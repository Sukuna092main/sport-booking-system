import { useEffect, useState } from "react"
import { useSearchParams, Link } from "react-router-dom"
import {
  CheckCircle2,
  XCircle,
  Loader2,
  CalendarDays,
  Clock,
  ArrowRight,
  ShieldCheck,
  MailCheck,
  RotateCcw,
} from "lucide-react"
import { paymentsApi } from "@/lib/api/payments"
import { bookingsApi } from "@/lib/api/bookings"
import type { BookingItem } from "@/features/bookings/types"
import type { PaymentStatus } from "@/types/payment.types"

export function PaymentResultPage() {
  const [searchParams] = useSearchParams()

  const ref = searchParams.get("ref") || ""
  const gatewayStatus = searchParams.get("gateway") || "pending"

  const [booking, setBooking] = useState<BookingItem | null>(null)
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null)
  const [isPolling, setIsPolling] = useState(gatewayStatus !== "failed")
  const [pollCount, setPollCount] = useState(0)

  // Find booking on mount
  useEffect(() => {
    let isMounted = true
    const savedBookingId = sessionStorage.getItem("pending_booking_id")

    async function checkStatus() {
      try {
        let bId = savedBookingId
        if (!bId) {
          const listRes = await bookingsApi.listMyBookings({ pageSize: 5 })
          if (listRes.data.length > 0) {
            bId = listRes.data[0].id
          }
        }

        if (bId) {
          const [bookingRes, payRes] = await Promise.all([
            bookingsApi.getMyBooking(bId),
            paymentsApi.getPaymentStatus(bId).catch(() => null),
          ])

          if (isMounted) {
            setBooking(bookingRes.data)
            if (payRes) setPaymentStatus(payRes.data)

            // If booking is already CONFIRMED or EXPIRED or poll reached max attempts, stop polling
            if (
              bookingRes.data.status === "CONFIRMED" ||
              bookingRes.data.status === "EXPIRED" ||
              pollCount >= 6
            ) {
              setIsPolling(false)
            } else {
              setPollCount((prev) => prev + 1)
            }
          }
        } else {
          if (isMounted) setIsPolling(false)
        }
      } catch {
        if (isMounted) setIsPolling(false)
      }
    }

    if (gatewayStatus === "failed") {
      return
    }

    if (isPolling) {
      const timer = setTimeout(checkStatus, 1500)
      return () => {
        isMounted = false
        clearTimeout(timer)
      }
    }
  }, [gatewayStatus, isPolling, pollCount])

  // If gateway reported failure
  if (gatewayStatus === "failed") {
    return (
      <div className="py-12 max-w-lg mx-auto">
        <div className="overflow-hidden rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-md">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
            <XCircle className="h-10 w-10" />
          </div>

          <p className="mt-4 text-[10px] font-bold uppercase tracking-widest text-rose-600">
            KẾT QUẢ GIAO DỊCH
          </p>
          <h1 className="mt-1 text-2xl font-black text-gray-900">
            Thanh toán không thành công
          </h1>
          <p className="mt-2 text-xs text-gray-500 leading-relaxed max-w-sm mx-auto">
            Giao dịch thanh toán đặt cọc đã bị hủy hoặc không thành công từ cổng thanh toán. Khung giờ sân của bạn sẽ được giữ tối đa trong 10 phút.
          </p>

          {ref && (
            <div className="mt-4 inline-block rounded-xl bg-gray-50 px-3.5 py-1.5 text-xs font-mono text-gray-600 border border-gray-100">
              Mã tham chiếu: <span className="font-bold text-gray-900">{ref}</span>
            </div>
          )}

          <div className="mt-6 flex flex-col gap-2.5">
            <Link
              to="/bookings"
              className="flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-5 py-3 text-xs font-bold text-white hover:bg-gray-800 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Về danh sách Booking & Thanh toán lại</span>
            </Link>
            <Link
              to="/"
              className="text-xs font-semibold text-gray-500 hover:text-gray-900 transition-colors py-1"
            >
              Về trang chủ
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Polling state
  if (isPolling && (!booking || booking.status === "PENDING_PAYMENT")) {
    return (
      <div className="py-16 max-w-md mx-auto text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 mb-4">
          <Loader2 className="h-8 w-8 animate-spin text-[#16A34A]" />
        </div>
        <h2 className="text-xl font-black text-gray-900">Đang xác nhận thanh toán…</h2>
        <p className="mt-2 text-xs text-gray-500 leading-relaxed">
          Hệ thống đang đồng bộ kết quả từ cổng thanh toán và xác nhận đơn đặt sân của bạn. Vui lòng giữ nguyên màn hình trong giây lát.
        </p>
      </div>
    )
  }

  const isConfirmed = booking?.status === "CONFIRMED"
  const depositVnd = paymentStatus?.depositAmountVnd ?? booking?.depositAmountVnd ?? 0
  const remainingVnd = paymentStatus?.remainingAmountVnd ?? booking?.remainingAmountVnd ?? 0
  const totalVnd = paymentStatus?.totalAmountVnd ?? booking?.totalAmountVnd ?? 0

  return (
    <div className="py-10 max-w-xl mx-auto">
      <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-lg">
        {/* Banner header */}
        <div className={`p-6 text-white text-center ${isConfirmed ? "bg-gradient-to-r from-emerald-800 to-green-700" : "bg-gradient-to-r from-amber-700 to-yellow-600"}`}>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-xs mb-3">
            {isConfirmed ? (
              <CheckCircle2 className="h-8 w-8 text-[#B4FF00]" />
            ) : (
              <Clock className="h-8 w-8 text-amber-200" />
            )}
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">
            KẾT QUẢ GIAO DỊCH THANH TOÁN
          </p>
          <h1 className="mt-1 text-2xl font-black">
            {isConfirmed ? "ĐẶT CỌC THÀNH CÔNG!" : "ĐANG CHỜ XÁC NHẬN"}
          </h1>
          <p className="mt-1 text-xs text-white/80">
            {isConfirmed
              ? "Đơn đặt sân của bạn đã được xác nhận chính thức trên hệ thống."
              : "Giao dịch đang được cổng thanh toán xử lý thêm."}
          </p>
        </div>

        {/* Content body */}
        <div className="p-6">
          {/* Booking Summary Box */}
          {booking && (
            <div className="rounded-2xl border border-gray-100 bg-gray-50/80 p-5 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Mã đơn đặt sân:</span>
                <span className="font-mono font-black text-sm text-gray-900 bg-white px-2.5 py-1 rounded-lg border border-gray-200">
                  {booking.bookingCode}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs border-t border-gray-200/60 pt-2.5">
                <span className="text-gray-500">Ngày đặt sân:</span>
                <span className="font-semibold text-gray-900 flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 text-emerald-600" />
                  {booking.bookingDate}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs border-t border-gray-200/60 pt-2.5">
                <span className="text-gray-500">Số khung giờ đã đặt:</span>
                <span className="font-semibold text-gray-900">
                  {booking.slots?.length || 0} khung giờ
                </span>
              </div>

              {totalVnd > 0 && (
                <div className="flex items-center justify-between text-xs border-t border-gray-200/60 pt-2.5">
                  <span className="text-gray-500">Tổng chi phí dự kiến:</span>
                  <span className="font-bold text-gray-900">
                    {totalVnd.toLocaleString("vi-VN")} VND
                  </span>
                </div>
              )}

              {depositVnd > 0 && (
                <>
                  <div className="flex items-center justify-between text-xs border-t border-gray-200/60 pt-2.5">
                    <span className="text-gray-500">Số tiền cọc đã thanh toán (30%):</span>
                    <span className="font-black text-emerald-700">
                      {depositVnd.toLocaleString("vi-VN")} VND
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs border-t border-gray-200/60 pt-2.5">
                    <span className="text-gray-500">Số tiền còn lại thanh toán tại sân:</span>
                    <span className="font-bold text-gray-900">
                      {remainingVnd.toLocaleString("vi-VN")} VND
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Email Notification Alert Box */}
          {isConfirmed && (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs text-emerald-950 flex items-start gap-3">
              <MailCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-emerald-900">
                  Thông báo xác nhận qua Email
                </p>
                <p className="text-[11px] leading-relaxed text-emerald-800">
                  Hệ thống đã tự động gửi email xác nhận và biên nhận đặt cọc tới hộp thư của bạn.
                  Đồng thời một email nhắc lịch thi đấu sẽ được gửi trước thời gian bắt đầu 24 tiếng.
                </p>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-6 flex flex-col gap-2.5">
            {booking && (
              <Link
                to={`/bookings/${booking.id}`}
                className="flex items-center justify-center gap-2 rounded-xl bg-[#B4FF00] px-5 py-3.5 text-xs font-black text-gray-900 hover:bg-[#AAEF00] transition-colors"
              >
                <span>Xem chi tiết Booking của bạn</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
            <Link
              to="/bookings"
              className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-3 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Về danh sách đặt sân
            </Link>
          </div>

          <div className="mt-6 border-t border-gray-100 pt-4 flex items-center justify-center gap-2 text-[11px] text-gray-400">
            <ShieldCheck className="h-3.5 w-3.5 text-gray-400" />
            <span>Xác thực bởi Sport Booking System</span>
          </div>
        </div>
      </div>
    </div>
  )
}
