import { useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import {
  AlertCircle,
  BookmarkCheck,
  CheckCircle,
  X,
} from "lucide-react"
import type { BookingStatus } from "@/features/bookings/types"
import type { AdminBookingItem } from "@/types/adminBooking.types"
import {
  useAdminCourts,
  useAdminSportTypes,
} from "@/features/admin/courts/useAdminCourts"
import {
  useAdminBookings,
} from "@/features/admin/bookings/useAdminBookings"
import { AdminBookingFilters } from "@/features/admin/bookings/AdminBookingFilters"
import { AdminBookingTable } from "@/features/admin/bookings/AdminBookingTable"
import { AdminCancelBookingModal } from "@/features/admin/bookings/AdminCancelBookingModal"
import { parseAdminBookingApiError } from "@/features/admin/bookings/adminBookingUtils"

export function AdminBookingsPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  // URL state synchronization
  const initialCourtId = searchParams.get("courtId") || ""
  const initialDate = searchParams.get("date") || ""
  const initialStatus = (searchParams.get("status") as BookingStatus | "ALL") || "ALL"
  const initialPage = Number(searchParams.get("page")) || 1
  const initialPageSize = Number(searchParams.get("pageSize")) || 20

  const [courtId, setCourtId] = useState(initialCourtId)
  const [date, setDate] = useState(initialDate)
  const [status, setStatus] = useState<BookingStatus | "ALL">(initialStatus)
  const [searchTerm, setSearchTerm] = useState("")
  const [page, setPage] = useState(initialPage)
  const [pageSize, setPageSize] = useState(initialPageSize)

  // Modal & Notification states
  const [cancellingBooking, setCancellingBooking] = useState<AdminBookingItem | null>(null)
  const [successBanner, setSuccessBanner] = useState<string | null>(null)

  // Sync state to URL params
  function updateQueryParams(updates: {
    courtId?: string
    date?: string
    status?: BookingStatus | "ALL"
    page?: number
    pageSize?: number
  }) {
    const nextCourtId = updates.courtId !== undefined ? updates.courtId : courtId
    const nextDate = updates.date !== undefined ? updates.date : date
    const nextStatus = updates.status !== undefined ? updates.status : status
    const nextPage = updates.page !== undefined ? updates.page : page
    const nextPageSize = updates.pageSize !== undefined ? updates.pageSize : pageSize

    const params: Record<string, string> = {}
    if (nextCourtId) params.courtId = nextCourtId
    if (nextDate) params.date = nextDate
    if (nextStatus && nextStatus !== "ALL") params.status = nextStatus
    if (nextPage > 1) params.page = String(nextPage)
    if (nextPageSize !== 20) params.pageSize = String(nextPageSize)

    setSearchParams(params, { replace: true })
  }

  // Handle filter changes
  function handleSelectCourt(id: string) {
    setCourtId(id)
    setPage(1)
    updateQueryParams({ courtId: id, page: 1 })
  }

  function handleSelectDate(d: string) {
    setDate(d)
    setPage(1)
    updateQueryParams({ date: d, page: 1 })
  }

  function handleSelectStatus(st: BookingStatus | "ALL") {
    setStatus(st)
    setPage(1)
    updateQueryParams({ status: st, page: 1 })
  }

  function handleResetFilters() {
    setCourtId("")
    setDate("")
    setStatus("ALL")
    setSearchTerm("")
    setPage(1)
    setSearchParams({}, { replace: true })
  }

  function handlePageChange(newPage: number) {
    setPage(newPage)
    updateQueryParams({ page: newPage })
  }

  function handlePageSizeChange(newSize: number) {
    setPageSize(newSize)
    setPage(1)
    updateQueryParams({ pageSize: newSize, page: 1 })
  }

  // API Queries
  const {
    data: bookingsResponse,
    isLoading: isBookingsLoading,
    isError: isBookingsError,
    error: bookingsError,
    isFetching: isBookingsFetching,
    refetch: refetchBookings,
  } = useAdminBookings({
    page,
    pageSize,
    courtId: courtId || undefined,
    date: date || undefined,
    status: status === "ALL" ? undefined : status,
  })

  const { data: courtsData } = useAdminCourts({ pageSize: 100 })
  const { data: sportTypes } = useAdminSportTypes()

  const courts = useMemo(() => courtsData?.data ?? [], [courtsData?.data])
  const courtMap = useMemo(() => {
    return new Map(courts.map((c) => [c.id, c]))
  }, [courts])

  const sportTypeMap = useMemo(() => {
    return new Map((sportTypes ?? []).map((s) => [s.id, s]))
  }, [sportTypes])

  // Filter list by client searchTerm (bookingCode or customerId) if entered
  const filteredBookings = useMemo(() => {
    const raw = bookingsResponse?.data ?? []
    if (!searchTerm.trim()) return raw
    const term = searchTerm.trim().toLowerCase()
    return raw.filter(
      (b) =>
        b.bookingCode.toLowerCase().includes(term) ||
        b.customerId.toLowerCase().includes(term),
    )
  }, [bookingsResponse?.data, searchTerm])

  const totalItems = bookingsResponse?.meta?.total ?? filteredBookings.length

  function handleCancelSuccess(updated: AdminBookingItem) {
    setCancellingBooking(null)
    setSuccessBanner(
      `Đã hủy thành công booking ${updated.bookingCode}. Các khung giờ đã được giải phóng và ghi nhận audit log.`,
    )
    setTimeout(() => setSuccessBanner(null), 6000)
  }

  const selectedCancellingCourt = cancellingBooking
    ? courtMap.get(cancellingBooking.courtId)
    : null
  const selectedCancellingSport = selectedCancellingCourt
    ? sportTypeMap.get(selectedCancellingCourt.sportTypeId)?.name
    : undefined

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-6 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-700 border border-emerald-200">
              <BookmarkCheck className="h-3 w-3" />
              FR-17 Management
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Sport Booking System
            </span>
          </div>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-gray-900">
            QUẢN LÝ ĐẶT SÂN (BOOKINGS)
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Tra cứu toàn bộ lượt đặt sân, lọc theo sân/ngày/trạng thái và hủy booking khi phát sinh sự cố hoặc bảo trì
          </p>
        </div>
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

      {/* ── Error Banner if API error ── */}
      {isBookingsError && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700 animate-in fade-in"
        >
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
          <span>
            {parseAdminBookingApiError(bookingsError).message}
          </span>
        </div>
      )}

      {/* ── Filters ── */}
      <AdminBookingFilters
        courts={courts}
        selectedCourtId={courtId}
        onSelectCourtId={handleSelectCourt}
        selectedDate={date}
        onSelectDate={handleSelectDate}
        selectedStatus={status}
        onSelectStatus={handleSelectStatus}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onReset={handleResetFilters}
        onRefresh={() => refetchBookings()}
        isFetching={isBookingsFetching}
      />

      {/* ── Table & Pagination ── */}
      <AdminBookingTable
        bookings={filteredBookings}
        courtMap={courtMap}
        sportTypeMap={sportTypeMap}
        isLoading={isBookingsLoading}
        currentPage={page}
        pageSize={pageSize}
        totalItems={totalItems}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        onRequestCancel={(b) => setCancellingBooking(b)}
      />

      {/* ── Cancel Confirmation Modal ── */}
      {cancellingBooking && (
        <AdminCancelBookingModal
          booking={cancellingBooking}
          court={selectedCancellingCourt}
          sportName={selectedCancellingSport}
          isOpen={Boolean(cancellingBooking)}
          onClose={() => setCancellingBooking(null)}
          onSuccess={handleCancelSuccess}
        />
      )}
    </div>
  )
}
