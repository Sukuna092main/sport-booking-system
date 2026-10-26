# QA S4 — Evidence tích hợp Admin Court / Schedule / Blackout

| Thuộc tính | Nội dung |
|---|---|
| Thẻ | [#53 [TEAM] Sprint 4 Admin Court / Schedule Integration](https://trello.com/c/KdyiHsCJ) — cột `Hưng - TV3` |
| Mục liên quan | TV3-3 (regression increment S4), TV3-7 (tổng hợp test evidence) |
| Ngày chạy | **26/10/2026 (UTC+7)** |
| Người thực hiện | Hưng (DevOps/QA) |
| Reviewer | Huy (PM/Backend) |
| Trạng thái | Đã chạy trên staging online — không phải local |

> Tài liệu này gom evidence cho lần tích hợp S4. Số liệu là kết quả chạy thật, không phải ước lượng.

## 1. Môi trường tại thời điểm chạy

| Hạng mục | Giá trị |
|---|---|
| Frontend | https://sport-booking-system-ochre.vercel.app |
| Backend API | https://sport-booking-api-staging.onrender.com/api/v1 |
| Health check | `GET /api/v1/ping` → 200 `{"environment":"production"}` |
| Database | Neon branch `staging`, `ep-nameless-glade-b3rz6u6q`, region `ap-southeast-1` |
| Schema | Goose **11** |
| Commit `develop` | `876a63e` |
| Commit backend đang chạy | `bd2ea63` — không đổi từ 25/10, vì các commit sau chỉ sửa `tests/`, `docs/`, `postman/` |
| CI trên `develop` | 5 lượt gần nhất đều **success**, mới nhất 26/10 07:04 |
| Region backend | Render Singapore |

## 2. Kết quả regression

Hai bộ test độc lập, chạy tuần tự trên cùng một môi trường.

### 2.1 Booking core — `tests/api/booking-core-qa.ps1`

```powershell
$db = (Get-Content backend\.env.staging | Where-Object { $_ -match '^STAGING_DATABASE_URL_DIRECT=' }) -replace '^STAGING_DATABASE_URL_DIRECT=', ''
powershell -NoProfile -ExecutionPolicy Bypass -File tests/api/booking-core-qa.ps1 `
  -BaseUrl https://sport-booking-api-staging.onrender.com/api/v1 -DbUrl $db
```

**Kết quả: 38 PASS / 0 FAIL**, exit 0. Evidence: `artifacts/tests/booking-qa-20261026/`

Điểm đáng chú ý:

| Test case | Kết quả |
|---|---|
| TC-06 ownership (7 assertion) | PASS — user khác 404, ADMIN khác chủ 404, không token 401, INACTIVE 403 |
| TC-07 cancel + availability | PASS — cancel 200 `CANCELLED`, slot trả lại, cancel lần 2 → 409 |
| TC-08 10 request đồng thời | PASS — 1×201, 9×409, **0×5xx** |
| TC-09 DB sau tranh chấp | PASS — 1 booking / 1 slot / 1 audit |
| TC-11 idempotency | PASS — retry tuần tự và 8 request đồng thời đều không tạo booking thứ hai |
| TC-12 atomic rollback | PASS — 2/2 test trong schema cô lập |

### 2.2 Admin court / schedule / blackout

Chạy theo kịch bản của collection `postman/Admin-Court-Schedule-QA-Sprint4.postman_collection.json`, với một thay đổi: **mỗi lượt dùng tài khoản USER mới** để không chạm giới hạn 3 booking active/user.

**Kết quả: 24 PASS / 0 FAIL.** Evidence: `artifacts/tests/admin-qa-20261026/results.txt`

| Nhóm | Assertion tiêu biểu | Kết quả |
|---|---|---|
| Role & Auth | USER → 403, không token → 401, ADMIN → 200 | PASS |
| SportType / Court CRUD | tạo 201, thiếu `name` → 400, trùng `code` → 409, PATCH 200, xoá sport còn sân → 409 | PASS |
| Schedule | PUT hours → 200 + **98** mẫu slot tuần (14/ngày × 7 ngày), `8:00` → 400, GET 200 | PASS |
| Blackout → availability | slot 10:00: `true` → `false` (có blackout) → `true` (bỏ blackout) | PASS |
| Bảo vệ booking | tạo 201 `CONFIRMED`, xoá mềm court 204, booking vẫn `CONFIRMED`, đặt mới → 422 | PASS |

## 3. Trạng thái bug

| Card | Mức | Trạng thái |
|---|---|---|
| [#121](https://trello.com/c/Xy...) FE Booking flow báo Done nhưng chưa gọi API | P1 | **Đã fix trong bundle đang chạy**, chờ Duy/Huy xác nhận để đóng |

Bằng chứng trên bundle production `index-gtxHeHgV.js`:

| Kiểm tra | Kết quả |
|---|---|
| Chuỗi `Simulate server roundtrip` | **0 lần** |
| Gọi `POST /bookings` kèm `Idempotency-Key` | có |
| `listMyBookings` | có |
| Endpoint `/cancel` | có |

Không có bug mới. Trong quá trình chạy regression không phát hiện lỗi sản phẩm.

## 4. Giới hạn và việc còn lại

1. **Chưa test UI admin trên trình duyệt.** Toàn bộ evidence ở mức API. Phần UI thuộc cột `Duy - TV2`.
2. **Bug #121 cần người xác nhận.** Về kỹ thuật đã fix và đã deploy, nhưng card do Duy phụ trách nên Hưng không tự đóng.
3. **Chưa có fixture có version.** Staging đang tích luỹ dữ liệu QA qua các lượt chạy (nhiều sport type / court tiền tố `QA-`). Phải reset trước regression S5.
4. **Collection không chạy lặp vô hạn với tài khoản cố định** — xem ghi chú trong `QA_S4_ADMIN_COURT_REPORT.md`.
5. **Rollback mới ở mức quy trình.** Đã ghi trong `docs/operations/STAGING_RUNBOOK.md` §5 nhưng chưa thực hiện thật lần nào trên staging.

## 5. Đối chiếu cột `Hưng - TV3`

| # | Mục | Trạng thái |
|---|---|---|
| 1 | Deploy bản tích hợp mới nhất lên staging | **Xong** — `develop` `876a63e`, backend không đổi từ `bd2ea63` |
| 2 | Chạy migration và smoke test sau deploy | **Xong** — Goose 11, ping 200 |
| 3 | Chạy smoke/regression increment S4 | **Xong** — 38/38 và 24/24, tài liệu này |
| 4 | Kiểm tra CI/CD và rollback/redeploy | **Một phần** — CI xanh; rollback đã ghi quy trình, chưa diễn tập thật |
| 5 | Theo dõi bug và xác nhận severity | **Một phần** — chỉ còn #121, đã xác định đã fix |
| 6 | Retest sau khi fix | **Một phần** — retest #121 ở mức bundle, cần xác nhận UI |
| 7 | Tổng hợp test evidence | **Xong** — tài liệu này |
