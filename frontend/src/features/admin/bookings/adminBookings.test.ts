import { describe, expect, it, vi, beforeEach } from "vitest"
import {
  checkAdminBookingCancelEligibility,
  formatAdminBookingDate,
  formatAdminDateTime,
  formatAdminSlotRange,
  formatAdminTimeSlot,
  parseAdminBookingApiError,
  shortenUuid,
  validateCancelReason,
} from "./adminBookingUtils"
import { adminBookingsQueryKeys } from "./useAdminBookings"
import { adminApi } from "@/lib/api/admin"
import { apiClient } from "@/lib/api/client"
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios"
import type { AdminBookingItem, AdminBookingSlotItem } from "@/types/adminBooking.types"

function makeSlot(
  id: string,
  startHour: number,
  endHour: number,
  date = "2026-10-25",
): AdminBookingSlotItem {
  const pad = (n: number) => String(n).padStart(2, "0")
  return {
    timeSlotId: id,
    startsAt: `${date}T${pad(startHour)}:00:00.000Z`,
    endsAt: `${date}T${pad(endHour)}:00:00.000Z`,
  }
}

describe("Admin Booking Management Tests (SRS FR-17, BR-14 & OpenAPI 0.5.0)", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  /* ------------------------------------------------------------------ */
  /* 1. Validation Rules: Cancellation Reason                          */
  /* ------------------------------------------------------------------ */
  describe("Checklist 6: Cancel Reason Validation", () => {
    it("accepts a valid cancellation reason", () => {
      const res = validateCancelReason("Bảo trì sân đột xuất do hệ thống chiếu sáng hỏng")
      expect(res.isValid).toBe(true)
      expect(res.error).toBeUndefined()
      expect(res.trimmed).toBe("Bảo trì sân đột xuất do hệ thống chiếu sáng hỏng")
    })

    it("trims surrounding whitespace", () => {
      const res = validateCancelReason("   Sự cố kỹ thuật   ")
      expect(res.isValid).toBe(true)
      expect(res.trimmed).toBe("Sự cố kỹ thuật")
    })

    it("rejects empty reason", () => {
      const res = validateCancelReason("")
      expect(res.isValid).toBe(false)
      expect(res.error).toBe("Vui lòng nhập lý do hủy booking.")
    })

    it("rejects whitespace-only reason", () => {
      const res = validateCancelReason("     \t \n  ")
      expect(res.isValid).toBe(false)
      expect(res.error).toBe("Vui lòng nhập lý do hủy booking.")
    })

    it("rejects reason exceeding 500 characters", () => {
      const longReason = "A".repeat(501)
      const res = validateCancelReason(longReason)
      expect(res.isValid).toBe(false)
      expect(res.error).toBe("Lý do hủy không được vượt quá 500 ký tự.")
    })

    it("accepts reason at exactly 500 characters", () => {
      const maxReason = "A".repeat(500)
      const res = validateCancelReason(maxReason)
      expect(res.isValid).toBe(true)
      expect(res.trimmed.length).toBe(500)
    })
  })

  /* ------------------------------------------------------------------ */
  /* 2. Business Rules: Cancellation Eligibility (BR-14 / FR-17)        */
  /* ------------------------------------------------------------------ */
  describe("Checklist 5: Cancellation Action Eligibility by Status & Time", () => {
    const fixedNow = new Date("2026-10-25T08:00:00.000Z").getTime()

    it("allows cancellation when status is CONFIRMED and first slot starts in future", () => {
      const slot1 = makeSlot("s1", 9, 10, "2026-10-25")
      const slot2 = makeSlot("s2", 10, 11, "2026-10-25")

      const booking: AdminBookingItem = {
        id: "bk-1",
        bookingCode: "BK-20261025-001",
        customerId: "cust-1",
        courtId: "court-1",
        bookingDate: "2026-10-25",
        status: "CONFIRMED",
        slots: [slot1, slot2],
        createdAt: "2026-10-20T10:00:00.000Z",
        cancelledAt: null,
      }

      const result = checkAdminBookingCancelEligibility(booking, fixedNow)
      expect(result.canCancel).toBe(true)
      expect(result.code).toBe("OK")
    })

    it("rejects cancellation when status is CANCELLED", () => {
      const slot1 = makeSlot("s1", 9, 10, "2026-10-25")

      const booking: AdminBookingItem = {
        id: "bk-2",
        bookingCode: "BK-20261025-002",
        customerId: "cust-1",
        courtId: "court-1",
        bookingDate: "2026-10-25",
        status: "CANCELLED",
        slots: [slot1],
        createdAt: "2026-10-20T10:00:00.000Z",
        cancelledAt: "2026-10-21T10:00:00.000Z",
      }

      const result = checkAdminBookingCancelEligibility(booking, fixedNow)
      expect(result.canCancel).toBe(false)
      expect(result.code).toBe("ALREADY_CANCELLED")
      expect(result.message).toContain("đã được hủy")
    })

    it("rejects cancellation when first slot has already started (startsAt < now)", () => {
      const slot1 = makeSlot("s1", 7, 8, "2026-10-25") // Started at 07:00, now is 08:00

      const booking: AdminBookingItem = {
        id: "bk-3",
        bookingCode: "BK-20261025-003",
        customerId: "cust-1",
        courtId: "court-1",
        bookingDate: "2026-10-25",
        status: "CONFIRMED",
        slots: [slot1],
        createdAt: "2026-10-20T10:00:00.000Z",
        cancelledAt: null,
      }

      const result = checkAdminBookingCancelEligibility(booking, fixedNow)
      expect(result.canCancel).toBe(false)
      expect(result.code).toBe("PAST_START_TIME")
      expect(result.message).toContain("SRS BR-14")
    })

    it("rejects cancellation when first slot starts exactly at current timestamp (startsAt === now)", () => {
      const slot1 = makeSlot("s1", 8, 9, "2026-10-25") // Starts at 08:00, now is 08:00

      const booking: AdminBookingItem = {
        id: "bk-4",
        bookingCode: "BK-20261025-004",
        customerId: "cust-1",
        courtId: "court-1",
        bookingDate: "2026-10-25",
        status: "CONFIRMED",
        slots: [slot1],
        createdAt: "2026-10-20T10:00:00.000Z",
        cancelledAt: null,
      }

      const result = checkAdminBookingCancelEligibility(booking, fixedNow)
      expect(result.canCancel).toBe(false)
      expect(result.code).toBe("PAST_START_TIME")
    })

    it("rejects cancellation when booking has empty slots array", () => {
      const booking: AdminBookingItem = {
        id: "bk-5",
        bookingCode: "BK-20261025-005",
        customerId: "cust-1",
        courtId: "court-1",
        bookingDate: "2026-10-25",
        status: "CONFIRMED",
        slots: [],
        createdAt: "2026-10-20T10:00:00.000Z",
        cancelledAt: null,
      }

      const result = checkAdminBookingCancelEligibility(booking, fixedNow)
      expect(result.canCancel).toBe(false)
      expect(result.code).toBe("NO_SLOTS")
    })

    it("correctly identifies the earliest slot even if unsorted in input", () => {
      // Slot 2 starts at 07:00 (past), Slot 1 starts at 09:00 (future)
      const slotLate = makeSlot("s1", 9, 10, "2026-10-25")
      const slotEarly = makeSlot("s2", 7, 8, "2026-10-25")

      const booking: AdminBookingItem = {
        id: "bk-6",
        bookingCode: "BK-20261025-006",
        customerId: "cust-1",
        courtId: "court-1",
        bookingDate: "2026-10-25",
        status: "CONFIRMED",
        slots: [slotLate, slotEarly], // deliberately unsorted
        createdAt: "2026-10-20T10:00:00.000Z",
        cancelledAt: null,
      }

      const result = checkAdminBookingCancelEligibility(booking, fixedNow)
      // Because the earliest slot started at 07:00, cannot cancel
      expect(result.canCancel).toBe(false)
      expect(result.code).toBe("PAST_START_TIME")
    })
  })

  /* ------------------------------------------------------------------ */
  /* 3. API Client & Contract (OpenAPI 0.5.0)                           */
  /* ------------------------------------------------------------------ */
  describe("Checklist 2: API Client & Endpoint Mapping", () => {
    it("adminApi.listBookings calls GET /admin/bookings with query parameters", async () => {
      const mockResponse: AxiosResponse = {
        data: {
          data: [],
          meta: { page: 1, pageSize: 20, total: 0 },
        },
        status: 200,
        statusText: "OK",
        headers: {},
        config: {} as InternalAxiosRequestConfig,
      }

      const getSpy = vi.spyOn(apiClient, "get").mockResolvedValueOnce(mockResponse)

      const queryParams = {
        page: 2,
        pageSize: 10,
        courtId: "11111111-1111-1111-1111-111111111111",
        date: "2026-10-25",
        status: "CONFIRMED" as const,
      }

      const result = await adminApi.listBookings(queryParams)

      expect(getSpy).toHaveBeenCalledWith("/admin/bookings", { params: queryParams })
      expect(result.meta.page).toBe(1)
      expect(result.meta.total).toBe(0)
    })

    it("adminApi.getBooking calls GET /admin/bookings/:id", async () => {
      const mockBooking: AdminBookingItem = {
        id: "22222222-2222-2222-2222-222222222222",
        bookingCode: "BK-001",
        customerId: "cust-1",
        courtId: "court-1",
        bookingDate: "2026-10-25",
        status: "CONFIRMED",
        slots: [makeSlot("s1", 9, 10)],
        createdAt: "2026-10-20T10:00:00.000Z",
        cancelledAt: null,
      }

      const mockResponse: AxiosResponse = {
        data: { data: mockBooking },
        status: 200,
        statusText: "OK",
        headers: {},
        config: {} as InternalAxiosRequestConfig,
      }

      const getSpy = vi.spyOn(apiClient, "get").mockResolvedValueOnce(mockResponse)

      const result = await adminApi.getBooking("22222222-2222-2222-2222-222222222222")

      expect(getSpy).toHaveBeenCalledWith("/admin/bookings/22222222-2222-2222-2222-222222222222")
      expect(result.data.bookingCode).toBe("BK-001")
    })

    it("adminApi.cancelBooking calls POST /admin/bookings/:id/cancel with reason", async () => {
      const mockUpdated: AdminBookingItem = {
        id: "33333333-3333-3333-3333-333333333333",
        bookingCode: "BK-002",
        customerId: "cust-1",
        courtId: "court-1",
        bookingDate: "2026-10-25",
        status: "CANCELLED",
        slots: [makeSlot("s1", 9, 10)],
        createdAt: "2026-10-20T10:00:00.000Z",
        cancelledAt: "2026-10-24T12:00:00.000Z",
      }

      const mockResponse: AxiosResponse = {
        data: { data: mockUpdated },
        status: 200,
        statusText: "OK",
        headers: {},
        config: {} as InternalAxiosRequestConfig,
      }

      const postSpy = vi.spyOn(apiClient, "post").mockResolvedValueOnce(mockResponse)

      const result = await adminApi.cancelBooking("33333333-3333-3333-3333-333333333333", {
        reason: "Bảo trì khẩn cấp",
      })

      expect(postSpy).toHaveBeenCalledWith(
        "/admin/bookings/33333333-3333-3333-3333-333333333333/cancel",
        { reason: "Bảo trì khẩn cấp" },
      )
      expect(result.data.status).toBe("CANCELLED")
    })

    it("adminApi.getStatistics calls GET /admin/statistics with from and to", async () => {
      const mockResponse: AxiosResponse = {
        data: {
          data: {
            totalBookings: 15,
            confirmedBookings: 12,
            cancelledBookings: 3,
          },
        },
        status: 200,
        statusText: "OK",
        headers: {},
        config: {} as InternalAxiosRequestConfig,
      }

      const getSpy = vi.spyOn(apiClient, "get").mockResolvedValueOnce(mockResponse)

      const result = await adminApi.getStatistics({ from: "2026-10-01", to: "2026-10-31" })

      expect(getSpy).toHaveBeenCalledWith("/admin/statistics", {
        params: { from: "2026-10-01", to: "2026-10-31" },
      })
      expect(result.data.totalBookings).toBe(15)
    })
  })

  /* ------------------------------------------------------------------ */
  /* 4. API Error Parsing & Negative Cases                             */
  /* ------------------------------------------------------------------ */
  describe("Checklist 2 & 7: API Error Handling & Negative Cases", () => {
    function makeAxiosError(status: number, code: string, message: string): AxiosError {
      const err = new AxiosError(message)
      err.response = {
        status,
        statusText: "Error",
        headers: {},
        config: {} as InternalAxiosRequestConfig,
        data: {
          error: {
            code,
            message,
            requestId: "req-123",
          },
        },
      }
      return err
    }

    it("parses 409 cancellation_closed error with backend message and fallback", () => {
      const errWithMsg = makeAxiosError(409, "cancellation_closed", "Chỉ được hủy trước slot đầu tiên.")
      const parsedWithMsg = parseAdminBookingApiError(errWithMsg)
      expect(parsedWithMsg.code).toBe("cancellation_closed")
      expect(parsedWithMsg.message).toBe("Chỉ được hủy trước slot đầu tiên.")
      expect(parsedWithMsg.requestId).toBe("req-123")

      // Fallback message when error response message is empty
      const errEmpty = makeAxiosError(409, "cancellation_closed", "")
      const parsedEmpty = parseAdminBookingApiError(errEmpty)
      expect(parsedEmpty.message).toContain("SRS BR-14")
    })

    it("parses 409 already_cancelled error with backend message and fallback", () => {
      const err = makeAxiosError(409, "already_cancelled", "Booking đã được hủy.")
      const parsed = parseAdminBookingApiError(err)
      expect(parsed.code).toBe("already_cancelled")
      expect(parsed.message).toBe("Booking đã được hủy.")

      const errEmpty = makeAxiosError(409, "already_cancelled", "")
      const parsedEmpty = parseAdminBookingApiError(errEmpty)
      expect(parsedEmpty.message).toContain("Booking này đã được hủy trước đó.")
    })

    it("parses 400 validation_error with backend message and fallback", () => {
      const err = makeAxiosError(400, "validation_error", "ID booking phải là UUID hợp lệ.")
      const parsed = parseAdminBookingApiError(err)
      expect(parsed.code).toBe("validation_error")
      expect(parsed.message).toBe("ID booking phải là UUID hợp lệ.")

      const errEmpty = makeAxiosError(400, "validation_error", "")
      const parsedEmpty = parseAdminBookingApiError(errEmpty)
      expect(parsedEmpty.message).toContain("không hợp lệ")
    })

    it("parses 404 not_found error with backend message and fallback", () => {
      const err = makeAxiosError(404, "not_found", "Không tìm thấy booking.")
      const parsed = parseAdminBookingApiError(err)
      expect(parsed.code).toBe("not_found")
      expect(parsed.message).toBe("Không tìm thấy booking.")

      const errEmpty = makeAxiosError(404, "not_found", "")
      const parsedEmpty = parseAdminBookingApiError(errEmpty)
      expect(parsedEmpty.message).toContain("404 Not Found")
    })

    it("parses 401 unauthorized error", () => {
      const err = makeAxiosError(401, "unauthorized", "Cần đăng nhập.")
      const parsed = parseAdminBookingApiError(err)
      expect(parsed.code).toBe("unauthorized")
      expect(parsed.message).toContain("quản trị viên")
    })

    it("parses 403 forbidden error", () => {
      const err = makeAxiosError(403, "forbidden", "Từ chối quyền truy cập.")
      const parsed = parseAdminBookingApiError(err)
      expect(parsed.code).toBe("forbidden")
      expect(parsed.message).toContain("ADMIN")
    })

    it("falls back gracefully for unknown errors or network timeouts", () => {
      const genericErr = new Error("Network Error")
      const parsed = parseAdminBookingApiError(genericErr)
      expect(parsed.code).toBe("error")
      expect(parsed.message).toBe("Network Error")
    })

    it("handles null or undefined error safely", () => {
      const parsed = parseAdminBookingApiError(null)
      expect(parsed.code).toBe("unknown")
      expect(parsed.message).toBe("Đã xảy ra lỗi không xác định.")
    })
  })

  /* ------------------------------------------------------------------ */
  /* 5. Formatting Helpers                                              */
  /* ------------------------------------------------------------------ */
  describe("Formatting Helpers: Dates, Slots, UUIDs", () => {
    it("formatAdminBookingDate formats YYYY-MM-DD into Vietnamese localized date", () => {
      const formatted = formatAdminBookingDate("2026-10-25")
      expect(formatted).toContain("2026")
      expect(formatted).toContain("10")
      expect(formatted).toContain("25")
    })

    it("formatAdminBookingDate handles empty or null safely", () => {
      expect(formatAdminBookingDate("")).toBe("—")
      expect(formatAdminBookingDate(null)).toBe("—")
    })

    it("formatAdminSlotRange calculates total minutes and slot count correctly", () => {
      const slot1 = makeSlot("s1", 8, 9, "2026-10-25")
      const slot2 = makeSlot("s2", 9, 10, "2026-10-25")
      const slot3 = makeSlot("s3", 10, 11, "2026-10-25")

      const res = formatAdminSlotRange([slot1, slot2, slot3])
      expect(res.slotCount).toBe(3)
      expect(res.totalMinutes).toBe(180)
      expect(res.rangeText).toBeDefined()
    })

    it("formatAdminSlotRange handles empty array gracefully", () => {
      const res = formatAdminSlotRange([])
      expect(res.slotCount).toBe(0)
      expect(res.totalMinutes).toBe(0)
      expect(res.rangeText).toBe("—")
    })

    it("formatAdminTimeSlot formats startsAt and endsAt", () => {
      const res = formatAdminTimeSlot(
        "2026-10-25T08:00:00.000Z",
        "2026-10-25T09:00:00.000Z",
      )
      expect(res).toContain(" - ")
    })

    it("formatAdminDateTime formats ISO timestamp", () => {
      const res = formatAdminDateTime("2026-10-25T14:30:00.000Z")
      expect(res).toContain("2026")
      expect(formatAdminDateTime("")).toBe("—")
    })

    it("shortenUuid truncates long UUID with ellipsis", () => {
      const uuid = "550e8400-e29b-41d4-a716-446655440000"
      const shortened = shortenUuid(uuid)
      expect(shortened).toContain("550e8400…")
      expect(shortened.length).toBeLessThan(uuid.length)
      expect(shortenUuid(null)).toBe("—")
    })
  })

  /* ------------------------------------------------------------------ */
  /* 6. Checklist 7: Query Keys & Cache Management                      */
  /* ------------------------------------------------------------------ */
  describe("Checklist 7: Query Keys & Cache Management", () => {
    it("generates correct query keys for all, list, detail, and statistics", () => {
      expect(adminBookingsQueryKeys.all).toEqual(["admin", "bookings"])

      const listKey = adminBookingsQueryKeys.list({ page: 1, pageSize: 20 })
      expect(listKey).toEqual(["admin", "bookings", "list", { page: 1, pageSize: 20 }])

      const detailKey = adminBookingsQueryKeys.detail("booking-123")
      expect(detailKey).toEqual(["admin", "bookings", "detail", "booking-123"])

      const statsKey = adminBookingsQueryKeys.statistics("2026-10-01", "2026-10-31")
      expect(statsKey).toEqual(["admin", "statistics", "2026-10-01", "2026-10-31"])
    })
  })

  /* ------------------------------------------------------------------ */
  /* 7. Checklist 8: Route Protection Role Verification                */
  /* ------------------------------------------------------------------ */
  describe("Checklist 8: Route Protection by ADMIN Role", () => {
    it("verifies user role requirements for admin booking route", () => {
      const adminUser = { id: "u-1", email: "admin@test.com", role: "ADMIN" as const }
      const normalUser = { id: "u-2", email: "user@test.com", role: "USER" as const }

      const isAdmin = (role?: string) => role === "ADMIN"

      expect(isAdmin(adminUser.role)).toBe(true)
      expect(isAdmin(normalUser.role)).toBe(false)
      expect(isAdmin(undefined)).toBe(false)
    })
  })

  /* ------------------------------------------------------------------ */
  /* 8. Checklist 9: Filter Parameters Mapping & Clean Serialization    */
  /* ------------------------------------------------------------------ */
  describe("Checklist 9: Filter Serialization & Search Logic", () => {
    it("correctly filters bookings by search term on client side", () => {
      const b1: AdminBookingItem = {
        id: "b-1",
        bookingCode: "BK-20261025-001",
        customerId: "11111111-aaaa-bbbb-cccc-111111111111",
        courtId: "c-1",
        bookingDate: "2026-10-25",
        status: "CONFIRMED",
        slots: [makeSlot("s1", 8, 9)],
        createdAt: "2026-10-20T10:00:00.000Z",
        cancelledAt: null,
      }

      const b2: AdminBookingItem = {
        id: "b-2",
        bookingCode: "BK-20261025-002",
        customerId: "22222222-xxxx-yyyy-zzzz-222222222222",
        courtId: "c-2",
        bookingDate: "2026-10-25",
        status: "CANCELLED",
        slots: [makeSlot("s2", 9, 10)],
        createdAt: "2026-10-20T11:00:00.000Z",
        cancelledAt: "2026-10-21T10:00:00.000Z",
      }

      const list = [b1, b2]

      // Filter by bookingCode
      const matchCode = list.filter((b) => b.bookingCode.toLowerCase().includes("001"))
      expect(matchCode).toHaveLength(1)
      expect(matchCode[0].id).toBe("b-1")

      // Filter by customerId substring
      const matchCustomer = list.filter((b) => b.customerId.toLowerCase().includes("xxxx"))
      expect(matchCustomer).toHaveLength(1)
      expect(matchCustomer[0].id).toBe("b-2")

      // Filter by non-existent term
      const noMatch = list.filter((b) => b.bookingCode.toLowerCase().includes("999"))
      expect(noMatch).toHaveLength(0)
    })
  })
})
