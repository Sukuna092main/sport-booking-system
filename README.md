# 🏟️ Sport Booking System (Hệ thống Quản lý và Đặt sân Thể thao)

[![CI Pipeline](https://github.com/Sukuna092main/sport-booking-system/actions/workflows/ci.yml/badge.svg)](https://github.com/Sukuna092main/sport-booking-system/actions)
[![Staging Live](https://img.shields.io/badge/Staging-Live-brightgreen)](https://sport-booking-system-ochre.vercel.app)
[![API Docs](https://img.shields.io/badge/Swagger-OpenAPI%203.0-blue)](https://sport-booking-api-staging.onrender.com/api/v1/docs)
[![Go Version](https://img.shields.io/badge/Go-1.25+-00ADD8?logo=go&logoColor=white)](https://go.dev/)
[![React Version](https://img.shields.io/badge/React-18.x-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> **Sport Booking System** là nền tảng quản trị và đặt sân thể thao trực tuyến thời gian thực, hỗ trợ khách hàng tìm kiếm, kiểm tra khung giờ trống và đặt lịch thi đấu thể thao (Cầu lông, Bóng đá, Tennis, Pickleball) tức thì. Hệ thống giải quyết triệt để bài toán xung đột đặt trùng lịch (Race Condition / Double-booking) bằng cơ chế khóa cơ sở dữ liệu và Idempotency Key, đồng thời cung cấp bộ công cụ quản lý toàn diện cho ban quản lý sân bãi.

Dự án thuộc Đồ án môn học **Quản lý Dự án Phần mềm** — Khoa Công nghệ Thông tin, **Học viện Công nghệ Bưu chính Viễn thông (PTIT)**.

---

## 📑 Mục lục (Table of Contents)

1. [Tổng quan & Minh họa Hệ thống (Overview & Visuals)](#1--tổng-quan--minh-họa-hệ-thống-overview--visuals)
2. [Tính năng Chính (Core Features)](#2--tính-năng-chính-core-features)
3. [Yêu cầu Hệ thống (Prerequisites)](#3--yêu-cầu-hệ-thống-prerequisites)
4. [Môi trường Trực tuyến & Tài khoản Thử nghiệm (Live Staging & Demo Accounts)](#4--môi-trường-trực-tuyến--tài-khoản-thử-nghiệm-live-staging--demo-accounts)
5. [Hướng dẫn Cài đặt & Khởi chạy (Installation & Usage)](#5--hướng-dẫn-cài-đặt--khởi-chạy-installation--usage)
6. [Cấu trúc Thư mục (Directory Structure)](#6--cấu-trúc-thư-mục-directory-structure)
7. [Kiểm thử Tự động & Đo kiểm Hiệu năng (Automated Testing & QA)](#7--kiểm-thử-tự-động--đo-kiểm-hiệu-năng-automated-testing--qa)
8. [Quy chuẩn Đóng góp (Contributing Guidelines)](#8--quy-chuẩn-đóng-góp-contributing-guidelines)
9. [Giấy phép Sử dụng (License)](#9--giấy-phép-sử-dụng-license)
10. [Đội ngũ Thực hiện & Lời cảm ơn (Credits & Authors)](#10--đội-ngũ-thực-hiện--lời-cảm-ơn-credits--authors)

---

## 1. 🖼️ Tổng quan & Minh họa Hệ thống (Overview & Visuals)

### Sơ đồ Kiến trúc Tổng thể (System Architecture)

Hệ thống được xây dựng theo mô hình **Modular Monolith** phân tầng rành mạch (*Handler -> Service -> Repository*), tối ưu hóa hiệu năng và khả năng bảo trì:

```mermaid
flowchart TD
    subgraph ClientLayer [" Lớp Trình duyệt & Người dùng (Client Layer) "]
        WebCustomer[" Khách hàng (React 18 SPA) "]
        WebAdmin[" Quản trị viên (React 18 Admin Dashboard) "]
    end

    subgraph HostingFrontend [" Hạ tầng Frontend (Vercel Cloud Edge) "]
        VercelCDN[" Vercel CDN / Edge Network (Rewrite to SPA) "]
    end

    subgraph BackendAPI [" Cổng Dịch vụ API (Render Cloud Service - Singapore) "]
        GinGateway[" Gin HTTP Engine & Middleware (Auth JWT, CORS, Rate Limit) "]
        SwaggerModule[" OpenAPI 3.0 / Swagger UI Docs "]
        
        subgraph BusinessModules [" Các Module Nghiệp vụ Độc lập "]
            AuthMod[" Module Xác thực (Auth & RBAC) "]
            CourtMod[" Module Quản lý Sân (Courts & Slots) "]
            BookingMod[" Module Đặt sân & Khóa giao dịch (Booking Core) "]
            AdminMod[" Module Quản trị & Blackout (Admin Mgmt) "]
        end
    end

    subgraph DatabaseLayer [" Cơ sở Dữ liệu & Lưu trữ (Neon Serverless PostgreSQL 17) "]
        DBPool[" Connection Pool (pgx / database/sql) "]
        PostgresTables[(" 12 Bảng Dữ liệu & Ràng buộc Độc quyền ")]
        Locks[" Row-Level Lock: SELECT ... FOR UPDATE "]
    end

    WebCustomer -->|HTTPS / REST API| VercelCDN
    WebAdmin -->|HTTPS / REST API| VercelCDN
    VercelCDN -->|JSON API v1| GinGateway
    GinGateway --> SwaggerModule
    GinGateway --> BusinessModules
    BookingMod -->|Pessimistic Locking & Idempotency| Locks
    BusinessModules --> DBPool
    DBPool --> PostgresTables
```

### Ma trận Trạng thái Khung giờ (Slot State Matrix)

Mỗi khung giờ (slot) trên lưới đặt sân được quản lý nghiêm ngặt theo vòng đời trạng thái:

| Trạng thái Slot | Mã màu UI | Ý nghĩa nghiệp vụ | Hành vi cho phép |
|---|:---:|---|---|
| **Available** | 🟢 Xanh lá | Khung giờ đang trống, sẵn sàng tiếp nhận đặt chỗ | Khách hàng bấm chọn để tạo đơn |
| **Pending** | 🟡 Vàng cam | Đang được giữ chỗ tạm thời trong phiên thanh toán | Tạm khóa đối với khách hàng khác |
| **Booked** | 🔴 Đỏ | Đã được đặt và xác nhận thành công | Khóa hoàn toàn, không thể đặt đè |
| **Blackout** | ⚫ Xám đậm | Quản trị viên khóa sân (bảo trì định kỳ, tổ chức giải) | Vô hiệu hóa đặt lịch đối với công chúng |
| **Past** | ⚪ Xám nhạt | Khung giờ trong quá khứ so với thời điểm hiện tại | Chỉ xem lịch sử, không thể đặt |

---

## 2. ✨ Tính năng Chính (Core Features)

### 👤 Dành cho Khách hàng (Customer Experience)
* **Tra cứu sân đa bộ môn:** Tìm kiếm, phân loại theo bộ môn (Cầu lông, Bóng đá, Tennis, Pickleball), khoảng giá và địa điểm thi đấu.
* **Lưới khung giờ trực quan (Time-slot Grid):** Kiểm tra tình trạng sân trống (Availability) theo ngày theo thời gian thực (Real-time).
* **Đặt sân tức thì & Chống trùng lặp:** Cơ chế gửi kèm `Idempotency-Key` bảo vệ khách hàng khỏi việc thanh toán/đặt trùng khi mạng chập chờn.
* **Quản lý lịch sử đặt chỗ:** Tra cứu danh sách các lượt đặt của cá nhân (`CONFIRMED`, `CANCELLED`) và tự hủy trước giờ quy định.

### 🛡️ Dành cho Quản trị viên (Admin Management)
* **Quản lý Sân & Cụm sân (Court CRUD):** Thêm mới, chỉnh sửa thông tin sân, bảng giá theo khung giờ cao điểm/thấp điểm và xóa mềm an toàn.
* **Cấu hình Giờ hoạt động (Operating Hours):** Thiết lập linh hoạt giờ mở/đóng cửa và độ dài slot (60 phút / 90 phút) cho từng ngày trong tuần.
* **Khóa sân bảo trì (Blackout Slots):** Đặt lịch đóng cửa sân đột xuất phục vụ bảo dưỡng, thi đấu nội bộ kèm lý do giải trình.
* **Báo cáo & Thống kê cơ bản (Basic Analytics):** Bảng tổng hợp số lượng booking, tỷ lệ lấp đầy sân và doanh thu sơ bộ.

### ⚙️ Đặc tính Kỹ thuật & Phi chức năng (Engineering & NFR)
* **Xử lý tương tranh triệt để (Concurrency Control):** Kết hợp PostgreSQL Row-level Lock (`SELECT ... FOR UPDATE`) và DB Unique Constraints `(court_id, slot_date, start_time)` ngăn chặn 100% rủi ro Double-booking ngay cả khi chịu tải đồng thời.
* **Quản lý Lược đồ Dữ liệu (Schema Evolution):** 12 migration tuần tự quản lý bằng công cụ Goose SQL, không sử dụng AutoMigrate để đảm bảo toàn vẹn production.
* **Kiểm soát chất lượng gắt gao:** 209 tests/subtests Go Backend với `-race` detector, 39 tests Vitest Frontend, 24 test requests Postman liên hoàn.
* **Hiệu năng cao:** Đạt chuẩn độ trễ đọc NFR-07 (p95 ≤ 2000ms; thực tế Staging đạt p95 = 380ms).

---

## 3. 📋 Yêu cầu Hệ thống (Prerequisites)

Để cài đặt và chạy thử dự án cục bộ, máy tính cần đáp ứng các điều kiện sau:

| Công cụ / Nền tảng | Phiên bản tối thiểu khuyên dùng | Mục đích sử dụng |
|---|:---:|---|
| **Hệ điều hành** | Windows 10/11, macOS 13+, Ubuntu 22.04+ | Môi trường phát triển và chạy ứng dụng |
| **Docker & Docker Compose** | Docker v24.0+ & Compose v2.20+ | Đóng gói và chạy trọn gói toàn bộ hệ thống bằng 1 lệnh |
| **Go Runtime** | Go 1.25+ *(khi chạy thủ công backend)* | Biên dịch và chạy Go/Gin API Gateway |
| **Node.js & npm** | Node.js v20.x LTS & npm v10.x+ *(khi chạy thủ công FE)* | Biên dịch mã nguồn React 18, Vite và chạy Vitest |
| **PostgreSQL** | PostgreSQL v17.x *(khi dùng DB ngoài)* | Hệ quản trị cơ sở dữ liệu quan hệ |
| **Goose CLI** | Goose v3.24.0+ | Chạy migration lược đồ cơ sở dữ liệu |
| **Git** | Git 2.40+ | Quản lý mã nguồn theo GitFlow |

---

## 4. 🌐 Môi trường Trực tuyến & Tài khoản Thử nghiệm (Live Staging & Demo Accounts)

Hệ thống đã được đóng gói và triển khai trực tuyến trên hạ tầng đám mây khu vực Singapore (`ap-southeast-1`):

* 🌐 **Giao diện Web Khách hàng (Vercel):** [https://sport-booking-system-ochre.vercel.app](https://sport-booking-system-ochre.vercel.app)
* ⚡ **Cổng API Gateway Backend (Render):** [https://sport-booking-api-staging.onrender.com/api/v1](https://sport-booking-api-staging.onrender.com/api/v1)
* 📖 **Tài liệu API Tương tác (Swagger UI):** [https://sport-booking-api-staging.onrender.com/api/v1/docs](https://sport-booking-api-staging.onrender.com/api/v1/docs)
* 📋 **Đặc tả OpenAPI 3.0 (YAML):** [https://sport-booking-api-staging.onrender.com/api/v1/openapi.yaml](https://sport-booking-api-staging.onrender.com/api/v1/openapi.yaml)
* 📊 **Bảng Quản lý Tiến độ (Trello):** [Nhóm 9 - Quản lý Dự án Phần mềm](https://trello.com/b/YHI1iwU2/nhom9quanlyduanphanmem)

> **Lưu ý về Cold-start:** Do sử dụng hạ tầng Render Free Tier, backend container sẽ tự động ngủ đông sau 15 phút không nhận request. Yêu cầu đầu tiên để đánh thức hệ thống có thể mất từ **12–15 giây**. Các yêu cầu kế tiếp sẽ phản hồi cực nhanh (50–150 ms).

### Tài khoản Thử nghiệm (Demo Credentials)

| Vai trò | Email đăng nhập | Mật khẩu | Phạm vi quyền hạn |
|---|---|:---:|---|
| **Quản trị viên (Admin)** | `qa-s4-admin@example.test` | `password123` | Quản lý Sân, Khóa sân Blackout, Cấu hình Giờ hoạt động, Báo cáo Thống kê. |
| **Khách hàng (User)** | `qa-s4-user@example.test` | `password123` | Tra cứu sân, xem lưới slot theo ngày, Đặt sân, Hủy đặt chỗ cá nhân. |

---

## 5. 🚀 Hướng dẫn Cài đặt & Khởi chạy (Installation & Usage)

### Cách 1: Khởi chạy nhanh bằng Docker Compose (Khuyên dùng)

Đây là phương thức tiện lợi nhất giúp thiết lập trọn gói Database, Migrations, Backend và Frontend chỉ với một dòng lệnh:

1. **Clone mã nguồn từ GitHub:**
   ```bash
   git clone https://github.com/Sukuna092main/sport-booking-system.git
   cd "sport-booking-system"
   ```

2. **Khởi tạo tệp biến môi trường `.env`:**
   ```bash
   # Windows PowerShell:
   Copy-Item .env.example .env

   # Linux / macOS:
   cp .env.example .env
   ```
   *(Tệp `.env` mẫu đã cấu hình sẵn chuỗi kết nối và `JWT_SECRET` hợp lệ).*

3. **Khởi động toàn bộ cụm container:**
   ```bash
   docker compose up --build
   ```
   *Quá trình này sẽ khởi chạy:*
   * Database PostgreSQL 17 tại cổng `5432`.
   * Bộ di chuyển dữ liệu Goose áp dụng 12 tệp migration tuần tự.
   * Backend Go/Gin REST API tại cổng `8080`.
   * Frontend React/Vite đóng gói cùng Nginx tại cổng `5173`.

4. **Truy cập ứng dụng:**
   * Giao diện người dùng: [http://localhost:5173](http://localhost:5173)
   * API Gateway Health Check: [http://localhost:8080/api/v1/ping](http://localhost:8080/api/v1/ping)
   * Tài liệu tương tác Swagger: [http://localhost:8080/api/v1/docs](http://localhost:8080/api/v1/docs)

---

### Cách 2: Khởi chạy Thủ công từng dịch vụ (Manual Setup)

Dành cho thành viên phát triển mã nguồn trực tiếp (Developer Mode).

#### Bước 1: Khởi động Cơ sở Dữ liệu & Chạy Migrations
Khởi động một instance PostgreSQL 17 (cục bộ hoặc Neon Cloud), sau đó thực thi migration:
```bash
# Cài đặt công cụ goose nếu chưa có
go install github.com/pressly/goose/v3/cmd/goose@v3.24.0

# Áp dụng migrations
goose -dir backend/migrations postgres "host=localhost port=5432 user=sport password=sport_123 dbname=sport_booking sslmode=disable" up
```

#### Bước 2: Chạy Backend Go/Gin API
```bash
cd backend

# Thiết lập biến môi trường (PowerShell ví dụ)
$env:APP_ENV = "development"
$env:APP_TIMEZONE = "Asia/Ho_Chi_Minh"
$env:HTTP_ADDR = ":8080"
$env:DATABASE_URL = "postgresql://sport:sport_123@localhost:5432/sport_booking?sslmode=disable"
$env:JWT_SECRET = "sport_booking_secret_key_minimum_32_bytes_long_123"
$env:JWT_TTL = "24h"
$env:CORS_ALLOWED_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173"

# Khởi chạy server
go run ./cmd/api
```

#### Bước 3: Chạy Frontend React/Vite
```bash
cd frontend

# Cài đặt thư viện phụ thuộc
npm install

# Chạy development server
npm run dev
# Truy cập giao diện tại http://localhost:5173
```

---

## 6. 📂 Cấu trúc Thư mục (Directory Structure)

```text
Sport Booking System/
├── backend/                       # Mã nguồn Backend Go/Gin (Modular Monolith)
│   ├── cmd/
│   │   └── api/                   # Điểm nhập ứng dụng (main.go, cấu hình DI)
│   ├── internal/                  # Các module nghiệp vụ được cô lập
│   │   ├── admin/                 # Quản trị sân, thống kê và quản lý Blackout
│   │   ├── auth/                  # Đăng ký, đăng nhập JWT, phân quyền RBAC
│   │   ├── booking/               # Lõi đặt sân, khóa hàng giao dịch, chống trùng
│   │   ├── court/                 # Đọc danh mục sân, tìm kiếm và tính Availability
│   │   └── platform/              # Thư viện dùng chung (DB pool, config, HTTP response)
│   ├── migrations/                # 12 tệp Goose SQL Migrations tuần tự
│   └── docs/                      # Đặc tả OpenAPI / Swagger specification
├── frontend/                      # Ứng dụng Frontend React 18, Vite, Tailwind CSS
│   ├── src/
│   │   ├── components/            # UI components tái sử dụng (Button, Modal, Input...)
│   │   ├── features/              # Các phân hệ UI theo chức năng (auth, booking, admin...)
│   │   ├── lib/                   # Cấu hình API client, Axios instance, utils
│   │   └── routes/                # Cấu hình định tuyến React Router
├── docs/                          # Hồ sơ tài liệu kỹ thuật và báo cáo đồ án
│   ├── report/                    # Báo cáo Chương 5, 6, 7 & Phụ lục (Markdown + .docx)
│   │   └── images/                # Biểu đồ chất lượng cao (CI/CD, Sprint Effort, Risk)
│   ├── testing/                   # Kế hoạch kiểm thử, Báo cáo QA S1–S5, Test cases
│   └── operations/                # Sách hướng dẫn vận hành hạ tầng Staging & Runbook
├── postman/                       # Bộ kiểm thử tích hợp tự động API
│   ├── collections/               # Postman Collections (Admin, Booking, Auth)
│   └── environments/              # Postman Environments (Local, Staging Online)
├── scripts/                       # Bộ công cụ tự động hóa DevOps & QA
│   ├── dev/                       # Script đo độ trễ Measure-ReadLatency, launcher
│   └── test/                      # Script chạy test suite tổng hợp
├── docker-compose.yml             # Cấu hình Docker Compose triển khai cục bộ
├── LICENSE                        # Giấy phép bản quyền mã nguồn (MIT License)
└── README.md                      # Tài liệu tổng quan dự án (Tệp hiện tại)
```

---

## 7. 🧪 Kiểm thử Tự động & Đo kiểm Hiệu năng (Automated Testing & QA)

Dự án tuân thủ chiến lược kiểm thử nghiêm ngặt theo mô hình Kim tự tháp Kiểm thử (Test Pyramid):

### 1. Kiểm thử Đơn vị Backend (Unit Tests với Race Detector)
```bash
cd backend
go test -v -race ./...
```
* **Kết quả:** Vượt qua **209 tests và subtests** với cờ kiểm tra xung đột tài nguyên `-race`.

### 2. Kiểm thử Đơn vị Giao diện Frontend (Vitest)
```bash
cd frontend
npm test
```
* **Kết quả:** Vượt qua **39 unit tests** kiểm tra form validation, state flow và error handling.

### 3. Kiểm thử Tích hợp API (Newman / Postman Runner)
Chạy bộ kiểm thử tự động 24 requests liên hoàn kiểm tra toàn bộ luồng Auth -> Sân -> Availability -> Đặt sân -> Hủy sân -> Admin Blackout:
```bash
npx newman run postman/collections/SportBooking_Admin_Management_Collection.json \
  -e postman/environments/staging.postman_environment.json
```

### 4. Đo kiểm Độ trễ & Hiệu năng Đọc (NFR-07)
Chạy script PowerShell đo lường thời gian phản hồi thực tế của 30 yêu cầu tuần tự trên Staging:
```powershell
./scripts/dev/Measure-ReadLatency.ps1 -BaseUrl "https://sport-booking-api-staging.onrender.com/api/v1" -Requests 30
```
* **Tiêu chuẩn:** p95 ≤ 2000ms.
* **Thực tế:** p95 = 380ms (trạng thái warm server), tỷ lệ mẫu đạt chuẩn 96.67% ≥ 95%.

---

## 8. 🤝 Quy chuẩn Đóng góp (Contributing Guidelines)

Nhóm 9 áp dụng quy trình phát triển phần mềm chuẩn mực theo mô hình GitFlow và Agile/Scrum:

### 1. Quy ước Phân nhánh (Branching Strategy)
* `main`: Nhánh ổn định cao nhất, chỉ chứa mã nguồn đã nghiệm thu xuất xưởng.
* `staging`: Nhánh triển khai trực tuyến trên Vercel và Render phục vụ kiểm thử tích hợp.
* `develop`: Nhánh tích hợp chung của toàn đội dự án.
* Nhánh tính năng / sửa lỗi: Tuân theo quy tắc đặt tên tiền tố:
  * `feat/<feature-name>`: Phát triển tính năng mới (ví dụ: `feat/booking-idempotency`).
  * `fix/<bug-id>`: Sửa lỗi hệ thống (ví dụ: `fix/bug-01-spa-rewrite`).
  * `qa/<test-run>`: Kịch bản kiểm thử và đo kiểm hiệu năng (ví dụ: `qa/s5-performance-latency`).
  * `docs/<topic>`: Soạn thảo hoặc cập nhật hồ sơ tài liệu.

### 2. Quy ước Thông điệp Commit (Conventional Commits)
Thông điệp commit phải ngắn gọn, súc tích và tuân thủ định dạng:
```text
<type>(<scope>): <mô tả ngắn gọn bằng tiếng Anh hoặc tiếng Việt>
```
* `feat`: Bổ sung tính năng mới.
* `fix`: Sửa lỗi hệ thống.
* `test`: Bổ sung hoặc chỉnh sửa test cases.
* `refactor`: Tái cấu trúc mã nguồn mà không thay đổi hành vi nghiệp vụ.
* `docs`: Cập nhật tài liệu, README, báo cáo.
* `chore`: Cập nhật cấu hình build, dependencies.

### 3. Quy trình Đệ trình Pull Request (PR)
Mọi Pull Request khi tạo vào `develop` hoặc `staging` phải thỏa mãn:
1. Tiêu đề rõ ràng, mô tả mục đích thay đổi và dẫn liên kết thẻ Trello tương ứng.
2. Vượt qua 100% các bước kiểm tra tự động trên GitHub Actions (Lint + Unit Test + Race Detector).
3. Được **ít nhất 01 thành viên khác (Peer Reviewer)** phê duyệt (Approve) trước khi merge.
4. Đảm bảo Tiêu chuẩn Hoàn thành (Definition of Done - DoD): Không có compiler warning, không làm suy giảm độ bao phủ kiểm thử.

---

## 9. 📄 Giấy phép Sử dụng (License)

Dự án được phân phối theo các điều khoản của **[Giấy phép MIT](LICENSE)**. Bạn được tự do sử dụng, chỉnh sửa và phân phối mã nguồn này cho mục đích học tập và nghiên cứu.

---

## 10. 👥 Đội ngũ Thực hiện & Lời cảm ơn (Credits & Authors)

### Nhóm Thực hiện (Nhóm 9 — PTIT)

| Họ và tên | Vai trò trong Dự án | Trách nhiệm chính |
|---|---|---|
| **Hoàng Phú Huy** | **Project Manager / Backend Lead** | Quản lý tiến độ tổng thể, phân rã WBS, thiết kế kiến trúc Modular Monolith Go/Gin, thuật toán khóa tương tranh Booking, cơ chế Idempotency. |
| **Phạm Bảo Duy** | **Frontend Lead / UI Designer** | Thiết kế UI/UX hiện đại, xây dựng ứng dụng React 18 / Vite, tích hợp TanStack Query quản lý trạng thái, đồng bộ lịch đặt sân thời gian thực. |
| **Bảo Hưng Võ Nguyễn** | **DevOps / QA & QC Lead** | Thiết lập hạ tầng CI/CD GitHub Actions, giám sát triển khai đám mây (Render, Vercel, Neon), quản lý quy trình QA và trực tiếp thực thi kiểm thử QC (Automated, Concurrency, Load/Latency NFR-07, UAT). |

### Giảng viên Hướng dẫn & Tài liệu Căn cứ
* **Giảng viên hướng dẫn:** ThS. **Nguyễn Quỳnh Chi** — Khoa Công nghệ Thông tin, Học viện Công nghệ Bưu chính Viễn thông.
* **Tài liệu tham khảo chuyên môn:** Giáo trình *Quản lý Dự án Phần mềm* (Học viện Công nghệ Bưu chính Viễn thông, 2014).

---
*(Bản quyền © 2026 Nhóm 9 — Học viện Công nghệ Bưu chính Viễn thông. Mọi quyền được bảo lưu).*
