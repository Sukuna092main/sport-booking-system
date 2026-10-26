# QA S5 — Performance & Usability Report

| Thuộc tính | Nội dung |
|---|---|
| Thẻ | [#99 [QA] Performance & Usability Validation](https://trello.com/c/3WhdY7GD) |
| WBS / REQ | 1.4.5; NFR-07, NFR-08 |
| Người thực hiện | Hưng (DevOps/QA) |
| Reviewer | Huy (PM/Backend) |
| Ngày | 26/10/2026 (UTC+7) |
| Trạng thái | **Warm đã đo — Cold chưa đo.** Không kết luận đạt NFR cho tới khi có số cold |

> **NFR-07 là technical proposal, không phải cam kết khách hàng.** Số liệu trong tài liệu này không phải SLA và không được dùng để tuyên bố đáp ứng NFR cho toàn hệ thống khi mới có một nửa điều kiện.

## 1. Tiêu chí đo (NFR-07)

Trích SRS-SB-001 §11:

> **NFR-07:** ≥ **95%** read request bình thường **≤ 2 giây**, khi tải trong "profile đã thống nhất".
> Verification: performance test; *"technical proposal, not a customer commitment in REQ-SB-001"*.

SRS **không** đặt ngưỡng cho concurrent users, uptime, hay write-path latency. Vì vậy "agreed profile" do nhóm định nghĩa ở §2 và cần Huy review.

**NFR-08** (usability) chỉ định tính: luồng chính rõ ràng; 4 trạng thái slot — available / unavailable / blackout / past — phải phân biệt được trên UI. Không có ngưỡng số.

## 2. Load profile đề xuất (cần Huy review)

| Tham số | Giá trị | Lý do |
|---|---|---|
| Endpoint | `GET /courts`, `GET /courts/{id}`, `GET /courts/{id}/availability` | Đây là các "read request bình thường" theo NFR-07; không gồm write path vì SRS không đặt ngưỡng |
| Warm — throughput | 300 request, concurrency 10 | Mô phỏng nhiều người dùng cùng lúc |
| Warm — tuần tự | 30 request, concurrency 1 | Baseline so sánh trực tiếp với cold |
| Cold | 30 request, concurrency 1 | Request #1 là cold, #2–30 là warm; tách bạch rõ |
| Chỉ số | p50/p90/p95/p99, min/max, error rate, % request ≤ 2000ms | Theo đúng câu chữ NFR-07 |
| Môi trường | Staging (Render Free + Neon Free), Singapore | Không phải local |

**Nguyên tắc bắt buộc:** warm và cold phải đo **cùng concurrency** mới so sánh được. Concurrency 10 làm latency tăng do tranh chấp, không phải do cold — lần đầu mình so sai chính vì điều này (§4.3).

## 3. Môi trường

| Hạng mục | Giá trị |
|---|---|
| API | https://sport-booking-api-staging.onrender.com/api/v1 |
| Frontend | https://sport-booking-system-ochre.vercel.app |
| Backend | Render Free, Singapore, 1 instance |
| Database | Neon branch `staging`, region `ap-southeast-1` |
| Commit `develop` | `3bd4a66` |
| Công cụ | `scripts/dev/Measure-ReadLatency.ps1` |

## 4. Kết quả

### 4.1. Warm — throughput (300 request, concurrency 10)

Chạy 15:55, 26/10.

| Chỉ số | Giá trị |
|---|---|
| Errors | 0 (0%) |
| min / mean | 251 ms / 306 ms |
| p50 / p90 | 287 ms / 357 ms |
| **p95** | **380 ms** |
| p99 / max | 510 ms / 510 ms |
| Request ≤ 2000 ms | **300/300 = 100%** |

### 4.2. Warm — tuần tự (30 request, concurrency 1)

Chạy 16:07, 26/10. Đây là baseline để so với cold.

| Chỉ số | Giá trị |
|---|---|
| Errors | 0 (0%) |
| min / mean | 57 ms / 87 ms |
| p50 / p90 | 79 ms / 99 ms |
| **p95** | **124 ms** |
| p99 / max | 270 ms / 270 ms |
| Request ≤ 2000 ms | **30/30 = 100%** |

### 4.3. Cold — **CHƯA ĐO**

Lần chạy 16:04 mang nhãn cold nhưng **không hợp lệ**, đã loại:

| Dấu hiệu | Kỳ vọng cold | Thực tế 16:04 |
|---|---|---|
| Request #1 | ~10.000–15.000 ms | **311 ms** |
| min so với max | min là số lớn nhất | min 59 ms, max 311 ms |
| So với warm@1 | cao hơn nhiều | gần như trùng khớp |

Nguyên nhân: chỉ ~4 phút kể từ request cuối, Render chưa ngủ (ngưỡng 15 phút).

**Cần đo lại vào sáng 27/10, ngay khi mở máy** — lúc đó Render và Neon đã ngủ qua đêm, đo được ngay mà không phải chờ 15 phút, và đúng kịch bản "người dùng đầu tiên trong ngày".

Lệnh:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/Measure-ReadLatency.ps1 `
  -Label cold -Requests 30 -Concurrency 1 -CourtId <courtId>
```

Dấu hiệu cold thật: `min` là con số **lớn nhất** (request #1 chậm nhất), `max` ≈ `min`.

## 5. Đánh giá theo NFR-07

| Điều kiện | Tỷ lệ request ≤ 2000 ms | Kết luận |
|---|---|---|
| Warm, concurrency 10 | 100% (300/300) | Đạt ngưỡng ≥95% |
| Warm, concurrency 1 | 100% (30/30) | Đạt ngưỡng ≥95% |
| **Cold** | **chưa có** | **Chưa kết luận** |

**Chưa thể nói "đạt NFR-07".** NFR-07 nói "read request bình thường" không loại trừ request đầu tiên sau khi hệ thống ngủ, mà cold start của Render Free đo được trước đó là **~12,6 giây** — vượt xa 2 giây. Kế hoạch online cũng đã ghi rõ: *"không loại cold start khỏi báo cáo để tuyên bố đáp ứng NFR"*.

## 6. Giới hạn phép đo

1. **Render Free ngủ sau ~15 phút**, wake ~12,6 giây (đo trực tiếp 26/10). Đây là giới hạn hạ tầng, không phải lỗi code.
2. **750 giờ/tháng tính chung cả workspace**, và workspace còn service cũ của project khác → có thể bị suspend ngoài ý muốn.
3. **Neon Free ngủ sau ~5 phút**; cold thật sự là hai lần thức dậy cùng lúc (container + database).
4. **Một instance duy nhất**, không có load balancer hay CDN trước API.
5. **Chưa đo write path** (tạo booking, cancel) — SRS không đặt ngưỡng, nhưng nếu cần thì phải bổ sung như một yêu cầu mới.
6. **Chưa đo dưới tải lớn hơn** (concurrency > 10); con số 10 là do nhóm chọn, không phải từ SRS.
7. Số liệu phụ thuộc mạng của máy đo và vị trí địa lý; chạy từ Việt Nam tới Singapore.

## 7. Usability — NFR-08

### 7.1. Kiểm tra tự động được (đã chạy)

| Hạng mục | Cách kiểm tra | Kết quả |
|---|---|---|
| Trang `/courts` render được | Chrome headless, đọc DOM | Pass — có tiêu đề và danh sách sân |
| Deep link không 404 | `curl` + headless | Pass — `/courts`, `/admin/courts` trả 200 |
| API availability trả đủ slot | `GET /courts/{id}/availability` | Pass — 16 slot/ngày với khung 06:00–22:00 |

### 7.2. Cần kiểm tra thủ công trên trình duyệt

| # | Test case | Cách kiểm tra | Trạng thái |
|---|---|---|---|
| U1 | 4 trạng thái slot phân biệt được: available / unavailable / blackout / past | Mở availability của một sân có blackout + ngày quá khứ, so màu và nhãn | **Chưa kiểm tra** |
| U2 | Form validation — đăng ký | Email sai định dạng, mật khẩu ngắn, bỏ trống | **Chưa kiểm tra** |
| U3 | Form validation — đặt sân | Không chọn slot, chọn quá 4 slot, chọn slot không liên tiếp | **Chưa kiểm tra** |
| U4 | Loading state | Bật DevTools throttling, xem có skeleton/spinner | **Chưa kiểm tra** |
| U5 | Error state | Chặn API (offline), xem có thông báo + nút thử lại | **Chưa kiểm tra** |
| U6 | Empty state | Xem trang khi chưa có booking nào | **Chưa kiểm tra** |
| U7 | Responsive | 375px / 768px / 1440px | **Chưa kiểm tra** |
| U8 | Luồng đặt sân end-to-end | Đăng nhập → chọn sân → chọn slot → xác nhận | **Chưa kiểm tra** |
| U9 | Luồng hủy booking | My Booking → hủy → kiểm tra trạng thái | **Chưa kiểm tra** |
| U10 | Admin court / schedule / blackout | Tạo sân, đặt giờ mở cửa, tạo blackout | **Chưa kiểm tra** |

U1 là mục **quan trọng nhất** vì NFR-08 nêu đích danh 4 trạng thái slot.

## 8. Cách tái hiện

```powershell
# warm, throughput
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/Measure-ReadLatency.ps1 `
  -Label warm -Requests 300 -Concurrency 10 -CourtId <courtId>

# warm, tuan tu (baseline)
... -Label warm -Requests 30 -Concurrency 1 -CourtId <courtId>

# cold: chi chay sau khi backend ngu >= 15 phut, khong request nao xen vao
... -Label cold -Requests 30 -Concurrency 1 -CourtId <courtId>
```

Evidence: `artifacts/tests/perf-YYYYMMDD/read-latency-<label>.json` (gitignored).

## 9. Đối chiếu checklist #99

| # | Mục | Trạng thái |
|---|---|---|
| 1 | Chốt môi trường, version, dataset, số user/request, tiêu chí NFR-07 | **Một phần** — đã có profile đề xuất ở §2, chờ Huy review |
| 2 | Chuẩn bị script đo read API, ghi latency/error rate/cấu hình | **Xong** — script + evidence |
| 3 | Chạy thử nghiệm, lưu raw results, so với tiêu chí | **Một phần** — warm xong, **cold chưa** |
| 4 | Kiểm tra usability | **Chưa** — đã có checklist §7.2, chưa thực hiện |
| 5 | Ghi defect/bottleneck, giới hạn, đề xuất | **Một phần** — giới hạn ở §6; chưa có defect vì chưa thấy |
| 6 | Bàn giao report cho Huy review và UAT Entry Gate | **Chưa** — report chưa hoàn chỉnh khi thiếu cold + usability |
| Online 1 | MVP deploy, staging readiness; Huy review load profile | **Một phần** — staging sẵn sàng; Huy chưa review profile |
| Online 2 | Đo warm/cold và usability qua URL thật, ghi quota/giới hạn | **Một phần** — warm xong, cold + usability chưa |
| Online 3 | Lưu số đo/evidence/issue trước regression; không tự khẳng định đạt NFR | **Đang giữ đúng nguyên tắc** — report không khẳng định đạt NFR |
