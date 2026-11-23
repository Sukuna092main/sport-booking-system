# Hướng dẫn cấu hình cho thành viên nhóm

Tài liệu này dùng cùng `sport-booking-system-share.zip`. Gói có `.env.example`, không có credential thật. Mỗi người tự tạo `.env` riêng; không gửi `.env` qua nhóm chat, commit Git hoặc đưa vào báo cáo.

## 1. Chạy bản local trước

Yêu cầu: Docker Desktop đang chạy. Giải nén project, mở PowerShell tại thư mục gốc rồi chạy:

```powershell
.\scripts\dev\Initialize-LocalEnv.ps1
docker compose up --build -d
docker compose ps
```

Script tạo `.env` từ `.env.example`, sinh `JWT_SECRET`, `EMAIL_ENCRYPTION_KEY` và `POSTGRES_PASSWORD` ngẫu nhiên, đồng thời không ghi đè `.env` đã có. Không cần cài Go để chạy cả stack Docker. Nếu `.env` đã tồn tại, tự kiểm tra rồi chỉnh file đó; không xóa hoặc ghi đè credential của người khác.

- Frontend: `http://localhost:5173`
- API: `http://localhost:8080/api/v1`
- Kiểm tra API: `http://localhost:8080/api/v1/ping`
- Swagger: `http://localhost:8080/api/v1/docs`

Compose dùng PostgreSQL local riêng và tự chạy migrations trên DB local. Giá trị `DATABASE_URL` trong `.env` bị Compose ghi đè thành kết nối nội bộ tới container `db`; stack local không tự kết nối Neon. Mặc định thanh toán Stripe và gửi email tắt để người chưa có credential vẫn chạy được ứng dụng.

Đăng ký một tài khoản local. Nếu cần cấu hình dữ liệu demo, nâng tài khoản đó lên ADMIN **chỉ trên DB local**:

