import { apiClient } from "@/lib/api/client"
import type {
  AuthMessageResponse,
  ChangePasswordRequest,
  ChangePasswordResponse,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  ResetPasswordRequest,
  ResetPasswordResponse,
  User,
} from "@/types/auth.types"

/**
 * Auth API service — theo contract OpenAPI & Backend Auth Router
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

  /**
   * POST /auth/refresh
   * 200 → { data: { accessToken, tokenType, expiresAt, user } }
   * 401 → unauthorized
   */
  refresh(): Promise<LoginResponse> {
    return apiClient
      .post<LoginResponse>("/auth/refresh", {})
      .then((r) => r.data)
  },

  /**
   * POST /auth/logout
   * 200 → { data: { message: "Đã đăng xuất." } }
   */
  logout(): Promise<AuthMessageResponse> {
    return apiClient
      .post<AuthMessageResponse>("/auth/logout", {})
      .then((r) => r.data)
  },

  /**
   * POST /auth/logout-all
   * 200 → { data: { message: "Đã đăng xuất khỏi mọi thiết bị." } }
   */
  logoutAll(): Promise<AuthMessageResponse> {
    return apiClient
      .post<AuthMessageResponse>("/auth/logout-all", {})
      .then((r) => r.data)
  },

  /**
   * POST /auth/forgot-password
   * 202 → { data: { message: "..." } }
   */
  forgotPassword(body: ForgotPasswordRequest): Promise<ForgotPasswordResponse> {
    return apiClient
      .post<ForgotPasswordResponse>("/auth/forgot-password", body)
      .then((r) => r.data)
  },

  /**
   * POST /auth/reset-password
   * 200 → { data: { message: "..." } }
   */
  resetPassword(body: ResetPasswordRequest): Promise<ResetPasswordResponse> {
    return apiClient
      .post<ResetPasswordResponse>("/auth/reset-password", body)
      .then((r) => r.data)
  },

  /**
   * POST /auth/change-password
   * 200 → { data: { message: "..." } }
   */
  changePassword(body: ChangePasswordRequest): Promise<ChangePasswordResponse> {
    return apiClient
      .post<ChangePasswordResponse>("/auth/change-password", body)
      .then((r) => r.data)
  },

  /**
   * GET /users/me
   * 200 → { data: User }
   * 401 → unauthorized
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
