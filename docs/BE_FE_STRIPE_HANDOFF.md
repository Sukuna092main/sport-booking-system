# Bàn giao API backend cho FE

Base URL là `/api/v1`. Swagger nằm ở `/api/v1/docs`, OpenAPI ở `/api/v1/openapi.yaml`. Nội dung dưới đây mô tả bản backend chuyển sang Stripe đang sửa tại local.

## Dữ liệu và định dạng chung

Thành công trả `{ "data": ... }`. API danh sách có thêm `meta` với `page`, `pageSize`, `total`. Lỗi trả `{ "error": { "code": "...", "message": "...", "requestId": "...", "details": [] } }`. `details` có thể được bỏ qua. Timestamp dùng UTC RFC3339, ngày booking dùng lịch địa phương của ứng dụng. Tiền dùng số nguyên VND.

Các API riêng của khách lấy chủ sở hữu từ access token. FE gửi `Authorization: Bearer <accessToken>`. Đơn của người khác trả 404. ADMIN quản lý giá sân qua API quản trị.

## Tài khoản

| API | Dữ liệu vào | Kết quả |
|---|---|---|
| POST `/auth/register` | `email`, `password`, `fullName`, `phone` tùy chọn | 201, hồ sơ USER |
| POST `/auth/login` | `email`, `password` | 200, `accessToken`, `tokenType`, `expiresAt`, `user` và cookie refresh |
| POST `/auth/refresh` | Cookie, body rỗng | 200, cùng cấu trúc login, cookie mới |
| POST `/auth/logout` | Cookie, body rỗng | 200, `data.message`, xóa cookie và thu hồi phiên |
| POST `/auth/logout-all` | Bearer, body rỗng | 200, `data.message`, thu hồi mọi phiên |
| POST `/auth/forgot-password` | `email` | 202, `data.message` giống nhau cho email tồn tại và không tồn tại |
| POST `/auth/reset-password` | `token`, `newPassword` | 200, `data.message`, đăng nhập lại |
| POST `/auth/change-password` | Bearer, `currentPassword`, `newPassword` | 200, `data.message`, đăng nhập lại |
| GET `/users/me` | Bearer | Hồ sơ hiện tại |
| PATCH `/users/me` | Bearer, `fullName`/`phone` | Hồ sơ sau cập nhật |

FE bật `credentials: "include"` hoặc `withCredentials: true` cho login/refresh/logout. Cookie `sb_refresh_token` có HttpOnly, path `/api/v1/auth`. FE tuần tự hóa refresh để tránh gửi đồng thời cùng một refresh token. Refresh token đã xoay mà bị dùng lại khiến cả phiên bị thu hồi.

Mật khẩu tối thiểu 8 ký tự, tối đa 72 byte UTF-8. Link reset trỏ tới `FRONTEND_PUBLIC_URL/reset-password?token=...`. FE lấy token và gửi trong JSON của reset-password. FE xử lý 401 bằng refresh một lần rồi retry yêu cầu gốc. Nếu refresh thất bại, chuyển về đăng nhập.

## Giá sân và đặt lịch

| API | Yêu cầu | Dữ liệu |
|---|---|---|
| GET `/courts/{courtId}/pricing` | Public | `courtId`, `pricePerSlotVnd`, `isActive`, `updatedAt` |
| PUT `/admin/courts/{courtId}/pricing` | Bearer ADMIN, `{ "pricePerSlotVnd": 50000, "isActive": true }` | Giá mới của sân |
| POST `/bookings` | Bearer, header `Idempotency-Key`, JSON `courtId`, `bookingDate`, `timeSlotIds` | Booking và số tiền chụp tại lúc đặt |
| GET `/bookings` | Bearer, `page`, `pageSize`, `status` tùy chọn | Danh sách của chính người dùng |
| GET `/bookings/{bookingId}` | Bearer | Chi tiết booking |
| POST `/bookings/{bookingId}/cancel` | Bearer | Booking sau hủy |

FE tạo một Idempotency-Key cho mỗi ý định đặt sân và giữ nguyên key khi retry do timeout. Backend từ chối key cũ đi cùng dữ liệu đặt sân khác. Giá tham khảo của sân và giá dùng để thu tiền được quản lý bằng hai trường riêng. API pricing là nguồn giá thanh toán.

