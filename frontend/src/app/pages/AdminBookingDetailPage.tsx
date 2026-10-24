import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  Loader2,
  X,
} from "lucide-react"
import type { AdminBookingItem } from "@/types/adminBooking.types"
import {
  useAdminCourts,
  useAdminSportTypes,
} from "@/features/admin/courts/useAdminCourts"
import {
  useAdminBookingDetail,
} from "@/features/admin/bookings/useAdminBookings"
import { AdminBookingDetailView } from "@/features/admin/bookings/AdminBookingDetailView"
import { AdminCancelBookingModal } from "@/features/admin/bookings/AdminCancelBookingModal"
import { parseAdminBookingApiError } from "@/features/admin/bookings/adminBookingUtils"

export function AdminBookingDetailPage() {
  const { bookingId } = useParams<{ bookingId: string }>()
  const navigate = useNavigate()

  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false)
  const [successBanner, setSuccessBanner] = useState<string | null>(null)

  const {
    data: booking,
    isLoading: isBookingLoading,
    isError: isBookingError,
    error: bookingError,
  } = useAdminBookingDetail(bookingId)

  const { data: courtsData } = useAdminCourts({ pageSize: 100 })
  const { data: sportTypes } = useAdminSportTypes()

  const court =
    booking?.courtId && courtsData?.data
      ? courtsData.data.find((c) => c.id === booking.courtId) ?? null
      : null

  const sportType =
    court?.sportTypeId && sportTypes
      ? sportTypes.find((s) => s.id === court.sportTypeId) ?? null
      : null

  function handleCancelSuccess(updated: AdminBookingItem) {
    setIsCancelModalOpen(false)
    setSuccessBanner(
      `Đã hủy thành công booking ${updated.bookingCode}. Các khung giờ đã được giải phóng và ghi nhận audit log.`,
    )
    setTimeout(() => setSuccessBanner(null), 6000)
  }

  // 1. Loading State
  if (isBookingLoading) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white py-20 text-center shadow-xs">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mb-3" />
        <p className="text-sm font-bold text-gray-700">Đang tải chi tiết booking...</p>
        <p className="text-xs text-gray-400">Vui lòng chờ trong giây lát</p>
      </div>
    )
  }

  // 2. Error / 404 State
  if (isBookingError || !booking) {
    const parsed = parseAdminBookingApiError(bookingError)
    return (
      <div className="space-y-4">
        <Link
          to="/admin/bookings"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Quay lại danh sách booking</span>
        </Link>

        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center shadow-xs">
          <AlertTriangle className="mx-auto h-10 w-10 text-rose-500 mb-3" />
          <h2 className="text-base font-bold text-rose-900">
            Không tìm thấy thông tin booking
          </h2>
          <p className="mt-1 text-xs text-rose-700 max-w-md mx-auto">
            {parsed.message}
          </p>
          <button
            type="button"
            onClick={() => navigate("/admin/bookings")}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-gray-800 transition-colors"
          >
            Về trang Quản lý Đặt sân
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Top Navigation Link ── */}
      <div>
        <Link
          to="/admin/bookings"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Quay lại danh sách Quản lý Đặt sân</span>
        </Link>
      </div>

      {/* ── Success Alert Banner ── */}
      {successBanner && (
        <div
          role="status"
          className="flex items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-xs text-emerald-800 animate-in fade-in"
        >
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{successBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessBanner(null)}
            className="rounded p-1 text-emerald-600 hover:bg-emerald-100/60 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Detail View ── */}
      <AdminBookingDetailView
        booking={booking}
        court={court}
        sportType={sportType}
        onRequestCancel={() => setIsCancelModalOpen(true)}
      />

      {/* ── Cancel Modal ── */}
      {isCancelModalOpen && (
        <AdminCancelBookingModal
          booking={booking}
          court={court}
          sportName={sportType?.name}
          isOpen={isCancelModalOpen}
          onClose={() => setIsCancelModalOpen(false)}
          onSuccess={handleCancelSuccess}
        />
      )}
    </div>
  )
}
