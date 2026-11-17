import { useEffect, useState, type FormEvent } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { authApi } from "@/lib/api/auth"

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get("token") ?? ""
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!token) return
    const cleanURL = new URL(window.location.href)
    cleanURL.searchParams.delete("token")
    window.history.replaceState(window.history.state, "", cleanURL.toString())
  }, [token])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError("")
    if (!token) return setError("Liên kết thiếu token đặt lại mật khẩu. Hãy yêu cầu một liên kết mới.")
    if ([...password].length < 8 || new TextEncoder().encode(password).length > 72) return setError("Mật khẩu phải có ít nhất 8 ký tự và tối đa 72 byte UTF-8.")
    if (password !== confirm) return setError("Hai mật khẩu không khớp.")
    setBusy(true)
    try {
      await authApi.resetPassword(token, password)
      setDone(true)
      window.dispatchEvent(new CustomEvent("auth:unauthorized"))
    } catch (failure) {
      const apiMessage = (failure as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message
      setError(apiMessage ?? "Không thể đặt lại mật khẩu. Liên kết có thể đã hết hạn hoặc đã được sử dụng.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mx-auto mt-12 max-w-md rounded-2xl border border-gray-200 bg-white p-7 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Bảo vệ tài khoản</p>
      <h1 className="mt-2 text-2xl font-black text-gray-900">Đặt mật khẩu mới</h1>
      {done ? <div role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">Mật khẩu đã được cập nhật. Các phiên đăng nhập cũ đã bị thu hồi. <Link to="/login" className="font-bold underline">Đăng nhập lại</Link>.</div> : (
        <form onSubmit={(event) => void submit(event)} className="mt-5 space-y-4">
          <label className="block text-sm font-semibold text-gray-700">Mật khẩu mới<input required type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1.5 block w-full rounded-xl border border-gray-300 px-3 py-2.5" /></label>
          <label className="block text-sm font-semibold text-gray-700">Nhập lại mật khẩu<input required type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} className="mt-1.5 block w-full rounded-xl border border-gray-300 px-3 py-2.5" /></label>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <button disabled={busy} className="w-full rounded-xl bg-[#B4FF00] px-4 py-3 text-sm font-bold text-gray-900 disabled:opacity-60">{busy ? "Đang cập nhật…" : "Cập nhật mật khẩu"}</button>
        </form>
      )}
      <Link to="/login" className="mt-5 block text-center text-sm font-semibold text-emerald-700 hover:underline">Quay lại đăng nhập</Link>
    </section>
  )
}
