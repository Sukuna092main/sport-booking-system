import { useState, type FormEvent, type ChangeEvent } from "react"
import { Link } from "react-router-dom"
import { AxiosError } from "axios"
import { ArrowLeft, ArrowRight, Mail, CheckCircle2, AlertCircle } from "lucide-react"
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

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [emailError, setEmailError] = useState<string | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  function handleEmailChange(e: ChangeEvent<HTMLInputElement>) {
    setEmail(e.target.value)
    if (emailError) setEmailError(null)
    if (apiError) setApiError(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setApiError(null)

    const trimmed = email.trim().toLowerCase()
    if (!trimmed) {
      setEmailError("Email không được để trống.")
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError("Email không hợp lệ.")
      return
    }

    setIsSubmitting(true)

    try {
      await authApi.forgotPassword({ email: trimmed })
      setIsSubmitted(true)
    } catch (err) {
      if (err instanceof AxiosError) {
        const data = err.response?.data as ApiErrorResponse | undefined
        if (err.response?.status === 429) {
          setApiError("Bạn đã gửi yêu cầu quá nhanh. Vui lòng thử lại sau ít phút.")
          return
        }
        setApiError(data?.error?.message ?? "Không thể gửi yêu cầu đặt lại mật khẩu. Vui lòng thử lại.")
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
            <p className="text-xs uppercase tracking-widest text-amber-400/80">Khôi phục quyền truy cập</p>
          </div>
          <h2 className="text-5xl font-black uppercase leading-tight tracking-tight">
            Quên mật khẩu?<br />
            <span className="text-[#B4FF00]">Khôi phục an toàn.</span>
          </h2>
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-white/50">
            Chúng tôi sẽ gửi liên kết bảo mật có thời hạn 15 phút đến hộp thư điện tử của bạn.
          </p>
        </div>

        {/* Bottom bar */}
        <div className="relative z-10 flex items-center justify-between text-[10px] text-white/25 uppercase tracking-widest">
          <span>🔒 Mã hóa AES-256</span>
          <span>Bảo mật phiên · Token 1 lần</span>
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
            <p className="text-xs font-bold uppercase tracking-widest text-[#16A34A]">Khôi phục tài khoản</p>
            <h1 className="mt-1 text-4xl font-black uppercase tracking-tight text-gray-900">Quên mật khẩu</h1>
            <p className="mt-2 text-sm text-gray-500">
              Nhập email đã đăng ký của bạn để nhận liên kết đặt lại mật khẩu.
            </p>

            {/* Success state */}
            {isSubmitted ? (
              <div role="status" className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-bold text-emerald-900">Đã gửi yêu cầu khôi phục</h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-emerald-800">
                      Nếu email <span className="font-semibold text-emerald-950">{email}</span> tồn tại trong hệ thống,
                      hướng dẫn đặt lại mật khẩu đã được gửi đến hộp thư của bạn.
                    </p>
                    <p className="mt-2 text-[11px] text-emerald-700">
                      💡 Vui lòng kiểm tra cả thư mục <strong>Spam / Thư rác</strong> nếu bạn không thấy email trong vài phút.
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex flex-col gap-2">
                  <Link
                    to="/login"
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-xs font-bold text-white hover:bg-emerald-800 transition-colors"
                  >
                    Quay lại màn hình đăng nhập
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSubmitted(false)
                      setEmail("")
                    }}
                    className="text-center text-xs font-semibold text-gray-500 hover:text-gray-900 transition-colors py-1"
                  >
                    Gửi lại với email khác
                  </button>
                </div>
              </div>
            ) : (
              /* Request form */
              <form id="forgot-password-form" onSubmit={handleSubmit} noValidate className="mt-7 space-y-4">
                {apiError && (
                  <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{apiError}</span>
                  </div>
                )}

                <div>
                  <label htmlFor="forgot-email" className="mb-1.5 block text-sm font-medium text-gray-700">
                    Email tài khoản <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      id="forgot-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={handleEmailChange}
                      disabled={isSubmitting}
                      aria-invalid={!!emailError}
                      aria-describedby={emailError ? "err-forgot-email" : undefined}
                      placeholder="name@example.com"
                      className="block w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#16A34A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20 disabled:opacity-50 aria-invalid:border-red-400 aria-invalid:ring-2 aria-invalid:ring-red-200"
                    />
                  </div>
                  {emailError && <p id="err-forgot-email" className="mt-1.5 text-xs text-red-500">{emailError}</p>}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  aria-busy={isSubmitting}
                  className="mt-2 flex w-full items-center justify-between rounded-xl bg-[#B4FF00] px-6 py-3.5 text-sm font-bold text-gray-900 transition-all hover:bg-[#AAEF00] active:scale-[0.99] disabled:opacity-60"
                >
                  <span>{isSubmitting ? "Đang gửi yêu cầu…" : "Gửi liên kết khôi phục"}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            )}

            <p className="mt-6 text-center text-sm text-gray-500">
              Nhớ mật khẩu của bạn?{" "}
              <Link to="/login" className="font-semibold text-[#16A34A] hover:underline">
                Đăng nhập ngay
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
