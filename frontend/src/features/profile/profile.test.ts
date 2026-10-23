/**
 * Unit tests for profile feature utilities.
 * Tests parseUpdateError and client-side validation logic
 * without requiring a real API or browser environment.
 */
import { describe, expect, it } from "vitest"
import { parseUpdateError } from "@/features/profile/useUpdateProfile"
import { AxiosError } from "axios"
import type { ApiErrorResponse } from "@/types/auth.types"

/* ── Helper: build a minimal AxiosError ── */
function makeAxiosError(
  status: number,
  data: ApiErrorResponse,
): AxiosError<ApiErrorResponse> {
  const err = new AxiosError<ApiErrorResponse>("request failed")
  Object.defineProperty(err, "response", {
    value: { status, data } as AxiosError<ApiErrorResponse>["response"],
    writable: true,
    configurable: true,
  })
  return err
}

describe("parseUpdateError", () => {
  it("returns fieldErrors when backend returns details array", () => {
    const err = makeAxiosError(400, {
      error: {
        code: "validation_error",
        message: "Dữ liệu không hợp lệ.",
        requestId: "req-1",
        details: [
          { field: "fullName", message: "Họ tên từ 1 đến 120 ký tự." },
          { field: "phone", message: "Số điện thoại tối đa 30 ký tự." },
        ],
      },
    })
    const result = parseUpdateError(err)
    expect(result.fieldErrors.fullName).toBe("Họ tên từ 1 đến 120 ký tự.")
    expect(result.fieldErrors.phone).toBe("Số điện thoại tối đa 30 ký tự.")
    expect(result.message).toBeNull()
  })

  it("returns generic message when backend returns top-level error without details", () => {
    const err = makeAxiosError(401, {
      error: {
        code: "unauthorized",
        message: "Cần đăng nhập bằng token hợp lệ.",
        requestId: "req-2",
      },
    })
    const result = parseUpdateError(err)
    expect(result.fieldErrors).toEqual({})
    expect(result.message).toBe("Cần đăng nhập bằng token hợp lệ.")
  })

  it("returns forbidden message for 403 account_inactive", () => {
    const err = makeAxiosError(403, {
      error: {
        code: "account_inactive",
        message: "Tài khoản không hoạt động.",
        requestId: "req-3",
      },
    })
    const result = parseUpdateError(err)
    expect(result.fieldErrors).toEqual({})
    expect(result.message).toBe("Tài khoản không hoạt động.")
  })

  it("returns fallback message for non-axios errors (network failure)", () => {
    const result = parseUpdateError(new Error("Network Error"))
    expect(result.fieldErrors).toEqual({})
    expect(result.message).toBe("Không kết nối được đến máy chủ.")
  })

  it("ignores unknown fields in backend details (only fullName/phone are editable)", () => {
    const err = makeAxiosError(400, {
      error: {
        code: "validation_error",
        message: "Dữ liệu không hợp lệ.",
        requestId: "req-4",
        details: [{ field: "role", message: "Trường này không được phép cập nhật." }],
      },
    })
    const result = parseUpdateError(err)
    // 'role' is not a known editable field — should not bleed into UI
    expect(result.fieldErrors).toEqual({})
    // but the details array is non-empty → message should be null
    expect(result.message).toBeNull()
  })

  it("returns fallback for axios error with no response (connection refused)", () => {
    const err = new AxiosError("Network Error")
    const result = parseUpdateError(err)
    expect(result.fieldErrors).toEqual({})
    expect(result.message).toBe("Lưu thất bại. Vui lòng thử lại.")
  })
})

/* ── Client-side validation rules (mirrors ProfilePage.handleSave) ── */
describe("Profile client-side validation rules", () => {
  function validate(fullName: string, phone: string) {
    const errors: { fullName?: string; phone?: string } = {}
    if (!fullName.trim()) {
      errors.fullName = "Họ tên không được để trống."
    } else if ([...fullName.trim()].length > 120) {
      errors.fullName = "Họ tên tối đa 120 ký tự."
    }
    if (phone && [...phone].length > 30) {
      errors.phone = "Số điện thoại tối đa 30 ký tự."
    }
    return errors
  }

  it("passes valid fullName and no phone", () => {
    expect(validate("Nguyễn Văn A", "")).toEqual({})
  })

  it("requires non-empty fullName", () => {
    expect(validate("   ", "")).toHaveProperty("fullName")
  })

  it("rejects fullName longer than 120 unicode characters", () => {
    const long = "A".repeat(121)
    expect(validate(long, "")).toHaveProperty("fullName")
  })

  it("accepts fullName exactly 120 unicode characters", () => {
    const exact = "Ă".repeat(120) // unicode char — each counts as 1 rune
    expect(validate(exact, "")).toEqual({})
  })

  it("rejects phone longer than 30 unicode characters", () => {
    const long = "1".repeat(31)
    expect(validate("Valid Name", long)).toHaveProperty("phone")
  })

  it("accepts phone exactly 30 characters", () => {
    const exact = "1".repeat(30)
    expect(validate("Valid Name", exact)).toEqual({})
  })

  it("allows empty phone (phone is optional)", () => {
    expect(validate("Nguyễn Văn A", "")).toEqual({})
  })
})
