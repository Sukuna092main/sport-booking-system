import { useMemo, useState, useEffect } from "react"
import { useSearchParams, Link } from "react-router-dom"
import {
  Clock,
  LayoutGrid,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronDown,
  Sliders,
  CalendarCheck,
  CalendarDays,
  Loader2,
  ExternalLink,
} from "lucide-react"
import type { Court } from "@/types/court.types"
import {
  useAdminCourts,
  useAdminSportTypes,
} from "@/features/admin/courts/useAdminCourts"
import { useCourtOperatingHours } from "@/features/admin/schedule/useAdminSchedule"
import { OperatingHoursForm } from "@/features/admin/schedule/OperatingHoursForm"
import { SlotPolicyForm } from "@/features/admin/schedule/SlotPolicyForm"
import { CurrentSlotsView } from "@/features/admin/schedule/CurrentSlotsView"
import { DateAvailabilityInspector } from "@/features/admin/schedule/DateAvailabilityInspector"

type TabKey = "hours" | "policy" | "slots" | "availability"

export function AdminSchedulePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialCourtId = searchParams.get("courtId") || ""

  const [activeTab, setActiveTab] = useState<TabKey>("hours")

  // Fetch all courts (pageSize 100 for admin selector)
  const {
    data: courtsData,
    isLoading: isCourtsLoading,
    isError: isCourtsError,
    error: courtsError,
    refetch: refetchCourts,
  } = useAdminCourts({ pageSize: 100 })

  const { data: sportTypes } = useAdminSportTypes()

  const courts = useMemo(() => courtsData?.data ?? [], [courtsData?.data])

  // Sport type lookup map
  const sportTypeMap = useMemo(() => {
    return new Map((sportTypes ?? []).map((s) => [s.id, s]))
  }, [sportTypes])

  // Selected court
  const selectedCourt: Court | null = useMemo(() => {
    if (courts.length === 0) return null
    if (initialCourtId) {
      const found = courts.find((c) => c.id === initialCourtId)
      if (found) return found
    }
    return courts[0]
  }, [courts, initialCourtId])

  // Sync selected court to URL param if not set
  useEffect(() => {
    if (selectedCourt && (!initialCourtId || initialCourtId !== selectedCourt.id)) {
      setSearchParams({ courtId: selectedCourt.id }, { replace: true })
    }
  }, [selectedCourt, initialCourtId, setSearchParams])

  // Fetch operating hours for selected court
  const {
    data: operatingHoursData,
    isLoading: isHoursLoading,
    isError: isHoursError,
    error: hoursError,
    refetch: refetchHours,
  } = useCourtOperatingHours(selectedCourt?.id || "")

  function handleSelectCourt(id: string) {
    setSearchParams({ courtId: id })
  }

  return (
    <div className="space-y-6">
      {/* ── Top Header & Court Selector ── */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-800 border border-emerald-200">
                <Clock className="h-3 w-3" />
                Schedule & TimeSlot Engine
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Contract FR-07 & 0.5.0
              </span>
            </div>
            <h1 className="mt-1 text-xl font-black tracking-tight text-gray-900 sm:text-2xl">
              QUẢN LÝ LỊCH HOẠT ĐỘNG & TIME SLOT
            </h1>
            <p className="mt-0.5 text-xs text-gray-500 sm:text-sm">
              Cấu hình giờ mở cửa theo ngày, thời lượng slot, min/max booking và kiểm tra availability
            </p>
          </div>

          {/* Court Selector Dropdown */}
          <div className="flex flex-col gap-1.5 sm:min-w-[320px]">
            <label htmlFor="courtSelect" className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
              Chọn sân để cấu hình:
            </label>
            {isCourtsLoading ? (
              <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                <span>Đang tải danh sách sân...</span>
              </div>
            ) : courts.length === 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                Chưa có sân nào trong hệ thống
              </div>
            ) : (
              <div className="relative">
                <select
                  id="courtSelect"
                  value={selectedCourt?.id || ""}
                  onChange={(e) => handleSelectCourt(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 pr-10 text-xs font-bold text-gray-900 shadow-2xs outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 cursor-pointer"
                >
                  {courts.map((c) => {
                    const sport = sportTypeMap.get(c.sportTypeId)
                    return (
                      <option key={c.id} value={c.id}>
                        [{c.code}] {c.name} {sport ? `— ${sport.name}` : ""} {c.isActive ? "" : "(Tạm dừng)"}
                      </option>
                    )
                  })}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              </div>
            )}
          </div>
        </div>

        {/* Selected Court Details Banner */}
        {selectedCourt && (
          <div className="mt-5 pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-black text-gray-900 bg-gray-100 px-2 py-0.5 rounded-md">
                  {selectedCourt.code}
                </span>
                <span className="font-bold text-gray-900">{selectedCourt.name}</span>
              </div>

              {sportTypeMap.get(selectedCourt.sportTypeId) && (
                <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-[10px] font-bold text-sky-700 border border-sky-200">
                  {sportTypeMap.get(selectedCourt.sportTypeId)?.name}
                </span>
              )}

              {selectedCourt.isActive ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                  <CheckCircle className="h-3 w-3" />
                  Hoạt động
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500 border border-gray-200">
                  <XCircle className="h-3 w-3" />
                  Tạm dừng
                </span>
              )}

              <span className="text-gray-300">|</span>

              <span className="text-gray-500">
                Thời lượng: <strong className="text-gray-800">{selectedCourt.slotDurationMinutes}p / slot</strong>
              </span>

              <span className="text-gray-500">
                Đặt liên tiếp: <strong className="text-gray-800">{selectedCourt.minConsecutiveSlots} – {selectedCourt.maxConsecutiveSlots} slot</strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to={`/courts/${selectedCourt.id}/availability`}
                target="_blank"
                className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 transition-colors"
              >
                <span>Xem giao diện khách</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* ── Main Content Area ── */}
      {isCourtsLoading ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white p-16 text-center shadow-xs">
          <Loader2 className="h-10 w-10 animate-spin text-emerald-600 mb-3" />
          <h3 className="text-sm font-black text-gray-900">Đang khởi tạo dữ liệu quản trị lịch...</h3>
          <p className="mt-1 text-xs text-gray-500">Vui lòng đợi trong giây lát</p>
        </div>
      ) : isCourtsError ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 p-12 text-center text-rose-900">
          <AlertCircle className="h-10 w-10 text-rose-600 mb-3" />
          <h3 className="text-sm font-black">Lỗi tải danh sách sân thể thao</h3>
          <p className="mt-1 text-xs text-rose-700 max-w-md">
            {(courtsError as Error)?.message || "Không thể nạp danh sách sân từ API backend."}
          </p>
          <button
            type="button"
            onClick={() => refetchCourts()}
            className="mt-4 rounded-xl border border-rose-300 bg-white px-4 py-2 text-xs font-bold text-rose-800 hover:bg-rose-100 transition-colors shadow-2xs"
          >
            Thử lại
          </button>
        </div>
      ) : !selectedCourt ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white p-16 text-center">
          <LayoutGrid className="h-12 w-12 text-gray-300 mb-3" />
          <h3 className="text-sm font-black text-gray-900">Chưa có sân thể thao nào</h3>
          <p className="mt-1 text-xs text-gray-500 max-w-md">
            Hệ thống cần ít nhất một sân để thực hiện cấu hình lịch và time slot.
          </p>
          <Link
            to="/admin/courts"
            className="mt-4 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-emerald-700 transition-colors"
          >
            Tạo sân thể thao ngay
          </Link>
        </div>
      ) : isHoursLoading ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white p-16 text-center shadow-xs">
          <Loader2 className="h-10 w-10 animate-spin text-emerald-600 mb-3" />
          <h3 className="text-sm font-black text-gray-900">
            Đang tải lịch và mẫu slot của [{selectedCourt.code}]...
          </h3>
          <p className="mt-1 text-xs text-gray-500">Đang đồng bộ với backend</p>
        </div>
      ) : isHoursError ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 p-12 text-center text-rose-900">
          <AlertCircle className="h-10 w-10 text-rose-600 mb-3" />
          <h3 className="text-sm font-black">Lỗi nạp lịch hoạt động của sân</h3>
          <p className="mt-1 text-xs text-rose-700 max-w-md">
            {(hoursError as Error)?.message || "Không thể đọc dữ liệu lịch từ máy chủ."}
          </p>
          <button
            type="button"
            onClick={() => refetchHours()}
            className="mt-4 rounded-xl border border-rose-300 bg-white px-4 py-2 text-xs font-bold text-rose-800 hover:bg-rose-100 transition-colors shadow-2xs"
          >
            Thử lại
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* ── Sub Navigation Tabs ── */}
          <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 pb-px">
            <button
              type="button"
              onClick={() => setActiveTab("hours")}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === "hours"
                  ? "border-[#16A34A] text-emerald-800 bg-white rounded-t-xl"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-900"
              }`}
            >
              <Clock className="h-4 w-4" />
              <span>1. Giờ Mở Cửa Hằng Tuần</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("policy")}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === "policy"
                  ? "border-[#16A34A] text-emerald-800 bg-white rounded-t-xl"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-900"
              }`}
            >
              <Sliders className="h-4 w-4" />
              <span>2. Thời Lượng & Min / Max Slot</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("slots")}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === "slots"
                  ? "border-[#16A34A] text-emerald-800 bg-white rounded-t-xl"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-900"
              }`}
            >
              <CalendarCheck className="h-4 w-4" />
              <span>3. Mẫu Slot Tuần ({operatingHoursData?.timeSlots?.length ?? 0})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("availability")}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === "availability"
                  ? "border-[#16A34A] text-emerald-800 bg-white rounded-t-xl"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-900"
              }`}
            >
              <CalendarDays className="h-4 w-4" />
              <span>4. Availability Theo Ngày</span>
            </button>
          </div>

          {/* ── Active Tab Content ── */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs">
            {activeTab === "hours" && (
              <div className="space-y-4">
                <div className="flex flex-col gap-1 border-b border-gray-100 pb-4">
                  <h2 className="text-base font-black text-gray-900">
                    Cấu Hình Giờ Mở Cửa Hằng Tuần (Operating Hours)
                  </h2>
                  <p className="text-xs text-gray-500">
                    Thiết lập giờ mở và đóng cửa cho từng thứ trong tuần (Thứ Hai đến Chủ Nhật).
                    Hệ thống hỗ trợ nhiều ca trong ngày và tự động tái tạo time slot tương ứng với thời lượng đã chọn.
                  </p>
                </div>

                <OperatingHoursForm
                  key={`${selectedCourt.id}-${operatingHoursData?.hours?.length ?? 0}`}
                  court={selectedCourt}
                  initialHours={operatingHoursData?.hours ?? []}
                  onSuccess={() => refetchHours()}
                />
              </div>
            )}

            {activeTab === "policy" && (
              <div className="space-y-4">
                <div className="flex flex-col gap-1 border-b border-gray-100 pb-4">
                  <h2 className="text-base font-black text-gray-900">
                    Quy Định Thời Lượng Slot & Giới Hạn Đặt Liền Kề
                  </h2>
                  <p className="text-xs text-gray-500">
                    Cấu hình thời lượng mỗi slot ({selectedCourt.slotDurationMinutes} phút) và số lượng slot liên tiếp tối thiểu/tối đa khi khách đặt sân.
                    Khi cập nhật thời lượng, backend sẽ tự động tính toán lại toàn bộ slot mẫu.
                  </p>
                </div>

                <SlotPolicyForm
                  key={`${selectedCourt.id}-${selectedCourt.slotDurationMinutes}-${selectedCourt.minConsecutiveSlots}-${selectedCourt.maxConsecutiveSlots}`}
                  court={selectedCourt}
                  onSuccess={() => {
                    refetchCourts()
                    refetchHours()
                  }}
                />
              </div>
            )}

            {activeTab === "slots" && (
              <div className="space-y-4">
                <div className="flex flex-col gap-1 border-b border-gray-100 pb-4">
                  <h2 className="text-base font-black text-gray-900">
                    Mẫu Slot Tuần Hiện Hành (TimeSlot Templates)
                  </h2>
                  <p className="text-xs text-gray-500">
                    Danh sách các khung giờ mẫu hoạt động của sân được sinh tự động từ giờ mở cửa và thời lượng slot ({selectedCourt.slotDurationMinutes} phút).
                  </p>
                </div>

                <CurrentSlotsView
                  timeSlots={operatingHoursData?.timeSlots ?? []}
                  operatingHours={operatingHoursData?.hours ?? []}
                  slotDurationMinutes={selectedCourt.slotDurationMinutes}
                />
              </div>
            )}

            {activeTab === "availability" && (
              <div className="space-y-4">
                <div className="flex flex-col gap-1 border-b border-gray-100 pb-4">
                  <h2 className="text-base font-black text-gray-900">
                    Kiểm Tra Availability Theo Ngày (Real-Time Availability Inspector)
                  </h2>
                  <p className="text-xs text-gray-500">
                    Xem slot khả dụng thực tế trên từng ngày cụ thể (trong giới hạn 30 ngày horizon).
                    Dữ liệu sẽ tự động làm mới khi bạn thay đổi lịch hoặc chính sách slot.
                  </p>
                </div>

                <DateAvailabilityInspector
                  key={selectedCourt.id}
                  court={selectedCourt}
                  timeZone={operatingHoursData?.timeZone}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
