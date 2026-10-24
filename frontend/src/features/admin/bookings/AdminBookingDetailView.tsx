import { useState } from "react"
import { Link } from "react-router-dom"
import {
  Ban,
  CalendarDays,
  CheckCircle,
  Clock,
  Copy,
  FileText,
  LayoutGrid,
  Shield,
  ShieldAlert,
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
  formatAdminTimeSlot,
} from "./adminBookingUtils"

interface AdminBookingDetailViewProps {
  booking: AdminBookingItem
  court?: Court | null
  sportType?: SportType | null
  onRequestCancel: () => void
}

export function AdminBookingDetailView({
  booking,
  court,
  sportType,
  onRequestCancel,
}: AdminBookingDetailViewProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [now] = useState(() => Date.now())
  const eligibility = checkAdminBookingCancelEligibility(booking, now)

  function handleCopy(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const { rangeText, slotCount, totalMinutes } = formatAdminSlotRange(booking.slots)
  const isConfirmed = booking.status === "CONFIRMED"
  const isCancelled = booking.status === "CANCELLED"

  const sortedSlots = [...(booking.slots ?? [])].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  )

  return (
    <div className="space-y-6">
      {/* ── Status Banner & Header ── */}
      <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-700 border border-emerald-200">
              <Shield className="h-3 w-3" />
              Admin Booking Detail
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              FR-17 Audit Control
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-black tracking-tight text-gray-900 sm:text-3xl font-mono">
              {booking.bookingCode}
            </h1>

            {/* Quick Copy */}
            <button
              type="button"
              onClick={() => handleCopy(booking.bookingCode, "code")}
              className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors"
              title="Sao chép mã"
            >
              <Copy className="h-3 w-3" />
              <span>{copiedKey === "code" ? "Đã sao chép" : "Sao chép mã"}</span>
            </button>

            {/* Status Pill */}
            {isConfirmed && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800 border border-emerald-200">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                ĐÃ XÁC NHẬN (CONFIRMED)
              </span>
            )}
            {isCancelled && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-black text-rose-800 border border-rose-200">
                <XCircle className="h-3.5 w-3.5 text-rose-600" />
                ĐÃ HỦY (CANCELLED)
              </span>
            )}
          </div>

          <p className="mt-1.5 text-xs text-gray-500">
            Tạo lúc {formatAdminDateTime(booking.createdAt)}
            {booking.cancelledAt && (
              <span className="text-rose-600 font-semibold ml-2">
                · Đã hủy lúc {formatAdminDateTime(booking.cancelledAt)}
              </span>
            )}
          </p>
        </div>

        {/* Action Button */}
        <div>
          {eligibility.canCancel ? (
            <button
              type="button"
              onClick={onRequestCancel}
              className="flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-rose-700 active:scale-[0.99] transition-all"
            >
              <Ban className="h-4 w-4" />
              <span>Hủy Đặt Sân (Admin Cancel)</span>
            </button>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-right">
              <span className="text-xs font-bold text-gray-400 flex items-center gap-1.5 justify-end">
                <Ban className="h-3.5 w-3.5" />
                Không thể hủy
              </span>
              <p className="text-[10px] text-gray-400 mt-0.5">{eligibility.message}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Grid of Details ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Customer & Court info (1/3) */}
        <div className="space-y-6">
          {/* Khách hàng (User Info) */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
                <User className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-black text-gray-900">Thông tin Khách hàng</h2>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">
                  Customer ID (UUID)
                </span>
                <div className="flex items-center justify-between rounded-xl bg-gray-50 border border-gray-200 p-2.5 font-mono text-gray-800 break-all text-[11px]">
                  <span>{booking.customerId}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(booking.customerId, "cust")}
                    className="ml-2 rounded p-1 text-gray-400 hover:text-gray-700"
                    title="Sao chép Customer ID"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
                {copiedKey === "cust" && (
                  <span className="text-[10px] text-emerald-600 font-bold mt-1 inline-block">
                    Đã sao chép Customer UUID!
                  </span>
                )}
              </div>

              <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-3 text-[11px] text-purple-800 space-y-1">
                <p className="font-bold">Lưu ý quản trị:</p>
                <p className="text-purple-700 leading-relaxed">
                  Lượt đặt sân này thuộc tài khoản trên. Khi hủy booking, khung giờ sẽ được giải
                  phóng và ghi nhận kiểm toán theo actor là admin hiện tại.
                </p>
              </div>
            </div>
          </div>

          {/* Sân Thể Thao (Court Info) */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <LayoutGrid className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-black text-gray-900">Sân Thể Thao</h2>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-500">Tên sân:</span>
                <span className="font-bold text-gray-900">
                  {court?.name ?? "Sân thể thao"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-500">Mã sân:</span>
                <span className="font-mono font-bold text-gray-800 bg-gray-100 px-2 py-0.5 rounded">
                  {court?.code ?? "—"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-500">Bộ môn:</span>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-black uppercase text-emerald-700 border border-emerald-200">
                  {sportType?.name ?? "Thể thao"}
                </span>
              </div>

              {court?.referencePriceAmount && (
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-500">Giá tham chiếu:</span>
                  <span className="font-bold text-emerald-700">
                    {Number(court.referencePriceAmount).toLocaleString("vi-VN")}{" "}
                    {court.referencePriceCurrency ?? "VND"}
                  </span>
                </div>
              )}

              {court?.slotDurationMinutes && (
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-500">Thời lượng chuẩn slot:</span>
                  <span className="font-semibold text-gray-800">
                    {court.slotDurationMinutes} phút / slot
                  </span>
                </div>
              )}

              <div className="pt-2 border-t border-gray-100">
                <Link
                  to={`/admin/courts`}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  <span>Quản lý thông tin sân</span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Time Slots & Audit Timeline (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Khung giờ đã đặt (Time Slots) */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                  <CalendarDays className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-gray-900">Chi tiết Khung giờ đã đặt</h2>
                  <p className="text-[11px] text-gray-500">
                    {formatAdminBookingDate(booking.bookingDate)} ({booking.bookingDate})
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-xl bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-800">
                <Clock className="h-3.5 w-3.5 text-amber-600" />
                <span>
                  {rangeText} ({slotCount} slot · {totalMinutes} phút)
                </span>
              </div>
            </div>

            {/* Slots List */}
            <div className="space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                Danh sách các Slot thành phần ({sortedSlots.length}):
              </p>

              <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-gray-50/50 overflow-hidden">
                {sortedSlots.map((slot, index) => {
                  const s = new Date(slot.startsAt)
                  const e = new Date(slot.endsAt)
                  const slotMins = Math.round((e.getTime() - s.getTime()) / (1000 * 60))
                  const timeFormatted = formatAdminTimeSlot(slot.startsAt, slot.endsAt)

                  return (
                    <div
                      key={slot.timeSlotId || index}
                      className="flex flex-wrap items-center justify-between gap-3 p-3.5 hover:bg-white transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-black text-emerald-800">
                          {index + 1}
                        </span>
                        <div>
                          <p className="font-bold text-gray-900 text-xs">
                            {timeFormatted} ({slotMins} phút)
                          </p>
                          <p className="font-mono text-[10px] text-gray-400">
                            ID: {slot.timeSlotId}
                          </p>
                        </div>
                      </div>

                      <div className="text-right text-[11px] text-gray-500 font-mono">
                        <span>UTC: {slot.startsAt.substring(11, 16)} - {slot.endsAt.substring(11, 16)}Z</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Audit & Policy Card */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                <FileText className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-black text-gray-900">
                Quy trình & Kiểm toán Quản trị (SRS FR-17 & FR-19)
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-600">
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-3.5 space-y-1.5">
                <p className="font-bold text-gray-900 flex items-center gap-1.5">
                  <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
                  Quyền & Audit Log:
                </p>
                <p className="text-[11px] leading-relaxed text-gray-600">
                  Thao tác hủy booking của Admin ghi nhận lý do vào nhật ký kiểm toán hệ thống
                  (audit log) cùng ID của quản trị viên thực hiện.
                </p>
              </div>

              <div className="rounded-xl border border-gray-100 bg-gray-50 p-3.5 space-y-1.5">
                <p className="font-bold text-gray-900 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-blue-600" />
                  Quy định thời gian hủy:
                </p>
                <p className="text-[11px] leading-relaxed text-gray-600">
                  Theo quy định SRS BR-14, thao tác hủy chỉ được phép thực hiện trước thời điểm
                  bắt đầu của slot đầu tiên trong booking.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
