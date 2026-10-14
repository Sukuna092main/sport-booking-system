import { Link, useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeft, MapPin, AlertCircle, CheckCircle,
  XCircle, CalendarDays, Clock, Tag,
} from "lucide-react"
import { useCourtById } from "@/features/courts/useCourts"
import { useSportTypes } from "@/features/courts/useCourts"

/* ── Sport type badge colours ─────────────────────────────────────── */
const SPORT_COLOURS: Record<string, { bg: string; text: string }> = {
  badminton:  { bg: "bg-sky-100",    text: "text-sky-700" },
  tennis:     { bg: "bg-amber-100",  text: "text-amber-700" },
  football:   { bg: "bg-emerald-100",text: "text-emerald-700" },
  futsal:     { bg: "bg-violet-100", text: "text-violet-700" },
  basketball: { bg: "bg-orange-100", text: "text-orange-700" },
  volleyball: { bg: "bg-pink-100",   text: "text-pink-700" },
}

function getSportColour(name: string) {
  const key = name.toLowerCase().replace(/\s+/g, "")
  for (const k of Object.keys(SPORT_COLOURS)) {
    if (key.includes(k)) return SPORT_COLOURS[k]
  }
  return { bg: "bg-gray-100", text: "text-gray-600" }
}

/* ── Court images (by sport type name) ───────────────────────────── */
const COURT_IMAGES: Record<string, string> = {
  badminton: "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800&q=80",
  tennis:    "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=800&q=80",
  football:  "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80",
  futsal:    "https://images.unsplash.com/photo-1540747913346-19212a109f0a?w=800&q=80",
  basketball:"https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&q=80",
  volleyball:"https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=800&q=80",
}

function getCourtImage(sportName: string) {
  const key = sportName.toLowerCase().replace(/\s+/g, "")
  for (const k of Object.keys(COURT_IMAGES)) {
    if (key.includes(k)) return COURT_IMAGES[k]
  }
  return "https://images.unsplash.com/photo-1575052814086-f385e2e2ad1b?w=800&q=80"
}

/* ── Info row component ──────────────────────────────────────────── */
function InfoRow({
  label,
  value,
}: {
  label: string
  value: string | null | undefined
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold text-gray-800">
        {value ?? <span className="font-normal italic text-gray-400">—</span>}
      </p>
    </div>
  )
}

/* ── Loading skeleton ────────────────────────────────────────────── */
function CourtDetailSkeleton() {
  return (
    <section className="py-4">
      <div className="h-4 w-28 rounded bg-gray-200 animate-pulse mb-6" />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="h-72 rounded-2xl bg-gray-200 animate-pulse" />
        <div className="rounded-2xl border border-gray-200 bg-white p-6 space-y-4">
          <div className="h-4 w-20 rounded bg-gray-200 animate-pulse" />
          <div className="h-8 w-48 rounded bg-gray-200 animate-pulse" />
          <div className="h-3 w-full rounded bg-gray-200 animate-pulse" />
          <div className="h-3 w-3/4 rounded bg-gray-200 animate-pulse" />
          <div className="h-10 w-full rounded-xl bg-gray-200 animate-pulse mt-4" />
        </div>
      </div>
    </section>
  )
}

