# Audit

**Truy vết:** FR-19; NFR-09; WBS 1.3.6.1.

Ghi audit cho thay đổi Admin và sự kiện Booking quan trọng: actor/action/target/time/result. Bảo toàn lịch sử, hạn chế truy cập và không log password/JWT/secret. Phân biệt audit nghiệp vụ với application logger.

Audit writer được gọi trong transaction của Booking và các module Admin inventory/schedule. Các event ghi actor từ context, action, target, request ID, timestamp và details được chọn từ DTO nghiệp vụ. Lỗi ghi audit rollback thay đổi. Không có endpoint sửa/xóa hoặc đọc audit công khai; kiểm chứng qua DB test riêng. Replay tạo booking không ghi thêm event thành công.
