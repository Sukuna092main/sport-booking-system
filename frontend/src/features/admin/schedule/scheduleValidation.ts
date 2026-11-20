import { AxiosError } from "axios"
import type { ApiErrorResponse } from "@/types/auth.types"
import type { OperatingHour, SlotPolicyPayload } from "@/types/schedule.types"

export interface WeekdayInfo {
  id: number
  name: string
  shortName: string
  english: string
}

export const WEEKDAYS: readonly WeekdayInfo[] = [
  { id: 1, name: "Thứ Hai", shortName: "T2", english: "Monday" },
  { id: 2, name: "Thứ Ba", shortName: "T3", english: "Tuesday" },
  { id: 3, name: "Thứ Tư", shortName: "T4", english: "Wednesday" },
  { id: 4, name: "Thứ Năm", shortName: "T5", english: "Thursday" },
  { id: 5, name: "Thứ Sáu", shortName: "T6", english: "Friday" },
  { id: 6, name: "Thứ Bảy", shortName: "T7", english: "Saturday" },
  { id: 7, name: "Chủ Nhật", shortName: "CN", english: "Sunday" },
] as const

export function getWeekdayName(weekday: number): string {
  const match = WEEKDAYS.find((w) => w.id === weekday)
  return match ? match.name : `Thứ ${weekday}`
}

/**
 * Standardize time string into strict HH:mm:ss format expected by backend contract.
 * Example: "08:00" -> "08:00:00", "08:00:00" -> "08:00:00"
 */
export function toHHmmss(timeStr: string): string {
  if (!timeStr) return ""
  const trimmed = timeStr.trim()
  if (/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(trimmed)) {
    return trimmed
  }
  if (/^([01]\d|2[0-3]):[0-5]\d$/.test(trimmed)) {
    return `${trimmed}:00`
  }
  return trimmed
}

/**
 * Format time string into HH:mm for standard HTML time input.
 * Example: "08:00:00" -> "08:00"
 */
export function toHHmm(timeStr: string): string {
  if (!timeStr) return ""
  const trimmed = timeStr.trim()
  const parts = trimmed.split(":")
  if (parts.length >= 2) {
    const h = parts[0].padStart(2, "0")
    const m = parts[1].padStart(2, "0")
    return `${h}:${m}`
  }
  return trimmed
}

/**
 * Parse time string to seconds since 00:00:00. Returns NaN if invalid.
 */
export function parseClockSeconds(timeStr: string): number {
  const formatted = toHHmmss(timeStr)
  if (!/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(formatted)) {
    return Number.NaN
  }
  const [h, m, s] = formatted.split(":").map(Number)
  return h * 3600 + m * 60 + s
}

export interface ScheduleValidationResult {
  isValid: boolean
  fieldErrors: Record<string, string>
  generalError?: string
}

/**
 * Validate full operating hours array on client before submitting.
 * Checks:
 * 1. Weekday 1-7
 * 2. Strict clock format HH:mm:ss
 * 3. Start time < End time (no zero intervals, no overnight)
 * 4. No overlapping intervals on the same weekday (adjacent intervals like 08:00-12:00 and 12:00-17:00 are allowed)
 */
export function validateOperatingHours(hours: OperatingHour[]): ScheduleValidationResult {
  const fieldErrors: Record<string, string> = {}

  // Group by weekday for overlap checking
  const grouped = new Map<number, OperatingHour[]>()

  for (let index = 0; index < hours.length; index++) {
    const h = hours[index]
    const prefix = `hours[${index}]`

    if (h.weekday < 1 || h.weekday > 7) {
      fieldErrors[`${prefix}.weekday`] = "Thứ phải từ 1 đến 7 (Thứ Hai đến Chủ Nhật)."
      continue
    }

    const startSec = parseClockSeconds(h.opensAt)
    const endSec = parseClockSeconds(h.closesAt)

    if (Number.isNaN(startSec)) {
      fieldErrors[`${prefix}.opensAt`] = "Giờ mở cửa không đúng định dạng (HH:mm)."
    }
    if (Number.isNaN(endSec)) {
      fieldErrors[`${prefix}.closesAt`] = "Giờ đóng cửa không đúng định dạng (HH:mm)."
    }

    if (!Number.isNaN(startSec) && !Number.isNaN(endSec)) {
      if (startSec >= endSec) {
        fieldErrors[`${prefix}.timeRange`] =
          "Giờ mở cửa phải trước giờ đóng cửa trong cùng ngày (không hỗ trợ qua đêm)."
      }
    }

    const dayHours = grouped.get(h.weekday) || []
    dayHours.push(h)
    grouped.set(h.weekday, dayHours)
  }

  // Check overlaps per weekday
  for (const [weekday, dayHours] of grouped.entries()) {
    if (dayHours.length <= 1) continue

    const sorted = [...dayHours].sort((a, b) => {
      const sa = parseClockSeconds(a.opensAt)
      const sb = parseClockSeconds(b.opensAt)
      return sa - sb
    })

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]
      const curr = sorted[i]
      const prevEnd = parseClockSeconds(prev.closesAt)
      const currStart = parseClockSeconds(curr.opensAt)

      if (!Number.isNaN(prevEnd) && !Number.isNaN(currStart) && prevEnd > currStart) {
        const weekdayName = getWeekdayName(weekday)
        fieldErrors[`weekday_${weekday}_overlap`] =
          `Khung giờ mở cửa bị trùng lặp vào ${weekdayName} (${toHHmm(prev.opensAt)}-${toHHmm(prev.closesAt)} và ${toHHmm(curr.opensAt)}-${toHHmm(curr.closesAt)}).`
      }
    }
  }

  const isValid = Object.keys(fieldErrors).length === 0
  let generalError: string | undefined
  if (!isValid) {
    generalError = "Vui lòng kiểm tra và sửa các khung giờ chưa hợp lệ hoặc bị trùng lặp."
  }

  return { isValid, fieldErrors, generalError }
}

