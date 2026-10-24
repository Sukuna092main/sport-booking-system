import { AlertTriangle, CheckCircle, Loader2 } from "lucide-react"

export interface ConfirmActionModalProps {
  isOpen: boolean
  title: string
  itemName: string
  actionType: "activate" | "deactivate"
  itemType: "court" | "sportType"
  warningMessage?: string
  errorMessage?: string | null
  isLoading?: boolean
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmActionModal({
  isOpen,
  title,
  itemName,
  actionType,
  itemType,
  warningMessage,
  errorMessage,
  isLoading = false,
  onConfirm,
  onClose,
}: ConfirmActionModalProps) {
  if (!isOpen) return null

  const isDeactivate = actionType === "deactivate"

  const defaultWarning = isDeactivate
    ? itemType === "sportType"
      ? "Lưu ý quan trọng: Theo quy định hệ thống, bạn không thể ngừng kích hoạt môn thể thao nếu vẫn còn sân đang hoạt động thuộc môn này."
      : "Sân sau khi ngừng kích hoạt sẽ không thể nhận booking mới. Lịch sử booking và các lượt đặt đã xác nhận trước đó vẫn được lưu giữ."
    : "Sân / môn thể thao sau khi kích hoạt lại sẽ sẵn sàng để người dùng tìm kiếm và đặt chỗ."

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl animate-in fade-in zoom-in-95">
        {/* Header Icon + Title */}
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              isDeactivate ? "bg-rose-100 text-rose-600" : "bg-emerald-100 text-emerald-600"
            }`}
          >
            {isDeactivate ? (
              <AlertTriangle className="h-5 w-5" />
            ) : (
              <CheckCircle className="h-5 w-5" />
            )}
          </div>
          <div>
            <h3 className="text-base font-black text-gray-900">{title}</h3>
            <p className="text-xs text-gray-500">Thao tác quản trị hệ thống</p>
          </div>
        </div>

        {/* Content */}
        <div className="mt-4 space-y-3">
          <p className="text-xs text-gray-600 leading-relaxed">
            Bạn có chắc chắn muốn {isDeactivate ? "ngừng kích hoạt" : "kích hoạt lại"}{" "}
            <span className="font-bold text-gray-900 font-mono bg-gray-100 px-1.5 py-0.5 rounded">
              {itemName}
            </span>
            ?
          </p>

          <div
            className={`rounded-xl border p-3 text-xs leading-relaxed ${
              isDeactivate
                ? "border-amber-200 bg-amber-50/80 text-amber-900"
                : "border-emerald-200 bg-emerald-50/80 text-emerald-900"
            }`}
          >
            {warningMessage || defaultWarning}
          </div>

          {errorMessage && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 font-medium">
              {errorMessage}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex items-center justify-end gap-2.5">
          <button
            type="button"
            disabled={isLoading}
            onClick={onClose}
            className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={onConfirm}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white transition-colors disabled:opacity-60 ${
              isDeactivate
                ? "bg-rose-600 hover:bg-rose-700 shadow-xs"
                : "bg-emerald-600 hover:bg-emerald-700 shadow-xs"
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Đang xử lý...</span>
              </>
            ) : isDeactivate ? (
              "Xác nhận ngừng kích hoạt"
            ) : (
              "Xác nhận kích hoạt"
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
