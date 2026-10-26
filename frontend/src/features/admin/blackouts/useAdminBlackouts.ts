import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { adminApi } from "@/lib/api/admin"
import { adminCourtsQueryKey } from "@/features/admin/courts/useAdminCourts"
import type { BlackoutPatch, BlackoutWrite } from "@/types/blackout.types"

/* ------------------------------------------------------------------ */
/*  Query Keys                                                        */
/* ------------------------------------------------------------------ */

export const adminBlackoutsQueryKey = (courtId: string) =>
  ["admin", "courts", courtId, "blackouts"] as const

/* ------------------------------------------------------------------ */
/*  Hooks                                                             */
/* ------------------------------------------------------------------ */

/**
 * useCourtBlackouts — GET /admin/courts/{courtId}/blackouts
 * Lấy danh sách toàn bộ lịch chặn của sân (gồm cả active và inactive).
 */
export function useCourtBlackouts(courtId: string) {
  return useQuery({
    queryKey: adminBlackoutsQueryKey(courtId),
    queryFn: () => adminApi.listCourtBlackouts(courtId).then((r) => r.data),
    staleTime: 1000 * 30, // 30s
    enabled: Boolean(courtId),
    retry: (failureCount, error) => {
      const status = (error as { response?: { status: number } })?.response?.status
      if (status === 404 || status === 403 || status === 401) return false
      return failureCount < 2
    },
  })
}

/**
 * Helper to invalidate availability cache for a court across all dates.
 * Checklist requirement: "refresh availability"
 */
function invalidateCourtAvailability(queryClient: ReturnType<typeof useQueryClient>, courtId: string) {
  queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey
      return (
        Array.isArray(key) &&
        key[0] === "courts" &&
        key[1] === "availability" &&
        key[2] === courtId
      )
    },
  })
}

/**
 * useCreateCourtBlackout — POST /admin/courts/{courtId}/blackouts
 * Tạo lịch chặn mới cho sân.
 * Tự động làm mới cache blackouts và availability của sân.
 * Note: Không tự xóa hoặc hủy booking CONFIRMED đã tồn tại.
 */
export function useCreateCourtBlackout() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      courtId,
      payload,
    }: {
      courtId: string
      payload: BlackoutWrite
    }) => adminApi.createCourtBlackout(courtId, payload),

    onSuccess: (_, variables) => {
      // 1. Invalidate blackouts list
      queryClient.invalidateQueries({
        queryKey: adminBlackoutsQueryKey(variables.courtId),
      })

      // 2. Refresh availability: Invalidate availability cache so customer view reflects blackout immediately
      invalidateCourtAvailability(queryClient, variables.courtId)

      // 3. Invalidate courts cache
      queryClient.invalidateQueries({ queryKey: ["courts"] })
      queryClient.invalidateQueries({ queryKey: adminCourtsQueryKey() })
    },
  })
}

/**
 * useUpdateCourtBlackout — PATCH /admin/courts/{courtId}/blackouts/{blackoutId}
 * Cập nhật thời gian, lý do hoặc trạng thái kích hoạt của lịch chặn.
 * Tự động làm mới availability cho sân.
 */
export function useUpdateCourtBlackout() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      courtId,
      blackoutId,
      payload,
    }: {
      courtId: string
      blackoutId: string
      payload: BlackoutPatch
    }) => adminApi.updateCourtBlackout(courtId, blackoutId, payload),

    onSuccess: (_, variables) => {
      // 1. Invalidate blackouts list
      queryClient.invalidateQueries({
        queryKey: adminBlackoutsQueryKey(variables.courtId),
      })

      // 2. Refresh availability
      invalidateCourtAvailability(queryClient, variables.courtId)

      // 3. Invalidate courts cache
      queryClient.invalidateQueries({ queryKey: ["courts"] })
      queryClient.invalidateQueries({ queryKey: adminCourtsQueryKey() })
    },
  })
}

/**
 * useDeactivateCourtBlackout — DELETE /admin/courts/{courtId}/blackouts/{blackoutId}
 * Ngừng kích hoạt (xóa mềm, isActive=false) lịch chặn sân.
 * Giữ nguyên lịch sử, audit log và không làm thay đổi các booking đã xác nhận.
 * Tự động làm mới availability.
 */
export function useDeactivateCourtBlackout() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      courtId,
      blackoutId,
    }: {
      courtId: string
      blackoutId: string
    }) => adminApi.deactivateCourtBlackout(courtId, blackoutId),

    onSuccess: (_, variables) => {
      // 1. Invalidate blackouts list
      queryClient.invalidateQueries({
        queryKey: adminBlackoutsQueryKey(variables.courtId),
      })

      // 2. Refresh availability
      invalidateCourtAvailability(queryClient, variables.courtId)

      // 3. Invalidate courts cache
      queryClient.invalidateQueries({ queryKey: ["courts"] })
      queryClient.invalidateQueries({ queryKey: adminCourtsQueryKey() })
    },
  })
}
