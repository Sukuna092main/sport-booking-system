# Frontend — feature-based

Stack ở thẻ Architecture: React + TypeScript + Vite, Tailwind + shadcn/ui, React Router, TanStack Query, Axios. Scaffold không tự chọn version hoặc cài dependency.

- `src/app/`: route composition và providers.
- `src/features/`: UI/API hooks/validation/types theo feature; có thể đặt components/api/hooks/types bên trong khi triển khai.
- `src/components/`: UI, layout và feedback tái sử dụng; không đặt toàn bộ feature tại đây.
- `src/lib/`: API client, auth utilities, query setup và utilities chung.
- `src/types/`: kiểu dùng chung; feature-specific types giữ tại feature.
- Unit/component tests colocated với code; integration/E2E ở `tests/`.

Chỉ mock sau khi UI/API contract được Huy review. Loading/error/empty/success/conflict states phải thiết kế rõ; tích hợp hoàn tất phải dùng API thật.
Route guard không thay thế authorization/ownership phía backend. Không hard-code secret trong frontend.
Chưa có `package.json`, entry point hay UI implementation; chưa thể chạy npm dev/build.
