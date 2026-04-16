'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import RoleGate from '@/components/RoleGate'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowDownTrayIcon, CalendarDaysIcon, CheckIcon, ChevronUpDownIcon, MagnifyingGlassIcon, MapPinIcon } from '@heroicons/react/24/outline'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { ModalFooter, ModalHeader } from '@/components/ui/modal-elements'
import { useAuth } from '@/components/AuthProvider'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { cn } from '@/lib/utils'

type AttendanceRow = {
  id: number
  userId: number
  userName: string
  userEmail: string
  locationId?: number | null
  locationName?: string | null
  locationType?: string | null
  date: string
  checkIn: string | null
  checkOut: string | null
  photoInUrl: string | null
  photoOutUrl: string | null
  latIn: number | null
  longIn: number | null
  latOut: number | null
  longOut: number | null
  locationIn: string | null
  locationOut: string | null
  status: string
}

type AttendanceSummary = {
  totalKaryawanAbsen: number
  totalMasuk: number
  totalPulang: number
}

type KaryawanOption = {
  id: number
  name: string
  email: string
}

function SearchableKaryawanFilter({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (next: string) => void
  options: KaryawanOption[]
}) {
  const [open, setOpen] = useState(false)
  const selected = value ? options.find((o) => String(o.id) === value) : null
  const label = selected ? `${selected.name} (${selected.id})` : 'Semua Karyawan'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="md:col-span-2 rounded-full h-10 justify-between"
        >
          <span className="truncate">{label}</span>
          <ChevronUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Cari karyawan..." />
          <CommandList>
            <CommandEmpty>Karyawan tidak ditemukan.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="Semua Karyawan"
                onSelect={() => {
                  onChange('')
                  setOpen(false)
                }}
              >
                <CheckIcon className={cn('mr-2 h-4 w-4', !value ? 'opacity-100' : 'opacity-0')} />
                Semua Karyawan
              </CommandItem>
              {options.map((k) => {
                const v = String(k.id)
                const text = `${k.name} (${k.id}) - ${k.email}`
                return (
                  <CommandItem
                    key={k.id}
                    value={text}
                    onSelect={() => {
                      onChange(v)
                      setOpen(false)
                    }}
                  >
                    <CheckIcon className={cn('mr-2 h-4 w-4', value === v ? 'opacity-100' : 'opacity-0')} />
                    <span className="truncate">{text}</span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

const formatDateTime = (value: string | null) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

const formatDateOnly = (value: string | null) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'full' }).format(date)
}

const formatWorkDuration = (checkIn: string | null, checkOut: string | null) => {
  if (!checkIn || !checkOut) return '-'
  const inDate = new Date(checkIn)
  const outDate = new Date(checkOut)
  if (Number.isNaN(inDate.getTime()) || Number.isNaN(outDate.getTime())) return '-'
  const ms = outDate.getTime() - inDate.getTime()
  if (ms <= 0) return '-'
  const minutes = Math.floor(ms / 60000)
  const hours = Math.floor(minutes / 60)
  const remain = minutes % 60
  if (hours <= 0) return `${remain} menit`
  if (remain <= 0) return `${hours} jam`
  return `${hours} jam ${remain} menit`
}

const toMapsLink = (lat: number | null, lng: number | null) => {
  if (lat == null || lng == null) return null
  return `https://www.google.com/maps?q=${lat},${lng}`
}

export default function AttendanceMonitorPage() {
  const { role } = useAuth()
  const userRole = String(role || '').toUpperCase()
  const canCancelAttendance = userRole === 'ADMIN' || userRole === 'PEMILIK'

  const WIB_OFFSET_MS = 7 * 60 * 60 * 1000
  const todayYmd = useMemo(() => {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  }, [])

  const [rows, setRows] = useState<AttendanceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [searchDraft, setSearchDraft] = useState('')
  const [karyawanId, setKaryawanId] = useState<string>('')
  const [karyawanOptions, setKaryawanOptions] = useState<KaryawanOption[]>([])
  const [locationId, setLocationId] = useState<string>('')
  const [locations, setLocations] = useState<Array<{ id: number; name: string; type: string }>>([])
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [total, setTotal] = useState(0)
  const [summary, setSummary] = useState<AttendanceSummary>({
    totalKaryawanAbsen: 0,
    totalMasuk: 0,
    totalPulang: 0,
  })
  const [quickRange, setQuickRange] = useState<'today' | 'last7' | 'this_month' | 'this_year' | 'all' | 'custom'>('today')
  const [startDate, setStartDate] = useState<string>(todayYmd)
  const [endDate, setEndDate] = useState<string>(todayYmd)
  const [periodOpen, setPeriodOpen] = useState(false)
  const [customStartDate, setCustomStartDate] = useState<string>(todayYmd)
  const [customEndDate, setCustomEndDate] = useState<string>(todayYmd)
  const [photoPreview, setPhotoPreview] = useState<{ open: boolean; url: string | null; title: string; row: AttendanceRow | null }>({
    open: false,
    url: null,
    title: '',
    row: null,
  })
  const [cancelPickerId, setCancelPickerId] = useState<number | null>(null)
  const [confirmCancel, setConfirmCancel] = useState<{ row: AttendanceRow; mode: 'in' | 'out' | 'both' } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)

  const totalPages = Math.max(1, Math.ceil(total / limit))

  useEffect(() => {
    const loadLocations = async () => {
      try {
        const res = await fetch('/api/work-locations', { cache: 'no-store' })
        const json = await res.json()
        if (!res.ok) return
        const list = Array.isArray(json?.data) ? json.data : []
        const mapped = list
          .map((x: any) => ({ id: Number(x.id), name: String(x.name || ''), type: String(x.type || '') }))
          .filter((x: any) => Number.isFinite(x.id) && x.id > 0)
        setLocations(mapped)
      } catch {
        setLocations([])
      }
    }
    loadLocations()
  }, [])

  useEffect(() => {
    const loadKaryawan = async () => {
      try {
        const res = await fetch('/api/attendance/admin?includeKaryawan=1&page=1&limit=1', { cache: 'no-store' })
        const json = await res.json()
        if (!res.ok) return
        const list = Array.isArray(json?.karyawanOptions) ? json.karyawanOptions : []
        setKaryawanOptions(
          list
            .map((x: any) => ({ id: Number(x.id), name: String(x.name || ''), email: String(x.email || '') }))
            .filter((x: KaryawanOption) => Number.isFinite(x.id) && x.id > 0)
        )
      } catch {
        setKaryawanOptions([])
      }
    }
    loadKaryawan()
  }, [])

  useEffect(() => {
    if (quickRange === 'custom') return
    if (quickRange === 'all') {
      setStartDate('')
      setEndDate('')
      return
    }

    const formatUtcYmd = (d: Date) =>
      new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)

    const wibNow = new Date(Date.now() + WIB_OFFSET_MS)
    const year = wibNow.getUTCFullYear()
    const month = String(wibNow.getUTCMonth() + 1).padStart(2, '0')

    if (quickRange === 'today') {
      setStartDate(todayYmd)
      setEndDate(todayYmd)
      return
    }

    if (quickRange === 'last7') {
      const start = new Date(wibNow.getTime() - 6 * 24 * 60 * 60 * 1000)
      setStartDate(formatUtcYmd(start))
      setEndDate(todayYmd)
      return
    }

    if (quickRange === 'this_month') {
      setStartDate(`${year}-${month}-01`)
      setEndDate(todayYmd)
      return
    }

    if (quickRange === 'this_year') {
      setStartDate(`${year}-01-01`)
      setEndDate(todayYmd)
      return
    }
  }, [quickRange, todayYmd, wibNow])

  useEffect(() => {
    setCustomStartDate(startDate || todayYmd)
    setCustomEndDate(endDate || todayYmd)
  }, [endDate, startDate, todayYmd])

  const periodLabel = useMemo(() => {
    if (quickRange === 'today') return 'Hari Ini'
    if (quickRange === 'last7') return '7 Hari Terakhir'
    if (quickRange === 'this_month') return 'Bulan Ini'
    if (quickRange === 'this_year') return 'Tahun Ini'
    if (quickRange === 'all') return 'Semua'
    if (quickRange === 'custom') {
      if (!startDate && !endDate) return 'Custom'
      if (startDate && endDate) return `${startDate} s/d ${endDate}`
      return startDate || endDate
    }
    return 'Periode'
  }, [endDate, quickRange, startDate])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) })
      if (search) params.set('search', search)
      if (karyawanId) params.set('karyawanId', karyawanId)
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)
      if (locationId) params.set('locationId', locationId)
      const res = await fetch(`/api/attendance/admin?${params.toString()}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Gagal memuat data')
      setRows(Array.isArray(json?.data) ? json.data : [])
      setTotal(Number(json?.total || 0))
      setSummary({
        totalKaryawanAbsen: Number(json?.summary?.totalKaryawanAbsen || 0),
        totalMasuk: Number(json?.summary?.totalMasuk || 0),
        totalPulang: Number(json?.summary?.totalPulang || 0),
      })
    } catch {
      setRows([])
      setTotal(0)
      setSummary({
        totalKaryawanAbsen: 0,
        totalMasuk: 0,
        totalPulang: 0,
      })
    } finally {
      setLoading(false)
    }
  }, [page, limit, search, karyawanId, startDate, endDate, locationId])

  const buildParams = useCallback((pageValue: number, limitValue: number) => {
    const params = new URLSearchParams({ page: String(pageValue), limit: String(limitValue) })
    if (search) params.set('search', search)
    if (karyawanId) params.set('karyawanId', karyawanId)
    if (startDate) params.set('startDate', startDate)
    if (endDate) params.set('endDate', endDate)
    if (locationId) params.set('locationId', locationId)
    return params
  }, [endDate, karyawanId, locationId, search, startDate])

  const handleExportPdf = useCallback(async () => {
    try {
      setExportingPdf(true)

      const firstRes = await fetch(`/api/attendance/admin?${buildParams(1, 200).toString()}`, { cache: 'no-store' })
      const firstJson = await firstRes.json().catch(() => ({} as any))
      if (!firstRes.ok) throw new Error(firstJson?.error || 'Gagal memuat data export')

      const totalPages = Math.max(1, Number(firstJson?.totalPages || 1))
      const allRows: AttendanceRow[] = Array.isArray(firstJson?.data) ? firstJson.data : []

      for (let p = 2; p <= totalPages; p++) {
        const res = await fetch(`/api/attendance/admin?${buildParams(p, 200).toString()}`, { cache: 'no-store' })
        const json = await res.json().catch(() => ({} as any))
        if (!res.ok) break
        if (Array.isArray(json?.data)) allRows.push(...json.data)
      }

      const jsPDF = (await import('jspdf')).default
      const autoTable = (await import('jspdf-autotable')).default
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

      doc.setFontSize(14)
      doc.text('Laporan Monitoring Absensi', 14, 14)
      doc.setFontSize(9)
      doc.text(`Periode: ${periodLabel}`, 14, 20)
      doc.text(`Total data: ${allRows.length}`, 14, 25)

      const body = allRows.map((row, idx) => [
        String(idx + 1),
        row.userName || '-',
        row.locationName || '-',
        formatDateOnly(row.date),
        formatDateTime(row.checkIn),
        formatDateTime(row.checkOut),
        formatWorkDuration(row.checkIn, row.checkOut),
        row.locationIn || '-',
        row.locationOut || '-',
      ])

      autoTable(doc, {
        head: [['No', 'Nama', 'Lokasi Kerja', 'Tanggal', 'Masuk', 'Pulang', 'Jam Kerja', 'Lokasi Masuk', 'Lokasi Pulang']],
        body,
        startY: 30,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [5, 150, 105] },
      } as any)

      doc.save(`Monitoring-Absensi-${new Date().toISOString().slice(0, 10)}.pdf`)
    } finally {
      setExportingPdf(false)
    }
  }, [buildParams, periodLabel])

  const handleCancelAttendance = useCallback(async () => {
    if (!confirmCancel?.row?.id) return
    try {
      setDeleting(true)
      const res = await fetch(`/api/attendance/admin?id=${confirmCancel.row.id}&mode=${confirmCancel.mode}`, { method: 'PATCH' })
      const json = await res.json().catch(() => ({} as any))
      if (!res.ok) throw new Error(json?.error || 'Gagal membatalkan absensi')
      setConfirmCancel(null)
      fetchData()
    } finally {
      setDeleting(false)
    }
  }, [confirmCancel, fetchData])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    setPage(1)
  }, [karyawanId, startDate, endDate, locationId])

  const applySearch = useCallback(() => {
    const trimmed = String(searchDraft || '').trim()
    if (trimmed && trimmed.length < 2) return
    setSearch(trimmed)
    setPage(1)
  }, [searchDraft])

  return (
    <RoleGate allow={['ADMIN', 'PEMILIK', 'KASIR']}>
      <div className="p-4 md:p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Monitoring Absensi Selfie</h1>
          <p className="text-sm text-gray-500 mt-1">Pantau absen masuk/pulang beserta foto dan lokasi karyawan.</p>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-4 md:p-5">
          <div className="grid grid-cols-1 md:grid-cols-8 gap-3">
            <div className="md:col-span-2 relative">
              <Input
                placeholder="Cari nama, email, atau ID user..."
                value={searchDraft}
                onChange={(e) => {
                  const next = e.target.value
                  setSearchDraft(next)
                  if (!String(next || '').trim()) {
                    setSearch('')
                    setPage(1)
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    applySearch()
                  }
                }}
                className="rounded-full h-10 pr-10"
              />
              <button
                type="button"
                onClick={applySearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                aria-label="Cari"
              >
                <MagnifyingGlassIcon className="h-5 w-5" />
              </button>
            </div>
            <SearchableKaryawanFilter
              value={karyawanId}
              onChange={setKaryawanId}
              options={karyawanOptions}
            />
            <Select value={locationId || 'ALL'} onValueChange={(v) => setLocationId(v === 'ALL' ? '' : v)}>
              <SelectTrigger className="md:col-span-2 rounded-full h-10">
                <SelectValue placeholder="Lokasi pekerjaan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Lokasi Pekerjaan</SelectItem>
                {locations.map((l) => (
                  <SelectItem key={l.id} value={String(l.id)}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Popover open={periodOpen} onOpenChange={setPeriodOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="md:col-span-2 justify-between rounded-full h-10">
                  <span className="truncate">{periodLabel}</span>
                  <CalendarDaysIcon className="w-4 h-4 text-gray-500" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[320px] p-3" align="end">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant={quickRange === 'today' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setQuickRange('today')
                      setPeriodOpen(false)
                    }}
                  >
                    Hari Ini
                  </Button>
                  <Button
                    variant={quickRange === 'last7' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setQuickRange('last7')
                      setPeriodOpen(false)
                    }}
                  >
                    7 Hari
                  </Button>
                  <Button
                    variant={quickRange === 'this_month' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setQuickRange('this_month')
                      setPeriodOpen(false)
                    }}
                  >
                    Bulan Ini
                  </Button>
                  <Button
                    variant={quickRange === 'this_year' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setQuickRange('this_year')
                      setPeriodOpen(false)
                    }}
                  >
                    Tahun Ini
                  </Button>
                  <Button
                    variant={quickRange === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setQuickRange('all')
                      setPeriodOpen(false)
                    }}
                    className="col-span-2"
                  >
                    Semua
                  </Button>
                  <Button
                    variant={quickRange === 'custom' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setQuickRange('custom')}
                    className="col-span-2"
                  >
                    Custom
                  </Button>
                </div>

                {quickRange === 'custom' ? (
                  <div className="mt-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} />
                      <Input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} />
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => {
                        setStartDate(customStartDate)
                        setEndDate(customEndDate)
                        setQuickRange('custom')
                        setPeriodOpen(false)
                      }}
                      disabled={!customStartDate || !customEndDate}
                    >
                      Terapkan
                    </Button>
                  </div>
                ) : null}
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-4 md:p-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
                <p className="text-xs text-emerald-700">Karyawan Absen</p>
                <p className="text-xl font-bold text-emerald-700">{summary.totalKaryawanAbsen}</p>
              </div>
              <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3">
                <p className="text-xs text-blue-700">Total Masuk</p>
                <p className="text-xl font-bold text-blue-700">{summary.totalMasuk}</p>
              </div>
              <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-3">
                <p className="text-xs text-purple-700">Total Pulang</p>
                <p className="text-xl font-bold text-purple-700">{summary.totalPulang}</p>
              </div>
            </div>
            <Button
              onClick={handleExportPdf}
              disabled={exportingPdf || loading}
              className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
              {exportingPdf ? 'Mengekspor...' : 'Export PDF'}
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {loading ? (
            Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-56" />
                <Skeleton className="h-24 w-full" />
              </div>
            ))
          ) : rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-8 text-center text-sm text-gray-500">
              Tidak ada data absensi pada filter ini.
            </div>
          ) : (
            rows.map((row, idx) => {
              const mapIn = toMapsLink(row.latIn, row.longIn)
              const mapOut = toMapsLink(row.latOut, row.longOut)
              const nomor = (page - 1) * limit + idx + 1
              const workDuration = formatWorkDuration(row.checkIn, row.checkOut)
              return (
                <div key={row.id} className="rounded-2xl border border-gray-100 bg-white p-4 md:p-5 space-y-4 shadow-sm">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                    <div>
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-emerald-500 bg-emerald-50 text-xs font-bold text-emerald-700 mb-2">
                        {nomor}
                      </span>
                      <p className="text-base font-semibold text-gray-900">{row.userName}</p>
                      <p className="text-xs text-gray-500">{row.userEmail}</p>
                      <p className="text-xs text-gray-500 mt-1">User ID: {row.userId}</p>
                      <p className="text-xs text-gray-500 mt-1">Lokasi Pekerjaan: {row.locationName || '-'}</p>
                      <p className="text-sm font-semibold text-emerald-700 mt-1">Jam Kerja: {workDuration}</p>
                    </div>
                    <div className="text-xs text-gray-600 flex items-center gap-1">
                      <CalendarDaysIcon className="w-4 h-4" />
                      {formatDateOnly(row.date)}
                    </div>
                  </div>

                  {canCancelAttendance ? (
                    <div className="flex justify-end">
                      <Popover open={cancelPickerId === row.id} onOpenChange={(open) => setCancelPickerId(open ? row.id : null)}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="rounded-full border-red-200 text-red-600 hover:bg-red-50"
                          >
                            Batalkan Absensi
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-2" align="end">
                          <div className="grid gap-2">
                            <Button
                              variant="outline"
                              className="justify-start"
                              disabled={!row.checkIn}
                              onClick={() => {
                                setCancelPickerId(null)
                                setConfirmCancel({ row, mode: 'in' })
                              }}
                            >
                              Batalkan Absen Masuk
                            </Button>
                            <Button
                              variant="outline"
                              className="justify-start"
                              disabled={!row.checkOut}
                              onClick={() => {
                                setCancelPickerId(null)
                                setConfirmCancel({ row, mode: 'out' })
                              }}
                            >
                              Batalkan Absen Pulang
                            </Button>
                            <Button
                              variant="outline"
                              className="justify-start border-red-200 text-red-600 hover:bg-red-50"
                              onClick={() => {
                                setCancelPickerId(null)
                                setConfirmCancel({ row, mode: 'both' })
                              }}
                            >
                              Batalkan Keduanya
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3 space-y-2">
                      <p className="text-sm font-semibold text-emerald-700">Absen Masuk</p>
                      <p className="text-xs text-gray-700">{formatDateTime(row.checkIn)}</p>
                      <p className="text-xs text-gray-600 line-clamp-2">{row.locationIn || '-'}</p>
                      <div className="flex gap-2">
                        {row.photoInUrl ? (
                          <button
                            type="button"
                            onClick={() => setPhotoPreview({ open: true, url: row.photoInUrl, title: `Foto Masuk - ${row.userName}`, row })}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            Lihat Foto
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">Foto belum ada</span>
                        )}
                        {mapIn ? (
                          <a href={mapIn} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">
                            Buka Maps
                          </a>
                        ) : null}
                      </div>
                    </div>

                    <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3 space-y-2">
                      <p className="text-sm font-semibold text-blue-700">Absen Pulang</p>
                      <p className="text-xs text-gray-700">{formatDateTime(row.checkOut)}</p>
                      <p className="text-xs text-gray-600 line-clamp-2">{row.locationOut || '-'}</p>
                      <div className="flex gap-2">
                        {row.photoOutUrl ? (
                          <button
                            type="button"
                            onClick={() => setPhotoPreview({ open: true, url: row.photoOutUrl, title: `Foto Pulang - ${row.userName}`, row })}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            Lihat Foto
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">Foto belum ada</span>
                        )}
                        {mapOut ? (
                          <a href={mapOut} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">
                            Buka Maps
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="text-[11px] text-gray-500 flex items-center gap-1">
                    <MapPinIcon className="w-3.5 h-3.5" />
                    Koordinat masuk: {row.latIn ?? '-'}, {row.longIn ?? '-'} | pulang: {row.latOut ?? '-'}, {row.longOut ?? '-'}
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-sm text-gray-600">
            Total data: <span className="font-semibold text-gray-900">{total}</span>
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page <= 1 || loading}
            >
              Sebelumnya
            </Button>
            <span className="text-sm text-gray-600 min-w-[90px] text-center">
              Hal. {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages || loading}
            >
              Berikutnya
            </Button>
          </div>
        </div>
      </div>

      <Dialog
        open={photoPreview.open}
        onOpenChange={(open) => setPhotoPreview((prev) => ({ ...prev, open }))}
      >
        <DialogContent className="w-[95vw] sm:max-w-2xl p-0 overflow-hidden rounded-2xl max-h-[92vh] flex flex-col [&>button.absolute]:hidden">
          <ModalHeader
            title={photoPreview.title || 'Preview Foto'}
            variant="emerald"
            onClose={() => setPhotoPreview({ open: false, url: null, title: '', row: null })}
          />
          <div className="flex-1 overflow-y-auto bg-gray-50 p-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {photoPreview.url ? (
              <div className="space-y-3">
                <img
                  src={photoPreview.url}
                  alt={photoPreview.title || 'Foto absensi'}
                  className="w-full max-h-[62vh] object-contain rounded-lg border border-gray-200 bg-white"
                />
                <div className="rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-700 space-y-1">
                  <p>Absen Masuk: {formatDateTime(photoPreview.row?.checkIn || null)}</p>
                  <p>Absen Pulang: {formatDateTime(photoPreview.row?.checkOut || null)}</p>
                  <p>Lokasi Masuk: {photoPreview.row?.locationIn || '-'}</p>
                  <p>Lokasi Pulang: {photoPreview.row?.locationOut || '-'}</p>
                </div>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-sm text-gray-500">Foto tidak tersedia</div>
            )}
          </div>
          <ModalFooter className="sm:justify-end flex-shrink-0">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => setPhotoPreview({ open: false, url: null, title: '', row: null })}
            >
              Tutup
            </Button>
            {photoPreview.url ? (
              <a href={photoPreview.url} download target="_blank" rel="noreferrer">
                <Button className="rounded-full bg-emerald-600 text-white hover:bg-emerald-700">
                  <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </a>
            ) : null}
          </ModalFooter>
        </DialogContent>
      </Dialog>

      <ConfirmationModal
        isOpen={!!confirmCancel}
        onClose={() => setConfirmCancel(null)}
        onConfirm={handleCancelAttendance}
        title="Batalkan Absensi"
        description={`Yakin ingin membatalkan ${
          confirmCancel?.mode === 'in' ? 'absen masuk' : confirmCancel?.mode === 'out' ? 'absen pulang' : 'absen masuk & pulang'
        } ${confirmCancel?.row?.userName || ''} pada tanggal ${confirmCancel ? formatDateOnly(confirmCancel.row.date) : ''}?`}
        variant="emerald"
        confirmLabel={deleting ? 'Membatalkan...' : 'Ya, Batalkan'}
        confirmDisabled={deleting}
      />
    </RoleGate>
  )
}
