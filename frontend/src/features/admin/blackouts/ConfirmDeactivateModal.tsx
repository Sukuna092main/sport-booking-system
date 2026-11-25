import { AlertTriangle, Clock, Info, Loader2, X } from "lucide-react"
import type { Court } from "@/types/court.types"
import type { Blackout } from "@/types/blackout.types"
import { formatBlackoutDateTime, formatBlackoutDuration } from "./blackoutValidation"

export interface ConfirmDeactivateModalProps {
  isOpen: boolean
  court: Court
  blackout: Blackout | null
  isLoading?: boolean
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmDeactivateModal({
  isOpen,
  court,
  blackout,
  isLoading = false,
  onConfirm,
  onClose,
}: ConfirmDeactivateModalProps) {
  if (!isOpen || !blackout) return null

  const durationText = formatBlackoutDuration(blackout.startsAt, blackout.endsAt)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="deactivate-blackout-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
    >
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
        {/* Header Icon + Title */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 id="deactivate-blackout-title" className="text-base font-black text-gray-900">
                Tắt Lịch Chặn Sân (Blackout)
              </h3>
              <p className="text-xs text-gray-500">
                Sân: <strong className="text-gray-800">[{court.code}] {court.name}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            aria-label="Đóng"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="mt-4 space-y-3">
          <p className="text-xs text-gray-600 leading-relaxed">
            Bạn có chắc chắn muốn ngừng kích hoạt lịch chặn này? Khi tắt, các slot trong khoảng giờ này sẽ
            trở lại khả dụng cho khách đặt chỗ (nếu không trùng với booking khác).
          </p>

          {/* Blackout Summary Card */}
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-1.5 text-xs">
            <div className="flex items-center gap-1.5 text-gray-700">
              <Clock className="h-3.5 w-3.5 text-rose-600 shrink-0" />
              <span>
                <strong>Thời gian:</strong> {formatBlackoutDateTime(blackout.startsAt)} – {formatBlackoutDateTime(blackout.endsAt)}
              </span>
            </div>
            <p className="text-gray-500 text-[11px] pl-5">
              Thời lượng: <strong className="text-gray-800">{durationText}</strong>
            </p>
            {blackout.reason && (
              <p className="text-gray-500 text-[11px] pl-5">
                Lý do: <span className="italic text-gray-700 font-medium">{blackout.reason}</span>
              </p>
            )}
          </div>

          {/* System Rule Guarantee: Confirmed bookings remain safe */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-900 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-emerald-950">
              <Info className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Bảo toàn dữ liệu & Lịch sử</span>
            </div>
            <p className="text-[11px] leading-relaxed text-emerald-800">
              Hệ thống áp dụng <strong>xóa mềm (soft delete, isActive=false)</strong>, lưu vết audit log đầy đủ.
              Thao tác này tuyệt đối không xóa hoặc thay đổi bất kỳ booking đã xác nhận nào.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-5 flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors shadow-2xs disabled:opacity-50"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
          >
            {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />}
            <span>Xác nhận tắt lịch chặn</span>
          </button>
        </div>
      </div>
    </div>
  )
}
