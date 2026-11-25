# Báo Cáo Đóng Gói & Kiểm Định Bản Release Candidate (RC Build & Validation Report)

| Thuộc tính | Nội dung |
|---|---|
| **Thẻ công việc** | [#104 [DEVOPS] Release Candidate Build & Validation](https://trello.com/c/1ufWyuIW) |
| **WBS / Requirement** | 1.5.2 |
| **Người thực hiện chính** | Bảo Hưng Võ Nguyễn (DevOps / QA Lead - `@bohngvonguyn`) |
| **Reviewer** | Hoàng Phú Huy (PM / Backend - `@hoangphuhuy`) |
| **Ngày thực hiện** | **17/11/2026, 16:00 (UTC+7)** |
| **Release Candidate Tag** | **`v1.1.0-rc1`** |
| **Commit định danh** | `884bddb` (Base `develop`, đã tích hợp toàn bộ UAT S6 & Backup/Restore Readiness) |
| **Kết quả thẩm định** | **100% READY** — Đạt toàn bộ tiêu chí chất lượng, sẵn sàng cho Final Deployment S7 |

---

## 1. Mục tiêu & Phạm vi kiểm định

1. **Mục tiêu:**
   - Đóng gói phiên bản ứng cử viên phát hành chính thức đầu tiên (**Release Candidate 1 — `v1.1.0-rc1`**) cho Sport Booking System.
   - Thẩm định độc lập toàn diện: Bản build Backend/Frontend có thể tái lập, tương thích cấu hình môi trường, toàn vẹn cơ sở dữ liệu và xác thực trực tiếp trên môi trường Staging trực tuyến.
   - Chuẩn bị đầy đủ tài liệu, biên bản kiểm chứng và kế hoạch rollback dự phòng làm đầu vào cho buổi Review Gate với PM (@hoangphuhuy).
2. **Các điều kiện tiên quyết (Prerequisites Gate) đã hoàn thành:**
   - ✅ **UAT Preparation (#101):** 10 kịch bản UAT-01..10 và bộ dữ liệu tài khoản kiểm chứng đã được phê duyệt tại PR #49.
   - ✅ **UAT Execution (#56):** Kịch bản Postman Collection (`postman/Sport-Booking-UAT-Sprint6.postman_collection.json`) đạt 38/38 assertions (100% Pass) qua Newman CLI, PR #50.
   - ✅ **Backup/Restore Readiness (#102):** Diễn tập phục hồi an toàn trên DB độc lập, đối soát 10/10 bảng (1,523 bản ghi) khớp 100%, PR #51.

---

## 2. Thông tin phiên bản & Cấu hình môi trường

| Hạng mục | Thông tin chi tiết |
|---|---|
| **Mã phiên bản (Tag)** | `v1.1.0-rc1` |
| **Nhánh Git** | `devops/s6-rc-build-validation` (tách từ `develop` tại commit `884bddb`) |
| **Frontend Production URL** | https://sport-booking-system-ochre.vercel.app |
| **Backend API Staging URL** | https://sport-booking-api-staging.onrender.com/api/v1 |
| **Database Staging** | Neon Serverless PostgreSQL (`ep-nameless-glade-b3rz6u6q`, region `ap-southeast-1`) |
| **Database Schema Version** | Goose Migration Version 11 (`00001_extensions.sql` → `00011_align_foundation_constraints.sql`) |

### Rà soát cấu hình biến môi trường (Config & Secrets Check):
* **Render (Backend):** 
  * `APP_ENV=production`, `APP_TIMEZONE=Asia/Ho_Chi_Minh`
  * `HTTP_ADDR=:10000`
  * `DATABASE_URL` (kết nối endpoint pooled an toàn)
  * `JWT_SECRET` (khóa ký độc lập cho staging), `JWT_TTL=15m`
  * `CORS_ALLOWED_ORIGINS=https://sport-booking-system-ochre.vercel.app`
* **Vercel (Frontend):** 
  * `VITE_API_BASE_URL=https://sport-booking-api-staging.onrender.com/api/v1`
* **Bảo mật:** Không có secret hoặc credential nào bị lưu vào git, artifacts hay log công khai.

---

## 3. Kết quả kiểm tra Build & Test (Reproducible Build Validation)

### 3.1 Backend (Go)
* **Trình biên dịch:** Go `go1.27.0` (windows/amd64 & linux/amd64 container).
* **Static Analysis:** `go vet ./...` → **0 cảnh báo / 0 lỗi**.
* **Biên dịch mã nguồn:** `go build ./...` → **Biên dịch thành công 100%**.
* **Đặc tả API:** Đã đồng bộ với OpenAPI specification và tuân thủ kiến trúc Modular Monolith.

### 3.2 Frontend (React 19 + TypeScript + Vite)
* **Kiểm tra kiểu dữ liệu (Typecheck):** `npx tsc -b` → **0 lỗi TypeScript**.
* **Kiểm thử tự động (Unit / Component Tests):**
  * Công cụ: `Vitest v5.0.3`
  * Số lượng: **13/13 test suites PASS** (gồm auth, courts, availability, bookings, adminSchedule, adminBookings, adminBlackouts...).
  * Tổng số test cases: **247/247 tests PASSED (100% Pass rate, 0 failed)**.
* **Đóng gói Bundle (Production Build):**
  * Công cụ: `vite build`
  * Kết quả: Tạo bundle tối ưu tại `frontend/dist/` (`index.html`, `assets/index-*.js`, `assets/index-*.css`, web fonts).
  * Thời gian đóng gói: `17.84s`.

---

## 4. Kiểm chứng trực tiếp trên môi trường Staging (Live Staging Validation)

Tiến hành kiểm tra trực tiếp qua API Staging thực tế:

| STT | Luồng kiểm tra | Endpoint | Tham số / Payload | Kết quả mong đợi | Kết quả thực tế | Trạng thái |
|:---:|---|---|---|---|---|:---:|
| 1 | Hệ thống hoạt động | `GET /ping` | None | HTTP 200, pong | HTTP 200, pong (`production`) | ✅ PASS |
| 2 | Danh sách sân thể thao | `GET /courts` | None | HTTP 200, danh sách sân | HTTP 200, 10 sân hoạt động | ✅ PASS |
| 3 | Đăng nhập Quản trị | `POST /auth/login` | Email/password admin UAT | HTTP 200, JWT token | HTTP 200, AccessToken hợp lệ | ✅ PASS |
| 4 | Báo cáo thống kê Admin | `GET /admin/statistics` | `?from=2026-11-01&to=2026-11-30` | HTTP 200, số liệu đặt sân | HTTP 200 (Total 25, Confirmed 14, Cancelled 11) | ✅ PASS |
| 5 | Nhật ký kiểm toán đặt sân | `GET /admin/bookings` | Admin Bearer Token | HTTP 200, audit lịch sử | HTTP 200 (20 bản ghi truy vết) | ✅ PASS |

---

## 5. Kế hoạch Fallback & Dự phòng Rollback

1. **Phương án sao lưu trước Release:**
   * Snapshot dữ liệu Staging đã được lưu tại `artifacts/operations/backup_restore_evidence.json`.
   * Quy trình phục hồi tự động đã được kiểm chứng sẵn sàng qua script `scripts/dev/Invoke-BackupRestoreTest.ps1` (RTO = 3.15s, RPO = 0).
2. **Kế hoạch Rollback:**
   * Trong trường hợp việc triển khai Release tại Sprint 7 gặp sự cố nghiêm trọng, hệ thống có thể revert về tag `v1.1.0-rc1` ngay lập tức.
   * Bản build local dự phòng qua `docker-compose.yml` (`sportbookingsystem-db-1` + local backend + frontend) đã được kiểm chứng hoạt động độc lập không phụ thuộc Internet.

---

## 6. Kết luận & Gate Review Handoff

* Phiên bản **`v1.1.0-rc1`** đã vượt qua tất cả các tiêu chí kiểm định nghiêm ngặt:
  1. Build Backend/Frontend sạch sẽ, 247/247 tests đạt 100%.
  2. Toàn bộ 10 kịch bản UAT Sprint 6 được xác nhận đạt yêu cầu trên Staging.
  3. Cơ sở dữ liệu Goose schema v11 và dữ liệu thực tế được bảo toàn nguyên vẹn.
  4. Sẵn sàng 100% để chuyển sang Sprint 7: **Card #58 (`Final Deployment & Smoke Validation`)** và **Card #107 (`Final Release / Operations Handoff`)**.
