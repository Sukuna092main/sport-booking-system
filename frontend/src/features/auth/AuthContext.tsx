import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { tokenStorage } from "@/lib/auth/token"
import { authApi } from "@/lib/api/auth"
import type { User } from "@/types/auth.types"

/* ------------------------------------------------------------------ */
/*  Context shape                                                        */
/* ------------------------------------------------------------------ */

interface AuthContextValue {
  user: User | null
  accessToken: string | null
  isAuthenticated: boolean
  /** True while re-hydrating token from storage on mount */
  isLoading: boolean
  /** Called after successful login — persists token + user */
  login(token: string, expiresAt: string, user: User): void
  /** Clears token + user; per contract logout only clears client-side */
  logout(): void
}

const AuthContext = createContext<AuthContextValue | null>(null)

/* ------------------------------------------------------------------ */
/*  Provider                                                             */
/* ------------------------------------------------------------------ */

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  /**
   * Re-hydrate session from localStorage on mount.
   * Doc §5.1: "Bearer token trong memory phía client; logout clear token;
   * không refresh/revocation nâng cao trong MVP."
   * On mount we verify the stored token via GET /users/me so stale or
   * expired tokens are cleared immediately.
   */
  useEffect(() => {
    const stored = tokenStorage.get()
    if (stored && !tokenStorage.isExpired()) {
      setAccessToken(stored)
      authApi
        .getMe()
        .then(({ data }) => setUser(data))
        .catch(() => {
          // Token invalid/expired — clear and continue as guest
          tokenStorage.clear()
          setAccessToken(null)
        })
        .finally(() => setIsLoading(false))
    } else {
      tokenStorage.clear()
      setIsLoading(false)
    }
  }, [])

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

  const value = useMemo<AuthContextValue>(
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

/* ------------------------------------------------------------------ */
/*  Hook                                                                 */
/* ------------------------------------------------------------------ */

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>")
  }
  return ctx
}
