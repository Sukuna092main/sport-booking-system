# Staging Runbook — Sport Booking System

| Thuộc tính | Nội dung |
|---|---|
| Thẻ | [#51 [DEVOPS] Staging Environment & Deployment Pipeline](https://trello.com/c/WsOCieqH) |
| Checklist | Mục 7 (migration step), 9 (URL/vận hành), 10 (redeploy/rollback), Online 3 (reset window) |
| Người soạn | Hưng (DevOps/QA) |
| Reviewer | Huy (PM/Backend) |
| Cập nhật | 25/10/2026 |
| Trạng thái | Đang dùng — staging đã live |

> Không ghi secret trong tài liệu này. Credential nằm ở `backend/.env.staging` (đã gitignore) và trong dashboard Render. Khi cần chia sẻ, dùng kênh riêng, không dán vào chat hay PR.

## 1. Thông tin môi trường

| Hạng mục | Giá trị |
|---|---|
| Frontend | https://sport-booking-system-ochre.vercel.app |
| Backend API | https://sport-booking-api-staging.onrender.com/api/v1 |
| Health check | `GET /api/v1/ping` |
| Database | Neon branch `staging`, endpoint `ep-nameless-glade-b3rz6u6q`, region `ap-southeast-1` |
| Region backend | Render Singapore |
| Gói | Render Free + Vercel Hobby + Neon Free |
| Branch deploy | `develop` (Render và Vercel đều theo dõi `develop`) |
| Schema version | Goose 11 |

**Chỉ dùng domain `sport-booking-system-ochre.vercel.app`.** URL dạng `sport-booking-system-<hash>.vercel.app` là deployment URL, bị Deployment Protection chặn (302 sang `vercel.com/sso-api`), người ngoài không mở được.

## 2. Biến môi trường

### Render (backend)

| Biến | Ghi chú |
|---|---|
| `APP_ENV` | `production` — enum không có `staging`, nên staging chạy như production |
| `APP_TIMEZONE` | `Asia/Ho_Chi_Minh` — **không có default**, thiếu là app exit |
| `HTTP_ADDR` | `:10000` — backend **không** đọc `PORT` của Render |
| `DATABASE_URL` | role `app_staging`, endpoint **pooled** |
| `JWT_SECRET` | riêng cho staging, không dùng chung với dev |
| `JWT_TTL` | `15m` |
| `CORS_ALLOWED_ORIGINS` | `https://sport-booking-system-ochre.vercel.app` |
| `DB_MAX_OPEN_CONNS` | `10` |
| `DB_MAX_IDLE_CONNS` | `5` |
| `DB_CONN_MAX_LIFETIME` | `15m` |
| `DB_CONN_MAX_IDLE_TIME` | `5m` |

### Vercel (frontend)

| Biến | Environment | Ghi chú |
|---|---|---|
| `VITE_API_BASE_URL` | **Production** | `https://sport-booking-api-staging.onrender.com/api/v1` |

Biến này là **build-time**. Sửa xong phải **redeploy**, restart không có tác dụng. Không set cho Preview: mỗi PR một domain riêng nên CORS sẽ chặn.

### Máy local (thao tác vận hành)

`backend/.env.staging` chứa 3 biến, **không** đưa lên Render:

| Biến | Dùng cho |
|---|---|
| `STAGING_DATABASE_URL_APP` | Tham chiếu — giá trị dùng cho `DATABASE_URL` của Render |
| `STAGING_DATABASE_URL_DIRECT` | Goose migration (endpoint direct) |
| `STAGING_DATABASE_URL_POOLED` | Quản trị/ops (role owner) |

## 3. Quy trình deploy

1. Merge PR vào `develop`.
2. Render tự build và deploy (Auto-Deploy theo commit).
3. Vercel tự build lại frontend.
4. Kiểm tra smoke ở mục 6.

Không có pre-deploy command: Render Free **không hỗ trợ** tính năng này (chỉ gói trả phí), và image runtime chỉ có `/app/server` — không có goose, migrations hay psql. Nên migration là bước chạy tay có kiểm soát, không phải tự động.

## 4. Migration

Chạy **trước** khi deploy commit có thay đổi schema.

```powershell
# xem đang ở version nào
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/Invoke-StagingMigration.ps1 -Command status

# áp dụng migration còn thiếu
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/Invoke-StagingMigration.ps1 -Command up
```

Script dùng đúng image `ghcr.io/kukymbr/goose-docker:3.24.0` như docker-compose, tự từ chối nếu URL không phải Neon, thiếu `sslmode=require`, hoặc là endpoint `-pooler`.

**Không** sửa migration đã áp dụng để che lệch schema. Nếu migration sai, tạo migration mới để sửa.

## 5. Redeploy và rollback

### Redeploy backend

- Render → service → **Manual Deploy** → *Deploy latest commit*, hoặc
- push thêm commit vào `develop`.

### Redeploy frontend

- Vercel → **Deployments** → chọn deployment → **Redeploy**, hoặc push vào `develop`.
- Sau khi đổi biến môi trường **bắt buộc** redeploy (build-time).

### Rollback app

| Thành phần | Cách làm | Phạm vi ảnh hưởng |
|---|---|---|
| Backend | Render → **Deploys** → deployment trước → **Rollback** | Chỉ code, DB không đổi |
| Frontend | Vercel → **Deployments** → deployment trước → **Promote to Production** | Chỉ bundle tĩnh |

Rollback app **không** hoàn nguyên schema. Nếu commit bị rollback có kèm migration đã chạy, phải xử lý riêng ở mục dưới.

### Rollback schema

Chỉ chạy Goose `down` trên **DB kiểm chứng riêng**, không chạy trên staging khi đang có dữ liệu regression/UAT. Muốn lùi schema trên staging thì phải:

1. Backup dữ liệu cần giữ.
2. Huy review migration down.
3. Chạy trong cửa sổ bảo trì đã thông báo.

## 6. Smoke check sau mỗi lần deploy

```powershell
curl.exe https://sport-booking-api-staging.onrender.com/api/v1/ping
curl.exe https://sport-booking-api-staging.onrender.com/api/v1/courts
```

Kỳ vọng:

| Kiểm tra | Kết quả đúng |
|---|---|
| `/api/v1/ping` | 200, `"environment":"production"` |
| `/api/v1/courts` | 200, `meta.total = 2` (chỉ court active và sport type active) |
| `https://sport-booking-system-ochre.vercel.app/courts` | 200, hiện `QA-S2-BD-01` và `QA-S2-TN-01` |
| `/admin/courts` mở trực tiếp bằng URL | 200, không 404 |
| DevTools → Network | Không có request tới `localhost:8080`, không lỗi CORS |

## 7. Chính sách reset dữ liệu

- Người được reset: Hưng. Việc reset phải thông báo trước cho nhóm.
- **Không reset staging trong regression S5 hoặc UAT S6.** Nếu buộc phải reset, phải có thời điểm và owner ghi lại.
- Staging hiện thừa hưởng snapshot dev lúc tạo branch (3 user, 3 sport type, 4 court, 84 slot, 1 booking). Trước regression S5 phải thay bằng fixture có version.
- Không copy dữ liệu cá nhân thật vào staging.

## 8. Sự cố thường gặp

| Hiện tượng | Nguyên nhân | Xử lý |
|---|---|---|
| Trang mở nhưng danh sách sân trống | `CORS_ALLOWED_ORIGINS` thiếu domain frontend → backend trả 403 `cors_origin_not_allowed` | Thêm đúng origin vào Render, restart |
| Request đầu tiên chậm ~50s | Render Free ngủ sau ~15 phút không có traffic | Bình thường, không phải lỗi |
| `/courts` trả 404 | Thiếu `frontend/vercel.json` hoặc Vercel deploy từ branch khác `develop` | Kiểm tra file và Production Branch |
| App trắng, console báo `VITE_API_BASE_URL is not configured` | Biến chưa set cho Production, hoặc set sau khi build | Set biến rồi **redeploy** |
| Container exit: `APP_TIMEZONE must be a valid IANA timezone` | Thiếu `APP_TIMEZONE` | Thêm biến |
| Container exit: `database ping failed` | Sai `DATABASE_URL`, hoặc dùng nhầm role owner/endpoint | Dùng đúng `STAGING_DATABASE_URL_APP` |
| Deploy fail: `no open ports detected` | `HTTP_ADDR` không phải `:10000` | Sửa biến |
| `goose` báo `no migrations to run` | Schema đã ở version mới nhất | Không phải lỗi |

## 9. Giới hạn đã biết

1. Render Free ngủ sau ~15 phút, wake ~50 giây. Không dùng keep-alive để coi đây là SLA.
2. Render Free không có pre-deploy command và không có one-off job → migration luôn là thao tác tay.
3. Preview deployment của Vercel không gọi được API (CORS chỉ cho domain production).
4. 750 giờ Free/tháng tính chung cả workspace — service cũ của project khác vẫn đang tồn tại và ăn vào quota này.
5. Chưa có endpoint `/api/v1/ready`; health check dùng `/api/v1/ping`, endpoint này không kiểm tra DB.
