# Sport Booking System

Khung dự án theo SRS-SB-001, SDP-SB-001, WBS-SB-001, SPMP-SB-001 và thẻ Architecture trên Trello.

## Trạng thái

Đây là **scaffold thư mục**, chưa phải ứng dụng chạy được. Chưa có Go module, frontend package manifest, API implementation, migration SQL hay pipeline CI.
File `docker-compose.yml` trống do bạn tạo trước được giữ nguyên; hoàn thiện ở task Docker/local environment, không coi là đã cấu hình chạy.

## Cấu trúc

```text
Sport Booking System/
├── backend/
│   ├── cmd/api/                  # Entry point ứng dụng Go
│   ├── internal/
│   │   ├── bootstrap/            # Wiring các module và route /api/v1
│   │   ├── Auth/                 # Register/Login/JWT/role
│   │   ├── User/                 # Basic Profile/ownership
│   │   ├── SportType/
│   │   ├── Court/
│   │   ├── TimeSlot/             # Schedule/slot configuration
│   │   ├── CourtBlackout/
│   │   ├── Availability/         # Read availability + exclusion rules
│   │   ├── Booking/              # Eligibility/transaction/concurrency/idempotency
│   │   ├── BookingSlot/          # Dữ liệu slot của booking, cùng transaction
│   │   ├── Admin/statistics/     # Admin operations + Basic Statistics
│   │   ├── Audit/                # Audit events, không chứa secret
│   │   ├── Notification/         # Optional, chưa bật trong MVP
│   │   └── platform/             # Config/DB/middleware/response/logger dùng chung
│   └── migrations/              # PostgreSQL + Goose; SQL sau review ERD
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── app/                  # Router/providers
│   │   ├── features/             # Auth/Profile/Court/Availability/Booking/Admin
│   │   ├── components/           # UI/layout/feedback dùng chung
│   │   ├── lib/                  # API client/auth/query/utils
│   │   ├── assets/
│   │   ├── styles/
│   │   └── types/
│   └── tests/                    # Integration/E2E frontend
├── docs/                        # Baseline links, thiết kế, test/UAT, vận hành
├── tests/                       # QA liên hệ thống + dữ liệu kiểm chứng
├── scripts/                     # Dev, database, release/backup/restore
├── deploy/                      # Local/staging/release configuration
├── artifacts/                   # Kết quả chạy thực tế, mặc định không commit
└── docker-compose.yml
```

## Quy tắc làm việc

- Giữ tên module backend hiện có của bạn (Auth, User, Court, ...). Mỗi module tổ chức Handler → Service → Repository; file Go và package name dùng convention nhất quán khi khởi tạo code.
- Backend là Modular Monolith; không tách các module thành microservice.
- Business rules, authorization/ownership, transaction và idempotency nằm ở backend/service; UI guard không thay thế kiểm tra backend.
- Review SRS/UI/API/ERD trước phần triển khai phụ thuộc. Frontend chỉ dùng mock sau khi contract được review; chỉ ghi tích hợp hoàn tất khi chạy API thật.
- Unit tests đặt cạnh code; kiểm thử qua API/hệ thống đặt trong `tests/`. Không ghi Pass/UAT accepted khi chưa có actual evidence.
- Không commit .env, secrets, dữ liệu người dùng thật hoặc database dump.
- Notification/password reset/Admin user management là Optional; payment/deposit, reschedule, no-show và AI không thuộc MVP.
- Tài liệu do Duy/Hưng soạn, Huy (PM) review. Backend do Huy review.

Xem [nguồn tài liệu](docs/README.md), [kiến trúc và truy vết](docs/design/architecture/README.md), [backend](backend/README.md), [frontend](frontend/README.md), [QA](tests/README.md).
