import { useMutation } from "@tanstack/react-query"
import { useNavigate, useLocation } from "react-router-dom"
import { authApi } from "@/lib/api/auth"
import { useAuth } from "@/features/auth/useAuth"
import type { LoginRequest } from "@/types/auth.types"

/**
 * useLogin — wraps POST /auth/login.
 * On success: keeps token+user in the AuthContext, then
 * navigates to location.state.from (set by ProtectedRoute) or /profile.
 */
export function useLogin() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const requestedFrom = (location.state as { from?: string } | null)?.from
  const from = requestedFrom && new URL(requestedFrom, window.location.origin).origin === window.location.origin
    ? requestedFrom
    : "/profile"

  return useMutation({
    mutationFn: (body: LoginRequest) => authApi.login(body),
    onSuccess: (res) => {
      const { accessToken, expiresAt, user } = res.data
      login(accessToken, expiresAt, user)
      navigate(from, { replace: true })
    },
  })
}

/**
 * Utility — extract a user-facing message from an Axios-wrapped API error.
 */
export { getApiErrorMessage } from "./errorUtils"
