# Backend — Go/Gin Modular Monolith

Luồng xử lý: Handler → Service → Repository. PostgreSQL do Goose quản lý; server không AutoMigrate hoặc tự seed.

## API đã triển khai

Base path `/api/v1`. Swagger: `/api/v1/docs`; spec: `/api/v1/openapi.yaml`.

| Chức năng | Method và đường dẫn | Quyền |
| --- | --- | --- |
| Kiểm tra tiến trình | GET `/ping` | Public |
| Đăng ký | POST `/auth/register` | Public |
| Đăng nhập | POST `/auth/login` | Public |
| Hồ sơ của tôi | GET `/users/me` | USER/ADMIN |
| Sửa họ tên/số điện thoại | PATCH `/users/me` | USER/ADMIN |
| Loại thể thao | GET `/sport-types` | Public |
| Tìm/lọc/phân trang sân | GET `/courts` | Public |
| Chi tiết sân | GET `/courts/{courtId}` | Public |
| Slot theo ngày | GET `/courts/{courtId}/availability?date=YYYY-MM-DD` | Public |

Booking và Admin CRUD là các task tiếp theo, còn `planned` trong Swagger. Guard ADMIN đã có và được test, chưa đăng ký route CRUD chưa triển khai.

## Chạy backend

Go 1.25+. Ứng dụng đọc biến môi trường, không tự nạp `.env`. Dùng [`.env.example`](.env.example) làm danh sách cấu hình.

```powershell
$env:APP_ENV = "development"
$env:APP_TIMEZONE = "Asia/Ho_Chi_Minh"
$env:HTTP_ADDR = ":8080"
$env:DATABASE_URL = "<PostgreSQL URL của môi trường đã được cấp quyền>"
# Tạo secret dev; môi trường chung dùng secret ổn định từ secret manager.
$jwtBytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($jwtBytes)
$env:JWT_SECRET = [Convert]::ToBase64String($jwtBytes)
$env:JWT_TTL = "15m"
cd backend
go run ./cmd/api
```

JWT_SECRET tối thiểu 32 byte; TTL từ 1 phút đến 24 giờ. Không đổi secret mỗi lần khởi động môi trường chung: token cũ sẽ mất hiệu lực. Production/Neon bắt buộc TLS. Log không ghi body, Authorization, hash mật khẩu hoặc SQL parameters.

### CORS khi tích hợp frontend

Đặt `CORS_ALLOWED_ORIGINS` thành danh sách origin FE thật, phân cách bằng dấu phẩy. Origin gồm scheme, host và port nếu có; không chứa đường dẫn `/api/v1`, query, credential hoặc wildcard. Ví dụ local:

```powershell
$env:CORS_ALLOWED_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173"
```

Khi biến chưa được đặt, development dùng hai origin local trên; test/production dùng allowlist rỗng. Đặt biến thành chuỗi rỗng để đóng CORS. Cấu hình sai làm server từ chối khởi động. Với online, Hưng cấu hình origin HTTPS thật do Duy bàn giao rồi redeploy; phải smoke trên URL thực tế.

Preflight `OPTIONS` từ origin trong allowlist trả 204, hỗ trợ các method REST và headers `Authorization`, `Content-Type`, `Accept`, `X-Request-ID`. Origin/header/method không được phép khiến preflight trả lỗi. Response thực từ origin được phép vẫn giữ mã lỗi Auth 400/401/403 và expose `X-Request-ID`. Không bật cookie credentials. CORS kiểm soát quyền trình duyệt đọc response; JWT và role middleware tiếp tục kiểm soát API, kể cả với curl hoặc Swagger cùng origin.

### Docker cục bộ

Tạo JWT_SECRET trong shell như trên, rồi từ root repo chạy `docker compose up --build`. Compose dùng DB cục bộ và volume riêng. Không đổi URL dịch vụ migrate sang Neon nếu chưa kiểm tra migration/dữ liệu với người quản lý DB.

### Migration 00011

Bổ sung constraint theo ERD v1.0 và sửa slot đã hủy có thể đặt lại. Trên DB đã có dữ liệu, kiểm tra trước: request_hash NULL, giờ/template active chồng nhau, mã currency sai. Migration từ chối dữ liệu lệch; không tự tạo hash lịch sử hoặc xóa booking. Goose Down 00011 có thể bị chặn nếu đã có lịch sử hủy rồi đặt lại cùng slot/ngày; cần review dữ liệu trước rollback.

## Ví dụ gọi API

```powershell
$base = "http://localhost:8080/api/v1"
$login = Invoke-RestMethod "$base/auth/login" -Method Post -ContentType "application/json" -Body '{"email":"huy@example.com","password":"your-password"}'
$headers = @{ Authorization = "Bearer $($login.data.accessToken)" }
Invoke-RestMethod "$base/users/me" -Headers $headers
Invoke-RestMethod "$base/users/me" -Method Patch -Headers $headers -ContentType "application/json" -Body '{"fullName":"Huy","phone":null}'
Invoke-RestMethod "$base/courts?q=badminton&page=1&pageSize=20"
```

Đăng ký với email/password/fullName, phone tùy chọn. Password ít nhất 8 ký tự, tối đa 72 byte UTF-8; không tự trim. Đăng ký trả user, đăng nhập mới trả token. PATCH chỉ nhận fullName/phone, phone:null xóa số điện thoại. Tài khoản inactive bị chặn ngay cả khi JWT còn hạn.

Availability dùng ngày địa phương của sân, từ hôm nay đến +30 ngày lịch. Chỉ trả template hợp lệ trong giờ hoạt động; slot quá khứ, bị chặn hoặc có booking chưa giải phóng trả available:false. Giờ DST mơ hồ/không tồn tại bị loại. Kết quả là snapshot lúc đọc; Booking Create phải kiểm tra lại trong transaction.

## Test và review

```powershell
# DB kiểm thử riêng, tên kết thúc _test; không dùng URL Neon.
$env:TEST_DATABASE_URL = "postgresql://postgres:local-test-only@localhost:55432/sport_booking_test?sslmode=disable"
cd backend
go test -race -count=1 ./...
go vet ./...
go build ./...
```

Không có TEST_DATABASE_URL thì các test integration skip; unit vẫn chạy. CI có PostgreSQL riêng và chạy cả unit/integration/race. Test tạo schema riêng và tự dọn; [fixture](testdata/court_foundation.sql) chỉ dùng test, không chạy tự động lúc server khởi động.

Xem [kết quả review 6 task](../docs/testing/BACKEND_SIX_TASKS_REVIEW.md).
