# logger

`logger.go` tạo logger JSON dùng chung bằng `slog`. Log request ghi request ID, phương thức, đường dẫn, trạng thái, thời gian xử lý và IP phía khách; không ghi body hoặc bí mật. Sự kiện kiểm toán nghiệp vụ thuộc module Audit.
