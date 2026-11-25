import { createContext } from "react"
import type { User } from "@/types/auth.types"

/* ------------------------------------------------------------------ */
/*  Context shape                                                        */
/* ------------------------------------------------------------------ */

export interface AuthContextValue {
  user: User | null
  accessToken: string | null
  isAuthenticated: boolean
  /** True while re-hydrating token from storage on mount */
  isLoading: boolean
  /** Called after successful login — persists token + user */
  login(token: string, expiresAt: string, user: User): void
  /** Revokes current session and clears client state */
  logout(): void
  /** Revokes all sessions on all devices and clears client state */
  logoutAll(): Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
