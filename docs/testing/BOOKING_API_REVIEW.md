# Kiểm chứng BE Booking đến History / Detail / Cancel

Ngày thực hiện: **15/10/2026 (UTC+7)**. Người phụ trách: **Huy**. Nhánh `feature/be_my_booking_detail_cancel` bắt đầu từ `develop` tại `9691ad5`; implementation được review tại `3df09bc`. [PR #24 → develop](https://github.com/Sukuna092main/sport-booking-system/pull/24).

Huy xác nhận làm toàn bộ BE còn thiếu đến task My Booking/Detail/Cancel. Phạm vi gồm:

| Task | Nguồn / truy vết | Phần triển khai |
| --- | --- | --- |
| Consecutive Slot Validation | [Trello](https://trello.com/c/jeNhziFN), FR-09, WBS 1.3.3.2 | Kiểm tra cùng sân/thứ/ngày, adjacency, giờ hoạt động, duration, min/max, quá khứ và blackout. |
| Booking Eligibility & Atomic Create | [Trello](https://trello.com/c/TkQnnKcY), FR-08/10/11, WBS 1.3.3.1/1.3.3.3 | Khóa customer rồi court, horizon 30 ngày, tối đa 3 booking hiệu lực, transaction booking + slot + audit, rollback toàn bộ. |
| Booking Idempotency & Retry Safety | [Trello](https://trello.com/c/TGh2b4dk), FR-12, NFR-06, WBS 1.3.3.5 | Key theo customer, SHA-256 của selection chuẩn hóa, replay trước eligibility, conflict khi đổi nội dung, bảo toàn retry sau hủy/thay đổi cấu hình. |
| My Booking, Booking Detail & Cancel API | [Trello](https://trello.com/c/jPxcpNpb), FR-13/14, WBS 1.3.3.6/1.3.3.7 | Lịch sử/chi tiết chỉ chủ sở hữu, phân trang theo booking, hủy trước slot đầu tiên, release và audit atomic, giữ snapshot lịch sử. |

## API và contract

OpenAPI **v0.4.0** tại `backend/internal/platform/openapi/openapi.yaml`; Swagger `/api/v1/docs`.

| Method | Đường dẫn dưới `/api/v1` | Kết quả |
| --- | --- | --- |
| POST | `/bookings`, header `Idempotency-Key` | 201 cho booking mới, 200 cho retry cùng thao tác. |
| GET | `/bookings?page=1&pageSize=20&status=CONFIRMED` | Danh sách của mình và meta; bỏ status để lấy cả lịch sử đã hủy. |
| GET | `/bookings/{bookingId}` | Chi tiết và mọi slot snapshot của mình; khác chủ/không tồn tại trả 404. |
| POST | `/bookings/{bookingId}/cancel` | Không cần body; 200 khi hủy trước start, 409 nếu đã hủy hoặc đã bắt đầu. |

Body tạo gồm courtId, bookingDate và timeSlotIds. Ownership chỉ lấy từ danh tính đã xác thực; ADMIN dùng nhóm route này vẫn chỉ thao tác booking của mình. Chuỗi slot mới phải theo thứ tự thời gian. Key giữ suốt vòng đời booking, không tự hết hạn theo TTL. Khi mất response/không rõ kết quả Commit, FE gửi lại cùng key/nội dung. Key cũ của booking đã hủy trả lại booking CANCELLED; muốn đặt lại phải dùng key mới.

CORS đã cho phép Idempotency-Key. Không thêm migration, dependency hoặc API Admin. Giá sân chỉ tham khảo, không có payment/fee/đổi lịch trong phạm vi.

## Kiểm chứng đã thực hiện

Unit tests ở `backend/internal/Booking/rules_test.go`; HTTP/service/PostgreSQL tests ở `backend/internal/bootstrap/booking_test.go`. Mỗi integration test tạo schema riêng trong DB cục bộ tên kết thúc `_test`, chạy migrations 00001–00011 rồi tự dọn. Các lỗi slot/audit và overlap chỉ được tiêm trong schema test.

**Kết quả chạy toàn backend:** 141 test/subtest pass, 0 fail, 0 skip, 10 package có test được thực thi. `go test -race -count=1 -timeout=240s -json ./...`, `go vet ./...` và `go build ./...` đều exit 0. Runtime cục bộ: Go 1.27.0 windows/amd64; PostgreSQL 17 riêng trên localhost:55432. CI dùng Go 1.25/PostgreSQL 17 theo cấu hình repository; xem trạng thái tại PR cho đúng commit đang bàn giao.

| Nhóm | Ca kiểm chứng và kết quả quan sát |
| --- | --- |
| Vòng đời | Create → retry → detail/list → cancel → availability trống lại → người khác đặt lại. ID/code/snapshot gốc được giữ; key theo người dùng độc lập. |
| Ownership / Auth | Thiếu token 401; inactive 403; USER/ADMIN khác chủ đều 404 cho detail/cancel; query customerId không đổi chủ sở hữu. |
| Đầu vào | Reject JSON sai/unknown field, thiếu key, UUID/ngày/slot trùng sai; query phân trang/status sai; request lỗi không giữ khóa. |
| Eligibility | Hôm nay và đúng +30 ngày được chấp nhận; ngày quá khứ/+31 bị từ chối; min/max theo sân, slot sai sân/thứ/duration, ngoài giờ hoặc ngày đóng bị từ chối. |
| Lịch chặn và snapshot | Blackout và booking cũ trên template inactive vẫn chặn; lịch sử vẫn đọc được sau khi sân/sport/template ngừng hoạt động. |
| Retry đồng thời | 8 request cùng key/selection: đúng một 201, bảy 200; DB chỉ có 1 booking/1 audit tạo. Khác key tranh cùng slot: một 201, bảy 409. |
| Nhiều người | Hai người tranh cùng slot: một 201, một 409; không có hai occupancy chồng nhau. |
| Giới hạn theo người | 4 request đồng thời trên 4 sân: ba 201, một 422. Đang diễn ra vẫn tính, đã kết thúc/hủy không tính. Retry tại giới hạn vẫn trả booking gốc. |
| Atomic / DB constraint | Lỗi slot thứ hai, lỗi audit tạo, GiST overlap: không còn booking/slot/audit dở. Lỗi audit hủy giữ CONFIRMED, slot chưa release; retry hủy sau khi bỏ lỗi thành công. |
| Cancel boundary | Trước start 1 microsecond được hủy; đúng hoặc sau start 1 microsecond bị chặn. Gọi lại đã hủy trả already_cancelled, không thêm audit. |
| Khóa và thời gian | Request chờ khóa sân đến khi slot bắt đầu bị từ chối sau khi lấy được khóa. Timestamp độ chính xác microsecond giữ nguyên giữa response đầu, DB và retry, gồm cancelledAt. |
| Lịch sử | Phân trang theo booking, không bị cắt slot; thứ tự ổn định khi createdAt bằng nhau, lọc CONFIRMED/CANCELLED, page cuối trả data=[]. |
| Hợp đồng | Swagger khớp routes đã đăng ký; các $ref hợp lệ; preflight Booking cho phép Idempotency-Key và vẫn giữ kiểm tra origin/Auth. |

Lệnh tái hiện từ thư mục `backend` (Go 1.25+, PostgreSQL 17 cục bộ):

```powershell
$env:TEST_DATABASE_URL = "postgresql://postgres:local-test-only@localhost:55432/sport_booking_test?sslmode=disable"
go test -race -count=1 -timeout=240s -json ./...
go vet ./...
go build ./...
```

Raw evidence cục bộ nằm tại `artifacts/booking-be-20261015/`: test-results.jsonl, test-run.json, test-stderr.log, static-checks.json, vet.log, build.log và final-summary.json. Artifacts được gitignore; kết quả CI được lưu tại PR để team xem lại trên GitHub.

## Review

Đã review riêng hai hướng: **tiêu chuẩn repo** (workflow, Handler → Service → Repository, error envelope, lock/transaction, UTC/snapshot, dùng chung Availability) và **đặc tả** (SRS FR-08–14/BR-01–18, ERD, bốn thẻ Trello, OpenAPI). Tại implementation `3df09bc`, cả hai lượt review không có finding cần sửa. Review tĩnh không thay thế kiểm thử chạy thật.

## Bàn giao tiếp theo

Duy tích hợp FE theo contract v0.4.0: mỗi thao tác tạo có một key ổn định qua retry; refresh Availability sau conflict/cancel; hiển thị mã lỗi từ error.code. Hưng kiểm tra trên môi trường tích hợp thực tế và lưu evidence theo gate sprint. Chưa có kết quả QA online hoặc nghiệm thu toàn sprint trong báo cáo này; chỉ cập nhật checklist Trello sau khi kiểm chứng đúng đầu ra.

Các task Admin tiếp theo phải khóa dòng sân khi sửa lịch/blackout, giữ lịch sử booking cũ và ghi audit cùng transaction. Admin cancel hộ người khác dùng task/route riêng đã planned trong OpenAPI.
