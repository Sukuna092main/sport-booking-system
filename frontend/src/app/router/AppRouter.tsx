import { BrowserRouter, Route, Routes } from "react-router-dom"
import { AppLayout } from "@/components/layout/AppLayout"
import { BookingsPage } from "@/app/pages/BookingsPage"
import { CourtsPage } from "@/app/pages/CourtsPage"
import { HomePage } from "@/app/pages/HomePage"
import { LoginPage } from "@/app/pages/LoginPage"
import { ProfilePage } from "@/app/pages/ProfilePage"
import { RegisterPage } from "@/app/pages/RegisterPage"
import { ProtectedRoute } from "./ProtectedRoute"

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          <Route path="/courts" element={<CourtsPage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/bookings" element={<BookingsPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}