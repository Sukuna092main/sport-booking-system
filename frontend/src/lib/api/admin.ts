import { apiClient } from "@/lib/api/client"
import type {
  CourtListResponse,
  CourtPatch,
  CourtResponse,
  CourtWrite,
  SportTypePatch,
  SportTypeResponse,
  SportTypeWrite,
  SportTypesResponse,
  AdminCourtQueryParams,
} from "@/types/court.types"

/**
 * Admin Inventory API service — theo OpenAPI 0.5.0 contract.
 *
 * GET    /admin/sport-types               → 200 { data: SportType[] }
 * POST   /admin/sport-types               → 201 { data: SportType }
 * PATCH  /admin/sport-types/:sportTypeId  → 200 { data: SportType }
 * DELETE /admin/sport-types/:sportTypeId  → 204 No Content (deactivate)
 *
 * GET    /admin/courts?page=&pageSize=    → 200 { data: Court[], meta: PageMeta }
 * POST   /admin/courts                    → 201 { data: Court }
 * PATCH  /admin/courts/:courtId           → 200 { data: Court }
 * DELETE /admin/courts/:courtId           → 204 No Content (deactivate)
 */
export const adminApi = {
  /**
   * GET /admin/sport-types
   * Returns all sport types (active & inactive).
   */
  listSportTypes(): Promise<SportTypesResponse> {
    return apiClient.get<SportTypesResponse>("/admin/sport-types").then((r) => r.data)
  },

  /**
   * POST /admin/sport-types
   * Creates a new sport type.
   */
  createSportType(payload: SportTypeWrite): Promise<SportTypeResponse> {
    return apiClient.post<SportTypeResponse>("/admin/sport-types", payload).then((r) => r.data)
  },

  /**
   * PATCH /admin/sport-types/:sportTypeId
   * Updates an existing sport type (e.g. name, description, isActive).
   */
  updateSportType(sportTypeId: string, payload: SportTypePatch): Promise<SportTypeResponse> {
    return apiClient.patch<SportTypeResponse>(`/admin/sport-types/${sportTypeId}`, payload).then((r) => r.data)
  },

  /**
   * DELETE /admin/sport-types/:sportTypeId
   * Deactivates sport type (soft delete, sets isActive=false).
   */
  deactivateSportType(sportTypeId: string): Promise<void> {
    return apiClient.delete<void>(`/admin/sport-types/${sportTypeId}`).then((r) => r.data)
  },

  /**
   * GET /admin/courts?page=&pageSize=
   * Returns paginated list of all courts (active & inactive).
   */
  listCourts(params?: AdminCourtQueryParams): Promise<CourtListResponse> {
    return apiClient.get<CourtListResponse>("/admin/courts", { params }).then((r) => r.data)
  },

  /**
   * POST /admin/courts
   * Creates a new court with slot configuration and optional reference price.
   */
  createCourt(payload: CourtWrite): Promise<CourtResponse> {
    return apiClient.post<CourtResponse>("/admin/courts", payload).then((r) => r.data)
  },

  /**
   * PATCH /admin/courts/:courtId
   * Updates an existing court.
   */
  updateCourt(courtId: string, payload: CourtPatch): Promise<CourtResponse> {
    return apiClient.patch<CourtResponse>(`/admin/courts/${courtId}`, payload).then((r) => r.data)
  },

  /**
   * DELETE /admin/courts/:courtId
   * Deactivates court (soft delete, sets isActive=false).
   */
  deactivateCourt(courtId: string): Promise<void> {
    return apiClient.delete<void>(`/admin/courts/${courtId}`).then((r) => r.data)
  },
}
