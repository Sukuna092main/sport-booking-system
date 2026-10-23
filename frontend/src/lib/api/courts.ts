import { apiClient } from "@/lib/api/client"
import type {
  CourtsQueryParams,
  CourtListResponse,
  CourtResponse,
  AvailabilityResponse,
  SportTypesResponse,
} from "@/types/court.types"

/**
 * Courts API service — theo contract OpenAPI 0.3.0.
 *
 * GET  /sport-types                          → 200 { data: SportType[] }
 * GET  /courts?q=&sportTypeId=&page=&pageSize= → 200 { data: Court[], meta: PageMeta }
 * GET  /courts/{courtId}                     → 200 { data: Court }
 * GET  /courts/{courtId}/availability?date=  → 200 { data: AvailabilityData }
 */
export const courtsApi = {
  /**
   * GET /sport-types
   * 200 → { data: SportType[] }
   * Public — no auth required.
   */
  listSportTypes(): Promise<SportTypesResponse> {
    return apiClient
      .get<SportTypesResponse>("/sport-types")
      .then((r) => r.data)
  },

  /**
   * GET /courts
   * Query: q (tên/mã), sportTypeId, page, pageSize.
   * 200 → { data: Court[], meta: PageMeta }
   * Public — no auth required.
   */
  listCourts(params?: CourtsQueryParams): Promise<CourtListResponse> {
    return apiClient
      .get<CourtListResponse>("/courts", { params })
      .then((r) => r.data)
  },

  /**
   * GET /courts/{courtId}
   * 200 → { data: Court }
   * 404 → not_found
   * Public — no auth required.
   */
  getCourt(courtId: string): Promise<CourtResponse> {
    return apiClient
      .get<CourtResponse>(`/courts/${courtId}`)
      .then((r) => r.data)
  },

  /**
   * GET /courts/{courtId}/availability?date=YYYY-MM-DD
   * 200 → { data: AvailabilityData }
   * 400 → validation_error (date > 30 days)
   * 404 → not_found
   * Public — no auth required.
   */
  getAvailability(courtId: string, date: string): Promise<AvailabilityResponse> {
    return apiClient
      .get<AvailabilityResponse>(`/courts/${courtId}/availability`, {
        params: { date },
      })
      .then((r) => r.data)
  },
}
