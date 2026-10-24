import { useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import {
  CalendarDays,
  Clock,
  ArrowRight,
  CheckCircle,
  XCircle,
  Plus,
  Loader2,
  Inbox,
  AlertTriangle,
  RotateCcw,
  Copy,
  MapPin,
  Ban,
} from "lucide-react"
import { useAuth } from "@/features/auth/useAuth"
import { useMyBookings, useCancelMyBooking } from "@/features/bookings/useBookings"
import { useCourts, useSportTypes } from "@/features/courts/useCourts"
import type { BookingItem, BookingStatus } from "@/features/bookings/types"
import { fmtTime } from "@/features/bookings/consecutiveSlots"
import {
  checkBookingCancellationEligibility,
  formatBookingDateDisplay,
  parseCancelError,
} from "@/features/bookings/cancellation"

export function BookingsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [statusFilter, setStatusFilter] = useState<BookingStatus | "ALL">("ALL")
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  // Cancellation modal state
  const [cancellingBooking, setCancellingBooking] = useState<BookingItem | null>(null)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [cancelSuccessMsg, setCancelSuccessMsg] = useState<string | null>(null)
  const [now] = useState(() => Date.now())

  // API Queries
  const { data, isLoading, isError, error, refetch } = useMyBookings(
    statusFilter === "ALL" ? undefined : { status: statusFilter }
  )
  const { data: courtsData } = useCourts({ pageSize: 100 })
  const { data: sportTypes } = useSportTypes()
  const cancelMutation = useCancelMyBooking()

  // Map courts and sport types for fast lookup
  const courtMap = useMemo(() => {
    return new Map((courtsData?.data ?? []).map((c) => [c.id, c]))
  }, [courtsData])

  const sportTypeMap = useMemo(() => {
    return new Map((sportTypes ?? []).map((st) => [st.id, st.name]))
  }, [sportTypes])

  const bookings = data?.data ?? []

  function handleCopyCode(code: string, e: React.MouseEvent) {
    e.stopPropagation()
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  async function handleConfirmCancel() {
    if (!cancellingBooking) return
    setCancelError(null)

    try {
      await cancelMutation.mutateAsync(cancellingBooking.id)
      const code = cancellingBooking.bookingCode
      setCancellingBooking(null)
      setCancelSuccessMsg(`Đã hủy thành công booking ${code}. Khung giờ đã được giải phóng.`)
      setTimeout(() => setCancelSuccessMsg(null), 5000)
    } catch (err: unknown) {
      const parsed = parseCancelError(err)
      setCancelError(parsed.message)
    }
  }

  return (
    <section className="py-4">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-gray-100">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#16A34A]">
            LỊCH SỬ ĐẶT SÂN
          </p>
          <h1 className="mt-0.5 text-3xl font-black tracking-tight text-gray-900">
            BOOKING CỦA TÔI
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Theo dõi danh sách các lượt đặt sân, thông tin sân và trạng thái của bạn
          </p>
        </div>

        <Link
          to="/courts"
          className="flex items-center gap-2 rounded-xl bg-[#B4FF00] px-4 py-2.5 text-xs font-black text-gray-900 transition-all hover:bg-[#AAEF00] active:scale-[0.99] shadow-xs"
        >
          <Plus className="h-4 w-4" />
          Đặt sân mới
        </Link>
      </div>

      {/* Success Notification Banner */}
      {cancelSuccessMsg && (
        <div
          role="status"
          className="mt-4 flex items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-xs text-emerald-800 animate-in fade-in"
        >
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{cancelSuccessMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setCancelSuccessMsg(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-bold"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="mt-6 flex items-center gap-2 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setStatusFilter("ALL")}
          className={`pb-3 text-xs font-bold transition-colors border-b-2 -mb-px ${
            statusFilter === "ALL"
              ? "border-emerald-600 text-emerald-800"
              : "border-transparent text-gray-400 hover:text-gray-700"
          }`}
        >
          Tất cả {data?.meta?.total !== undefined ? `(${data.meta.total})` : `(${bookings.length})`}
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("CONFIRMED")}
          className={`pb-3 text-xs font-bold transition-colors border-b-2 -mb-px ${
            statusFilter === "CONFIRMED"
              ? "border-emerald-600 text-emerald-800"
              : "border-transparent text-gray-400 hover:text-gray-700"
          }`}
        >
          Đã xác nhận (CONFIRMED)
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("CANCELLED")}
          className={`pb-3 text-xs font-bold transition-colors border-b-2 -mb-px ${
            statusFilter === "CANCELLED"
              ? "border-emerald-600 text-emerald-800"
              : "border-transparent text-gray-400 hover:text-gray-700"
          }`}
        >
          Đã hủy (CANCELLED)
        </button>
      </div>

      {/* Bookings List Content */}
      <div className="mt-6">
        {isLoading ? (
          <div className="py-16 text-center text-xs text-gray-400 flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
            <span>Đang tải danh sách booking của bạn…</span>
          </div>
        ) : isError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-10 text-center shadow-xs">
            <AlertTriangle className="mx-auto h-10 w-10 text-rose-500 mb-3" />
            <h3 className="text-base font-bold text-rose-900">Không thể tải danh sách booking</h3>
            <p className="mt-1 text-xs text-rose-700 max-w-sm mx-auto">
              {error instanceof Error ? error.message : "Đã có lỗi xảy ra khi kết nối máy chủ. Vui lòng thử lại."}
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-gray-800 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Tải lại danh sách
            </button>
          </div>
        ) : bookings.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-xs">
            <Inbox className="mx-auto h-12 w-12 text-gray-300 mb-3" />
            <h3 className="text-base font-bold text-gray-800">Chưa có lượt đặt sân nào</h3>
            <p className="mt-1 text-xs text-gray-400 max-w-sm mx-auto">
              {statusFilter === "ALL"
                ? "Bạn chưa có booking nào trong hệ thống. Hãy chọn sân thể thao yêu thích để bắt đầu trải nghiệm!"
                : `Không có booking nào với trạng thái ${statusFilter}.`}
            </p>
            <Link
              to="/courts"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-gray-800 transition-colors"
            >
              Xem danh sách sân ngay
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {bookings.map((b) => {
              const isConfirmed = b.status === "CONFIRMED"
              const slotCount = b.slots?.length ?? 0
              const sorted = [...(b.slots ?? [])].sort(
                (x, y) => new Date(x.startsAt).getTime() - new Date(y.startsAt).getTime()
              )
              const timeRange =
                sorted.length > 0
                  ? `${fmtTime(sorted[0].startsAt)} – ${fmtTime(sorted[sorted.length - 1].endsAt)}`
                  : "—"

              const court = courtMap.get(b.courtId)
              const sportName = court
                ? sportTypeMap.get(court.sportTypeId) ?? "THỂ THAO"
                : "THỂ THAO"
              const courtDisplayName = court?.name ?? `Sân #${b.courtId.slice(0, 8)}`

              const dateDisplay = formatBookingDateDisplay(b.bookingDate)

              // Check business rule for cancel eligibility
              const cancelEligibility = checkBookingCancellationEligibility(
                b,
                user?.id,
                now
              )

              return (
                <div
                  key={b.id}
                  className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs hover:border-emerald-300 transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Header: code & status badge */}
                    <div className="flex items-center justify-between gap-2 pb-3 border-b border-gray-100">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-sm font-black text-gray-900">
                          {b.bookingCode}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleCopyCode(b.bookingCode, e)}
                          title="Sao chép mã booking"
                          className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                        {copiedCode === b.bookingCode && (
                          <span className="text-[10px] text-emerald-600 font-semibold">Đã sao chép!</span>
                        )}
                      </div>

                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          isConfirmed
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {isConfirmed ? (
                          <>
                            <CheckCircle className="h-3 w-3 text-emerald-600" />
                            CONFIRMED
                          </>
                        ) : (
                          <>
                            <XCircle className="h-3 w-3 text-gray-400" />
                            CANCELLED
                          </>
                        )}
                      </span>
                    </div>

                    {/* Court Info */}
                    <div className="mt-3 flex items-start gap-2">
                      <MapPin className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <span className="inline-block rounded bg-emerald-50 px-1.5 py-0.2 text-[9px] font-bold uppercase text-emerald-700 mb-0.5">
                          {sportName}
                        </span>
                        <p className="text-xs font-bold text-gray-900 truncate" title={courtDisplayName}>
                          {courtDisplayName}
                        </p>
                        {court?.code && (
                          <p className="text-[10px] text-gray-400 font-mono">Mã: {court.code}</p>
                        )}
                      </div>
                    </div>

                    {/* Date & Time */}
                    <div className="mt-3 space-y-1.5 text-xs bg-gray-50/60 p-2.5 rounded-xl border border-gray-100">
                      <div className="flex items-center gap-2 text-gray-700">
                        <CalendarDays className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span className="font-semibold text-gray-900">{dateDisplay}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-700">
                        <Clock className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span>
                          {timeRange} ({slotCount} slot)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                    <span className="text-[10px] text-gray-400">
                      {isConfirmed
                        ? `Đặt lúc ${new Date(b.createdAt).toLocaleDateString("vi-VN")}`
                        : b.cancelledAt
                        ? `Đã hủy ${new Date(b.cancelledAt).toLocaleDateString("vi-VN")}`
                        : "Đã hủy"}
                    </span>

                    <div className="flex items-center gap-2">
                      {cancelEligibility.canCancel && (
                        <button
                          type="button"
                          onClick={() => {
                            setCancellingBooking(b)
                            setCancelError(null)
                          }}
                          className="font-bold text-rose-600 hover:text-rose-700 hover:underline inline-flex items-center gap-1 text-[11px]"
                        >
                          <Ban className="h-3 w-3" />
                          Hủy
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => navigate(`/bookings/${b.id}`)}
                        className="font-bold text-emerald-700 hover:text-emerald-800 hover:underline inline-flex items-center gap-1 text-[11px]"
                      >
                        Chi tiết
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Cancellation Confirmation Dialog */}
      {cancellingBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <h3 className="text-lg font-black text-gray-900">Xác nhận hủy đặt sân</h3>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Bạn có chắc chắn muốn hủy booking{" "}
              <span className="font-mono font-bold text-gray-900">
                {cancellingBooking.bookingCode}
              </span>
              ?
            </p>

            {/* Booking Summary in Modal */}
            <div className="my-3 rounded-xl border border-gray-100 bg-gray-50/80 p-3 text-xs space-y-1">
              <p className="font-bold text-gray-900">
                {courtMap.get(cancellingBooking.courtId)?.name ?? "Sân thể thao"}
              </p>
              <p className="text-gray-600 flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-emerald-600" />
                {formatBookingDateDisplay(cancellingBooking.bookingDate)}
              </p>
              <p className="text-gray-500 text-[11px] pt-1 border-t border-gray-200/60">
                Theo quy định hệ thống (SRS BR-14), thao tác hủy sẽ giải phóng khung giờ đã chọn cho người dùng khác và không thể hoàn tác.
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
                  setCancellingBooking(null)
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