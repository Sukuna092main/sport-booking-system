import { Link } from "react-router-dom"
import { ShieldAlert, ArrowLeft, Home } from "lucide-react"

export function ForbiddenPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100 text-red-600 shadow-sm">
        <ShieldAlert className="h-8 w-8" />
      </div>
      <span className="mt-4 inline-flex items-center rounded-full bg-red-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-red-600">
        403 - Quyền truy cập bị từ chối
      </span>
      <h1 className="mt-2 text-3xl font-black uppercase tracking-tight text-gray-900">
        Không có quyền truy cập
      </h1>
      <p className="mt-2 max-w-md text-sm text-gray-500">
        Tài khoản của bạn không có quyền truy cập vào chức năng hoặc trang quản trị này. Nếu bạn cho rằng đây là sự nhầm lẫn, vui lòng liên hệ quản trị viên.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          to="/"
          className="flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-gray-800"
        >
          <Home className="h-4 w-4" />
          Về trang chủ
        </Link>
        <Link
          to="/courts"
          className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Xem danh sách sân
        </Link>
      </div>
    </div>
  )
}
