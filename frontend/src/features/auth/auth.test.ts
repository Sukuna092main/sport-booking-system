/**
 * Unit tests for Auth utilities, tokenStorage, and validation rules.
 */
import { describe, expect, it, beforeEach } from "vitest"
import { tokenStorage } from "@/lib/auth/token"
import { getApiErrorMessage } from "@/features/auth/errorUtils"
import { AxiosError } from "axios"
import type { ApiErrorResponse } from "@/types/auth.types"

/* ── In-memory mock for localStorage in Node/Vitest environment ── */
const storageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(globalThis, "localStorage", {
  value: storageMock,
  writable: true,
})

/* ── 1. Token storage unit tests ── */
describe("tokenStorage", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("returns null when no token is stored", () => {
    expect(tokenStorage.get()).toBeNull()
  })

  it("saves and retrieves access token correctly", () => {
    tokenStorage.set("test-token-xyz")
    expect(tokenStorage.get()).toBe("test-token-xyz")
  })

  it("clears stored token and expiration", () => {
    tokenStorage.set("test-token-xyz", new Date(Date.now() + 60000).toISOString())
    expect(tokenStorage.get()).toBe("test-token-xyz")
    tokenStorage.clear()
    expect(tokenStorage.get()).toBeNull()
  })

  it("returns false for isExpired when no expiration is set", () => {
    tokenStorage.set("token-no-exp")
    expect(tokenStorage.isExpired()).toBe(false)
  })

  it("returns true for isExpired when expiration is in the past", () => {
    const past = new Date(Date.now() - 10000).toISOString()
    tokenStorage.set("expired-token", past)
    expect(tokenStorage.isExpired()).toBe(true)
  })

  it("returns false for isExpired when expiration is in the future", () => {
    const future = new Date(Date.now() + 600000).toISOString()
    tokenStorage.set("valid-token", future)
    expect(tokenStorage.isExpired()).toBe(false)
  })
})

/* ── 2. Error message extraction unit tests ── */
describe("getApiErrorMessage", () => {
  it("extracts message from error response", () => {
    const err = new AxiosError<ApiErrorResponse>("Request failed")
    Object.defineProperty(err, "response", {
      value: {
        status: 401,
        data: {
          error: {
            code: "invalid_credentials",
            message: "Email hoặc mật khẩu không chính xác.",
            requestId: "req-123",
          },
        },
      },
    })
    expect(getApiErrorMessage(err)).toBe("Email hoặc mật khẩu không chính xác.")
  })

  it("extracts details messages if top-level message is absent", () => {
    const err = new AxiosError<ApiErrorResponse>("Request failed")
    Object.defineProperty(err, "response", {
      value: {
        status: 400,
        data: {
          error: {
            code: "validation_error",
            message: "",
            requestId: "req-456",
            details: [
              { field: "email", message: "Email không được để trống." },
              { field: "password", message: "Mật khẩu tối thiểu 8 ký tự." },
            ],
          },
        },
      },
    })
    expect(getApiErrorMessage(err)).toBe("Email không được để trống.; Mật khẩu tối thiểu 8 ký tự.")
  })

  it("returns fallback for non-axios error", () => {
    expect(getApiErrorMessage(new Error("Unknown error"))).toBe("Đã xảy ra lỗi. Vui lòng thử lại.")
  })
})

/* ── 3. Validation logic unit tests (mirrors LoginPage & RegisterPage) ── */
describe("Auth Form Validations", () => {
  function validateLogin(email: string, pass: string) {
    const errors: { email?: string; password?: string } = {}
    if (!email) errors.email = "Email không được để trống."
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Email không hợp lệ."
    if (!pass) errors.password = "Mật khẩu không được để trống."
    return errors
  }

  function validateRegister(fields: { email: string; password: string; fullName: string; phone: string }) {
    const errors: { email?: string; password?: string; fullName?: string; phone?: string } = {}
    if (!fields.fullName.trim()) errors.fullName = "Họ tên không được để trống."
    else if (fields.fullName.trim().length > 120) errors.fullName = "Họ tên tối đa 120 ký tự."
    if (!fields.email) errors.email = "Email không được để trống."
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) errors.email = "Email không hợp lệ."
    if (!fields.password) errors.password = "Mật khẩu không được để trống."
    else if (fields.password.length < 8) errors.password = "Mật khẩu tối thiểu 8 ký tự."
    else if (fields.password.length > 72) errors.password = "Mật khẩu tối đa 72 ký tự."
    if (fields.phone && fields.phone.length > 30) errors.phone = "Số điện thoại tối đa 30 ký tự."
    return errors
  }

  it("validates login correctly", () => {
    expect(validateLogin("", "")).toHaveProperty("email")
    expect(validateLogin("", "")).toHaveProperty("password")
    expect(validateLogin("invalid-email", "pass123")).toHaveProperty("email")
    expect(validateLogin("user@example.com", "validPass123")).toEqual({})
  })

  it("validates register correctly", () => {
    expect(validateRegister({ email: "", password: "", fullName: "", phone: "" })).toHaveProperty("fullName")
    expect(validateRegister({ email: "test@example.com", password: "short", fullName: "User", phone: "" })).toHaveProperty("password")
    expect(validateRegister({ email: "test@example.com", password: "validPassword123", fullName: "User", phone: "0901234567" })).toEqual({})
  })
})
