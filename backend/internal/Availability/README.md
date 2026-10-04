# Availability

**Truy vết:** FR-06; WBS 1.3.2.3.

Read availability theo court/date: loại inactive court, ngoài giờ, past, blackout và slot đang bị active booking chiếm. Dùng read data/contract; không gọi Booking Eligibility để tính availability, tránh vòng phụ thuộc.

Khi triển khai: chia trách nhiệm handler/service/repository/model/DTO theo design đã review, đặt unit tests cạnh code. Chưa có implementation trong scaffold này.
