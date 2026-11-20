import { useEffect, useMemo, useState } from "react"
import { useSearchParams, Link } from "react-router-dom"
import {
  AlertCircle,
  CalendarDays,
  CalendarX,
  CheckCircle,
  ChevronDown,
  Clock,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  RotateCw,
  Search,
  ShieldAlert,
  XCircle,
} from "lucide-react"
import type { Court } from "@/types/court.types"
import type { Blackout } from "@/types/blackout.types"
import {
  useAdminCourts,
  useAdminSportTypes,
} from "@/features/admin/courts/useAdminCourts"
import {
  useCourtBlackouts,
  useDeactivateCourtBlackout,
  useUpdateCourtBlackout,
} from "@/features/admin/blackouts/useAdminBlackouts"
import {
  checkBlackoutOverlap,
  formatBlackoutDateTime,
  formatBlackoutDuration,
  parseBlackoutApiError,
} from "@/features/admin/blackouts/blackoutValidation"
import { BlackoutFormModal } from "@/features/admin/blackouts/BlackoutFormModal"
import { ConfirmDeactivateModal } from "@/features/admin/blackouts/ConfirmDeactivateModal"
import { DateAvailabilityInspector } from "@/features/admin/schedule/DateAvailabilityInspector"

type FilterStatus = "all" | "active" | "inactive"
type ViewMode = "blackouts" | "availability"

