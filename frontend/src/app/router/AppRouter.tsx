import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { AuthProvider } from "@/features/auth/AuthContext"
import { AppLayout } from "@/components/layout/AppLayout"
import { BookingsPage } from "@/app/pages/BookingsPage"
import { BookingDetailPage } from "@/app/pages/BookingDetailPage"
import { CourtsPage } from "@/app/pages/CourtsPage"
import { CourtDetailPage } from "@/app/pages/CourtDetailPage"
import { CourtAvailabilityPage } from "@/app/pages/CourtAvailabilityPage"
import { BookingReviewPage } from "@/app/pages/BookingReviewPage"
import { HomePage } from "@/app/pages/HomePage"
import { LoginPage } from "@/app/pages/LoginPage"
import { ProfilePage } from "@/app/pages/ProfilePage"
import { RegisterPage } from "@/app/pages/RegisterPage"
import { ForbiddenPage } from "@/app/pages/ForbiddenPage"
import { AdminLayout } from "@/features/admin/AdminLayout"
import { AdminCourtsPage } from "@/app/pages/AdminCourtsPage"
import { AdminSportTypesPage } from "@/app/pages/AdminSportTypesPage"
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
            <Route path="/forbidden" element={<ForbiddenPage />} />

            {/* Courts — public browse/search/detail/availability */}
            <Route path="/courts" element={<CourtsPage />} />
            <Route path="/courts/:courtId" element={<CourtDetailPage />} />
            <Route path="/courts/:courtId/availability" element={<CourtAvailabilityPage />} />

            {/* Booking review & handoff verification */}
            <Route path="/bookings/review" element={<BookingReviewPage />} />

            {/* USER-protected routes (any authenticated user) */}
            <Route element={<ProtectedRoute />}>
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/bookings" element={<BookingsPage />} />
              <Route path="/bookings/:bookingId" element={<BookingDetailPage />} />
            </Route>

            {/* ADMIN-only routes */}
            <Route element={<ProtectedRoute requiredRole="ADMIN" />}>
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<Navigate to="/admin/courts" replace />} />
                <Route path="courts" element={<AdminCourtsPage />} />
                <Route path="sport-types" element={<AdminSportTypesPage />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}