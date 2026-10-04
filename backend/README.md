# Backend — Modular Monolith

Stack đã ghi tại thẻ Architecture: Go + Gin + GORM + PostgreSQL; schema version-control bằng Goose. SDP Final khóa module/boundary, không khóa version framework. Chưa chọn version dependency trong scaffold này.

- `cmd/api/`: entry point, chỉ startup/shutdown.
- `internal/bootstrap/`: dependency injection thủ công và đăng ký route `/api/v1`.
- `internal/<Module>/`: một feature boundary. Dự kiến có `handler.go`, `service.go`, `repository.go`, `model.go`, `dto.go` và tests khi triển khai; đây không phải file đã tồn tại.
- `internal/platform/`: hạ tầng dùng chung, không đặt business rules Booking tại đây.
- `migrations/`: migration đã review; không tạo schema giả chỉ để lấp khung.

Handler parse/validate request và trả response. Service kiểm tra business rules/quyền, điều phối transaction. Repository thực hiện persistence/query/locking.
Booking và BookingSlot phải dùng cùng transaction; không để mỗi repository tự commit riêng.
Availability dùng dữ liệu/read contract nền tảng, không phụ thuộc vòng vào Booking Eligibility service.
Admin gom route/permission, tái sử dụng service nghiệp vụ; không sao chép cùng logic sang hai module.

Unit/service tests đặt cạnh code với tên `*_test.go`; integration/concurrency evidence xem [QA](../tests/README.md).
