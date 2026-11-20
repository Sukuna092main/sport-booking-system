# Báo Cáo Diễn Tập Sao Lưu & Phục Hồi (Backup / Restore Readiness Report)

| Thuộc tính | Nội dung |
|---|---|
| **Thẻ công việc** | [#102 [DEVOPS] Backup / Restore Readiness Test](https://trello.com/c/6Q4GuvxH) |
| **WBS / Requirement** | 1.5.4; NFR-11 |
| **Người thực hiện chính** | Bảo Hưng Võ Nguyễn (DevOps / QA Lead - `@bohngvonguyn`) |
| **Reviewer** | Hoàng Phú Huy (PM / Backend - `@hoangphuhuy`) |
| **Ngày thực hiện** | **17/11/2026, 15:20 (UTC+7)** |
| **Phiên bản hệ thống** | Nhánh `devops/s6-backup-restore-readiness` (Commit base `e3bad36`, Goose Migration v11) |
| **Kết quả tổng thể** | **100% PASS** — Đối soát 10/10 bảng khớp tuyệt đối, Smoke Flow thành công |

---

## 1. Mục tiêu & Nguyên tắc an toàn

1. **Mục tiêu:**
   - Kiểm chứng năng lực sao lưu và phục hồi dữ liệu thực tế của hệ thống Sport Booking System trước khi bước vào Release Candidate (RC).
   - Đảm bảo toàn vẹn cấu trúc bảng (DDL schema Goose 11), ràng buộc toàn vẹn khóa ngoại (FK), chuỗi sequence và dữ liệu nghiệp vụ (DML).
2. **Nguyên tắc an toàn (Safety Boundary):**
   - **Tuyệt đối không thao tác phá hủy trên Staging/Production:** Toàn bộ quá trình phục hồi diễn tập được thực hiện trên một database độc lập hoàn toàn (`sport_restore_rehearsal`) tại cụm Neon PostgreSQL `ep-nameless-glade-b3rz6u6q`. Môi trường Staging chỉ được truy cập ở chế độ ĐỌC (Read-Only Dump).
   - **Bảo mật thông tin:** Không nhúng mật khẩu hay chuỗi kết nối chứa secret vào code, artifacts, PR hoặc chat.
   - **Tự động thu hồi tài nguyên:** Database diễn tập được xóa an toàn ngay sau khi hoàn thành kiểm định.

---

## 2. Thông tin môi trường diễn tập

| Hạng mục | Nguồn (Staging) | Đích (Diễn tập phục hồi) |
|---|---|---|
| **Dịch vụ DB** | Neon Serverless PostgreSQL (v17) | Neon Serverless PostgreSQL (v17) |
| **Host Marker** | `ep-nameless-glade-b3rz6u6q` | `ep-nameless-glade-b3rz6u6q` |
| **Region** | `ap-southeast-1` (Singapore) | `ap-southeast-1` (Singapore) |
| **Tên Database** | `neondb` (staging) | `sport_restore_rehearsal` (database độc lập) |
| **Goose Schema** | Version 11 (`00001` → `00011`) | Version 11 (`00001` → `00011`) |
| **Công cụ diễn tập** | `scripts/dev/backup_restore_rehearsal.py` | Python 3.14 + `psycopg2-binary` |

---

## 3. Quy trình thực hiện (Runbook)

Quy trình diễn tập được tự động hóa hoàn toàn và có thể tái hiện bất kỳ lúc nào qua lệnh:
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/Invoke-BackupRestoreTest.ps1
```

### Các giai đoạn thực thi:
1. **Giai đoạn 1 (Dump / Sao lưu):** Kết nối nguồn Staging, kiểm tra schema Goose v11, thu thập danh sách 10 bảng nghiệp vụ và dump toàn bộ 1,523 bản ghi vào bộ nhớ đệm an toàn.
2. **Giai đoạn 2 (Tạo môi trường độc lập):** Kết nối quản trị, khởi tạo database mới `sport_restore_rehearsal`.
3. **Giai đoạn 3 (Phục hồi DDL & DML):** 
   - Áp dụng tuần tự 11 file migration chuẩn từ `backend/migrations/` và khởi tạo bảng `goose_db_version`.
   - Nạp dữ liệu theo đúng cây phụ thuộc khóa ngoại (FK): `sport_types` → `users` → `courts` → `court_operating_hours` → `time_slots` → `court_blackouts` → `bookings` → `booking_slots` → `audit_logs`.
   - Căn chỉnh sequence định danh tự tăng.
4. **Giai đoạn 4 (Đối soát toàn vẹn - Data Integrity Check):** Truy vấn đối chiếu số lượng bản ghi trên từng bảng giữa Staging và bản phục hồi.
5. **Giai đoạn 5 (Smoke Validation):** Chạy luồng nghiệp vụ kiểm thử giả lập trên bản phục hồi:
   - *Auth:* Xác thực tài khoản người dùng UAT `qa-s4-user@example.test` (Role `USER`, Status `ACTIVE`).
   - *Availability:* Xác thực 1,078 khung giờ hoạt động khả dụng.
   - *Create Booking:* Tạo thành công đơn đặt sân diễn tập (ID `#c7dafdf5-2ee8-4c2e-a4ad-691db85adf37`, Code `BK-TEST-1794903608`).
   - *Cancel Booking:* Hủy thành công đơn đặt sân và kiểm tra ràng buộc `cancelled_at`.
6. **Giai đoạn 6 (Dọn dẹp):** Thu hồi và drop database `sport_restore_rehearsal` với cờ `WITH (FORCE)`.

---

## 4. Bảng đối chiếu số liệu toàn vẹn (Integrity Comparison)

| Tên bảng | Bản ghi Staging (Nguồn) | Bản ghi Phục hồi (Đích) | Trạng thái khớp | Ghi chú khóa / Ràng buộc |
|:---|:---:|:---:|:---:|:---|
| `goose_db_version` | 12 | 12 | ✅ Khớp 100% | Goose schema metadata |
| `sport_types` | 11 | 11 | ✅ Khớp 100% | Danh mục môn thể thao |
| `users` | 41 | 41 | ✅ Khớp 100% | Tài khoản khách hàng & quản trị |
| `courts` | 19 | 19 | ✅ Khớp 100% | Danh sách sân thể thao |
| `court_operating_hours` | 112 | 112 | ✅ Khớp 100% | Giờ mở/đóng cửa từng sân |
| `time_slots` | 1,120 | 1,120 | ✅ Khớp 100% | Khung giờ theo tuần (1-7) |
| `court_blackouts` | 10 | 10 | ✅ Khớp 100% | Lịch bảo trì / đóng sân đột xuất |
| `bookings` | 37 | 37 | ✅ Khớp 100% | Lịch sử đặt sân |
| `booking_slots` | 50 | 50 | ✅ Khớp 100% | Chi tiết slot từng booking |
| `audit_logs` | 111 | 111 | ✅ Khớp 100% | Nhật ký thao tác hệ thống |
| **TỔNG BẢN GHI** | **1,523** | **1,523** | **✅ Khớp 100%** | **0 lỗi / 0 mất mát dữ liệu** |

---

## 5. Đo lường chỉ số thời gian & RPO / RTO

* **Thời gian thực hiện sao lưu (Backup Duration):** `2.019s`
* **Thời gian thực hiện phục hồi (Restore Duration):** `3.153s`
* **Tổng thời gian hoàn tất chu trình:** `~ 7.8s` (bao gồm tạo DB, chạy migration, nạp 1,523 bản ghi, kiểm thử smoke và dọn dẹp).
* **Đánh giá chỉ số:**
  - **RPO (Recovery Point Objective):** Đạt mức **0 data loss** đối với snapshot sao lưu. Toàn bộ 1,523 bản ghi và 11 migration versions được phục hồi nguyên vẹn.
  - **RTO (Recovery Time Objective):** Đạt dưới **10 giây** cho khối lượng dữ liệu hiện tại, hoàn toàn đáp ứng tiêu chí NFR-11 cho môi trường triển khai thực tế.

---

## 6. Kết luận & Kiến nghị

1. Môi trường dữ liệu của Sport Booking System đã sẵn sàng 100% cho việc đóng gói bản **Release Candidate (RC)** tại thẻ [#104](https://trello.com/c/1ufWyuIW).
2. Kịch bản phục hồi đã kiểm chứng thành công tính toàn vẹn của DDL v11 (bao gồm cả ràng buộc khắt khe `request_hash`, composite unique key và kiểm tra hủy đặt sân).
3. Biên bản evidence JSON chi tiết được lưu tại: `artifacts/operations/backup_restore_evidence.json`.