export function AdminBlackoutsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialCourtId = searchParams.get("courtId") || ""

  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [viewMode, setViewMode] = useState<ViewMode>("blackouts")

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false)
  const [editingBlackout, setEditingBlackout] = useState<Blackout | null>(null)
  const [deactivatingBlackout, setDeactivatingBlackout] = useState<Blackout | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  // Fetch all courts for selector
  const {
    data: courtsData,
    isLoading: isCourtsLoading,
  } = useAdminCourts({ pageSize: 100 })

  const { data: sportTypes } = useAdminSportTypes()
  const courts = useMemo(() => courtsData?.data ?? [], [courtsData?.data])

  const sportTypeMap = useMemo(() => {
    return new Map((sportTypes ?? []).map((s) => [s.id, s]))
  }, [sportTypes])

  // Selected court
  const selectedCourt: Court | null = useMemo(() => {
    if (courts.length === 0) return null
    if (initialCourtId) {
      const found = courts.find((c) => c.id === initialCourtId)
      if (found) return found
    }
    return courts[0]
  }, [courts, initialCourtId])

  // Sync selected court to URL param
  useEffect(() => {
    if (selectedCourt && (!initialCourtId || initialCourtId !== selectedCourt.id)) {
      setSearchParams({ courtId: selectedCourt.id }, { replace: true })
    }
  }, [selectedCourt, initialCourtId, setSearchParams])

  // Fetch blackouts for selected court
  const {
    data: blackouts = [],
    isLoading: isBlackoutsLoading,
    isError: isBlackoutsError,
    error: blackoutsError,
    isFetching: isBlackoutsFetching,
    refetch: refetchBlackouts,
  } = useCourtBlackouts(selectedCourt?.id || "")

  const updateMutation = useUpdateCourtBlackout()
  const deactivateMutation = useDeactivateCourtBlackout()

  function handleSelectCourt(id: string) {
    setSearchParams({ courtId: id })
    setActionError(null)
  }

  // Active / Inactive counts
  const activeCount = useMemo(() => blackouts.filter((b) => b.isActive).length, [blackouts])
  const inactiveCount = useMemo(() => blackouts.filter((b) => !b.isActive).length, [blackouts])

  // Filtered blackouts
  const filteredBlackouts = useMemo(() => {
    return blackouts.filter((b) => {
      // Status filter
      if (filterStatus === "active" && !b.isActive) return false
      if (filterStatus === "inactive" && b.isActive) return false

      // Search term filter
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim()
        const reasonMatch = b.reason?.toLowerCase().includes(term) ?? false
        const startMatch = b.startsAt.includes(term)
        const endMatch = b.endsAt.includes(term)
        return reasonMatch || startMatch || endMatch
      }

      return true
    })
  }, [blackouts, filterStatus, searchTerm])

  // Overlap map for all blackouts
  const overlapMap = useMemo(() => {
    const map = new Map<string, boolean>()
    for (const b of blackouts) {
      if (b.isActive) {
        const check = checkBlackoutOverlap({ startsAt: b.startsAt, endsAt: b.endsAt, id: b.id }, blackouts)
        map.set(b.id, check.hasOverlap)
      }
    }
    return map
  }, [blackouts])

  // Handle Quick Reactivate
  async function handleReactivate(b: Blackout) {
    if (!selectedCourt) return
    setActionError(null)
    try {
      await updateMutation.mutateAsync({
        courtId: selectedCourt.id,
        blackoutId: b.id,
        payload: { isActive: true },
      })
    } catch (err) {
      const parsed = parseBlackoutApiError(err)
      setActionError(parsed.message)
    }
  }

  // Handle Confirm Deactivate
  async function handleConfirmDeactivate() {
    if (!selectedCourt || !deactivatingBlackout) return
    setActionError(null)
    try {
      await deactivateMutation.mutateAsync({
        courtId: selectedCourt.id,
        blackoutId: deactivatingBlackout.id,
      })
      setDeactivatingBlackout(null)
    } catch (err) {
      const parsed = parseBlackoutApiError(err)
      setActionError(parsed.message)
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Top Header & Court Selector ── */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-rose-800 border border-rose-200">
                <ShieldAlert className="h-3 w-3" />
                Court Blackout Management
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Contract FR-16 & 0.5.0
              </span>
            </div>
            <h1 className="mt-1 text-xl font-black tracking-tight text-gray-900 sm:text-2xl">
              QUẢN LÝ LỊCH CHẶN SÂN (COURT BLACKOUTS)
            </h1>
            <p className="mt-0.5 text-xs text-gray-500 sm:text-sm">
              Khóa sân đột xuất, thiết lập thời gian bảo trì, sự kiện; chặn đặt mới và bảo toàn booking đã xác nhận
            </p>
          </div>

          {/* Court Selector Dropdown */}
          <div className="flex flex-col gap-1.5 sm:min-w-[320px]">
            <label htmlFor="blackoutCourtSelect" className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
              Chọn sân quản lý:
            </label>
            {isCourtsLoading ? (
              <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                <span>Đang tải danh sách sân...</span>
              </div>
            ) : courts.length === 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                Chưa có sân nào trong hệ thống
              </div>
            ) : (
              <div className="relative">
                <select
                  id="blackoutCourtSelect"
                  value={selectedCourt?.id || ""}
                  onChange={(e) => handleSelectCourt(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 pr-10 text-xs font-bold text-gray-900 shadow-2xs outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 cursor-pointer"
                >
                  {courts.map((c) => {
                    const sport = sportTypeMap.get(c.sportTypeId)
                    return (
                      <option key={c.id} value={c.id}>
                        [{c.code}] {c.name} {sport ? `— ${sport.name}` : ""} {c.isActive ? "" : "(Tạm dừng)"}
                      </option>
                    )
                  })}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              </div>
            )}
          </div>
        </div>

        {/* Selected Court Details Banner */}
        {selectedCourt && (
          <div className="mt-5 pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-black text-gray-900 bg-gray-100 px-2 py-0.5 rounded-md">
                  {selectedCourt.code}
                </span>
                <span className="font-bold text-gray-900">{selectedCourt.name}</span>
              </div>

              {sportTypeMap.get(selectedCourt.sportTypeId) && (
                <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-[10px] font-bold text-sky-700 border border-sky-200">
                  {sportTypeMap.get(selectedCourt.sportTypeId)?.name}
                </span>
              )}

              {selectedCourt.isActive ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                  <CheckCircle className="h-3 w-3" />
                  Hoạt động
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500 border border-gray-200">
                  <XCircle className="h-3 w-3" />
                  Tạm dừng
                </span>
              )}

              <span className="text-gray-300">|</span>

              <span className="text-gray-500">
                Thời lượng slot: <strong className="text-gray-800">{selectedCourt.slotDurationMinutes}p</strong>
              </span>

              <span className="text-gray-500">
                Tổng lịch chặn: <strong className="text-gray-800">{blackouts.length}</strong> (Đang hoạt động:{" "}
                <strong className="text-rose-700">{activeCount}</strong>)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to={`/admin/schedule?courtId=${selectedCourt.id}`}
                className="flex items-center gap-1 text-[11px] font-bold text-gray-600 hover:text-emerald-700 transition-colors"
              >
                <Clock className="h-3 w-3" />
                <span>Xem lịch & slot</span>
              </Link>
              <span className="text-gray-300">|</span>
              <Link
                to={`/courts/${selectedCourt.id}/availability`}
                target="_blank"
                className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 transition-colors"
              >
                <span>Xem giao diện khách</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* ── System Rule Notice Banner (Checklist: Không xóa confirmed booking & Overlap/Range handling) ── */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 text-xs text-amber-950 space-y-2 shadow-2xs">
        <div className="flex items-center gap-2 font-black text-amber-900 text-sm">
          <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
          <span>Nguyên tắc & Chính sách Hệ thống (FR-16 & SRS)</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-[11px] leading-relaxed">
          <div className="rounded-xl bg-white/80 p-3 border border-amber-200/60 space-y-1">
            <strong className="text-amber-900 block font-bold">1. Chặn đặt mới</strong>
            <p className="text-amber-800">
              Lịch chặn đang hoạt động (isActive=true) sẽ làm các time slot giao thoa chuyển sang trạng thái
              <strong> Không khả dụng (available: false)</strong> trên giao diện đặt sân của khách hàng.
            </p>
          </div>
          <div className="rounded-xl bg-white/80 p-3 border border-amber-200/60 space-y-1">
            <strong className="text-emerald-900 block font-bold">2. Không tự xóa booking đã xác nhận</strong>
            <p className="text-emerald-800">
              Tạo hoặc sửa lịch chặn <strong>tuyệt đối không tự động hủy hoặc xóa</strong> các booking CONFIRMED đã
              tồn tại. Nếu cần hủy lịch của khách, Admin thực hiện hủy từng booking có lý do qua Quản lý Booking.
            </p>
          </div>
          <div className="rounded-xl bg-white/80 p-3 border border-amber-200/60 space-y-1">
            <strong className="text-amber-900 block font-bold">3. Xử lý giao nhau (Overlap)</strong>
            <p className="text-amber-800">
              Khoảng thời gian kết thúc phải sau bắt đầu (startsAt &lt; endsAt). Các lịch chặn có thể giao nhau hoặc
              liền kề; hệ thống sẽ tự động gộp các khoảng thời gian bị chặn khi tính toán Availability.
            </p>
          </div>
        </div>
      </div>

      {/* Action Error Alert */}
      {actionError && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-800">
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* ── View Mode Switcher: Blackout List vs Date Availability Inspector ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-200 pb-px">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode("blackouts")}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              viewMode === "blackouts"
                ? "border-[#16A34A] text-emerald-800 bg-white rounded-t-xl"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-900"
            }`}
          >
            <CalendarX className="h-4 w-4" />
            <span>Danh Sách Lịch Chặn ({blackouts.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode("availability")}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              viewMode === "availability"
                ? "border-[#16A34A] text-emerald-800 bg-white rounded-t-xl"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-900"
            }`}
          >
            <CalendarDays className="h-4 w-4" />
            <span>Kiểm Tra Availability & Slot Khóa</span>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => refetchBlackouts()}
            disabled={isBlackoutsFetching}
            className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 shadow-2xs disabled:opacity-50 transition-colors"
          >
            <RotateCw className={`h-3.5 w-3.5 ${isBlackoutsFetching ? "animate-spin text-emerald-600" : ""}`} />
            <span>{isBlackoutsFetching ? "Đang đồng bộ..." : "Làm mới dữ liệu"}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingBlackout(null)
              setIsFormModalOpen(true)
            }}
            disabled={!selectedCourt}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Tạo lịch chặn mới</span>
          </button>
        </div>
      </div>

      {/* ── View Mode: Date Availability Inspector ── */}
      {viewMode === "availability" && selectedCourt && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs">
          <DateAvailabilityInspector court={selectedCourt} />
        </div>
      )}

      {/* ── View Mode: Blackouts Table & Management ── */}
      {viewMode === "blackouts" && (
        <div className="space-y-4">
          {/* Filters & Search Toolbar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-gray-200 bg-white p-4 shadow-xs">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setFilterStatus("all")}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                  filterStatus === "all"
                    ? "bg-white text-gray-900 shadow-2xs"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                Tất cả ({blackouts.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus("active")}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                  filterStatus === "active"
                    ? "bg-white text-rose-700 shadow-2xs"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                Đang chặn ({activeCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus("inactive")}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                  filterStatus === "inactive"
                    ? "bg-white text-gray-700 shadow-2xs"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                Đã tắt ({inactiveCount})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm theo lý do, ngày giờ..."
                className="w-full rounded-xl border border-gray-200 bg-gray-50/50 py-1.5 pl-8 pr-3 text-xs text-gray-800 placeholder-gray-400 outline-none focus:border-emerald-600 focus:bg-white focus:ring-1 focus:ring-emerald-600 transition-colors"
              />
            </div>
          </div>

          {/* Blackouts Table / List */}
          {isBlackoutsLoading ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white p-16 text-center shadow-xs">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mb-3" />
              <p className="text-xs font-bold text-gray-600">Đang tải danh sách lịch chặn...</p>
            </div>
          ) : isBlackoutsError ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 p-12 text-center">
              <AlertCircle className="h-8 w-8 text-rose-600 mb-2" />
              <p className="text-sm font-bold text-rose-800">Không thể tải dữ liệu lịch chặn</p>
              <p className="mt-1 text-xs text-rose-600">
                {(blackoutsError as Error)?.message || "Vui lòng kiểm tra kết nối mạng và thử lại."}
              </p>
              <button
                type="button"
                onClick={() => refetchBlackouts()}
                className="mt-4 rounded-xl bg-white px-4 py-2 text-xs font-bold text-rose-700 shadow-2xs border border-rose-200 hover:bg-rose-100/50"
              >
                Thử lại
              </button>
            </div>
          ) : filteredBlackouts.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white p-16 text-center shadow-xs">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-400 mb-3">
                <CalendarX className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-black text-gray-900">
                {searchTerm || filterStatus !== "all"
                  ? "Không tìm thấy lịch chặn phù hợp"
                  : "Chưa có lịch chặn nào cho sân này"}
              </h3>
              <p className="mt-1 text-xs text-gray-500 max-w-md">
                {searchTerm || filterStatus !== "all"
                  ? "Thử thay đổi bộ lọc tìm kiếm hoặc từ khóa để xem kết quả khác."
                  : "Sân đang hoạt động bình thường theo các khung giờ mở cửa định kỳ. Tạo lịch chặn khi cần bảo trì hoặc khóa sân đột xuất."}
              </p>
              {!searchTerm && filterStatus === "all" && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingBlackout(null)
                    setIsFormModalOpen(true)
                  }}
                  className="mt-4 flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition-colors shadow-xs"
                >
                  <Plus className="h-4 w-4" />
                  <span>Tạo lịch chặn đầu tiên</span>
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50/75 text-[10px] font-black uppercase tracking-wider text-gray-500">
                      <th className="px-5 py-3.5">Khoảng Thời Gian Chặn</th>
                      <th className="px-4 py-3.5">Thời Lượng</th>
                      <th className="px-4 py-3.5">Lý Do Chặn</th>
                      <th className="px-4 py-3.5">Trạng Thái</th>
                      <th className="px-4 py-3.5">Thời Gian Tạo / Cập Nhật</th>
                      <th className="px-5 py-3.5 text-right">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs">
                    {filteredBlackouts.map((b) => {
                      const duration = formatBlackoutDuration(b.startsAt, b.endsAt)
                      const isOverlapping = overlapMap.get(b.id) ?? false

                      return (
                        <tr key={b.id} className="hover:bg-gray-50/50 transition-colors">
                          {/* Time Range */}
                          <td className="px-5 py-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 font-bold text-gray-900">
                                <Clock className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                                <span>{formatBlackoutDateTime(b.startsAt)}</span>
                                <span className="text-gray-400 font-normal">đến</span>
                                <span>{formatBlackoutDateTime(b.endsAt)}</span>
                              </div>
                              {isOverlapping && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200">
                                  <AlertCircle className="h-3 w-3" />
                                  Giao nhau với blackout khác
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Duration */}
                          <td className="px-4 py-4 font-semibold text-gray-700">
                            <span className="rounded-lg bg-gray-100 px-2 py-1 text-[11px] font-bold text-gray-800">
                              {duration}
                            </span>
                          </td>

                          {/* Reason */}
                          <td className="px-4 py-4 max-w-xs">
                            {b.reason ? (
                              <p className="text-gray-800 line-clamp-2" title={b.reason}>
                                {b.reason}
                              </p>
                            ) : (
                              <span className="text-gray-400 italic">Không có lý do</span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="px-4 py-4">
                            {b.isActive ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-bold text-rose-700 border border-rose-200">
                                <ShieldAlert className="h-3 w-3" />
                                Đang chặn
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-bold text-gray-500 border border-gray-200">
                                <XCircle className="h-3 w-3" />
                                Đã tắt
                              </span>
                            )}
                          </td>

                          {/* Timestamps */}
                          <td className="px-4 py-4 text-gray-500 text-[11px]">
                            <div>Tạo: {formatBlackoutDateTime(b.createdAt)}</div>
                            {b.updatedAt !== b.createdAt && (
                              <div className="text-gray-400 text-[10px]">
                                Sửa: {formatBlackoutDateTime(b.updatedAt)}
                              </div>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-5 py-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingBlackout(b)
                                  setIsFormModalOpen(true)
                                }}
                                className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-gray-700 shadow-2xs hover:bg-gray-50 hover:text-gray-900 transition-colors"
                              >
                                <Pencil className="h-3 w-3" />
                                <span>Sửa</span>
                              </button>

                              {b.isActive ? (
                                <button
                                  type="button"
                                  onClick={() => setDeactivatingBlackout(b)}
                                  disabled={deactivateMutation.isPending}
                                  className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-bold text-rose-700 hover:bg-rose-100 transition-colors disabled:opacity-50"
                                >
                                  Tắt
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleReactivate(b)}
                                  disabled={updateMutation.isPending}
                                  className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                                >
                                  Kích hoạt lại
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Modals ── */}
      {selectedCourt && (
        <>
          <BlackoutFormModal
            isOpen={isFormModalOpen}
            court={selectedCourt}
            blackout={editingBlackout}
            existingBlackouts={blackouts}
            onClose={() => {
              setIsFormModalOpen(false)
              setEditingBlackout(null)
            }}
          />

          <ConfirmDeactivateModal
            isOpen={Boolean(deactivatingBlackout)}
            court={selectedCourt}
            blackout={deactivatingBlackout}
            isLoading={deactivateMutation.isPending}
            onConfirm={handleConfirmDeactivate}
            onClose={() => setDeactivatingBlackout(null)}
          />
        </>
      )}
    </div>
  )
}
