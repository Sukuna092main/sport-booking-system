/**
 * Auth domain types — theo OpenAPI 0.3.0 contract
 */

export type UserRole = "USER" | "ADMIN"
export type UserStatus = "ACTIVE" | "INACTIVE"

/** Schema: User */
export interface User {
  id: string
  email: string
  fullName: string
  phone: string | null
  role: UserRole
  status: UserStatus
  createdAt: string
  updatedAt: string
}

/** POST /auth/register — request body */
export interface RegisterRequest {
  email: string
  password: string
  fullName: string
  phone?: string | null
}

/** POST /auth/register — response: { data: User } */
export interface RegisterResponse {
  data: User
}

/** POST /auth/login — request body */
export interface LoginRequest {
  email: string
  password: string
}

/** POST /auth/login — response: { data: { accessToken, tokenType, expiresAt, user } } */
export interface LoginData {
  accessToken: string
  tokenType: "Bearer"
  expiresAt: string
  user: User
}

export interface LoginResponse {
  data: LoginData
}

/** API error envelope */
export interface ApiErrorDetail {
  field: string
  message: string
}

export interface ApiError {
  code: string
  message: string
  requestId: string
  details?: ApiErrorDetail[]
}

export interface ApiErrorResponse {
  error: ApiError
}

/** Auth state held in context */
export interface AuthState {
  user: User | null
  accessToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
}
