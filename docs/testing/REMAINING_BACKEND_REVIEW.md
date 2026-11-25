# Backend Admin, Audit và Security review

Ngày: 23/10/2026. Phụ trách: Huy. Nhánh: `feature/be_admin_remaining`.

## Căn cứ và phạm vi

Tiếp tục kế hoạch BE đã có trong tài liệu “Hướng dẫn chi tiết task Huy Backend và PM”, chương 13–14; đối chiếu SRS FR-07, FR-15–19, NFR-01–03/09/12, ERD và OpenAPI. Bản hướng dẫn nằm trong artifact bàn giao ngày 13/10; không thay thế bằng một phạm vi mới.

| Task | Phần triển khai |
|---|---|
| Admin SportType / Court CRUD | Danh sách, tạo, PATCH phân biệt thiếu/null, DELETE xóa mềm; kiểm tra tham chiếu, mặc định slot 60/1/4, giá tham khảo và audit. |
| Admin Court Schedule / TimeSlot Configuration | GET/PUT giờ mở cửa theo APP_TIMEZONE, thứ ISO 1–7; sinh mẫu slot mới, giữ template cũ và snapshot booking. |
| CourtBlackout Management | GET/POST/PATCH/DELETE; kiểm tra khoảng thời gian và đúng court trong path; UTC; xóa mềm; không tự hủy booking. |
| Admin Booking Management | Danh sách phân trang và bộ lọc court/date/status, chi tiết khác chủ; hủy trước slot đầu với lý do 1–500 ký tự và audit. |
| Basic Booking Statistics (phần BE) | Đếm booking theo bookingDate, gồm hai biên from/to, total/confirmed/cancelled; không tính số slot hoặc doanh thu. |
| Audit Logging | Mutation và event thành công cùng transaction; actor từ context, request ID, đối tượng và details nghiệp vụ; không có API sửa/xóa audit. |
| Security / Privacy Controls Review | Quyền ADMIN theo role hiện tại trong DB, thu hồi quyền khi token còn hạn; ownership và hồi quy các endpoint hiện có; DTO không lộ hash/key nội bộ. |

## Quy tắc tích hợp

- Tất cả `/api/v1/admin` dùng Authenticate và RequireRole ADMIN. USER không được thao tác dù là chủ booking.
- Các writer Schedule/Blackout/Court cùng khóa dòng court với Create Booking. Admin cancel dùng lõi hủy chung với owner, theo thứ tự khóa owner → court → booking, release slot và audit atomic.
- DELETE lặp trên bản đã ngừng kích hoạt trả 204, không thêm audit thay đổi trạng thái lần nữa. Không xóa vật lý lịch sử.
- Giờ mở cửa qua nửa đêm bị từ chối. Chỉ sinh slot đầy đủ: 08:00–10:30, duration60 tạo 08–09 và 09–10; phần dư không đặt được. Đây là lựa chọn kỹ thuật theo thuật toán kế hoạch cũ, được ghi rõ cho FE.
- Blackout có thể giao nhau; không tự thêm quy tắc cấm overlap giữa blackout. Availability trừ các khoảng giao với slot; booking confirmed vẫn giữ nguyên.
- Không thêm thông báo, reset mật khẩu, payment, reschedule hoặc endpoint đọc audit vào phạm vi.

## Kiểm chứng và review

Kiểm thử dùng PostgreSQL 18 riêng tại loopback cổng55433, database tên kết thúc `_test`. Mỗi bài test tạo schema riêng, áp dụng migration rồi tự dọn. Không dùng dữ liệu Neon; Huy đồng ý bổ sung kiểm tra online khi có cấu hình.

Bộ test gồm: validation đầu vào; soft delete và tham chiếu; tranh chấp tạo court/ngừng sport; thay slot và giữ lịch sử; rollback khi audit lỗi; chặn booking bằng blackout và các biên thời gian; khóa court; admin list/detail/filter/statistics; owner inactive; hủy tại start; thu hồi role và 401/403 trên toàn bộ 18 operation Admin. Bộ Booking/Auth/Profile/Availability hiện có được chạy hồi quy.

Review tĩnh hai hướng: đặc tả và chất lượng/security/concurrency. Không thấy blocker về ownership, khóa hoặc snapshot; phát hiện chuỗi NUL có thể gây lỗi PostgreSQL500. Đã thêm regression tests, quan sát thất bại rồi sửa validation để trả400 trên text Admin/blackout/reason hủy.

Kết quả lệnh và SHA bàn giao được ghi trong PR; không coi code đã chạy online hoặc đã được UAT chỉ từ kết quả local/CI.

Kết quả local: `go test -race -count=1 -timeout=240s ./...` đạt toàn bộ package; sau sửa NUL chạy lại `go test -race -count=1 ./internal/Admin/...` đạt cả ba module. `go vet ./...`, `go build ./...` đều exit0. Full suite bao gồm router/contract/security và hồi quy Booking; không dùng TEST_DATABASE_URL trỏ online.

## Giới hạn kiểm chứng bảo mật

Đã kiểm tra các kiểm soát cụ thể trong phạm vi test và review, không tuyên bố an toàn tuyệt đối. Login/Register hiện chưa có rate limiter chuyên biệt; ghi nhận là hạng mục hardening cần đánh giá khi triển khai public cùng reverse proxy. Runtime DB grants, secret và cấu hình TLS/CORS online cần được kiểm tra trên môi trường thực tế bởi Hưng/Huy. Chưa có cấu hình online trong phiên này, nên không kết luận về các điều kiện vận hành đó.

## Bàn giao

Swagger/OpenAPI0.5.0 tại `/api/v1/docs` và `/api/v1/openapi.yaml`. Duy tích hợp theo DTO và error envelope hiện có; Hưng kiểm thử staging và ghi URL/version/evidence. Chỉ cập nhật Done/nghiệm thu theo đúng điều kiện thẻ thực tế, không tự đánh dấu kết quả online hoặc UAT.
