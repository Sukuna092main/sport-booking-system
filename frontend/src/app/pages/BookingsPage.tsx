import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import {
  CalendarDays,
  Clock,
  ArrowRight,
  CheckCircle,
  XCircle,
  Plus,
  Loader2,
  Inbox,
} from "lucide-react"
import { useMyBookings } from "@/features/bookings/useBookings"
import type { BookingStatus } from "@/features/bookings/types"
import { fmtTime } from "@/features/bookings/consecutiveSlots"

export function BookingsPage() {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState<BookingStatus | "ALL">("ALL")

  const { data, isLoading } = useMyBookings(
    statusFilter === "ALL" ? undefined : { status: statusFilter }
  )

  const bookings = data?.data ?? []

  return (
    <section className="py-4">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-gray-100">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#16A34A]">
            LỊCH SỬ ĐẶT SÂN
          </p>
          <h1 className="mt-0.5 text-3xl font-black tracking-tight text-gray-900">
            BOOKING CỦA TÔI
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Theo dõi danh sách các lượt đặt sân và trạng thái xác nhận của bạn
          </p>
        </div>

        <Link
          to="/courts"
          className="flex items-center gap-2 rounded-xl bg-[#B4FF00] px-4 py-2.5 text-xs font-black text-gray-900 transition-all hover:bg-[#AAEF00] active:scale-[0.99] shadow-xs"
        >
          <Plus className="h-4 w-4" />
          Đặt sân mới
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="mt-6 flex items-center gap-2 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setStatusFilter("ALL")}
          className={`pb-3 text-xs font-bold transition-colors border-b-2 -mb-px ${
            statusFilter === "ALL"
              ? "border-emerald-600 text-emerald-800"
              : "border-transparent text-gray-400 hover:text-gray-700"
          }`}
        >
          Tất cả ({data?.meta?.total ?? bookings.length})
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("CONFIRMED")}
          className={`pb-3 text-xs font-bold transition-colors border-b-2 -mb-px ${
            statusFilter === "CONFIRMED"
              ? "border-emerald-600 text-emerald-800"
              : "border-transparent text-gray-400 hover:text-gray-700"
          }`}
        >
          Đã xác nhận (CONFIRMED)
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("CANCELLED")}
          className={`pb-3 text-xs font-bold transition-colors border-b-2 -mb-px ${
            statusFilter === "CANCELLED"
              ? "border-emerald-600 text-emerald-800"
              : "border-transparent text-gray-400 hover:text-gray-700"
          }`}
        >
          Đã hủy (CANCELLED)
        </button>
      </div>

      {/* Bookings List Content */}
      <div className="mt-6">
        {isLoading ? (
          <div className="py-12 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
            Đang tải danh sách booking…
          </div>
        ) : bookings.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-xs">
            <Inbox className="mx-auto h-12 w-12 text-gray-300 mb-3" />
            <h3 className="text-base font-bold text-gray-800">Chưa có lượt đặt sân nào</h3>
            <p className="mt-1 text-xs text-gray-400 max-w-sm mx-auto">
              {statusFilter === "ALL"
                ? "Bạn chưa có booking nào trong hệ thống. Hãy chọn sân thể thao yêu thích để bắt đầu trải nghiệm!"
                : `Không có booking nào với trạng thái ${statusFilter}.`}
            </p>
            <Link
              to="/courts"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-gray-800 transition-colors"
            >
              Xem danh sách sân ngay
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {bookings.map((b) => {
              const isConfirmed = b.status === "CONFIRMED"
              const slotCount = b.slots?.length ?? 0
              const sorted = [...(b.slots ?? [])].sort(
                (x, y) => new Date(x.startsAt).getTime() - new Date(y.startsAt).getTime()
              )
              const timeRange =
                sorted.length > 0
                  ? `${fmtTime(sorted[0].startsAt)} – ${fmtTime(sorted[sorted.length - 1].endsAt)}`
                  : "—"

              const [by, bm, bd] = (b.bookingDate || "").split("-").map(Number)
              const dateDisplay = by && bm && bd
                ? new Date(by, bm - 1, bd).toLocaleDateString("vi-VN", {
                    weekday: "short",
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })
                : b.bookingDate

              return (
                <div
                  key={b.id}
                  className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs hover:border-emerald-300 transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Header: code & status badge */}
                    <div className="flex items-center justify-between gap-2 pb-3 border-b border-gray-100">
                      <span className="font-mono text-sm font-black text-gray-900">
                        {b.bookingCode}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          isConfirmed
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {isConfirmed ? (
                          <>
                            <CheckCircle className="h-3 w-3 text-emerald-600" />
                            CONFIRMED
                          </>
                        ) : (
                          <>
                            <XCircle className="h-3 w-3 text-gray-400" />
                            CANCELLED
                          </>
                        )}
                      </span>
                    </div>

                    {/* Date & Time */}
                    <div className="mt-3.5 space-y-2 text-xs">
                      <div className="flex items-center gap-2 text-gray-700">
                        <CalendarDays className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span className="font-semibold">{dateDisplay}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-700">
                        <Clock className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span>{timeRange} ({slotCount} slot)</span>
                      </div>
                    </div>
                  </div>

                  {/* Footer Action */}
                  <div className="mt-5 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                    <span className="text-[10px] text-gray-400">
                      Tạo lúc {new Date(b.createdAt).toLocaleDateString("vi-VN")}
                    </span>
                    <button
                      type="button"
                      onClick={() => navigate(`/bookings/${b.id}`)}
                      className="font-bold text-emerald-700 hover:text-emerald-800 hover:underline inline-flex items-center gap-1"
                    >
                      Chi tiết
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}