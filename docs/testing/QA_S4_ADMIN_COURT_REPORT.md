# QA S4 — Admin Court / Schedule / Blackout: báo cáo thực thi

Ngày chạy: **25/10/2026 (UTC+7)**. Người thực hiện: **Hưng**. Reviewer: **Huy (PM/Backend)**.
Thẻ: [[QA] Admin Court / Schedule / Blackout Test](https://trello.com/c/XdyFY9Gh) · WBS 1.4.1; UAT-08.
Công cụ: **Postman** — `postman/Admin-Court-Schedule-QA-Sprint4.postman_collection.json`.

> Chạy trên **staging online**, không phải local. Số liệu dưới đây là quan sát thật từ API staging.

## Môi trường và phạm vi

| Hạng mục | Giá trị |
|---|---|
| Frontend | https://sport-booking-system-ochre.vercel.app |
| Backend | https://sport-booking-api-staging.onrender.com/api/v1 |
| Database | Neon branch `staging`, region `ap-southeast-1` |
| Schema | Goose **11** |
| Commit backend đang chạy | `bd2ea63` (branch `develop`) |
| Tài khoản test | `qa-s4-admin@example.test` (ADMIN), `qa-s4-user@example.test` (USER) |
| Phạm vi | API admin court / sport type / operating hours / blackout, ảnh hưởng lên availability và bảo vệ booking đã xác nhận. **Không gồm** kiểm thử UI (thao tác trên trình duyệt) |

## Cách chạy

```text
Postman → Import → postman/Admin-Court-Schedule-QA-Sprint4.postman_collection.json
        → chọn collection → Run (Collection Runner)
```

Collection có **6 folder, 24 request**, mỗi request kèm test tự động. Phải chạy theo thứ tự: folder sau dùng token và `courtId` do folder trước tạo.

| Folder | Nội dung |
|---|---|
| 0. Setup | Đăng ký user, login USER, login ADMIN (tự lưu token vào biến) |
| 1. Role & Auth | USER gọi admin, không token, ADMIN hợp lệ |
| 2. SportType & Court CRUD | Tạo, validation, trùng code, PATCH, xoá sport type còn sân |
| 3. Schedule & Blackout | PUT operating-hours cả tuần, sai format giờ, tạo/patch/xoá blackout |
| 4. Availability phản ánh thay đổi | Slot 10:00 bị chặn khi có blackout và trả lại khi bỏ |
| 5. Confirmed booking không bị xoá | Đặt sân → xoá mềm sân → booking vẫn còn |

## Kết quả theo 4 mục checklist

| # | Mục | Kết quả | Bằng chứng |
|---|---|---|---|
| 1 | CRUD / role / validation | **PASS** | USER → 403 `forbidden`; không token → 401; thiếu `name` → 400 `validation_error`; trùng `code` → 409; xoá sport type còn sân active → 409 `conflict` |
| 2 | Schedule / blackout | **PASS** | PUT operating-hours → 200, sinh **98** mẫu slot tuần (14 slot/ngày × 7 ngày) cho khung 08:00–22:00; `opensAt` sai format (`8:00`) → 400 `validation_error`; tạo blackout → 201; PATCH → 200; xoá mềm → 204 |
| 3 | Availability phản ánh thay đổi | **PASS** | Trước blackout slot 10:00 `available=true`; sau blackout `available=false`; bỏ blackout `available=true` |
| 4 | Confirmed booking không bị xoá | **PASS** | Tạo booking → 201 `CONFIRMED`; xoá mềm court → 204; đọc lại booking → 200 `CONFIRMED`; đặt mới trên sân inactive → 422 `booking_rule_violation` |

Toàn bộ 24 request trong collection pass.

## Bug đã ghi nhận

**Không phát hiện lỗi sản phẩm** trong phạm vi kiểm chứng. Không có card mới trong list `Bugs` cho thẻ này.

Một sai lệch **không phải bug**, ghi lại để tránh hiểu nhầm khi viết test:

> `PUT`/`GET /admin/courts/{courtId}/operating-hours` trả danh sách mẫu slot ở trường **`data.timeSlots`**, không phải `data.slots`. `GET /courts/{courtId}/availability` thì trả `data.slots`. Hai endpoint dùng tên khác nhau.

## Ghi chú kỹ thuật

- **Xoá là xoá mềm.** `DELETE /admin/courts/{id}`, `DELETE /admin/sport-types/{id}`, `DELETE /admin/courts/{id}/blackouts/{id}` đều đặt `isActive=false` và trả **204**. Gọi lại trên bản đã ngừng vẫn trả 204. Booking đã xác nhận và lịch sử được giữ nguyên — đây chính là hành vi mà mục 4 kiểm chứng.
- **`weekday` theo ISO**, 1 = thứ Hai … 7 = Chủ Nhật. `opensAt`/`closesAt` bắt buộc đúng `HH:mm:ss`; thiếu giây bị từ chối.
- **Múi giờ:** 08:00 giờ VN = `01:00Z`, 10:00 giờ VN = `03:00Z`. Các test lọc slot theo giờ UTC nên phụ thuộc quy ước này.
- **`APP_ENV` không có giá trị `staging`** — backend staging chạy bằng `production`, nên gin ở ReleaseMode.

## Giới hạn kiểm chứng

1. **Chỉ mức API.** Chưa kiểm thử UI admin trên trình duyệt (form nhập, thông báo lỗi, phân trang). Nếu cần thì bổ sung ở S5 regression.
2. **Chưa có fixture có version.** Staging đang dùng snapshot dev thừa hưởng từ lúc tạo branch; dữ liệu QA do collection tạo thêm sẽ còn lại trên staging cho tới lần reset trước S5.
3. **Render Free ngủ sau ~15 phút.** Request đầu tiên trong một lượt chạy có thể chậm ~50 giây; không phải lỗi API.
4. **Collection dùng tài khoản USER cố định nên không chạy lặp vô hạn được.** Hệ thống giới hạn **3 booking active/user**; sau 3 lượt chạy, folder 5 sẽ nhận 422 `booking_rule_violation` — đúng luật nghiệp vụ, không phải lỗi. Trước khi chạy lại: huỷ booking cũ của `qa-s4-user@example.test`, hoặc đổi `userEmail` sang account mới. Bản chạy regression ngày 26/10 dùng user sinh riêng cho từng lượt nên không gặp vấn đề này.

## Đối chiếu checklist thẻ

| Mục | Trạng thái |
|---|---|
| CRUD/role/validation | PASS — tick được |
| Schedule/blackout | PASS — tick được |
| Availability phản ánh thay đổi | PASS — tick được |
| Confirmed booking không bị xóa + evidence | PASS — tick được |
| Online 1: staging + BE/FE deploy trước QA | Đã có (staging live, admin FE merge 24/10) |
| Online 2: test CRUD/role/validation, schedule/blackout, booking không bị xoá | PASS |
| Online 3: ghi report/issue/commit/schema, Huy review | Report này + commit `3e221ae`; **Huy review chưa thực hiện** |
