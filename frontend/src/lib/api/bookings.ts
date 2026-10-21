import { apiClient } from "@/lib/api/client"
import type {
  CreateBookingPayload,
  BookingResponse,
  BookingListResponse,
  BookingStatus,
} from "@/features/bookings/types"

/**
 * Generate a client-side UUID fallback if crypto.randomUUID is unavailable
 */
export function generateIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `idemp-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`
}

/**
 * Bookings API service — theo OpenAPI 0.3.0 & Booking State/Error Contract Handoff
 *
 * POST /bookings               (Header: Idempotency-Key) → 201 Created / 200 OK
 * GET  /bookings               (Query: page, pageSize, status) → 200 OK
 * GET  /bookings/{bookingId}   → 200 OK / 404 Not Found
 * POST /bookings/{bookingId}/cancel → 200 OK / 409 Conflict
 */
export const bookingsApi = {
  /**
   * POST /bookings
   * Headers:
   *  - Authorization: Bearer <token> (attached by interceptor)
   *  - Idempotency-Key: string (1-128 chars)
   */
  createBooking(
    payload: CreateBookingPayload,
    idempotencyKey?: string
  ): Promise<BookingResponse> {
    const key = idempotencyKey || generateIdempotencyKey()
    return apiClient
      .post<BookingResponse>("/bookings", payload, {
        headers: {
          "Idempotency-Key": key,
        },
      })
      .then((r) => r.data)
  },

  /**
   * GET /bookings
   * List authenticated user's bookings, newest first.
   */
  listMyBookings(params?: {
    page?: number
    pageSize?: number
    status?: BookingStatus
  }): Promise<BookingListResponse> {
    return apiClient
      .get<BookingListResponse>("/bookings", { params })
      .then((r) => r.data)
  },

  /**
   * GET /bookings/{bookingId}
   * Get booking details. Non-owned booking returns 404 per contract.
   */
  getMyBooking(bookingId: string): Promise<BookingResponse> {
    return apiClient
      .get<BookingResponse>(`/bookings/${bookingId}`)
      .then((r) => r.data)
  },

  /**
   * POST /bookings/{bookingId}/cancel
   * Cancel booking before first slot start time. No cancellation fee in MVP.
   */
  cancelMyBooking(bookingId: string): Promise<BookingResponse> {
    return apiClient
      .post<BookingResponse>(`/bookings/${bookingId}/cancel`)
      .then((r) => r.data)
  },
}
