import { Link } from "react-router-dom"
import { AxiosError } from "axios"
import { ArrowRight, Mail, Lock, Eye, EyeOff, Phone, User } from "lucide-react"
import { useState, type FormEvent, type ChangeEvent } from "react"
import { useRegister } from "@/features/auth/useRegister"
import type { ApiErrorResponse, RegisterRequest } from "@/types/auth.types"

interface FieldErrors {
  email?: string
  password?: string
  fullName?: string
  phone?: string
}

/**
 * Validation — Figma design has no confirmPassword field.
 * Per doc §4.1: "Nếu UI có field này, kiểm tra khớp trước submit."
 * Since the Figma design does not include it, we omit it.
 */
function validate(fields: { email: string; password: string; fullName: string; phone: string }): FieldErrors {
  const errors: FieldErrors = {}
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

function FieldOverlay() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full opacity-10"
      viewBox="0 0 600 400" fill="none" xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="20" y="20" width="560" height="360" rx="4" stroke="white" strokeWidth="1.5" />
      <line x1="300" y1="20" x2="300" y2="380" stroke="white" strokeWidth="1.5" />
      <circle cx="300" cy="200" r="60" stroke="white" strokeWidth="1.5" />
      <circle cx="300" cy="200" r="4" fill="white" />
      <rect x="20" y="140" width="80" height="120" stroke="white" strokeWidth="1.5" />
      <rect x="500" y="140" width="80" height="120" stroke="white" strokeWidth="1.5" />
    </svg>
  )
}

const INITIAL = { email: "", password: "", fullName: "", phone: "" }

