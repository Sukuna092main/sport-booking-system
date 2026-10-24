import { useState } from "react"
import { X, Loader2, Layers, AlertCircle } from "lucide-react"
import type { SportType } from "@/types/court.types"
import { useCreateSportType, useUpdateSportType } from "./useAdminCourts"
import {
  parseAdminApiError,
  validateSportTypeForm,
  type SportTypeFormState,
} from "./adminErrorUtils"

export interface SportTypeFormModalProps {
  isOpen: boolean
  initialData?: SportType | null
  onClose: () => void
  onSuccess?: (item: SportType) => void
}

function SportTypeFormModalContent({
  initialData,
  onClose,
  onSuccess,
}: Omit<SportTypeFormModalProps, "isOpen">) {
  const isEdit = Boolean(initialData)
  const createMutation = useCreateSportType()
  const updateMutation = useUpdateSportType()

  const [form, setForm] = useState<SportTypeFormState>(() =>
    initialData
      ? {
          name: initialData.name,
          description: initialData.description || "",
          isActive: initialData.isActive,
        }
      : {
          name: "",
          description: "",
          isActive: true,
        },
  )
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [generalError, setGeneralError] = useState<string | null>(null)

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setGeneralError(null)

    // Client-side validation
    const errors = validateSportTypeForm(form)
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }
    setFieldErrors({})

    try {
      if (isEdit && initialData) {
        const res = await updateMutation.mutateAsync({
          id: initialData.id,
          payload: {
            name: form.name.trim(),
            description: form.description.trim() ? form.description.trim() : null,
            isActive: form.isActive,
          },
        })
        onSuccess?.(res.data)
      } else {
        const res = await createMutation.mutateAsync({
          name: form.name.trim(),
          description: form.description.trim() ? form.description.trim() : null,
          isActive: form.isActive,
        })
        onSuccess?.(res.data)
      }
      onClose()
    } catch (err) {
      const parsed = parseAdminApiError(err, "sportType")
      setGeneralError(parsed.message)
      if (Object.keys(parsed.fieldErrors).length > 0) {
        setFieldErrors(parsed.fieldErrors)
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-black text-gray-900">
                {isEdit ? "Chỉnh Sửa Loại Thể Thao" : "Thêm Loại Thể Thao Mới"}
              </h2>
              <p className="text-xs text-gray-400">
                {isEdit ? "Cập nhật tên, mô tả và trạng thái hoạt động" : "Tạo mới phân loại môn thể thao"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* General Error Banner */}
        {generalError && (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
            <div className="leading-relaxed font-medium">{generalError}</div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Tên môn thể thao */}
          <div>
            <label htmlFor="sport-name" className="block text-xs font-bold text-gray-700">
              Tên môn thể thao <span className="text-rose-500">*</span>
            </label>
            <input
              id="sport-name"
              type="text"
              maxLength={100}
              placeholder="VD: Cầu lông, Bóng đá, Tennis..."
              value={form.name}
              onChange={(e) => {
                setForm({ ...form, name: e.target.value })
                if (fieldErrors.name) {
                  setFieldErrors((prev) => ({ ...prev, name: "" }))
                }
              }}
              className={`mt-1 w-full rounded-xl border px-3.5 py-2 text-xs font-medium text-gray-900 shadow-2xs outline-none transition-colors placeholder:text-gray-400 focus:ring-2 focus:ring-emerald-500/20 ${
                fieldErrors.name
                  ? "border-rose-300 bg-rose-50/30 focus:border-rose-500"
                  : "border-gray-200 bg-white focus:border-emerald-600"
              }`}
            />
            {fieldErrors.name && (
              <p className="mt-1 text-[11px] font-semibold text-rose-600">{fieldErrors.name}</p>
            )}
            <p className="mt-1 text-[10px] text-gray-400">Tối đa 100 ký tự. Không được trùng tên với môn khác.</p>
          </div>

          {/* Mô tả */}
          <div>
            <label htmlFor="sport-desc" className="block text-xs font-bold text-gray-700">
              Mô tả chi tiết
            </label>
            <textarea
              id="sport-desc"
              rows={3}
              placeholder="Thông tin quy chuẩn sân, số người chơi, trang thiết bị hỗ trợ..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-medium text-gray-900 shadow-2xs outline-none transition-colors placeholder:text-gray-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          {/* Trạng thái hoạt động */}
          <div className="flex items-center gap-2.5 rounded-xl border border-gray-100 bg-gray-50/80 p-3">
            <input
              id="sport-active"
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            <label htmlFor="sport-active" className="cursor-pointer text-xs font-bold text-gray-800">
              Kích hoạt môn thể thao này
            </label>
          </div>
          {isEdit && !form.isActive && (
            <p className="text-[11px] text-amber-700 font-medium">
              Lưu ý: Không thể ngừng kích hoạt nếu vẫn còn sân đang hoạt động thuộc môn này.
            </p>
          )}

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2.5 border-t border-gray-100 pt-4">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition-colors disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Đang lưu...</span>
                </>
              ) : isEdit ? (
                "Cập nhật môn"
              ) : (
                "Thêm mới"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function SportTypeFormModal(props: SportTypeFormModalProps) {
  if (!props.isOpen) return null

  return (
    <SportTypeFormModalContent
      key={props.initialData?.id || "create"}
      initialData={props.initialData}
      onClose={props.onClose}
      onSuccess={props.onSuccess}
    />
  )
}
