import { useState, useCallback } from "react"
import { Link } from "react-router-dom"
import {
  Search, Filter, MapPin, AlertCircle,
  ArrowRight, CheckCircle, XCircle, ChevronLeft, ChevronRight,
} from "lucide-react"
import { useCourts } from "@/features/courts/useCourts"
import { useSportTypes } from "@/features/courts/useCourts"
import type { Court } from "@/types/court.types"

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

/* ── Court images (placeholder based on sport type name) ─────────── */
const COURT_IMAGES: Record<string, string> = {
  badminton: "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=640&q=80",
  tennis:    "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=640&q=80",
  football:  "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=640&q=80",
  futsal:    "https://images.unsplash.com/photo-1540747913346-19212a109f0a?w=640&q=80",
  basketball:"https://images.unsplash.com/photo-1546519638-68e109498ffc?w=640&q=80",
  volleyball:"https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=640&q=80",
}

function getCourtImage(sportName: string) {
  const key = sportName.toLowerCase().replace(/\s+/g, "")
  for (const k of Object.keys(COURT_IMAGES)) {
    if (key.includes(k)) return COURT_IMAGES[k]
  }
  return "https://images.unsplash.com/photo-1575052814086-f385e2e2ad1b?w=640&q=80"
}

/* ── Court Card ──────────────────────────────────────────────────── */
function CourtCard({
  court,
  sportName,
}: {
  court: Court
  sportName: string
}) {
  const colour = getSportColour(sportName)
  const imgSrc = getCourtImage(sportName)

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
      {/* Image */}
      <div className="relative h-44 overflow-hidden bg-gray-100">
        <img
          src={imgSrc}
          alt={court.name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              "https://images.unsplash.com/photo-1575052814086-f385e2e2ad1b?w=640&q=80"
          }}
        />
        {/* Availability badge */}
        <div className="absolute bottom-2 right-2">
          {court.isActive ? (
            <span className="flex items-center gap-1 rounded-full bg-[#22C55E]/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
              <CheckCircle className="h-3 w-3" />
              available to book
            </span>
          ) : (
            <span className="flex items-center gap-1 rounded-full bg-gray-900/75 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
              <XCircle className="h-3 w-3" />
              inactive
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-4">
        {/* Sport type + status */}
        <div className="mb-2 flex items-center justify-between">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${colour.bg} ${colour.text}`}
          >
            {sportName}
          </span>
          <span
            className={`text-[10px] font-semibold uppercase tracking-wide ${
              court.isActive ? "text-[#16A34A]" : "text-gray-400"
            }`}
          >
            {court.isActive ? "open" : "closed"}
          </span>
        </div>

        {/* Name */}
        <h2 className="text-lg font-black tracking-tight text-gray-900 leading-tight">
          {court.name}
        </h2>

        {/* Code + description */}
        <div className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
          <MapPin className="h-3 w-3 shrink-0 text-gray-400" />
          <span className="truncate">
            {court.description ?? `Sân mã ${court.code}`}
          </span>
        </div>

        {/* Pricing */}
        {court.referencePriceAmount && (
          <p className="mt-1 text-xs text-gray-400">
            <span className="font-semibold text-gray-600">
              {Number(court.referencePriceAmount).toLocaleString("vi-VN")}
              {court.referencePriceCurrency
                ? ` ${court.referencePriceCurrency}`
                : ""}
            </span>
            {" "}/ giờ
          </p>
        )}

        {/* Footer */}
        <div className="mt-auto flex items-center justify-between pt-4">
          {court.isActive ? (
            <span className="text-xs text-[#16A34A]">report now</span>
          ) : (
            <span className="text-xs text-gray-400">can't find out</span>
          )}
          <Link
            to={`/courts/${court.id}`}
            id={`court-card-link-${court.id}`}
            className="flex items-center gap-1 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-gray-700"
          >
            View court
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </article>
  )
}

/* ── Loading skeletons ───────────────────────────────────────────── */
function CourtCardSkeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="h-44 bg-gray-200" />
      <div className="p-4 space-y-3">
        <div className="flex justify-between">
          <div className="h-4 w-20 rounded-full bg-gray-200" />
          <div className="h-4 w-12 rounded bg-gray-200" />
        </div>
        <div className="h-5 w-3/4 rounded bg-gray-200" />
        <div className="h-3.5 w-full rounded bg-gray-200" />
        <div className="flex justify-between pt-2">
          <div className="h-3 w-16 rounded bg-gray-200" />
          <div className="h-7 w-24 rounded-lg bg-gray-200" />
        </div>
      </div>
    </div>
  )
}

/* ── Empty state ────────────────────────────────────────────────── */
function EmptyState({ query }: { query: string }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
        <Search className="h-7 w-7 text-gray-400" />
      </div>
      <h3 className="text-base font-bold text-gray-800">Không tìm thấy sân</h3>
      <p className="mt-1 max-w-xs text-sm text-gray-500">
        {query
          ? `Không có sân nào khớp với "${query}". Thử từ khóa khác.`
          : "Chưa có sân nào trong hệ thống."}
      </p>
    </div>
  )
}

/* ── Main page ──────────────────────────────────────────────────── */
export function CourtsPage() {
  const [search, setSearch] = useState("")
  const [sportTypeId, setSportTypeId] = useState("")
  const [page, setPage] = useState(1)

  // Debounce-ish: only update query after user stops typing
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearch(value)
      if (debounceTimer) clearTimeout(debounceTimer)
      const t = setTimeout(() => {
        setDebouncedSearch(value)
        setPage(1)
      }, 350)
      setDebounceTimer(t)
    },
    [debounceTimer]
  )

  const handleSportTypeChange = useCallback((value: string) => {
    setSportTypeId(value)
    setPage(1)
  }, [])

  /* Data */
  const { data: sportTypes, isLoading: stLoading } = useSportTypes()
  const {
    data: courtsData,
    isLoading: courtsLoading,
    error: courtsError,
  } = useCourts({
    q: debouncedSearch || undefined,
    sportTypeId: sportTypeId || undefined,
    page,
    pageSize: 9,
  })

  /* Build a lookup map: sportTypeId → name */
  const sportTypeMap = Object.fromEntries(
    (sportTypes ?? []).map((st) => [st.id, st.name])
  )

  const courts = courtsData?.data ?? []
  const meta = courtsData?.meta
  const totalPages = meta ? Math.ceil(meta.total / meta.pageSize) : 0
  const isLoading = courtsLoading

  /* Active courts count for header badge */
  const activeCourtsCount = courtsData?.meta?.total ?? 0

  return (
    <section className="py-2">
      {/* ── Page header ── */}
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-[#16A34A]">
          Find your next game
        </p>
        <div className="mt-1 flex items-end justify-between">
          <h1 className="text-4xl font-black uppercase tracking-tight text-gray-900">
            COURTS
          </h1>
          {!isLoading && (
            <span className="mb-1 rounded-full bg-[#B4FF00] px-3 py-1 text-xs font-bold text-gray-800">
              {activeCourtsCount} active courts
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Browse active courts and find a time that works for you.
        </p>
      </div>

      {/* ── Search + filter bar ── */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            id="courts-search"
            type="search"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by court, sport, or facility..."
            className="block w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-800 placeholder:text-gray-400 focus:border-[#16A34A] focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20 shadow-sm"
          />
        </div>

        {/* Sport type filter */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <select
              id="courts-sport-filter"
              value={sportTypeId}
              onChange={(e) => handleSportTypeChange(e.target.value)}
              disabled={stLoading}
              className="appearance-none rounded-xl border border-gray-200 bg-white py-2.5 pl-8 pr-7 text-sm text-gray-700 focus:border-[#16A34A] focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20 shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <option value="">All courts</option>
              {(sportTypes ?? []).map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name}
                </option>
              ))}
            </select>
            <ChevronRight className="absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rotate-90 text-gray-400 pointer-events-none" />
          </div>

          {/* Status indicator */}
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-500 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-[#22C55E]" />
            <span className="text-xs font-medium">All active</span>
            <ChevronRight className="h-3.5 w-3.5 rotate-90 text-gray-400" />
          </div>
        </div>
      </div>

      {/* ── Error state ── */}
      {courtsError && !isLoading && (
        <div
          role="alert"
          className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-600"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Không thể tải danh sách sân.</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-1 underline underline-offset-2 hover:no-underline"
            >
              Tải lại trang
            </button>
          </div>
        </div>
      )}

      {/* ── Court grid ── */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <CourtCardSkeleton key={i} />)
        ) : courts.length === 0 ? (
          <EmptyState query={debouncedSearch} />
        ) : (
          courts.map((court) => (
            <CourtCard
              key={court.id}
              court={court}
              sportName={sportTypeMap[court.sportTypeId] ?? "Sport"}
            />
          ))
        )}
      </div>

      {/* ── Pagination ── */}
      {!isLoading && totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          <button
            id="courts-prev-page"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              id={`courts-page-${p}`}
              onClick={() => setPage(p)}
              className={`flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-semibold transition-colors ${
                p === page
                  ? "border-[#16A34A] bg-[#16A34A] text-white shadow-sm"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {p}
            </button>
          ))}

          <button
            id="courts-next-page"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </section>
  )
}