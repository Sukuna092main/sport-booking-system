# QA S3 — Booking Core & Concurrency: báo cáo thực thi

Ngày chạy: **24/10/2026 (UTC+7)**. Người thực hiện: **Hưng**. Reviewer: **Huy (PM/Backend)**.
Thẻ: [[QA] Booking Core & Concurrency Test](https://trello.com/c/k624Ws2D) · WBS 1.4.3/1.4.1/1.4.2 · FR-08→14.
Test case matrix: [QA_S3_BOOKING_CORE_TESTCASES.md](QA_S3_BOOKING_CORE_TESTCASES.md).

> Bản nháp. Số liệu dưới đây là kết quả chạy thật ngày 24/10 trên môi trường local; **không phải** nghiệm thu online/UAT.

## Môi trường và phạm vi

| Hạng mục | Giá trị |
|---|---|
| Backend | `http://localhost:8080/api/v1`, docker compose, 18 route admin + 4 route booking đã đăng ký |
| Database | `sport_booking` (container `sportbookingsystem-db-1`), PostgreSQL 17.11 |
| DB test tự động | `sport_booking_test` cùng container, schema riêng cho từng test |
| Baseline tự động | **209 pass / 0 fail / 0 skip / 13 package**, `go test -race -count=1` |
| Phạm vi | Booking API + ownership + cancel + concurrency + idempotency + eligibility. **Không gồm** FE (còn simulation) và môi trường online |

## Kết quả

**38 assertion / 13 test case: 38 PASS, 0 FAIL.** Không phát hiện lỗi sản phẩm trong phạm vi kiểm chứng.

| TC | Nội dung | Kết quả | Evidence |
|---|---|---|---|
| TC-01 | Tạo data: sport, 3 court, operating hours, blackout | PASS — 6 slot/ngày, blackout 201 | `api-evidence.json` |
| TC-02 | Booking 1 slot | PASS — 201, CONFIRMED, 1 slot, có `bookingCode` | `api-evidence.json` |
| TC-03 | Booking 2 và 4 slot liên tiếp; 5 slot vượt max | PASS — 201, 201, 422 | `api-evidence.json` |
| TC-04 | Gap, đảo thứ tự, khác court, sai weekday, slot trùng | PASS — 422×4, 400 | `api-evidence.json` |
| TC-05 | Quá khứ, blackout, đã bị chiếm, court inactive | PASS — 422, 409, 409, 422 | `api-evidence.json` |
| TC-06 | Ownership: user khác, ADMIN, không token, INACTIVE, `customerId` | PASS — 404, 404, 401, 403, total=0 | `api-evidence.json` |
| TC-07 | Cancel, availability trả lại, cancel lần 2, replay key | PASS — 200, available=true, 409, 200 CANCELLED | `api-evidence.json` |
| TC-08 | 10 request đồng thời cùng slot | PASS — **1×201, 9×409, 0×5xx** | `api-evidence.json` |
| TC-09 | DB sau tranh chấp | PASS — **1 booking / 1 slot / 1 audit** | `db-checks.txt` |
| TC-11 | Idempotency tuần tự, 8 request đồng thời, body khác, key chéo user, sau cancel | PASS — 201→200, 1×201+7×200, 409, 201, 200 | `api-evidence.json` |
| TC-12 | Atomic rollback + ràng buộc overlap (schema cô lập) | PASS — 2/2 test | output `go test` trong `api-evidence.json` |
| TC-13 | Biên +30/+31, 3 active, hủy không tính | PASS — 201, 422, 3×201, 422, 201 | `api-evidence.json` |

### Kiểm tra DB sau khi chạy

```
bookings_total    | 21
slots_active      | 29
audit_created     | 21
double_occupancy  | 0      <-- không có hai occupancy chồng lấn
```

## Bug đã ghi nhận

| Card | Mức độ | Tóm tắt |
|---|---|---|
| [#XymXqNd4](https://trello.com/c/XymXqNd4) | P1 / BUG / S3 | `[BUG] FE Booking flow báo Done nhưng chưa gọi API — BookingReviewPage vẫn simulate` |

Không phát hiện lỗi backend. Bug duy nhất là khoảng trống FE: card #7b9W5QEM ở `Sprint - Done` (10/10) nhưng repo không có `lib/api/bookings.ts`, `BookingReviewPage` vẫn `Simulate server roundtrip`, `BookingsPage` là placeholder.

## Đối chiếu 16 mục checklist

| # | Mục | Kết quả | Đề xuất |
|---|---|---|---|
| A1 | Deploy Booking API/FE/cancel; availability nền | **Chưa có staging** — không chứng minh được | **Không tick**, ghi carry-over |
| A2 | Concurrent, atomic rollback, retry/idempotency, DB không trùng | PASS (local) | Tick kèm ghi chú "local" |
| A3 | Ownership/history/cancel + negative qua API thật, report, Huy review | PASS + report này | Tick sau khi Huy review |
| B1 | Chuẩn bị test data | PASS | Tick |
| B2 | Booking 1 slot | PASS | Tick |
| B3 | Nhiều slot liên tiếp | PASS | Tick |
| B4 | Reject không liên tiếp / khác court / ngày | PASS | Tick |
| B5 | Reject quá khứ / blackout / đã chiếm | PASS | Tick |
| B6 | My Booking & Detail ownership | PASS | Tick |
| B7 | Cancel + availability | PASS | Tick |
| B8 | Concurrent cùng slot | PASS | Tick |
| B9 | Chỉ 1 request thành công | PASS | Tick |
| B10 | Evidence + bug list | Evidence đã lưu; 1 bug đã ghi vào list `Bugs` | Tick |
| B11 | Retry cùng idempotency key | PASS | Tick |
| B12 | Atomic rollback | PASS | Tick |
| B13 | Horizon 30 ngày / 3 active / 1..4 slot | PASS | Tick |

## Giới hạn kiểm chứng

1. **Online chưa kiểm chứng.** Không có URL staging, `deploy/staging/` chỉ có README. Mọi kết quả là local.
2. **FE chưa kiểm chứng.** `BookingReviewPage.tsx` vẫn mô phỏng (`Simulate server roundtrip`), không gọi `POST /bookings`; không có `lib/api/bookings.ts`. Không có evidence UI create/cancel.
3. **TC-12 không chạy qua HTTP.** Atomic rollback cần inject lỗi giữa transaction; chứng minh bằng test tự động trong schema cô lập, không phải API thật.
4. **Login/Register chưa có rate limiter** (đã ghi nhận ở review backend 23/10), ngoài phạm vi thẻ này.

## Ghi chú kỹ thuật cho tích hợp

- `PUT /admin/courts/{courtId}/operating-hours` yêu cầu `opensAt`/`closesAt` đúng `HH:mm:ss` (OpenAPI đã ghi đúng). Duy cần dùng đúng format khi làm FE Admin.
- Availability từ chối ngày ngoài `[hôm nay, +30]` bằng **400 `validation_error`** (không phải 422); booking vượt horizon trả **422 `booking_rule_violation`**. FE nên hiển thị theo `error.code`.
- `docker compose up` **không tự rebuild** backend; image cũ (09/10) thiếu route `/bookings` và `/admin`. Cần `docker compose up -d --build` trước khi test — nếu không sẽ nhận 404 sai lệch.

## Tái hiện

```powershell
# 1. stack
docker compose up -d --build

# 2. script QA (tự tạo data, chạy 13 TC, ghi evidence)
powershell -NoProfile -ExecutionPolicy Bypass -File tests/api/booking-core-qa.ps1

# 3. baseline tự động
cd backend
$env:TEST_DATABASE_URL = "postgresql://sport:sport_123@localhost:5432/sport_booking_test?sslmode=disable"
go test -race -count=1 -timeout=300s ./...
```

Evidence: `artifacts/tests/booking-qa-20261024/` (gitignored) gồm `api-evidence.json`, `db-checks.txt`, `test-results.jsonl`, `environment.txt`, `vet.log`, `build.log`.
