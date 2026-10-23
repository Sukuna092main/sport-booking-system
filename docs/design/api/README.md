# REST Contract và Swagger Base

**Phiên bản:** 0.3.0 · **Nguồn chuẩn:** [OpenAPI 3.0.3](../../../backend/internal/platform/openapi/openapi.yaml). Huy đã giao tự chốt triển khai 6 task backend; FE đối chiếu contract trước tích hợp.

## Cách mở

Chạy backend theo [hướng dẫn](../../../backend/README.md), rồi mở `http://localhost:8080/api/v1/docs`. File thô ở `http://localhost:8080/api/v1/openapi.yaml`. Trang Swagger dùng `swagger-ui-dist@5.11.0` từ unpkg; trình duyệt cần truy cập CDN để tải giao diện, còn file OpenAPI được server phục vụ cục bộ.

**Đã triển khai:** Ping, Register/Login, Profile GET/PATCH, Sport Types, Court Browse/Search/Detail và Availability. Mỗi operation có `x-implementation-status`; Booking và Admin CRUD vẫn là `planned`. Xem [cách chạy và ví dụ](../../../backend/README.md), [kết quả kiểm thử/review](../../testing/BACKEND_SIX_TASKS_REVIEW.md).

## Quy ước chung

| Mục | Quy ước |
| --- | --- |
| Base path | `/api/v1`; JSON UTF-8; tên trường camelCase. |
| Thành công | Endpoint nghiệp vụ trả `{ "data": ... }`; danh sách phân trang thêm `{ "meta": { "page", "pageSize", "total" } }`. DELETE thành công trả `204` không có body. `ping` là endpoint vận hành đã có sẵn, giữ nguyên body cũ. |
| Lỗi | `{ "error": { "code", "message", "requestId", "details"? } }`; `X-Request-ID` cùng giá trị với `error.requestId`. `details` là lỗi từng trường khi có. Không trả stack trace hay thông tin nội bộ. |
| Auth | `Authorization: Bearer <JWT>` cho route bảo vệ; claim `sub` là UUID người dùng, `role` là `USER`/`ADMIN`, có `iat`/`exp`. Route `/admin/*` đòi ADMIN. Không trả token trong log. |
| Ngày giờ | `bookingDate` và query `date` là `YYYY-MM-DD` theo `APP_TIMEZONE` của địa điểm; mẫu giờ là `HH:mm:ss` địa phương; timestamp trả UTC RFC 3339. Thứ dùng ISO 1–7. |
| Danh sách | `page` từ 1 (mặc định 1), `pageSize` từ 1–100 (mặc định 20). |
| Đặt sân | `Idempotency-Key` bắt buộc, opaque, 1–128 ký tự, phạm vi theo người dùng. Cùng khóa+nội dung trả booking gốc (`200`); khác nội dung trả `409 idempotency_conflict`. Tạo mới trả `201`. |
| Giá | `referencePriceAmount` là decimal string; chỉ hiển thị, không có thanh toán MVP. |
| DELETE | Chỉ dành cho ADMIN ngừng kích hoạt sport type, court và blackout (`isActive=false`); trả `204` không có body, gọi lại vẫn `204`. Không xóa vật lý dữ liệu đã tham chiếu. Booking dùng thao tác hủy, giữ lịch sử và audit. |

Mã lỗi ổn định cho FE: `validation_error` (400), `unauthorized`/`invalid_credentials` (401), `forbidden`/`account_inactive` (403), `not_found` (404), `method_not_allowed` (405), `email_taken`/`slot_unavailable`/`idempotency_conflict`/`already_cancelled`/`cancellation_closed`/`resource_has_active_children` (409), `booking_rule_violation` (422), `internal_error` (500), `service_unavailable` (503). Thông báo hiển thị có thể đổi theo ngữ cảnh; FE dựa vào `code`. Với booking không thuộc người dùng, API trả 404 như booking không tồn tại.

Các vi phạm như quá 30 ngày, slot quá khứ, vượt giới hạn ba booking còn hiệu lực, slot không liên tiếp hoặc quá min/max của sân trả `422 booking_rule_violation` với `details`. Slot đã được đặt hoặc bị lịch chặn trả `409 slot_unavailable`. Hủy sau giờ bắt đầu slot đầu tiên trả `409 cancellation_closed`.

