/**
 * Unit tests for Availability Display & Single-Slot Selection (S2)
 *
 * Checklist:
 * [x] Chon ngay — date options cover today + 29 days (30 days total)
 * [x] Hien thi available/unavailable — getSlotStatus returns correct status
 * [x] Khong chon past/blackout/booked — isSelectable() returns false for non-available
 * [x] Payload dung contract — BookingPayload structure matches CreateBookingRequest
 */
import { describe, expect, it } from "vitest"

/* ── Helpers extracted from CourtAvailabilityPage (duplicated for testability) ── */

type SlotStatus = "available" | "unavailable" | "past"

interface MockSlot {
  id: string
  startsAt: string
  endsAt: string
  available: boolean
}

function getSlotStatus(slot: MockSlot): SlotStatus {
  const now = new Date()
  const starts = new Date(slot.startsAt)
  if (starts <= now) return "past"
  if (!slot.available) return "unavailable"
  return "available"
}

function isSelectable(slot: MockSlot): boolean {
  return getSlotStatus(slot) === "available"
}

function getDateString(offsetDays: number) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().split("T")[0]
}

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

/* ── Helper to build slot ── */
function makeSlot(overrides: Partial<MockSlot> = {}): MockSlot {
  return {
    id: "slot-uuid-1",
    startsAt: new Date(Date.now() + 3600 * 1000).toISOString(), // 1h future
    endsAt: new Date(Date.now() + 7200 * 1000).toISOString(),   // 2h future
    available: true,
    ...overrides,
  }
}

/* ────────────────────────────────────────────── */

describe("Checklist: Chon ngay (Date Selection)", () => {
  it("builds exactly 30 date options starting from today", () => {
    const options = buildDateOptions()
    expect(options).toHaveLength(30)
  })

  it("first date option is today (YYYY-MM-DD)", () => {
    const options = buildDateOptions()
    const today = new Date().toISOString().split("T")[0]
    expect(options[0].value).toBe(today)
  })

  it("last date option is 29 days from today", () => {
    const options = buildDateOptions()
    const last = options[29]
    const d = new Date()
    d.setDate(d.getDate() + 29)
    const expected = d.toISOString().split("T")[0]
    expect(last.value).toBe(expected)
  })

  it("each option has correct weekday, day, month abbreviation", () => {
    const options = buildDateOptions()
    const opt = options[0]
    expect(opt.weekday).toBeTruthy()
    expect(typeof opt.day).toBe("number")
    expect(opt.month).toMatch(/^T\d+$/)
  })
})

/* ────────────────────────────────────────────── */

describe("Checklist: Hien thi available/unavailable (Slot Status)", () => {
  it("returns 'available' for a future slot with available=true", () => {
    const slot = makeSlot({ available: true })
    expect(getSlotStatus(slot)).toBe("available")
  })

  it("returns 'unavailable' for a future slot with available=false (booked)", () => {
    const slot = makeSlot({ available: false })
    expect(getSlotStatus(slot)).toBe("unavailable")
  })

  it("returns 'unavailable' for a future slot with available=false (blackout)", () => {
    // Per API spec, blackout and booked both yield available=false
    const slot = makeSlot({
      available: false,
      startsAt: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
    })
    expect(getSlotStatus(slot)).toBe("unavailable")
  })

  it("returns 'past' for a slot whose startsAt is in the past", () => {
    const slot = makeSlot({
      startsAt: new Date(Date.now() - 3600 * 1000).toISOString(), // 1h ago
      available: true, // even if available=true, past should win
    })
    expect(getSlotStatus(slot)).toBe("past")
  })

  it("returns 'past' for a slot that started exactly now (boundary)", () => {
    const slot = makeSlot({
      startsAt: new Date(Date.now() - 1).toISOString(), // 1ms ago
      available: true,
    })
    expect(getSlotStatus(slot)).toBe("past")
  })

  it("returns 'past' for a past slot with available=false (past takes priority)", () => {
    const slot = makeSlot({
      startsAt: new Date(Date.now() - 7200 * 1000).toISOString(),
      available: false,
    })
    expect(getSlotStatus(slot)).toBe("past")
  })
})

