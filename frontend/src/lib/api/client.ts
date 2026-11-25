import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios"
import { tokenStorage } from "@/lib/auth/token"
import type { ApiErrorResponse, LoginResponse } from "@/types/auth.types"

const baseURL = import.meta.env.VITE_API_BASE_URL

if (!baseURL) {
  throw new Error("VITE_API_BASE_URL is not configured")
}

export const apiClient = axios.create({
  baseURL,
  withCredentials: true,
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

// Concurrency mutex / queue for token refresh
let isRefreshing = false
let failedQueue: Array<{
  resolve: (token: string) => void
  reject: (error: unknown) => void
}> = []

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else if (token) {
      prom.resolve(token)
    }
  })
  failedQueue = []
}

/**
 * Response interceptor:
 * - 401 on protected requests: Attempt to refresh accessToken via POST /auth/refresh
 *   using HttpOnly cookie sb_refresh_token (withCredentials: true).
 *   If refresh succeeds, replay original request and queued requests with new token.
 *   If refresh fails, clear tokenStorage and dispatch auth:unauthorized.
 * - 403: pass through (authenticated but forbidden).
 */
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorResponse>) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined

    if (!originalRequest) {
      return Promise.reject(error)
    }

    const url = originalRequest.url ?? ""
    const isAuthRoute =
      url.includes("/auth/login") ||
      url.includes("/auth/refresh") ||
      url.includes("/auth/register") ||
      url.includes("/auth/forgot-password") ||
      url.includes("/auth/reset-password")

    // If not a 401, or already retried, or is an unauthenticated auth route: pass through error
    if (error.response?.status !== 401 || originalRequest._retry || isAuthRoute) {
      if (error.response?.status === 401 && !isAuthRoute) {
        tokenStorage.clear()
        window.dispatchEvent(new CustomEvent("auth:unauthorized"))
      }
      return Promise.reject(error)
    }

    // If a refresh is already in progress, enqueue this request
    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject })
      })
        .then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`
          return apiClient(originalRequest)
        })
        .catch((err) => Promise.reject(err))
    }

    originalRequest._retry = true
    isRefreshing = true

    try {
      // Call refresh endpoint with withCredentials: true to send sb_refresh_token cookie
      const res = await axios.post<LoginResponse>(
        `${baseURL}/auth/refresh`,
        {},
        {
          withCredentials: true,
          headers: {
            "Content-Type": "application/json",
          },
        },
      )

      const newAccessToken = res.data.data.accessToken
      tokenStorage.set(newAccessToken, res.data.data.expiresAt)

      // Notify AuthContext about the refreshed token and user
      window.dispatchEvent(
        new CustomEvent("auth:token-refreshed", {
          detail: res.data.data,
        }),
      )

      processQueue(null, newAccessToken)
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
      return apiClient(originalRequest)
    } catch (refreshErr) {
      processQueue(refreshErr, null)
      tokenStorage.clear()
      window.dispatchEvent(new CustomEvent("auth:unauthorized"))
      return Promise.reject(refreshErr)
    } finally {
      isRefreshing = false
    }
  },
)
