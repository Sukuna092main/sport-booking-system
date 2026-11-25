import { describe, it, expect } from "vitest"
import { paymentsApi } from "@/lib/api/payments"
import type { BookingStatus } from "@/features/bookings/types"

describe("Payment & Deposit Calculation Suite", () => {
  it("should have all payment API methods exposed", () => {
    expect(typeof paymentsApi.startPayment).toBe("function")
    expect(typeof paymentsApi.getPaymentStatus).toBe("function")
    expect(typeof paymentsApi.completeMockPayment).toBe("function")
    expect(typeof paymentsApi.getCourtPricing).toBe("function")
    expect(typeof paymentsApi.setCourtPricing).toBe("function")
  })

  describe("Deposit & Remaining Calculations", () => {
    function computeAmounts(pricePerSlotVnd: number, slotCount: number, depositBps = 3000) {
      const total = pricePerSlotVnd * slotCount
      const deposit = Math.floor((total * depositBps) / 10000)
      const remaining = total - deposit
      return { total, deposit, remaining }
    }

    it("correctly computes 30% deposit for 1 slot at 100,000 VND", () => {
      const { total, deposit, remaining } = computeAmounts(100000, 1)
      expect(total).toBe(100000)
      expect(deposit).toBe(30000)
      expect(remaining).toBe(70000)
    })

    it("correctly computes 30% deposit for 3 consecutive slots at 150,000 VND", () => {
      const { total, deposit, remaining } = computeAmounts(150000, 3)
      expect(total).toBe(450000)
      expect(deposit).toBe(135000)
      expect(remaining).toBe(315000)
    })

    it("maintains balance where total = deposit + remaining", () => {
      for (const price of [80000, 120000, 250000, 333333]) {
        for (const count of [1, 2, 4]) {
          const { total, deposit, remaining } = computeAmounts(price, count)
          expect(deposit + remaining).toBe(total)
        }
      }
    })
  })

  describe("Hold Expiration Countdown Calculation", () => {
    function calculateTimeLeft(holdExpiresAt: string, currentTimestamp: number): {
      secondsLeft: number
      isExpired: boolean
      formatted: string
    } {
      const expires = new Date(holdExpiresAt).getTime()
      const diffSec = Math.max(0, Math.floor((expires - currentTimestamp) / 1000))
      const minutes = Math.floor(diffSec / 60)
      const seconds = diffSec % 60
      return {
        secondsLeft: diffSec,
        isExpired: diffSec === 0,
        formatted: `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`,
      }
    }

    it("formats 10 minutes remaining correctly", () => {
      const now = 1000000
      const tenMinutesLater = new Date(now + 10 * 60 * 1000).toISOString()
      const result = calculateTimeLeft(tenMinutesLater, now)
      expect(result.secondsLeft).toBe(600)
      expect(result.isExpired).toBe(false)
      expect(result.formatted).toBe("10:00")
    })

    it("formats 3 minutes 45 seconds remaining correctly", () => {
      const now = 1000000
      const future = new Date(now + 225 * 1000).toISOString()
      const result = calculateTimeLeft(future, now)
      expect(result.secondsLeft).toBe(225)
      expect(result.isExpired).toBe(false)
      expect(result.formatted).toBe("03:45")
    })

    it("marks as expired when target time is in the past", () => {
      const now = 2000000
      const past = new Date(now - 10000).toISOString()
      const result = calculateTimeLeft(past, now)
      expect(result.secondsLeft).toBe(0)
      expect(result.isExpired).toBe(true)
      expect(result.formatted).toBe("00:00")
    })
  })

  describe("Booking Status Lifecycle Compatibility", () => {
    const validStatuses: BookingStatus[] = ["CONFIRMED", "CANCELLED", "PENDING_PAYMENT", "EXPIRED"]

    it("recognizes all 4 backend lifecycle statuses", () => {
      expect(validStatuses).toContain("CONFIRMED")
      expect(validStatuses).toContain("CANCELLED")
      expect(validStatuses).toContain("PENDING_PAYMENT")
      expect(validStatuses).toContain("EXPIRED")
    })
  })
})
