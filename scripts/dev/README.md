# Chạy backend trên máy với Neon

Chuẩn bị Go và `backend/.env` với connection string Neon/TLS. Dừng backend Docker đang giữ cổng 8080 trước khi chạy.

Từ root repo, trong PowerShell:

```powershell
& .\scripts\dev\Start-BackendNeon.ps1
```

Script nạp cấu hình ứng dụng từ `backend/.env`, xác nhận đích Neon/TLS và chạy `go run ./cmd/api`. Nếu JWT_SECRET trống trong development, script tạo secret ngẫu nhiên chỉ trong phiên chạy; token cũ mất hiệu lực khi khởi động lại, cần đăng nhập lại. Nếu đã cấu hình JWT_SECRET, script giữ giá trị đó. Secret không được in ra hoặc ghi vào source.

Giữ Terminal mở; Ctrl+C để dừng. API mặc định: `http://localhost:8080/api/v1`. Không cần Docker cho chế độ chạy này. Script không chạy migration, seed hay reset database; các việc đó được thực hiện riêng trên đúng môi trường đã xác nhận.

`backend/.env` chứa credential, không commit hoặc gửi lên chat.
