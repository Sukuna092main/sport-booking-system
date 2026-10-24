import { Link, NavLink, Outlet } from "react-router-dom"
import { Shield, Layers, LayoutGrid, ArrowLeft, CalendarCheck, CalendarX } from "lucide-react"

export function AdminLayout() {
  return (
    <div className="space-y-6">
      {/* ── Admin Header ── */}
      <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-700 border border-emerald-200">
              <Shield className="h-3 w-3" />
              Role: Admin
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Sport Booking System
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-gray-900 sm:text-3xl">
            TRUNG TÂM QUẢN TRỊ
          </h1>
          <p className="mt-0.5 text-xs text-gray-500 sm:text-sm">
            Quản lý thông tin sân, cấu hình slot và danh mục các bộ môn thể thao
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/courts"
            className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Giao diện người dùng</span>
          </Link>
        </div>
      </div>

      {/* ── Sub Navigation Tabs ── */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-px">
        <NavLink
          to="/admin/courts"
          className={({ isActive }) =>
            `flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-all ${
              isActive
                ? "border-[#16A34A] text-emerald-800 bg-white rounded-t-xl"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-900"
            }`
          }
        >
          <LayoutGrid className="h-4 w-4" />
          <span>Sân Thể Thao (Courts)</span>
        </NavLink>

        <NavLink
          to="/admin/schedule"
          className={({ isActive }) =>
            `flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-all ${
              isActive
                ? "border-[#16A34A] text-emerald-800 bg-white rounded-t-xl"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-900"
            }`
          }
        >
          <CalendarCheck className="h-4 w-4" />
          <span>Lịch & Khung Giờ (Schedule)</span>
        </NavLink>

        <NavLink
          to="/admin/blackouts"
          className={({ isActive }) =>
            `flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-all ${
              isActive
                ? "border-[#16A34A] text-emerald-800 bg-white rounded-t-xl"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-900"
            }`
          }
        >
          <CalendarX className="h-4 w-4" />
          <span>Khóa Sân (Blackout)</span>
        </NavLink>

        <NavLink
          to="/admin/sport-types"
          className={({ isActive }) =>
            `flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-all ${
              isActive
                ? "border-[#16A34A] text-emerald-800 bg-white rounded-t-xl"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-900"
            }`
          }
        >
          <Layers className="h-4 w-4" />
          <span>Loại Thể Thao (Sport Types)</span>
        </NavLink>
      </div>

      {/* ── Tab Content ── */}
      <div>
        <Outlet />
      </div>
    </div>
  )
}
