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
| Tạo booking, retry an toàn | POST `/bookings` + `Idempotency-Key` | USER/ADMIN, chính mình |
| Lịch sử của tôi | GET `/bookings?page=1&pageSize=20&status=CONFIRMED` | USER/ADMIN, chính mình |
| Chi tiết booking của tôi | GET `/bookings/{bookingId}` | Chủ sở hữu |
| Hủy booking của tôi | POST `/bookings/{bookingId}/cancel` | Chủ sở hữu, trước slot đầu tiên |

Booking và các API Admin đã triển khai: SportType/Court CRUD xóa mềm, lịch/slot, blackout, booking list/detail/cancel có lý do và thống kê. Tất cả route `/api/v1/admin` yêu cầu ADMIN theo role hiện tại trong DB. Xem [hợp đồng và hướng dẫn Booking](internal/Booking/README.md).

## Chạy backend

Để chạy trên máy với Neon từ cấu hình sẵn trong `.env` ở root repo, dùng PowerShell tại root:

```powershell
& .\scripts\dev\Start-BackendNeon.ps1
```

Script kiểm tra đích Neon/TLS, nạp biến môi trường allowlist và chạy API. Dùng secret ổn định được tạo/lưu cục bộ trong `.env`; không đổi mỗi lần khởi động môi trường chung. Xem [hướng dẫn launcher](../scripts/dev/README.md). Không cần bật backend/DB Docker cho chế độ này.

Go 1.25+. Ứng dụng đọc biến môi trường, không tự nạp `.env`. Dùng [mẫu cấu hình root](../.env.example); lệnh launcher nạp riêng biến được backend hỗ trợ.

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

Preflight `OPTIONS` từ origin trong allowlist trả 204, hỗ trợ các method REST và headers `Authorization`, `Content-Type`, `Accept`, `X-Request-ID`, `Idempotency-Key`. Origin/header/method không được phép khiến preflight trả lỗi. Response từ origin cho phép expose `X-Request-ID` và bật credentials để frontend gửi/nhận refresh cookie HttpOnly. Không dùng wildcard; `RequireAllowedOrigin` kiểm tra origin với thao tác refresh/logout dùng cookie. CORS kiểm soát quyền trình duyệt đọc response; JWT và role middleware tiếp tục kiểm soát API, kể cả với curl hoặc Swagger cùng origin.

### Docker cục bộ

Từ root repo chạy `.\scripts\dev\Initialize-LocalEnv.ps1`, sau đó `docker compose up --build`. Compose dùng DB cục bộ, volume riêng và chạy Goose migrations trên DB local. Không đổi dịch vụ migrate sang Neon nếu chưa được chủ sở hữu DB xác nhận.

### Auth, thanh toán và email

- `REFRESH_TOKEN_TTL`, `PASSWORD_RESET_TTL`, `REFRESH_COOKIE_SECURE`, `REFRESH_COOKIE_SAME_SITE`, `FRONTEND_PUBLIC_URL`, `CORS_ALLOWED_ORIGINS` cấu hình refresh cookie và reset link. Cookie production phải Secure; frontend origin cần nằm trong CORS allowlist. `SameSite=none` chỉ dùng khi frontend/API thật sự khác site và luôn cần Secure/HTTPS.
- Mẫu root `.env.example` liệt kê đầy đủ biến runtime cho API, worker, frontend và Compose, kể cả các HTTP timeout. `scripts/dev/Initialize-LocalEnv.ps1` tạo `.env` local và sinh JWT/AES/PostgreSQL secrets; Neon, SMTP và merchant credential vẫn phải do chủ tài khoản cấp.
- `PAYMENT_ENABLED=false` mặc định. Bật Stripe bằng `PAYMENT_PROVIDER=stripe`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` và `PAYMENT_HOLD_TTL=35m`. ADMIN đặt giá sân qua `PUT /admin/courts/{courtId}/pricing`. Webhook nhận ở `POST /payments/stripe/webhook`.
- Email đặt lịch và password reset cần bật đồng thời `EMAIL_ENABLED=true` và `EMAIL_WORKER_ENABLED=true`; điền SMTP settings (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM`, `SMTP_USE_TLS`) theo SMTP relay của bạn. `EMAIL_ENCRYPTION_KEY` là khóa AES-GCM 32 byte dạng Base64, được script local sinh sẵn. Không commit hoặc gửi `.env` có credential thật.
- API server không chạy migration tự động. Trên môi trường dùng chung, người có trách nhiệm DB phải review backup/rollback rồi áp dụng migrations theo quy trình riêng.

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


## Chạy với một file cấu hình riêng

Chạy từ thư mục gốc trên PowerShell. Các lệnh bên dưới dùng file cấu hình riêng nếu bạn có file đó.

```powershell
.\scripts\dev\Start-BackendNeon.ps1 -EnvFile backend/.env.integration -CheckConfig
```

Lệnh trên chỉ kiểm tra cấu hình. Để chạy với PostgreSQL local, dùng Docker Compose:

```powershell
$env:SPORT_BOOKING_ENV_FILE = "backend/.env.integration"
docker compose --env-file $env:SPORT_BOOKING_ENV_FILE up --build db migrate backend worker
```

Compose chạy DB riêng và thay `DATABASE_URL` của API và worker bằng địa chỉ DB nội bộ. Nếu đã có volume PostgreSQL local, giữ thông tin đăng nhập dùng khi tạo volume hoặc chạy project Compose với tên khác. Với Neon đã được áp dụng migration, dùng launcher với `-EnvFile` cho API và thêm `-Worker` ở cửa sổ thứ hai để xử lý email và giải phóng các giữ chỗ hết hạn. Xem [hướng dẫn đầy đủ](../docs/TEAM_INTEGRATION_SETUP.md).

Đăng xuất thu hồi phiên hiện tại. Đăng xuất mọi thiết bị, đổi mật khẩu và đặt lại mật khẩu thu hồi toàn bộ phiên. Frontend gửi cookie qua `credentials: "include"` khi gọi các API phiên đăng nhập. Với Stripe, webhook đã xác thực xác nhận thanh toán. Trang return đọc trạng thái từ API. Giao dịch đến muộn được lưu với trạng thái `PAID_REVIEW` để đối soát thủ công.

Worker xếp lịch nhắc 24 giờ trước slot đầu tiên nếu thời điểm nhắc vẫn còn ở tương lai. Khi gửi, worker kiểm tra đơn còn xác nhận và chưa bắt đầu. Nếu SMTP nhận thư ngay trước khi worker hoặc DB gặp lỗi, lần retry sau có thể gửi lại thư.
