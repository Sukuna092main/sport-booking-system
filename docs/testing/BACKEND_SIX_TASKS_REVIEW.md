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

## Court / Schedule / Blackout Data Foundation

- Giữ 10 migration đã bàn giao; migration 00011 bổ sung ràng buộc theo ERD.
- Sửa unique slot/ngày thành partial unique khi `released_at IS NULL`; bắt buộc request_hash; chặn lịch/slot active chồng nhau bằng GiST.
- Fixture SQL riêng có sân active/inactive, sport inactive, giờ tuần, slot, blackout, booking confirmed/cancelled và template cũ đã inactive.
- Availability dùng predicate khoảng thời gian `[start,end)` độc lập với eligibility và giới hạn người dùng.
- Migration không tự chạy lúc khởi động. DB chung cần kiểm tra dữ liệu cũ trước khi áp dụng; không tự sửa hash lịch sử hoặc reset Neon.

## Basic Profile & Ownership API

- GET/PATCH `/users/me` lấy ID từ context đã xác thực.
- PATCH chỉ cho phép fullName/phone; bỏ qua trường không gửi, phone:null xóa số điện thoại, cập nhật updatedAt.
- Test HTTP với hai tài khoản kiểm tra đọc/sửa chính mình, chặn id/userId/email/role/status/password, validation và persistence.
- Kiểm tra tài khoản inactive và tài khoản đã xóa ngay khi JWT còn hạn.

## Court Browse / Search / Detail API

- Public GET `/sport-types`, `/courts`, `/courts/{courtId}` chỉ trả sân/sport active.
- Tìm tên/mã không phân biệt hoa thường; q tối đa 100 ký tự; ký tự %, dấu nháy được tìm như ký tự thường.
- Lọc sportTypeId, phân trang 1/20, pageSize tối đa 100; count và danh sách dùng cùng snapshot, thứ tự code/id ổn định.
- Test HTTP/PostgreSQL đã có search/filter/pagination/empty, UUID sai, inactive, giá decimal string và input injection.

## Môi trường kiểm thử

`TEST_DATABASE_URL` chỉ chấp nhận host local/CI và tên DB kết thúc `_test`. Mỗi test dùng schema riêng và tự dọn schema; không đọc `DATABASE_URL` của Neon.

Lệnh chạy từ `backend/`:

```text
go test -count=1 ./...
go vet ./...
go build ./...
```

Các task còn lại đang được triển khai; chưa ghi nhận hoàn thành hoặc QA staging.
