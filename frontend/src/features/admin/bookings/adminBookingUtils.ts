import type { AdminBookingItem, AdminBookingSlotItem } from "@/types/adminBooking.types"

export type AdminBookingCancelEligibilityCode =
  | "OK"
  | "ALREADY_CANCELLED"
  | "PAST_START_TIME"
  | "NO_SLOTS"

export interface AdminBookingCancelEligibilityResult {
  canCancel: boolean
  code: AdminBookingCancelEligibilityCode
  message: string
}

/**
 * Check if a booking is eligible for admin cancellation
 * per SRS FR-17, BR-14 & OpenAPI 0.5.0 contract:
 * - Status must be "CONFIRMED"
 * - Must have at least 1 slot
 * - Current timestamp must be strictly before the start time of the first slot (startsAt > now)
 */
export function checkAdminBookingCancelEligibility(
  booking: Pick<AdminBookingItem, "status"> & {
    slots?: AdminBookingSlotItem[]
  },
  nowTimestamp: number = Date.now(),
): AdminBookingCancelEligibilityResult {
  // 1. Status check
  if (booking.status === "CANCELLED") {
    return {
      canCancel: false,
      code: "ALREADY_CANCELLED",
      message: "Booking này đã được hủy trước đó.",
    }
  }

  // 2. Slots check
  const slots = booking.slots ?? []
  if (slots.length === 0) {
    return {
      canCancel: false,
      code: "NO_SLOTS",
      message: "Không có thông tin khung giờ để xác thực.",
    }
  }

  // 3. Timing check — first slot start time vs current time
  const sorted = [...slots].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  )
  const firstSlotStart = new Date(sorted[0].startsAt).getTime()

  if (firstSlotStart <= nowTimestamp) {
    return {
      canCancel: false,
      code: "PAST_START_TIME",
      message: "Chỉ được hủy trước thời điểm bắt đầu slot đầu tiên (SRS BR-14 / FR-17).",
    }
  }

  return {
    canCancel: true,
    code: "OK",
    message: "Booking đủ điều kiện để quản trị viên hủy.",
  }
}

/**
 * Validate admin cancellation reason input
 * per OpenAPI schema AdminCancelBookingRequest: reason string minLength 1, maxLength 500
 */
export function validateCancelReason(rawReason: string): {
  isValid: boolean
  error?: string
  trimmed: string
} {
  const trimmed = rawReason.trim()
  if (!trimmed) {
    return {
      isValid: false,
      error: "Vui lòng nhập lý do hủy booking.",
      trimmed,
    }
  }
  if (trimmed.length > 500) {
    return {
      isValid: false,
      error: "Lý do hủy không được vượt quá 500 ký tự.",
      trimmed,
    }
  }
  return {
    isValid: true,
    trimmed,
  }
}

/**
 * Parse Admin Booking API errors to clear user-friendly Vietnamese messages
 * per OpenAPI 0.5.0 error schema and error codes
 */
export function parseAdminBookingApiError(err: unknown): {
  code: string
  message: string
  requestId?: string
} {
  if (!err) {
    return { code: "unknown", message: "Đã xảy ra lỗi không xác định." }
  }

  const axiosErr = err as {
    response?: {
      status?: number
      data?: {
        error?: {
          code?: string
          message?: string
          requestId?: string
        }
      }
    }
    message?: string
  }

  const status = axiosErr.response?.status
  const errorObj = axiosErr.response?.data?.error
  const code = errorObj?.code || (status === 404 ? "not_found" : status === 409 ? "conflict" : "error")
  const requestId = errorObj?.requestId

  if (code === "cancellation_closed") {
    return {
      code,
      message:
        errorObj?.message ||
        "Không thể hủy booking: Khung giờ đã bắt đầu hoặc đã qua thời hạn được phép hủy (SRS BR-14).",
      requestId,
    }
  }

  if (code === "already_cancelled") {
    return {
      code,
      message: errorObj?.message || "Booking này đã được hủy trước đó.",
      requestId,
    }
  }

  if (code === "validation_error" || status === 400) {
    return {
      code,
      message: errorObj?.message || "Dữ liệu yêu cầu không hợp lệ. Vui lòng kiểm tra lại thông tin.",
      requestId,
    }
  }

  if (status === 404 || code === "not_found") {
    return {
      code: "not_found",
      message: errorObj?.message || "Không tìm thấy booking trong hệ thống (404 Not Found).",
      requestId,
    }
  }

  if (status === 401 || code === "unauthorized") {
    return {
      code: "unauthorized",
      message: "Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại với quyền quản trị viên.",
      requestId,
    }
  }

  if (status === 403 || code === "forbidden") {
    return {
      code: "forbidden",
      message: "Bạn không có quyền thực hiện thao tác quản trị trên booking này (Yêu cầu vai trò ADMIN).",
      requestId,
    }
  }

  return {
    code,
    message: errorObj?.message || axiosErr.message || "Không thể thực hiện thao tác. Vui lòng thử lại sau.",
    requestId,
  }
}

