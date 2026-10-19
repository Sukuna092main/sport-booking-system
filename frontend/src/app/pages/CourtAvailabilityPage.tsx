import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeft, MapPin, Loader2, AlertCircle,
  Clock, CheckCircle, AlertTriangle,
  CalendarDays, ArrowRight, Ban, XCircle,
} from "lucide-react"
import { useCourtById } from "@/features/courts/useCourts"
import { useCourtAvailability } from "@/features/courts/useCourts"
import { useSportTypes } from "@/features/courts/useCourts"
import { useAuth } from "@/features/auth/useAuth"
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

/** Build an array of { label, value } for the date picker (today + 29 = 30 days horizon per SRS C-01) */
function buildDateOptions() {
  return Array.from({ length: 30 }, (_, i) => {
    const dateStr = getDateString(i)
    const [y, m, d] = dateStr.split("-").map(Number)
    const date = new Date(y, m - 1, d)
    const weekday = date.toLocaleDateString("vi-VN", { weekday: "short" })
    const dayNum = date.getDate()
    const monthAbbr = "T" + (date.getMonth() + 1)
    return { value: dateStr, weekday, day: dayNum, month: monthAbbr }
  })
}

/** Label for current month/year displayed on calendar strip */
function getMonthYear(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number)
  const date = new Date(y, m - 1, d)
  return `Tháng ${date.getMonth() + 1}, ${date.getFullYear()}`
}

/* ── Slot status helpers ─────────────────────────────────────────── */
/**
 * Slot status classification:
 * - "past"       : startsAt <= now (already passed, regardless of available flag)
 * - "unavailable": available === false AND not past (booked or blackout)
 * - "available"  : available === true AND not past
 *
 * Per OpenAPI spec: available=false covers both "overlap blackout active" AND
 * "snapshot booking CONFIRMED". FE cannot distinguish them; we show "Không thể đặt".
 */
type SlotStatus = "available" | "unavailable" | "past"

function getSlotStatus(slot: AvailabilitySlot): SlotStatus {
  const now = new Date()
  const starts = new Date(slot.startsAt)

  // A slot is "past" if its start time is in the past
  if (starts <= now) return "past"

  // Future slot: check availability flag
  if (!slot.available) return "unavailable"

  return "available"
}

