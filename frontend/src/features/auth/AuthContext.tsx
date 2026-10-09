import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { tokenStorage } from "@/lib/auth/token"
import { authApi } from "@/lib/api/auth"
import type { User } from "@/types/auth.types"
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
   * Doc §5.1: "Bearer token trong memory phía client; logout clear token;
   * không refresh/revocation nâng cao trong MVP."
   * Both accessToken and isLoading are seeded by the lazy initialisers
   * above. This effect only performs the async network verification.
   */
  useEffect(() => {
    if (!accessToken) {
      // No valid stored token — already cleaned up in lazy init, nothing to do
      tokenStorage.clear()
      return
    }
    authApi
      .getMe()
      .then(({ data }) => setUser(data))
      .catch(() => {
        // Token invalid/expired — clear and continue as guest
        tokenStorage.clear()
        setAccessToken(null)
      })
      .finally(() => setIsLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentionally run once on mount only

  /**
   * Listen for the auth:unauthorized event dispatched by the axios
   * interceptor when any API call returns 401.
   * Doc §7.1: "401 từ protected API đưa ứng dụng về trạng thái chưa
   * xác thực theo policy đã review."
   */
  useEffect(() => {
    function handleUnauthorized() {
      setUser(null)
      setAccessToken(null)
    }
    window.addEventListener("auth:unauthorized", handleUnauthorized)
    return () => {
      window.removeEventListener("auth:unauthorized", handleUnauthorized)
    }
  }, [])

  const login = useCallback((token: string, expiresAt: string, u: User) => {
    tokenStorage.set(token, expiresAt)
    setAccessToken(token)
    setUser(u)
  }, [])

  /**
   * Logout: doc §5.1 — no server-side revocation in MVP; only clear
   * client-side token and state.
   */
  const logout = useCallback(() => {
    tokenStorage.clear()
    setAccessToken(null)
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({
      user,
      accessToken,
      isAuthenticated: !!user && !!accessToken,
      isLoading,
      login,
      logout,
    }),
    [user, accessToken, isLoading, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
