# config

`config.go` nạp và kiểm tra biến môi trường của tiến trình, gồm `APP_TIMEZONE` bắt buộc. Giá trị mẫu nằm trong `backend/.env.example`; ứng dụng không tự đọc file `.env`. Không hard-code bí mật hoặc commit file `.env` chứa giá trị thật.