/** Returns true if slot can be selected */
function isSelectable(slot: AvailabilitySlot): boolean {
  return getSlotStatus(slot) === "available"
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
      <div
        className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3 opacity-50 cursor-not-allowed select-none"
      >
        <div className="flex items-center gap-2.5 text-sm text-gray-400">
          <Clock className="h-3.5 w-3.5" />
          <span className="font-medium">{timeRange}</span>
        </div>
        <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
          <XCircle className="h-3 w-3" />
          Đã qua
        </span>
      </div>
    )
  }

  if (status === "unavailable") {
    return (
      <div
        className="relative flex items-center justify-between overflow-hidden rounded-xl border border-red-100 bg-red-50/40 px-4 py-3 cursor-not-allowed select-none"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(-45deg, #ef4444 0, #ef4444 1px, transparent 0, transparent 50%)",
            backgroundSize: "8px 8px",
          }}
          aria-hidden="true"
        />
        <div className="flex items-center gap-2.5 text-sm text-red-400">
          <Clock className="h-3.5 w-3.5" />
          <span className="font-medium">{timeRange}</span>
        </div>
        <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-red-400">
          <Ban className="h-3 w-3" />
          Không thể đặt
        </span>
      </div>
    )
  }

  if (isSelected) {
    return (
      <button
        id={`slot-${slot.id}`}
        type="button"
        onClick={onSelect}
        aria-pressed="true"
        className="flex items-center justify-between rounded-xl border-2 border-[#22C55E] bg-[#22C55E]/10 px-4 py-3 text-left transition-all hover:bg-[#22C55E]/15 w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A]"
      >
        <div className="flex items-center gap-2.5 text-sm text-[#15803D] font-semibold">
          <Clock className="h-3.5 w-3.5" />
          <span>{timeRange}</span>
        </div>
        <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-[#15803D]">
          <CheckCircle className="h-3 w-3" />
          Đã chọn
        </span>
      </button>
    )
  }

  return (
    <button
      id={`slot-${slot.id}`}
      type="button"
      onClick={onSelect}
      aria-pressed="false"
      className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-left transition-all hover:border-[#22C55E]/60 hover:bg-[#22C55E]/5 w-full group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A]"
    >
      <div className="flex items-center gap-2.5 text-sm text-gray-700 group-hover:text-gray-900">
        <Clock className="h-3.5 w-3.5 text-gray-400 group-hover:text-[#22C55E]" />
        <span className="font-medium">{timeRange}</span>
      </div>
      <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-[#16A34A]">
        <CheckCircle className="h-3 w-3" />
        Còn trống
      </span>
    </button>
  )
}

/* ── Legend ──────────────────────────────────────────────────────── */
function SlotLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] text-gray-500">
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-2 w-2 rounded-full bg-[#22C55E]" />
        Còn trống
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-2 w-2 rounded-full bg-red-400" />
        Không thể đặt
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-2 w-2 rounded-full bg-gray-300" />
        Đã qua
      </span>
    </div>
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

/* ── Booking payload type (per CreateBookingRequest contract) ─────── */
interface BookingPayload {
  courtId: string
  bookingDate: string   // YYYY-MM-DD
  timeSlotIds: string[] // array of time_slot template UUIDs
}

/* ── Main page ──────────────────────────────────────────────────── */
export function CourtAvailabilityPage() {
  const { courtId } = useParams<{ courtId: string }>()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

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
          Quay lại chi tiết sân
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

  /**
   * Selection handler.
   * Guard: only allow "available" slots (not past, not unavailable).
   */
  function handleSlotSelect(slot: AvailabilitySlot) {
    if (!isSelectable(slot)) return
    setSelectedSlot((prev) => (prev?.id === slot.id ? null : slot))
  }

  /* Selection info */
  const selectedStart = selectedSlot ? fmtTime(selectedSlot.startsAt) : null
  const selectedEnd = selectedSlot ? fmtTime(selectedSlot.endsAt) : null
  const duration = selectedSlot && court
    ? `${court.slotDurationMinutes >= 60
        ? `${court.slotDurationMinutes / 60} gio`
        : `${court.slotDurationMinutes} phut`}`
    : null

  const formattedDate = selectedDate ? fmtDate(selectedDate) : ""

  /**
   * CreateBookingRequest payload (per API contract).
   * POST /bookings
   * {
   *   courtId: string (UUID),
   *   bookingDate: "YYYY-MM-DD",
   *   timeSlotIds: ["<slot.id>"]  -- time_slot template UUIDs in chronological order
   * }
   * S2 = single slot selection only. Multi-slot consecutive planned for S3.
   */
  const bookingPayload: BookingPayload | null = selectedSlot && courtId
    ? {
        courtId,
        bookingDate: selectedDate,
        timeSlotIds: [selectedSlot.id],
      }
    : null

  function handleContinueBooking() {
    if (!bookingPayload) return

    // Persist payload for use after auth or in booking page (S3)
    sessionStorage.setItem(
      "pending_booking_payload",
      JSON.stringify(bookingPayload)
    )

    if (!isAuthenticated) {
      navigate("/login")
      return
    }

    // Booking page planned for S3; navigate to /bookings as placeholder
    navigate("/bookings")
  }

  /* Count selectable slots for info banner */
  const availableCount = slots.filter((s) => isSelectable(s)).length

  return (
    <section className="py-4">
      {/* Back link */}
      <Link
        to={`/courts/${courtId}`}
        id="availability-back"
        className="mb-4 flex w-fit items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-gray-400 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Quay lại chi tiết sân
      </Link>

      {/* Page heading */}
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#16A34A]">
        Lịch khả dụng của sân
      </p>
      <h1 className="mt-0.5 text-3xl font-black tracking-tight text-gray-900">
        {court?.name ?? ""}
      </h1>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-500">
        <div className="flex items-center gap-1.5">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-100">
            <MapPin className="h-3 w-3 text-gray-400" />
          </div>
          <span className="text-sm text-gray-600">
            {court?.description ?? `Sân mã ${court?.code}`}
          </span>
        </div>
        {sportName && (
          <>
            <span className="text-gray-300">·</span>
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              {sportName}
            </span>
          </>
        )}
      </div>

      {/* Info banner */}
      {!availLoading && slots.length > 0 && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-700">
          <CheckCircle className="h-3.5 w-3.5 shrink-0" />
          <span>
            <span className="font-semibold">{availableCount}</span> khung giờ còn trống vào ngày{" "}
            <span className="font-semibold">{formattedDate}</span>. Chọn một khung giờ bên dưới để đặt sân.
          </span>
        </div>
      )}
      {(availLoading || slots.length === 0) && !availError && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-700">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Vui lòng chọn ngày và khung giờ còn trống để đặt sân.
        </div>
      )}

      {/* Two-column layout */}
      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_280px]">

        {/* Left: calendar + time slots */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          {/* Date picker strip */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
              <CalendarDays className="h-4 w-4 text-gray-400" />
              Chọn ngày
            </div>
            <span className="text-xs font-medium text-gray-400">
              {getMonthYear(selectedDate)}
            </span>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {dateOptions.map((opt) => {
              const isActive = opt.value === selectedDate
              return (
                <button
                  key={opt.value}
                  id={`date-${opt.value}`}
                  type="button"
                  onClick={() => {
                    setSelectedDate(opt.value)
                    setSelectedSlot(null)
                  }}
                  aria-pressed={isActive}
                  className={`flex min-w-[52px] flex-col items-center rounded-xl px-3 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A] ${
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
                <p className="text-sm font-semibold text-gray-800">Chọn khung giờ</p>
                <p className="text-xs text-gray-400">{fmtDate(selectedDate)}</p>
              </div>
              <SlotLegend />
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
                <p className="mt-1 text-xs text-gray-400">Sân có thể không mở cửa vào ngày này.</p>
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
                      onSelect={() => handleSlotSelect(slot)}
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
                      onSelect={() => handleSlotSelect(slot)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: selection summary */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm h-fit">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">
            Thông tin đã chọn
          </p>

          {selectedSlot ? (
            <>
              <p className="text-2xl font-black text-gray-900">
                {selectedStart} - {selectedEnd}
              </p>

              <div className="mt-4 space-y-2.5 rounded-xl bg-gray-50 px-3 py-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Sân</span>
                  <span className="font-semibold text-gray-800 truncate max-w-[140px]">{court?.name}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Ngày</span>
                  <span className="font-semibold text-gray-800">{formattedDate}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Thời lượng</span>
                  <span className="font-semibold text-gray-800">{duration}</span>
                </div>
              </div>

              {/* Continue booking CTA */}
              <button
                id="availability-continue-booking"
                type="button"
                className="mt-4 flex w-full items-center justify-between rounded-xl bg-[#B4FF00] px-5 py-3.5 text-sm font-bold text-gray-900 transition-colors hover:bg-[#AAEF00] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A]"
                onClick={handleContinueBooking}
              >
                Tiếp tục đặt sân
                <ArrowRight className="h-4 w-4" />
              </button>
              {!isAuthenticated && (
                <p className="mt-2 text-center text-[10px] text-gray-400">
                  Bạn sẽ được chuyển đến trang đăng nhập trước.
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-xl font-black text-gray-300">Chưa chọn khung giờ</p>
              <p className="mt-1 text-xs text-gray-400">
                Chọn một khung giờ còn trống bên trái để tiếp tục đặt sân.
              </p>

              <div className="mt-4 space-y-2.5 rounded-xl bg-gray-50 px-3 py-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Sân</span>
                  <span className="font-semibold text-gray-500">{court?.name}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Ngày</span>
                  <span className="font-semibold text-gray-500">{formattedDate}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Thời lượng</span>
                  <span className="font-semibold text-gray-400">-</span>
                </div>
              </div>

              <button
                id="availability-continue-booking"
                type="button"
                disabled
                aria-disabled="true"
                className="mt-4 flex w-full items-center justify-between rounded-xl bg-gray-100 px-5 py-3.5 text-sm font-bold text-gray-400 cursor-not-allowed select-none"
              >
                Tiếp tục đặt sân
                <ArrowRight className="h-4 w-4" />
              </button>
              {!isAuthenticated && (
                <p className="mt-2 text-center text-[10px] text-gray-400">
                  Bạn cần đăng nhập trước khi tiếp tục đặt sân.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  )
}
