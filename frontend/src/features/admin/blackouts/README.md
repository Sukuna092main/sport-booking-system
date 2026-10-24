# blackouts

Quản lý lịch chặn sân (Court Blackouts) theo đặc tả FR-16 và OpenAPI 0.5.0:
- CRUD Blackout cho từng sân: danh sách, tạo mới, chỉnh sửa, tắt (xóa mềm).
- Validation thời gian bắt đầu < kết thúc (`startsAt < endsAt`), định dạng ISO UTC và kiểm tra lỗi range.
- Phát hiện và cảnh báo overlap (giao nhau) với các blackout đang hoạt động khác của sân.
- Không tự xóa booking đã xác nhận: đảm bảo tính bất biến, không hủy các booking `CONFIRMED`.
- Tự động làm mới cache Availability khi tạo/sửa/tắt blackout.
- Đầy đủ unit và integration test suite.
