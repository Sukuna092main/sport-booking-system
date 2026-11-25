import { describe, expect, it, vi, beforeEach } from "vitest"
import {
  parseAdminApiError,
  validateSportTypeForm,
  validateCourtForm,
  type SportTypeFormState,
  type CourtFormState,
} from "./adminErrorUtils"
import {
  adminSportTypesQueryKey,
  adminCourtsQueryKey,
} from "./useAdminCourts"
import { adminApi } from "@/lib/api/admin"
import { apiClient } from "@/lib/api/client"
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios"
import type { Court, SportType } from "@/types/court.types"

describe("Admin SportType & Court Management Tests (SRS FR-15 & OpenAPI 0.5.0)", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  /* ------------------------------------------------------------------ */
  /* 1. Form Validation Rules (Checklist 3)                            */
  /* ------------------------------------------------------------------ */
  describe("Checklist 3: Form Validation Rules", () => {
    describe("validateSportTypeForm", () => {
      it("passes with valid data", () => {
        const form: SportTypeFormState = {
          name: "Cầu lông",
          description: "Môn thể thao dùng vợt và quả cầu",
          isActive: true,
        }
        const errors = validateSportTypeForm(form)
        expect(Object.keys(errors).length).toBe(0)
      })

      it("rejects empty or whitespace-only name", () => {
        const form: SportTypeFormState = {
          name: "   ",
          description: "",
          isActive: true,
        }
        const errors = validateSportTypeForm(form)
        expect(errors.name).toBe("Tên loại thể thao không được để trống.")
      })

      it("rejects name exceeding 100 characters", () => {
        const form: SportTypeFormState = {
          name: "A".repeat(101),
          description: "",
          isActive: true,
        }
        const errors = validateSportTypeForm(form)
        expect(errors.name).toBe("Tên loại thể thao không được vượt quá 100 ký tự.")
      })
    })

    describe("validateCourtForm", () => {
      const validForm: CourtFormState = {
        sportTypeId: "11111111-1111-1111-1111-111111111111",
        code: "SAN-BD-01",
        name: "Sân Cầu Lông 1",
        description: "Sân thảm tiêu chuẩn",
        isActive: true,
        slotDurationMinutes: 60,
        minConsecutiveSlots: 1,
        maxConsecutiveSlots: 4,
        referencePriceAmount: "150000",
        referencePriceCurrency: "VND",
      }

      it("passes with valid court payload", () => {
        const errors = validateCourtForm(validForm)
        expect(Object.keys(errors).length).toBe(0)
      })

      it("passes without optional reference price and currency (both empty)", () => {
        const form: CourtFormState = {
          ...validForm,
          referencePriceAmount: "",
          referencePriceCurrency: "",
        }
        const errors = validateCourtForm(form)
        expect(Object.keys(errors).length).toBe(0)
      })

      it("rejects missing sportTypeId", () => {
        const form: CourtFormState = { ...validForm, sportTypeId: "" }
        const errors = validateCourtForm(form)
        expect(errors.sportTypeId).toBe("Vui lòng chọn loại thể thao.")
      })

      it("rejects empty or whitespace code", () => {
        const form: CourtFormState = { ...validForm, code: "   " }
        const errors = validateCourtForm(form)
        expect(errors.code).toBe("Mã sân không được để trống.")
      })

      it("rejects code exceeding 50 characters", () => {
        const form: CourtFormState = { ...validForm, code: "C".repeat(51) }
        const errors = validateCourtForm(form)
        expect(errors.code).toBe("Mã sân không được vượt quá 50 ký tự.")
      })

      it("rejects empty or whitespace name", () => {
        const form: CourtFormState = { ...validForm, name: "   " }
        const errors = validateCourtForm(form)
        expect(errors.name).toBe("Tên sân không được để trống.")
      })

      it("rejects name exceeding 120 characters", () => {
        const form: CourtFormState = { ...validForm, name: "N".repeat(121) }
        const errors = validateCourtForm(form)
        expect(errors.name).toBe("Tên sân không được vượt quá 120 ký tự.")
      })

      it("rejects invalid slotDurationMinutes (< 1 or NaN)", () => {
        const form: CourtFormState = { ...validForm, slotDurationMinutes: 0 }
        const errors = validateCourtForm(form)
        expect(errors.slotDurationMinutes).toBe("Thời lượng slot phải là số nguyên dương (phút).")
      })

      it("rejects invalid minConsecutiveSlots (< 1)", () => {
        const form: CourtFormState = { ...validForm, minConsecutiveSlots: 0 }
        const errors = validateCourtForm(form)
        expect(errors.minConsecutiveSlots).toBe("Số slot tối thiểu phải là số nguyên dương (>= 1).")
      })

      it("rejects maxConsecutiveSlots less than minConsecutiveSlots", () => {
        const form: CourtFormState = {
          ...validForm,
          minConsecutiveSlots: 3,
          maxConsecutiveSlots: 2,
        }
        const errors = validateCourtForm(form)
        expect(errors.maxConsecutiveSlots).toBe(
          "Số slot tối đa phải lớn hơn hoặc bằng số slot tối thiểu.",
        )
      })

      it("enforces price & currency pair: rejects price without currency", () => {
        const form: CourtFormState = {
          ...validForm,
          referencePriceAmount: "150000",
          referencePriceCurrency: "",
        }
        const errors = validateCourtForm(form)
        expect(errors.referencePriceCurrency).toBe(
          "Vui lòng nhập mã tiền tệ khi có giá tham khảo (VD: VND).",
        )
      })

      it("enforces price & currency pair: rejects currency without price", () => {
        const form: CourtFormState = {
          ...validForm,
          referencePriceAmount: "",
          referencePriceCurrency: "VND",
        }
        const errors = validateCourtForm(form)
        expect(errors.referencePriceAmount).toBe("Vui lòng nhập số tiền khi có mã tiền tệ.")
      })

      it("rejects non-decimal price format", () => {
        const form: CourtFormState = {
          ...validForm,
          referencePriceAmount: "150abc",
          referencePriceCurrency: "VND",
        }
        const errors = validateCourtForm(form)
        expect(errors.referencePriceAmount).toContain("Giá tham khảo không hợp lệ")
      })

      it("rejects currency with length !== 3", () => {
        const form: CourtFormState = {
          ...validForm,
          referencePriceAmount: "150000",
          referencePriceCurrency: "VN",
        }
        const errors = validateCourtForm(form)
        expect(errors.referencePriceCurrency).toContain("3 ký tự")
      })
    })
  })

  /* ------------------------------------------------------------------ */
  /* 2. Backend Error Parsing (Checklist 6)                             */
  /* ------------------------------------------------------------------ */
  describe("Checklist 6: Backend Validation & Conflict Error Handling", () => {
    function makeAxiosError(status: number, data: unknown): AxiosError {
      const err = new AxiosError("Request failed with status code " + status)
      err.response = {
        status,
        data,
        statusText: "Error",
        headers: {},
        config: {} as InternalAxiosRequestConfig,
      } as AxiosResponse
      return err
    }

    it("handles 409 Conflict when deactivating sport type that has active courts", () => {
      const axiosErr = makeAxiosError(409, {
        error: {
          code: "conflict",
          message: "Bản ghi trùng hoặc còn tham chiếu đang hoạt động.",
          requestId: "req-123",
        },
      })

      const parsed = parseAdminApiError(axiosErr, "sportType")
      expect(parsed.code).toBe("conflict")
      expect(parsed.message).toContain("còn sân đang hoạt động")
    })

    it("handles 409 Conflict when creating court with duplicate code", () => {
      const axiosErr = makeAxiosError(409, {
        error: {
          code: "conflict",
          message: "Bản ghi trùng hoặc còn tham chiếu đang hoạt động.",
          requestId: "req-123",
        },
      })

      const parsed = parseAdminApiError(axiosErr, "court")
      expect(parsed.code).toBe("conflict")
      expect(parsed.message).toContain("Mã sân đã tồn tại")
    })

    it("handles 400 Validation Error with detailed field list", () => {
      const axiosErr = makeAxiosError(400, {
        error: {
          code: "validation_error",
          message: "Dữ liệu không hợp lệ.",
          requestId: "req-123",
          details: [
            { field: "code", message: "Mã sân không hợp lệ." },
            { field: "maxConsecutiveSlots", message: "Số slot tối đa không hợp lệ." },
          ],
        },
      })

      const parsed = parseAdminApiError(axiosErr)
      expect(parsed.code).toBe("validation_error")
      expect(parsed.fieldErrors.code).toBe("Mã sân không hợp lệ.")
      expect(parsed.fieldErrors.maxConsecutiveSlots).toBe("Số slot tối đa không hợp lệ.")
      expect(parsed.message).toContain("Mã sân không hợp lệ.")
    })

    it("handles 404 Not Found", () => {
      const axiosErr = makeAxiosError(404, {
        error: {
          code: "not_found",
          message: "Không tìm thấy bản ghi.",
          requestId: "req-123",
        },
      })

      const parsed = parseAdminApiError(axiosErr)
      expect(parsed.code).toBe("not_found")
      expect(parsed.message).toBe("Không tìm thấy bản ghi.")
    })

    it("handles 403 Forbidden role rejection", () => {
      const axiosErr = makeAxiosError(403, {
        error: {
          code: "forbidden",
          message: "Không có quyền.",
          requestId: "req-123",
        },
      })

      const parsed = parseAdminApiError(axiosErr)
      expect(parsed.code).toBe("forbidden")
      expect(parsed.message).toBe("Bạn không có quyền thực hiện thao tác quản trị này.")
    })

    it("handles 401 Unauthorized", () => {
      const axiosErr = makeAxiosError(401, {
        error: {
          code: "unauthorized",
          message: "Cần đăng nhập.",
          requestId: "req-123",
        },
      })

      const parsed = parseAdminApiError(axiosErr)
      expect(parsed.code).toBe("unauthorized")
      expect(parsed.message).toBe("Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.")
    })
  })

  /* ------------------------------------------------------------------ */
  /* 3. Query Keys Verification (Checklist 1 & 2)                       */
  /* ------------------------------------------------------------------ */
  describe("Checklist 1 & 2: Query Keys", () => {
    it("generates correct adminSportTypesQueryKey", () => {
      expect(adminSportTypesQueryKey).toEqual(["admin", "sport-types"])
    })

    it("generates correct adminCourtsQueryKey with and without pagination", () => {
      expect(adminCourtsQueryKey()).toEqual(["admin", "courts", undefined])
      expect(adminCourtsQueryKey({ page: 2, pageSize: 10 })).toEqual([
        "admin",
        "courts",
        { page: 2, pageSize: 10 },
      ])
    })
  })

  /* ------------------------------------------------------------------ */
  /* 4. Admin API Client Contract End-to-End (Checklist 9)              */
  /* ------------------------------------------------------------------ */
  describe("Checklist 9: Admin API Client Contract", () => {
    const mockSport: SportType = {
      id: "sport-uuid-1",
      name: "Badminton",
      description: "Fast-paced racquet sport",
      isActive: true,
    }

    const mockCourt: Court = {
      id: "court-uuid-1",
      sportTypeId: "sport-uuid-1",
      code: "BD-01",
      name: "Sân 1",
      description: "Thảm gỗ",
      isActive: true,
      slotDurationMinutes: 60,
      minConsecutiveSlots: 1,
      maxConsecutiveSlots: 4,
      referencePriceAmount: "120000.00",
      referencePriceCurrency: "VND",
    }

    it("calls GET /admin/sport-types and unwraps response", async () => {
      vi.spyOn(apiClient, "get").mockResolvedValueOnce({
        data: { data: [mockSport] },
      })

      const result = await adminApi.listSportTypes()
      expect(apiClient.get).toHaveBeenCalledWith("/admin/sport-types")
      expect(result.data).toHaveLength(1)
      expect(result.data[0].name).toBe("Badminton")
    })

    it("calls POST /admin/sport-types with write payload", async () => {
      vi.spyOn(apiClient, "post").mockResolvedValueOnce({
        data: { data: mockSport },
      })

      const payload = { name: "Badminton", description: "Desc", isActive: true }
      const result = await adminApi.createSportType(payload)
      expect(apiClient.post).toHaveBeenCalledWith("/admin/sport-types", payload)
      expect(result.data.id).toBe("sport-uuid-1")
    })

    it("calls PATCH /admin/sport-types/:id with update payload", async () => {
      vi.spyOn(apiClient, "patch").mockResolvedValueOnce({
        data: { data: { ...mockSport, name: "Badminton Pro" } },
      })

      const payload = { name: "Badminton Pro" }
      const result = await adminApi.updateSportType("sport-uuid-1", payload)
      expect(apiClient.patch).toHaveBeenCalledWith(
        "/admin/sport-types/sport-uuid-1",
        payload,
      )
      expect(result.data.name).toBe("Badminton Pro")
    })

    it("calls DELETE /admin/sport-types/:id for soft deactivation", async () => {
      vi.spyOn(apiClient, "delete").mockResolvedValueOnce({
        data: undefined,
      })

      await adminApi.deactivateSportType("sport-uuid-1")
      expect(apiClient.delete).toHaveBeenCalledWith("/admin/sport-types/sport-uuid-1")
    })

    it("calls GET /admin/courts with pagination params", async () => {
      vi.spyOn(apiClient, "get").mockResolvedValueOnce({
        data: {
          data: [mockCourt],
          meta: { page: 1, pageSize: 20, total: 1 },
        },
      })

      const result = await adminApi.listCourts({ page: 1, pageSize: 20 })
      expect(apiClient.get).toHaveBeenCalledWith("/admin/courts", {
        params: { page: 1, pageSize: 20 },
      })
      expect(result.data).toHaveLength(1)
      expect(result.meta.total).toBe(1)
    })

    it("calls POST /admin/courts with court write payload", async () => {
      vi.spyOn(apiClient, "post").mockResolvedValueOnce({
        data: { data: mockCourt },
      })

      const payload = {
        sportTypeId: "sport-uuid-1",
        code: "BD-01",
        name: "Sân 1",
        description: "Thảm gỗ",
        isActive: true,
        slotDurationMinutes: 60,
        minConsecutiveSlots: 1,
        maxConsecutiveSlots: 4,
        referencePriceAmount: "120000.00",
        referencePriceCurrency: "VND",
      }

      const result = await adminApi.createCourt(payload)
      expect(apiClient.post).toHaveBeenCalledWith("/admin/courts", payload)
      expect(result.data.code).toBe("BD-01")
    })

    it("calls PATCH /admin/courts/:id with court patch payload", async () => {
      vi.spyOn(apiClient, "patch").mockResolvedValueOnce({
        data: { data: { ...mockCourt, isActive: false } },
      })

      const payload = { isActive: false }
      const result = await adminApi.updateCourt("court-uuid-1", payload)
      expect(apiClient.patch).toHaveBeenCalledWith("/admin/courts/court-uuid-1", payload)
      expect(result.data.isActive).toBe(false)
    })

    it("calls DELETE /admin/courts/:id for court deactivation", async () => {
      vi.spyOn(apiClient, "delete").mockResolvedValueOnce({
        data: undefined,
      })

      await adminApi.deactivateCourt("court-uuid-1")
      expect(apiClient.delete).toHaveBeenCalledWith("/admin/courts/court-uuid-1")
    })
  })
})
