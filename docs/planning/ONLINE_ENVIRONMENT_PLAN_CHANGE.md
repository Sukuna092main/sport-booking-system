# Đề xuất kế hoạch chuyển sang môi trường online

| Thuộc tính | Nội dung |
|---|---|
| Dự án | Sport Booking System — Nhom9_QuanLyDuAnPhanMem |
| Ngày lập / ngày nghiên cứu dịch vụ | 06/10/2026 |
| Phiên bản | 0.1 |
| Trạng thái | **Đề xuất — chờ Huy (PM) review** |
| Người soạn / đối chiếu | Hưng: backend, database, vận hành; Duy: frontend và tài liệu liên quan |
| Reviewer / người phê duyệt | Huy (PM); Huy tiếp tục review backend |
| Phạm vi thay đổi | Đề xuất đưa database và bản dev online vào S1; cập nhật môi trường, phụ thuộc, task và công sức |
| Ngoài phạm vi thực hiện file này | Không sửa Trello, Google Docs Final, mã nguồn hay cấu hình dịch vụ; không provision/deploy thực tế |

## 1. Quyết định đề xuất và giới hạn

Chọn **Neon PostgreSQL + Go/Gin trên Render Free + frontend React/TypeScript/Vite trên Vercel**. Database và backend đặt tại **Singapore**. Vercel phục vụ frontend tĩnh theo Architecture hiện tại, không thay backend bằng Vercel Functions. Huy cần phê duyệt phương án và xử lý nguồn lực trước khi cam kết mốc online S1.

Ba thành viên dùng chung URL frontend và API qua HTTPS; không cần cùng LAN, mở cổng máy cá nhân hoặc đồng bộ database giữa ba máy. Backend đọc/ghi database của môi trường tương ứng. UI nhìn thấy dữ liệu mới khi gọi lại API, refetch hoặc invalidation sau thao tác; **không mặc định bổ sung Realtime**. Quyền truy cập và xung đột đặt sân vẫn phải được kiểm soát ở backend/database, không dựa vào UI.

Giữ nguyên:

- Khung 7 sprint: **03/10–20/11/2026**, không thêm Start Date vào thẻ.
- Toàn bộ MVP/MUST của SRS; giữ nghiệp vụ tài khoản, sân, availability, booking/history/cancel, quản trị sân/lịch/blackout/booking, Basic Statistics và Audit Logging. Không tự đưa Optional/Deferred vào MVP.
- Gate Booking Core cuối S3; functional/security regression trước UAT ở S5; UAT và release candidate (RC) cuối S6; deployment, smoke và bàn giao ở S7.
- Go/Gin xử lý auth/JWT, mật khẩu và phân quyền theo baseline; Neon chỉ là nhà cung cấp PostgreSQL, không thay luồng auth bằng dịch vụ khác.
- Task chức năng giữ owner và phạm vi nghiệp vụ hiện tại. Duy/Hưng soạn tài liệu; Huy review. Không giảm estimate cũ để làm bảng tải trông vừa capacity.

Đây là đề xuất thay đổi môi trường và kế hoạch, **không phải chứng nhận đã triển khai, kiểm thử hoặc hoàn thành**. Các checklist bên dưới đều chưa được xác nhận.

## 2. Cơ sở đối chiếu

