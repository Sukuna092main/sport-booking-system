import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeft, MapPin, Loader2, AlertCircle,
  Clock, CheckCircle, AlertTriangle,
  CalendarDays, ArrowRight,
} from "lucide-react"
import { useCourtById } from "@/features/courts/useCourts"
import { useCourtAvailability } from "@/features/courts/useCourts"
import { useSportTypes } from "@/features/courts/useCourts"
import type { AvailabilitySlot } from "@/types/court.types"

/* ── Helpers ─────────────────────────────────────────────────────── */

/** Format a UTC date-time string to local HH:MM */
function fmtTime(utcStr: string) {
  const d = new Date(utcStr)
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

/** Format YYYY-MM-DD to Vietnamese display */
function fmtDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString("vi-VN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })
}

/** Get YYYY-MM-DD string for today + offset days */
function getDateString(offsetDays: number) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().split("T")[0]
}

/** Build an array of { label, value } for the date picker (today + 6) */
function buildDateOptions() {
  return Array.from({ length: 7 }, (_, i) => {
    const dateStr = getDateString(i)
    const [y, m, d] = dateStr.split("-").map(Number)
    const date = new Date(y, m - 1, d)
    const weekday = date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()
    const dayNum = date.getDate()
    const monthAbbr = date
      .toLocaleDateString("en-US", { month: "short" })
      .toUpperCase()
    return { value: dateStr, weekday, day: dayNum, month: monthAbbr }
  })
}

/** Label for current month/year displayed on calendar strip */
function getMonthYear(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" })
}

/* ── Slot status helpers ─────────────────────────────────────────── */
type SlotStatus = "available" | "booked" | "past" | "blocked"

function getSlotStatus(slot: AvailabilitySlot): SlotStatus {
  if (!slot.available) {
    const now = new Date()
    const starts = new Date(slot.startsAt)
    if (starts <= now) return "past"
    return "booked"
  }
  return "available"
}

/* ── Slot item component ─────────────────────────────────────────── */
function SlotItem({
  slot,
  isSelected,
  onSelect,
}: {
  slot: AvailabilitySlot
  isSelected: boolean
  onSelect: () => void
}) {
  const status = getSlotStatus(slot)
  const startTime = fmtTime(slot.startsAt)
  const endTime = fmtTime(slot.endsAt)
  const timeRange = `${startTime} - ${endTime}`

  if (status === "past") {
    return (
      <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/50 px-4 py-3 opacity-50">
        <div className="flex items-center gap-2.5 text-sm text-gray-400">
          <Clock className="h-3.5 w-3.5" />
          <span className="font-medium">{timeRange}</span>
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
          past
        </span>
      </div>
    )
  }

  if (status === "booked") {
    return (
      <div className="relative flex items-center justify-between overflow-hidden rounded-xl border border-red-100 bg-red-50/40 px-4 py-3">
        {/* hatching pattern */}
        <div
          className="pointer-events-none absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "repeating-linear-gradient(-45deg, #ef4444 0, #ef4444 1px, transparent 0, transparent 50%)",
            backgroundSize: "8px 8px",
          }}
        />
        <div className="flex items-center gap-2.5 text-sm text-red-400">
          <Clock className="h-3.5 w-3.5" />
          <span className="font-medium">{timeRange}</span>
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-red-400">
          booked
        </span>
      </div>
    )
  }

  /* available */
  if (isSelected) {
    return (
      <button
        id={`slot-${slot.id}`}
        onClick={onSelect}
        className="flex items-center justify-between rounded-xl border-2 border-[#22C55E] bg-[#22C55E]/10 px-4 py-3 text-left transition-colors hover:bg-[#22C55E]/15 w-full"
      >
        <div className="flex items-center gap-2.5 text-sm text-[#15803D] font-semibold">
          <Clock className="h-3.5 w-3.5" />
          <span>{timeRange}</span>
        </div>
        <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-[#15803D]">
          <CheckCircle className="h-3 w-3" />
          selected
        </span>
      </button>
    )
  }

  return (
    <button
      id={`slot-${slot.id}`}
      onClick={onSelect}
      className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-left transition-colors hover:border-[#22C55E]/50 hover:bg-[#22C55E]/5 w-full group"
    >
      <div className="flex items-center gap-2.5 text-sm text-gray-700 group-hover:text-gray-900">
        <Clock className="h-3.5 w-3.5 text-gray-400 group-hover:text-[#22C55E]" />
        <span className="font-medium">{timeRange}</span>
      </div>
      <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-[#16A34A]">
        <CheckCircle className="h-3 w-3" />
        available
      </span>
    </button>
  )
}

/* ── Loading skeleton ────────────────────────────────────────────── */
function AvailabilitySkeleton() {
  return (
    <section className="py-4">
      <div className="h-4 w-32 rounded bg-gray-200 animate-pulse mb-4" />
      <div className="h-6 w-20 rounded bg-gray-200 animate-pulse mb-1" />
      <div className="h-9 w-48 rounded bg-gray-200 animate-pulse mb-2" />
      <div className="h-4 w-40 rounded bg-gray-200 animate-pulse mb-6" />
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-3">
          <div className="h-4 w-32 rounded bg-gray-200 animate-pulse" />
          <div className="flex gap-2 mt-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-16 w-14 rounded-xl bg-gray-200 animate-pulse" />
            ))}
          </div>
          <div className="mt-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-11 rounded-xl bg-gray-200 animate-pulse" />
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-3">
          <div className="h-4 w-24 rounded bg-gray-200 animate-pulse" />
          <div className="h-8 w-32 rounded bg-gray-200 animate-pulse" />
          <div className="h-10 w-full rounded-xl bg-gray-200 animate-pulse mt-4" />
        </div>
      </div>
    </section>
  )
}

