import { useMemo } from "react"
import { Clock, Calendar, AlertCircle } from "lucide-react"
import type { TimeSlotTemplate, OperatingHour } from "@/types/schedule.types"
import { WEEKDAYS, toHHmm } from "./scheduleValidation"

export interface CurrentSlotsViewProps {
  timeSlots: TimeSlotTemplate[]
  operatingHours: OperatingHour[]
  slotDurationMinutes: number
}

export function CurrentSlotsView({
  timeSlots,
  operatingHours,
  slotDurationMinutes,
}: CurrentSlotsViewProps) {
  // Group slots by weekday
  const slotsByWeekday = useMemo(() => {
    const map = new Map<number, TimeSlotTemplate[]>()
    for (const w of WEEKDAYS) {
      map.set(w.id, [])
    }
    for (const slot of timeSlots) {
      const list = map.get(slot.weekday) || []
      list.push(slot)
      map.set(slot.weekday, list)
    }
    // Sort slots by startsAt
    for (const [key, list] of map.entries()) {
      list.sort((a, b) => (a.startsAt > b.startsAt ? 1 : -1))
      map.set(key, list)
    }
    return map
  }, [timeSlots])

  // Count active days
  const activeDaysCount = useMemo(() => {
    return Array.from(slotsByWeekday.values()).filter((list) => list.length > 0).length
  }, [slotsByWeekday])

  return (
    <div className="space-y-4">
      {/* ── Summary Bar ── */}
      <div className="flex flex-col gap-2 rounded-2xl border border-gray-200 bg-gray-50/70 p-4 sm:flex-row sm:items-center sm:justify-between text-xs">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-emerald-600" />
          <span className="font-bold text-gray-700">Mẫu slot tuần hiện hành:</span>
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-black text-emerald-800">
            {timeSlots.length} slot / tuần
          </span>
          <span className="text-gray-400">|</span>
          <span className="text-gray-600">
            {activeDaysCount} / 7 ngày có lịch
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-gray-500 font-medium">
          <Clock className="h-3.5 w-3.5 text-gray-400" />
          <span>Thời lượng chuẩn: <strong className="text-gray-900">{slotDurationMinutes} phút / slot</strong></span>
        </div>
      </div>

      {/* ── Empty State ── */}
      {timeSlots.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600 mb-3 border border-amber-200">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h4 className="text-sm font-black text-gray-900">
            Chưa có mẫu slot nào được sinh
          </h4>
          <p className="mt-1 max-w-md text-xs text-gray-500">
            Sân chưa có giờ mở cửa hoặc khung giờ mở cửa ngắn hơn thời lượng slot ({slotDurationMinutes} phút).
            Vui lòng cấu hình giờ hoạt động ở biểu mẫu phía trên để hệ thống tự động sinh các slot.
          </p>
        </div>
      ) : (
        /* ── Weekday Grid ── */
        <div className="space-y-3">
          {WEEKDAYS.map((w) => {
            const slots = slotsByWeekday.get(w.id) || []
            const dayOperating = operatingHours.filter((h) => h.weekday === w.id)

            return (
              <div
                key={w.id}
                className="rounded-2xl border border-gray-200 bg-white p-4 shadow-2xs transition-all"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-gray-100 pb-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`flex h-7 w-10 items-center justify-center rounded-lg text-xs font-black ${
                        slots.length > 0
                          ? "bg-emerald-600 text-white"
                          : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      {w.shortName}
                    </span>
                    <span className="text-sm font-black text-gray-900">
                      {w.name}
                    </span>
                    <span className="text-[11px] font-medium text-gray-400">
                      ({w.english})
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    {dayOperating.length > 0 ? (
                      <span className="text-gray-500 font-medium">
                        Giờ mở cửa:{" "}
                        <strong className="text-gray-800">
                          {dayOperating
                            .map((o) => `${toHHmm(o.opensAt)} – ${toHHmm(o.closesAt)}`)
                            .join(", ")}
                        </strong>
                      </span>
                    ) : (
                      <span className="text-gray-400 italic">Đóng cửa</span>
                    )}

                    <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-700">
                      {slots.length} slot
                    </span>
                  </div>
                </div>

                {/* Slots Grid */}
                {slots.length === 0 ? (
                  <div className="text-xs text-gray-400 italic py-1">
                    Không có slot hoạt động trong ngày này.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
                    {slots.map((slot) => (
                      <div
                        key={slot.id}
                        title={`Slot ID: ${slot.id}`}
                        className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-gray-50/70 p-2 text-center hover:bg-emerald-50 hover:border-emerald-200 transition-colors group cursor-default"
                      >
                        <div className="flex items-center gap-1 text-xs font-black text-gray-900 group-hover:text-emerald-800">
                          <span>{toHHmm(slot.startsAt)}</span>
                          <span className="text-gray-400 font-normal">-</span>
                          <span>{toHHmm(slot.endsAt)}</span>
                        </div>
                        <span className="mt-0.5 text-[9px] font-mono text-gray-400 truncate max-w-[80px]">
                          {slot.id.slice(0, 8)}...
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
