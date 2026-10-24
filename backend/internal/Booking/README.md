# Booking

**Truy vết:** FR-08..14; WBS 1.3.3.1–1.3.3.7.

Eligibility, chọn slot liên tiếp cùng court/ngày, atomic create, concurrency, server idempotency, own history/detail và cancel trước start. Baseline: horizon ≤30 ngày, ≤3 active bookings/user, slot 60 phút và min/max 1..4 theo cấu hình. Không có payment/deposit hay fee hủy trong MVP.

## API đã triển khai

Base `/api/v1`, mọi endpoint bên dưới cần `Authorization: Bearer <JWT>`. USER và ADMIN chỉ thao tác booking của chính mình qua nhóm route này. ADMIN không được dùng route này để đọc/hủy booking của người khác.

| Chức năng | Method/đường dẫn | Thành công |
| --- | --- | --- |
| Tạo booking | POST `/bookings` | `201 {data: Booking}` |
| Retry thao tác tạo | POST `/bookings`, cùng `Idempotency-Key` | `200 {data: Booking}` gốc |
| Lịch sử | GET `/bookings?page=1&pageSize=20&status=CONFIRMED` | `200 {data: Booking[], meta: {page,pageSize,total}}` |
| Chi tiết | GET `/bookings/{bookingId}` | `200 {data: Booking}` |
| Hủy | POST `/bookings/{bookingId}/cancel` (không cần body) | `200 {data: Booking}` có status CANCELLED |

Create nhận đúng ba trường `courtId`, `bookingDate` (`YYYY-MM-DD` theo APP_TIMEZONE), `timeSlotIds` (UUID lấy từ Availability, gửi theo thứ tự thời gian). Không nhận customerId/status/price từ client. Không tính tiền, đặt cọc hoặc phí hủy; giá tham khảo vẫn là dữ liệu của Court, không tự ghi doanh thu/giá thanh toán vào Booking.

```json
{
  "courtId": "<UUID sân từ GET /courts>",
  "bookingDate": "<ngày địa phương YYYY-MM-DD>",
  "timeSlotIds": ["<UUID slot liên tiếp từ GET /courts/{courtId}/availability>"]
}
```

Các ký hiệu `<...>` cần thay bằng dữ liệu thật. Response theo schema `Booking` trong [OpenAPI](../platform/openapi/openapi.yaml): id, bookingCode, customerId, courtId, bookingDate, status, slots (timeSlotId/startsAt/endsAt), createdAt, cancelledAt. Timestamp là UTC RFC 3339; snapshot giữ nguyên khi cấu hình lịch/sân thay đổi. Danh sách gồm booking quá khứ và đã hủy; bỏ `status` để xem tất cả. Mặc định page=1/pageSize=20, pageSize tối đa 100; sắp xếp createdAt DESC, id DESC, slot theo startsAt. Page quá cuối trả data=[], total vẫn là tổng booking phù hợp.

## Điều kiện và giao dịch

Handler chỉ đọc identity đã xác thực. Service kiểm tra hình dạng input; repository thực hiện các luật phụ thuộc dữ liệu trong transaction:

1. Khóa dòng người dùng (`FOR UPDATE`), kiểm tra tài khoản/role hiện hành. Mọi writer booking phải tuân theo thứ tự **customer → court → booking**; giới hạn và khóa idempotency là theo customer, kể cả request trên nhiều sân.
2. Tìm `(customer_id,idempotency_key)` trước các điều kiện đặt mới. Cùng hash trả booking gốc; khác hash trả 409. Khóa opaque 1–128 ký tự, không trim/case-fold/nhận ký tự điều khiển. Giữ khóa theo vòng đời booking, không tự hết hạn. SHA-256 tính trên courtId/ngày/tập slot đã chuẩn hóa UUID chữ thường và thứ tự ID; JSON layout và đổi thứ tự array không tạo thao tác mới khi retry. Lần tạo mới vẫn yêu cầu slot theo thời gian.
3. Khóa sân, giữ shared lock loại thể thao; sân/loại phải active. Đọc clock **sau khi chờ khóa**; horizon gồm hôm nay và +30 ngày lịch địa phương. Tối đa 3 booking CONFIRMED có ít nhất một slot chưa released với ends_at > hiện tại; đếm booking, gồm đang diễn ra, bỏ đã kết thúc/đã hủy.
4. Đọc lịch/template/blackout/booking cùng transaction và dùng chung `Availability.DatedSlots`. Slot phải active, đúng sân/thứ, trong giờ mở cửa, đúng thời lượng, theo thứ tự liên tiếp và min/max của sân. Từ chối slot đã bắt đầu, DST mơ hồ/không tồn tại. Khoảng nửa mở [start,end) cho phép hai booking sát nhau.
5. Ghi booking + toàn bộ slot snapshot + audit BOOKING_CREATED trong cùng transaction. Partial unique và GiST exclusion là lớp bảo vệ DB. Lỗi bất kỳ rollback toàn bộ. Không đọc lại trong transaction PostgreSQL đã lỗi; response chỉ thành công khi Commit thành công.

