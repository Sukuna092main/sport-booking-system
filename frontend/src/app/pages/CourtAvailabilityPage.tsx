import { useState, useMemo } from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import {
  ArrowLeft, MapPin, Loader2, AlertCircle,
  Clock, Check, AlertTriangle,
  CalendarDays, ArrowRight, Info,
  ChevronLeft, ChevronRight,
} from "lucide-react"
import { useCourtById, useCourtAvailability, useSportTypes } from "@/features/courts/useCourts"
import { useAuth } from "@/features/auth/useAuth"
import type { AvailabilitySlot } from "@/types/court.types"
import type { BookingReviewHandoffData } from "@/features/bookings/types"
import {
  buildBookingPayload,
  formatTimeRange,
  formatTotalDuration,
  toggleSlotSelection,
} from "@/features/bookings/consecutiveSlots"

import { buildDateOptions, courtCalendarDate, DEFAULT_COURT_TIME_ZONE, formatSlotTime, getSlotStatus, selectedAvailableSlots } from "@/features/availability/presentation"

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
  timeZone,
  hasTopConnector = false,
  hasBottomConnector = false,
}: {
  slot: AvailabilitySlot
  isSelected: boolean
  onSelect: () => void
  timeZone: string
  hasTopConnector?: boolean
  hasBottomConnector?: boolean
}) {
  const status = getSlotStatus(slot, new Date())
  const startTime = formatSlotTime(slot.startsAt, timeZone)
  const endTime = formatSlotTime(slot.endsAt, timeZone)
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

  if (status === "unavailable") {
    return (
      <div className="flex items-center justify-between rounded-xl border border-rose-100 bg-[#FEF2F2] px-4 py-3.5 cursor-not-allowed select-none transition-all">
        <div className="flex items-center gap-2.5 text-sm text-rose-500">
          <Clock className="h-3.5 w-3.5 text-rose-400" />
          <span className="font-medium">{timeRange}</span>
        </div>
        <span className="flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-400">
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

  const [searchParams] = useSearchParams()
  const dateFromQuery = searchParams.get("date")

  const [selectedDate, setSelectedDate] = useState(() => {
    return dateFromQuery || courtCalendarDate(new Date(), DEFAULT_COURT_TIME_ZONE)
  })
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [warningMessage, setWarningMessage] = useState<string | null>(null)
  const { data: court, isLoading: courtLoading } = useCourtById(courtId ?? "")
  const { data: sportTypes } = useSportTypes()
  const { data: availability, isLoading: availLoading, error: availError, refetch: refetchAvailability } = useCourtAvailability(courtId ?? "", selectedDate)
  const timeZone = availability?.timeZone ?? DEFAULT_COURT_TIME_ZONE
  const dateOptions = buildDateOptions(new Date(), timeZone)

  // Chia danh sách ngày thành từng tuần (mỗi tuần 7 ngày)
  const weeks = useMemo(() => {
    const list: (typeof dateOptions)[] = []
    for (let i = 0; i < dateOptions.length; i += 7) {
      list.push(dateOptions.slice(i, i + 7))
    }
    return list
  }, [dateOptions])

  // Xác định tuần hiện tại dựa trên selectedDate
  const currentWeekIndex = useMemo(() => {
    const idx = weeks.findIndex((w) => w.some((d) => d.value === selectedDate))
    return idx >= 0 ? idx : 0
  }, [weeks, selectedDate])

  function handleWeekChange(newIndex: number) {
    if (newIndex < 0 || newIndex >= weeks.length) return
    const targetWeek = weeks[newIndex]
    if (targetWeek && !targetWeek.some((d) => d.value === selectedDate)) {
      handleDateChange(targetWeek[0].value)
    }
  }

  const currentWeekDays = weeks[currentWeekIndex] ?? []
  const weekStart = currentWeekDays[0]
  const weekEnd = currentWeekDays[currentWeekDays.length - 1]
  const weekRangeLabel = weekStart && weekEnd
    ? `${weekStart.day}/${weekStart.month.replace("T", "")} – ${weekEnd.day}/${weekEnd.month.replace("T", "")}`
    : ""

  const selectedSlots = !availError && !availLoading
    ? selectedAvailableSlots(availability, courtId ?? "", selectedDate, selectedIds, new Date()) : []

  const sportTypeMap = Object.fromEntries(
    (sportTypes ?? []).map((st) => [st.id, st.name])
  )
  const sportName = court ? (sportTypeMap[court.sportTypeId] ?? "BADMINTON") : "BADMINTON"

  if (courtLoading) return <AvailabilitySkeleton />


  const slots = availability?.slots ?? []

  /**
   * Selection handler with Consecutive Multi-Slot constraints.
   */
  function handleSlotSelect(slot: AvailabilitySlot) {
    if (getSlotStatus(slot, new Date()) !== "available" || !availability || availError) return

    const { newSlots, warningMessage: msg } = toggleSlotSelection(
      selectedSlots,
      slot,
      {
        minConsecutiveSlots: court?.minConsecutiveSlots ?? 1,
        maxConsecutiveSlots: court?.maxConsecutiveSlots ?? 4,
      }
    )

    setSelectedIds(newSlots.map((item) => item.id))
    setWarningMessage(msg)
  }

  function handleDateChange(dateValue: string) {
    setSelectedDate(dateValue)
    setSelectedIds([])
    setWarningMessage(null)
  }

  const timeRangeText = selectedSlots.length ? `${formatSlotTime(selectedSlots[0].startsAt, timeZone)} – ${formatSlotTime(selectedSlots[selectedSlots.length - 1].endsAt, timeZone)}` : formatTimeRange(selectedSlots)
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
    if (!bookingPayload || selectedSlots.length === 0 || selectedSlots.length !== selectedIds.length || !courtId || availError || availLoading) return

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
        formattedRange: `${formatSlotTime(s.startsAt, timeZone)} - ${formatSlotTime(s.endsAt, timeZone)}`,
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
          {/* Calendar Date Strip Card - Chia theo tuần 7 ngày */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs">
            {/* Top header: Title + Month/Year */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
                <CalendarDays className="h-4 w-4 text-[#16A34A]" />
                <span>Chọn ngày đặt sân</span>
              </div>
              <span className="text-xs font-semibold text-gray-400">
                {getMonthYear(selectedDate)}
              </span>
            </div>

            {/* Week navigation & week selector pills */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-4 pb-3 border-b border-gray-100">
              {/* Prev / Next buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  id="prev-week-btn"
                  disabled={currentWeekIndex === 0}
                  onClick={() => handleWeekChange(currentWeekIndex - 1)}
                  className="flex h-8 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Tuần trước</span>
                </button>

                <div className="px-2 text-xs font-bold text-gray-800">
                  Tuần {currentWeekIndex + 1}
                  <span className="ml-1 text-[11px] font-normal text-gray-400">({weekRangeLabel})</span>
                </div>

                <button
                  type="button"
                  id="next-week-btn"
                  disabled={currentWeekIndex >= weeks.length - 1}
                  onClick={() => handleWeekChange(currentWeekIndex + 1)}
                  className="flex h-8 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span>Tuần sau</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Quick week tabs */}
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                {weeks.map((_, wIdx) => {
                  const isCurrent = wIdx === currentWeekIndex
                  const label = wIdx === 0 ? "Tuần này" : wIdx === 1 ? "Tuần tới" : `Tuần ${wIdx + 1}`
                  return (
                    <button
                      key={wIdx}
                      type="button"
                      id={`week-tab-${wIdx}`}
                      onClick={() => handleWeekChange(wIdx)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                        isCurrent
                          ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300"
                          : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 7 Days of the Selected Week */}
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2.5">
              {currentWeekDays.map((opt) => {
                const isActive = opt.value === selectedDate
                return (
                  <button
                    key={opt.value}
                    id={`date-${opt.value}`}
                    type="button"
                    onClick={() => handleDateChange(opt.value)}
                    aria-pressed={isActive}
                    className={`flex flex-col items-center justify-center rounded-xl p-2 sm:p-2.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A] ${
                      isActive
                        ? "bg-[#0D3B2E] text-white shadow-sm ring-1 ring-[#0D3B2E]"
                        : "border border-gray-100 bg-gray-50/70 text-gray-600 hover:bg-gray-100/80"
                    }`}
                  >
                    <span className={`text-[10px] font-bold tracking-wider ${isActive ? "text-emerald-300" : "text-gray-400"}`}>
                      {opt.weekday}
                    </span>
                    <span className={`text-base sm:text-lg font-black leading-tight my-0.5 ${isActive ? "text-white" : "text-gray-800"}`}>
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
                Không thể tải danh sách slot. Vui lòng thử lại. <button className="underline" onClick={() => refetchAvailability()}>Thử lại</button>
              </div>
            )}

            {/* Slot Grid (2 Columns) */}
            {availError ? null : availLoading ? (
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
                {slots.map((slot) => (
                  <SlotItem key={slot.id} slot={slot} timeZone={timeZone}
                    isSelected={isSlotSelected(slot.id)} onSelect={() => handleSlotSelect(slot)} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Selection Summary Sidebar */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs h-fit">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#16A34A] mb-2">
            YOUR SELECTION
          </p>

          {selectedSlots.length > 0 && selectedSlots.length === selectedIds.length ? (
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
