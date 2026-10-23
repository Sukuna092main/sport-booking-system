import { describe, expect, it } from "vitest"
import type { AvailabilityData, AvailabilitySlot } from "@/types/court.types"
import { buildDateOptions, courtCalendarDate, formatSlotTime, getSlotStatus, selectedAvailableSlot, selectedAvailableSlots } from "./presentation"

const zone = "Asia/Ho_Chi_Minh"
const now = new Date("2026-10-15T17:10:00Z") // 00:10 on Oct 16 at the venue.
const slot: AvailabilitySlot = {
  id: "slot-1", startsAt: "2026-10-23T01:00:00Z", endsAt: "2026-10-23T02:00:00Z", available: true,
}
const data: AvailabilityData = { courtId: "court-A", date: "2026-10-23", timeZone: zone, slots: [slot] }

describe("Availability presentation follows the venue calendar", () => {
  it("uses the venue date across UTC midnight", () => {
    expect(courtCalendarDate(now, zone)).toBe("2026-10-16")
    expect(courtCalendarDate(now, "America/Los_Angeles")).toBe("2026-10-15")
  })
  it("includes today through +30 calendar days", () => {
    const dates = buildDateOptions(now, zone)
    expect(dates).toHaveLength(31)
    expect(dates[0].value).toBe("2026-10-16")
    expect(dates[30].value).toBe("2026-11-15")
    expect(new Set(dates.map((date) => date.value)).size).toBe(31)
  })
  it("keeps calendar dates through a DST transition", () => {
    const dates = buildDateOptions(new Date("2026-10-31T23:00:00Z"), "America/New_York")
    expect(dates[0].value).toBe("2026-10-31")
    expect(dates[1].value).toBe("2026-11-01")
    expect(dates[30].value).toBe("2026-11-30")
  })
  it("formats UTC snapshots in the API timeZone", () => {
    expect(formatSlotTime(slot.startsAt, zone)).toBe("08:00")
    expect(formatSlotTime(slot.startsAt, "America/New_York")).toBe("21:00")
  })
  it("does not invent a booked reason for blackout/unavailable slots", () => {
    expect(getSlotStatus({ ...slot, available: false }, now)).toBe("unavailable")
    expect(getSlotStatus(slot, new Date(slot.startsAt))).toBe("past")
    expect(getSlotStatus(slot, now)).toBe("available")
  })
})

describe("Single-slot selection uses the latest response", () => {
  it("selects one current available slot", () => {
    expect(selectedAvailableSlot(data, "court-a", data.date, slot.id, now)).toEqual(slot)
  })
  it("drops a selection made unavailable by refetch", () => {
    const changed = { ...data, slots: [{ ...slot, available: false }] }
    expect(selectedAvailableSlot(changed, data.courtId, data.date, slot.id, now)).toBeNull()
  })
  it("does not keep slots from a different court or date", () => {
    expect(selectedAvailableSlot(data, "court-B", data.date, slot.id, now)).toBeNull()
    expect(selectedAvailableSlot(data, data.courtId, "2026-10-24", slot.id, now)).toBeNull()
    expect(selectedAvailableSlot(undefined, data.courtId, data.date, slot.id, now)).toBeNull()
  })
  it("drops a stale available flag after the slot starts", () => {
    expect(selectedAvailableSlot(data, data.courtId, data.date, slot.id, new Date(slot.startsAt))).toBeNull()
  })
})

describe("Multi-slot selection uses the latest response", () => {
  const next = { ...slot, id: "slot-2", startsAt: slot.endsAt, endsAt: "2026-10-23T03:00:00Z" }
  const pair = { ...data, slots: [slot, next] }
  it("keeps both consecutive available slots", () => {
    expect(selectedAvailableSlots(pair, data.courtId, data.date, [slot.id, next.id], now)).toEqual([slot, next])
  })
  it("drops the whole selection when one slot is no longer available", () => {
    const changed = { ...pair, slots: [slot, { ...next, available: false }] }
    expect(selectedAvailableSlots(changed, data.courtId, data.date, [slot.id, next.id], now)).toEqual([])
  })
  it("rejects stale court, date, or absent response", () => {
    expect(selectedAvailableSlots(pair, "court-B", data.date, [slot.id, next.id], now)).toEqual([])
    expect(selectedAvailableSlots(pair, data.courtId, "2026-10-24", [slot.id, next.id], now)).toEqual([])
    expect(selectedAvailableSlots(undefined, data.courtId, data.date, [slot.id, next.id], now)).toEqual([])
  })
})
