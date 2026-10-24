import { Link, Outlet, useLocation, useNavigate } from "react-router-dom"
import { LogOut } from "lucide-react"
import { useAuth } from "@/features/auth/useAuth"

/** Brand logo — used in the header */
function BrandLogo() {
  return (
    <Link to="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#22C55E]">
        <svg width="16" height="12" viewBox="0 0 18 14" fill="none">
          <rect width="18" height="2.5" rx="1.25" fill="white" />
          <rect y="5.5" width="14" height="2.5" rx="1.25" fill="white" />
          <rect y="11" width="18" height="2.5" rx="1.25" fill="white" />
        </svg>
      </div>
      <div>
        <p className="text-sm font-black tracking-wider text-gray-900">SÂN</p>
        <p className="text-[8px] uppercase tracking-widest text-gray-400 leading-none">Đặt sân thể thao</p>
      </div>
    </Link>
  )
}

/**
 * AppLayout — wraps all pages with a brand header.
 * Auth pages (login/register) bypass the header since they have
 * their own full-screen split layout.
 */
export function AppLayout() {
  const { isAuthenticated, user, logout, isLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Auth pages are full-screen — no header needed
  const isAuthPage = ["/login", "/register"].includes(location.pathname)
  if (isAuthPage) {
    return <Outlet />
  }

  function handleLogout() {
    logout()
    navigate("/login", { replace: true })
  }

  const initials = user?.fullName?.charAt(0).toUpperCase() ?? "?"

  return (
    <div className="min-h-screen bg-[#F0F4EF] font-sans">
      {/* ─── Header ─── */}
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
          <BrandLogo />

          {/* Nav */}
          <nav className="hidden items-center gap-7 text-sm font-semibold sm:flex">
            <Link
              to="/courts"
              className={`pb-1 transition-all ${
                location.pathname.startsWith("/courts")
                  ? "border-b-2 border-[#16A34A] text-gray-900"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              Courts
            </Link>
            <Link
              to="/bookings"
              className={`pb-1 transition-all ${
                location.pathname === "/bookings"
                  ? "border-b-2 border-[#16A34A] text-gray-900"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              Booking của tôi
            </Link>
            <Link
              to="/bookings/review"
              className={`pb-1 transition-all ${
                location.pathname === "/bookings/review"
                  ? "border-b-2 border-[#16A34A] text-gray-900"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              Review Handoff
            </Link>
            {isAuthenticated && (
              <Link
                to="/profile"
                className={`pb-1 transition-all ${
                  location.pathname === "/profile"
                    ? "border-b-2 border-[#16A34A] text-gray-900"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                Profile
              </Link>
            )}
            {user?.role === "ADMIN" && (
              <Link
                to="/admin"
                className={`pb-1 transition-all ${
                  location.pathname.startsWith("/admin")
                    ? "border-b-2 border-[#16A34A] text-gray-900"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                Quản trị
              </Link>
            )}
          </nav>

          {/* Auth actions */}
          <div className="flex items-center gap-3">
            {isLoading ? (
              <div className="h-8 w-24 animate-pulse rounded-full bg-gray-100" />
            ) : isAuthenticated ? (
              <>
                {user?.role === "ADMIN" && (
                  <Link
                    to="/admin"
                    className={`hidden rounded-xl border px-3.5 py-1.5 text-xs font-bold shadow-xs transition-colors sm:inline-block ${
                      location.pathname.startsWith("/admin")
                        ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                        : "border-gray-200 bg-white text-gray-800 hover:bg-gray-50"
                    }`}
                  >
                    Admin
                  </Link>
                )}
                <Link
                  to="/profile"
                  className="flex items-center gap-2.5 rounded-full border border-gray-200 bg-white py-1 pl-1.5 pr-3 text-xs shadow-xs hover:bg-gray-50 transition-colors"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-black text-emerald-800">
                    {initials}
                  </div>
                  <div className="text-left leading-tight">
                    <p className="font-bold text-gray-800">{user?.email ?? user?.fullName}</p>
                    <p className="text-[9px] uppercase tracking-wider text-gray-400">{user?.role ?? "User"}</p>
                  </div>
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Log out</span>
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                  Đăng nhập
                </Link>
                <Link
                  to="/register"
                  className="rounded-xl bg-[#B4FF00] px-4 py-2 text-sm font-bold text-gray-900 hover:bg-[#AAEF00] transition-colors"
                >
                  Đăng ký
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ─── Main content ─── */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}