/**
 * Validate slot duration and min/max consecutive slots.
 */
export function validateSlotPolicy(policy: SlotPolicyPayload): Record<string, string> {
  const errors: Record<string, string> = {}

  if (
    Number.isNaN(policy.slotDurationMinutes) ||
    policy.slotDurationMinutes < 1 ||
    policy.slotDurationMinutes > 32767
  ) {
    errors.slotDurationMinutes = "Thời lượng slot phải từ 1 đến 32.767 phút (thông thường 30-120 phút)."
  }

  if (Number.isNaN(policy.minConsecutiveSlots) || policy.minConsecutiveSlots < 1) {
    errors.minConsecutiveSlots = "Số slot liên tiếp tối thiểu phải là số nguyên dương (>= 1)."
  }

  if (Number.isNaN(policy.maxConsecutiveSlots) || policy.maxConsecutiveSlots < 1) {
    errors.maxConsecutiveSlots = "Số slot liên tiếp tối đa phải là số nguyên dương (>= 1)."
  } else if (policy.maxConsecutiveSlots < policy.minConsecutiveSlots) {
    errors.maxConsecutiveSlots = "Số slot liên tiếp tối đa phải lớn hơn hoặc bằng số slot tối thiểu."
  }

  return errors
}

export interface ParsedScheduleError {
  code: string
  message: string
  fieldErrors: Record<string, string>
}

/**
 * Friendly mapping for backend error responses on schedule & court operations.
 */
export function parseScheduleApiError(error: unknown): ParsedScheduleError {
  if (error instanceof AxiosError) {
    const status = error.response?.status
    const data = error.response?.data as ApiErrorResponse | undefined
    const errCode = data?.error?.code || ""
    const serverMsg = data?.error?.message || ""
    const fieldErrors: Record<string, string> = {}

    if (data?.error?.details && Array.isArray(data.error.details)) {
      for (const d of data.error.details) {
        if (d.field) {
          fieldErrors[d.field] = d.message || "Dữ liệu trường này không hợp lệ."
        }
      }
    }

    if (status === 409 || errCode === "schedule_overlap" || errCode === "conflict") {
      const message =
        serverMsg ||
        "Giờ mở cửa bị trùng lặp với lịch hiện hành hoặc xung đột với dữ liệu hiện tại."
      return { code: "schedule_overlap", message, fieldErrors }
    }

    if (status === 400 || errCode === "validation_error") {
      const detailsCount = Object.keys(fieldErrors).length
      const message =
        detailsCount > 0
          ? `Lỗi cấu hình: ${Object.values(fieldErrors).join(", ")}`
          : serverMsg || "Dữ liệu cấu hình không hợp lệ. Vui lòng kiểm tra lại."
      return { code: "validation_error", message, fieldErrors }
    }

    if (status === 404 || errCode === "not_found") {
      return {
        code: "not_found",
        message: serverMsg || "Không tìm thấy thông tin sân thể thao (404 Not Found).",
        fieldErrors,
      }
    }

    if (status === 403 || errCode === "forbidden") {
      return {
        code: "forbidden",
        message: "Bạn không có quyền thực hiện thao tác quản trị lịch sân.",
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
