import { Navigate, Outlet, useLocation } from "react-router-dom"
import { useAuth } from "@/features/auth/AuthContext"
import type { UserRole } from "@/types/auth.types"

interface ProtectedRouteProps {
  /** If provided, only users with this role can access. Others see 403 redirect. */
  requiredRole?: UserRole
}

/**
 * ProtectedRoute — reads auth state from AuthContext.
 * - isLoading: renders nothing while re-hydrating session.
 * - Not authenticated: redirect to /login with `from` state.
 * - Wrong role: redirect to /forbidden (or / for USER role trying admin routes).
 * - OK: render <Outlet />.
 */
export function ProtectedRoute({ requiredRole }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth()
  const location = useLocation()

  // While re-hydrating token from localStorage, show nothing to avoid flash
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="text-muted-foreground text-sm">Đang tải...</span>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <Navigate to="/login" replace state={{ from: location.pathname }} />
    )
  }

  if (requiredRole && user?.role !== requiredRole) {
    // USER trying to access ADMIN route → back to home
    return <Navigate to="/" replace />
  }

  return <Outlet />
}