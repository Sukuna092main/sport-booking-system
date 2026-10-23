import { useQuery } from "@tanstack/react-query"
import { courtsApi } from "@/lib/api/courts"
import type { CourtsQueryParams } from "@/types/court.types"

/* ------------------------------------------------------------------ */
/*  Query keys                                                           */
/* ------------------------------------------------------------------ */

export const sportTypesQueryKey = ["sport-types"] as const
export const courtsQueryKey = (params?: CourtsQueryParams) =>
  ["courts", "list", params] as const
export const courtDetailQueryKey = (courtId: string) =>
  ["courts", "detail", courtId] as const
export const courtAvailabilityQueryKey = (courtId: string, date: string) =>
  ["courts", "availability", courtId, date] as const

/* ------------------------------------------------------------------ */
/*  Hooks                                                                */
/* ------------------------------------------------------------------ */

/**
 * useSportTypes — GET /sport-types.
 * Returns all active sport types for filter UI.
 */
export function useSportTypes() {
  return useQuery({
    queryKey: sportTypesQueryKey,
    queryFn: () => courtsApi.listSportTypes().then((r) => r.data),
    staleTime: 1000 * 60 * 5, // 5 min — sport types rarely change
  })
}

/**
 * useCourts — GET /courts?q=&sportTypeId=&page=&pageSize=.
 * Returns paginated list of active courts.
 */
export function useCourts(params?: CourtsQueryParams) {
  return useQuery({
    queryKey: courtsQueryKey(params),
    queryFn: () => courtsApi.listCourts(params),
    staleTime: 1000 * 30, // 30 s
  })
}

/**
 * useCourtById — GET /courts/{courtId}.
 * Returns a single court's details.
 */
export function useCourtById(courtId: string) {
  return useQuery({
    queryKey: courtDetailQueryKey(courtId),
    queryFn: () => courtsApi.getCourt(courtId).then((r) => r.data),
    staleTime: 1000 * 60, // 1 min
    enabled: !!courtId,
    retry: (failureCount, error) => {
      const status = (error as { response?: { status: number } })?.response?.status
      if (status === 404) return false
      return failureCount < 2
    },
  })
}

/**
 * useCourtAvailability — GET /courts/{courtId}/availability?date=YYYY-MM-DD.
 * Returns slot availability for the given court and date.
 */
export function useCourtAvailability(courtId: string, date: string) {
  return useQuery({
    queryKey: courtAvailabilityQueryKey(courtId, date),
    queryFn: () => courtsApi.getAvailability(courtId, date).then((r) => r.data),
    staleTime: 1000 * 30, // 30 s — availability changes frequently
    refetchInterval: 1000 * 30,
    enabled: !!courtId && !!date,
    retry: (failureCount, error) => {
      const status = (error as { response?: { status: number } })?.response?.status
      if (status === 400 || status === 404) return false
      return failureCount < 2
    },
  })
}
