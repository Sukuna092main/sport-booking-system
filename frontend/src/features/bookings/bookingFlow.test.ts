import { describe, expect, it, vi, beforeEach } from "vitest"
import {
  buildBookingPayload,
  formatReferencePrice,
  validateBookingReview,
  validateSlotSelection,
} from "./consecutiveSlots"
import { bookingsApi, generateIdempotencyKey } from "@/lib/api/bookings"
import {
  getMockBookings,
  saveMockBooking,
  updateMockBookingStatus,
} from "./useBookings"
import { apiClient } from "@/lib/api/client"
import type { BookingItem, CreateBookingPayload } from "./types"

function makeSlot(
  id: string,
  startHour: number,
  endHour: number,
  date = "2026-10-25"
) {
  const pad = (n: number) => String(n).padStart(2, "0")
  return {
    id,
    startsAt: `${date}T${pad(startHour)}:00:00.000Z`,
    endsAt: `${date}T${pad(endHour)}:00:00.000Z`,
    formattedRange: `${pad(startHour)}:00 - ${pad(endHour)}:00`,
    available: true,
  }
}

/* ── In-memory mock for sessionStorage in Node/Vitest environment ── */
const storageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(globalThis, "sessionStorage", {
  value: storageMock,
  writable: true,
})

describe("WBS 1.3.3.3–1.3.3.5: Booking Confirmation & Create Booking Flow Tests", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    sessionStorage.clear()
  })

  /* ------------------------------------------------------------------ */
  /* 1. Nhận dữ liệu Court/Date/Selected Slots & Xây dựng Payload        */
  /* ------------------------------------------------------------------ */
  describe("Checklist 1 & 2: Handoff data & Payload Construction", () => {
    it("builds valid CreateBookingPayload with chronological timeSlotIds per OpenAPI", () => {
      const slot2 = makeSlot("slot-2", 10, 11)
      const slot1 = makeSlot("slot-1", 9, 10)
      const slot3 = makeSlot("slot-3", 11, 12)

      // Unordered input
      const unorderedSlots = [slot2, slot3, slot1]
      const payload = buildBookingPayload("court-uuid-1", "2026-10-25", unorderedSlots)

      expect(payload).not.toBeNull()
      expect(payload?.courtId).toBe("court-uuid-1")
      expect(payload?.bookingDate).toBe("2026-10-25")
      // Must be sorted chronologically
      expect(payload?.timeSlotIds).toEqual(["slot-1", "slot-2", "slot-3"])
    })

    it("returns null if courtId or slots are missing", () => {
      expect(buildBookingPayload("", "2026-10-25", [makeSlot("s1", 9, 10)])).toBeNull()
      expect(buildBookingPayload("court-1", "", [makeSlot("s1", 9, 10)])).toBeNull()
      expect(buildBookingPayload("court-1", "2026-10-25", [])).toBeNull()
    })
  })

  /* ------------------------------------------------------------------ */
  /* 3. Hiển thị giá tham chiếu và tổng số slot                         */
  /* ------------------------------------------------------------------ */
  describe("Checklist 3: Giá tham chiếu và tổng số slot", () => {
    it("formats reference price correctly for configured amount and slot count", () => {
      const singleSlot = formatReferencePrice("150000", "VND", 1)
      expect(singleSlot.isConfigured).toBe(true)
      expect(singleSlot.unitText).toBe("150.000 VND / slot")
      expect(singleSlot.totalText).toBe("150.000 VND")

      const multiSlots = formatReferencePrice("150000", "VND", 3)
      expect(multiSlots.totalText).toBe("450.000 VND")
    })

    it("handles null, empty or zero reference price gracefully per MVP rules", () => {
      const nullPrice = formatReferencePrice(null, "VND", 2)
      expect(nullPrice.isConfigured).toBe(false)
      expect(nullPrice.unitText).toBe("Chưa cấu hình")
      expect(nullPrice.totalText).toBe("Miễn phí tham chiếu (MVP)")

      const emptyPrice = formatReferencePrice("", undefined, 1)
      expect(emptyPrice.isConfigured).toBe(false)
      expect(emptyPrice.totalText).toBe("Miễn phí tham chiếu (MVP)")

      const zeroPrice = formatReferencePrice("0", "VND", 2)
      expect(zeroPrice.isConfigured).toBe(false)
      expect(zeroPrice.totalText).toBe("Miễn phí tham chiếu (MVP)")
    })

    it("supports custom currencies", () => {
      const usdPrice = formatReferencePrice("25", "USD", 2)
      expect(usdPrice.unitText).toBe("25 USD / slot")
      expect(usdPrice.totalText).toBe("50 USD")
    })
  })

  /* ------------------------------------------------------------------ */
  /* 4. Validate slot selection trước khi gửi request                    */
  /* ------------------------------------------------------------------ */
  describe("Checklist 4: Validate slot selection trước khi gửi request", () => {
    const fixedNow = new Date("2026-10-21T08:00:00.000Z")

    it("accepts valid contiguous slots within horizon and bounds", () => {
      const slot1 = makeSlot("s1", 9, 10, "2026-10-25")
      const slot2 = makeSlot("s2", 10, 11, "2026-10-25")
      const validation = validateBookingReview(
        "2026-10-25",
        [slot1, slot2],
        { minConsecutiveSlots: 1, maxConsecutiveSlots: 4 },
        fixedNow
      )
      expect(validation.isValid).toBe(true)
      expect(validation.error).toBeNull()

      // Also verify pure validateSlotSelection
      expect(validateSlotSelection([slot1, slot2]).isValid).toBe(true)
      expect(validateSlotSelection([]).isValid).toBe(false)
    })

    it("rejects non-consecutive slots with time gap (CON-03)", () => {
      const slot1 = makeSlot("s1", 9, 10, "2026-10-25")
      const slot3 = makeSlot("s3", 11, 12, "2026-10-25") // Gap: 10:00 - 11:00 missing
      const validation = validateBookingReview(
        "2026-10-25",
        [slot1, slot3],
        { minConsecutiveSlots: 1, maxConsecutiveSlots: 4 },
        fixedNow
      )
      expect(validation.isValid).toBe(false)
      expect(validation.error).toContain("liên tiếp")
    })

    it("rejects booking date exceeding 30-day horizon (C-01 / BR-05)", () => {
      const slot1 = makeSlot("s1", 9, 10, "2026-12-01") // > 30 days after Oct 21
      const validation = validateBookingReview(
        "2026-12-01",
        [slot1],
        { minConsecutiveSlots: 1, maxConsecutiveSlots: 4 },
        fixedNow
      )
      expect(validation.isValid).toBe(false)
      expect(validation.error).toContain("30 ngày")
    })

    it("rejects past date (before today)", () => {
      const slot1 = makeSlot("s1", 9, 10, "2026-10-10")
      const validation = validateBookingReview(
        "2026-10-10",
        [slot1],
        { minConsecutiveSlots: 1, maxConsecutiveSlots: 4 },
        fixedNow
      )
      expect(validation.isValid).toBe(false)
      expect(validation.error).toContain("quá khứ")
    })

    it("rejects slot starting before current time on same day (ERR-07 / BR-04)", () => {
      const pastSlot = makeSlot("s1", 7, 8, "2026-10-21") // 07:00 is past relative to 08:00
      const validation = validateBookingReview(
        "2026-10-21",
        [pastSlot],
        { minConsecutiveSlots: 1, maxConsecutiveSlots: 4 },
        fixedNow
      )
      expect(validation.isValid).toBe(false)
      expect(validation.error).toContain("đã qua")
    })

    it("rejects exceeding court maxConsecutiveSlots (C-04 / CON-05)", () => {
      const s1 = makeSlot("s1", 9, 10, "2026-10-25")
      const s2 = makeSlot("s2", 10, 11, "2026-10-25")
      const s3 = makeSlot("s3", 11, 12, "2026-10-25")
      const validation = validateBookingReview(
        "2026-10-25",
        [s1, s2, s3],
        { minConsecutiveSlots: 1, maxConsecutiveSlots: 2 },
        fixedNow
      )
      expect(validation.isValid).toBe(false)
      expect(validation.error).toContain("tối đa là 2 slot")
    })
  })

  /* ------------------------------------------------------------------ */
  /* 5. Idempotency Key & Create Booking API Call                       */
  /* ------------------------------------------------------------------ */
  describe("Checklist 5 & 6: Idempotency Key & Create Booking API", () => {
    it("generates opaque unique 1-128 chars Idempotency-Key", () => {
      const key1 = generateIdempotencyKey()
      const key2 = generateIdempotencyKey()
      expect(key1).toBeDefined()
      expect(key1.length).toBeGreaterThan(0)
      expect(key1.length).toBeLessThanOrEqual(128)
      expect(key1).not.toBe(key2)
    })

    it("calls POST /bookings with Idempotency-Key header and payload", async () => {
      const payload: CreateBookingPayload = {
        courtId: "c1111111-2222-3333-4444-555555555555",
        bookingDate: "2026-10-25",
        timeSlotIds: ["s1", "s2"],
      }
      const mockKey = "test-idempotency-key-123"

      const mockResponse = {
        data: {
          data: {
            id: "bk-uuid-123",
            bookingCode: "BK-20261025-ABCD",
            customerId: "user-123",
            courtId: payload.courtId,
            bookingDate: payload.bookingDate,
            status: "CONFIRMED",
            slots: [
              { timeSlotId: "s1", startsAt: "2026-10-25T09:00:00Z", endsAt: "2026-10-25T10:00:00Z" },
              { timeSlotId: "s2", startsAt: "2026-10-25T10:00:00Z", endsAt: "2026-10-25T11:00:00Z" },
            ],
            createdAt: "2026-10-21T08:00:00Z",
            cancelledAt: null,
          },
        },
      }

      const postSpy = vi.spyOn(apiClient, "post").mockResolvedValueOnce(mockResponse)

      const result = await bookingsApi.createBooking(payload, mockKey)

      expect(postSpy).toHaveBeenCalledWith("/bookings", payload, {
        headers: {
          "Idempotency-Key": mockKey,
        },
      })
      expect(result.data.bookingCode).toBe("BK-20261025-ABCD")
      expect(result.data.status).toBe("CONFIRMED")
    })
  })

  /* ------------------------------------------------------------------ */
  /* 7. Xử lý booking conflict bằng thông báo rõ ràng (409)              */
  /* ------------------------------------------------------------------ */
  describe("Checklist 7: Conflict Handling (409 Conflict / slot_unavailable)", () => {
    it("propagates 409 slot_unavailable error envelope when slot is occupied", async () => {
      const payload: CreateBookingPayload = {
        courtId: "c1",
        bookingDate: "2026-10-25",
        timeSlotIds: ["s1"],
      }

      const conflictError = {
        response: {
          status: 409,
          data: {
            error: {
              code: "slot_unavailable",
              message: "Khung giờ đã được đặt. Vui lòng chọn giờ khác.",
              requestId: "req-conflict-uuid",
              details: [
                {
                  field: "timeSlotIds",
                  message: "Khung giờ không còn khả dụng.",
                },
              ],
            },
          },
        },
      }

      vi.spyOn(apiClient, "post").mockRejectedValueOnce(conflictError)

      await expect(bookingsApi.createBooking(payload, "key-1")).rejects.toEqual(conflictError)
    })
  })

  /* ------------------------------------------------------------------ */
  /* 8 & 9. Local Resilience, Success State & Detail Navigation Store    */
  /* ------------------------------------------------------------------ */
  describe("Checklist 8 & 9: Mock Booking Store for Offline/Simulation resilience", () => {
    it("saves and retrieves bookings in sessionStorage", () => {
      expect(getMockBookings()).toHaveLength(0)

      const booking: BookingItem = {
        id: "test-bk-1",
        bookingCode: "BK-20261025-XYZ1",
        customerId: "user-1",
        courtId: "court-1",
        bookingDate: "2026-10-25",
        status: "CONFIRMED",
        slots: [{ timeSlotId: "s1", startsAt: "2026-10-25T09:00:00Z", endsAt: "2026-10-25T10:00:00Z" }],
        createdAt: new Date().toISOString(),
        cancelledAt: null,
      }

      saveMockBooking(booking)
      const list = getMockBookings()
      expect(list).toHaveLength(1)
      expect(list[0].bookingCode).toBe("BK-20261025-XYZ1")
      expect(list[0].status).toBe("CONFIRMED")
    })

    it("updates booking status on cancellation (CONFIRMED -> CANCELLED)", () => {
      const booking: BookingItem = {
        id: "test-bk-2",
        bookingCode: "BK-20261025-XYZ2",
        customerId: "user-1",
        courtId: "court-1",
        bookingDate: "2026-10-25",
        status: "CONFIRMED",
        slots: [{ timeSlotId: "s1", startsAt: "2026-10-25T09:00:00Z", endsAt: "2026-10-25T10:00:00Z" }],
        createdAt: new Date().toISOString(),
        cancelledAt: null,
      }

      saveMockBooking(booking)
      const updated = updateMockBookingStatus("test-bk-2", "CANCELLED")
      expect(updated).not.toBeNull()
      expect(updated?.status).toBe("CANCELLED")
      expect(updated?.cancelledAt).toBeDefined()

      const list = getMockBookings()
      expect(list[0].status).toBe("CANCELLED")
    })
  })

  /* ------------------------------------------------------------------ */
  /* Additional API Service Endpoints (Detail, Cancel, List)            */
  /* ------------------------------------------------------------------ */
  describe("Booking Details & Cancel API calls", () => {
    it("calls GET /bookings/{id} for booking detail", async () => {
      const mockDetail = {
        data: {
          data: {
            id: "b123",
            bookingCode: "BK-001",
            customerId: "u1",
            courtId: "c1",
            bookingDate: "2026-10-25",
            status: "CONFIRMED",
            slots: [],
            createdAt: "2026-10-21T00:00:00Z",
            cancelledAt: null,
          },
        },
      }
      const getSpy = vi.spyOn(apiClient, "get").mockResolvedValueOnce(mockDetail)

      const result = await bookingsApi.getMyBooking("b123")
      expect(getSpy).toHaveBeenCalledWith("/bookings/b123")
      expect(result.data.bookingCode).toBe("BK-001")
    })

    it("calls POST /bookings/{id}/cancel for booking cancellation", async () => {
      const mockCancelled = {
        data: {
          data: {
            id: "b123",
            bookingCode: "BK-001",
            customerId: "u1",
            courtId: "c1",
            bookingDate: "2026-10-25",
            status: "CANCELLED",
            slots: [],
            createdAt: "2026-10-21T00:00:00Z",
            cancelledAt: "2026-10-21T08:00:00Z",
          },
        },
      }
      const postSpy = vi.spyOn(apiClient, "post").mockResolvedValueOnce(mockCancelled)

      const result = await bookingsApi.cancelMyBooking("b123")
      expect(postSpy).toHaveBeenCalledWith("/bookings/b123/cancel")
      expect(result.data.status).toBe("CANCELLED")
    })
  })
})
