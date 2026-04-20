'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { ASSET_GROUPS, computeStraightLineDepreciation, computeStraightLineYearlySchedule, type AssetTaxGroup } from '@/lib/asset-depreciation'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { useDebounce } from '@/hooks/useDebounce'
import ImageUpload from '@/components/ui/ImageUpload'
import { convertImageFileToWebp } from '@/lib/image-webp'
import { ArrowDownTrayIcon, ArrowLeftIcon, ArrowPathIcon, ArrowUpTrayIcon, BanknotesIcon, BuildingOfficeIcon, BuildingOffice2Icon, CalendarIcon, CheckIcon, ChevronDownIcon, ClipboardDocumentListIcon, ClockIcon, CurrencyDollarIcon, DocumentTextIcon, EnvelopeIcon, EyeIcon, MapPinIcon, PencilSquareIcon, PhoneIcon, ScaleIcon, TagIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline'
import PerusahaanDetailPageModals from './PerusahaanDetailPageModals'
import { PerusahaanDetailHeader } from './PerusahaanDetailHeader'
import { PerusahaanDetailTabs } from './PerusahaanDetailTabs'

type Perusahaan = {
  id: number
  name: string
  address: string | null
  email: string | null
  phone: string | null
  logoUrl: string | null
}

type PerusahaanDocument = {
  id: number
  type: string
  fileName: string
  fileUrl: string
  updatedAt?: string
}

type NotaPreview = {
  id: number
  tanggalBongkar: string | null
  supirName: string
  kebunName: string
  beratAkhir: number
  totalPembayaran: number
}

type InvoicePreview = {
  id: number
  number: string
  status: string
  year: number
  month: number
  grandTotal: number
  pabrikName: string
  signedPdfUrl: string | null
}

type PabrikPreview = {
  id: number
  name: string
  address: string | null
  totalNota: number
  totalNilai: number
}

type PerusahaanAsset = {
  id: number
  perusahaanId: number
  name: string
  group: string
  acquiredAt: string
  cost: number
  salvage: number
  disposedAt?: string | null
  disposalType?: string | null
  disposalProceeds?: number | null
  disposalNotes?: string | null
  createdAt: string
  updatedAt: string
}

type PerusahaanBiaya = {
  id: number
  date: string
  type: string
  kategori: string
  deskripsi: string | null
  jumlah: number
  gambarUrl?: string | null
  source: string
  keterangan?: string | null
  kasTransaksiId?: number | null
  kebunId?: number | null
  kendaraanPlatNomor?: string | null
  karyawanId?: number | null
}

function formatCurrency(val: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val)
}

function formatNumber(val: number) {
  return new Intl.NumberFormat('id-ID').format(val)
}

function escapeCsvCell(value: unknown) {
  const s = String(value ?? '')
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function labelDocType(type: string) {
  switch (type) {
    case 'NPWP':
      return 'NPWP'
    case 'AKTA_NOTARIS':
      return 'Akta Notaris'
    case 'AKTA_PERUBAHAN':
      return 'Akta Perubahan'
    case 'KTP_DIREKTUR':
      return 'KTP Direktur'
    default:
      if (type.startsWith('OTHER:')) return type.slice('OTHER:'.length) || 'Dokumen Lainnya'
      return type
  }
}

function isLikelyImageFile(file: File) {
  const mime = String((file as any)?.type || '')
  if (mime.startsWith('image/')) return true
  const name = String((file as any)?.name || '').toLowerCase()
  const ext = name.split('.').pop() || ''
  return ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'bmp', 'gif'].includes(ext)
}

