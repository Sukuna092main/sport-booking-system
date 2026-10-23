import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  AlertTriangle,
  Loader2,
  ShieldCheck,
  RefreshCw,
  Copy,
  Info,
} from "lucide-react"
import type { BookingReviewHandoffData, SimulationOutcome } from "@/features/bookings/types"

const DEFAULT_REVIEW_DATA: BookingReviewHandoffData = {
  courtId: "c1111111-2222-3333-4444-555555555555",
  courtName: "Court A",
  courtCode: "CRT-A",
  sportName: "BADMINTON",
  sportTypeId: "st-badminton",
  locationText: "Riverside Sports Center · 12 Riverwalk Avenue",
  bookingDate: "2026-10-15",
  formattedDate: "Thứ Năm, 15/10/2026",
  slotDurationMinutes: 60,
  minConsecutiveSlots: 1,
  maxConsecutiveSlots: 4,
  timeRangeText: "14:00 – 15:00",
  durationText: "1 hour",
  selectedSlots: [
    {
      id: "slot-demo-1",
      startsAt: "2026-10-15T07:00:00.000Z",
      endsAt: "2026-10-15T08:00:00.000Z",
      formattedRange: "14:00 - 15:00",
    },
  ],
  payload: {
    courtId: "c1111111-2222-3333-4444-555555555555",
    bookingDate: "2026-10-15",
    timeSlotIds: ["slot-demo-1"],
  },
}

