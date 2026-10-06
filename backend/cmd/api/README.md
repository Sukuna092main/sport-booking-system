# Điểm khởi chạy API

`main.go` nạp và kiểm tra cấu hình môi trường, tạo logger và router qua `bootstrap`, rồi chạy `net/http` với các thời hạn chờ và cơ chế tắt có kiểm soát. Không đặt nghiệp vụ trong gói này. Task PostgreSQL sẽ bổ sung kết nối cơ sở dữ liệu theo ERD đã chốt.
