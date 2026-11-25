import { describe, expect, it, vi, beforeEach } from "vitest"
import {
  toHHmmss,
  toHHmm,
  parseClockSeconds,
  validateOperatingHours,
  validateSlotPolicy,
  parseScheduleApiError,
  WEEKDAYS,
  getWeekdayName,
} from "./scheduleValidation"
import {
  adminScheduleQueryKey,
} from "./useAdminSchedule"
import { adminApi } from "@/lib/api/admin"
import { apiClient } from "@/lib/api/client"
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios"
import type { OperatingHour, SlotPolicyPayload } from "@/types/schedule.types"

describe("Admin Schedule & TimeSlot Management (Checklist FR-07 & OpenAPI 0.5.0)", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  /* ------------------------------------------------------------------ */
  /* 1. Time Normalization & Helpers                                   */
  /* ------------------------------------------------------------------ */
  describe("Time Normalization & Helper Utilities", () => {
    it("converts HH:mm to strict HH:mm:ss for backend contract", () => {
      expect(toHHmmss("08:00")).toBe("08:00:00")
      expect(toHHmmss("22:30")).toBe("22:30:00")
      expect(toHHmmss("00:00")).toBe("00:00:00")
    })

    it("preserves already-formatted HH:mm:ss", () => {
      expect(toHHmmss("08:00:00")).toBe("08:00:00")
      expect(toHHmmss("23:59:59")).toBe("23:59:59")
    })

    it("converts HH:mm:ss to HH:mm for HTML time inputs", () => {
      expect(toHHmm("08:00:00")).toBe("08:00")
      expect(toHHmm("14:30:00")).toBe("14:30")
      expect(toHHmm("08:00")).toBe("08:00")
    })

    it("parses clock seconds accurately", () => {
      expect(parseClockSeconds("00:00:00")).toBe(0)
      expect(parseClockSeconds("01:00:00")).toBe(3600)
      expect(parseClockSeconds("08:30:00")).toBe(8 * 3600 + 30 * 60)
      expect(parseClockSeconds("23:59:59")).toBe(23 * 3600 + 59 * 60 + 59)
    })

    it("returns NaN for invalid clock formats", () => {
      expect(Number.isNaN(parseClockSeconds("25:00:00"))).toBe(true)
      expect(Number.isNaN(parseClockSeconds("08:60:00"))).toBe(true)
      expect(Number.isNaN(parseClockSeconds("8:00"))).toBe(true)
      expect(Number.isNaN(parseClockSeconds("invalid"))).toBe(true)
    })

    it("returns correct Vietnamese weekday names", () => {
      expect(WEEKDAYS.length).toBe(7)
      expect(getWeekdayName(1)).toBe("Thứ Hai")
      expect(getWeekdayName(7)).toBe("Chủ Nhật")
    })
  })

  /* ------------------------------------------------------------------ */
  /* 2. Client-side Operating Hours Validation (Checklist 4)           */
  /* ------------------------------------------------------------------ */
  describe("Checklist 4: Client-side Operating Hours Validation", () => {
    it("passes with valid weekly operating hours", () => {
      const hours: OperatingHour[] = [
        { weekday: 1, opensAt: "08:00:00", closesAt: "22:00:00" },
        { weekday: 2, opensAt: "08:00:00", closesAt: "22:00:00" },
        { weekday: 3, opensAt: "08:00:00", closesAt: "22:00:00" },
        { weekday: 4, opensAt: "08:00:00", closesAt: "22:00:00" },
        { weekday: 5, opensAt: "08:00:00", closesAt: "22:00:00" },
        { weekday: 6, opensAt: "08:00:00", closesAt: "22:00:00" },
        { weekday: 7, opensAt: "08:00:00", closesAt: "22:00:00" },
      ]
      const result = validateOperatingHours(hours)
      expect(result.isValid).toBe(true)
      expect(Object.keys(result.fieldErrors).length).toBe(0)
    })

    it("accepts empty array (court closed whole week)", () => {
      const result = validateOperatingHours([])
      expect(result.isValid).toBe(true)
    })

    it("accepts adjacent shifts on the same weekday without overlap", () => {
      const hours: OperatingHour[] = [
        { weekday: 1, opensAt: "08:00:00", closesAt: "12:00:00" },
        { weekday: 1, opensAt: "12:00:00", closesAt: "18:00:00" },
        { weekday: 1, opensAt: "18:00:00", closesAt: "22:00:00" },
      ]
      const result = validateOperatingHours(hours)
      expect(result.isValid).toBe(true)
    })

    it("rejects weekday outside 1–7", () => {
      const hours: OperatingHour[] = [
        { weekday: 0, opensAt: "08:00:00", closesAt: "22:00:00" },
      ]
      const result = validateOperatingHours(hours)
      expect(result.isValid).toBe(false)
      expect(result.fieldErrors["hours[0].weekday"]).toBeDefined()
    })

    it("rejects zero-length time interval (opensAt == closesAt)", () => {
      const hours: OperatingHour[] = [
        { weekday: 1, opensAt: "08:00:00", closesAt: "08:00:00" },
      ]
      const result = validateOperatingHours(hours)
      expect(result.isValid).toBe(false)
      expect(result.fieldErrors["hours[0].timeRange"]).toContain("Giờ mở cửa phải trước giờ đóng cửa")
    })

    it("rejects overnight interval (opensAt > closesAt)", () => {
      const hours: OperatingHour[] = [
        { weekday: 1, opensAt: "22:00:00", closesAt: "08:00:00" },
      ]
      const result = validateOperatingHours(hours)
      expect(result.isValid).toBe(false)
      expect(result.fieldErrors["hours[0].timeRange"]).toContain("không hỗ trợ qua đêm")
    })

    it("rejects overlapping intervals on the same weekday", () => {
      const hours: OperatingHour[] = [
        { weekday: 2, opensAt: "08:00:00", closesAt: "14:00:00" },
        { weekday: 2, opensAt: "12:00:00", closesAt: "20:00:00" },
      ]
      const result = validateOperatingHours(hours)
      expect(result.isValid).toBe(false)
      expect(result.fieldErrors["weekday_2_overlap"]).toContain("trùng lặp")
    })

    it("rejects unsorted overlapping intervals on the same weekday", () => {
      const hours: OperatingHour[] = [
        { weekday: 3, opensAt: "14:00:00", closesAt: "22:00:00" },
        { weekday: 3, opensAt: "08:00:00", closesAt: "16:00:00" },
      ]
      const result = validateOperatingHours(hours)
      expect(result.isValid).toBe(false)
      expect(result.fieldErrors["weekday_3_overlap"]).toBeDefined()
    })

    it("allows identical intervals on different weekdays", () => {
      const hours: OperatingHour[] = [
        { weekday: 1, opensAt: "08:00:00", closesAt: "12:00:00" },
        { weekday: 2, opensAt: "08:00:00", closesAt: "12:00:00" },
      ]
      const result = validateOperatingHours(hours)
      expect(result.isValid).toBe(true)
    })
  })

  /* ------------------------------------------------------------------ */
  /* 3. Slot Policy Validation (Checklist 3)                            */
  /* ------------------------------------------------------------------ */
  describe("Checklist 3: Slot Policy Validation (Duration, Min, Max)", () => {
    it("passes with valid policy", () => {
      const policy: SlotPolicyPayload = {
        slotDurationMinutes: 60,
        minConsecutiveSlots: 1,
        maxConsecutiveSlots: 4,
      }
      const errors = validateSlotPolicy(policy)
      expect(Object.keys(errors).length).toBe(0)
    })

    it("rejects slot duration <= 0", () => {
      const policy: SlotPolicyPayload = {
        slotDurationMinutes: 0,
        minConsecutiveSlots: 1,
        maxConsecutiveSlots: 4,
      }
      const errors = validateSlotPolicy(policy)
      expect(errors.slotDurationMinutes).toContain("phải từ 1 đến 32.767")
    })

    it("rejects slot duration > 32767", () => {
      const policy: SlotPolicyPayload = {
        slotDurationMinutes: 32768,
        minConsecutiveSlots: 1,
        maxConsecutiveSlots: 4,
      }
      const errors = validateSlotPolicy(policy)
      expect(errors.slotDurationMinutes).toBeDefined()
    })

    it("rejects minConsecutiveSlots < 1", () => {
      const policy: SlotPolicyPayload = {
        slotDurationMinutes: 60,
        minConsecutiveSlots: 0,
        maxConsecutiveSlots: 4,
      }
      const errors = validateSlotPolicy(policy)
      expect(errors.minConsecutiveSlots).toContain("tối thiểu phải là số nguyên dương")
    })

    it("rejects maxConsecutiveSlots < minConsecutiveSlots", () => {
      const policy: SlotPolicyPayload = {
        slotDurationMinutes: 60,
        minConsecutiveSlots: 3,
        maxConsecutiveSlots: 2,
      }
      const errors = validateSlotPolicy(policy)
      expect(errors.maxConsecutiveSlots).toContain("lớn hơn hoặc bằng số slot tối thiểu")
    })

    it("accepts minConsecutiveSlots equal to maxConsecutiveSlots", () => {
      const policy: SlotPolicyPayload = {
        slotDurationMinutes: 60,
        minConsecutiveSlots: 2,
        maxConsecutiveSlots: 2,
      }
      const errors = validateSlotPolicy(policy)
      expect(Object.keys(errors).length).toBe(0)
    })
  })

  /* ------------------------------------------------------------------ */
  /* 4. Backend Error Handling (Checklist 5)                           */
  /* ------------------------------------------------------------------ */
  describe("Checklist 5: Backend Error Handling & Parsing", () => {
    function makeAxiosError(status: number, data: unknown): AxiosError {
      const err = new AxiosError("Request failed with status code " + status)
      err.response = {
        status,
        data,
        statusText: "",
        headers: {},
        config: {} as InternalAxiosRequestConfig,
      } as AxiosResponse
      return err
    }

    it("parses 409 schedule_overlap correctly", () => {
      const err = makeAxiosError(409, {
        error: {
          code: "schedule_overlap",
          message: "Giờ mở cửa bị trùng.",
          requestId: "req-123",
        },
      })
      const parsed = parseScheduleApiError(err)
      expect(parsed.code).toBe("schedule_overlap")
      expect(parsed.message).toBe("Giờ mở cửa bị trùng.")
    })

    it("parses 400 validation_error with field details", () => {
      const err = makeAxiosError(400, {
        error: {
          code: "validation_error",
          message: "Dữ liệu không hợp lệ.",
          requestId: "req-456",
          details: [
            { field: "hours", message: "Giờ mở phải trước giờ đóng trong cùng ngày." },
            { field: "slotDurationMinutes", message: "Thời lượng slot phải từ 1 đến 32767 phút." },
          ],
        },
      })
      const parsed = parseScheduleApiError(err)
      expect(parsed.code).toBe("validation_error")
      expect(parsed.fieldErrors.hours).toBe("Giờ mở phải trước giờ đóng trong cùng ngày.")
      expect(parsed.fieldErrors.slotDurationMinutes).toBe("Thời lượng slot phải từ 1 đến 32767 phút.")
    })

    it("parses 404 not_found error", () => {
      const err = makeAxiosError(404, {
        error: { code: "not_found", message: "Không tìm thấy tài nguyên." },
      })
      const parsed = parseScheduleApiError(err)
      expect(parsed.code).toBe("not_found")
      expect(parsed.message).toBe("Không tìm thấy tài nguyên.")
    })

    it("parses 403 forbidden error", () => {
      const err = makeAxiosError(403, {
        error: { code: "forbidden", message: "Cần quyền ADMIN." },
      })
      const parsed = parseScheduleApiError(err)
      expect(parsed.code).toBe("forbidden")
      expect(parsed.message).toContain("quyền")
    })

    it("parses 401 unauthorized error", () => {
      const err = makeAxiosError(401, {
        error: { code: "unauthorized", message: "Cần đăng nhập." },
      })
      const parsed = parseScheduleApiError(err)
      expect(parsed.code).toBe("unauthorized")
      expect(parsed.message).toContain("hết hạn")
    })

    it("handles non-Axios generic error", () => {
      const parsed = parseScheduleApiError(new Error("Network failure"))
      expect(parsed.code).toBe("unknown")
      expect(parsed.message).toBe("Network failure")
    })
  })

  /* ------------------------------------------------------------------ */
  /* 5. API Services & Query Key Contracts                              */
  /* ------------------------------------------------------------------ */
  describe("API Services & Query Key Contracts", () => {
    it("generates correct query key for court schedule", () => {
      const key = adminScheduleQueryKey("court-uuid-001")
      expect(key).toEqual(["admin", "courts", "court-uuid-001", "schedule"])
    })

    it("calls GET /admin/courts/:courtId/operating-hours", async () => {
      const mockResponse = {
        data: {
          data: {
            courtId: "court-1",
            timeZone: "Asia/Ho_Chi_Minh",
            hours: [{ weekday: 1, opensAt: "08:00:00", closesAt: "22:00:00" }],
            timeSlots: [
              { id: "slot-1", weekday: 1, startsAt: "08:00:00", endsAt: "09:00:00" },
            ],
          },
        },
      }
      vi.spyOn(apiClient, "get").mockResolvedValueOnce(mockResponse)

      const result = await adminApi.getOperatingHours("court-1")
      expect(apiClient.get).toHaveBeenCalledWith("/admin/courts/court-1/operating-hours")
      expect(result.data.courtId).toBe("court-1")
      expect(result.data.timeSlots.length).toBe(1)
    })

    it("calls PUT /admin/courts/:courtId/operating-hours", async () => {
      const mockResponse = {
        data: {
          data: {
            courtId: "court-1",
            timeZone: "Asia/Ho_Chi_Minh",
            hours: [{ weekday: 1, opensAt: "07:00:00", closesAt: "23:00:00" }],
            timeSlots: [],
          },
        },
      }
      vi.spyOn(apiClient, "put").mockResolvedValueOnce(mockResponse)

      const payload = {
        hours: [{ weekday: 1, opensAt: "07:00:00", closesAt: "23:00:00" }],
      }
      const result = await adminApi.replaceOperatingHours("court-1", payload)
      expect(apiClient.put).toHaveBeenCalledWith(
        "/admin/courts/court-1/operating-hours",
        payload,
      )
      expect(result.data.hours[0].opensAt).toBe("07:00:00")
    })
  })
})
