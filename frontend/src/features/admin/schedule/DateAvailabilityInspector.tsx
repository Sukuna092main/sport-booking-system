import { useMemo, useState } from "react"
import {
  Calendar,
  Clock,
  RotateCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  ShieldAlert,
  Loader2,
  CalendarDays,
  Info,
} from "lucide-react"
import type { Court } from "@/types/court.types"
import { useCourtAvailability } from "@/features/courts/useCourts"
import {
  buildDateOptions,
  courtCalendarDate,
  DEFAULT_COURT_TIME_ZONE,
  formatSlotTime,
  getSlotStatus,
} from "@/features/availability/presentation"

export interface DateAvailabilityInspectorProps {
  court: Court
  timeZone?: string
}

export function DateAvailabilityInspector({
  court,
  timeZone = DEFAULT_COURT_TIME_ZONE,
}: DateAvailabilityInspectorProps) {
  const [now] = useState(() => new Date())
  const todayStr = useMemo(() => courtCalendarDate(now, timeZone), [now, timeZone])
  const [selectedDate, setSelectedDate] = useState<string>(todayStr)

  const dateOptions = useMemo(() => buildDateOptions(now, timeZone), [now, timeZone])

  // Fetch availability for court & selected date
  const {
    data: availabilityData,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useCourtAvailability(court.id, selectedDate)

  const slots = useMemo(() => availabilityData?.slots ?? [], [availabilityData?.slots])

  // Count available vs unavailable
  const stats = useMemo(() => {
    let available = 0
    let booked = 0
    let past = 0
    for (const s of slots) {
      const status = getSlotStatus(s, now)
      if (status === "available") available++
      else if (status === "past") past++
      else booked++
    }
    return { total: slots.length, available, booked, past }
  }, [slots, now])

  return (
    <div className="space-y-6">
      {/* ── Notice Bar ── */}
      <div className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 sm:flex-row sm:items-center sm:justify-between text-xs text-emerald-950">
        <div className="flex items-start gap-2.5">
          <Info className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
          <div>
            <p className="font-bold">
              Kiểm tra tính khả dụng thực tế theo ngày (Availability Inspector):
            </p>
            <p className="text-emerald-800 text-[11px] mt-0.5">
              Dữ liệu Availability phản ánh chính xác các slot khách hàng có thể đặt trong ngày đã chọn.
              Khi lưu thay đổi lịch hoạt động hoặc thời lượng slot, hệ thống sẽ tự động làm mới Availability.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-50 shadow-2xs disabled:opacity-50 transition-colors"
          >
            <RotateCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin text-emerald-600" : ""}`} />
            <span>{isFetching ? "Đang đồng bộ..." : "Làm mới dữ liệu"}</span>
          </button>
        </div>
      </div>

      {/* ── Separate Blackout Notice (Requirement: CourtBlackout UI tách riêng) ── */}
      <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-2.5 text-xs text-amber-900">
        <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
        <span className="text-[11px]">
          <strong>Lưu ý:</strong> Quản lý lịch chặn sân (Court Blackouts) được thực hiện trong màn hình quản trị Blackout riêng biệt, không tạo/sửa/xóa blackout tại thẻ cấu hình lịch này.
        </span>
      </div>

      {/* ── 30-Day Date Horizon Picker ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-gray-500" />
            <span className="text-xs font-black uppercase tracking-wider text-gray-700">
              Chọn ngày trong vòng 30 ngày (APP_TIMEZONE: {timeZone}):
            </span>
          </div>
          <span className="text-xs text-gray-500 font-bold">
            Đang chọn: <strong className="text-emerald-700">{selectedDate}</strong>
          </span>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 pt-1 scrollbar-thin">
          {dateOptions.map((opt) => {
            const isSelected = opt.value === selectedDate
            const isToday = opt.value === todayStr

            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSelectedDate(opt.value)}
                className={`flex flex-col items-center justify-center rounded-2xl border px-3.5 py-2.5 min-w-[70px] transition-all cursor-pointer ${
                  isSelected
                    ? "border-emerald-600 bg-emerald-600 text-white shadow-xs font-bold"
                    : isToday
                      ? "border-emerald-300 bg-emerald-50/70 text-emerald-900 hover:bg-emerald-100"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                <span className={`text-[10px] uppercase font-bold ${isSelected ? "text-emerald-100" : "text-gray-400"}`}>
                  {isToday ? "Hôm nay" : opt.weekday}
                </span>
                <span className="text-lg font-black tracking-tight my-0.5">
                  {opt.day}
                </span>
                <span className={`text-[10px] font-medium ${isSelected ? "text-emerald-100" : "text-gray-400"}`}>
                  {opt.month}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Stats Summary Bar ── */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-2xs text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold text-gray-700">Tổng số slot ngày {selectedDate}:</span>
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 font-black text-gray-800">
            {stats.total} slot
          </span>
        </div>
        <span className="text-gray-300">|</span>
        <div className="flex items-center gap-1.5 text-emerald-700">
          <CheckCircle className="h-3.5 w-3.5" />
          <span>Khả dụng: <strong>{stats.available}</strong></span>
        </div>
        <span className="text-gray-300">|</span>
        <div className="flex items-center gap-1.5 text-rose-700">
          <XCircle className="h-3.5 w-3.5" />
          <span>Đã đặt / Đóng: <strong>{stats.booked}</strong></span>
        </div>
        {stats.past > 0 && (
          <>
            <span className="text-gray-300">|</span>
            <div className="flex items-center gap-1.5 text-gray-400">
              <Clock className="h-3.5 w-3.5" />
              <span>Đã qua giờ: <strong>{stats.past}</strong></span>
            </div>
          </>
        )}
      </div>

      {/* ── Slots List / Status Grid ── */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white p-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mb-2" />
          <p className="text-xs font-bold text-gray-600">Đang tải dữ liệu Availability...</p>
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center text-rose-900">
          <AlertCircle className="h-8 w-8 text-rose-600 mb-2" />
          <p className="text-sm font-bold">Không thể tải Availability cho ngày {selectedDate}</p>
          <p className="text-xs text-rose-700 mt-1 max-w-md">
            {(error as Error)?.message || "Vui lòng kiểm tra lại kết nối mạng hoặc thử lại sau."}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-4 rounded-xl border border-rose-300 bg-white px-4 py-2 text-xs font-bold text-rose-800 hover:bg-rose-100 transition-colors"
          >
            Thử lại
          </button>
        </div>
      ) : slots.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400 mb-3">
            <Calendar className="h-6 w-6" />
          </div>
          <h4 className="text-sm font-black text-gray-900">
            Không có slot nào vào ngày {selectedDate}
          </h4>
          <p className="mt-1 max-w-md text-xs text-gray-500">
            Sân không có lịch mở cửa vào thứ này hoặc ngày được chọn không có slot khả dụng.
            Kiểm tra cấu hình Giờ Hoạt Động tuần ở thẻ bên cạnh.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {slots.map((slot) => {
            const status = getSlotStatus(slot, now)
            const startLabel = formatSlotTime(slot.startsAt, timeZone)
            const endLabel = formatSlotTime(slot.endsAt, timeZone)

            return (
              <div
                key={slot.id}
                title={`Slot ID: ${slot.id}\nStarts: ${slot.startsAt}\nEnds: ${slot.endsAt}`}
                className={`flex flex-col justify-between rounded-2xl border p-3.5 transition-all ${
                  status === "available"
                    ? "border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50 hover:border-emerald-300 shadow-2xs"
                    : status === "past"
                      ? "border-gray-200 bg-gray-50/70 opacity-60"
                      : "border-rose-200 bg-rose-50/40 hover:bg-rose-50"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                        status === "available"
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                          : status === "past"
                            ? "bg-gray-200 text-gray-600"
                            : "bg-rose-100 text-rose-800 border border-rose-300"
                      }`}
                    >
                      {status === "available" ? (
                        <>
                          <CheckCircle className="h-2.5 w-2.5" />
                          <span>Khả dụng</span>
                        </>
                      ) : status === "past" ? (
                        <>
                          <Clock className="h-2.5 w-2.5" />
                          <span>Đã qua</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-2.5 w-2.5" />
                          <span>Đã đặt / Đóng</span>
                        </>
                      )}
                    </span>
                  </div>

                  <div className="text-base font-black text-gray-900 tracking-tight">
                    {startLabel} – {endLabel}
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-gray-100/80 flex items-center justify-between text-[9px] font-mono text-gray-400">
                  <span>ID:</span>
                  <span className="truncate max-w-[80px]">{slot.id.slice(0, 8)}...</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
