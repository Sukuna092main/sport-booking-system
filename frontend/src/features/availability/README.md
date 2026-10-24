# Availability — Sprint 2

`presentation.ts` chuyển UTC snapshot sang `data.timeZone`, tạo lịch gồm hôm nay đến +30 ngày và kiểm tra lựa chọn từ response mới nhất. Trước response đầu, múi giờ sân MVP mặc định là Asia/Ho_Chi_Minh.

Slot `available=false` tương lai hiển thị **Không khả dụng**; API chưa cung cấp nguyên nhân booked/blackout riêng. Slot quá khứ không được chọn. Refetch mỗi 30 giây trên tab hoạt động; error có retry và không hiện empty thành công. Selection được đối chiếu lại với court/date/slot hiện hành. S2 chỉ chọn một slot; submit/multi-slot là luồng S3.

Unit tests: `presentation.test.ts`. Báo cáo: [Sprint 2 Integration](../../../../docs/testing/SPRINT2_INTEGRATION_REVIEW.md). Raw browser/API evidence local riêng: `artifacts/sprint2-huy-20261016/`.
