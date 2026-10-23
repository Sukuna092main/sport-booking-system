import { describe, expect, it } from "vitest"
import type { AvailabilitySlot } from "@/types/court.types"
import {
  buildBookingPayload,
  canRemoveSlot,
  fmtTime,
  formatTimeRange,
  formatTotalDuration,
  getSlotStatus,
  isSlotConsecutive,
  toggleSlotSelection,
  validateSlotSelection,
} from "./consecutiveSlots"

function makeSlot(
  id: string,
  startHour: number,
  endHour: number,
  available = true,
  status?: AvailabilitySlot["status"]
): AvailabilitySlot {
  const pad = (n: number) => String(n).padStart(2, "0")
  return {
    id,
    startsAt: `2026-10-14T${pad(startHour)}:00:00.000Z`,
    endsAt: `2026-10-14T${pad(endHour)}:00:00.000Z`,
    available,
    status,
  }
}

describe("Checklist: Multi-slot liên tiếp (Consecutive Multi-Slot Selection)", () => {
  const slot1 = makeSlot("s1", 9, 10)
  const slot2 = makeSlot("s2", 10, 11)
  const slot3 = makeSlot("s3", 11, 12)

  it("selects first slot when none selected", () => {
    const result = toggleSlotSelection([], slot1)
    expect(result.newSlots).toHaveLength(1)
    expect(result.newSlots[0].id).toBe("s1")
    expect(result.warningMessage).toBeNull()
  })

  it("adds adjacent slot after existing selection (chaining)", () => {
    const step1 = toggleSlotSelection([], slot1)
    const step2 = toggleSlotSelection(step1.newSlots, slot2)
    expect(step2.newSlots).toHaveLength(2)
    expect(step2.newSlots.map((s) => s.id)).toEqual(["s1", "s2"])
    expect(step2.warningMessage).toBeNull()

    const step3 = toggleSlotSelection(step2.newSlots, slot3)
    expect(step3.newSlots).toHaveLength(3)
    expect(step3.newSlots.map((s) => s.id)).toEqual(["s1", "s2", "s3"])
    expect(step3.warningMessage).toBeNull()
  })

  it("adds adjacent slot before existing selection and maintains chronological order", () => {
    const step1 = toggleSlotSelection([], slot2)
    const step2 = toggleSlotSelection(step1.newSlots, slot1) // slot1 ends when slot2 starts
    expect(step2.newSlots).toHaveLength(2)
    expect(step2.newSlots[0].id).toBe("s1")
    expect(step2.newSlots[1].id).toBe("s2")
    expect(step2.warningMessage).toBeNull()
  })

  it("allows unselecting from the start of the consecutive range", () => {
    const current = [slot1, slot2, slot3]
    const result = toggleSlotSelection(current, slot1)
    expect(result.newSlots.map((s) => s.id)).toEqual(["s2", "s3"])
    expect(result.warningMessage).toBeNull()
  })

  it("allows unselecting from the end of the consecutive range", () => {
    const current = [slot1, slot2, slot3]
    const result = toggleSlotSelection(current, slot3)
    expect(result.newSlots.map((s) => s.id)).toEqual(["s1", "s2"])
    expect(result.warningMessage).toBeNull()
  })

  it("formats multi-slot time range correctly", () => {
    expect(formatTimeRange([])).toBe("No time selected")
    expect(formatTimeRange([slot1])).toBe(
      `${fmtTime(slot1.startsAt)} – ${fmtTime(slot1.endsAt)}`
    )
    expect(formatTimeRange([slot1, slot2, slot3])).toBe(
      `${fmtTime(slot1.startsAt)} – ${fmtTime(slot3.endsAt)}`
    )
  })

  it("formats total duration based on slot count and slot duration", () => {
    expect(formatTotalDuration([], 60)).toBe("-")
    expect(formatTotalDuration([slot1], 60)).toBe("1 hour")
    expect(formatTotalDuration([slot1, slot2, slot3], 60)).toBe("3 hours")
    expect(formatTotalDuration([slot1, slot2], 45)).toBe("90 mins")
  })
})

describe("Checklist: Min/max constraints", () => {
  const slot1 = makeSlot("s1", 9, 10)
  const slot2 = makeSlot("s2", 10, 11)
  const slot3 = makeSlot("s3", 11, 12)
  const slot4 = makeSlot("s4", 12, 13)
  const slot5 = makeSlot("s5", 13, 14)

  it("enforces default max consecutive slots (4)", () => {
    const current = [slot1, slot2, slot3, slot4]
    const result = toggleSlotSelection(current, slot5, { maxConsecutiveSlots: 4 })
    expect(result.newSlots).toHaveLength(4)
    expect(result.warningMessage).toBe("Maximum 4 consecutive slots allowed per booking.")
  })

  it("enforces custom court max consecutive slots (e.g. 2)", () => {
    const current = [slot1, slot2]
    const result = toggleSlotSelection(current, slot3, { maxConsecutiveSlots: 2 })
    expect(result.newSlots).toHaveLength(2)
    expect(result.warningMessage).toBe("Maximum 2 consecutive slots allowed per booking.")
  })

  it("validates minConsecutiveSlots constraint correctly", () => {
    // Single slot when min is 2
    const single = validateSlotSelection([slot1], { minConsecutiveSlots: 2 })
    expect(single.isValid).toBe(false)
    expect(single.error).toContain("2 slot liên tiếp")

    // Two slots when min is 2
    const valid = validateSlotSelection([slot1, slot2], { minConsecutiveSlots: 2 })
    expect(valid.isValid).toBe(true)
    expect(valid.error).toBeNull()
  })

  it("validates empty selection", () => {
    const res = validateSlotSelection([])
    expect(res.isValid).toBe(false)
  })
})

