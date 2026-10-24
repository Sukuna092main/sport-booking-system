import { useState } from "react"
import { Link } from "react-router-dom"
import {
  Ban,
  CalendarDays,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Eye,
  Inbox,
  Loader2,
  User,
  XCircle,
} from "lucide-react"
import type { AdminBookingItem } from "@/types/adminBooking.types"
import type { Court, SportType } from "@/types/court.types"
import {
  checkAdminBookingCancelEligibility,
  formatAdminBookingDate,
  formatAdminDateTime,
  formatAdminSlotRange,
  shortenUuid,
} from "./adminBookingUtils"

interface AdminBookingTableProps {
  bookings: AdminBookingItem[]
  courtMap: Map<string, Court>
  sportTypeMap: Map<string, SportType>
  isLoading: boolean
  currentPage: number
  pageSize: number
  totalItems: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  onRequestCancel: (booking: AdminBookingItem) => void
}

export function AdminBookingTable({
  bookings,
  courtMap,
  sportTypeMap,
  isLoading,
  currentPage,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  onRequestCancel,
}: AdminBookingTableProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [now] = useState(() => Date.now())

  function handleCopy(text: string, key: string, e: React.MouseEvent) {
    e.stopPropagation()
    e.preventDefault()
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, totalItems)

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white py-16 text-center shadow-xs">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mb-3" />
        <p className="text-sm font-bold text-gray-700">Đang tải danh sách booking...</p>
        <p className="text-xs text-gray-400">Vui lòng đợi trong giây lát</p>
      </div>
    )
  }

  if (bookings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white py-16 text-center shadow-xs">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-gray-400 mb-4">
          <Inbox className="h-7 w-7" />
        </div>
        <h3 className="text-base font-black text-gray-800">Không tìm thấy booking nào</h3>
        <p className="mt-1 text-xs text-gray-500 max-w-sm">
          Chưa có lượt đặt sân nào phù hợp với bộ lọc hiện tại. Thử thay đổi điều kiện lọc hoặc ngày xem.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-xs overflow-hidden">
      {/* Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50/80 text-[10px] font-black uppercase tracking-wider text-gray-500">
              <th className="py-3.5 pl-6 pr-3">Mã Booking & Ngày tạo</th>
              <th className="px-3 py-3.5">Khách hàng (User)</th>
              <th className="px-3 py-3.5">Sân thể thao</th>
              <th className="px-3 py-3.5">Ngày & Khung giờ</th>
              <th className="px-3 py-3.5">Trạng thái</th>
              <th className="py-3.5 pl-3 pr-6 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {bookings.map((booking) => {
              const court = courtMap.get(booking.courtId)
              const sportType = court ? sportTypeMap.get(court.sportTypeId) : undefined
              const { rangeText, slotCount, totalMinutes } = formatAdminSlotRange(booking.slots)
              const eligibility = checkAdminBookingCancelEligibility(booking, now)

              const isConfirmed = booking.status === "CONFIRMED"
              const isCancelled = booking.status === "CANCELLED"

              return (
                <tr
                  key={booking.id}
                  className="hover:bg-gray-50/80 transition-colors group"
                >
                  {/* Mã Booking & Created At */}
                  <td className="py-3.5 pl-6 pr-3">
                    <div className="flex items-center gap-1.5">
                      <Link
                        to={`/admin/bookings/${booking.id}`}
                        className="font-mono font-black text-gray-900 hover:text-emerald-700 hover:underline transition-colors"
                      >
                        {booking.bookingCode}
                      </Link>
                      <button
                        type="button"
                        onClick={(e) => handleCopy(booking.bookingCode, `code-${booking.id}`, e)}
                        title="Sao chép mã booking"
                        className="rounded p-1 text-gray-400 hover:bg-gray-200/60 hover:text-gray-700 transition-colors"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                    {copiedKey === `code-${booking.id}` && (
                      <span className="text-[10px] text-emerald-600 font-bold">Đã sao chép!</span>
                    )}
                    <p className="mt-0.5 text-[11px] text-gray-400">
                      Tạo lúc {formatAdminDateTime(booking.createdAt)}
                    </p>
                  </td>

                  {/* Customer (User ID) */}
                  <td className="px-3 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-100 text-purple-700 shrink-0">
                        <User className="h-3 w-3" />
                      </div>
                      <span
                        className="font-mono text-[11px] text-gray-700 font-semibold"
                        title={booking.customerId}
                      >
                        {shortenUuid(booking.customerId)}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleCopy(booking.customerId, `cust-${booking.id}`, e)}
                        title="Sao chép Customer UUID"
                        className="rounded p-1 text-gray-400 hover:bg-gray-200/60 hover:text-gray-700 transition-colors"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                    {copiedKey === `cust-${booking.id}` && (
                      <span className="text-[10px] text-emerald-600 font-bold">Đã sao chép!</span>
                    )}
                  </td>

                  {/* Court & Sport info */}
                  <td className="px-3 py-3.5">
                    <div className="font-bold text-gray-900">
                      {court?.name ?? "Sân thể thao"}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {court?.code && (
                        <span className="font-mono text-[10px] text-gray-500">
                          {court.code}
                        </span>
                      )}
                      {sportType && (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.2 text-[9px] font-black uppercase text-emerald-700 border border-emerald-200">
                          {sportType.name}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Booking Date & Slots */}
                  <td className="px-3 py-3.5">
                    <div className="flex items-center gap-1.5 font-bold text-gray-900">
                      <CalendarDays className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                      <span>{formatAdminBookingDate(booking.bookingDate)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-gray-600 text-[11px]">
                      <Clock className="h-3 w-3 text-amber-600 shrink-0" />
                      <span className="font-semibold">{rangeText}</span>
                      <span className="text-gray-400">
                        ({slotCount} slot · {totalMinutes}p)
                      </span>
                    </div>
                  </td>

                  {/* Status Badge */}
                  <td className="px-3 py-3.5">
                    {isConfirmed && (
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-800 border border-emerald-200">
                        <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                        <span>ĐÃ XÁC NHẬN</span>
                      </div>
                    )}
                    {isCancelled && (
                      <div>
                        <div className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-black text-rose-800 border border-rose-200">
                          <XCircle className="h-3.5 w-3.5 text-rose-600" />
                          <span>ĐÃ HỦY</span>
                        </div>
                        {booking.cancelledAt && (
                          <p className="mt-0.5 text-[10px] text-gray-400">
                            Lúc {formatAdminDateTime(booking.cancelledAt)}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Additional timing notice if past start */}
                    {isConfirmed && !eligibility.canCancel && (
                      <p className="mt-1 text-[10px] font-semibold text-amber-700">
                        Đã qua giờ bắt đầu
                      </p>
                    )}
                  </td>

                  {/* Actions column */}
                  <td className="py-3.5 pl-3 pr-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {/* View Detail Link */}
                      <Link
                        to={`/admin/bookings/${booking.id}`}
                        className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors shadow-2xs"
                        title="Xem chi tiết booking"
                      >
                        <Eye className="h-3.5 w-3.5 text-gray-500" />
                        <span className="hidden md:inline">Chi tiết</span>
                      </Link>

                      {/* Cancel Action Button — Only active and enabled when eligible */}
                      {eligibility.canCancel ? (
                        <button
                          type="button"
                          onClick={() => onRequestCancel(booking)}
                          className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 hover:text-rose-900 transition-colors shadow-2xs"
                          title="Hủy booking quản trị"
                        >
                          <Ban className="h-3.5 w-3.5 text-rose-600" />
                          <span className="hidden md:inline">Hủy</span>
                        </button>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 rounded-xl border border-transparent px-2.5 py-1.5 text-xs font-medium text-gray-300 cursor-not-allowed"
                          title={eligibility.message}
                        >
                          <Ban className="h-3.5 w-3.5 text-gray-300" />
                          <span className="hidden md:inline">Hủy</span>
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-gray-200 bg-gray-50/50 px-6 py-3.5 text-xs text-gray-600">
        <div className="flex items-center gap-4">
          <span>
            Hiển thị <strong className="text-gray-900">{startItem}</strong> -{" "}
            <strong className="text-gray-900">{endItem}</strong> trên tổng số{" "}
            <strong className="text-gray-900">{totalItems}</strong> booking
          </span>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-gray-400">Số bản ghi:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-bold text-gray-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>

        {/* Page Nav */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:pointer-events-none transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <span className="px-2 text-xs font-bold text-gray-700">
            Trang {currentPage} / {totalPages}
          </span>

          <button
            type="button"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:pointer-events-none transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
