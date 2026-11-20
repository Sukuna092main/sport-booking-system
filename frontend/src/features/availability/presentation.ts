import type { AvailabilityData, AvailabilitySlot } from "@/types/court.types"

// The MVP venue uses this zone before the first Availability response arrives.
export const DEFAULT_COURT_TIME_ZONE = "Asia/Ho_Chi_Minh"

export function courtCalendarDate(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now)
  const part = (name: string) => parts.find((value) => value.type === name)!.value
  return `${part("year")}-${part("month")}-${part("day")}`
}

export function buildDateOptions(now: Date, timeZone: string) {
  const today = courtCalendarDate(now, timeZone)
  // Calendar arithmetic in UTC avoids both browser-zone shifts and DST hours.
  const day = new Date(`${today}T00:00:00Z`)
  return Array.from({ length: 31 }, (_, offset) => {
    const date = new Date(day)
    date.setUTCDate(day.getUTCDate() + offset)
    return {
      value: date.toISOString().slice(0, 10),
      weekday: date.toLocaleDateString("vi-VN", { timeZone: "UTC", weekday: "short" }),
      day: date.getUTCDate(),
      month: `T${date.getUTCMonth() + 1}`,
    }
  })
}

export function formatSlotTime(timestamp: string, timeZone: string) {
  return new Date(timestamp).toLocaleTimeString("en-GB", {
    timeZone, hour: "2-digit", minute: "2-digit", hour12: false,
  })
}

export function getSlotStatus(slot: AvailabilitySlot, now: Date) {
  if (new Date(slot.startsAt) <= now) return "past"
  // The API exposes only a boolean; never invent a booked/blackout reason.
  return slot.available ? "available" : "unavailable"
}

export function selectedAvailableSlot(
  data: AvailabilityData | undefined,
  courtId: string,
  date: string,
  selectedId: string | null,
  now: Date,
) {
  if (!data || data.courtId.toLowerCase() !== courtId.toLowerCase() || data.date !== date) return null
  return data.slots.find((slot) => slot.id === selectedId && getSlotStatus(slot, now) === "available") ?? null
}

export function selectedAvailableSlots(
  data: AvailabilityData | undefined,
  courtId: string,
  date: string,
  selectedIds: string[],
  now: Date,
): AvailabilitySlot[] {
  if (!data || data.courtId.toLowerCase() !== courtId.toLowerCase() || data.date !== date) return []
  const selected = selectedIds.map((id) => data.slots.find((slot) => slot.id === id && getSlotStatus(slot, now) === "available"))
  return selected.every((slot): slot is AvailabilitySlot => slot !== undefined) ? selected : []
}
