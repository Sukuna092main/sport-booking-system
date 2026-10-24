import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { adminApi } from "@/lib/api/admin"
import { sportTypesQueryKey } from "@/features/courts/useCourts"
import type {
  AdminCourtQueryParams,
  CourtPatch,
  CourtWrite,
  SportTypePatch,
  SportTypeWrite,
} from "@/types/court.types"

/* ── Query Keys ─────────────────────────────────────────────────── */

export const adminSportTypesQueryKey = ["admin", "sport-types"] as const

export const adminCourtsQueryKey = (params?: AdminCourtQueryParams) =>
  ["admin", "courts", params] as const

/* ── Sport Type Hooks ───────────────────────────────────────────── */

/**
 * useAdminSportTypes — GET /admin/sport-types
 * Returns all sport types (both active and inactive).
 */
export function useAdminSportTypes() {
  return useQuery({
    queryKey: adminSportTypesQueryKey,
    queryFn: () => adminApi.listSportTypes().then((r) => r.data),
    staleTime: 1000 * 30, // 30s
  })
}

/**
 * useCreateSportType — POST /admin/sport-types
 */
export function useCreateSportType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: SportTypeWrite) => adminApi.createSportType(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminSportTypesQueryKey })
      queryClient.invalidateQueries({ queryKey: sportTypesQueryKey })
    },
  })
}

/**
 * useUpdateSportType — PATCH /admin/sport-types/:sportTypeId
 */
export function useUpdateSportType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: SportTypePatch }) =>
      adminApi.updateSportType(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminSportTypesQueryKey })
      queryClient.invalidateQueries({ queryKey: sportTypesQueryKey })
      queryClient.invalidateQueries({ queryKey: ["admin", "courts"] })
      queryClient.invalidateQueries({ queryKey: ["courts"] })
    },
  })
}

/**
 * useDeactivateSportType — DELETE /admin/sport-types/:sportTypeId
 */
export function useDeactivateSportType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => adminApi.deactivateSportType(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminSportTypesQueryKey })
      queryClient.invalidateQueries({ queryKey: sportTypesQueryKey })
    },
  })
}

/* ── Court Hooks ────────────────────────────────────────────────── */

/**
 * useAdminCourts — GET /admin/courts?page=&pageSize=
 * Returns paginated court list (both active and inactive).
 */
export function useAdminCourts(params?: AdminCourtQueryParams) {
  return useQuery({
    queryKey: adminCourtsQueryKey(params),
    queryFn: () => adminApi.listCourts(params),
    staleTime: 1000 * 30, // 30s
  })
}

/**
 * useCreateCourt — POST /admin/courts
 */
export function useCreateCourt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CourtWrite) => adminApi.createCourt(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "courts"] })
      queryClient.invalidateQueries({ queryKey: ["courts"] })
      queryClient.invalidateQueries({ queryKey: adminSportTypesQueryKey })
    },
  })
}

/**
 * useUpdateCourt — PATCH /admin/courts/:courtId
 */
export function useUpdateCourt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CourtPatch }) =>
      adminApi.updateCourt(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "courts"] })
      queryClient.invalidateQueries({ queryKey: ["courts"] })
    },
  })
}

/**
 * useDeactivateCourt — DELETE /admin/courts/:courtId
 */
export function useDeactivateCourt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => adminApi.deactivateCourt(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "courts"] })
      queryClient.invalidateQueries({ queryKey: ["courts"] })
    },
  })
}
