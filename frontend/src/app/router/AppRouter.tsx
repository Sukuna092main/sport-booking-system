import { BrowserRouter, Route, Routes } from "react-router-dom"
import { AuthProvider } from "@/features/auth/AuthContext"
import { AppLayout } from "@/components/layout/AppLayout"
import { BookingsPage } from "@/app/pages/BookingsPage"
import { CourtsPage } from "@/app/pages/CourtsPage"
import { CourtDetailPage } from "@/app/pages/CourtDetailPage"
import { CourtAvailabilityPage } from "@/app/pages/CourtAvailabilityPage"
import { HomePage } from "@/app/pages/HomePage"
import { LoginPage } from "@/app/pages/LoginPage"
import { ProfilePage } from "@/app/pages/ProfilePage"
import { RegisterPage } from "@/app/pages/RegisterPage"
import { ProtectedRoute } from "./ProtectedRoute"

export function AppRouter() {
  return (
    <BrowserRouter>
      {/* AuthProvider wraps everything so useAuth() is available in all routes */}
      <AuthProvider>
        <Routes>
          <Route element={<AppLayout />}>
            {/* Public routes */}
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Courts — public browse/search/detail/availability */}
            <Route path="/courts" element={<CourtsPage />} />
            <Route path="/courts/:courtId" element={<CourtDetailPage />} />
            <Route path="/courts/:courtId/availability" element={<CourtAvailabilityPage />} />

            {/* USER-protected routes (any authenticated user) */}
            <Route element={<ProtectedRoute />}>
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/bookings" element={<BookingsPage />} />
            </Route>

            {/* ADMIN-only routes */}
            <Route element={<ProtectedRoute requiredRole="ADMIN" />}>
              {/* Future admin pages go here */}
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}