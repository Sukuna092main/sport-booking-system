# Staging — Review cấu hình backend cho Render

| Thuộc tính | Nội dung |
|---|---|
| Thẻ | [#51 [DEVOPS] Staging Environment & Deployment Pipeline](https://trello.com/c/WsOCieqH) |
| Checklist | Mục 1/10 — "Kiểm tra cấu hình backend Render theo Architecture và khả năng dùng cho staging; ghi hạn chế/biện pháp dự phòng" |
| WBS | 1.5.1; 1.3.6.3 |
| Người soạn | Hưng (DevOps/QA) |
| Reviewer | Huy (PM/Backend) |
| Ngày | 25/10/2026 |
| Trạng thái | **Nháp — chưa provision, chưa deploy, chưa có URL staging** |

> Tài liệu này chỉ đánh giá **khả năng cấu hình** của backend hiện tại cho Render. Không có service nào được tạo, không có bằng chứng staging nào tồn tại. Mọi kết luận dưới đây đọc từ source, không phải từ môi trường thật.

## 1. Nguồn đối chiếu

- `backend/internal/platform/config/config.go` — toàn bộ biến môi trường và ràng buộc `Validate()`.
- `backend/Dockerfile` — runtime `alpine:3.21`, chạy `/app/server`, `EXPOSE 8080`.
- `docs/planning/ONLINE_ENVIRONMENT_PLAN_CHANGE.md` §3.2–3.4 — quyết định Render/Neon/Vercel, Singapore, giới hạn Free tier.
- [Render Web Services — Port binding](https://render.com/docs/web-services#port-binding): service phải bind `0.0.0.0`, **`PORT` mặc định là `10000`**.

## 2. Sáu điểm phải xử lý trước khi deploy

| # | Vấn đề | Bằng chứng trong code | Cách xử lý |
|---|---|---|---|
| 1 | Port lệch với Render | `config.go:41` — `HTTP_ADDR` mặc định `:8080`. Render mặc định `PORT=10000` | Đặt `HTTP_ADDR=:10000`. `:10000` bind `0.0.0.0` nên đúng yêu cầu Render |
| 2 | Thiếu `APP_TIMEZONE` thì app **exit ngay** | `config.go:109-114` — không có default, `Validate()` bắt buộc IANA timezone | Đặt `APP_TIMEZONE=Asia/Ho_Chi_Minh` |
| 3 | Không có giá trị `staging` cho `APP_ENV` | `config.go:104-108` — chỉ nhận `development`, `test`, `production` | Dùng `APP_ENV=production`. Hệ quả: gin chuyển ReleaseMode (`router.go:33`) và **`DATABASE_URL` buộc TLS** (`config.go:145`) |
| 4 | CORS rỗng nếu không set | `config.go:81` — default chỉ áp dụng khi `APP_ENV=development` | Bắt buộc set `CORS_ALLOWED_ORIGINS=https://<domain-vercel>`. Không dùng wildcard, không kèm path |
| 5 | Chưa có endpoint readiness kiểm tra DB | `router.go:58` — chỉ có `GET /api/v1/ping`, không có `/api/v1/ready` | Health check của Render tạm dùng `/api/v1/ping`. `/api/v1/ready` là **đề xuất** trong kế hoạch online, cần Huy quyết định có làm ở S4 hay không |
| 6 | Migration không được chạy lúc app start | `docker-compose.yml` tách riêng service `migrate`; kế hoạch online §3.3 cấm nhiều instance tự chạy Goose; Render Free không có one-off job | Chạy Goose từ máy local hoặc workflow được bảo vệ, trỏ vào **direct endpoint** của Neon, không dùng pooled endpoint |

## 3. Biến môi trường tối thiểu cho staging

| Biến | Giá trị | Ghi chú |
|---|---|---|
| `APP_ENV` | `production` | Xem điểm 3 |
| `APP_TIMEZONE` | `Asia/Ho_Chi_Minh` | Bắt buộc, không có default |
| `HTTP_ADDR` | `:10000` | Khớp `PORT` của Render |
| `DATABASE_URL` | `postgresql://...@...-pooler...neon.tech/...?sslmode=require` | Endpoint **pooled** cho app; `sslmode` bắt buộc do Validate |
| `JWT_SECRET` | chuỗi ≥ 32 byte, sinh riêng cho staging | Không dùng lại secret của dev/local |
| `JWT_TTL` | `15m` | Trong khoảng 1m–24h |
| `CORS_ALLOWED_ORIGINS` | `https://<domain-vercel>` | Chỉ origin thật, không wildcard |
| `LOG_LEVEL` | `info` | `debug` chỉ khi cần điều tra |
| `DB_MAX_OPEN_CONNS` | `10` | Nhỏ hơn default 20 để hợp quota Neon Free |

Nếu dùng biến riêng cho Goose (khuyến nghị theo kế hoạch §3.2): `MIGRATION_DATABASE_URL` trỏ **direct endpoint**, quyền DDL, không truyền cho frontend.

## 4. Hạn chế Render Free và biện pháp dự phòng

| Hạn chế | Ảnh hưởng | Dự phòng |
|---|---|---|
| Ngủ sau ~15 phút không có traffic, wake ~1 phút | Request đầu tiên có thể timeout | Ghi rõ trong report; test cold start riêng, tách khỏi số đo warm |
| 750 giờ Free/workspace/tháng, dùng chung | Không đủ nếu mở nhiều service | Chỉ 1 backend staging; dọn service không dùng |
| Filesystem tạm | Không giữ file/log trên disk | Dữ liệu bền vững đặt ở Neon; log qua stdout |
| Không có one-off job | Không chạy được migration job riêng | Goose chạy từ local/workflow (điểm 6) |
| Port phải detect đúng | Deploy fail nếu bind sai | Set `HTTP_ADDR=:10000` thay vì tin vào auto-detect |

Không dùng keep-alive để coi Free tier là SLA.

## 5. Cần Huy quyết định

1. **Có thêm `GET /api/v1/ready`** (kiểm tra DB, 200/503) trong S4 không, hay dùng `/api/v1/ping` cho health check và để `ready` sang S5?
2. Xác nhận `APP_ENV=production` cho staging là chấp nhận được (không có giá trị `staging` trong enum).

## 6. Đối chiếu checklist #51

| Mục | Trạng thái |
|---|---|
| 1. Kiểm tra cấu hình backend Render, ghi hạn chế/dự phòng | **Xong bằng tài liệu này** |
| 2. Neon PostgreSQL/TLS + DB staging riêng | **Xong** — xem §7 |
| 3–10 | Chưa |

## 7. Nhật ký thực hiện

### 25/10/2026 — Neon staging branch và role app

Đã kiểm chứng bằng `psql` (không ghi credential vào tài liệu):

| Hạng mục | Kết quả |
|---|---|
| Branch | `staging`, cắt từ branch default của project (tên `production`, thực chất đang chứa dữ liệu dev) |
| Endpoint | `ep-nameless-glade-b3rz6u6q` — khác dev (`ep-long-grass-b33vny8t`) |
| Region | `ap-southeast-1` (Singapore) |
| TLS | `TLSv1.3`, `TLS_AES_256_GCM_SHA384`, xác nhận bằng `\conninfo` trên **cả** endpoint pooled và direct |
| Schema | Goose version **11** (đủ 11 migration), 10 bảng `public` |
| Role app | `app_staging` — `LOGIN`, **không** superuser, **không** có `CREATE` trên schema `public` |
| Quyền trên bảng nghiệp vụ | `SELECT`, `INSERT`, `UPDATE`, `DELETE` = có; `TRUNCATE` = không |
| Quyền trên `goose_db_version` | chỉ `SELECT` — đã `REVOKE` ghi để app không sửa được lịch sử migration |
| Default privileges | `ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner` để bảng mới do migration tạo ra vẫn cấp đúng quyền cho `app_staging` |

**Lưu ý khi kiểm chứng TLS trên Neon:** `pg_stat_ssl.ssl` trả `f` vì proxy của Neon kết thúc TLS rồi nối plain vào backend. Đây **không phải** lỗi cấu hình. Dùng `\conninfo` của `psql` (hoặc thông tin connection của client) làm bằng chứng, đừng dùng `pg_stat_ssl` — nếu không sẽ báo sai là mất mã hoá.

**Dữ liệu hiện tại:** branch `staging` thừa hưởng snapshot dev lúc tạo (3 user, 3 sport type, 4 court, 84 time slot, 1 booking). Chấp nhận được cho smoke test sau deploy, nhưng **phải reset bằng fixture có version trước regression S5/UAT S6**. Chưa truncate.

**Biến môi trường (file `backend/.env.staging`, đã gitignore):**

| Biến | Dùng cho | Ghi chú |
|---|---|---|
| `STAGING_DATABASE_URL_APP` | Backend trên Render | Role `app_staging`, endpoint **pooled** |
| `STAGING_DATABASE_URL_DIRECT` | Goose | Role `neondb_owner`, endpoint **direct** |
| `STAGING_DATABASE_URL_POOLED` | Quản trị/ops | Role `neondb_owner` — **không** đưa vào Render |

### Còn lại của mục 2

- [ ] Reset dữ liệu staging bằng fixture có version trước S5/UAT (chưa làm, cố ý trì hoãn)