```powershell
docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Trong `psql`, thay email bằng email local vừa đăng ký:

```sql
UPDATE users SET role='ADMIN' WHERE email='email-ban-vua-dang-ky';
```

Thoát bằng `\q`. Dùng Swagger để tạo loại thể thao, sân, lịch hoạt động và khung giờ trước khi thử booking. Không dùng lệnh nâng quyền này trên Neon hoặc DB dùng chung.

## 2. Cấu hình email/SMTP

Người phụ trách cần nhận thông tin SMTP từ chủ mail relay/nhà cung cấp. Không tự điền password cá nhân hoặc gửi credential vào nhóm chat. Mở `.env` trên máy chạy API/worker và điền:

```dotenv
EMAIL_ENABLED=true
EMAIL_WORKER_ENABLED=true
EMAIL_WORKER_POLL_INTERVAL=30s
EMAIL_ENCRYPTION_KEY=<giữ khóa do Initialize-LocalEnv.ps1 tạo>
SMTP_HOST=<SMTP host do nhà cung cấp cấp>
SMTP_PORT=587
SMTP_USERNAME=<SMTP username nếu nhà cung cấp yêu cầu>
SMTP_PASSWORD=<SMTP password/app credential do nhà cung cấp cấp>
SMTP_FROM=<địa chỉ gửi đã được nhà cung cấp xác nhận>
SMTP_USE_TLS=true
```

`SMTP_FROM` phải là địa chỉ gửi hợp lệ được mail provider cho phép. Nếu provider dùng cổng hoặc kiểu TLS khác, nhập đúng thông số provider yêu cầu. Chỉ bật email sau khi đã có SMTP credential; thiếu host/from hoặc khóa mã hóa sẽ khiến API/worker báo cấu hình không hợp lệ.

Sau khi sửa `.env`, tạo lại API và worker để chúng nhận cấu hình mới:

```powershell
docker compose up -d --build --force-recreate backend worker
docker compose logs --tail=100 backend worker
```

Worker cần cùng `EMAIL_ENCRYPTION_KEY` với API vì API mã hóa nội dung email trong outbox và worker giải mã trước khi gửi. Nếu dùng chung DB hoặc có nhiều API/worker, dùng một khóa ổn định được lưu trong secret manager và cấp an toàn cho các instance; không chạy initializer riêng trên từng instance để tạo các khóa khác nhau. Không xoay khóa khi còn email outbox đã mã hóa bằng khóa cũ.

Kiểm tra luồng bằng chức năng quên mật khẩu trên frontend và xác nhận email tới hộp thư thử nghiệm. Không chụp/gửi log hoặc ảnh có SMTP username, password hay token reset.

## 3. Cấu hình Stripe Checkout

Trong file env riêng, dùng cấu hình sau. Lấy khóa test từ Stripe Dashboard và webhook secret từ endpoint hoặc phiên Stripe CLI đang dùng.

```dotenv
PAYMENT_ENABLED=true
PAYMENT_PROVIDER=stripe
PAYMENT_DEPOSIT_BPS=3000
PAYMENT_HOLD_TTL=35m
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
```

API dùng STRIPE_SECRET_KEY để tạo Stripe Checkout Session qua HTTPS. STRIPE_PUBLISHABLE_KEY dành cho ứng dụng khách tích hợp Stripe.js. Luồng Checkout hosted trả checkoutUrl trực tiếp. Số tiền VND gửi nguyên số đồng, vì VND là zero-decimal currency của Stripe.

Đăng ký POST /api/v1/payments/stripe/webhook tại Stripe Dashboard. Khi phát triển local có thể dùng:

```powershell
stripe listen --forward-to localhost:8080/api/v1/payments/stripe/webhook
```

Điền whsec của phiên CLI đó vào STRIPE_WEBHOOK_SECRET rồi khởi động lại backend. Endpoint nhận checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed và checkout.session.expired. Session completed chỉ xác nhận nếu payment_status là paid. Webhook dùng raw body, kiểm tra Stripe-Signature và thời gian ký, đối chiếu tiền/currency/reference rồi ghi trạng thái trong transaction.

ADMIN cấu hình giá qua PUT /api/v1/admin/courts/{courtId}/pricing. POST /api/v1/bookings tạo giữ chỗ. POST /api/v1/bookings/{bookingId}/payments trả checkoutUrl để chuyển khách sang Stripe. GET cùng đường dẫn trả bookingStatus, tổng tiền, tiền cọc, tiền còn lại và giao dịch mới nhất. Trang success/cancel cần đọc lại trạng thái API. Webhook mới quyết định trạng thái thanh toán.

Checkout Session yêu cầu ít nhất 30 phút còn lại khi tạo. Backend mặc định giữ chỗ 35 phút và từ chối giữ chỗ quá sát giờ chơi. Nếu tạo checkout sau khi thời gian còn lại dưới 30 phút, API trả provider_unavailable. Worker giải phóng đơn hết hạn. Khoản tiền nhận sau hạn được ghi PAID_REVIEW để người quản lý đối soát. Chính sách hoàn tiền tự động nằm ngoài luồng hiện tại.

Migration 00015 giữ lịch sử giao dịch và áp dụng trigger chỉ cho tạo giao dịch Stripe mới. Rollback gỡ trigger và giữ nguyên dữ liệu; trước khi hạ phiên bản ứng dụng cần kiểm tra khả năng đọc lịch sử Stripe của phiên bản đích.

Tài liệu chính thức:
- https://docs.stripe.com/api/checkout/sessions/create
- https://docs.stripe.com/events/manage-webhook-endpoints
- https://docs.stripe.com/currencies


## 4. Kết nối Neon dùng chung

Ưu tiên mỗi người dùng PostgreSQL local riêng để phát triển. Nếu cần DB chung, người phụ trách Neon tạo nhánh/dev database và cấp từng người connection string/quyền phù hợp qua kênh bảo mật của nhóm. Không dùng owner credential hoặc production DB cho thử nghiệm thông thường.

Đặt `DATABASE_URL` trong `.env` thành connection string được cấp, có TLS (`sslmode=require`). `scripts/dev/Start-BackendNeon.ps1` chạy API local với `.env` root nhưng **không** chạy migration. Chủ DB phải review và áp dụng migration còn thiếu theo đúng thứ tự đến `00014` trên nhánh dev trước khi kết nối. Compose vẫn dùng DB local của nó; không đổi service migration để trỏ Neon.

Nếu nhiều backend instance cùng kết nối một DB, chúng cần cùng `JWT_SECRET` ổn định để token phát hành ở instance này dùng được ở instance khác, và cùng `EMAIL_ENCRYPTION_KEY` nếu xử lý chung email outbox. Chủ nhóm phải quản lý các khóa đó tập trung; từng thành viên chạy initializer riêng phù hợp cho DB local riêng, không phù hợp khi chạy nhiều instance vào chung DB.

## 5. Checklist bàn giao

- [ ] Gửi ZIP và tài liệu này; không gửi `.env` thật.
- [ ] Thành viên chạy local stack, `docker compose ps` cho thấy DB, migration, API, worker và frontend hoạt động.
- [ ] API ping được và Swagger mở được.
- [ ] Email chỉ bật sau khi SMTP gửi thử thành công; worker dùng đúng encryption key.
- [ ] Kiểm tra Stripe Checkout và webhook bằng bộ khóa test của nhóm.
- [ ] Neon chỉ dùng đúng nhánh/DB được cấp; migration đã được người phụ trách review.
- [ ] Báo lại kết quả, lỗi và request ID; không gửi credential, refresh cookie, password hoặc reset token.