Booking có `id`, `bookingCode`, `customerId`, `courtId`, `bookingDate`, `status`, `slots`, `createdAt`, `cancelledAt`. Booking có đặt cọc còn trả `holdExpiresAt`, `totalAmountVnd`, `depositAmountVnd`, `remainingAmountVnd`. `expiredAt` có khi đơn đã hết hạn. FE cho phép các trường optional vắng mặt với đơn cũ hoặc khi thanh toán đang tắt.

Các trạng thái booking là `PENDING_PAYMENT`, `CONFIRMED`, `CANCELLED`, `EXPIRED`. Số tiền được server tính và giữ nguyên khi cấu hình giá thay đổi. Khi bật Stripe, thời gian giữ chỗ mặc định 35 phút. API từ chối đơn quá sát giờ chơi để Checkout còn thời gian thanh toán hợp lệ.

## Stripe Checkout

1. FE tạo booking và lưu `bookingId` của đơn `PENDING_PAYMENT`.
2. FE gọi POST `/bookings/{bookingId}/payments` bằng Bearer, body rỗng. Backend trả 201 với đối tượng Payment trong `data`.
3. FE chuyển trình duyệt tới `data.checkoutUrl`. Backend dùng Stripe hosted Checkout và chỉ bật phương thức card.
4. Stripe chuyển về `/payment-result?bookingId=...&ref=...&gateway=pending&session_id=...` khi hoàn tất hoặc `gateway=failed` khi khách bấm quay lại. Giá trị query chỉ hỗ trợ hiển thị và tương quan đơn.
5. FE dùng `bookingId` trong URL để gọi GET `/bookings/{bookingId}` và GET `/bookings/{bookingId}/payments`. Tránh lấy đơn đầu tiên trong lịch sử làm đơn thanh toán.
6. FE poll có giới hạn và cho phép người dùng tải lại trạng thái nếu webhook đến chậm. Trạng thái PAID từ API mới là căn cứ xác nhận tiền cọc.

Payment gồm `id`, `bookingId`, `provider`, `providerOrderRef`, `amountVnd`, `currency`, `status`, `createdAt`. `checkoutUrl` và `paidAt` optional. Giao dịch mới có provider `stripe`. Lịch sử cũ vẫn có thể mang giá trị provider trước khi chuyển đổi.

GET `/bookings/{bookingId}/payments` trả `bookingId`, `bookingStatus`, `holdExpiresAt` nếu có, `totalAmountVnd`, `depositAmountVnd`, `remainingAmountVnd`, và `payment` nếu đã tạo giao dịch. `payment` là lần thử mới nhất. Khi chưa có giao dịch, trường này có thể vắng mặt.

Payment status gồm `PENDING`, `PAID`, `FAILED`, `EXPIRED`, `PAID_REVIEW`. Với PAID_REVIEW, FE hiển thị đang chờ người quản lý đối soát. Khoản thanh toán sau hạn không tự chiếm lại slot đã giải phóng. Hủy đơn đã trả cọc cũng cần người quản lý xem xét khoản tiền đã thu.

| HTTP/code | Cách FE xử lý |
|---|---|
| 404 `not_found` | Đơn không tồn tại hoặc không thuộc người gọi |
| 409 `payment_window_closed` | Tải lại đơn, hiển thị đã đóng cửa sổ tạo thanh toán |
| 409 `payment_requires_review` | Hiển thị chờ đối soát |
| 503 `payment_unavailable` | Backend chưa bật/cấu hình thanh toán |
| 503 `provider_unavailable` | Giữ nguyên booking, cho retry checkout |
| 409 `idempotency_conflict` | Kiểm tra thao tác đặt sân và key đang dùng |
| 422 `booking_rule_violation` | Hiển thị luật bị vi phạm, cho chọn lại slot |

Stripe yêu cầu ít nhất 30 phút còn lại khi tạo Checkout Session. Với giữ chỗ 35 phút, khách nên bắt đầu checkout ngay sau tạo booking. Khi thời gian còn dưới 30 phút, backend trả payment_window_closed nếu chưa có checkout URL. Checkout đã tạo vẫn dùng được tới hạn của đơn.

## Webhook và email

POST `/payments/stripe/webhook` do Stripe gọi. Webhook kiểm tra raw body và Stripe-Signature, đối chiếu reference, số tiền VND rồi xử lý trạng thái trong transaction. FE lấy kết quả qua API trạng thái.

