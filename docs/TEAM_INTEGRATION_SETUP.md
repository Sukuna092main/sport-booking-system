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

Compose dùng PostgreSQL local riêng và tự chạy migrations trên DB local. Giá trị `DATABASE_URL` trong `.env` bị Compose ghi đè thành kết nối nội bộ tới container `db`; stack local không tự kết nối Neon. Mặc định VNPAY và gửi email tắt để người chưa có credential vẫn chạy được ứng dụng.

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

## 3. Cấu hình VNPAY sandbox

Đầu mối tích hợp phải xin merchant sandbox credentials và callback/domain từ người quản lý tài khoản VNPAY của nhóm. Mẫu repository không chứa `VNPAY_TMN_CODE` hoặc `VNPAY_HASH_SECRET`; không dùng giá trị tự nghĩ ra.

Điền `.env` trên đúng môi trường chạy API:

```dotenv
PAYMENT_ENABLED=true
PAYMENT_PROVIDER=vnpay
PAYMENT_DEPOSIT_BPS=3000
PAYMENT_HOLD_TTL=10m
VNPAY_TMN_CODE=<merchant code do chủ tài khoản cấp>
VNPAY_HASH_SECRET=<hash secret do chủ tài khoản cấp>
VNPAY_PAYMENT_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_RETURN_URL=https://<public-api-domain>/api/v1/payments/vnpay/return
VNPAY_IPN_URL=https://<public-api-domain>/api/v1/payments/vnpay/ipn
```

Thay `<public-api-domain>` bằng domain API HTTPS thật. Không giữ dấu ngoặc nhọn và không dùng `localhost`: VNPAY cần gọi được IPN URL từ bên ngoài. Nếu chưa có API HTTPS truy cập công khai thì dùng `PAYMENT_PROVIDER=mock` để demo local; đừng bật VNPAY với callback giả. Với sandbox, dùng sandbox merchant và payment URL sandbox; production cần bộ credential, URL và cấu hình riêng của production.

Sau khi lưu `.env`, tạo lại API và worker như phần email. ADMIN phải cấu hình giá cho từng sân bằng Swagger tại `PUT /api/v1/admin/courts/{courtId}/pricing`. Tạo booking, bắt đầu checkout ở `POST /api/v1/bookings/{bookingId}/payments`, hoàn tất giao dịch sandbox và kiểm tra trạng thái trong trang kết quả/lịch sử đặt sân. Số tiền mỗi lần thanh toán VNPAY phải đạt mức tối thiểu VNPAY mà backend kiểm tra (5.000 VND). Trạng thái cuối được xác nhận qua IPN đã kiểm tra chữ ký; không kết luận giao dịch thành công chỉ từ trang return của trình duyệt.

Nếu nhiều thành viên cùng dùng một môi trường API/DB, chỉ người được giao quản lý tích hợp mới giữ merchant secret; các API instance phải dùng cùng cấu hình ổn định. Không để secret xuất hiện trong source, ZIP, log, ảnh chụp màn hình hoặc PR.

## 4. Kết nối Neon dùng chung

Ưu tiên mỗi người dùng PostgreSQL local riêng để phát triển. Nếu cần DB chung, người phụ trách Neon tạo nhánh/dev database và cấp từng người connection string/quyền phù hợp qua kênh bảo mật của nhóm. Không dùng owner credential hoặc production DB cho thử nghiệm thông thường.

Đặt `DATABASE_URL` trong `.env` thành connection string được cấp, có TLS (`sslmode=require`). `scripts/dev/Start-BackendNeon.ps1` chạy API local với `.env` root nhưng **không** chạy migration. Chủ DB phải review và áp dụng migration còn thiếu theo đúng thứ tự đến `00014` trên nhánh dev trước khi kết nối. Compose vẫn dùng DB local của nó; không đổi service migration để trỏ Neon.

Nếu nhiều backend instance cùng kết nối một DB, chúng cần cùng `JWT_SECRET` ổn định để token phát hành ở instance này dùng được ở instance khác, và cùng `EMAIL_ENCRYPTION_KEY` nếu xử lý chung email outbox. Chủ nhóm phải quản lý các khóa đó tập trung; từng thành viên chạy initializer riêng phù hợp cho DB local riêng, không phù hợp khi chạy nhiều instance vào chung DB.

## 5. Checklist bàn giao

- [ ] Gửi ZIP và tài liệu này; không gửi `.env` thật.
- [ ] Thành viên chạy local stack, `docker compose ps` cho thấy DB, migration, API, worker và frontend hoạt động.
- [ ] API ping được và Swagger mở được.
- [ ] Email chỉ bật sau khi SMTP gửi thử thành công; worker dùng đúng encryption key.
- [ ] VNPAY chỉ bật sau khi có sandbox credential và callback HTTPS công khai; kiểm tra IPN và trạng thái thanh toán.
- [ ] Neon chỉ dùng đúng nhánh/DB được cấp; migration đã được người phụ trách review.
- [ ] Báo lại kết quả, lỗi và request ID; không gửi credential, refresh cookie, password hoặc reset token.
