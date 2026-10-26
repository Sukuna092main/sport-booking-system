/**
 * Schedule & TimeSlot domain types — theo OpenAPI 0.5.0 contract
 * Endpoints:
 * - GET /admin/courts/{courtId}/operating-hours
 * - PUT /admin/courts/{courtId}/operating-hours
 * - PATCH /admin/courts/{courtId} (slot policy)
 * - GET /courts/{courtId}/availability?date=YYYY-MM-DD
 */

export interface OperatingHour {
  /** ISO weekday: 1 = Thứ Hai (Monday) ... 7 = Chủ Nhật (Sunday) */
  weekday: number
  /** Format HH:mm:ss, e.g. "08:00:00" */
  opensAt: string
  /** Format HH:mm:ss, e.g. "22:00:00" */
  closesAt: string
}

export interface TimeSlotTemplate {
  id: string
  weekday: number
  startsAt: string
  endsAt: string
}

export interface OperatingHoursData {
  courtId: string
  timeZone: string
  hours: OperatingHour[]
  timeSlots: TimeSlotTemplate[]
}

export interface OperatingHoursResponse {
  data: OperatingHoursData
}

export interface ReplaceOperatingHoursPayload {
  hours: OperatingHour[]
}

export interface SlotPolicyPayload {
  slotDurationMinutes: number
  minConsecutiveSlots: number
  maxConsecutiveSlots: number
}
