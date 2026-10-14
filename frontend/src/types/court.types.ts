/**
 * Court domain types — theo OpenAPI 0.3.0 contract
 * Endpoints: GET /sport-types, GET /courts, GET /courts/{courtId},
 *            GET /courts/{courtId}/availability
 */

/* ── Sport Type ── */

export interface SportType {
  id: string
  name: string
  description: string | null
  isActive: boolean
}

export interface SportTypesResponse {
  data: SportType[]
}

/* ── Court ── */

export interface Court {
  id: string
  sportTypeId: string
  code: string
  name: string
  description: string | null
  isActive: boolean
  slotDurationMinutes: number
  minConsecutiveSlots: number
  maxConsecutiveSlots: number
  /** Decimal string; display only, no payment in MVP */
  referencePriceAmount: string | null
  referencePriceCurrency: string | null
}

/** GET /courts — response: { data: Court[], meta: PageMeta } */
export interface CourtListResponse {
  data: Court[]
  meta: PageMeta
}

/** GET /courts/{courtId} — response: { data: Court } */
export interface CourtResponse {
  data: Court
}

/** Pagination metadata */
export interface PageMeta {
  page: number
  pageSize: number
  total: number
}

/* ── Availability ── */

export interface AvailabilitySlot {
  id: string
  startsAt: string   // UTC ISO date-time
  endsAt: string     // UTC ISO date-time
  available: boolean
}

export interface AvailabilityData {
  courtId: string
  date: string       // YYYY-MM-DD
  timeZone: string
  slots: AvailabilitySlot[]
}

/** GET /courts/{courtId}/availability?date=YYYY-MM-DD */
export interface AvailabilityResponse {
  data: AvailabilityData
}

/* ── Query params ── */

export interface CourtsQueryParams {
  q?: string
  sportTypeId?: string
  page?: number
  pageSize?: number
}
