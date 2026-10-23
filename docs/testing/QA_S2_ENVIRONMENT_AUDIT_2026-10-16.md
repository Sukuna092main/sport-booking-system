# Đối chiếu trạng thái dự án và môi trường QA S2

## Cập nhật sau khi xử lý lỗi khởi động, cùng ngày 16/10

- Người dùng đã chạy Goose trên Neon và cung cấp log `00011_align_foundation_constraints.sql` thành công, database lên version 11. Giá trị Neon version 10 trong phần kiểm tra ban đầu bên dưới là lịch sử trước bước này.
- Container backend local đã được người dùng dừng. Khi đọc `backend/.env`, phát hiện `JWT_SECRET` trống; Go config bắt buộc tối thiểu 32 byte. Cổng 8080 chưa có backend phục vụ ở thời điểm bắt đầu xử lý lỗi.
- Đã thêm `scripts/dev/Start-BackendNeon.ps1`: nạp cấu hình, xác nhận Neon/TLS, tạo JWT secret tạm nếu thiếu trong development, chạy backend và khôi phục môi trường shell khi dừng. Không ghi secret vào file và không tự chạy migration/seed.
- Đã khởi động backend trên máy qua launcher; log khởi động xác nhận database kết nối thành công, API lắng nghe cổng 8080. Vì launcher kiểm tra host Neon và config được truyền vào backend, luồng hiện tại là **API localhost → Neon**, khác container local trong ảnh chụp ban đầu.
- Kiểm tra trực tiếp sau khởi động: `/api/v1/ping` 200; `/api/v1/courts` 200 với `data: []`, `total: 0`; `/api/v1/sport-types` 200 với `data: []`.
- Chưa thêm dữ liệu QA; chưa xác nhận QA S2 Pass. JWT secret tạm có vòng đời theo phiên backend, cần đăng nhập lại nếu khởi động lại.

## Ảnh chụp kiểm tra ban đầu (trước các cập nhật trên)

- Ngày kiểm tra: 16/10/2026, UTC+7.
- Phạm vi: board Trello, source tại commit `9691ad5`, cấu hình được lưu, container đang chạy, các GET API local và truy vấn chỉ đọc Neon/local.
- Đây là ảnh chụp trạng thái để hướng dẫn QA; cần đọc lại Trello/runtime khi tiếp tục ở phiên khác.
- Không thay đổi code, cấu hình chạy, schema, dữ liệu hay trạng thái thẻ trong lượt kiểm tra này. File báo cáo và mục lục là đầu ra của việc kiểm tra.

## 1. Môi trường đã xác nhận

| Thành phần | Kết quả thực tế |
|---|---|
| Backend hiện chạy | Container `sportbookingsystem-backend-1`, API `http://localhost:8080/api/v1` |
| Database backend đang dùng | PostgreSQL Docker, host `db`, database `sport_booking`; không phải Neon |
| Cấu hình Neon đã lưu | Có trong `backend/.env`, TLS `sslmode=require`; kết nối chỉ đọc thành công |
| Cách nạp cấu hình | Backend đọc process environment; không tự nạp `.env`. Compose gán `DATABASE_URL` local trực tiếp, không đọc `backend/.env` cho backend |
| Migration local | Goose version 11 |
| Migration Neon | Goose version 10; chưa khớp migration mới nhất trong repo |
| Dữ liệu local | SportType/Court/OperatingHours/TimeSlot/Blackout/Booking đều 0 dòng |
| Dữ liệu Neon | Các nhóm dữ liệu trên đều 0 dòng, xác nhận trong transaction `READ ONLY` |
| Frontend hiện chạy | Container tạo ngày 08/10; source frontend gần nhất có thay đổi ngày 14/10. Cần đối chiếu/rebuild trước QA UI hiện tại |
| Render/Vercel | Người dùng xác nhận chưa deploy; Project Links chưa có staging/demo URL. Cấu hình/kế hoạch không phải bằng chứng đã deploy |

**Luồng khả thi để tiếp tục trước khi deploy:** Postman hoặc frontend → backend chạy trên máy → Neon, sau khi cấu hình process/container đúng, đối chiếu migration và chuẩn bị dữ liệu QA. `localhost` chỉ vị trí API, không xác định database API đang dùng. Mỗi thành viên có thể chạy backend riêng kết nối cùng Neon; đây chưa phải một URL API dùng chung qua Internet.

