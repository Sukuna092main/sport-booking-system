import { useEffect, useState, useCallback } from "react"
import { useSearchParams, Link } from "react-router-dom"
import {
  CheckCircle2,
  XCircle,
  Loader2,
  CalendarDays,
  Clock,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  MailCheck,
  RotateCcw,
  RefreshCw,
} from "lucide-react"
import { paymentsApi } from "@/lib/api/payments"
import { bookingsApi } from "@/lib/api/bookings"
import type { BookingItem } from "@/features/bookings/types"
import type { PaymentStatus } from "@/types/payment.types"

export function PaymentResultPage() {
  const [searchParams] = useSearchParams()

  const queryBookingId = searchParams.get("bookingId") || ""
  const sessionId = searchParams.get("session_id") || ""
  const ref = searchParams.get("ref") || ""
  const gatewayStatus = searchParams.get("gateway") || "pending"

  const [booking, setBooking] = useState<BookingItem | null>(null)
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null)
  const [isPolling, setIsPolling] = useState(gatewayStatus !== "failed")
  const [pollCount, setPollCount] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const fetchStatus = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true)
    try {
      const savedBookingId = sessionStorage.getItem("pending_booking_id")
      let bId = queryBookingId || savedBookingId
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

        setBooking(bookingRes.data)
        if (payRes) setPaymentStatus(payRes.data)

        if (
          bookingRes.data.status === "CONFIRMED" ||
          bookingRes.data.status === "EXPIRED" ||
          payRes?.data?.payment?.status === "PAID" ||
          payRes?.data?.payment?.status === "PAID_REVIEW" ||
          pollCount >= 8
        ) {
          setIsPolling(false)
        } else if (!isManual) {
          setPollCount((prev) => prev + 1)
        }
      } else {
        setIsPolling(false)
      }
    } catch {
      setIsPolling(false)
    } finally {
      if (isManual) setIsRefreshing(false)
    }
  }, [pollCount, queryBookingId])

  // Find booking on mount and poll
  useEffect(() => {
    let isMounted = true

    if (gatewayStatus === "failed") {
      return
    }

    if (isPolling) {
      const timer = setTimeout(() => {
        if (isMounted) fetchStatus(false)
      }, 1500)
      return () => {
        isMounted = false
        clearTimeout(timer)
      }
    }
  }, [fetchStatus, gatewayStatus, isPolling])

  function handleManualRefresh() {
    fetchStatus(true)
  }

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
          {sessionId && (
            <div className="mt-2 inline-block rounded-xl bg-gray-50 px-3.5 py-1 text-[11px] font-mono text-gray-500 border border-gray-100 max-w-xs truncate">
              Session: <span className="font-semibold text-gray-700">{sessionId}</span>
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

  const isConfirmed = booking?.status === "CONFIRMED" || paymentStatus?.payment?.status === "PAID"
  const isPaidReview = paymentStatus?.payment?.status === "PAID_REVIEW"
  const isPending = !isConfirmed && !isPaidReview
  const depositVnd = paymentStatus?.depositAmountVnd ?? booking?.depositAmountVnd ?? 0
  const remainingVnd = paymentStatus?.remainingAmountVnd ?? booking?.remainingAmountVnd ?? 0
  const totalVnd = paymentStatus?.totalAmountVnd ?? booking?.totalAmountVnd ?? 0

  return (
    <div className="py-10 max-w-xl mx-auto">
      <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-lg">
        {/* Banner header */}
        <div
          className={`p-6 text-white text-center ${
            isConfirmed
              ? "bg-gradient-to-r from-emerald-800 to-green-700"
              : isPaidReview
              ? "bg-gradient-to-r from-blue-800 to-indigo-700"
              : "bg-gradient-to-r from-amber-700 to-yellow-600"
          }`}
        >
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-xs mb-3">
            {isConfirmed ? (
              <CheckCircle2 className="h-8 w-8 text-[#B4FF00]" />
            ) : isPaidReview ? (
              <ShieldAlert className="h-8 w-8 text-blue-200" />
            ) : (
              <Clock className="h-8 w-8 text-amber-200" />
            )}
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">
            KẾT QUẢ GIAO DỊCH THANH TOÁN
          </p>
          <h1 className="mt-1 text-2xl font-black">
            {isConfirmed
              ? "ĐẶT CỌC THÀNH CÔNG!"
              : isPaidReview
              ? "CHỜ ĐỐI SOÁT (PAID_REVIEW)"
              : "ĐANG CHỜ XÁC NHẬN"}
          </h1>
          <p className="mt-1 text-xs text-white/80">
            {isConfirmed
              ? "Đơn đặt sân của bạn đã được xác nhận chính thức trên hệ thống."
              : isPaidReview
              ? "Giao dịch thanh toán cọc đã được ghi nhận. Hệ thống đang tiến hành đối soát và người quản lý sẽ cập nhật đơn."
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

              {ref && (
                <div className="flex items-center justify-between text-xs border-t border-gray-200/60 pt-2.5">
                  <span className="text-gray-500">Mã tham chiếu (Ref):</span>
                  <span className="font-mono font-semibold text-gray-700 bg-white px-2 py-0.5 rounded border border-gray-200">
                    {ref}
                  </span>
                </div>
              )}

              {sessionId && (
                <div className="flex items-center justify-between text-xs border-t border-gray-200/60 pt-2.5">
                  <span className="text-gray-500">Mã phiên thanh toán (Stripe):</span>
                  <span className="font-mono text-[11px] text-gray-700 bg-white px-2 py-0.5 rounded border border-gray-200 max-w-[200px] truncate" title={sessionId}>
                    {sessionId}
                  </span>
                </div>
              )}

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

          {/* PAID_REVIEW Alert Box */}
          {isPaidReview && (
            <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50/70 p-4 text-xs text-blue-950 flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-blue-900">
                  Giao dịch thanh toán cọc cần đối soát thủ công
                </p>
                <p className="text-[11px] leading-relaxed text-blue-800">
                  Cổng thanh toán đã nhận tiền cọc của bạn. Vì giao dịch được ghi nhận sau hạn hoặc cần kiểm duyệt bổ sung, quản trị viên sẽ đối soát và xử lý đơn đặt sân của bạn sớm nhất.
                </p>
              </div>
            </div>
          )}

          {/* Pending Alert Box */}
          {isPending && (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-950 flex items-start gap-3">
              <Clock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-amber-900">
                  Chờ phản hồi từ cổng thanh toán
                </p>
                <p className="text-[11px] leading-relaxed text-amber-800">
                  Nếu bạn vừa hoàn tất thanh toán thẻ trên cổng thanh toán, vui lòng bấm nút &quot;Làm mới trạng thái&quot; bên dưới để kiểm tra lại kết quả.
                </p>
              </div>
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

            {/* Manual refresh button */}
            <button
              type="button"
              id="payment-refresh-btn"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-3 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-gray-500 ${isRefreshing ? "animate-spin text-emerald-600" : ""}`} />
              <span>{isRefreshing ? "Đang đồng bộ trạng thái…" : "Làm mới trạng thái (Kiểm tra lại)"}</span>
            </button>

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
