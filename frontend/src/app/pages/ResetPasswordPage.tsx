import { useState, type FormEvent, type ChangeEvent } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { AxiosError } from "axios"
import { ArrowLeft, ArrowRight, Lock, Eye, EyeOff, CheckCircle2, AlertCircle, KeyRound } from "lucide-react"
import { authApi } from "@/lib/api/auth"
import type { ApiErrorResponse } from "@/types/auth.types"

/** Football field decorative SVG overlay matching LoginPage */
function FieldOverlay() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full opacity-10"
      viewBox="0 0 600 400"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="20" y="20" width="560" height="360" rx="4" stroke="white" strokeWidth="1.5" />
      <line x1="300" y1="20" x2="300" y2="380" stroke="white" strokeWidth="1.5" />
      <circle cx="300" cy="200" r="60" stroke="white" strokeWidth="1.5" />
      <circle cx="300" cy="200" r="4" fill="white" />
      <rect x="20" y="140" width="80" height="120" stroke="white" strokeWidth="1.5" />
      <rect x="500" y="140" width="80" height="120" stroke="white" strokeWidth="1.5" />
      <path d="M20 200 Q 300 100 580 200" stroke="white" strokeWidth="0.5" strokeDasharray="6 4" />
    </svg>
  )
}

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const initialToken = searchParams.get("token") || ""

  const [token, setToken] = useState(initialToken)
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  const [fieldErrors, setFieldErrors] = useState<{
    token?: string
    newPassword?: string
    confirmPassword?: string
  }>({})
  const [apiError, setApiError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  function validate() {
    const errors: { token?: string; newPassword?: string; confirmPassword?: string } = {}
    if (!token.trim()) {
      errors.token = "Mã xác thực token không được để trống."
    }
    if (!newPassword) {
      errors.newPassword = "Mật khẩu mới không được để trống."
    } else if (newPassword.length < 8) {
      errors.newPassword = "Mật khẩu mới phải có ít nhất 8 ký tự."
    } else if (newPassword.length > 72) {
      errors.newPassword = "Mật khẩu mới tối đa 72 ký tự."
    }
    if (newPassword !== confirmPassword) {
      errors.confirmPassword = "Xác nhận mật khẩu không khớp với mật khẩu mới."
    }
    return errors
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setApiError(null)

    const errors = validate()
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }
    setFieldErrors({})
    setIsSubmitting(true)

    try {
      await authApi.resetPassword({
        token: token.trim(),
        newPassword,
      })
      setIsSuccess(true)
    } catch (err) {
      if (err instanceof AxiosError) {
        const data = err.response?.data as ApiErrorResponse | undefined
        const code = data?.error?.code
        if (code === "invalid_or_expired_token") {
          setApiError("Liên kết hoặc mã đặt lại mật khẩu đã hết hạn hoặc không hợp lệ. Vui lòng yêu cầu liên kết mới.")
        } else if (code === "validation_error" && data?.error?.details?.length) {
          const fe: typeof fieldErrors = {}
          data.error.details.forEach((d) => {
            if (d.field === "token") fe.token = d.message
            if (d.field === "newPassword") fe.newPassword = d.message
          })
          setFieldErrors(fe)
        } else {
          setApiError(data?.error?.message ?? "Không thể đặt lại mật khẩu. Vui lòng thử lại.")
        }
      } else {
        setApiError("Không thể kết nối đến máy chủ. Vui lòng thử lại.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex h-screen w-full overflow-hidden font-sans">
      {/* ─── Left panel: dark green ─── */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-[#0A1A0D] p-10 text-white lg:flex">
        <FieldOverlay />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#22C55E]">
            <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
              <rect width="18" height="2.5" rx="1.25" fill="white" />
              <rect y="5.5" width="14" height="2.5" rx="1.25" fill="white" />
              <rect y="11" width="18" height="2.5" rx="1.25" fill="white" />
            </svg>
          </div>
          <div>
            <p className="text-base font-black tracking-wider text-white">SÂN</p>
            <p className="text-[9px] uppercase tracking-widest text-white/40">Đặt sân thể thao</p>
          </div>
        </div>

        {/* Main copy */}
        <div className="relative z-10">
          <div className="mb-5 flex items-center gap-3">
            <div className="h-px w-8 bg-amber-400/80" />
            <p className="text-xs uppercase tracking-widest text-amber-400/80">Thiết lập mật khẩu mới</p>
          </div>
          <h2 className="text-5xl font-black uppercase leading-tight tracking-tight">
            Khôi phục<br />
            <span className="text-[#B4FF00]">Mật khẩu mới.</span>
          </h2>
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-white/50">
            Đặt lại mật khẩu của bạn để bảo vệ tài khoản và tiếp tục đặt sân thể thao nhanh chóng.
          </p>
        </div>

        {/* Bottom bar */}
        <div className="relative z-10 flex items-center justify-between text-[10px] text-white/25 uppercase tracking-widest">
          <span>🔒 Mã hóa an toàn Bcrypt</span>
          <span>Hủy phiên cũ tự động</span>
        </div>
      </div>

      {/* ─── Right panel: form ─── */}
      <div className="flex w-full flex-col bg-white lg:w-1/2">
        <div className="flex flex-1 items-center justify-center px-8 py-12">
          <div className="w-full max-w-sm">
            <Link
              to="/login"
              className="mb-6 inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-gray-700 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Quay lại đăng nhập
            </Link>

            {/* Heading */}
            <p className="text-xs font-bold uppercase tracking-widest text-[#16A34A]">Bảo mật tài khoản</p>
            <h1 className="mt-1 text-4xl font-black uppercase tracking-tight text-gray-900">Đặt lại mật khẩu</h1>
            <p className="mt-2 text-sm text-gray-500">
              Nhập mã xác thực và mật khẩu mới cho tài khoản của bạn.
            </p>

            {/* Success state */}
            {isSuccess ? (
              <div role="status" className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-bold text-emerald-900">Đặt lại mật khẩu thành công!</h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-emerald-800">
                      Mật khẩu của bạn đã được cập nhật thành công. Mọi phiên đăng nhập cũ trên các thiết bị khác đã được thu hồi an toàn.
                    </p>
                  </div>
                </div>

                <div className="mt-6">
                  <Link
                    to="/login"
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#B4FF00] px-5 py-3 text-xs font-bold text-gray-900 hover:bg-[#AAEF00] transition-colors"
                  >
                    <span>Đăng nhập ngay</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            ) : (
              /* Reset form */
              <form id="reset-password-form" onSubmit={handleSubmit} noValidate className="mt-7 space-y-4">
                {apiError && (
                  <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <span>{apiError}</span>
                      {apiError.includes("hết hạn") && (
                        <div className="mt-2">
                          <Link to="/forgot-password" className="text-xs font-bold text-red-700 underline">
                            Gửi lại yêu cầu quên mật khẩu
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Token (if not present in URL query) */}
                {!initialToken && (
                  <div>
                    <label htmlFor="reset-token" className="mb-1.5 block text-sm font-medium text-gray-700">
                      Mã token một lần <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <KeyRound className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <input
                        id="reset-token"
                        name="token"
                        type="text"
                        value={token}
                        onChange={(e) => {
                          setToken(e.target.value)
                          if (fieldErrors.token) setFieldErrors((p) => ({ ...p, token: undefined }))
                        }}
                        disabled={isSubmitting}
                        aria-invalid={!!fieldErrors.token}
                        placeholder="Dán mã token từ email"
                        className="block w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-sm font-mono text-gray-900 placeholder:text-gray-400 focus:border-[#16A34A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20 disabled:opacity-50"
                      />
                    </div>
                    {fieldErrors.token && <p className="mt-1.5 text-xs text-red-500">{fieldErrors.token}</p>}
                  </div>
                )}

                {/* New Password */}
                <div>
                  <label htmlFor="new-password" className="mb-1.5 block text-sm font-medium text-gray-700">
                    Mật khẩu mới (8-72 ký tự) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      id="new-password"
                      name="newPassword"
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => {
                        setNewPassword(e.target.value)
                        if (fieldErrors.newPassword) setFieldErrors((p) => ({ ...p, newPassword: undefined }))
                      }}
                      disabled={isSubmitting}
                      aria-invalid={!!fieldErrors.newPassword}
                      placeholder="Nhập mật khẩu mới"
                      className="block w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-11 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#16A34A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20 disabled:opacity-50 aria-invalid:border-red-400"
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute inset-y-0 right-3.5 flex items-center text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {fieldErrors.newPassword && <p className="mt-1.5 text-xs text-red-500">{fieldErrors.newPassword}</p>}
                </div>

                {/* Confirm Password */}
                <div>
                  <label htmlFor="confirm-password" className="mb-1.5 block text-sm font-medium text-gray-700">
                    Xác nhận mật khẩu mới <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      id="confirm-password"
                      name="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => {
                        setConfirmPassword(e.target.value)
                        if (fieldErrors.confirmPassword) setFieldErrors((p) => ({ ...p, confirmPassword: undefined }))
                      }}
                      disabled={isSubmitting}
                      aria-invalid={!!fieldErrors.confirmPassword}
                      placeholder="Nhập lại mật khẩu mới"
                      className="block w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#16A34A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20 disabled:opacity-50 aria-invalid:border-red-400"
                    />
                  </div>
                  {fieldErrors.confirmPassword && <p className="mt-1.5 text-xs text-red-500">{fieldErrors.confirmPassword}</p>}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  aria-busy={isSubmitting}
                  className="mt-2 flex w-full items-center justify-between rounded-xl bg-[#B4FF00] px-6 py-3.5 text-sm font-bold text-gray-900 transition-all hover:bg-[#AAEF00] active:scale-[0.99] disabled:opacity-60"
                >
                  <span>{isSubmitting ? "Đang xử lý…" : "Đổi mật khẩu & Lưu"}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Copyright */}
        <p className="py-4 text-center text-[10px] text-gray-400">
          © 2026 Hệ thống Đặt sân thể thao.
        </p>
      </div>
    </div>
  )
}
