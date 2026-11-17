# Kịch bản UAT & Hồ sơ Chuẩn bị Kiểm thử Nghiệm thu (UAT Preparation)

- **Mã tài liệu:** UAT-PREP-SB-001
- **Dự án:** Sport Booking System (Hệ thống Quản lý và Đặt sân Thể thao)
- **Thẻ Trello:** [[QA] UAT Accounts / Data / Evidence Preparation](https://trello.com/c/bBqClrzT) (Card #101)
- **Truy vết WBS / REQ:** 1.4.6, 1.6.3; SRS-SB-001 (FR-01..12, BR-01..02, NFR-07, UAT-01..10)
- **Người lập:** **Bảo Hưng Võ Nguyễn** (DevOps / QA Lead)
- **Reviewer:** **Hoàng Phú Huy** (PM / Backend Lead)
- **Ngày lập:** 17/11/2026 (UTC+7)
- **Trạng thái:** Bản chuẩn bị — Chờ Huy (PM) review trước khi thực thi tại thẻ #56

> **Nguyên tắc nghiêm ngặt:** Tài liệu này chỉ chuẩn bị môi trường, tài khoản, dữ liệu mẫu và các bước kỳ vọng (Expected). Các cột kết quả thực tế (Actual), bằng chứng (Evidence), danh sách lỗi (Defects) và chữ ký nghiệm thu được giữ nguyên dạng mẫu trống (template); chỉ điền khi thực thi thực tế tại thẻ **#56 ([QA] UAT Execution & Acceptance Evidence)**.

---

## 1. Môi trường Kiểm thử (Test Environment)

| Thành phần | Thông tin triển khai | Ghi chú |
|---|---|---|
| **Frontend URL** | https://sport-booking-system-ochre.vercel.app | Bản build React 18 / Vite trên Vercel Edge |
| **Backend API** | https://sport-booking-api-staging.onrender.com/api/v1 | Bản Go/Gin Modular Monolith trên Render Staging |
| **Swagger / OpenAPI** | https://sport-booking-api-staging.onrender.com/api/v1/docs | Tài liệu đặc tả API v1 |
| **Cơ sở dữ liệu** | Neon Serverless PostgreSQL (`staging` branch) | Region: `ap-southeast-1` (Singapore) |
| **Database Schema** | Goose Migration Version **11** | Đã hoàn tất migration bảng audit & booking |
| **Kiểm tra truy cập** | Đạt — Đã kiểm tra kết nối mạng và HTTPS từ client bên ngoài | Không chứa credential/secret nhạy cảm |

---

## 2. Danh sách Tài khoản Kiểm thử (UAT Accounts)

Bộ tài khoản thử nghiệm được chuẩn bị độc lập cho UAT, đảm bảo phân quyền đúng giữa người dùng cuối (USER) và ban quản trị (ADMIN):

| STT | Vai trò (Role) | Email đăng nhập | Mật khẩu mặc định | Mục đích sử dụng |
|:---:|:---:|---|:---:|---|
| 1 | **USER (Chính)** | `fixture-user1@example.test` | `password123` | Dùng cho kịch bản xem sân, đặt sân (UAT-03..05), hủy sân (UAT-06), cập nhật profile (UAT-02) |
| 2 | **USER (Đối chứng)** | `fixture-user2@example.test` | `password123` | Dùng kiểm thử đặt sân đồng thời (concurrency), kiểm tra dữ liệu phân tách giữa các user |
| 3 | **ADMIN** | `fixture-admin@example.test` | `password123` | Dùng kiểm thử quản lý sân, blackout, khung giờ (UAT-07..08), xem thống kê (UAT-09), audit log (UAT-10) |
| 4 | **USER (Tạo mới)** | `uat-newuser-20261117@example.test` | `password123` | Dùng kiểm thử đăng ký tài khoản mới tinh từ màn hình Register (UAT-01) |

> ⚠️ **Lưu ý an toàn:** Tuyệt đối không sử dụng mật khẩu thực tế, email thật hoặc thông tin cá nhân của khách hàng. Tất cả tài khoản trên đều sử dụng tên miền thử nghiệm `.test`.

---

## 3. Dữ liệu Mẫu & Trạng thái Khởi tạo (Data Fixtures)

Dữ liệu hệ thống đã được đồng bộ thông qua script chuẩn hóa `scripts/dev/Reset-StagingFixture.ps1` (Fixture Version `v1`):

1. **Danh mục Môn thể thao (Sport Types):**
   * Bóng đá (Football / Soccer)
   * Cầu lông (Badminton)
   * Tennis (Quần vợt)
2. **Danh mục Sân (Courts):**
   * 06 cụm sân với mã định danh chuẩn (`FB-01`, `FB-02`, `BM-01`, `BM-02`, `TN-01`, `TN-02`), đầy đủ trạng thái `Active`.
3. **Lịch hoạt động & Khung giờ (Operating Hours & Time Slots):**
   * Khung giờ phục vụ: 06:00 đến 22:00 hàng ngày (16 khung giờ 60 phút/ngày).
   * Đầy đủ 96 slots/tuần cho mỗi sân, đảm bảo API Availability phản ánh chính xác dữ liệu slot trống.
4. **Dữ liệu kiểm chứng Thống kê & Nhật ký (Statistics & Audit Data):**
   * Sẵn sàng ghi nhận log ngay khi thực hiện các thao tác login, booking, hủy booking, tạo blackout.

---

## 4. Chi tiết 10 Kịch bản Kiểm thử Nghiệm thu (UAT Scenarios)

### UAT-01: Đăng ký Tài khoản mới & Đăng nhập Hệ thống
* **Truy vết:** FR-01, FR-02 (Authentication & Authorization).
* **Vai trò:** Khách vãng lai (Guest).
* **Dữ liệu đầu vào:**
  * Email: `uat-newuser-20261117@example.test`
  * Mật khẩu: `Password123@`
  * Họ và tên: `Nguyễn Văn UAT`
* **Các bước thực hiện:**
  1. Truy cập trang chủ Staging: `https://sport-booking-system-ochre.vercel.app`.
  2. Bấm vào nút "Đăng ký" (Register).
  3. Nhập đầy đủ thông tin: Họ tên, Email, Mật khẩu và bấm "Xác nhận đăng ký".
  4. Chuyển sang màn hình "Đăng nhập", nhập email và mật khẩu vừa tạo, bấm "Đăng nhập".
* **Kết quả mong đợi (Expected):**
  * Đăng ký thành công, hệ thống chuyển hướng hoặc hiển thị thông báo hợp lệ.
  * Đăng nhập thành công, token được lưu vào session/localStorage, giao diện hiển thị tên người dùng `Nguyễn Văn UAT` trên thanh điều hướng.

---

### UAT-02: Xem & Cập nhật Hồ sơ Cá nhân (User Profile)
* **Truy vết:** FR-03 (Profile Management).
* **Vai trò:** Người dùng (`fixture-user1@example.test`).
* **Dữ liệu đầu vào:** Số điện thoại: `0987654321`, Tên hiển thị mới: `Fixture User 1 Updated`.
* **Các bước thực hiện:**
  1. Đăng nhập bằng tài khoản `fixture-user1@example.test`.
  2. Truy cập trang "Hồ sơ cá nhân" (Profile) từ menu người dùng.
  3. Kiểm tra thông tin hiển thị hiện tại.
  4. Cập nhật Số điện thoại hoặc Họ tên, bấm "Lưu thay đổi".
  5. Tải lại trang (F5) để kiểm chứng tính bền vững của dữ liệu.
* **Kết quả mong đợi (Expected):**
  * Thông tin cập nhật hiển thị chính xác, không mất sau khi tải lại trang. Hệ thống ghi nhận phản hồi 200 OK từ API `/profile`.

---

### UAT-03: Xem Danh sách Sân & Bộ lọc theo Môn thể thao (Court Browsing)
* **Truy vết:** FR-04 (Court Browse & Search).
* **Vai trò:** Khách vãng lai hoặc Người dùng đã đăng nhập.
* **Dữ liệu đầu vào:** Lọc theo môn thể thao: "Bóng đá", "Cầu lông".
* **Các bước thực hiện:**
  1. Truy cập danh sách sân tại trang chủ / trang Khám phá sân.
  2. Chọn bộ lọc "Bóng đá" -> Quan sát danh sách sân hiển thị.
  3. Chọn bộ lọc "Cầu lông" -> Quan sát danh sách sân hiển thị.
  4. Nhấp vào một sân cụ thể (ví dụ: `BM-01`) để vào trang chi tiết.
* **Kết quả mong đợi (Expected):**
  * Danh sách sân lọc chính xác theo môn thể thao được chọn, hiển thị đúng tên sân, loại sân, giá thuê mỗi giờ.
  * Trang chi tiết sân hiển thị đầy đủ mô tả, hình ảnh/icon, giá tiền và quy định sử dụng sân.

---

### UAT-04: Tra cứu Khung giờ Trống theo Ngày (Court Availability Calendar)
* **Truy vết:** FR-05 (Real-time Availability).
* **Vai trò:** Người dùng.
* **Dữ liệu đầu vào:** Sân: `BM-01`, Ngày chọn: Ngày mai (D+1).
* **Các bước thực hiện:**
  1. Tại trang chi tiết sân `BM-01`, chọn lịch xem khung giờ ngày mai.
  2. Quan sát ma trận các khung giờ (từ 06:00 đến 22:00).
  3. Nhận diện các trạng thái slot: `Available` (Trống), `Booked` (Đã đặt), `Blackout` (Khóa bảo trì).
* **Kết quả mong đợi (Expected):**
  * Giao diện tải danh sách slot mượt mà, phân biệt màu sắc rõ ràng giữa slot còn trống và slot không khả dụng.

---

### UAT-05: Đặt sân Đơn slot & Nhiều slot Liên tiếp (Create Booking)
* **Truy vết:** FR-06, BR-01 (Booking Creation & Time Slot Rules).
* **Vai trò:** Người dùng (`fixture-user1@example.test`).
* **Dữ liệu đầu vào:** Sân `BM-01`, Ngày D+1, chọn 2 slot liên tiếp (ví dụ: 17:00 - 18:00 và 18:00 - 19:00).
* **Các bước thực hiện:**
  1. Chọn 2 khung giờ liên tiếp hợp lệ còn trống trên bảng lịch.
  2. Kiểm tra tổng tiền thuê sân tạm tính hiển thị tự động.
  3. Bấm "Xác nhận đặt sân" (Confirm Booking).
  4. Quan sát thông báo tạo đơn và chuyển hướng.
* **Kết quả mong đợi (Expected):**
  * Đơn đặt sân được tạo thành công với trạng thái `CONFIRMED`.
  * Quay lại bảng lịch ngày D+1, 2 slot vừa đặt lập tức chuyển sang trạng thái `Booked` (không thể đặt lại).

---

### UAT-06: Xem Đơn đặt của tôi & Thực hiện Hủy sân (My Bookings & Cancellation)
* **Truy vết:** FR-07, BR-02 (My Bookings & Cancellation Policy).
* **Vai trò:** Người dùng (`fixture-user1@example.test`).
* **Dữ liệu đầu vào:** Mã đơn đặt sân vừa tạo ở kịch bản UAT-05.
* **Các bước thực hiện:**
  1. Vào mục "Đơn đặt của tôi" (My Bookings).
  2. Tìm đơn đặt sân vừa tạo ở UAT-05, kiểm tra thông tin chi tiết (sân, ngày, giờ, tổng tiền).
  3. Bấm nút "Hủy đặt sân" (Cancel Booking).
  4. Xác nhận hộp thoại cảnh báo hủy sân.
  5. Quay lại bảng Availability của sân `BM-01` ngày D+1.
* **Kết quả mong đợi (Expected):**
  * Trạng thái đơn đổi sang `CANCELLED`.
  * Các khung giờ tương ứng trên bảng lịch tự động chuyển ngược lại thành `Available` (cho phép người khác đặt lại).

---

### UAT-07: Quản trị viên Quản lý Sân & Cấu hình Giờ hoạt động (Admin Court & Schedule)
* **Truy vết:** FR-08, FR-09 (Admin Court & Operating Hours).
* **Vai trò:** Quản trị viên (`fixture-admin@example.test`).
* **Dữ liệu đầu vào:** Tên sân mới: `Sân Tennis VIP 01`, Mã: `TN-VIP`, Giờ mở cửa: `06:00 - 22:00`.
* **Các bước thực hiện:**
  1. Đăng nhập với tài khoản ADMIN, truy cập trang Quản trị (Admin Dashboard).
  2. Vào mục "Quản lý Sân" (Court Management), chọn "Thêm sân mới".
  3. Nhập môn thể thao, mã sân, tên sân, giá tiền và lưu.
  4. Vào mục "Cấu hình Giờ hoạt động" (Operating Hours) của sân vừa tạo, thiết lập khung giờ và lưu.
* **Kết quả mong đợi (Expected):**
  * Sân mới được tạo thành công, xuất hiện trong danh sách quản trị và phía giao diện người dùng.
  * API sinh đầy đủ các khung giờ (TimeSlots) theo giờ hoạt động đã thiết lập.

---

### UAT-08: Quản trị viên Thiết lập Lịch bảo trì / Khóa sân (Admin Blackout)
* **Truy vết:** FR-10 (Court Blackout Management).
* **Vai trò:** Quản trị viên (`fixture-admin@example.test`).
* **Dữ liệu đầu vào:** Sân `FB-01`, Ngày D+2, Khung giờ: 08:00 - 12:00, Lý do: `Bảo trì mặt cỏ định kỳ`.
* **Các bước thực hiện:**
  1. Tại trang Quản trị, chọn mục "Quản lý Bảo trì" (Blackouts).
  2. Bấm "Tạo lịch bảo trì", chọn sân `FB-01`, chọn ngày và khoảng giờ bảo trì.
  3. Nhập lý do bảo trì và bấm "Xác nhận".
  4. Mở cửa sổ ẩn danh (chưa đăng nhập hoặc đăng nhập USER), vào xem lịch sân `FB-01` ngày D+2.
* **Kết quả mong đợi (Expected):**
  * Lịch bảo trì được tạo thành công trên hệ thống.
  * Phía người dùng, các khung giờ 08:00 - 12:00 hiển thị trạng thái `Blackout` / Khóa bảo trì, không cho phép chọn đặt.

---

### UAT-09: Quản trị viên Tra cứu Thống kê Cơ bản (Basic Statistics)
* **Truy vết:** FR-11 (Admin Statistics Dashboard).
* **Vai trò:** Quản trị viên (`fixture-admin@example.test`).
* **Dữ liệu đầu vào:** Bộ lọc theo tháng hiện tại.
* **Các bước thực hiện:**
  1. Tại trang Quản trị, chọn mục "Báo cáo & Thống kê" (Statistics).
  2. Quan sát các chỉ số tổng quan: Tổng số lượt đặt sân, Tổng doanh thu ước tính, Tỷ lệ lấp đầy theo môn thể thao.
  3. Kiểm tra tính khớp nối với các đơn đặt sân đã tạo trong hệ thống.
* **Kết quả mong đợi (Expected):**
  * Bảng thống kê và biểu đồ hiển thị trực quan, số liệu phản ánh trung thực các đơn hàng thực tế trong cơ sở dữ liệu, không có lỗi tính toán âm hoặc lỗi định dạng tiền tệ (VND).

---

### UAT-10: Quản trị viên Kiểm tra Nhật ký Hoạt động (Audit Log)
* **Truy vết:** FR-12 (System Audit Trail).
* **Vai trò:** Quản trị viên (`fixture-admin@example.test`).
* **Dữ liệu đầu vào:** Tra cứu các thao tác vừa diễn ra.
* **Các bước thực hiện:**
  1. Tại trang Quản trị, chọn mục "Nhật ký hệ thống" (Audit Logs).
  2. Kiểm tra danh sách bản ghi: Thời gian, Người thực hiện (User/Admin), Hành động (CREATE_BOOKING, CANCEL_BOOKING, CREATE_BLACKOUT,...), Địa chỉ IP/User-Agent.
* **Kết quả mong đợi (Expected):**
  * Các thao tác trọng yếu từ kịch bản UAT-05, UAT-06, UAT-08 đều được ghi nhận đầy đủ vào Audit Trail với mốc thời gian chính xác, hỗ trợ đối soát bảo mật.

---

## 5. Mẫu Biểu Mẫu Nghiệm Thu Thực Tế (Execution & Acceptance Form Template)

*(Biểu mẫu này sẽ được Hưng và nhóm kiểm thử điền trực tiếp khi thực thi tại thẻ **#56**)*

### 5.1. Bảng Ghi nhận Kết quả Thực thi UAT-01..10
| Kịch bản | Tên kịch bản | Người thực hiện | Thời điểm chạy | Kết quả (Pass / Fail) | Link Bằng chứng (Screenshot / Log) | Ghi chú / Lỗi phát sinh |
|:---:|---|:---:|:---:|:---:|:---:|---|
| **UAT-01** | Đăng ký & Đăng nhập | *(Chờ thực thi #56)* | *(Chờ)* | `[ ] Pass`  `[ ] Fail` | *(Trống)* | *(Trống)* |
| **UAT-02** | Quản lý Hồ sơ cá nhân | *(Chờ thực thi #56)* | *(Chờ)* | `[ ] Pass`  `[ ] Fail` | *(Trống)* | *(Trống)* |
| **UAT-03** | Xem Danh sách & Chi tiết sân | *(Chờ thực thi #56)* | *(Chờ)* | `[ ] Pass`  `[ ] Fail` | *(Trống)* | *(Trống)* |
| **UAT-04** | Tra cứu Khung giờ trống | *(Chờ thực thi #56)* | *(Chờ)* | `[ ] Pass`  `[ ] Fail` | *(Trống)* | *(Trống)* |
| **UAT-05** | Đặt sân đơn & nhiều slot | *(Chờ thực thi #56)* | *(Chờ)* | `[ ] Pass`  `[ ] Fail` | *(Trống)* | *(Trống)* |
| **UAT-06** | Xem đơn đặt & Hủy đặt sân | *(Chờ thực thi #56)* | *(Chờ)* | `[ ] Pass`  `[ ] Fail` | *(Trống)* | *(Trống)* |
| **UAT-07** | Admin Sân & Giờ hoạt động | *(Chờ thực thi #56)* | *(Chờ)* | `[ ] Pass`  `[ ] Fail` | *(Trống)* | *(Trống)* |
| **UAT-08** | Admin Khóa sân bảo trì | *(Chờ thực thi #56)* | *(Chờ)* | `[ ] Pass`  `[ ] Fail` | *(Trống)* | *(Trống)* |
| **UAT-09** | Báo cáo Thống kê cơ bản | *(Chờ thực thi #56)* | *(Chờ)* | `[ ] Pass`  `[ ] Fail` | *(Trống)* | *(Trống)* |
| **UAT-10** | Nhật ký hệ thống Audit Log | *(Chờ thực thi #56)* | *(Chờ)* | `[ ] Pass`  `[ ] Fail` | *(Trống)* | *(Trống)* |

---

### 5.2. Bảng Theo dõi Khiếm khuyết & Yêu cầu Thay đổi (Defect vs Change Request)
*(Phân loại rõ giữa lỗi sai khác với đặc tả [Defect] và yêu cầu phát sinh mới ngoài phạm vi [CR])*

| Mã Issue | Loại (Defect / CR) | Thuộc Kịch bản | Mô tả chi tiết & Bước tái hiện | Mức độ (P1 / P2 / P3) | Trạng thái chuyển giao (#103) |
|:---:|:---:|:---:|---|:---:|---|
| *DEF-01* | *(Chờ thực thi)* | *(Chờ)* | *(Chờ thực thi kịch bản)* | *(Chờ)* | *(Chuyển sang thẻ #103)* |

---

### 5.3. Khung Xác nhận Nghiệm thu của Đại diện Người dùng (Customer Representative Sign-off)
- **Tình trạng:** `[ ] CHƯA NGHIỆM THU` (Đang ở giai đoạn chuẩn bị dữ liệu và kịch bản).
- **Đại diện Người dùng / Giảng viên hướng dẫn:** *(Chờ xác nhận sau khi chạy UAT thực tế)*.
- **Ngày ký xác nhận:** `____ / ____ / 2026`.

---

## 6. Kế hoạch Bàn giao sang Thẻ #56 (Handover Checklist)

- [x] Đã đối chiếu đầy đủ 10 kịch bản UAT với tài liệu baseline SRS-SB-001.
- [x] Đã chuẩn bị tài khoản USER và ADMIN không dùng mật khẩu thật.
- [x] Đã xác định dữ liệu mẫu và cơ chế seed từ `scripts/dev/Reset-StagingFixture.ps1`.
- [x] Đã chuẩn bị sẵn mẫu bảng kết quả (Actual/Evidence) và phân loại Defect/CR.
- [ ] Chuyển giao tài liệu cho Huy (PM) review và phê duyệt UAT Entry Gate.
- [ ] Bàn giao danh sách accounts/scenarios sang thẻ **#56 ([QA] UAT Execution & Acceptance Evidence)** để kích hoạt chạy thực tế.
