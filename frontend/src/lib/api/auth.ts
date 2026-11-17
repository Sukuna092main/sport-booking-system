import { apiClient, refreshSession } from "@/lib/api/client"
import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  User,
} from "@/types/auth.types"

/**
 * Auth API service — theo contract OpenAPI 0.3.0.
 *
 * POST  /auth/register → 201 { data: User }      (không tự đăng nhập)
 * POST  /auth/login    → 200 { data: LoginData }
 * GET   /users/me      → 200 { data: User }       (cần Bearer token)
 * PATCH /users/me      → 200 { data: User }       (cần Bearer token)
 */
export const authApi = {
  /**
   * POST /auth/register
   * 201 → { data: User }
   * 400 → validation_error
   * 409 → email_taken
   */
  register(body: RegisterRequest): Promise<RegisterResponse> {
    return apiClient
      .post<RegisterResponse>("/auth/register", body)
      .then((r) => r.data)
  },

  /**
   * POST /auth/login
   * 200 → { data: { accessToken, tokenType, expiresAt, user } }
   * 401 → invalid_credentials
   * 403 → account_inactive
   */
  login(body: LoginRequest): Promise<LoginResponse> {
    return apiClient
      .post<LoginResponse>("/auth/login", body)
      .then((r) => r.data)
  },

  refresh(): Promise<LoginResponse> {
    return refreshSession()
  },

  logout(): Promise<unknown> {
    return apiClient.post("/auth/logout").then((r) => r.data)
  },

  forgotPassword(email: string): Promise<{ data: { message: string } }> {
    return apiClient.post("/auth/forgot-password", { email }).then((r) => r.data)
  },

  resetPassword(token: string, newPassword: string): Promise<{ data: { message: string } }> {
    return apiClient.post("/auth/reset-password", { token, newPassword }).then((r) => r.data)
  },

  changePassword(currentPassword: string, newPassword: string): Promise<{ data: { message: string } }> {
    return apiClient.post("/auth/change-password", { currentPassword, newPassword }).then((r) => r.data)
  },

  /**
   * GET /users/me
   * 200 → { data: User }
   * 401 → unauthorized  (token missing/invalid/expired)
   */
  getMe(): Promise<{ data: User }> {
    return apiClient
      .get<{ data: User }>("/users/me")
      .then((r) => r.data)
  },

  /**
   * PATCH /users/me — cập nhật fullName và phone.
   * 200 → { data: User }
   * 400 → validation_error
   * 401 → unauthorized
   */
  updateMe(body: { fullName: string; phone?: string | null }): Promise<{ data: User }> {
    return apiClient
      .patch<{ data: User }>("/users/me", body)
      .then((r) => r.data)
  },
}
