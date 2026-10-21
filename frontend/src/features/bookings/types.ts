/**
 * Booking domain & handoff types — per OpenAPI 0.3.0 and DES_Booking_State_Error_Contract_Handoff
 */

export interface CreateBookingPayload {
  courtId: string       // UUID of the court
  bookingDate: string   // YYYY-MM-DD
  timeSlotIds: string[] // Array of time_slot template UUIDs in chronological order
}

export type SlotStatus = "available" | "unavailable" | "past" | "booked" | "blackout"

export interface BookingReviewHandoffData {
  courtId: string
  courtName: string
  courtCode: string
  sportName: string
  sportTypeId: string
  locationText: string
  bookingDate: string
  formattedDate: string
  slotDurationMinutes: number
  minConsecutiveSlots: number
  maxConsecutiveSlots: number
  timeRangeText: string
  durationText: string
  selectedSlots: Array<{
    id: string
    startsAt: string
    endsAt: string
    formattedRange: string
  }>
  payload: CreateBookingPayload
}

export type SimulationOutcome =
  | "success"
  | "error_conflict"
  | "error_non_consecutive"
  | "error_min_max"
  | "error_limit_reached"
  | "error_horizon_exceeded"
  | "error_timeout"
