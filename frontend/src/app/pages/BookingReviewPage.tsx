import { useState } from "react"
import { Link, Navigate, useNavigate } from "react-router-dom"
import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, Clock3, Loader2 } from "lucide-react"
import { bookingsApi, type BookingRecord } from "@/features/bookings/api"
import { paymentsApi } from "@/features/bookings/payments"
import type { BookingReviewHandoffData, CreateBookingPayload } from "@/features/bookings/types"

function readSession<T>(key: string): T | null {
  try {
    const value = sessionStorage.getItem(key)
    return value ? JSON.parse(value) as T : null
  } catch {
    return null
  }
}

function errorMessage(error: unknown): string {
  const response = (error as { response?: { data?: { error?: { message?: string } } } })?.response
  return response?.data?.error?.message ?? "Không kết nối được máy chủ. Kiểm tra kết nối rồi thử lại."
}

const vnd = (amount?: number) => amount == null ? "Máy chủ sẽ xác nhận" : `${amount.toLocaleString("vi-VN")} ₫`

export function BookingReviewPage() {
  const navigate = useNavigate()
  const [review] = useState(() => readSession<BookingReviewHandoffData>("pending_booking_review"))
  const [payload] = useState(() => readSession<CreateBookingPayload>("pending_booking_payload"))
  const [booking, setBooking] = useState<BookingRecord | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  if (!review || !payload) {
    return <Navigate to="/courts" replace />
  }

  async function confirmBooking() {
    if (!payload) return
    setIsSubmitting(true)
    setError("")
    try {
      let key = sessionStorage.getItem("pending_booking_idempotency_key")
      if (!key) {
        key = crypto.randomUUID()
        sessionStorage.setItem("pending_booking_idempotency_key", key)
      }
      const created = await bookingsApi.create(payload, key)
      setBooking(created)
      if (created.status === "PENDING_PAYMENT") {
        sessionStorage.setItem("active_payment_booking_id", created.id)
        const payment = await paymentsApi.start(created.id)
        if (payment.provider === "mock") {
          navigate(`/mock-payment?ref=${encodeURIComponent(payment.providerOrderRef)}&bookingId=${encodeURIComponent(created.id)}`)
        } else if (payment.checkoutUrl) {
          window.location.assign(payment.checkoutUrl)
        } else {
          throw new Error("Cổng thanh toán chưa trả về đường dẫn checkout.")
        }
        return
      }
      sessionStorage.removeItem("pending_booking_payload")
      sessionStorage.removeItem("pending_booking_review")
      sessionStorage.removeItem("pending_booking_idempotency_key")
    } catch (submitError) {
      setError(errorMessage(submitError))
    } finally {
      setIsSubmitting(false)
    }
  }

  const timeRange = review.selectedSlots.length
    ? `${review.selectedSlots[0].formattedRange.split(" - ")[0]} – ${review.selectedSlots.at(-1)?.formattedRange.split(" - ")[1]}`
    : review.timeRangeText

  return (
    <section className="mx-auto max-w-5xl py-6">
      <Link to={`/courts/${review.courtId}/availability`} className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-900">
        <ArrowLeft className="h-4 w-4" /> Quay lại chọn giờ
      </Link>
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <article className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Xác nhận lựa chọn</p>
          <h1 className="mt-1 text-3xl font-black text-gray-900">{review.courtName}</h1>
          <p className="mt-1 text-sm text-gray-500">{review.locationText}</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-gray-50 p-4">
              <CalendarDays className="mb-2 h-5 w-5 text-emerald-700" />
              <p className="text-xs text-gray-500">Ngày chơi</p>
              <p className="font-bold text-gray-900">{review.formattedDate}</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <Clock3 className="mb-2 h-5 w-5 text-emerald-700" />
              <p className="text-xs text-gray-500">Thời gian</p>
              <p className="font-bold text-gray-900">{timeRange} · {review.durationText}</p>
            </div>
          </div>
          <div className="mt-6">
            <p className="mb-2 text-sm font-bold text-gray-700">Các khung giờ</p>
            <div className="flex flex-wrap gap-2">
              {review.selectedSlots.map((slot) => (
                <span key={slot.id} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
                  {slot.formattedRange}
                </span>
              ))}
            </div>
          </div>
          {booking && (
            <div role="status" className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              <p className="flex items-center gap-2 font-bold"><CheckCircle2 className="h-4 w-4" /> Booking đã được tạo</p>
              <p className="mt-1">Mã booking: <span className="font-mono font-bold">{booking.bookingCode}</span></p>
              <p>Trạng thái: {booking.status}</p>
            </div>
          )}
        </article>

        <aside className="h-fit rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-black text-gray-900">Tóm tắt</h2>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-3"><span className="text-gray-500">Số slot</span><b>{review.selectedSlots.length}</b></div>
            <div className="flex justify-between gap-3"><span className="text-gray-500">Tổng tiền</span><b>{vnd(booking?.totalAmountVnd)}</b></div>
            <div className="flex justify-between gap-3"><span className="text-gray-500">Tiền cọc</span><b>{vnd(booking?.depositAmountVnd)}</b></div>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-gray-500">Giá và khả năng giữ slot do máy chủ xác nhận khi gửi yêu cầu. Nếu có bật thanh toán, booking chỉ được xác nhận sau khi cổng thanh toán báo giao dịch thành công.</p>
          {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {booking?.status === "CONFIRMED" ? (
            <Link to="/bookings" className="mt-5 flex w-full items-center justify-between rounded-xl bg-[#B4FF00] px-5 py-3.5 text-sm font-bold text-gray-900">
              Xem booking <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <button type="button" onClick={confirmBooking} disabled={isSubmitting} className="mt-5 flex w-full items-center justify-between rounded-xl bg-[#B4FF00] px-5 py-3.5 text-sm font-bold text-gray-900 disabled:opacity-60">
              {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Đang xử lý…</> : <>Xác nhận đặt sân <ArrowRight className="h-4 w-4" /></>}
            </button>
          )}
          <Link to="/bookings" className="mt-4 block text-center text-sm font-semibold text-emerald-700 hover:underline">Lịch đặt sân của tôi</Link>
        </aside>
      </div>
    </section>
  )
}
