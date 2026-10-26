import { AxiosError } from "axios"
import type { ApiErrorResponse } from "@/types/auth.types"
import type { Blackout } from "@/types/blackout.types"

export interface BlackoutFormState {
  /** Local datetime string for HTML input (YYYY-MM-DDTHH:mm) */
  startsAt: string
  /** Local datetime string for HTML input (YYYY-MM-DDTHH:mm) */
  endsAt: string
  reason: string
  isActive?: boolean
}

export interface BlackoutValidationResult {
  isValid: boolean
  fieldErrors: Record<string, string>
  generalError?: string
}

export interface OverlapCheckResult {
  hasOverlap: boolean
  overlappingBlackouts: Blackout[]
}

/**
 * Convert Date or ISO-8601 UTC string to HTML datetime-local input string: "YYYY-MM-DDTHH:mm"
 */
export function toLocalDatetimeInput(dateOrIso: Date | string): string {
  const d = typeof dateOrIso === "string" ? new Date(dateOrIso) : dateOrIso
  if (Number.isNaN(d.getTime())) return ""

  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  const hours = String(d.getHours()).padStart(2, "0")
  const minutes = String(d.getMinutes()).padStart(2, "0")

  return `${year}-${month}-${day}T${hours}:${minutes}`
}

/**
 * Convert HTML datetime-local input string ("YYYY-MM-DDTHH:mm") to ISO-8601 UTC string.
 * Returns empty string if invalid.
 */
export function toUtcIsoString(localDatetimeStr: string): string {
  if (!localDatetimeStr) return ""
  const d = new Date(localDatetimeStr)
  if (Number.isNaN(d.getTime())) return ""
  return d.toISOString()
}

/**
 * Format ISO datetime for Vietnamese display (e.g. "08:00, 25/10/2026")
 */
export function formatBlackoutDateTime(isoString: string): string {
  if (!isoString) return "—"
  const d = new Date(isoString)
  if (Number.isNaN(d.getTime())) return isoString

  const time = d.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
  const date = d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })

  return `${time}, ${date}`
}

/**
 * Format duration between two timestamps in human-readable Vietnamese text.
 */
export function formatBlackoutDuration(startsAtIso: string, endsAtIso: string): string {
  const start = new Date(startsAtIso).getTime()
  const end = new Date(endsAtIso).getTime()
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
    return "0 phút"
  }

  const diffMinutes = Math.round((end - start) / (1000 * 60))
  if (diffMinutes < 60) {
    return `${diffMinutes} phút`
  }

  const hours = Math.floor(diffMinutes / 60)
  const remainingMinutes = diffMinutes % 60

  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    const remainingHours = hours % 24
    if (remainingHours === 0 && remainingMinutes === 0) {
      return `${days} ngày`
    }
    return `${days} ngày ${remainingHours}h ${remainingMinutes > 0 ? `${remainingMinutes}p` : ""}`.trim()
  }

  if (remainingMinutes === 0) {
    return `${hours} giờ`
  }
  return `${hours} giờ ${remainingMinutes} phút`
}

/**
 * Validate Blackout form inputs:
 * 1. startsAt and endsAt must be provided and valid
 * 2. Range rule: startsAt < endsAt (strict order)
 * 3. Reason: optional, max 500 chars, no NUL character
 */
export function validateBlackoutForm(form: BlackoutFormState): BlackoutValidationResult {
  const fieldErrors: Record<string, string> = {}

  if (!form.startsAt || !form.startsAt.trim()) {
    fieldErrors.startsAt = "Vui lòng chọn thời điểm bắt đầu chặn."
  }

  if (!form.endsAt || !form.endsAt.trim()) {
    fieldErrors.endsAt = "Vui lòng chọn thời điểm kết thúc chặn."
  }

  if (form.startsAt && form.endsAt) {
    const startMs = new Date(form.startsAt).getTime()
    const endMs = new Date(form.endsAt).getTime()

    if (Number.isNaN(startMs)) {
      fieldErrors.startsAt = "Thời điểm bắt đầu không hợp lệ."
    }
    if (Number.isNaN(endMs)) {
      fieldErrors.endsAt = "Thời điểm kết thúc không hợp lệ."
    }

    if (!Number.isNaN(startMs) && !Number.isNaN(endMs)) {
      if (endMs <= startMs) {
        // Exact wording matching backend validation: "Thời điểm kết thúc phải sau thời điểm bắt đầu."
        fieldErrors.endsAt = "Thời điểm kết thúc phải sau thời điểm bắt đầu."
      }
    }
  }

  // Reason checks
  if (form.reason) {
    if (form.reason.includes("\u0000")) {
      fieldErrors.reason = "Lý do chứa ký tự không hợp lệ."
    } else if (form.reason.length > 500) {
      fieldErrors.reason = "Lý do không được vượt quá 500 ký tự."
    }
  }

  const isValid = Object.keys(fieldErrors).length === 0
  let generalError: string | undefined
  if (!isValid) {
    generalError =
      fieldErrors.endsAt ||
      fieldErrors.startsAt ||
      fieldErrors.reason ||
      "Dữ liệu lịch chặn chưa hợp lệ. Vui lòng kiểm tra lại."
  }

  return { isValid, fieldErrors, generalError }
}

