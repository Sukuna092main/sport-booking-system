import axios, { type AxiosError } from "axios"
import { tokenStorage } from "@/lib/auth/token"
import type { ApiErrorResponse } from "@/types/auth.types"

const baseURL = import.meta.env.VITE_API_BASE_URL

if (!baseURL) {
  throw new Error("VITE_API_BASE_URL is not configured")
}

export const apiClient = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
})

/** Attach Bearer token to every request if available */
apiClient.interceptors.request.use((config) => {
  const token = tokenStorage.get()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

/**
 * Response interceptor:
 * - 401: clear token storage AND dispatch a custom event so AuthContext
 *   can reset its in-memory state. This covers the case where a token
 *   expires after the initial mount (e.g., during a protected API call).
 *   Per doc section 7.1: "401 từ protected API đưa ứng dụng về trạng thái
 *   chưa xác thực theo policy đã review."
 * - 403: pass through; doc says 403 means authenticated but forbidden,
 *   must NOT silently convert to 401.
 */
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorResponse>) => {
    if (error.response?.status === 401) {
      tokenStorage.clear()
      // Notify AuthContext to reset in-memory user/token state
      window.dispatchEvent(new CustomEvent("auth:unauthorized"))
    }
    return Promise.reject(error)
  },
)