import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  AlertTriangle,
  Loader2,
  ShieldCheck,
  CalendarDays,
  Clock,
  Tag,
  MapPin,
  AlertCircle,
  Calendar,
  CreditCard,
  MailCheck,
} from "lucide-react"
import type {
  BookingItem,
  BookingReviewHandoffData,
} from "@/features/bookings/types"
import {
  formatReferencePrice,
  validateBookingReview,
} from "@/features/bookings/consecutiveSlots"
import { useCourtById } from "@/features/courts/useCourts"
import { bookingsApi, generateIdempotencyKey } from "@/lib/api/bookings"
import { saveMockBooking } from "@/features/bookings/useBookings"
import { paymentsApi } from "@/lib/api/payments"
import { AxiosError } from "axios"
import type { ApiErrorResponse } from "@/types/auth.types"

export function BookingReviewPage() {
  const navigate = useNavigate()

  // 1. Nhận dữ liệu Court/Date/Selected Slots từ Availability UI qua sessionStorage
  const reviewData: BookingReviewHandoffData | null = (() => {
    try {
      const stored = sessionStorage.getItem("pending_booking_review")
      if (stored) {
        return JSON.parse(stored) as BookingReviewHandoffData
      }
    } catch {
      // fallback
    }
    return null
  })()

  // Fresh court data query to ensure latest constraints and reference price
  const { data: court } = useCourtById(reviewData?.courtId ?? "")

  // Real pricing per slot from backend
  const [courtPricing, setCourtPricing] = useState<{ pricePerSlotVnd: number } | null>(null)

  useEffect(() => {
    if (reviewData?.courtId) {
      paymentsApi
        .getCourtPricing(reviewData.courtId)
        .then((res) => {
          if (res.data?.pricePerSlotVnd) {
            setCourtPricing(res.data)
          }
        })
        .catch(() => setCourtPricing(null))
    }
  }, [reviewData?.courtId])

  // Idempotency Key state (opaque, 1-128 chars, unique per attempt / preserved on retry)
  const [idempotencyKey] = useState<string>(() => generateIdempotencyKey())

  // Submit states
  const [isSubmitting, setIsSubmitting] = useState(false)
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

  // If no review data exists in session storage, guide user to select court first
  if (!reviewData) {
    return (
      <div className="py-12">
        <div className="mx-auto max-w-lg rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-xs">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <Calendar className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-xl font-black text-gray-900">
            Chưa có thông tin đặt sân
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-gray-500">
            Bạn chưa chọn sân hoặc khung giờ nào. Vui lòng khám phá danh sách sân thể thao và chọn khung giờ bạn muốn đặt trước khi xác nhận.
          </p>
          <div className="mt-6 flex justify-center">
            <Link
              to="/courts"
              className="flex items-center gap-2 rounded-xl bg-[#B4FF00] px-5 py-3 text-xs font-black text-gray-900 transition-colors hover:bg-[#AAEF00]"
            >
              <span>Khám phá danh sách sân ngay</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    )
  }

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

  // Real pricing calculations
  const pricePerSlot = courtPricing?.pricePerSlotVnd || 0
  const totalCalculatedVnd = pricePerSlot > 0 ? pricePerSlot * slotCount : 0
  const depositCalculatedVnd = totalCalculatedVnd > 0 ? Math.floor((totalCalculatedVnd * 3000) / 10000) : 0
  const remainingCalculatedVnd = totalCalculatedVnd - depositCalculatedVnd

  // Hiển thị giá tham chiếu và tổng số slot
  const priceInfo = formatReferencePrice(priceAmount, priceCurrency, slotCount)

  // Validate slot selection trước khi gửi request
  const validation = validateBookingReview(
    reviewData.bookingDate,
    reviewData.selectedSlots,
    {
      minConsecutiveSlots: minSlots,
      maxConsecutiveSlots: maxSlots,
    }
  )

  async function handleConfirmBooking() {
    if (isSubmitting || !validation.isValid || !reviewData) return

    setIsSubmitting(true)
    setSubmitResult({ status: "idle" })

    try {
      const response = await bookingsApi.createBooking(
        reviewData.payload,
        idempotencyKey
      )
      const createdBooking = response.data
      saveMockBooking(createdBooking)
      sessionStorage.removeItem("pending_booking_review")
      sessionStorage.removeItem("pending_booking_payload")

      // If booking requires payment, initiate checkout session
      if (createdBooking.status === "PENDING_PAYMENT") {
        sessionStorage.setItem("pending_booking_id", createdBooking.id)
        try {
          const payRes = await paymentsApi.startPayment(createdBooking.id)
          if (payRes.data.checkoutUrl) {
            const url = payRes.data.checkoutUrl
            if (url.startsWith("http://") || url.startsWith("https://")) {
              if (url.includes(window.location.host)) {
                const parsedUrl = new URL(url)
                navigate(parsedUrl.pathname + parsedUrl.search)
              } else {
                window.location.href = url
              }
            } else {
              navigate(url)
            }
            return
          }
        } catch {
          // If starting checkout fails, display result state with button
        }
      }

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

        // 409 Conflict
        if (status === 409) {
          setSubmitResult({
            status: "conflict",
            errorEnvelope: {
              code: errData?.error?.code || "slot_unavailable",
              message:
                errData?.error?.message ||
                "Khung giờ bạn chọn đã bị người khác đặt trước hoặc không còn khả dụng.",
              requestId: errData?.error?.requestId || "",
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
              requestId: errData?.error?.requestId || "",
              details: errData?.error?.details,
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
              requestId: errData?.error?.requestId || "",
            },
          })
          return
        }

        if (errData?.error) {
          setSubmitResult({
            status: "error",
            errorEnvelope: errData.error,
          })
          return
        }
      }

      setSubmitResult({
        status: "error",
        errorEnvelope: {
          code: "internal_error",
          message:
            "Không thể kết nối đến máy chủ hoặc timeout mạng. Vui lòng kiểm tra danh sách Booking trước khi gửi lại.",
          requestId: "",
        },
      })
    }
  }

  function handleBackToEdit() {
    if (!reviewData) return
    navigate(`/courts/${reviewData.courtId}/availability?date=${reviewData.bookingDate}`)
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
      </div>

      {/* Two columns layout */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Left Column: Court & Slot Summary */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
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

            {/* Details Grid */}
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

            {/* Real Payment Pricing or Reference Price */}
            <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50/80 p-4">
              {courtPricing && courtPricing.pricePerSlotVnd > 0 ? (
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-gray-200/70">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900">
                      <CreditCard className="h-4 w-4 text-emerald-600" />
                      <span>Chi phí đặt sân & Đặt cọc</span>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                      CỌC 30% ONLINE
                    </span>
                  </div>

                  <div className="mt-3 space-y-2 text-xs">
                    <div className="flex justify-between text-gray-600">
                      <span>Đơn giá mỗi slot:</span>
                      <span className="font-semibold text-gray-900">
                        {pricePerSlot.toLocaleString("vi-VN")} VND / slot
                      </span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Tổng tiền ({slotCount} slot):</span>
                      <span className="font-bold text-gray-900">
                        {totalCalculatedVnd.toLocaleString("vi-VN")} VND
                      </span>
                    </div>
                    <div className="flex justify-between text-emerald-900 font-bold border-t border-gray-200/60 pt-2">
                      <span>Số tiền cọc trực tuyến (30%):</span>
                      <span className="text-sm font-black text-emerald-700">
                        {depositCalculatedVnd.toLocaleString("vi-VN")} VND
                      </span>
                    </div>
                    <div className="flex justify-between text-gray-500 text-[11px]">
                      <span>Số tiền còn lại thanh toán tại sân:</span>
                      <span>{remainingCalculatedVnd.toLocaleString("vi-VN")} VND</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
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
                      Giá tham chiếu mang tính đối chiếu. Bạn có thể thanh toán khi đến sân.
                    </span>
                  </p>
                </div>
              )}
            </div>

            {/* Validation Banner */}
            <div className="mt-6">
              {validation.isValid ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                    <ShieldCheck className="h-4 w-4 text-emerald-700" />
                    Kiểm tra điều kiện đặt sân: Hợp lệ
                  </div>
                  <p className="mt-1 text-xs text-emerald-800 leading-relaxed">
                    Các slot cùng sân, cùng ngày, liên tiếp và nằm trong giới hạn {minSlots}–{maxSlots} slot. Giao dịch sẽ được xác nhận an toàn tại máy chủ.
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
          </div>
        </div>

        {/* Right Column: Submission Controls */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm h-fit">
            <h2 className="text-base font-black text-gray-900">
              Xác nhận & Hoàn tất
            </h2>
            <p className="mt-1 text-xs text-gray-500 leading-relaxed">
              Vui lòng kiểm tra kỹ thông tin trước khi nhấn xác nhận. Bạn có thể chủ động hủy lịch trước giờ mở sân nếu có thay đổi.
            </p>

            {/* Submit button */}
            <button
              id="review-confirm-button"
              type="button"
              disabled={isSubmitting || !validation.isValid || submitResult.status === "success"}
              onClick={handleConfirmBooking}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#B4FF00] px-5 py-3.5 text-sm font-black text-gray-900 transition-all hover:bg-[#AAEF00] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-gray-900" />
                  Đang xử lý đặt sân…
                </>
              ) : submitResult.status === "success" ? (
                <>
                  <CheckCircle className="h-4 w-4 text-emerald-800" />
                  Đã đặt sân thành công
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

            {/* Success state */}
            {submitResult.status === "success" && (
              <div
                role="alert"
                className="mt-5 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-xs text-emerald-950 animate-in fade-in"
              >
                <div className="flex items-center gap-2 font-black text-sm text-emerald-900">
                  <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
                  {submitResult.booking?.status === "PENDING_PAYMENT"
                    ? "Đã tạo đơn đặt sân — Chờ đặt cọc"
                    : "Đặt sân thành công!"}
                </div>
                <div className="mt-3 space-y-1.5 rounded-xl bg-white/80 p-3 border border-emerald-100">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 font-medium">Mã booking:</span>
                    <span className="font-mono font-black text-sm text-emerald-800">
                      {submitResult.bookingCode}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-500">Trạng thái:</span>
                    <span className={`font-bold ${submitResult.booking?.status === "PENDING_PAYMENT" ? "text-amber-700" : "text-emerald-700"}`}>
                      {submitResult.booking?.status || "CONFIRMED"}
                    </span>
                  </div>
                  {submitResult.booking?.status === "PENDING_PAYMENT" && depositCalculatedVnd > 0 && (
                    <div className="flex items-center justify-between text-[11px] border-t border-emerald-100/60 pt-1.5">
                      <span className="text-gray-500">Tiền cọc cần thanh toán (30%):</span>
                      <span className="font-bold text-emerald-800">
                        {depositCalculatedVnd.toLocaleString("vi-VN")} VND
                      </span>
                    </div>
                  )}
                </div>

                {submitResult.booking?.status === "CONFIRMED" ? (
                  <div className="mt-3 rounded-xl border border-emerald-200 bg-white/80 p-2.5 text-[11px] text-emerald-900 flex items-start gap-2">
                    <MailCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      Email xác nhận đã được gửi đến hộp thư của bạn. Hệ thống sẽ tiếp tục gửi email nhắc lịch trước giờ thi đấu 24 tiếng.
                    </span>
                  </div>
                ) : (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/80 p-2.5 text-[11px] text-amber-900 flex items-start gap-2">
                    <Clock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      Vui lòng tiến hành thanh toán cọc trực tuyến để giữ chỗ chính thức.
                    </span>
                  </div>
                )}

                <div className="mt-4 space-y-2">
                  {submitResult.booking?.status === "PENDING_PAYMENT" && submitResult.bookingId && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const res = await paymentsApi.startPayment(submitResult.bookingId!)
                          if (res.data.checkoutUrl) {
                            window.location.href = res.data.checkoutUrl
                          }
                        } catch {
                          navigate(`/bookings/${submitResult.bookingId}`)
                        }
                      }}
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#16A34A] px-4 py-2.5 text-xs font-black text-white hover:bg-[#15803D] transition-colors shadow-xs"
                    >
                      <CreditCard className="h-4 w-4" />
                      Tiến hành thanh toán cọc ngay →
                    </button>
                  )}
                  {submitResult.bookingId && (
                    <button
                      type="button"
                      onClick={() => navigate(`/bookings/${submitResult.bookingId}`)}
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-gray-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-gray-800 transition-colors"
                    >
                      Xem chi tiết Booking này
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => navigate("/bookings")}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Về danh sách Booking của tôi
                  </button>
                </div>
              </div>
            )}

            {/* Conflict Error (409) */}
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

                <div className="mt-3.5 flex flex-col gap-2 pt-2 border-t border-rose-200/80">
                  <button
                    type="button"
                    onClick={handleBackToEdit}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-rose-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-rose-800 transition-colors"
                  >
                    Tải lại lịch sân & Chọn giờ khác
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubmitResult({ status: "idle" })}
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