export function RegisterPage() {
  const [form, setForm] = useState(INITIAL)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [showPassword, setShowPassword] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  const registerMutation = useRegister()
  const isLoading = registerMutation.isPending

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (fieldErrors[name as keyof FieldErrors]) {
      setFieldErrors((prev) => ({ ...prev, [name]: undefined }))
    }
    setApiError(null)
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setApiError(null)
    const errors = validate(form)
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return }
    setFieldErrors({})

    const payload: RegisterRequest = {
      email: form.email.trim().toLowerCase(),
      password: form.password,
      fullName: form.fullName.trim(),
      ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
    }

    registerMutation.mutate(payload, {
      onError: (error) => {
        if (error instanceof AxiosError) {
          const data = error.response?.data as ApiErrorResponse | undefined
          if (data?.error?.code === "email_taken") {
            setFieldErrors({ email: "Email này đã được sử dụng." }); return
          }
          if (data?.error?.details?.length) {
            const fe: FieldErrors = {}
            data.error.details.forEach((d) => { fe[d.field as keyof FieldErrors] = d.message })
            setFieldErrors(fe); return
          }
          setApiError(data?.error?.message ?? "Đăng ký thất bại. Vui lòng thử lại.")
        } else {
          setApiError("Không kết nối được đến máy chủ. Vui lòng thử lại.")
        }
      },
    })
  }

  return (
    <div className="flex h-screen w-full overflow-hidden font-sans">
      {/* ─── Left panel ─── */}
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

        {/* Copy */}
        <div className="relative z-10">
          <div className="mb-5 flex items-center gap-3">
            <div className="h-px w-8 bg-amber-400/80" />
            <p className="text-xs uppercase tracking-widest text-amber-400/80">Hệ thống đặt sân thể thao</p>
          </div>
          <h2 className="text-5xl font-black uppercase leading-tight tracking-tight">
            Bắt đầu hành trình<br />
            <span className="text-[#B4FF00]">Thể thao của bạn.</span>
          </h2>
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-white/50">
            Tạo tài khoản để bắt đầu sử dụng hệ thống đặt sân thể thao.
          </p>
        </div>

        <div className="relative z-10 flex items-center justify-between text-[10px] text-white/25 uppercase tracking-widest">
          <span>🔒 Bảo thực an toàn</span>
          <span>JWT · Role-based access</span>
        </div>
      </div>

      {/* ─── Right panel: form ─── */}
      <div className="flex w-full flex-col bg-white lg:w-1/2">
        <div className="flex flex-1 items-center justify-center px-8 py-10">
          <div className="w-full max-w-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-[#16A34A]">Tạo tài khoản</p>
            <h1 className="mt-1 text-4xl font-black uppercase tracking-tight text-gray-900">Đăng ký</h1>
            <p className="mt-2 text-sm text-gray-500">Điền thông tin bên dưới để tạo tài khoản User.</p>

            {apiError && (
              <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {apiError}
              </div>
            )}

            <form id="register-form" onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
              {/* Row 1: fullName + phone */}
              <div className="grid grid-cols-2 gap-3">
                {/* fullName */}
                <div>
                  <label htmlFor="register-fullName" className="mb-1.5 block text-sm font-medium text-gray-700">
                    Họ và tên
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      id="register-fullName" name="fullName" type="text" autoComplete="name"
                      value={form.fullName} onChange={handleChange} disabled={isLoading}
                      aria-invalid={!!fieldErrors.fullName}
                      aria-describedby={fieldErrors.fullName ? "err-fullName" : undefined}
                      placeholder="Nhập họ và tên"
                      className="block w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-[#16A34A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20 disabled:opacity-50 aria-invalid:border-red-400"
                    />
                  </div>
                  {fieldErrors.fullName && <p id="err-fullName" className="mt-1 text-xs text-red-500">{fieldErrors.fullName}</p>}
                </div>

                {/* Phone */}
                <div>
                  <label htmlFor="register-phone" className="mb-1.5 block text-sm font-medium text-gray-700">
                    Số điện thoại
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      id="register-phone" name="phone" type="tel" autoComplete="tel"
                      value={form.phone} onChange={handleChange} disabled={isLoading}
                      aria-invalid={!!fieldErrors.phone}
                      aria-describedby={fieldErrors.phone ? "err-phone" : undefined}
                      placeholder="Nhập số điện thoại"
                      className="block w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-[#16A34A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20 disabled:opacity-50 aria-invalid:border-red-400"
                    />
                  </div>
                  {fieldErrors.phone && <p id="err-phone" className="mt-1 text-xs text-red-500">{fieldErrors.phone}</p>}
                </div>
              </div>

              {/* Email */}
              <div>
                <label htmlFor="register-email" className="mb-1.5 block text-sm font-medium text-gray-700">
                  Email <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    id="register-email" name="email" type="email" autoComplete="email"
                    value={form.email} onChange={handleChange} disabled={isLoading}
                    aria-invalid={!!fieldErrors.email}
                    aria-describedby={fieldErrors.email ? "err-email" : undefined}
                    placeholder="name@example.com"
                    className="block w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-sm placeholder:text-gray-400 focus:border-[#16A34A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20 disabled:opacity-50 aria-invalid:border-red-400"
                  />
                </div>
                {fieldErrors.email && <p id="err-email" className="mt-1.5 text-xs text-red-500">{fieldErrors.email}</p>}
              </div>

              {/* Password */}
              <div>
                <label htmlFor="register-password" className="mb-1.5 block text-sm font-medium text-gray-700">
                  Mật khẩu <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    id="register-password" name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={form.password} onChange={handleChange} disabled={isLoading}
                    aria-invalid={!!fieldErrors.password}
                    aria-describedby={fieldErrors.password ? "err-password" : undefined}
                    placeholder="Nhập mật khẩu"
                    className="block w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-11 text-sm placeholder:text-gray-400 focus:border-[#16A34A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20 disabled:opacity-50 aria-invalid:border-red-400"
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
                {fieldErrors.password && <p id="err-password" className="mt-1.5 text-xs text-red-500">{fieldErrors.password}</p>}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                aria-busy={isLoading}
                className="mt-2 flex w-full items-center justify-between rounded-xl bg-[#B4FF00] px-6 py-3.5 text-sm font-bold text-gray-900 transition-all hover:bg-[#AAEF00] active:scale-[0.99] disabled:opacity-60"
              >
                <span>{isLoading ? "Đang tạo tài khoản…" : "Tạo tài khoản"}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            <p className="mt-5 text-center text-sm text-gray-500">
              Đã có tài khoản?{" "}
              <Link to="/login" className="font-semibold text-[#16A34A] hover:underline">
                Đăng nhập
              </Link>
            </p>
          </div>
        </div>
        <p className="py-4 text-center text-[10px] text-gray-400">
          © 2026 Hệ thống Đặt sân thể thao.
        </p>
      </div>
    </div>
  )
}