import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { adminApi } from "@/lib/api/admin"
import { adminCourtsQueryKey } from "@/features/admin/courts/useAdminCourts"
import type {
  AdminBookingQueryParams,
  AdminCancelBookingPayload,
} from "@/types/adminBooking.types"

/* ------------------------------------------------------------------ */
/*  Query Keys                                                        */
/* ------------------------------------------------------------------ */

export const adminBookingsQueryKeys = {
  all: ["admin", "bookings"] as const,
  list: (params?: AdminBookingQueryParams) =>
    ["admin", "bookings", "list", params] as const,
  detail: (id: string) => ["admin", "bookings", "detail", id] as const,
  statistics: (from: string, to: string) =>
    ["admin", "statistics", from, to] as const,
}

/* ------------------------------------------------------------------ */
/*  Hooks                                                             */
/* ------------------------------------------------------------------ */

/**
 * useAdminBookings — GET /admin/bookings
 * Tra cứu danh sách booking cho quản trị có phân trang và bộ lọc.
 */
export function useAdminBookings(params?: AdminBookingQueryParams) {
  // Clean empty params so query cache is well-formed
  const cleanParams: AdminBookingQueryParams | undefined = params
    ? {
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 20,
        ...(params.courtId ? { courtId: params.courtId } : {}),
        ...(params.date ? { date: params.date } : {}),
        ...(params.status ? { status: params.status } : {}),
      }
    : undefined

  return useQuery({
    queryKey: adminBookingsQueryKeys.list(cleanParams),
    queryFn: () => adminApi.listBookings(cleanParams),
    staleTime: 1000 * 10, // 10s
    retry: (failureCount, error) => {
      const status = (error as { response?: { status: number } })?.response?.status
      if (status === 404 || status === 403 || status === 401 || status === 400) {
        return false
      }
      return failureCount < 2
    },
  })
}

/**
 * useAdminBookingDetail — GET /admin/bookings/:bookingId
 * Chi tiết booking cho quản trị.
 */
export function useAdminBookingDetail(bookingId?: string | null) {
  return useQuery({
    queryKey: adminBookingsQueryKeys.detail(bookingId || ""),
    queryFn: () => adminApi.getBooking(bookingId!).then((res) => res.data),
    enabled: Boolean(bookingId),
    staleTime: 1000 * 15,
    retry: (failureCount, error) => {
      const status = (error as { response?: { status: number } })?.response?.status
      if (status === 404 || status === 403 || status === 401 || status === 400) {
        return false
      }
      return failureCount < 2
    },
  })
}

/**
 * useAdminCancelBooking — POST /admin/bookings/:bookingId/cancel
 * Admin hủy booking bị ảnh hưởng và ghi lý do vào audit log.
 * Tự động làm mới cache admin bookings, availability và danh sách sân.
 */
export function useAdminCancelBooking() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      bookingId,
      payload,
    }: {
      bookingId: string
      payload: AdminCancelBookingPayload
    }) => adminApi.cancelBooking(bookingId, payload),

    onSuccess: (response) => {
      const updated = response.data

      // 1. Invalidate all admin bookings queries (list & details)
      queryClient.invalidateQueries({ queryKey: adminBookingsQueryKeys.all })

      // 2. Set detail cache directly with updated entity for immediate UI responsiveness
      if (updated?.id) {
        queryClient.setQueryData(adminBookingsQueryKeys.detail(updated.id), updated)
      }

      // 3. Refresh court availability so freed slots show as available immediately
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey
          return (
            Array.isArray(key) &&
            key[0] === "courts" &&
            key[1] === "availability"
          )
        },
      })

      // 4. Invalidate user bookings cache in case user view is open
      queryClient.invalidateQueries({ queryKey: ["bookings"] })

      // 5. Invalidate admin courts cache
      queryClient.invalidateQueries({ queryKey: adminCourtsQueryKey() })
    },
  })
}

/**
 * useAdminStatistics — GET /admin/statistics?from=...&to=...
 */
export function useAdminStatistics(from: string, to: string) {
  return useQuery({
    queryKey: adminBookingsQueryKeys.statistics(from, to),
    queryFn: () => adminApi.getStatistics({ from, to }).then((r) => r.data),
    enabled: Boolean(from && to && from <= to),
    staleTime: 1000 * 30,
  })
}
