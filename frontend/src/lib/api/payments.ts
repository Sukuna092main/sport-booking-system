import { apiClient } from "@/lib/api/client"
import type {
  MockCompleteRequest,
  MockCompleteResponse,
  PaymentResponse,
  PaymentStatusResponse,
  PricingResponse,
  SetPricingRequest,
} from "@/types/payment.types"

/**
 * Payments & Court Pricing API service
 */
export const paymentsApi = {
  /**
   * POST /bookings/:bookingId/payments
   * Creates or resumes checkout session. Returns checkoutUrl and payment info.
   */
  startPayment(bookingId: string): Promise<PaymentResponse> {
    return apiClient
      .post<PaymentResponse>(`/bookings/${bookingId}/payments`)
      .then((r) => r.data)
  },

  /**
   * GET /bookings/:bookingId/payments
   * Returns current payment status, hold expiry and amounts.
   */
  getPaymentStatus(bookingId: string): Promise<PaymentStatusResponse> {
    return apiClient
      .get<PaymentStatusResponse>(`/bookings/${bookingId}/payments`)
      .then((r) => r.data)
  },

  /**
   * POST /payments/mock/:orderRef/complete
   * Simulates payment gateway completion in development.
   */
  completeMockPayment(orderRef: string, success: boolean): Promise<MockCompleteResponse> {
    const payload: MockCompleteRequest = { success }
    return apiClient
      .post<MockCompleteResponse>(`/payments/mock/${orderRef}/complete`, payload)
      .then((r) => r.data)
  },

  /**
   * GET /courts/:courtId/pricing
   * Reads court pricing per slot.
   */
  getCourtPricing(courtId: string): Promise<PricingResponse> {
    return apiClient
      .get<PricingResponse>(`/courts/${courtId}/pricing`)
      .then((r) => r.data)
  },

  /**
   * PUT /admin/courts/:courtId/pricing
   * Sets court pricing per slot (Admin only).
   */
  setCourtPricing(courtId: string, body: SetPricingRequest): Promise<PricingResponse> {
    return apiClient
      .put<PricingResponse>(`/admin/courts/${courtId}/pricing`, body)
      .then((r) => r.data)
  },
}
