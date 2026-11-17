import { apiClient } from "@/lib/api/client"

export interface PaymentRecord {
  id: string
  bookingId: string
  provider: "mock" | "vnpay"
  providerOrderRef: string
  amountVnd: number
  currency: string
  status: "PENDING" | "PAID" | "FAILED" | "EXPIRED" | "PAID_REVIEW"
  checkoutUrl?: string
  createdAt: string
  paidAt: string | null
}

export interface BookingPaymentStatus {
  bookingId: string
  bookingStatus: string
  holdExpiresAt?: string
  totalAmountVnd: number
  depositAmountVnd: number
  remainingAmountVnd: number
  payment?: PaymentRecord
}

export const paymentsApi = {
  start(bookingId: string) {
    return apiClient.post<{ data: PaymentRecord }>(`/bookings/${bookingId}/payments`).then((r) => r.data.data)
  },
  status(bookingId: string) {
    return apiClient.get<{ data: BookingPaymentStatus }>(`/bookings/${bookingId}/payments`).then((r) => r.data.data)
  },
  completeMock(orderRef: string) {
    return apiClient.post(`/payments/mock/${encodeURIComponent(orderRef)}/complete`, { success: true }).then((r) => r.data)
  },
}
