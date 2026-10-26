import { useMemo, useState } from "react"
import {
  AlertCircle,
  Calendar,
  Clock,
  Info,
  Loader2,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react"
import type { Court } from "@/types/court.types"
import type { Blackout } from "@/types/blackout.types"
import {
  checkBlackoutOverlap,
  formatBlackoutDuration,
  formatBlackoutDateTime,
  getBlackoutPreset,
  parseBlackoutApiError,
  toLocalDatetimeInput,
  toUtcIsoString,
  validateBlackoutForm,
  type BlackoutFormState,
  type BlackoutPresetKey,
} from "./blackoutValidation"
import {
  useCreateCourtBlackout,
  useUpdateCourtBlackout,
} from "./useAdminBlackouts"

export interface BlackoutFormModalProps {
  isOpen: boolean
  court: Court
  blackout?: Blackout | null
  existingBlackouts: Blackout[]
  onClose: () => void
  onSuccess?: () => void
}

function BlackoutFormModalContent({
  court,
  blackout = null,
  existingBlackouts,
  onClose,
  onSuccess,
}: Omit<BlackoutFormModalProps, "isOpen">) {
  const isEditing = Boolean(blackout)
  const createMutation = useCreateCourtBlackout()
  const updateMutation = useUpdateCourtBlackout()

  const [form, setForm] = useState<BlackoutFormState>(() => {
    if (blackout) {
      return {
        startsAt: toLocalDatetimeInput(blackout.startsAt),
        endsAt: toLocalDatetimeInput(blackout.endsAt),
        reason: blackout.reason || "",
        isActive: blackout.isActive,
      }
    }
    const preset = getBlackoutPreset("plus_2h")
    return {
      startsAt: preset.startsAt,
      endsAt: preset.endsAt,
      reason: "",
      isActive: true,
    }
  })

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)

  // Real-time duration calculation
  const durationText = useMemo(() => {
    if (!form.startsAt || !form.endsAt) return null
    return formatBlackoutDuration(form.startsAt, form.endsAt)
  }, [form.startsAt, form.endsAt])

  // Real-time overlap check against other active blackouts
  const overlapCheck = useMemo(() => {
    if (!form.startsAt || !form.endsAt) return { hasOverlap: false, overlappingBlackouts: [] }
    return checkBlackoutOverlap(
      {
        startsAt: form.startsAt,
        endsAt: form.endsAt,
        id: blackout?.id,
      },
      existingBlackouts,
    )
  }, [form.startsAt, form.endsAt, blackout?.id, existingBlackouts])

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  function handlePreset(key: BlackoutPresetKey) {
    const preset = getBlackoutPreset(key)
    setForm((prev) => ({
      ...prev,
      startsAt: preset.startsAt,
      endsAt: preset.endsAt,
    }))
    // Clear range errors on preset change
    setFieldErrors((prev) => {
      const next = { ...prev }
      delete next.startsAt
      delete next.endsAt
      return next
    })
  }

  function handleChange(field: keyof BlackoutFormState, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }))
    // Clear field-specific error as user types
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
    // Also re-clear endsAt error when startsAt changes
    if (field === "startsAt" && fieldErrors.endsAt) {
      setFieldErrors((prev) => {
        const next = { ...prev }
        delete next.endsAt
        return next
      })
    }
    setServerError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)

    // 1. Client-side validation
    const validation = validateBlackoutForm(form)
    if (!validation.isValid) {
      setFieldErrors(validation.fieldErrors)
      return
    }

    // 2. Convert to UTC ISO-8601 strings
    const startsAtUtc = toUtcIsoString(form.startsAt)
    const endsAtUtc = toUtcIsoString(form.endsAt)

    if (!startsAtUtc || !endsAtUtc) {
      setServerError("Thời gian bắt đầu hoặc kết thúc không hợp lệ.")
      return
    }

    const trimmedReason = form.reason.trim()
    const reasonPayload = trimmedReason === "" ? null : trimmedReason

    try {
      if (isEditing && blackout) {
        await updateMutation.mutateAsync({
          courtId: court.id,
          blackoutId: blackout.id,
          payload: {
            startsAt: startsAtUtc,
            endsAt: endsAtUtc,
            reason: reasonPayload,
            isActive: form.isActive ?? true,
          },
        })
      } else {
        await createMutation.mutateAsync({
          courtId: court.id,
          payload: {
            startsAt: startsAtUtc,
            endsAt: endsAtUtc,
            reason: reasonPayload,
          },
        })
      }

      onSuccess?.()
      onClose()
    } catch (err) {
      const parsed = parseBlackoutApiError(err)
      setServerError(parsed.message)
      if (Object.keys(parsed.fieldErrors).length > 0) {
        setFieldErrors(parsed.fieldErrors)
      }
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="blackout-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs overflow-y-auto"
    >
      <div className="relative w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h2 id="blackout-modal-title" className="text-base font-black text-gray-900">
                {isEditing ? "Chỉnh Sửa Lịch Chặn Sân" : "Tạo Lịch Chặn Sân Mới (Blackout)"}
              </h2>
              <p className="text-xs text-gray-500">
                Sân: <strong className="text-gray-800">[{court.code}] {court.name}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            aria-label="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* System Rule Notice: Do NOT delete confirmed bookings (Checklist Requirement) */}
          <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-3.5 text-xs text-sky-900 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-sky-950">
              <Info className="h-4 w-4 text-sky-600 shrink-0" />
              <span>Chính sách hệ thống (FR-16): Không tự xóa booking đã xác nhận</span>
            </div>
            <p className="text-[11px] leading-relaxed text-sky-800 pl-5">
              Lịch chặn chỉ áp dụng cho các <strong>lượt đặt mới</strong>. Các booking đã ở trạng thái{" "}
              <strong className="underline decoration-sky-400">CONFIRMED</strong> trước đó vẫn được giữ nguyên
              trong cơ sở dữ liệu và lịch sử. Nếu cần hủy lịch của khách, Admin vui lòng xử lý riêng tại mục Quản lý Booking.
            </p>
          </div>

          {/* Server Error Alert */}
          {serverError && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 font-semibold">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{serverError}</span>
            </div>
          )}

          {/* Quick Preset Buttons */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-gray-500">
              <Sparkles className="h-3 w-3 text-amber-500" />
              <span>Khung giờ gợi ý nhanh:</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => handlePreset("plus_1h")}
                className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-semibold text-gray-700 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-800 transition-colors"
              >
                +1 giờ tới
              </button>
              <button
                type="button"
                onClick={() => handlePreset("plus_2h")}
                className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-semibold text-gray-700 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-800 transition-colors"
              >
                +2 giờ tới
              </button>
              <button
                type="button"
                onClick={() => handlePreset("today_rest")}
                className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-semibold text-gray-700 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-800 transition-colors"
              >
                Hết ngày hôm nay
              </button>
              <button
                type="button"
                onClick={() => handlePreset("tomorrow_morning")}
                className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-semibold text-gray-700 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-800 transition-colors"
              >
                Sáng mai (8h - 12h)
              </button>
              <button
                type="button"
                onClick={() => handlePreset("tomorrow_afternoon")}
                className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-semibold text-gray-700 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-800 transition-colors"
              >
                Chiều mai (13h - 18h)
              </button>
              <button
                type="button"
                onClick={() => handlePreset("tomorrow_full")}
                className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-semibold text-gray-700 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-800 transition-colors"
              >
                Cả ngày mai
              </button>
            </div>
          </div>

          {/* Time Range Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* StartsAt */}
            <div className="space-y-1">
              <label
                htmlFor="blackout-startsAt"
                className="flex items-center gap-1 text-xs font-bold text-gray-700"
              >
                <Calendar className="h-3.5 w-3.5 text-gray-400" />
                <span>Bắt đầu chặn (Starts At) *</span>
              </label>
              <input
                id="blackout-startsAt"
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => handleChange("startsAt", e.target.value)}
                className={`w-full rounded-xl border px-3 py-2 text-xs font-semibold text-gray-900 shadow-2xs outline-none focus:ring-1 ${
                  fieldErrors.startsAt
                    ? "border-rose-400 bg-rose-50/30 focus:border-rose-600 focus:ring-rose-600"
                    : "border-gray-300 focus:border-emerald-600 focus:ring-emerald-600"
                }`}
                required
              />
              {fieldErrors.startsAt && (
                <p className="text-[11px] font-medium text-rose-600">{fieldErrors.startsAt}</p>
              )}
            </div>

            {/* EndsAt */}
            <div className="space-y-1">
              <label
                htmlFor="blackout-endsAt"
                className="flex items-center gap-1 text-xs font-bold text-gray-700"
              >
                <Calendar className="h-3.5 w-3.5 text-gray-400" />
                <span>Kết thúc chặn (Ends At) *</span>
              </label>
              <input
                id="blackout-endsAt"
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => handleChange("endsAt", e.target.value)}
                className={`w-full rounded-xl border px-3 py-2 text-xs font-semibold text-gray-900 shadow-2xs outline-none focus:ring-1 ${
                  fieldErrors.endsAt
                    ? "border-rose-400 bg-rose-50/30 focus:border-rose-600 focus:ring-rose-600"
                    : "border-gray-300 focus:border-emerald-600 focus:ring-emerald-600"
                }`}
                required
              />
              {fieldErrors.endsAt && (
                <p className="text-[11px] font-medium text-rose-600">{fieldErrors.endsAt}</p>
              )}
            </div>
          </div>

          {/* Duration Indicator */}
          {durationText && !fieldErrors.endsAt && (
            <div className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5">
              <Clock className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span>
                Tổng thời lượng chặn: <strong className="text-gray-900 font-bold">{durationText}</strong>
              </span>
            </div>
          )}

          {/* Overlap Advisory Banner (Checklist: Range/overlap handling) */}
          {overlapCheck.hasOverlap && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-950">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                <span>Phát hiện giao nhau với lịch chặn đang hoạt động ({overlapCheck.overlappingBlackouts.length})</span>
              </div>
              <p className="text-[11px] text-amber-800">
                Khoảng thời gian này trùng một phần hoặc toàn bộ với lịch chặn khác của sân. Hệ thống cho phép các
                lịch chặn giao nhau và sẽ gộp các khoảng thời gian bị chặn khi tính Availability:
              </p>
              <ul className="text-[11px] list-disc list-inside space-y-0.5 text-amber-900 font-medium pl-1">
                {overlapCheck.overlappingBlackouts.map((b) => (
                  <li key={b.id}>
                    {formatBlackoutDateTime(b.startsAt)} – {formatBlackoutDateTime(b.endsAt)}
                    {b.reason ? ` (${b.reason})` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Reason */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label htmlFor="blackout-reason" className="text-xs font-bold text-gray-700">
                Lý do chặn sân (Tùy chọn)
              </label>
              <span className="text-[10px] text-gray-400">
                {form.reason.length} / 500 ký tự
              </span>
            </div>
            <textarea
              id="blackout-reason"
              rows={3}
              value={form.reason}
              onChange={(e) => handleChange("reason", e.target.value)}
              placeholder="VD: Bảo trì định kỳ mặt cỏ / sàn gỗ, thay bóng đèn chiếu sáng, tổ chức giải nội bộ..."
              className={`w-full rounded-xl border px-3 py-2 text-xs text-gray-900 shadow-2xs outline-none focus:ring-1 resize-none ${
                fieldErrors.reason
                  ? "border-rose-400 bg-rose-50/30 focus:border-rose-600 focus:ring-rose-600"
                  : "border-gray-300 focus:border-emerald-600 focus:ring-emerald-600"
              }`}
            />
            {fieldErrors.reason && (
              <p className="text-[11px] font-medium text-rose-600">{fieldErrors.reason}</p>
            )}
          </div>

          {/* IsActive Toggle (When editing) */}
          {isEditing && (
            <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50/60 p-3">
              <div>
                <span className="text-xs font-bold text-gray-900">Trạng thái kích hoạt (isActive)</span>
                <p className="text-[11px] text-gray-500">
                  Chỉ lịch chặn đang hoạt động mới làm Time Slot tương ứng chuyển sang Không khả dụng.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive ?? true}
                  onChange={(e) => handleChange("isActive", e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors shadow-2xs disabled:opacity-50"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />}
              <span>{isEditing ? "Cập nhật lịch chặn" : "Tạo lịch chặn"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function BlackoutFormModal({ isOpen, ...props }: BlackoutFormModalProps) {
  if (!isOpen) return null
  return <BlackoutFormModalContent key={props.blackout?.id ?? "create"} {...props} />
}

