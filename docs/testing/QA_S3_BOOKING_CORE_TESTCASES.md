# QA S3 — Booking Core & Concurrency: test case matrix

Ngày lập: **24/10/2026 (UTC+7)**. Owner: **Hưng**. Reviewer: **Huy (PM/Backend)**.
Thẻ: [[QA] Booking Core & Concurrency Test](https://trello.com/c/k624Ws2D) · WBS 1.4.3/1.4.1/1.4.2 · FR-08→14.

Tài liệu này map **1-1 với 16 mục checklist** trên thẻ. Mỗi dòng ghi rõ cách kiểm chứng, test tự động tương ứng (nếu có) và trạng thái thực tế. **Không dòng nào được coi là Pass trước khi có evidence chạy thật.**

## Môi trường

| Hạng mục | Giá trị |
|---|---|
| Backend | `http://localhost:8080/api/v1` (docker compose, commit tại `environment.txt`) |
| DB test | `sport_booking_test` @ `localhost:5432` (container `sportbookingsystem-db-1`) |
| Baseline tự động | 209 pass / 0 fail / **0 skip** / 13 package, `go test -race` |
| Online/staging | **Chưa có** → mọi mục gắn nhãn `Online` đang blocked |

## A. Checklist "Công việc & nghiệm thu — Online" (3 mục)

| # | Mục checklist | Cách kiểm chứng | Trạng thái |
|---|---|---|---|
| A1 | Deploy Booking API/FE/cancel hoàn tất; availability nền và fixture/exclusion đã kiểm chứng | Cần URL staging + SHA + schema. Phần availability/exclusion kiểm được local | **Blocked (online)**; phần local: Ready |
| A2 | Chạy concurrent booking cùng slot, atomic rollback nhiều slot, retry/idempotency; DB không ghi trùng | TC-08, TC-09, TC-11, TC-12 + query đếm bảng | Ready (local) |
| A3 | Kiểm tra ownership/history/cancel và negative cases qua API thật; report/issue, Huy review | TC-04→TC-07, TC-13 + report; comment thẻ gắn link | Ready (local), chờ Huy review |

## B. Checklist "Checklist kiểm thử" (13 mục)

| # | Mục checklist | TC | Test tự động tương ứng | Cách chạy thêm | Trạng thái |
|---|---|---|---|---|---|
| B1 | Chuẩn bị test data Court/TimeSlot/Booking/Blackout | TC-01 | `testdb.SeedCourts` + `backend/testdata/court_foundation.sql` | Seed qua Admin API cho stack docker (fixture cũ dùng ngày 09/10 đã quá khứ) | Ready |
| B2 | Booking 1 slot thành công | TC-02 | `TestBookingLifecycleHTTP` | API thật: POST `/bookings` | Ready |
| B3 | Booking nhiều slot liên tiếp thành công | TC-03 | `TestBookingLifecycleHTTP` (2 slot) | API thật: 2–4 slot liền kề | Ready |
| B4 | Reject slot không liên tiếp / khác court / khác ngày | TC-04 | `TestBookingInputAndEligibilityHTTP` (`gap`, `reverse`, `wrong_court`, `wrong_weekday`) | API thật | Ready |
| B5 | Reject slot quá khứ, blackout hoặc đã bị chiếm | TC-05 | `TestBookingInputAndEligibilityHTTP` (`past_start`, `blackout`, `old_template_overlap`) | API thật | Ready |
| B6 | My Booking & Booking Detail ownership | TC-06 | `TestBookingLifecycleHTTP`, `TestBookingHistoryPaginationAndStatus` | API thật: user khác → 404 | Ready |
| B7 | Cancel Booking và availability sau cancel | TC-07 | `TestBookingLifecycleHTTP`, `TestBookingCancellationBoundary` | API thật + GET availability | Ready |
| B8 | Chạy concurrent booking cùng một slot | TC-08 | `TestBookingConcurrentRetryAndConflict`, `TestBookingDifferentUsersRaceForSameSlot` | API thật: 10 request song song | Ready |
| B9 | Xác minh chỉ một request thành công | TC-09 | như TC-08 + `assertBookingCounts` | Query DB đếm booking/slot | Ready |
| B10 | Lưu evidence và ghi bug vào Bugs list | TC-10 | — | `artifacts/tests/booking-qa-<ngày>/` + card Bug | Ready — list `Bugs` đã có; 1 bug đã ghi ([#XymXqNd4](https://trello.com/c/XymXqNd4)) |
| B11 | Retry cùng idempotency key tuần tự/đồng thời: không tạo booking thứ hai | TC-11 | `TestBookingTimestampPrecisionSurvivesRetry`, `TestBookingConcurrentRetryAndConflict` | API thật: sequential + 8 concurrent | Ready |
| B12 | Atomic rollback khi lỗi giữa các bước tạo Booking/BookingSlot | TC-12 | `TestBookingAtomicRollback`, `TestBookingOverlapConstraintRollsBackAllSlots` | Inject lỗi trong schema test | Ready |
| B13 | Eligibility boundary: horizon 30 ngày, 3 active booking/user, 1..4 slot liên tiếp | TC-13 | `TestBookingPerCourtPolicyAndCalendarBoundary`, `TestBookingConcurrentActiveLimitAcrossCourts`, `TestBookingActiveLimitCountsInProgressButNotCompleted` | API thật: biên today / +30 / +31 | Ready |

## C. Chi tiết test case

Quy ước: `T` = ngày chạy (UTC+7). Dữ liệu tạo mới, không dùng fixture ngày 09/10.

### TC-01 — Chuẩn bị test data
- Tạo 1 ADMIN (register rồi `UPDATE users SET role='ADMIN'`), 2 USER (`qa-a`, `qa-b`).
- POST `/admin/sport-types` → 1 sport active.
- POST `/admin/courts` → court active, `slotDurationMinutes=60`, `minConsecutiveSlots=1`, `maxConsecutiveSlots=4`.
- PUT `/admin/courts/{id}/operating-hours` → 07:00–13:00 cho weekday 1–7.
- POST `/admin/courts/{id}/blackouts` → 1 blackout ở ngày T+2, 09:00–10:00.
- Kỳ vọng: GET `/courts/{id}/availability?date=T+1` trả ≥ 5 slot `available=true`.

### TC-02 — Booking 1 slot
- POST `/bookings` body `{courtId, bookingDate: T+1, timeSlotIds:[slot 08:00]}`, header `Idempotency-Key`.
- Kỳ vọng: **201**, `status=CONFIRMED`, có `bookingCode`, `slots` dài 1, giờ UTC đúng.

### TC-03 — Booking nhiều slot liên tiếp
- POST 2 slot (08:00, 09:00) và 4 slot (08:00–11:00).
- Kỳ vọng: **201**; `slots` giữ đúng thứ tự thời gian; 4 slot vượt `maxConsecutiveSlots` → **422**.

### TC-04 — Reject slot không hợp lệ về cấu trúc
| Input | Kỳ vọng |
|---|---|
| 2 slot cách nhau (08:00, 10:00) | 422 `booking_rule_violation` |
| 2 slot đảo thứ tự | 422 |
| Slot của court khác | 422 |
| Slot đúng court nhưng sai weekday | 422 |
| Trùng slot trong cùng request | 400 |

### TC-05 — Reject quá khứ / blackout / đã bị chiếm
| Input | Kỳ vọng |
|---|---|
| `bookingDate` = T-1 | 422 |
| Slot nằm trong blackout | 409 `slot_unavailable` |
| Slot vừa được user khác đặt | 409 |
| Court/sport inactive | 422 |

### TC-06 — Ownership history/detail
- User B GET `/bookings/{idCủaA}` → **404** (không phải 403).
- ADMIN khác chủ → **404**.
- GET `/bookings` của B → không thấy booking của A; `?customerId=A` không đổi kết quả.
- Thiếu token → 401; user INACTIVE → 403.

### TC-07 — Cancel + availability
- Cancel trước giờ bắt đầu → **200**, `status=CANCELLED`, `cancelledAt` có giá trị.
- GET availability cùng ngày → các slot đó `available=true`.
- Cancel lần 2 → **409** `already_cancelled`.
- Cancel khi slot đã bắt đầu → **409**.
- Retry create bằng key cũ → trả lại booking CANCELLED (200), không tạo mới.

### TC-08 — Concurrent cùng slot
- 10 request song song, 2 user, key khác nhau, cùng 1 slot.
- Kỳ vọng: đúng **1×201**, còn lại **409 `slot_unavailable`**; không có response 5xx.

### TC-09 — Chỉ một request thắng (DB)
- Sau TC-08, query:
  - `SELECT count(*) FROM bookings WHERE ...` = 1
  - `SELECT count(*) FROM booking_slots WHERE ... AND released_at IS NULL` = 1
  - Không tồn tại 2 occupancy chồng lấn (ràng buộc GiST)
- Kỳ vọng: không ghi trùng; `audit_logs` chỉ 1 bản ghi tạo.

### TC-10 — Evidence & bug
- Lưu `artifacts/tests/booking-qa-<ngày>/`: `test-results.jsonl`, `environment.txt`, `api-evidence.json`, `db-checks.txt`.
- Bug (nếu có): ghi vào list **Bugs** trên board (đã tạo 24/10). Nếu không phát hiện bug thì list để trống — **không tạo bug giả để lấp list**.

### TC-11 — Idempotency
| Kịch bản | Kỳ vọng |
|---|---|
| Cùng key, cùng body, tuần tự | 201 rồi 200, cùng `id` |
| Cùng key, cùng body, 8 request đồng thời | 1×201, 7×200, **1 booking trong DB** |
| Cùng key, body khác | 409 `idempotency_conflict` |
| Key của user A dùng cho user B | Không trả booking của A (scope theo customer) |
| Key đã dùng cho booking đã hủy | 200 trả booking CANCELLED, không tạo mới |

### TC-12 — Atomic rollback
- Trong schema test, inject lỗi: slot thứ 2 vi phạm, audit insert lỗi, vi phạm ràng buộc overlap.
- Kỳ vọng: **không còn** booking/slot/audit dở; request lỗi không "khóa" idempotency key (dùng lại key đó vẫn tạo được).
- Cancel lỗi audit → booking giữ `CONFIRMED`, slot chưa release.

### TC-13 — Eligibility boundary
| Biên | Kỳ vọng |
|---|---|
| `bookingDate` = T | Chấp nhận (nếu slot chưa qua) |
| = T+30 | Chấp nhận |
| = T+31 | 422 |
| 3 booking active | OK; booking thứ 4 → 422 |
| Booking đã hủy/kết thúc | Không tính vào giới hạn 3 |
| 1 slot / 4 slot | OK; 5 slot → 422 |
| `minConsecutiveSlots=2` | 1 slot → 422 |

## D. Trạng thái tổng hợp

| Nhóm | Số mục | Chạy được ngay | Blocked |
|---|---|---|---|
| A. Online/nghiệm thu | 3 | 2 (A2, A3) | 1 (A1 — chưa có staging) |
| B. Checklist kiểm thử | 13 | 13 | 0 |
| **Tổng** | **16** | **15** | **1** (A1 — chưa có staging) |

## E. Việc còn thiếu trước khi tick

1. Chạy TC-01→TC-13 trên stack docker, lưu evidence thật.
2. Viết report `QA_S3_BOOKING_CORE_REPORT.md` với actual/expected từng TC.
3. Comment thẻ #44: link report + SHA + môi trường; Huy review.
4. Báo PM phần A1 (online) chưa chứng minh được → carry-over, không tick.
5. FE create/cancel còn simulation → không có evidence phía UI; ghi rõ, không tick mục FE.
