import { useMutation } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { authApi } from "@/lib/api/auth"
import type { RegisterRequest } from "@/types/auth.types"

/**
 * useRegister — wraps POST /auth/register.
 * On success: redirect to /login (API does NOT auto-login per contract).
 */
export function useRegister() {
  const navigate = useNavigate()

  return useMutation({
    mutationFn: (body: RegisterRequest) => authApi.register(body),
    onSuccess: () => {
      // Contract: register returns 201 + UserResponse, does NOT return token.
      // Redirect to login so the user authenticates.
      navigate("/login?registered=1", { replace: true })
    },
  })
}