export default function PerusahaanDetailPage() {
  const params = useParams()
  const perusahaanId = Number((params as any).id)

  const [tab, setTab] = useState<'profil' | 'dokumen' | 'nota' | 'invoice' | 'pabrik' | 'keuangan' | 'harta' | 'ppn'>('profil')
  const [loading, setLoading] = useState(true)
  const [perusahaan, setPerusahaan] = useState<Perusahaan | null>(null)

  const [docList, setDocList] = useState<PerusahaanDocument[]>([])
  const [docLoading, setDocLoading] = useState(false)
  const [otherDocName, setOtherDocName] = useState('')
  const [docPreviewOpen, setDocPreviewOpen] = useState(false)
  const [docPreview, setDocPreview] = useState<PerusahaanDocument | null>(null)

  const [notaLoading, setNotaLoading] = useState(false)
  const [notaList, setNotaList] = useState<NotaPreview[]>([])
  const [notaPage, setNotaPage] = useState(1)
  const [notaLimit] = useState(10)
  const [notaStartDate, setNotaStartDate] = useState('')
  const [notaEndDate, setNotaEndDate] = useState('')
  const [notaQuickRange, setNotaQuickRange] = useState<'today' | 'yesterday' | 'last_week' | 'last_30_days' | 'this_month' | 'custom' | ''>('')
  const [notaSearch, setNotaSearch] = useState('')
  const debouncedNotaSearch = useDebounce(notaSearch, 400)
  const [notaExporting, setNotaExporting] = useState(false)

  const [invoiceLoading, setInvoiceLoading] = useState(false)
  const [invoiceList, setInvoiceList] = useState<InvoicePreview[]>([])
  const [invoicePage, setInvoicePage] = useState(1)
  const [invoiceLimit] = useState(10)
  const [invoiceStartDate, setInvoiceStartDate] = useState('')
  const [invoiceEndDate, setInvoiceEndDate] = useState('')
  const [invoiceQuickRange, setInvoiceQuickRange] = useState<'today' | 'yesterday' | 'last_week' | 'last_30_days' | 'this_month' | 'custom' | ''>('')
  const [invoiceSearch, setInvoiceSearch] = useState('')
  const debouncedInvoiceSearch = useDebounce(invoiceSearch, 400)

  const [pabrikLoading, setPabrikLoading] = useState(false)
  const [pabrikList, setPabrikList] = useState<PabrikPreview[]>([])
  const [pabrikPage, setPabrikPage] = useState(1)
  const [pabrikLimit] = useState(10)
  const [pabrikStartDate, setPabrikStartDate] = useState('')
  const [pabrikEndDate, setPabrikEndDate] = useState('')
  const [pabrikQuickRange, setPabrikQuickRange] = useState<'today' | 'yesterday' | 'last_week' | 'last_30_days' | 'this_month' | 'custom' | ''>('')
  const [pabrikSearch, setPabrikSearch] = useState('')
  const debouncedPabrikSearch = useDebounce(pabrikSearch, 400)

  const [financeLoading, setFinanceLoading] = useState(false)
  const [financeStartDate, setFinanceStartDate] = useState('')
  const [financeEndDate, setFinanceEndDate] = useState('')
  const [financeQuickRange, setFinanceQuickRange] = useState<'today' | 'yesterday' | 'last_week' | 'last_30_days' | 'this_month' | 'custom' | ''>('')
  const [financeData, setFinanceData] = useState<any>(null)
  const [financeHistory, setFinanceHistory] = useState<any[]>([])
  const [financeHistoryLoading, setFinanceHistoryLoading] = useState(false)
  const [financeHistorySaving, setFinanceHistorySaving] = useState(false)
  const [assetLoading, setAssetLoading] = useState(false)
  const [assetList, setAssetList] = useState<PerusahaanAsset[]>([])
  const [assetModalOpen, setAssetModalOpen] = useState(false)
  const [assetEditing, setAssetEditing] = useState<PerusahaanAsset | null>(null)
  const [assetName, setAssetName] = useState('')
  const [assetGroup, setAssetGroup] = useState<AssetTaxGroup>('KEL1')
  const [assetAcquiredAt, setAssetAcquiredAt] = useState('')
  const [assetCost, setAssetCost] = useState('')
  const [assetSalvage, setAssetSalvage] = useState('')
  const [assetSaving, setAssetSaving] = useState(false)
  const [assetDeleteOpen, setAssetDeleteOpen] = useState(false)
  const [assetDeleteTarget, setAssetDeleteTarget] = useState<PerusahaanAsset | null>(null)
  const [assetDetailOpen, setAssetDetailOpen] = useState(false)
  const [assetDetailTarget, setAssetDetailTarget] = useState<PerusahaanAsset | null>(null)
  const [assetDisposalOpen, setAssetDisposalOpen] = useState(false)
  const [assetDisposalTarget, setAssetDisposalTarget] = useState<PerusahaanAsset | null>(null)
  const [assetDisposalStatus, setAssetDisposalStatus] = useState<'AKTIF' | 'DIJUAL' | 'DIHENTIKAN'>('AKTIF')
  const [assetDisposalDate, setAssetDisposalDate] = useState('')
  const [assetDisposalProceeds, setAssetDisposalProceeds] = useState('')
  const [assetDisposalNotes, setAssetDisposalNotes] = useState('')
  const [ppnYear, setPpnYear] = useState<number>(new Date().getFullYear())
  const [ppnRows, setPpnRows] = useState<any[]>([])
  const [ppnLoading, setPpnLoading] = useState(false)
  const [ppnSavingKey, setPpnSavingKey] = useState<string | null>(null)
  const [ppnSettingOpen, setPpnSettingOpen] = useState(false)
  const [ppnSettingLoading, setPpnSettingLoading] = useState(false)
  const [ppnRatePct, setPpnRatePct] = useState('11')
  const [notaSawitSettingOpen, setNotaSawitSettingOpen] = useState(false)
  const [notaSawitSettingLoading, setNotaSawitSettingLoading] = useState(false)
  const [notaSawitPphRatePct, setNotaSawitPphRatePct] = useState('0.25')
  const [notaSawitPphEffectiveFrom, setNotaSawitPphEffectiveFrom] = useState('')
  const [notaSawitPphRates, setNotaSawitPphRates] = useState<any[]>([])
  const [taxSettingOpen, setTaxSettingOpen] = useState(false)
  const [taxSettingLoading, setTaxSettingLoading] = useState(false)
  const [taxScheme, setTaxScheme] = useState('AUTO')
  const [taxRounding, setTaxRounding] = useState('THOUSAND')
  const [taxStandardRatePct, setTaxStandardRatePct] = useState('22')
  const [taxUmkmFinalRatePct, setTaxUmkmFinalRatePct] = useState('0.5')
  const [taxUmkmThreshold, setTaxUmkmThreshold] = useState('')
  const [taxFacilityThreshold, setTaxFacilityThreshold] = useState('')
  const [taxFacilityPortionThreshold, setTaxFacilityPortionThreshold] = useState('')
  const [taxFacilityDiscountPct, setTaxFacilityDiscountPct] = useState('50')
  const [biayaLoading, setBiayaLoading] = useState(false)
  const [biayaList, setBiayaList] = useState<PerusahaanBiaya[]>([])
  const [biayaFormOpen, setBiayaFormOpen] = useState(false)
  const [biayaPage, setBiayaPage] = useState(1)
  const biayaLimit = 20
  const [biayaMeta, setBiayaMeta] = useState<{ page: number; pageSize: number; totalItems: number; totalPages: number; totalJumlah: number } | null>(null)
  const [editBiayaOpen, setEditBiayaOpen] = useState(false)
  const [editBiaya, setEditBiaya] = useState<PerusahaanBiaya | null>(null)
  const [editKategori, setEditKategori] = useState('')
  const [buktiOpen, setBuktiOpen] = useState(false)
  const [buktiUrl, setBuktiUrl] = useState<string | null>(null)
  const [biayaDate, setBiayaDate] = useState('')
  const [biayaKategori, setBiayaKategori] = useState('Administrasi')
  const [openBiayaKategoriCombo, setOpenBiayaKategoriCombo] = useState(false)
  const [biayaKategoriQuery, setBiayaKategoriQuery] = useState('')
  const [biayaCategories, setBiayaCategories] = useState<string[]>([])
  const [kategoriOpen, setKategoriOpen] = useState(false)
  const [kategoriNew, setKategoriNew] = useState('')
  const [biayaDeskripsi, setBiayaDeskripsi] = useState('')
  const [biayaJumlah, setBiayaJumlah] = useState('')
  const [biayaFile, setBiayaFile] = useState<File | null>(null)
  const [biayaPreviewUrl, setBiayaPreviewUrl] = useState<string | null>(null)
  const biayaPreviewUrlRef = useRef<string | null>(null)

  const formatRupiahInput = useCallback((value: string) => {
    const numberString = String(value || '').replace(/[^0-9]/g, '')
    if (!numberString) return ''
    const sisa = numberString.length % 3
    let rupiah = numberString.substring(0, sisa)
    const ribuan = numberString.substring(sisa).match(/\d{3}/g)
    if (ribuan) {
      const separator = sisa ? '.' : ''
      rupiah += separator + ribuan.join('.')
    }
    return rupiah ? `Rp ${rupiah}` : ''
  }, [])

  const parseRupiahToNumber = useCallback((value: string) => {
    const n = Number(String(value || '').replace(/[^0-9]/g, ''))
    return Number.isFinite(n) ? n : 0
  }, [])

  const kategoriDatalistId = useMemo(() => `biaya-kategori-${perusahaanId}`, [perusahaanId])

  const normalizeKategoriList = useCallback((list: string[]) => {
    const mapped = new Map<string, string>()
    for (const v of list || []) {
      const raw = String(v || '').trim()
      if (!raw) continue
      const key = raw.toLowerCase()
      if (!mapped.has(key)) mapped.set(key, raw)
    }
    return Array.from(mapped.values()).slice(0, 200)
  }, [])

  const fetchKategoriList = useCallback(async () => {
    try {
      const res = await fetch(`/api/perusahaan/${perusahaanId}/biaya/categories`, { cache: 'no-store' })
      const json = await res.json().catch(() => ({ data: [] }))
      if (!res.ok || json.error) throw new Error(json.error || 'Gagal memuat kategori')
      setBiayaCategories(normalizeKategoriList([...(json.data || []), 'Harga Pokok Penjualan (HPP)']))
    } catch {
      setBiayaCategories(normalizeKategoriList([
        'Harga Pokok Penjualan (HPP)',
        'Administrasi',
        'Kebutuhan Kantor',
        'Listrik & Internet',
        'Air',
        'BBM',
        'Perawatan Aktiva',
        'Penyusutan Aktiva',
        'Perjalanan Dinas',
        'Gaji Karyawan',
        'Umum',
      ]))
    }
  }, [normalizeKategoriList, perusahaanId])

  useEffect(() => {
    fetchKategoriList()
  }, [fetchKategoriList])

  const addKategori = useCallback(async (name: string) => {
    const value = String(name || '').trim()
    if (!value) return
    setBiayaCategories(prev => normalizeKategoriList([...prev, value]))
    try {
      await fetch(`/api/perusahaan/${perusahaanId}/biaya/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: value }),
      })
    } catch {}
  }, [normalizeKategoriList, perusahaanId])

  const deleteKategori = useCallback(async (name: string) => {
    const value = String(name || '').trim()
    if (!value) return
    setBiayaCategories(prev => prev.filter(x => x.toLowerCase() !== value.toLowerCase()))
    try {
      await fetch(`/api/perusahaan/${perusahaanId}/biaya/categories?name=${encodeURIComponent(value)}`, { method: 'DELETE' })
    } catch {}
  }, [perusahaanId])

  const docTypes = useMemo(() => ([
    { type: 'NPWP', accept: 'application/pdf,image/*' },
    { type: 'AKTA_NOTARIS', accept: 'application/pdf,image/*' },
    { type: 'AKTA_PERUBAHAN', accept: 'application/pdf,image/*' },
    { type: 'KTP_DIREKTUR', accept: 'application/pdf,image/*' },
  ]), [])

  const docsByType = useMemo(() => {
    const map = new Map<string, PerusahaanDocument>()
    for (const d of docList) {
      const prev = map.get(d.type)
      if (!prev) {
        map.set(d.type, d)
        continue
      }
      const prevTs = prev.updatedAt ? new Date(prev.updatedAt).getTime() : 0
      const curTs = d.updatedAt ? new Date(d.updatedAt).getTime() : 0
      if (curTs >= prevTs) map.set(d.type, d)
    }
    return map
  }, [docList])

  const otherDocs = useMemo(() => docList.filter(d => d.type.startsWith('OTHER:')), [docList])

  const isPdfPreview = useMemo(() => {
    const name = (docPreview?.fileName || '').toLowerCase()
    const url = (docPreview?.fileUrl || '').toLowerCase()
    return name.endsWith('.pdf') || url.includes('.pdf')
  }, [docPreview])

  const notaTotals = useMemo(() => {
    const totalBeratAkhir = notaList.reduce((acc, n) => acc + Number(n.beratAkhir || 0), 0)
    const totalPembayaran = notaList.reduce((acc, n) => acc + Number(n.totalPembayaran || 0), 0)
    return { totalBeratAkhir, totalPembayaran }
  }, [notaList])

  const exportNotaQuery = useMemo(() => {
    const sp = new URLSearchParams()
    sp.set('perusahaanId', String(perusahaanId))
    if (notaStartDate) sp.set('startDate', notaStartDate)
    if (notaEndDate) sp.set('endDate', notaEndDate)
    if (debouncedNotaSearch) sp.set('search', debouncedNotaSearch)
    return sp.toString()
  }, [perusahaanId, notaStartDate, notaEndDate, debouncedNotaSearch])

  function formatDateRangeLabel(start: string, end: string) {
    if (!start || !end) return 'Rentang Waktu'
    const s = new Date(start)
    const e = new Date(end)
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 'Rentang Waktu'
    return `${format(s, 'dd MMM yyyy', { locale: idLocale })} - ${format(e, 'dd MMM yyyy', { locale: idLocale })}`
  }

  function applyQuickRange(
    range: 'today' | 'yesterday' | 'last_week' | 'last_30_days' | 'this_month',
    setStart: (v: string) => void,
    setEnd: (v: string) => void,
    setQuick: (v: any) => void
  ) {
    const today = new Date()
    const start = new Date(today)
    const end = new Date(today)
    start.setHours(0, 0, 0, 0)
    end.setHours(0, 0, 0, 0)

    if (range === 'today') {
      setStart(start.toISOString().split('T')[0])
      setEnd(end.toISOString().split('T')[0])
    } else if (range === 'yesterday') {
      start.setDate(start.getDate() - 1)
      end.setDate(end.getDate() - 1)
      setStart(start.toISOString().split('T')[0])
      setEnd(end.toISOString().split('T')[0])
    } else if (range === 'last_week') {
      start.setDate(start.getDate() - 6)
      setStart(start.toISOString().split('T')[0])
      setEnd(end.toISOString().split('T')[0])
    } else if (range === 'last_30_days') {
      start.setDate(start.getDate() - 29)
      setStart(start.toISOString().split('T')[0])
      setEnd(end.toISOString().split('T')[0])
    } else if (range === 'this_month') {
      start.setDate(1)
      setStart(start.toISOString().split('T')[0])
      setEnd(end.toISOString().split('T')[0])
    }
    setQuick(range)
  }

  const fetchPerusahaan = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/perusahaan/${perusahaanId}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Gagal memuat perusahaan')
      const found = await res.json()
      setPerusahaan({
        id: Number(found.id),
        name: String(found.name || ''),
        address: found.address || null,
        email: found.email || null,
        phone: found.phone || null,
        logoUrl: found.logoUrl || null,
      })
    } catch (e: any) {
      toast.error(e?.message || 'Gagal memuat perusahaan')
      setPerusahaan(null)
    } finally {
      setLoading(false)
    }
  }, [perusahaanId])

  const fetchDocuments = useCallback(async () => {
    setDocLoading(true)
    try {
      const res = await fetch(`/api/perusahaan/${perusahaanId}/documents`, { cache: 'no-store' })
      const json = await res.json().catch(() => ({ data: [] }))
      setDocList((json.data || []).map((d: any) => ({
        id: Number(d.id),
        type: String(d.type || ''),
        fileName: String(d.fileName || ''),
        fileUrl: String(d.fileUrl || ''),
        updatedAt: d.updatedAt || null,
      })))
    } finally {
      setDocLoading(false)
    }
  }, [perusahaanId])

  const fetchNota = useCallback(async () => {
    setNotaLoading(true)
    try {
      const sp = new URLSearchParams()
      sp.set('perusahaanId', String(perusahaanId))
      sp.set('page', String(notaPage))
      sp.set('limit', String(notaLimit))
      if (notaStartDate) sp.set('startDate', notaStartDate)
      if (notaEndDate) sp.set('endDate', notaEndDate)
      if (debouncedNotaSearch) sp.set('search', debouncedNotaSearch)
      const res = await fetch(`/api/nota-sawit?${sp.toString()}`, { cache: 'no-store' })
      const json = await res.json().catch(() => ({ data: [] }))
      setNotaList((json.data || []).map((n: any) => ({
        id: Number(n.id),
        tanggalBongkar: n.tanggalBongkar || null,
        supirName: n.supir?.name || '-',
        kebunName: n.timbangan?.kebun?.name || n.kebun?.name || '-',
        beratAkhir: Number(n.beratAkhir || 0),
        totalPembayaran: Number(n.totalPembayaran || 0),
      })))
    } finally {
      setNotaLoading(false)
    }
  }, [perusahaanId, notaLimit, notaPage, notaStartDate, notaEndDate, debouncedNotaSearch])

  const fetchInvoices = useCallback(async () => {
    setInvoiceLoading(true)
    try {
      const sp = new URLSearchParams()
      sp.set('perusahaanId', String(perusahaanId))
      sp.set('page', String(invoicePage))
      sp.set('limit', String(invoiceLimit))
      if (invoiceStartDate) sp.set('startDate', invoiceStartDate)
      if (invoiceEndDate) sp.set('endDate', invoiceEndDate)
      if (debouncedInvoiceSearch) sp.set('search', debouncedInvoiceSearch)
      const res = await fetch(`/api/invoice-tbs?${sp.toString()}`, { cache: 'no-store' })
      const json = await res.json().catch(() => ({ data: [] }))
      setInvoiceList((json.data || []).map((inv: any) => ({
        id: Number(inv.id),
        number: String(inv.number || ''),
        status: String(inv.status || ''),
        year: Number(inv.year || 0),
        month: Number(inv.month || 0),
        grandTotal: Number(inv.grandTotal || 0),
        pabrikName: inv.pabrik?.name || '-',
        signedPdfUrl: inv.signedPdfUrl || null,
      })))
    } finally {
      setInvoiceLoading(false)
    }
  }, [perusahaanId, invoiceLimit, invoicePage, invoiceStartDate, invoiceEndDate, debouncedInvoiceSearch])

  const fetchPabriks = useCallback(async () => {
    setPabrikLoading(true)
    try {
      const sp = new URLSearchParams()
      sp.set('perusahaanId', String(perusahaanId))
      sp.set('page', String(pabrikPage))
      sp.set('limit', String(pabrikLimit))
      if (pabrikStartDate && pabrikEndDate) {
        sp.set('startDate', pabrikStartDate)
        sp.set('endDate', pabrikEndDate)
      }
      if (debouncedPabrikSearch) sp.set('search', debouncedPabrikSearch)
      const res = await fetch(`/api/pabrik-sawit?${sp.toString()}`, { cache: 'no-store' })
      const json = await res.json().catch(() => ({ data: [] }))
      setPabrikList((json.data || []).map((p: any) => ({
        id: Number(p.id),
        name: String(p.name || ''),
        address: p.address || null,
        totalNota: Number(p.stats?.totalNota || 0),
        totalNilai: Number(p.stats?.totalNilai || 0),
      })))
    } finally {
      setPabrikLoading(false)
    }
  }, [perusahaanId, pabrikLimit, pabrikPage, pabrikStartDate, pabrikEndDate, debouncedPabrikSearch])

  const fetchFinance = useCallback(async () => {
    setFinanceLoading(true)
    try {
      const sp = new URLSearchParams()
      if (financeStartDate) sp.set('startDate', financeStartDate)
      if (financeEndDate) sp.set('endDate', financeEndDate)
      const res = await fetch(`/api/perusahaan/${perusahaanId}/laporan-keuangan?${sp.toString()}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error || 'Gagal memuat laporan keuangan')
      setFinanceData(json)
    } catch (e: any) {
      toast.error(e?.message || 'Gagal memuat laporan keuangan')
      setFinanceData(null)
    } finally {
      setFinanceLoading(false)
    }
  }, [perusahaanId, financeStartDate, financeEndDate])

  const fetchFinanceHistory = useCallback(async () => {
    setFinanceHistoryLoading(true)
    try {
      const sp = new URLSearchParams()
      if (financeStartDate) sp.set('startDate', financeStartDate)
      if (financeEndDate) sp.set('endDate', financeEndDate)
      sp.set('limit', '30')
      const res = await fetch(`/api/perusahaan/${perusahaanId}/laporan-keuangan/history?${sp.toString()}`, { cache: 'no-store' })
      const json = await res.json().catch(() => ({} as any))
      if (!res.ok || (json as any).error) throw new Error((json as any).error || 'Gagal memuat history laporan')
      setFinanceHistory(Array.isArray((json as any).data) ? (json as any).data : [])
    } catch {
      setFinanceHistory([])
    } finally {
      setFinanceHistoryLoading(false)
    }
  }, [financeEndDate, financeStartDate, perusahaanId])

  useEffect(() => {
    fetchFinanceHistory()
  }, [fetchFinanceHistory])

  const handleSaveFinanceHistory = useCallback(async () => {
    if (!financeData) {
      toast.error('Tidak ada data laporan untuk disimpan')
      return
    }
    setFinanceHistorySaving(true)
    try {
      const res = await fetch(`/api/perusahaan/${perusahaanId}/laporan-keuangan/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: financeStartDate || null,
          endDate: financeEndDate || null,
          data: financeData,
        }),
      })
      const json = await res.json().catch(() => ({} as any))
      if (!res.ok || (json as any).error) throw new Error((json as any).error || 'Gagal menyimpan history')
      toast.success('History laporan tersimpan')
      await fetchFinanceHistory()
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menyimpan history')
    } finally {
      setFinanceHistorySaving(false)
    }
  }, [fetchFinanceHistory, financeData, financeEndDate, financeStartDate, perusahaanId])

  const fetchAssets = useCallback(async () => {
    if (!perusahaanId) return
    setAssetLoading(true)
    try {
      const res = await fetch(`/api/perusahaan/${perusahaanId}/harta`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal memuat daftar harta')
      setAssetList(Array.isArray(json.data) ? json.data : [])
    } catch (e: any) {
      toast.error(e?.message || 'Gagal memuat daftar harta')
    } finally {
      setAssetLoading(false)
    }
  }, [perusahaanId])

  useEffect(() => {
    if (tab === 'harta') fetchAssets()
  }, [tab, fetchAssets])

  const openCreateAsset = useCallback(() => {
    setAssetEditing(null)
    setAssetName('')
    setAssetGroup('KEL1')
    setAssetAcquiredAt(new Date().toISOString().split('T')[0])
    setAssetCost('')
    setAssetSalvage('')
    setAssetModalOpen(true)
  }, [])

  const openEditAsset = useCallback((a: PerusahaanAsset) => {
    setAssetEditing(a)
    setAssetName(a.name || '')
    setAssetGroup((a.group as AssetTaxGroup) || 'KEL1')
    setAssetAcquiredAt(a.acquiredAt ? new Date(a.acquiredAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0])
    setAssetCost(String(Math.round(Number(a.cost || 0))))
    setAssetSalvage(String(Math.round(Number(a.salvage || 0))))
    setAssetModalOpen(true)
  }, [])

  const saveAsset = useCallback(async () => {
    if (!perusahaanId) return
    if (!assetName.trim()) {
      toast.error('Nama harta wajib diisi')
      return
    }
    if (!assetAcquiredAt) {
      toast.error('Tanggal perolehan wajib diisi')
      return
    }
    const payload = {
      name: assetName.trim(),
      group: assetGroup,
      acquiredAt: assetAcquiredAt,
      cost: parseRupiahToNumber(assetCost),
      salvage: parseRupiahToNumber(assetSalvage),
    }

    setAssetSaving(true)
    try {
      const url = assetEditing ? `/api/perusahaan/${perusahaanId}/harta/${assetEditing.id}` : `/api/perusahaan/${perusahaanId}/harta`
      const method = assetEditing ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal menyimpan harta')
      toast.success(assetEditing ? 'Harta berhasil diperbarui' : 'Harta berhasil ditambahkan')
      setAssetModalOpen(false)
      await fetchAssets()
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menyimpan harta')
    } finally {
      setAssetSaving(false)
    }
  }, [assetAcquiredAt, assetCost, assetEditing, assetGroup, assetName, assetSalvage, fetchAssets, parseRupiahToNumber, perusahaanId])

  const confirmDeleteAsset = useCallback((a: PerusahaanAsset) => {
    setAssetDeleteTarget(a)
    setAssetDeleteOpen(true)
  }, [])

  const openAssetDetail = useCallback((a: PerusahaanAsset) => {
    setAssetDetailTarget(a)
    setAssetDetailOpen(true)
  }, [])

  const openAssetDisposal = useCallback((a: PerusahaanAsset) => {
    setAssetDisposalTarget(a)
    const disposedAt = a.disposedAt ? new Date(a.disposedAt) : null
    if (!disposedAt) {
      setAssetDisposalStatus('AKTIF')
      setAssetDisposalDate('')
      setAssetDisposalProceeds('')
      setAssetDisposalNotes('')
    } else {
      setAssetDisposalStatus(String(a.disposalType || 'SOLD') === 'SCRAPPED' ? 'DIHENTIKAN' : 'DIJUAL')
      setAssetDisposalDate(disposedAt.toISOString().split('T')[0])
      setAssetDisposalProceeds(String(Math.round(Number(a.disposalProceeds || 0))))
      setAssetDisposalNotes(String(a.disposalNotes || ''))
    }
    setAssetDisposalOpen(true)
  }, [])

  const saveAssetDisposal = useCallback(async () => {
    if (!perusahaanId || !assetDisposalTarget) return
    if (assetDisposalStatus !== 'AKTIF' && !assetDisposalDate) {
      toast.error('Tanggal penghentian wajib diisi')
      return
    }

    setAssetSaving(true)
    try {
      const payload = {
        name: assetDisposalTarget.name,
        group: assetDisposalTarget.group,
        acquiredAt: assetDisposalTarget.acquiredAt ? new Date(assetDisposalTarget.acquiredAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        cost: Number(assetDisposalTarget.cost || 0),
        salvage: Number(assetDisposalTarget.salvage || 0),
        disposedAt: assetDisposalStatus === 'AKTIF' ? null : assetDisposalDate,
        disposalType: assetDisposalStatus === 'DIHENTIKAN' ? 'SCRAPPED' : assetDisposalStatus === 'DIJUAL' ? 'SOLD' : null,
        disposalProceeds: assetDisposalStatus === 'DIJUAL' ? parseRupiahToNumber(assetDisposalProceeds) : 0,
        disposalNotes: assetDisposalStatus === 'AKTIF' ? null : (assetDisposalNotes.trim() || null),
      }

      const res = await fetch(`/api/perusahaan/${perusahaanId}/harta/${assetDisposalTarget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal menyimpan penghentian harta')
      toast.success('Penghentian/penjualan tersimpan')
      setAssetDisposalOpen(false)
      setAssetDisposalTarget(null)
      await fetchAssets()
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menyimpan penghentian harta')
    } finally {
      setAssetSaving(false)
    }
  }, [assetDisposalDate, assetDisposalNotes, assetDisposalProceeds, assetDisposalStatus, assetDisposalTarget, fetchAssets, parseRupiahToNumber, perusahaanId])

  const exportAssetCsv = useCallback(() => {
    try {
      const asOf = new Date()
      const y = asOf.getFullYear()
      const periodStart = new Date(y, 0, 1)
      const prevAsOf = new Date(y - 1, 11, 31)

      const header = [
        'Nama',
        'Kelompok',
        'Tanggal Perolehan',
        'Harga Perolehan',
        'Residu',
        'Status',
        'Tanggal Penghentian',
        'Harga Jual',
        'Laba/Rugi Pelepasan',
        'Penyusutan Tahun Berjalan',
        'Akumulasi Penyusutan',
        'Nilai Buku',
        'Nilai Buku Tahun Lalu',
      ]

      const rows = assetList.map(a => {
        const disposedAt = a.disposedAt ? new Date(a.disposedAt) : null
        const depNow = computeStraightLineDepreciation({
          cost: Number(a.cost || 0),
          salvage: Number(a.salvage || 0),
          acquiredAt: new Date(a.acquiredAt),
          group: String(a.group || ''),
          periodStart,
          periodEnd: asOf,
          disposedAt,
        })

        const acquired = new Date(a.acquiredAt)
        const prevBookValue = acquired <= prevAsOf && (!disposedAt || disposedAt > prevAsOf)
          ? computeStraightLineDepreciation({
              cost: Number(a.cost || 0),
              salvage: Number(a.salvage || 0),
              acquiredAt: acquired,
              group: String(a.group || ''),
              periodStart: new Date(prevAsOf.getFullYear(), 0, 1),
              periodEnd: prevAsOf,
              disposedAt,
            }).bookValue
          : 0

        const status = disposedAt
          ? (String(a.disposalType || 'SOLD') === 'SCRAPPED' ? 'DIHENTIKAN' : 'DIJUAL')
          : 'AKTIF'
        const proceeds = disposedAt ? Number(a.disposalProceeds || 0) : 0
        const gainLoss = disposedAt ? proceeds - Number(depNow.bookValue || 0) : 0

        const groupLabel = ASSET_GROUPS.find(g => g.value === a.group)?.label || a.group

        return [
          a.name,
          groupLabel,
          a.acquiredAt ? new Date(a.acquiredAt).toLocaleDateString('id-ID') : '',
          Math.round(Number(a.cost || 0)),
          Math.round(Number(a.salvage || 0)),
          status,
          disposedAt ? disposedAt.toLocaleDateString('id-ID') : '',
          Math.round(proceeds),
          Math.round(gainLoss),
          Math.round(depNow.expenseInPeriod || 0),
          Math.round(depNow.accumulated || 0),
          Math.round(depNow.bookValue || 0),
          Math.round(prevBookValue || 0),
        ]
      })

      const csv = [header, ...rows].map(r => r.map(escapeCsvCell).join(',')).join('\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Daftar-Harta-${(perusahaan?.name || 'Perusahaan').replace(/\s+/g, '-')}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('CSV dibuat')
    } catch {
      toast.error('Gagal export CSV')
    }
  }, [assetList, perusahaan?.name])

  const exportAssetPdf = useCallback(async () => {
    try {
      const jsPDF = (await import('jspdf')).default
      const autoTable = (await import('jspdf-autotable')).default
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })

      const asOf = new Date()
      const y = asOf.getFullYear()
      const periodStart = new Date(y, 0, 1)
      const prevAsOf = new Date(y - 1, 11, 31)

      const title = 'Daftar Harta & Penyusutan'
      const fmt = (n: number) => `Rp ${Math.round(Number(n || 0)).toLocaleString('id-ID')}`

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.text(title, 40, 42)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text(perusahaan?.name || '-', 40, 58)
      doc.text(`Per ${asOf.toLocaleDateString('id-ID')}`, 40, 72)

      const body = assetList.map(a => {
        const disposedAt = a.disposedAt ? new Date(a.disposedAt) : null
        const depNow = computeStraightLineDepreciation({
          cost: Number(a.cost || 0),
          salvage: Number(a.salvage || 0),
          acquiredAt: new Date(a.acquiredAt),
          group: String(a.group || ''),
          periodStart,
          periodEnd: asOf,
          disposedAt,
        })

        const acquired = new Date(a.acquiredAt)
        const prevBookValue = acquired <= prevAsOf && (!disposedAt || disposedAt > prevAsOf)
          ? computeStraightLineDepreciation({
              cost: Number(a.cost || 0),
              salvage: Number(a.salvage || 0),
              acquiredAt: acquired,
              group: String(a.group || ''),
              periodStart: new Date(prevAsOf.getFullYear(), 0, 1),
              periodEnd: prevAsOf,
              disposedAt,
            }).bookValue
          : 0
        const status = disposedAt
          ? (String(a.disposalType || 'SOLD') === 'SCRAPPED' ? 'Dihentikan' : 'Dijual')
          : 'Aktif'
        const proceeds = disposedAt ? Number(a.disposalProceeds || 0) : 0
        const gainLoss = disposedAt ? proceeds - Number(depNow.bookValue || 0) : 0

        const groupLabel = ASSET_GROUPS.find(g => g.value === a.group)?.label || a.group
        return [
          String(a.name || '-'),
          String(groupLabel || '-'),
          a.acquiredAt ? new Date(a.acquiredAt).toLocaleDateString('id-ID') : '-',
          fmt(Number(a.cost || 0)),
          fmt(prevBookValue || 0),
          status,
          disposedAt ? disposedAt.toLocaleDateString('id-ID') : '-',
          fmt(proceeds),
          fmt(gainLoss),
          fmt(depNow.expenseInPeriod || 0),
          fmt(depNow.accumulated || 0),
          fmt(depNow.bookValue || 0),
        ]
      })

      autoTable(doc, {
        head: [['Nama', 'Kelompok', 'Perolehan', 'Harga', 'Nilai Buku Th Lalu', 'Status', 'Tgl Henti', 'Harga Jual', 'Laba/Rugi', 'Susut (Th Berjalan)', 'Akumulasi', 'Nilai Buku']],
        body,
        startY: 92,
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42] },
        styles: { fontSize: 9, cellPadding: 5 },
        columnStyles: {
          0: { cellWidth: 170 },
          1: { cellWidth: 160 },
          2: { cellWidth: 70 },
          3: { halign: 'right' },
          4: { halign: 'right' },
          5: { cellWidth: 60 },
          6: { cellWidth: 60 },
          7: { halign: 'right' },
          8: { halign: 'right' },
          9: { halign: 'right' },
          10: { halign: 'right' },
          11: { halign: 'right' },
        },
      })

      doc.save(`Daftar-Harta-${(perusahaan?.name || 'Perusahaan').replace(/\s+/g, '-')}.pdf`)
      toast.success('PDF dibuat')
    } catch {
      toast.error('Gagal export PDF')
    }
  }, [assetList, perusahaan?.name])

  const deleteAsset = useCallback(async () => {
    if (!perusahaanId || !assetDeleteTarget) return
    setAssetSaving(true)
    try {
      const res = await fetch(`/api/perusahaan/${perusahaanId}/harta/${assetDeleteTarget.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal menghapus harta')
      toast.success('Harta berhasil dihapus')
      setAssetDeleteOpen(false)
      setAssetDeleteTarget(null)
      await fetchAssets()
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menghapus harta')
    } finally {
      setAssetSaving(false)
    }
  }, [assetDeleteTarget, fetchAssets, perusahaanId])

  const fetchPpn = useCallback(async () => {
    setPpnLoading(true)
    try {
      const sp = new URLSearchParams()
      sp.set('year', String(ppnYear))
      const res = await fetch(`/api/perusahaan/${perusahaanId}/ppn?${sp.toString()}`, { cache: 'no-store' })
      const json = await res.json().catch(() => ({} as any))
      if (!res.ok || (json as any).error) throw new Error((json as any).error || 'Gagal memuat data PPN')
      const arr = Array.isArray((json as any).data) ? (json as any).data : []
      setPpnRows(arr.map((r: any) => ({
        ...r,
        ppnMasukanInput: formatRupiahInput(String(Math.round(Number(r.ppnMasukan || 0)))),
      })))
    } catch (e: any) {
      toast.error(e?.message || 'Gagal memuat data PPN')
      setPpnRows([])
    } finally {
      setPpnLoading(false)
    }
  }, [formatRupiahInput, perusahaanId, ppnYear])

  useEffect(() => {
    if (tab !== 'ppn') return
    fetchPpn()
  }, [fetchPpn, tab])

  const savePpnRow = useCallback(async (month: number) => {
    const row = ppnRows.find((r: any) => Number(r.month) === Number(month))
    if (!row) return
    const key = `${ppnYear}-${month}-save`
    setPpnSavingKey(key)
    try {
      const payload = {
        year: ppnYear,
        month,
        ppnMasukan: parseRupiahToNumber(String(row.ppnMasukanInput || '')),
      }
      const res = await fetch(`/api/perusahaan/${perusahaanId}/ppn`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => ({} as any))
      if (!res.ok || (json as any).error) throw new Error((json as any).error || 'Gagal menyimpan PPN')
      toast.success('PPN tersimpan')
      await fetchPpn()
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menyimpan PPN')
    } finally {
      setPpnSavingKey(null)
    }
  }, [fetchPpn, parseRupiahToNumber, perusahaanId, ppnRows, ppnYear])

  const uploadPpnSpt = useCallback(async (month: number, file: File) => {
    const key = `${ppnYear}-${month}-upload`
    setPpnSavingKey(key)
    const loadingToast = toast.loading('Mengunggah dokumen...')
    try {
      if (file.type !== 'application/pdf') throw new Error('Harap unggah file PDF')
      const fd = new FormData()
      fd.append('file', file)
      const up = await fetch('/api/upload', { method: 'POST', body: fd })
      const upJson = await up.json().catch(() => ({} as any))
      if (!up.ok || !(upJson as any).success) throw new Error((upJson as any).error || 'Upload gagal')

      const res = await fetch(`/api/perusahaan/${perusahaanId}/ppn`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: ppnYear,
          month,
          sptFileName: file.name,
          sptFileUrl: (upJson as any).url,
        }),
      })
      const json = await res.json().catch(() => ({} as any))
      if (!res.ok || (json as any).error) throw new Error((json as any).error || 'Gagal menyimpan dokumen')
      toast.success('Dokumen tersimpan', { id: loadingToast })
      await fetchPpn()
    } catch (e: any) {
      toast.error(e?.message || 'Gagal mengunggah dokumen', { id: loadingToast })
    } finally {
      setPpnSavingKey(null)
    }
  }, [fetchPpn, perusahaanId, ppnYear])

  const markPpnSubmitted = useCallback(async (month: number) => {
    const key = `${ppnYear}-${month}-submit`
    setPpnSavingKey(key)
    try {
      const res = await fetch(`/api/perusahaan/${perusahaanId}/ppn`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: ppnYear, month, status: 'SUBMITTED' }),
      })
      const json = await res.json().catch(() => ({} as any))
      if (!res.ok || (json as any).error) throw new Error((json as any).error || 'Gagal menyimpan status')
      toast.success('Status tersimpan')
      await fetchPpn()
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menyimpan status')
    } finally {
      setPpnSavingKey(null)
    }
  }, [fetchPpn, perusahaanId, ppnYear])

  const openPpnSettingModal = useCallback(async () => {
    setPpnSettingLoading(true)
    try {
      const res = await fetch(`/api/perusahaan/${perusahaanId}/ppn/setting`, { cache: 'no-store' })
      const json = await res.json().catch(() => ({} as any))
      if (res.ok && (json as any).data) {
        const rate = Number((json as any).data.ppnRate ?? 0.11)
        setPpnRatePct(String(Math.round(rate * 10000) / 100))
      } else {
        setPpnRatePct('11')
      }
      setPpnSettingOpen(true)
    } catch {
      setPpnRatePct('11')
      setPpnSettingOpen(true)
    } finally {
      setPpnSettingLoading(false)
    }
  }, [perusahaanId])

  const savePpnSetting = useCallback(async () => {
    setPpnSettingLoading(true)
    const loadingToast = toast.loading('Menyimpan tarif PPN...')
    try {
      const rate = Number(String(ppnRatePct).replace(',', '.')) / 100
      const payload = { ppnRate: Number.isFinite(rate) ? rate : 0.11 }
      const res = await fetch(`/api/perusahaan/${perusahaanId}/ppn/setting`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => ({} as any))
      if (!res.ok || (json as any).error) throw new Error((json as any).error || 'Gagal menyimpan tarif PPN')
      toast.success('Tarif PPN tersimpan', { id: loadingToast })
      setPpnSettingOpen(false)
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menyimpan tarif PPN', { id: loadingToast })
    } finally {
      setPpnSettingLoading(false)
    }
  }, [perusahaanId, ppnRatePct])

  const openNotaSawitSettingModal = useCallback(async () => {
    setNotaSawitSettingLoading(true)
    try {
      const res = await fetch(`/api/perusahaan/${perusahaanId}/nota-sawit/setting`, { cache: 'no-store' })
      const json = await res.json().catch(() => ({} as any))
      if (res.ok && (json as any).data) {
        const rate = Number((json as any).data.pphRate ?? 0.0025)
        setNotaSawitPphRatePct(String(Math.round(rate * 10000) / 100))
        setNotaSawitPphRates(Array.isArray((json as any).data.rates) ? (json as any).data.rates : [])
      } else {
        setNotaSawitPphRatePct('0.25')
        setNotaSawitPphRates([])
      }
      const today = new Date()
      const y = today.getFullYear()
      const m = String(today.getMonth() + 1).padStart(2, '0')
      const d = String(today.getDate()).padStart(2, '0')
      setNotaSawitPphEffectiveFrom(`${y}-${m}-${d}`)
      setNotaSawitSettingOpen(true)
    } catch {
      setNotaSawitPphRatePct('0.25')
      setNotaSawitPphRates([])
      const today = new Date()
      const y = today.getFullYear()
      const m = String(today.getMonth() + 1).padStart(2, '0')
      const d = String(today.getDate()).padStart(2, '0')
      setNotaSawitPphEffectiveFrom(`${y}-${m}-${d}`)
      setNotaSawitSettingOpen(true)
    } finally {
      setNotaSawitSettingLoading(false)
    }
  }, [perusahaanId])

  const saveNotaSawitSetting = useCallback(async () => {
    setNotaSawitSettingLoading(true)
    const loadingToast = toast.loading('Menyimpan tarif PPh Nota Sawit...')
    try {
      const rate = Number(String(notaSawitPphRatePct).replace(',', '.')) / 100
      const payload = { pphRate: Number.isFinite(rate) ? rate : 0.0025, effectiveFrom: notaSawitPphEffectiveFrom || undefined }
      const res = await fetch(`/api/perusahaan/${perusahaanId}/nota-sawit/setting`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => ({} as any))
      if (!res.ok || (json as any).error) throw new Error((json as any).error || 'Gagal menyimpan tarif PPh Nota Sawit')
      toast.success('Tarif PPh Nota Sawit tersimpan', { id: loadingToast })
      await openNotaSawitSettingModal()
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menyimpan tarif PPh Nota Sawit', { id: loadingToast })
    } finally {
      setNotaSawitSettingLoading(false)
    }
  }, [notaSawitPphEffectiveFrom, notaSawitPphRatePct, openNotaSawitSettingModal, perusahaanId])

  const exportLabaRugiPdf = useCallback(async (data: any) => {
    try {
      const jsPDF = (await import('jspdf')).default
      const autoTable = (await import('jspdf-autotable')).default
      const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })

      const title = 'Laporan Laba Rugi'
      const periodText = formatDateRangeLabel(financeStartDate, financeEndDate)
      const fmt = (n: number) => `Rp ${Math.round(Number(n || 0)).toLocaleString('id-ID')}`

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.text(title, 40, 42)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text(perusahaan?.name || '-', 40, 58)
      doc.text(periodText, 40, 72)

      const lr = data?.labaRugi || {}
      const tax = lr?.tax || {}
      const scheme = String(tax?.schemeApplied || '').toUpperCase()
      const taxLabel = scheme === 'UMKM_FINAL' ? 'Final 0,5% Omzet' : scheme === 'PASAL_31E' ? 'Pasal 31E' : scheme === 'STANDARD' ? '22%' : 'Pajak'

      const adminItems = Array.isArray(lr?.breakdownPengeluaran) ? lr.breakdownPengeluaran : []
      const adminOnly = adminItems.filter((x: any) => String(x?.kategori || '').trim() && String(x?.kategori || '').trim().toUpperCase() !== 'HPP')

      const body: any[] = [
        ['Penjualan Bersih', fmt(lr.pendapatanTbs || 0)],
        ['Harga Pokok Penjualan', fmt(lr.hppTotal || 0)],
        ['Laba Kotor', fmt(lr.labaKotor || 0)],
        ['Biaya Administrasi Umum', fmt(lr.adminTotal || 0)],
        ['Laba Sebelum PPH', fmt(lr.labaSebelumPphDibulatkan ?? lr.labaSebelumPph ?? 0)],
        [`PPH Terutang (${taxLabel})`, fmt(lr.pphTerutang || 0)],
        ['Laba Bersih Setelah PPH', fmt(lr.labaSetelahPph || 0)],
      ]

      autoTable(doc, {
        head: [['Keterangan', 'Nilai']],
        body,
        startY: 92,
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42] },
        styles: { fontSize: 10, cellPadding: 6 },
        columnStyles: { 0: { cellWidth: 290 }, 1: { halign: 'right' } },
      })

      const y1 = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 18 : 260
      const hppBreakdown = (Array.isArray(lr?.breakdownPengeluaran) ? lr.breakdownPengeluaran : []).filter((x: any) => {
        const k = String(x?.kategori || '').toUpperCase()
        return k.includes('HPP') || k.includes('HARGA POKOK') || k === 'KEBUN'
      })

      if (hppBreakdown.length > 0) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(11)
        doc.text('Rincian HPP', 40, y1)
        const hppBody = hppBreakdown.map((x: any) => [String(x.kategori || '-'), fmt(x.total || 0), String(x.source || '-')])
        autoTable(doc, {
          head: [['Kategori', 'Total', 'Sumber']],
          body: hppBody,
          startY: y1 + 8,
          theme: 'grid',
          headStyles: { fillColor: [0, 0, 0] },
          styles: { fontSize: 9, cellPadding: 5 },
          columnStyles: { 1: { halign: 'right' } },
        })
      }

      doc.save(`Laba-Rugi-${(perusahaan?.name || 'Perusahaan').replace(/\\s+/g, '-')}.pdf`)
      toast.success('PDF laba rugi dibuat')
    } catch {
      toast.error('Gagal export PDF laba rugi')
    }
  }, [financeEndDate, financeStartDate, perusahaan?.name])

  const exportNeracaPdf = useCallback(async (data: any) => {
    try {
      const jsPDF = (await import('jspdf')).default
      const autoTable = (await import('jspdf-autotable')).default
      const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })

      const title = 'Neraca'
      const periodText = formatDateRangeLabel(financeStartDate, financeEndDate)
      const fmt = (n: number) => `Rp ${Math.round(Number(n || 0)).toLocaleString('id-ID')}`

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.text(title, 40, 42)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text(perusahaan?.name || '-', 40, 58)
      doc.text(periodText, 40, 72)

      const nrc = data?.neraca || {}
      const aset = Array.isArray(nrc.aset) ? nrc.aset : []
      const ekuitas = Array.isArray(nrc.ekuitas) ? nrc.ekuitas : []

      autoTable(doc, {
        head: [['Aset', 'Total']],
        body: [
          ...aset.map((a: any) => [String(a.akun || '-'), fmt(a.total || 0)]),
          ['Total Aset', fmt(nrc.totalAset || 0)],
        ],
        startY: 92,
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42] },
        styles: { fontSize: 10, cellPadding: 6 },
        columnStyles: { 1: { halign: 'right' } },
      })

      const y1 = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 18 : 260
      autoTable(doc, {
        head: [['Kewajiban & Ekuitas', 'Total']],
        body: [
          ['Total Kewajiban', fmt(nrc.totalKewajiban || 0)],
          ...ekuitas.map((e: any) => [String(e.akun || '-'), fmt(e.total || 0)]),
          ['Total Ekuitas', fmt(nrc.totalEkuitas || 0)],
        ],
        startY: y1,
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42] },
        styles: { fontSize: 10, cellPadding: 6 },
        columnStyles: { 1: { halign: 'right' } },
      })

      doc.save(`Neraca-${(perusahaan?.name || 'Perusahaan').replace(/\\s+/g, '-')}.pdf`)
      toast.success('PDF neraca dibuat')
    } catch {
      toast.error('Gagal export PDF neraca')
    }
  }, [financeEndDate, financeStartDate, perusahaan?.name])

  const openTaxModal = useCallback(async () => {
    setTaxSettingLoading(true)
    try {
      const api = financeData?.labaRugi?.tax?.setting
      if (api) {
        setTaxScheme(String(api.scheme || 'AUTO').toUpperCase())
        setTaxRounding(String(api.rounding || 'THOUSAND').toUpperCase())
        setTaxStandardRatePct(String(Math.round(Number(api.standardRate || 0.22) * 10000) / 100))
        setTaxUmkmFinalRatePct(String(Math.round(Number(api.umkmFinalRate || 0.005) * 10000) / 100))
        setTaxUmkmThreshold(formatRupiahInput(String(Math.round(Number(api.umkmOmzetThreshold || 4_800_000_000)))))
        setTaxFacilityThreshold(formatRupiahInput(String(Math.round(Number(api.facilityOmzetThreshold || 50_000_000_000)))))
        setTaxFacilityPortionThreshold(formatRupiahInput(String(Math.round(Number(api.facilityPortionThreshold || 4_800_000_000)))))
        setTaxFacilityDiscountPct(String(Math.round(Number(api.facilityDiscount ?? 0.5) * 100)))
        setTaxSettingOpen(true)
        return
      }

      const res = await fetch(`/api/perusahaan/${perusahaanId}/tax`, { cache: 'no-store' })
      const json = await res.json().catch(() => ({} as any))
      if (!res.ok || (json as any).error) throw new Error((json as any).error || 'Gagal memuat pengaturan pajak')
      const d = (json as any).data || {}
      setTaxScheme(String(d.scheme || 'AUTO').toUpperCase())
      setTaxRounding(String(d.rounding || 'THOUSAND').toUpperCase())
      setTaxStandardRatePct(String(Math.round(Number(d.standardRate || 0.22) * 10000) / 100))
      setTaxUmkmFinalRatePct(String(Math.round(Number(d.umkmFinalRate || 0.005) * 10000) / 100))
      setTaxUmkmThreshold(formatRupiahInput(String(Math.round(Number(d.umkmOmzetThreshold || 4_800_000_000)))))
      setTaxFacilityThreshold(formatRupiahInput(String(Math.round(Number(d.facilityOmzetThreshold || 50_000_000_000)))))
      setTaxFacilityPortionThreshold(formatRupiahInput(String(Math.round(Number(d.facilityPortionThreshold || 4_800_000_000)))))
      setTaxFacilityDiscountPct(String(Math.round(Number(d.facilityDiscount ?? 0.5) * 100)))
      setTaxSettingOpen(true)
    } catch (e: any) {
      toast.error(e?.message || 'Gagal memuat pengaturan pajak')
    } finally {
      setTaxSettingLoading(false)
    }
  }, [financeData, formatRupiahInput, perusahaanId])

  const saveTaxSetting = useCallback(async () => {
    const loadingToast = toast.loading('Menyimpan pengaturan pajak...')
    setTaxSettingLoading(true)
    try {
      const standardRate = Number(String(taxStandardRatePct).replace(',', '.')) / 100
      const umkmFinalRate = Number(String(taxUmkmFinalRatePct).replace(',', '.')) / 100
      const facilityDiscount = Number(String(taxFacilityDiscountPct).replace(',', '.')) / 100

      const payload = {
        scheme: taxScheme,
        rounding: taxRounding,
        standardRate: Number.isFinite(standardRate) ? standardRate : 0.22,
        umkmFinalRate: Number.isFinite(umkmFinalRate) ? umkmFinalRate : 0.005,
        umkmOmzetThreshold: parseRupiahToNumber(taxUmkmThreshold),
        facilityOmzetThreshold: parseRupiahToNumber(taxFacilityThreshold),
        facilityPortionThreshold: parseRupiahToNumber(taxFacilityPortionThreshold),
        facilityDiscount: Number.isFinite(facilityDiscount) ? facilityDiscount : 0.5,
      }

      const res = await fetch(`/api/perusahaan/${perusahaanId}/tax`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => ({} as any))
      if (!res.ok || (json as any).error) throw new Error((json as any).error || 'Gagal menyimpan pengaturan pajak')
      toast.success('Pengaturan pajak tersimpan', { id: loadingToast })
      setTaxSettingOpen(false)
      await fetchFinance()
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menyimpan pengaturan pajak', { id: loadingToast })
    } finally {
      setTaxSettingLoading(false)
    }
  }, [fetchFinance, parseRupiahToNumber, perusahaanId, taxFacilityDiscountPct, taxFacilityPortionThreshold, taxFacilityThreshold, taxRounding, taxScheme, taxStandardRatePct, taxUmkmFinalRatePct, taxUmkmThreshold])

  const fetchBiaya = useCallback(async () => {
    setBiayaLoading(true)
    try {
      const sp = new URLSearchParams()
      if (financeStartDate) sp.set('startDate', financeStartDate)
      if (financeEndDate) sp.set('endDate', financeEndDate)
      sp.set('type', 'PENGELUARAN')
      sp.set('source', 'LEDGER')
      sp.set('page', String(biayaPage))
      sp.set('limit', String(biayaLimit))

      const res = await fetch(`/api/perusahaan/${perusahaanId}/biaya?${sp.toString()}`, { cache: 'no-store' })
      const json = await res.json().catch(() => ({ data: [], meta: null }))
      if (!res.ok || json.error) throw new Error(json.error || 'Gagal memuat daftar biaya')

      setBiayaList((json.data || []).map((x: any) => ({
        id: Number(x.id),
        date: String(x.date),
        type: String(x.type || 'PENGELUARAN'),
        kategori: String(x.kategori || 'UMUM'),
        deskripsi: x.deskripsi ? String(x.deskripsi) : null,
        jumlah: Number(x.jumlah || 0),
        gambarUrl: x.gambarUrl ? String(x.gambarUrl) : null,
        source: String(x.source || 'MANUAL'),
        keterangan: x.keterangan ? String(x.keterangan) : null,
        kasTransaksiId: x.kasTransaksiId ? Number(x.kasTransaksiId) : null,
        kebunId: x.kebunId !== undefined && x.kebunId !== null ? Number(x.kebunId) : null,
        kendaraanPlatNomor: x.kendaraanPlatNomor ? String(x.kendaraanPlatNomor) : null,
        karyawanId: x.karyawanId !== undefined && x.karyawanId !== null ? Number(x.karyawanId) : null,
      })))
      setBiayaMeta(json.meta || null)
    } catch (e: any) {
      toast.error(e?.message || 'Gagal memuat biaya manual')
      setBiayaList([])
      setBiayaMeta(null)
    } finally {
      setBiayaLoading(false)
    }
  }, [perusahaanId, financeStartDate, financeEndDate, biayaPage])

  useEffect(() => {
    fetchPerusahaan()
  }, [fetchPerusahaan])

  useEffect(() => {
    if (tab === 'dokumen') fetchDocuments()
  }, [fetchDocuments, tab])

  useEffect(() => {
    if (tab === 'nota') fetchNota()
  }, [fetchNota, tab])

  useEffect(() => {
    if (tab === 'invoice') fetchInvoices()
  }, [fetchInvoices, tab])

  useEffect(() => {
    if (tab === 'pabrik') fetchPabriks()
  }, [fetchPabriks, tab])

  useEffect(() => {
    if (tab === 'keuangan') fetchFinance()
  }, [fetchFinance, tab])

  useEffect(() => {
    if (tab === 'keuangan') fetchBiaya()
  }, [fetchBiaya, tab])

  useEffect(() => {
    setBiayaPage(1)
  }, [financeStartDate, financeEndDate, perusahaanId])

  async function handleUploadDoc(type: string, file: File) {
    if (!perusahaan) return
    const safeFile = isLikelyImageFile(file) ? await convertImageFileToWebp(file, { quality: 0.82, maxDimension: 1280 }) : file
    const fd = new FormData()
    fd.append('file', safeFile)
    const loadingToast = toast.loading('Mengunggah dokumen...')
    setDocLoading(true)
    try {
      const up = await fetch('/api/upload', { method: 'POST', body: fd })
      const upJson = await up.json()
      if (!up.ok || !upJson.success) throw new Error(upJson.error || 'Upload gagal')
      const res = await fetch(`/api/perusahaan/${perusahaan.id}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, fileName: safeFile.name, fileUrl: upJson.url }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.error) throw new Error(json.error || 'Gagal menyimpan dokumen')
      toast.success('Dokumen berhasil diunggah', { id: loadingToast })
      await fetchDocuments()
    } catch (err: any) {
      toast.error(err?.message || 'Gagal mengunggah dokumen', { id: loadingToast })
    } finally {
      setDocLoading(false)
    }
  }

  function makeOtherType(name: string, fileName: string) {
    const raw = (name || '').trim() || fileName.replace(/\.[^/.]+$/, '')
    const safe = raw
      .replace(/\s+/g, ' ')
      .slice(0, 80)
      .replace(/[^\p{L}\p{N} .,_-]/gu, '')
      .trim()
    return `OTHER:${safe || 'Dokumen Lainnya'}`
  }

  async function handleDeleteDoc(doc: PerusahaanDocument) {
    if (!perusahaan) return
    const loadingToast = toast.loading('Menghapus dokumen...')
    setDocLoading(true)
    try {
      const res = await fetch(`/api/perusahaan/${perusahaan.id}/documents/${doc.id}`, { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.error) throw new Error(json.error || 'Gagal menghapus dokumen')
      toast.success('Dokumen dihapus', { id: loadingToast })
      await fetchDocuments()
    } catch (err: any) {
      toast.error(err?.message || 'Gagal menghapus dokumen', { id: loadingToast })
    } finally {
      setDocLoading(false)
    }
  }

  async function handleAddBiaya() {
    if (!biayaDate) {
      toast.error('Tanggal wajib diisi')
      return
    }
    const kategori = String(biayaKategori || '').trim()
    if (!kategori) {
      toast.error('Kategori wajib diisi')
      return
    }
    const jumlah = Number(String(biayaJumlah).replace(/[^0-9]/g, ''))
    if (!Number.isFinite(jumlah) || jumlah <= 0) {
      toast.error('Jumlah harus > 0')
      return
    }
    const loadingToast = toast.loading('Menyimpan biaya...')
    try {
      addKategori(kategori)
      let gambarUrl: string | null = null
      if (biayaFile) {
        const safeFile = isLikelyImageFile(biayaFile) ? await convertImageFileToWebp(biayaFile, { quality: 0.82, maxDimension: 1280 }) : biayaFile
        const fd = new FormData()
        fd.append('file', safeFile)
        const up = await fetch('/api/upload', { method: 'POST', body: fd })
        const upJson = await up.json()
        if (!up.ok || !upJson.success) throw new Error(upJson.error || 'Upload bukti gagal')
        gambarUrl = upJson.url
      }
      const res = await fetch(`/api/perusahaan/${perusahaanId}/biaya`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: biayaDate,
          type: 'PENGELUARAN',
          kategori,
          deskripsi: biayaDeskripsi || null,
          jumlah,
          gambarUrl,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.error) throw new Error(json.error || 'Gagal menyimpan biaya')
      toast.success('Biaya tersimpan', { id: loadingToast })
      setBiayaDeskripsi('')
      setBiayaJumlah('')
      setBiayaFile(null)
      if (biayaPreviewUrlRef.current) URL.revokeObjectURL(biayaPreviewUrlRef.current)
      biayaPreviewUrlRef.current = null
      setBiayaPreviewUrl(null)
      await Promise.all([fetchBiaya(), fetchFinance()])
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menyimpan biaya', { id: loadingToast })
    }
  }

  async function handleDeleteBiaya(item: PerusahaanBiaya) {
    if (item.source !== 'MANUAL') {
      toast.error('Biaya dari Kasir tidak bisa dihapus dari sini. Hapus lewat menu Kasir.')
      return
    }
    const ok = confirm('Hapus biaya ini?')
    if (!ok) return
    const loadingToast = toast.loading('Menghapus biaya...')
    try {
      const res = await fetch(`/api/perusahaan/${perusahaanId}/biaya/${item.id}`, { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.error) throw new Error(json.error || 'Gagal menghapus biaya')
      toast.success('Biaya dihapus', { id: loadingToast })
      await Promise.all([fetchBiaya(), fetchFinance()])
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menghapus biaya', { id: loadingToast })
    }
  }

  async function handleSaveEditBiaya() {
    if (!editBiaya) return
    const kategoriBaru = editKategori.trim()
    if (!kategoriBaru) {
      toast.error('Kategori wajib diisi')
      return
    }

    const loadingToast = toast.loading('Menyimpan perubahan...')
    try {
      addKategori(kategoriBaru)
      if (editBiaya.source === 'MANUAL') {
        const res = await fetch(`/api/perusahaan/${perusahaanId}/biaya/${editBiaya.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kategori: kategoriBaru }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok || json.error) throw new Error(json.error || 'Gagal mengubah kategori')
      } else if (editBiaya.source === 'KASIR') {
        const res = await fetch('/api/kasir', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editBiaya.kasTransaksiId || editBiaya.id,
            tipe: editBiaya.type || 'PENGELUARAN',
            deskripsi: editBiaya.deskripsi || '',
            jumlah: Number(editBiaya.jumlah || 0),
            keterangan: editBiaya.keterangan || '',
            gambarUrl: editBiaya.gambarUrl || '',
            date: editBiaya.date,
            kendaraanPlatNomor: editBiaya.kendaraanPlatNomor || undefined,
            kebunId: editBiaya.kebunId || undefined,
            karyawanId: editBiaya.karyawanId || undefined,
            kategori: kategoriBaru,
          }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok || json.error) throw new Error(json.error || 'Gagal mengubah kategori')
      } else {
        throw new Error('Sumber biaya ini tidak bisa diedit dari sini')
      }

      toast.success('Kategori diperbarui', { id: loadingToast })
      setEditBiayaOpen(false)
      setEditBiaya(null)
      await Promise.all([fetchBiaya(), fetchFinance()])
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menyimpan perubahan', { id: loadingToast })
    }
  }

  const openBukti = (url: string) => {
    setBuktiUrl(url)
    setBuktiOpen(true)
  }

  const handleDownloadBukti = async () => {
    if (!buktiUrl) return
    try {
      const res = await fetch(buktiUrl, { cache: 'no-store' })
      const blob = await res.blob()
      const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg'
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.href = url
      link.download = `bukti-${perusahaanId}.${ext}`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch {
      const link = document.createElement('a')
      link.href = buktiUrl
      link.target = '_blank'
      document.body.appendChild(link)
      link.click()
      link.remove()
    }
  }

  async function fetchNotaForExport() {
    const res = await fetch(`/api/nota-sawit?${exportNotaQuery}`, { cache: 'no-store' })
    if (!res.ok) throw new Error('Gagal mengambil data untuk ekspor')
    const json = await res.json()
    const dataToExport = Array.isArray(json) ? json : json.data
    if (!Array.isArray(dataToExport)) throw new Error('Format data ekspor tidak valid')
    return dataToExport
  }

  async function handleExportNotaCsv() {
    setNotaExporting(true)
    const loadingToast = toast.loading('Menyiapkan export spreadsheet...')
    try {
      const dataToExport = await fetchNotaForExport()
      const header = ['No', 'ID', 'Tgl Bongkar', 'Pabrik', 'Supir', 'Plat', 'Kebun', 'Berat Akhir (Kg)', 'Total (Rp)', 'Status']

      let totalBeratAkhir = 0
      let totalPembayaran = 0

      const rows = dataToExport.map((item: any, idx: number) => {
        const tgl = item.tanggalBongkar ? new Date(item.tanggalBongkar).toLocaleDateString('id-ID') : '-'
        const pabrik = item.pabrikSawit?.name || '-'
        const supir = item.supir?.name || '-'
        const plat = item.kendaraanPlatNomor || item.kendaraan?.platNomor || '-'
        const kebun = item.timbangan?.kebun?.name || item.kebun?.name || '-'
        const beratAkhir = Number(item.beratAkhir || 0)
        const total = Number(item.totalPembayaran || 0)
        const status = String(item.statusPembayaran || '-')
        totalBeratAkhir += beratAkhir
        totalPembayaran += total
        return [
          idx + 1,
          item.id,
          tgl,
          pabrik,
          supir,
          plat,
          kebun,
          beratAkhir,
          total,
          status,
        ]
      })

      const summaryRow = ['', '', '', '', '', '', 'TOTAL', totalBeratAkhir, totalPembayaran, '']
      const csvLines = [
        header.map(escapeCsvCell).join(','),
        ...rows.map(r => r.map(escapeCsvCell).join(',')),
        summaryRow.map(escapeCsvCell).join(','),
      ].join('\n')

      const blob = new Blob([csvLines], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      const startLabel = notaStartDate || 'all'
      const endLabel = notaEndDate || 'all'
      const name = (perusahaan?.name || 'perusahaan').replace(/[^\p{L}\p{N}\s_-]/gu, '').trim().replace(/\s+/g, '-')
      link.setAttribute('download', `nota-sawit-${name}-${startLabel}-sampai-${endLabel}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      toast.success('Spreadsheet berhasil dibuat', { id: loadingToast })
    } catch (e: any) {
      toast.error(e?.message || 'Gagal mengekspor spreadsheet', { id: loadingToast })
    } finally {
      setNotaExporting(false)
    }
  }

  async function handleExportNotaPdf() {
    setNotaExporting(true)
    const loadingToast = toast.loading('Menyiapkan export PDF...')
    try {
      const dataToExport = await fetchNotaForExport()
      const jsPDF = (await import('jspdf')).default
      const autoTable = (await import('jspdf-autotable')).default

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const title = `Nota Sawit - ${perusahaan?.name || 'Perusahaan'}`
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text(title, 14, 15)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(`Periode: ${formatDateRangeLabel(notaStartDate, notaEndDate)}`, 14, 22)
      if (debouncedNotaSearch) doc.text(`Search: ${debouncedNotaSearch}`, 14, 27)

      let totalBeratAkhir = 0
      let totalPembayaran = 0

      const head = [['No', 'Tgl', 'Pabrik', 'Supir', 'Plat', 'Kebun', 'Berat Akhir (Kg)', 'Total (Rp)', 'Status']]
      const body = dataToExport.map((item: any, idx: number) => {
        const tgl = item.tanggalBongkar ? new Date(item.tanggalBongkar).toLocaleDateString('id-ID') : '-'
        const pabrik = item.pabrikSawit?.name || '-'
        const supir = item.supir?.name || '-'
        const plat = item.kendaraanPlatNomor || item.kendaraan?.platNomor || '-'
        const kebun = item.timbangan?.kebun?.name || item.kebun?.name || '-'
        const beratAkhir = Number(item.beratAkhir || 0)
        const total = Number(item.totalPembayaran || 0)
        const status = String(item.statusPembayaran || '-')
        totalBeratAkhir += beratAkhir
        totalPembayaran += total
        return [
          idx + 1,
          tgl,
          pabrik,
          supir,
          plat,
          kebun,
          formatNumber(beratAkhir),
          formatCurrency(total),
          status,
        ]
      })

      const footer = [[
        { content: 'TOTAL', colSpan: 6, styles: { halign: 'right' as const, fontStyle: 'bold' as const } },
        { content: formatNumber(totalBeratAkhir), styles: { fontStyle: 'bold' as const } },
        { content: formatCurrency(totalPembayaran), styles: { fontStyle: 'bold' as const } },
        { content: '', styles: { fontStyle: 'bold' as const } },
      ]]

      autoTable(doc, {
        head,
        body,
        foot: footer,
        startY: 33,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 1.5 },
        headStyles: { fillColor: [22, 160, 133], textColor: 255, fontStyle: 'bold' as const },
        footStyles: { fillColor: [230, 230, 230], textColor: 0, fontStyle: 'bold' as const },
      })

      const startLabel = notaStartDate || 'all'
      const endLabel = notaEndDate || 'all'
      const name = (perusahaan?.name || 'perusahaan').replace(/[^\p{L}\p{N}\s_-]/gu, '').trim().replace(/\s+/g, '-')
      doc.save(`nota-sawit-${name}-${startLabel}-sampai-${endLabel}.pdf`)
      toast.success('PDF berhasil dibuat', { id: loadingToast })
    } catch (e: any) {
      toast.error(e?.message || 'Gagal mengekspor PDF', { id: loadingToast })
    } finally {
      setNotaExporting(false)
    }
  }

  function openDocPreview(doc: PerusahaanDocument) {
    setDocPreview(doc)
    setDocPreviewOpen(true)
  }

  return (
    <main className="p-4 md:p-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <PerusahaanDetailHeader
          loading={loading}
          perusahaan={perusahaan as any}
          backHref="/perusahaan"
          onRefresh={() => {
            fetchPerusahaan()
            if (tab === 'dokumen') fetchDocuments()
          }}
          refreshSpinning={loading}
        />

        <Tabs value={tab} onValueChange={(v: any) => setTab(v)} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <PerusahaanDetailTabs />

          <TabsContent value="profil">
            <div className="mt-4 text-sm text-gray-500">Data profil tampil di header.</div>
          </TabsContent>

          <TabsContent value="dokumen">
            <div className="mt-4 space-y-3">
              {docTypes.map(dt => {
                const doc = docsByType.get(dt.type)
                return (
                  <div key={dt.type} className="rounded-2xl border border-gray-100 bg-white p-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[10px] font-black tracking-wider text-gray-500 uppercase">{labelDocType(dt.type)}</div>
                      <div className="text-sm font-semibold text-gray-900 mt-1 truncate">{doc ? doc.fileName : '-'}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {doc ? (
                        <>
                          <button
                            type="button"
                            onClick={() => openDocPreview(doc)}
                            className="h-9 w-9 rounded-full border border-gray-200 bg-white text-gray-700 flex items-center justify-center hover:bg-gray-50"
                            aria-label="Detail dokumen"
                          >
                            <EyeIcon className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteDoc(doc)}
                            className="h-9 w-9 rounded-full border border-red-200 bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-100"
                            aria-label="Hapus dokumen"
                            disabled={docLoading}
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </>
                      ) : null}
                      <label className="h-9 w-9 rounded-full border border-amber-200 bg-amber-50 text-amber-700 flex items-center justify-center hover:bg-amber-100 cursor-pointer">
                        <ArrowUpTrayIcon className="h-4 w-4" />
                        <input
                          type="file"
                          accept={dt.accept}
                          className="sr-only"
                          onChange={async (e) => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            await handleUploadDoc(dt.type, file)
                            e.target.value = ''
                          }}
                        />
                      </label>
                    </div>
                  </div>
                )
              })}
              {docLoading ? <div className="text-xs text-gray-500">Memproses...</div> : null}

              <div className="rounded-2xl border border-gray-100 bg-white p-4">
                <div className="text-[10px] font-black tracking-wider text-gray-500 uppercase">Dokumen Lainnya</div>
                <div className="mt-3 flex flex-col sm:flex-row gap-2">
                  <input
                    value={otherDocName}
                    onChange={(e) => setOtherDocName(e.target.value)}
                    placeholder="Nama dokumen (opsional)"
                    className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                  <label className="h-10 px-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 flex items-center justify-center hover:bg-emerald-100 cursor-pointer shrink-0">
                    <ArrowUpTrayIcon className="h-4 w-4 mr-2" />
                    Upload
                    <input
                      type="file"
                      accept="application/pdf,image/*"
                      className="sr-only"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        const type = makeOtherType(otherDocName, file.name)
                        await handleUploadDoc(type, file)
                        setOtherDocName('')
                        e.target.value = ''
                      }}
                    />
                  </label>
                </div>
                {otherDocs.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    {otherDocs.map((doc) => (
                      <div key={doc.id} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-gray-900 truncate">{labelDocType(doc.type)}</div>
                          <div className="text-[11px] text-gray-500 truncate">{doc.fileName}</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => openDocPreview(doc)}
                            className="h-9 w-9 rounded-full border border-gray-200 bg-white text-gray-700 flex items-center justify-center hover:bg-gray-50"
                            aria-label="Detail dokumen"
                          >
                            <EyeIcon className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteDoc(doc)}
                            className="h-9 w-9 rounded-full border border-red-200 bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-100"
                            aria-label="Hapus dokumen"
                            disabled={docLoading}
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 text-xs text-gray-500">Belum ada dokumen lainnya</div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="nota">
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-2">
              <Input
                type="text"
                placeholder="Cari nota (supir, kebun, angka)..."
                value={notaSearch}
                onChange={(e) => { setNotaSearch(e.target.value); setNotaPage(1) }}
                className="h-10 rounded-xl bg-white w-full sm:w-[340px]"
              />
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full sm:w-[340px] justify-start text-left font-normal bg-white rounded-xl',
                      !(notaStartDate && notaEndDate) && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formatDateRangeLabel(notaStartDate, notaEndDate)}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[92vw] sm:w-auto p-4 bg-white" align="start">
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <div className="font-semibold leading-none">Rentang Waktu</div>
                      <div className="text-sm text-muted-foreground">Pilih rentang waktu cepat atau kustom</div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" size="sm" onClick={() => { applyQuickRange('today', setNotaStartDate, setNotaEndDate, setNotaQuickRange); setNotaPage(1) }} className={notaQuickRange === 'today' ? 'bg-accent' : ''}>Hari Ini</Button>
                      <Button variant="outline" size="sm" onClick={() => { applyQuickRange('yesterday', setNotaStartDate, setNotaEndDate, setNotaQuickRange); setNotaPage(1) }} className={notaQuickRange === 'yesterday' ? 'bg-accent' : ''}>Kemarin</Button>
                      <Button variant="outline" size="sm" onClick={() => { applyQuickRange('last_week', setNotaStartDate, setNotaEndDate, setNotaQuickRange); setNotaPage(1) }} className={notaQuickRange === 'last_week' ? 'bg-accent' : ''}>7 Hari</Button>
                      <Button variant="outline" size="sm" onClick={() => { applyQuickRange('last_30_days', setNotaStartDate, setNotaEndDate, setNotaQuickRange); setNotaPage(1) }} className={notaQuickRange === 'last_30_days' ? 'bg-accent' : ''}>30 Hari</Button>
                      <Button variant="outline" size="sm" onClick={() => { applyQuickRange('this_month', setNotaStartDate, setNotaEndDate, setNotaQuickRange); setNotaPage(1) }} className={notaQuickRange === 'this_month' ? 'bg-accent' : ''}>Bulan Ini</Button>
                    </div>
                    <div className="border-t pt-4 space-y-2">
                      <div className="font-semibold leading-none">Kustom</div>
                      <div className="grid gap-2">
                        <div className="grid grid-cols-3 items-center gap-4">
                          <Label className="text-xs">Dari</Label>
                          <Input
                            type="date"
                            className="col-span-2 h-8"
                            value={notaStartDate}
                            onChange={(e) => { setNotaStartDate(e.target.value); setNotaQuickRange('custom'); setNotaPage(1) }}
                          />
                        </div>
                        <div className="grid grid-cols-3 items-center gap-4">
                          <Label className="text-xs">Sampai</Label>
                          <Input
                            type="date"
                            className="col-span-2 h-8"
                            value={notaEndDate}
                            onChange={(e) => { setNotaEndDate(e.target.value); setNotaQuickRange('custom'); setNotaPage(1) }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button variant="outline" size="sm" onClick={() => { setNotaStartDate(''); setNotaEndDate(''); setNotaQuickRange(''); setNotaPage(1) }}>Reset</Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="rounded-xl h-10 w-full sm:w-auto" disabled={notaExporting}>
                    <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleExportNotaPdf() }}>
                    Export PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleExportNotaCsv() }}>
                    Export Spreadsheet (CSV)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="outline"
                className="rounded-xl h-10 w-full sm:w-auto"
                onClick={openNotaSawitSettingModal}
                disabled={notaSawitSettingLoading}
              >
                <TagIcon className={`h-4 w-4 mr-2 ${notaSawitSettingLoading ? 'animate-spin' : ''}`} />
                Tarif PPh Nota Sawit
              </Button>
            </div>
            <div className="mt-3 space-y-3 sm:hidden">
              {notaLoading ? (
                <div className="rounded-2xl border border-gray-100 bg-white p-4">
                  <Skeleton className="h-6 w-full" />
                </div>
              ) : notaList.length === 0 ? (
                <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center text-sm text-gray-500">
                  Tidak ada data
                </div>
              ) : (
                <>
                  {notaList.map(n => (
                    <div key={n.id} className="rounded-2xl border border-gray-100 bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-bold text-gray-900 truncate">{n.supirName}</div>
                          <div className="text-xs text-gray-500 mt-1 truncate">{n.kebunName}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs font-semibold text-gray-900">{formatCurrency(n.totalPembayaran)}</div>
                          <div className="text-[11px] text-gray-500 mt-1">{n.beratAkhir.toLocaleString('id-ID')} Kg</div>
                        </div>
                      </div>
                      <div className="mt-3 text-xs text-gray-600">
                        {n.tanggalBongkar ? new Date(n.tanggalBongkar).toLocaleDateString('id-ID') : '-'}
                      </div>
                    </div>
                  ))}
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                    <div className="text-xs font-bold text-gray-700">Jumlah (Halaman)</div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <div className="rounded-xl border border-gray-100 bg-white p-3">
                        <div className="text-[10px] font-black tracking-wider uppercase text-gray-400">Berat Akhir</div>
                        <div className="text-xs font-semibold text-gray-900 mt-1">{notaTotals.totalBeratAkhir.toLocaleString('id-ID')} Kg</div>
                      </div>
                      <div className="rounded-xl border border-gray-100 bg-white p-3">
                        <div className="text-[10px] font-black tracking-wider uppercase text-gray-400">Total</div>
                        <div className="text-xs font-semibold text-gray-900 mt-1">{formatCurrency(notaTotals.totalPembayaran)}</div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="hidden sm:block mt-3 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px] uppercase">Tanggal</TableHead>
                    <TableHead className="text-[10px] uppercase">Supir</TableHead>
                    <TableHead className="text-[10px] uppercase">Kebun</TableHead>
                    <TableHead className="text-right text-[10px] uppercase">Berat Akhir</TableHead>
                    <TableHead className="text-right text-[10px] uppercase">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notaLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8"><Skeleton className="h-6 w-full" /></TableCell>
                    </TableRow>
                  ) : notaList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-xs text-gray-500 py-8">Tidak ada data</TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {notaList.map(n => (
                        <TableRow key={n.id}>
                          <TableCell className="text-xs">{n.tanggalBongkar ? new Date(n.tanggalBongkar).toLocaleDateString('id-ID') : '-'}</TableCell>
                          <TableCell className="text-xs">{n.supirName}</TableCell>
                          <TableCell className="text-xs">{n.kebunName}</TableCell>
                          <TableCell className="text-right text-xs">{n.beratAkhir.toLocaleString('id-ID')} Kg</TableCell>
                          <TableCell className="text-right text-xs font-semibold">{formatCurrency(n.totalPembayaran)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-gray-50/60 border-t">
                        <TableCell colSpan={3} className="text-xs font-bold text-gray-700">Jumlah (Halaman)</TableCell>
                        <TableCell className="text-right text-xs font-black text-gray-900">{notaTotals.totalBeratAkhir.toLocaleString('id-ID')} Kg</TableCell>
                        <TableCell className="text-right text-xs font-black text-gray-900">{formatCurrency(notaTotals.totalPembayaran)}</TableCell>
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="outline" className="rounded-xl" disabled={notaPage <= 1} onClick={() => setNotaPage(p => Math.max(1, p - 1))}>Prev</Button>
              <Button variant="outline" className="rounded-xl" onClick={() => setNotaPage(p => p + 1)}>Next</Button>
            </div>
          </TabsContent>

          <TabsContent value="invoice">
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-2">
              <Input
                type="text"
                placeholder="Cari invoice (no surat, pabrik, status)..."
                value={invoiceSearch}
                onChange={(e) => { setInvoiceSearch(e.target.value); setInvoicePage(1) }}
                className="h-10 rounded-xl bg-white w-full sm:w-[340px]"
              />
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full sm:w-[340px] justify-start text-left font-normal bg-white rounded-xl',
                      !(invoiceStartDate && invoiceEndDate) && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formatDateRangeLabel(invoiceStartDate, invoiceEndDate)}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[92vw] sm:w-auto p-4 bg-white" align="start">
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <div className="font-semibold leading-none">Rentang Waktu</div>
                      <div className="text-sm text-muted-foreground">Pilih rentang waktu cepat atau kustom</div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" size="sm" onClick={() => { applyQuickRange('today', setInvoiceStartDate, setInvoiceEndDate, setInvoiceQuickRange); setInvoicePage(1) }} className={invoiceQuickRange === 'today' ? 'bg-accent' : ''}>Hari Ini</Button>
                      <Button variant="outline" size="sm" onClick={() => { applyQuickRange('yesterday', setInvoiceStartDate, setInvoiceEndDate, setInvoiceQuickRange); setInvoicePage(1) }} className={invoiceQuickRange === 'yesterday' ? 'bg-accent' : ''}>Kemarin</Button>
                      <Button variant="outline" size="sm" onClick={() => { applyQuickRange('last_week', setInvoiceStartDate, setInvoiceEndDate, setInvoiceQuickRange); setInvoicePage(1) }} className={invoiceQuickRange === 'last_week' ? 'bg-accent' : ''}>7 Hari</Button>
                      <Button variant="outline" size="sm" onClick={() => { applyQuickRange('last_30_days', setInvoiceStartDate, setInvoiceEndDate, setInvoiceQuickRange); setInvoicePage(1) }} className={invoiceQuickRange === 'last_30_days' ? 'bg-accent' : ''}>30 Hari</Button>
                      <Button variant="outline" size="sm" onClick={() => { applyQuickRange('this_month', setInvoiceStartDate, setInvoiceEndDate, setInvoiceQuickRange); setInvoicePage(1) }} className={invoiceQuickRange === 'this_month' ? 'bg-accent' : ''}>Bulan Ini</Button>
                    </div>
                    <div className="border-t pt-4 space-y-2">
                      <div className="font-semibold leading-none">Kustom</div>
                      <div className="grid gap-2">
                        <div className="grid grid-cols-3 items-center gap-4">
                          <Label className="text-xs">Dari</Label>
                          <Input
                            type="date"
                            className="col-span-2 h-8"
                            value={invoiceStartDate}
                            onChange={(e) => { setInvoiceStartDate(e.target.value); setInvoiceQuickRange('custom'); setInvoicePage(1) }}
                          />
                        </div>
                        <div className="grid grid-cols-3 items-center gap-4">
                          <Label className="text-xs">Sampai</Label>
                          <Input
                            type="date"
                            className="col-span-2 h-8"
                            value={invoiceEndDate}
                            onChange={(e) => { setInvoiceEndDate(e.target.value); setInvoiceQuickRange('custom'); setInvoicePage(1) }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button variant="outline" size="sm" onClick={() => { setInvoiceStartDate(''); setInvoiceEndDate(''); setInvoiceQuickRange(''); setInvoicePage(1) }}>Reset</Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div className="mt-3 space-y-3 sm:hidden">
              {invoiceLoading ? (
                <div className="rounded-2xl border border-gray-100 bg-white p-4">
                  <Skeleton className="h-6 w-full" />
                </div>
              ) : invoiceList.length === 0 ? (
                <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center text-sm text-gray-500">
                  Tidak ada data
                </div>
              ) : (
                invoiceList.map(inv => (
                  <div key={inv.id} className="rounded-2xl border border-gray-100 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-bold text-gray-900 truncate">{inv.number}</div>
                        <div className="text-xs text-gray-500 mt-1 truncate">{inv.pabrikName}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-semibold text-gray-900">{formatCurrency(inv.grandTotal)}</div>
                        <div className="text-[11px] text-gray-500 mt-1">{String(inv.status || '-')}</div>
                      </div>
                    </div>
                    <div className="mt-3 text-xs text-gray-600">
                      {new Date(inv.year, (inv.month || 1) - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="hidden sm:block mt-3 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px] uppercase">No. Surat</TableHead>
                    <TableHead className="text-[10px] uppercase">Pabrik</TableHead>
                    <TableHead className="text-[10px] uppercase">Periode</TableHead>
                    <TableHead className="text-[10px] uppercase">Status</TableHead>
                    <TableHead className="text-right text-[10px] uppercase">Grand Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoiceLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8"><Skeleton className="h-6 w-full" /></TableCell>
                    </TableRow>
                  ) : invoiceList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-xs text-gray-500 py-8">Tidak ada data</TableCell>
                    </TableRow>
                  ) : (
                    invoiceList.map(inv => (
                      <TableRow key={inv.id}>
                        <TableCell className="text-xs font-medium">{inv.number}</TableCell>
                        <TableCell className="text-xs">{inv.pabrikName}</TableCell>
                        <TableCell className="text-xs">{new Date(inv.year, (inv.month || 1) - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</TableCell>
                        <TableCell className="text-xs">{inv.status}</TableCell>
                        <TableCell className="text-right text-xs font-semibold">{formatCurrency(inv.grandTotal)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="outline" className="rounded-xl" disabled={invoicePage <= 1} onClick={() => setInvoicePage(p => Math.max(1, p - 1))}>Prev</Button>
              <Button variant="outline" className="rounded-xl" onClick={() => setInvoicePage(p => p + 1)}>Next</Button>
            </div>
          </TabsContent>

          <TabsContent value="pabrik">
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-2">
              <Input
                type="text"
                placeholder="Cari pabrik (nama/alamat)..."
                value={pabrikSearch}
                onChange={(e) => { setPabrikSearch(e.target.value); setPabrikPage(1) }}
                className="h-10 rounded-xl bg-white w-full sm:w-[340px]"
              />
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full sm:w-[340px] justify-start text-left font-normal bg-white rounded-xl',
                      !(pabrikStartDate && pabrikEndDate) && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formatDateRangeLabel(pabrikStartDate, pabrikEndDate)}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[92vw] sm:w-auto p-4 bg-white" align="start">
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <div className="font-semibold leading-none">Rentang Waktu</div>
                      <div className="text-sm text-muted-foreground">Pilih rentang waktu cepat atau kustom</div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" size="sm" onClick={() => { applyQuickRange('today', setPabrikStartDate, setPabrikEndDate, setPabrikQuickRange); setPabrikPage(1) }} className={pabrikQuickRange === 'today' ? 'bg-accent' : ''}>Hari Ini</Button>
                      <Button variant="outline" size="sm" onClick={() => { applyQuickRange('yesterday', setPabrikStartDate, setPabrikEndDate, setPabrikQuickRange); setPabrikPage(1) }} className={pabrikQuickRange === 'yesterday' ? 'bg-accent' : ''}>Kemarin</Button>
                      <Button variant="outline" size="sm" onClick={() => { applyQuickRange('last_week', setPabrikStartDate, setPabrikEndDate, setPabrikQuickRange); setPabrikPage(1) }} className={pabrikQuickRange === 'last_week' ? 'bg-accent' : ''}>7 Hari</Button>
                      <Button variant="outline" size="sm" onClick={() => { applyQuickRange('last_30_days', setPabrikStartDate, setPabrikEndDate, setPabrikQuickRange); setPabrikPage(1) }} className={pabrikQuickRange === 'last_30_days' ? 'bg-accent' : ''}>30 Hari</Button>
                      <Button variant="outline" size="sm" onClick={() => { applyQuickRange('this_month', setPabrikStartDate, setPabrikEndDate, setPabrikQuickRange); setPabrikPage(1) }} className={pabrikQuickRange === 'this_month' ? 'bg-accent' : ''}>Bulan Ini</Button>
                    </div>
                    <div className="border-t pt-4 space-y-2">
                      <div className="font-semibold leading-none">Kustom</div>
                      <div className="grid gap-2">
                        <div className="grid grid-cols-3 items-center gap-4">
                          <Label className="text-xs">Dari</Label>
                          <Input
                            type="date"
                            className="col-span-2 h-8"
                            value={pabrikStartDate}
                            onChange={(e) => { setPabrikStartDate(e.target.value); setPabrikQuickRange('custom'); setPabrikPage(1) }}
                          />
                        </div>
                        <div className="grid grid-cols-3 items-center gap-4">
                          <Label className="text-xs">Sampai</Label>
                          <Input
                            type="date"
                            className="col-span-2 h-8"
                            value={pabrikEndDate}
                            onChange={(e) => { setPabrikEndDate(e.target.value); setPabrikQuickRange('custom'); setPabrikPage(1) }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button variant="outline" size="sm" onClick={() => { setPabrikStartDate(''); setPabrikEndDate(''); setPabrikQuickRange(''); setPabrikPage(1) }}>Reset</Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div className="mt-3 space-y-3 sm:hidden">
              {pabrikLoading ? (
                <div className="rounded-2xl border border-gray-100 bg-white p-4">
                  <Skeleton className="h-6 w-full" />
                </div>
              ) : pabrikList.length === 0 ? (
                <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center text-sm text-gray-500">
                  Tidak ada data
                </div>
              ) : (
                pabrikList.map(p => (
                  <div key={p.id} className="rounded-2xl border border-gray-100 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-bold text-gray-900 truncate">{p.name}</div>
                        <div className="text-xs text-gray-500 mt-1 truncate">{p.address || '-'}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-semibold text-gray-900">{formatCurrency(p.totalNilai)}</div>
                        <div className="text-[11px] text-gray-500 mt-1">{p.totalNota.toLocaleString('id-ID')} nota</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="hidden sm:block mt-3 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px] uppercase">Nama</TableHead>
                    <TableHead className="text-[10px] uppercase">Alamat</TableHead>
                    <TableHead className="text-right text-[10px] uppercase">Total Nota</TableHead>
                    <TableHead className="text-right text-[10px] uppercase">Total Nilai</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pabrikLoading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8"><Skeleton className="h-6 w-full" /></TableCell>
                    </TableRow>
                  ) : pabrikList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-xs text-gray-500 py-8">Tidak ada data</TableCell>
                    </TableRow>
                  ) : (
                    pabrikList.map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="text-xs font-medium">{p.name}</TableCell>
                        <TableCell className="text-xs">{p.address || '-'}</TableCell>
                        <TableCell className="text-right text-xs">{p.totalNota.toLocaleString('id-ID')}</TableCell>
                        <TableCell className="text-right text-xs font-semibold">{formatCurrency(p.totalNilai)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="outline" className="rounded-xl" disabled={pabrikPage <= 1} onClick={() => setPabrikPage(p => Math.max(1, p - 1))}>Prev</Button>
              <Button variant="outline" className="rounded-xl" onClick={() => setPabrikPage(p => p + 1)}>Next</Button>
            </div>
          </TabsContent>

          <TabsContent value="keuangan">
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full sm:w-[340px] justify-start text-left font-normal bg-white rounded-xl',
                      !(financeStartDate && financeEndDate) && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formatDateRangeLabel(financeStartDate, financeEndDate)}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[92vw] sm:w-auto p-4 bg-white" align="start">
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <div className="font-semibold leading-none">Rentang Waktu</div>
                      <div className="text-sm text-muted-foreground">Pilih rentang waktu cepat atau kustom</div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" size="sm" onClick={() => { applyQuickRange('today', setFinanceStartDate, setFinanceEndDate, setFinanceQuickRange) }} className={financeQuickRange === 'today' ? 'bg-accent' : ''}>Hari Ini</Button>
                      <Button variant="outline" size="sm" onClick={() => { applyQuickRange('yesterday', setFinanceStartDate, setFinanceEndDate, setFinanceQuickRange) }} className={financeQuickRange === 'yesterday' ? 'bg-accent' : ''}>Kemarin</Button>
                      <Button variant="outline" size="sm" onClick={() => { applyQuickRange('last_week', setFinanceStartDate, setFinanceEndDate, setFinanceQuickRange) }} className={financeQuickRange === 'last_week' ? 'bg-accent' : ''}>7 Hari</Button>
                      <Button variant="outline" size="sm" onClick={() => { applyQuickRange('last_30_days', setFinanceStartDate, setFinanceEndDate, setFinanceQuickRange) }} className={financeQuickRange === 'last_30_days' ? 'bg-accent' : ''}>30 Hari</Button>
                      <Button variant="outline" size="sm" onClick={() => { applyQuickRange('this_month', setFinanceStartDate, setFinanceEndDate, setFinanceQuickRange) }} className={financeQuickRange === 'this_month' ? 'bg-accent' : ''}>Bulan Ini</Button>
                    </div>
                    <div className="border-t pt-4 space-y-2">
                      <div className="font-semibold leading-none">Kustom</div>
                      <div className="grid gap-2">
                        <div className="grid grid-cols-3 items-center gap-4">
                          <Label className="text-xs">Dari</Label>
                          <Input
                            type="date"
                            className="col-span-2 h-8"
                            value={financeStartDate}
                            onChange={(e) => { setFinanceStartDate(e.target.value); setFinanceQuickRange('custom') }}
                          />
                        </div>
                        <div className="grid grid-cols-3 items-center gap-4">
                          <Label className="text-xs">Sampai</Label>
                          <Input
                            type="date"
                            className="col-span-2 h-8"
                            value={financeEndDate}
                            onChange={(e) => { setFinanceEndDate(e.target.value); setFinanceQuickRange('custom') }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button variant="outline" size="sm" onClick={() => { setFinanceStartDate(''); setFinanceEndDate(''); setFinanceQuickRange('') }}>Reset</Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              <Button variant="outline" className="rounded-xl h-10 w-full sm:w-auto" onClick={fetchFinance} disabled={financeLoading}>
                <ArrowPathIcon className={`h-4 w-4 mr-2 ${financeLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="destructive" className="rounded-xl h-10 w-full sm:w-auto" disabled={financeLoading || !financeData}>
                    <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => exportLabaRugiPdf(financeData)}>Laba Rugi (PDF)</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportNeracaPdf(financeData)}>Neraca (PDF)</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="outline"
                className="rounded-xl h-10 w-full sm:w-auto"
                onClick={handleSaveFinanceHistory}
                disabled={financeLoading || financeHistorySaving || !financeData}
              >
                <ClockIcon className={`h-4 w-4 mr-2 ${financeHistorySaving ? 'animate-spin' : ''}`} />
                Simpan History
              </Button>
              <Button variant="outline" className="rounded-xl h-10 w-full sm:w-auto" onClick={openTaxModal} disabled={financeLoading || taxSettingLoading}>
                <TagIcon className={`h-4 w-4 mr-2 ${taxSettingLoading ? 'animate-spin' : ''}`} />
                Pajak
              </Button>
            </div>

            <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b bg-gray-50 flex items-center gap-2">
                  <CurrencyDollarIcon className="h-4 w-4 text-emerald-600" />
                  <div className="text-xs font-black tracking-wider text-gray-700 uppercase">Laba Rugi</div>
                </div>
                <div className="p-4">
                  {financeLoading ? (
                    <Skeleton className="h-24 w-full" />
                  ) : !financeData ? (
                    <div className="text-sm text-gray-500">Belum ada data</div>
                  ) : (
                    <div className="rounded-2xl border border-gray-100 overflow-hidden">
                      <div className="px-4 py-3 bg-white">
                        <div className="text-[11px] font-black tracking-wider text-gray-900 uppercase text-center">Laporan Laba Rugi</div>
                        <div className="text-xs text-gray-500 text-center mt-1">{perusahaan?.name || '-'}</div>
                        <div className="text-[11px] text-gray-500 text-center mt-1">{formatDateRangeLabel(financeStartDate, financeEndDate)}</div>
                      </div>

                      {(() => {
                        const pendapatan = Number(financeData.labaRugi?.pendapatanTbs || 0)
                        const breakdownRaw = Array.isArray(financeData.labaRugi?.breakdownPengeluaran) ? financeData.labaRugi.breakdownPengeluaran : []
                        const breakdown = breakdownRaw
                          .map((x: any) => ({ kategori: String(x.kategori || 'UMUM'), total: Number(x.total || 0), source: String(x.source || '') }))
                          .filter((x: any) => Number.isFinite(x.total) && x.total !== 0)

                        const classify = (kategori: string) => {
                          const k = String(kategori || '').trim().toUpperCase()
                          if (!k) return 'ADMIN'

                          const isAdmin =
                            k === 'UMUM' ||
                            k === 'GAJI' ||
                            k.includes('GAJI') ||
                            k.includes('ADMIN') ||
                            k.includes('KEBUTUHAN KANTOR') ||
                            k.includes('KANTOR') ||
                            k.includes('LISTRIK') ||
                            k.includes('INTERNET') ||
                            k === 'AIR' ||
                            k.includes('AIR ') ||
                            k.includes('BBM') ||
                            k.includes('PERAWATAN') ||
                            k.includes('AKTIVA') ||
                            k.includes('PENYUSUTAN') ||
                            k.includes('PERJALANAN') ||
                            k.includes('DINAS') ||
                            k === 'KENDARAAN'

                          const isHpp =
                            k === 'KEBUN' ||
                            k.includes('HPP') ||
                            k.includes('HARGA POKOK') ||
                            k.includes('PRODUKSI') ||
                            k.includes('PANEN') ||
                            k.includes('PUPUK') ||
                            k.includes('BIBIT') ||
                            k.includes('PEMELIHARAAN') ||
                            k.includes('TBS') ||
                            k.includes('ANGKUT') ||
                            k.includes('BONGKAR')

                          if (isHpp && !isAdmin) return 'HPP'
                          if (isHpp && isAdmin) return 'ADMIN'
                          return isAdmin ? 'ADMIN' : 'ADMIN'
                        }

                        const hppItems = breakdown.filter((x: any) => classify(x.kategori) === 'HPP')
                        const adminItems = breakdown.filter((x: any) => classify(x.kategori) === 'ADMIN')

                        const hppTotal = hppItems.reduce((acc: number, x: any) => acc + x.total, 0)
                        const labaKotor = pendapatan - hppTotal
                        const adminTotal = adminItems.reduce((acc: number, x: any) => acc + x.total, 0)
                        const labaSebelumPph = labaKotor - adminTotal
                        const apiTax = financeData?.labaRugi?.tax
                        const labaSebelumPphDibulatkan = Number.isFinite(Number(financeData?.labaRugi?.labaSebelumPphDibulatkan))
                          ? Number(financeData?.labaRugi?.labaSebelumPphDibulatkan)
                          : Math.round(labaSebelumPph / 1000) * 1000
                        const pphTerutang = Number.isFinite(Number(financeData?.labaRugi?.pphTerutang))
                          ? Number(financeData?.labaRugi?.pphTerutang)
                          : (labaSebelumPphDibulatkan > 0 ? Math.round(labaSebelumPphDibulatkan * 0.22) : 0)
                        const labaSetelahPph = Number.isFinite(Number(financeData?.labaRugi?.labaSetelahPph))
                          ? Number(financeData?.labaRugi?.labaSetelahPph)
                          : (labaSebelumPphDibulatkan - pphTerutang)

                        const taxLabel = (() => {
                          const s = String(apiTax?.schemeApplied || '').toUpperCase()
                          if (s === 'UMKM_FINAL') return 'Final 0,5% Omzet'
                          if (s === 'PASAL_31E') return 'Pasal 31E'
                          if (s === 'STANDARD') return '22%'
                          return 'Pajak'
                        })()

                        const fmt = (n: number) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Math.round(Number(n || 0)))

                        const Row = ({ label, value, bold, negative }: { label: string; value: number; bold?: boolean; negative?: boolean }) => (
                          <div className={cn('grid grid-cols-[1fr_34px_150px] gap-2 text-xs items-center', bold ? 'font-black' : '')}>
                            <div className={cn('text-gray-900', bold ? '' : 'font-semibold')}>{label}</div>
                            <div className="text-gray-500">Rp.</div>
                            <div className={cn('text-right', negative ? 'text-rose-700 font-bold' : bold ? 'text-gray-900' : 'text-gray-900 font-semibold')}>
                              {negative ? `-${fmt(Math.abs(value))}` : fmt(value)}
                            </div>
                          </div>
                        )

                        return (
                          <div className="border-t border-gray-100 px-4 py-4 space-y-4">
                            <div className="space-y-2">
                              <Row label="PENJUALAN BERSIH" value={pendapatan} bold />
                              <Row label="HARGA POKOK PENJUALAN" value={hppTotal} bold negative />
                              <div className="border-t pt-2">
                                <Row label="LABA KOTOR" value={labaKotor} bold />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <div className="text-xs font-black tracking-wider text-gray-900 uppercase">Biaya Administrasi Umum</div>
                              {adminItems.length === 0 ? (
                                <div className="text-xs text-gray-500">Belum ada biaya</div>
                              ) : (
                                <div className="space-y-1">
                                  {adminItems.map((x: any, idx: number) => (
                                    <Row key={`${x.kategori}-${idx}`} label={`${idx + 1}. ${x.kategori}`} value={x.total} negative />
                                  ))}
                                  <div className="border-t pt-2">
                                    <Row label="JUMLAH" value={adminTotal} bold negative />
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="space-y-2">
                              <Row label="LABA SEBELUM PPH" value={labaSebelumPph} bold />
                              <Row label="LABA SEBELUM PPH DIBULATKAN" value={labaSebelumPphDibulatkan} bold />
                              <Row label={`PPH TERUTANG (${taxLabel})`} value={pphTerutang} negative />
                              <div className="border-t pt-2">
                                <Row label="LABA BERSIH SETELAH PPH" value={labaSetelahPph} bold />
                              </div>
                            </div>

                            {hppItems.length > 0 ? (
                              <div className="pt-3 border-t">
                                <div className="text-[10px] font-black tracking-wider uppercase text-gray-400 mb-2">Rincian HPP</div>
                                <div className="space-y-1">
                                  {hppItems.map((x: any, idx: number) => (
                                    <div key={`${x.kategori}-hpp-${idx}`} className="flex items-center justify-between text-xs">
                                      <span className="text-gray-600">
                                        {x.kategori}
                                        <span className="text-[10px] text-gray-400 ml-2">{x.source === 'MANUAL' ? '(Manual)' : '(Auto)'}</span>
                                      </span>
                                      <span className="font-semibold text-gray-900">{fmt(x.total || 0)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null}

                            <div className="pt-3 border-t">
                              <div className="text-[10px] font-black tracking-wider uppercase text-gray-400 mb-2">Ringkasan Sumber Biaya</div>
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-gray-600">Biaya Otomatis</span>
                                  <span className="font-semibold text-gray-900">{fmt(Number(financeData.labaRugi?.biayaAuto || 0))}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-gray-600">Biaya Manual</span>
                                  <span className="font-semibold text-gray-900">{fmt(Number(financeData.labaRugi?.biayaManual || 0))}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs font-black border-t pt-2">
                                  <span className="text-gray-700">Total Biaya</span>
                                  <span className="text-gray-900">{fmt(Number(financeData.labaRugi?.totalBiaya || 0))}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b bg-gray-50 flex items-center gap-2">
                  <ScaleIcon className="h-4 w-4 text-emerald-600" />
                  <div className="text-xs font-black tracking-wider text-gray-700 uppercase">Neraca</div>
                </div>
                <div className="p-4">
                  {financeLoading ? (
                    <Skeleton className="h-24 w-full" />
                  ) : !financeData ? (
                    <div className="text-sm text-gray-500">Belum ada data</div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <div className="text-[10px] font-black tracking-wider uppercase text-gray-400 mb-2">Aset</div>
                        <div className="space-y-2">
                          {(financeData.neraca?.aset || []).map((a: any) => (
                            <div key={a.akun} className="flex items-center justify-between text-xs">
                              <span className="text-gray-600">{a.akun}</span>
                              <span className="font-semibold text-gray-900">{formatCurrency(a.total || 0)}</span>
                            </div>
                          ))}
                          <div className="flex items-center justify-between text-xs font-black border-t pt-2">
                            <span className="text-gray-700">Total Aset</span>
                            <span className="text-gray-900">{formatCurrency(financeData.neraca?.totalAset || 0)}</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] font-black tracking-wider uppercase text-gray-400 mb-2">Kewajiban & Ekuitas</div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-600">Total Kewajiban</span>
                            <span className="font-semibold text-gray-900">{formatCurrency(financeData.neraca?.totalKewajiban || 0)}</span>
                          </div>
                          {(financeData.neraca?.ekuitas || []).map((e: any) => (
                            <div key={e.akun} className="flex items-center justify-between text-xs">
                              <span className="text-gray-600">{e.akun}</span>
                              <span className="font-semibold text-gray-900">{formatCurrency(e.total || 0)}</span>
                            </div>
                          ))}
                          <div className="flex items-center justify-between text-xs font-black border-t pt-2">
                            <span className="text-gray-700">Total Ekuitas</span>
                            <span className="text-gray-900">{formatCurrency(financeData.neraca?.totalEkuitas || 0)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="mt-3 text-[11px] text-gray-500">
                    Neraca ini bersifat ringkas (Kas + Piutang Nota Belum Lunas).
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BanknotesIcon className="h-4 w-4 text-emerald-600" />
                  <div className="text-xs font-black tracking-wider text-gray-700 uppercase">Input Biaya Manual</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setKategoriOpen(true)}
                    className="h-8 w-8 rounded-full border border-gray-200 bg-white text-gray-700 flex items-center justify-center hover:bg-gray-50"
                    aria-label="Kelola kategori"
                    title="Kelola kategori"
                  >
                    <TagIcon className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setBiayaFormOpen(v => !v)}
                    className="h-8 w-8 rounded-full border border-gray-200 bg-white text-gray-700 flex items-center justify-center hover:bg-gray-50"
                    aria-label="Toggle"
                  >
                    <ChevronDownIcon className={cn('h-4 w-4 transition-transform', biayaFormOpen ? 'rotate-180' : 'rotate-0')} />
                  </button>
                </div>
              </div>
              <div className={cn('overflow-hidden transition-all duration-300 ease-in-out', biayaFormOpen ? 'max-h-[1200px] opacity-100' : 'max-h-0 opacity-0')}>
                <div className="p-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <div className="text-[10px] font-black tracking-wider uppercase text-gray-400">Tanggal</div>
                    <Input type="date" className="mt-1 h-10 rounded-xl" value={biayaDate} onChange={(e) => setBiayaDate(e.target.value)} />
                  </div>
                  <div>
                    <div className="text-[10px] font-black tracking-wider uppercase text-gray-400">Kategori</div>
                    <Popover open={openBiayaKategoriCombo} onOpenChange={(v) => { setOpenBiayaKategoriCombo(v); if (!v) setBiayaKategoriQuery('') }}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="mt-1 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-left text-sm flex items-center justify-between"
                          aria-haspopup="listbox"
                        >
                          <span className="truncate">{biayaKategori || 'Pilih kategori'}</span>
                          <ChevronDownIcon className="h-4 w-4 text-gray-500" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-2 bg-white">
                        <Input
                          autoFocus
                          placeholder="Cari / tulis kategori…"
                          value={biayaKategoriQuery}
                          onChange={(e) => setBiayaKategoriQuery(e.target.value)}
                          className="mb-2 h-9 rounded-lg"
                        />
                        <div role="listbox" className="max-h-56 overflow-y-auto space-y-1">
                          {(() => {
                            const q = biayaKategoriQuery.trim().toLowerCase()
                            const filtered = biayaCategories.filter((c) => c.toLowerCase().includes(q))
                            const hasExact = q ? biayaCategories.some((c) => c.toLowerCase() === q) : false
                            return (
                              <>
                                {q && !hasExact ? (
                                  <button
                                    type="button"
                                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 text-sm"
                                    onClick={() => {
                                      setBiayaKategori(biayaKategoriQuery.trim())
                                      setOpenBiayaKategoriCombo(false)
                                    }}
                                  >
                                    Gunakan: <span className="font-semibold">{biayaKategoriQuery.trim()}</span>
                                  </button>
                                ) : null}
                                {(filtered.length ? filtered : biayaCategories).map((c) => (
                                  <button
                                    key={c}
                                    type="button"
                                    onClick={() => { setBiayaKategori(c); setOpenBiayaKategoriCombo(false) }}
                                    className={cn(
                                      'w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 text-sm',
                                      String(biayaKategori || '').trim().toLowerCase() === c.toLowerCase() ? 'bg-emerald-50 text-emerald-700' : ''
                                    )}
                                  >
                                    {c}
                                  </button>
                                ))}
                                {biayaCategories.length === 0 ? (
                                  <div className="px-3 py-2 text-sm text-gray-500">Belum ada kategori.</div>
                                ) : null}
                              </>
                            )
                          })()}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="sm:col-span-2">
                    <div className="text-[10px] font-black tracking-wider uppercase text-gray-400">Deskripsi</div>
                    <Input className="mt-1 h-10 rounded-xl" value={biayaDeskripsi} onChange={(e) => setBiayaDeskripsi(e.target.value)} placeholder="Opsional" />
                  </div>
                  <div>
                    <div className="text-[10px] font-black tracking-wider uppercase text-gray-400">Jumlah (Rp)</div>
                    <Input
                      className="mt-1 h-10 rounded-xl"
                      value={biayaJumlah}
                      onChange={(e) => setBiayaJumlah(formatRupiahInput(e.target.value))}
                      placeholder="Contoh: Rp 250.000"
                      inputMode="numeric"
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <div className="text-[10px] font-black tracking-wider uppercase text-gray-400">Bukti (Foto)</div>
                    <div className="mt-2">
                      <ImageUpload
                        previewUrl={biayaPreviewUrl}
                        onFileChange={(file) => {
                          setBiayaFile(file)
                          if (biayaPreviewUrlRef.current) URL.revokeObjectURL(biayaPreviewUrlRef.current)
                          if (!file) {
                            biayaPreviewUrlRef.current = null
                            setBiayaPreviewUrl(null)
                            return
                          }
                          const url = URL.createObjectURL(file)
                          biayaPreviewUrlRef.current = url
                          setBiayaPreviewUrl(url)
                        }}
                      />
                    </div>
                  </div>
                  <div className="sm:col-span-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <Button
                      className="rounded-xl h-10 bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto"
                      onClick={handleAddBiaya}
                      disabled={biayaLoading || financeLoading}
                    >
                      <CheckIcon className="h-4 w-4 mr-2" />
                      Simpan
                    </Button>
                    <div className="text-xs text-gray-500">
                      Untuk HPP, gunakan kategori “Harga Pokok Penjualan (HPP)”.
                    </div>
                  </div>
                </div>
                </div>
              </div>
              <div className="px-4 py-3 border-t bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClipboardDocumentListIcon className="h-4 w-4 text-emerald-600" />
                  <div className="text-xs font-black tracking-wider text-gray-700 uppercase">Daftar Biaya</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-xs text-gray-500">{biayaMeta?.totalItems ?? biayaList.length} item</div>
                  <button
                    type="button"
                    onClick={() => setKategoriOpen(true)}
                    className="h-8 w-8 rounded-full border border-gray-200 bg-white text-gray-700 flex items-center justify-center hover:bg-gray-50"
                    aria-label="Kelola kategori"
                    title="Kelola kategori"
                  >
                    <TagIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="p-4">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px] uppercase">Tanggal</TableHead>
                        <TableHead className="text-[10px] uppercase">Kategori</TableHead>
                        <TableHead className="text-[10px] uppercase">Deskripsi</TableHead>
                        <TableHead className="text-[10px] uppercase">Bukti</TableHead>
                        <TableHead className="text-right text-[10px] uppercase">Jumlah</TableHead>
                        <TableHead className="text-right text-[10px] uppercase">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {biayaLoading ? (
                        <TableRow>
                          <TableCell colSpan={6} className="py-8"><Skeleton className="h-6 w-full" /></TableCell>
                        </TableRow>
                      ) : biayaList.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-xs text-gray-500 py-8">Belum ada biaya</TableCell>
                        </TableRow>
                      ) : (
                        biayaList.map((b) => (
                          <TableRow key={`${b.source}-${b.id}`}>
                            <TableCell className="text-xs">{new Date(b.date).toLocaleDateString('id-ID')}</TableCell>
                            <TableCell className="text-xs font-semibold">{b.kategori}</TableCell>
                            <TableCell className="text-xs">{b.deskripsi || '-'}</TableCell>
                            <TableCell className="text-xs">
                              {b.gambarUrl ? (
                                <button
                                  type="button"
                                  onClick={() => openBukti(b.gambarUrl as string)}
                                    className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-900 font-semibold"
                                >
                                  <EyeIcon className="h-4 w-4" />
                                  Lihat
                                </button>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right text-xs font-semibold">{formatCurrency(b.jumlah)}</TableCell>
                            <TableCell className="text-right">
                              <div className="inline-flex items-center justify-end gap-1">
                                {(b.source === 'MANUAL' || b.source === 'KASIR') ? (
                                  <button
                                    type="button"
                                    onClick={() => { setEditBiaya(b); setEditKategori(String(b.kategori || '')); setEditBiayaOpen(true) }}
                                    className="h-8 w-8 rounded-full border border-gray-200 bg-white text-gray-700 inline-flex items-center justify-center hover:bg-gray-50"
                                    aria-label="Edit"
                                  >
                                    <PencilSquareIcon className="h-4 w-4" />
                                  </button>
                                ) : null}
                                {b.source === 'MANUAL' ? (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteBiaya(b)}
                                    className="h-8 w-8 rounded-full border border-red-200 bg-red-50 text-red-600 inline-flex items-center justify-center hover:bg-red-100"
                                    aria-label="Hapus"
                                  >
                                    <TrashIcon className="h-4 w-4" />
                                  </button>
                                ) : null}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell colSpan={4} className="text-right text-xs font-semibold text-gray-600">Total</TableCell>
                        <TableCell className="text-right text-xs font-black text-gray-900">{formatCurrency(biayaMeta?.totalJumlah || 0)}</TableCell>
                        <TableCell />
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>
                <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="text-xs text-gray-500">
                    Halaman {biayaMeta?.page || biayaPage} dari {biayaMeta?.totalPages || 1}
                  </div>
                  <div className="flex items-center gap-2 justify-end">
                    <Button
                      variant="outline"
                      className="rounded-xl h-9"
                      disabled={biayaLoading || (biayaMeta?.page ? biayaMeta.page <= 1 : biayaPage <= 1)}
                      onClick={() => setBiayaPage(p => Math.max(1, p - 1))}
                    >
                      Prev
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-xl h-9"
                      disabled={biayaLoading || (biayaMeta?.page ? biayaMeta.page >= biayaMeta.totalPages : true)}
                      onClick={() => setBiayaPage(p => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClockIcon className="h-4 w-4 text-gray-600" />
                  <div className="text-xs font-black tracking-wider text-gray-700 uppercase">History Laba Rugi & Neraca</div>
                </div>
                <Button variant="outline" className="rounded-xl h-9" onClick={fetchFinanceHistory} disabled={financeHistoryLoading}>
                  <ArrowPathIcon className={`h-4 w-4 mr-2 ${financeHistoryLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
              <div className="p-4">
                {financeHistoryLoading ? (
                  <Skeleton className="h-20 w-full" />
                ) : financeHistory.length === 0 ? (
                  <div className="text-sm text-gray-500">Belum ada history. Klik “Simpan History” untuk menyimpan laporan.</div>
                ) : (
                  <>
                    <div className="space-y-3 sm:hidden">
                      {financeHistory.map((h: any) => {
                        const d = h.data || {}
                        const lr = d.labaRugi || {}
                        const start = h.startDate ? new Date(h.startDate) : null
                        const end = h.endDate ? new Date(h.endDate) : null
                        const period = start && end
                          ? `${format(start, 'dd MMM yyyy', { locale: idLocale })} - ${format(end, 'dd MMM yyyy', { locale: idLocale })}`
                          : '-'
                        const createdAtText = h.createdAt ? format(new Date(h.createdAt), 'dd MMM yyyy HH:mm', { locale: idLocale }) : '-'
                        return (
                          <div key={h.id} className="rounded-2xl border border-gray-100 bg-white p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="font-bold text-gray-900 truncate">{period}</div>
                                <div className="text-xs text-gray-500 mt-1">{createdAtText}</div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="text-[11px] text-gray-500">Omzet</div>
                                <div className="text-xs font-semibold text-gray-900">{formatCurrency(lr.pendapatanTbs || 0)}</div>
                                <div className="text-[11px] text-gray-500 mt-2">Laba</div>
                                <div className="text-xs font-semibold text-gray-900">{formatCurrency(lr.labaSetelahPph || 0)}</div>
                              </div>
                            </div>
                            <div className="mt-3 flex items-center justify-end gap-2">
                              <Button size="sm" variant="outline" className="rounded-full" onClick={() => exportLabaRugiPdf(d)}>
                                PDF Laba Rugi
                              </Button>
                              <Button size="sm" variant="outline" className="rounded-full" onClick={() => exportNeracaPdf(d)}>
                                PDF Neraca
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    <div className="hidden sm:block overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="text-xs text-gray-500 uppercase border-b">
                          <tr>
                            <th className="text-left py-2 pr-3">Waktu</th>
                            <th className="text-left py-2 pr-3">Periode</th>
                            <th className="text-right py-2 pr-3">Omzet</th>
                            <th className="text-right py-2 pr-3">Laba Setelah PPH</th>
                            <th className="text-right py-2">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {financeHistory.map((h: any) => {
                            const d = h.data || {}
                            const lr = d.labaRugi || {}
                            const start = h.startDate ? new Date(h.startDate) : null
                            const end = h.endDate ? new Date(h.endDate) : null
                            const period = start && end
                              ? `${format(start, 'dd MMM yyyy', { locale: idLocale })} - ${format(end, 'dd MMM yyyy', { locale: idLocale })}`
                              : '-'
                            return (
                              <tr key={h.id}>
                                <td className="py-2 pr-3 text-gray-700">
                                  {h.createdAt ? format(new Date(h.createdAt), 'dd MMM yyyy HH:mm', { locale: idLocale }) : '-'}
                                </td>
                                <td className="py-2 pr-3 text-gray-700">{period}</td>
                                <td className="py-2 pr-3 text-right font-semibold">{formatCurrency(lr.pendapatanTbs || 0)}</td>
                                <td className="py-2 pr-3 text-right font-semibold">{formatCurrency(lr.labaSetelahPph || 0)}</td>
                                <td className="py-2 text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button size="sm" variant="outline" className="rounded-full" onClick={() => exportLabaRugiPdf(d)}>
                                      PDF Laba Rugi
                                    </Button>
                                    <Button size="sm" variant="outline" className="rounded-full" onClick={() => exportNeracaPdf(d)}>
                                      PDF Neraca
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="harta">
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-sm font-bold text-gray-900">Daftar Harta & Penyusutan (Pajak)</div>
              <div className="flex flex-wrap items-center gap-2 justify-end">
                <Button
                  variant="outline"
                  className="rounded-xl h-10 px-3"
                  onClick={exportAssetCsv}
                  disabled={assetLoading || assetList.length === 0}
                >
                  <ArrowDownTrayIcon className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">CSV</span>
                </Button>
                <Button
                  variant="outline"
                  className="rounded-xl h-10 px-3"
                  onClick={exportAssetPdf}
                  disabled={assetLoading || assetList.length === 0}
                >
                  <ArrowDownTrayIcon className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">PDF</span>
                </Button>
                <Button variant="outline" className="rounded-xl h-10 px-3" onClick={fetchAssets} disabled={assetLoading}>
                  <ArrowPathIcon className={`h-4 w-4 ${assetLoading ? 'animate-spin' : ''}`} />
                </Button>
                <Button className="rounded-xl h-10 bg-emerald-600 hover:bg-emerald-700" onClick={openCreateAsset}>
                  Tambah Harta
                </Button>
              </div>
            </div>

            {(() => {
              const asOf = new Date()
              const periodStart = new Date(asOf.getFullYear(), 0, 1)
              const prevAsOf = new Date(asOf.getFullYear() - 1, 11, 31)
              let totalCost = 0
              let totalAcc = 0
              let totalBook = 0
              let totalExp = 0
              let totalPrevBook = 0
              for (const a of assetList) {
                const disposedAt = a.disposedAt ? new Date(a.disposedAt) : null
                const dep = computeStraightLineDepreciation({
                  cost: Number(a.cost || 0),
                  salvage: Number(a.salvage || 0),
                  acquiredAt: new Date(a.acquiredAt),
                  group: String(a.group || ''),
                  periodStart,
                  periodEnd: asOf,
                  disposedAt,
                })
                totalExp += dep.expenseInPeriod
                const activeAsOf = !disposedAt || disposedAt > asOf
                if (activeAsOf) {
                  totalCost += Number(a.cost || 0)
                  totalAcc += dep.accumulated
                  totalBook += dep.bookValue
                }

                const acquired = new Date(a.acquiredAt)
                if (acquired <= prevAsOf && (!disposedAt || disposedAt > prevAsOf)) {
                  const prev = computeStraightLineDepreciation({
                    cost: Number(a.cost || 0),
                    salvage: Number(a.salvage || 0),
                    acquiredAt: acquired,
                    group: String(a.group || ''),
                    periodStart: new Date(prevAsOf.getFullYear(), 0, 1),
                    periodEnd: prevAsOf,
                    disposedAt,
                  })
                  totalPrevBook += prev.bookValue
                }
              }

              return (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-5 gap-3">
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                    <div className="text-[10px] font-black tracking-wider uppercase text-gray-400">Harga Perolehan</div>
                    <div className="text-lg font-extrabold text-gray-900 mt-1">{formatCurrency(totalCost)}</div>
                  </div>
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                    <div className="text-[10px] font-black tracking-wider uppercase text-gray-400">Akumulasi Penyusutan</div>
                    <div className="text-lg font-extrabold text-gray-900 mt-1">{formatCurrency(totalAcc)}</div>
                  </div>
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                    <div className="text-[10px] font-black tracking-wider uppercase text-gray-400">Nilai Buku</div>
                    <div className="text-lg font-extrabold text-gray-900 mt-1">{formatCurrency(totalBook)}</div>
                  </div>
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                    <div className="text-[10px] font-black tracking-wider uppercase text-gray-400">Nilai Buku Tahun Lalu</div>
                    <div className="text-lg font-extrabold text-gray-900 mt-1">{formatCurrency(totalPrevBook)}</div>
                  </div>
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                    <div className="text-[10px] font-black tracking-wider uppercase text-gray-400">Penyusutan Tahun Berjalan</div>
                    <div className="text-lg font-extrabold text-gray-900 mt-1">{formatCurrency(totalExp)}</div>
                  </div>
                </div>
              )
            })()}

            <div className="mt-4 space-y-3 sm:hidden">
              {assetLoading ? (
                <div className="rounded-2xl border border-gray-100 bg-white p-4">
                  <Skeleton className="h-6 w-full" />
                </div>
              ) : assetList.length === 0 ? (
                <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center text-sm text-gray-500">
                  Belum ada harta
                </div>
              ) : (
                assetList.map((a) => {
                  const asOf = new Date()
                  const prevAsOf = new Date(asOf.getFullYear() - 1, 11, 31)
                  const disposedAt = a.disposedAt ? new Date(a.disposedAt) : null
                  const dep = computeStraightLineDepreciation({
                    cost: Number(a.cost || 0),
                    salvage: Number(a.salvage || 0),
                    acquiredAt: new Date(a.acquiredAt),
                    group: String(a.group || ''),
                    periodStart: new Date(asOf.getFullYear(), 0, 1),
                    periodEnd: asOf,
                    disposedAt,
                  })
                  const acquired = new Date(a.acquiredAt)
                  const prevBookValue = acquired <= prevAsOf && (!disposedAt || disposedAt > prevAsOf)
                    ? computeStraightLineDepreciation({
                        cost: Number(a.cost || 0),
                        salvage: Number(a.salvage || 0),
                        acquiredAt: acquired,
                        group: String(a.group || ''),
                        periodStart: new Date(prevAsOf.getFullYear(), 0, 1),
                        periodEnd: prevAsOf,
                        disposedAt,
                      }).bookValue
                    : 0
                  const groupLabel = ASSET_GROUPS.find(g => g.value === a.group)?.label || a.group

                  return (
                    <div key={a.id} className="rounded-2xl border border-gray-100 bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="font-bold text-gray-900 truncate">{a.name}</div>
                            <span
                              className={cn(
                                'shrink-0 text-[10px] font-semibold px-2 py-1 rounded-full border',
                                disposedAt
                                  ? (String(a.disposalType || 'SOLD') === 'SCRAPPED'
                                      ? 'border-gray-200 bg-gray-50 text-gray-700'
                                      : 'border-emerald-200 bg-white text-emerald-700')
                                  : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              )}
                            >
                              {disposedAt
                                ? (String(a.disposalType || 'SOLD') === 'SCRAPPED' ? 'Dihentikan' : 'Dijual')
                                : 'Aktif'}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1 truncate">{groupLabel}</div>
                          {disposedAt ? (
                            <div className="text-[11px] text-gray-500 mt-1">
                              {disposedAt.toLocaleDateString('id-ID')}
                            </div>
                          ) : null}
                        </div>
                        <div className="shrink-0 flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openAssetDisposal(a)}
                            className="h-9 w-9 rounded-full border border-gray-200 bg-white text-gray-700 inline-flex items-center justify-center"
                            aria-label="Penghentian/Penjualan"
                          >
                            <BanknotesIcon className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openAssetDetail(a)}
                            className="h-9 w-9 rounded-full border border-gray-200 bg-white text-gray-700 inline-flex items-center justify-center"
                            aria-label="Detail penyusutan"
                          >
                            <EyeIcon className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditAsset(a)}
                            className="h-9 w-9 rounded-full border border-gray-200 bg-white text-gray-700 inline-flex items-center justify-center"
                            aria-label="Edit"
                          >
                            <PencilSquareIcon className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => confirmDeleteAsset(a)}
                            className="h-9 w-9 rounded-full border border-red-200 bg-red-50 text-red-600 inline-flex items-center justify-center"
                            aria-label="Hapus"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                          <div className="text-[10px] font-black tracking-wider uppercase text-gray-400">Perolehan</div>
                          <div className="text-xs font-semibold text-gray-900 mt-1">{a.acquiredAt ? new Date(a.acquiredAt).toLocaleDateString('id-ID') : '-'}</div>
                        </div>
                        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                          <div className="text-[10px] font-black tracking-wider uppercase text-gray-400">Harga</div>
                          <div className="text-xs font-semibold text-gray-900 mt-1">{formatCurrency(Number(a.cost || 0))}</div>
                        </div>
                        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                          <div className="text-[10px] font-black tracking-wider uppercase text-gray-400">Susut Th Berjalan</div>
                          <div className="text-xs font-semibold text-gray-900 mt-1">{formatCurrency(dep.expenseInPeriod)}</div>
                        </div>
                        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                          <div className="text-[10px] font-black tracking-wider uppercase text-gray-400">Akumulasi</div>
                          <div className="text-xs font-semibold text-gray-900 mt-1">{formatCurrency(dep.accumulated)}</div>
                        </div>
                        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                          <div className="text-[10px] font-black tracking-wider uppercase text-gray-400">Nilai Buku</div>
                          <div className="text-xs font-semibold text-gray-900 mt-1">{formatCurrency(dep.bookValue)}</div>
                        </div>
                        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                          <div className="text-[10px] font-black tracking-wider uppercase text-gray-400">Nilai Buku Th Lalu</div>
                          <div className="text-xs font-semibold text-gray-900 mt-1">{formatCurrency(prevBookValue)}</div>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <div className="hidden sm:block mt-4 rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px] uppercase">Nama</TableHead>
                      <TableHead className="text-[10px] uppercase">Kelompok</TableHead>
                      <TableHead className="text-[10px] uppercase">Perolehan</TableHead>
                      <TableHead className="text-right text-[10px] uppercase">Harga</TableHead>
                      <TableHead className="text-right text-[10px] uppercase">Nilai Buku Th Lalu</TableHead>
                      <TableHead className="text-right text-[10px] uppercase">Susut (Th Berjalan)</TableHead>
                      <TableHead className="text-right text-[10px] uppercase">Akumulasi</TableHead>
                      <TableHead className="text-right text-[10px] uppercase">Nilai Buku</TableHead>
                      <TableHead className="text-right text-[10px] uppercase">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assetLoading ? (
                      <TableRow>
                        <TableCell colSpan={9} className="py-8"><Skeleton className="h-6 w-full" /></TableCell>
                      </TableRow>
                    ) : assetList.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-xs text-gray-500 py-8">Belum ada harta</TableCell>
                      </TableRow>
                    ) : (
                      assetList.map((a) => {
                        const asOf = new Date()
                        const prevAsOf = new Date(asOf.getFullYear() - 1, 11, 31)
                        const disposedAt = a.disposedAt ? new Date(a.disposedAt) : null
                        const dep = computeStraightLineDepreciation({
                          cost: Number(a.cost || 0),
                          salvage: Number(a.salvage || 0),
                          acquiredAt: new Date(a.acquiredAt),
                          group: String(a.group || ''),
                          periodStart: new Date(asOf.getFullYear(), 0, 1),
                          periodEnd: asOf,
                          disposedAt,
                        })
                        const acquired = new Date(a.acquiredAt)
                        const prevBookValue = acquired <= prevAsOf && (!disposedAt || disposedAt > prevAsOf)
                          ? computeStraightLineDepreciation({
                              cost: Number(a.cost || 0),
                              salvage: Number(a.salvage || 0),
                              acquiredAt: acquired,
                              group: String(a.group || ''),
                              periodStart: new Date(prevAsOf.getFullYear(), 0, 1),
                              periodEnd: prevAsOf,
                              disposedAt,
                            }).bookValue
                          : 0
                        const groupLabel = ASSET_GROUPS.find(g => g.value === a.group)?.label || a.group
                        return (
                          <TableRow key={a.id}>
                            <TableCell className="text-xs font-semibold">
                              <div className="flex items-center gap-2">
                                <span className="min-w-0 truncate">{a.name}</span>
                                <span
                                  className={cn(
                                    'shrink-0 text-[10px] font-semibold px-2 py-1 rounded-full border',
                                    disposedAt
                                      ? (String(a.disposalType || 'SOLD') === 'SCRAPPED'
                                          ? 'border-gray-200 bg-gray-50 text-gray-700'
                                          : 'border-emerald-200 bg-white text-emerald-700')
                                      : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                  )}
                                >
                                  {disposedAt
                                    ? (String(a.disposalType || 'SOLD') === 'SCRAPPED' ? 'Dihentikan' : 'Dijual')
                                    : 'Aktif'}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs">{groupLabel}</TableCell>
                            <TableCell className="text-xs">{a.acquiredAt ? new Date(a.acquiredAt).toLocaleDateString('id-ID') : '-'}</TableCell>
                            <TableCell className="text-right text-xs font-semibold">{formatCurrency(Number(a.cost || 0))}</TableCell>
                            <TableCell className="text-right text-xs font-semibold">{formatCurrency(prevBookValue)}</TableCell>
                            <TableCell className="text-right text-xs font-semibold">{formatCurrency(dep.expenseInPeriod)}</TableCell>
                            <TableCell className="text-right text-xs font-semibold">{formatCurrency(dep.accumulated)}</TableCell>
                            <TableCell className="text-right text-xs font-semibold">{formatCurrency(dep.bookValue)}</TableCell>
                            <TableCell className="text-right">
                              <div className="inline-flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => openAssetDisposal(a)}
                                  className="h-8 w-8 rounded-full border border-gray-200 bg-white text-gray-700 inline-flex items-center justify-center hover:bg-gray-50"
                                  aria-label="Penghentian/Penjualan"
                                >
                                  <BanknotesIcon className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openAssetDetail(a)}
                                  className="h-8 w-8 rounded-full border border-gray-200 bg-white text-gray-700 inline-flex items-center justify-center hover:bg-gray-50"
                                  aria-label="Detail penyusutan"
                                >
                                  <EyeIcon className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openEditAsset(a)}
                                  className="h-8 w-8 rounded-full border border-gray-200 bg-white text-gray-700 inline-flex items-center justify-center hover:bg-gray-50"
                                  aria-label="Edit"
                                >
                                  <PencilSquareIcon className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => confirmDeleteAsset(a)}
                                  className="h-8 w-8 rounded-full border border-red-200 bg-red-50 text-red-600 inline-flex items-center justify-center hover:bg-red-100"
                                  aria-label="Hapus"
                                >
                                  <TrashIcon className="h-4 w-4" />
                                </button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

          </TabsContent>

          <TabsContent value="ppn">
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Label className="text-xs text-gray-600">Tahun</Label>
                <select
                  className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm focus:outline-none"
                  value={String(ppnYear)}
                  onChange={(e) => setPpnYear(Number(e.target.value))}
                >
                  {Array.from({ length: 8 }).map((_, idx) => {
                    const y = new Date().getFullYear() - idx
                    return <option key={y} value={y}>{y}</option>
                  })}
                </select>
              </div>
              <Button variant="outline" className="rounded-xl h-10 w-full sm:w-auto" onClick={fetchPpn} disabled={ppnLoading}>
                <ArrowPathIcon className={`h-4 w-4 mr-2 ${ppnLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button variant="outline" className="rounded-xl h-10 w-full sm:w-auto" onClick={openPpnSettingModal} disabled={ppnLoading || ppnSettingLoading}>
                <TagIcon className={`h-4 w-4 mr-2 ${ppnSettingLoading ? 'animate-spin' : ''}`} />
                Tarif PPN
              </Button>
            </div>

            <div className="mt-4 rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50 flex items-center gap-2">
                <DocumentTextIcon className="h-4 w-4 text-emerald-600" />
                <div className="text-xs font-black tracking-wider text-gray-700 uppercase">PPN Bulanan</div>
              </div>
              <div className="p-4">
                {ppnLoading ? (
                  <Skeleton className="h-20 w-full" />
                ) : ppnRows.length === 0 ? (
                  <div className="text-sm text-gray-500">Belum ada data</div>
                ) : (
                  <>
                    <div className="space-y-3 sm:hidden">
                      {ppnRows.map((r: any) => {
                        const month = Number(r.month)
                        const keySave = `${ppnYear}-${month}-save`
                        const keyUpload = `${ppnYear}-${month}-upload`
                        const keySubmit = `${ppnYear}-${month}-submit`
                        const saving = ppnSavingKey === keySave || ppnSavingKey === keyUpload || ppnSavingKey === keySubmit
                        const submitted = String(r.status || 'DRAFT') === 'SUBMITTED'
                        return (
                          <div key={`${ppnYear}-${month}`} className="rounded-2xl border border-gray-100 bg-white p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="font-bold text-gray-900 truncate">{r.label}</div>
                                <div className="mt-2 inline-flex items-center gap-2">
                                  <span className={cn('text-xs font-semibold px-2 py-1 rounded-full border', submitted ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-gray-50 text-gray-700')}>
                                    {submitted ? 'Dilaporkan' : 'Draft'}
                                  </span>
                                  <Button size="sm" variant="outline" className="rounded-full" onClick={() => markPpnSubmitted(month)} disabled={saving}>
                                    Tandai Lapor
                                  </Button>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="text-[11px] text-gray-500">PPN Terutang</div>
                                <div className="text-xs font-black text-gray-900">{formatCurrency(r.ppnTerutang || 0)}</div>
                              </div>
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-2">
                              <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                                <div className="text-[10px] font-black tracking-wider uppercase text-gray-400">DPP</div>
                                <div className="text-xs font-semibold text-gray-900 mt-1">{formatCurrency(r.dpp || 0)}</div>
                              </div>
                              <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                                <div className="text-[10px] font-black tracking-wider uppercase text-gray-400">PPN Keluaran</div>
                                <div className="text-xs font-semibold text-gray-900 mt-1">{formatCurrency(r.ppnKeluaran || 0)}</div>
                              </div>
                            </div>

                            <div className="mt-3">
                              <div className="text-[10px] font-black tracking-wider uppercase text-gray-400">PPN Masukan</div>
                              <div className="mt-2 flex items-center gap-2">
                                <Input
                                  className="h-10 rounded-xl flex-1"
                                  value={String(r.ppnMasukanInput || '')}
                                  onChange={(e) => {
                                    const v = formatRupiahInput(e.target.value)
                                    setPpnRows(prev => prev.map((x: any) => Number(x.month) === month ? { ...x, ppnMasukanInput: v } : x))
                                  }}
                                  inputMode="numeric"
                                  placeholder="Rp 0"
                                />
                                <Button size="sm" className="rounded-full" onClick={() => savePpnRow(month)} disabled={saving}>
                                  Simpan
                                </Button>
                              </div>
                            </div>

                            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between gap-2">
                              <div className="text-xs text-gray-600 font-semibold">SPT PPN</div>
                              <div className="flex items-center gap-2">
                                {r.sptFileUrl ? (
                                  <Button size="sm" variant="outline" className="rounded-full" onClick={() => window.open(String(r.sptFileUrl), '_blank')}>
                                    <EyeIcon className="h-4 w-4 mr-2" />
                                    Lihat
                                  </Button>
                                ) : (
                                  <span className="text-xs text-gray-400">Belum ada</span>
                                )}
                                <label className={cn('inline-flex items-center justify-center rounded-full border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer', saving ? 'opacity-50 pointer-events-none' : '')}>
                                  <ArrowUpTrayIcon className="h-4 w-4 mr-2" />
                                  Upload PDF
                                  <input
                                    type="file"
                                    accept="application/pdf"
                                    className="sr-only"
                                    onChange={async (e) => {
                                      const file = e.target.files?.[0]
                                      if (!file) return
                                      await uploadPpnSpt(month, file)
                                      e.target.value = ''
                                    }}
                                  />
                                </label>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    <div className="hidden sm:block overflow-x-auto">
                      <table className="min-w-[980px] w-full text-sm">
                        <thead className="text-xs text-gray-500 uppercase border-b">
                          <tr>
                            <th className="text-left py-2 pr-3">Periode</th>
                            <th className="text-right py-2 pr-3">DPP</th>
                            <th className="text-right py-2 pr-3">PPN Keluaran</th>
                            <th className="text-left py-2 pr-3">PPN Masukan</th>
                            <th className="text-right py-2 pr-3">PPN Terutang</th>
                            <th className="text-left py-2 pr-3">Status</th>
                            <th className="text-left py-2">SPT PPN</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {ppnRows.map((r: any) => {
                            const month = Number(r.month)
                            const keySave = `${ppnYear}-${month}-save`
                            const keyUpload = `${ppnYear}-${month}-upload`
                            const keySubmit = `${ppnYear}-${month}-submit`
                            const saving = ppnSavingKey === keySave || ppnSavingKey === keyUpload || ppnSavingKey === keySubmit
                            return (
                              <tr key={`${ppnYear}-${month}`}>
                                <td className="py-2 pr-3 font-semibold text-gray-900">{r.label}</td>
                                <td className="py-2 pr-3 text-right font-semibold">{formatCurrency(r.dpp || 0)}</td>
                                <td className="py-2 pr-3 text-right font-semibold">{formatCurrency(r.ppnKeluaran || 0)}</td>
                                <td className="py-2 pr-3">
                                  <div className="flex items-center gap-2">
                                    <Input
                                      className="h-9 rounded-xl w-44"
                                      value={String(r.ppnMasukanInput || '')}
                                      onChange={(e) => {
                                        const v = formatRupiahInput(e.target.value)
                                        setPpnRows(prev => prev.map((x: any) => Number(x.month) === month ? { ...x, ppnMasukanInput: v } : x))
                                      }}
                                      inputMode="numeric"
                                      placeholder="Rp 0"
                                    />
                                    <Button size="sm" className="rounded-full" onClick={() => savePpnRow(month)} disabled={saving}>
                                      Simpan
                                    </Button>
                                  </div>
                                </td>
                                <td className="py-2 pr-3 text-right font-black text-gray-900">{formatCurrency(r.ppnTerutang || 0)}</td>
                                <td className="py-2 pr-3">
                                  <div className="inline-flex items-center gap-2">
                                    <span className={cn('text-xs font-semibold px-2 py-1 rounded-full border', String(r.status || 'DRAFT') === 'SUBMITTED' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-gray-50 text-gray-700')}>
                                      {String(r.status || 'DRAFT') === 'SUBMITTED' ? 'Dilaporkan' : 'Draft'}
                                    </span>
                                    <Button size="sm" variant="outline" className="rounded-full" onClick={() => markPpnSubmitted(month)} disabled={saving}>
                                      Tandai Lapor
                                    </Button>
                                  </div>
                                </td>
                                <td className="py-2">
                                  <div className="flex items-center gap-2">
                                    {r.sptFileUrl ? (
                                      <Button size="sm" variant="outline" className="rounded-full" onClick={() => window.open(String(r.sptFileUrl), '_blank')}>
                                        <EyeIcon className="h-4 w-4 mr-2" />
                                        Lihat
                                      </Button>
                                    ) : (
                                      <span className="text-xs text-gray-400">Belum ada</span>
                                    )}
                                    <label className={cn('inline-flex items-center justify-center rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer', saving ? 'opacity-50 pointer-events-none' : '')}>
                                      <ArrowUpTrayIcon className="h-4 w-4 mr-2" />
                                      Upload PDF
                                      <input
                                        type="file"
                                        accept="application/pdf"
                                        className="sr-only"
                                        onChange={async (e) => {
                                          const file = e.target.files?.[0]
                                          if (!file) return
                                          await uploadPpnSpt(month, file)
                                          e.target.value = ''
                                        }}
                                      />
                                    </label>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
                <div className="mt-3 text-[11px] text-gray-500">
                  PPN keluaran diambil dari Invoice TBS perusahaan per bulan. PPN masukan diisi manual sesuai faktur pajak masukan.
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <PerusahaanDetailPageModals
        assetModalOpen={assetModalOpen}
        setAssetModalOpen={setAssetModalOpen}
        assetEditing={assetEditing}
        assetName={assetName}
        setAssetName={setAssetName}
        assetGroup={assetGroup}
        setAssetGroup={setAssetGroup}
        assetAcquiredAt={assetAcquiredAt}
        setAssetAcquiredAt={setAssetAcquiredAt}
        assetCost={assetCost}
        setAssetCost={setAssetCost}
        assetSalvage={assetSalvage}
        setAssetSalvage={setAssetSalvage}
        assetSaving={assetSaving}
        saveAsset={saveAsset}
        assetDeleteOpen={assetDeleteOpen}
        setAssetDeleteOpen={setAssetDeleteOpen}
        assetDeleteTarget={assetDeleteTarget}
        deleteAsset={deleteAsset}
        assetDisposalOpen={assetDisposalOpen}
        setAssetDisposalOpen={setAssetDisposalOpen}
        assetDisposalTarget={assetDisposalTarget}
        assetDisposalStatus={assetDisposalStatus}
        setAssetDisposalStatus={setAssetDisposalStatus}
        assetDisposalDate={assetDisposalDate}
        setAssetDisposalDate={setAssetDisposalDate}
        assetDisposalProceeds={assetDisposalProceeds}
        setAssetDisposalProceeds={setAssetDisposalProceeds}
        assetDisposalNotes={assetDisposalNotes}
        setAssetDisposalNotes={setAssetDisposalNotes}
        saveAssetDisposal={saveAssetDisposal}
        assetDetailOpen={assetDetailOpen}
        setAssetDetailOpen={setAssetDetailOpen}
        assetDetailTarget={assetDetailTarget}
        ppnSettingOpen={ppnSettingOpen}
        setPpnSettingOpen={setPpnSettingOpen}
        ppnRatePct={ppnRatePct}
        setPpnRatePct={setPpnRatePct}
        savePpnSetting={savePpnSetting}
        ppnSettingLoading={ppnSettingLoading}
        notaSawitSettingOpen={notaSawitSettingOpen}
        setNotaSawitSettingOpen={setNotaSawitSettingOpen}
        notaSawitPphEffectiveFrom={notaSawitPphEffectiveFrom}
        setNotaSawitPphEffectiveFrom={setNotaSawitPphEffectiveFrom}
        notaSawitPphRatePct={notaSawitPphRatePct}
        setNotaSawitPphRatePct={setNotaSawitPphRatePct}
        notaSawitPphRates={notaSawitPphRates}
        saveNotaSawitSetting={saveNotaSawitSetting}
        notaSawitSettingLoading={notaSawitSettingLoading}
        editBiayaOpen={editBiayaOpen}
        setEditBiayaOpen={setEditBiayaOpen}
        setEditBiaya={setEditBiaya}
        editBiaya={editBiaya}
        kategoriDatalistId={kategoriDatalistId}
        biayaCategories={biayaCategories}
        editKategori={editKategori}
        setEditKategori={setEditKategori}
        handleSaveEditBiaya={handleSaveEditBiaya}
        kategoriOpen={kategoriOpen}
        setKategoriOpen={setKategoriOpen}
        kategoriNew={kategoriNew}
        setKategoriNew={setKategoriNew}
        addKategori={addKategori}
        deleteKategori={deleteKategori}
        taxSettingOpen={taxSettingOpen}
        setTaxSettingOpen={setTaxSettingOpen}
        taxScheme={taxScheme}
        setTaxScheme={setTaxScheme}
        taxRounding={taxRounding}
        setTaxRounding={setTaxRounding}
        taxStandardRatePct={taxStandardRatePct}
        setTaxStandardRatePct={setTaxStandardRatePct}
        taxUmkmFinalRatePct={taxUmkmFinalRatePct}
        setTaxUmkmFinalRatePct={setTaxUmkmFinalRatePct}
        taxFacilityDiscountPct={taxFacilityDiscountPct}
        setTaxFacilityDiscountPct={setTaxFacilityDiscountPct}
        taxUmkmThreshold={taxUmkmThreshold}
        setTaxUmkmThreshold={setTaxUmkmThreshold}
        taxFacilityThreshold={taxFacilityThreshold}
        setTaxFacilityThreshold={setTaxFacilityThreshold}
        taxFacilityPortionThreshold={taxFacilityPortionThreshold}
        setTaxFacilityPortionThreshold={setTaxFacilityPortionThreshold}
        saveTaxSetting={saveTaxSetting}
        taxSettingLoading={taxSettingLoading}
        buktiOpen={buktiOpen}
        setBuktiOpen={setBuktiOpen}
        buktiUrl={buktiUrl}
        setBuktiUrl={setBuktiUrl}
        handleDownloadBukti={handleDownloadBukti}
        docPreviewOpen={docPreviewOpen}
        setDocPreviewOpen={setDocPreviewOpen}
        docPreview={docPreview}
        isPdfPreview={isPdfPreview}
        labelDocType={labelDocType}
        formatCurrency={formatCurrency}
        formatRupiahInput={formatRupiahInput}
        parseRupiahToNumber={parseRupiahToNumber}
      />
    </main>
  )
}
