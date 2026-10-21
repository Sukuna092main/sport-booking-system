import { useState } from "react"
import { useNavigate } from "react-router-dom"
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
  CalendarDays,
  Clock,
  Tag,
  MapPin,
  AlertCircle,
  KeyRound,
} from "lucide-react"
import type {
  BookingItem,
  BookingReviewHandoffData,
  SubmissionMode,
} from "@/features/bookings/types"
import {
  formatReferencePrice,
  validateBookingReview,
} from "@/features/bookings/consecutiveSlots"
import { useCourtById } from "@/features/courts/useCourts"
import { bookingsApi, generateIdempotencyKey } from "@/lib/api/bookings"
import { saveMockBooking } from "@/features/bookings/useBookings"
import { AxiosError } from "axios"
import type { ApiErrorResponse } from "@/types/auth.types"

function makeRequestId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).substring(2, 10)}`
}


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
  referencePriceAmount: "150000",
  referencePriceCurrency: "VND",
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

  // 1. Nhận dữ liệu Court/Date/Selected Slots từ Availability UI qua sessionStorage
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

  // Fresh court data query to ensure latest constraints and reference price
  const { data: court } = useCourtById(reviewData.courtId)

  // Merge latest court parameters if available
  const courtName = court?.name ?? reviewData.courtName
  const courtCode = court?.code ?? reviewData.courtCode
  const locationText = court?.description ?? reviewData.locationText
  const minSlots = court?.minConsecutiveSlots ?? reviewData.minConsecutiveSlots ?? 1
  const maxSlots = court?.maxConsecutiveSlots ?? reviewData.maxConsecutiveSlots ?? 4
  const slotDuration = court?.slotDurationMinutes ?? reviewData.slotDurationMinutes ?? 60
  const priceAmount = court?.referencePriceAmount ?? reviewData.referencePriceAmount
  const priceCurrency = court?.referencePriceCurrency ?? reviewData.referencePriceCurrency ?? "VND"

  const slotCount = reviewData.selectedSlots.length

  // 3. Hiển thị giá tham chiếu và tổng số slot
  const priceInfo = formatReferencePrice(priceAmount, priceCurrency, slotCount)

  // 4. Validate slot selection trước khi gửi request
  const validation = validateBookingReview(
    reviewData.bookingDate,
    reviewData.selectedSlots,
    {
      minConsecutiveSlots: minSlots,
      maxConsecutiveSlots: maxSlots,
    }
  )

  // Idempotency Key state (opaque, 1-128 chars, unique per attempt / preserved on retry)
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => generateIdempotencyKey())

  // Execution mode: Real API or contract simulation for review/testing
  const [submissionMode, setSubmissionMode] = useState<SubmissionMode>("real_api")

  // 6. Disable submit trong lúc request để tránh double submit
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Submit result state
  const [submitResult, setSubmitResult] = useState<{
    status: "idle" | "success" | "conflict" | "error"
    booking?: BookingItem
    bookingCode?: string
    bookingId?: string
    errorEnvelope?: {
      code: string
      message: string
      requestId: string
      details?: Array<{ field: string; message: string }>
    }
  }>({ status: "idle" })

  const [copiedPayload, setCopiedPayload] = useState(false)
  const [copiedKey, setCopiedKey] = useState(false)
  const [copiedSuccessCode, setCopiedSuccessCode] = useState(false)

  // 5. Gọi Create Booking API / xử lý submit
  async function handleConfirmBooking() {
    if (isSubmitting || !validation.isValid) return

    setIsSubmitting(true)
    setSubmitResult({ status: "idle" })

    // A. Real API Submission
    if (submissionMode === "real_api") {
      try {
        const response = await bookingsApi.createBooking(
          reviewData.payload,
          idempotencyKey
        )
        const createdBooking = response.data
        saveMockBooking(createdBooking)
        setIsSubmitting(false)
        setSubmitResult({
          status: "success",
          booking: createdBooking,
          bookingCode: createdBooking.bookingCode,
          bookingId: createdBooking.id,
        })
      } catch (err: unknown) {
        setIsSubmitting(false)
        if (err instanceof AxiosError) {
          const status = err.response?.status
          const errData = err.response?.data as ApiErrorResponse | undefined

          // 7. Xử lý booking conflict bằng thông báo rõ ràng (409 Conflict)
          if (status === 409) {
            setSubmitResult({
              status: "conflict",
              errorEnvelope: {
                code: errData?.error?.code || "slot_unavailable",
                message:
                  errData?.error?.message ||
                  "Khung giờ bạn chọn đã bị người khác đặt trước hoặc không còn khả dụng.",
                requestId: errData?.error?.requestId || makeRequestId("req-conflict"),
                details: errData?.error?.details || [
                  {
                    field: "timeSlotIds",
                    message: "Xung đột lịch đặt: Khung giờ đã bị chiếm trong lúc giao dịch commit.",
                  },
                ],
              },
            })
            return
          }

          // Rule violation (422)
          if (status === 422) {
            setSubmitResult({
              status: "error",
              errorEnvelope: {
                code: errData?.error?.code || "booking_rule_violation",
                message:
                  errData?.error?.message ||
                  "Yêu cầu đặt sân vi phạm quy tắc nghiệp vụ.",
                requestId: errData?.error?.requestId || makeRequestId("req-rule"),
                details: errData?.error?.details,
              },
            })
            return
          }

          // Planned endpoint notice (404 Not Found before BE handoff)
          if (status === 404) {
            setSubmitResult({
              status: "error",
              errorEnvelope: {
                code: "not_found",
                message:
                  "Endpoint POST /api/v1/bookings hiện đang ở trạng thái 'planned' (chờ Backend hoàn tất handoff). Để kiểm chứng flow ngay bây giờ, bạn có thể chọn chế độ 'Mô phỏng' bên dưới.",
                requestId: errData?.error?.requestId || makeRequestId("req-404"),
              },
            })
            return
          }

          // Unauthorized (401)
          if (status === 401) {
            setSubmitResult({
              status: "error",
              errorEnvelope: {
                code: "unauthorized",
                message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.",
                requestId: errData?.error?.requestId || makeRequestId("req-auth"),
              },
            })
            return
          }

          // Generic error envelope from backend
          if (errData?.error) {
            setSubmitResult({
              status: "error",
              errorEnvelope: errData.error,
            })
            return
          }
        }

        // Network / Timeout error
        setSubmitResult({
          status: "error",
          errorEnvelope: {
            code: "internal_error",
            message:
              "Không thể kết nối đến máy chủ hoặc timeout mạng. Kết quả commit có thể chưa rõ, vui lòng kiểm tra danh sách Booking trước khi gửi lại.",
            requestId: makeRequestId("req-net"),
          },
        })
      }
      return
    }

    // B. Simulation Mode (Mock execution per OpenAPI & SRS contract)
    setTimeout(() => {
      setIsSubmitting(false)

      if (submissionMode === "success") {
        const randomHex = Math.random().toString(36).substring(2, 6).toUpperCase()
        const dateCode = reviewData.bookingDate.replace(/-/g, "")
        const code = `BK-${dateCode}-${randomHex}`
        const mockBooking: BookingItem = {
          id: (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : makeRequestId("bk"),
          bookingCode: code,
          customerId: "usr-current-user",
          courtId: reviewData.courtId,
          bookingDate: reviewData.bookingDate,
          status: "CONFIRMED",
          slots: reviewData.selectedSlots.map((s) => ({
            timeSlotId: s.id,
            startsAt: s.startsAt,
            endsAt: s.endsAt,
          })),
          createdAt: new Date().toISOString(),
          cancelledAt: null,
        }
        saveMockBooking(mockBooking)
        setSubmitResult({
          status: "success",
          booking: mockBooking,
          bookingCode: code,
          bookingId: mockBooking.id,
        })
      } else if (submissionMode === "error_conflict") {
        // 7. Xử lý booking conflict bằng thông báo rõ ràng
        setSubmitResult({
          status: "conflict",
          errorEnvelope: {
            code: "slot_unavailable",
            message:
              "Một hoặc nhiều khung giờ đã bị người khác đặt trước khi bạn hoàn tất. Toàn bộ yêu cầu đặt sân đã được hủy (rollback) an toàn để không phát sinh booking dang dở.",
            requestId: (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : "req-conflict-409",
            details: [
              {
                field: "timeSlotIds",
                message: "Khung giờ không còn khả dụng tại thời điểm giao dịch commit.",
              },
            ],
          },
        })
      } else if (submissionMode === "error_non_consecutive") {
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
      } else if (submissionMode === "error_min_max") {
        setSubmitResult({
          status: "error",
          errorEnvelope: {
            code: "booking_rule_violation",
            message: `Số slot phải từ ${minSlots} đến ${maxSlots} slot liên tiếp theo cấu hình của sân.`,
            requestId: "req-minmax-422",
            details: [
              {
                field: "timeSlotIds",
                message: "Số lượng slot không nằm trong giới hạn cấu hình của sân.",
              },
            ],
          },
        })
      } else if (submissionMode === "error_limit_reached") {
        setSubmitResult({
          status: "error",
          errorEnvelope: {
            code: "booking_rule_violation",
            message: "Bạn đã đạt giới hạn tối đa 3 booking đang hoạt động (SRS BR-06).",
            requestId: "req-limit-422",
            details: [
              {
                field: "customerId",
                message: "Tối đa 3 active bookings cho mỗi tài khoản.",
              },
            ],
          },
        })
      } else if (submissionMode === "error_horizon_exceeded") {
        setSubmitResult({
          status: "error",
          errorEnvelope: {
            code: "booking_rule_violation",
            message: "Ngày đặt sân vượt quá phạm vi 30 ngày cho phép (SRS C-01 / BR-05).",
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
        // error_timeout
        setSubmitResult({
          status: "error",
          errorEnvelope: {
            code: "internal_error",
            message: "Hệ thống tạm thời bận hoặc timeout mạng. Vui lòng kiểm tra danh sách Booking trước khi gửi lại.",
            requestId: "req-timeout-500",
          },
        })
      }
    }, 600)
  }

  function handleBackToEdit() {
    navigate(`/courts/${reviewData.courtId}/availability?date=${reviewData.bookingDate}`)
  }

  function handleCopyPayload() {
    navigator.clipboard.writeText(JSON.stringify(reviewData.payload, null, 2))
    setCopiedPayload(true)
    setTimeout(() => setCopiedPayload(false), 2000)
  }

  function handleCopyKey() {
    navigator.clipboard.writeText(idempotencyKey)
    setCopiedKey(true)
    setTimeout(() => setCopiedKey(false), 2000)
  }

  function handleRefreshKey() {
    setIdempotencyKey(generateIdempotencyKey())
  }

  return (
    <section className="py-4">
      {/* Top back link */}
      <button
        onClick={handleBackToEdit}
        className="mb-4 flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Quay lại chỉnh sửa khung giờ đã chọn
      </button>

      {/* Header section */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#16A34A]">
            BOOKING CONFIRMATION
          </p>
          <h1 className="mt-0.5 text-3xl font-black tracking-tight text-gray-900">
            XÁC NHẬN ĐẶT SÂN
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Kiểm tra thông tin sân, ngày và các khung giờ trước khi hoàn tất gửi yêu cầu
          </p>
        </div>

        {/* Execution Mode Badge */}
        <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-xs font-semibold text-emerald-800">
          <Info className="h-3.5 w-3.5 text-emerald-600" />
          <span>Hỗ trợ API thật & Mô phỏng theo Contract</span>
        </div>
      </div>

      {/* Two columns layout matching Screenshot 5 & design system */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Left Column: Court & Slot Summary */}
        <div className="space-y-6">
          {/* Main Booking Summary Card */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            {/* 2. Hiển thị booking summary trước khi submit */}
            {/* Court Info Header */}
            <div className="flex items-start gap-3.5 pb-6 border-b border-gray-100">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-lg font-black text-emerald-800">
                {courtName.charAt(0) || "C"}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                    {reviewData.sportName}
                  </span>
                  <span className="text-gray-300">·</span>
                  <span className="text-[10px] font-mono font-semibold text-gray-400">
                    Mã: {courtCode}
                  </span>
                </div>
                <h2 className="text-xl font-black text-gray-900">
                  {courtName}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                  {locationText}
                </p>
              </div>
            </div>

            {/* 4 Details Grid */}
            <div className="mt-6 grid grid-cols-2 gap-y-5 gap-x-4">
              <div>
                <p className="text-xs text-gray-400 font-medium">Ngày đặt sân</p>
                <p className="mt-0.5 text-sm font-bold text-gray-900 flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 text-emerald-600" />
                  {reviewData.formattedDate}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium">Khung giờ tổng</p>
                <p className="mt-0.5 text-sm font-bold text-gray-900 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-emerald-600" />
                  {reviewData.timeRangeText}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium">Số TimeSlot</p>
                <p className="mt-0.5 text-sm font-bold text-gray-900">
                  {slotCount} slot liên tiếp ({reviewData.durationText})
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium">Thời lượng mỗi slot</p>
                <p className="mt-0.5 text-sm font-bold text-gray-900">
                  {slotDuration} phút / slot
                </p>
              </div>
            </div>

            {/* Selected Slot Badges */}
            <div className="mt-6">
              <p className="text-xs font-semibold text-gray-500 mb-2">
                Danh sách khung giờ đã chọn ({slotCount}):
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

            {/* 3. Hiển thị giá tham chiếu và tổng số slot */}
            <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50/80 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    GIÁ THAM CHIẾU (REFERENCE PRICE)
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    Đơn giá: <span className="font-semibold text-gray-900">{priceInfo.unitText}</span> × {slotCount} slot
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-gray-400 font-medium">Tổng giá tham chiếu:</span>
                  <p className="text-lg font-black text-gray-900">
                    {priceInfo.totalText}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-[11px] text-gray-400 leading-relaxed border-t border-gray-200/60 pt-2 flex items-center gap-1.5">
                <Tag className="h-3 w-3 text-emerald-600 shrink-0" />
                <span>
                  Giá tham chiếu mang tính đối chiếu. MVP hiện tại không thu phí hoặc yêu cầu thanh toán trực tuyến.
                </span>
              </p>
            </div>

            {/* 4. Validate slot selection result banner */}
            <div className="mt-6">
              {validation.isValid ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                    <ShieldCheck className="h-4 w-4 text-emerald-700" />
                    Kiểm tra điều kiện đặt sân: Hợp lệ
                  </div>
                  <p className="mt-1 text-xs text-emerald-800 leading-relaxed">
                    Các slot cùng sân, cùng ngày, liên tiếp và nằm trong giới hạn {minSlots}–{maxSlots} slot. Điều kiện sẽ được backend xác minh lại atomic khi submit.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-rose-300 bg-rose-50 p-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-rose-900">
                    <AlertTriangle className="h-4 w-4 text-rose-700" />
                    Lựa chọn không hợp lệ
                  </div>
                  <p className="mt-1 text-xs text-rose-800 leading-relaxed font-medium">
                    {validation.error}
                  </p>
                  <button
                    type="button"
                    onClick={handleBackToEdit}
                    className="mt-2 text-xs font-bold text-rose-700 hover:underline flex items-center gap-1"
                  >
                    Quay lại chọn lại khung giờ →
                  </button>
                </div>
              )}
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
        </div>

        {/* Right Column: Submission Controls & Outcomes */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm h-fit">
            <h2 className="text-base font-black text-gray-900">
              Xác nhận & Gửi yêu cầu
            </h2>
            <p className="mt-1 text-xs text-gray-500 leading-relaxed">
              Nút submit sẽ được vô hiệu hóa trong lúc gửi để chống double-click. Giao dịch được bảo vệ bằng Idempotency-Key.
            </p>

            {/* Idempotency Key Info & Refresh */}
            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50/70 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-gray-700 flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5 text-emerald-600" />
                  Idempotency-Key
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyKey}
                    title="Sao chép key"
                    className="text-[10px] text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-0.5"
                  >
                    <Copy className="h-2.5 w-2.5" />
                    {copiedKey ? "Đã chép" : "Chép"}
                  </button>
                  <button
                    type="button"
                    onClick={handleRefreshKey}
                    title="Đổi key mới"
                    className="text-[10px] text-gray-500 hover:text-gray-800 font-semibold flex items-center gap-0.5"
                  >
                    <RefreshCw className="h-2.5 w-2.5" />
                    Đổi
                  </button>
                </div>
              </div>
              <p className="mt-1 text-[11px] font-mono text-gray-500 truncate" title={idempotencyKey}>
                {idempotencyKey}
              </p>
            </div>

            {/* Execution / Simulation Selector */}
            <div className="mt-5">
              <label
                htmlFor="submission-mode-select"
                className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5"
              >
                NGUỒN THỰC THI (API THẬT / MÔ PHỎNG CONTRACT)
              </label>
              <select
                id="submission-mode-select"
                value={submissionMode}
                onChange={(e) => {
                  setSubmissionMode(e.target.value as SubmissionMode)
                  setSubmitResult({ status: "idle" })
                }}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-xs font-semibold text-gray-800 shadow-sm transition-colors focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              >
                <option value="real_api">🚀 Gọi API thật (POST /api/v1/bookings)</option>
                <option value="success">✅ Mô phỏng: Đặt sân thành công (201)</option>
                <option value="error_conflict">⚠️ Mô phỏng: Xung đột khung giờ / Conflict (409 slot_unavailable)</option>
                <option value="error_non_consecutive">❌ Mô phỏng: Slot không liên tiếp (422)</option>
                <option value="error_min_max">❌ Mô phỏng: Vượt quá min/max slot (422)</option>
                <option value="error_limit_reached">❌ Mô phỏng: Quá 3 active booking (422)</option>
                <option value="error_horizon_exceeded">❌ Mô phỏng: Quá 30 ngày horizon (422)</option>
                <option value="error_timeout">📡 Mô phỏng: Lỗi mạng / Timeout (500)</option>
              </select>
            </div>

            {/* 6. Disable submit trong lúc request để tránh double submit */}
            <button
              id="review-confirm-button"
              type="button"
              disabled={isSubmitting || !validation.isValid}
              onClick={handleConfirmBooking}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#B4FF00] px-5 py-3.5 text-sm font-black text-gray-900 transition-all hover:bg-[#AAEF00] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-gray-900" />
                  Đang xử lý đặt sân…
                </>
              ) : (
                <>
                  Xác nhận & Đặt sân
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

            {/* 8. Hiển thị success state và booking code/id */}
            {submitResult.status === "success" && (
              <div
                role="alert"
                className="mt-5 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-xs text-emerald-950 animate-in fade-in"
              >
                <div className="flex items-center gap-2 font-black text-sm text-emerald-900">
                  <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
                  Đặt sân thành công!
                </div>
                <div className="mt-3 space-y-1.5 rounded-xl bg-white/80 p-3 border border-emerald-100">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 font-medium">Mã booking:</span>
                    <div className="flex items-center gap-1 font-mono font-black text-sm text-emerald-800">
                      <span>{submitResult.bookingCode}</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (submitResult.bookingCode) {
                            navigator.clipboard.writeText(submitResult.bookingCode)
                            setCopiedSuccessCode(true)
                            setTimeout(() => setCopiedSuccessCode(false), 2000)
                          }
                        }}
                        className="p-0.5 text-emerald-600 hover:text-emerald-800"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                      {copiedSuccessCode && <span className="text-[10px] text-emerald-600">✓</span>}
                    </div>
                  </div>
                  {submitResult.bookingId && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-gray-500">ID Booking:</span>
                      <span className="font-mono text-gray-700 truncate max-w-[150px]" title={submitResult.bookingId}>
                        {submitResult.bookingId}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-500">Trạng thái:</span>
                    <span className="font-bold text-emerald-700">CONFIRMED</span>
                  </div>
                </div>

                {/* 9. Điều hướng sang Booking Detail hoặc My Booking */}
                <div className="mt-4 space-y-2">
                  {submitResult.bookingId && (
                    <button
                      type="button"
                      onClick={() => navigate(`/bookings/${submitResult.bookingId}`)}
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-800 transition-colors"
                    >
                      Xem chi tiết Booking này →
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => navigate("/bookings")}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-4 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-50 transition-colors"
                  >
                    Về danh sách Booking của tôi
                  </button>
                </div>
              </div>
            )}

            {/* 7. Xử lý booking conflict bằng thông báo rõ ràng */}
            {submitResult.status === "conflict" && submitResult.errorEnvelope && (
              <div
                role="alert"
                className="mt-5 rounded-2xl border border-rose-300 bg-rose-50 p-4 text-xs text-rose-950 animate-in fade-in"
              >
                <div className="flex items-center gap-2 font-black text-sm text-rose-900">
                  <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
                  Xung đột khung giờ đặt sân (409 Conflict)
                </div>
                <p className="mt-1.5 text-xs text-rose-800 leading-relaxed font-medium">
                  {submitResult.errorEnvelope.message}
                </p>
                <div className="mt-2.5 rounded-xl bg-white/80 p-2.5 font-mono text-[10px] text-rose-800 space-y-0.5 border border-rose-200">
                  <p>Mã lỗi: <span className="font-bold">{submitResult.errorEnvelope.code}</span></p>
                  <p>Request ID: {submitResult.errorEnvelope.requestId}</p>
                  {submitResult.errorEnvelope.details?.map((d, i) => (
                    <p key={i} className="text-rose-600 font-sans">
                      Chi tiết: [{d.field}] {d.message}
                    </p>
                  ))}
                </div>

                <div className="mt-3.5 flex flex-col gap-2 pt-2 border-t border-rose-200/80">
                  <button
                    type="button"
                    onClick={handleBackToEdit}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-rose-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-rose-800 transition-colors"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Tải lại lịch sân & Chọn giờ khác
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSubmitResult({ status: "idle" })
                    }}
                    className="text-center text-[11px] font-semibold text-rose-700 hover:underline"
                  >
                    Đóng thông báo
                  </button>
                </div>
              </div>
            )}

            {/* Other Errors (422 / 500 / Network) */}
            {submitResult.status === "error" && submitResult.errorEnvelope && (
              <div
                role="alert"
                className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-950 animate-in fade-in"
              >
                <div className="flex items-center gap-2 font-black text-sm text-amber-900">
                  <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
                  Yêu cầu chưa thể hoàn tất
                </div>
                <p className="mt-1.5 text-xs text-amber-800 leading-relaxed font-medium">
                  {submitResult.errorEnvelope.message}
                </p>
                <div className="mt-2.5 rounded-xl bg-white/80 p-2.5 font-mono text-[10px] text-amber-800 space-y-0.5 border border-amber-200">
                  <p>Mã lỗi: {submitResult.errorEnvelope.code}</p>
                  <p>Request ID: {submitResult.errorEnvelope.requestId}</p>
                  {submitResult.errorEnvelope.details?.map((d, i) => (
                    <p key={i} className="text-amber-700 font-sans">
                      Chi tiết: [{d.field}] {d.message}
                    </p>
                  ))}
                </div>
                <div className="mt-3 pt-2 border-t border-amber-200 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleBackToEdit}
                    className="text-xs font-bold text-amber-800 hover:underline"
                  >
                    Quay lại chọn lại
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubmitResult({ status: "idle" })}
                    className="text-[11px] text-amber-700 hover:underline"
                  >
                    Thử lại
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