describe("Checklist: Invalid-selection UI & warnings", () => {
  const slot1 = makeSlot("s1", 9, 10)
  const slot2 = makeSlot("s2", 10, 11)
  const slot3 = makeSlot("s3", 11, 12)
  const slotFar = makeSlot("sFar", 14, 15)

  it("prevents selecting non-adjacent slot and returns exact warning message", () => {
    const current = [slot1]
    const result = toggleSlotSelection(current, slotFar)
    expect(result.newSlots).toHaveLength(1)
    expect(result.newSlots[0].id).toBe("s1")
    expect(result.warningMessage).toBe(
      "Choose a time next to your current selection to create one consecutive booking."
    )
  })

  it("prevents removing middle slot and returns exact warning message", () => {
    const current = [slot1, slot2, slot3]
    const result = toggleSlotSelection(current, slot2) // slot2 is middle
    expect(result.newSlots).toHaveLength(3)
    expect(result.newSlots.map((s) => s.id)).toEqual(["s1", "s2", "s3"])
    expect(result.warningMessage).toBe(
      "Remove a slot from either end to keep your booking consecutive."
    )
  })

  it("canRemoveSlot helper identifies middle vs edge slots", () => {
    const current = [slot1, slot2, slot3]
    expect(canRemoveSlot(current, slot1).canRemove).toBe(true)
    expect(canRemoveSlot(current, slot3).canRemove).toBe(true)
    expect(canRemoveSlot(current, slot2).canRemove).toBe(false)
    expect(canRemoveSlot(current, slot2).warningMessage).toBe(
      "Remove a slot from either end to keep your booking consecutive."
    )
  })

  it("isSlotConsecutive correctly identifies before, after, and none", () => {
    expect(isSlotConsecutive([slot2], slot1)).toEqual({ isConsecutive: true, position: "before" })
    expect(isSlotConsecutive([slot2], slot3)).toEqual({ isConsecutive: true, position: "after" })
    expect(isSlotConsecutive([slot2], slotFar)).toEqual({ isConsecutive: false, position: "none" })
  })

  it("slot status classification supports available, past, unavailable, booked, blackout", () => {
    const futureTime = new Date(Date.now() + 3600 * 1000).toISOString()
    const futureEnd = new Date(Date.now() + 7200 * 1000).toISOString()
    const pastTime = new Date(Date.now() - 3600 * 1000).toISOString()

    expect(getSlotStatus({ id: "1", startsAt: futureTime, endsAt: futureEnd, available: true })).toBe("available")
    expect(getSlotStatus({ id: "2", startsAt: pastTime, endsAt: futureTime, available: true })).toBe("past")
    expect(getSlotStatus({ id: "3", startsAt: futureTime, endsAt: futureEnd, available: false })).toBe("unavailable")
    expect(getSlotStatus({ id: "4", startsAt: futureTime, endsAt: futureEnd, available: false, status: "booked" })).toBe("booked")
    expect(getSlotStatus({ id: "5", startsAt: futureTime, endsAt: futureEnd, available: false, status: "blackout" })).toBe("blackout")
  })
})

describe("Checklist: Payload sang booking flow (CreateBookingRequest Contract)", () => {
  const slot1 = makeSlot("slot-uuid-1", 9, 10)
  const slot2 = makeSlot("slot-uuid-2", 10, 11)
  const slot3 = makeSlot("slot-uuid-3", 11, 12)

  it("produces valid OpenAPI CreateBookingRequest payload with ordered timeSlotIds", () => {
    const courtId = "11111111-2222-3333-4444-555555555555"
    const bookingDate = "2026-10-14"

    const payload = buildBookingPayload(courtId, bookingDate, [slot1, slot2, slot3])

    expect(payload).toEqual({
      courtId: "11111111-2222-3333-4444-555555555555",
      bookingDate: "2026-10-14",
      timeSlotIds: ["slot-uuid-1", "slot-uuid-2", "slot-uuid-3"],
    })
  })

  it("returns null payload if no slots selected", () => {
    expect(buildBookingPayload("court-id", "2026-10-14", [])).toBeNull()
  })

  it("preserves chronological order of timeSlotIds even if array was shuffled", () => {
    const payload = buildBookingPayload("c1", "2026-10-14", [slot3, slot1, slot2])
    expect(payload?.timeSlotIds).toEqual(["slot-uuid-1", "slot-uuid-2", "slot-uuid-3"])
  })
})
