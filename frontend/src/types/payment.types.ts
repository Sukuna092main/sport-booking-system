/**
 * Payment and Pricing domain types — per OpenAPI and Backend Payment Service
 */

export type PaymentStatusEnum = "PENDING" | "PAID" | "FAILED" | "EXPIRED" | "PAID_REVIEW"

export type PaymentProvider = "mock" | "vnpay"

export interface Payment {
  id: string
  bookingId: string
  provider: PaymentProvider
  providerOrderRef: string
  amountVnd: number
  currency: string
  status: PaymentStatusEnum
  checkoutUrl?: string
  createdAt: string
  paidAt?: string | null
}

export interface Pricing {
  courtId: string
  pricePerSlotVnd: number
  isActive: boolean
  updatedAt: string
}

export interface SetPricingRequest {
  pricePerSlotVnd: number
  isActive?: boolean
}

export interface PaymentStatus {
  bookingId: string
  bookingStatus: string
  holdExpiresAt?: string
  totalAmountVnd: number
  depositAmountVnd: number
  remainingAmountVnd: number
  payment?: Payment | null
}

export interface PaymentResponse {
  data: Payment
}

export interface PaymentStatusResponse {
  data: PaymentStatus
}

export interface PricingResponse {
  data: Pricing
}

export interface MockCompleteRequest {
  success: boolean
}

export interface MockCompleteResponse {
  data: {
    RspCode: string
    Message: string
  }
}