/* ── Main page ──────────────────────────────────────────────────── */
export function CourtDetailPage() {
  const { courtId } = useParams<{ courtId: string }>()
  const navigate = useNavigate()

  const {
    data: court,
    isLoading,
    error,
  } = useCourtById(courtId ?? "")

  const { data: sportTypes } = useSportTypes()
  const sportTypeMap = Object.fromEntries(
    (sportTypes ?? []).map((st) => [st.id, st.name])
  )

  const sportName = court ? (sportTypeMap[court.sportTypeId] ?? "Sport") : ""
  const colour = getSportColour(sportName)
  const imgSrc = getCourtImage(sportName)

  /* ── Loading ── */
  if (isLoading) return <CourtDetailSkeleton />

  /* ── Error ── */
  if (error) {
    const status = (error as { response?: { status: number } })?.response?.status
    const is404 = status === 404
    return (
      <section className="py-4">
        <button
          onClick={() => navigate(-1)}
          className="mb-6 flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại danh sách sân
        </button>
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-5 text-sm text-red-600"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">
              {is404 ? "Sân không tồn tại." : "Không thể tải thông tin sân."}
            </p>
            {!is404 && (
              <button
                onClick={() => window.location.reload()}
                className="mt-1 underline underline-offset-2 hover:no-underline"
              >
                Tải lại trang
              </button>
            )}
          </div>
        </div>
      </section>
    )
  }

  if (!court) return null

  const slotHours = court.slotDurationMinutes / 60
  const priceDisplay =
    court.referencePriceAmount
      ? `${Number(court.referencePriceAmount).toLocaleString("vi-VN")}${
          court.referencePriceCurrency ? ` ${court.referencePriceCurrency}` : ""
        }`
      : null

  return (
    <section className="py-4">
      {/* ── Back link ── */}
      <Link
        to="/courts"
        id="court-detail-back"
        className="mb-5 flex w-fit items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Quay lại danh sách sân
      </Link>

      {/* ── Two-column layout ── */}
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">

        {/* Left: court image */}
        <div className="relative overflow-hidden rounded-2xl bg-gray-100 shadow-sm">
          <img
            src={imgSrc}
            alt={court.name}
            className="h-full w-full min-h-[280px] object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                "https://images.unsplash.com/photo-1575052814086-f385e2e2ad1b?w=800&q=80"
            }}
          />
          {/* Status overlay */}
          <div className="absolute bottom-4 left-4">
            {court.isActive ? (
              <span className="flex items-center gap-1.5 rounded-full bg-[#22C55E]/90 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-sm">
                <CheckCircle className="h-3.5 w-3.5" />
                Đang hoạt động
              </span>
            ) : (
              <span className="flex items-center gap-1.5 rounded-full bg-gray-900/75 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-sm">
                <XCircle className="h-3.5 w-3.5" />
                Tạm ngừng hoạt động
              </span>
            )}
          </div>
        </div>

        {/* Right: info card */}
        <div className="flex flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          {/* Sport type badge */}
          <span
            className={`mb-3 inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${colour.bg} ${colour.text}`}
          >
            {sportName}
          </span>

          {/* Court name */}
          <h1 className="text-3xl font-black tracking-tight text-gray-900">
            {court.name}
          </h1>

          {/* Location / code */}
          <div className="mt-2 flex items-center gap-1.5 text-sm text-gray-500">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100">
              <MapPin className="h-3.5 w-3.5 text-gray-400" />
            </div>
            <span className="font-medium text-gray-700">
              {court.description ?? `Sân mã ${court.code}`}
            </span>
          </div>
          {court.description && (
            <p className="mt-0.5 ml-7.5 text-xs text-gray-400">{court.code}</p>
          )}

          {/* Description */}
          {court.description && (
            <p className="mt-4 text-sm leading-relaxed text-gray-600 border-b border-gray-100 pb-4">
              {court.description}
            </p>
          )}

          {/* Info grid */}
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-400 shrink-0" />
              <InfoRow
                label="Thời lượng"
                value={`${slotHours > 1 ? `${slotHours} giờ` : `${court.slotDurationMinutes} phút`}`}
              />
            </div>
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-gray-400 shrink-0" />
              <InfoRow label="Giá giờ chơi" value={priceDisplay ?? "Liên hệ"} />
            </div>
            <InfoRow
              label="Tối thiểu"
              value={`${court.minConsecutiveSlots} slot`}
            />
            <InfoRow
              label="Tối đa"
              value={`${court.maxConsecutiveSlots} slots`}
            />
          </div>

          {/* Operating hours hint */}
          {priceDisplay && (
            <div className="mt-3 rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-500">
              <span className="font-semibold text-gray-700">{priceDisplay}</span>
              {" "}· Giá tham khảo (không thu tiền MVP)
            </div>
          )}

          {/* CTA */}
          <div className="mt-auto pt-5">
            {court.isActive ? (
              <Link
                to={`/courts/${court.id}/availability`}
                id="court-detail-check-availability"
                className="flex w-full items-center justify-between rounded-xl bg-[#22C55E] px-5 py-3.5 text-sm font-bold text-white transition-colors hover:bg-[#16A34A]"
              >
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  Xem lịch trống & đặt giờ
                </div>
                <ArrowLeft className="h-4 w-4 rotate-180" />
              </Link>
            ) : (
              <div className="flex w-full items-center justify-center rounded-xl border border-gray-200 bg-gray-50 px-5 py-3.5 text-sm font-medium text-gray-400">
                Sân tạm ngừng hoạt động
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
