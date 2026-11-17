import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CalendarDays, Clock3, Loader2, RefreshCw } from "lucide-react"
import { bookingsApi, type BookingRecord } from "@/features/bookings/api"
import { paymentsApi } from "@/features/bookings/payments"

const money = (value?: number) => value == null ? "—" : `${value.toLocaleString("vi-VN")} ₫`
const startsLabel = (booking: BookingRecord) => booking.slots.map((slot) => new Date(slot.startsAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })).join(" · ")

export function BookingsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [actionError, setActionError] = useState("")
  const query = useQuery({ queryKey: ["bookings", "mine"], queryFn: bookingsApi.list, retry: 1 })
  const cancelMutation = useMutation({
    mutationFn: bookingsApi.cancel,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bookings", "mine"] }),
    onError: () => setActionError("Không thể hủy booking. Có thể booking đã bắt đầu hoặc trạng thái vừa thay đổi."),
  })

  async function pay(bookingId: string) {
    setActionError("")
    try {
      sessionStorage.setItem("active_payment_booking_id", bookingId)
      const payment = await paymentsApi.start(bookingId)
      if (payment.provider === "mock") {
        navigate(`/mock-payment?ref=${encodeURIComponent(payment.providerOrderRef)}&bookingId=${encodeURIComponent(bookingId)}`)
      } else if (payment.checkoutUrl) {
        window.location.assign(payment.checkoutUrl)
      } else {
        setActionError("Cổng thanh toán chưa trả về đường dẫn thanh toán.")
      }
    } catch {
      setActionError("Không thể khởi tạo thanh toán. Hãy tải lại danh sách và thử lại.")
    }
  }

  if (query.isLoading) return <div className="py-16 text-center text-sm text-gray-500">Đang tải lịch đặt sân…</div>
  if (query.isError) return <div role="alert" className="mx-auto my-10 max-w-xl rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">Không tải được lịch đặt sân. Kiểm tra kết nối rồi tải lại trang.<button onClick={() => void query.refetch()} className="ml-2 font-bold underline">Thử lại</button></div>

  const bookings = query.data?.data ?? []
  return (
    <section className="mx-auto max-w-5xl py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Tài khoản</p><h1 className="mt-1 text-3xl font-black text-gray-900">Lịch đặt sân</h1></div>
        <Link to="/courts" className="rounded-xl bg-[#B4FF00] px-4 py-2.5 text-sm font-bold text-gray-900">Tìm sân</Link>
      </div>
      {actionError && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{actionError}</p>}
      <p className="mt-4 text-xs text-gray-500">Nếu booking đã thanh toán rồi được hủy, giao dịch cần quản trị viên đối soát theo chính sách hoàn tiền của sân; hệ thống hiện không tự hoàn tiền.</p>
      {bookings.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center"><CalendarDays className="mx-auto h-8 w-8 text-gray-400"/><p className="mt-3 font-semibold text-gray-700">Bạn chưa có booking nào.</p><Link className="mt-3 inline-block text-sm font-bold text-emerald-700 hover:underline" to="/courts">Xem danh sách sân</Link></div>
      ) : (
        <div className="mt-6 space-y-4">
          {bookings.map((booking) => {
            const canCancel = (booking.status === "PENDING_PAYMENT" || booking.status === "CONFIRMED") && new Date(booking.slots[0]?.startsAt ?? 0) > new Date()
            return (
              <article key={booking.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="text-xs text-gray-500">Mã booking</p><p className="font-mono text-lg font-bold text-gray-900">{booking.bookingCode}</p><p className="mt-1 text-xs text-gray-500">Sân ID: {booking.courtId}</p></div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${booking.status === "CONFIRMED" ? "bg-emerald-100 text-emerald-800" : booking.status === "PENDING_PAYMENT" ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-600"}`}>{booking.status}</span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="flex items-center gap-2 text-sm text-gray-700"><CalendarDays className="h-4 w-4 text-gray-400"/>{booking.bookingDate}</div>
                  <div className="flex items-center gap-2 text-sm text-gray-700"><Clock3 className="h-4 w-4 text-gray-400"/>{startsLabel(booking)}</div>
                </div>
                {booking.totalAmountVnd != null && <div className="mt-4 rounded-xl bg-gray-50 p-3 text-sm"><div className="flex justify-between"><span className="text-gray-500">Tổng tiền</span><b>{money(booking.totalAmountVnd)}</b></div><div className="mt-1 flex justify-between"><span className="text-gray-500">Đặt cọc</span><b>{money(booking.depositAmountVnd)}</b></div><div className="mt-1 flex justify-between"><span className="text-gray-500">Còn lại</span><b>{money(booking.remainingAmountVnd)}</b></div></div>}
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  {booking.status === "PENDING_PAYMENT" && <button onClick={() => void pay(booking.id)} className="rounded-lg bg-[#B4FF00] px-4 py-2 text-sm font-bold text-gray-900">Tiếp tục thanh toán</button>}
                  {canCancel && <button disabled={cancelMutation.isPending} onClick={() => { if (window.confirm("Bạn muốn hủy booking này?")) cancelMutation.mutate(booking.id) }} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 disabled:opacity-50">{cancelMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin"/> : "Hủy booking"}</button>}
                </div>
                {booking.status === "PENDING_PAYMENT" && booking.holdExpiresAt && <p className="mt-3 text-right text-xs text-amber-700">Giữ slot đến {new Date(booking.holdExpiresAt).toLocaleString("vi-VN")}</p>}
              </article>
            )
          })}
        </div>
      )}
      <button onClick={() => void query.refetch()} className="mt-5 flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-800"><RefreshCw className="h-4 w-4"/> Tải lại</button>
    </section>
  )
}
