/**
 * Token storage helpers.
 * Dùng localStorage; key cố định để các module khác không tự đặt key.
 */

const TOKEN_KEY = "sb_access_token"
const EXPIRES_KEY = "sb_token_expires_at"

export const tokenStorage = {
  get(): string | null {
    return localStorage.getItem(TOKEN_KEY)
  },

  set(token: string, expiresAt?: string): void {
    localStorage.setItem(TOKEN_KEY, token)
    if (expiresAt) {
      localStorage.setItem(EXPIRES_KEY, expiresAt)
    }
  },

  clear(): void {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(EXPIRES_KEY)
  },

  isExpired(): boolean {
    const expiresAt = localStorage.getItem(EXPIRES_KEY)
    if (!expiresAt) return false
    return new Date(expiresAt) <= new Date()
  },
}
