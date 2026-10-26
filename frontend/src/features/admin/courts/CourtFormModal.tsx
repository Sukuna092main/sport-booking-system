import { useState } from "react"
import { X, Loader2, LayoutGrid, AlertCircle, Info } from "lucide-react"
import type { Court, SportType } from "@/types/court.types"
import { useCreateCourt, useUpdateCourt } from "./useAdminCourts"
import {
  parseAdminApiError,
  validateCourtForm,
  type CourtFormState,
} from "./adminErrorUtils"

export interface CourtFormModalProps {
  isOpen: boolean
  initialData?: Court | null
  sportTypes: SportType[]
  onClose: () => void
  onSuccess?: (item: Court) => void
}

function CourtFormModalContent({
  initialData,
  sportTypes,
  onClose,
  onSuccess,
}: Omit<CourtFormModalProps, "isOpen">) {
  const isEdit = Boolean(initialData)
  const createMutation = useCreateCourt()
  const updateMutation = useUpdateCourt()

  const [form, setForm] = useState<CourtFormState>(() => {
    if (initialData) {
      return {
        sportTypeId: initialData.sportTypeId,
        code: initialData.code,
        name: initialData.name,
        description: initialData.description || "",
        isActive: initialData.isActive,
        slotDurationMinutes: initialData.slotDurationMinutes ?? 60,
        minConsecutiveSlots: initialData.minConsecutiveSlots ?? 1,
        maxConsecutiveSlots: initialData.maxConsecutiveSlots ?? 4,
        referencePriceAmount: initialData.referencePriceAmount || "",
        referencePriceCurrency: initialData.referencePriceCurrency || "VND",
      }
    }
    const defaultSport = sportTypes.find((s) => s.isActive) || sportTypes[0]
    return {
      sportTypeId: defaultSport ? defaultSport.id : "",
      code: "",
      name: "",
      description: "",
      isActive: true,
      slotDurationMinutes: 60,
      minConsecutiveSlots: 1,
      maxConsecutiveSlots: 4,
      referencePriceAmount: "",
      referencePriceCurrency: "VND",
    }
  })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [generalError, setGeneralError] = useState<string | null>(null)

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setGeneralError(null)

    // Client validation
    const errors = validateCourtForm(form)
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }
    setFieldErrors({})

    const hasPrice = form.referencePriceAmount.trim() !== ""
    const priceAmount = hasPrice ? form.referencePriceAmount.trim() : null
    const priceCurrency = hasPrice ? form.referencePriceCurrency.trim().toUpperCase() : null

    try {
      if (isEdit && initialData) {
        const res = await updateMutation.mutateAsync({
          id: initialData.id,
          payload: {
            sportTypeId: form.sportTypeId,
            code: form.code.trim(),
            name: form.name.trim(),
            description: form.description.trim() ? form.description.trim() : null,
            isActive: form.isActive,
            slotDurationMinutes: Number(form.slotDurationMinutes),
            minConsecutiveSlots: Number(form.minConsecutiveSlots),
            maxConsecutiveSlots: Number(form.maxConsecutiveSlots),
            referencePriceAmount: priceAmount,
            referencePriceCurrency: priceCurrency,
          },
        })
        onSuccess?.(res.data)
      } else {
        const res = await createMutation.mutateAsync({
          sportTypeId: form.sportTypeId,
          code: form.code.trim(),
          name: form.name.trim(),
          description: form.description.trim() ? form.description.trim() : null,
          isActive: form.isActive,
          slotDurationMinutes: Number(form.slotDurationMinutes),
          minConsecutiveSlots: Number(form.minConsecutiveSlots),
          maxConsecutiveSlots: Number(form.maxConsecutiveSlots),
          referencePriceAmount: priceAmount,
          referencePriceCurrency: priceCurrency,
        })
        onSuccess?.(res.data)
      }
      onClose()
    } catch (err) {
      const parsed = parseAdminApiError(err, "court")
      setGeneralError(parsed.message)
      if (Object.keys(parsed.fieldErrors).length > 0) {
        setFieldErrors(parsed.fieldErrors)
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="my-8 w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <LayoutGrid className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-black text-gray-900">
                {isEdit ? "Chỉnh Sửa Thông Tin Sân" : "Thêm Sân Thể Thao Mới"}
              </h2>
              <p className="text-xs text-gray-400">
                {isEdit ? "Cập nhật mã sân, tên, cấu hình slot và giá tham khảo" : "Tạo sân mới và thiết lập chính sách slot"}
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
          {/* Nhóm 1: Thông tin cơ bản */}
          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
              1. Thông tin chung
            </p>

            {/* Loại thể thao */}
            <div>
              <label htmlFor="court-sport" className="block text-xs font-bold text-gray-700">
                Loại thể thao <span className="text-rose-500">*</span>
              </label>
              <select
                id="court-sport"
                value={form.sportTypeId}
                onChange={(e) => {
                  setForm({ ...form, sportTypeId: e.target.value })
                  if (fieldErrors.sportTypeId) {
                    setFieldErrors((prev) => ({ ...prev, sportTypeId: "" }))
                  }
                }}
                className={`mt-1 w-full rounded-xl border px-3 py-2 text-xs font-medium text-gray-900 shadow-2xs outline-none transition-colors bg-white focus:ring-2 focus:ring-emerald-500/20 ${
                  fieldErrors.sportTypeId
                    ? "border-rose-300 bg-rose-50/30 focus:border-rose-500"
                    : "border-gray-200 focus:border-emerald-600"
                }`}
              >
                <option value="">-- Chọn loại thể thao --</option>
                {sportTypes.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name} {!st.isActive ? "(Tạm dừng)" : ""}
                  </option>
                ))}
              </select>
              {fieldErrors.sportTypeId && (
                <p className="mt-1 text-[11px] font-semibold text-rose-600">{fieldErrors.sportTypeId}</p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {/* Mã sân */}
              <div>
                <label htmlFor="court-code" className="block text-xs font-bold text-gray-700">
                  Mã sân <span className="text-rose-500">*</span>
                </label>
                <input
                  id="court-code"
                  type="text"
                  maxLength={50}
                  placeholder="VD: SAN-BD-01"
                  value={form.code}
                  onChange={(e) => {
                    setForm({ ...form, code: e.target.value })
                    if (fieldErrors.code) {
                      setFieldErrors((prev) => ({ ...prev, code: "" }))
                    }
                  }}
                  className={`mt-1 w-full font-mono rounded-xl border px-3.5 py-2 text-xs font-medium text-gray-900 shadow-2xs outline-none transition-colors placeholder:text-gray-400 focus:ring-2 focus:ring-emerald-500/20 ${
                    fieldErrors.code
                      ? "border-rose-300 bg-rose-50/30 focus:border-rose-500"
                      : "border-gray-200 bg-white focus:border-emerald-600"
                  }`}
                />
                {fieldErrors.code && (
                  <p className="mt-1 text-[11px] font-semibold text-rose-600">{fieldErrors.code}</p>
                )}
                <p className="mt-0.5 text-[10px] text-gray-400">Mã duy nhất, tối đa 50 ký tự.</p>
              </div>

              {/* Tên sân */}
              <div>
                <label htmlFor="court-name" className="block text-xs font-bold text-gray-700">
                  Tên sân <span className="text-rose-500">*</span>
                </label>
                <input
                  id="court-name"
                  type="text"
                  maxLength={120}
                  placeholder="VD: Sân Cầu Lông VIP 1"
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
                <p className="mt-0.5 text-[10px] text-gray-400">Tối đa 120 ký tự.</p>
              </div>
            </div>

            {/* Mô tả */}
            <div>
              <label htmlFor="court-desc" className="block text-xs font-bold text-gray-700">
                Mô tả sân
              </label>
              <textarea
                id="court-desc"
                rows={2}
                placeholder="Vị trí sân trong cụm, loại thảm hoặc sàn thi đấu, ánh sáng..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-medium text-gray-900 shadow-2xs outline-none transition-colors placeholder:text-gray-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>

          {/* Nhóm 2: Cấu hình Slot */}
          <div className="space-y-3 border-t border-gray-100 pt-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
                2. Chính sách khung giờ (Slot Policy)
              </p>
              <span className="text-[10px] text-gray-400">SRS FR-07</span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {/* Thời lượng slot */}
              <div>
                <label htmlFor="court-duration" className="block text-xs font-bold text-gray-700">
                  Thời lượng 1 slot (phút) <span className="text-rose-500">*</span>
                </label>
                <input
                  id="court-duration"
                  type="number"
                  min={1}
                  step={1}
                  value={form.slotDurationMinutes}
                  onChange={(e) =>
                    setForm({ ...form, slotDurationMinutes: parseInt(e.target.value, 10) || 0 })
                  }
                  className={`mt-1 w-full rounded-xl border px-3 py-2 text-xs font-medium text-gray-900 shadow-2xs outline-none transition-colors ${
                    fieldErrors.slotDurationMinutes
                      ? "border-rose-300 bg-rose-50/30"
                      : "border-gray-200 bg-white focus:border-emerald-600"
                  }`}
                />
                {fieldErrors.slotDurationMinutes && (
                  <p className="mt-1 text-[11px] font-semibold text-rose-600">
                    {fieldErrors.slotDurationMinutes}
                  </p>
                )}
                <p className="mt-0.5 text-[10px] text-gray-400">Mặc định 60 phút.</p>
              </div>

              {/* Min consecutive */}
              <div>
                <label htmlFor="court-min-slots" className="block text-xs font-bold text-gray-700">
                  Slot tối thiểu / booking <span className="text-rose-500">*</span>
                </label>
                <input
                  id="court-min-slots"
                  type="number"
                  min={1}
                  step={1}
                  value={form.minConsecutiveSlots}
                  onChange={(e) =>
                    setForm({ ...form, minConsecutiveSlots: parseInt(e.target.value, 10) || 0 })
                  }
                  className={`mt-1 w-full rounded-xl border px-3 py-2 text-xs font-medium text-gray-900 shadow-2xs outline-none transition-colors ${
                    fieldErrors.minConsecutiveSlots
                      ? "border-rose-300 bg-rose-50/30"
                      : "border-gray-200 bg-white focus:border-emerald-600"
                  }`}
                />
                {fieldErrors.minConsecutiveSlots && (
                  <p className="mt-1 text-[11px] font-semibold text-rose-600">
                    {fieldErrors.minConsecutiveSlots}
                  </p>
                )}
                <p className="mt-0.5 text-[10px] text-gray-400">Mặc định 1 slot.</p>
              </div>

              {/* Max consecutive */}
              <div>
                <label htmlFor="court-max-slots" className="block text-xs font-bold text-gray-700">
                  Slot tối đa / booking <span className="text-rose-500">*</span>
                </label>
                <input
                  id="court-max-slots"
                  type="number"
                  min={1}
                  step={1}
                  value={form.maxConsecutiveSlots}
                  onChange={(e) =>
                    setForm({ ...form, maxConsecutiveSlots: parseInt(e.target.value, 10) || 0 })
                  }
                  className={`mt-1 w-full rounded-xl border px-3 py-2 text-xs font-medium text-gray-900 shadow-2xs outline-none transition-colors ${
                    fieldErrors.maxConsecutiveSlots
                      ? "border-rose-300 bg-rose-50/30"
                      : "border-gray-200 bg-white focus:border-emerald-600"
                  }`}
                />
                {fieldErrors.maxConsecutiveSlots && (
                  <p className="mt-1 text-[11px] font-semibold text-rose-600">
                    {fieldErrors.maxConsecutiveSlots}
                  </p>
                )}
                <p className="mt-0.5 text-[10px] text-gray-400">Mặc định 4 slot.</p>
              </div>
            </div>

            {isEdit && (
              <div className="flex items-start gap-2 rounded-xl bg-blue-50/80 border border-blue-200 p-2.5 text-[11px] text-blue-800">
                <Info className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
                <p className="leading-relaxed">
                  Lưu ý: Nếu thay đổi thời lượng slot, hệ thống backend sẽ tự động tái sinh các time slot tuần hiện hành của sân trong cùng giao dịch.
                </p>
              </div>
            )}
          </div>

          {/* Nhóm 3: Giá tham khảo */}
          <div className="space-y-3 border-t border-gray-100 pt-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
              3. Giá tham khảo (Tùy chọn hiển thị)
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="court-price" className="block text-xs font-bold text-gray-700">
                  Giá tham khảo
                </label>
                <input
                  id="court-price"
                  type="text"
                  placeholder="VD: 150000 hoặc 150000.00"
                  value={form.referencePriceAmount}
                  onChange={(e) => {
                    setForm({ ...form, referencePriceAmount: e.target.value })
                    if (fieldErrors.referencePriceAmount) {
                      setFieldErrors((prev) => ({ ...prev, referencePriceAmount: "" }))
                    }
                  }}
                  className={`mt-1 w-full rounded-xl border px-3.5 py-2 text-xs font-medium text-gray-900 shadow-2xs outline-none transition-colors ${
                    fieldErrors.referencePriceAmount
                      ? "border-rose-300 bg-rose-50/30"
                      : "border-gray-200 bg-white focus:border-emerald-600"
                  }`}
                />
                {fieldErrors.referencePriceAmount && (
                  <p className="mt-1 text-[11px] font-semibold text-rose-600">
                    {fieldErrors.referencePriceAmount}
                  </p>
                )}
                <p className="mt-0.5 text-[10px] text-gray-400">Chỉ số thập phân (tối đa 2 số sau dấu phẩy).</p>
              </div>

              <div>
                <label htmlFor="court-currency" className="block text-xs font-bold text-gray-700">
                  Mã tiền tệ (ISO 4217)
                </label>
                <input
                  id="court-currency"
                  type="text"
                  maxLength={3}
                  placeholder="VD: VND"
                  value={form.referencePriceCurrency}
                  onChange={(e) => {
                    setForm({ ...form, referencePriceCurrency: e.target.value.toUpperCase() })
                    if (fieldErrors.referencePriceCurrency) {
                      setFieldErrors((prev) => ({ ...prev, referencePriceCurrency: "" }))
                    }
                  }}
                  className={`mt-1 w-full font-mono uppercase rounded-xl border px-3.5 py-2 text-xs font-medium text-gray-900 shadow-2xs outline-none transition-colors ${
                    fieldErrors.referencePriceCurrency
                      ? "border-rose-300 bg-rose-50/30"
                      : "border-gray-200 bg-white focus:border-emerald-600"
                  }`}
                />
                {fieldErrors.referencePriceCurrency && (
                  <p className="mt-1 text-[11px] font-semibold text-rose-600">
                    {fieldErrors.referencePriceCurrency}
                  </p>
                )}
                <p className="mt-0.5 text-[10px] text-gray-400">Đúng 3 ký tự (VND, USD...).</p>
              </div>
            </div>
          </div>

          {/* Nhóm 4: Trạng thái kích hoạt */}
          <div className="flex items-center gap-2.5 rounded-xl border border-gray-100 bg-gray-50/80 p-3">
            <input
              id="court-active"
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            <label htmlFor="court-active" className="cursor-pointer text-xs font-bold text-gray-800">
              Kích hoạt sân (Cho phép đặt sân trên hệ thống)
            </label>
          </div>

          {/* Action Buttons */}
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
                "Cập nhật sân"
              ) : (
                "Thêm mới sân"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function CourtFormModal(props: CourtFormModalProps) {
  if (!props.isOpen) return null

  return (
    <CourtFormModalContent
      key={props.initialData?.id || "create"}
      initialData={props.initialData}
      sportTypes={props.sportTypes}
      onClose={props.onClose}
      onSuccess={props.onSuccess}
    />
  )
}
