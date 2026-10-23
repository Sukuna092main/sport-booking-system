import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  Copy,
  CheckCircle,
  XCircle,
  MapPin,
  Tag,
} from "lucide-react"
import { useMyBooking, useCancelMyBooking } from "@/features/bookings/useBookings"
import { useCourtById, useSportTypes } from "@/features/courts/useCourts"
import { fmtTime, formatReferencePrice } from "@/features/bookings/consecutiveSlots"

export function BookingDetailPage() {
  const { bookingId } = useParams<{ bookingId: string }>()
  const navigate = useNavigate()
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedId, setCopiedId] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [currentTime] = useState(() => Date.now())

  const { data: booking, isLoading, error } = useMyBooking(bookingId ?? "")
  const { data: court } = useCourtById(booking?.courtId ?? "")
  const { data: sportTypes } = useSportTypes()
  const cancelMutation = useCancelMyBooking()

  const sportTypeMap = Object.fromEntries(
    (sportTypes ?? []).map((st) => [st.id, st.name])
  )
  const sportName = court ? (sportTypeMap[court.sportTypeId] ?? "THỂ THAO") : "THỂ THAO"

  if (isLoading) {
    return (
      <section className="py-8">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
          Đang tải thông tin booking…
        </div>
      </section>
    )
  }

  if (error || !booking) {
    return (
      <section className="py-8">
        <button
          onClick={() => navigate("/bookings")}
          className="mb-4 flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Quay lại danh sách Booking
        </button>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-rose-500 mb-2" />
          <h2 className="text-base font-bold text-rose-900">Không tìm thấy thông tin đặt sân</h2>
          <p className="mt-1 text-xs text-rose-700">
            Booking không tồn tại hoặc bạn không có quyền truy cập thông tin này.
          </p>
          <button
            onClick={() => navigate("/bookings")}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2 text-xs font-bold text-white hover:bg-gray-800"
          >
            Về trang Booking của tôi
          </button>
        </div>
      </section>
    )
  }

  const slotCount = booking.slots?.length ?? 0
  const sortedSlots = [...(booking.slots ?? [])].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
  )
  const firstSlotStart = sortedSlots.length > 0 ? new Date(sortedSlots[0].startsAt) : null

  const isConfirmed = booking.status === "CONFIRMED"
  const isPastStart = firstSlotStart ? firstSlotStart.getTime() <= currentTime : false
  const canCancel = isConfirmed && !isPastStart

  const timeRangeText =
    sortedSlots.length > 0
      ? `${fmtTime(sortedSlots[0].startsAt)} – ${fmtTime(sortedSlots[sortedSlots.length - 1].endsAt)}`
      : "—"

  const priceInfo = formatReferencePrice(
    court?.referencePriceAmount,
    court?.referencePriceCurrency,
    slotCount
  )

  const [by, bm, bd] = (booking.bookingDate || "").split("-").map(Number)
  const bookingDateObj = by && bm && bd ? new Date(by, bm - 1, bd) : null
  const formattedBookingDate = bookingDateObj
    ? `${bookingDateObj.toLocaleDateString("vi-VN", {
        weekday: "long",
      })}, ${bookingDateObj.toLocaleDateString("vi-VN")}`
    : booking.bookingDate

  function handleCopyCode() {
    if (booking?.bookingCode) {
      navigator.clipboard.writeText(booking.bookingCode)
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 2000)
    }
  }

  function handleCopyId() {
    if (booking?.id) {
      navigator.clipboard.writeText(booking.id)
      setCopiedId(true)
      setTimeout(() => setCopiedId(false), 2000)
    }
  }

  async function handleConfirmCancel() {
    if (!booking) return
    setCancelError(null)
    try {
      await cancelMutation.mutateAsync(booking.id)
      setShowCancelModal(false)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message
      setCancelError(msg || "Không thể hủy booking. Vui lòng thử lại sau.")
    }
  }

  return (
    <section className="py-4 max-w-4xl">
      {/* Top Navigation */}
      <div className="mb-4 flex items-center justify-between">
        <Link
          to="/bookings"
          className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Danh sách Booking của tôi
        </Link>
        <Link
          to="/courts"
          className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition-colors"
        >
          Đặt thêm sân khác →
        </Link>
      </div>

      {/* Main Card */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {/* Header Banner */}
        <div className="border-b border-gray-100 bg-gray-50/60 p-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#16A34A]">
                CHI TIẾT BOOKING
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-black uppercase tracking-wider ${
                  isConfirmed
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-gray-200 text-gray-700"
                }`}
              >
                {isConfirmed ? (
                  <>
                    <CheckCircle className="h-3 w-3 text-emerald-600" />
                    CONFIRMED
                  </>
                ) : (
                  <>
                    <XCircle className="h-3 w-3 text-gray-500" />
                    CANCELLED
                  </>
                )}
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-black text-gray-900 flex items-center gap-2">
              <span>{booking.bookingCode}</span>
              <button
                type="button"
                onClick={handleCopyCode}
                title="Sao chép mã booking"
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700 transition-colors"
              >
                <Copy className="h-4 w-4" />
              </button>
              {copiedCode && <span className="text-xs text-emerald-600 font-medium">Đã sao chép!</span>}
            </h1>
            <p className="text-xs text-gray-400 font-mono mt-0.5 flex items-center gap-1.5">
              <span>ID: {booking.id}</span>
              <button
                type="button"
                onClick={handleCopyId}
                title="Sao chép ID"
                className="hover:text-gray-700 transition-colors"
              >
                <Copy className="h-3 w-3" />
              </button>
              {copiedId && <span className="text-[10px] text-emerald-600 font-sans">Đã sao chép</span>}
            </p>
          </div>

          {/* Quick court badge */}
          <div className="text-right">
            <span className="inline-block rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">
              {sportName}
            </span>
            <p className="mt-0.5 text-base font-black text-gray-900">
              {court?.name ?? "Sân thể thao"}
            </p>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6">
          {/* Grid Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
              <p className="text-[10px] font-bold uppercase text-gray-400">Ngày đặt</p>
              <p className="mt-1 text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-emerald-600" />
                {formattedBookingDate}
              </p>
            </div>

            <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
              <p className="text-[10px] font-bold uppercase text-gray-400">Khung giờ</p>
              <p className="mt-1 text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-emerald-600" />
                {timeRangeText}
              </p>
            </div>

            <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
              <p className="text-[10px] font-bold uppercase text-gray-400">Tổng số slot</p>
              <p className="mt-1 text-sm font-bold text-gray-900">
                {slotCount} slot liên tiếp
              </p>
            </div>

            <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
              <p className="text-[10px] font-bold uppercase text-gray-400">Giá tham chiếu (MVP)</p>
              <p className="mt-1 text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-emerald-600" />
                {priceInfo.totalText}
              </p>
            </div>
          </div>

          {/* Slots list */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
              Danh sách TimeSlot đã đặt ({slotCount})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {sortedSlots.map((s, idx) => (
                <div
                  key={s.timeSlotId || idx}
                  className="flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50/40 px-3.5 py-2.5 text-xs"
                >
                  <span className="font-semibold text-emerald-900">
                    Slot #{idx + 1}: {fmtTime(s.startsAt)} – {fmtTime(s.endsAt)}
                  </span>
                  <span className="font-mono text-[10px] text-emerald-700">
                    ID: {s.timeSlotId.substring(0, 8)}…
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Court location */}
          <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4 flex items-start gap-3">
            <MapPin className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-bold text-gray-800">{court?.name} (Mã: {court?.code})</p>
              <p className="text-gray-500 mt-0.5">{court?.description ?? "Khu liên hợp thể thao Riverside Sports Center"}</p>
            </div>
          </div>

          {/* Timestamps & Audit Note */}
          <div className="border-t border-gray-100 pt-4 flex flex-wrap items-center justify-between text-xs text-gray-400">
            <div>
              Thời điểm tạo: {new Date(booking.createdAt).toLocaleString("vi-VN")}
              {booking.cancelledAt && (
                <span className="ml-3 text-rose-600">
                  · Thời điểm hủy: {new Date(booking.cancelledAt).toLocaleString("vi-VN")}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-emerald-700">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Giao dịch atomic đảm bảo an toàn</span>
            </div>
          </div>
        </div>

        {/* Action Footer */}
        <div className="border-t border-gray-100 bg-gray-50/40 p-6 flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => navigate("/bookings")}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors"
          >
            Quay lại danh sách
          </button>

          {canCancel && (
            <button
              type="button"
              onClick={() => setShowCancelModal(true)}
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition-colors"
            >
              Hủy booking này
            </button>
          )}

          {!canCancel && isConfirmed && isPastStart && (
            <span className="text-xs font-medium text-gray-400">
              Không thể hủy booking sau thời điểm bắt đầu (SRS BR-14).
            </span>
          )}

          {!isConfirmed && (
            <span className="text-xs font-medium text-gray-400">
              Booking này đã bị hủy.
            </span>
          )}
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <AlertTriangle className="h-6 w-6" />
              <h3 className="text-lg font-black text-gray-900">Xác nhận hủy booking</h3>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              Bạn có chắc chắn muốn hủy booking <span className="font-mono font-bold text-gray-900">{booking.bookingCode}</span>?
              Theo quy tắc MVP (SRS BR-14), thao tác này không thu phí và chỉ áp dụng trước giờ bắt đầu slot đầu tiên.
            </p>

            {cancelError && (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                {cancelError}
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={cancelMutation.isPending}
                onClick={() => setShowCancelModal(false)}
                className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
              >
                Không, giữ booking
              </button>
              <button
                type="button"
                disabled={cancelMutation.isPending}
                onClick={handleConfirmCancel}
                className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {cancelMutation.isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Đang xử lý hủy…
                  </>
                ) : (
                  "Xác nhận hủy"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
