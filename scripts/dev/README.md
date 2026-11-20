# Chạy backend trên máy với Neon

Chuẩn bị Go và `.env` ở thư mục gốc với connection string Neon/TLS do chủ DB cấp quyền. Có thể tạo file từ `../.env.example`; không commit `.env`. Dừng backend Docker đang giữ cổng 8080 trước khi chạy.

Từ root repo, trong PowerShell:

```powershell
& .\scripts\dev\Start-BackendNeon.ps1
```

Script nạp các biến backend trong allowlist từ `.env`, xác nhận đích Neon/TLS và chạy `go run ./cmd/api`. Secret không được in ra hoặc ghi vào source.

Giữ Terminal mở; Ctrl+C để dừng. API mặc định: `http://localhost:8080/api/v1`. Không cần Docker cho chế độ chạy này. Script không chạy migration, seed hay reset database; các việc đó được thực hiện riêng trên đúng môi trường đã xác nhận.

`.env` chứa credential, không commit hoặc gửi lên chat. Người nhận repository cần dùng tài khoản DB được cấp riêng; không dùng credential của bạn trừ khi chủ sở hữu DB chủ động cấp quyền.
