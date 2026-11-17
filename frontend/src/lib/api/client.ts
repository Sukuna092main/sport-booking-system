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
  headers: { "Content-Type": "application/json" },
})

type RetryableRequest = InternalAxiosRequestConfig & { __authRetry?: boolean }
let refreshFlight: Promise<LoginResponse> | null = null

export function refreshSession(): Promise<LoginResponse> {
  if (!refreshFlight) {
    const refresh = () => axios
      .post<LoginResponse>(`${baseURL}/auth/refresh`, {}, { withCredentials: true })
      .then((response) => response.data)
    const locks = typeof navigator === "undefined"
      ? undefined
      : (navigator as Navigator & { locks?: { request<T>(name: string, callback: () => Promise<T>): Promise<T> } }).locks
    const request = locks
      ? locks.request("sport-booking-refresh-session", refresh)
      : refresh()
    refreshFlight = request.finally(() => { refreshFlight = null })
  }
  return refreshFlight
}

apiClient.interceptors.request.use((config) => {
  const token = tokenStorage.get()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorResponse>) => {
    const request = error.config as RetryableRequest | undefined
    const path = request?.url ?? ""
    const publicAuthCall = /\/auth\/(login|register|refresh|forgot-password|reset-password)$/.test(path)
    if (error.response?.status !== 401 || !request || request.__authRetry || publicAuthCall) {
      return Promise.reject(error)
    }

    request.__authRetry = true
    try {
      const session = await refreshSession()
      const token = session.data.accessToken
      tokenStorage.set(token)
      request.headers.Authorization = `Bearer ${token}`
      return apiClient(request)
    } catch {
      tokenStorage.clear()
      window.dispatchEvent(new CustomEvent("auth:unauthorized"))
      return Promise.reject(error)
    }
  },
)