Email reset mật khẩu, xác nhận, hủy, hết hạn và nhắc trước 24 giờ được xếp vào outbox. Worker phải chạy cùng API để gửi email và giải phóng các giữ chỗ hết hạn. FE nhận kết quả nghiệp vụ từ API và thông báo việc gửi email có thể có độ trễ.

## Chuẩn bị backend

- Dùng `.env.example`, chọn `PAYMENT_PROVIDER=stripe`, nhập khóa Stripe của môi trường và webhook secret đúng endpoint đang chạy.
- Dùng `PAYMENT_HOLD_TTL=35m` hoặc giá trị phù hợp từ 35 phút đến 2 giờ.
- Áp dụng migration 00015 sau các migration hiện có, trên đúng database của môi trường triển khai.
- Cấu hình `FRONTEND_PUBLIC_URL` và `CORS_ALLOWED_ORIGINS` theo origin FE thật.
- Chạy API và worker với cùng DATABASE_URL, JWT_SECRET và EMAIL_ENCRYPTION_KEY.

## Điểm FE cần tiếp nhận

Code FE đang có vẫn khai báo provider các provider cũ và trang kết quả suy ra booking từ sessionStorage hoặc đơn mới nhất. Người phụ trách FE cần cập nhật kiểu provider, chuyển trình duyệt tới checkoutUrl, đọc bookingId từ query khi quay về, và xử lý PAID_REVIEW. Phần bàn giao này giữ các API booking và pricing hiện có để tiếp tục tích hợp.

## Kết quả kiểm chứng ngày 23/11/2026

Đã chạy thành công:
- `go build -p 4 ./...`
- `go vet -p 4 ./...`
- `go test -p 4 -count=1 ./...` với PostgreSQL cục bộ riêng tên `sport_booking_test`.
- Launcher `-CheckConfig` với env Stripe local trả `Configuration OK`.
- `git diff --check` thành công.

Bộ test bao gồm API tài khoản, ADMIN, sân/lịch trống, đặt sân và hủy, ownership, transaction/idempotency, Swagger đối chiếu route, request Stripe Checkout qua HTTP transport kiểm thử, chữ ký webhook và chống sửa body. Test tích hợp kiểm tra refresh replay, logout, reset một lần, đổi mật khẩu, logout-all, dữ liệu booking/thanh toán FE cần, callback lặp, email retry, bỏ nhắc lịch cho đơn đã hủy và khoản thanh toán sau hết hạn.

Một ca kiểm tra hết hạn ban đầu dùng access token hết hạn khi dịch đồng hồ quá 15 phút. Ca đó đã được sửa để đăng nhập lại trước khi đọc đơn. Lần chạy cuối thành công toàn bộ bộ test.

Đã kiểm tra Stripe online bằng khóa test của nhóm:
- Tạo Checkout Session với 15.000 VND trả HTTP 200, livemode=false.
- Retry cùng idempotency key trả cùng session ID.
- Đọc session và đóng session thử nghiệm đều trả HTTP 200.
- Thanh toán PaymentIntent riêng với pm_card_visa trả succeeded, amount_received=15000, livemode=false.
- Thẻ pm_card_chargeDeclined trả HTTP 402, card_declined.
- Gọi trực tiếp StripeGateway trong code Go hiện tại tạo Checkout online thành công và đóng session test sau kiểm tra.
- Unit test Stripe, build và vet được chạy lại sau bản sửa API.

Kiểm tra online phát hiện phiên bản Stripe API 2026-11-18.endive đã bỏ payment_method_types khi tạo Checkout. Gateway đã sửa thành allowed_payment_method_types để lọc card. Test request cũng đã cập nhật theo tham số được Stripe online chấp nhận.

Checkout Session thử nghiệm được tạo rồi đóng. Thanh toán PaymentIntent kiểm tra riêng khả năng xử lý thẻ của tài khoản, chưa phải thao tác trả tiền trong chính Checkout Session của booking. Người dùng xác nhận bản Stripe chưa deploy, nên còn bước kiểm tra xuyên suốt Checkout hosted → webhook trên backend công khai → cập nhật PostgreSQL → FE đọc trạng thái. Chưa gửi email qua SMTP thật. Khi triển khai cần áp dụng migration 00015, chạy API/worker và đăng ký endpoint webhook của môi trường.

Đã kiểm tra phần thay đổi Git của thư mục frontend là rỗng. Các yêu cầu FE cần tiếp nhận được mô tả ở phần trên.
