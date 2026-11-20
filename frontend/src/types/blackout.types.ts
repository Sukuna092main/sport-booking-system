/**
 * Court Blackout domain types — theo OpenAPI 0.5.0 contract
 *
 * Endpoints:
 * - GET    /admin/courts/{courtId}/blackouts
 * - POST   /admin/courts/{courtId}/blackouts
 * - PATCH  /admin/courts/{courtId}/blackouts/{blackoutId}
 * - DELETE /admin/courts/{courtId}/blackouts/{blackoutId}
 */

export interface Blackout {
  id: string
  courtId: string
  /** ISO-8601 UTC date-time string, e.g. "2026-10-25T08:00:00Z" */
  startsAt: string
  /** ISO-8601 UTC date-time string, e.g. "2026-10-25T10:00:00Z" */
  endsAt: string
  reason: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface BlackoutResponse {
  data: Blackout
}

export interface BlackoutListResponse {
  data: Blackout[]
}

export interface BlackoutWrite {
  startsAt: string
  endsAt: string
  reason?: string | null
}

export interface BlackoutPatch {
  startsAt?: string
  endsAt?: string
  reason?: string | null
  isActive?: boolean
}
