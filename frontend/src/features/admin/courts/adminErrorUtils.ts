import { AxiosError } from "axios"
import type { ApiErrorResponse } from "@/types/auth.types"

export interface ParsedAdminError {
  code: string
  message: string
  fieldErrors: Record<string, string>
}

/** Friendly translations for backend validation field names */
const FIELD_TRANSLATIONS: Record<string, string> = {
  name: "Tên",
  code: "Mã sân",
  sportTypeId: "Loại thể thao",
  slotDurationMinutes: "Thời lượng slot",
  minConsecutiveSlots: "Số slot liên tiếp tối thiểu",
  maxConsecutiveSlots: "Số slot liên tiếp tối đa",
  referencePriceAmount: "Giá tham khảo",
  referencePriceCurrency: "Mã tiền tệ",
  isActive: "Trạng thái hoạt động",
  body: "Dữ liệu yêu cầu",
}

/**
 * Parse any error returned from Admin API into a structured object
 * with localized messages and field-specific error map.
 */
export function parseAdminApiError(
  error: unknown,
  context?: "sportType" | "court",
): ParsedAdminError {
  if (error instanceof AxiosError) {
    const status = error.response?.status
    const data = error.response?.data as ApiErrorResponse | undefined
    const errCode = data?.error?.code || ""
    const serverMsg = data?.error?.message || ""
    const fieldErrors: Record<string, string> = {}

    if (data?.error?.details && Array.isArray(data.error.details)) {
      for (const d of data.error.details) {
        if (d.field) {
          const fieldLabel = FIELD_TRANSLATIONS[d.field] || d.field
          fieldErrors[d.field] = d.message || `${fieldLabel} không hợp lệ.`
        }
      }
    }

    if (status === 409 || errCode === "conflict") {
      let message = serverMsg || "Xung đột dữ liệu hoặc còn bản ghi tham chiếu đang hoạt động."
      if (context === "sportType") {
        message =
          serverMsg.includes("tham chiếu") || serverMsg.includes("trùng")
            ? "Tên môn thể thao đã tồn tại hoặc vẫn còn sân đang hoạt động thuộc môn này."
            : serverMsg
      } else if (context === "court") {
        message =
          serverMsg.includes("tham chiếu") || serverMsg.includes("trùng")
            ? "Mã sân đã tồn tại trong hệ thống hoặc môn thể thao chưa được kích hoạt."
            : serverMsg
      }
      return { code: "conflict", message, fieldErrors }
    }

    if (status === 400 || errCode === "validation_error") {
      const detailsCount = Object.keys(fieldErrors).length
      const message =
        detailsCount > 0
          ? `Dữ liệu không hợp lệ: ${Object.values(fieldErrors).join(", ")}`
          : serverMsg || "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại."
      return { code: "validation_error", message, fieldErrors }
    }

    if (status === 404 || errCode === "not_found") {
      return {
        code: "not_found",
        message: serverMsg || "Không tìm thấy dữ liệu yêu cầu (404 Not Found).",
        fieldErrors,
      }
    }

    if (status === 403 || errCode === "forbidden") {
      return {
        code: "forbidden",
        message: "Bạn không có quyền thực hiện thao tác quản trị này.",
        fieldErrors,
      }
    }

    if (status === 401 || errCode === "unauthorized") {
      return {
        code: "unauthorized",
        message: "Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.",
        fieldErrors,
      }
    }

    if (serverMsg) {
      return { code: errCode || "error", message: serverMsg, fieldErrors }
    }
  }

  return {
    code: "unknown",
    message: error instanceof Error ? error.message : "Đã xảy ra lỗi không xác định. Vui lòng thử lại.",
    fieldErrors: {},
  }
}

/* ── Form validation helpers ─────────────────────────────────────── */

export interface SportTypeFormState {
  name: string
  description: string
  isActive: boolean
}

export function validateSportTypeForm(form: SportTypeFormState): Record<string, string> {
  const errors: Record<string, string> = {}
  const trimmedName = form.name.trim()

  if (!trimmedName) {
    errors.name = "Tên loại thể thao không được để trống."
  } else if (trimmedName.length > 100) {
    errors.name = "Tên loại thể thao không được vượt quá 100 ký tự."
  }

  return errors
}

export interface CourtFormState {
  sportTypeId: string
  code: string
  name: string
  description: string
  isActive: boolean
  slotDurationMinutes: number
  minConsecutiveSlots: number
  maxConsecutiveSlots: number
  referencePriceAmount: string
  referencePriceCurrency: string
}

export function validateCourtForm(form: CourtFormState): Record<string, string> {
  const errors: Record<string, string> = {}

  if (!form.sportTypeId) {
    errors.sportTypeId = "Vui lòng chọn loại thể thao."
  }

  const trimmedCode = form.code.trim()
  if (!trimmedCode) {
    errors.code = "Mã sân không được để trống."
  } else if (trimmedCode.length > 50) {
    errors.code = "Mã sân không được vượt quá 50 ký tự."
  }

  const trimmedName = form.name.trim()
  if (!trimmedName) {
    errors.name = "Tên sân không được để trống."
  } else if (trimmedName.length > 120) {
    errors.name = "Tên sân không được vượt quá 120 ký tự."
  }

  if (Number.isNaN(form.slotDurationMinutes) || form.slotDurationMinutes < 1) {
    errors.slotDurationMinutes = "Thời lượng slot phải là số nguyên dương (phút)."
  }

  if (Number.isNaN(form.minConsecutiveSlots) || form.minConsecutiveSlots < 1) {
    errors.minConsecutiveSlots = "Số slot tối thiểu phải là số nguyên dương (>= 1)."
  }

  if (Number.isNaN(form.maxConsecutiveSlots) || form.maxConsecutiveSlots < 1) {
    errors.maxConsecutiveSlots = "Số slot tối đa phải là số nguyên dương (>= 1)."
  } else if (form.maxConsecutiveSlots < form.minConsecutiveSlots) {
    errors.maxConsecutiveSlots = "Số slot tối đa phải lớn hơn hoặc bằng số slot tối thiểu."
  }

  // Price & currency pair validation: either both or neither
  const hasPrice = form.referencePriceAmount.trim() !== ""
  const hasCurrency = form.referencePriceCurrency.trim() !== ""

  if (hasPrice !== hasCurrency) {
    if (hasPrice) {
      errors.referencePriceCurrency = "Vui lòng nhập mã tiền tệ khi có giá tham khảo (VD: VND)."
    } else {
      errors.referencePriceAmount = "Vui lòng nhập số tiền khi có mã tiền tệ."
    }
  } else if (hasPrice) {
    const priceVal = form.referencePriceAmount.trim()
    const pricePattern = /^[0-9]+(\.[0-9]{1,2})?$/
    if (!pricePattern.test(priceVal)) {
      errors.referencePriceAmount = "Giá tham khảo không hợp lệ (VD: 100000 hoặc 150000.50)."
    }

    const currencyVal = form.referencePriceCurrency.trim().toUpperCase()
    if (currencyVal.length !== 3) {
      errors.referencePriceCurrency = "Mã tiền tệ phải có đúng 3 ký tự chữ hoa (VD: VND, USD)."
    }
  }

  return errors
}
