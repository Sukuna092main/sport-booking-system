import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { tokenStorage } from "@/lib/auth/token"
import { authApi } from "@/lib/api/auth"
import type { LoginData, User } from "@/types/auth.types"
import { AuthContext } from "./AuthContextDef"

/* ------------------------------------------------------------------ */
/*  Provider                                                             */
/* ------------------------------------------------------------------ */

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)

  /**
   * Lazy-initialise accessToken from storage so we never call setState
   * synchronously inside an effect (react-hooks/set-state-in-effect).
   */
  const [accessToken, setAccessToken] = useState<string | null>(() => {
    const stored = tokenStorage.get()
    return stored && !tokenStorage.isExpired() ? stored : null
  })

  /**
   * Lazy-initialise isLoading: only true when there IS a stored token
   * that needs to be verified via the network. If no token exists we are
   * already done loading, so we start as false to avoid a synchronous
   * setIsLoading(false) call inside the effect.
   */
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    const stored = tokenStorage.get()
    return !!(stored && !tokenStorage.isExpired())
  })

  /**
   * Re-hydrate session from localStorage on mount.
   */
  useEffect(() => {
    if (!accessToken) {
      tokenStorage.clear()
      return
    }
    authApi
      .getMe()
      .then(({ data }) => setUser(data))
      .catch(() => {
        tokenStorage.clear()
        setAccessToken(null)
      })
      .finally(() => setIsLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentionally run once on mount only

  /**
   * Listen for auth events dispatched by apiClient interceptor:
   * - auth:unauthorized: reset user & token state
   * - auth:token-refreshed: update token & user state with new session
   */
  useEffect(() => {
    function handleUnauthorized() {
      setUser(null)
      setAccessToken(null)
    }

    function handleTokenRefreshed(e: Event) {
      const customEvent = e as CustomEvent<LoginData>
      if (customEvent.detail) {
        setAccessToken(customEvent.detail.accessToken)
        if (customEvent.detail.user) {
          setUser(customEvent.detail.user)
        }
      }
    }

    window.addEventListener("auth:unauthorized", handleUnauthorized)
    window.addEventListener("auth:token-refreshed", handleTokenRefreshed)
    return () => {
      window.removeEventListener("auth:unauthorized", handleUnauthorized)
      window.removeEventListener("auth:token-refreshed", handleTokenRefreshed)
    }
  }, [])

  const login = useCallback((token: string, expiresAt: string, u: User) => {
    tokenStorage.set(token, expiresAt)
    setAccessToken(token)
    setUser(u)
  }, [])

  /**
   * Logout: call backend /auth/logout to revoke refresh session & cookie,
   * then clear client-side token and state.
   */
  const logout = useCallback(() => {
    authApi.logout().catch(() => {})
    tokenStorage.clear()
    setAccessToken(null)
    setUser(null)
  }, [])

  /**
   * Logout all devices: revoke all active sessions on backend,
   * then clear client-side token and state.
   */
  const logoutAll = useCallback(async () => {
    try {
      await authApi.logoutAll()
    } finally {
      tokenStorage.clear()
      setAccessToken(null)
      setUser(null)
    }
  }, [])

  const value = useMemo(
    () => ({
      user,
      accessToken,
      isAuthenticated: !!user && !!accessToken,
      isLoading,
      login,
      logout,
      logoutAll,
    }),
    [user, accessToken, isLoading, login, logout, logoutAll],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
