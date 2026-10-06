# REST Contract và Swagger Base

**Phiên bản đề xuất:** 0.1.0 · **Trạng thái:** chờ Huy duyệt và Duy đối chiếu FE/API · **Nguồn chuẩn:** [OpenAPI 3.0.3](../../../backend/internal/platform/openapi/openapi.yaml).

## Cách mở

Chạy backend theo [hướng dẫn](../../../backend/README.md), rồi mở `http://localhost:8080/api/v1/docs`. File thô ở `http://localhost:8080/api/v1/openapi.yaml`. Trang Swagger dùng `swagger-ui-dist@5.11.0` từ unpkg; trình duyệt cần truy cập CDN để tải giao diện, còn file OpenAPI được server phục vụ cục bộ.

**Chỉ `GET /api/v1/ping` đã chạy.** Swagger mô tả hợp đồng của các endpoint nghiệp vụ tương lai; gọi chúng lúc này trả `404`. Mỗi operation có `x-implementation-status` để phân biệt. Không coi màn hình Swagger là bằng chứng Auth/Booking/Admin đã được triển khai.

## Quy ước chung

| Mục | Quy ước |
| --- | --- |
| Base path | `/api/v1`; JSON UTF-8; tên trường camelCase. |
| Thành công | Endpoint nghiệp vụ trả `{ "data": ... }`; danh sách phân trang thêm `{ "meta": { "page", "pageSize", "total" } }`. `ping` là endpoint vận hành đã có sẵn, giữ nguyên body cũ. |
| Lỗi | `{ "error": { "code", "message", "requestId", "details"? } }`; `X-Request-ID` cùng giá trị với `error.requestId`. `details` là lỗi từng trường khi có. Không trả stack trace hay thông tin nội bộ. |
| Auth | `Authorization: Bearer <JWT>` cho route bảo vệ; claim `sub` là UUID người dùng, `role` là `USER`/`ADMIN`, có `iat`/`exp`. Route `/admin/*` đòi ADMIN. Không trả token trong log. |
| Ngày giờ | `bookingDate` và query `date` là `YYYY-MM-DD` theo `APP_TIMEZONE` của địa điểm; mẫu giờ là `HH:mm:ss` địa phương; timestamp trả UTC RFC 3339. Thứ dùng ISO 1–7. |
| Danh sách | `page` từ 1 (mặc định 1), `pageSize` từ 1–100 (mặc định 20). |
| Đặt sân | `Idempotency-Key` bắt buộc, opaque, 1–128 ký tự, phạm vi theo người dùng. Cùng khóa+nội dung trả booking gốc (`200`); khác nội dung trả `409 idempotency_conflict`. Tạo mới trả `201`. |
| Giá | `referencePriceAmount` là decimal string; chỉ hiển thị, không có thanh toán MVP. |

Mã lỗi ổn định cho FE: `validation_error` (400), `unauthorized`/`invalid_credentials` (401), `forbidden`/`account_inactive` (403), `not_found` (404), `method_not_allowed` (405), `email_taken`/`slot_unavailable`/`idempotency_conflict`/`already_cancelled`/`cancellation_closed` (409), `booking_rule_violation` (422), `internal_error` (500), `service_unavailable` (503). Thông báo hiển thị có thể đổi theo ngữ cảnh; FE dựa vào `code`. Với booking không thuộc người dùng, API trả 404 như booking không tồn tại.

Các vi phạm như quá 30 ngày, slot quá khứ, vượt giới hạn ba booking còn hiệu lực, slot không liên tiếp hoặc quá min/max của sân trả `422 booking_rule_violation` với `details`. Slot đã được đặt hoặc bị lịch chặn trả `409 slot_unavailable`. Hủy sau giờ bắt đầu slot đầu tiên trả `409 cancellation_closed`.

## Phạm vi endpoint

- Công khai: đăng ký/đăng nhập, danh mục loại thể thao, tìm và xem sân, xem slot khả dụng.
- USER: hồ sơ của mình, tạo booking, lịch sử và chi tiết của mình, hủy booking trước giờ bắt đầu.
- ADMIN: tạo/sửa/ngừng kích hoạt loại thể thao và sân, thay lịch mở cửa, lịch chặn, tra cứu booking, thống kê số booking cơ bản.
- Không có endpoint thanh toán, đặt cọc, đổi lịch, refresh token hay thông báo trong MVP này. SRS chưa định nghĩa quyền đổi trạng thái booking của ADMIN ngoài luồng hủy của chủ sở hữu nên contract chưa thêm thao tác đó.

## Nguồn và các điểm cần duyệt

- [SRS-SB-001 v2.0](https://docs.google.com/document/d/1pRTJGfRwTsopUzYMMqSoESE6M_wwXj0VbnROKVcUSbE/edit): FR-01–FR-19, BR-01–BR-18, NFR-02–NFR-06; baseline 60 phút, 1–4 slot/sân, 30 ngày, tối đa 3 booking còn hiệu lực.
- [ERD v1.0 đã chốt](../database/ERD.md): tên thực thể, `booking_code`, `CONFIRMED`/`CANCELLED`, snapshot thời gian, khóa idempotency, múi giờ và luật giao dịch.
- [Thẻ kiến trúc](https://trello.com/c/0VhI2oe1): Go/Gin, REST `/api/v1`, JWT+bcrypt, USER/ADMIN.
- [Task API](https://trello.com/c/ol2X6l9v): contract và Swagger phải qua review trước tích hợp FE.

**Cần Huy/Duy duyệt trước khi coi là baseline:** hình dạng DTO cho UI, bộ mã lỗi, chính sách JWT chỉ có access token và đăng nhập lại khi hết hạn, tên trạng thái tài khoản `ACTIVE`/`INACTIVE`, công thức thống kê theo trạng thái hiện tại. Nếu thay đổi một mục, tăng phiên bản spec và cập nhật FE/backend cùng thay đổi đó. Duy đối chiếu Register/Login/Profile và các màn Court/Booking trước tích hợp.