/**
 * Format date string YYYY-MM-DD to Vietnamese display
 */
export function formatAdminBookingDate(dateStr?: string | null): string {
  if (!dateStr) return "—"
  const [y, m, d] = dateStr.split("-").map(Number)
  if (!y || !m || !d) return dateStr

  const dateObj = new Date(y, m - 1, d)
  return dateObj.toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

/**
 * Format single time slot startsAt - endsAt (HH:mm - HH:mm)
 */
export function formatAdminTimeSlot(startsAt: string, endsAt: string): string {
  try {
    const s = new Date(startsAt)
    const e = new Date(endsAt)
    const pad = (n: number) => String(n).padStart(2, "0")
    // Use local time for user presentation
    const sH = pad(s.getHours())
    const sM = pad(s.getMinutes())
    const eH = pad(e.getHours())
    const eM = pad(e.getMinutes())
    return `${sH}:${sM} - ${eH}:${eM}`
  } catch {
    return "—"
  }
}

/**
 * Format full slot range text from list of slots
 * e.g. "08:00 - 10:00 (2 slot - 120 phút)"
 */
export function formatAdminSlotRange(slots?: AdminBookingSlotItem[]): {
  rangeText: string
  slotCount: number
  totalMinutes: number
} {
  if (!slots || slots.length === 0) {
    return { rangeText: "—", slotCount: 0, totalMinutes: 0 }
  }

  const sorted = [...slots].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  )
  const first = sorted[0]
  const last = sorted[sorted.length - 1]

  try {
    const s = new Date(first.startsAt)
    const e = new Date(last.endsAt)
    const pad = (n: number) => String(n).padStart(2, "0")
    const sH = pad(s.getHours())
    const sM = pad(s.getMinutes())
    const eH = pad(e.getHours())
    const eM = pad(e.getMinutes())

    const totalMinutes = Math.round((e.getTime() - s.getTime()) / (1000 * 60))
    const rangeText = `${sH}:${sM} - ${eH}:${eM}`

    return {
      rangeText,
      slotCount: slots.length,
      totalMinutes,
    }
  } catch {
    return { rangeText: "—", slotCount: slots.length, totalMinutes: 0 }
  }
}

/**
 * Format ISO datetime string to "HH:mm DD/MM/YYYY"
 */
export function formatAdminDateTime(isoStr?: string | null): string {
  if (!isoStr) return "—"
  try {
    const d = new Date(isoStr)
    if (isNaN(d.getTime())) return isoStr
    const pad = (n: number) => String(n).padStart(2, "0")
    const day = pad(d.getDate())
    const month = pad(d.getMonth() + 1)
    const year = d.getFullYear()
    const hours = pad(d.getHours())
    const minutes = pad(d.getMinutes())
    return `${hours}:${minutes} ${day}/${month}/${year}`
  } catch {
    return isoStr
  }
}

/**
 * Shorten a UUID for clean table presentation (e.g., 550e8400...4466)
 */
export function shortenUuid(uuid?: string | null, len: number = 8): string {
  if (!uuid) return "—"
  if (uuid.length <= len + 4) return uuid
  return `${uuid.substring(0, len)}…${uuid.substring(uuid.length - 4)}`
}
