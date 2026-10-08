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

## Availability Read API & Exclusion Rules

- GET `/courts/{courtId}/availability?date=YYYY-MM-DD` đọc snapshot nhất quán, theo APP_TIMEZONE, timestamp UTC.
- Ngày từ hôm nay đến +30 ngày lịch; loại sân inactive, template inactive/sai thứ/sai thời lượng/ngoài giờ, giờ DST mơ hồ hoặc không tồn tại.
- Slot quá khứ, blackout active và booking confirmed chưa released có overlap được đánh dấu false; dùng snapshot giờ thực tế dù template cũ đã inactive.
- Booking cancelled/released không chặn, khoảng sát nhau được phép, slots sắp theo thời gian; ngày đóng cửa trả [].
- Test unit/HTTP/PostgreSQL gồm horizon theo ngày địa phương, DST/giờ bị nhảy, partial blackout, template cũ, cancelled và released.
- Kết quả chỉ là trạng thái lúc đọc; task Booking Create phải kiểm tra lại trong transaction.

## Môi trường kiểm thử

`TEST_DATABASE_URL` chỉ chấp nhận host local/CI và tên DB kết thúc `_test`. Mỗi test dùng schema riêng và tự dọn schema; không đọc `DATABASE_URL` của Neon.

Lệnh chạy từ `backend/`:

```text
go test -race -count=1 ./...
go vet ./...
go build ./...
```

## Kết quả review tích hợp

- 52 test/case đã đạt với race detector, không có test integration bị skip.
- 20 kiểm tra HTTP qua server thật đã đạt: Auth/Profile/Court/Availability, validation, error envelope và Swagger.
- `go vet ./...`, build Windows và build Linux CGO_ENABLED=0 đã đạt.
- Goose thực tế: Up 11 migration → Down về 0 → Up 11 migration, đều đạt trên DB kiểm thử riêng.
- Bổ sung test đăng ký trùng email đồng thời, PATCH hai trường đồng thời, precision numeric và đối chiếu toàn bộ route implemented với Swagger.
- Đã tự review theo quyền Huy giao. Chưa xác nhận QA Neon/staging; không thay dữ liệu DB chung.

## GitHub và tên nhánh

Tài khoản dùng: `huyhcm2k5it`. Đã đăng xuất `phuhuyhcm` khỏi Git Credential Manager.
Nhánh theo quy định Huy chốt: `be_auth_register_login`, `be_auth_role_middleware`,
`be_court_data_foundation`, `be_user_profile`, `be_court_list_detail`, `be_court_availability`.
Mỗi task có PR vào develop; chỉ merge khi Backend/Frontend CI đạt.

| Task | PR |
| --- | --- |
| Authentication Core | [#7](https://github.com/Sukuna092main/sport-booking-system/pull/7) |
| Authorization Middleware | [#8](https://github.com/Sukuna092main/sport-booking-system/pull/8) |
| Data Foundation | [#9](https://github.com/Sukuna092main/sport-booking-system/pull/9) |
| Basic Profile & Ownership | [#10](https://github.com/Sukuna092main/sport-booking-system/pull/10) |
| Court Browse/Search/Detail | [#11](https://github.com/Sukuna092main/sport-booking-system/pull/11) |
| Availability Read & Exclusion Rules | [#12](https://github.com/Sukuna092main/sport-booking-system/pull/12) |

Kết quả CI/merge xem trực tiếp trong từng PR; các kiểm tra phải đạt trên đúng SHA được merge.

Raw evidence nằm trong `artifacts/backend-six-tasks/` (gitignored); báo cáo này là bản tóm tắt để review.
