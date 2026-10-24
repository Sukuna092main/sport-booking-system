# Admin Bookings Management

Phần tính năng Quản lý Đặt sân cho Quản trị viên (Admin Booking Management UI) theo chuẩn hợp đồng OpenAPI 0.5.0 và tài liệu đặc tả SRS FR-17, BR-14.

## Cấu trúc module

- `adminBookingUtils.ts`: Domain logic, kiểm tra điều kiện hủy (BR-14 / FR-17), validation lý do hủy (1-500 ký tự), format ngày giờ slot và parse lỗi API.
- `useAdminBookings.ts`: React Query hooks (`useAdminBookings`, `useAdminBookingDetail`, `useAdminCancelBooking`, `useAdminStatistics`) cùng cơ chế invalidate cache khi action thành công.
- `AdminBookingFilters.tsx`: Bộ lọc quản trị theo Sân (Court), Ngày (Date), Trạng thái (Status: ALL / CONFIRMED / CANCELLED) và tìm kiếm nhanh.
- `AdminBookingTable.tsx`: Bảng danh sách booking với đầy đủ thông tin mã booking, customer ID, court, time slots, trạng thái và action hợp lệ.
- `AdminBookingDetailView.tsx`: Giao diện chi tiết booking cho quản trị viên, chi tiết các slot và chính sách kiểm toán.
- `AdminCancelBookingModal.tsx`: Dialog xác nhận thao tác hủy booking có nhập lý do kiểm toán (Audit Reason) trước khi gửi yêu cầu tới API.
- `adminBookings.test.ts`: Bộ kiểm thử tự động toàn diện kiểm chứng form validation, luật nghiệp vụ hủy, mapping API client, negative cases và phân quyền role ADMIN.
