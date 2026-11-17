# Sport Booking System

Ứng dụng đặt sân theo kiến trúc modular monolith: API Go/Gin, PostgreSQL, frontend React/Vite. Booking, Auth, Admin và cấu hình API hiện có trong `backend/`; các tính năng refresh/reset/change password, đặt cọc/thanh toán và email outbox được bật theo cấu hình. Xem chi tiết endpoint tại [backend README](backend/README.md) và [frontend README](frontend/README.md).

Gửi dự án cho thành viên nhóm: dùng [hướng dẫn cấu hình `.env`, Neon, VNPAY và SMTP](docs/TEAM_INTEGRATION_SETUP.md). Chỉ chia sẻ `.env.example`; mỗi người tạo `.env` riêng với credential được cấp cho họ.

## Chạy nhanh trên máy mới (Windows / PowerShell)

Yêu cầu: Docker Desktop đang chạy. Tại thư mục gốc repository:

```powershell
.\scripts\dev\Initialize-LocalEnv.ps1
docker compose up --build
```

Lệnh khởi tạo chỉ tạo file `.env` chưa có, sinh JWT key, khóa mã hóa email và mật khẩu PostgreSQL local ngẫu nhiên. Nếu `.env` đã tồn tại, script dừng và không ghi đè. Docker Compose áp dụng migration Goose lên PostgreSQL cục bộ trong volume `pgdata`, rồi chạy API, worker và frontend. Mặc định email và thanh toán trực tuyến tắt; API dùng mock gateway khi bật thanh toán trong môi trường development.

Mở frontend ở `http://localhost:5173`, API ở `http://localhost:8080/api/v1`, health check ở `http://localhost:8080/api/v1/ping`. Swagger: `http://localhost:8080/api/v1/docs`.

DB local mới khởi động rỗng. Đăng ký tài khoản qua giao diện trước, rồi nếu cần tạo dữ liệu demo thì chỉ nâng quyền tài khoản local đó lên ADMIN:

```powershell
docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Trong prompt `psql`, chạy `UPDATE users SET role='ADMIN' WHERE email='email-ban-vua-dang-ky';` rồi thoát bằng `\q`. Chỉ dùng thao tác này trên DB local của bạn; không dùng trên Neon hoặc DB dùng chung. Sau đó tạo loại thể thao, sân và lịch giờ qua Swagger/Admin API. Muốn thử đặt cọc bằng mock, bật `PAYMENT_ENABLED=true` trong `.env`, khởi động lại backend và cấu hình giá sân cho ADMIN.

## Kết nối Neon được cấp quyền

Người chạy cần tự nhận connection string có quyền từ chủ sở hữu DB và đặt vào `DATABASE_URL` trong `.env`. Không gửi connection string, mật khẩu SMTP, VNPAY secret hay `.env` qua repository/chat. Sau đó có thể chạy API local trực tiếp:

```powershell
& .\scripts\dev\Start-BackendNeon.ps1
```

Script đọc `.env` ở thư mục gốc, kiểm tra host Neon và TLS rồi chạy API. Script không chạy migration, seed, xóa dữ liệu hoặc reset DB. Trên Neon, chủ sở hữu DB cần kiểm tra Goose version hiện tại, backup/preflight và áp dụng các migration còn thiếu tới `00014` theo thứ tự (bao gồm `00011` nếu DB chưa có) trước khi chạy bản backend này. Không chạy migration trên DB đang dùng chung nếu chưa phối hợp.

Nếu chỉ cần database local, dùng Docker Compose ở phần trên; Compose tự tạo PostgreSQL riêng và chạy migrations trên DB đó, không đụng Neon.

## Cấu hình tích hợp

- `.env.example` là danh sách biến an toàn để chia sẻ; `.env` chứa secret riêng và đã bị Git ignore.
- `.env.example` liệt kê cấu hình cho Compose, API, worker, frontend, timeout HTTP, PostgreSQL, auth, thanh toán và email. Script khởi tạo sinh secret local cho JWT, AES email và PostgreSQL; nó không thể tạo credential thay cho Neon, SMTP hay VNPAY.
- Để thử thanh toán local không cần merchant account, bật `PAYMENT_ENABLED=true` và giữ `PAYMENT_PROVIDER=mock`. Muốn dùng VNPAY, đặt `PAYMENT_PROVIDER=vnpay`, điền `VNPAY_TMN_CODE` và `VNPAY_HASH_SECRET` do chủ tài khoản merchant cấp, giữ đúng payment URL sandbox/prod, rồi đặt `VNPAY_RETURN_URL` và `VNPAY_IPN_URL` thành hai endpoint HTTPS thật có thể truy cập từ VNPAY. VNPAY không thể callback tới `localhost`.
- Để gửi email, bật cả `EMAIL_ENABLED=true` và `EMAIL_WORKER_ENABLED=true`; điền `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM` theo mail provider và bật TLS theo cấu hình provider. `EMAIL_ENCRYPTION_KEY` được script khởi tạo sinh sẵn. Không dùng password tài khoản cá nhân thay cho SMTP credential/app password do nhà cung cấp cấp.
- VNPAY, SMTP và Neon credential phải được cấp riêng cho từng người chạy; không chép secret của bạn vào ZIP/repository. Nếu bạn của bạn chỉ chạy stack local, Compose có PostgreSQL riêng và mock payment; để dùng chung Neon hoặc VNPAY, cần cấp đúng quyền/merchant access và endpoint tương ứng.
- Thanh toán yêu cầu ADMIN đặt giá cho từng sân. `PAYMENT_DEPOSIT_BPS=3000` (30%) và hold 10 phút là cấu hình demo có thể đổi, không phải chính sách thương mại đã chốt.
- Với môi trường production, cấu hình HTTPS, `REFRESH_COOKIE_SECURE=true`, `REFRESH_COOKIE_SAME_SITE` phù hợp với domain FE/API (dùng `none` chỉ khi thật sự cross-site và luôn bật Secure), CORS origin chính xác, secret ổn định từ secret manager, SMTP TLS và VNPAY credentials của môi trường tương ứng.

Không commit `.env`, credential, dump dữ liệu hay thông tin người dùng thật. `.env.example` không chứa credential dùng được.
