# Booking

**Truy vết:** FR-08..14; WBS 1.3.3.1–1.3.3.7.

Eligibility, chọn slot liên tiếp cùng court/ngày, atomic create, concurrency, server idempotency, own history/detail và cancel trước start. Baseline: horizon ≤30 ngày, ≤3 active bookings/user, slot 60 phút và min/max 1..4 theo cấu hình. Không có payment/deposit hay fee hủy trong MVP.

Khi triển khai: chia trách nhiệm handler/service/repository/model/DTO theo design đã review, đặt unit tests cạnh code. Chưa có implementation trong scaffold này.
