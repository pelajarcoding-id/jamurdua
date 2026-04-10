'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import useSWR from 'swr'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ChevronDownIcon, CheckCircleIcon, EyeIcon, MagnifyingGlassIcon, XMarkIcon, PlusIcon, CheckIcon, ArrowDownTrayIcon, PencilSquareIcon, TrashIcon, BanknotesIcon, ClockIcon, CurrencyDollarIcon, InformationCircleIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { useAuth } from '@/components/AuthProvider'
import ImageUpload from '@/components/ui/ImageUpload'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import { ModalHeader, ModalContentWrapper, ModalFooter } from '@/components/ui/modal-elements'

type User = {
  id: number
  name: string
  email: string
  photoUrl?: string | null
  kebunId?: number | null
  jobType?: string | null
  status?: string | null
  deleteRequestPending?: boolean
}

type Row = {
  karyawan: User
  hariKerja: number
  totalGaji: number
  totalGajiDibayar: number
  totalGajiBelumDibayar: number
  hutangSaldo: number
  lastPotongan?: {
    date: string
    jumlah: number
  } | null
}

type HutangDetailRow = {
  id: number
  date: string
  jumlah: number
  tipe: string
  kategori: string | null
  deskripsi: string | null
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function AbsensiTab({ kebunId }: { kebunId: number }) {
  const { role, id: currentUserId } = useAuth()
  const isAdminOrOwner = role === 'ADMIN' || role === 'PEMILIK'
  const isManagerOrMandor = role === 'MANAGER' || role === 'MANDOR'
  const canCreateKaryawan = isAdminOrOwner || isManagerOrMandor
  const canManageKaryawan = canCreateKaryawan
  const canSeeDebtDetail = isAdminOrOwner || isManagerOrMandor

  const { data: kebunListData } = useSWR<Array<{ id: number; name: string }>>('/api/kebun/list', fetcher)
  const kebunNameMap = useMemo(() => {
    const map = new Map<number, string>()
    if (Array.isArray(kebunListData)) {
      kebunListData.forEach(k => map.set(k.id, k.name))
    }
    return map
  }, [kebunListData])
  const formatDipindahLabel = useCallback((toKebunId?: number | null) => {
    if (typeof toKebunId === 'number' && Number.isFinite(toKebunId)) {
      const name = kebunNameMap.get(toKebunId)
      return `Dipindah - ${name || `Kebun #${toKebunId}`}`
    }
    return 'Dipindah'
  }, [kebunNameMap])

  const [absenMonth, setAbsenMonth] = useState<Date>(new Date())
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [absenUserId, setAbsenUserId] = useState<number | null>(null)
  const [absenOpen, setAbsenOpen] = useState(false)
  const [absenSelectedDate, setAbsenSelectedDate] = useState<string>('')
  const [absenValue, setAbsenValue] = useState<string>('')
  
  // State for attendance data
  const [absenMap, setAbsenMap] = useState<Record<string, string>>({})
  const [absenWorkMap, setAbsenWorkMap] = useState<Record<string, boolean>>({})
  const [absenOffMap, setAbsenOffMap] = useState<Record<string, boolean>>({})
  const [absenNoteMap, setAbsenNoteMap] = useState<Record<string, string>>({})
  const [absenHourlyMap, setAbsenHourlyMap] = useState<Record<string, boolean>>({})
  const [absenHourMap, setAbsenHourMap] = useState<Record<string, string>>({})
  const [absenRateMap, setAbsenRateMap] = useState<Record<string, string>>({})
  const [absenMealEnabledMap, setAbsenMealEnabledMap] = useState<Record<string, boolean>>({})
  const [absenMealMap, setAbsenMealMap] = useState<Record<string, string>>({})
  const [absenPaidMap, setAbsenPaidMap] = useState<Record<string, boolean>>({})

  // Form state for daily input
  const [absenWork, setAbsenWork] = useState<boolean>(false)
  const [absenOff, setAbsenOff] = useState<boolean>(false)
  const [absenNote, setAbsenNote] = useState<string>('')
  const [absenUseHourly, setAbsenUseHourly] = useState(false)
  const [absenHour, setAbsenHour] = useState<string>('')
  const [absenRate, setAbsenRate] = useState<string>('')
  const [absenMealEnabled, setAbsenMealEnabled] = useState(false)
  const [absenMealAmount, setAbsenMealAmount] = useState<string>('')
  const [absenDefaultAmount, setAbsenDefaultAmount] = useState<number>(0)
  const [absenSaving, setAbsenSaving] = useState(false)

  // Payment History state
  const [absenPayOpen, setAbsenPayOpen] = useState(false)
  const [absenPaySelection, setAbsenPaySelection] = useState<Record<string, boolean>>({})
  const [absenPayHistoryRows, setAbsenPayHistoryRows] = useState<any[]>([])
  const [absenPayHistoryLoading, setAbsenPayHistoryLoading] = useState(false)
  const [absenPayHistoryStart, setAbsenPayHistoryStart] = useState<string>('')
  const [absenPayHistoryEnd, setAbsenPayHistoryEnd] = useState<string>('')
  const [absenPayHistoryOpen, setAbsenPayHistoryOpen] = useState(false)
  const [absenPayPotong, setAbsenPayPotong] = useState<string>('')
  const [absenPayPotongDesc, setAbsenPayPotongDesc] = useState<string>('Potong Hutang dari Pembayaran Gaji')
  const [openPayDetail, setOpenPayDetail] = useState(false)
  const [payDetailLoading, setPayDetailLoading] = useState(false)
  const [payDetail, setPayDetail] = useState<any | null>(null)
  const [payDetailExporting, setPayDetailExporting] = useState(false)

  const [openEditKaryawan, setOpenEditKaryawan] = useState(false)
  const [editKaryawanSubmitting, setEditKaryawanSubmitting] = useState(false)
  const [editKaryawanTarget, setEditKaryawanTarget] = useState<User | null>(null)
  const [editKaryawanName, setEditKaryawanName] = useState('')
  const [editKaryawanStatus, setEditKaryawanStatus] = useState<'AKTIF' | 'NONAKTIF'>('AKTIF')
  const [editKaryawanPhotoFile, setEditKaryawanPhotoFile] = useState<File | null>(null)
  const [editKaryawanPhotoPreview, setEditKaryawanPhotoPreview] = useState<string | null>(null)
  const [openDeleteKaryawan, setOpenDeleteKaryawan] = useState(false)
  const [deleteKaryawanId, setDeleteKaryawanId] = useState<number | null>(null)

  const [openDetailHutang, setOpenDetailHutang] = useState(false)
  const [detailTarget, setDetailTarget] = useState<User | null>(null)
  const [detailRows, setDetailRows] = useState<HutangDetailRow[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailExporting, setDetailExporting] = useState(false)

  const [openAbsenView, setOpenAbsenView] = useState(false)
  const [isDeletingAbsen, setIsDeletingAbsen] = useState(false)
  const [openDeleteAbsenConfirm, setOpenDeleteAbsenConfirm] = useState(false)

  const [karyawanSearch, setKaryawanSearch] = useState('')
  const calendarRef = useRef<HTMLDivElement>(null)
  const [openAddKaryawan, setOpenAddKaryawan] = useState(false)
  const [addKaryawanName, setAddKaryawanName] = useState('')
  const [addKaryawanStatus, setAddKaryawanStatus] = useState<'AKTIF' | 'NONAKTIF'>('AKTIF')
  const [addKaryawanPhotoFile, setAddKaryawanPhotoFile] = useState<File | null>(null)
  const [addKaryawanPhotoPreview, setAddKaryawanPhotoPreview] = useState<string | null>(null)
  const [addKaryawanLoading, setAddKaryawanLoading] = useState(false)

  const formatRibuanId = useCallback((s: string) => {
    const digits = s.replace(/\D/g, '')
    if (!digits) return ''
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  }, [])

  const formatDateKey = useCallback((d: Date) => {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }, [])

  const startOfMonth = useMemo(() => {
    const d = new Date(absenMonth.getFullYear(), absenMonth.getMonth(), 1)
    return formatDateKey(d)
  }, [absenMonth, formatDateKey])

  const endOfMonth = useMemo(() => {
    const d = new Date(absenMonth.getFullYear(), absenMonth.getMonth() + 1, 0)
    return formatDateKey(d)
  }, [absenMonth, formatDateKey])

  // Fetch summary/debt data for the selected month
  const { data: summaryRowsData, mutate: mutateSummary, isLoading: loadingSummary } = useSWR<{ data: Row[] }>(
    `/api/karyawan-kebun?kebunId=${kebunId}&startDate=${startOfMonth}&endDate=${endOfMonth}`,
    fetcher
  )
  const rows = summaryRowsData?.data ?? []

  const filteredRows = useMemo(() => {
    if (!karyawanSearch.trim()) return rows
    const s = karyawanSearch.toLowerCase()
    return rows.filter(r => r.karyawan.name.toLowerCase().includes(s))
  }, [rows, karyawanSearch])

  const totalGajiBerjalan = useMemo(() => filteredRows.reduce((acc, curr) => acc + (curr.totalGajiBelumDibayar || 0), 0), [filteredRows])
  const totalGajiDibayar = useMemo(() => filteredRows.reduce((acc, curr) => acc + (curr.totalGajiDibayar || 0), 0), [filteredRows])
  const totalSaldoHutang = useMemo(() => filteredRows.reduce((acc, curr) => acc + (curr.hutangSaldo || 0), 0), [filteredRows])

  const hutangList = useMemo(() => {
    return filteredRows
      .sort((a, b) => (Number(b.hutangSaldo || 0) - Number(a.hutangSaldo || 0)))
  }, [filteredRows])

  // Fetch employees for this kebun (for dropdown if still needed or just list)
  const { data: karyawanData, mutate: mutateKaryawanList } = useSWR<{ data: User[] }>(
    `/api/karyawan?kebunId=${kebunId}&jobType=KEBUN&limit=100`,
    fetcher
  )
  const karyawanList = karyawanData?.data ?? []

  const handleCreateKaryawan = async () => {
    const name = addKaryawanName.trim()
    if (!name) {
      toast.error('Nama wajib diisi')
      return
    }
    setAddKaryawanLoading(true)
    const loadingToast = toast.loading('Menyimpan karyawan...')
    try {
      let photoUrl: string | null = null
      if (addKaryawanPhotoFile) {
        const fd = new FormData()
        fd.append('file', addKaryawanPhotoFile)
        const up = await fetch('/api/upload', { method: 'POST', body: fd })
        const upJson = await up.json().catch(() => ({} as any))
        if (!up.ok || !upJson?.success) throw new Error(upJson?.error || 'Upload foto profil gagal')
        photoUrl = upJson.url
      }

      const res = await fetch('/api/karyawan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          kebunId,
          jobType: 'KEBUN',
          role: 'KARYAWAN',
          status: addKaryawanStatus,
          ...(photoUrl ? { photoUrl } : {}),
        }),
      })
      const json = await res.json().catch(() => ({} as any))
      if (!res.ok) throw new Error((json as any)?.error || 'Gagal menambah karyawan')
      toast.success('Karyawan berhasil ditambahkan', { id: loadingToast })
      setOpenAddKaryawan(false)
      setAddKaryawanName('')
      setAddKaryawanStatus('AKTIF')
      setAddKaryawanPhotoFile(null)
      setAddKaryawanPhotoPreview(null)
      await Promise.all([mutateKaryawanList(), mutateSummary()])
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menambah karyawan', { id: loadingToast })
    } finally {
      setAddKaryawanLoading(false)
    }
  }

  const openEditKaryawanModal = useCallback((karyawan: User) => {
    setEditKaryawanTarget(karyawan)
    setEditKaryawanName(karyawan.name || '')
    setEditKaryawanStatus((karyawan.status as any) === 'NONAKTIF' ? 'NONAKTIF' : 'AKTIF')
    setEditKaryawanPhotoFile(null)
    setEditKaryawanPhotoPreview(karyawan.photoUrl || null)
    setOpenEditKaryawan(true)
  }, [])

  const handleUpdateKaryawan = useCallback(async () => {
    if (!editKaryawanTarget) return
    const name = editKaryawanName.trim()
    if (!name) {
      toast.error('Nama wajib diisi')
      return
    }
    setEditKaryawanSubmitting(true)
    const loadingToast = toast.loading('Menyimpan perubahan...')
    try {
      let photoUrl: string | null | undefined = undefined
      if (editKaryawanPhotoFile) {
        const fd = new FormData()
        fd.append('file', editKaryawanPhotoFile)
        const up = await fetch('/api/upload', { method: 'POST', body: fd })
        const upJson = await up.json().catch(() => ({} as any))
        if (!up.ok || !upJson?.success) throw new Error(upJson?.error || 'Upload foto profil gagal')
        photoUrl = upJson.url
      } else if (editKaryawanPhotoPreview === null && editKaryawanTarget.photoUrl) {
        photoUrl = null
      }

      const res = await fetch(`/api/karyawan/${editKaryawanTarget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          status: editKaryawanStatus,
          ...(typeof photoUrl !== 'undefined' ? { photoUrl } : {}),
        }),
      })
      const json = await res.json().catch(() => ({} as any))
      if (!res.ok) throw new Error((json as any)?.error || 'Gagal menyimpan perubahan')
      toast.success('Perubahan tersimpan', { id: loadingToast })
      setOpenEditKaryawan(false)
      setEditKaryawanTarget(null)
      await Promise.all([mutateKaryawanList(), mutateSummary()])
      if (selectedUser?.id === editKaryawanTarget.id) {
        setSelectedUser((prev) => prev ? { ...prev, name, status: editKaryawanStatus, photoUrl: typeof photoUrl === 'undefined' ? prev.photoUrl : photoUrl } : prev)
      }
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menyimpan perubahan', { id: loadingToast })
    } finally {
      setEditKaryawanSubmitting(false)
    }
  }, [editKaryawanTarget, editKaryawanName, editKaryawanStatus, editKaryawanPhotoFile, editKaryawanPhotoPreview, mutateKaryawanList, mutateSummary, selectedUser])

  const requestDeleteKaryawan = useCallback((id: number) => {
    setDeleteKaryawanId(id)
    setOpenDeleteKaryawan(true)
  }, [])

  const handleConfirmDeleteKaryawan = useCallback(async () => {
    if (deleteKaryawanId == null) return
    try {
      const alreadyPending = rows.find((r) => r.karyawan.id === deleteKaryawanId)?.karyawan?.deleteRequestPending
      if (alreadyPending) {
        toast.error('Permohonan hapus sudah diajukan')
        return
      }
      const res = await fetch(`/api/karyawan/delete-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ karyawanId: deleteKaryawanId, reason: 'Permintaan dari Detail Kebun (Absensi)' }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({} as any))
        toast.error((err as any).error || 'Gagal mengajukan permintaan penghapusan')
        return
      }
      toast.success('Permintaan penghapusan diajukan')
      await Promise.all([mutateKaryawanList(), mutateSummary()])
    } finally {
      setOpenDeleteKaryawan(false)
      setDeleteKaryawanId(null)
    }
  }, [deleteKaryawanId, mutateKaryawanList, mutateSummary, rows])

  // Load attendance from server
  useEffect(() => {
    const loadServerData = async () => {
      if (!kebunId || !absenUserId) return
      
      const start = new Date(absenMonth.getFullYear(), absenMonth.getMonth(), 1)
      const end = new Date(absenMonth.getFullYear(), absenMonth.getMonth() + 1, 0)
      
      const params = new URLSearchParams({
        kebunId: String(kebunId),
        karyawanId: String(absenUserId),
        startDate: formatDateKey(start),
        endDate: formatDateKey(end),
      })
      
      try {
        const res = await fetch(`/api/karyawan-kebun/absensi?${params.toString()}`)
        if (res.ok) {
          const json = await res.json()
          const records = json.data || []
          
          const nextAmount: Record<string, string> = {}
          const nextWork: Record<string, boolean> = {}
          const nextOff: Record<string, boolean> = {}
          const nextNote: Record<string, string> = {}
          
          records.forEach((r: any) => {
            // Parse date from server (YYYY-MM-DD...) into local date object without shift
            const dateObj = new Date(r.date)
            const year = dateObj.getUTCFullYear()
            const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0')
            const day = String(dateObj.getUTCDate()).padStart(2, '0')
            const key = `${year}-${month}-${day}`
            
            if (r.jumlah > 0) nextAmount[key] = String(r.jumlah)
            if (r.kerja) nextWork[key] = true
            if (r.libur) nextOff[key] = true
            if (r.note) nextNote[key] = r.note
          })
          
          setAbsenMap(nextAmount)
          setAbsenWorkMap(nextWork)
          setAbsenOffMap(nextOff)
          setAbsenNoteMap(nextNote)
          
          // Also update localStorage to keep it in sync
          const ym = `${absenMonth.getFullYear()}-${String(absenMonth.getMonth() + 1).padStart(2, '0')}`
          const storageKey = `absensi:v2:${kebunId}:${absenUserId}:${ym}`
          localStorage.setItem(storageKey, JSON.stringify({
            amount: nextAmount,
            work: nextWork,
            off: nextOff,
            note: nextNote
          }))
        }
      } catch (e) {
        console.error('Failed to load absensi from server', e)
      }
    }
    
    loadServerData()
  }, [kebunId, absenUserId, absenMonth, formatDateKey])

  // Load attendance from localStorage (as fallback or initial)
  useEffect(() => {
    if (!kebunId || !absenUserId) return
    const ym = `${absenMonth.getFullYear()}-${String(absenMonth.getMonth() + 1).padStart(2, '0')}`
    const key = `absensi:v2:${kebunId}:${absenUserId}:${ym}`
    try {
      const raw = localStorage.getItem(key)
      if (raw) {
        const parsed = JSON.parse(raw)
        // Only set if current maps are empty to avoid overwriting server data if it loaded faster
        setAbsenMap(prev => Object.keys(prev).length === 0 ? (parsed.amount || {}) : prev)
        setAbsenWorkMap(prev => Object.keys(prev).length === 0 ? (parsed.work || {}) : prev)
        setAbsenOffMap(prev => Object.keys(prev).length === 0 ? (parsed.off || {}) : prev)
        setAbsenNoteMap(prev => Object.keys(prev).length === 0 ? (parsed.note || {}) : prev)
        // ... set others if needed ...
      }
    } catch {
      // ignore
    }
  }, [kebunId, absenUserId, absenMonth])

  // Load payment status
  const loadPaid = useCallback(async (kId: number, uId: number, month: Date) => {
    const start = new Date(month.getFullYear(), month.getMonth(), 1)
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 0)
    const params = new URLSearchParams({
      kebunId: String(kId),
      karyawanId: String(uId),
      startDate: formatDateKey(start),
      endDate: formatDateKey(end),
    })
    const res = await fetch(`/api/karyawan-kebun/absensi-payments?${params.toString()}`)
    if (!res.ok) {
      setAbsenPaidMap({})
      return
    }
    const json = await res.json()
    const next: Record<string, boolean> = {}
    ;(json.data || []).forEach((r: { date: string }) => { 
      if (r.date) {
        const d = new Date(r.date)
        const year = d.getUTCFullYear()
        const month = String(d.getUTCMonth() + 1).padStart(2, '0')
        const day = String(d.getUTCDate()).padStart(2, '0')
        const key = `${year}-${month}-${day}`
        next[key] = true 
      }
    })
    setAbsenPaidMap(next)
  }, [formatDateKey])

  useEffect(() => {
    if (!kebunId || !absenUserId) {
      setAbsenPaidMap({})
      return
    }
    loadPaid(kebunId, absenUserId, absenMonth)
  }, [kebunId, absenUserId, absenMonth, loadPaid])

  // Load default wage
  useEffect(() => {
    const loadDefault = async () => {
      if (!kebunId || !absenUserId) {
        setAbsenDefaultAmount(0)
        return
      }
      const params = new URLSearchParams({ kebunId: String(kebunId), karyawanId: String(absenUserId) })
      const res = await fetch(`/api/karyawan-kebun/absensi-default?${params.toString()}`)
      if (res.ok) {
        const json = await res.json()
        setAbsenDefaultAmount(Number(json.amount) || 0)
      }
    }
    loadDefault()
  }, [kebunId, absenUserId])

  // Payment history fetching
  const fetchAbsenPayHistory = useCallback(async () => {
    if (!kebunId || !absenUserId) {
      setAbsenPayHistoryRows([])
      return
    }
    const params = new URLSearchParams({
      kebunId: String(kebunId),
      karyawanId: String(absenUserId),
      startDate: absenPayHistoryStart || formatDateKey(new Date(absenMonth.getFullYear(), absenMonth.getMonth(), 1)),
      endDate: absenPayHistoryEnd || formatDateKey(new Date(absenMonth.getFullYear(), absenMonth.getMonth() + 1, 0)),
      history: '1',
    })
    setAbsenPayHistoryLoading(true)
    try {
      const res = await fetch(`/api/karyawan-kebun/absensi-payments?${params.toString()}`)
      if (res.ok) {
        const json = await res.json()
        setAbsenPayHistoryRows(json.data || [])
      }
    } finally {
      setAbsenPayHistoryLoading(false)
    }
  }, [kebunId, absenUserId, absenMonth, formatDateKey, absenPayHistoryStart, absenPayHistoryEnd])

  useEffect(() => {
    fetchAbsenPayHistory()
  }, [fetchAbsenPayHistory])

  // Summary logic
  const absenSummary = useMemo(() => {
    const ym = `${absenMonth.getFullYear()}-${String(absenMonth.getMonth() + 1).padStart(2, '0')}`
    let hariKerja = 0
    let totalGaji = 0
    let totalMeal = 0
    Object.entries(absenWorkMap).forEach(([date, work]) => {
      if (work && date.startsWith(ym)) hariKerja += 1
    })
    Object.entries(absenMap).forEach(([date, val]) => {
      if (!date.startsWith(ym)) return
      const num = Number((val || '').toString().replace(/\./g, '').replace(/,/g, '')) || 0
      if (!absenPaidMap[date]) totalGaji += num
    })
    Object.entries(absenMealMap).forEach(([date, val]) => {
      if (!date.startsWith(ym)) return
      if (!absenMealEnabledMap[date]) return
      const num = Number((val || '').toString().replace(/\./g, '').replace(/,/g, '')) || 0
      totalMeal += num
    })
    const hutang = selectedUser ? Math.round(rows.find(r => r.karyawan.id === selectedUser.id)?.hutangSaldo || 0) : 0
    return { hariKerja, totalGaji, totalMeal, hutang }
  }, [absenMonth, absenWorkMap, absenMap, absenPaidMap, absenMealMap, absenMealEnabledMap, selectedUser, rows])

  const unpaidDates = useMemo(() => {
    const ym = `${absenMonth.getFullYear()}-${String(absenMonth.getMonth() + 1).padStart(2, '0')}`
    return Object.entries(absenMap)
      .filter(([date, val]) => date.startsWith(ym) && val && !absenPaidMap[date])
      .map(([date, val]) => {
        const amount = Number((val || '').toString().replace(/\./g, '').replace(/,/g, '')) || 0
        return { date, amount }
      })
      .filter(x => x.amount > 0)
  }, [absenMonth, absenMap, absenPaidMap])

  const hutangBeforePay = useMemo(() => {
    if (!selectedUser) return 0
    return Math.max(0, Math.round(rows.find(r => r.karyawan.id === selectedUser.id)?.hutangSaldo || 0))
  }, [rows, selectedUser])
  const potongPayValue = useMemo(() => Number((absenPayPotong || '').toString().replace(/\./g, '').replace(/,/g, '')) || 0, [absenPayPotong])
  const potongPayEffective = useMemo(() => {
    if (hutangBeforePay <= 0) return 0
    return Math.min(potongPayValue, hutangBeforePay)
  }, [potongPayValue, hutangBeforePay])
  const hutangAfterPay = useMemo(() => Math.max(0, hutangBeforePay - potongPayEffective), [hutangBeforePay, potongPayEffective])

  const totalHutangDetail = useMemo(() => {
    return detailRows.reduce((acc, d) => acc + (d.kategori === 'HUTANG_KARYAWAN' ? Number(d.jumlah || 0) : 0), 0)
  }, [detailRows])
  const totalPotonganDetail = useMemo(() => {
    return detailRows.reduce((acc, d) => acc + (d.kategori === 'PEMBAYARAN_HUTANG' ? Number(d.jumlah || 0) : 0), 0)
  }, [detailRows])
  const sisaHutangDetail = Math.max(0, Math.round(totalHutangDetail - totalPotonganDetail))

  const handleSaveAbsen = async () => {
    if (!kebunId || !absenUserId || !absenSelectedDate) return
    if (absenPaidMap[absenSelectedDate]) {
      toast.error('Absensi sudah dibayar dan tidak bisa diubah')
      return
    }
    setAbsenSaving(true)
    try {
      const num = Number(absenValue.replace(/\./g, '').replace(/,/g, '')) || 0
      const entry = {
        date: absenSelectedDate,
        amount: num,
        work: absenWork,
        off: absenOff,
        note: absenNote,
        hourly: absenUseHourly,
        hour: Number(absenHour.replace(',', '.')) || 0,
        rate: Number(absenRate.replace(/\D/g, '')) || 0,
        mealEnabled: absenMealEnabled,
        meal: Number(absenMealAmount.replace(/\D/g, '')) || 0,
      }

      const res = await fetch('/api/karyawan-kebun/absensi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kebunId,
          karyawanId: absenUserId,
          entries: [entry]
        }),
      })

      if (res.ok) {
        // Update local maps
        const nextAmount = { ...absenMap, [absenSelectedDate]: String(num) }
        const nextWork = { ...absenWorkMap, [absenSelectedDate]: absenWork }
        const nextOff = { ...absenOffMap, [absenOffMap[absenSelectedDate] ? absenSelectedDate : '']: false, [absenSelectedDate]: absenOff }
        const nextNote = { ...absenNoteMap, [absenSelectedDate]: absenNote }
        const nextHourly = { ...absenHourlyMap, [absenSelectedDate]: absenUseHourly }
        const nextHour = { ...absenHourMap, [absenSelectedDate]: absenHour }
        const nextRate = { ...absenRateMap, [absenSelectedDate]: absenRate }
        const nextMealEnabled = { ...absenMealEnabledMap, [absenSelectedDate]: absenMealEnabled }
        const nextMeal = { ...absenMealMap, [absenSelectedDate]: absenMealAmount }

        setAbsenMap(nextAmount)
        setAbsenWorkMap(nextWork)
        setAbsenOffMap(nextOff)
        setAbsenNoteMap(nextNote)
        setAbsenHourlyMap(nextHourly)
        setAbsenHourMap(nextHour)
        setAbsenRateMap(nextRate)
        setAbsenMealEnabledMap(nextMealEnabled)
        setAbsenMealMap(nextMeal)

        // Persist to localStorage
        const ym = `${absenMonth.getFullYear()}-${String(absenMonth.getMonth() + 1).padStart(2, '0')}`
        const key = `absensi:v2:${kebunId}:${absenUserId}:${ym}`
        localStorage.setItem(key, JSON.stringify({
          amount: nextAmount,
          work: nextWork,
          off: nextOff,
          note: nextNote,
          hourly: nextHourly,
          hour: nextHour,
          rate: nextRate,
          mealEnabled: nextMealEnabled,
          meal: nextMeal
        }))

        toast.success('Absensi disimpan')
        setAbsenOpen(false)
        mutateSummary()
      } else {
        const err = await res.json()
        toast.error(err.error || 'Gagal menyimpan absensi')
      }
    } finally {
      setAbsenSaving(false)
    }
  }

  const handlePayGaji = async () => {
    if (!kebunId || !absenUserId) return
    const selection = Object.entries(absenPaySelection).filter(([_, v]) => v).map(([d]) => d)
    if (selection.length === 0) {
      toast.error('Pilih tanggal yang akan dibayar')
      return
    }

    const selectedEntries = unpaidDates.filter(d => absenPaySelection[d.date])
    const entries = selectedEntries.map(d => ({ date: d.date, jumlah: d.amount }))
    if (entries.length === 0) {
      toast.error('Pilih tanggal yang akan dibayar')
      return
    }

    try {
      const batchKey = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const res = await fetch('/api/karyawan-kebun/absensi-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kebunId,
          karyawanId: absenUserId,
          entries,
          batchKey,
        }),
      })

      if (res.ok) {
        if (potongPayEffective > 0) {
          const lastDate = selectedEntries[selectedEntries.length - 1]?.date
          const potongRes = await fetch('/api/karyawan-kebun/pembayaran', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              kebunId,
              karyawanId: absenUserId,
              jumlah: potongPayEffective,
              date: lastDate || undefined,
              deskripsi: `${absenPayPotongDesc || 'Potong Hutang dari Pembayaran Gaji'} | Batch ${batchKey}`,
            }),
          })
          if (potongRes.ok) {
            mutateSummary()
          } else {
            toast.error('Gagal menyimpan potongan hutang')
          }
        }
        toast.success('Pembayaran gaji berhasil')
        setAbsenPayOpen(false)
        fetchAbsenPayHistory()
        loadPaid(kebunId, absenUserId, absenMonth)
        setAbsenPayPotong('')
        setAbsenPayPotongDesc('Potong Hutang dari Pembayaran Gaji')
        mutateSummary()
      } else {
        const err = await res.json()
        toast.error(err.error || 'Gagal membayar gaji')
      }
    } catch (e) {
      toast.error('Terjadi kesalahan')
    }
  }

  const handleOpenDetailHutang = async (u: User) => {
    setDetailTarget(u)
    setOpenDetailHutang(true)
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/karyawan-kebun/detail?kebunId=${kebunId}&karyawanId=${u.id}`)
      if (!res.ok) {
        setDetailRows([])
        return
      }
      const json = await res.json()
      setDetailRows(Array.isArray(json.data) ? json.data : [])
    } catch {
      setDetailRows([])
    } finally {
      setDetailLoading(false)
    }
  }

  const handleExportDetailHutang = async () => {
    if (!detailTarget) return
    if (detailRows.length === 0) {
      toast.error('Tidak ada data hutang untuk dicetak')
      return
    }
    try {
      setDetailExporting(true)
      const jsPDF = (await import('jspdf')).default
      const autoTable = (await import('jspdf-autotable')).default
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      doc.setFontSize(14)
      doc.text('Detail Hutang & Potongan', 14, 16)
      doc.setFontSize(10)
      doc.text(`Karyawan: ${detailTarget.name}`, 14, 24)
      doc.text(`Total Hutang: Rp ${Math.round(totalHutangDetail).toLocaleString('id-ID')}`, 14, 30)
      doc.text(`Total Potongan: Rp ${Math.round(totalPotonganDetail).toLocaleString('id-ID')}`, 14, 36)
      doc.text(`Sisa Hutang: Rp ${Math.round(sisaHutangDetail).toLocaleString('id-ID')}`, 14, 42)
      const body = detailRows.map((d) => {
        const isHutang = d.kategori === 'HUTANG_KARYAWAN'
        const isPotongan = d.kategori === 'PEMBAYARAN_HUTANG'
        return [
          format(new Date(d.date), 'dd MMM yy', { locale: idLocale }),
          isHutang ? `Rp ${Math.round(d.jumlah).toLocaleString('id-ID')}` : '-',
          isPotongan ? `Rp ${Math.round(d.jumlah).toLocaleString('id-ID')}` : '-',
          d.deskripsi || '-',
        ]
      })
      autoTable(doc, {
        head: [['Tanggal', 'Hutang', 'Potongan', 'Keterangan']],
        body,
        startY: 48,
        theme: 'grid',
        headStyles: { fillColor: [0, 0, 0] },
        styles: { fontSize: 9 },
      })
      doc.save(`Detail-Hutang-${detailTarget.name.replace(/\s+/g, '-')}.pdf`)
      toast.success('PDF berhasil dibuat')
    } catch (e) {
      toast.error('Gagal membuat PDF')
    } finally {
      setDetailExporting(false)
    }
  }

  const openPayDetailModal = useCallback(async (row: any) => {
    if (!kebunId || !absenUserId) return
    setOpenPayDetail(true)
    setPayDetailLoading(true)
    setPayDetail(null)
    try {
      const params = new URLSearchParams({
        kebunId: String(kebunId),
        karyawanId: String(absenUserId),
        startDate: String(row?.startDate || ''),
        endDate: String(row?.endDate || ''),
        history: '1',
        detail: '1',
      })
      if (row?.gajianId) params.set('gajianId', String(row.gajianId))
      else params.set('paidAt', String(row?.paidAt || ''))
      const res = await fetch(`/api/karyawan-kebun/absensi-payments?${params.toString()}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Gagal memuat detail')
      const json = await res.json().catch(() => ({} as any))
      setPayDetail(json)
    } catch {
      toast.error('Gagal memuat detail pembayaran')
      setOpenPayDetail(false)
    } finally {
      setPayDetailLoading(false)
    }
  }, [kebunId, absenUserId])

  const handleExportPayDetailPdf = useCallback(async () => {
    if (!payDetail?.summary) return
    try {
      setPayDetailExporting(true)
      const jsPDF = (await import('jspdf')).default
      const autoTable = (await import('jspdf-autotable')).default
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

      const userName = payDetail.summary.userName || selectedUser?.name || '-'
      const startDate = String(payDetail.summary.startDate || '')
      const endDate = String(payDetail.summary.endDate || '')
      const paidAt = String(payDetail.summary.paidAt || '')
      const jumlah = Math.round(Number(payDetail.summary.jumlah || 0))
      const potonganHutang = Math.round(Number(payDetail.summary.potonganHutang || 0))
      const sisa = Math.max(0, Math.round(Number(payDetail.summary.sisa || (jumlah - potonganHutang) || 0)))

      doc.setFontSize(14)
      doc.text('Detail Pembayaran Gaji', 14, 16)
      doc.setFontSize(10)
      doc.text(`Karyawan: ${userName}`, 14, 24)
      doc.text(`Periode: ${startDate}${endDate && endDate !== startDate ? ` - ${endDate}` : ''}`, 14, 30)
      if (paidAt) doc.text(`Tanggal Bayar: ${format(new Date(paidAt), 'dd MMM yy HH:mm', { locale: idLocale })}`, 14, 36)
      doc.text(`Jumlah: Rp ${jumlah.toLocaleString('id-ID')}`, 14, 42)
      doc.text(`Potongan Hutang: Rp ${potonganHutang.toLocaleString('id-ID')}`, 14, 48)
      doc.text(`Sisa Gaji: Rp ${sisa.toLocaleString('id-ID')}`, 14, 54)

      const body = (Array.isArray(payDetail.items) ? payDetail.items : []).map((it: any) => [
        format(new Date(it.date), 'dd MMM yy', { locale: idLocale }),
        `Rp ${Math.round(Number(it.jumlah || 0)).toLocaleString('id-ID')}`,
        `Rp ${Math.round(Number(it.potonganHutang || 0)).toLocaleString('id-ID')}`,
        `Rp ${Math.round(Number(it.sisa || 0)).toLocaleString('id-ID')}`,
      ])

      autoTable(doc, {
        head: [['Tanggal', 'Gaji', 'Potongan', 'Sisa']],
        body,
        startY: 62,
        theme: 'grid',
        headStyles: { fillColor: [37, 99, 235] },
        styles: { fontSize: 9 },
        columnStyles: {
          1: { halign: 'right' },
          2: { halign: 'right' },
          3: { halign: 'right' },
        },
      } as any)

      const safeName = String(userName || 'Karyawan').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-')
      doc.save(`Detail-Pembayaran-Gaji-${safeName}-${startDate}${endDate && endDate !== startDate ? `-${endDate}` : ''}.pdf`)
      toast.success('PDF berhasil dibuat')
    } catch {
      toast.error('Gagal membuat PDF')
    } finally {
      setPayDetailExporting(false)
    }
  }, [payDetail, selectedUser])

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg md:text-xl font-bold text-gray-900 capitalize">Tabel Karyawan Kebun</h2>
            <p className="text-xs md:text-sm text-gray-500">Pilih karyawan untuk mengelola absensi.</p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative w-full sm:w-64">
              <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Cari karyawan..."
                value={karyawanSearch}
                onChange={(e) => setKaryawanSearch(e.target.value)}
                className="rounded-full pl-9 h-10 border-gray-200 text-sm"
              />
            </div>

            <div className="flex items-center justify-between bg-gray-50 rounded-full p-1 border border-gray-100">
              <Button 
                variant="ghost" 
                size="sm" 
                className="rounded-full h-8 w-8 p-0 hover:bg-white hover:shadow-sm"
                onClick={() => setAbsenMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
              >
                <ChevronDownIcon className="w-4 h-4 rotate-90" />
              </Button>
              <span className="px-2 md:px-4 text-xs md:text-sm font-medium text-gray-700 min-w-[100px] md:min-w-[120px] text-center">
                {new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(absenMonth)}
              </span>
              <Button 
                variant="ghost" 
                size="sm" 
                className="rounded-full h-8 w-8 p-0 hover:bg-white hover:shadow-sm"
                onClick={() => setAbsenMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
              >
                <ChevronDownIcon className="w-4 h-4 -rotate-90" />
              </Button>
            </div>

            {canCreateKaryawan && (
              <Button
                size="sm"
                className="rounded-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => setOpenAddKaryawan(true)}
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Tambah Karyawan
              </Button>
            )}
          </div>
        </div>

        <div className="md:hidden space-y-3 mb-6">
          {loadingSummary ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))
          ) : filteredRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center text-sm text-gray-500">
              Tidak ada data karyawan
            </div>
          ) : (
            <>
              {filteredRows.map((r) => (
                <div
                  key={`card-${r.karyawan.id}`}
                  onClick={() => {
                    setAbsenMap({})
                    setAbsenWorkMap({})
                    setAbsenOffMap({})
                    setAbsenNoteMap({})
                    setSelectedUser(r.karyawan)
                    setAbsenUserId(r.karyawan.id)
                    setTimeout(() => {
                      calendarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }, 0)
                  }}
                  className={`rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-3 transition-colors ${selectedUser?.id === r.karyawan.id ? 'ring-2 ring-gray-900' : 'hover:bg-gray-50/50'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {r.karyawan.photoUrl ? (
                          <img
                            src={r.karyawan.photoUrl}
                            alt={r.karyawan.name}
                            className="w-8 h-8 rounded-full object-cover border border-gray-200"
                          />
                        ) : (
                          <div className="w-8 h-8 bg-gray-900 rounded-full flex items-center justify-center text-white font-bold text-xs">
                            {r.karyawan.name.charAt(0)}
                          </div>
                        )}
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="font-semibold text-gray-900 capitalize truncate">{r.karyawan.name}</div>
                          {r.karyawan.kebunId !== kebunId && (
                            <span
                              title={formatDipindahLabel(r.karyawan.kebunId)}
                              className="inline-flex items-center rounded-full bg-gray-100 text-gray-600 px-2 py-0.5 text-[10px] font-bold"
                            >
                              {formatDipindahLabel(r.karyawan.kebunId)}
                            </span>
                          )}
                          {r.karyawan.deleteRequestPending ? (
                            <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[10px] font-bold">
                              Permohonan hapus
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">{r.hariKerja || 0} Hari Kerja</div>
                    </div>
                    {canManageKaryawan ? (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-full"
                          onClick={(e) => {
                            e.stopPropagation()
                            openEditKaryawanModal(r.karyawan)
                          }}
                        >
                          <PencilSquareIcon className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-full text-red-600 hover:bg-red-50"
                          onClick={(e) => {
                            e.stopPropagation()
                            requestDeleteKaryawan(r.karyawan.id)
                          }}
                          disabled={!!r.karyawan.deleteRequestPending}
                        >
                          <TrashIcon className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                    <div className="text-xs font-semibold text-gray-400">
                      {selectedUser?.id === r.karyawan.id ? 'Dipilih' : ''}
                    </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-gray-400">Gaji Berjalan</div>
                      <div className="font-semibold">Rp {(r.totalGajiBelumDibayar || 0).toLocaleString('id-ID')}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Gaji Dibayar</div>
                      <div className="font-semibold text-emerald-600">Rp {(r.totalGajiDibayar || 0).toLocaleString('id-ID')}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Saldo Hutang</div>
                      <div className="font-semibold text-red-600">Rp {(r.hutangSaldo || 0).toLocaleString('id-ID')}</div>
                    </div>
                  </div>
                </div>
              ))}
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-700">Total</span>
                  <span className="font-semibold text-gray-900">Rp {totalGajiBerjalan.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="font-semibold text-emerald-700">Gaji Dibayar</span>
                  <span className="font-semibold text-emerald-700">Rp {totalGajiDibayar.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="font-semibold text-red-600">Saldo Hutang</span>
                  <span className="font-semibold text-red-600">Rp {totalSaldoHutang.toLocaleString('id-ID')}</span>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="hidden md:block overflow-x-auto rounded-2xl border border-gray-100 mb-6">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Nama</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Hari Kerja</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Gaji Berjalan</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Gaji Dibayar</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Saldo Hutang</th>
                {canManageKaryawan ? <th className="px-4 py-3 text-right font-semibold text-gray-600">Aksi</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loadingSummary ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                    <td className="px-4 py-3 text-right"><Skeleton className="h-4 w-12 ml-auto" /></td>
                    <td className="px-4 py-3 text-right"><Skeleton className="h-4 w-24 ml-auto" /></td>
                    <td className="px-4 py-3 text-right"><Skeleton className="h-4 w-24 ml-auto" /></td>
                    <td className="px-4 py-3 text-right"><Skeleton className="h-4 w-24 ml-auto" /></td>
                    {canManageKaryawan ? <td className="px-4 py-3 text-right"><Skeleton className="h-8 w-16 ml-auto" /></td> : null}
                  </tr>
                ))
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={canManageKaryawan ? 6 : 5} className="px-4 py-8 text-center text-gray-400">Tidak ada data karyawan</td>
                </tr>
              ) : (
                filteredRows.map((r) => (
                  <tr 
                    key={r.karyawan.id}
                    onClick={() => {
                      setAbsenMap({})
                      setAbsenWorkMap({})
                      setAbsenOffMap({})
                      setAbsenNoteMap({})
                      setSelectedUser(r.karyawan)
                      setAbsenUserId(r.karyawan.id)
                      setTimeout(() => {
                        calendarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      }, 0)
                    }}
                    className={`hover:bg-gray-50/50 cursor-pointer transition-colors ${selectedUser?.id === r.karyawan.id ? 'bg-gray-50' : ''}`}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <div className="flex items-center gap-2">
                        {selectedUser?.id === r.karyawan.id && <div className="w-1 h-4 bg-gray-900 rounded-full" />}
                        {r.karyawan.photoUrl ? (
                          <img
                            src={r.karyawan.photoUrl}
                            alt={r.karyawan.name}
                            className="w-8 h-8 rounded-full object-cover border border-gray-200"
                          />
                        ) : (
                          <div className="w-8 h-8 bg-gray-900 rounded-full flex items-center justify-center text-white font-bold text-xs">
                            {r.karyawan.name.charAt(0)}
                          </div>
                        )}
                        <span className="capitalize">{r.karyawan.name}</span>
                        {r.karyawan.kebunId !== kebunId && (
                          <span
                            title={formatDipindahLabel(r.karyawan.kebunId)}
                            className="inline-flex items-center rounded-full bg-gray-100 text-gray-600 px-2 py-0.5 text-[10px] font-bold"
                          >
                            {formatDipindahLabel(r.karyawan.kebunId)}
                          </span>
                        )}
                        {r.karyawan.deleteRequestPending ? (
                          <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[10px] font-bold">
                            Permohonan hapus
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-600 font-medium">{r.hariKerja || 0} Hari</td>
                    <td className="px-4 py-3 text-right font-semibold">Rp {(r.totalGajiBelumDibayar || 0).toLocaleString('id-ID')}</td>
                    <td className="px-4 py-3 text-right text-emerald-600 font-semibold">Rp {(r.totalGajiDibayar || 0).toLocaleString('id-ID')}</td>
                    <td className="px-4 py-3 text-right text-red-600 font-semibold">Rp {(r.hutangSaldo || 0).toLocaleString('id-ID')}</td>
                    {canManageKaryawan ? (
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full"
                            onClick={(e) => {
                              e.stopPropagation()
                              openEditKaryawanModal(r.karyawan)
                            }}
                          >
                            <PencilSquareIcon className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full text-red-600 hover:bg-red-50"
                            onClick={(e) => {
                              e.stopPropagation()
                              requestDeleteKaryawan(r.karyawan.id)
                            }}
                            disabled={!!r.karyawan.deleteRequestPending}
                          >
                            <TrashIcon className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
            {filteredRows.length > 0 && (
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td colSpan={2} className="px-4 py-3 font-bold text-gray-900 text-right">TOTAL</td>
                  <td className="px-4 py-3 font-bold text-gray-900 text-right">Rp {totalGajiBerjalan.toLocaleString('id-ID')}</td>
                  <td className="px-4 py-3 font-bold text-emerald-700 text-right">Rp {totalGajiDibayar.toLocaleString('id-ID')}</td>
                  <td className="px-4 py-3 font-bold text-red-600 text-right">Rp {totalSaldoHutang.toLocaleString('id-ID')}</td>
                  {canManageKaryawan ? <td className="px-4 py-3" /> : null}
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {selectedUser && (
          <div ref={calendarRef} className="pt-6 border-t border-gray-100 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                {selectedUser.photoUrl ? (
                  <img
                    src={selectedUser.photoUrl}
                    alt={selectedUser.name}
                    className="w-10 h-10 rounded-full object-cover border border-gray-200"
                  />
                ) : (
                  <div className="w-10 h-10 bg-gray-900 rounded-full flex items-center justify-center text-white font-bold">
                    {selectedUser.name.charAt(0)}
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-bold text-gray-900 capitalize">{selectedUser.name}</h3>
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Kalender Absensi - {new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(absenMonth)}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="rounded-full text-gray-500 hover:text-gray-900" onClick={() => setSelectedUser(null)}>
                Tutup Kalender
              </Button>
            </div>

            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                      <CheckCircleIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Ringkasan Absensi</p>
                      <p className="text-xs text-gray-500">Rekap hari kerja dan biaya</p>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    Periode: <span className="font-semibold text-gray-900">{new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(absenMonth)}</span>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="rounded-xl bg-emerald-50/60 px-3 py-2">
                    <p className="text-xs text-emerald-700">Hari Kerja</p>
                    <p className="text-lg font-semibold text-gray-900">{absenSummary.hariKerja.toLocaleString('id-ID')} Hari</p>
                  </div>
                  <div className="rounded-xl bg-sky-50/70 px-3 py-2">
                    <p className="text-xs text-sky-700">Gaji Berjalan</p>
                    <p className="text-lg font-semibold text-gray-900">Rp {absenSummary.totalGaji.toLocaleString('id-ID')}</p>
                  </div>
                  <div className="rounded-xl bg-amber-50/70 px-3 py-2">
                    <p className="text-xs text-amber-700">Uang Makan</p>
                    <p className="text-lg font-semibold text-gray-900">Rp {absenSummary.totalMeal.toLocaleString('id-ID')}</p>
                  </div>
                  <div className="rounded-xl bg-emerald-50/60 px-3 py-2">
                    <p className="text-xs text-emerald-700">Saldo Hutang</p>
                    <p className="text-lg font-semibold text-gray-900">Rp {absenSummary.hutang.toLocaleString('id-ID')}</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center">
                  <h4 className="text-sm font-bold text-gray-400 capitalize tracking-widest">Detail Absensi</h4>
              </div>

              {/* Calendar Grid */}
              <div className="-mx-4 sm:mx-0 overflow-x-auto no-scrollbar pb-4">
                <div className="grid grid-cols-7 gap-1 sm:gap-2 min-w-[600px] md:min-w-0 px-4 sm:px-0">
                  {['Min','Sen','Sel','Rab','Kam','Jum','Sab'].map(d => (
                    <div key={d} className="text-center text-[10px] sm:text-xs font-bold text-gray-400 py-2">{d}</div>
                  ))}
                  {(() => {
                    const cells = []
                    const firstDay = new Date(absenMonth.getFullYear(), absenMonth.getMonth(), 1)
                    const startOffset = (firstDay.getDay() + 6) % 7
                    for (let i = 0; i < startOffset; i++) cells.push(<div key={`pad-${i}`} />)
                    
                    const daysInMonth = new Date(absenMonth.getFullYear(), absenMonth.getMonth() + 1, 0).getDate()
                    for (let d = 1; d <= daysInMonth; d++) {
                      const date = new Date(absenMonth.getFullYear(), absenMonth.getMonth(), d)
                      const key = formatDateKey(date)
                      const val = absenMap[key]
                      const num = Number((val || '').toString().replace(/\D/g, '')) || 0
                      const isOff = !!absenOffMap[key]
                      const isWork = !!absenWorkMap[key]
                      const isPaid = !!absenPaidMap[key]
                      const isFilled = !!val || isOff || isWork || !!absenNoteMap[key]
                      
                      cells.push(
                        <button
                          key={key}
                          onClick={() => {
                            setAbsenSelectedDate(key)
                            setAbsenValue(val ? formatRibuanId(val) : (absenDefaultAmount > 0 ? formatRibuanId(String(absenDefaultAmount)) : ''))
                            setAbsenWork(isWork || !!val || (absenDefaultAmount > 0 && !isOff))
                            setAbsenOff(isOff)
                            setAbsenNote(absenNoteMap[key] || '')
                            
                            if (isFilled) {
                              setOpenAbsenView(true)
                            } else if (!isPaid) {
                              setAbsenOpen(true)
                            } else {
                              // If paid but somehow not filled (unlikely), still show detail
                              setOpenAbsenView(true)
                            }
                          }}
                          className={`h-20 sm:h-24 md:h-28 rounded-xl sm:rounded-2xl border p-1.5 sm:p-2 text-left transition-all hover:ring-2 hover:ring-gray-200 relative group
                            ${isOff ? 'bg-red-50 border-red-100 text-red-700' : 
                              isPaid ? 'bg-purple-50 border-purple-100 text-purple-700' :
                              num > 0 ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 
                              'bg-white border-gray-100 text-gray-700'}`}
                        >
                          <div className="flex justify-between items-start mb-1 sm:mb-2">
                            <span className="text-[10px] sm:text-xs font-bold">{d}</span>
                            {isFilled && <CheckCircleIcon className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${isOff ? 'text-red-500' : isWork ? 'text-emerald-600' : 'text-blue-500'} opacity-40 group-hover:opacity-100`} />}
                          </div>
                          <div className="space-y-0.5 sm:space-y-1">
                            {isOff ? (
                              <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-tight">Libur</div>
                            ) : num > 0 ? (
                              <div className="flex flex-col">
                                <span className="text-[10px] sm:text-xs font-bold truncate">Rp {num.toLocaleString('id-ID')}</span>
                              </div>
                            ) : null}
                          </div>

                          {isPaid && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <span className="text-purple-700/15 font-black leading-none select-none whitespace-nowrap rotate-[-18deg] uppercase text-[clamp(12px,5vw,28px)] tracking-[0.18em]">
                                Lunas
                              </span>
                            </div>
                          )}
                          {absenNoteMap[key] && (
                            <div className="absolute bottom-1.5 right-1.5 w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-blue-400" title={absenNoteMap[key]} />
                          )}
                        </button>
                      )
                    }
                    return cells
                  })()}
                </div>
              </div>

              {/* Payment History */}
              <div className="mt-8 border-t border-gray-100 pt-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-gray-900 capitalize tracking-widest">Riwayat Pembayaran</h3>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="rounded-full text-blue-600"
                    onClick={() => setAbsenPayHistoryOpen(!absenPayHistoryOpen)}
                  >
                    {absenPayHistoryOpen ? 'Sembunyikan' : 'Lihat Semua'}
                  </Button>
                </div>

                {absenPayHistoryOpen && (
                  <>
                    <div className="md:hidden space-y-3">
                      {absenPayHistoryLoading ? (
                        <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center text-sm text-gray-400">
                          Memuat riwayat...
                        </div>
                      ) : absenPayHistoryRows.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center text-sm text-gray-500">
                          Belum ada riwayat pembayaran
                        </div>
                      ) : (
                        absenPayHistoryRows.map(r => (
                          <div key={`pay-${r.source || 'x'}-${r.paidAt}`} className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1">
                                <div className="text-xs text-gray-400">Periode</div>
                                <div className="font-semibold text-gray-900">
                                  {r.startDate === r.endDate 
                                    ? format(new Date(r.startDate), 'dd MMM yy', { locale: idLocale })
                                    : `${format(new Date(r.startDate), 'dd MMM', { locale: idLocale })} - ${format(new Date(r.endDate), 'dd MMM yy', { locale: idLocale })}`}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-full text-blue-600 hover:bg-blue-50"
                                onClick={() => openPayDetailModal(r)}
                              >
                                <EyeIcon className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <div className="text-gray-400">Tanggal Bayar</div>
                                <div className="font-medium text-gray-800">{format(new Date(r.paidAt), 'dd MMM yy', { locale: idLocale })}</div>
                              </div>
                              <div>
                                <div className="text-gray-400">Jumlah</div>
                                <div className="font-semibold text-gray-900">Rp {Number(r.jumlah).toLocaleString('id-ID')}</div>
                              </div>
                              <div>
                                <div className="text-gray-400">Potongan</div>
                                <div className="font-semibold text-red-600">Rp {Number(r.potonganHutang || 0).toLocaleString('id-ID')}</div>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="hidden md:block overflow-x-auto rounded-2xl border border-gray-100">
                      <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold text-gray-600">Periode</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-600">Tanggal Bayar</th>
                          <th className="px-4 py-3 text-right font-semibold text-gray-600">Jumlah</th>
                          <th className="px-4 py-3 text-right font-semibold text-gray-600">Potongan</th>
                          <th className="px-4 py-3 text-center font-semibold text-gray-600">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {absenPayHistoryLoading ? (
                          <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Memuat riwayat...</td></tr>
                        ) : absenPayHistoryRows.length === 0 ? (
                          <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Belum ada riwayat pembayaran</td></tr>
                        ) : (
                          absenPayHistoryRows.map(r => (
                            <tr key={`${r.source || 'x'}-${r.paidAt}`} className="hover:bg-gray-50/50">
                              <td className="px-4 py-3">
                                {r.startDate === r.endDate 
                                  ? format(new Date(r.startDate), 'dd MMM yy', { locale: idLocale })
                                  : `${format(new Date(r.startDate), 'dd MMM', { locale: idLocale })} - ${format(new Date(r.endDate), 'dd MMM yy', { locale: idLocale })}`}
                              </td>
                              <td className="px-4 py-3 text-gray-500">{format(new Date(r.paidAt), 'dd MMM yy', { locale: idLocale })}</td>
                              <td className="px-4 py-3 text-right font-medium">Rp {Number(r.jumlah).toLocaleString('id-ID')}</td>
                              <td className="px-4 py-3 text-right text-red-600">Rp {Number(r.potonganHutang || 0).toLocaleString('id-ID')}</td>
                              <td className="px-4 py-3 text-center">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-full text-blue-600 hover:bg-blue-50"
                                  onClick={() => openPayDetailModal(r)}
                                >
                                  <EyeIcon className="h-4 w-4" />
                                </Button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {!selectedUser && (
          <div className="flex flex-col items-center justify-center py-12 text-center bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
              <span className="text-2xl">☝️</span>
            </div>
            <h3 className="text-lg font-bold text-gray-900 capitalize">Pilih Karyawan</h3>
            <p className="text-gray-500 max-w-xs mt-1 text-sm">Klik pada baris tabel di atas untuk melihat detail absensi & penggajian.</p>
          </div>
        )}

        <div className="border-t border-gray-100 pt-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-4">
            <h3 className="text-sm md:text-base font-bold text-gray-900 capitalize tracking-widest">Daftar Hutang Karyawan</h3>
            <span className="text-xs text-gray-500">Periode {format(absenMonth, 'MMMM yyyy', { locale: idLocale })}</span>
          </div>
          <div className="md:hidden space-y-3">
            {loadingSummary ? (
              <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center text-sm text-gray-400">
                Memuat data...
              </div>
            ) : hutangList.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center text-sm text-gray-500">
                Tidak ada data karyawan
              </div>
            ) : (
              hutangList.map((r) => (
                <div key={`hutang-card-${r.karyawan.id}`} className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="font-semibold text-gray-900">{r.karyawan.name}</div>
                      <div className="text-xs text-gray-500">Saldo Hutang</div>
                      <div className="font-semibold text-red-600">Rp {(r.hutangSaldo || 0).toLocaleString('id-ID')}</div>
                    </div>
                    <div className="text-right text-xs">
                      <div className="text-gray-400">Saldo Sebelum Potong</div>
                      <div className="font-semibold text-gray-800">
                        {r.lastPotongan?.jumlah
                          ? `Rp ${Math.round((r.hutangSaldo || 0) + r.lastPotongan.jumlah).toLocaleString('id-ID')}`
                          : '-'}
                      </div>
                      <div className="text-gray-400 mt-2">Potongan Terakhir</div>
                      <div className="font-semibold text-emerald-600">
                        {r.lastPotongan?.jumlah ? `Rp ${Math.round(r.lastPotongan.jumlah).toLocaleString('id-ID')}` : '-'}
                      </div>
                    </div>
                  </div>
                  {canSeeDebtDetail ? (
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" className="rounded-full" onClick={() => handleOpenDetailHutang(r.karyawan)}>
                        Detail
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">-</span>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="hidden md:block overflow-x-auto rounded-2xl border border-gray-100">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Karyawan</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">Saldo Sebelum Potong</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">Potongan Terakhir</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">Saldo Hutang</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-600">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loadingSummary ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Memuat data...</td></tr>
                ) : hutangList.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Tidak ada data karyawan</td></tr>
                ) : (
                  hutangList.map((r) => (
                    <tr key={`hutang-${r.karyawan.id}`}>
                      <td className="px-4 py-3 font-medium text-gray-900">{r.karyawan.name}</td>
                      <td className="px-4 py-3 text-right text-gray-700 font-semibold">
                        {r.lastPotongan?.jumlah
                          ? `Rp ${Math.round((r.hutangSaldo || 0) + r.lastPotongan.jumlah).toLocaleString('id-ID')}`
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-600 font-semibold">
                        {r.lastPotongan?.jumlah ? `Rp ${Math.round(r.lastPotongan.jumlah).toLocaleString('id-ID')}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-right text-red-600 font-semibold">Rp {(r.hutangSaldo || 0).toLocaleString('id-ID')}</td>
                      <td className="px-4 py-3 text-center">
                        {canSeeDebtDetail ? (
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-full"
                              onClick={() => handleOpenDetailHutang(r.karyawan)}
                            >
                              Detail
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Dialog open={openAbsenView} onOpenChange={setOpenAbsenView}>
        <DialogContent className="w-[92vw] sm:w-full sm:max-w-md bg-white rounded-3xl p-0 overflow-hidden shadow-2xl border-none [&>button.absolute]:hidden">
          <ModalHeader
            title={selectedUser?.name || 'Detail Absensi'}
            subtitle={absenSelectedDate ? format(new Date(absenSelectedDate), 'EEEE, dd MMMM yyyy', { locale: idLocale }) : ''}
            variant="emerald"
            onClose={() => setOpenAbsenView(false)}
          />

          <ModalContentWrapper className="space-y-5" id="absen-view-content-kebun">
            <div className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 border border-gray-100">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${absenOffMap[absenSelectedDate] ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                  <CheckCircleIcon className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Status</p>
                  <p className="font-bold text-gray-900">
                    {absenOffMap[absenSelectedDate] ? 'Libur' : 'Masuk Kerja'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total Gaji</p>
                <p className="font-bold text-emerald-600 text-lg">
                  Rp {(() => {
                    const val = absenMap[absenSelectedDate] || '0'
                    return Number(val.replace(/\./g, '').replace(/,/g, '')).toLocaleString('id-ID')
                  })()}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Status Pembayaran</p>
                {absenPaidMap[absenSelectedDate] ? (
                  <div className="flex items-center gap-1.5 text-purple-600 font-bold text-sm">
                    <BanknotesIcon className="w-4 h-4" />
                    Sudah Dibayar
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-amber-600 font-bold text-sm">
                    <ClockIcon className="w-4 h-4" />
                    Belum Dibayar
                  </div>
                )}
              </div>
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Metode Upah</p>
                <div className="flex items-center gap-1.5 text-blue-600 font-bold text-sm">
                  <CurrencyDollarIcon className="w-4 h-4" />
                  {absenHourlyMap[absenSelectedDate] ? 'Per Jam' : 'Harian'}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm p-2 px-3 bg-gray-50 rounded-lg border border-gray-100">
                <span className="text-gray-500 font-medium">Upah Harian:</span>
                <span className="font-bold text-gray-900">
                  {!absenHourlyMap[absenSelectedDate] ? `Rp ${Number(absenMap[absenSelectedDate]?.replace(/\./g, '') || 0).toLocaleString('id-ID')}` : '-'}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm p-2 px-3 bg-gray-50 rounded-lg border border-gray-100">
                <span className="text-gray-500 font-medium">Upah Per Jam:</span>
                <span className="font-bold text-gray-900">
                  {absenHourlyMap[absenSelectedDate] ? (
                    `${absenHourMap[absenSelectedDate] || 0} jam × Rp ${Number(absenRateMap[absenSelectedDate]?.replace(/\./g, '') || 0).toLocaleString('id-ID')}`
                  ) : '-'}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm p-2 px-3 bg-gray-50 rounded-lg border border-gray-100">
                <span className="text-gray-500 font-medium">Uang Makan:</span>
                <span className="font-bold text-gray-900">
                  {absenMealEnabledMap[absenSelectedDate] ? (
                    `Rp ${Number(absenMealMap[absenSelectedDate]?.replace(/\./g, '') || 0).toLocaleString('id-ID')}`
                  ) : '-'}
                </span>
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider ml-1">Keterangan</p>
                <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-100 text-gray-700 text-sm leading-relaxed min-h-[44px]">
                  {absenNoteMap[absenSelectedDate] || '-'}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                size="icon"
                className="rounded-xl w-10 h-10 border-blue-200 text-blue-600 hover:bg-blue-50 transition-all shadow-sm"
                title="Export PDF"
                onClick={async () => {
                  const html2canvas = (await import('html2canvas')).default;
                  const jsPDF = (await import('jspdf')).jsPDF;
                  
                  const pdfContainer = document.createElement('div');
                  pdfContainer.style.position = 'fixed';
                  pdfContainer.style.left = '-9999px';
                  pdfContainer.style.top = '0';
                  pdfContainer.style.width = '210mm'; // A4 width
                  pdfContainer.style.backgroundColor = '#ffffff';
                  pdfContainer.style.padding = '20mm';
                  pdfContainer.style.fontFamily = 'sans-serif';
                  pdfContainer.style.color = '#000000';
                  
                  const dateStr = absenSelectedDate ? format(new Date(absenSelectedDate), 'EEEE, dd MMMM yyyy', { locale: idLocale }) : '';
                  const totalGaji = (() => {
                    const val = absenMap[absenSelectedDate] || '0';
                    return Number(val.replace(/\./g, '').replace(/,/g, '')).toLocaleString('id-ID');
                  })();

                  pdfContainer.innerHTML = `
                    <div style="border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px;">
                      <h1 style="font-size: 24px; margin: 0; color: #059669;">LAPORAN ABSENSI HARIAN</h1>
                      <p style="font-size: 14px; margin: 5px 0 0 0; color: #666;">Dicetak pada: ${format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
                    </div>
                    
                    <div style="margin-bottom: 30px;">
                      <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                          <td style="width: 150px; padding: 8px 0; font-weight: bold; color: #4b5563;">Nama Karyawan</td>
                          <td style="padding: 8px 0;">: ${selectedUser?.name || '-'}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; font-weight: bold; color: #4b5563;">Tanggal</td>
                          <td style="padding: 8px 0;">: ${dateStr}</td>
                        </tr>
                      </table>
                    </div>

                    <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
                      <h2 style="font-size: 18px; margin: 0 0 15px 0; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px;">Ringkasan Pekerjaan</h2>
                      <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                          <td style="padding: 8px 0; color: #4b5563;">Status Kehadiran</td>
                          <td style="padding: 8px 0; font-weight: bold; text-align: right;">${absenOffMap[absenSelectedDate] ? 'Libur' : 'Masuk Kerja'}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #4b5563;">Metode Upah</td>
                          <td style="padding: 8px 0; font-weight: bold; text-align: right;">${absenHourlyMap[absenSelectedDate] ? 'Per Jam' : 'Harian'}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #4b5563;">Status Pembayaran</td>
                          <td style="padding: 8px 0; font-weight: bold; text-align: right; color: ${absenPaidMap[absenSelectedDate] ? '#7c3aed' : '#d97706'};">${absenPaidMap[absenSelectedDate] ? 'SUDAH DIBAYAR' : 'BELUM DIBAYAR'}</td>
                        </tr>
                        <tr style="border-top: 1px solid #e5e7eb;">
                          <td style="padding: 15px 0 8px 0; font-size: 18px; font-weight: bold;">TOTAL GAJI</td>
                          <td style="padding: 15px 0 8px 0; font-size: 20px; font-weight: bold; text-align: right; color: #059669;">Rp ${totalGaji}</td>
                        </tr>
                      </table>
                    </div>

                    <div style="margin-bottom: 30px;">
                      <h2 style="font-size: 16px; margin: 0 0 10px 0; color: #4b5563;">Rincian Gaji:</h2>
                      <div style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                          <tr style="background-color: #f3f4f6;">
                            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">Upah Harian</td>
                            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold;">${!absenHourlyMap[absenSelectedDate] ? `Rp ${Number(absenMap[absenSelectedDate]?.replace(/\./g, '') || 0).toLocaleString('id-ID')}` : '-'}</td>
                          </tr>
                          <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">Upah Per Jam</td>
                            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold;">${absenHourlyMap[absenSelectedDate] ? `${absenHourMap[absenSelectedDate] || 0} jam × Rp ${Number(absenRateMap[absenSelectedDate]?.replace(/\./g, '') || 0).toLocaleString('id-ID')}` : '-'}</td>
                          </tr>
                          <tr style="background-color: #f3f4f6;">
                            <td style="padding: 10px;">Uang Makan</td>
                            <td style="padding: 10px; text-align: right; font-weight: bold;">${absenMealEnabledMap[absenSelectedDate] ? `Rp ${Number(absenMealMap[absenSelectedDate]?.replace(/\./g, '') || 0).toLocaleString('id-ID')}` : '-'}</td>
                          </tr>
                        </table>
                      </div>
                    </div>

                    <div>
                      <h2 style="font-size: 16px; margin: 0 0 10px 0; color: #4b5563;">Keterangan:</h2>
                      <div style="padding: 15px; background-color: #f0fdf4; border: 1px solid #dcfce7; border-radius: 8px; font-size: 14px; color: #166534; min-height: 60px;">
                        ${absenNoteMap[absenSelectedDate] || '-'}
                      </div>
                    </div>

                    <div style="margin-top: 50px; text-align: right; font-size: 12px; color: #9ca3af;">
                      <p>Dokumen ini dihasilkan secara otomatis oleh Sistem Aplikasi Sarakan.</p>
                    </div>
                  `;

                  document.body.appendChild(pdfContainer);

                  const canvas = await html2canvas(pdfContainer, { 
                    logging: false,
                    useCORS: true,
                    backgroundColor: '#ffffff',
                    scale: 2
                  } as any);

                  const imgData = canvas.toDataURL('image/png');
                  const pdf = new jsPDF('p', 'mm', 'a4');
                  const pdfWidth = pdf.internal.pageSize.getWidth();
                  const imgProps = pdf.getImageProperties(imgData);
                  const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
                  
                  pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
                  pdf.save(`Laporan_Absensi_${selectedUser?.name || 'Karyawan'}_${absenSelectedDate}.pdf`);
                  
                  document.body.removeChild(pdfContainer);
                }}
              >
                <ArrowDownTrayIcon className="w-4 h-4" />
              </Button>
              {absenPaidMap[absenSelectedDate] ? null : (
                <>
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-xl w-10 h-10 border-blue-200 text-blue-600 hover:bg-blue-50 transition-all shadow-sm"
                    title="Edit Data"
                    onClick={() => {
                      setOpenAbsenView(false);
                      setAbsenOpen(true);
                    }}
                  >
                    <PencilSquareIcon className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-xl w-10 h-10 border-red-200 text-red-500 hover:bg-red-50 transition-all shadow-sm"
                    title="Hapus Data"
                    disabled={isDeletingAbsen}
                    onClick={() => setOpenDeleteAbsenConfirm(true)}
                  >
                    <TrashIcon className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>
          </ModalContentWrapper>
        </DialogContent>
      </Dialog>

      <ConfirmationModal
        isOpen={openDeleteAbsenConfirm}
        onClose={() => setOpenDeleteAbsenConfirm(false)}
        title="Hapus Absensi"
        variant="emerald"
        description={`Apakah Anda yakin ingin menghapus data absensi tanggal ${absenSelectedDate ? format(new Date(absenSelectedDate), 'dd MMMM yyyy', { locale: idLocale }) : ''}? Tindakan ini tidak dapat dibatalkan.`}
        onConfirm={async () => {
          if (!kebunId || !absenUserId || !absenSelectedDate) return;
          
          setIsDeletingAbsen(true);
          try {
            const res = await fetch(`/api/karyawan-kebun/absensi?kebunId=${kebunId}&karyawanId=${absenUserId}&date=${absenSelectedDate}`, {
              method: 'DELETE'
            });
            if (res.ok) {
              const nextAmount = { ...absenMap }; delete nextAmount[absenSelectedDate];
              const nextWork = { ...absenWorkMap }; delete nextWork[absenSelectedDate];
              const nextOff = { ...absenOffMap }; delete nextOff[absenSelectedDate];
              const nextNote = { ...absenNoteMap }; delete nextNote[absenSelectedDate];
              
              setAbsenMap(nextAmount);
              setAbsenWorkMap(nextWork);
              setAbsenOffMap(nextOff);
              setAbsenNoteMap(nextNote);
              
              const ym = `${absenMonth.getFullYear()}-${String(absenMonth.getMonth() + 1).padStart(2, '0')}`
              const storageKey = `absensi:v2:${kebunId}:${absenUserId}:${ym}`
              localStorage.setItem(storageKey, JSON.stringify({
                amount: nextAmount,
                work: nextWork,
                off: nextOff,
                note: nextNote
              }))

              toast.success('Absensi dihapus');
              setOpenAbsenView(false);
              await mutateSummary();
            } else {
              toast.error('Gagal menghapus data');
            }
          } catch {
            toast.error('Kesalahan jaringan');
          } finally {
            setIsDeletingAbsen(false);
            setOpenDeleteAbsenConfirm(false);
          }
        }}
      />

      {/* Daily Input Modal */}
      <Dialog open={absenOpen} onOpenChange={setAbsenOpen}>
        <DialogContent className="max-w-md bg-white rounded-3xl p-0 overflow-hidden max-h-[90vh] overflow-y-auto [&>button.absolute]:hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <ModalHeader
            title="Input Absensi"
            subtitle={absenSelectedDate ? format(new Date(absenSelectedDate), 'EEEE, dd MMMM yyyy', { locale: idLocale }) : ''}
            variant="emerald"
            onClose={() => setAbsenOpen(false)}
          />
          <div className="space-y-6 px-6 py-5">
            {absenSelectedDate && absenPaidMap[absenSelectedDate] ? (
              <div className="rounded-2xl border border-purple-100 bg-purple-50 px-4 py-3 text-sm text-purple-800">
                Absensi sudah dibayar, jadi tidak bisa diubah.
              </div>
            ) : null}
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 border border-gray-100">
                <div className="space-y-0.5">
                  <Label className="text-sm font-semibold">Masuk Kerja</Label>
                  <p className="text-xs text-gray-500">Karyawan hadir bekerja</p>
                </div>
                <Switch 
                  checked={absenWork} 
                  disabled={!!(absenSelectedDate && absenPaidMap[absenSelectedDate])}
                  onCheckedChange={(v) => { 
                    setAbsenWork(v); 
                    if (v) { 
                      setAbsenOff(false); 
                    } else {
                      setAbsenValue('0');
                      setAbsenUseHourly(false);
                      setAbsenHour('');
                      setAbsenRate('');
                      setAbsenMealEnabled(false);
                      setAbsenMealAmount('');
                    }
                  }} 
                />
              </div>
              <div className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 border border-gray-100">
                <div className="space-y-0.5">
                  <Label className="text-sm font-semibold">Libur</Label>
                  <p className="text-xs text-gray-500">Karyawan tidak hadir</p>
                </div>
                <Switch 
                  checked={absenOff} 
                  disabled={!!(absenSelectedDate && absenPaidMap[absenSelectedDate])}
                  onCheckedChange={(v) => { 
                    setAbsenOff(v); 
                    if (v) { 
                      setAbsenWork(false); 
                      setAbsenValue('0'); 
                      setAbsenUseHourly(false);
                      setAbsenHour('');
                      setAbsenRate('');
                      setAbsenMealEnabled(false);
                      setAbsenMealAmount('');
                    }
                  }} 
                />
              </div>
            </div>

            {!absenOff && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Upah Harian (Rp)</Label>
                  <Input
                    className="rounded-xl h-12 text-lg font-bold"
                    placeholder="0"
                    value={absenValue}
                    onChange={(e) => setAbsenValue(formatRibuanId(e.target.value))}
                    disabled={!!(absenSelectedDate && absenPaidMap[absenSelectedDate])}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 border border-gray-100">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-semibold">Hitung per jam</Label>
                    <p className="text-xs text-gray-500">Gunakan rate per jam</p>
                  </div>
                  <Switch
                    checked={absenUseHourly}
                    onCheckedChange={setAbsenUseHourly}
                    disabled={!!(absenSelectedDate && absenPaidMap[absenSelectedDate])}
                  />
                </div>

                {absenUseHourly && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Jam Kerja</Label>
                      <Input
                        type="number"
                        step="0.5"
                        className="rounded-xl h-11"
                        value={absenHour}
                        onChange={e => setAbsenHour(e.target.value)}
                        placeholder="7.5"
                        disabled={!!(absenSelectedDate && absenPaidMap[absenSelectedDate])}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Rate/Jam</Label>
                      <Input
                        className="rounded-xl h-11"
                        value={absenRate}
                        onChange={e => setAbsenRate(formatRibuanId(e.target.value))}
                        placeholder="15.000"
                        disabled={!!(absenSelectedDate && absenPaidMap[absenSelectedDate])}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 border border-gray-100">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-semibold">Uang Makan</Label>
                      <p className="text-xs text-gray-500">Opsional tambahan</p>
                    </div>
                    <Switch
                      checked={absenMealEnabled}
                      onCheckedChange={setAbsenMealEnabled}
                      disabled={!!(absenSelectedDate && absenPaidMap[absenSelectedDate])}
                    />
                  </div>
                  {absenMealEnabled && (
                    <Input
                      className="rounded-xl h-11"
                      value={absenMealAmount}
                      onChange={e => setAbsenMealAmount(formatRibuanId(e.target.value))}
                      placeholder="contoh: 20.000"
                      disabled={!!(absenSelectedDate && absenPaidMap[absenSelectedDate])}
                    />
                  )}
                </div>

                <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Input Rupiah</span>
                    <span className="font-semibold text-gray-900">Rp {(() => {
                      const manual = Number((absenValue || '').toString().replace(/\./g, '').replace(/,/g, '')) || 0
                      return manual ? manual.toLocaleString('id-ID') : 0
                    })()}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Hitung Per Jam</span>
                    <span className="font-semibold text-gray-900">Rp {(() => {
                      if (!absenUseHourly) return 0
                      const hourly = (parseFloat((absenHour || '').toString().replace(',', '.')) || 0) * (Number((absenRate || '').toString().replace(/\./g, '').replace(/,/g, '')) || 0)
                      return Math.round(hourly).toLocaleString('id-ID')
                    })()}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Uang Makan</span>
                    <span className="font-semibold text-gray-900">Rp {(() => {
                      const meal = !absenMealEnabled ? 0 : Number((absenMealAmount || '').toString().replace(/\./g, '').replace(/,/g, '')) || 0
                      return Math.round(meal).toLocaleString('id-ID')
                    })()}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-200">
                    <span className="text-gray-900 font-bold">TOTAL AKHIR</span>
                    <span className="font-bold text-emerald-600 text-lg">Rp {(() => {
                      const manual = Number((absenValue || '').toString().replace(/\./g, '').replace(/,/g, '')) || 0
                      const hourly = !absenUseHourly ? 0 : (parseFloat((absenHour || '').toString().replace(',', '.')) || 0) * (Number((absenRate || '').toString().replace(/\./g, '').replace(/,/g, '')) || 0)
                      const meal = !absenMealEnabled ? 0 : Number((absenMealAmount || '').toString().replace(/\./g, '').replace(/,/g, '')) || 0
                      return Math.round(manual + hourly + meal).toLocaleString('id-ID')
                    })()}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Keterangan (Opsional)</Label>
              <Input
                className="rounded-xl"
                placeholder="Contoh: Lembur, Izin, dll"
                value={absenNote}
                onChange={(e) => setAbsenNote(e.target.value)}
                disabled={!!(absenSelectedDate && absenPaidMap[absenSelectedDate])}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" className="rounded-full" onClick={() => setAbsenOpen(false)}>Batal</Button>
            <Button 
              className="rounded-full bg-emerald-600 text-white hover:bg-emerald-700 px-8" 
              onClick={handleSaveAbsen}
              disabled={absenSaving || !!(absenSelectedDate && absenPaidMap[absenSelectedDate])}
            >
              {absenSaving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pay Gaji Modal */}
      <Dialog open={absenPayOpen} onOpenChange={setAbsenPayOpen}>
        <DialogContent className="max-w-md bg-white rounded-3xl p-0 overflow-hidden [&>button.absolute]:hidden">
          <DialogHeader className="relative">
            <DialogTitle className="text-xl font-bold">Bayar Gaji</DialogTitle>
            <button
              type="button"
              onClick={() => setAbsenPayOpen(false)}
              className="absolute right-6 top-1/2 -translate-y-1/2 h-9 w-9 rounded-md border border-white/70 bg-white text-blue-600 flex items-center justify-center hover:bg-white/90"
              aria-label="Tutup"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </DialogHeader>
          <div className="space-y-6 px-6 py-5">
            <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100">
              <p className="text-xs font-medium text-blue-600 uppercase tracking-wider mb-1">Total Gaji Terpilih</p>
              <p className="text-2xl font-bold text-blue-900">
                Rp {unpaidDates.reduce((acc, d) => acc + (absenPaySelection[d.date] ? d.amount : 0), 0).toLocaleString('id-ID')}
              </p>
              <p className="text-xs text-blue-600 mt-1">{Object.values(absenPaySelection).filter(Boolean).length} hari kerja dipilih</p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Potongan Hutang (Rp)</Label>
              <Input
                className="rounded-xl h-12 text-lg font-bold text-red-600"
                placeholder="0"
                value={absenPayPotong}
                onChange={(e) => setAbsenPayPotong(formatRibuanId(e.target.value))}
              />
              <div className="text-xs text-gray-500 space-y-1">
                <p>Saldo hutang saat ini: Rp {hutangBeforePay.toLocaleString('id-ID')}</p>
                {potongPayEffective > 0 && (
                  <p>Potong efektif: Rp {potongPayEffective.toLocaleString('id-ID')} • Sisa: Rp {hutangAfterPay.toLocaleString('id-ID')}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Keterangan</Label>
              <Input
                className="rounded-xl"
                value={absenPayPotongDesc}
                onChange={(e) => setAbsenPayPotongDesc(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" className="rounded-full" onClick={() => setAbsenPayOpen(false)}>Batal</Button>
            <Button 
              className="rounded-full bg-gray-900 text-white hover:bg-gray-800 px-8" 
              onClick={handlePayGaji}
            >
              Konfirmasi Bayar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openDetailHutang} onOpenChange={(open) => { if (!open) { setOpenDetailHutang(false); setDetailTarget(null); setDetailRows([]) } else { setOpenDetailHutang(true) } }}>
        <DialogContent className="bg-white max-w-3xl max-h-[90vh] overflow-y-auto p-0 [&>button.absolute]:hidden">
          <DialogHeader className="relative">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <DialogTitle>Detail Hutang & Potongan</DialogTitle>
            </div>
            <button
              type="button"
              onClick={() => { setOpenDetailHutang(false); setDetailTarget(null); setDetailRows([]) }}
              className="absolute right-6 top-1/2 -translate-y-1/2 h-9 w-9 rounded-md border border-white/70 bg-white text-blue-600 flex items-center justify-center hover:bg-white/90"
              aria-label="Tutup"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </DialogHeader>
          <div className="space-y-4 px-6 py-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
              <div className="text-sm text-gray-500">
                Karyawan: <span className="font-semibold text-gray-900">{detailTarget?.name || '-'}</span>
              </div>
              <div className="text-xs text-gray-500">
                Total Hutang: <span className="font-semibold text-gray-900">Rp {Math.round(totalHutangDetail).toLocaleString('id-ID')}</span> •
                Potongan: <span className="font-semibold text-gray-900">Rp {Math.round(totalPotonganDetail).toLocaleString('id-ID')}</span> •
                Sisa: <span className="font-semibold text-gray-900">Rp {Math.round(sisaHutangDetail).toLocaleString('id-ID')}</span>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-gray-100">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Tanggal</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600">Hutang</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600">Potongan</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600">Sisa</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {detailLoading ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Memuat detail...</td></tr>
                  ) : detailRows.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Belum ada transaksi hutang</td></tr>
                  ) : (
                    (() => {
                      let running = 0
                      return detailRows.map((d) => {
                        const isHutang = d.kategori === 'HUTANG_KARYAWAN'
                        const isPotongan = d.kategori === 'PEMBAYARAN_HUTANG'
                        const hutangAmount = isHutang ? Number(d.jumlah || 0) : 0
                        const potongAmount = isPotongan ? Number(d.jumlah || 0) : 0
                        running = running + hutangAmount - potongAmount
                        const sisa = Math.max(0, Math.round(running))
                        return (
                          <tr key={d.id}>
                            <td className="px-4 py-3">{format(new Date(d.date), 'dd MMM yy', { locale: idLocale })}</td>
                            <td className="px-4 py-3 text-right text-red-600">{isHutang ? `Rp ${Math.round(d.jumlah).toLocaleString('id-ID')}` : '-'}</td>
                            <td className="px-4 py-3 text-right text-emerald-600">{isPotongan ? `Rp ${Math.round(d.jumlah).toLocaleString('id-ID')}` : '-'}</td>
                            <td className="px-4 py-3 text-right font-semibold text-gray-900">Rp {sisa.toLocaleString('id-ID')}</td>
                            <td className="px-4 py-3">{d.deskripsi || '-'}</td>
                          </tr>
                        )
                      })
                    })()
                  )}
                </tbody>
                {detailRows.length > 0 && (
                  <tfoot className="bg-gray-50 border-t border-gray-200">
                    <tr>
                      <td className="px-4 py-3 font-bold text-gray-900">TOTAL</td>
                      <td className="px-4 py-3 text-right font-bold text-red-600">Rp {Math.round(totalHutangDetail).toLocaleString('id-ID')}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-700">Rp {Math.round(totalPotonganDetail).toLocaleString('id-ID')}</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">Rp {Math.round(sisaHutangDetail).toLocaleString('id-ID')}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
          <DialogFooter className="bg-gray-50 border-t px-6 py-4 flex items-center justify-between gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => { setOpenDetailHutang(false); setDetailTarget(null); setDetailRows([]) }}>
              Tutup
            </Button>
            <Button
              variant="outline"
              className="rounded-full bg-white text-blue-600 border-gray-200 hover:bg-gray-50"
              onClick={handleExportDetailHutang}
              disabled={detailExporting}
            >
              {detailExporting ? 'Mencetak...' : 'Cetak PDF'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openAddKaryawan} onOpenChange={setOpenAddKaryawan}>
        <DialogContent className="w-[92vw] sm:max-w-md p-0 overflow-hidden [&>button.absolute]:hidden">
          <ModalHeader
            title="Tambah Karyawan Kebun"
            variant="emerald"
            icon={<PlusIcon className="h-5 w-5 text-white" />}
            onClose={() => setOpenAddKaryawan(false)}
          />

          <ModalContentWrapper className="space-y-4">
            <div className="text-xs text-gray-500">Karyawan akan otomatis terhubung ke kebun ini.</div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Nama</Label>
              <Input
                className="rounded-xl h-11"
                value={addKaryawanName}
                onChange={(e) => setAddKaryawanName(e.target.value)}
                placeholder="Nama karyawan"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Status</Label>
              <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 h-11">
                <div className="text-sm text-gray-700">{addKaryawanStatus === 'AKTIF' ? 'Aktif' : 'Nonaktif'}</div>
                <Switch
                  checked={addKaryawanStatus === 'AKTIF'}
                  onCheckedChange={(checked) => setAddKaryawanStatus(checked ? 'AKTIF' : 'NONAKTIF')}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Foto Profil (Opsional)</Label>
              <ImageUpload
                previewUrl={addKaryawanPhotoPreview}
                onFileChange={(file) => {
                  setAddKaryawanPhotoFile(file)
                  if (!file) {
                    setAddKaryawanPhotoPreview(null)
                    return
                  }
                  setAddKaryawanPhotoPreview(URL.createObjectURL(file))
                }}
              />
            </div>
          </ModalContentWrapper>

          <ModalFooter>
            <Button type="button" variant="outline" onClick={() => setOpenAddKaryawan(false)} className="rounded-full" disabled={addKaryawanLoading}>
              <XMarkIcon className="h-4 w-4 mr-2" />
              Batal
            </Button>
            <Button type="button" className="rounded-full bg-emerald-600 hover:bg-emerald-700" onClick={handleCreateKaryawan} disabled={addKaryawanLoading}>
              <CheckIcon className="h-4 w-4 mr-2" />
              {addKaryawanLoading ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </ModalFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openEditKaryawan} onOpenChange={setOpenEditKaryawan}>
        <DialogContent className="w-[92vw] sm:w-full sm:max-w-lg max-h-[92vh] rounded-2xl p-0 overflow-hidden [&>button.absolute]:hidden flex flex-col">
          <ModalHeader
            title="Edit Karyawan"
            variant="emerald"
            icon={<PencilSquareIcon className="h-5 w-5 text-white" />}
            onClose={() => setOpenEditKaryawan(false)}
          />
          <ModalContentWrapper className="space-y-4 overflow-y-auto">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Nama</Label>
              <Input
                value={editKaryawanName}
                onChange={(e) => setEditKaryawanName(e.target.value)}
                placeholder="Nama karyawan"
                className="rounded-full h-10"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Status</Label>
              <div className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-4">
                <div className="text-sm text-gray-700">{editKaryawanStatus === 'AKTIF' ? 'Aktif' : 'Nonaktif'}</div>
                <Switch
                  checked={editKaryawanStatus === 'AKTIF'}
                  onCheckedChange={(checked) => setEditKaryawanStatus(checked ? 'AKTIF' : 'NONAKTIF')}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Foto Profil (Opsional)</Label>
              <ImageUpload
                previewUrl={editKaryawanPhotoPreview}
                onFileChange={(file) => {
                  setEditKaryawanPhotoFile(file)
                  if (!file) {
                    setEditKaryawanPhotoPreview(null)
                    return
                  }
                  setEditKaryawanPhotoPreview(URL.createObjectURL(file))
                }}
              />
            </div>
          </ModalContentWrapper>
          <ModalFooter className="sm:justify-end">
            <Button className="rounded-full w-full sm:w-auto" variant="outline" onClick={() => setOpenEditKaryawan(false)}>Batal</Button>
            <Button className="rounded-full w-full sm:w-auto bg-emerald-600 text-white hover:bg-emerald-700" onClick={handleUpdateKaryawan} disabled={editKaryawanSubmitting}>
              Simpan
            </Button>
          </ModalFooter>
        </DialogContent>
      </Dialog>

      <ConfirmationModal
        isOpen={openDeleteKaryawan}
        onClose={() => { setOpenDeleteKaryawan(false); setDeleteKaryawanId(null) }}
        onConfirm={handleConfirmDeleteKaryawan}
        title="Konfirmasi Hapus Karyawan"
        description="Permintaan Anda akan dikirim untuk persetujuan admin/pemilik."
        variant="emerald"
      />

      <Dialog open={openPayDetail} onOpenChange={setOpenPayDetail}>
        <DialogContent className="w-[92vw] sm:w-full sm:max-w-2xl max-h-[92vh] rounded-2xl p-0 overflow-hidden [&>button.absolute]:hidden flex flex-col">
          <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-500 text-white flex items-center justify-between">
            <DialogTitle className="text-white">Detail Pembayaran Gaji</DialogTitle>
            <button
              type="button"
              onClick={() => setOpenPayDetail(false)}
              className="h-9 w-9 rounded-full border border-white/30 bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
              aria-label="Tutup"
              title="Tutup"
            >
              <XMarkIcon className="h-5 w-5 text-white" />
            </button>
          </div>
          <div className="px-6 py-5 space-y-4 overflow-y-auto">
            {payDetailLoading ? (
              <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center text-sm text-gray-400">
                Memuat detail...
              </div>
            ) : !payDetail?.summary ? (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center text-sm text-gray-500">
                Detail tidak tersedia
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl border border-gray-100 bg-white p-4">
                    <div className="text-xs text-gray-500">Karyawan</div>
                    <div className="font-semibold text-gray-900">{payDetail.summary.userName || selectedUser?.name || '-'}</div>
                    <div className="text-xs text-gray-500 mt-2">Periode</div>
                    <div className="font-medium text-gray-800">
                      {payDetail.summary.startDate === payDetail.summary.endDate
                        ? format(new Date(payDetail.summary.startDate), 'dd MMM yy', { locale: idLocale })
                        : `${format(new Date(payDetail.summary.startDate), 'dd MMM', { locale: idLocale })} - ${format(new Date(payDetail.summary.endDate), 'dd MMM yy', { locale: idLocale })}`}
                    </div>
                    <div className="text-xs text-gray-500 mt-2">Tanggal Bayar</div>
                    <div className="font-medium text-gray-800">{format(new Date(payDetail.summary.paidAt), 'dd MMM yy HH:mm', { locale: idLocale })}</div>
                  </div>
                  <div className="rounded-2xl border border-gray-100 bg-white p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 text-xs">Jumlah</span>
                      <span className="font-semibold text-gray-900">Rp {Number(payDetail.summary.jumlah || 0).toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 text-xs">Potongan Hutang</span>
                      <span className="font-semibold text-red-600">Rp {Number(payDetail.summary.potonganHutang || 0).toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-gray-100 pt-2">
                      <span className="text-gray-500 text-xs">Sisa Gaji</span>
                      <span className="font-semibold text-emerald-700">Rp {Number(payDetail.summary.sisa || 0).toLocaleString('id-ID')}</span>
                    </div>
                    {payDetail.summary.deskripsi ? (
                      <div className="text-xs text-gray-500 pt-2 border-t border-gray-100">{payDetail.summary.deskripsi}</div>
                    ) : null}
                  </div>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-gray-100">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-gray-600">Tanggal</th>
                        <th className="px-4 py-3 text-right font-semibold text-gray-600">Gaji</th>
                        <th className="px-4 py-3 text-right font-semibold text-gray-600">Potongan</th>
                        <th className="px-4 py-3 text-right font-semibold text-gray-600">Sisa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(Array.isArray(payDetail.items) ? payDetail.items : []).map((it: any) => (
                        <tr key={it.date}>
                          <td className="px-4 py-3">{format(new Date(it.date), 'dd MMM yy', { locale: idLocale })}</td>
                          <td className="px-4 py-3 text-right">Rp {Number(it.jumlah || 0).toLocaleString('id-ID')}</td>
                          <td className="px-4 py-3 text-right text-red-600">Rp {Number(it.potonganHutang || 0).toLocaleString('id-ID')}</td>
                          <td className="px-4 py-3 text-right font-semibold text-emerald-700">Rp {Number(it.sisa || 0).toLocaleString('id-ID')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
          <DialogFooter className="px-6 pb-6 pt-2 flex flex-col-reverse sm:flex-row gap-3 sm:gap-2 sm:justify-end">
            <Button className="rounded-full w-full sm:w-auto" variant="outline" onClick={() => setOpenPayDetail(false)}>Tutup</Button>
            <Button
              className="rounded-full w-full sm:w-auto bg-blue-600 text-white hover:bg-blue-700"
              onClick={handleExportPayDetailPdf}
              disabled={!payDetail?.summary || payDetailLoading || payDetailExporting}
            >
              <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