/**
 * Check if the given interval [startsAt, endsAt) overlaps with any existing active blackout.
 *
 * Interval overlap rule: max(startA, startB) < min(endA, endB)
 * i.e.: startA < endB && endA > startB
 *
 * Note: Per backend contract and review, blackouts can overlap in DB without conflict error;
 * however, detecting and displaying overlap to admin ensures transparency and clear awareness.
 */
export function checkBlackoutOverlap(
  target: { startsAt: string; endsAt: string; id?: string },
  blackouts: Blackout[],
): OverlapCheckResult {
  const startMs = new Date(target.startsAt).getTime()
  const endMs = new Date(target.endsAt).getTime()

  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
    return { hasOverlap: false, overlappingBlackouts: [] }
  }

  const overlapping = blackouts.filter((b) => {
    // Only check against active blackouts
    if (!b.isActive) return false
    // Skip self if editing
    if (target.id && b.id === target.id) return false

    const bStart = new Date(b.startsAt).getTime()
    const bEnd = new Date(b.endsAt).getTime()

    if (Number.isNaN(bStart) || Number.isNaN(bEnd)) return false

    // Overlap condition: startA < endB && endA > startB
    return startMs < bEnd && endMs > bStart
  })

  return {
    hasOverlap: overlapping.length > 0,
    overlappingBlackouts: overlapping,
  }
}

/**
 * Quick preset helpers for admin form convenience.
 */
export type BlackoutPresetKey =
  | "plus_1h"
  | "plus_2h"
  | "today_rest"
  | "tomorrow_morning"
  | "tomorrow_afternoon"
  | "tomorrow_full"

export function getBlackoutPreset(preset: BlackoutPresetKey): { startsAt: string; endsAt: string } {
  const now = new Date()

  switch (preset) {
    case "plus_1h": {
      const start = new Date(now)
      start.setMinutes(Math.ceil(start.getMinutes() / 15) * 15, 0, 0)
      const end = new Date(start.getTime() + 60 * 60 * 1000)
      return {
        startsAt: toLocalDatetimeInput(start),
        endsAt: toLocalDatetimeInput(end),
      }
    }
    case "plus_2h": {
      const start = new Date(now)
      start.setMinutes(Math.ceil(start.getMinutes() / 15) * 15, 0, 0)
      const end = new Date(start.getTime() + 120 * 60 * 1000)
      return {
        startsAt: toLocalDatetimeInput(start),
        endsAt: toLocalDatetimeInput(end),
      }
    }
    case "today_rest": {
      const start = new Date(now)
      start.setMinutes(Math.ceil(start.getMinutes() / 15) * 15, 0, 0)
      const end = new Date(now)
      end.setHours(23, 59, 0, 0)
      return {
        startsAt: toLocalDatetimeInput(start),
        endsAt: toLocalDatetimeInput(end),
      }
    }
    case "tomorrow_morning": {
      const start = new Date(now)
      start.setDate(start.getDate() + 1)
      start.setHours(8, 0, 0, 0)
      const end = new Date(start)
      end.setHours(12, 0, 0, 0)
      return {
        startsAt: toLocalDatetimeInput(start),
        endsAt: toLocalDatetimeInput(end),
      }
    }
    case "tomorrow_afternoon": {
      const start = new Date(now)
      start.setDate(start.getDate() + 1)
      start.setHours(13, 0, 0, 0)
      const end = new Date(start)
      end.setHours(18, 0, 0, 0)
      return {
        startsAt: toLocalDatetimeInput(start),
        endsAt: toLocalDatetimeInput(end),
      }
    }
    case "tomorrow_full": {
      const start = new Date(now)
      start.setDate(start.getDate() + 1)
      start.setHours(6, 0, 0, 0)
      const end = new Date(start)
      end.setHours(23, 0, 0, 0)
      return {
        startsAt: toLocalDatetimeInput(start),
        endsAt: toLocalDatetimeInput(end),
      }
    }
  }
}

export interface ParsedBlackoutError {
  code: string
  message: string
  fieldErrors: Record<string, string>
}

/**
 * Friendly mapping for backend error responses on Blackout operations.
 */
export function parseBlackoutApiError(error: unknown): ParsedBlackoutError {
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

    if (status === 409 || errCode === "conflict" || errCode === "schedule_overlap") {
      const message =
        serverMsg || "Xung đột lịch chặn với dữ liệu hiện hành trên hệ thống."
      return { code: "conflict", message, fieldErrors }
    }

    if (status === 400 || errCode === "validation_error") {
      const detailsCount = Object.keys(fieldErrors).length
      const message =
        detailsCount > 0
          ? `Lỗi dữ liệu: ${Object.values(fieldErrors).join(", ")}`
          : serverMsg || "Thời điểm kết thúc phải sau thời điểm bắt đầu."
      return { code: "validation_error", message, fieldErrors }
    }

    if (status === 404 || errCode === "not_found") {
      return {
        code: "not_found",
        message: serverMsg || "Không tìm thấy thông tin sân hoặc lịch chặn (404 Not Found).",
        fieldErrors,
      }
    }

    if (status === 403 || errCode === "forbidden") {
      return {
        code: "forbidden",
        message: "Bạn không có quyền thực hiện thao tác quản trị Blackout.",
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
    message:
      error instanceof Error
        ? error.message
        : "Đã xảy ra lỗi không xác định. Vui lòng thử lại.",
    fieldErrors: {},
  }
}
