'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import { 
  BanknotesIcon, 
  FunnelIcon, 
  ArrowDownTrayIcon, 
  ChevronDownIcon, 
  ListBulletIcon, 
  ChartBarSquareIcon 
} from '@heroicons/react/24/outline'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Legend, 
  Tooltip as RechartsTooltip, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid 
} from 'recharts'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu'

const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: 'no-store' })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json?.error || 'Gagal memuat data ledger')
  return json
}

const formatCurrency = (num: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(Number(num || 0))

const formatDate = (v: string | Date) => {
  if (!v) return '-'
  try {
    return new Date(v).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
  } catch {
    return String(v)
  }
}

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000
const pad2 = (n: number) => String(n).padStart(2, '0')
const toWibYmd = (dt?: Date) => {
  if (!dt) return ''
  const wib = new Date(dt.getTime() + WIB_OFFSET_MS)
  return `${wib.getUTCFullYear()}-${pad2(wib.getUTCMonth() + 1)}-${pad2(wib.getUTCDate())}`
}
const getWibToday = () => {
  const now = new Date()
  const wib = new Date(now.getTime() + WIB_OFFSET_MS)
  return new Date(Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate()))
}

export default function LedgerBiayaPage() {
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('list')
  const [scope, setScope] = useState('kebun')
  const [tipe, setTipe] = useState('all')
  const [kebunId, setKebunId] = useState('all')
  const [karyawanId, setKaryawanId] = useState('all')
  const [perusahaanId, setPerusahaanId] = useState('all')
  const [kendaraanPlatNomor, setKendaraanPlatNomor] = useState('all')
  const [includeOperasional, setIncludeOperasional] = useState(true)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [kebunList, setKebunList] = useState<Array<{ id: number; name: string }>>([])
  const [karyawanList, setKaryawanList] = useState<Array<{ id: number; name: string }>>([])
  const [perusahaanList, setPerusahaanList] = useState<Array<{ id: number; name: string }>>([])
  const [kendaraanList, setKendaraanList] = useState<Array<{ platNomor: string; merk: string }>>([])
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    const today = getWibToday()
    const start = new Date(Date.UTC(today.getUTCFullYear(), 0, 1))
    setStartDate(toWibYmd(start))
    setEndDate(toWibYmd(today))
  }, [])

  useEffect(() => {
    const load = async () => {
      try {
        const [kebunRes, userRes, perusahaanRes, kendaraanRes] = await Promise.all([
          fetch('/api/kebun?page=1&limit=200&search=', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({ data: [] })),
          fetch('/api/users?page=1&limit=200&status=AKTIF', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({ data: [] })),
          fetch('/api/perusahaan?page=1&limit=200&search=', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({ data: [] })),
          fetch('/api/kendaraan?page=1&limit=200&search=', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({ data: [] })),
        ])

        const kebuns = Array.isArray(kebunRes?.data) ? kebunRes.data : []
        const users = Array.isArray(userRes?.data) ? userRes.data : []
        const perusahaans = Array.isArray(perusahaanRes?.data) ? perusahaanRes.data : []
        const kendaraans = Array.isArray(kendaraanRes?.data) ? kendaraanRes.data : []

        setKebunList(kebuns.map((k: any) => ({ id: Number(k.id), name: String(k.name || '-') })).filter((k: any) => Number.isFinite(k.id) && k.id > 0))
        setKaryawanList(
          users
            .filter((u: any) => String(u?.role || '').toUpperCase() !== 'SUPIR')
            .map((u: any) => ({ id: Number(u.id), name: String(u.name || '-') }))
            .filter((u: any) => Number.isFinite(u.id) && u.id > 0),
        )
        setPerusahaanList(perusahaans.map((p: any) => ({ id: Number(p.id), name: String(p.name || '-') })).filter((p: any) => Number.isFinite(p.id) && p.id > 0))
        setKendaraanList(
          kendaraans
            .map((k: any) => ({ platNomor: String(k.platNomor || ''), merk: String(k.merk || '') }))
            .filter((k: any) => !!k.platNomor),
        )
      } catch (err) {
        console.error('Failed to load filter lists:', err)
      }
    }
    load()
  }, [])

  const qs = useMemo(() => {
    const p = new URLSearchParams()
    p.set('page', String(page))
    p.set('limit', String(limit))
    if (activeTab === 'kpi') p.set('includeEntityStats', '1')
    if (search) p.set('search', search)
    if (scope && scope !== 'all') p.set('scope', scope)
    if (tipe && tipe !== 'all') p.set('tipe', tipe)
    if (kebunId && kebunId !== 'all') p.set('kebunId', kebunId)
    if (karyawanId && karyawanId !== 'all') p.set('karyawanId', karyawanId)
    if (perusahaanId && perusahaanId !== 'all') p.set('perusahaanId', perusahaanId)
    if (kendaraanPlatNomor && kendaraanPlatNomor !== 'all') p.set('kendaraanPlatNomor', kendaraanPlatNomor)
    if (!includeOperasional) p.set('includeOperasional', '0')
    if (startDate) p.set('startDate', startDate)
    if (endDate) p.set('endDate', endDate)
    return p.toString()
  }, [page, limit, activeTab, search, scope, tipe, kebunId, karyawanId, perusahaanId, kendaraanPlatNomor, includeOperasional, startDate, endDate])

  const { data, error, isLoading, mutate } = useSWR(`/api/ledger-biaya?${qs}`, fetcher)
  const rows = data?.data || []
  const summaryRaw = data?.summary
  const summary = useMemo(() => summaryRaw || { pemasukan: 0, pengeluaran: 0, saldo: 0, notaIncome: 0, breakdown: {}, incomeBreakdown: {} }, [summaryRaw])
  const pagination = data?.pagination || { page: 1, totalPages: 1, total: 0, limit }
  const entityStats = data?.entityStats || null

  const formatKategori = useCallback((raw: any) => {
    const s = String(raw || '').trim()
    if (!s) return '-'
    const upper = s.toUpperCase()
    if (upper === 'ABSENSI') return 'ABSENSI / HARIAN KARYAWAN'
    return upper
  }, [])

  const formatKpiKategori = useCallback((raw: any) => {
    const s = String(raw || '').trim()
    if (!s) return '-'
    const normalized = s.replace(/_/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase()
    if (normalized === 'ABSENSI') return 'ABSENSI / HARIAN KARYAWAN'
    return normalized
  }, [])

  const profitMargin = summary.pemasukan > 0 ? ((summary.saldo / summary.pemasukan) * 100).toFixed(1) : '0'
  const costRatio = summary.pemasukan > 0 ? ((summary.pengeluaran / summary.pemasukan) * 100).toFixed(1) : '0'

  const entityName = useMemo(() => {
    if (scope === 'kebun' && kebunId === 'all') return 'Semua Kebun'
    if (kebunId !== 'all') return kebunList.find(k => String(k.id) === kebunId)?.name || 'Kebun'
    if (perusahaanId !== 'all') return perusahaanList.find(p => String(p.id) === perusahaanId)?.name || 'Perusahaan'
    if (kendaraanPlatNomor !== 'all') return kendaraanPlatNomor
    return 'Semua Entitas'
  }, [scope, kebunId, perusahaanId, kendaraanPlatNomor, kebunList, perusahaanList])

  const sortedBreakdown = useMemo(() => 
    Object.entries(summary.breakdown || {})
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .filter(([, v]) => (v as number) > 0)
  , [summary.breakdown])

  const sortedIncomeBreakdown = useMemo(() => 
    Object.entries(summary.incomeBreakdown || {})
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .filter(([, v]) => (v as number) > 0)
  , [summary.incomeBreakdown])

  const chartData = useMemo(() => {
    const top3 = sortedBreakdown.slice(0, 3)
    const others = sortedBreakdown.slice(3)
    const data = top3.map(([name, value]) => ({ name, value: value as number }))
    
    if (others.length > 0) {
      const othersTotal = others.reduce((acc, [, val]) => acc + (val as number), 0)
      data.push({ name: 'LAINNYA', value: othersTotal })
    }
    return data
  }, [sortedBreakdown])
  const incomeChartData = useMemo(() => {
    const top3 = sortedIncomeBreakdown.slice(0, 3)
    const others = sortedIncomeBreakdown.slice(3)
    const data = top3.map(([name, value]) => ({ name, value: value as number }))
    
    if (others.length > 0) {
      const othersTotal = others.reduce((acc, [, val]) => acc + (val as number), 0)
      data.push({ name: 'LAINNYA', value: othersTotal })
    }
    return data
  }, [sortedIncomeBreakdown])
  
  const COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#64748b']
  const INCOME_COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#64748b']

  const barData = useMemo(() => [
    { name: 'Pendapatan', value: summary.pemasukan, fill: '#10b981' },
    { name: 'Pengeluaran', value: summary.pengeluaran, fill: '#ef4444' },
    { name: 'Profit', value: summary.saldo, fill: '#3b82f6' }
  ], [summary])

  const handleExportCsv = () => {
    const buildCsvStr = (headers: string[], rows: Array<Record<string, any>>) => {
      const esc = (v: any) => {
        if (v === null || v === undefined) return ''
        const s = String(v).replace(/"/g, '""')
        return `"${s}"`
      }
      const lines = []
      lines.push(headers.join(','))
      for (const r of rows) {
        lines.push(headers.map(h => esc(r[h])).join(','))
      }
      return '\ufeff' + lines.join('\r\n')
    }

    const headers = ['Tanggal', 'Sumber', 'Scope', 'Tipe', 'Kategori', 'Entitas', 'Deskripsi', 'Jumlah']
    const exportRows = rows.map((r: any) => ({
      'Tanggal': formatDate(r.date),
      'Sumber': r.source || '-',
      'Scope': r.scope,
      'Tipe': r.tipe,
      'Kategori': formatKategori(r.kategori),
      'Entitas': r.kendaraan?.platNomor || r.kebun?.name || r.karyawan?.name || r.perusahaan?.name || '-',
      'Deskripsi': r.deskripsi || '-',
      'Jumlah': r.jumlah
    }))
    const csvStr = buildCsvStr(headers, exportRows)
    const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ledger-biaya-${entityName}-${startDate}-${endDate}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const handleExportPdf = async () => {
    if (exporting) return
    setExporting(true)
    try {
      const jsPDF = (await import('jspdf')).default
      const autoTable = (await import('jspdf-autotable')).default
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      
      doc.setFontSize(14)
      doc.text('Laporan Ledger Biaya Terpadu', 14, 15)
      doc.setFontSize(10)
      doc.text(`Entitas: ${entityName}`, 14, 22)
      doc.text(`Periode: ${formatDate(startDate)} - ${formatDate(endDate)}`, 14, 27)

      const tableRows = rows.map((r: any) => [
        formatDate(r.date),
        r.source || '-',
        r.scope,
        r.tipe,
        formatKategori(r.kategori),
        r.kendaraan?.platNomor || r.kebun?.name || r.karyawan?.name || r.perusahaan?.name || '-',
        r.deskripsi || '-',
        formatCurrency(r.jumlah)
      ])

      const images: (string|null)[] = await (async () => {
        const urls = rows.map((r: any) => r.gambarUrl || '')
        const limitCount = Math.min(urls.length, 50)
        const out: (string|null)[] = new Array(rows.length).fill(null)
        await Promise.all(
          urls.slice(0, limitCount).map(async (u: string, idx: number) => {
            if (!u) return
            try {
              const resp = await fetch(u)
              const blob = await resp.blob()
              const reader = new FileReader()
              const dataUrl: string = await new Promise(res => { 
                reader.onload = () => res(reader.result as string)
                reader.readAsDataURL(blob) 
              })
              out[idx] = dataUrl
            } catch {
              console.warn('Failed to load image for PDF:', u)
            }
          })
        )
        return out
      })()

      autoTable(doc, {
        startY: 35,
        head: [['Tanggal', 'Sumber', 'Scope', 'Tipe', 'Kategori', 'Entitas', 'Deskripsi', 'Bukti', 'Jumlah']],
        body: tableRows.map((row: any[]) => {
          const newRow = [...row]
          newRow.splice(7, 0, '') // Placeholder for image
          return newRow
        }),
        styles: { fontSize: 8, cellPadding: 2, valign: 'middle' },
        headStyles: { fillColor: [5, 150, 105], textColor: 255, fontStyle: 'bold' },
        columnStyles: { 7: { cellWidth: 20 }, 8: { halign: 'right' } },
        didParseCell: (data: any) => {
          if (data.section === 'body' && data.column.index === 7) {
            data.cell.styles.minCellHeight = 12
          }
        },
        didDrawCell: (data: any) => {
          if (data.section === 'body' && data.column.index === 7) {
            const idx = data.row.index
            const img = images[idx]
            if (img) {
              const w = 18
              const h = 10
              const x = data.cell.x + (data.cell.width - w) / 2
              const y = data.cell.y + (data.cell.height - h) / 2
              const type = String(img).startsWith('data:image/png') ? 'PNG' : 'JPEG'
              doc.addImage(img, type, x, y, w, h)
            }
          }
        }
      })

      doc.save(`ledger-biaya-${entityName}-${startDate}-${endDate}.pdf`)
    } catch (err) {
      console.error('PDF Export failed:', err)
    } finally {
      setExporting(false)
    }
  }

  return (
    <main className="p-4 md:p-8 space-y-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <BanknotesIcon className="w-6 h-6 text-emerald-700" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-2xl md:text-3xl font-bold text-gray-800 truncate">Ledger Biaya Terpadu</h1>
              <p className="hidden sm:block text-sm text-gray-500 truncate">Biaya kendaraan, kebun, uang jalan, perusahaan, karyawan, dan kas dalam satu daftar</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="rounded-xl bg-emerald-600 hover:bg-emerald-700 flex items-center gap-2 px-3 sm:px-4 whitespace-nowrap" disabled={exporting}>
                  <ArrowDownTrayIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">{exporting ? 'Mengekspor...' : 'Ekspor Laporan'}</span>
                  <ChevronDownIcon className="w-4 h-4 opacity-50 hidden sm:inline" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 rounded-xl">
                <DropdownMenuItem onClick={handleExportCsv} className="cursor-pointer">
                  Ekspor ke CSV (.csv)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportPdf} className="cursor-pointer">
                  Ekspor ke PDF (.pdf)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="w-full sm:w-auto flex items-center gap-1 h-12 rounded-2xl bg-gray-50 border border-gray-100 p-1">
            <TabsTrigger
              value="list"
              className="flex-1 min-w-0 rounded-xl px-4 h-10 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
            >
              <ListBulletIcon className="h-4 w-4 mr-2" />
              <span className="font-semibold text-xs sm:text-sm truncate">Daftar Transaksi</span>
            </TabsTrigger>
            <TabsTrigger
              value="kpi"
              className="flex-1 min-w-0 rounded-xl px-4 h-10 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
            >
              <ChartBarSquareIcon className="h-4 w-4 mr-2" />
              <span className="font-semibold text-xs sm:text-sm truncate">KPI & Analisis Visual</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="space-y-6 outline-none">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                <div className="text-xs text-emerald-700 font-semibold flex justify-between">
                  <span>Total Pendapatan</span>
                  {summary.notaIncome > 0 && <span className="text-[10px] bg-emerald-200 px-1 rounded">Inc. Nota</span>}
                </div>
                <div className="text-xl font-bold text-emerald-800">{formatCurrency(summary.pemasukan)}</div>
                <div className="text-[10px] text-emerald-600 mt-1">Margin Profit: {profitMargin}%</div>
              </div>
              <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
                <div className="text-xs text-rose-700 font-semibold">Total Pengeluaran</div>
                <div className="text-xl font-bold text-rose-800">{formatCurrency(summary.pengeluaran)}</div>
                <div className="text-[10px] text-rose-600 mt-1">Rasio Biaya: {costRatio}%</div>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="text-xs text-gray-600 font-semibold">Saldo Bersih</div>
                <div className="text-xl font-bold text-gray-900">{formatCurrency(summary.saldo)}</div>
                <div className="text-[10px] text-gray-400 mt-1">Pemasukan - Pengeluaran</div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-4 md:p-5">
              <div className="flex items-center gap-2 mb-3 text-gray-700">
                <FunnelIcon className="w-4 h-4" />
                <span className="text-sm font-semibold">Filter</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                <Input
                  value={searchDraft}
                  onChange={(e) => setSearchDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setSearch(String(searchDraft || '').trim())
                      setPage(1)
                    }
                  }}
                  placeholder="Cari deskripsi/kategori/kebun/karyawan..."
                  className="md:col-span-2 rounded-xl"
                />
                <select 
                  className="h-10 rounded-xl border border-gray-200 px-3 text-sm" 
                  value={scope} 
                  onChange={(e) => { setScope(e.target.value); setPage(1) }}
                >
                  <option value="all">Semua Scope</option>
                  <option value="kendaraan">Kendaraan</option>
                  <option value="kebun">Kebun</option>
                  <option value="uang_jalan">Uang Jalan</option>
                  <option value="perusahaan">Perusahaan</option>
                  <option value="karyawan">Karyawan</option>
                  <option value="kas">Kas Umum</option>
                </select>
                <select 
                  className="h-10 rounded-xl border border-gray-200 px-3 text-sm" 
                  value={tipe} 
                  onChange={(e) => { setTipe(e.target.value); setPage(1) }}
                >
                  <option value="all">Semua Tipe</option>
                  <option value="PEMASUKAN">Pemasukan</option>
                  <option value="PENGELUARAN">Pengeluaran</option>
                </select>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value)
                    setPage(1)
                  }}
                  className="rounded-xl"
                />
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value)
                    setPage(1)
                  }}
                  className="rounded-xl"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3">
                <select 
                  className="h-10 rounded-xl border border-gray-200 px-3 text-sm" 
                  value={kebunId} 
                  onChange={(e) => { setKebunId(e.target.value); setPage(1) }}
                >
                  <option value="all">Semua Kebun</option>
                  {kebunList.map((k) => (
                    <option key={k.id} value={String(k.id)}>{k.name}</option>
                  ))}
                </select>
                <select 
                  className="h-10 rounded-xl border border-gray-200 px-3 text-sm" 
                  value={karyawanId} 
                  onChange={(e) => { setKaryawanId(e.target.value); setPage(1) }}
                >
                  <option value="all">Semua Karyawan</option>
                  {karyawanList.map((u) => (
                    <option key={u.id} value={String(u.id)}>{u.name}</option>
                  ))}
                </select>
                <select 
                  className="h-10 rounded-xl border border-gray-200 px-3 text-sm" 
                  value={perusahaanId} 
                  onChange={(e) => { setPerusahaanId(e.target.value); setPage(1) }}
                >
                  <option value="all">Semua Perusahaan</option>
                  {perusahaanList.map((p) => (
                    <option key={p.id} value={String(p.id)}>{p.name}</option>
                  ))}
                </select>
                <select 
                  className="h-10 rounded-xl border border-gray-200 px-3 text-sm" 
                  value={kendaraanPlatNomor} 
                  onChange={(e) => { setKendaraanPlatNomor(e.target.value); setPage(1) }}
                >
                  <option value="all">Semua Kendaraan</option>
                  {kendaraanList.map((k) => (
                    <option key={k.platNomor} value={k.platNomor}>{k.platNomor}{k.merk ? ` • ${k.merk}` : ''}</option>
                  ))}
                </select>
              </div>
              <div className="mt-3 flex items-center gap-2 text-sm text-gray-700">
                <input
                  id="includeOperasional"
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  checked={includeOperasional}
                  onChange={(e) => { setIncludeOperasional(e.target.checked); setPage(1) }}
                />
                <label htmlFor="includeOperasional" className="select-none">
                  Sertakan borongan & absensi (detail kebun)
                </label>
              </div>
              <div className="mt-3 flex gap-2">
                <Button 
                  onClick={() => { setSearch(String(searchDraft || '').trim()); setPage(1) }} 
                  className="rounded-full bg-emerald-600 hover:bg-emerald-700"
                >
                  Terapkan
                </Button>
                <Button
                  variant="outline"
                  className="rounded-full"
                  onClick={() => {
                    const today = getWibToday()
                    const start = new Date(Date.UTC(today.getUTCFullYear(), 0, 1))
                    setSearchDraft('')
                    setSearch('')
                    setScope('all')
                    setTipe('all')
                    setKebunId('all')
                    setKaryawanId('all')
                    setPerusahaanId('all')
                    setKendaraanPlatNomor('all')
                    setIncludeOperasional(true)
                    setStartDate(toWibYmd(start))
                    setEndDate(toWibYmd(today))
                    setPage(1)
                    mutate()
                  }}
                >
                  Reset
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-emerald-600 text-white">
                    <tr>
                      <th className="px-3 py-3 text-left font-semibold">Tanggal</th>
                      <th className="px-3 py-3 text-left font-semibold">Sumber</th>
                      <th className="px-3 py-3 text-left font-semibold">Scope</th>
                      <th className="px-3 py-3 text-left font-semibold">Tipe</th>
                      <th className="px-3 py-3 text-left font-semibold">Kategori</th>
                      <th className="px-3 py-3 text-left font-semibold">Entitas</th>
                      <th className="px-3 py-3 text-left font-semibold">Deskripsi</th>
                      <th className="px-3 py-3 text-right font-semibold">Jumlah</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {isLoading ? (
                      <tr><td className="px-3 py-8 text-center text-gray-500" colSpan={8}>Memuat data...</td></tr>
                    ) : error ? (
                      <tr><td className="px-3 py-8 text-center text-rose-600" colSpan={8}>{String(error.message || 'Gagal memuat data')}</td></tr>
                    ) : rows.length === 0 ? (
                      <tr><td className="px-3 py-8 text-center text-gray-500" colSpan={8}>Tidak ada transaksi ditemukan</td></tr>
                    ) : rows.map((r: any) => (
                      <tr key={r.key || `${r.source || 'ROW'}:${r.id}`} className={cn("hover:bg-gray-50 transition-colors", r.isPaid && "opacity-60 italic bg-gray-50/50")}>
                        <td className="px-3 py-2 whitespace-nowrap">{formatDate(r.date)}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-gray-500">{r.source || '-'}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className="px-1.5 py-0.5 rounded bg-gray-100 text-[10px] font-bold text-gray-600 uppercase">{r.scope}</span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <span className={cn(
                              "text-[10px] font-bold px-1.5 py-0.5 rounded uppercase",
                              r.tipe === 'PEMASUKAN' ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                            )}>
                              {r.tipe}
                            </span>
                            {r.isPaid && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded uppercase font-bold">Lunas</span>}
                          </div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-600 uppercase">{formatKategori(r.kategori)}</td>
                        <td className="px-3 py-2 whitespace-nowrap font-medium text-gray-700">
                          {r.kendaraan?.platNomor || r.kebun?.name || r.karyawan?.name || r.perusahaan?.name || '-'}
                        </td>
                        <td className="px-3 py-2 min-w-[280px] text-gray-600 line-clamp-2">{r.deskripsi || '-'}</td>
                        <td className="px-3 py-2 text-right font-bold tabular-nums">
                          {r.isPaid ? `(${formatCurrency(r.jumlah)})` : formatCurrency(r.jumlah)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
                <div className="text-xs text-gray-500 font-medium">Total: {pagination.total || 0} baris</div>
                <div className="flex items-center gap-3">
                  <select 
                    value={limit} 
                    onChange={(e) => { setLimit(Number(e.target.value)); setPage(1) }} 
                    className="h-8 rounded-lg border border-gray-200 px-2 text-xs focus:ring-emerald-500"
                  >
                    <option value={20}>20 / hal</option>
                    <option value={50}>50 / hal</option>
                    <option value={100}>100 / hal</option>
                  </select>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="h-8 w-8 p-0">{'<'}</Button>
                    <span className="text-xs font-bold text-gray-600 px-2">Hal {page} / {pagination.totalPages || 1}</span>
                    <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(pagination.totalPages || 1, p + 1))} disabled={page >= (pagination.totalPages || 1)} className="h-8 w-8 p-0">{'>'}</Button>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="kpi" className="space-y-6 outline-none">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Pie Chart: Pendapatan Breakdown */}
              <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <div className="w-2 h-6 bg-emerald-500 rounded-full" />
                  Sumber Pendapatan
                </h3>
                <div className="h-[280px]">
                  {sortedIncomeBreakdown.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={incomeChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {incomeChartData.map((entry, index) => (
                            <Cell key={`cell-income-${index}`} fill={INCOME_COLORS[index % INCOME_COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip formatter={(v: any) => formatCurrency(v)} />
                        <Legend 
                          verticalAlign="bottom" 
                          align="center" 
                          iconSize={10}
                          wrapperStyle={{ 
                            fontSize: '11px', 
                            paddingTop: '10px',
                            fontWeight: '600',
                            textTransform: 'uppercase'
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-400 italic text-sm">Data pendapatan tidak tersedia</div>
                  )}
                </div>
              </div>

              {/* Pie Chart: Biaya Breakdown */}
              <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <div className="w-2 h-6 bg-rose-500 rounded-full" />
                  Proporsi Beban Biaya
                </h3>
                <div className="h-[280px]">
                  {sortedBreakdown.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-expense-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip formatter={(v: any) => formatCurrency(v)} />
                        <Legend 
                          verticalAlign="bottom" 
                          align="center" 
                          iconSize={10}
                          wrapperStyle={{ 
                            fontSize: '11px', 
                            paddingTop: '10px',
                            fontWeight: '600',
                            textTransform: 'uppercase'
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-400 italic text-sm">Data biaya tidak tersedia</div>
                  )}
                </div>
              </div>

              {/* Bar Chart: Profitability */}
              <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <div className="w-2 h-6 bg-blue-500 rounded-full" />
                  Performa Keuangan
                </h3>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" />
                      <YAxis tickFormatter={(v) => `Rp${v/1000000}jt`} />
                      <RechartsTooltip formatter={(v: any) => formatCurrency(v)} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-50 to-blue-50 border border-emerald-100 grid grid-cols-1 md:grid-cols-2 gap-6 shadow-sm">
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Profitabilitas {entityName}</h4>
                <p className="text-base text-emerald-900">
                  {entityName} menghasilkan keuntungan bersih sebesar <span className="font-bold text-emerald-700">{formatCurrency(summary.saldo)}</span> dari total pendapatan <span className="font-bold">{formatCurrency(summary.pemasukan)}</span>.
                </p>
                <div className="text-xs text-emerald-600 font-medium">Margin Keuntungan: <span className="text-sm font-bold">{profitMargin}%</span></div>
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-blue-700 uppercase tracking-wider">Rasio Efisiensi Operasional</h4>
                <p className="text-base text-blue-900">
                  Setiap Rp1.000 pendapatan yang masuk, {entityName} mengeluarkan biaya sebesar <span className="font-bold text-rose-600">Rp{(Number(costRatio) * 10).toFixed(0)}</span> untuk operasional.
                </p>
                <div className="text-xs text-blue-600 font-medium">Rasio Biaya: <span className="text-sm font-bold text-rose-600">{costRatio}%</span></div>
              </div>
            </div>

            {Array.isArray(entityStats?.rows) && entityStats.rows.length > 0 ? (
              <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-800 mb-4">
                  {entityStats?.type === 'kebun'
                    ? 'Ringkasan Per Kebun'
                    : entityStats?.type === 'perusahaan'
                      ? 'Ringkasan Per Perusahaan'
                      : entityStats?.type === 'kendaraan'
                        ? 'Ringkasan Per Kendaraan'
                        : 'Ringkasan Per Entitas'}
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50/80">
                      <tr>
                        <th className="px-4 py-3 text-left font-bold text-gray-700">Entitas</th>
                        <th className="px-4 py-3 text-right font-bold text-gray-700">Pendapatan</th>
                        <th className="px-4 py-3 text-right font-bold text-gray-700">Pengeluaran</th>
                        <th className="px-4 py-3 text-right font-bold text-gray-700">Profit</th>
                        <th className="px-4 py-3 text-right font-bold text-gray-700">Margin</th>
                        <th className="px-4 py-3 text-right font-bold text-gray-700">Rasio</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {entityStats.rows.map((r: any) => (
                        <tr key={String(r.key || r.id || r.name)}>
                          <td className="px-4 py-3 font-medium text-gray-900">{r.name || '-'}</td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-800">{formatCurrency(Number(r.pemasukan || 0))}</td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-800">{formatCurrency(Number(r.pengeluaran || 0))}</td>
                          <td className={cn('px-4 py-3 text-right font-bold', Number(r.saldo || 0) >= 0 ? 'text-emerald-700' : 'text-rose-700')}>
                            {formatCurrency(Number(r.saldo || 0))}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-gray-700">{Number(r.profitMargin || 0).toFixed(1)}%</td>
                          <td className="px-4 py-3 text-right font-bold text-gray-700">{Number(r.costRatio || 0).toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Detailed Income Table */}
              <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <BanknotesIcon className="w-5 h-5 text-emerald-500" />
                  Rincian Pendapatan {entityName}
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50/80">
                      <tr>
                        <th className="px-4 py-3 text-left font-bold text-gray-700">Sumber Pendapatan</th>
                        <th className="px-4 py-3 text-right font-bold text-gray-700">Jumlah</th>
                        <th className="px-4 py-3 text-right font-bold text-gray-700">% Kontribusi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {sortedIncomeBreakdown.length > 0 ? sortedIncomeBreakdown.map(([cat, val]) => {
                        const percentage = ((val as number) / (summary.pemasukan || 1) * 100)
                        return (
                          <tr key={`income-row-${cat}`}>
                            <td className="px-4 py-3 font-medium text-gray-900 uppercase text-xs">{formatKpiKategori(cat)}</td>
                            <td className="px-4 py-3 text-right font-semibold text-gray-800">{formatCurrency(val as number)}</td>
                            <td className="px-4 py-3 text-right">
                              <span className="font-bold text-emerald-600">{percentage.toFixed(1)}%</span>
                            </td>
                          </tr>
                        )
                      }) : (
                        <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-400 italic text-sm">Tidak ada data pendapatan</td></tr>
                      )}
                      <tr className="bg-emerald-50/50 font-bold border-t-2 border-emerald-100">
                        <td className="px-4 py-3 text-emerald-900">TOTAL PENDAPATAN</td>
                        <td className="px-4 py-3 text-right text-emerald-900">{formatCurrency(summary.pemasukan)}</td>
                        <td className="px-4 py-3 text-right text-emerald-900">100%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Detailed Expense Table */}
              <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <BanknotesIcon className="w-5 h-5 text-rose-500" />
                  Rincian Beban Biaya {entityName}
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50/80">
                      <tr>
                        <th className="px-4 py-3 text-left font-bold text-gray-700">Kategori Biaya</th>
                        <th className="px-4 py-3 text-right font-bold text-gray-700">Jumlah</th>
                        <th className="px-4 py-3 text-right font-bold text-gray-700">% Beban</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {sortedBreakdown.length > 0 ? sortedBreakdown.map(([cat, val], idx) => {
                        const percentage = ((val as number) / (summary.pengeluaran || 1) * 100)
                        return (
                          <tr key={`expense-row-${cat}`}>
                            <td className="px-4 py-3 font-medium text-gray-900 uppercase text-xs">{formatKpiKategori(cat)}</td>
                            <td className="px-4 py-3 text-right font-semibold text-gray-800">{formatCurrency(val as number)}</td>
                            <td className="px-4 py-3 text-right">
                              <span className={cn("font-bold", idx === 0 ? "text-rose-600" : "text-amber-600")}>{percentage.toFixed(1)}%</span>
                            </td>
                          </tr>
                        )
                      }) : (
                        <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-400 italic text-sm">Tidak ada data pengeluaran</td></tr>
                      )}
                      <tr className="bg-rose-50/50 font-bold border-t-2 border-rose-100">
                        <td className="px-4 py-3 text-rose-900">TOTAL PENGELUARAN</td>
                        <td className="px-4 py-3 text-right text-rose-900">{formatCurrency(summary.pengeluaran)}</td>
                        <td className="px-4 py-3 text-right text-rose-900">100%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}
