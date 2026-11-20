import { useState } from "react"
import {
  Clock,
  Layers,
  AlertCircle,
  CheckCircle,
  Save,
  RotateCcw,
  Loader2,
  Info,
} from "lucide-react"
import type { Court } from "@/types/court.types"
import type { SlotPolicyPayload } from "@/types/schedule.types"
import {
  validateSlotPolicy,
  parseScheduleApiError,
} from "./scheduleValidation"
import { useUpdateSlotPolicy } from "./useAdminSchedule"

export interface SlotPolicyFormProps {
  court: Court
  onSuccess?: () => void
}

const COMMON_DURATION_PRESETS = [30, 45, 60, 90, 120]

export function SlotPolicyForm({ court, onSuccess }: SlotPolicyFormProps) {
  const updatePolicyMutation = useUpdateSlotPolicy()

  const [form, setForm] = useState<SlotPolicyPayload>({
    slotDurationMinutes: court.slotDurationMinutes || 60,
    minConsecutiveSlots: court.minConsecutiveSlots || 1,
    maxConsecutiveSlots: court.maxConsecutiveSlots || 4,
  })

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [successToast, setSuccessToast] = useState<string | null>(null)

  function handleReset() {
    setForm({
      slotDurationMinutes: court.slotDurationMinutes || 60,
      minConsecutiveSlots: court.minConsecutiveSlots || 1,
      maxConsecutiveSlots: court.maxConsecutiveSlots || 4,
    })
    setFieldErrors({})
    setServerError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)
    setSuccessToast(null)

    const errors = validateSlotPolicy(form)
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }
    setFieldErrors({})

    try {
      await updatePolicyMutation.mutateAsync({
        courtId: court.id,
        payload: {
          slotDurationMinutes: Number(form.slotDurationMinutes),
          minConsecutiveSlots: Number(form.minConsecutiveSlots),
          maxConsecutiveSlots: Number(form.maxConsecutiveSlots),
        },
      })
      setSuccessToast(
        `Đã cập nhật quy định slot thành công! Thời lượng ${form.slotDurationMinutes} phút đã được áp dụng và backend đã tái tạo mẫu slot hiện hành.`,
      )
      setTimeout(() => setSuccessToast(null), 5000)
      onSuccess?.()
    } catch (err) {
      const parsed = parseScheduleApiError(err)
      setServerError(parsed.message)
      if (Object.keys(parsed.fieldErrors).length > 0) {
        setFieldErrors(parsed.fieldErrors)
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ── Policy Notice ── */}
      <div className="flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50/70 p-4 text-sky-950">
        <Info className="h-5 w-5 shrink-0 text-sky-600 mt-0.5" />
        <div className="text-xs space-y-1">
          <p className="font-bold">Quy tắc tái tạo khung giờ (Contract FR-07 & OpenAPI):</p>
          <p className="text-sky-800">
            Khi thay đổi thời lượng slot (Slot Duration), hệ thống sẽ giữ nguyên giờ mở cửa
            và tự động chia lại toàn bộ mẫu slot tuần. Khoảng thời gian dư ở cuối giờ mở cửa
            ngắn hơn thời lượng slot sẽ tự động được loại bỏ. Availability của sân sẽ được tự động làm mới.
          </p>
        </div>
      </div>

      {/* ── Server Error Alert ── */}
      {serverError && (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-900">
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-bold">{serverError}</p>
            {Object.keys(fieldErrors).length > 0 && (
              <ul className="list-disc list-inside space-y-0.5 text-rose-800 text-[11px]">
                {Object.entries(fieldErrors).map(([key, msg]) => (
                  <li key={key}>{msg}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* ── Success Toast ── */}
      {successToast && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 animate-fadeIn">
          <CheckCircle className="h-5 w-5 shrink-0 text-emerald-600" />
          <p className="text-xs font-bold">{successToast}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Slot Duration */}
        <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-emerald-600" />
            <label htmlFor="slotDurationMinutes" className="text-xs font-black uppercase tracking-wider text-gray-900">
              Thời Lượng Slot (Phút)
            </label>
          </div>
          <p className="text-[11px] text-gray-500">
            Độ dài của một ca/slot đặt sân (thường là 60 phút)
          </p>

          {/* Quick presets */}
          <div className="flex flex-wrap gap-1.5">
            {COMMON_DURATION_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setForm((f) => ({ ...f, slotDurationMinutes: preset }))
                  setFieldErrors((e) => {
                    const copy = { ...e }
                    delete copy.slotDurationMinutes
                    return copy
                  })
                }}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                  form.slotDurationMinutes === preset
                    ? "bg-emerald-600 text-white shadow-2xs"
                    : "border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100"
                }`}
              >
                {preset}p
              </button>
            ))}
          </div>

          <div className="pt-1">
            <input
              id="slotDurationMinutes"
              type="number"
              min={1}
              max={32767}
              value={form.slotDurationMinutes}
              onChange={(e) => {
                const val = Number(e.target.value)
                setForm((f) => ({ ...f, slotDurationMinutes: val }))
              }}
              className={`w-full rounded-xl border px-3 py-2 text-sm font-bold outline-none transition-colors ${
                fieldErrors.slotDurationMinutes
                  ? "border-rose-400 bg-rose-50/40 focus:border-rose-600"
                  : "border-gray-200 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
              }`}
            />
            {fieldErrors.slotDurationMinutes && (
              <p className="mt-1 text-[11px] font-medium text-rose-600">
                {fieldErrors.slotDurationMinutes}
              </p>
            )}
          </div>
        </div>

        {/* Min Consecutive Slots */}
        <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-emerald-600" />
            <label htmlFor="minConsecutiveSlots" className="text-xs font-black uppercase tracking-wider text-gray-900">
              Slot Tối Thiểu / Booking
            </label>
          </div>
          <p className="text-[11px] text-gray-500">
            Số slot liền kề ít nhất khách phải đặt mỗi lần (thường là 1)
          </p>

          <div className="pt-8">
            <input
              id="minConsecutiveSlots"
              type="number"
              min={1}
              max={form.maxConsecutiveSlots || 32767}
              value={form.minConsecutiveSlots}
              onChange={(e) => {
                const val = Number(e.target.value)
                setForm((f) => ({ ...f, minConsecutiveSlots: val }))
              }}
              className={`w-full rounded-xl border px-3 py-2 text-sm font-bold outline-none transition-colors ${
                fieldErrors.minConsecutiveSlots
                  ? "border-rose-400 bg-rose-50/40 focus:border-rose-600"
                  : "border-gray-200 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
              }`}
            />
            {fieldErrors.minConsecutiveSlots && (
              <p className="mt-1 text-[11px] font-medium text-rose-600">
                {fieldErrors.minConsecutiveSlots}
              </p>
            )}
          </div>
        </div>

        {/* Max Consecutive Slots */}
        <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-emerald-600" />
            <label htmlFor="maxConsecutiveSlots" className="text-xs font-black uppercase tracking-wider text-gray-900">
              Slot Tối Đa / Booking
            </label>
          </div>
          <p className="text-[11px] text-gray-500">
            Số slot liền kề tối đa khách được đặt mỗi lần (thường là 4)
          </p>

          <div className="pt-8">
            <input
              id="maxConsecutiveSlots"
              type="number"
              min={form.minConsecutiveSlots || 1}
              max={32767}
              value={form.maxConsecutiveSlots}
              onChange={(e) => {
                const val = Number(e.target.value)
                setForm((f) => ({ ...f, maxConsecutiveSlots: val }))
              }}
              className={`w-full rounded-xl border px-3 py-2 text-sm font-bold outline-none transition-colors ${
                fieldErrors.maxConsecutiveSlots
                  ? "border-rose-400 bg-rose-50/40 focus:border-rose-600"
                  : "border-gray-200 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
              }`}
            />
            {fieldErrors.maxConsecutiveSlots && (
              <p className="mt-1 text-[11px] font-medium text-rose-600">
                {fieldErrors.maxConsecutiveSlots}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Form Actions ── */}
      <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-end">
        <button
          type="button"
          onClick={handleReset}
          disabled={updatePolicyMutation.isPending}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Khôi phục ban đầu</span>
        </button>

        <button
          type="submit"
          disabled={updatePolicyMutation.isPending}
          className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 transition-all cursor-pointer"
        >
          {updatePolicyMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Đang lưu chính sách...</span>
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              <span>Lưu Quy Định Slot</span>
            </>
          )}
        </button>
      </div>
    </form>
  )
}
