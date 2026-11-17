# Sport Booking System — Frontend

React/Vite client cho Sport Booking System. Khi chạy bằng Compose, frontend dùng `VITE_API_BASE_URL` từ `.env` gốc ở thời điểm build; mặc định là `http://localhost:8080/api/v1`.

## Chạy riêng frontend

```powershell
$env:VITE_API_BASE_URL = "http://localhost:8080/api/v1"
npm ci
npm run dev
```

Đừng đặt credential backend vào biến `VITE_*`: Vite nhúng biến loại này vào JavaScript tải xuống trình duyệt. Access token chỉ nằm trong bộ nhớ tab; refresh token do API giữ trong cookie HttpOnly. Auth refresh, reset/change password, booking, đặt cọc/mock checkout và trạng thái giao dịch gọi API thật. Email reset/booking do backend worker gửi, không gửi credential SMTP từ frontend.

## Tech Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- React Router
- TanStack Query
- Axios
- Vitest

## Architecture

The frontend follows a feature-based structure:

```text
src/
├── app/
│   ├── pages/
│   ├── providers/
│   └── router/
├── components/
│   ├── feedback/
│   ├── layout/
│   └── ui/
├── features/
│   ├── admin/
│   ├── auth/
│   ├── availability/
│   ├── bookings/
│   ├── courts/
│   └── profile/
├── lib/
│   ├── api/
│   ├── auth/
│   ├── query/
│   └── utils/
├── styles/
└── types/