## Phạm vi endpoint

- Công khai: đăng ký/đăng nhập, danh mục loại thể thao, tìm và xem sân, xem slot khả dụng.
- USER: hồ sơ của mình, tạo booking, lịch sử và chi tiết của mình, hủy booking trước giờ bắt đầu.
- ADMIN: tạo/sửa/xóa mềm loại thể thao, sân và lịch chặn; xem/thay lịch mở cửa; tra cứu và hủy booking bị ảnh hưởng với lý do; thống kê số booking cơ bản.
- Không có endpoint thanh toán, đặt cọc, đổi lịch, refresh token hay thông báo trong MVP này. Quyền đổi trạng thái booking khác `CONFIRMED → CANCELLED` chưa được SRS định nghĩa.

## Đối chiếu chức năng MVP với SRS

| Yêu cầu | Đường API hoặc xử lý dự kiến |
| --- | --- |
| FR-01–FR-03: tài khoản và hồ sơ | `/auth/register`, `/auth/login`, `/users/me` GET/PATCH. |
| FR-04–FR-06: tìm sân, chi tiết, availability | `/sport-types`, `/courts`, `/courts/{courtId}`, `/courts/{courtId}/availability`. |
| FR-07: giờ hoạt động và chính sách slot | `/admin/courts/{courtId}` PATCH cấu hình; `/admin/courts/{courtId}/operating-hours` GET/PUT. Mẫu time slot được sinh từ cấu hình. |
| FR-08–FR-12: tạo booking an toàn | `/bookings` POST; điều kiện, tính liên tiếp, giao dịch, chống đặt trùng và idempotency là luật service/database, không phải endpoint riêng. |
| FR-13–FR-14: lịch sử và hủy | `/bookings` GET, `/bookings/{bookingId}` GET, `/bookings/{bookingId}/cancel` POST. |
| FR-15: quản lý loại thể thao và sân | `/admin/sport-types*`, `/admin/courts*` GET/POST/PATCH/DELETE; DELETE là ngừng kích hoạt. |
| FR-16: blackout | `/admin/courts/{courtId}/blackouts*` GET/POST/PATCH/DELETE; không tự hủy booking đã xác nhận. |
| FR-17: quản lý booking Admin | `/admin/bookings` GET, `/admin/bookings/{bookingId}` GET, `/admin/bookings/{bookingId}/cancel` POST với lý do và audit. |
| FR-18: thống kê | `/admin/statistics` GET. |
| FR-19: audit | Service ghi `audit_logs` khi thay đổi quản trị và booking; SRS chưa yêu cầu endpoint đọc audit. |

Bảng trên mô tả phạm vi thiết kế MVP. FR-01–FR-06 đã có API thuộc 6 task này; FR-07–FR-19 được triển khai theo các task Booking/Admin tiếp theo. Foundation đã có schema, fixture và exclusion rules; chưa có Admin CRUD.

## Nguồn và các điểm cần duyệt

- [SRS-SB-001 v2.0](https://docs.google.com/document/d/1pRTJGfRwTsopUzYMMqSoESE6M_wwXj0VbnROKVcUSbE/edit): FR-01–FR-19, BR-01–BR-18, NFR-02–NFR-06; baseline 60 phút, 1–4 slot/sân, 30 ngày, tối đa 3 booking còn hiệu lực.
- [ERD v1.0 đã chốt](../database/ERD.md): tên thực thể, `booking_code`, `CONFIRMED`/`CANCELLED`, snapshot thời gian, khóa idempotency, múi giờ và luật giao dịch.
- [Thẻ kiến trúc](https://trello.com/c/0VhI2oe1): Go/Gin, REST `/api/v1`, JWT+bcrypt, USER/ADMIN.
- [Task API](https://trello.com/c/ol2X6l9v): contract và Swagger phải qua review trước tích hợp FE.

Các API đã triển khai giữ DTO đã chốt: access token, ACTIVE/INACTIVE, profile self-only, date theo APP_TIMEZONE. Duy đối chiếu trước tích hợp FE. Các quy tắc Booking/Admin còn planned được review trong task tương ứng; khi đổi contract phải tăng version và đồng bộ FE/backend.