export function BookingReviewPage() {
  const navigate = useNavigate()

  // Read handoff data from sessionStorage if present, otherwise fallback to sample
  const reviewData: BookingReviewHandoffData = (() => {
    try {
      const stored = sessionStorage.getItem("pending_booking_review")
      if (stored) {
        return JSON.parse(stored) as BookingReviewHandoffData
      }
    } catch {
      // fallback
    }
    return DEFAULT_REVIEW_DATA
  })()

  const [simulationOutcome, setSimulationOutcome] = useState<SimulationOutcome>("success")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState<{
    status: "idle" | "success" | "error"
    bookingCode?: string
    errorEnvelope?: {
      code: string
      message: string
      requestId: string
      details?: Array<{ field: string; message: string }>
    }
  }>({ status: "idle" })

  const [copiedPayload, setCopiedPayload] = useState(false)

  const slotCount = reviewData.selectedSlots.length

  function handleConfirmBooking() {
    setIsSubmitting(true)
    setSubmitResult({ status: "idle" })

    // Simulate server roundtrip
    setTimeout(() => {
      setIsSubmitting(false)

      if (simulationOutcome === "success") {
        const randomHex = Math.random().toString(36).substring(2, 6).toUpperCase()
        const dateCode = reviewData.bookingDate.replace(/-/g, "")
        const code = `BK-${dateCode}-${randomHex}`
        setSubmitResult({
          status: "success",
          bookingCode: code,
        })
      } else if (simulationOutcome === "error_conflict") {
        setSubmitResult({
          status: "error",
          errorEnvelope: {
            code: "slot_unavailable",
            message: "Một hoặc nhiều khung giờ đã bị người khác đặt trước khi bạn hoàn tất.",
            requestId: crypto.randomUUID ? crypto.randomUUID() : "req-conflict-409",
            details: [
              {
                field: "timeSlotIds",
                message: "Khung giờ không còn khả dụng tại thời điểm giao dịch commit.",
              },
            ],
          },
        })
      } else if (simulationOutcome === "error_non_consecutive") {
        setSubmitResult({
          status: "error",
          errorEnvelope: {
            code: "booking_rule_violation",
            message: "Các khung giờ đặt sân phải liên tiếp nhau trong cùng một ngày.",
            requestId: "req-consecutive-422",
            details: [
              {
                field: "timeSlotIds",
                message: "Phát hiện khoảng trống thời gian giữa các slot.",
              },
            ],
          },
        })
      } else if (simulationOutcome === "error_min_max") {
        setSubmitResult({
          status: "error",
          errorEnvelope: {
            code: "booking_rule_violation",
            message: `Số slot phải từ ${reviewData.minConsecutiveSlots} đến ${reviewData.maxConsecutiveSlots} slot liên tiếp.`,
            requestId: "req-minmax-422",
            details: [
              {
                field: "timeSlotIds",
                message: "Số lượng slot không nằm trong giới hạn cấu hình của sân.",
              },
            ],
          },
        })
      } else if (simulationOutcome === "error_limit_reached") {
        setSubmitResult({
          status: "error",
          errorEnvelope: {
            code: "booking_rule_violation",
            message: "Bạn đã đạt giới hạn tối đa 3 booking đang hoạt động.",
            requestId: "req-limit-422",
            details: [
              {
                field: "customerId",
                message: "Tối đa 3 active bookings cho mỗi tài khoản.",
              },
            ],
          },
        })
      } else if (simulationOutcome === "error_horizon_exceeded") {
        setSubmitResult({
          status: "error",
          errorEnvelope: {
            code: "booking_rule_violation",
            message: "Ngày đặt sân vượt quá phạm vi 30 ngày cho phép.",
            requestId: "req-horizon-422",
            details: [
              {
                field: "bookingDate",
                message: "Ngày đặt tối đa 30 ngày lịch tính từ hiện tại.",
              },
            ],
          },
        })
      } else {
        setSubmitResult({
          status: "error",
          errorEnvelope: {
            code: "internal_error",
            message: "Hệ thống tạm thời bận hoặc timeout mạng. Vui lòng kiểm tra lại trước khi gửi lại.",
            requestId: "req-timeout-500",
          },
        })
      }
    }, 600)
  }

  function handleBackToEdit() {
    navigate(`/courts/${reviewData.courtId}/availability`)
  }

  function handleCopyPayload() {
    navigator.clipboard.writeText(JSON.stringify(reviewData.payload, null, 2))
    setCopiedPayload(true)
    setTimeout(() => setCopiedPayload(false), 2000)
  }

  return (
    <section className="py-4">
      {/* Top back link */}
      <button
        onClick={handleBackToEdit}
        className="mb-4 flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Quay lại chỉnh sửa lựa chọn
      </button>

      {/* Header section */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#16A34A]">
            BOOKING REVIEW
          </p>
          <h1 className="mt-0.5 text-3xl font-black tracking-tight text-gray-900">
            KIỂM TRA BOOKING
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Xác nhận lại sân, ngày và các TimeSlot trước khi gửi yêu cầu
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3.5 py-1.5 text-xs font-semibold text-sky-700">
          <Info className="h-3.5 w-3.5" />
          Prototype — chưa kết nối API
        </div>
      </div>

      {/* Two columns layout matching Screenshot 5 */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Left Column: Court & Slot Summary */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          {/* Court Info Header */}
          <div className="flex items-start gap-3.5 pb-6 border-b border-gray-100">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-base font-black text-emerald-800">
              {reviewData.courtName.charAt(0) || "C"}
            </div>
            <div>
              <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                {reviewData.sportName}
              </span>
              <h2 className="text-xl font-black text-gray-900">
                {reviewData.courtName}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {reviewData.locationText}
              </p>
            </div>
          </div>

          {/* 4 Details Grid */}
          <div className="mt-6 grid grid-cols-2 gap-y-5 gap-x-4">
            <div>
              <p className="text-xs text-gray-400 font-medium">Ngày đặt</p>
              <p className="mt-0.5 text-sm font-bold text-gray-900">
                {reviewData.formattedDate}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium">Khung giờ</p>
              <p className="mt-0.5 text-sm font-bold text-gray-900">
                {reviewData.timeRangeText}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium">Số TimeSlot</p>
              <p className="mt-0.5 text-sm font-bold text-gray-900">
                {slotCount} slot liên tiếp
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium">Thời lượng slot</p>
              <p className="mt-0.5 text-sm font-bold text-gray-900">
                {reviewData.slotDurationMinutes} phút / slot
              </p>
            </div>
          </div>

          {/* Selected Slot Badges */}
          <div className="mt-6">
            <p className="text-xs font-semibold text-gray-500 mb-2">
              Danh sách slot đã chọn ({slotCount}):
            </p>
            <div className="flex flex-wrap gap-2">
              {reviewData.selectedSlots.map((slot) => (
                <span
                  key={slot.id}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800"
                >
                  <CheckCircle className="h-3 w-3 text-emerald-600" />
                  {slot.formattedRange}
                </span>
              ))}
            </div>
          </div>

          {/* Verification Callout Box */}
          <div className="mt-8 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
              <ShieldCheck className="h-4 w-4 text-emerald-700" />
              Kiểm tra phía giao diện đã đạt
            </div>
            <p className="mt-1.5 text-xs text-emerald-800 leading-relaxed">
              Các slot cùng sân, cùng ngày, liên tiếp và nằm trong giới hạn {reviewData.minConsecutiveSlots}–{reviewData.maxConsecutiveSlots}. Availability có thể thay đổi trước khi yêu cầu hoàn tất, vì vậy điều kiện sẽ được xác minh lại khi xử lý.
            </p>
          </div>

          {/* Verified API Payload preview drawer */}
          <div className="mt-6 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Contract Payload (CreateBookingRequest)
              </span>
              <button
                type="button"
                onClick={handleCopyPayload}
                className="flex items-center gap-1 text-[11px] font-medium text-emerald-700 hover:text-emerald-800"
              >
                <Copy className="h-3 w-3" />
                {copiedPayload ? "Đã sao chép!" : "Sao chép JSON"}
              </button>
            </div>
            <pre className="overflow-x-auto rounded-xl bg-gray-900 p-3 text-[11px] text-gray-100 font-mono">
              {JSON.stringify(reviewData.payload, null, 2)}
            </pre>
          </div>
        </div>

        {/* Right Column: Submission & Simulation Controls */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm h-fit">
          <h2 className="text-base font-black text-gray-900">
            Xác nhận gửi yêu cầu
          </h2>
          <p className="mt-1 text-xs text-gray-500 leading-relaxed">
            Nút sẽ bị khóa trong lúc xử lý để giảm double-click. Thành công chỉ hiển thị sau kết quả được xác minh.
          </p>

          {/* Simulation Outcome Selector */}
          <div className="mt-5">
            <label
              htmlFor="simulation-select"
              className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5"
            >
              KẾT QUẢ MÔ PHỎNG CHO REVIEW
            </label>
            <select
              id="simulation-select"
              value={simulationOutcome}
              onChange={(e) => {
                setSimulationOutcome(e.target.value as SimulationOutcome)
                setSubmitResult({ status: "idle" })
              }}
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-xs font-medium text-gray-800 shadow-sm transition-colors focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            >
              <option value="success">Thành công</option>
              <option value="error_conflict">Lỗi: Slot đã bị đặt / Conflict (409)</option>
              <option value="error_non_consecutive">Lỗi: Slot không liên tiếp (422)</option>
              <option value="error_min_max">Lỗi: Vượt quá min/max slot (422)</option>
              <option value="error_limit_reached">Lỗi: Vượt quá 3 active booking (422)</option>
              <option value="error_horizon_exceeded">Lỗi: Quá 30 ngày horizon (422)</option>
              <option value="error_timeout">Lỗi: Mạng / Timeout (500)</option>
            </select>
          </div>

          {/* Submit Action */}
          <button
            id="review-confirm-button"
            type="button"
            disabled={isSubmitting}
            onClick={handleConfirmBooking}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#B4FF00] px-5 py-3.5 text-sm font-black text-gray-900 transition-all hover:bg-[#AAEF00] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 shadow-sm"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-gray-900" />
                Đang gửi yêu cầu…
              </>
            ) : (
              <>
                Xác nhận Booking
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>

          {/* Back Button */}
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleBackToEdit}
            className="mt-2.5 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-bold text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900"
          >
            Quay lại chỉnh sửa
          </button>

          <p className="mt-3 text-center text-[11px] text-gray-400">
            Đây là prototype UI, không có transaction hoặc booking thật được tạo.
          </p>

          {/* Simulated Result Display */}
          {submitResult.status === "success" && (
            <div
              role="alert"
              className="mt-5 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-xs text-emerald-900 animate-in fade-in"
            >
              <div className="flex items-center gap-2 font-bold text-sm text-emerald-800">
                <CheckCircle className="h-4 w-4 text-emerald-600" />
                Đặt sân thành công!
              </div>
              <p className="mt-1 text-xs text-emerald-700">
                Mã booking: <span className="font-mono font-bold">{submitResult.bookingCode}</span>
              </p>
              <p className="mt-0.5 text-[11px] text-emerald-600">
                Trạng thái: <span className="font-bold">CONFIRMED</span> (gửi với Idempotency-Key)
              </p>
              <div className="mt-3 pt-2 border-t border-emerald-200/60 flex items-center justify-between">
                <Link
                  to="/bookings"
                  className="font-bold text-emerald-800 hover:underline text-xs"
                >
                  Xem Booking của tôi →
                </Link>
                <button
                  type="button"
                  onClick={() => setSubmitResult({ status: "idle" })}
                  className="text-[11px] text-emerald-600 hover:text-emerald-800"
                >
                  Đóng
                </button>
              </div>
            </div>
          )}

          {submitResult.status === "error" && submitResult.errorEnvelope && (
            <div
              role="alert"
              className="mt-5 rounded-xl border border-rose-300 bg-rose-50 p-4 text-xs text-rose-900 animate-in fade-in"
            >
              <div className="flex items-center gap-2 font-bold text-sm text-rose-800">
                <AlertTriangle className="h-4 w-4 text-rose-600" />
                Yêu cầu bị từ chối
              </div>
              <p className="mt-1 text-xs text-rose-700 font-medium">
                {submitResult.errorEnvelope.message}
              </p>
              <div className="mt-2 rounded-lg bg-white/70 p-2 font-mono text-[10px] text-rose-800 space-y-0.5">
                <p>Mã lỗi: {submitResult.errorEnvelope.code}</p>
                <p>Request ID: {submitResult.errorEnvelope.requestId}</p>
                {submitResult.errorEnvelope.details?.map((d, i) => (
                  <p key={i} className="text-rose-600">
                    Chi tiết: [{d.field}] {d.message}
                  </p>
                ))}
              </div>
              <div className="mt-3 pt-2 border-t border-rose-200/60 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleBackToEdit}
                  className="flex items-center gap-1 font-bold text-rose-800 hover:underline text-xs"
                >
                  <RefreshCw className="h-3 w-3" />
                  Chọn lại khung giờ
                </button>
                <button
                  type="button"
                  onClick={() => setSubmitResult({ status: "idle" })}
                  className="text-[11px] text-rose-600 hover:text-rose-800"
                >
                  Thử lại
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
