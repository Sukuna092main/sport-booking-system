# Sprint 2 — Court / Availability Integration

Ngày kiểm chứng: **16/10/2026 (UTC+7)**. Owner: **Huy**. [Thẻ Integration](https://trello.com/c/T5SZpxCt).

**Kết luận: local đạt các kiểm tra bên dưới; gate Online chưa đạt.** Huy xác nhận chưa có URL frontend/API chung. Kết quả localhost không phải nghiệm thu online; hai thẻ tiếp tục Working On theo tiêu chí gốc.

## Phiên bản và môi trường

- Nhánh `feature/be_sprint2_court_integration`, từ develop `9691ad5`. Court/Profile/Availability đã tích hợp qua PR #13–#15, #20–#22.
- Increment S2 dùng OpenAPI **0.3.0**, schema **00011**. Không demo Admin CRUD hoặc submit/multi-slot Booking chưa có trong S2.
- Frontend production build: `http://127.0.0.1:5175`; API Go/Gin thật: `http://127.0.0.1:8082/api/v1`. Đây là localhost, không phải URL dev chung.
- PostgreSQL 17 riêng, DB `sport_sprint2_20261016_test`. Fixture thứ Sáu **23/10/2026**, dữ liệu tổng hợp, không dùng Neon/dữ liệu production.
- Chrome headless được đặt timezone UTC để xác nhận giờ sân vẫn theo Asia/Ho_Chi_Minh. Test Auth/Profile dùng tài khoản @example.test.

## Kết quả thực thi

| Kiểm chứng | Kết quả |
| --- | --- |
| Backend toàn bộ, race detector | **88 test/subtest pass**, 0 fail, 0 skip. |
| Frontend toàn bộ | **39 test pass**, 0 fail/pending; lint/build exit 0. |
| Goose sạch | **11 → 0 → 11**, cả ba lệnh thành công; fixture nạp thành công. |
| HTTP + browser | **12 nhóm kiểm tra pass**, 0 fail; desktop/mobile và production build gọi API thật. |
| Online | Chưa có URL/evidence; chưa có sign-off QA trên card của Hưng lúc đọc. |

Các nhóm browser/HTTP gồm: health; list/search/filter/pagination; inactive/not-found; blackout/booked/old-template/released; CORS và Profile 401; Court → Detail → Availability; horizon gồm hôm nay đến +30, giờ sân khi browser ở UTC; single-slot toggle/reset; empty; network-error/retry; loading; mobile không tràn ngang; Auth login, Profile update/read-back/ownership/logout; không có uncaught JavaScript error. Lỗi mạng/trì hoãn response được tiêm riêng và ghi nhãn faultInjection, không giả lập response thành công.

## Defect đã sửa và retest

| ID | Trước | Sau |
| --- | --- | --- |
| S2-01 | Chỉ có hôm nay đến +29. | 31 lựa chọn gồm hôm nay đến +30, test qua tháng/DST. |
| S2-02 | Ngày/giờ theo browser có thể lệch giờ sân. | Ngày theo lịch sân, giờ theo timeZone API; browser UTC vẫn thấy 07:00–08:00. |
| S2-03 | false tương lai luôn ghi Đã đặt, kể cả blackout. | Nhãn Không khả dụng, không suy diễn booked/blackout từ boolean; slot bị loại không thể chọn. |
| S2-04 | Selection giữ object cũ; error có thể hiện thêm empty; lỗi tải sân bị gọi là not-found. | Đối chiếu selection với response/court/date/thời điểm mới nhất; error có retry, không giả empty; phân biệt 404 và lỗi tải. Refetch 30 giây trên tab hoạt động. |
| S2-05 | Dải ngày kéo giãn grid, tràn ngoài viewport. | minmax(0,1fr), min-width 0 và scroll nội bộ; retest hình học/ảnh desktop 1440 và mobile 390px. |

Không phát hiện defect backend mới cần sửa: checklist Fix lỗi backend là N/A sau regression, không tạo commit backend giả. DTO/schema giữ theo OpenAPI, không đổi để khớp ví dụ thiết kế.

## Oracle fixture

BD-01 ngày 23/10, theo giờ sân:

| Slot | available | Căn cứ |
| --- | --- | --- |
| 07–08 | true | Blackout inactive không chặn. |
| 08–09 | false | Blackout active 08:30–08:45 overlap một phần. |
| 09–10 | false | CONFIRMED chưa released. |
| 10–11, 11–12 | false | Booking cũ 10:30–11:30 trên template inactive vẫn chặn. |
| 12–13 | true | CANCELLED/released không giữ chỗ. |

Template inactive/sai duration/ngoài giờ không thành slot hợp lệ. Sân/sport inactive bị public API loại; ngày đóng cửa trả slots=[]. Backend fixed-clock tests bao phủ quá khứ, +30/+31 và DST. API boolean không có nguyên nhân booked/blackout riêng; nhãn chung chính xác được dùng cho false.

## Evidence và tái hiện

Raw evidence tại `artifacts/sprint2-huy-20261016/` (gitignored): backend-tests.jsonl, backend-checks.json, backend-summary.json, frontend-tests.json, frontend-checks.json, goose-up.log, goose-down.log, goose-up-again.log, browser-results.json, browser-smoke.log, fixture.sql, fixture-date.json; ảnh 01-court-list.png đến 07-mobile-availability.png. `sources/` lưu handoff và checklist gốc.

Lệnh backend: `go test -race -count=1 -timeout=600s -json ./...` với TEST_DATABASE_URL local, tên DB kết thúc _test. Frontend: `npm test`, `npm run lint`, `npm run build` với VITE_API_BASE_URL kiểm thử. Browser script: `artifacts/sprint2-huy-20261016/browser_smoke.cjs`, cần API/preview/fixture ở các cổng trên.

Lượt kiểm tra do trợ lý thực thi cho Huy. Tên Duy/Hưng trên checklist là phân công gốc; không suy ra họ đã ký QA hoặc đã tự chạy test chỉ từ kết quả này.

## Điều kiện còn mở

1. Hưng/Duy bàn giao URL frontend/API chung, SHA đang deploy, schema/migration và CORS (không gửi secret).
2. Test/retest Court/Availability/Profile/Auth qua các URL đó, lưu evidence thật và triage blocker.
3. Liên kết QA report/sign-off tại [QA S2](https://trello.com/c/gcdUfvcz), đối chiếu checklist Online trước Done.

Chưa ghi actual hours, remaining=0 hoặc nghiệm thu online giả; không đổi deadline để che gate thiếu đầu vào.
