import {
  CalendarDays,
  CheckCircle,
  Filter,
  LayoutGrid,
  RotateCw,
  Search,
  X,
  XCircle,
} from "lucide-react"
import type { BookingStatus } from "@/features/bookings/types"
import type { Court } from "@/types/court.types"

interface AdminBookingFiltersProps {
  courts: Court[]
  selectedCourtId: string
  onSelectCourtId: (courtId: string) => void
  selectedDate: string
  onSelectDate: (date: string) => void
  selectedStatus: BookingStatus | "ALL"
  onSelectStatus: (status: BookingStatus | "ALL") => void
  searchTerm: string
  onSearchChange: (val: string) => void
  onReset: () => void
  onRefresh: () => void
  isFetching?: boolean
}

export function AdminBookingFilters({
  courts,
  selectedCourtId,
  onSelectCourtId,
  selectedDate,
  onSelectDate,
  selectedStatus,
  onSelectStatus,
  searchTerm,
  onSearchChange,
  onReset,
  onRefresh,
  isFetching,
}: AdminBookingFiltersProps) {
  // Quick date chips
  const todayStr = new Date().toISOString().split("T")[0]
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split("T")[0]

  const hasActiveFilters = Boolean(
    selectedCourtId || selectedDate || selectedStatus !== "ALL" || searchTerm,
  )

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs space-y-4">
      {/* Top row: Status Tabs & Quick Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4">
        {/* Status Pill Selector */}
        <div className="flex items-center gap-1.5 rounded-xl bg-gray-100 p-1 text-xs font-bold">
          <button
            type="button"
            onClick={() => onSelectStatus("ALL")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all ${
              selectedStatus === "ALL"
                ? "bg-white text-gray-900 shadow-xs"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <Filter className="h-3.5 w-3.5" />
            <span>Tất cả</span>
          </button>
          <button
            type="button"
            onClick={() => onSelectStatus("CONFIRMED")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all ${
              selectedStatus === "CONFIRMED"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <CheckCircle className="h-3.5 w-3.5" />
            <span>Đã xác nhận</span>
          </button>
          <button
            type="button"
            onClick={() => onSelectStatus("CANCELLED")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all ${
              selectedStatus === "CANCELLED"
                ? "bg-rose-600 text-white shadow-xs"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <XCircle className="h-3.5 w-3.5" />
            <span>Đã hủy</span>
          </button>
        </div>

        {/* Refresh & Reset Actions */}
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <button
              type="button"
              onClick={onReset}
              className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <X className="h-3.5 w-3.5 text-gray-400" />
              <span>Xóa bộ lọc</span>
            </button>
          )}

          <button
            type="button"
            onClick={onRefresh}
            disabled={isFetching}
            className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            title="Làm mới dữ liệu"
          >
            <RotateCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin text-emerald-600" : "text-gray-500"}`} />
            <span className="hidden sm:inline">Làm mới</span>
          </button>
        </div>
      </div>

      {/* Second row: Court, Date, and Search filters */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {/* Court dropdown */}
        <div>
          <label
            htmlFor="filter-court"
            className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1"
          >
            Sân Thể Thao
          </label>
          <div className="relative">
            <LayoutGrid className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            <select
              id="filter-court"
              value={selectedCourtId}
              onChange={(e) => onSelectCourtId(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-8 text-xs font-medium text-gray-800 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="">Tất cả các sân ({courts.length})</option>
              {courts.map((court) => (
                <option key={court.id} value={court.id}>
                  {court.name} ({court.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Date picker */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label
              htmlFor="filter-date"
              className="block text-[11px] font-bold uppercase tracking-wider text-gray-500"
            >
              Ngày Đặt Sân
            </label>
            <div className="flex items-center gap-1 text-[10px]">
              <button
                type="button"
                onClick={() => onSelectDate(todayStr)}
                className={`font-bold hover:underline ${
                  selectedDate === todayStr ? "text-emerald-700" : "text-gray-400"
                }`}
              >
                Hôm nay
              </button>
              <span className="text-gray-300">·</span>
              <button
                type="button"
                onClick={() => onSelectDate(tomorrowStr)}
                className={`font-bold hover:underline ${
                  selectedDate === tomorrowStr ? "text-emerald-700" : "text-gray-400"
                }`}
              >
                Ngày mai
              </button>
              {selectedDate && (
                <>
                  <span className="text-gray-300">·</span>
                  <button
                    type="button"
                    onClick={() => onSelectDate("")}
                    className="text-rose-500 font-bold hover:underline"
                  >
                    Xóa
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="relative">
            <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            <input
              id="filter-date"
              type="date"
              value={selectedDate}
              onChange={(e) => onSelectDate(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-xs font-medium text-gray-800 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Quick Search */}
        <div>
          <label
            htmlFor="filter-search"
            className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1"
          >
            Tìm mã booking / khách hàng
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            <input
              id="filter-search"
              type="text"
              placeholder="VD: BK-20261025-001 hoặc ID..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-8 text-xs font-medium text-gray-800 placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
