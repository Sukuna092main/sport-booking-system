import { useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { Loader2 } from "lucide-react"
import { paymentsApi } from "@/features/bookings/payments"

export function MockPaymentPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const ref = params.get("ref") ?? ""
  const bookingId = params.get("bookingId") ?? ""

  async function complete() {
    if (!ref) return
    setBusy(true)
    setError("")
    try {
      await paymentsApi.completeMock(ref)
      navigate(`/payment-result?gateway=mock&bookingId=${encodeURIComponent(bookingId)}`, { replace: true })
    } catch {
      setError("Không thể xác nhận giao dịch mô phỏng. Hãy thử lại hoặc kiểm tra lịch booking.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mx-auto mt-10 max-w-xl rounded-2xl border border-amber-200 bg-white p-7 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-widest text-amber-700">Môi trường development</p>
      <h1 className="mt-2 text-2xl font-black text-gray-900">Thanh toán mô phỏng</h1>
      <p className="mt-3 text-sm leading-relaxed text-gray-600">Đây là mock gateway để kiểm tra luồng đặt cọc. Không có tiền thật bị trừ. Khi xác nhận, backend sẽ ghi nhận một callback mô phỏng và cập nhật trạng thái booking.</p>
      <div className="mt-5 rounded-xl bg-gray-50 p-3 text-xs text-gray-600">Mã giao dịch: <span className="font-mono font-semibold">{ref || "Không hợp lệ"}</span></div>
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button disabled={!ref || busy} onClick={() => void complete()} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#B4FF00] px-5 py-3.5 text-sm font-bold text-gray-900 disabled:opacity-50">
        {busy && <Loader2 className="h-4 w-4 animate-spin"/>}{busy ? "Đang xác nhận…" : "Xác nhận thanh toán mô phỏng"}
      </button>
      <Link to="/bookings" className="mt-4 block text-center text-sm font-semibold text-emerald-700 hover:underline">Quay lại lịch booking</Link>
    </section>
  )
}