| Nguồn baseline | Vai trò trong đề xuất |
|---|---|
| [SRS-SB-001 Final](https://docs.google.com/document/d/1pRTJGfRwTsopUzYMMqSoESE6M_wwXj0VbnROKVcUSbE/edit) | Giữ FR/BR/UC/MUST; kiểm chứng atomicity, concurrency, idempotency, performance, usability, audit, backup và privacy |
| [SDP-SB-001 Final](https://docs.google.com/document/d/1Zs01yCdeQK4gA5K-mAwSAsbgupdXiJfTRqAlggmAAgI/edit) | Thiết kế/contract và review trước triển khai; integration, flow môi trường và handoff |
| [WBS-SB-001 Final](https://docs.google.com/document/d/15LCVvx_zBCmCA3hZjuSTnp6WPVxI9tDwKg2FshzhOSY/edit) | Mapping gói việc, phụ thuộc và đầu ra; trọng tâm 1.5.1–1.5.5, tài liệu 1.6 và kiểm soát 1.7 |
| [SPMP-SB-001 Final](https://docs.google.com/document/d/1wgjoxqvrmy7jtHJ9zzGymezd_7NGbj_Fz986P85VRfk/edit) | Configuration/change control, nguồn lực, rủi ro và trách nhiệm vận hành |
| [Architecture / Tech Stack](https://trello.com/c/0VhI2oe1) | Go/Gin/GORM, React/TypeScript/Vite, Vercel frontend; nhà cung cấp backend/database cần chốt |
| [Board](https://trello.com/b/YHI1iwU2/nhom9quanlyduanphanmem), [bảng công sức](https://trello.com/c/KxIwXmVL) | Snapshot task/nhãn/ngày và estimate công bố để lập đề xuất, không phải actual |

Google Docs Final vẫn là baseline. File này không tự thay đổi nội dung hoặc tuyên bố đã phê duyệt Final. Checkout local tại thời điểm lập file chủ yếu là scaffold/README; trạng thái Done và evidence trên Trello không đồng nghĩa mọi implementation đã có trong checkout này.

## 3. Thiết kế môi trường, dữ liệu và vận hành

### 3.1. Tách môi trường

| Môi trường | Thời điểm / mục đích | Database và truy cập |
|---|---|---|
| Dev chung | S1; integration và demo increment | Neon dev riêng; API Render và frontend Vercel dev chung; tài khoản test riêng từng người |
| Staging | Chuẩn bị S4; regression S5, UAT S6 | Database/credential/config riêng; fixture có version; bản build ổn định, không để dev reset ảnh hưởng UAT |
| Release | Kiểm chứng S7; deployment và bàn giao | Database/credential/config riêng; dữ liệu bàn giao được duyệt; hạn chế quyền ghi và reset |
| Local / CI / kiểm chứng migration | Phát triển độc lập, PR test, thử thao tác phá hủy và dự phòng | PostgreSQL Docker/tạm hoặc DB kiểm chứng riêng; không tự đồng bộ với Neon dev/staging/release |

Đề xuất dùng các nhánh database Neon riêng cho dev, staging và release, với role/credential và endpoint được kiểm soát riêng. Nhánh clone phải được làm sạch dữ liệu nhạy cảm và đổi quyền trước khi sử dụng; các nhánh **không tự đồng bộ/merge dữ liệu**. Mỗi môi trường áp dụng migration theo version. Có thể dùng DB/nhánh tạm riêng để kiểm chứng Up/Down và backup/restore. Nếu cần tách project để tăng cách ly, Huy review lại quota và chi phí trước khi tạo.

Render service và Vercel deployment/config cũng tách theo môi trường. Quota Free được tính theo phạm vi nhà cung cấp, không mặc định mỗi môi trường đều có quota độc lập. Staging “ổn định” nghĩa là build/schema/fixture được khóa cho kiểm thử, không có nghĩa Render Free luôn thức.

### 3.2. Cấu hình và bảo mật

- Frontend chỉ dùng `VITE_API_BASE_URL` trỏ tới API đúng môi trường; không chứa `DATABASE_URL`, mật khẩu DB hoặc JWT signing secret. Giá trị Vite đưa vào bundle là công khai. Theo prefix hiện tại, base URL kết thúc bằng `/api/v1`; tránh ghép prefix hai lần.
- Backend giữ `DATABASE_URL`, JWT secret và cấu hình CORS; có thể tách `MIGRATION_DATABASE_URL` cho Goose với quyền DDL. App role chỉ có quyền cần thiết, không dùng tài khoản quản trị cho request thường.
- Cấu hình `PORT` của host và bind `0.0.0.0`; origin CORS là allowlist cụ thể cho frontend dev/staging/release và local khi cần. Không dùng wildcard với credential. Cookie/token và cơ chế auth tuân theo contract đã review.
- Kết nối Neon bằng TLS theo connection string chính thức; cấu hình timeout connect/query, giới hạn connection pool nhỏ phù hợp workload và quota. Kiểm tra driver/GORM và pooled/direct endpoint; Goose dùng endpoint đã kiểm chứng cho migration.
- Khi compute ngủ hoặc kết nối đứt: mở lại kết nối có giới hạn, timeout rõ và trả lỗi có kiểm soát. Không retry mù request tạo booking; giữ transaction và idempotency để tránh ghi trùng.
- Không commit `.env`, backup, token, connection string thật; chỉ đưa tên biến/placeholder vào `.env.example`. Không log credential; chia sẻ secret qua kênh riêng có kiểm soát, đổi secret khi lộ.
- Giữ `GET /api/v1/ping` để kiểm tra ứng dụng. **Đề xuất** thêm `GET /api/v1/ready` kiểm tra DB với timeout ngắn, trả 200 khi sẵn sàng và 503 khi chưa sẵn sàng, không tiết lộ cấu hình. Hai endpoint không thay thế smoke nghiệp vụ.

### 3.3. Migration, fixture và deploy

Hưng điều phối migration và reset dữ liệu chung; Huy review thay đổi schema/backend. Migration Goose được version trong Git, đối chiếu ERD/schema đã duyệt; không sửa migration đã áp dụng để che lệch schema.

1. Review migration, compatibility và chiến lược rollback; chuẩn bị backup nếu có dữ liệu cần giữ.
2. Thử Up/Down trên DB kiểm chứng riêng, rồi Up lại; kiểm tra constraint, index, fixture và dữ liệu. Down có nguy cơ mất dữ liệu chỉ được thử ở DB riêng.
3. PR CI dùng PostgreSQL sạch/tạm, chạy migration và build/test; không dùng cloud DB/secret chung, kể cả PR từ fork.
4. Sau CI và kiểm tra migration: Hưng thực hiện migration có kiểm soát trên đúng môi trường, rồi deploy commit tương thích. Nếu thay đổi không tương thích, cần maintenance window/chiến lược rollout được Huy duyệt trước.
5. Kiểm tra readiness và smoke API/FE thật; ghi commit, schema version, môi trường, URL, thời điểm và kết quả thực tế. Có lỗi thì dừng promotion và thực hiện rollback/restore đã review.

Không cho nhiều instance tự chạy Goose đồng thời lúc API khởi động. Render Free không hỗ trợ one-off job; đề xuất migration qua workflow được bảo vệ hoặc thao tác Goose có kiểm soát bởi Hưng. Quyền/secret deploy tách khỏi PR test. Nếu dùng auto-deploy theo CI, chỉ bật khi bảo đảm migration/compatibility gate đã chạy; trạng thái check bị skipped không được coi là evidence đã test.

Fixture có version; ba người dùng tài khoản test khác nhau. Reset dev phải thông báo, có thời điểm và owner; không reset staging giữa regression/UAT. Chỉ copy dữ liệu test đã duyệt, không dùng dữ liệu cá nhân thật.

### 3.4. Free tier và phương án dự phòng

Theo nguồn chính thức nghiên cứu **06/10/2026**:

| Dịch vụ | Giới hạn cần đưa vào kế hoạch | Tác động / ứng phó |
|---|---|---|
| [Neon Free](https://neon.com/blog/neon-free-plan-1-gb-per-project) | 1 GB/project; 100 CU-giờ/project/tháng; 10 branch/project; cửa sổ instant restore 6 giờ | Theo dõi dung lượng/compute/branch, dọn fixture có kiểm soát; không coi instant restore là toàn bộ chính sách backup |
| [Render Free](https://render.com/docs/free) | Ngủ sau 15 phút không có traffic; wake có thể mất khoảng một phút; 750 giờ Free/workspace/tháng dùng chung; filesystem tạm; không có one-off job | Bản online phù hợp đồ án/dev/demo, **chưa phải cam kết luôn sẵn sàng**; test cold start riêng; dữ liệu bền vững ở DB, không ở disk backend |
| [Vercel Vite](https://vercel.com/docs/frameworks/frontend/vite), [environment variables](https://vercel.com/docs/environment-variables) | Base URL là cấu hình build frontend; đổi biến cần deployment mới | Smoke lại đúng FE/API/môi trường; Huy kiểm tra quota/điều kiện gói sử dụng trước bàn giao |

Singapore được đối chiếu qua [Neon regions](https://neon.com/demos/regional-latency) và [Render regions](https://render.com/docs/regions); provision phải kiểm tra region thực tế trong console. Không hứa chi phí bằng 0 mãi mãi, không tự nâng gói trả phí, không dùng keep-alive để coi Free là SLA.

Docker là công cụ phát triển độc lập, PostgreSQL cho CI và demo fallback. Fallback chỉ có snapshot/fixture được chuẩn bị, **không tự có dữ liệu mới nhất từ cloud**. Kiểm tra import/restore và ghi rõ dữ liệu/schema của demo. Performance report tách cold/warm, nêu load profile, quota và giới hạn; không loại cold start khỏi báo cáo để tuyên bố đáp ứng NFR. Mục tiêu performance trong SRS không chuyển thành SLA của Free tier.

## 4. Đề xuất task Trello

Tên và WBS dưới đây là đề xuất mapping để PM review, không phải WBS mới đã phê duyệt. Mỗi thẻ mới có một owner chính; phần người hỗ trợ và giờ của task TEAM ghi riêng. Các thẻ tách phải có link hai chiều tới [thẻ gốc #51](https://trello.com/c/WsOCieqH), mô tả phần chuyển đi/giữ lại và giờ chỉ tính một lần. Thẻ chức năng khác giữ owner, scope và estimate hiện tại.

### 4.1. Task mới — Quyết định môi trường & cập nhật kế hoạch (S1)

- **Owner:** Hưng; Duy đối chiếu FE; **reviewer:** Huy (PM).
- **WBS đề xuất:** 1.6.5, 1.7.1/1.7.4; liên kết 1.5.1–1.5.5.
- **Phụ thuộc:** SRS/SDP/SPMP/WBS Final và Architecture; phải được review trước provision/deploy phụ thuộc.
- **Đầu ra:** quyết định môi trường, mapping task/giờ, config/deploy outline, danh sách vấn đề cần PM duyệt.
- **Ước lượng đề xuất:** Hưng 2h + Duy 1h + Huy 1h = **4h mới**.

Checklist:

- [ ] Duy/Hưng đối chiếu baseline, giữ MVP và gate 7 sprint.
- [ ] Chốt provider/region, cách ly môi trường, quota và local fallback.
- [ ] Huy review task, phụ thuộc, checklist và bảng tải; quyết định nguồn lực/ưu tiên.
- [ ] Ghi phê duyệt và đề xuất cập nhật Architecture/Final; chưa ghi là đã sửa Final.

### 4.2. Task mới — Neon Dev Database Provisioning (S1)

- **Owner:** Hưng; **reviewer:** Huy.
- **WBS đề xuất:** 1.5.1, 1.5.3; không cộng thêm giờ aggregate WBS vào giờ task.
- **Phụ thuộc:** 4.1 được review; ERD/schema đã duyệt để triển khai cấu trúc qua 4.3.
- **Đầu ra:** DB dev Singapore, endpoint/role/secret được bàn giao riêng; quy tắc fixture/reset và kiểm soát quota.
- **Ước lượng đề xuất:** Hưng 4h + Huy 1h = **5h mới**.

Checklist:

- [ ] Tạo DB/branch dev, kiểm tra region và quota; chưa dùng cho staging/release.
- [ ] Tách app role/migration role, cấp quyền tối thiểu, lưu secret ngoài Git.
- [ ] Cung cấp cấu hình TLS/endpoint cho backend và Goose; không đưa credential cho FE.
- [ ] Chuẩn bị fixture, ba tài khoản test riêng sau khi schema/auth sẵn sàng.
- [ ] Ghi owner reset, quy tắc thông báo và bảo vệ dữ liệu chung; Huy review.

### 4.3. Cập nhật [#20 — PostgreSQL Connection & Goose Migration](https://trello.com/c/m2Qm97SA) (S1)

- **Owner:** Hưng; **reviewer:** Huy. **WBS:** 1.5.3; 1.3.6.3.
- **Phụ thuộc:** 4.2, [ERD](https://trello.com/c/KQ2Z38K0), [Gin scaffold](https://trello.com/c/QE82scps) và schema/contract đã review.
- **Đầu ra:** kết nối Neon, migration giữ schema đã duyệt, evidence kiểm chứng và cấu hình vận hành.
- **Công sức:** giữ Hưng 6h + Huy 2h = **8h gốc**. Phần bổ sung vào scope cần reforecast nếu không còn đủ giờ; chưa tự cộng/giảm estimate.

Checklist bổ sung:

- [ ] Kiểm chứng TLS, endpoint, timeout/pool và lỗi mất/kết nối lại; không lộ secret.
- [ ] Review Goose; chạy Up/Down/Up trên DB riêng, kiểm tra constraint/index.
- [ ] Áp dụng Up có kiểm soát trên dev; ghi schema version và fixture version.
- [ ] Giữ ping; review/triển khai readiness DB theo quyết định 3.2.
- [ ] Bàn giao hướng dẫn kết nối và migration, Huy review evidence trước deploy/integration.

### 4.4. Tách [#51 — Staging Environment & Deployment Pipeline](https://trello.com/c/WsOCieqH)

**A. Online Dev API & Deployment Pipeline — S1**

- **Owner:** Hưng; **reviewer:** Huy. **WBS:** 1.5.1; 1.3.6.3; liên kết build/release 1.5.2.
- **Phụ thuộc:** 4.1–4.3, Gin build và CI 4.7; không giữ phụ thuộc Sprint Review S3 cho phần dev S1.
- **Đầu ra:** URL API Render dev, env/secrets/CORS, flow migration/deploy và evidence ping/readiness/smoke.
- **Công sức:** **8h của 12h gốc**, chuyển S4 sang S1; không tính thành giờ mới. Reviewer chưa có phân bổ tách riêng trong 12h; PM xác nhận hoặc dùng review hiện hữu, không giả định review miễn phí.

Checklist:

- [ ] Tạo service Singapore; build/run Go phù hợp host, bind/PORT đúng.
- [ ] Cấu hình DB/JWT/CORS và log an toàn; kiểm tra timeout/pool.
- [ ] CI đạt, kiểm tra schema/migration rồi deploy commit đã chọn.
- [ ] Ghi URL/commit/schema, ping/readiness và smoke; thử cold start và lỗi DB có kiểm soát.
- [ ] Gắn link hai chiều thẻ gốc, giữ lịch sử và ghi 8h đã chuyển.

**B. Staging/UAT Readiness — S4**

- **Owner:** Hưng; **reviewer:** Huy. **WBS:** 1.5.1; 1.3.6.3.
- **Phụ thuộc:** pipeline dev đã kiểm chứng, increment và Review S3, schema tương thích.
- **Đầu ra:** staging DB/API/FE riêng, fixture/account, pipeline promotion và runbook phục vụ regression/UAT.
- **Công sức:** **4h còn lại của 12h gốc** ở S4; không tính lại 8h S1. Nếu 4h không đủ cách ly và review, ghi remaining mới để PM duyệt.

Checklist:

- [ ] Tách database, role/secret, Render service và Vercel config khỏi dev.
- [ ] Deploy build/schema phù hợp, kiểm chứng CORS/readiness/API thật.
- [ ] Chốt fixture, tài khoản, reset window và quyền trong regression/UAT.
- [ ] Bàn giao URL, commit/schema, smoke và runbook trước regression S5.
- [ ] Gắn truy vết thẻ gốc và ghi rõ 4h scope còn lại.

### 4.5. Task mới — Frontend Online Deployment & API Configuration (S1)

- **Owner:** Duy; Hưng hỗ trợ API/CORS; **reviewer:** Huy.
- **WBS đề xuất:** 1.5.1/1.5.2; đối chiếu frontend foundation hiện hữu, không tạo thêm giờ chức năng FE.
- **Phụ thuộc:** quyết định/contract đã review, FE build, CI; có thể chuẩn bị mock sau contract nhưng chỉ chốt khi API 4.4A thật sẵn sàng.
- **Đầu ra:** URL Vercel dev, `VITE_API_BASE_URL` đúng, auth/CORS/refresh route hoạt động.
- **Ước lượng đề xuất:** Duy 2h + Hưng 1h + Huy 1h = **4h mới**.

Checklist:

- [ ] Cấu hình build Vite và base URL `/api/v1`, không đưa secret backend vào bundle.
- [ ] Cấu hình origin CORS đúng; kiểm tra auth/token/cookie theo contract.
- [ ] Kiểm tra direct-link/refresh route và API thật; đổi env thì deploy lại.
- [ ] Ghi URL/commit/API môi trường và kết quả thực tế, Huy review.

### 4.6. Task mới — Three-Network Online Smoke Test (S1)

- **Owner:** Hưng; Duy/Huy tham gia; **reviewer:** Huy.
- **WBS đề xuất:** 1.5.1 và kiểm chứng tích hợp/tài liệu 1.6.3.
- **Phụ thuộc:** 4.3–4.5, fixture và tài khoản test; Auth API sẵn sàng cho smoke có đăng nhập. Ping sớm không thay kiểm chứng dữ liệu.
- **Đầu ra:** evidence ba tài khoản trên ba mạng, chung môi trường/schema, thấy dữ liệu sau API/refetch; issue log nếu lỗi.
- **Ước lượng đề xuất:** Hưng 2h + Duy 1h + Huy 1h = **4h mới**.

Checklist:

- [ ] Dùng ba kết nối mạng độc lập và tài khoản riêng, ghi môi trường/commit/schema.
- [ ] Kiểm tra FE/API/readiness và auth trên từng mạng, gồm cold/warm nếu có.
- [ ] Một tài khoản thay đổi dữ liệu test được scope S1 cho phép; tài khoản có quyền khác refetch và đối chiếu kết quả đúng quyền.
- [ ] Không yêu cầu endpoint booking chưa có ở S1; test booking/concurrency đầy đủ ở S3.
- [ ] Ghi thời điểm, thao tác, kết quả và lỗi có thật; che token/secret/dữ liệu cá nhân.
- [ ] Huy review trước chốt Auth Integration; smoke này không tính lại giờ QA nghiệp vụ của #29.

### 4.7. Cập nhật [#27 — GitHub Actions CI](https://trello.com/c/ZeqjRAW7) (S1)

- **Owner:** Hưng; **reviewer:** Huy. **WBS:** 1.5.2.
- **Phụ thuộc:** Gin/FE foundation, migration reviewed; online deploy phụ thuộc CI, PR CI không phụ thuộc cloud DB.
- **Đầu ra:** PR checks build/test, PostgreSQL tạm và migration evidence; deploy gate riêng.
- **Công sức:** giữ **Hưng 8h gốc**; review theo phân bổ hiện có, reforecast nếu phát sinh.

Checklist:

- [ ] PostgreSQL sạch/tạm cho từng CI run; Goose Up và kiểm chứng rollback ở DB riêng.
- [ ] Build/test BE/FE, kiểm tra constraint/transaction khi test đã có; checks bắt buộc thực sự chạy.
- [ ] PR không truy cập DB chung hoặc nhận cloud/deploy secret; tách quyền deploy sau CI.
- [ ] Deploy flow có migration compatibility gate, commit/schema và smoke evidence.
- [ ] Ghi workflow/run link và hướng dẫn xử lý lỗi; không cộng trùng pipeline 4.4A.

### 4.8. Cập nhật [#26 — Docker Compose Local Environment](https://trello.com/c/ilLjehOx) (chuyển S2)

- **Owner:** Hưng; **reviewer:** Huy; Duy đối chiếu cách chạy FE.
- **WBS:** 1.5.1. **Phụ thuộc:** app/DB config và schema đã review; không còn là điều kiện phải hoàn tất trước online S1.
- **Đầu ra:** Compose local độc lập, hướng dẫn local/online và demo fallback có fixture/version.
- **Công sức:** giữ **8h gốc**, chuyển S1 sang S2; **thêm Hưng 2h — ước lượng đề xuất** cho hai chế độ. Không tính lại 8h.

Checklist:

- [ ] Compose chạy local PostgreSQL và app theo config, healthcheck/volume rõ.
- [ ] Hướng dẫn chọn local DB hoặc online endpoint; không vô tình reset Neon bằng lệnh local.
- [ ] Nêu rõ local DB không tự đồng bộ, cách migration/fixture tương ứng.
- [ ] Chuẩn bị backup/fixture import cho demo dự phòng; kiểm tra version và startup.
- [ ] Duy đối chiếu FE base URL; Huy review runbook/evidence.

### 4.9. QA và Integration từng increment

- **Owner chính đề xuất:** Hưng cho QA/evidence; task TEAM ghi Huy phụ trách BE/review, Duy FE, Hưng môi trường/test. Giữ assignment và estimate hiện hữu; Huy review gate.
- **WBS:** giữ gói chức năng của thẻ, liên kết 1.6.3 (test/UAT evidence), 1.7.3 (Review). Không coi QA môi trường là thay cho QA nghiệp vụ.
- **Phụ thuộc:** contract reviewed → implementation → deploy đúng increment/schema → QA API thật → xử lý lỗi/retest → Integration → Review.
- **Đầu ra:** test report/issue, commit/schema, demo increment; không chốt chỉ bằng mock.

| Sprint / thẻ | Bổ sung vào checklist, không đổi scope chức năng |
|---|---|
| S1 [Auth Integration & QA #29](https://trello.com/c/UYghDU4t), [Review #30](https://trello.com/c/cpiXWRI1) | Online dev/CI/FE và smoke ba mạng thay dependency “Docker hoàn tất”; Auth API/role/FE/test prep phải có; Profile vẫn thuộc increment tương ứng |
| S2 [QA](https://trello.com/c/gcdUfvcz), [Integration](https://trello.com/c/T5SZpxCt), [Review](https://trello.com/c/CjltXLxO) | API thật của increment S2, fixture Court/Schedule/Blackout nền để kiểm chứng availability; Docker fallback không tạo vòng dependency |
| S3 [Booking Core & Concurrency QA](https://trello.com/c/k624Ws2D), [Integration](https://trello.com/c/3LhVH1Fr), [Review](https://trello.com/c/PY3bMC9X) | Eligibility/consecutive selection dùng availability đã kiểm chứng; online concurrent request, atomic rollback, retry/idempotency, ownership/history/cancel; gate Booking Core |
| S4 [QA](https://trello.com/c/XdyFY9Gh), [Integration](https://trello.com/c/KdyiHsCJ), [Review](https://trello.com/c/a8tk2zcz) | Admin increment tương ứng và staging; Review chỉ demo increment S4, không “toàn bộ MVP” nếu WBS còn việc S5 |
| S5 [Regression #52](https://trello.com/c/snU7fIbv), [Performance/Usability #99](https://trello.com/c/3WhdY7GD), [Security/Privacy](https://trello.com/c/hbR4O5LP) | Functional/security regression và warm/cold performance/usability có load profile; stabilization/retest trước UAT Entry Gate |

Checklist chung cho các thẻ QA/Integration/Review:

- [ ] Ghi FR/BR/NFR/UC, fixture, môi trường, commit/schema và API thực dùng.
- [ ] Kiểm tra lỗi quyền, dữ liệu/xung đột và mạng/DB theo increment; ghi expected/actual có thật.
- [ ] Chặn Done khi đầu vào bắt buộc chưa có, critical defect chưa đóng hoặc evidence thiếu.
- [ ] Review đánh giá increment đã hoàn tất; liên kết report/issue và phần còn lại, không tuyên bố MVP hoàn thành sớm.

### 4.10. DB readiness, Backup/Restore, RC và Final Deployment

| Thẻ / WBS | Owner, reviewer và giờ gốc | Phụ thuộc → đầu ra đề xuất |
|---|---|---|
| [DB/Migration Release Readiness #98](https://trello.com/c/bk0fO5no); 1.5.3 / 1.3.6.3 | Hưng 4h, Huy 2h review | Staging/schema/CI → connection, migration/compatibility và rollback evidence trước UAT |
| [Backup/Restore #102](https://trello.com/c/6Q4GuvxH); 1.5.4, NFR11 | Hưng 3h, Huy 1h review | DB/fixture/version và runbook → backup riêng tư, restore DB riêng, integrity/core smoke trước RC |
| [RC Build Validation #104](https://trello.com/c/1ufWyuIW); 1.5.2 | Hưng 4h; Huy review gate | UAT acceptance, defect retest, backup readiness, CI/schema → immutable RC commit/build và evidence |
| [Final Deployment & Smoke #58](https://trello.com/c/obOcIsYr); 1.5.5 | Hưng 4h, Huy 1h, Duy 1h; Huy reviewer | RC/release approval, release config/DB/migration readiness → URL release, schema/commit, BE/FE smoke |
| [Operations Handoff #107](https://trello.com/c/hsSBIoHd); 1.6.4 / 1.5.5 | Hưng 4h, Duy 2h, Huy 2h review | Final deploy/smoke thành công → runbook, quyền vận hành, backup/reset/quota/rollback, fallback và handoff record |
| [Finalize Project Documentation #57](https://trello.com/c/5tTxw2th); 1.6.2/1.6.3 | Đề xuất Duy 6h + Hưng 4h soạn, Huy 2h review trong 12h gốc | Implementation/test/UAT evidence → technical/test/UAT docs S6; ops handoff S7 ở #107, không đếm lại |

Reviewer chưa tách giờ ở thẻ RC phải được PM xác nhận trong giờ Review/gate hiện hữu hoặc reforecast; bảng 617h chưa tự thêm phần chưa định lượng đó. Phân bổ 12h #57 là đề xuất cần PM xác nhận, không phải actual.

Checklist bổ sung cho từng thẻ trong bảng:

**#98 — DB readiness**

- [ ] Kiểm tra TLS/pool/timeout/reconnect.
- [ ] Thử migration/rollback trên DB riêng; ghi schema/compatibility và quyền thực thi.
- [ ] Huy review evidence trước gate.

**#102 — Backup/Restore**

- [ ] Tạo backup có version, lưu riêng tư ngoài Git; restore DB riêng.
- [ ] Kiểm tra integrity và auth/booking smoke.
- [ ] Đo thời gian/dung lượng thật, bàn giao runbook; Huy review. Không tự cam kết RPO/RTO chưa duyệt.

**#104 — RC**

- [ ] UAT/defect retest đạt trước chốt RC.
- [ ] Build/CI/DB readiness/backup đủ; pin commit/schema/config.
- [ ] Ghi RC validation và quyết định release.

**#58 — Final deployment**

- [ ] Chuẩn bị release DB/account/secret riêng; backup và migration trước deploy.
- [ ] Deploy RC; readiness và smoke FE/API/booking sau deploy.
- [ ] Ghi URL/commit/schema/kết quả và thử phương án Docker dự phòng.

**#107 — Operations handoff**

- [ ] Deploy/smoke xong trước bàn giao; quyền/secret chuyển qua kênh riêng.
- [ ] Hướng dẫn quota/cold start/mất kết nối/reset/backup/restore.
- [ ] Link evidence và xác nhận người tiếp nhận có thật.

**#57 — Finalize documentation**

- [ ] Cập nhật technical docs theo implementation; đưa report regression/UAT/acceptance có thật sau kiểm thử.
- [ ] Bỏ hạn 01/11 cũ, gắn gate S6/S7 đúng phạm vi.
- [ ] Huy review, liên kết ops #107. Tài liệu nền Done không đồng nghĩa report kiểm thử/UAT/handoff đã Done.

## 5. Lịch phụ thuộc và gate

| Sprint | Khoảng thời gian giữ nguyên | Thứ tự / đầu ra cần chốt |
|---|---|---|
| S1 | 03–09/10/2026 | Tài liệu môi trường review → provision DB → connection/migration → CI và deploy API/FE → smoke ba mạng → Auth Integration → Sprint Review |
| S2 | 10–16/10/2026 | Increment S2 và availability nền được kiểm chứng; bổ sung Docker fallback/hướng dẫn hai chế độ |
| S3 | 17–23/10/2026 | Booking Core → online concurrency/atomicity/idempotency QA → retest/integration → Review Booking Core |
| S4 | 24–30/10/2026 | Admin increment, staging riêng và fixture/runbook → QA/integration → Review S4 |
| S5 | 31/10–06/11/2026 | Hoàn tất MUST còn lại → functional/security/performance/usability regression → stabilization/retest → UAT Entry Gate |
| S6 | 07–13/11/2026 | UAT data/account + backup readiness → UAT execution/acceptance → defect fix/retest → RC → docs/review release readiness |
| S7 | 14–20/11/2026 | RC defect resolution nếu có → release DB/migration → final deployment/smoke → operations handoff → closure |

FE có thể dùng mock sau contract review; kiểm chứng cuối cần API thật. Availability S2 dựa vào Court/Schedule/Blackout nền, không đợi toàn bộ UI/API admin S4. S3 eligibility/consecutive selection dùng kết quả availability đã kiểm chứng. CI PostgreSQL tạm không phụ thuộc Docker Compose đầy đủ ở S2.

S1 đã diễn ra tại ngày 06/10: chuỗi online mới rất sát hạn 09/10. Có thể chuẩn bị độc lập sau review contract, nhưng không đổi thứ tự nghiệm thu để “kịp” lịch. Nếu thiếu giờ/người hoặc đầu vào, Huy phải duyệt bổ sung hỗ trợ/điều chỉnh phân bổ; mốc mục tiêu không tự thành cam kết khả thi.

### 5.1. Các mâu thuẫn đã tồn tại — không quy cho thay đổi hosting

Ngày dưới đây là **đề xuất Due Date**, giờ địa phương UTC+7; chỉ cập nhật Trello sau review. Không thêm Start Date. Mọi deadline thẻ upstream phải được refinement đủ sớm; đổi ngày gate mà giữ đầu vào sau gate vẫn là sai.

| Vấn đề từ snapshot Trello | Đề xuất sửa / điều kiện |
|---|---|
| [S4 Integration](https://trello.com/c/KdyiHsCJ) due 06/11 (S5), nhãn S4/S5 nhưng Review S4 ở 30/10 | Đưa integration vào S4, mục tiêu 30/10 17:00; Review 30/10 21:00; dời deadline implementation/QA upstream trước integration; nhãn S4 |
| [Pre-UAT Stabilization #55](https://trello.com/c/1Ikmoifr) due 19/11 (S7), nhãn S5/S6/S7 | Đưa về S5, mục tiêu 06/11 17:00 sau regression và trước UAT Gate; nhãn S5. Sửa lỗi UAT/RC dùng thẻ riêng, không gộp nhiều sprint |
| [UAT Entry Gate #100](https://trello.com/c/pM3OoWd8) 06/11 21:00 trước hạn regression #52 23:59 | Đề xuất functional/security/performance/usability upstream chốt 04/11 17:00 → regression 05/11 17:00 → stabilization/retest 06/11 17:00 → gate 06/11 21:00; refinement deadline implementation upstream tương ứng, không giữ performance ở 05/11 17:00 cùng hạn regression |
| [Release Readiness #105](https://trello.com/c/edbqfu02) 13/11 21:00 trước hạn [UAT #56](https://trello.com/c/UpFLhBc5) 23:59; RC cũng có hạn sớm | Đề xuất UAT/acceptance 11/11 17:00 → [UAT defect retest #103](https://trello.com/c/NCkmMNqC) 12/11 17:00 → RC 13/11 13:00 → technical/test docs 13/11 17:00 → Review 13/11 21:00; nếu UAT chưa đạt thì không qua gate |
| [Operations Handoff #107](https://trello.com/c/hsSBIoHd) 19/11 17:00 trước hạn final deployment #58 20/11 23:59 | Đề xuất final deploy/smoke 18/11 17:00 → handoff 19/11 17:00 → [closure #59](https://trello.com/c/SBnM8LVM) 20/11 21:00; nhãn S7 |
| [Finalize Documentation #57](https://trello.com/c/5tTxw2th) còn ghi 01/11; due 19/11, nhãn S5 | Tách phạm vi technical/test/UAT documentation S6 và operations S7 ở #107; sửa nội dung/ngày/nhãn theo chuỗi evidence, giữ 12h một lần |
| #98 DB readiness, #99 performance, security/privacy có due S5 nhưng nhãn S4; UAT data/backup chưa có nhãn | Nhãn S5 cho readiness/performance/security; S6 cho [UAT data #101](https://trello.com/c/bBqClrzT)/backup. Đối chiếu lại từng thẻ, không dùng nhãn sai để tính tải |
| QA/Integration/Review S3 đang cùng hạn cuối ngày 23/10 | Refinement deadline BE/FE/deploy/QA/retest trước Integration/Review theo thứ tự; cùng hạn không chứng minh đầu vào đã có. Không tự ghi đạt Booking Core |
| WBS 1.5.3 ở S5/owner Huy, task connection #20 lại S1/owner Hưng | Phân biệt foundation connection S1 do Hưng làm/Huy review và DB release readiness S5; đề xuất WBS ghi đủ hai đầu ra, không cộng hai lần cùng phần việc |

Các ngày mục tiêu trên cần PM kiểm tra tải và toàn bộ deadline upstream trước đồng bộ. Bảng tải mục 6 là cập nhật từ bảng công bố, **chưa phải lịch đã cân tải lại sau mọi sửa mâu thuẫn**. Các điều chuyển như #55/#57 sẽ cần reforecast bảng người × sprint theo phần việc thực còn lại.

## 6. Công sức, actual và thiếu hụt nguồn lực

### 6.1. Phần tăng thêm và điều chuyển

Tất cả giờ mới là **ước lượng đề xuất**, chưa phải actual. 1 ngày estimate = 8 giờ công; capacity 20 giờ/người/tuần bao gồm họp, review, tài liệu và kiểm thử.

| Phần việc mới | Huy | Duy | Hưng | Tổng |
|---|---:|---:|---:|---:|
| Quyết định/tài liệu môi trường S1 | 1h | 1h | 2h | 4h |
| Provision Neon S1 | 1h | 0h | 4h | 5h |
| Deploy frontend S1 | 1h | 2h | 1h | 4h |
| Smoke ba mạng S1 | 1h | 1h | 2h | 4h |
| Docker hai chế độ S2 — phần thêm | 0h | 0h | 2h | 2h |
| **Tổng tăng** | **4h** | **4h** | **11h** | **19h** |

Điều chuyển, không tăng tổng: deployment #51 **12h = 8h S1 + 4h S4**; Docker #26 **8h gốc S1 → S2**, thêm 2h mới. Không cộng lại tổng ngày WBS vào task hours. Task TEAM phân bổ từng người như bảng/thẻ, không nhân toàn bộ estimate cho mỗi thành viên.

### 6.2. Bảng estimate toàn dự án sau đề xuất online

| Sprint | Huy | Duy | Hưng | Tổng |
|---|---:|---:|---:|---:|
| S1 | 65h | 33h | 47h | 145h |
| S2 | 41h | 46h | 35h | 122h |
| S3 | 56h | 38h | 16h | 110h |
| S4 | 43h | 26h | 15h | 84h |
| S5 | 36h | 19h | 33h | 88h |
| S6 | 9h | 11h | 25h | 45h |
| S7 | 8h | 5h | 10h | 23h |
| **Tổng estimate** | **258h** | **178h** | **181h** | **617h** |
| Capacity 7 tuần | 140h | 140h | 140h | 420h |
| Chênh lệch ròng | +118h | +38h | +41h | **+197h** |

Đây là phép cập nhật **598h công bố → 617h (= 598 + 19)**, không phải tổng công sức còn lại. Phần 8h deployment và 8h Docker chỉ đổi sprint, không tăng tổng. Bảng giữ cơ sở công bố, chưa chứng minh lịch khả thi hoặc đã phân bổ xong mọi sửa gate ở 5.1.

| Giờ vượt 20h/người/sprint | Huy | Duy | Hưng | Tổng |
|---|---:|---:|---:|---:|
| S1 | 45h | 13h | 27h | 85h |
| S2 | 21h | 26h | 15h | 62h |
| S3 | 36h | 18h | 0h | 54h |
| S4 | 23h | 6h | 0h | 29h |
| S5 | 16h | 0h | 13h | 29h |
| S6 | 0h | 0h | 5h | 5h |
| S7 | 0h | 0h | 0h | 0h |
| **Tổng vượt theo ô** | **141h** | **63h** | **60h** | **264h** |

Thiếu ròng 197h khác với tổng vượt theo từng người/sprint 264h: 67h trống ở các ô khác không tự bù được công việc sớm hoặc chuyên môn không tương đương. Không dùng capacity muộn để bỏ qua phụ thuộc S1/S3/S5.

### 6.3. Tách Done estimate, remaining và actual

| Loại số liệu | Cách hiểu / xử lý |
|---|---|
| Estimate gốc toàn dự án | 598h trên bảng công bố, gồm cả task đã Done và chưa Done |
| Planned estimate của phần đánh dấu Done | Snapshot đối chiếu được 52h; đây là giờ kế hoạch, không phải actual đã tiêu tốn. Trạng thái/evidence review còn cần xác nhận |
| Estimate của phần chưa Done trong snapshot | 546h = 534h task có phân bổ + 12h #57 cần xác nhận phân bổ; vẫn là estimate gốc, không phải remaining đã cập nhật |
| Estimate sau đề xuất online | 617h, gồm 19h mới và cả phần Done; không ghi “còn phải làm 617h” |
| Remaining estimate | **Chưa được reforecast** từ mức hoàn thành, evidence và phần thực còn lại. Không mặc định 617 − 52 là remaining đã xác nhận |
| Actual | **Chưa có số liệu đủ tin cậy để tổng hợp**; cần timesheet/record theo người, task, ngày và hoạt động |

Huy cần xác nhận Done/review, actual và remaining trước cam kết; đặc biệt review API contract còn phải đối chiếu evidence. Ngày 06/10 không thể mặc định mỗi người còn đủ toàn bộ 20h của S1. Mọi giờ review chưa phân bổ, scope cloud trong task cũ hoặc rủi ro cold start/migration có thể làm remaining tăng; 19h chưa phải bảo đảm bao phủ mọi phát sinh.

### 6.4. Quyết định nguồn lực cần PM xử lý

- Chỉ chuyển việc phù hợp chuyên môn: Duy FE/config/evidence FE, Hưng DB/CI/deploy/test ops; Huy giữ review backend/gate. Không dồn review backend sang người chưa đủ năng lực để cân số.
- Chốt hỗ trợ backend cho các tuần S1–S5, hỗ trợ FE/test/config và DevOps theo cột vượt ở 6.2. **197h** là thiếu hụt ròng theo full estimate; **264h** là độ lệch theo ô cần tái phân bổ/hỗ trợ, không phải tự động thuê đúng 264h.
- Hỗ trợ thực tế phải được tính sau remaining reforecast và thời gian onboarding/review; không tự coi giờ thêm là overtime đã được chấp thuận.
- Nếu chưa có hỗ trợ hoặc capacity được xác nhận, giữ lịch là mục tiêu có rủi ro. PM quyết định phân bổ/nguồn lực/change control để giữ MVP và 20/11; không tự cắt MUST, giảm estimate hay kéo deadline.

## 7. Đề xuất cập nhật tài liệu Final và quản trị

| Tài liệu / thẻ | Nội dung đề xuất, chỉ thực hiện sau review |
|---|---|
| SDP | Thêm dev online S1 trước integration, staging S4 và release S7; flow CI → migration compatibility → migration/deploy → readiness/smoke; mock chỉ sau contract review; runbook/handoff và cold start |
| WBS | Cập nhật 1.5.1 environment/dev/staging/local, 1.5.2 CI/build/release, 1.5.3 connection S1 + readiness S5, 1.5.4 backup/restore, 1.5.5 final deploy/smoke; mapping/phụ thuộc/giờ và tài liệu vận hành 1.6.4; không cộng trùng aggregate |
| SPMP | Provider/region/role, config/secret ownership, change approval, migration/reset, quota và rolling forecast; mô tả thiếu hụt nguồn lực và evidence gate |
| SRS | Ghi online/hosting vào technical decision hoặc deployment constraints; giữ FR/BR/MUST đã chốt và tiêu chí NFR; không tự bổ sung Realtime hay SLA Free tier |
| [Architecture](https://trello.com/c/0VhI2oe1) | Thay provider TBD bằng đề xuất Neon/Render/Vercel, môi trường/region, credential boundary, refetch và Docker fallback |
| [Budget](https://trello.com/c/qHMv6xyr) | Phân biệt chi phí tiền mặt cloud/upgrade được duyệt với ngân sách mô phỏng dự án và giờ công; 19h không đồng nghĩa khoản tiền cloud. Ngân sách mô phỏng 1,5 tỷ VND trong SPMP không phải hóa đơn hosting |
| [Risk Log](https://trello.com/c/Wx4Z0oHm), [Project Control](https://trello.com/c/vxmOgrJ9) | Ghi rủi ro, owner, trigger và phương án; decision/CR, reforecast và phê duyệt |
| [QA/Release](https://trello.com/c/16YXvVlg) | Test môi trường thực, quota/cold start, readiness/backup và thứ tự UAT/RC/deploy/handoff |

Các đề xuất này không đồng nghĩa Final đã được sửa. Nếu khi review phát hiện baseline tự mâu thuẫn, ghi nguồn/mục/ảnh hưởng và quyết định cần PM; không âm thầm sửa Final trong phạm vi file này.

### 7.1. Rủi ro và trách nhiệm

| Rủi ro / dấu hiệu | Owner / reviewer | Biện pháp và evidence cần có |
|---|---|---|
| Quota compute/storage/giờ service gần hết hoặc suspend | Hưng / Huy | Theo dõi console, giới hạn fixture/branch, thông báo PM; nâng gói chỉ khi duyệt; Docker demo fallback |
| Cold start / mất kết nối làm API timeout | Hưng; Duy xử lý UI / Huy | Readiness, timeout/pool/reconnect, lỗi UI/refetch rõ; test warm/cold; không retry tạo booking thiếu idempotency |
| Migration lỗi, schema lệch hoặc reset DB chung | Hưng / Huy | Review, Up/Down DB riêng, backup/version, single operator, reset window, restore evidence |
| Lộ secret / frontend dùng nhầm môi trường | Hưng/Duy / Huy | Env tách, allowlist CORS, không commit/log credential, rotate khi lộ, smoke URL/schema đúng |
| UAT bị dev reset hoặc build thay đổi giữa test | Hưng / Huy | Staging riêng, fixture/commit pin, quyền hạn chế, change window và record |
| Online S1 quá tải, thiếu review/test | Huy (PM); Duy/Hưng cung cấp remaining | Reforecast actual/remaining, bổ sung hỗ trợ đúng chuyên môn; không vượt gate khi evidence chưa đủ |

## 8. Checklist đồng bộ và bàn giao sau PM review

Các mục này là công việc tương lai, **chưa được thực hiện bởi việc tạo file**:

- [ ] Huy review provider, quota, bảo mật, WBS, công sức, remaining và khả năng giữ mốc online S1.
- [ ] Tạo/cập nhật thẻ theo mục 4: tên, owner, reviewer, scope, acceptance/checklist, WBS, dependency, đầu ra, estimate và nhãn sprint; không thêm Start Date.
- [ ] Thẻ tách có link hai chiều thẻ gốc; 12h deployment và 8h Docker chỉ tính một lần.
- [ ] Sắp thứ tự Backlog theo baseline/contract → environment/schema → chức năng → deploy/QA → gate; Due Date/nhãn khớp lịch đã được PM duyệt.
- [ ] Sửa mâu thuẫn mục 5.1 cùng mọi deadline upstream; không còn vòng dependency hoặc gate trước đầu vào.
- [ ] Đối chiếu toàn bộ MUST/gói việc bắt buộc có task implementation và verification; không bỏ Basic Statistics, Audit Logging, idempotency, performance/usability hay backup.
- [ ] Duy/Hưng soạn cập nhật Final sau khi được giao riêng; Huy review; giữ nguồn truy vết và không tạo kết quả test/acceptance chưa có.
- [ ] Đọc lại Trello sau cập nhật để xác nhận nội dung, owner, checklist, giờ, link, Due Date và nhãn; bàn giao changelog/thiếu hụt nguồn lực.

Kiểm tra số học của **file đề xuất**: 4 + 5 + 4 + 4 + 2 = 19h mới; 598 + 19 = 617h; 617 − 420 = 197h thiếu ròng; tổng vượt theo người × sprint = 264h. Các kiểm tra tài liệu không phải kết quả smoke, migration, deploy, UAT hoặc approval.

## 9. Nguồn kỹ thuật chính thức

- [Neon Free: 1 GB per project](https://neon.com/blog/neon-free-plan-1-gb-per-project) — dung lượng, compute, branch và instant restore.
- [Neon regional latency / regions](https://neon.com/demos/regional-latency) — đối chiếu Singapore.
- [Render Free](https://render.com/docs/free) — sleep/wake, quota, filesystem và giới hạn thực thi.
- [Render regions](https://render.com/docs/regions) — lựa chọn Singapore.
- [Deploy Go on Render](https://render.com/docs/deploy-go) — cấu hình build/run backend.
- [Render deploys](https://render.com/docs/deploys) — flow deploy và gating theo checks.
- [Vercel Vite](https://vercel.com/docs/frameworks/frontend/vite) và [environment variables](https://vercel.com/docs/environment-variables) — deploy frontend và cấu hình theo môi trường.

Giới hạn dịch vụ có thể thay đổi; kiểm tra lại console/tài liệu chính thức lúc provision và trước UAT/release. Không ghi credential hoặc URL triển khai chưa được tạo vào tài liệu.
