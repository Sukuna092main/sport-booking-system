import { useEffect } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { paymentsApi } from "@/features/bookings/payments"

export function PaymentResultPage() {
  const [params] = useSearchParams()
  const gateway = params.get("gateway") ?? "pending"
  const bookingId = params.get("bookingId") || sessionStorage.getItem("active_payment_booking_id") || ""
  const statusQuery = useQuery({
    queryKey: ["payment-status", bookingId],
    queryFn: () => paymentsApi.status(bookingId),
    enabled: Boolean(bookingId),
    retry: 1,
    refetchInterval: (query) => {
      const status = query.state.data?.payment?.status
      if (query.state.data?.bookingStatus === "CONFIRMED" || ["FAILED", "EXPIRED", "PAID_REVIEW"].includes(status ?? "")) return false
      return 2000
    },
  })
  const state = statusQuery.data
  const confirmed = state?.bookingStatus === "CONFIRMED"
  const review = state?.payment?.status === "PAID_REVIEW"
  const failed = state?.payment?.status === "FAILED" || state?.payment?.status === "EXPIRED" || state?.bookingStatus === "EXPIRED"

  useEffect(() => {
    if (confirmed || review || failed) sessionStorage.removeItem("active_payment_booking_id")
  }, [confirmed, review, failed])

  const title = confirmed ? "Thanh toán thành công" : review ? "Giao dịch cần được đối soát" : failed ? "Thanh toán chưa hoàn tất" : "Đang xác nhận giao dịch"
  const description = confirmed
    ? "Booking đã được xác nhận. Bạn có thể xem chi tiết trong lịch đặt sân."
    : review
      ? "Cổng thanh toán báo trạng thái cần kiểm tra. Booking chưa được xác nhận tự động; vui lòng liên hệ quản trị viên để đối soát."
      : failed
        ? "Giao dịch không thành công hoặc thời gian giữ slot đã hết. Bạn có thể quay lại lịch đặt sân để kiểm tra và chọn khung giờ khác."
        : gateway === "failed"
          ? "Trình duyệt trở về với thông tin giao dịch chưa thành công. Đang kiểm tra trạng thái cuối cùng từ máy chủ…"
          : "Kết quả trên trình duyệt chưa phải xác nhận cuối cùng. Máy chủ đang chờ thông báo đối soát từ cổng thanh toán."

  return (
    <section className="mx-auto mt-10 max-w-xl rounded-2xl border border-gray-200 bg-white p-7 text-center shadow-sm">
      <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Kết quả thanh toán</p>
      <h1 className="mt-2 text-2xl font-black text-gray-900">{title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-gray-600">{description}</p>
      {state?.payment && <p className="mt-4 text-xs text-gray-500">Trạng thái giao dịch: <b>{state.payment.status}</b></p>}
      {!bookingId && <p className="mt-4 text-xs text-amber-700">Không tìm thấy booking trong phiên trình duyệt. Hãy mở lịch booking để đối chiếu.</p>}
      {statusQuery.isError && <p role="alert" className="mt-4 text-sm text-red-700">Chưa tải được trạng thái. Bạn có thể kiểm tra lại trong trang booking.</p>}
      <Link to="/bookings" className="mt-6 inline-flex rounded-xl bg-[#B4FF00] px-5 py-3 text-sm font-bold text-gray-900">Mở lịch booking</Link>
    </section>
  )
}
