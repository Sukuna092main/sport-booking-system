import { type ReactNode, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Loader2, AlertCircle, Pencil, X, Check,
  User as UserIcon, Mail, Phone, Shield, Key, Activity,
  Lock, CheckCircle2,
} from "lucide-react"
import { useAuth } from "@/features/auth/useAuth"
import { useProfile } from "@/features/profile/useProfile"
import { useUpdateProfile, parseUpdateError } from "@/features/profile/useUpdateProfile"
import type { UpdateProfileFieldErrors } from "@/features/profile/useUpdateProfile"

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
  const { logout } = useAuth()
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
    // Clear per-field error on change
    setEditErrors((p) => ({ ...p, [name]: undefined }))
    setSaveError(null)
  }

  /* ── Client-side validation (mirrors backend rules) ── */
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
    // 1. Client validation
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

  /* ── Fetch error (network / 500) ── */
  const fetchErrorMessage = (() => {
    if (!fetchError) return null
    const status = (fetchError as { response?: { status: number } })?.response?.status
    if (status === 401) return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
    if (status === 403) return "Tài khoản của bạn đã bị vô hiệu hoá."
    return "Không thể tải hồ sơ. Vui lòng thử lại."
  })()

  /* ── Loading state ── */
  if (isLoading) {
    return (
      <section className="flex min-h-[20rem] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#16A34A]" />
        <span className="ml-2 text-sm text-gray-500">Đang tải hồ sơ…</span>
      </section>
    )
  }

  /* ── Fetch error ── */
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

  /* ── No profile (should not happen after loading + no error) ── */
  if (!profile) return null

  const isAdmin = profile.role === "ADMIN"
  const initials = profile.fullName.charAt(0).toUpperCase()
  const isSaving = updateMutation.isPending

  return (
    <section className="py-6">
      {/* ── Page header ── */}
      <div className="mb-7 flex items-start justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#16A34A]">Tài khoản của tôi</p>
          <h1 className="mt-1 text-4xl font-black uppercase tracking-tight text-gray-900">Hồ sơ cá nhân</h1>
          <p className="mt-1.5 text-sm text-gray-500">Xem và cập nhật thông tin cá nhân của bạn.</p>
        </div>
        {!isEditing && (
          <button
            id="profile-edit-btn"
            onClick={startEdit}
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:border-gray-300 hover:shadow"
          >
            <Pencil className="h-3.5 w-3.5" />
            Chỉnh sửa hồ sơ
          </button>
        )}
      </div>

      {/* ── Success banner (auto-dismiss) ── */}
      {showSuccess && (
        <div
          role="status"
          aria-live="polite"
          className="mb-5 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Hồ sơ đã được cập nhật thành công.
        </div>
      )}

      {/* ── Two-column card layout ── */}
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">

        {/* ─ Left: Avatar card (dark green) ─ */}
        <div className="overflow-hidden rounded-2xl border border-[#1B3A1E]/30">
          {/* Green header with field illustration */}
          <div className="relative h-28 overflow-hidden bg-[#0A1A0D]">
            <svg className="absolute inset-0 h-full w-full opacity-15" viewBox="0 0 280 120" fill="none">
              <circle cx="140" cy="60" r="40" stroke="white" strokeWidth="1" />
              <circle cx="140" cy="60" r="3" fill="white" />
              <rect x="8" y="8" width="264" height="104" rx="4" stroke="white" strokeWidth="1" />
              <line x1="140" y1="8" x2="140" y2="112" stroke="white" strokeWidth="1" />
            </svg>
          </div>

          {/* Avatar */}
          <div className="relative flex justify-center">
            <div className="-mt-8 flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-[#22C55E] text-2xl font-black text-white shadow-sm">
              {initials}
            </div>
          </div>

          {/* Info */}
          <div className="px-5 pb-5 pt-2 text-center">
            <p className="text-base font-black text-gray-900">{profile.fullName}</p>
            <p className="mt-0.5 text-xs text-gray-500">{profile.email}</p>

            <div className="mt-3 flex justify-center">
              <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold ${
                isAdmin
                  ? "border-purple-200 bg-purple-50 text-purple-700"
                  : "border-[#22C55E]/30 bg-[#22C55E]/10 text-[#15803D]"
              }`}>
                {profile.role}
              </span>
            </div>

            <div className="mt-4 flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-500">
              <span>Trạng thái tài khoản</span>
              <span className={`flex items-center gap-1 font-semibold ${
                profile.status === "ACTIVE" ? "text-[#16A34A]" : "text-red-500"
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${profile.status === "ACTIVE" ? "bg-[#16A34A]" : "bg-red-500"}`} />
                {profile.status === "ACTIVE" ? "Hoạt động" : "Vô hiệu hoá"}
              </span>
            </div>
          </div>
        </div>

        {/* ─ Right: Info card ─ */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <p className="text-base font-bold text-gray-900">Thông tin cơ bản</p>
              <p className="text-sm text-gray-500">
                {isEditing
                  ? "Chỉnh sửa các trường được phép sửa dưới đây."
                  : "Thông tin hồ sơ hiện tại của bạn."}
              </p>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-[10px] font-semibold text-gray-500">
              <Shield className="h-3 w-3" />
              Được bảo vệ
            </div>
          </div>

          {/* Save error */}
          {saveError && (
            <div
              role="alert"
              id="profile-save-error"
              className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
            >
              {saveError}
            </div>
          )}

          {isEditing ? (
            /* ── Edit form ── */
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <EditableField
                  icon={<UserIcon className="h-4 w-4" />}
                  label="Họ và tên" name="fullName"
                  value={editFullName} onChange={handleEditChange}
                  placeholder="Nhập họ và tên" error={editErrors.fullName} disabled={isSaving}
                />
                <EditableField
                  icon={<Phone className="h-4 w-4" />}
                  label="Số điện thoại" name="phone"
                  value={editPhone} onChange={handleEditChange}
                  placeholder="Nhập số điện thoại (tuỳ chọn)" error={editErrors.phone} disabled={isSaving}
                />
              </div>

              {/* Read-only fields in edit mode */}
              <div className="grid gap-3 sm:grid-cols-2">
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

      {/* Logout */}
      <div className="mt-6 flex justify-end">
        <button
          id="profile-logout-btn"
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-700 transition-colors"
        >
          <X className="h-4 w-4" />
          Đăng xuất
        </button>
      </div>
    </section>
  )
}