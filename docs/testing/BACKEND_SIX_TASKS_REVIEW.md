# Review 6 task backend — Huy

Ngày thực hiện: 08/10/2026. Phạm vi theo các card Trello và ERD v1.0 đã chốt.

## Authentication Core

- Đã triển khai Register/Login với PostgreSQL thật, bcrypt và JWT HS256.
- Role/status được server đặt USER/ACTIVE; email không phân biệt hoa thường.
- JWT kiểm tra signature, algorithm, issuer, audience, expiry, issued-at và identity.
- Test unit và integration PostgreSQL đã đạt: đăng ký/đăng nhập, validation, email trùng, mật khẩu Unicode, tài khoản inactive, JWT sai/hết hạn, HTTP envelope.
- Không đưa password hash hoặc lỗi SQL/credential vào response/log.
- CI đã bổ sung PostgreSQL riêng; trạng thái chạy trên GitHub được ghi sau khi có PR.

## Authorization & Role Middleware

- Bearer token được xác thực trước khi nạp tài khoản từ DB vào request context.
- DB role/status là nguồn quyết định; kiểm tra token thiếu/sai/hết hạn, user đã xóa, inactive, USER bị chặn và ADMIN được phép.
- Route ADMIN dùng để test chỉ nằm trong test, không tạo endpoint debug trên server.
- Recovery trả ErrorResponse với requestId; test xác nhận panic không làm lộ secret.

## Môi trường kiểm thử

`TEST_DATABASE_URL` chỉ chấp nhận host local/CI và tên DB kết thúc `_test`. Mỗi test dùng schema riêng và tự dọn schema; không đọc `DATABASE_URL` của Neon.

Lệnh chạy từ `backend/`:

```text
go test -count=1 ./...
go vet ./...
go build ./...
```

Các task còn lại đang được triển khai; chưa ghi nhận hoàn thành hoặc QA staging.
