# Review 6 task backend — Huy

Ngày thực hiện: 08/10/2026. Phạm vi theo các card Trello và ERD v1.0 đã chốt.

## Authentication Core

- Đã triển khai Register/Login với PostgreSQL thật, bcrypt và JWT HS256.
- Role/status được server đặt USER/ACTIVE; email không phân biệt hoa thường.
- JWT kiểm tra signature, algorithm, issuer, audience, expiry, issued-at và identity.
- Test unit và integration PostgreSQL đã đạt: đăng ký/đăng nhập, validation, email trùng, mật khẩu Unicode, tài khoản inactive, JWT sai/hết hạn, HTTP envelope.
- Không đưa password hash hoặc lỗi SQL/credential vào response/log.
- CI đã bổ sung PostgreSQL riêng; trạng thái chạy trên GitHub được ghi sau khi có PR.

## Môi trường kiểm thử

`TEST_DATABASE_URL` chỉ chấp nhận host local/CI và tên DB kết thúc `_test`. Mỗi test dùng schema riêng và tự dọn schema; không đọc `DATABASE_URL` của Neon.

Lệnh chạy từ `backend/`:

```text
go test -count=1 ./...
go vet ./...
go build ./...
```

Các task còn lại đang được triển khai; chưa ghi nhận hoàn thành hoặc QA staging.
