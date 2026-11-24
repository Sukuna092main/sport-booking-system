import { useState } from "react"
import { useSearchParams, useNavigate, Link } from "react-router-dom"
import { AxiosError } from "axios"
import {
  CreditCard,
  ShieldCheck,
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle,
  ArrowLeft,
  Building2,
  Clock,
} from "lucide-react"
import { paymentsApi } from "@/lib/api/payments"
import type { ApiErrorResponse } from "@/types/auth.types"

export function MockPaymentPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const orderRef = searchParams.get("ref") || ""

  const [isProcessing, setIsProcessing] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  if (!orderRef) {
    return (
      <div className="py-12 max-w-lg mx-auto">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-rose-500 mx-auto mb-2" />
          <h2 className="text-base font-bold text-rose-900">Thiếu mã giao dịch thanh toán</h2>
          <p className="mt-1 text-xs text-rose-700">
            Không tìm thấy thông tin tham chiếu đơn thanh toán (orderRef) trong đường dẫn.
          </p>
          <div className="mt-4">
            <Link
              to="/bookings"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-800 underline"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Về danh sách Booking của tôi
            </Link>
          </div>
        </div>
      </div>
    )
  }

  async function handleComplete(success: boolean) {
    setIsProcessing(true)
    setErrorMsg(null)

    try {
      await paymentsApi.completeMockPayment(orderRef, success)
      navigate(`/payment-result?ref=${encodeURIComponent(orderRef)}&gateway=${success ? "pending" : "failed"}`)
    } catch (err: unknown) {
      if (err instanceof AxiosError) {
        const data = err.response?.data as ApiErrorResponse | undefined
        if (err.response?.status === 404) {
          setErrorMsg("Giao dịch không tồn tại hoặc đã hết hạn giữ chỗ (404 Not Found).")
        } else {
          setErrorMsg(data?.error?.message ?? "Không thể hoàn tất giao dịch mô phỏng. Vui lòng thử lại.")
        }
      } else {
        setErrorMsg("Lỗi kết nối máy chủ.")
      }
      setIsProcessing(false)
    }
  }

  return (
    <div className="py-8 max-w-xl mx-auto">
      {/* Top breadcrumb */}
      <Link
        to="/bookings"
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Về danh sách Booking
      </Link>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-md">
        {/* Header bar */}
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#B4FF00] text-gray-950 font-black">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#B4FF00]">
                  CỔNG THANH TOÁN TRỰC TUYẾN
                </p>
                <h1 className="text-lg font-black tracking-tight">Xác nhận thanh toán đặt cọc</h1>
              </div>
            </div>
            <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-mono font-semibold text-white/80">
              BẢO MẬT SSL / TLS
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5 text-xs text-emerald-900 leading-relaxed flex items-start gap-2.5">
            <Building2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <strong>Thanh toán trực tuyến an toàn:</strong> Giao dịch thanh toán cọc trực tuyến của bạn được bảo mật theo tiêu chuẩn.
              Vui lòng kiểm tra mã tham chiếu đơn đặt sân và bấm xác nhận để hoàn tất giao dịch.
            </div>
          </div>

          {/* Transaction Info Box */}
          <div className="mt-5 rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">Mã tham chiếu thanh toán (Ref):</span>
              <span className="font-mono font-bold text-gray-900">{orderRef}</span>
            </div>
            <div className="flex items-center justify-between text-xs border-t border-gray-200/60 pt-2.5">
              <span className="text-gray-500">Hình thức thanh toán:</span>
              <span className="font-semibold text-gray-900">Đặt cọc trực tuyến (30%)</span>
            </div>
            <div className="flex items-center justify-between text-xs border-t border-gray-200/60 pt-2.5">
              <span className="text-gray-500">Thời gian giữ chỗ:</span>
              <span className="font-semibold text-emerald-700 flex items-center gap-1">
                <Clock className="h-3 w-3" /> Tối đa 35 phút kể từ lúc đặt
              </span>
            </div>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-600 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              id="mock-pay-success-btn"
              onClick={() => handleComplete(true)}
              disabled={isProcessing}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#16A34A] py-3.5 px-4 text-sm font-bold text-white shadow-xs hover:bg-[#15803D] active:scale-[0.99] disabled:opacity-60 transition-all"
            >
              {isProcessing ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Đang xử lý giao dịch…</>
              ) : (
                <><CheckCircle className="h-4 w-4" /> Xác nhận thanh toán cọc thành công</>
              )}
            </button>

            <button
              type="button"
              id="mock-pay-fail-btn"
              onClick={() => handleComplete(false)}
              disabled={isProcessing}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-300 bg-rose-50 py-3 px-4 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-60 transition-all"
            >
              <XCircle className="h-4 w-4" />
              Hủy giao dịch / Quay lại
            </button>
          </div>

          {/* Security footnote */}
          <div className="mt-6 border-t border-gray-100 pt-4 flex items-center justify-center gap-2 text-[11px] text-gray-400">
            <ShieldCheck className="h-3.5 w-3.5 text-gray-400" />
            <span>Xác thực giao dịch an toàn · Sport Booking Gateway</span>
          </div>
        </div>
      </div>
    </div>
  )
}
