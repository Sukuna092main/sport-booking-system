# Module nghiệp vụ

Các module nghiệp vụ theo luồng HTTP → Handler → Service → Repository. `bootstrap` nối phụ thuộc, còn `platform` chứa hạ tầng dùng chung; hai gói này không sở hữu quy tắc nghiệp vụ.

`Availability`, `Audit` và `Admin/statistics` là các ranh giới cần có. `Notification` vẫn là phần tùy chọn của MVP. Không tạo API CRUD cho BookingSlot chỉ vì có thư mục hoặc thực thể tương ứng. Model, lưu trữ và API Booking sẽ theo contract và schema đã được review. `Health` minh họa cách nối ba lớp mà không tạo schema nghiệp vụ ngoài phạm vi.
