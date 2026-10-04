# Module nghiệp vụ

Các thư mục module giữ nguyên cách viết tên bạn đang dùng. HTTP → Handler → Service → Repository → PostgreSQL.

`Availability`, `Audit` và `Admin/statistics` bổ sung các boundary bắt buộc còn thiếu. `Notification` được giữ nhưng là Optional, không phải điều kiện nghiệm thu MVP. Shared infrastructure ở `platform`; wiring ở `bootstrap`.

Không thêm endpoint CRUD độc lập cho BookingSlot chỉ vì có thư mục/entity. Ranh giới API/schema chi tiết cần design review trước khi viết code.
