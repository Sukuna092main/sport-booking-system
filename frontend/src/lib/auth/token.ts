// Access tokens stay in memory. The refresh credential is an HttpOnly cookie
// owned and rotated by the API, so JavaScript never reads or persists it.
let accessToken: string | null = null
let expiresAt: string | null = null

export const tokenStorage = {
  get(): string | null {
    return accessToken
  },

  set(token: string, expiration?: string): void {
    accessToken = token
    expiresAt = expiration ?? null
  },

  clear(): void {
    accessToken = null
    expiresAt = null
  },

  isExpired(): boolean {
    return expiresAt !== null && new Date(expiresAt).getTime() <= Date.now()
  },
}
