import type { AvailabilitySlot } from "@/types/court.types"
import type { CreateBookingPayload, SlotStatus } from "./types"

/**
 * Determine slot status for display:
 * - "past"       : startsAt <= now
 * - "booked"     : explicit status === "booked"
 * - "blackout"   : explicit status === "blackout"
 * - "unavailable": available === false and not past
 * - "available"  : available === true and not past
 */
export function getSlotStatus(slot: AvailabilitySlot, now = new Date()): SlotStatus {
  const starts = new Date(slot.startsAt)
  if (starts.getTime() <= now.getTime()) {
    return "past"
  }

  // If slot provides explicit status (e.g. from mock / extended API)
  if (slot.status) {
    return slot.status
  }

  if (!slot.available) {
    return "unavailable"
  }

  return "available"
}

/** Check if slot can be selected by user */
export function isSelectable(slot: AvailabilitySlot, now = new Date()): boolean {
  return getSlotStatus(slot, now) === "available"
}

/**
 * Check if newSlot is immediately adjacent to the current range of selected slots.
 * Returns position ('before' | 'after' | 'none') and boolean flag.
 */
export function isSlotConsecutive(
  currentSlots: AvailabilitySlot[],
  newSlot: AvailabilitySlot
): { isConsecutive: boolean; position: "before" | "after" | "none" } {
  if (currentSlots.length === 0) {
    return { isConsecutive: true, position: "after" }
  }

  const sorted = [...currentSlots].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
  )

  const firstSlot = sorted[0]
  const lastSlot = sorted[sorted.length - 1]

  const newStart = new Date(newSlot.startsAt).getTime()
  const newEnd = new Date(newSlot.endsAt).getTime()
  const firstStart = new Date(firstSlot.startsAt).getTime()
  const lastEnd = new Date(lastSlot.endsAt).getTime()

  // Immediately preceding the first slot
  if (newEnd === firstStart) {
    return { isConsecutive: true, position: "before" }
  }

  // Immediately following the last slot
  if (newStart === lastEnd) {
    return { isConsecutive: true, position: "after" }
  }

  return { isConsecutive: false, position: "none" }
}

/**
 * Check if a selected slot can be unselected without breaking consecutiveness.
 * User can only remove from either end (start or end) of the current selection.
 */
export function canRemoveSlot(
  currentSlots: AvailabilitySlot[],
  slotToRemove: AvailabilitySlot
): { canRemove: boolean; warningMessage?: string } {
  if (currentSlots.length <= 1) {
    return { canRemove: true }
  }

  const sorted = [...currentSlots].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
  )

  const firstId = sorted[0].id
  const lastId = sorted[sorted.length - 1].id

  if (slotToRemove.id === firstId || slotToRemove.id === lastId) {
    return { canRemove: true }
  }

  return {
    canRemove: false,
    warningMessage: "Remove a slot from either end to keep your booking consecutive.",
  }
}

export interface CourtSlotConstraints {
  minConsecutiveSlots?: number
  maxConsecutiveSlots?: number
}

/**
 * Toggle or add/remove a slot while strictly enforcing:
 * 1. Consecutiveness (adjacent slots only)
 * 2. Unselection from ends only (preserves consecutiveness)
 * 3. Min/Max slot constraints
 */
export function toggleSlotSelection(
  currentSlots: AvailabilitySlot[],
  slot: AvailabilitySlot,
  constraints: CourtSlotConstraints = {}
): {
  newSlots: AvailabilitySlot[]
  warningMessage: string | null
} {
  const maxSlots = constraints.maxConsecutiveSlots ?? 4

  const isAlreadySelected = currentSlots.some((s) => s.id === slot.id)

  if (isAlreadySelected) {
    const removalCheck = canRemoveSlot(currentSlots, slot)
    if (!removalCheck.canRemove) {
      return {
        newSlots: currentSlots,
        warningMessage:
          removalCheck.warningMessage ??
          "Remove a slot from either end to keep your booking consecutive.",
      }
    }
    const updated = currentSlots.filter((s) => s.id !== slot.id)
    return {
      newSlots: updated,
      warningMessage: null,
    }
  }

  // Not selected yet: Attempt to add
  if (currentSlots.length === 0) {
    return {
      newSlots: [slot],
      warningMessage: null,
    }
  }

  const consecutiveCheck = isSlotConsecutive(currentSlots, slot)
  if (!consecutiveCheck.isConsecutive) {
    return {
      newSlots: currentSlots,
      warningMessage:
        "Choose a time next to your current selection to create one consecutive booking.",
    }
  }

  // Check max constraint
  if (currentSlots.length >= maxSlots) {
    return {
      newSlots: currentSlots,
      warningMessage: `Maximum ${maxSlots} consecutive slots allowed per booking.`,
    }
  }

  let updated: AvailabilitySlot[]
  if (consecutiveCheck.position === "before") {
    updated = [slot, ...currentSlots]
  } else {
    updated = [...currentSlots, slot]
  }

  // Sort chronologically
  updated.sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
  )

  return {
    newSlots: updated,
    warningMessage: null,
  }
}

/**
 * Validate current slot selection against court rules and API contract
 */
