import type { BookingItem, BookingSlotItem } from "./types"

export type CancellationEligibilityCode =
  | "OK"
  | "NOT_OWNER"
  | "ALREADY_CANCELLED"
  | "PAST_START_TIME"
  | "NO_SLOTS"

export interface CancellationEligibilityResult {
  canCancel: boolean
  code: CancellationEligibilityCode
  message: string
}

/**
 * Check if a booking is eligible for cancellation per SRS BR-14 & OpenAPI contract:
 * 1. User ownership: booking.customerId must match userId (if both are present).
 * 2. Status: booking.status must be "CONFIRMED".
 * 3. Slots: must have at least 1 slot.
 * 4. Timing: current timestamp must be strictly before the start time of the first slot.
 */
export function checkBookingCancellationEligibility(
  booking: Pick<BookingItem, "status"> & {
    slots?: BookingSlotItem[]
    customerId?: string
  },
  userId?: string,
  nowTimestamp: number = Date.now()
): CancellationEligibilityResult {
  // 1. Ownership check (if both userId and customerId exist)
  if (userId && booking.customerId && booking.customerId !== userId) {
    return {
      canCancel: false,
      code: "NOT_OWNER",
      message: "Bạn không có quyền thao tác trên booking không thuộc sở hữu của mình.",
    }
  }

  // 2. Status check
  if (booking.status === "CANCELLED") {
    return {
      canCancel: false,
      code: "ALREADY_CANCELLED",
      message: "Booking này đã bị hủy trước đó.",
    }
  }

  // 3. Slots check
  const slots = booking.slots ?? []
  if (slots.length === 0) {
    return {
      canCancel: false,
      code: "NO_SLOTS",
      message: "Không có thông tin khung giờ để xác thực.",
    }
  }

  // 4. Timing check — first slot start time vs current time
  const sorted = [...slots].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
  )
  const firstSlotStart = new Date(sorted[0].startsAt).getTime()

  if (firstSlotStart <= nowTimestamp) {
    return {
      canCancel: false,
      code: "PAST_START_TIME",
      message: "Không thể hủy booking sau thời điểm bắt đầu slot đầu tiên (SRS BR-14).",
    }
  }

  return {
    canCancel: true,
    code: "OK",
    message: "Booking đủ điều kiện hủy theo quy định.",
  }
}

/**
 * Parse cancellation API errors and map to clear user-facing messages
 * per OpenAPI contract (409 cancellation_closed, already_cancelled, 404 not_found, etc.)
 */
export function parseCancelError(err: unknown): { code: string; message: string } {
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

  if (code === "cancellation_closed") {
    return {
      code,
      message:
        errorObj?.message ||
        "Không thể hủy booking: Khung giờ đã bắt đầu hoặc đã qua thời hạn được phép hủy (SRS BR-14).",
    }
  }

  if (code === "already_cancelled") {
    return {
      code,
      message: errorObj?.message || "Booking này đã được hủy trước đó.",
    }
  }

  if (status === 404 || code === "not_found") {
    return {
      code: "not_found",
      message:
        errorObj?.message ||
        "Booking không tồn tại hoặc bạn không có quyền thao tác trên booking này (404 Not Found).",
    }
  }

  if (status === 401 || code === "unauthorized") {
    return {
      code: "unauthorized",
      message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
    }
  }

  if (status === 403 || code === "forbidden") {
    return {
      code: "forbidden",
      message: "Bạn không có quyền thực hiện thao tác hủy này.",
    }
  }

  return {
    code,
    message: errorObj?.message || axiosErr.message || "Không thể hủy booking. Vui lòng thử lại sau.",
  }
}

/** Format date string YYYY-MM-DD into Vietnamese localized display */
export function formatBookingDateDisplay(dateStr?: string | null): string {
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
