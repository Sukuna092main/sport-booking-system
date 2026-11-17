import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { tokenStorage } from "@/lib/auth/token"
import { authApi } from "@/lib/api/auth"
import type { User } from "@/types/auth.types"
import { AuthContext } from "./AuthContextDef"

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    authApi.refresh()
      .then(({ data }) => {
        if (!mounted) return
        tokenStorage.set(data.accessToken)
        setAccessToken(data.accessToken)
        setUser(data.user)
      })
      .catch(() => {
        tokenStorage.clear()
        if (mounted) {
          setAccessToken(null)
          setUser(null)
        }
      })
      .finally(() => { if (mounted) setIsLoading(false) })
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    function handleUnauthorized() {
      tokenStorage.clear()
      setUser(null)
      setAccessToken(null)
    }
    window.addEventListener("auth:unauthorized", handleUnauthorized)
    return () => window.removeEventListener("auth:unauthorized", handleUnauthorized)
  }, [])

  const login = useCallback((token: string, _expiresAt: string, currentUser: User) => {
    tokenStorage.set(token)
    setAccessToken(token)
    setUser(currentUser)
  }, [])

  const logout = useCallback(() => {
    void authApi.logout().catch(() => undefined)
    tokenStorage.clear()
    setAccessToken(null)
    setUser(null)
  }, [])

  const value = useMemo(() => ({
    user,
    accessToken,
    isAuthenticated: Boolean(user && accessToken),
    isLoading,
    login,
    logout,
  }), [user, accessToken, isLoading, login, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