Mọi writer lịch/blackout trong task Admin sau này phải khóa cùng dòng sân. Không tái dùng repository Availability bằng một transaction riêng để quyết định ghi booking. Các lần đọc lịch sử dùng RepeatableRead để parent/slot/count cùng snapshot.

## Retry và hủy

- Retry cùng key/nội dung trả cùng ID/code/snapshot, kể cả đã hủy, đã quá horizon, đủ ba booking hoặc sân/template đã bị tắt. Key khác tạo thao tác mới và kiểm tra lại điều kiện. Khóa của hai người dùng là độc lập.
- Lỗi rollback không giữ key. Khi mất response hoặc lỗi Commit khiến chưa rõ DB đã lưu hay chưa, FE gửi lại **cùng key/nội dung**. Không đổi key chỉ vì timeout; không tự tạo booking mới sau cancel bằng key cũ.
- Cancel chỉ chủ sở hữu; không tồn tại/khác chủ đều `404 not_found`. Không có bỏ qua ownership dành cho ADMIN trong route tự phục vụ.
- Chỉ chuyển CONFIRMED → CANCELLED khi `now < startsAt` của **slot đầu tiên đã lưu**. Tại/sau start: 409 cancellation_closed. Đã hủy: 409 already_cancelled, không ghi thêm audit. Không giới hạn số lần hủy riêng trong baseline.
- Một transaction cập nhật status/cancelled_at, released_at của mọi slot còn giữ và audit BOOKING_CANCELLED. Không xóa booking/slot. Sân/template inactive vẫn hủy được. Sau commit, Availability cho phép slot được đặt lại bằng key mới nếu các điều kiện khác vẫn hợp lệ.
- Audit lưu actor, entity booking, trạng thái, request ID và timestamp; không lưu token, key hoặc request_hash. Timestamps ghi theo độ chính xác microsecond của PostgreSQL để response đầu và retry thống nhất.

## Mã lỗi cho FE

| HTTP/code | Nguyên nhân / cách xử lý |
| --- | --- |
| 400 validation_error | UUID/ngày/JSON/key/query sai; sửa input, đọc details. |
| 401 unauthorized | Chưa đăng nhập hoặc JWT không hợp lệ. |
| 403 account_inactive/forbidden | Tài khoản bị tắt hoặc role không được hỗ trợ. |
| 404 not_found | Booking không tồn tại hoặc không thuộc người gọi. |
| 409 slot_unavailable | Slot bị blackout/đã chiếm; refresh Availability. |
| 409 idempotency_conflict | Key đã gắn với nội dung khác; kiểm tra thao tác đang retry. |
| 409 already_cancelled/cancellation_closed | Không còn chuyển trạng thái hủy được; tải lại detail. |
| 422 booking_rule_violation | Sân/slot/chuỗi slot/horizon/giới hạn booking không hợp lệ, hoặc slot đã bắt đầu; có details. |
| 500 internal_error | Lỗi ghi/DB/audit; không trả SQL. Nếu tạo booking chưa rõ kết quả, retry cùng key. |
| 503 retryable_transaction | DB báo deadlock/serialization failure; gửi lại thao tác, Create giữ nguyên key. |

## Tự chạy và bàn giao

Theo [backend README](../../README.md), mở `http://localhost:8080/api/v1/docs`, Authorize bằng JWT, GET sân → Availability → chọn slot liên tiếp → POST Booking với một key mới → GET list/detail → POST cancel → GET Availability và tạo lại với key mới. CORS đã cho phép `Idempotency-Key`; không cần sửa schema/migration ngoài 00001–00011 hiện có.

Tests: `go test -race -count=1 ./...` với TEST_DATABASE_URL cục bộ, database tên kết thúc `_test`. Integration test ở `internal/bootstrap/booking_test.go`: hành vi HTTP với PostgreSQL thật, tranh chấp, ownership, boundary, phân trang và lỗi slot/audit được tiêm trong schema kiểm thử. Unit rule tests ở `rules_test.go`; contract tests đối chiếu Swagger với router. Xem báo cáo [Booking API](../../../docs/testing/BOOKING_API_REVIEW.md) sau khi chạy kiểm chứng.

Các task: [Consecutive Slot Validation](https://trello.com/c/jeNhziFN), [Eligibility/Atomic Create](https://trello.com/c/TkQnnKcY), [Idempotency/Retry](https://trello.com/c/TGh2b4dk), [My Booking/Detail/Cancel](https://trello.com/c/jPxcpNpb). Admin CRUD/cancel hộ người khác và kiểm thử tích hợp FE online là phần bàn giao tiếp theo.
