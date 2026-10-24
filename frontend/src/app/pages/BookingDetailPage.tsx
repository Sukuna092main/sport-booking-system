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
  Info,
} from "lucide-react"
import { useAuth } from "@/features/auth/useAuth"
import { useMyBooking, useCancelMyBooking } from "@/features/bookings/useBookings"
import { useCourtById, useSportTypes } from "@/features/courts/useCourts"
import { fmtTime, formatReferencePrice } from "@/features/bookings/consecutiveSlots"
import {
  checkBookingCancellationEligibility,
  formatBookingDateDisplay,
  parseCancelError,
} from "@/features/bookings/cancellation"

export function BookingDetailPage() {
  const { bookingId } = useParams<{ bookingId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedId, setCopiedId] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [successBanner, setSuccessBanner] = useState<string | null>(null)
  const [now] = useState(() => Date.now())

  const { data: booking, isLoading, error } = useMyBooking(bookingId ?? "")
  const { data: court } = useCourtById(booking?.courtId ?? "")
  const { data: sportTypes } = useSportTypes()
  const cancelMutation = useCancelMyBooking()

  const sportTypeMap = Object.fromEntries(
    (sportTypes ?? []).map((st) => [st.id, st.name])
  )
  const sportName = court ? sportTypeMap[court.sportTypeId] ?? "THỂ THAO" : "THỂ THAO"

  // 1. Loading state
  if (isLoading) {
    return (
      <section className="py-12 max-w-4xl mx-auto">
        <div className="flex flex-col items-center justify-center gap-3 text-sm text-gray-500">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
          <span>Đang tải thông tin chi tiết booking…</span>
        </div>
      </section>
    )
  }

  // 2. Ownership & Error / Not Found handling
  // Per OpenAPI contract: Non-owned bookings return 404 to avoid leaking existence.
  const isOwner =
    !booking?.customerId || !user?.id || booking.customerId === user.id

  if (error || !booking || !isOwner) {
    return (
      <section className="py-8 max-w-4xl mx-auto">
        <button
          type="button"
          onClick={() => navigate("/bookings")}
          className="mb-4 flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Quay lại danh sách Booking
        </button>

        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center shadow-xs">
          <AlertTriangle className="mx-auto h-10 w-10 text-rose-500 mb-3" />
          <h2 className="text-base font-bold text-rose-900">Không tìm thấy thông tin đặt sân</h2>
          <p className="mt-1 text-xs text-rose-700 max-w-md mx-auto">
            Booking không tồn tại hoặc bạn không có quyền truy cập vào thông tin này (404 Not Found).
          </p>
          <button
            type="button"
            onClick={() => navigate("/bookings")}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-gray-800 transition-colors"
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

  const isConfirmed = booking.status === "CONFIRMED"

  // Check business rules for cancellation
  const cancelEligibility = checkBookingCancellationEligibility(
    booking,
    user?.id,
    now
  )
  const canCancel = cancelEligibility.canCancel

  const timeRangeText =
    sortedSlots.length > 0
      ? `${fmtTime(sortedSlots[0].startsAt)} – ${fmtTime(sortedSlots[sortedSlots.length - 1].endsAt)}`
      : "—"

  const priceInfo = formatReferencePrice(
    court?.referencePriceAmount,
    court?.referencePriceCurrency,
    slotCount
  )

  const formattedBookingDate = formatBookingDateDisplay(booking.bookingDate)

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
      setSuccessBanner(
        `Hủy booking ${booking.bookingCode} thành công! Khung giờ của bạn đã được giải phóng trên hệ thống.`
      )
    } catch (err: unknown) {
      const parsed = parseCancelError(err)
      setCancelError(parsed.message)
    }
  }

  return (
    <section className="py-4 max-w-4xl mx-auto">
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

      {/* Success Notification Banner */}
      {successBanner && (
        <div
          role="status"
          className="mb-4 flex items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-xs text-emerald-800 animate-in fade-in"
        >
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{successBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessBanner(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-bold"
          >
            Đóng
          </button>
        </div>
      )}

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
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                    CONFIRMED
                  </>
                ) : (
                  <>
                    <XCircle className="h-3.5 w-3.5 text-gray-500" />
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

            <div className="text-xs text-gray-400 font-mono mt-0.5 flex items-center gap-1.5">
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
            </div>
          </div>

          {/* Quick court badge */}
          <div className="text-right">
            <span className="inline-block rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">
              {sportName}
            </span>
            <p className="mt-0.5 text-base font-black text-gray-900">
              {court?.name ?? "Sân thể thao"}
            </p>
            {court?.code && (
              <p className="text-[11px] font-mono text-gray-400">Mã: {court.code}</p>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6">
          {/* Grid Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
              <p className="text-[10px] font-bold uppercase text-gray-400">Ngày đặt</p>
              <p className="mt-1 text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span className="truncate">{formattedBookingDate}</span>
              </p>
            </div>

            <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
              <p className="text-[10px] font-bold uppercase text-gray-400">Khung giờ</p>
              <p className="mt-1 text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span>{timeRangeText}</span>
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
                <Tag className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span>{priceInfo.totalText}</span>
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

          {/* Court location card */}
          <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4 flex items-start gap-3">
            <MapPin className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-bold text-gray-800">
                {court?.name ?? "Sân thể thao"} {court?.code ? `(Mã: ${court.code})` : ""}
              </p>
              <p className="text-gray-500 mt-0.5">
                {court?.description ?? "Khu liên hợp thể thao Riverside Sports Center"}
              </p>
            </div>
          </div>

          {/* Timestamps & Audit Note */}
          <div className="border-t border-gray-100 pt-4 flex flex-wrap items-center justify-between text-xs text-gray-400 gap-2">
            <div>
              <span>Thời điểm tạo: {new Date(booking.createdAt).toLocaleString("vi-VN")}</span>
              {booking.cancelledAt && (
                <span className="ml-3 text-rose-600 font-medium">
                  · Thời điểm hủy: {new Date(booking.cancelledAt).toLocaleString("vi-VN")}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-emerald-700">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Giao dịch atomic đảm bảo tính toàn vẹn</span>
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

          {/* Cancel Action Button (only if eligible by business rules) */}
          {canCancel && (
            <button
              type="button"
              onClick={() => {
                setCancelError(null)
                setShowCancelModal(true)
              }}
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition-colors"
            >
              Hủy booking này
            </button>
          )}

          {/* Ineligible states info notes */}
          {!canCancel && isConfirmed && cancelEligibility.code === "PAST_START_TIME" && (
            <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
              <Info className="h-3.5 w-3.5 shrink-0" />
              <span>Không thể hủy booking sau thời điểm bắt đầu slot đầu tiên (SRS BR-14).</span>
            </div>
          )}

          {!isConfirmed && (
            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg">
              Booking này đã bị hủy.
            </span>
          )}
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <h3 className="text-lg font-black text-gray-900">Xác nhận hủy đặt sân</h3>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Bạn có chắc chắn muốn hủy booking{" "}
              <span className="font-mono font-bold text-gray-900">{booking.bookingCode}</span>?
            </p>

            {/* Modal Summary */}
            <div className="my-3 rounded-xl border border-gray-100 bg-gray-50/80 p-3 text-xs space-y-1">
              <p className="font-bold text-gray-900">{court?.name ?? "Sân thể thao"}</p>
              <p className="text-gray-600 flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-emerald-600" />
                <span>{formattedBookingDate} ({timeRangeText})</span>
              </p>
              <p className="text-gray-500 text-[11px] pt-1.5 border-t border-gray-200/60">
                Theo quy định hệ thống (SRS BR-14), thao tác này không thu phí và sẽ giải phóng các khung giờ cho người khác. Thao tác không thể hoàn tác.
              </p>
            </div>

            {cancelError && (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                {cancelError}
              </div>
            )}

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={cancelMutation.isPending}
                onClick={() => {
                  setShowCancelModal(false)
                  setCancelError(null)
                }}
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
