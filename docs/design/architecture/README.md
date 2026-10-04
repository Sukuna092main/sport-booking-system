# Ranh giới kiến trúc & truy vết cấu trúc

Backend giữ Modular Monolith, với layering HTTP → Handler → Service → Repository → PostgreSQL.
Frontend tổ chức theo feature; mock chỉ sau contract review. Các README trong module mô tả khung, không là design/API approval hoặc implementation.

| Boundary SDP | Thư mục backend | Thư mục frontend | Truy vết |
| --- | --- | --- | --- |
| Identity | Auth, User | auth, profile | FR-01..03; WBS 1.3.1 |
| Court Discovery | SportType, Court, Availability; read data TimeSlot/CourtBlackout | courts, availability | FR-04..07; WBS 1.3.2 |
| Booking | Booking, BookingSlot | bookings, availability | FR-08..14; WBS 1.3.3 |
| Administration | Admin, Admin/statistics; mutations qua SportType/Court/TimeSlot/CourtBlackout/Booking | admin/courts, schedule, blackouts, bookings, statistics | FR-15..18; WBS 1.3.4–1.3.5 |
| Audit & Operations | Audit, platform, migrations | Consumer theo API được review; không tự tạo Audit UI bắt buộc | FR-19; NFR; WBS 1.3.6,1.5 |
| Optional | Notification giữ từ khung có sẵn, chưa bật | Không scaffold thành feature MVP | FR-20/21; WBS 1.3.7 |

## Ranh giới quan trọng

- Availability tính từ court/schedule/blackout/existing-booking read data; không phụ thuộc vòng vào Booking Eligibility.
- Booking service sở hữu transaction; BookingSlot dùng transaction đó. Anti-double-booking và server idempotency không thể thay bằng UI double-submit guard.
- Admin tái sử dụng nghiệp vụ domain; không copy cùng logic qua service Admin thứ hai. Statistics aggregate thuộc Admin/statistics.
- Audit lưu business events, khác application logger; bảo toàn lịch sử và không lộ secrets.
- Notification giữ Optional. Không bổ sung payment/deposit, reschedule, no-show hoặc AI vào khung MVP.
- Unit tests cạnh source; API/system validation ở tests; actual results ở artifacts (không commit mặc định).

SDP/SPMP không khóa version/framework; stack cụ thể tham chiếu thẻ Architecture. Những quyết định schema/API/token storage/version chưa review vẫn để mở. Việc thêm thư mục không xác nhận task thiết kế/triển khai đã Done.
