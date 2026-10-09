# Auth API Test Cases

- Trạng thái: Đã smoke trực tiếp 10 scenario Auth/Profile trên Docker local ngày 09/10/2026; test Go cho package Auth và bootstrap cũng pass. Các scenario còn lại giữ nguyên `Chưa chạy`.
- Nguồn: `backend/internal/platform/openapi/openapi.yaml`
- Register/Login/Profile đã triển khai. Guard USER/ADMIN được kiểm chứng trong test middleware; `/admin/courts` còn planned nên chưa dùng các request Admin trong bảng làm smoke endpoint thật.
- Môi trường: `http://localhost:8080/api/v1`, PostgreSQL local trong Docker Compose; dùng tài khoản QA tổng hợp, không truy cập Neon/production. Backend được build lại từ source hiện tại trước khi chạy. Không lưu token hoặc mật khẩu trong bằng chứng.

| ID | Scenario | Request / dữ liệu | Expected | Actual | Kết quả |
|---|---|---|---|---|---|
| AUTH-REG-001 | Đăng ký hợp lệ | Email mới, password từ 8 ký tự, fullName hợp lệ | 201; trả thông tin user, không tự đăng nhập | 201; role `USER`, không có access token | Pass |
| AUTH-REG-002 | Đăng ký thiếu email | Thiếu trường `email` | 400 | Chưa chạy | Chưa chạy |
| AUTH-REG-003 | Email sai định dạng | `email: "khong-phai-email"`; các trường khác hợp lệ | 400 | 400 | Pass |
| AUTH-REG-004 | Mật khẩu ngắn hơn 8 ký tự | `password: "abc123"`; các trường khác hợp lệ | 400 | 400 | Pass |
| AUTH-REG-005 | Thiếu họ tên | Không gửi `fullName` | 400 | Chưa chạy | Chưa chạy |
| AUTH-REG-006 | Đăng ký email đã tồn tại | Gửi cùng email hợp lệ hai lần; lần đầu tạo tài khoản | Lần đầu 201, lần hai 409 | 201 rồi 409 | Pass |
| AUTH-LOGIN-001 | Đăng nhập hợp lệ | Tài khoản active đã tồn tại; email/password đúng | 200; `data` có `accessToken`, `tokenType: Bearer`, `expiresAt`, `user` | 200; có Bearer token và user khớp | Pass |
| AUTH-LOGIN-002 | Sai mật khẩu | Email của tài khoản có thật, password sai | 401 | 401 | Pass |
| AUTH-LOGIN-003 | Email chưa đăng ký | Email hợp lệ nhưng không có tài khoản | 401; không tiết lộ email có đăng ký hay không | 401 | Pass |
| AUTH-LOGIN-004 | Thiếu password hoặc email sai định dạng | Thiếu `password` hoặc gửi email không hợp lệ | 400 | Chưa chạy | Chưa chạy |
| AUTH-LOGIN-005 | Tài khoản không hoạt động | Đăng nhập bằng tài khoản inactive, nếu nhóm thống nhất hỗ trợ trạng thái này | 403; contract ghi `account_inactive` | Chưa chạy | Chưa chạy |
| AUTH-TOKEN-001 | Gọi hồ sơ khi chưa đăng nhập | `GET /users/me`, không gửi Authorization | 401; `error.code` là `unauthorized` | 401 | Pass |
| AUTH-TOKEN-002 | Gọi hồ sơ với token không hợp lệ | `GET /users/me`, gửi `Authorization: Bearer abc` | 401 | 401 | Pass |
| AUTH-TOKEN-003 | USER gọi API dành cho ADMIN | `GET /admin/courts` với token USER hợp lệ | 403; `error.code` là `forbidden` | Chưa chạy | Chưa chạy |
| AUTH-ROLE-001 | ADMIN gọi API quản trị | `GET /admin/courts` với token ADMIN hợp lệ | 200 | Chưa chạy | Chưa chạy |
| AUTH-ROLE-002 | Người dùng lấy hồ sơ của chính mình | `GET /users/me` với token USER hợp lệ | 200; user trả về khớp tài khoản đã đăng nhập | 200; email khớp tài khoản đã đăng nhập | Pass |

## Test bổ sung

- Go: `go test -count=1 ./internal/Auth ./internal/bootstrap` — Pass. Các test database cần `TEST_DATABASE_URL` không thuộc lần chạy này. `-race` chưa chạy được trong container Alpine vì cần CGO.
- Frontend: `npm test -- --run` — Pass, 1 test file / 1 test.
- Chưa kiểm thử trực tiếp USER/ADMIN qua endpoint quản trị: `/admin/courts` chưa được đăng ký; guard role được bao phủ bởi `TestAuthorization` trong package Auth.
- Lần smoke ban đầu trước khi build lại backend nhận 404 do image cũ chỉ đăng ký `/ping` và OpenAPI. Sau khi build lại từ source, 10/10 scenario ở trên pass.
