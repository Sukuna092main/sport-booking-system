# Auth API Test Cases

- Trạng thái: Các scenario Auth/Profile có test Go tự động; xem báo cáo review 6 task. Bộ request Postman chưa chạy riêng.
- Nguồn: `backend/internal/platform/openapi/openapi.yaml`
- Register/Login/Profile đã triển khai. Guard USER/ADMIN được kiểm chứng trong test middleware; `/admin/courts` còn planned nên chưa dùng các request Admin trong bảng làm smoke endpoint thật.

| ID | Scenario | Request / dữ liệu | Expected | Actual | Kết quả |
|---|---|---|---|---|---|
| AUTH-REG-001 | Đăng ký hợp lệ | Email mới, password từ 8 ký tự, fullName hợp lệ | 201; trả thông tin user, không tự đăng nhập | Chưa chạy | Chưa chạy |
| AUTH-REG-002 | Đăng ký thiếu email | Thiếu trường `email` | 400 | Chưa chạy | Chưa chạy |
| AUTH-REG-003 | Email sai định dạng | `email: "khong-phai-email"`; các trường khác hợp lệ | 400 | Chưa chạy | Chưa chạy |
| AUTH-REG-004 | Mật khẩu ngắn hơn 8 ký tự | `password: "abc123"`; các trường khác hợp lệ | 400 | Chưa chạy | Chưa chạy |
| AUTH-REG-005 | Thiếu họ tên | Không gửi `fullName` | 400 | Chưa chạy | Chưa chạy |
| AUTH-REG-006 | Đăng ký email đã tồn tại | Gửi cùng email hợp lệ hai lần; lần đầu tạo tài khoản | Lần đầu 201, lần hai 409 | Chưa chạy | Chưa chạy |
| AUTH-LOGIN-001 | Đăng nhập hợp lệ | Tài khoản active đã tồn tại; email/password đúng | 200; `data` có `accessToken`, `tokenType: Bearer`, `expiresAt`, `user` | Chưa chạy | Chưa chạy |
| AUTH-LOGIN-002 | Sai mật khẩu | Email của tài khoản có thật, password sai | 401 | Chưa chạy | Chưa chạy |
| AUTH-LOGIN-003 | Email chưa đăng ký | Email hợp lệ nhưng không có tài khoản | 401; không tiết lộ email có đăng ký hay không | Chưa chạy | Chưa chạy |
| AUTH-LOGIN-004 | Thiếu password hoặc email sai định dạng | Thiếu `password` hoặc gửi email không hợp lệ | 400 | Chưa chạy | Chưa chạy |
| AUTH-LOGIN-005 | Tài khoản không hoạt động | Đăng nhập bằng tài khoản inactive, nếu nhóm thống nhất hỗ trợ trạng thái này | 403; contract ghi `account_inactive` | Chưa chạy | Chưa chạy |
| AUTH-TOKEN-001 | Gọi hồ sơ khi chưa đăng nhập | `GET /users/me`, không gửi Authorization | 401; `error.code` là `unauthorized` | Chưa chạy | Chưa chạy |
| AUTH-TOKEN-002 | Gọi hồ sơ với token không hợp lệ | `GET /users/me`, gửi `Authorization: Bearer abc` | 401 | Chưa chạy | Chưa chạy |
| AUTH-TOKEN-003 | USER gọi API dành cho ADMIN | `GET /admin/courts` với token USER hợp lệ | 403; `error.code` là `forbidden` | Chưa chạy | Chưa chạy |
| AUTH-ROLE-001 | ADMIN gọi API quản trị | `GET /admin/courts` với token ADMIN hợp lệ | 200 | Chưa chạy | Chưa chạy |
| AUTH-ROLE-002 | Người dùng lấy hồ sơ của chính mình | `GET /users/me` với token USER hợp lệ | 200; user trả về khớp tài khoản đã đăng nhập | Chưa chạy | Chưa chạy |
