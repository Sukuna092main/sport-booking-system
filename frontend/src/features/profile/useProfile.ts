import { useQuery } from "@tanstack/react-query"
import { authApi } from "@/lib/api/auth"

/* ------------------------------------------------------------------ */
/*  Query key                                                            */
/* ------------------------------------------------------------------ */

export const profileQueryKey = ["profile", "me"] as const

/* ------------------------------------------------------------------ */
/*  Hook                                                                 */
/* ------------------------------------------------------------------ */

/**
 * useProfile — GET /users/me.
 * Fetches the authenticated user's profile from the real API.
 * Throws on 401/403; the axios interceptor handles global 401 logout.
 */
export function useProfile() {
  return useQuery({
    queryKey: profileQueryKey,
    queryFn: () => authApi.getMe().then((r) => r.data),
    // Don't retry on 401/403 — user needs to re-authenticate
    retry: (failureCount, error) => {
      const status = (error as { response?: { status: number } })?.response?.status
      if (status === 401 || status === 403) return false
      return failureCount < 2
    },
    staleTime: 1000 * 30, // 30 s — profile rarely changes mid-session
  })
}
