import { describe, expect, it, vi, beforeEach } from "vitest"
import {
  checkBookingCancellationEligibility,
  formatBookingDateDisplay,
  parseCancelError,
} from "./cancellation"
import { bookingsApi } from "@/lib/api/bookings"
import { apiClient } from "@/lib/api/client"
import type { BookingItem, BookingSlotItem } from "./types"

function makeSlot(id: string, startHour: number, endHour: number, date = "2026-10-25"): BookingSlotItem {
  const pad = (n: number) => String(n).padStart(2, "0")
  return {
    timeSlotId: id,
    startsAt: `${date}T${pad(startHour)}:00:00.000Z`,
    endsAt: `${date}T${pad(endHour)}:00:00.000Z`,
  }
}

describe("WBS: My Booking & Cancel Flow Contract & Business Rule Tests", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  /* ------------------------------------------------------------------ */
  /* 1. Business Rule BR-14: Cancellation Eligibility Tests             */
  /* ------------------------------------------------------------------ */
  describe("Checklist 5: Business Rule Cancellation Eligibility (BR-14)", () => {
    const fixedNow = new Date("2026-10-25T08:00:00.000Z").getTime()

    it("allows cancellation when booking is CONFIRMED and first slot starts in future", () => {
      // First slot starts at 09:00:00Z (> 08:00:00Z)
      const slot1 = makeSlot("s1", 9, 10, "2026-10-25")
      const slot2 = makeSlot("s2", 10, 11, "2026-10-25")

      const booking: BookingItem = {
        id: "bk-1",
        bookingCode: "BK-20261025-001",
        customerId: "user-123",
        courtId: "court-1",
        bookingDate: "2026-10-25",
        status: "CONFIRMED",
        slots: [slot1, slot2],
        createdAt: "2026-10-20T10:00:00.000Z",
        cancelledAt: null,
      }

      const result = checkBookingCancellationEligibility(booking, "user-123", fixedNow)
      expect(result.canCancel).toBe(true)
      expect(result.code).toBe("OK")
    })

    it("rejects cancellation if first slot has already started (startsAt <= now)", () => {
      // First slot started at 07:00:00Z (< 08:00:00Z)
      const slot1 = makeSlot("s1", 7, 8, "2026-10-25")
      const slot2 = makeSlot("s2", 8, 9, "2026-10-25")

      const booking: BookingItem = {
        id: "bk-2",
        bookingCode: "BK-20261025-002",
        customerId: "user-123",
        courtId: "court-1",
        bookingDate: "2026-10-25",
        status: "CONFIRMED",
        slots: [slot1, slot2],
        createdAt: "2026-10-20T10:00:00.000Z",
        cancelledAt: null,
      }

      const result = checkBookingCancellationEligibility(booking, "user-123", fixedNow)
      expect(result.canCancel).toBe(false)
      expect(result.code).toBe("PAST_START_TIME")
      expect(result.message).toContain("SRS BR-14")
    })

    it("rejects cancellation exactly at slot start time (startsAt === now)", () => {
      // First slot starts at exactly 08:00:00Z
      const slot1 = makeSlot("s1", 8, 9, "2026-10-25")

      const booking: BookingItem = {
        id: "bk-3",
        bookingCode: "BK-20261025-003",
        customerId: "user-123",
        courtId: "court-1",
        bookingDate: "2026-10-25",
        status: "CONFIRMED",
        slots: [slot1],
        createdAt: "2026-10-20T10:00:00.000Z",
        cancelledAt: null,
      }

      const result = checkBookingCancellationEligibility(booking, "user-123", fixedNow)
      expect(result.canCancel).toBe(false)
      expect(result.code).toBe("PAST_START_TIME")
    })

    it("sorts slots chronologically to check earliest slot start time", () => {
      // Slots passed out of order: slot2 (10-11) before slot1 (09-10)
      const slot2 = makeSlot("s2", 10, 11, "2026-10-25")
      const slot1 = makeSlot("s1", 9, 10, "2026-10-25")

      const booking: BookingItem = {
        id: "bk-4",
        bookingCode: "BK-20261025-004",
        customerId: "user-123",
        courtId: "court-1",
        bookingDate: "2026-10-25",
        status: "CONFIRMED",
        slots: [slot2, slot1], // out of order
        createdAt: "2026-10-20T10:00:00.000Z",
        cancelledAt: null,
      }

      // Now = 08:30 (before 09:00) -> canCancel = true
      expect(
        checkBookingCancellationEligibility(
          booking,
          "user-123",
          new Date("2026-10-25T08:30:00.000Z").getTime()
        ).canCancel
      ).toBe(true)

      // Now = 09:15 (after 09:00 start) -> canCancel = false
      expect(
        checkBookingCancellationEligibility(
          booking,
          "user-123",
          new Date("2026-10-25T09:15:00.000Z").getTime()
        ).canCancel
      ).toBe(false)
    })

    it("rejects cancellation if status is already CANCELLED", () => {
      const slot1 = makeSlot("s1", 14, 15, "2026-10-25")

      const booking: BookingItem = {
        id: "bk-5",
        bookingCode: "BK-20261025-005",
        customerId: "user-123",
        courtId: "court-1",
        bookingDate: "2026-10-25",
        status: "CANCELLED",
        slots: [slot1],
        createdAt: "2026-10-20T10:00:00.000Z",
        cancelledAt: "2026-10-21T10:00:00.000Z",
      }

      const result = checkBookingCancellationEligibility(booking, "user-123", fixedNow)
      expect(result.canCancel).toBe(false)
      expect(result.code).toBe("ALREADY_CANCELLED")
    })

    it("rejects cancellation if booking has empty slots array", () => {
      const booking: BookingItem = {
        id: "bk-6",
        bookingCode: "BK-20261025-006",
        customerId: "user-123",
        courtId: "court-1",
        bookingDate: "2026-10-25",
        status: "CONFIRMED",
        slots: [],
        createdAt: "2026-10-20T10:00:00.000Z",
        cancelledAt: null,
      }

      const result = checkBookingCancellationEligibility(booking, "user-123", fixedNow)
      expect(result.canCancel).toBe(false)
      expect(result.code).toBe("NO_SLOTS")
    })
  })

  /* ------------------------------------------------------------------ */
  /* 2. Checklist 9: Ownership isolation and verification               */
  /* ------------------------------------------------------------------ */
  describe("Checklist 9: Ownership Enforcement", () => {
    it("rejects user from cancelling a booking owned by someone else", () => {
      const slot1 = makeSlot("s1", 14, 15, "2026-10-25")
      const booking: BookingItem = {
        id: "bk-other",
        bookingCode: "BK-20261025-OTHER",
        customerId: "user-alice-456", // Owned by Alice
        courtId: "court-1",
        bookingDate: "2026-10-25",
        status: "CONFIRMED",
        slots: [slot1],
        createdAt: "2026-10-20T10:00:00.000Z",
        cancelledAt: null,
      }

      // Bob tries to cancel Alice's booking
      const result = checkBookingCancellationEligibility(
        booking,
        "user-bob-789", // Bob's ID
        new Date("2026-10-25T08:00:00.000Z").getTime()
      )

      expect(result.canCancel).toBe(false)
      expect(result.code).toBe("NOT_OWNER")
      expect(result.message).toContain("không thuộc sở hữu")
    })

    it("allows cancellation when user is the verified owner", () => {
      const slot1 = makeSlot("s1", 14, 15, "2026-10-25")
      const booking: BookingItem = {
        id: "bk-own",
        bookingCode: "BK-20261025-OWN",
        customerId: "user-alice-456",
        courtId: "court-1",
        bookingDate: "2026-10-25",
        status: "CONFIRMED",
        slots: [slot1],
        createdAt: "2026-10-20T10:00:00.000Z",
        cancelledAt: null,
      }

      const result = checkBookingCancellationEligibility(
        booking,
        "user-alice-456",
        new Date("2026-10-25T08:00:00.000Z").getTime()
      )

      expect(result.canCancel).toBe(true)
      expect(result.code).toBe("OK")
    })
  })

  /* ------------------------------------------------------------------ */
  /* 3. Error Handling and Business Rule Evidence Mapping               */
  /* ------------------------------------------------------------------ */
  describe("Checklist 7 & 8: API Error Parsing & Evidence Mapping", () => {
    it("maps 409 cancellation_closed to SRS BR-14 explanation", () => {
      const error = {
        response: {
          status: 409,
          data: {
            error: {
              code: "cancellation_closed",
              message: "Khung giờ đã bắt đầu. Không thể hủy.",
              requestId: "req-err-01",
            },
          },
        },
      }

      const parsed = parseCancelError(error)
      expect(parsed.code).toBe("cancellation_closed")
      expect(parsed.message).toContain("Khung giờ đã bắt đầu")
    })

    it("maps 409 already_cancelled to proper explanation", () => {
      const error = {
        response: {
          status: 409,
          data: {
            error: {
              code: "already_cancelled",
              message: "Booking đã ở trạng thái CANCELLED.",
              requestId: "req-err-02",
            },
          },
        },
      }

      const parsed = parseCancelError(error)
      expect(parsed.code).toBe("already_cancelled")
      expect(parsed.message).toContain("đã ở trạng thái CANCELLED")
    })

    it("maps 404 not_found (unauthorized or non-existent booking) per contract", () => {
      const error = {
        response: {
          status: 404,
          data: {
            error: {
              code: "not_found",
              message: "Không tìm thấy booking.",
              requestId: "req-err-03",
            },
          },
        },
      }

      const parsed = parseCancelError(error)
      expect(parsed.code).toBe("not_found")
      expect(parsed.message).toBe("Không tìm thấy booking.")

      // Default fallback when message is omitted
      const emptyError = {
        response: {
          status: 404,
        },
      }
      const defaultParsed = parseCancelError(emptyError)
      expect(defaultParsed.code).toBe("not_found")
      expect(defaultParsed.message).toContain("404 Not Found")
    })

    it("maps 401 unauthorized to session expiry message", () => {
      const error = {
        response: {
          status: 401,
          data: {
            error: {
              code: "unauthorized",
              message: "Token expired",
            },
          },
        },
      }

      const parsed = parseCancelError(error)
      expect(parsed.code).toBe("unauthorized")
      expect(parsed.message).toContain("Phiên đăng nhập")
    })

    it("handles unexpected network error gracefully", () => {
      const networkError = new Error("Network timeout")
      const parsed = parseCancelError(networkError)
      expect(parsed.code).toBe("error")
      expect(parsed.message).toBe("Network timeout")
    })
  })

  /* ------------------------------------------------------------------ */
  /* 4. Date formatting helper                                          */
  /* ------------------------------------------------------------------ */
  describe("Date Display Formatting", () => {
    it("formats YYYY-MM-DD date string with Vietnamese locale", () => {
      const formatted = formatBookingDateDisplay("2026-10-25")
      expect(formatted).toBeDefined()
      expect(formatted).toContain("2026")
      expect(formatted).toContain("10")
      expect(formatted).toContain("25")
    })

    it("handles invalid or empty date strings gracefully", () => {
      expect(formatBookingDateDisplay(null)).toBe("—")
      expect(formatBookingDateDisplay("")).toBe("—")
      expect(formatBookingDateDisplay("invalid-date")).toBe("invalid-date")
    })
  })

  /* ------------------------------------------------------------------ */
  /* 5. End-to-End API Service Contract Calls                           */
  /* ------------------------------------------------------------------ */
  describe("Checklist 2 & 7: API Service Contracts", () => {
    it("GET /bookings calls with status filter parameter", async () => {
      const mockList = {
        data: {
          data: [],
          meta: { page: 1, pageSize: 20, total: 0 },
        },
      }
      const getSpy = vi.spyOn(apiClient, "get").mockResolvedValueOnce(mockList)

      await bookingsApi.listMyBookings({ status: "CONFIRMED", page: 1, pageSize: 10 })

      expect(getSpy).toHaveBeenCalledWith("/bookings", {
        params: { status: "CONFIRMED", page: 1, pageSize: 10 },
      })
    })

    it("GET /bookings/{id} returns booking details", async () => {
      const mockDetail = {
        data: {
          data: {
            id: "b-test",
            bookingCode: "BK-TEST-123",
            customerId: "user-1",
            courtId: "court-1",
            bookingDate: "2026-10-25",
            status: "CONFIRMED",
            slots: [],
            createdAt: "2026-10-20T00:00:00Z",
            cancelledAt: null,
          },
        },
      }
      const getSpy = vi.spyOn(apiClient, "get").mockResolvedValueOnce(mockDetail)

      const result = await bookingsApi.getMyBooking("b-test")
      expect(getSpy).toHaveBeenCalledWith("/bookings/b-test")
      expect(result.data.bookingCode).toBe("BK-TEST-123")
    })

    it("POST /bookings/{id}/cancel executes successfully and returns updated status", async () => {
      const mockCancelled = {
        data: {
          data: {
            id: "b-cancel-1",
            bookingCode: "BK-CANCEL-1",
            customerId: "user-1",
            courtId: "court-1",
            bookingDate: "2026-10-25",
            status: "CANCELLED",
            slots: [],
            createdAt: "2026-10-20T00:00:00Z",
            cancelledAt: "2026-10-24T12:00:00Z",
          },
        },
      }
      const postSpy = vi.spyOn(apiClient, "post").mockResolvedValueOnce(mockCancelled)

      const res = await bookingsApi.cancelMyBooking("b-cancel-1")
      expect(postSpy).toHaveBeenCalledWith("/bookings/b-cancel-1/cancel")
      expect(res.data.status).toBe("CANCELLED")
      expect(res.data.cancelledAt).toBe("2026-10-24T12:00:00Z")
    })
  })
})
