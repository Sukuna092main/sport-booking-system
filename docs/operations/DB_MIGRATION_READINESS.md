# DB / Migration Release Readiness — evidence

| Thuộc tính | Nội dung |
|---|---|
| Thẻ | [#98 [DEVOPS] Database / Migration Release Readiness](https://trello.com/c/bk0fO5no) |
| WBS | 1.5.3; 1.3.6.3 |
| Người thực hiện | Hưng (DevOps/QA) |
| Reviewer | Huy (PM/Backend) |
| Ngày chạy | **26/10/2026 (UTC+7)** |
| Phạm vi | Migration forward, rollback/recovery, constraint/index integrity, schema version trên staging, TLS/pool/timeout |

> Toàn bộ kiểm thử phá huỷ (Down) chạy trên **DB kiểm chứng riêng**, không đụng staging. Staging chỉ được đọc.

## 1. Môi trường

| Hạng mục | Giá trị |
|---|---|
| Staging DB | Neon branch `staging`, `ep-nameless-glade-b3rz6u6q`, region `ap-southeast-1` |
| DB kiểm chứng | PostgreSQL 17.11 trong container `sportbookingsystem-db-1`, database `sport_qa_scratch` (tạo mới, xoá sau khi test) |
| Migration tool | `ghcr.io/kukymbr/goose-docker:3.24.0` |
| Số migration | 11 file (`00001` → `00011`) |
| Commit `develop` | `876a63e` |

## 2. Migration forward

Chạy `goose up` trên DB trống:

```
OK   00005_court_operating_hours.sql (20.8ms)
...
OK   00011_align_foundation_constraints.sql (31.48ms)
goose: successfully migrated database to version: 11
```

**Kết quả: 11/11 migration áp dụng thành công, không lỗi, không cần can thiệp tay.**

## 3. Rollback và recovery

Chạy `goose down-to 0` rồi `goose up` lại, trên cùng DB kiểm chứng.

| Bước | Kết quả |
|---|---|
| `down-to 0` | 11/11 migration rollback thành công, `current version: 0` |
| Trạng thái sau down | Chỉ còn bảng `goose_db_version` — toàn bộ bảng nghiệp vụ đã bị xoá |
| `up` lại | `successfully migrated database to version: 11` |
| Schema sau recovery | Khớp lại 100% với staging (xem §4) |

**Lưu ý:** `00001_extensions.sql` báo `EMPTY` khi rollback — file này chỉ tạo extension, không có script down. Extension vẫn tồn tại sau khi lùi về version 0. Đây là hành vi đã biết, không phải lỗi; nếu cần dọn sạch hoàn toàn thì phải `DROP EXTENSION` thủ công.

**Kết luận:** chu trình up → down → up hội tụ về đúng schema ban đầu. Có thể dùng làm cơ sở cho quy trình recovery.

## 4. Constraint / index integrity

So sánh DB vừa migrate từ đầu với staging:

| Hạng mục | DB migrate từ đầu | Staging | Khớp |
|---|---|---|---|
| Bảng (`BASE TABLE`) | 10 | 10 | ✅ |
| Primary key | 10 | 10 | ✅ |
| Foreign key | 10 | 10 | ✅ |
| Unique | 7 | 7 | ✅ |
| Check | 29 | 29 | ✅ |
| **Exclusion** | **3** | **3** | ✅ |
| NOT NULL | 62 | 62 | ✅ |
| Index | 39 | 39 | ✅ |

**Không có drift.** Schema staging đúng bằng schema mà migration sinh ra từ đầu.

### 3 exclusion constraint — cơ chế chống chồng lấn

| Bảng | Constraint | Chặn điều gì |
|---|---|---|
| `booking_slots` | `bslots_no_active_overlap` | Hai booking active chồng giờ trên cùng sân — nền tảng của chống double-booking |
| `court_operating_hours` | `coh_no_active_overlap` | Hai khung giờ mở cửa chồng lấn trong cùng ngày |
| `time_slots` | `ts_no_active_overlap` | Hai mẫu slot chồng lấn trên cùng sân/ngày |

### 7 unique constraint

| Bảng | Constraint | Ý nghĩa |
|---|---|---|
| `users` | `users_email_uk` | Email không trùng |
| `sport_types` | `sport_types_name_uk` | Tên loại thể thao không trùng |
| `courts` | `courts_code_uk` | Mã sân không trùng |
| `bookings` | `bookings_code_uk` | Mã booking không trùng |
| `bookings` | `bookings_idempotency_uk` | Chống tạo trùng khi retry cùng idempotency key |
| `bookings` | `bookings_id_court_date_uk` | Một booking chỉ thuộc một sân/ngày |
| `time_slots` | `ts_id_court_weekday_uk` | Mẫu slot không trùng sân + thứ |

## 5. Schema version trên staging

| Kiểm tra | Kết quả |
|---|---|
| `goose version` trên staging | **11** — bằng đúng version mới nhất trong repo |
| Số bảng `public` | 10 |
| Drift so với migration | Không (§4) |

## 6. TLS / pool / timeout

| Hạng mục | Trạng thái |
|---|---|
| TLS | `TLSv1.3`, `TLS_AES_256_GCM_SHA384` trên cả endpoint pooled và direct. Xác nhận bằng `\conninfo` — **không** dùng `pg_stat_ssl` vì proxy Neon báo sai (`ssl=f`) |
| Connection pool | `DB_MAX_OPEN_CONNS=10`, `DB_MAX_IDLE_CONNS=5` trên Render; `DB_CONN_MAX_LIFETIME=15m`, `DB_CONN_MAX_IDLE_TIME=5m` |
| Timeout HTTP | read header 5s, read 10s, write 15s, idle 60s, shutdown 10s |
| Role | App dùng `app_staging` (không `CREATE` schema, không ghi `goose_db_version`); migration dùng `neondb_owner` qua endpoint direct |
| Reconnect sau khi Neon auto-suspend | **Đã kiểm chứng** — xem §6.1 |

### 6.1. Reconnect sau khi idle

Thí nghiệm: đo baseline khi backend đang nóng, để **7 phút không có request nào**, rồi đo lại 3 lần liên tiếp.

| Thời điểm | Lần | Thời gian | HTTP |
|---|---|---|---|
| Baseline (đang nóng) | 2 | 0.264s | 200 |
| Baseline (đang nóng) | 3 | 0.291s | 200 |
| Sau 7 phút idle | 1 | **1.379s** | **200** |
| Sau 7 phút idle | 2 | 0.273s | 200 |
| Sau 7 phút idle | 3 | 0.312s | 200 |

**Kết luận:** request đầu tiên sau 7 phút idle vẫn trả **200**, không lỗi connection. Chênh lệch ~1.1s so với trạng thái nóng là chi phí mở lại connection + đánh thức compute của Neon; các request sau trở về mức nóng.

Lưu ý: con số này **không** phải cold start của Render (12.6s ở lần đo đầu tiên khi backend còn ngủ) — nghĩa là trong thí nghiệm này Render vẫn thức (ngưỡng ngủ 15 phút) và chỉ có đường DB là phải nối lại. Đây đúng là kịch bản cần kiểm chứng.

**Cơ chế trong code** (`backend/internal/platform/database/database.go`):

| Thiết lập | Giá trị | Tác dụng |
|---|---|---|
| `connect_timeout` (bổ sung vào DSN nếu thiếu) | 10s | Không treo vô hạn khi Neon đang wake |
| `SetConnMaxIdleTime` | 5m | Connection nhàn rỗi bị dọn — đây là lý do connection "chết" sau suspend không bị dùng lại |
| `SetConnMaxLifetime` | 15m | Connection cũ bị đóng và tạo mới định kỳ |
| `SetMaxOpenConns` / `SetMaxIdleConns` | 10 / 5 | Tránh vượt quota connection của Neon Free |
| Ping lúc khởi động | 10s timeout | Fail-fast nếu DB không sẵn sàng |

Vì `ConnMaxIdleTime` = 5m nhỏ hơn ngưỡng suspend của Neon, mọi connection đã chết đều bị loại khỏi pool trước khi có request dùng lại. Đây là lý do reconnect hoạt động mà không cần retry logic riêng.

## 7. Cách tái hiện

```bash
# 1. Tạo DB kiểm chứng (không dùng staging)
docker exec sportbookingsystem-db-1 psql -U sport -d sport_booking -c "CREATE DATABASE sport_qa_scratch"

# 2. Migration forward
docker run --rm --entrypoint goose \
  --network sportbookingsystem_default \
  --mount "type=bind,source=$(pwd -W)/backend/migrations,target=/migrations" \
  -e GOOSE_DRIVER=postgres -e GOOSE_MIGRATION_DIR=/migrations \
  -e GOOSE_DBSTRING="host=db port=5432 user=sport password=sport_123 dbname=sport_qa_scratch sslmode=disable" \
  ghcr.io/kukymbr/goose-docker:3.24.0 up

# 3. Rollback toàn bộ rồi lên lại
#    (đổi "up" thành "down-to 0", chạy lại, rồi chạy lại "up")

# 4. Dọn
docker exec sportbookingsystem-db-1 psql -U sport -d sport_booking -c "DROP DATABASE sport_qa_scratch"
```

### Ba cái bẫy gặp phải khi tái hiện

1. **`docker compose run migrate down-to 0` không có tác dụng.** Service `migrate` trong compose ghim `command: goose up`, nên truyền thêm tham số không đổi được lệnh — nó vẫn chạy `up` và báo "no migrations to run". Phải dùng `docker run --entrypoint goose`.
2. **`-v` với đường dẫn Windows có dấu cách mount rỗng.** Repo nằm ở `C:/Users/hello/Sport Booking System`, mount bằng `-v` cho container thấy `/migrations` trống → `goose run: no migration files found`. Dùng `--mount type=bind` thì đúng.
3. **Thiếu `GOOSE_MIGRATION_DIR=/migrations` cũng gây lỗi trên.** Đặt tường minh cho chắc.

## 8. Giới hạn

1. **Reconnect đã kiểm chứng nhưng chưa chứng minh được Neon thực sự đã suspend.** Kết quả 200 sau 7 phút idle và mức tăng ~1.1s phù hợp với việc wake compute, nhưng từ phía client không có cách xác nhận trạng thái suspend. Muốn chắc chắn thì cần xem dashboard Neon hoặc log của Neon tại đúng thời điểm đo.
2. **Chưa test migration trên dữ liệu thật.** Down chạy trên DB trống; hành vi khi có dữ liệu (đặc biệt migration có `DROP COLUMN`) chưa được kiểm chứng.
3. **Chưa có backup/restore.** Thuộc thẻ #102 [DEVOPS] Backup / Restore Readiness (S6).
4. **Staging đang tích luỹ dữ liệu QA** từ các lượt chạy trước (nhiều sport type / court tiền tố `QA-`). Cần reset bằng fixture có version trước regression S5.

## 9. Đối chiếu checklist #98

| # | Mục | Trạng thái |
|---|---|---|
| 1 | Migration forward | **Xong** — 11/11, version 11 |
| 2 | Rollback/recovery procedure | **Xong** — down-to 0 → up, hội tụ đúng schema |
| 3 | Constraint/index integrity | **Xong** — 8/8 hạng mục khớp staging, không drift |
| 4 | Staging schema/test data đúng version | **Một phần** — schema đúng version 11; test data chưa chuẩn hoá (còn dữ liệu QA) |
| Online 1 | Schema Audit/Admin Booking và staging/CI sẵn sàng | **Một phần** — staging sẵn sàng; bảng audit/booking đã có nhưng chưa audit nội dung dữ liệu |
| Online 2 | TLS/pool/timeout/reconnect, migration/rollback trên DB riêng | **Xong** — TLS/pool/timeout đo được, reconnect sau 7 phút idle trả 200, migration/rollback chạy trên DB kiểm chứng riêng |
| Online 3 | Ghi schema/config/quyền/fixture, Huy review | **Một phần** — tài liệu này; fixture chưa chốt; Huy chưa review |
