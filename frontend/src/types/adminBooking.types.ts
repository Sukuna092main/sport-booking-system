import type { BookingStatus } from "@/features/bookings/types"

/**
 * Slot item snapshot inside an admin booking
 * per OpenAPI 0.5.0: BookingSlot schema
 */
export interface AdminBookingSlotItem {
  timeSlotId: string
  startsAt: string // UTC ISO timestamp
  endsAt: string   // UTC ISO timestamp
}

/**
 * Admin Booking entity
 * per OpenAPI 0.5.0: Booking schema
 */
export interface AdminBookingItem {
  id: string
  bookingCode: string
  customerId: string // UUID of the user who booked
  courtId: string    // UUID of the court
  bookingDate: string // YYYY-MM-DD local date
  status: BookingStatus // "CONFIRMED" | "CANCELLED"
  slots: AdminBookingSlotItem[]
  createdAt: string // UTC ISO timestamp
  cancelledAt?: string | null // UTC ISO timestamp
}

/**
 * Query parameters for GET /admin/bookings
 * per OpenAPI 0.5.0: /admin/bookings GET operation
 */
export interface AdminBookingQueryParams {
  page?: number
  pageSize?: number
  courtId?: string
  date?: string // YYYY-MM-DD
  status?: BookingStatus
}

/**
 * Paginated list response for GET /admin/bookings
 */
export interface AdminBookingListResponse {
  data: AdminBookingItem[]
  meta: {
    page: number
    pageSize: number
    total: number
  }
}

/**
 * Single booking response for GET /admin/bookings/{bookingId}
 * and POST /admin/bookings/{bookingId}/cancel
 */
export interface AdminBookingResponse {
  data: AdminBookingItem
}

/**
 * Request payload for POST /admin/bookings/{bookingId}/cancel
 * per OpenAPI 0.5.0: AdminCancelBookingRequest schema
 */
export interface AdminCancelBookingPayload {
  reason: string // 1-500 characters, required
}

/**
 * Basic statistics response for GET /admin/statistics
 */
export interface AdminStatisticsData {
  totalBookings: number
  confirmedBookings: number
  cancelledBookings: number
}

export interface AdminStatisticsResponse {
  data: AdminStatisticsData
}