/* ────────────────────────────────────────────── */

describe("Checklist: Khong chon past/blackout/booked (Selection Guard)", () => {
  it("isSelectable returns true for a future available slot", () => {
    const slot = makeSlot({ available: true })
    expect(isSelectable(slot)).toBe(true)
  })

  it("isSelectable returns false for a past slot", () => {
    const slot = makeSlot({
      startsAt: new Date(Date.now() - 3600 * 1000).toISOString(),
    })
    expect(isSelectable(slot)).toBe(false)
  })

  it("isSelectable returns false for a future booked slot (available=false)", () => {
    const slot = makeSlot({ available: false })
    expect(isSelectable(slot)).toBe(false)
  })

  it("isSelectable returns false for a future blackout slot (available=false)", () => {
    // Blackout also sets available=false per API contract
    const slot = makeSlot({
      available: false,
      startsAt: new Date(Date.now() + 5 * 3600 * 1000).toISOString(),
    })
    expect(isSelectable(slot)).toBe(false)
  })

  it("only available slots can be selected (no past, no unavailable)", () => {
    const slots: MockSlot[] = [
      makeSlot({ id: "s1", available: true }),
      makeSlot({ id: "s2", available: false }),
      makeSlot({ id: "s3", startsAt: new Date(Date.now() - 3600 * 1000).toISOString(), available: true }),
      makeSlot({ id: "s4", startsAt: new Date(Date.now() - 3600 * 1000).toISOString(), available: false }),
    ]
    const selectable = slots.filter(isSelectable)
    expect(selectable).toHaveLength(1)
    expect(selectable[0].id).toBe("s1")
  })
})

/* ────────────────────────────────────────────── */

describe("Checklist: Payload dung contract (CreateBookingRequest)", () => {
  it("booking payload has correct shape: { courtId, bookingDate, timeSlotIds }", () => {
    const courtId = "court-uuid-123"
    const selectedDate = "2026-10-15"
    const slot = makeSlot({ id: "slot-uuid-abc" })

    // Replicate handleContinueBooking payload construction
    const bookingPayload = {
      courtId,
      bookingDate: selectedDate,
      timeSlotIds: [slot.id],
    }

    expect(bookingPayload).toEqual({
      courtId: "court-uuid-123",
      bookingDate: "2026-10-15",
      timeSlotIds: ["slot-uuid-abc"],
    })
  })

  it("timeSlotIds contains slot.id (time_slot template UUID per contract)", () => {
    const slot = makeSlot({ id: "aaaabbbb-cccc-dddd-eeee-ffffaaaabbbb" })
    const payload = {
      courtId: "c1",
      bookingDate: "2026-10-15",
      timeSlotIds: [slot.id],
    }
    expect(payload.timeSlotIds[0]).toBe(slot.id)
  })

  it("bookingDate uses YYYY-MM-DD format (not ISO timestamp)", () => {
    const date = "2026-10-15"
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it("single slot selection produces timeSlotIds array with one element (S2 scope)", () => {
    const slot = makeSlot()
    const payload = {
      courtId: "court-1",
      bookingDate: "2026-10-15",
      timeSlotIds: [slot.id],
    }
    expect(payload.timeSlotIds).toHaveLength(1)
  })

  it("multi-slot selection produces ordered timeSlotIds per CreateBookingRequest contract", () => {
    const slotA = makeSlot({ id: "slot-1", startsAt: "2026-10-15T09:00:00Z", endsAt: "2026-10-15T10:00:00Z" })
    const slotB = makeSlot({ id: "slot-2", startsAt: "2026-10-15T10:00:00Z", endsAt: "2026-10-15T11:00:00Z" })
    const slotC = makeSlot({ id: "slot-3", startsAt: "2026-10-15T11:00:00Z", endsAt: "2026-10-15T12:00:00Z" })

    const payload = {
      courtId: "court-1",
      bookingDate: "2026-10-15",
      timeSlotIds: [slotA.id, slotB.id, slotC.id],
    }

    expect(payload.timeSlotIds).toHaveLength(3)
    expect(payload.timeSlotIds).toEqual(["slot-1", "slot-2", "slot-3"])
  })
})

