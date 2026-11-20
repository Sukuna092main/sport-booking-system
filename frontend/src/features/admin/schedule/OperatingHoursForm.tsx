import { useState } from "react"
import {
  Clock,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle,
  Copy,
  RotateCcw,
  Save,
  Sparkles,
  Loader2,
} from "lucide-react"
import type { Court } from "@/types/court.types"
import type { OperatingHour } from "@/types/schedule.types"
import {
  WEEKDAYS,
  toHHmmss,
  toHHmm,
  validateOperatingHours,
  parseScheduleApiError,
  parseClockSeconds,
} from "./scheduleValidation"
import { useReplaceOperatingHours } from "./useAdminSchedule"

export interface OperatingHoursFormProps {
  court: Court
  initialHours: OperatingHour[]
  onSuccess?: () => void
}

interface DayInterval {
  id: string
  opensAt: string // HH:mm
  closesAt: string // HH:mm
}

interface WeekdayState {
  weekday: number
  isOpen: boolean
  intervals: DayInterval[]
}

export function OperatingHoursForm({
  court,
  initialHours,
  onSuccess,
}: OperatingHoursFormProps) {
  const replaceMutation = useReplaceOperatingHours()

  // Initialize weekly state
  const [scheduleState, setScheduleState] = useState<WeekdayState[]>(() =>
    buildInitialState(initialHours),
  )

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [successToast, setSuccessToast] = useState<string | null>(null)



  function buildInitialState(hours: OperatingHour[]): WeekdayState[] {
    return WEEKDAYS.map((w) => {
      const dayHours = hours
        .filter((h) => h.weekday === w.id)
        .sort((a, b) => (a.opensAt > b.opensAt ? 1 : -1))

      if (dayHours.length === 0) {
        return {
          weekday: w.id,
          isOpen: false,
          intervals: [
            {
              id: `${w.id}-1`,
              opensAt: "08:00",
              closesAt: "22:00",
            },
          ],
        }
      }

      return {
        weekday: w.id,
        isOpen: true,
        intervals: dayHours.map((h, idx) => ({
          id: `${w.id}-${idx + 1}-${Math.random().toString(36).slice(2, 6)}`,
          opensAt: toHHmm(h.opensAt),
          closesAt: toHHmm(h.closesAt),
        })),
      }
    })
  }

  // Toggle open / closed for a day
  function handleToggleDay(weekday: number) {
    setScheduleState((prev) =>
      prev.map((day) => {
        if (day.weekday !== weekday) return day
        const nextOpen = !day.isOpen
        return {
          ...day,
          isOpen: nextOpen,
          intervals:
            day.intervals.length > 0
              ? day.intervals
              : [{ id: `${weekday}-1`, opensAt: "08:00", closesAt: "22:00" }],
        }
      }),
    )
  }

  // Add interval to a day
  function handleAddInterval(weekday: number) {
    setScheduleState((prev) =>
      prev.map((day) => {
        if (day.weekday !== weekday) return day
        // Guess next slot based on last interval
        let defaultOpen = "14:00"
        let defaultClose = "22:00"
        if (day.intervals.length > 0) {
          const last = day.intervals[day.intervals.length - 1]
          defaultOpen = last.closesAt
          const lastEndSec = parseClockSeconds(last.closesAt)
          const newEndSec = Math.min(86399, lastEndSec + 4 * 3600)
          const h = Math.floor(newEndSec / 3600)
            .toString()
            .padStart(2, "0")
          const m = Math.floor((newEndSec % 3600) / 60)
            .toString()
            .padStart(2, "0")
          defaultClose = `${h}:${m}`
        }

        return {
          ...day,
          isOpen: true,
          intervals: [
            ...day.intervals,
            {
              id: `${weekday}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
              opensAt: defaultOpen,
              closesAt: defaultClose,
            },
          ],
        }
      }),
    )
  }

  // Remove interval from a day
  function handleRemoveInterval(weekday: number, intervalId: string) {
    setScheduleState((prev) =>
      prev.map((day) => {
        if (day.weekday !== weekday) return day
        const nextIntervals = day.intervals.filter((i) => i.id !== intervalId)
        return {
          ...day,
          intervals: nextIntervals,
          isOpen: nextIntervals.length > 0,
        }
      }),
    )
  }

  // Update interval time
  function handleTimeChange(
    weekday: number,
    intervalId: string,
    field: "opensAt" | "closesAt",
    value: string,
  ) {
    setScheduleState((prev) =>
      prev.map((day) => {
        if (day.weekday !== weekday) return day
        return {
          ...day,
          intervals: day.intervals.map((i) =>
            i.id === intervalId ? { ...i, [field]: value } : i,
          ),
        }
      }),
    )
  }

  // Preset: Open all days 08:00 - 22:00
  function handleApplyPresetStandard(open: string, close: string) {
    setScheduleState(
      WEEKDAYS.map((w) => ({
        weekday: w.id,
        isOpen: true,
        intervals: [{ id: `${w.id}-preset`, opensAt: open, closesAt: close }],
      })),
    )
  }

  // Preset: Copy Monday to all days
  function handleCopyMondayToAll() {
    const monday = scheduleState.find((d) => d.weekday === 1)
    if (!monday) return
    setScheduleState(
      WEEKDAYS.map((w) => ({
        weekday: w.id,
        isOpen: monday.isOpen,
        intervals: monday.intervals.map((i, idx) => ({
          id: `${w.id}-copy-${idx}`,
          opensAt: i.opensAt,
          closesAt: i.closesAt,
        })),
      })),
    )
  }

  // Preset: Close all days
  function handleCloseAllDays() {
    setScheduleState((prev) =>
      prev.map((day) => ({
        ...day,
        isOpen: false,
      })),
    )
  }

  // Reset to initial
  function handleReset() {
    setScheduleState(buildInitialState(initialHours))
    setFieldErrors({})
    setServerError(null)
  }

  // Convert current UI state into API payload
  function compilePayload(): OperatingHour[] {
    const hours: OperatingHour[] = []
    for (const day of scheduleState) {
      if (!day.isOpen) continue
      for (const interval of day.intervals) {
        hours.push({
          weekday: day.weekday,
          opensAt: toHHmmss(interval.opensAt),
          closesAt: toHHmmss(interval.closesAt),
        })
      }
    }
    return hours
  }

  // Submit
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)
    setSuccessToast(null)

    const payloadHours = compilePayload()

    // Client-side validation
    const validation = validateOperatingHours(payloadHours)
    if (!validation.isValid) {
      setFieldErrors(validation.fieldErrors)
      setServerError(validation.generalError || "Lịch mở cửa chưa hợp lệ.")
      return
    }
    setFieldErrors({})

    try {
      await replaceMutation.mutateAsync({
        courtId: court.id,
        payload: { hours: payloadHours },
      })
      setSuccessToast(
        `Đã cập nhật giờ hoạt động cho sân "${court.name}" thành công! Mẫu slot và Availability đã được tự động tái tạo.`,
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
      {/* ── Presets & Quick Tools ── */}
      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-gray-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
          <Sparkles className="h-4 w-4 text-emerald-600" />
          <span>Mẫu cấu hình nhanh:</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleApplyPresetStandard("08:00", "22:00")}
            className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-bold text-gray-700 shadow-2xs hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-800 transition-colors"
          >
            08:00 – 22:00 Cả Tuần
          </button>
          <button
            type="button"
            onClick={() => handleApplyPresetStandard("06:00", "22:00")}
            className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-bold text-gray-700 shadow-2xs hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-800 transition-colors"
          >
            06:00 – 22:00 Cả Tuần
          </button>
          <button
            type="button"
            onClick={handleCopyMondayToAll}
            className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-bold text-gray-700 shadow-2xs hover:bg-gray-100 transition-colors"
          >
            <Copy className="h-3 w-3" />
            <span>Sao chép T2 cho cả tuần</span>
          </button>
          <button
            type="button"
            onClick={handleCloseAllDays}
            className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition-colors"
          >
            Đóng cửa cả tuần
          </button>
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

      {/* ── Weekday List ── */}
      <div className="space-y-3">
        {scheduleState.map((day) => {
          const weekdayInfo = WEEKDAYS.find((w) => w.id === day.weekday)!
          const overlapError = fieldErrors[`weekday_${day.weekday}_overlap`]

          return (
            <div
              key={day.weekday}
              className={`rounded-2xl border transition-all ${
                day.isOpen
                  ? "border-gray-200 bg-white shadow-2xs"
                  : "border-gray-100 bg-gray-50/60 opacity-80"
              }`}
            >
              <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-9 w-12 items-center justify-center rounded-xl text-xs font-black tracking-wider ${
                      day.isOpen
                        ? "bg-emerald-600 text-white shadow-2xs"
                        : "bg-gray-200 text-gray-500"
                    }`}
                  >
                    {weekdayInfo.shortName}
                  </span>
                  <div>
                    <h3 className="text-sm font-black text-gray-900">
                      {weekdayInfo.name}
                    </h3>
                    <p className="text-[11px] font-medium text-gray-400">
                      {weekdayInfo.english}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleDay(day.weekday)}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                      day.isOpen
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                        : "bg-gray-200 text-gray-600 border border-gray-300 hover:bg-gray-300"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        day.isOpen ? "bg-emerald-600" : "bg-gray-400"
                      }`}
                    />
                    <span>{day.isOpen ? "Đang Mở Cửa" : "Nghỉ / Đóng Cửa"}</span>
                  </button>

                  {day.isOpen && (
                    <button
                      type="button"
                      onClick={() => handleAddInterval(day.weekday)}
                      className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors shadow-2xs"
                      title="Thêm ca hoạt động thứ hai trong ngày (ca sáng / ca tối)"
                    >
                      <Plus className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Thêm ca</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Day Intervals */}
              {day.isOpen ? (
                <div className="p-4 space-y-3">
                  {overlapError && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700 font-medium">
                      {overlapError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {day.intervals.map((interval) => {
                      const startSec = parseClockSeconds(interval.opensAt)
                      const endSec = parseClockSeconds(interval.closesAt)
                      const hasRangeError =
                        !Number.isNaN(startSec) &&
                        !Number.isNaN(endSec) &&
                        startSec >= endSec

                      return (
                        <div
                          key={interval.id}
                          className={`flex items-center gap-2 rounded-xl border p-2.5 transition-all ${
                            hasRangeError
                              ? "border-rose-300 bg-rose-50/50"
                              : "border-gray-200 bg-gray-50/50 hover:bg-white"
                          }`}
                        >
                          <div className="flex flex-1 items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                            <div className="flex items-center gap-1 text-xs">
                              <input
                                type="time"
                                value={interval.opensAt}
                                onChange={(e) =>
                                  handleTimeChange(
                                    day.weekday,
                                    interval.id,
                                    "opensAt",
                                    e.target.value,
                                  )
                                }
                                className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-bold text-gray-800 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                              />
                              <span className="text-gray-400 font-bold">đến</span>
                              <input
                                type="time"
                                value={interval.closesAt}
                                onChange={(e) =>
                                  handleTimeChange(
                                    day.weekday,
                                    interval.id,
                                    "closesAt",
                                    e.target.value,
                                  )
                                }
                                className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-bold text-gray-800 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                              />
                            </div>
                          </div>

                          {day.intervals.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                handleRemoveInterval(day.weekday, interval.id)
                              }
                              className="rounded-lg p-1.5 text-gray-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                              title="Xóa ca này"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="px-4 py-3 text-xs text-gray-400 italic">
                  Sân không mở cửa vào ngày này (không có slot hoạt động).
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Form Actions ── */}
      <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-end">
        <button
          type="button"
          onClick={handleReset}
          disabled={replaceMutation.isPending}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Khôi phục ban đầu</span>
        </button>

        <button
          type="submit"
          disabled={replaceMutation.isPending}
          className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 transition-all cursor-pointer"
        >
          {replaceMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Đang lưu & tái tạo slot...</span>
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              <span>Lưu Cấu Hình Giờ Hoạt Động</span>
            </>
          )}
        </button>
      </div>
    </form>
  )
}
