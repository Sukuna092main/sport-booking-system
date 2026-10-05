import { Link, Outlet } from "react-router-dom"

export function AppLayout() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <Link to="/" className="font-semibold">
            Sport Booking System
          </Link>

          <nav className="flex items-center gap-4 text-sm">
            <Link to="/courts">Courts</Link>
            <Link to="/bookings">Bookings</Link>
            <Link to="/profile">Profile</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}