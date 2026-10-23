/**
 * Unit tests for courts query keys and helpers.
 */
import { describe, expect, it } from "vitest"
import {
  sportTypesQueryKey,
  courtsQueryKey,
  courtDetailQueryKey,
  courtAvailabilityQueryKey,
} from "@/features/courts/useCourts"

describe("Courts Query Keys", () => {
  it("generates correct sportTypesQueryKey", () => {
    expect(sportTypesQueryKey).toEqual(["sport-types"])
  })

  it("generates correct courtsQueryKey with params", () => {
    const params = { q: "badminton", page: 1, pageSize: 9 }
    expect(courtsQueryKey(params)).toEqual(["courts", "list", params])
  })

  it("generates correct courtsQueryKey without params", () => {
    expect(courtsQueryKey()).toEqual(["courts", "list", undefined])
  })

  it("generates correct courtDetailQueryKey", () => {
    expect(courtDetailQueryKey("court-123")).toEqual(["courts", "detail", "court-123"])
  })

  it("generates correct courtAvailabilityQueryKey", () => {
    expect(courtAvailabilityQueryKey("court-123", "2026-10-15")).toEqual([
      "courts",
      "availability",
      "court-123",
      "2026-10-15",
    ])
  })
})
