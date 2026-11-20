import { useMemo, useState } from "react"
import {
  Layers,
  Plus,
  Search,
  CheckCircle,
  XCircle,
  Pencil,
  AlertCircle,
  RotateCcw,
  LayoutGrid,
} from "lucide-react"
import type { SportType } from "@/types/court.types"
import {
  useAdminSportTypes,
  useAdminCourts,
  useUpdateSportType,
  useDeactivateSportType,
} from "@/features/admin/courts/useAdminCourts"
import { SportTypeFormModal } from "@/features/admin/courts/SportTypeFormModal"
import { ConfirmActionModal } from "@/features/admin/courts/ConfirmActionModal"
import { parseAdminApiError } from "@/features/admin/courts/adminErrorUtils"

export function AdminSportTypesPage() {
  const { data: sportTypes, isLoading, isError, error, refetch } = useAdminSportTypes()
  const { data: courtsData } = useAdminCourts({ pageSize: 100 })

  const updateMutation = useUpdateSportType()
  const deactivateMutation = useDeactivateSportType()

  // State
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL")
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<SportType | null>(null)
  const [confirmAction, setConfirmAction] = useState<{
    item: SportType
    actionType: "activate" | "deactivate"
  } | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  function showToast(msg: string) {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 4000)
  }

  // Count active courts per sport type
  const courtCountMap = useMemo(() => {
    const map = new Map<string, { total: number; active: number }>()
    for (const c of courtsData?.data ?? []) {
      const cur = map.get(c.sportTypeId) || { total: 0, active: 0 }
      cur.total += 1
      if (c.isActive) cur.active += 1
      map.set(c.sportTypeId, cur)
    }
    return map
  }, [courtsData])

  // Filtered sport types
  const filteredList = useMemo(() => {
    if (!sportTypes) return []
    return sportTypes.filter((st) => {
      if (statusFilter === "ACTIVE" && !st.isActive) return false
      if (statusFilter === "INACTIVE" && st.isActive) return false
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim()
        const matchName = st.name.toLowerCase().includes(q)
        const matchDesc = st.description?.toLowerCase().includes(q) || false
        if (!matchName && !matchDesc) return false
      }
      return true
    })
  }, [sportTypes, statusFilter, searchTerm])

  const stats = useMemo(() => {
    const all = sportTypes ?? []
    return {
      total: all.length,
      active: all.filter((s) => s.isActive).length,
      inactive: all.filter((s) => !s.isActive).length,
    }
  }, [sportTypes])

  // Handle confirm status change
  async function handleConfirmStatusChange() {
    if (!confirmAction) return
    setConfirmError(null)

    try {
      if (confirmAction.actionType === "deactivate") {
        await deactivateMutation.mutateAsync(confirmAction.item.id)
        showToast(`Đã ngừng kích hoạt môn "${confirmAction.item.name}".`)
      } else {
        await updateMutation.mutateAsync({
          id: confirmAction.item.id,
          payload: { isActive: true },
        })
        showToast(`Đã kích hoạt lại môn "${confirmAction.item.name}".`)
      }
      setConfirmAction(null)
    } catch (err) {
      const parsed = parseAdminApiError(err, "sportType")
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

      {/* Header & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-black text-gray-900 sm:text-2xl">
            DANH MỤC LOẠI THỂ THAO
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Quản lý các môn thể thao trong hệ thống (SRS FR-15)
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Thêm Loại Thể Thao Mới</span>
        </button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Tổng số môn
          </p>
          <p className="mt-1 text-2xl font-black text-gray-900">{stats.total}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
            Đang hoạt động
          </p>
          <p className="mt-1 text-2xl font-black text-emerald-700">{stats.active}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
            Đang tạm dừng
          </p>
          <p className="mt-1 text-2xl font-black text-gray-600">{stats.inactive}</p>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Tìm theo tên môn hoặc mô tả..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-gray-50/50 py-2 pl-9 pr-3.5 text-xs font-medium text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Lọc trạng thái:
          </span>
          <div className="inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1 text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter("ALL")}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors ${
                statusFilter === "ALL"
                  ? "bg-white text-gray-900 shadow-2xs"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              Tất cả ({stats.total})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("ACTIVE")}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors ${
                statusFilter === "ACTIVE"
                  ? "bg-white text-emerald-800 shadow-2xs"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              Hoạt động ({stats.active})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("INACTIVE")}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors ${
                statusFilter === "INACTIVE"
                  ? "bg-white text-gray-900 shadow-2xs"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              Tạm dừng ({stats.inactive})
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area: Loading / Error / Empty / List */}
      {isLoading ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-8">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
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
          <h3 className="mt-2 text-sm font-bold text-rose-900">Không thể tải danh sách loại thể thao</h3>
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
      ) : filteredList.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white p-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-400">
            <Layers className="h-6 w-6" />
          </div>
          <h3 className="mt-3 text-sm font-black text-gray-900">
            {searchTerm || statusFilter !== "ALL"
              ? "Không tìm thấy môn thể thao phù hợp"
              : "Chưa có môn thể thao nào"}
          </h3>
          <p className="mt-1 max-w-sm text-xs text-gray-500">
            {searchTerm || statusFilter !== "ALL"
              ? "Hãy thử thay đổi từ khóa tìm kiếm hoặc bỏ bộ lọc trạng thái."
              : "Tạo môn thể thao đầu tiên để bắt đầu thêm và cấu hình các sân thi đấu."}
          </p>
          {searchTerm || statusFilter !== "ALL" ? (
            <button
              type="button"
              onClick={() => {
                setSearchTerm("")
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
              <span>Thêm loại thể thao mới</span>
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
                  <th className="px-5 py-3.5">Môn Thể Thao</th>
                  <th className="px-4 py-3.5">Mô Tả</th>
                  <th className="px-4 py-3.5">Số Sân Thuộc Môn</th>
                  <th className="px-4 py-3.5">Trạng Thái</th>
                  <th className="px-5 py-3.5 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredList.map((st) => {
                  const courtStats = courtCountMap.get(st.id) || { total: 0, active: 0 }
                  return (
                    <tr
                      key={st.id}
                      className="hover:bg-gray-50/60 transition-colors"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 font-black">
                            {st.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900">{st.name}</p>
                            <p className="font-mono text-[10px] text-gray-400">{st.id}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4 max-w-xs text-gray-600">
                        {st.description ? (
                          <span className="line-clamp-2">{st.description}</span>
                        ) : (
                          <span className="italic text-gray-300">Không có mô tả</span>
                        )}
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1.5 font-medium text-gray-700">
                          <LayoutGrid className="h-3.5 w-3.5 text-gray-400" />
                          <span>
                            {courtStats.total} sân{" "}
                            <span className="text-[10px] text-emerald-600 font-bold">
                              ({courtStats.active} hoạt động)
                            </span>
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        {st.isActive ? (
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

                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingItem(st)}
                            className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-gray-700 shadow-2xs hover:bg-gray-50 hover:text-gray-900 transition-colors"
                          >
                            <Pencil className="h-3 w-3" />
                            <span>Sửa</span>
                          </button>

                          {st.isActive ? (
                            <button
                              type="button"
                              onClick={() => {
                                setConfirmError(null)
                                setConfirmAction({ item: st, actionType: "deactivate" })
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
                                setConfirmAction({ item: st, actionType: "activate" })
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
        </div>
      )}

      {/* Create Modal */}
      <SportTypeFormModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={(created) => showToast(`Đã thêm môn "${created.name}" thành công.`)}
      />

      {/* Edit Modal */}
      <SportTypeFormModal
        isOpen={Boolean(editingItem)}
        initialData={editingItem}
        onClose={() => setEditingItem(null)}
        onSuccess={(updated) => showToast(`Đã cập nhật môn "${updated.name}" thành công.`)}
      />

      {/* Confirm Deactivate / Activate Action Modal */}
      <ConfirmActionModal
        isOpen={Boolean(confirmAction)}
        title={
          confirmAction?.actionType === "deactivate"
            ? "Ngừng kích hoạt môn thể thao"
            : "Kích hoạt lại môn thể thao"
        }
        itemName={confirmAction?.item.name ?? ""}
        actionType={confirmAction?.actionType ?? "deactivate"}
        itemType="sportType"
        warningMessage={
          confirmAction?.actionType === "deactivate" &&
          (courtCountMap.get(confirmAction.item.id)?.active || 0) > 0
            ? `Cảnh báo: Đang có ${courtCountMap.get(confirmAction.item.id)?.active} sân hoạt động thuộc môn này. Hệ thống sẽ từ chối ngừng kích hoạt cho đến khi các sân này được tạm dừng.`
            : undefined
        }
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
