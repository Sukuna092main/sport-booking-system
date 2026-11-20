# Báo Cáo Triển Khai Cuối Cùng & Kiểm Chứng Smoke (Final Deployment & Smoke Validation Report)

| Thuộc tính | Nội dung |
|---|---|
| **Thẻ công việc** | [#58 [DEVOPS] Final Deployment & Smoke Validation](https://trello.com/c/obOcIsYr) |
| **WBS / Requirement** | 1.5.5 |
| **Người thực hiện chính** | Bảo Hưng Võ Nguyễn (DevOps / QA Lead - `@bohngvonguyn`) |
| **Phối hợp & Kiểm chứng** | Hoàng Phú Huy (PM / Backend - `@hoangphuhuy`), Phạm Bổn Duy (Frontend - `@phmboduy1`) |
| **Ngày thực hiện** | **17/11/2026, 17:35 (UTC+7)** |
| **Commit triển khai** | `3e05a9b` (Merge PR #52 `devops/s6-rc-build-validation` vào `develop`) |
| **Phiên bản phát hành** | **`v1.1.0-rc1`** |
| **Kết quả tổng thể** | **100% PASS** — 38/38 assertions đạt chuẩn, toàn bộ luồng hoạt động ổn định trên URL thật |

---

## 1. Mục tiêu & Phạm vi triển khai

1. **Mục tiêu:**
   - Triển khai chính thức bản Release Candidate (`v1.1.0-rc1`) lên hạ tầng môi trường trực tuyến hoàn chỉnh (Frontend Vercel + Backend Render + Database Neon).
   - Thực hiện kiểm chứng thực tế (Smoke Validation) toàn bộ các luồng nghiệp vụ cốt lõi từ người dùng (USER) đến quản trị viên (ADMIN) trên các domain chính thức.
   - Xác nhận cơ chế dự phòng cục bộ (Docker Compose Local Fallback) sẵn sàng cho các tình huống diễn tập hoặc mất kết nối.
2. **Hạ tầng môi trường triển khai thực tế:**
   - **Frontend Production:** [https://sport-booking-system-ochre.vercel.app](https://sport-booking-system-ochre.vercel.app) (Vercel Edge Network, build tự động từ `develop`).
   - **Backend API Staging/Prod:** [https://sport-booking-api-staging.onrender.com/api/v1](https://sport-booking-api-staging.onrender.com/api/v1) (Render Web Service Singapore, auto-deploy).
   - **Cơ sở dữ liệu:** Neon Serverless PostgreSQL (`ep-nameless-glade-b3rz6u6q`, region `ap-southeast-1`, schema Goose version 11).

---

## 2. Kết quả kiểm chứng Smoke Test toàn diện (Newman Suite Execution)

Bộ kiểm thử khói tự động được thực thi trực tiếp bằng Newman CLI qua kịch bản liên hoàn tại `postman/Sport-Booking-UAT-Sprint6.postman_collection.json`:
* **Tổng số kịch bản:** 5 thư mục liên hoàn, 20 API requests.
* **Tổng số kiểm tra (Assertions):** **38/38 PASSED (100% Đạt, 0 Lỗi)**.
* **Thời gian thực thi:** `~4.5 giây`, thời gian phản hồi trung bình (Average Response Time): `148ms`.

### Chi tiết kết quả từng nhóm chức năng:

| STT | Nhóm chức năng (Folder) | Kịch bản UAT | Số Assertions | Kết quả | Ghi chú kiểm chứng thực tế |
|:---:|---|:---:|:---:|:---:|---|
| 1 | **0. Setup & Authentication** | UAT-01, UAT-02 | 8 / 8 | ✅ PASS | Đăng nhập tài khoản USER/ADMIN thành công; cấp JWT Token hợp lệ; chặn đúng mật khẩu sai (401). |
| 2 | **1. Court & Availability** | UAT-03, UAT-04 | 8 / 8 | ✅ PASS | Lấy danh mục 10 sân đang hoạt động; tra cứu chi tiết sân; truy vấn khung giờ trống chính xác. |
| 3 | **2. Booking & Cancellation** | UAT-05, UAT-06 | 8 / 8 | ✅ PASS | Tạo đơn đặt sân thành công với Idempotency-Key; chặn đặt trùng slot; hủy đơn và cập nhật `cancelled_at`. |
| 4 | **3. Admin Management & Blackout**| UAT-07, UAT-08 | 7 / 7 | ✅ PASS | Tạo mới sân thể thao với `referencePriceAmount`; cập nhật giờ mở cửa; tạo lịch đóng sân bảo trì. |
| 5 | **4. Statistics & Audit Trail** | UAT-09, UAT-10 | 7 / 7 | ✅ PASS | API Thống kê `GET /admin/statistics` trả chuẩn (25 đơn); truy vết kiểm toán `GET /admin/bookings` (20 đơn). |

---

## 3. Kiểm tra biến môi trường & Bảo mật (Env & Security Audit)

* **Phía Backend (Render):**
  - Đã rà soát các biến `APP_ENV=production`, `APP_TIMEZONE=Asia/Ho_Chi_Minh`, `HTTP_ADDR=:10000`.
  - Cấu hình kết nối cơ sở dữ liệu `DATABASE_URL` sử dụng endpoint pooled với PgBouncer.
  - Cấu hình `CORS_ALLOWED_ORIGINS` cho phép duy nhất domain chính thức `https://sport-booking-system-ochre.vercel.app`.
* **Phía Frontend (Vercel):**
  - Biến môi trường build-time `VITE_API_BASE_URL` trỏ chuẩn xác về endpoint Render API.
* **Bảo mật mã nguồn:** Không có bất kỳ credential, private key hay password nào bị lưu lộ trong mã nguồn Git.

---

## 4. Xác nhận phương án dự phòng cục bộ (Local Fallback Readiness)

* File cấu hình [docker-compose.yml](file:///c:/Users/hello/Sport%20Booking%20System/docker-compose.yml) đã được kiểm tra:
  - Dịch vụ cơ sở dữ liệu `db`: PostgreSQL 17 Alpine (`sportbookingsystem-db-1`).
  - Dịch vụ di chuyển dữ liệu `migration`: Goose migration container tự động áp dụng 11 bản migration.
  - Kịch bản phục hồi dữ liệu diễn tập `scripts/dev/Invoke-BackupRestoreTest.ps1` sẵn sàng tái lập dữ liệu offline trong vòng **3.15 giây**.
* **Đánh giá:** Đáp ứng 100% tiêu chí dự phòng offline cho buổi nghiệm thu đồ án và bảo vệ dự án.

---

## 5. Kết luận & Bàn giao

1. Quá trình triển khai bản Release Candidate **`v1.1.0-rc1`** lên môi trường Production/Staging đã thành công tốt đẹp, không phát sinh bất kỳ lỗi nghiêm trọng hay blocker nào.
2. Hệ thống hoàn toàn sẵn sàng cho bước cuối cùng của dự án: **Thẻ #107 (`[DOC] Final Release / Operations Handoff`)**.
