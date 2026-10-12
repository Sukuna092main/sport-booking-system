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
          <nav className="hidden items-center gap-6 text-sm font-medium text-gray-500 sm:flex">
            <Link to="/courts" className="transition-colors hover:text-gray-900">Sân thể thao</Link>
            {isAuthenticated && (
              <Link to="/bookings" className="transition-colors hover:text-gray-900">Đặt sân của tôi</Link>
            )}
          </nav>

          {/* Auth actions */}
          <div className="flex items-center gap-3">
            {isLoading ? (
              <div className="h-8 w-24 animate-pulse rounded-full bg-gray-100" />
            ) : isAuthenticated ? (
              <>
                <Link
                  to="/profile"
                  className="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 py-1 pl-1 pr-3 text-sm hover:bg-gray-100 transition-colors"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#22C55E] text-[10px] font-bold text-white">
                    {initials}
                  </div>
                  <span className="font-medium text-gray-700">{user?.fullName?.split(" ").pop()}</span>
                  <span className="text-[10px] uppercase text-gray-400">{user?.role}</span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Đăng xuất</span>
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