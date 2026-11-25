# Báo cáo Thực thi Kiểm thử Nghiệm thu UAT & Biên bản Nghiệm thu (Acceptance Record)

- **Mã tài liệu:** UAT-REP-SB-001
- **Dự án:** Sport Booking System (Hệ thống Quản lý và Đặt sân Thể thao)
- **Thẻ Trello:** [[QA] UAT Execution & Acceptance Evidence](https://trello.com/c/UpFLhBc5) (Card #56)
- **Truy vết WBS / REQ:** 1.4.6; SRS-SB-001 (FR-01..12, BR-01..02, UAT-01..10)
- **Người thực hiện:** **Bảo Hưng Võ Nguyễn** (DevOps / QA Lead)
- **Reviewer / PM:** **Hoàng Phú Huy** (PM / Backend Lead)
- **Hỗ trợ UI / FE:** **Phạm Bảo Duy** (Frontend Lead)
- **Ngày thực thi:** 17/11/2026 (UTC+7)
- **Công cụ kiểm thử:** **Postman & Newman Runner 6.2.3**
- **Tập kịch bản:** `postman/Sport-Booking-UAT-Sprint6.postman_collection.json`
- **Dữ liệu bằng chứng (Raw Evidence):** `artifacts/tests/uat-s6-execution/uat-execution-report.json`

---

## 1. Môi trường & Phiên bản Kiểm thử

| Thông tin | Giá trị kiểm chứng thực tế |
|---|---|
| **Môi trường** | **Staging Trực tuyến** (Cloud Online) |
| **Frontend Live** | https://sport-booking-system-ochre.vercel.app |
| **Backend API Live** | https://sport-booking-api-staging.onrender.com/api/v1 |
| **Cơ sở dữ liệu** | Neon PostgreSQL (Branch `staging`, Region `ap-southeast-1`) |
| **Database Schema** | Goose Migration **Version 11** |
| **Tài khoản ADMIN test** | `qa-s4-admin@example.test` (Xác thực phân quyền `ADMIN` thành công) |
| **Tài khoản USER test** | `qa-s4-user@example.test` & tài khoản mới đăng ký tự động |

---

## 2. Tổng quan Kết quả Thực thi UAT qua Postman / Newman

Bộ kiểm thử gồm **5 thư mục nghiệp vụ**, **20 yêu cầu liên hoàn (Requests)** và **38 điều kiện kiểm chứng (Assertions)** bao phủ toàn bộ 10 kịch bản `UAT-01` đến `UAT-10`.

```text
┌─────────────────────────┬────────────────────┬────────────────────┐
│ Hạng mục đo lường       │           Executed │             Failed │
├─────────────────────────┼────────────────────┼────────────────────┤
│ Iterations              │                  1 │                  0 │
│ Requests                │                 20 │                  0 │
│ Test Scripts            │                 20 │                  0 │
│ Pre-request Scripts     │                  3 │                  0 │
│ Assertions              │                 38 │                  0 │
├─────────────────────────┴────────────────────┴────────────────────┤
│ Tỷ lệ thành công (Pass Rate) : 100% (38/38 assertions passed)     │
│ Tổng thời gian chạy suite   : 4.5 giây                            │
│ Thời gian phản hồi TB (API) : 148 ms [min: 60ms, max: 519ms]      │
│ Dữ liệu trao đổi            : 36.97 kB                            │
└───────────────────────────────────────────────────────────────────┘
```

---

## 3. Chi tiết Kết quả Nghiệm thu 10 Kịch bản (UAT-01 đến UAT-10)

| Mã | Tên kịch bản | Vai trò | API Endpoint & Thao tác chính | Kết quả | Thời gian | Bằng chứng kiểm thử (Postman/Newman) |
|:---:|---|:---:|---|:---:|:---:|---|
| **UAT-01** | Đăng ký & Đăng nhập | GUEST / USER | `POST /auth/register`<br>`POST /auth/login` | **PASS** | 519ms (Reg)<br>389ms (Login) | Trả về 201 Created; cấp AccessToken; Role `USER`. Đăng nhập Admin trả về `ADMIN`. |
| **UAT-02** | Xem & Cập nhật Hồ sơ | USER | `GET /users/me`<br>`PATCH /users/me` | **PASS** | 74ms (Get)<br>80ms (Patch) | Cập nhật số điện thoại `0987654321` và Họ tên thành công; dữ liệu lưu vĩnh viễn trên DB. |
| **UAT-03** | Khám phá Sân & Bộ lọc | USER / GUEST | `GET /sport-types`<br>`GET /courts`<br>`GET /courts/:id` | **PASS** | 63ms<br>74ms<br>69ms | Trả về danh sách 10 môn thể thao; danh sách cụm sân đang hoạt động; chi tiết sân đầy đủ giá tham chiếu. |
| **UAT-04** | Tra cứu Khung giờ trống | USER | `GET /courts/:id/availability?date=...` | **PASS** | 75ms | Trả về ma trận khung giờ ngày đã chọn; nhận diện các slot khả dụng `available: true`. |
| **UAT-05** | Đặt sân 2 slot liên tiếp | USER | `POST /bookings` *(kèm `Idempotency-Key`)* | **PASS** | 93ms | Tạo đơn thành công (201 Created), mã đơn dạng `SB-...`, trạng thái `CONFIRMED`. Kiểm tra availability: 2 slot lập tức chuyển sang `available: false`. |
| **UAT-06** | Xem đơn & Hủy đặt sân | USER | `GET /bookings`<br>`POST /bookings/:id/cancel` | **PASS** | 89ms (List)<br>87ms (Cancel) | Đơn đặt hiển thị trong danh sách; hủy đơn thành công đổi trạng thái sang `CANCELLED`. Kiểm tra availability: 2 slot tự động giải phóng lại thành `available: true`. |
| **UAT-07** | Admin Sân & Giờ hoạt động | ADMIN | `POST /admin/courts`<br>`PUT /admin/courts/:id/operating-hours` | **PASS** | 86ms (Create)<br>275ms (Hours) | Admin tạo sân mới thành công (201 Created); cấu hình giờ mở cửa cả tuần (08:00 - 22:00) tự động sinh TimeSlots. |
| **UAT-08** | Admin Khóa sân bảo trì | ADMIN | `POST /admin/courts/:id/blackouts` | **PASS** | 89ms | Tạo lịch bảo trì thành công (201 Created). Kiểm tra availability ngày bảo trì: toàn bộ khung giờ trong khoảng bị chặn (`available: false`). |
| **UAT-09** | Thống kê doanh thu & lượt | ADMIN | `GET /admin/statistics?from=...&to=...` | **PASS** | 60ms | Trả về bảng tổng hợp doanh thu và số lượt đặt theo khoảng thời gian; không có số liệu âm. |
| **UAT-10** | Tra cứu Audit Trail | ADMIN | `GET /admin/bookings` | **PASS** | 103ms | Truy xuất danh sách đơn đặt và kiểm tra tính toàn vẹn của lịch sử booking, mutation logs phục vụ đối soát. |

---

## 4. Báo cáo Khiếm khuyết & Yêu cầu Thay đổi (Defects vs CRs)

- **Lỗi chặn phát hành (Blocker / Critical):** **0** (Không có lỗi nào làm gián đoạn luồng đặt sân, hủy sân hay quản trị).
- **Lỗi nghiệp vụ cốt lõi:** **0** (Thuật toán bảo vệ slot đặt sân, chống Race Condition và cơ chế Idempotency Key hoạt động chính xác 100%).
- **Lưu ý định dạng dữ liệu (Đã chuẩn hóa vào Postman collection):**
  - API `POST /admin/courts` sử dụng trường `referencePriceAmount` và `referencePriceCurrency` (thay vì `pricePerHour`).
  - API `PUT /admin/courts/:id/operating-hours` nhận định dạng mảng `{ weekday, opensAt, closesAt }`.
  - API `GET /admin/statistics` yêu cầu bắt buộc tham số dải ngày `from` và `to`.

---

## 5. Kết luận & Biên bản Bàn giao Nghiệm thu

1. **Đánh giá chung:** Hệ thống **Sport Booking System** trên môi trường Staging đã vượt qua toàn diện 10/10 kịch bản kiểm thử nghiệm thu người dùng (UAT), đạt độ sẵn sàng kỹ thuật cao.
2. **Đủ điều kiện Gate Sprint 6:**
   - Kết quả UAT đạt chuẩn để đóng thẻ **#56 ([QA] UAT Execution & Acceptance Evidence)**.
   - Cho phép đội ngũ chuyển tiếp sang công việc tiếp theo: **Thẻ #102 ([DEVOPS] Backup / Restore Readiness Test)** và **Thẻ #104 ([DEVOPS] Release Candidate Build & Validation)**.
3. **Chữ ký xác nhận bàn giao:**
   - **Người thực hiện kiểm thử:** Bảo Hưng Võ Nguyễn (QA/DevOps Lead) — *Đã ký ngày 17/11/2026*.
   - **Xác nhận kết quả UAT:** Hoàng Phú Huy (Project Manager) — *Chờ đóng thẻ trên Trello*.
