import { AxiosError } from "axios"
import type { ApiErrorResponse } from "@/types/auth.types"

/**
 * Extract a user-facing error message from any Axios API error.
 */
export function getApiErrorMessage(
  error: unknown,
  fallback = "Đã xảy ra lỗi. Vui lòng thử lại.",
): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as ApiErrorResponse | undefined
    if (data?.error?.message) return data.error.message
    if (data?.error?.details?.length) {
      return data.error.details.map((d) => d.message).join("; ")
    }
  }
  return fallback
}
