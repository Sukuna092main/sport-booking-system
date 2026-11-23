import { describe, it, expect } from "vitest"
import { authApi } from "@/lib/api/auth"

describe("Auth Advanced Services & Contracts", () => {
  it("should have all required auth API functions defined", () => {
    expect(typeof authApi.forgotPassword).toBe("function")
    expect(typeof authApi.resetPassword).toBe("function")
    expect(typeof authApi.changePassword).toBe("function")
    expect(typeof authApi.logout).toBe("function")
    expect(typeof authApi.logoutAll).toBe("function")
    expect(typeof authApi.refresh).toBe("function")
  })

  describe("Password Reset Input Validation Rules", () => {
    function validateResetInput(token: string, newPassword: string, confirmPassword: string) {
      const errors: Record<string, string> = {}
      if (!token.trim()) errors.token = "Mã xác thực token không được để trống."
      if (!newPassword) errors.newPassword = "Mật khẩu mới không được để trống."
      else if (newPassword.length < 8) errors.newPassword = "Mật khẩu mới phải có ít nhất 8 ký tự."
      else if (newPassword.length > 72) errors.newPassword = "Mật khẩu mới tối đa 72 ký tự."
      if (newPassword !== confirmPassword) errors.confirmPassword = "Xác nhận mật khẩu không khớp."
      return errors
    }

    it("rejects empty token", () => {
      const err = validateResetInput("", "password123", "password123")
      expect(err.token).toBeDefined()
    })

    it("rejects password less than 8 characters", () => {
      const err = validateResetInput("token-123", "short", "short")
      expect(err.newPassword).toContain("ít nhất 8 ký tự")
    })

    it("rejects password greater than 72 characters", () => {
      const longPw = "a".repeat(73)
      const err = validateResetInput("token-123", longPw, longPw)
      expect(err.newPassword).toContain("tối đa 72 ký tự")
    })

    it("rejects mismatched passwords", () => {
      const err = validateResetInput("token-123", "password123", "different123")
      expect(err.confirmPassword).toContain("không khớp")
    })

    it("accepts valid input", () => {
      const err = validateResetInput("token-123", "validPassword123", "validPassword123")
      expect(Object.keys(err)).toHaveLength(0)
    })
  })

  describe("Change Password Input Validation Rules", () => {
    function validateChangePassword(current: string, next: string, confirm: string) {
      const errors: Record<string, string> = {}
      if (!current) errors.currentPassword = "Mật khẩu hiện tại không được để trống."
      if (!next) errors.newPassword = "Mật khẩu mới không được để trống."
      else if (next.length < 8) errors.newPassword = "Mật khẩu mới phải có tối thiểu 8 ký tự."
      else if (next.length > 72) errors.newPassword = "Mật khẩu mới tối đa 72 ký tự."
      if (next !== confirm) errors.confirmPassword = "Xác nhận mật khẩu mới không khớp."
      return errors
    }

    it("rejects empty current password", () => {
      const err = validateChangePassword("", "newPassword123", "newPassword123")
      expect(err.currentPassword).toBeDefined()
    })

    it("rejects short new password", () => {
      const err = validateChangePassword("oldPass123", "12345", "12345")
      expect(err.newPassword).toContain("tối thiểu 8 ký tự")
    })

    it("accepts valid change password fields", () => {
      const err = validateChangePassword("oldPass123", "newPass1234", "newPass1234")
      expect(Object.keys(err)).toHaveLength(0)
    })
  })

  describe("Forgot Password Email Validation", () => {
    function validateForgotEmail(email: string) {
      const trimmed = email.trim().toLowerCase()
      if (!trimmed) return "Email không được để trống."
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return "Email không hợp lệ."
      return null
    }

    it("rejects invalid email formats", () => {
      expect(validateForgotEmail("")).toBe("Email không được để trống.")
      expect(validateForgotEmail("invalid-email")).toBe("Email không hợp lệ.")
      expect(validateForgotEmail("missing@domain")).toBe("Email không hợp lệ.")
    })

    it("accepts valid email format", () => {
      expect(validateForgotEmail("test@example.com")).toBeNull()
      expect(validateForgotEmail("admin@sportbooking.vn")).toBeNull()
    })
  })
})
