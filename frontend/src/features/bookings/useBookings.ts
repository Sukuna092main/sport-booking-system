import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { bookingsApi } from "@/lib/api/bookings"
import type {
  BookingItem,
  BookingStatus,
  CreateBookingPayload,
} from "./types"

/* ------------------------------------------------------------------ */
/*  Session Mock Storage Helper (for local demo & before BE handoff)  */
/* ------------------------------------------------------------------ */

const MOCK_STORAGE_KEY = "sport_mock_user_bookings"

export function getMockBookings(): BookingItem[] {
  try {
    const raw = sessionStorage.getItem(MOCK_STORAGE_KEY)
    if (raw) return JSON.parse(raw) as BookingItem[]
  } catch {
    // fallback
  }
  return []
}

export function saveMockBooking(booking: BookingItem): void {
  try {
    const existing = getMockBookings()
    const updated = [booking, ...existing.filter((b) => b.id !== booking.id)]
    sessionStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(updated))
  } catch {
    // fallback
  }
}

export function updateMockBookingStatus(
  bookingId: string,
  status: BookingStatus
): BookingItem | null {
  try {
    const existing = getMockBookings()
    const target = existing.find((b) => b.id === bookingId)
    if (target) {
      target.status = status
      if (status === "CANCELLED") {
        target.cancelledAt = new Date().toISOString()
      }
      sessionStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(existing))
      return target
    }
  } catch {
    // fallback
  }
  return null
}

/* ------------------------------------------------------------------ */
/*  Query keys                                                        */
/* ------------------------------------------------------------------ */

export const bookingsQueryKeys = {
  all: ["bookings"] as const,
  list: (params?: { page?: number; pageSize?: number; status?: BookingStatus }) =>
    ["bookings", "list", params] as const,
  detail: (id: string) => ["bookings", "detail", id] as const,
}

/* ------------------------------------------------------------------ */
/*  Hooks                                                             */
/* ------------------------------------------------------------------ */

/**
 * useMyBookings — fetch user's bookings list
 */
export function useMyBookings(params?: {
  page?: number
  pageSize?: number
  status?: BookingStatus
}) {
  return useQuery({
    queryKey: bookingsQueryKeys.list(params),
    queryFn: async () => {
      try {
        const response = await bookingsApi.listMyBookings(params)
        return response
      } catch {
        // Fallback to local session storage bookings before BE handoff
        const local = getMockBookings()
        const filtered = params?.status
          ? local.filter((b) => b.status === params.status)
          : local
        return {
          data: filtered,
          meta: {
            page: params?.page ?? 1,
            pageSize: params?.pageSize ?? 20,
            total: filtered.length,
          },
        }
      }
    },
    staleTime: 1000 * 10,
  })
}

/**
 * useMyBooking — fetch single booking details
 */
export function useMyBooking(bookingId: string) {
  return useQuery({
    queryKey: bookingsQueryKeys.detail(bookingId),
    queryFn: async () => {
      try {
        const response = await bookingsApi.getMyBooking(bookingId)
        return response.data
      } catch {
        // Fallback to local session storage
        const local = getMockBookings()
        const found = local.find((b) => b.id === bookingId)
        if (found) return found
        throw new Error("Không tìm thấy thông tin đặt sân.")
      }
    },
    enabled: !!bookingId,
    retry: false,
  })
}

/**
 * useCreateBooking — mutation to call POST /bookings
 */
export function useCreateBooking() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      payload,
      idempotencyKey,
    }: {
      payload: CreateBookingPayload
      idempotencyKey?: string
    }) => bookingsApi.createBooking(payload, idempotencyKey),

    onSuccess: (response) => {
      // Invalidate queries so lists update
      queryClient.invalidateQueries({ queryKey: bookingsQueryKeys.all })
      // Also cache in local session for offline/mock resilience
      if (response?.data) {
        saveMockBooking(response.data)
      }
    },
  })
}

/**
 * useCancelMyBooking — mutation to call POST /bookings/{id}/cancel
 */
export function useCancelMyBooking() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (bookingId: string) => {
      try {
        const res = await bookingsApi.cancelMyBooking(bookingId)
        return res.data
      } catch (err) {
        // Fallback for mock if BE endpoint is not ready
        const updated = updateMockBookingStatus(bookingId, "CANCELLED")
        if (updated) return updated
        throw err
      }
    },
    onSuccess: (cancelled) => {
      queryClient.invalidateQueries({ queryKey: bookingsQueryKeys.all })
      queryClient.setQueryData(bookingsQueryKeys.detail(cancelled.id), cancelled)
    },
  })
}
