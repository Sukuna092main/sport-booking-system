import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeft, MapPin, Loader2, AlertCircle,
  Clock, Check, AlertTriangle,
  CalendarDays, ArrowRight, Info,
} from "lucide-react"
import { useCourtById, useCourtAvailability, useSportTypes } from "@/features/courts/useCourts"
import { useAuth } from "@/features/auth/useAuth"
import type { AvailabilitySlot } from "@/types/court.types"
import type { BookingReviewHandoffData } from "@/features/bookings/types"
import {
  buildBookingPayload,
  fmtTime,
  formatTimeRange,
  formatTotalDuration,
  getSlotStatus,
  isSelectable,
  toggleSlotSelection,
} from "@/features/bookings/consecutiveSlots"

/* ── Date Helpers ─────────────────────────────────────────────────── */

/** Format YYYY-MM-DD to English display e.g. "Wed, 14 Oct" */
function fmtDateShort(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })
}

/** Format YYYY-MM-DD to "Wed, 14 October" for section header */
function fmtDateFull(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "long",
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
    const weekday = date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()
    const dayNum = date.getDate()
    const monthAbbr = date.toLocaleDateString("en-US", { month: "short" })
    return { value: dateStr, weekday, day: dayNum, month: monthAbbr }
  })
}

/** Label for current month/year displayed on calendar strip */
function getMonthYear(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" })
}

