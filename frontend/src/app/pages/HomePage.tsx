import { Link } from "react-router-dom"
import {
  ArrowRight,
  Sparkles,
  Activity,
  MapPin,
  Tag,
} from "lucide-react"
import { useCourts, useSportTypes } from "@/features/courts/useCourts"
import { useAuth } from "@/features/auth/useAuth"

export function HomePage() {
  const { isAuthenticated } = useAuth()
  const { data: courtsResponse, isLoading: isLoadingCourts } = useCourts({ pageSize: 6 })
  const { data: sportTypes, isLoading: isLoadingSports } = useSportTypes()

  const courts = courtsResponse?.data ?? []

  return (
    <div className="space-y-16 pb-12">
      {/* ─── Hero Section ─── */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0F3822] via-[#14532D] to-[#0A2617] px-6 py-16 text-white shadow-xl sm:px-12 sm:py-20">
        {/* Subtle decorative glow */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-96 w-96 rounded-full bg-[#22C55E]/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-96 w-96 rounded-full bg-[#B4FF00]/10 blur-3xl" />

        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-950/60 px-4 py-1.5 text-xs font-semibold text-emerald-300 backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5 text-[#B4FF00]" />
            <span>Nền tảng đặt sân thể thao trực tuyến chính thức</span>
          </div>

          <h1 className="mt-5 text-3xl font-black tracking-tight text-white sm:text-5xl sm:leading-tight">
            Đặt sân thể thao nhanh chóng, tiện lợi & chính xác
          </h1>

          <p className="mt-4 text-base font-normal text-emerald-100/90 sm:text-lg sm:leading-relaxed">
            Tra cứu lịch trống thời gian thực của các sân Cầu lông, Tennis, Pickleball tiêu chuẩn.
            Lựa chọn khung giờ linh hoạt, xác nhận tức thì và quản lý lịch đặt dễ dàng.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              to="/courts"
              className="flex items-center gap-2 rounded-xl bg-[#B4FF00] px-6 py-3.5 text-sm font-black text-gray-900 shadow-lg shadow-lime-950/20 transition-all hover:bg-[#AAEF00] active:scale-98"
            >
              <span>Khám phá danh sách sân</span>
              <ArrowRight className="h-4 w-4 stroke-[2.5]" />
            </Link>

            {isAuthenticated ? (
              <Link
                to="/bookings"
                className="flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-900/40 px-5 py-3.5 text-sm font-bold text-white backdrop-blur-sm transition-all hover:bg-emerald-800/60"
              >
                <span>Booking của tôi</span>
              </Link>
            ) : (
              <Link
                to="/register"
                className="flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-900/40 px-5 py-3.5 text-sm font-bold text-white backdrop-blur-sm transition-all hover:bg-emerald-800/60"
              >
                <span>Đăng ký thành viên</span>
              </Link>
            )}
          </div>

          {/* Key Value Badges */}
          <div className="mt-10 grid grid-cols-2 gap-4 border-t border-emerald-800/60 pt-8 sm:grid-cols-4">
            <div>
              <p className="text-2xl font-black text-white">100%</p>
              <p className="text-xs text-emerald-300">Lịch trống thời gian thực</p>
            </div>
            <div>
              <p className="text-2xl font-black text-white">Tức thì</p>
              <p className="text-xs text-emerald-300">Xác nhận tự động</p>
            </div>
            <div>
              <p className="text-2xl font-black text-white">1 - 4 Slot</p>
              <p className="text-xs text-emerald-300">Đặt khung giờ liên tiếp</p>
            </div>
            <div>
              <p className="text-2xl font-black text-white">Chủ động</p>
              <p className="text-xs text-emerald-300">Hủy lịch minh bạch</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Sport Types Categories ─── */}
      <section className="space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#16A34A]">
              BỘ MÔN THỂ THAO
            </p>
            <h2 className="text-2xl font-black tracking-tight text-gray-900">
              Chọn môn thể thao bạn muốn chơi
            </h2>
          </div>
          <Link
            to="/courts"
            className="text-xs font-bold text-[#16A34A] hover:underline"
          >
            Xem tất cả sân →
          </Link>
        </div>

        {isLoadingSports ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-white border border-gray-200" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {(sportTypes ?? []).map((sport) => (
              <Link
                key={sport.id}
                to={`/courts?sportTypeId=${sport.id}`}
                className="group flex items-center gap-3.5 rounded-2xl border border-gray-200 bg-white p-4 shadow-xs transition-all hover:border-[#16A34A] hover:shadow-md"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 transition-colors group-hover:bg-[#16A34A] group-hover:text-white">
                  <Activity className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-black text-gray-900 group-hover:text-[#16A34A] transition-colors">
                    {sport.name}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {sport.isActive ? "Đang hoạt động" : "Tạm dừng"}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ─── Featured Courts Section ─── */}
      <section className="space-y-6">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#16A34A]">
              DANH SÁCH SÂN NỔI BẬT
            </p>
            <h2 className="text-2xl font-black tracking-tight text-gray-900">
              Các sân thể thao sẵn sàng phục vụ
            </h2>
          </div>
          <Link
            to="/courts"
            className="hidden items-center gap-1 text-xs font-bold text-[#16A34A] hover:underline sm:flex"
          >
            <span>Xem toàn bộ sân</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {isLoadingCourts ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 animate-pulse rounded-2xl bg-white border border-gray-200" />
            ))}
          </div>
        ) : courts.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
            <p className="text-sm text-gray-500">Chưa có sân thể thao nào được khởi tạo.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {courts.map((court) => {
              const sportName = sportTypes?.find((s) => s.id === court.sportTypeId)?.name ?? "Thể thao"
              return (
                <div
                  key={court.id}
                  className="flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-6 shadow-xs transition-all hover:shadow-md hover:border-gray-300"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-800 border border-emerald-100">
                        {sportName}
                      </span>
                      <span className="font-mono text-xs font-semibold text-gray-400">
                        {court.code}
                      </span>
                    </div>

                    <h3 className="mt-3 text-lg font-black text-gray-900">
                      {court.name}
                    </h3>

                    <p className="mt-1 text-xs text-gray-500 flex items-center gap-1 line-clamp-1">
                      <MapPin className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      <span>{court.description || "Riverside Sports Center"}</span>
                    </p>

                    <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-gray-50 p-3 text-xs">
                      <div>
                        <span className="text-gray-400 block text-[10px]">Thời lượng slot</span>
                        <span className="font-bold text-gray-800">{court.slotDurationMinutes} phút</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[10px]">Slot liên tiếp</span>
                        <span className="font-bold text-gray-800">
                          {court.minConsecutiveSlots} - {court.maxConsecutiveSlots} slot
                        </span>
                      </div>
                    </div>

                    {court.referencePriceAmount && (
                      <div className="mt-3 flex items-center justify-between text-xs border-t border-gray-100 pt-3">
                        <span className="text-gray-400 flex items-center gap-1">
                          <Tag className="h-3 w-3 text-emerald-600" />
                          Giá tham chiếu:
                        </span>
                        <span className="font-black text-gray-900">
                          {Number(court.referencePriceAmount).toLocaleString("vi-VN")} {court.referencePriceCurrency}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="mt-5 pt-3 border-t border-gray-100 flex gap-2">
                    <Link
                      to={`/courts/${court.id}/availability`}
                      className="flex-1 text-center rounded-xl bg-[#B4FF00] py-2.5 text-xs font-black text-gray-900 transition-colors hover:bg-[#AAEF00]"
                    >
                      Xem lịch & Đặt sân
                    </Link>
                    <Link
                      to={`/courts/${court.id}`}
                      className="rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-xs font-bold text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      Chi tiết
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ─── How it Works ─── */}
      <section className="rounded-3xl border border-gray-200 bg-white p-8 shadow-xs sm:p-12">
        <div className="max-w-2xl text-center mx-auto">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#16A34A]">
            QUY TRÌNH ĐƠN GIẢN
          </p>
          <h2 className="mt-1 text-2xl font-black text-gray-900 sm:text-3xl">
            Đặt sân thể thao chỉ trong 3 bước
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            Hệ thống tự động hóa hoàn toàn, không cần chờ xét duyệt thủ công
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-3">
          <div className="relative rounded-2xl bg-gray-50 p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#16A34A] text-sm font-black text-white">
              1
            </div>
            <h3 className="mt-4 text-base font-black text-gray-900">
              Chọn sân & Bộ môn
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-gray-500">
              Dễ dàng lọc theo bộ môn Cầu lông, Tennis, Pickleball... và kiểm tra thông số quy chuẩn của từng sân.
            </p>
          </div>

          <div className="relative rounded-2xl bg-gray-50 p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#16A34A] text-sm font-black text-white">
              2
            </div>
            <h3 className="mt-4 text-base font-black text-gray-900">
              Chọn ngày & Khung giờ
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-gray-500">
              Theo dõi lịch trống cập nhật theo thời gian thực và chọn các slot giờ liên tiếp phù hợp nhu cầu tập luyện.
            </p>
          </div>

          <div className="relative rounded-2xl bg-gray-50 p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#16A34A] text-sm font-black text-white">
              3
            </div>
            <h3 className="mt-4 text-base font-black text-gray-900">
              Xác nhận & Nhận mã
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-gray-500">
              Giao dịch được bảo vệ an toàn với mã xác nhận tức thì. Dễ dàng theo dõi và hủy lịch nếu có việc đột xuất.
            </p>
          </div>
        </div>
      </section>

      {/* ─── Bottom CTA ─── */}
      <section className="rounded-3xl bg-[#16A34A] p-8 text-white shadow-lg sm:p-12 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl font-black text-white sm:text-3xl">
            Sẵn sàng cho trận đấu tiếp theo?
          </h2>
          <p className="mt-1 text-sm text-emerald-100">
            Đặt sân ngay hôm nay để có được khung giờ tập luyện lý tưởng nhất.
          </p>
        </div>
        <Link
          to="/courts"
          className="shrink-0 rounded-xl bg-white px-6 py-3.5 text-sm font-black text-emerald-950 transition-colors hover:bg-emerald-50 shadow-md"
        >
          Khám phá danh sách sân
        </Link>
      </section>
    </div>
  )
}