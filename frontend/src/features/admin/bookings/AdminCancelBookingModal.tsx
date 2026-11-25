import { useState } from "react"
import {
  AlertTriangle,
  CalendarDays,
  Clock,
  Loader2,
  MapPin,
  ShieldAlert,
  User,
  X,
} from "lucide-react"
import type { AdminBookingItem } from "@/types/adminBooking.types"
import type { Court } from "@/types/court.types"
import {
  formatAdminBookingDate,
  formatAdminSlotRange,
  parseAdminBookingApiError,
  validateCancelReason,
} from "./adminBookingUtils"
import { useAdminCancelBooking } from "./useAdminBookings"

interface AdminCancelBookingModalProps {
  booking: AdminBookingItem
  court?: Court | null
  sportName?: string
  isOpen: boolean
  onClose: () => void
  onSuccess: (updatedBooking: AdminBookingItem) => void
}

export function AdminCancelBookingModal({
  booking,
  court,
  sportName,
  isOpen,
  onClose,
  onSuccess,
}: AdminCancelBookingModalProps) {
  const [reason, setReason] = useState("")
  const [validationError, setValidationError] = useState<string | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)

  const cancelMutation = useAdminCancelBooking()

  if (!isOpen) return null

  const { rangeText, slotCount, totalMinutes } = formatAdminSlotRange(booking.slots)
  const formattedDate = formatAdminBookingDate(booking.bookingDate)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setValidationError(null)
    setApiError(null)

    const val = validateCancelReason(reason)
    if (!val.isValid) {
      setValidationError(val.error || "Lý do hủy không hợp lệ.")
      return
    }

    try {
      const res = await cancelMutation.mutateAsync({
        bookingId: booking.id,
        payload: { reason: val.trimmed },
      })
      onSuccess(res.data)
      onClose()
    } catch (err: unknown) {
      const parsed = parseAdminBookingApiError(err)
      setApiError(parsed.message)
    }
  }

  function handleClose() {
    if (cancelMutation.isPending) return
    setReason("")
    setValidationError(null)
    setApiError(null)
    onClose()
  }

  const charCount = reason.trim().length
  const isOverLimit = charCount > 500

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-gray-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={handleClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl transition-all animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 ring-4 ring-rose-50">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <h2
                id="cancel-modal-title"
                className="text-lg font-black tracking-tight text-gray-900"
              >
                Xác nhận Hủy Đặt Sân
              </h2>
              <p className="text-xs text-gray-500">
                Thao tác quản trị với ghi nhận kiểm toán (Audit Log)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={cancelMutation.isPending}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Booking Summary Box */}
        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-2.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-gray-500">Mã Booking:</span>
            <span className="font-mono font-black text-gray-900 bg-white px-2 py-0.5 rounded border border-gray-200">
              {booking.bookingCode}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-bold text-gray-500">
              <MapPin className="h-3.5 w-3.5 text-emerald-600" />
              Sân thể thao:
            </span>
            <span className="font-semibold text-gray-800">
              {court?.name ?? "Sân thể thao"} {court?.code ? `(${court.code})` : ""}
              {sportName ? ` · ${sportName}` : ""}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-bold text-gray-500">
              <CalendarDays className="h-3.5 w-3.5 text-blue-600" />
              Ngày đặt:
            </span>
            <span className="font-semibold text-gray-800">
              {formattedDate} ({booking.bookingDate})
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-bold text-gray-500">
              <Clock className="h-3.5 w-3.5 text-amber-600" />
              Khung giờ:
            </span>
            <span className="font-semibold text-gray-800">
              {rangeText} ({slotCount} slot · {totalMinutes} phút)
            </span>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-gray-200/60">
            <span className="flex items-center gap-1.5 font-bold text-gray-500">
              <User className="h-3.5 w-3.5 text-purple-600" />
              Khách hàng (ID):
            </span>
            <span className="font-mono text-[11px] text-gray-600 truncate max-w-[220px]">
              {booking.customerId}
            </span>
          </div>
        </div>

        {/* Warning Note */}
        <div className="mt-3.5 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Hủy booking sẽ giải phóng toàn bộ khung giờ để người khác có thể đặt. Thao tác này
            không thể hoàn tác và lý do hủy sẽ được ghi lại trong nhật ký kiểm toán hệ thống.
          </p>
        </div>

        {/* Error Banners */}
        {apiError && (
          <div
            role="alert"
            className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 animate-in fade-in"
          >
            {apiError}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="cancel-reason"
                className="block text-xs font-bold text-gray-800"
              >
                Lý do hủy của Quản trị viên <span className="text-rose-500">*</span>
              </label>
              <span
                className={`text-[11px] font-mono ${
                  isOverLimit ? "font-bold text-rose-600" : "text-gray-400"
                }`}
              >
                {charCount}/500
              </span>
            </div>
            <textarea
              id="cancel-reason"
              rows={3}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value)
                if (validationError) setValidationError(null)
              }}
              placeholder="Nhập lý do cụ thể (ví dụ: Bảo trì hệ thống điện, sự cố mặt sân đột xuất, yêu cầu từ ban quản lý...)"
              className={`w-full rounded-xl border px-3.5 py-2.5 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 transition-all ${
                validationError || isOverLimit
                  ? "border-rose-300 focus:ring-rose-400 bg-rose-50/30"
                  : "border-gray-200 focus:ring-emerald-500 bg-white"
              }`}
            />
            {validationError && (
              <p className="mt-1 text-[11px] font-medium text-rose-600">
                {validationError}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={handleClose}
              disabled={cancelMutation.isPending}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={cancelMutation.isPending || charCount === 0 || isOverLimit}
              className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-rose-700 active:scale-[0.99] transition-all disabled:opacity-50 disabled:pointer-events-none"
            >
              {cancelMutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Đang xử lý hủy...</span>
                </>
              ) : (
                <span>Xác nhận Hủy Booking</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
