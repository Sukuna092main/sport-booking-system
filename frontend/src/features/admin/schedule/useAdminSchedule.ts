import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { adminApi } from "@/lib/api/admin"
import { adminCourtsQueryKey } from "@/features/admin/courts/useAdminCourts"
import type {
  ReplaceOperatingHoursPayload,
  SlotPolicyPayload,
} from "@/types/schedule.types"

/* ------------------------------------------------------------------ */
/*  Query Keys                                                        */
/* ------------------------------------------------------------------ */

export const adminScheduleQueryKey = (courtId: string) =>
  ["admin", "courts", courtId, "schedule"] as const

/* ------------------------------------------------------------------ */
/*  Hooks                                                             */
/* ------------------------------------------------------------------ */

/**
 * useCourtOperatingHours — GET /admin/courts/{courtId}/operating-hours
 * Lấy danh sách lịch mở cửa và các mẫu time_slots đang hoạt động của sân.
 */
export function useCourtOperatingHours(courtId: string) {
  return useQuery({
    queryKey: adminScheduleQueryKey(courtId),
    queryFn: () => adminApi.getOperatingHours(courtId).then((r) => r.data),
    staleTime: 1000 * 60, // 1 min
    enabled: Boolean(courtId),
    retry: (failureCount, error) => {
      const status = (error as { response?: { status: number } })?.response?.status
      if (status === 404 || status === 403 || status === 401) return false
      return failureCount < 2
    },
  })
}

/**
 * useReplaceOperatingHours — PUT /admin/courts/{courtId}/operating-hours
 * Thay thế lịch mở cửa hằng tuần của sân và tái tạo mẫu slot hiện hành.
 * Tự động làm mới availability cho sân theo checklist.
 */
export function useReplaceOperatingHours() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      courtId,
      payload,
    }: {
      courtId: string
      payload: ReplaceOperatingHoursPayload
    }) => adminApi.replaceOperatingHours(courtId, payload),

    onSuccess: (response, variables) => {
      // 1. Cập nhật cache operating hours của sân này
      queryClient.setQueryData(adminScheduleQueryKey(variables.courtId), response.data)

      // 2. Yêu cầu checklist: Refresh availability sau thay đổi cấu hình Schedule
      // Invalidate tất cả availability queries của court này (mọi ngày đã xem)
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey
          return (
            Array.isArray(key) &&
            key[0] === "courts" &&
            key[1] === "availability" &&
            key[2] === variables.courtId
          )
        },
      })

      // 3. Invalidate thông tin court list
      queryClient.invalidateQueries({ queryKey: ["courts"] })
      queryClient.invalidateQueries({ queryKey: adminCourtsQueryKey() })
    },
  })
}

/**
 * useUpdateSlotPolicy — PATCH /admin/courts/{courtId}
 * Cập nhật cấu hình slot duration, min consecutive slots, max consecutive slots.
 * Khi duration đổi, backend tự động RegenerateSlots trong transaction.
 * Hook tự động invalidate operating hours và availability để hiển thị ngay slots mới.
 */
export function useUpdateSlotPolicy() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      courtId,
      payload,
    }: {
      courtId: string
      payload: SlotPolicyPayload
    }) =>
      adminApi.updateCourt(courtId, {
        slotDurationMinutes: payload.slotDurationMinutes,
        minConsecutiveSlots: payload.minConsecutiveSlots,
        maxConsecutiveSlots: payload.maxConsecutiveSlots,
      }),

    onSuccess: (_, variables) => {
      // Invalidate schedule để kéo lại timeSlots mới vừa được backend tái tạo
      queryClient.invalidateQueries({
        queryKey: adminScheduleQueryKey(variables.courtId),
      })

      // Invalidate availability để phản ánh duration và slot mới ngay lập tức
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey
          return (
            Array.isArray(key) &&
            key[0] === "courts" &&
            key[1] === "availability" &&
            key[2] === variables.courtId
          )
        },
      })

      // Invalidate courts list
      queryClient.invalidateQueries({ queryKey: ["courts"] })
      queryClient.invalidateQueries({ queryKey: adminCourtsQueryKey() })
    },
  })
}
