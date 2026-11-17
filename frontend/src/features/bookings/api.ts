import { apiClient } from "@/lib/api/client"
import type { CreateBookingPayload } from "./types"

export interface BookingRecord {
  id: string
  bookingCode: string
  customerId: string
  courtId: string
  bookingDate: string
  status: "PENDING_PAYMENT" | "CONFIRMED" | "CANCELLED" | "EXPIRED"
  slots: Array<{ timeSlotId: string; startsAt: string; endsAt: string }>
  createdAt: string
  cancelledAt: string | null
  holdExpiresAt?: string
  expiredAt?: string
  totalAmountVnd?: number
  depositAmountVnd?: number
  remainingAmountVnd?: number
}

export interface BookingPageResponse {
  data: BookingRecord[]
  meta: { page: number; pageSize: number; total: number }
}

export const bookingsApi = {
  create(payload: CreateBookingPayload, idempotencyKey: string) {
    return apiClient.post<{ data: BookingRecord }>("/bookings", payload, {
      headers: { "Idempotency-Key": idempotencyKey },
    }).then((r) => r.data.data)
  },
  list() {
    return apiClient.get<BookingPageResponse>("/bookings", { params: { page: 1, pageSize: 100 } }).then((r) => r.data)
  },
  cancel(bookingId: string) {
    return apiClient.post<{ data: BookingRecord }>(`/bookings/${bookingId}/cancel`).then((r) => r.data.data)
  },
}
