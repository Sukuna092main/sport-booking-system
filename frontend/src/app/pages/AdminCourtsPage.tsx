import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  LayoutGrid,
  Plus,
  Search,
  CheckCircle,
  XCircle,
  Pencil,
  AlertCircle,
  RotateCcw,
  Clock,
  Layers,
  ChevronLeft,
  ChevronRight,
  Tag,
  ShieldAlert,
} from "lucide-react"
import type { Court } from "@/types/court.types"
import {
  useAdminCourts,
  useAdminSportTypes,
  useUpdateCourt,
  useDeactivateCourt,
} from "@/features/admin/courts/useAdminCourts"
import { CourtFormModal } from "@/features/admin/courts/CourtFormModal"
import { ConfirmActionModal } from "@/features/admin/courts/ConfirmActionModal"
import { parseAdminApiError } from "@/features/admin/courts/adminErrorUtils"

/* ── Sport type badge colors ─────────────────────────────────────── */
const SPORT_COLOURS: Record<string, { bg: string; text: string; border: string }> = {
  badminton:  { bg: "bg-sky-50",     text: "text-sky-700",    border: "border-sky-200" },
  tennis:     { bg: "bg-amber-50",   text: "text-amber-700",  border: "border-amber-200" },
  football:   { bg: "bg-emerald-50", text: "text-emerald-700",border: "border-emerald-200" },
  futsal:     { bg: "bg-violet-50",  text: "text-violet-700", border: "border-violet-200" },
  basketball: { bg: "bg-orange-50",  text: "text-orange-700", border: "border-orange-200" },
  volleyball: { bg: "bg-pink-50",    text: "text-pink-700",   border: "border-pink-200" },
}

function getSportBadgeStyle(name: string) {
  const key = name.toLowerCase().replace(/\s+/g, "")
  for (const k of Object.keys(SPORT_COLOURS)) {
    if (key.includes(k)) return SPORT_COLOURS[k]
  }
  return { bg: "bg-gray-100", text: "text-gray-700", border: "border-gray-200" }
}

