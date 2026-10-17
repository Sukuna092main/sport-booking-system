# Sprint 2 — Review & Retrospective của Huy

Ngày lập: **16/10/2026 (UTC+7)**. Sprint: **10–16/10/2026**. Owner: **Huy — PM/Backend Lead**. [Thẻ Review](https://trello.com/c/CjltXLxO).

## Kết luận và increment

Đã walkthrough/demo kỹ thuật local Court → Detail → Availability và Auth/Profile qua API thật: **12 nhóm HTTP/browser**, **39 frontend test**, **88 backend test/subtest + race** đạt. Xem [báo cáo Integration](../testing/SPRINT2_INTEGRATION_REVIEW.md).

**Chốt S2 local ngày 17/10 theo S2-DEC01:** Huy giao quyền tự quyết định kết thúc hai thẻ; trợ lý chốt bằng evidence local đã có, chuyển Online/QA sign-off và đầu vào S3 chưa đủ sang [S3 Integration & QA](https://trello.com/c/3LhVH1Fr). Chưa có URL chung hoặc QA sign-off được xác minh. Đây là thay đổi tiêu chí chốt hai thẻ S2, không phải xác nhận Online Pass hay nghiệm thu toàn dự án.

Đây là bản review kỹ thuật/PM chuẩn bị và thực thi cho Huy. Chưa được cung cấp bằng chứng họp/feedback của Duy/Hưng; không dựng người tham dự, phát biểu, đồng thuận hoặc giờ actual.

| Increment | Trạng thái có bằng chứng |
| --- | --- |
| Court read / Availability / Profile / Auth | Có trên develop; UI/API local và regression đã kiểm tra. |
| Schema | Goose sạch 11 → 0 → 11; không thêm migration trong sửa tích hợp S2. |
| Admin CRUD | Chưa triển khai; chỉ review thiết kế/contract planned. |
| Booking S3 | Candidate [PR #24](https://github.com/Sukuna092main/sport-booking-system/pull/24), v0.4.0, evidence 15/10: 141 test/subtest và CI pass. Lần sync 16/10, develop vẫn 9691ad5, chưa chứa candidate. Không tính candidate S3 thành increment S2 đã bàn giao. |

## Review handoff và mapping cho Huy chốt

Đã đọc [Court/Availability handoff 11/10](https://docs.google.com/document/d/1NkarnbOvjMwhTTr18bGALFZPwWcS4Ob0qMFzPjhGgU0/edit) và [Admin handoff 16/10](https://docs.google.com/document/d/1GhWNgiaEWt3ouDrXmGElU0LXXwWlELPVH2G-c_-HyUM/edit). Tài liệu có nhiều ví dụ/path ghi rõ là đề xuất; OpenAPI/ERD trong repo là nguồn triển khai.

| Điểm | Mapping/feedback kỹ thuật |
| --- | --- |
| ID / trạng thái | UUID; Court/SportType dùng isActive boolean. ACTIVE/INACTIVE là account status. |
| Availability | id/startsAt/endsAt/available, data.date/timeZone; không bịa status enum. false tương lai dùng Không khả dụng; past là Đã qua. Muốn lý do riêng cần review contract/privacy/tests. |
| Schedule | `/admin/courts/{courtId}/operating-hours` GET/PUT, không tạo route `/schedule` trùng. |
| Blackout | `/admin/courts/{courtId}/blackouts/{blackoutId}`; startsAt/endsAt/isActive, không lấy startAt/endAt/status minh họa. Policy overlap chốt ở task Admin; không tự hủy CONFIRMED. |
| DELETE | Soft disable theo OpenAPI, giữ dữ liệu lịch sử. |
| Error | error.code/message/requestId/details, code chữ thường. 400 syntax, 422 booking rule, 409 conflict, 401/403/404 theo quyền; không dùng traceId/VALIDATION_ERROR minh họa làm oracle. |
| Statistics | Contract planned: totalBookings/confirmedBookings/cancelledBookings, from/to theo bookingDate và bao gồm hai biên. Không gọi giá tham khảo là doanh thu; không dùng metric-key placeholder để xác nhận pass. |
| Audit | Actor/action/entity/requestId/time; cùng transaction với thay đổi, lỗi audit rollback. Không tự thêm read-audit API hoặc lưu token/secret. |

Các mapping là kết quả review của Huy, không khẳng định Duy/Hưng đã đóng feedback. Duy đồng bộ ví dụ trước tích hợp Admin S4; Hưng dùng oracle đã mapping. Không tự thay trạng thái task thiết kế đã Done trên board.

## Risk / issue / carry-over

| ID | Vấn đề / tác động | Owner và hành động |
| --- | --- | --- |
| S2-I01 | Chưa có URL dev chung, không kiểm tra deployment/CORS online được; chuyển S3 theo S2-DEC01. | Hưng chuẩn bị, Duy đối chiếu FE, Huy review. Cần URL + SHA + schema rồi smoke/retest; chưa có ngày hoàn tất được owner xác nhận. |
| S2-I02 | QA S2 chưa có report/sign-off trên card lúc đọc. | Hưng bàn giao QA evidence; lượt tự kiểm tra của Huy không thay chữ ký QA độc lập. |
| S2-I03 | Ví dụ handoff khác DTO/path thật. | Duy cập nhật, Huy chốt mapping, Hưng xác nhận oracle; theo dõi feedback closure. |
| S2-I04 | Booking code làm sớm nhưng S2 gate/handoff S3 chưa đóng đủ. | Giữ candidate PR riêng; hoàn thiện handoff/integration/QA trước gate Booking Core. Không sửa lịch sử thành đã đủ đầu vào trước code. |
| S2-I05 | Chưa có actual/remaining do từng người báo. | Từng thành viên khai báo, Huy tổng hợp; không suy ra actual từ commit hay thời gian test, không đặt remaining=0. |

## Retrospective từ quan sát

| Quan sát | Bài học / hành động |
| --- | --- |
| Contract + fixture giúp phát hiện blackout/old-template/ownership. | Giữ oracle có phiên bản; Huy lưu evidence, Hưng liên kết QA report đúng build/schema. |
| Query-key tests chưa bắt timezone/horizon/tràn ngang. | Đã thêm 9 test Availability và browser desktop/mobile; Duy giữ lại khi làm FE Booking. |
| UI suy false thành booked dù API không có reason. | Dùng state đúng dữ liệu; review contract trước khi gắn nhãn. Đã sửa nhãn và mapping. |
| Đến ngày Review vẫn thiếu online input. | Chuẩn bị owner/URL/SHA/schema sớm. Huy reforecast sau khi Hưng/Duy báo remaining thật. |
| Code Booking có trước khi gate/feedback đủ. | Tách tiến độ kỹ thuật với nghiệm thu; PR/CI không thay DoR, integration và QA. |

Đây là quan sát/đề xuất, không phải trích lời hoặc quyết định của một cuộc họp chưa được ghi nhận.

## Refinement / DoR S3

Giữ S3 **17–23/10/2026**, gate Booking Core cuối S3; giữ 7 sprint kết thúc 20/11.

| Đầu vào | Có | Cần trước Ready/Done |
| --- | --- | --- |
| ERD/schema/availability | Develop schema 11, local regression đạt. | Đối chiếu version và fixture môi trường chung. |
| Booking transaction / retry / owner / cancel | Candidate PR #24, contract v0.4.0, tests. | Review State/Error handoff, FE integration, QA expected/actual, merge đúng workflow. |
| [State/Error handoff](https://trello.com/c/u1hZxLTO) | Có task/acceptance criteria. | Artifact/link và feedback closure thật; không suy Ready từ tên task. |
| QA oracle / FE S3 | Có fixture và self-check; S2 chỉ single-slot. | Hưng xác nhận expected/actual; Duy làm consecutive/confirm/retry/My Booking theo contract. |
| Capacity / effort | Estimate gốc bốn task BE 4+16+4+12=36h; có code làm sớm, actual/remaining chưa báo. | Giữ estimate, không tính 36h là remaining mới. Refine handoff/integration/retest với capacity 20h/người/tuần; không đếm lại effort online archived. |

**DoR verdict:** đã refine và có nền/candidate; chưa xác nhận toàn bộ backlog S3 Ready khi còn các đầu vào nêu trên. Không bỏ gate Booking Core để giữ ngày hạn.

## Checklist và quyết định kết thúc — S2-DEC01

Ngày **17/10/2026**, Huy giao quyền tự chốt qua tin nhắn “bạn tự chốt đại luôn đi cho xong”. Theo ủy quyền này, trợ lý chốt hai thẻ S2 dựa trên kiểm chứng local; đổi tiêu chí còn thiếu thành chốt local/chuyển tiếp có truy vết, ghi quyết định trên cả hai thẻ và đánh dấu hoàn thành theo phạm vi điều chỉnh.

| Tiêu chí trước điều chỉnh | Cách xử lý trong quyết định |
| --- | --- |
| QA S2 và handoff FE/API đạt | Local self-check đã có; QA sign-off độc lập/handoff còn thiếu chuyển S3, chưa đạt. |
| Kiểm tra Court/Availability/Profile qua URL chung | Chốt kết quả chạy API thật tại local; smoke/retest URL chung chuyển S3, chưa kiểm chứng. |
| Commit/schema/report và review cuối | Chốt local trên SHA eb765f6, schema 00011, OpenAPI 0.3.0, PR #25 và hai báo cáo này; CI frontend/backend đạt trên SHA đó. |
| Không còn blocker trước Review | Đã triage và sửa/retest các lỗi local; phần chặn Online được chấp nhận chuyển S3, không tuyên bố toàn hệ thống hết blocker. |
| Integration/evidence đủ trước Review | Đủ cho review local trong phạm vi S2 điều chỉnh; chưa đủ nghiệm thu Online. |
| Toàn bộ backlog S3 đủ DoR | Chốt hoạt động refinement và danh sách đầu vào còn thiếu; không xác nhận toàn bộ Ready. |

Checklist **Carry-over S2 — S2-DEC01** tại [S3 Integration & QA](https://trello.com/c/3LhVH1Fr) giữ các mục sau chưa tick:

1. URL frontend/API chung, SHA đang deploy, schema và CORS — Hưng/Duy bàn giao, Huy đối chiếu.
2. Smoke/retest Court/Availability/Profile/Auth online, ghi expected/actual, bug và evidence — Hưng thực thi, Duy/Huy xử lý lỗi theo phần việc.
3. Report/sign-off QA S2 độc lập, liên kết đúng build/schema và [thẻ QA gốc](https://trello.com/c/gcdUfvcz) — Hưng bàn giao, Huy review.
4. Đóng feedback [Booking State/Error handoff](https://trello.com/c/u1hZxLTO), chốt expected results và đối chiếu DoR từng task S3 — Duy/Huy/Hưng theo phân công hiện có.
5. Thu actual/remaining thật, đối chiếu capacity 20h/người/tuần và reforecast phần còn lại — Huy tổng hợp khi từng người báo; không đặt remaining=0.
6. Theo dõi review/merge PR #25 và phiên bản deploy thực tế trước smoke môi trường chung — Huy điều phối; quyết định này không tự xác nhận merge/deploy.

Không thêm estimate trùng cho các task hiện có. Huy cần đối chiếu remaining khi có dữ liệu trước cam kết gate S3 **23/10/2026**; ngày đó là mốc mục tiêu hiện tại, chưa phải xác nhận cam kết mới của từng owner. Giữ gate Booking Core và hạn dự án 20/11. Quyết định này không phải biên bản họp hoặc chữ ký QA của Duy/Hưng.
