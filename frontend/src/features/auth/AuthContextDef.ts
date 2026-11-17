import { createContext } from "react"
import type { User } from "@/types/auth.types"

/* ------------------------------------------------------------------ */
/*  Context shape                                                        */
/* ------------------------------------------------------------------ */

export interface AuthContextValue {
  user: User | null
  accessToken: string | null
  isAuthenticated: boolean
  /** True while restoring an HttpOnly-cookie session on mount */
  isLoading: boolean
  /** Called after successful login — keeps only the short-lived token in memory */
  login(token: string, expiresAt: string, user: User): void
  /** Revokes the current refresh session and clears client state */
  logout(): void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