export function AdminCourtsPage() {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  // API Queries
  const { data: courtsData, isLoading, isError, error, refetch } = useAdminCourts({
    page,
    pageSize,
  })
  const { data: sportTypes } = useAdminSportTypes()

  // Mutations
  const updateMutation = useUpdateCourt()
  const deactivateMutation = useDeactivateCourt()

  // Local Filter States
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedSportId, setSelectedSportId] = useState<string>("ALL")
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL")

  // Modal States
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingCourt, setEditingCourt] = useState<Court | null>(null)
  const [confirmAction, setConfirmAction] = useState<{
    item: Court
    actionType: "activate" | "deactivate"
  } | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  function showToast(msg: string) {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 4000)
  }

  // Sport type lookup map
  const sportTypeMap = useMemo(() => {
    return new Map((sportTypes ?? []).map((s) => [s.id, s]))
  }, [sportTypes])

  // Filter courts list on current page
  const courts = useMemo(() => courtsData?.data ?? [], [courtsData?.data])
  const meta = courtsData?.meta ?? { page: 1, pageSize: 20, total: 0 }
  const totalPages = Math.max(1, Math.ceil(meta.total / meta.pageSize))

  const filteredCourts = useMemo(() => {
    return courts.filter((c) => {
      if (statusFilter === "ACTIVE" && !c.isActive) return false
      if (statusFilter === "INACTIVE" && c.isActive) return false
      if (selectedSportId !== "ALL" && c.sportTypeId !== selectedSportId) return false
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim()
        const matchCode = c.code.toLowerCase().includes(q)
        const matchName = c.name.toLowerCase().includes(q)
        const matchDesc = c.description?.toLowerCase().includes(q) || false
        if (!matchCode && !matchName && !matchDesc) return false
      }
      return true
    })
  }, [courts, statusFilter, selectedSportId, searchTerm])

  // Stats
  const stats = useMemo(() => {
    return {
      total: meta.total,
      active: courts.filter((c) => c.isActive).length,
      inactive: courts.filter((c) => !c.isActive).length,
    }
  }, [courts, meta.total])

  // Handle status confirmation
  async function handleConfirmStatusChange() {
    if (!confirmAction) return
    setConfirmError(null)

    try {
      if (confirmAction.actionType === "deactivate") {
        await deactivateMutation.mutateAsync(confirmAction.item.id)
        showToast(`Đã ngừng kích hoạt sân "${confirmAction.item.name}" (${confirmAction.item.code}).`)
      } else {
        await updateMutation.mutateAsync({
          id: confirmAction.item.id,
          payload: { isActive: true },
        })
        showToast(`Đã kích hoạt lại sân "${confirmAction.item.name}" (${confirmAction.item.code}).`)
      }
      setConfirmAction(null)
    } catch (err) {
      const parsed = parseAdminApiError(err, "court")
      setConfirmError(parsed.message)
    }
  }

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-18 right-6 z-50 flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-3 text-xs font-bold text-emerald-800 shadow-lg animate-in slide-in-from-top-2">
          <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header & Primary Action */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-black text-gray-900 sm:text-2xl">
            DANH SÁCH SÂN THỂ THAO
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Quản lý thông tin sân, cấu hình slot và giá tham khảo (SRS FR-15)
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Thêm Sân Mới</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Tổng số sân
          </p>
          <p className="mt-1 text-2xl font-black text-gray-900">{stats.total}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
            Đang hoạt động (Trang này)
          </p>
          <p className="mt-1 text-2xl font-black text-emerald-700">{stats.active}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
            Đang tạm dừng (Trang này)
          </p>
          <p className="mt-1 text-2xl font-black text-gray-600">{stats.inactive}</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-2xs">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm theo mã sân hoặc tên sân..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50/50 py-2 pl-9 pr-3.5 text-xs font-medium text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          {/* Sport Type Filter */}
          <div>
            <select
              value={selectedSportId}
              onChange={(e) => setSelectedSportId(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3 py-2 text-xs font-medium text-gray-900 outline-none transition-colors focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="ALL">-- Tất cả loại thể thao --</option>
              {(sportTypes ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {!s.isActive ? "(Tạm dừng)" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter Tabs */}
          <div className="inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1 text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter("ALL")}
              className={`flex-1 rounded-lg py-1 text-center text-[11px] font-bold transition-colors ${
                statusFilter === "ALL"
                  ? "bg-white text-gray-900 shadow-2xs"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              Tất cả
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("ACTIVE")}
              className={`flex-1 rounded-lg py-1 text-center text-[11px] font-bold transition-colors ${
                statusFilter === "ACTIVE"
                  ? "bg-white text-emerald-800 shadow-2xs"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              Hoạt động
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("INACTIVE")}
              className={`flex-1 rounded-lg py-1 text-center text-[11px] font-bold transition-colors ${
                statusFilter === "INACTIVE"
                  ? "bg-white text-gray-900 shadow-2xs"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              Tạm dừng
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-8">
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex animate-pulse items-center justify-between border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gray-100" />
                  <div className="space-y-1.5">
                    <div className="h-4 w-32 rounded bg-gray-100" />
                    <div className="h-3 w-48 rounded bg-gray-100" />
                  </div>
                </div>
                <div className="h-8 w-20 rounded bg-gray-100" />
              </div>
            ))}
          </div>
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-rose-200 bg-rose-50/50 p-8 text-center">
          <AlertCircle className="h-8 w-8 text-rose-600" />
          <h3 className="mt-2 text-sm font-bold text-rose-900">Không thể tải danh sách sân</h3>
          <p className="mt-1 text-xs text-rose-700">
            {error instanceof Error ? error.message : "Đã xảy ra lỗi khi kết nối tới máy chủ."}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-4 flex items-center gap-1.5 rounded-xl border border-rose-300 bg-white px-3.5 py-1.5 text-xs font-bold text-rose-800 shadow-2xs hover:bg-rose-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Thử lại</span>
          </button>
        </div>
      ) : filteredCourts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white p-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-400">
            <LayoutGrid className="h-6 w-6" />
          </div>
          <h3 className="mt-3 text-sm font-black text-gray-900">
            {searchTerm || selectedSportId !== "ALL" || statusFilter !== "ALL"
              ? "Không tìm thấy sân phù hợp"
              : "Chưa có sân nào trong hệ thống"}
          </h3>
          <p className="mt-1 max-w-sm text-xs text-gray-500">
            {searchTerm || selectedSportId !== "ALL" || statusFilter !== "ALL"
              ? "Hãy thử thay đổi từ khóa tìm kiếm hoặc điều chỉnh các bộ lọc phía trên."
              : "Tạo sân đầu tiên để bắt đầu quản lý lịch đặt và thời gian mở cửa."}
          </p>
          {searchTerm || selectedSportId !== "ALL" || statusFilter !== "ALL" ? (
            <button
              type="button"
              onClick={() => {
                setSearchTerm("")
                setSelectedSportId("ALL")
                setStatusFilter("ALL")
              }}
              className="mt-4 rounded-xl border border-gray-200 px-3.5 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
            >
              Xóa bộ lọc
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="mt-4 flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" />
              <span>Thêm sân mới</span>
            </button>
          )}
        </div>
      ) : (
        /* Data Table */
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-gray-100 bg-gray-50/80 text-[10px] font-black uppercase tracking-wider text-gray-400">
                <tr>
                  <th className="px-5 py-3.5">Mã & Tên Sân</th>
                  <th className="px-4 py-3.5">Môn Thể Thao</th>
                  <th className="px-4 py-3.5">Chính Sách Slot</th>
                  <th className="px-4 py-3.5">Giá Tham Khảo</th>
                  <th className="px-4 py-3.5">Trạng Thái</th>
                  <th className="px-5 py-3.5 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCourts.map((court) => {
                  const sport = sportTypeMap.get(court.sportTypeId)
                  const sportName = sport?.name || "Thể thao"
                  const sportStyle = getSportBadgeStyle(sportName)

                  return (
                    <tr
                      key={court.id}
                      className="hover:bg-gray-50/60 transition-colors"
                    >
                      {/* Tên & Mã */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-700 font-mono font-bold text-xs">
                            {court.code.slice(0, 3)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-gray-900">{court.name}</span>
                              <span className="font-mono rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-600">
                                {court.code}
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-400 line-clamp-1 mt-0.5">
                              {court.description || "Không có mô tả"}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Loại thể thao */}
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${sportStyle.bg} ${sportStyle.text} ${sportStyle.border}`}
                        >
                          <Layers className="h-3 w-3" />
                          {sportName}
                        </span>
                      </td>

                      {/* Slot Policy */}
                      <td className="px-4 py-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 text-gray-700 font-semibold">
                            <Clock className="h-3 w-3 text-emerald-600" />
                            <span>{court.slotDurationMinutes} phút / slot</span>
                          </div>
                          <p className="text-[10px] text-gray-400">
                            Đặt từ {court.minConsecutiveSlots} đến {court.maxConsecutiveSlots} slot
                          </p>
                        </div>
                      </td>

                      {/* Giá tham khảo */}
                      <td className="px-4 py-4">
                        {court.referencePriceAmount ? (
                          <div className="flex items-center gap-1 text-gray-900 font-bold">
                            <Tag className="h-3 w-3 text-amber-500" />
                            <span>
                              {Number(court.referencePriceAmount).toLocaleString("vi-VN")}{" "}
                              {court.referencePriceCurrency || "VND"}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-300 italic">Chưa cấu hình</span>
                        )}
                      </td>

                      {/* Trạng thái */}
                      <td className="px-4 py-4">
                        {court.isActive ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                            <CheckCircle className="h-3 w-3" />
                            Hoạt động
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-bold text-gray-500 border border-gray-200">
                            <XCircle className="h-3 w-3" />
                            Tạm dừng
                          </span>
                        )}
                      </td>

                      {/* Thao tác */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            to={`/admin/schedule?courtId=${court.id}`}
                            className="flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100 transition-colors shadow-2xs"
                            title="Quản lý giờ mở cửa và cấu hình time slot cho sân này"
                          >
                            <Clock className="h-3 w-3 text-emerald-600" />
                            <span>Lịch / Slot</span>
                          </Link>

                          <Link
                            to={`/admin/blackouts?courtId=${court.id}`}
                            className="flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-bold text-rose-800 hover:bg-rose-100 transition-colors shadow-2xs"
                            title="Quản lý lịch chặn sân (Blackout) cho sân này"
                          >
                            <ShieldAlert className="h-3 w-3 text-rose-600" />
                            <span>Blackout</span>
                          </Link>

                          <button
                            type="button"
                            onClick={() => setEditingCourt(court)}
                            className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-gray-700 shadow-2xs hover:bg-gray-50 hover:text-gray-900 transition-colors"
                          >
                            <Pencil className="h-3 w-3" />
                            <span>Sửa</span>
                          </button>

                          {court.isActive ? (
                            <button
                              type="button"
                              onClick={() => {
                                setConfirmError(null)
                                setConfirmAction({ item: court, actionType: "deactivate" })
                              }}
                              className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-bold text-rose-700 hover:bg-rose-100 transition-colors"
                            >
                              Ngừng kích hoạt
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setConfirmError(null)
                                setConfirmAction({ item: court, actionType: "activate" })
                              }}
                              className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 transition-colors"
                            >
                              Kích hoạt
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

          {/* Pagination Bar */}
          <div className="flex flex-col gap-3 border-t border-gray-100 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between text-xs text-gray-500">
            <div className="flex items-center gap-2">
              <span>
                Hiển thị trang <span className="font-bold text-gray-900">{meta.page}</span> /{" "}
                <span className="font-bold text-gray-900">{totalPages}</span> (Tổng cộng{" "}
                <span className="font-bold text-gray-900">{meta.total}</span> sân)
              </span>
              <span className="text-gray-300">|</span>
              <label htmlFor="pageSizeSelect" className="text-gray-400">Số lượng:</label>
              <select
                id="pageSizeSelect"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setPage(1)
                }}
                className="rounded-lg border border-gray-200 px-2 py-1 text-xs font-bold text-gray-700 outline-none focus:border-emerald-600"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Trước</span>
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors"
              >
                <span>Sau</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      <CourtFormModal
        isOpen={isCreateOpen}
        sportTypes={sportTypes ?? []}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={(created) => showToast(`Đã thêm sân "${created.name}" (${created.code}) thành công.`)}
      />

      {/* Edit Modal */}
      <CourtFormModal
        isOpen={Boolean(editingCourt)}
        initialData={editingCourt}
        sportTypes={sportTypes ?? []}
        onClose={() => setEditingCourt(null)}
        onSuccess={(updated) => showToast(`Đã cập nhật sân "${updated.name}" (${updated.code}) thành công.`)}
      />

      {/* Confirm Action Modal */}
      <ConfirmActionModal
        isOpen={Boolean(confirmAction)}
        title={
          confirmAction?.actionType === "deactivate"
            ? "Ngừng kích hoạt sân thể thao"
            : "Kích hoạt lại sân thể thao"
        }
        itemName={`${confirmAction?.item.name ?? ""} (${confirmAction?.item.code ?? ""})`}
        actionType={confirmAction?.actionType ?? "deactivate"}
        itemType="court"
        errorMessage={confirmError}
        isLoading={deactivateMutation.isPending || updateMutation.isPending}
        onConfirm={handleConfirmStatusChange}
        onClose={() => {
          setConfirmAction(null)
          setConfirmError(null)
        }}
      />
    </div>
  )
}
