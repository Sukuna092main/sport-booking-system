import { Link, useSearchParams } from "react-router-dom"
import { AxiosError } from "axios"
import { ArrowRight, Mail, Lock, Eye, EyeOff, CheckCircle2 } from "lucide-react"
import { useState, type FormEvent, type ChangeEvent } from "react"
import { useLogin } from "@/features/auth/useLogin"
import type { ApiErrorResponse, LoginRequest } from "@/types/auth.types"

interface FieldErrors { email?: string; password?: string }

function validate(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {}
  if (!email) errors.email = "Email không được để trống."
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Email không hợp lệ."
  if (!password) errors.password = "Mật khẩu không được để trống."
  return errors
}

/** Football field decorative SVG overlay */
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

export function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [apiError, setApiError] = useState<string | null>(null)

  const [searchParams] = useSearchParams()
  const justRegistered = searchParams.get("registered") === "1"
  const loginMutation = useLogin()
  const isLoading = loginMutation.isPending

  function handleEmailChange(e: ChangeEvent<HTMLInputElement>) {
    setEmail(e.target.value)
    if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: undefined }))
    setApiError(null)
  }
  function handlePasswordChange(e: ChangeEvent<HTMLInputElement>) {
    setPassword(e.target.value)
    if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: undefined }))
    setApiError(null)
  }
  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setApiError(null)
    const errors = validate(email, password)
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return }
    setFieldErrors({})
    const payload: LoginRequest = { email: email.trim().toLowerCase(), password }
    loginMutation.mutate(payload, {
      onError: (error) => {
        if (error instanceof AxiosError) {
          const data = error.response?.data as ApiErrorResponse | undefined
          const code = data?.error?.code
          if (code === "invalid_credentials") { setApiError("Email hoặc mật khẩu không chính xác."); return }
          if (code === "account_inactive") { setApiError("Tài khoản của bạn đã bị vô hiệu hoá. Vui lòng liên hệ hỗ trợ."); return }
          if (code === "validation_error" && data?.error?.details?.length) {
            const fe: FieldErrors = {}
            data.error.details.forEach((d) => { fe[d.field as keyof FieldErrors] = d.message })
            setFieldErrors(fe); return
          }
          setApiError(data?.error?.message ?? "Đăng nhập thất bại. Vui lòng thử lại.")
        } else { setApiError("Không kết nối được đến máy chủ. Vui lòng thử lại.") }
      },
    })
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
            <p className="text-xs uppercase tracking-widest text-amber-400/80">Hệ thống đặt sân thể thao</p>
          </div>
          <h2 className="text-5xl font-black uppercase leading-tight tracking-tight">
            Sẵn sàng cho<br />
            <span className="text-[#B4FF00]">Trận đấu mới.</span>
          </h2>
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-white/50">
            Đăng nhập để truy cập hồ sơ và tiếp tục sử dụng hệ thống.
          </p>
        </div>

        {/* Bottom bar */}
        <div className="relative z-10 flex items-center justify-between text-[10px] text-white/25 uppercase tracking-widest">
          <span>🔒 Xác thực an toàn</span>
          <span>JWT · Role-based access</span>
        </div>
      </div>

      {/* ─── Right panel: form ─── */}
      <div className="flex w-full flex-col bg-white lg:w-1/2">
        <div className="flex flex-1 items-center justify-center px-8 py-12">
          <div className="w-full max-w-sm">
            {/* Heading */}
            <p className="text-xs font-bold uppercase tracking-widest text-[#16A34A]">Chào mừng trở lại</p>
            <h1 className="mt-1 text-4xl font-black uppercase tracking-tight text-gray-900">Đăng nhập</h1>
            <p className="mt-2 text-sm text-gray-500">Nhập thông tin của bạn để tiếp tục.</p>

            {/* Success banner */}
            {justRegistered && (
              <div role="status" className="mt-5 flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Tài khoản đã được tạo. Vui lòng đăng nhập.</span>
              </div>
            )}

            {/* API error */}
            {apiError && (
              <div role="alert" className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 border border-red-200">
                {apiError}
              </div>
            )}

            <form id="login-form" onSubmit={handleSubmit} noValidate className="mt-7 space-y-4">
              {/* Email */}
              <div>
                <label htmlFor="login-email" className="mb-1.5 block text-sm font-medium text-gray-700">
                  Email <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    id="login-email" name="email" type="email" autoComplete="email"
                    value={email} onChange={handleEmailChange} disabled={isLoading}
                    aria-invalid={!!fieldErrors.email}
                    aria-describedby={fieldErrors.email ? "err-login-email" : undefined}
                    placeholder="name@example.com"
                    className="block w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#16A34A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20 disabled:opacity-50 aria-invalid:border-red-400 aria-invalid:ring-2 aria-invalid:ring-red-200"
                  />
                </div>
                {fieldErrors.email && <p id="err-login-email" className="mt-1.5 text-xs text-red-500">{fieldErrors.email}</p>}
              </div>

              {/* Password */}
              <div>
                <label htmlFor="login-password" className="mb-1.5 block text-sm font-medium text-gray-700">
                  Mật khẩu <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    id="login-password" name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password} onChange={handlePasswordChange} disabled={isLoading}
                    aria-invalid={!!fieldErrors.password}
                    aria-describedby={fieldErrors.password ? "err-login-password" : undefined}
                    placeholder="Nhập mật khẩu"
                    className="block w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-11 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#16A34A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20 disabled:opacity-50 aria-invalid:border-red-400 aria-invalid:ring-2 aria-invalid:ring-red-200"
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
                {fieldErrors.password && <p id="err-login-password" className="mt-1.5 text-xs text-red-500">{fieldErrors.password}</p>}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                aria-busy={isLoading}
                className="mt-2 flex w-full items-center justify-between rounded-xl bg-[#B4FF00] px-6 py-3.5 text-sm font-bold text-gray-900 transition-all hover:bg-[#AAEF00] active:scale-[0.99] disabled:opacity-60"
              >
                <span>{isLoading ? "Đang đăng nhập…" : "Đăng nhập"}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            <p className="mt-5 text-center text-sm text-gray-500">
              Chưa có tài khoản?{" "}
              <Link to="/register" className="font-semibold text-[#16A34A] hover:underline">
                Đăng ký ngay
              </Link>
            </p>
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