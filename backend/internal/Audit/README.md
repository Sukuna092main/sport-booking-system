# Audit

**Truy vết:** FR-19; NFR-09; WBS 1.3.6.1.

Ghi audit cho thay đổi Admin và sự kiện Booking quan trọng: actor/action/target/time/result. Bảo toàn lịch sử, hạn chế truy cập và không log password/JWT/secret. Phân biệt audit nghiệp vụ với application logger.

Khi triển khai: chia trách nhiệm handler/service/repository/model/DTO theo design đã review, đặt unit tests cạnh code. Chưa có implementation trong scaffold này.