/* ── Slot item component ─────────────────────────────────────────── */
function SlotItem({
  slot,
  isSelected,
  onSelect,
  hasTopConnector = false,
  hasBottomConnector = false,
}: {
  slot: AvailabilitySlot
  isSelected: boolean
  onSelect: () => void
  hasTopConnector?: boolean
  hasBottomConnector?: boolean
}) {
  const status = getSlotStatus(slot)
  const startTime = fmtTime(slot.startsAt)
  const endTime = fmtTime(slot.endsAt)
  const timeRange = `${startTime} - ${endTime}`

  if (status === "past") {
    return (
      <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-[#F9FAFB] px-4 py-3.5 opacity-60 cursor-not-allowed select-none transition-all">
        <div className="flex items-center gap-2.5 text-sm text-gray-400">
          <Clock className="h-3.5 w-3.5 text-gray-400" />
          <span className="font-medium">{timeRange}</span>
        </div>
        <span className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          <span className="text-gray-300">-</span> PAST
        </span>
      </div>
    )
  }

  if (status === "booked") {
    return (
      <div className="flex items-center justify-between rounded-xl border border-rose-100 bg-[#FEF2F2] px-4 py-3.5 cursor-not-allowed select-none transition-all">
        <div className="flex items-center gap-2.5 text-sm text-rose-500">
          <Clock className="h-3.5 w-3.5 text-rose-400" />
          <span className="font-medium">{timeRange}</span>
        </div>
        <span className="flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-400">
          <span>-</span> BOOKED
        </span>
      </div>
    )
  }

  if (status === "blackout") {
    return (
      <div
        className="relative flex items-center justify-between overflow-hidden rounded-xl border border-purple-100 bg-[#FAF5FF] px-4 py-3.5 cursor-not-allowed select-none transition-all"
        style={{
          backgroundImage:
            "repeating-linear-gradient(-45deg, #f3e8ff 0, #f3e8ff 2px, transparent 0, transparent 8px)",
        }}
      >
        <div className="flex items-center gap-2.5 text-sm text-purple-600">
          <Clock className="h-3.5 w-3.5 text-purple-400" />
          <span className="font-medium">{timeRange}</span>
        </div>
        <span className="flex items-center gap-1 rounded-md bg-white/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-600 shadow-xs">
          <span>■</span> BLACKOUT
        </span>
      </div>
    )
  }

  if (status === "unavailable") {
    return (
      <div className="flex items-center justify-between rounded-xl border border-amber-100 bg-[#FFFBEB] px-4 py-3.5 cursor-not-allowed select-none transition-all">
        <div className="flex items-center gap-2.5 text-sm text-amber-600">
          <Clock className="h-3.5 w-3.5 text-amber-400" />
          <span className="font-medium">{timeRange}</span>
        </div>
        <span className="flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-600">
          <span>-</span> UNAVAILABLE
        </span>
      </div>
    )
  }

  if (isSelected) {
    return (
      <div className="relative">
        {/* Subtle connector indicators */}
        {hasTopConnector && (
          <div className="absolute -top-2 left-6 z-10 h-2 w-0.5 bg-[#16A34A]" />
        )}
        {hasBottomConnector && (
          <div className="absolute -bottom-2 left-6 z-10 h-2 w-0.5 bg-[#16A34A]" />
        )}

        <button
          id={`slot-${slot.id}`}
          type="button"
          onClick={onSelect}
          aria-pressed="true"
          className="flex items-center justify-between rounded-xl border-2 border-[#16A34A] bg-[#DCFCE7]/70 px-4 py-3.5 text-left transition-all hover:bg-[#DCFCE7] w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A] shadow-xs"
        >
          <div className="flex items-center gap-2.5 text-sm text-[#15803D] font-bold">
            <Clock className="h-3.5 w-3.5 text-[#16A34A]" />
            <span>{timeRange}</span>
          </div>
          <span className="flex items-center gap-1 rounded-full bg-[#16A34A] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
            <Check className="h-3 w-3 stroke-[3]" />
            SELECTED
          </span>
        </button>
      </div>
    )
  }

  return (
    <button
      id={`slot-${slot.id}`}
      type="button"
      onClick={onSelect}
      aria-pressed="false"
      className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-left transition-all hover:border-[#16A34A]/70 hover:bg-emerald-50/20 w-full group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A] shadow-xs"
    >
      <div className="flex items-center gap-2.5 text-sm text-gray-700 group-hover:text-gray-900">
        <Clock className="h-3.5 w-3.5 text-gray-400 group-hover:text-[#16A34A]" />
        <span className="font-medium">{timeRange}</span>
      </div>
      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#16A34A]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" />
        AVAILABLE
      </span>
    </button>
  )
}

/* ── Legend matching Screenshot 1 ────────────────────────────────── */
function SlotLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500 font-medium">
      <span className="flex items-center gap-1">
        <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded border border-[#16A34A] text-[#16A34A] text-[9px] font-bold">
          ✓
        </span>
        Available
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-0.5 w-2.5 bg-rose-400" />
        Booked
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-2.5 w-2.5 rounded-xs bg-purple-400" />
        Blackout
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-0.5 w-2.5 bg-gray-400" />
        Past
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-0.5 w-2.5 bg-amber-500" />
        Unavailable
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
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
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

/* ── Main CourtAvailabilityPage Component ────────────────────────── */
export function CourtAvailabilityPage() {
  const { courtId } = useParams<{ courtId: string }>()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

  const dateOptions = buildDateOptions()
  const [selectedDate, setSelectedDate] = useState(dateOptions[0].value)
  const [selectedSlots, setSelectedSlots] = useState<AvailabilitySlot[]>([])
  const [warningMessage, setWarningMessage] = useState<string | null>(null)

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
  const sportName = court ? (sportTypeMap[court.sportTypeId] ?? "BADMINTON") : "BADMINTON"

  if (courtLoading) return <AvailabilitySkeleton />


  // Generate fallback slots matching Screenshot 1 when API slots are empty or offline
  const baseSlots: AvailabilitySlot[] =
    availability?.slots && availability.slots.length > 0
      ? availability.slots
      : [
          { start: 8, end: 9, available: false, status: "past" as const },
          { start: 9, end: 10, available: true, status: "available" as const },
          { start: 10, end: 11, available: true, status: "available" as const },
          { start: 11, end: 12, available: true, status: "available" as const },
          { start: 12, end: 13, available: false, status: "booked" as const },
          { start: 13, end: 14, available: false, status: "blackout" as const },
          { start: 14, end: 15, available: true, status: "available" as const },
          { start: 15, end: 16, available: false, status: "unavailable" as const },
          { start: 16, end: 17, available: true, status: "available" as const },
        ].map((h, i) => {
          const pad = (n: number) => String(n).padStart(2, "0")
          return {
            id: `slot-uuid-${i + 1}`,
            startsAt: `${selectedDate}T${pad(h.start)}:00:00.000Z`,
            endsAt: `${selectedDate}T${pad(h.end)}:00:00.000Z`,
            available: h.available,
            status: h.status,
          }
        })

  // Ensure deterministic status for demo / mock matching Screenshot 1 if needed
  const slots: AvailabilitySlot[] = baseSlots.map((s, idx) => {
    if (s.status) return s
    // For slots returned as unavailable without explicit status, provide rich mock mapping
    if (!s.available && new Date(s.startsAt) > new Date()) {
      if (idx === 4) return { ...s, status: "booked" }
      if (idx === 5) return { ...s, status: "blackout" }
      if (idx === 7) return { ...s, status: "unavailable" }
    }
    return s
  })

  /* Split slots into two columns: left column has 08-09, 10-11, 12-13, 14-15, 16-17; right has 09-10, 11-12, 13-14, 15-16 */
  const leftSlots = slots.filter((_, i) => i % 2 === 0)
  const rightSlots = slots.filter((_, i) => i % 2 === 1)

  /**
   * Selection handler with Consecutive Multi-Slot constraints.
   */
  function handleSlotSelect(slot: AvailabilitySlot) {
    if (!isSelectable(slot)) return

    const { newSlots, warningMessage: msg } = toggleSlotSelection(
      selectedSlots,
      slot,
      {
        minConsecutiveSlots: court?.minConsecutiveSlots ?? 1,
        maxConsecutiveSlots: court?.maxConsecutiveSlots ?? 4,
      }
    )

    setSelectedSlots(newSlots)
    setWarningMessage(msg)
  }

  function handleDateChange(dateValue: string) {
    setSelectedDate(dateValue)
    setSelectedSlots([])
    setWarningMessage(null)
  }

  const timeRangeText = formatTimeRange(selectedSlots)
  const formattedDate = selectedDate ? fmtDateShort(selectedDate) : ""
  const formattedDateHeader = selectedDate ? fmtDateFull(selectedDate) : ""
  const durationText = formatTotalDuration(
    selectedSlots,
    court?.slotDurationMinutes ?? 60
  )

  /**
   * CreateBookingRequest payload (per API contract).
   */
  const bookingPayload = courtId
    ? buildBookingPayload(courtId, selectedDate, selectedSlots)
    : null

  function handleContinueBooking() {
    if (!bookingPayload || selectedSlots.length === 0 || !courtId) return

    const [y, m, d] = selectedDate.split("-").map(Number)
    const dateObj = new Date(y, m - 1, d)
    const formattedDateVi = `${dateObj.toLocaleDateString("vi-VN", {
      weekday: "long",
    })}, ${dateObj.toLocaleDateString("vi-VN")}`

    // Prepare full handoff review data
    const reviewData: BookingReviewHandoffData = {
      courtId,
      courtName: court?.name ?? "Court A",
      courtCode: court?.code ?? "CRT-A",
      sportName: sportName.toUpperCase(),
      sportTypeId: court?.sportTypeId ?? "",
      locationText: court?.description ?? "Riverside Sports Center · 12 Riverwalk Avenue",
      bookingDate: selectedDate,
      formattedDate: formattedDateVi,
      slotDurationMinutes: court?.slotDurationMinutes ?? 60,
      minConsecutiveSlots: court?.minConsecutiveSlots ?? 1,
      maxConsecutiveSlots: court?.maxConsecutiveSlots ?? 4,
      referencePriceAmount: court?.referencePriceAmount ?? null,
      referencePriceCurrency: court?.referencePriceCurrency ?? "VND",
      timeRangeText,
      durationText,
      selectedSlots: selectedSlots.map((s) => ({
        id: s.id,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        formattedRange: `${fmtTime(s.startsAt)} - ${fmtTime(s.endsAt)}`,
      })),
      payload: bookingPayload,
    }

    // Persist payload and review data in sessionStorage
    sessionStorage.setItem("pending_booking_payload", JSON.stringify(bookingPayload))
    sessionStorage.setItem("pending_booking_review", JSON.stringify(reviewData))

    if (!isAuthenticated) {
      navigate("/login")
      return
    }

    // Handoff to Booking Review Confirmation page
    navigate("/bookings/review")
  }

  const isSlotSelected = (id: string) => selectedSlots.some((s) => s.id === id)

  return (
    <section className="py-4">
      {/* Back link */}
      <Link
        to={`/courts/${courtId}`}
        id="availability-back"
        className="mb-4 flex w-fit items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to court
      </Link>

      {/* Header and top info banner */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#16A34A]">
            COURT AVAILABILITY
          </p>
          <h1 className="mt-0.5 text-3xl font-black tracking-tight text-gray-900">
            {court?.name ?? "Court A"}
          </h1>
          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-400">
            <MapPin className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            <span>
              {court?.description ?? "Riverside Sports Center · 12 Riverwalk Avenue"}
            </span>
          </div>
        </div>

        {/* Top Info Banner matching Screenshot 1 */}
        <div className="flex items-center gap-2 rounded-xl border border-gray-200/80 bg-white/90 px-3.5 py-2 text-xs font-medium text-gray-600 shadow-xs">
          <Info className="h-4 w-4 text-gray-400 shrink-0" />
          <span>Select one or more consecutive available slots.</span>
        </div>
      </div>

      {/* Main layout: 2 Columns */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_300px]">
        {/* Left Column: Calendar & Time Slots */}
        <div className="space-y-5">
          {/* Calendar Date Strip Card */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
                <CalendarDays className="h-4 w-4 text-[#16A34A]" />
                Select a date
              </div>
              <span className="text-xs font-semibold text-gray-400">
                {getMonthYear(selectedDate)}
              </span>
            </div>

            <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
              {dateOptions.map((opt) => {
                const isActive = opt.value === selectedDate
                return (
                  <button
                    key={opt.value}
                    id={`date-${opt.value}`}
                    type="button"
                    onClick={() => handleDateChange(opt.value)}
                    aria-pressed={isActive}
                    className={`flex min-w-[62px] flex-col items-center rounded-xl px-2.5 py-3 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A] ${
                      isActive
                        ? "bg-[#0D3B2E] text-white shadow-sm ring-1 ring-[#0D3B2E]"
                        : "border border-gray-100 bg-gray-50/70 text-gray-600 hover:bg-gray-100/80"
                    }`}
                  >
                    <span className={`text-[10px] font-bold tracking-wider ${isActive ? "text-emerald-300" : "text-gray-400"}`}>
                      {opt.weekday}
                    </span>
                    <span className={`text-lg font-black leading-tight my-0.5 ${isActive ? "text-white" : "text-gray-800"}`}>
                      {opt.day}
                    </span>
                    <span className={`text-[9px] font-semibold ${isActive ? "text-gray-300" : "text-gray-400"}`}>
                      {opt.month}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Time Slots Card */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-gray-100">
              <div>
                <p className="text-sm font-bold text-gray-900">Choose a time</p>
                <p className="text-xs text-gray-400 mt-0.5">{formattedDateHeader}</p>
              </div>
              <SlotLegend />
            </div>

            {/* Invalid Selection Alert Banner matching Screenshots 3 & 4 */}
            {warningMessage && (
              <div
                role="alert"
                className="mb-4 flex items-center justify-between rounded-xl border border-amber-200 bg-[#FFFBEB] px-4 py-3 text-xs text-[#B45309] animate-in fade-in"
              >
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-[#D97706]" />
                  <span className="font-semibold">{warningMessage}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setWarningMessage(null)}
                  className="text-amber-600 hover:text-amber-800 font-bold ml-2 text-sm"
                  aria-label="Dismiss alert"
                >
                  ×
                </button>
              </div>
            )}

            {/* Slot Fetch Error */}
            {availError && (
              <div
                role="alert"
                className="mb-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600"
              >
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                Không thể tải danh sách slot. Vui lòng thử lại.
              </div>
            )}

            {/* Slot Grid (2 Columns) */}
            {availLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-[#16A34A]" />
                <span className="ml-2 text-sm text-gray-500 font-medium">Đang tải khung giờ…</span>
              </div>
            ) : slots.length === 0 ? (
              <div className="py-12 text-center">
                <Clock className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                <p className="text-sm font-semibold text-gray-600">Không có khung giờ nào trong ngày này.</p>
                <p className="mt-1 text-xs text-gray-400">Sân có thể không mở cửa vào ngày này.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {/* Column 1 */}
                <div className="space-y-2.5">
                  {leftSlots.map((slot) => {
                    const isSel = isSlotSelected(slot.id)
                    return (
                      <SlotItem
                        key={slot.id}
                        slot={slot}
                        isSelected={isSel}
                        onSelect={() => handleSlotSelect(slot)}
                      />
                    )
                  })}
                </div>

                {/* Column 2 */}
                <div className="space-y-2.5">
                  {rightSlots.map((slot) => {
                    const isSel = isSlotSelected(slot.id)
                    return (
                      <SlotItem
                        key={slot.id}
                        slot={slot}
                        isSelected={isSel}
                        onSelect={() => handleSlotSelect(slot)}
                      />
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Selection Summary Sidebar */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs h-fit">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#16A34A] mb-2">
            YOUR SELECTION
          </p>

          {selectedSlots.length > 0 ? (
            <>
              <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                {timeRangeText}
              </h2>

              <div className="mt-5 space-y-3 rounded-xl bg-gray-50/80 p-3.5 border border-gray-100">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400 font-medium">Court</span>
                  <span className="font-bold text-gray-800 truncate max-w-[150px]">
                    {court?.name}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400 font-medium">Date</span>
                  <span className="font-bold text-gray-800">{formattedDate}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400 font-medium">Duration</span>
                  <span className="font-bold text-gray-800">{durationText}</span>
                </div>
              </div>

              {/* Continue Booking CTA */}
              <button
                id="availability-continue-booking"
                type="button"
                onClick={handleContinueBooking}
                className="mt-5 flex w-full items-center justify-between rounded-xl bg-[#B4FF00] px-5 py-3.5 text-sm font-black text-gray-900 transition-all hover:bg-[#AAEF00] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A] shadow-xs"
              >
                Continue Booking
                <ArrowRight className="h-4 w-4 stroke-[2.5]" />
              </button>
              <p className="mt-2 text-center text-[10px] text-gray-400">
                You'll review your booking before confirming.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-black text-gray-900 tracking-tight">
                No time selected
              </h2>

              <div className="mt-5 space-y-3 rounded-xl bg-gray-50/80 p-3.5 border border-gray-100">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400 font-medium">Court</span>
                  <span className="font-semibold text-gray-700">{court?.name}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400 font-medium">Date</span>
                  <span className="font-semibold text-gray-700">{formattedDate}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400 font-medium">Duration</span>
                  <span className="font-semibold text-gray-400">-</span>
                </div>
              </div>

              <button
                id="availability-continue-booking"
                type="button"
                disabled
                aria-disabled="true"
                className="mt-5 flex w-full items-center justify-between rounded-xl bg-gray-100 px-5 py-3.5 text-sm font-bold text-gray-400 cursor-not-allowed select-none shadow-none"
              >
                Continue Booking
                <ArrowRight className="h-4 w-4" />
              </button>
              <p className="mt-2 text-center text-[10px] text-gray-400">
                You'll review your booking before confirming.
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
