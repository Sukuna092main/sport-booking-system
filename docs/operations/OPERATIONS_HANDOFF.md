# Tài Liệu Bàn Giao Vận Hành Hệ Thống (Final Release / Operations Handoff Manual)

| Thuộc tính | Chi tiết |
|---|---|
| **Dự án** | **Sport Booking System** |
| **Phiên bản phát hành (Release Version)** | **`v1.1.0`** (Release Candidate: `v1.1.0-rc1`) |
| **Thẻ công việc (Trello Card)** | [#107 [DOC] Final Release / Operations Handoff](https://trello.com/c/hsSBIoHd) |
| **WBS / Requirement** | 1.6.4, 1.6.5 |
| **Người bàn giao (DevOps & QA Lead)** | Bảo Hưng Võ Nguyễn (`@bohngvonguyn`) |
| **Người tiếp nhận & Phê duyệt (PM & Backend Lead)** | Hoàng Phú Huy (`@hoangphuhuy`) |
| **Thành viên phối hợp (Frontend Lead)** | Phạm Bổn Duy (`@phmboduy1`) |
| **Ngày lập tài liệu** | 17/11/2026 |
| **Trạng thái tài liệu** | **Chính thức — Sẵn sàng bàn giao (Official Ready for Handoff)** |

---

## 1. Tổng quan kiến trúc & Môi trường vận hành (System Architecture & Topology)

Hệ thống Sport Booking System phiên bản `v1.1.0` được triển khai theo mô hình micro-service / cloud-native hybrid với độ sẵn sàng cao, chia thành 3 lớp dịch vụ chính:

```
[ Khách hàng / Quản trị viên ]
             │
             ▼
   [ Vercel Edge Network ] ─── https://sport-booking-system-ochre.vercel.app
             │ (HTTPS / REST API)
             ▼
    [ Render Web Service ] ─── https://sport-booking-api-staging.onrender.com/api/v1
             │ (PostgreSQL Protocol / TLS)
             ▼
    [ Neon Serverless DB ] ─── ep-nameless-glade-b3rz6u6q (ap-southeast-1)
```

### 1.1. Bảng phân bổ hạ tầng và thông tin môi trường

| Thành phần | Hạ tầng / Dịch vụ | URL chính thức / Endpoint | Cơ chế triển khai |
|---|---|---|---|
| **Giao diện người dùng (Frontend)** | Vercel Edge Network (Hobby Plan) | [https://sport-booking-system-ochre.vercel.app](https://sport-booking-system-ochre.vercel.app) | Tự động build từ branch `develop` (Vite, React 19, TailwindCSS, Client-side rewrites `vercel.json`). |
| **Giao diện lập trình (Backend API)** | Render Web Service (Singapore, Free Plan) | [https://sport-booking-api-staging.onrender.com/api/v1](https://sport-booking-api-staging.onrender.com/api/v1) | Tự động build và deploy từ branch `develop` (Go 1.24, Chi router, Docker multi-stage build). |
| **Cơ sở dữ liệu (Database)** | Neon Serverless PostgreSQL | `ep-nameless-glade-b3rz6u6q.ap-southeast-1.aws.neon.tech` | Serverless PostgreSQL 16/17, quản lý phiên bản qua công cụ Goose (Schema version: 11). |
| **Kiểm tra sức khỏe (Health Check)** | Render API Endpoint | `GET https://sport-booking-api-staging.onrender.com/api/v1/ping` | Phản hồi JSON `{"status":"ok","environment":"production"}`. |
| **Hạ tầng dự phòng cục bộ (Local Fallback)** | Docker Compose (Localhost) | `localhost:8080` (API), `localhost:5173` (Frontend), `localhost:5432` (PostgreSQL) | Container `sportbookingsystem-db-1` (Postgres 17 Alpine) + Goose migration container tự động. |

> [!WARNING]
> **Quy định về Domain Frontend:** Chỉ sử dụng domain chính thức `sport-booking-system-ochre.vercel.app`. Các URL dạng xem trước `sport-booking-system-<hash>.vercel.app` chịu cơ chế Vercel Deployment Protection (bị redirect 302 sang trang đăng nhập SSO của Vercel), người dùng ngoài tổ chức không thể truy cập.

---

## 2. Quản lý thông tin bảo mật & Bàn giao quyền truy cập (Secrets & Access Handover)

Tuân thủ nghiêm ngặt quy tắc an toàn thông tin của dự án: **Tuyệt đối không lưu trữ bất kỳ thông tin nhạy cảm, mật khẩu hoặc connection string nào vào mã nguồn Git hoặc mô tả thẻ Trello.**

### 2.1. Danh mục các thông tin cấu hình nhạy cảm (Secrets Inventory)

| Phạm vi | Tên biến môi trường | Mục đích sử dụng | Vị trí lưu trữ an toàn |
|---|---|---|---|
| **Render Backend** | `DATABASE_URL` | Kết nối DB từ backend API | Dashboard Render (Secret Environment Variables), dùng role `app_staging` qua endpoint pooled PgBouncer (`-pooler`). |
| **Render Backend** | `JWT_SECRET` | Khóa ký và giải mã JWT token | Dashboard Render, chuỗi ngẫu nhiên 64 ký tự hex độc lập cho staging. |
| **Render Backend** | `APP_TIMEZONE` | Múi giờ hệ thống (`Asia/Ho_Chi_Minh`) | Bắt buộc phải có trong Render, thiếu biến app sẽ tự thoát (exit). |
| **Render Backend** | `CORS_ALLOWED_ORIGINS` | Giới hạn tên miền truy cập | Chỉ cho phép `https://sport-booking-system-ochre.vercel.app`. |
| **Vercel Frontend** | `VITE_API_BASE_URL` | Endpoint API của backend | Dashboard Vercel (Production Environment Variables). Biến build-time, yêu cầu redeploy khi sửa đổi. |
| **Ops CLI Local** | `STAGING_DATABASE_URL_DIRECT` | Dùng cho công cụ Goose Migration | Lưu tại file `backend/.env.staging` trên máy vận hành (đã gitignore). Kết nối trực tiếp không qua pooler. |
| **Ops CLI Local** | `STAGING_DATABASE_URL_POOLED` | Dùng cho tài khoản owner quản trị | Lưu tại file `backend/.env.staging` trên máy vận hành (đã gitignore). |

### 2.2. Kênh bàn giao quyền và thông tin truy cập
- **Kênh bàn giao:** Bàn giao qua kênh bảo mật nội bộ (Vault/1Password hoặc tin nhắn mã hóa trực tiếp giữa Hưng và Huy PM).
- **Quyền quản trị bàn giao:**
  - Quyền quản trị tổ chức Trello `Nhom9_QuanLyDuAnPhanMem`.
  - Quyền Owner/Admin trên Vercel Project `sport-booking-system-ochre`.
  - Quyền Quản trị viên dịch vụ Render Service `sport-booking-api-staging`.
  - Quyền Quản trị viên cơ sở dữ liệu Neon Project `ep-nameless-glade-b3rz6u6q`.

---

## 3. Sổ tay vận hành hệ thống (Operational Runbooks)

### 3.1. Quy trình Triển khai & Phát hành bản mới (Deployment & Release Runbook)
1. **Quy tắc luồng nhánh (Branching Flow):** Toàn bộ tính năng hoặc sửa lỗi phải được phát triển trên nhánh riêng, tạo Pull Request và yêu cầu tối thiểu 1 reviewer phê duyệt trước khi merge vào `develop`.
2. **Kích hoạt tự động (CI/CD):**
   - Khi PR được merge vào `develop`, Render tự động phát hiện webhook và tiến hành build Docker image backend.
   - Vercel tự động phát hiện commit mới trên `develop` và build lại gói tĩnh frontend.
3. **Quy trình kiểm tra khói sau triển khai (Smoke Check):**
   ```powershell
   # 1. Kiểm tra API Healthcheck
   curl.exe -i https://sport-booking-api-staging.onrender.com/api/v1/ping
   # Kỳ vọng: HTTP 200, {"status":"ok","environment":"production"}

   # 2. Kiểm tra danh mục sân thể thao
   curl.exe -i https://sport-booking-api-staging.onrender.com/api/v1/courts
   # Kỳ vọng: HTTP 200, meta.total >= 2
   ```

### 3.2. Quy trình Xử lý Khởi động nguội & Giữ kết nối (Cold Start & Keep-Alive Runbook)
- **Đặc tính gói Render Free:** Dịch vụ backend tự động đi vào trạng thái ngủ (spin-down/idle) nếu không có bất kỳ lượt truy cập HTTP nào trong vòng 15 phút. Khi có request mới, thời gian khởi động lại dịch vụ (cold start) kéo dài từ **30 đến 50 giây**.
- **Hiện tượng nhận biết:** Người dùng tải trang lần đầu sau thời gian nghỉ thấy trang web chờ tải dữ liệu trong khoảng 40 giây. Đây là hành vi bình thường của hạ tầng miễn phí, không phải lỗi sập ứng dụng.
- **Biện pháp vận hành trong sự kiện / chấm điểm / demo:**
  - Chạy kịch bản ping định kỳ mỗi 10 phút từ máy trạm:
    ```powershell
    while ($true) {
        Write-Host "[$(Get-Date)] Ping API Render..." -ForegroundColor Cyan
        Invoke-RestMethod -Uri "https://sport-booking-api-staging.onrender.com/api/v1/ping"
        Start-Sleep -Seconds 600
    }
    ```

### 3.3. Quy trình Di chuyển Cơ sở dữ liệu (Database Migration Runbook)
- **Công cụ quản lý:** `goose` (Image `ghcr.io/kukymbr/goose-docker:3.24.0`).
- **Nguyên tắc an toàn sống còn:**
  - **TUYỆT ĐỐI KHÔNG** chạy lệnh di chuyển schema (`goose up` hoặc `goose down`) thông qua endpoint `-pooler` của PgBouncer. PgBouncer chạy ở chế độ transaction pooling sẽ làm đứt kết nối hoặc lỗi khóa phiên bản DDL.
  - Luôn sử dụng script tự động hóa an toàn `scripts/dev/Invoke-StagingMigration.ps1`. Script này tích hợp sẵn bộ kiểm tra: bắt buộc SSL, từ chối endpoint `-pooler`, và chỉ cho phép chạy khi trỏ đúng tên miền Neon.

```powershell
# 1. Kiểm tra trạng thái các phiên bản migration hiện tại
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/Invoke-StagingMigration.ps1 -Command status

# 2. Áp dụng các bản migration mới còn thiếu
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/Invoke-StagingMigration.ps1 -Command up
```

### 3.4. Quy trình Sao lưu & Phục hồi Dữ liệu (Backup & Restore Runbook)
Dự án đã thiết lập quy trình kiểm thử diễn tập sao lưu và phục hồi tự động, được thẩm định tại Thẻ #102 (`docs/operations/BACKUP_RESTORE_READINESS_REPORT.md`):

- **Thông số kỹ thuật đã kiểm chứng thực tế:**
  - **RTO (Thời gian phục hồi thực tế - Recovery Time Objective):** **3.15 giây** (Đạt vượt chuẩn yêu cầu SLA < 30 phút).
  - **RPO (Mức độ mất mát dữ liệu - Recovery Point Objective):** **0 records** (Khớp chính xác 100% dữ liệu trên toàn bộ 10/10 bảng nghiệp vụ, tổng cộng 1,523 dòng dữ liệu).
- **Kịch bản phục hồi khi xảy ra sự cố:**
  1. *Phương án 1 (Cloud Point-in-time Restore):* Sử dụng tính năng Instant Branching / Point-in-time Recovery của Neon Dashboard để khôi phục snapshot tại thời điểm trước sự cố.
  2. *Phương án 2 (Kịch bản khôi phục tự động qua Script):*
     ```powershell
     # Chạy kịch bản diễn tập hoặc khôi phục dữ liệu từ bản sao lưu snapshot
     powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/Invoke-BackupRestoreTest.ps1
     ```

### 3.5. Quy trình Hoàn nguyên Sự cố (Rollback Runbook)
Khi một bản phát hành mới gặp sự cố nghiêm trọng không thể khắc phục ngay:

| Thành phần | Thao tác hoàn nguyên (Rollback) | Lưu ý & Phạm vi ảnh hưởng |
|---|---|---|
| **Backend API** | Mở Render Dashboard → Chọn `sport-booking-api-staging` → Tab **Deploys** → Chọn bản deploy thành công gần nhất → Nhấn nút **Rollback to this deploy**. | Thao tác diễn ra trong ~1-2 phút. Không làm ảnh hưởng hoặc thay đổi dữ liệu trong cơ sở dữ liệu. |
| **Frontend UI** | Mở Vercel Dashboard → Chọn Project `sport-booking-system-ochre` → Tab **Deployments** → Chọn bản deploy ổn định trước đó → Nhấn menu `...` → **Promote to Production**. | Hoàn nguyên tức thì trên mạng Vercel CDN trong vài giây. |
| **Cơ sở dữ liệu** | **Không khuyến khích chạy lệnh `down` trực tiếp trên Production.** Nếu bắt buộc: 1. Tạo snapshot backup DB ngay lập tức; 2. PM Hoàng Phú Huy phê duyệt script lùi schema; 3. Chạy lệnh hạ phiên bản trong khung giờ bảo trì. | Tránh rollback làm mất các cột dữ liệu đã phát sinh giao dịch mới. |

### 3.6. Quy trình Kích hoạt Chế độ Dự phòng Cục bộ (Local Fallback Runbook)
Trong trường hợp hạ tầng Cloud (Render/Neon/Vercel) gặp sự cố mất mạng hoặc sử dụng trong buổi nghiệm thu ngoại tuyến:

1. Đảm bảo Docker Desktop đang chạy trên máy chủ/máy trạm.
2. Khởi chạy toàn bộ hạ tầng cơ sở dữ liệu cục bộ:
   ```powershell
   # Khởi động PostgreSQL 17 và tự động chạy Goose Migration
   docker-compose up -d
   ```
3. Khởi chạy backend API cục bộ:
   ```powershell
   cd backend
   go run cmd/server/main.go
   # Backend lắng nghe tại http://localhost:8080
   ```
4. Khởi chạy frontend cục bộ:
   ```powershell
   cd frontend
   npm run dev
   # Frontend truy cập tại http://localhost:5173
   ```
5. Toàn bộ tính năng đặt sân, quản trị, thống kê và xác thực hoạt động 100% offline.

---

## 4. Quản lý Định mức Tài nguyên & Giới hạn Hạ tầng (Quotas & Limitations)

| Dịch vụ | Gói tài khoản | Giới hạn định mức (Quotas) | Hướng xử lý khi chạm ngưỡng |
|---|---|---|---|
| **Render Web Service** | Free Plan | 750 giờ tính toán miễn phí/tháng (chia sẻ cho toàn bộ services trong tài khoản). 512 MB RAM. | Tắt các dịch vụ cũ không sử dụng trong tài khoản Render. Nâng cấp gói Starter (\$7/tháng) nếu hệ thống chuyển sang thương mại. |
| **Neon PostgreSQL** | Free Tier | 0.5 GiB dung lượng lưu trữ. Tính toán tự động co giãn. | Chạy kịch bản dọn dẹp audit log và test booking định kỳ. Xóa các branch cơ sở dữ liệu không sử dụng. |
| **Vercel** | Hobby Plan | 100 GB băng thông/tháng. Giới hạn 100 lần build/ngày. | Đã cấu hình cache tài nguyên tĩnh hiệu quả qua Vite build headers. |

---

## 5. Bảng ma trận bằng chứng vận hành (Operational Evidence Traceability Matrix)

Toàn bộ các hoạt động triển khai, kiểm thử và diễn tập vận hành đều được lập biên bản và lưu trữ đầy đủ trong thư mục `docs/operations/`:

| STT | Tài liệu bằng chứng | Thẻ Trello liên quan | Nội dung & Giá trị kiểm chứng |
|:---:|---|---|---|
| 1 | [DB_MIGRATION_READINESS.md](DB_MIGRATION_READINESS.md) | Thẻ #51 (Sprint 5) | Đánh giá tính sẵn sàng và cơ chế chạy migration 2 chiều an toàn trên Neon. |
| 2 | [STAGING_RUNBOOK.md](STAGING_RUNBOOK.md) | Thẻ #51 (Sprint 5) | Sổ tay vận hành ban đầu cho môi trường staging, chi tiết các cấu hình cổng và múi giờ. |
| 3 | [STAGING_CONFIG_REVIEW.md](STAGING_CONFIG_REVIEW.md) | Thẻ #51 (Sprint 5) | Rà soát toàn bộ các biến môi trường và mức độ tuân thủ bảo mật 12-Factor App. |
| 4 | [BACKUP_RESTORE_READINESS_REPORT.md](BACKUP_RESTORE_READINESS_REPORT.md) | Thẻ #102 (Sprint 6) | Báo cáo kiểm thử diễn tập sao lưu: RTO 3.15s, RPO 0, khớp 10/10 bảng dữ liệu (1,523 bản ghi). |
| 5 | [RELEASE_CANDIDATE_VALIDATION_REPORT.md](RELEASE_CANDIDATE_VALIDATION_REPORT.md) | Thẻ #104 (Sprint 6) | Báo cáo đóng gói Release Candidate `v1.1.0-rc1`: 0 lỗi Go build, 247/247 frontend tests pass 100%. |
| 6 | [FINAL_DEPLOYMENT_REPORT.md](FINAL_DEPLOYMENT_REPORT.md) | Thẻ #58 (Sprint 7) | Báo cáo triển khai cuối cùng & kiểm chứng Smoke: 38/38 Newman assertions đạt 100% trên URL thật. |
| 7 | [UAT_EXECUTION_AND_ACCEPTANCE_REPORT.md](../qa/UAT_EXECUTION_AND_ACCEPTANCE_REPORT.md) | Thẻ #56 (Sprint 6) | Biên bản nghiệm thu chấp nhận người dùng UAT: 10/10 kịch bản đạt tiêu chuẩn nghiệm thu. |

---

## 6. Hạng mục Trì hoãn & Quản lý Thay đổi (Deferred Scope & Change Requests Disposition)

Nhằm đảm bảo chất lượng phát hành đúng hạn cho mốc `v1.1.0`, các hạng mục sau đã được thống nhất đưa vào diện **Trì hoãn có kiểm soát (Deferred Scope)** và chuyển giao sang lộ trình phiên bản tiếp theo:

1. **Biểu đồ thống kê chuyên sâu (Advanced Visual Analytics):**
   - *Hiện trạng:* Backend đã cung cấp đầy đủ API tổng hợp số liệu `GET /api/v1/admin/statistics?from=...&to=...`. Giao diện Frontend hiển thị bảng số liệu và các chỉ số KPI doanh thu, lượt đặt sân. Các biểu đồ trực quan dạng chart được tài liệu hóa kiến trúc tại `frontend/src/features/admin/statistics/README.md`.
   - *Đánh giá:* Không chặn luồng nghiệp vụ vận hành của Admin. Chuyển sang phiên bản `v1.2.0`.
2. **Tích hợp Cổng thanh toán trực tuyến bên thứ ba (Third-party Payment Gateway - VNPay / MoMo):**
   - *Hiện trạng:* Hệ thống hiện tại hỗ trợ luồng nghiệp vụ xác nhận đơn đặt sân, giữ chỗ và hủy chỗ với trạng thái thanh toán linh hoạt.
   - *Đánh giá:* Thiết kế module thanh toán độc lập; việc tích hợp cổng thanh toán trực tiếp sẽ được thực hiện khi ký hợp đồng thương mại với nhà cung cấp dịch vụ thanh toán trong giai đoạn 2.

---

## 7. Biên bản Ký nhận Bàn giao (Handoff Sign-off & Closure)

Biên bản bàn giao này xác nhận toàn bộ các thành phần mã nguồn, hạ tầng đám mây, cơ chế sao lưu dự phòng, bộ tài liệu vận hành và bằng chứng kiểm thử của hệ thống **Sport Booking System (v1.1.0)** đã hoàn tất 100% và chuyển giao quyền làm chủ cho đội ngũ quản lý dự án.

| Đại diện bàn giao (DevOps & QA Lead) | Đại diện tiếp nhận (Project Manager & Backend Lead) | Đại diện phát triển Frontend (Frontend Lead) |
|:---:|:---:|:---:|
| *(Đã ký bàn giao)* | *(Đã nghiệm thu)* | *(Đã nghiệm thu)* |
| **Bảo Hưng Võ Nguyễn** | **Hoàng Phú Huy** | **Phạm Bổn Duy** |
| `@bohngvonguyn` | `@hoangphuhuy` | `@phmboduy1` |
| Ngày: 17/11/2026 | Ngày: 17/11/2026 | Ngày: 17/11/2026 |