Không hiển thị hoặc sao chép credential từ `backend/.env` vào báo cáo. File này được Git ignore.

## 2. Đối chiếu task Done

Board hiện có 116 thẻ chưa archive. List Done 1.1 có 38 thẻ Complete và 1 thẻ hướng dẫn; list Done 1.2 chỉ còn thẻ hướng dẫn. Trạng thái dưới đây được đọc trực tiếp ngày kiểm tra.

| Task | Trello | Source/bằng chứng và giới hạn |
|---|---|---|
| [PostgreSQL Connection & Goose Migration](https://trello.com/c/m2Qm97SA) | Done, checklist đã tick | Có cấu hình Neon và kết nối được; Neon version 10, local/repo version 11. Checklist còn ghi đã kiểm chứng `/ready`, nhưng route này chưa có trong router đang dùng |
| [Docker Compose Local Environment](https://trello.com/c/ilLjehOx) | Done, checklist đã tick | Các container đang chạy; Compose là chế độ PostgreSQL local. Không suy ra đã chạy với Neon |
| [Court / Schedule / Blackout Data Foundation](https://trello.com/c/QsYR06Dc) | Done, checklist đã tick | Có migrations, fixture và predicate. Fixture tồn tại trong source không có nghĩa đã nạp vào DB dùng cho QA thủ công |
| [Court Browse / Search / Detail API](https://trello.com/c/2xo7Z4FC) | Done | Source có read/search/filter/detail; API danh sách đang trả 200 và dữ liệu rỗng |
| [Availability Read API & Exclusion Rules](https://trello.com/c/5PRDk26p) | Done, checklist đã tick | Source có API và unit/integration tests. Chưa xác nhận smoke Availability bằng dữ liệu QA hiện tại trên Neon |
| [Basic Profile & Ownership API](https://trello.com/c/wiHrL9Ur) | Done | Có GET/PATCH `/users/me`; không cần triển khai lại để làm QA S2 |
| [FE Basic Profile](https://trello.com/c/ksSIzLM5) | Done, checklist đã tick | Source có UI; cần kiểm thử đúng bản frontend đang bàn giao thay vì mặc định container cũ là bản đó |
| [FE Court List / Search / Detail](https://trello.com/c/oONDvbe5) | Done, checklist đã tick | Code đã có; lịch sử Git có merge PR #21. Không coi GET trang gốc 200 là bằng chứng luồng Court hoạt động |
| [FE Availability Display & Single-Slot Selection](https://trello.com/c/o7qMBScr) | Done, checklist đã tick | Code đã có; HEAD có merge PR #22. Chọn nhiều slot liên tiếp thuộc S3 |
| [Admin UI/API Design & Review Handoff](https://trello.com/c/yiyIHK01) | Done | Đây là thiết kế/handoff; không đồng nghĩa API CRUD Admin đã triển khai |
| [Sprint 1 Auth Integration & QA](https://trello.com/c/UYghDU4t) | Done, checklist đã tick | `tests/api/auth-cases.md` ghi smoke Docker local ngày 09/10. Báo cáo không xác nhận smoke Neon hoặc deployment online |
| [Online Environment Decision & Plan Review](https://trello.com/c/bExHnR02) | Done | Quyết định/kế hoạch; không suy ra Render/Vercel đã chạy |
| [QA Sprint 2 Court Read & Availability Test](https://trello.com/c/gcdUfvcz) | Working On, 0/13 mục checklist hoàn tất | Cần dữ liệu QA, kiểm thử API/UI thật, report và Huy review |
| [Staging Environment & Deployment Pipeline](https://trello.com/c/WsOCieqH) | Backlog | Có lịch S4; không dùng như bằng chứng staging hiện có |

Auth Core, Authorization, Go/Gin skeleton, React foundation, CI, ERD và REST contract cũng đang Complete trên board. Các thẻ tài liệu nền Done không thay thế kết quả QA S2, UAT hoặc hồ sơ release cuối kỳ.

Không tìm thấy attachment trên 5 thẻ đã đọc: Migration, Data Foundation, FE Court, FE Availability, S1 Integration. Điều này cho thấy truy vết trên thẻ còn thiếu, không chứng minh công việc chưa được thực hiện. Trong máy hiện tại, `artifacts/` chỉ có README; không có raw evidence được nhắc trong báo cáo review cũ.

## 3. Kiểm tra hiện tại và điểm cần xử lý

| Probe chỉ đọc | Kết quả |
|---|---|
| GET `/api/v1/ping` | 200, `pong`, environment `development` |
| GET `/api/v1/sport-types` | 200, `data: []` |
| GET `/api/v1/courts` | 200, `data: []`, `total: 0` |
| GET `/api/v1/ready` | 404; router source cũng chưa đăng ký endpoint này |
| GET `/api/v1/admin/courts` | 404; backend README ghi CRUD Admin còn planned |
| GET frontend `/` | 200, tải được HTML/asset |
| GET frontend `/courts` trực tiếp | 404; Nginx hiện không có SPA fallback về `index.html` |

Các điểm cần ghi nhớ:

1. `ping` chỉ kiểm tra ứng dụng; response không chứng minh kết nối Neon hoặc dữ liệu kiểm thử đã sẵn sàng.
2. `backend/testdata/court_foundation.sql` dùng dữ liệu ngày 09/10/2026; integration tests cố định clock ở 08/10/2026. Đây là fixture hợp lệ cho test tự động, không phải seed để chạy nguyên trạng trên Neon ngày 16/10. File cũng ghi rõ không chạy trên Neon dùng chung.
3. Thiếu migration 11 trên Neon cần được đối chiếu/preflight với Huy trước khi áp dụng; lượt kiểm tra này không chạy migration/Down/reset/seed trên Neon.
4. Hai request Role trong bộ Postman cũ kỳ vọng 403/200 ở `/admin/courts`, trong khi endpoint còn planned. Không dùng chúng để kết luận guard role sai; role middleware có test riêng trong code.
5. Hai request S2 mới được lưu ở repo hiện có URL trống và đang untracked. Request đã gửi trong giao diện Postman có thể chưa được lưu; cần lưu lại URL/test script trước bàn giao.
6. Root README còn mô tả scaffold chưa có implementation; README staging còn ghi provider TBD. Không dùng các đoạn cũ đó để suy ra trạng thái hiện tại.
7. Project Links hiện trỏ tới bộ SRS/SPMP/SDP/WBS khác các URL “Nguồn Final” trên thẻ Capacity và file đề xuất online ngày 06/10. Cần đối chiếu phiên bản tài liệu trước khi dùng làm căn cứ thay đổi kế hoạch.

## 4. Thứ tự tiếp tục QA S2

1. Chốt DB/nhánh Neon dev dùng cho QA, review và đồng bộ schema cần thiết; giữ dữ liệu chung và quyền truy cập đúng môi trường.
2. Chuẩn bị dataset QA theo ngày hiện tại: active/inactive court/sport, giờ hoạt động, slot hợp lệ/ngoài giờ, blackout active/inactive, booking confirmed/cancelled và boundary. Không chỉ thêm một sân rồi coi dữ liệu đủ.
3. Nạp cấu hình Neon vào process/container backend dùng cho QA; kiểm tra lại target DB và schema thực tế. API trên máy vẫn có thể là `http://localhost:8080/api/v1`.
4. Dùng bản frontend đúng commit bàn giao; đối chiếu `VITE_API_BASE_URL` và cách phục vụ route SPA.
5. Lưu bộ Postman S2, chạy read/search/filter/detail/availability và Auth/Profile regression; ghi expected/actual, phiên bản/schema, issue và evidence.
6. Huy review kết quả trước S2 Integration/Review. Không kiểm thử Admin CRUD như phần bắt buộc của increment S2.

## 5. Nguồn để dùng ở phiên hướng dẫn tiếp

- Trạng thái công việc: đọc lại board và thẻ QA S2; ưu tiên xem Done và phần scope đã bàn giao trước khi đề xuất tạo/triển khai lại.
- Source/API hiện tại: `backend/README.md`, `backend/internal/bootstrap/router.go`, `backend/internal/platform/openapi/openapi.yaml`.
- Evidence lịch sử: `tests/api/auth-cases.md`, `docs/testing/BACKEND_SIX_TASKS_REVIEW.md`; ghi đúng ngày/phạm vi của báo cáo, không chuyển kết quả local thành kết quả Neon.
- Môi trường thực tế: inspect process/container và truy vấn chỉ đọc; không suy ra từ tên file `.env`, checklist hoặc kế hoạch đề xuất.
- Lượt này không chạy lại toàn bộ unit/integration/CI hoặc đọc toàn bộ Google Docs Final; các trạng thái Pass lịch sử chỉ được dẫn theo tài liệu đã lưu.
