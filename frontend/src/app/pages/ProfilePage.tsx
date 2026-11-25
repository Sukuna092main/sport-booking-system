import { type ReactNode, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { AxiosError } from "axios"
import {
  Loader2, AlertCircle, Pencil, X, Check,
  User as UserIcon, Mail, Phone, Shield, Key, Activity,
  Lock, CheckCircle2, KeyRound, LogOut, Eye, EyeOff, ShieldCheck,
} from "lucide-react"
import { useAuth } from "@/features/auth/useAuth"
import { useProfile } from "@/features/profile/useProfile"
import { useUpdateProfile, parseUpdateError } from "@/features/profile/useUpdateProfile"
import type { UpdateProfileFieldErrors } from "@/features/profile/useUpdateProfile"
import { authApi } from "@/lib/api/auth"
import type { ApiErrorResponse } from "@/types/auth.types"

/* ──────────────────────────────────────────────
   Sub-components
   ────────────────────────────────────────────── */

function ReadOnlyField({
  icon, label, value,
}: { icon: ReactNode; label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-gray-50/60 px-4 py-3">
      <span className="mt-0.5 text-gray-400">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
        <p className="mt-0.5 truncate text-sm font-semibold text-gray-800">
          {value || <span className="font-normal italic text-gray-400">Chưa cập nhật</span>}
        </p>
      </div>
      <span className="flex items-center gap-0.5 text-[10px] text-gray-300">
        <Lock className="h-2.5 w-2.5" /> Chỉ đọc
      </span>
    </div>
  )
}

function EditableField({
  icon, label, name, value, placeholder, onChange, error, disabled,
}: {
  icon: ReactNode; label: string; name: string; value: string
  placeholder?: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  error?: string; disabled: boolean
}) {
  return (
    <div>
      <label
        htmlFor={`profile-field-${name}`}
        className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-gray-400"
      >
        {label}
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{icon}</span>
        <input
          id={`profile-field-${name}`}
          name={name}
          value={value}
          onChange={onChange}
          disabled={disabled}
          placeholder={placeholder}
          aria-invalid={!!error}
          aria-describedby={error ? `profile-err-${name}` : undefined}
          className="block w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm font-medium text-gray-800 focus:border-[#16A34A] focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20 disabled:opacity-50 aria-invalid:border-red-400 aria-invalid:ring-2 aria-invalid:ring-red-200"
        />
      </div>
      {error && <p id={`profile-err-${name}`} className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}

/* ──────────────────────────────────────────────
   ProfilePage
   ────────────────────────────────────────────── */

export function ProfilePage() {
  const { logout, logoutAll } = useAuth()
  const navigate = useNavigate()

  /* ── Data fetching ── */
  const { data: profile, isLoading, error: fetchError } = useProfile()
  const updateMutation = useUpdateProfile()

  /* ── Edit mode state ── */
  const [isEditing, setIsEditing] = useState(false)
  const [editFullName, setEditFullName] = useState("")
  const [editPhone, setEditPhone] = useState("")
  const [editErrors, setEditErrors] = useState<UpdateProfileFieldErrors>({})
  const [saveError, setSaveError] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)

  /* ── Change Password Modal state ── */
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [passwordErrors, setPasswordErrors] = useState<{
    currentPassword?: string
    newPassword?: string
    confirmPassword?: string
  }>({})
  const [passwordApiError, setPasswordApiError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [isLoggingOutAll, setIsLoggingOutAll] = useState(false)

  /* Hide success banner after 3 s */
  useEffect(() => {
    if (!showSuccess) return
    const id = setTimeout(() => setShowSuccess(false), 3000)
    return () => clearTimeout(id)
  }, [showSuccess])

  /* ── Auth ── */
  function handleLogout() {
    logout()
    navigate("/login", { replace: true })
  }

  async function handleLogoutAll() {
    if (!window.confirm("Bạn có chắc chắn muốn đăng xuất khỏi tất cả các thiết bị?")) return
    setIsLoggingOutAll(true)
    try {
      await logoutAll()
      navigate("/login", { replace: true })
    } catch {
      logout()
      navigate("/login", { replace: true })
    } finally {
      setIsLoggingOutAll(false)
    }
  }

  /* ── Change Password Handlers ── */
  function openPasswordModal() {
    setCurrentPassword("")
    setNewPassword("")
    setConfirmPassword("")
    setPasswordErrors({})
    setPasswordApiError(null)
    setPasswordSuccess(null)
    setShowPasswordModal(true)
  }

  function closePasswordModal() {
    setShowPasswordModal(false)
    setPasswordApiError(null)
  }

  async function handleChangePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPasswordApiError(null)

    const errors: typeof passwordErrors = {}
    if (!currentPassword) errors.currentPassword = "Mật khẩu hiện tại không được để trống."
    if (!newPassword) {
      errors.newPassword = "Mật khẩu mới không được để trống."
    } else if (newPassword.length < 8) {
      errors.newPassword = "Mật khẩu mới phải có tối thiểu 8 ký tự."
    } else if (newPassword.length > 72) {
      errors.newPassword = "Mật khẩu mới tối đa 72 ký tự."
    }
    if (newPassword !== confirmPassword) {
      errors.confirmPassword = "Xác nhận mật khẩu mới không khớp."
    }

    if (Object.keys(errors).length > 0) {
      setPasswordErrors(errors)
      return
    }
    setPasswordErrors({})
    setIsChangingPassword(true)

    try {
      await authApi.changePassword({ currentPassword, newPassword })
      setPasswordSuccess("Đã đổi mật khẩu thành công. Hệ thống đang chuyển về màn hình đăng nhập…")
      setTimeout(() => {
        logout()
        navigate("/login", { replace: true })
      }, 1500)
    } catch (err: unknown) {
      if (err instanceof AxiosError) {
        const data = err.response?.data as ApiErrorResponse | undefined
        const code = data?.error?.code
        if (code === "invalid_current_password") {
          setPasswordApiError("Mật khẩu hiện tại không chính xác.")
        } else if (code === "validation_error" && data?.error?.details?.length) {
          const fe: typeof passwordErrors = {}
          data.error.details.forEach((d) => {
            if (d.field === "currentPassword") fe.currentPassword = d.message
            if (d.field === "newPassword") fe.newPassword = d.message
          })
          setPasswordErrors(fe)
        } else {
          setPasswordApiError(data?.error?.message ?? "Không thể đổi mật khẩu. Vui lòng thử lại.")
        }
      } else {
        setPasswordApiError("Lỗi kết nối máy chủ. Vui lòng thử lại.")
      }
    } finally {
      setIsChangingPassword(false)
    }
  }

  /* ── Edit helpers ── */
  function startEdit() {
    if (!profile) return
    setEditFullName(profile.fullName)
    setEditPhone(profile.phone ?? "")
    setEditErrors({})
    setSaveError(null)
    setIsEditing(true)
  }

  function cancelEdit() {
    setIsEditing(false)
    setSaveError(null)
    updateMutation.reset()
  }

  function handleEditChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target
    if (name === "fullName") setEditFullName(value)
    if (name === "phone") setEditPhone(value)
    setEditErrors((p) => ({ ...p, [name]: undefined }))
    setSaveError(null)
  }

  function validate(): UpdateProfileFieldErrors {
    const errors: UpdateProfileFieldErrors = {}
    if (!editFullName.trim()) {
      errors.fullName = "Họ tên không được để trống."
    } else if ([...editFullName.trim()].length > 120) {
      errors.fullName = "Họ tên tối đa 120 ký tự."
    }
    if (editPhone && [...editPhone].length > 30) {
      errors.phone = "Số điện thoại tối đa 30 ký tự."
    }
    return errors
  }

  async function handleSave() {
    const clientErrors = validate()
    if (Object.keys(clientErrors).length > 0) {
      setEditErrors(clientErrors)
      return
    }

    setSaveError(null)
    setEditErrors({})

    try {
      await updateMutation.mutateAsync({
        fullName: editFullName,
        phone: editPhone.trim() || null,
      })
      setIsEditing(false)
      setShowSuccess(true)
    } catch (err) {
      const parsed = parseUpdateError(err)
      if (Object.keys(parsed.fieldErrors).length > 0) {
        setEditErrors(parsed.fieldErrors)
      } else {
        setSaveError(parsed.message)
      }
    }
  }

  const fetchErrorMessage = (() => {
    if (!fetchError) return null
    const status = (fetchError as { response?: { status: number } })?.response?.status
    if (status === 401) return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
    if (status === 403) return "Tài khoản của bạn đã bị vô hiệu hoá."
    return "Không thể tải hồ sơ. Vui lòng thử lại."
  })()

  if (isLoading) {
    return (
      <section className="flex min-h-[20rem] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#16A34A]" />
        <span className="ml-2 text-sm text-gray-500">Đang tải hồ sơ…</span>
      </section>
    )
  }

  if (fetchErrorMessage) {
    return (
      <section className="py-10">
        <h1 className="mb-6 text-3xl font-black uppercase tracking-tight">Hồ sơ cá nhân</h1>
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-600">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">{fetchErrorMessage}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-1 underline underline-offset-2 hover:no-underline"
            >
              Tải lại trang
            </button>
          </div>
        </div>
      </section>
    )
  }

  if (!profile) return null

  const isSaving = updateMutation.isPending

  return (
    <section className="py-8">
      {/* Page header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#16A34A]">Tài khoản của bạn</p>
          <h1 className="text-3xl font-black uppercase tracking-tight text-gray-900">Hồ sơ cá nhân</h1>
        </div>
        {!isEditing && (
          <button
            id="profile-edit-btn"
            onClick={startEdit}
            className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 shadow-2xs hover:bg-gray-50 transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
            Chỉnh sửa thông tin
          </button>
        )}
      </div>

      {/* Success banner */}
      {showSuccess && (
        <div role="status" className="mb-6 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>Hồ sơ đã được cập nhật thành công.</span>
        </div>
      )}

      {/* Save error banner */}
      {saveError && (
        <div role="alert" className="mb-6 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      {/* ── Profile card ── */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xs">
        {/* Banner with avatar */}
        <div className="relative h-24 bg-gradient-to-r from-[#0A1A0D] to-[#16421E] px-6">
          <div className="absolute -bottom-6 flex items-end gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-white bg-[#16A34A] text-xl font-black text-white shadow-md">
              {profile.fullName.slice(0, 1).toUpperCase()}
            </div>
            <div className="mb-1">
              <p className="text-base font-black text-white">{profile.fullName}</p>
              <p className="text-xs text-emerald-200">{profile.email}</p>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6 pt-10">
          {isEditing ? (
            /* ── Edit mode ── */
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <EditableField
                  icon={<UserIcon className="h-4 w-4" />}
                  label="Họ và tên"
                  name="fullName"
                  value={editFullName}
                  onChange={handleEditChange}
                  error={editErrors.fullName}
                  disabled={isSaving}
                />
                <EditableField
                  icon={<Phone className="h-4 w-4" />}
                  label="Số điện thoại"
                  name="phone"
                  value={editPhone}
                  placeholder="0912 345 678"
                  onChange={handleEditChange}
                  error={editErrors.phone}
                  disabled={isSaving}
                />
                <ReadOnlyField icon={<Mail className="h-4 w-4" />} label="Email" value={profile.email} />
                <ReadOnlyField icon={<Shield className="h-4 w-4" />} label="Vai trò" value={profile.role} />
                <ReadOnlyField icon={<Activity className="h-4 w-4" />} label="Trạng thái" value={profile.status === "ACTIVE" ? "Hoạt động" : "Vô hiệu hoá"} />
                <ReadOnlyField icon={<Key className="h-4 w-4" />} label="ID tài khoản" value={profile.id} />
              </div>

              {/* Action buttons */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  id="profile-cancel-btn"
                  onClick={cancelEdit}
                  disabled={isSaving}
                  className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  id="profile-save-btn"
                  onClick={handleSave}
                  disabled={isSaving}
                  aria-busy={isSaving}
                  className="flex items-center gap-2 rounded-xl bg-[#B4FF00] px-5 py-2.5 text-sm font-bold text-gray-900 hover:bg-[#AAEF00] disabled:opacity-60"
                >
                  {isSaving ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang lưu…</>
                  ) : (
                    <><Check className="h-3.5 w-3.5" /> Lưu thay đổi</>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* ── View mode ── */
            <div className="grid gap-3 sm:grid-cols-2">
              <ReadOnlyField icon={<UserIcon className="h-4 w-4" />} label="Họ và tên" value={profile.fullName} />
              <ReadOnlyField icon={<Phone className="h-4 w-4" />} label="Số điện thoại" value={profile.phone} />
              <ReadOnlyField icon={<Mail className="h-4 w-4" />} label="Email" value={profile.email} />
              <ReadOnlyField icon={<Shield className="h-4 w-4" />} label="Vai trò" value={profile.role} />
              <ReadOnlyField icon={<Activity className="h-4 w-4" />} label="Trạng thái" value={profile.status === "ACTIVE" ? "Hoạt động" : "Vô hiệu hoá"} />
              <ReadOnlyField icon={<Key className="h-4 w-4" />} label="ID tài khoản" value={profile.id} />
            </div>
          )}
        </div>
      </div>

      {/* ── Security & Sessions Section ── */}
      <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-xs">
        <div className="flex items-center gap-2 pb-4 border-b border-gray-100">
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
          <h2 className="text-base font-bold text-gray-900">Bảo mật & Quản lý phiên</h2>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {/* Change password item */}
          <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
                <KeyRound className="h-4 w-4 text-[#16A34A]" />
                Mật khẩu đăng nhập
              </div>
              <p className="mt-1 text-xs text-gray-500 leading-relaxed">
                Đổi mật khẩu định kỳ giúp bảo vệ tài khoản khỏi các truy cập trái phép.
              </p>
            </div>
            <div className="mt-4">
              <button
                type="button"
                id="profile-change-pw-btn"
                onClick={openPasswordModal}
                className="flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition-colors"
              >
                <KeyRound className="h-3.5 w-3.5 text-emerald-600" />
                Đổi mật khẩu
              </button>
            </div>
          </div>

          {/* Logout all devices item */}
          <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
                <LogOut className="h-4 w-4 text-amber-600" />
                Phiên làm việc trên mọi thiết bị
              </div>
              <p className="mt-1 text-xs text-gray-500 leading-relaxed">
                Thu hồi toàn bộ Refresh Token của tài khoản và đăng xuất khỏi các trình duyệt khác.
              </p>
            </div>
            <div className="mt-4">
              <button
                type="button"
                id="profile-logout-all-btn"
                onClick={handleLogoutAll}
                disabled={isLoggingOutAll}
                className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100 disabled:opacity-60 transition-colors"
              >
                {isLoggingOutAll ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-600" />
                ) : (
                  <LogOut className="h-3.5 w-3.5 text-amber-600" />
                )}
                Đăng xuất khỏi mọi thiết bị
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Logout current session */}
      <div className="mt-6 flex justify-end">
        <button
          id="profile-logout-btn"
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-700 transition-colors"
        >
          <X className="h-4 w-4" />
          Đăng xuất phiên hiện tại
        </button>
      </div>

      {/* ── Change Password Modal ── */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl animate-in fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-emerald-600" />
                <h3 className="text-base font-bold text-gray-900">Đổi mật khẩu tài khoản</h3>
              </div>
              <button
                type="button"
                onClick={closePasswordModal}
                disabled={isChangingPassword}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {passwordSuccess ? (
              <div role="status" className="my-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800 flex items-start gap-2.5">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <span>{passwordSuccess}</span>
              </div>
            ) : (
              <form onSubmit={handleChangePasswordSubmit} className="mt-4 space-y-4">
                {passwordApiError && (
                  <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{passwordApiError}</span>
                  </div>
                )}

                {/* Current Password */}
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Mật khẩu hiện tại <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPw ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => {
                        setCurrentPassword(e.target.value)
                        if (passwordErrors.currentPassword) setPasswordErrors((p) => ({ ...p, currentPassword: undefined }))
                      }}
                      disabled={isChangingPassword}
                      placeholder="Nhập mật khẩu hiện tại"
                      className="block w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-3.5 pr-10 text-sm text-gray-900 focus:border-[#16A34A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPw((v) => !v)}
                      className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
                    >
                      {showCurrentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {passwordErrors.currentPassword && (
                    <p className="mt-1 text-xs text-red-500">{passwordErrors.currentPassword}</p>
                  )}
                </div>

                {/* New Password */}
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Mật khẩu mới (8-72 ký tự) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPw ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value)
                        if (passwordErrors.newPassword) setPasswordErrors((p) => ({ ...p, newPassword: undefined }))
                      }}
                      disabled={isChangingPassword}
                      placeholder="Nhập mật khẩu mới"
                      className="block w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-3.5 pr-10 text-sm text-gray-900 focus:border-[#16A34A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPw((v) => !v)}
                      className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
                    >
                      {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {passwordErrors.newPassword && (
                    <p className="mt-1 text-xs text-red-500">{passwordErrors.newPassword}</p>
                  )}
                </div>

                {/* Confirm New Password */}
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Xác nhận mật khẩu mới <span className="text-red-500">*</span>
                  </label>
                  <input
                    type={showNewPw ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value)
                      if (passwordErrors.confirmPassword) setPasswordErrors((p) => ({ ...p, confirmPassword: undefined }))
                    }}
                    disabled={isChangingPassword}
                    placeholder="Nhập lại mật khẩu mới"
                    className="block w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 px-3.5 text-sm text-gray-900 focus:border-[#16A34A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20"
                  />
                  {passwordErrors.confirmPassword && (
                    <p className="mt-1 text-xs text-red-500">{passwordErrors.confirmPassword}</p>
                  )}
                </div>

                {/* Modal actions */}
                <div className="flex justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={closePasswordModal}
                    disabled={isChangingPassword}
                    className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={isChangingPassword}
                    className="flex items-center gap-1.5 rounded-xl bg-[#B4FF00] px-5 py-2.5 text-xs font-bold text-gray-900 hover:bg-[#AAEF00] disabled:opacity-60"
                  >
                    {isChangingPassword ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang cập nhật…</>
                    ) : (
                      "Cập nhật mật khẩu"
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