/* ── Main page ──────────────────────────────────────────────────── */
export function CourtAvailabilityPage() {
  const { courtId } = useParams<{ courtId: string }>()
  const navigate = useNavigate()

  const dateOptions = buildDateOptions()
  const [selectedDate, setSelectedDate] = useState(dateOptions[0].value)
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null)

  const { data: court, isLoading: courtLoading } = useCourtById(courtId ?? "")
  const { data: sportTypes } = useSportTypes()
  const {
    data: availability,
    isLoading: availLoading,
    error: availError,
  } = useCourtAvailability(courtId ?? "", selectedDate)

  const sportTypeMap = Object.fromEntries(
    (sportTypes ?? []).map((st) => [st.id, st.name])
  )
  const sportName = court ? (sportTypeMap[court.sportTypeId] ?? "Sport") : ""

  // availLoading is used directly in JSX below; courtLoading drives the skeleton guard above
  if (courtLoading) return <AvailabilitySkeleton />

  const courtError = !courtLoading && !court
  if (courtError) {
    return (
      <section className="py-4">
        <button
          onClick={() => navigate(-1)}
          className="mb-6 flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to court
        </button>
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-600">
          Sân không tồn tại.
        </div>
      </section>
    )
  }

  /* Split slots into two columns */
  const slots = availability?.slots ?? []
  const leftSlots = slots.filter((_, i) => i % 2 === 0)
  const rightSlots = slots.filter((_, i) => i % 2 === 1)

  /* Selection info */
  const selectedStart = selectedSlot ? fmtTime(selectedSlot.startsAt) : null
  const selectedEnd = selectedSlot ? fmtTime(selectedSlot.endsAt) : null
  const duration = selectedSlot && court
    ? `${court.slotDurationMinutes >= 60
        ? `${court.slotDurationMinutes / 60} hour`
        : `${court.slotDurationMinutes} min`}`
    : null

  const formattedDate = selectedDate
    ? fmtDate(selectedDate)
    : ""

  return (
    <section className="py-4">
      {/* ── Back link ── */}
      <Link
        to={`/courts/${courtId}`}
        id="availability-back"
        className="mb-4 flex w-fit items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-gray-400 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        back to court
      </Link>

      {/* ── Page heading ── */}
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#16A34A]">
        court availability
      </p>
      <h1 className="mt-0.5 text-3xl font-black tracking-tight text-gray-900">
        {court?.name ?? ""}
      </h1>
      <div className="mt-2 flex items-center gap-3 text-sm text-gray-500">
        <div className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-gray-400" />
          <span>{court?.description ?? `Sân mã ${court?.code}`}</span>
        </div>
        <span className="text-gray-300">·</span>
        <div className="flex items-center gap-1 text-gray-400">
          <MapPin className="h-3 w-3" />
          <span className="text-xs">{sportName}</span>
        </div>
      </div>

      {/* ── Info banner ── */}
      <div className="mt-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-700">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        Select one or more consecutive available slots.
      </div>

      {/* ── Two-column layout ── */}
      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_280px]">

        {/* Left: calendar + time slots */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          {/* Date picker strip */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
              <CalendarDays className="h-4 w-4 text-gray-400" />
              Select a date
            </div>
            <span className="text-xs font-medium text-gray-400">
              {getMonthYear(selectedDate)}
            </span>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {dateOptions.map((opt) => {
              const isActive = opt.value === selectedDate
              return (
                <button
                  key={opt.value}
                  id={`date-${opt.value}`}
                  onClick={() => {
                    setSelectedDate(opt.value)
                    setSelectedSlot(null)
                  }}
                  className={`flex min-w-[52px] flex-col items-center rounded-xl px-3 py-3 transition-colors ${
                    isActive
                      ? "bg-gray-900 text-white shadow-sm"
                      : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <span className={`text-[10px] font-semibold ${isActive ? "text-gray-300" : "text-gray-400"}`}>
                    {opt.weekday}
                  </span>
                  <span className={`text-lg font-black leading-tight ${isActive ? "text-white" : "text-gray-800"}`}>
                    {opt.day}
                  </span>
                  <span className={`text-[9px] font-semibold ${isActive ? "text-gray-400" : "text-gray-400"}`}>
                    {opt.month}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Time slots */}
          <div className="mt-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-gray-800">Choose a time</p>
                <p className="text-xs text-gray-400">{fmtDate(selectedDate)}</p>
              </div>
              {/* Legend */}
              <div className="flex items-center gap-3 text-[10px] text-gray-400">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-[#22C55E]" />
                  Available
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                  Booked
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-red-400" />
                  Reserved
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-gray-300" />
                  Past
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-gray-400" />
                  Unavailable
                </span>
              </div>
            </div>

            {/* Slot error */}
            {availError && (
              <div role="alert" className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                Không thể tải danh sách slot. Vui lòng thử lại.
              </div>
            )}

            {/* Slot grid — 2 columns */}
            {availLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-[#16A34A]" />
                <span className="ml-2 text-sm text-gray-500">Đang tải slot…</span>
              </div>
            ) : slots.length === 0 ? (
              <div className="py-10 text-center">
                <Clock className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                <p className="text-sm text-gray-500">Không có slot nào trong ngày này.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {/* Left column */}
                <div className="space-y-2">
                  {leftSlots.map((slot) => (
                    <SlotItem
                      key={slot.id}
                      slot={slot}
                      isSelected={selectedSlot?.id === slot.id}
                      onSelect={() =>
                        setSelectedSlot((prev) =>
                          prev?.id === slot.id ? null : slot
                        )
                      }
                    />
                  ))}
                </div>
                {/* Right column */}
                <div className="space-y-2">
                  {rightSlots.map((slot) => (
                    <SlotItem
                      key={slot.id}
                      slot={slot}
                      isSelected={selectedSlot?.id === slot.id}
                      onSelect={() =>
                        setSelectedSlot((prev) =>
                          prev?.id === slot.id ? null : slot
                        )
                      }
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: selection summary */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">
            your selection
          </p>

          {selectedSlot ? (
            <>
              <p className="text-2xl font-black text-gray-900">
                {selectedStart} – {selectedEnd}
              </p>

              <div className="mt-4 space-y-2.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Court</span>
                  <span className="font-semibold text-gray-800">{court?.name}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Date</span>
                  <span className="font-semibold text-gray-800">{formattedDate}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Duration</span>
                  <span className="font-semibold text-gray-800">{duration}</span>
                </div>
              </div>

              {/* Continue booking CTA */}
              <button
                id="availability-continue-booking"
                className="mt-6 flex w-full items-center justify-between rounded-xl bg-[#B4FF00] px-5 py-3.5 text-sm font-bold text-gray-900 transition-colors hover:bg-[#AAEF00]"
                onClick={() => {
                  // Booking is planned (not yet implemented) — navigate will be wired
                  // once booking feature is ready
                  navigate(`/courts/${courtId}`)
                }}
              >
                Continue Booking
                <ArrowRight className="h-4 w-4" />
              </button>
              <p className="mt-2 text-center text-[10px] text-gray-400">
                You'll need to log in before continuing.
              </p>
            </>
          ) : (
            <>
              <p className="text-xl font-black text-gray-400">No time selected</p>
              <div className="mt-4 space-y-2.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Court</span>
                  <span className="font-semibold text-gray-500">{court?.name}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Date</span>
                  <span className="font-semibold text-gray-500">{formattedDate}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Duration</span>
                  <span className="font-semibold text-gray-500">–</span>
                </div>
              </div>
              <button
                disabled
                className="mt-6 flex w-full items-center justify-between rounded-xl bg-gray-100 px-5 py-3.5 text-sm font-bold text-gray-400 cursor-not-allowed"
              >
                Continue Booking
                <ArrowRight className="h-4 w-4" />
              </button>
              <p className="mt-2 text-center text-[10px] text-gray-400">
                You'll need to log in before continuing.
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