export function validateSlotSelection(
  slots: AvailabilitySlot[],
  constraints: CourtSlotConstraints = {}
): { isValid: boolean; error: string | null } {
  const minSlots = constraints.minConsecutiveSlots ?? 1
  const maxSlots = constraints.maxConsecutiveSlots ?? 4

  if (slots.length === 0) {
    return { isValid: false, error: "Vui lòng chọn ít nhất một khung giờ." }
  }

  if (slots.length < minSlots) {
    return {
      isValid: false,
      error: `Số lượng slot tối thiểu là ${minSlots} slot liên tiếp.`,
    }
  }

  if (slots.length > maxSlots) {
    return {
      isValid: false,
      error: `Số lượng slot tối đa là ${maxSlots} slot liên tiếp.`,
    }
  }

  const sorted = [...slots].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
  )

  for (let i = 0; i < sorted.length - 1; i++) {
    const currentEnd = new Date(sorted[i].endsAt).getTime()
    const nextStart = new Date(sorted[i + 1].startsAt).getTime()
    if (currentEnd !== nextStart) {
      return {
        isValid: false,
        error: "Các khung giờ đã chọn phải liên tiếp nhau.",
      }
    }
  }

  return { isValid: true, error: null }
}

/**
 * Validate booking review data including date horizon and past slots
 */
export function validateBookingReview(
  bookingDate: string,
  slots: Array<{ id: string; startsAt: string; endsAt: string }>,
  constraints: CourtSlotConstraints = {},
  now = new Date()
): { isValid: boolean; error: string | null } {
  const minSlots = constraints.minConsecutiveSlots ?? 1
  const maxSlots = constraints.maxConsecutiveSlots ?? 4

  if (!bookingDate) {
    return { isValid: false, error: "Ngày đặt sân không hợp lệ." }
  }

  // Horizon check: max 30 days from today (today + 29 days)
  const [y, m, d] = bookingDate.split("-").map(Number)
  const targetDate = new Date(y, m - 1, d)
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diffTime = targetDate.getTime() - todayMidnight.getTime()
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays < 0) {
    return { isValid: false, error: "Không thể đặt sân cho ngày trong quá khứ." }
  }

  if (diffDays >= 30) {
    return {
      isValid: false,
      error: "Ngày đặt sân vượt quá phạm vi 30 ngày cho phép (BOOKING_HORIZON_EXCEEDED).",
    }
  }

  if (!slots || slots.length === 0) {
    return { isValid: false, error: "Vui lòng chọn ít nhất một khung giờ." }
  }

  if (slots.length < minSlots) {
    return {
      isValid: false,
      error: `Số lượng slot tối thiểu là ${minSlots} slot liên tiếp.`,
    }
  }

  if (slots.length > maxSlots) {
    return {
      isValid: false,
      error: `Số lượng slot tối đa là ${maxSlots} slot liên tiếp.`,
    }
  }

  // Check if any slot is in the past
  for (const s of slots) {
    if (new Date(s.startsAt).getTime() <= now.getTime()) {
      return {
        isValid: false,
        error: "Một hoặc nhiều khung giờ đã bắt đầu hoặc đã qua thời điểm hiện tại.",
      }
    }
  }

  // Check consecutive slots
  const sorted = [...slots].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
  )

  for (let i = 0; i < sorted.length - 1; i++) {
    const currentEnd = new Date(sorted[i].endsAt).getTime()
    const nextStart = new Date(sorted[i + 1].startsAt).getTime()
    if (currentEnd !== nextStart) {
      return {
        isValid: false,
        error: "Các khung giờ đã chọn phải liên tiếp nhau, không có khoảng trống.",
      }
    }
  }

  return { isValid: true, error: null }
}

/**
 * Format reference price for display per OpenAPI / SRS (display only, no MVP payment)
 */
export function formatReferencePrice(
  amount: string | number | null | undefined,
  currency?: string | null,
  slotCount = 1
): { unitText: string; totalText: string; isConfigured: boolean } {
  const curr = currency || "VND"
  if (amount === null || amount === undefined || amount === "") {
    return {
      unitText: "Chưa cấu hình",
      totalText: "Miễn phí tham chiếu (MVP)",
      isConfigured: false,
    }
  }

  const num = Number(amount)
  if (isNaN(num) || num <= 0) {
    return {
      unitText: "Chưa cấu hình",
      totalText: "Miễn phí tham chiếu (MVP)",
      isConfigured: false,
    }
  }

  const unitFormatted = `${num.toLocaleString("vi-VN")} ${curr}`
  const totalFormatted = `${(num * Math.max(1, slotCount)).toLocaleString("vi-VN")} ${curr}`

  return {
    unitText: `${unitFormatted} / slot`,
    totalText: totalFormatted,
    isConfigured: true,
  }
}


/** Format UTC date-time string to local HH:MM */
export function fmtTime(utcStr: string): string {
  const d = new Date(utcStr)
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

/** Format time range for selected slots (e.g. "09:00 – 12:00") */
export function formatTimeRange(slots: AvailabilitySlot[]): string {
  if (slots.length === 0) return "No time selected"

  const sorted = [...slots].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
  )

  const firstStart = fmtTime(sorted[0].startsAt)
  const lastEnd = fmtTime(sorted[sorted.length - 1].endsAt)
  return `${firstStart} – ${lastEnd}`
}

/** Format total duration (e.g. "3 hours", "1 hour", "60 minutes") */
export function formatTotalDuration(
  slots: AvailabilitySlot[],
  slotDurationMinutes: number
): string {
  if (slots.length === 0) return "-"

  const totalMinutes = slots.length * slotDurationMinutes
  if (totalMinutes % 60 === 0) {
    const hours = totalMinutes / 60
    return hours === 1 ? "1 hour" : `${hours} hours`
  }
  return `${totalMinutes} mins`
}

/** Build OpenAPI CreateBookingRequest payload */
export function buildBookingPayload(
  courtId: string,
  bookingDate: string,
  selectedSlots: AvailabilitySlot[]
): CreateBookingPayload | null {
  if (!courtId || !bookingDate || selectedSlots.length === 0) {
    return null
  }

  const sorted = [...selectedSlots].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
  )

  return {
    courtId,
    bookingDate,
    timeSlotIds: sorted.map((s) => s.id),
  }
}
