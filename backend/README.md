# Backend — Modular Monolith

Go 1.25+ và Gin 1.12 tạo nền tảng HTTP. Backend là Modular Monolith với luồng Handler → Service → Repository, các gói hạ tầng dùng chung và khởi tạo phụ thuộc thủ công.

## Chạy cục bộ

Đứng trong thư mục `backend/`, đặt biến môi trường theo `.env.example` rồi chạy:

```powershell
$env:APP_ENV = "development"
$env:APP_TIMEZONE = "UTC"
$env:HTTP_ADDR = ":8080"
go run ./cmd/api
```

`GET http://localhost:8080/api/v1/ping` trả `message: pong`, tên dịch vụ và môi trường. Ứng dụng đọc biến môi trường trực tiếp, không tự nạp file `.env`. `APP_TIMEZONE` là bắt buộc; giá trị `UTC` ở ví dụ chỉ dành cho bước chạy thử này. Trước khi triển khai nghiệp vụ đặt sân, phải đặt múi giờ IANA thực tế của địa điểm theo ERD v1.0 đã chốt.

Swagger ở `GET http://localhost:8080/api/v1/docs`; OpenAPI YAML ở `GET http://localhost:8080/api/v1/openapi.yaml`. Xem [trạng thái contract](../docs/design/api/README.md) trước khi dùng: các endpoint nghiệp vụ đang là thiết kế để review, chưa được triển khai. Giao diện Swagger tải tài nguyên từ CDN.

## Cấu trúc

- `cmd/api/`: khởi động HTTP server và tắt server có kiểm soát.
- `internal/bootstrap/`: nối phụ thuộc thủ công và đăng ký route `/api/v1`.
- `internal/<Module>/`: ranh giới nghiệp vụ theo luồng Handler → Service → Repository.
- `internal/platform/`: cấu hình, logging, middleware, response và hạ tầng dùng chung; không đặt quy tắc Booking tại đây.
- `migrations/`: chỉ chứa Goose migrations đã được review; task khởi tạo này chưa tạo schema.

Module `Health` là ví dụ nhỏ cho luồng ba lớp của route Ping. Repository của nó đọc thông tin ứng dụng từ cấu hình, không truy vấn cơ sở dữ liệu. Repository nghiệp vụ và kết nối PostgreSQL/GORM thuộc các task riêng.

Booking và BookingSlot phải dùng chung giao dịch do Booking service điều phối; repository không tự commit riêng. Availability đọc dữ liệu sân, lịch, lịch chặn và lượt đặt mà không tạo phụ thuộc vòng. Admin dùng lại service nghiệp vụ, không sao chép quy tắc. Notification là phần tùy chọn của MVP.
