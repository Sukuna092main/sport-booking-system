import { useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import { authApi } from "@/lib/api/auth"

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError("")
    try {
      await authApi.forgotPassword(email.trim().toLowerCase())
      setSent(true)
    } catch {
      setError("Chưa gửi được yêu cầu. Vui lòng kiểm tra kết nối và thử lại.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mx-auto mt-12 max-w-md rounded-2xl border border-gray-200 bg-white p-7 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Khôi phục tài khoản</p>
      <h1 className="mt-2 text-2xl font-black text-gray-900">Quên mật khẩu?</h1>
      <p className="mt-2 text-sm text-gray-500">Nhập email tài khoản. Nếu địa chỉ hợp lệ, hệ thống sẽ gửi hướng dẫn đặt lại mật khẩu.</p>
      {sent ? <p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">Nếu email thuộc một tài khoản hợp lệ, hướng dẫn đặt lại mật khẩu sẽ được gửi. Hãy kiểm tra hộp thư và thư rác.</p> : (
        <form onSubmit={(event) => void submit(event)} className="mt-5 space-y-4">
          <label className="block text-sm font-semibold text-gray-700">Email<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 block w-full rounded-xl border border-gray-300 px-3 py-2.5" /></label>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <button disabled={busy} className="w-full rounded-xl bg-[#B4FF00] px-4 py-3 text-sm font-bold text-gray-900 disabled:opacity-60">{busy ? "Đang gửi…" : "Gửi hướng dẫn"}</button>
        </form>
      )}
      <Link to="/login" className="mt-5 block text-center text-sm font-semibold text-emerald-700 hover:underline">Quay lại đăng nhập</Link>
    </section>
  )
}
