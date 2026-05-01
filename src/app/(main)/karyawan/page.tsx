'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import useSWR from 'swr'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { PencilSquareIcon, TrashIcon, ChevronDownIcon, PlusCircleIcon, MinusCircleIcon, EyeIcon, ArrowPathIcon, CheckCircleIcon, CalendarIcon, MagnifyingGlassIcon, ClockIcon, UserGroupIcon, BanknotesIcon, CreditCardIcon, CurrencyDollarIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import useSWRImmutable from 'swr/immutable'
import KaryawanPageModals from './KaryawanPageModals'
import { useKaryawanModalsState } from './useKaryawanModalsState'
import { KaryawanHeader } from './KaryawanHeader'
import { KaryawanSummaryCards } from './KaryawanSummaryCards'
import { KaryawanTabs } from './KaryawanTabs'

type Kebun = { id: number; name: string }
type WorkLocation = { id: number; name: string; type: string; kebunId?: number | null }
type DeleteRequest = { id: number; status: string; createdAt: string; reason?: string | null; karyawan: { id: number; name: string }; requester: { id: number; name: string } }
type User = {
  id: number
  name: string
  email: string
  role?: string
  photoUrl?: string | null
  kebunId?: number | null
  noHp?: string | null
  phone?: string | null
  jenisPekerjaan?: string | null
  jobType?: string | null
  status?: string | null
  kendaraanPlatNomor?: string | null
}
type Row = {
  karyawan: User
  pekerjaanCount: number
  pekerjaanTotalBiaya: number
  totalPengeluaran: number
  totalPembayaran: number
  hutangSaldo: number
  hariKerja: number
  totalGaji: number
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function KaryawanKebunPage() {
  const [kebunList, setKebunList] = useState<Kebun[]>([])
  const [selectedKebunId, setSelectedKebunId] = useState<number | null>(null)
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [quickRange, setQuickRange] = useState('this_year')
  const [, setSummaryKebunId] = useState<number | null>(null)
  const [summaryKebunSet, setSummaryKebunSet] = useState(false)
  const [summaryJobType, setSummaryJobType] = useState<string>('all')
  const [summaryKaryawanId, setSummaryKaryawanId] = useState<number | null>(null)
  const [summaryStartDate, setSummaryStartDate] = useState<string>('')
  const [summaryEndDate, setSummaryEndDate] = useState<string>('')

  const {
    openAbsenView,
    setOpenAbsenView,
    openDeleteAbsenConfirm,
    setOpenDeleteAbsenConfirm,
    openCancelGajiConfirm,
    setOpenCancelGajiConfirm,
    absenOpen,
    setAbsenOpen,
    absenPayOpen,
    setAbsenPayOpen,
    openCancelPaid,
    setOpenCancelPaid,
    cancelPaidDate,
    setCancelPaidDate,
    openDeleteAbsenPay,
    setOpenDeleteAbsenPay,
    deleteAbsenPayId,
    setDeleteAbsenPayId,
    deleteAbsenPayPaidAt,
    setDeleteAbsenPayPaidAt,
    openDeleteKaryawan,
    setOpenDeleteKaryawan,
    deleteKaryawanId,
    setDeleteKaryawanId,
    openHutang,
    setOpenHutang,
    openPotong,
    setOpenPotong,
    hutangModalUser,
    setHutangModalUser,
    openDetail,
    setOpenDetail,
    openEditDetail,
    setOpenEditDetail,
    openDeleteDetail,
    setOpenDeleteDetail,
    openPayroll,
    setOpenPayroll,
    openAddEditKaryawan,
    setOpenAddEditKaryawan,
    editKaryawan,
    setEditKaryawan,
    openMove,
    setOpenMove,
    moveUser,
    setMoveUser,
    moveLocationId,
    setMoveLocationId,
    moveDate,
    setMoveDate,
    openHistory,
    setOpenHistory,
    historyUser,
    setHistoryUser,
  } = useKaryawanModalsState()
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [hutangJumlah, setHutangJumlah] = useState<string>('')
  const [hutangTanggal, setHutangTanggal] = useState<string>('')
  const [hutangDeskripsi, setHutangDeskripsi] = useState<string>('Hutang Karyawan')
  const [potongJumlah, setPotongJumlah] = useState<string>('')
  const [potongTanggal, setPotongTanggal] = useState<string>('')
  const [potongDeskripsi, setPotongDeskripsi] = useState<string>('Pembayaran Hutang Karyawan')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailRows, setDetailRows] = useState<Array<{ id: number; date: string; jumlah: number; tipe: string; kategori: string; deskripsi: string }>>([])
  const [editDetailId, setEditDetailId] = useState<number | null>(null)
  const [editDetailDate, setEditDetailDate] = useState<string>('')
  const [editDetailJumlah, setEditDetailJumlah] = useState<string>('')
  const [editDetailDeskripsi, setEditDetailDeskripsi] = useState<string>('')
  const [deleteDetail, setDeleteDetail] = useState<{ id: number; date: string; jumlah: number; kategori: string; deskripsi: string } | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [potongMap, setPotongMap] = useState<Record<number, string>>({})
  const [massNominal, setMassNominal] = useState<string>('')
  const [, setMassPercent] = useState<string>('') // 0-100
  const [massDate, setMassDate] = useState<string>('') // override dateUse
  const [massDesc, setMassDesc] = useState<string>('') // override deskripsi
  const [activeTab, setActiveTab] = useState('karyawan')
  const formatRibuanId = useCallback((s: string) => {
    const digits = s.replace(/\D/g, '')
    if (!digits) return ''
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  }, [])
  const [karyawanPage, setKaryawanPage] = useState(1)
  const [karyawanLimit, setKaryawanLimit] = useState(10)
  const [selectedJobType, setSelectedJobType] = useState<string>('all')
  const [openJobTypeCombo, setOpenJobTypeCombo] = useState(false)
  const [jobTypeQuery, setJobTypeQuery] = useState('')
  const [openKebunFilterCombo, setOpenKebunFilterCombo] = useState(false)
  const [kebunFilterQuery, setKebunFilterQuery] = useState('')
  const [openKaryawanFilterCombo, setOpenKaryawanFilterCombo] = useState(false)
  const [karyawanFilterQuery, setKaryawanFilterQuery] = useState('')
  const [selectedLocationFilterId, setSelectedLocationFilterId] = useState<number | 'all'>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('AKTIF')
  const [karyawanSearch, setKaryawanSearch] = useState('')
  const [karyawanSearchApplied, setKaryawanSearchApplied] = useState('')
  const [filterExpanded, setFilterExpanded] = useState(false)

  const { data: me } = useSWRImmutable<{ id: number; name: string; role: string }>('/api/auth/me', (u: string) => fetch(u).then(r => r.ok ? r.json() : null))
  const canDelete = (me?.role === 'ADMIN' || me?.role === 'PEMILIK')
  const canMove = (me?.role === 'ADMIN' || me?.role === 'PEMILIK' || me?.role === 'MANAGER')
  const canRequestDelete = (me?.role === 'MANAGER')
  const canShowDelete = canDelete || canRequestDelete
  const accessDenied = !!(me && (me.role === 'MANAGER' || me.role === 'MANDOR'))

  const karyawanUrl = useMemo(() => {
    const sp = new URLSearchParams()
    const needWideFetch = selectedLocationFilterId !== 'all'
    sp.set('limit', String(needWideFetch ? 1000 : karyawanLimit))
    sp.set('page', String(needWideFetch ? 1 : karyawanPage))
    if (selectedJobType !== 'all') sp.set('jobType', selectedJobType)
    if (selectedJobType === 'KEBUN' && selectedKebunId) sp.set('kebunId', String(selectedKebunId))
    if (selectedStatus !== 'all') sp.set('status', selectedStatus)
    if (karyawanSearchApplied.trim()) sp.set('search', karyawanSearchApplied.trim())
    return `/api/karyawan?${sp.toString()}`
  }, [karyawanLimit, karyawanPage, selectedJobType, selectedKebunId, selectedLocationFilterId, karyawanSearchApplied, selectedStatus])
  const { data: karyawanData, isLoading: loadingKaryawan, mutate: mutateKaryawan } = useSWR<{ data: User[]; total: number; page: number; limit: number }>(
    accessDenied ? null : karyawanUrl,
    (url: string) => fetch(url).then(r => r.json())
  )
  const karyawanList = useMemo(() => {
    if (karyawanData && Array.isArray(karyawanData.data)) return karyawanData.data
    return []
  }, [karyawanData])
  const totalKaryawan = karyawanData?.total ?? 0
  const activeAssignmentsUrl = useMemo(() => {
    if (!Array.isArray(karyawanList) || karyawanList.length === 0) return null
    const ids = karyawanList.map(k => k.id).join(',')
    return `/api/karyawan/assignments?userIds=${ids}&active=1`
  }, [karyawanList])
  const { data: activeAssignmentsData } = useSWR<{ data: Array<{ userId: number; location: WorkLocation }> }>(
    accessDenied ? null : activeAssignmentsUrl,
    fetcher
  )
  const activeAssignments = useMemo(() => {
    if (activeAssignmentsData && Array.isArray(activeAssignmentsData.data)) return activeAssignmentsData.data
    return []
  }, [activeAssignmentsData])
  const activeAssignmentMap = useMemo(() => {
    const map = new Map<number, { userId: number; location: WorkLocation }>()
    if (Array.isArray(activeAssignments)) {
      activeAssignments.forEach(a => map.set(a.userId, a))
    }
    return map
  }, [activeAssignments])
  const getLocationLabel = useCallback((loc: WorkLocation) => {
    if (!loc) return '-'
    const type = loc.type?.toUpperCase()
    if (type === 'KANTOR_PUSAT') return `Kantor Pusat - ${loc.name}`
    if (type === 'GUDANG') return `Gudang - ${loc.name}`
    return `Kebun - ${loc.name}`
  }, [])
  const getActiveLocationLabel = useCallback((k: User) => {
    const assignment = activeAssignmentMap.get(k.id)
    if (assignment?.location) return getLocationLabel(assignment.location)
    if (typeof k.kebunId === 'number') {
      const kebun = Array.isArray(kebunList) ? kebunList.find(x => x.id === k.kebunId) : null
      return kebun ? `Kebun - ${kebun.name}` : 'Kebun'
    }
    return '-'
  }, [activeAssignmentMap, getLocationLabel, kebunList])
  const [formName, setFormName] = useState('')
  const [formPhotoFile, setFormPhotoFile] = useState<File | null>(null)
  const [formPhotoPreview, setFormPhotoPreview] = useState<string | null>(null)
  const [formKebunId, setFormKebunId] = useState<number | null>(null)
  const [formJobType, setFormJobType] = useState<string>('KEBUN')
  const [formStatus, setFormStatus] = useState<string>('AKTIF')
  const [formRole, setFormRole] = useState<string>('KARYAWAN')
  const [formTanggalMulaiBekerja, setFormTanggalMulaiBekerja] = useState<string>('')
  const [formKendaraanPlatNomor, setFormKendaraanPlatNomor] = useState<string>('')
  const [alatBeratList, setAlatBeratList] = useState<Array<{ platNomor: string; merk?: string | null; jenis?: string | null }>>([])
  const [openKebunCombo, setOpenKebunCombo] = useState(false)
  const [kebunQuery, setKebunQuery] = useState('')
  const [openKaryawanTable, setOpenKaryawanTable] = useState(true)
  const [absenMonth, setAbsenMonth] = useState<Date>(new Date())
  const [absenMap, setAbsenMap] = useState<Record<string, string>>({})
  const [absenUserId, setAbsenUserId] = useState<number | null>(null)
  const [absenSelectedDate, setAbsenSelectedDate] = useState<string>('')
  const [absenValue, setAbsenValue] = useState<string>('')
  const [absenWorkMap, setAbsenWorkMap] = useState<Record<string, boolean>>({})
  const [absenOffMap, setAbsenOffMap] = useState<Record<string, boolean>>({})
  const [absenNoteMap, setAbsenNoteMap] = useState<Record<string, string>>({})
  const [absenSourceMap, setAbsenSourceMap] = useState<Record<string, string>>({})
  const [absenHourlyMap, setAbsenHourlyMap] = useState<Record<string, boolean>>({})
  const [absenHourMap, setAbsenHourMap] = useState<Record<string, string>>({})
  const [absenRateMap, setAbsenRateMap] = useState<Record<string, string>>({})
  const [absenMealEnabledMap, setAbsenMealEnabledMap] = useState<Record<string, boolean>>({})
  const [absenMealMap, setAbsenMealMap] = useState<Record<string, string>>({})
  const [absenPaidMap, setAbsenPaidMap] = useState<Record<string, boolean>>({})
  const [absenWork, setAbsenWork] = useState<boolean>(false)
  const [absenOff, setAbsenOff] = useState<boolean>(false)
  const [absenNote, setAbsenNote] = useState<string>('')
  const [absenUseHourly, setAbsenUseHourly] = useState(false)
  const [absenHour, setAbsenHour] = useState<string>('')
  const [absenRate, setAbsenRate] = useState<string>('')
  const [absenMealEnabled, setAbsenMealEnabled] = useState(false)
  const [absenMealAmount, setAbsenMealAmount] = useState<string>('')
  const [absenDefaultAmount, setAbsenDefaultAmount] = useState<number>(0)
  const [absenSetDefault, setAbsenSetDefault] = useState<boolean>(false)
  const [absenSaving, setAbsenSaving] = useState(false)
  const [, setAbsenSaved] = useState(false)
  const absenSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [absenPaySelection, setAbsenPaySelection] = useState<Record<string, boolean>>({})
  const [absenPayHistoryRows, setAbsenPayHistoryRows] = useState<Array<{ id: number; startDate: string; endDate: string; paidAt: string; jumlah: number; deskripsi: string; userName: string | null; potonganHutang: number; kebunId: number; karyawanId: number }>>([])
  const [absenPayHistoryLoading, setAbsenPayHistoryLoading] = useState(false)
  const [absenPayHistoryStart, setAbsenPayHistoryStart] = useState<string>('')
  const [absenPayHistoryEnd, setAbsenPayHistoryEnd] = useState<string>('')
  const [absenPayHistoryOpen, setAbsenPayHistoryOpen] = useState(false)
  const [absenPayPotong, setAbsenPayPotong] = useState<string>('')
  const [absenPayPotongDesc, setAbsenPayPotongDesc] = useState<string>('Potong Hutang dari Pembayaran Gaji')
  const [openAbsenSection, setOpenAbsenSection] = useState(false)
  const [isDeletingAbsen, setIsDeletingAbsen] = useState(false)
  const [isCancellingGaji, setIsCancellingGaji] = useState(false)
  const [biayaKaryawanOpen, setBiayaKaryawanOpen] = useState(true)
  const [biayaKaryawanLoading, setBiayaKaryawanLoading] = useState(false)
  const [biayaKaryawanRows, setBiayaKaryawanRows] = useState<any[]>([])
  const [biayaKaryawanTotal, setBiayaKaryawanTotal] = useState<number>(0)

  useEffect(() => {
    try {
      const isMobile = window.matchMedia('(max-width: 767px)').matches
      setFilterExpanded(!isMobile)
    } catch {
      setFilterExpanded(true)
    }
  }, [])
  const { data: deleteRequestData, isLoading: loadingDeleteRequests, mutate: mutateDeleteRequests } = useSWR<{ data: DeleteRequest[] }>(
    canDelete ? '/api/karyawan/delete-requests' : null,
    fetcher
  )
  const deleteRequests = useMemo(() => {
    if (deleteRequestData && Array.isArray(deleteRequestData.data)) return deleteRequestData.data
    return []
  }, [deleteRequestData])
  const { data: locationData } = useSWRImmutable<{ data: WorkLocation[] }>('/api/work-locations', (u: string) => fetch(u).then(r => r.ok ? r.json() : { data: [] }))
  const workLocations = useMemo(() => {
    if (locationData && Array.isArray(locationData.data)) return locationData.data
    return []
  }, [locationData])
  const filteredKaryawanList = useMemo(() => {
    if (!Array.isArray(karyawanList)) return []
    if (selectedLocationFilterId === 'all') return karyawanList
    return karyawanList.filter((k) => {
      const assignment = activeAssignmentMap.get(k.id)
      if (assignment?.location?.id === selectedLocationFilterId) return true
      if (!assignment?.location && typeof k.kebunId === 'number' && Array.isArray(workLocations)) {
        const fallback = workLocations.find(l => l.type === 'KEBUN' && l.kebunId === k.kebunId)
        return fallback?.id === selectedLocationFilterId
      }
      return false
    })
  }, [selectedLocationFilterId, karyawanList, activeAssignmentMap, workLocations])
  const [moveLoading, setMoveLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyItems, setHistoryItems] = useState<Array<{ id: number; startDate: string; endDate?: string | null; status: string; location: WorkLocation }>>([])
  const openMoveModal = useCallback((k: User) => {
    setMoveUser(k)
    setMoveDate(new Date().toISOString().split('T')[0])
    const currentLoc = workLocations.find((l) => l.type === 'KEBUN' && typeof k.kebunId === 'number' && l.kebunId === k.kebunId)
    setMoveLocationId(currentLoc?.id ?? workLocations[0]?.id ?? null)
    setOpenMove(true)
  }, [workLocations])
  const openHistoryModal = useCallback(async (k: User) => {
    setHistoryUser(k)
    setOpenHistory(true)
    setHistoryLoading(true)
    try {
      const res = await fetch(`/api/karyawan/assignments?userId=${k.id}`)
      if (!res.ok) throw new Error('Failed')
      const json = await res.json()
      setHistoryItems(json?.data ?? [])
    } catch {
      setHistoryItems([])
    } finally {
      setHistoryLoading(false)
    }
  }, [])
  const absenSectionRef = useRef<HTMLDivElement | null>(null)
  const openDetailKaryawan = useCallback((k: User) => {
    setSelectedUser(k)
    setAbsenUserId(k.id)
    setOpenAbsenSection(true)
    setTimeout(() => {
      absenSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 0)
    if (!selectedKebunId && typeof k.kebunId === 'number') {
      setSelectedKebunId(k.kebunId)
    }
  }, [selectedKebunId])
  const daftarHutangRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (selectedLocationFilterId !== 'all') {
      const loc = workLocations.find(l => l.id === selectedLocationFilterId)
      if (loc?.type === 'KEBUN' && loc.kebunId) {
        setSelectedKebunId(loc.kebunId)
      } else {
        setSelectedKebunId(null)
      }
    }
  }, [selectedLocationFilterId, workLocations])

  useEffect(() => {
    setKaryawanPage(1)
  }, [selectedJobType, selectedKebunId, selectedLocationFilterId, selectedStatus, karyawanSearchApplied])

  const applyKaryawanSearch = useCallback(() => {
    const trimmed = String(karyawanSearch || '').trim()
    if (trimmed && trimmed.length < 2) return
    setKaryawanSearchApplied(trimmed)
    setKaryawanPage(1)
  }, [karyawanSearch])

  useEffect(() => {
    async function loadKebun() {
      try {
        const res = await fetch('/api/kebun/list')
        const json = await res.json()
        const data = Array.isArray(json.data) ? json.data : Array.isArray(json) ? json : []
        setKebunList(data)
      } catch {
        setKebunList([])
      }
    }
    loadKebun()
  }, [])
  useEffect(() => {
    async function loadAlatBerat() {
      try {
        const res = await fetch('/api/kendaraan?limit=500')
        if (!res.ok) throw new Error('Failed')
        const json = await res.json()
        const rows = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : []
        const filtered = rows.filter((k: any) => (k?.jenis || '').toString().toUpperCase().includes('ALAT BERAT'))
        setAlatBeratList(filtered.map((k: any) => ({ platNomor: k.platNomor, merk: k.merk, jenis: k.jenis })))
      } catch {
        setAlatBeratList([])
      }
    }
    loadAlatBerat()
  }, [])
  useEffect(() => {
    if (!summaryKebunSet && selectedKebunId) {
      setSummaryKebunId(selectedKebunId)
    }
  }, [selectedKebunId, summaryKebunSet])

  const formatDateKey = useCallback((d: Date) => new Intl.DateTimeFormat('en-CA').format(d), [])

  // Load attendance from server
  useEffect(() => {
    const loadServerData = async () => {
      if (!absenUserId) return
      const kebunKey = selectedKebunId ?? 0
      
      const start = new Date(absenMonth.getFullYear(), absenMonth.getMonth(), 1)
      const end = new Date(absenMonth.getFullYear(), absenMonth.getMonth() + 1, 0)
      
      const params = new URLSearchParams({
        kebunId: String(kebunKey),
        karyawanId: String(absenUserId),
        startDate: formatDateKey(start),
        endDate: formatDateKey(end),
      })
      
      try {
        const res = await fetch(`/api/karyawan/operasional/absensi?${params.toString()}`, { cache: 'no-store' })
        if (res.ok) {
          const json = await res.json()
          const records = json.data || []
          
          const nextAmount: Record<string, string> = {}
          const nextWork: Record<string, boolean> = {}
          const nextOff: Record<string, boolean> = {}
          const nextNote: Record<string, string> = {}
          const nextSource: Record<string, string> = {}
          const nextHourly: Record<string, boolean> = {}
          const nextHour: Record<string, string> = {}
          const nextRate: Record<string, string> = {}
          const nextMealEnabled: Record<string, boolean> = {}
          const nextMeal: Record<string, string> = {}
          
          records.forEach((r: any) => {
            const raw = r?.date ? String(r.date).trim() : ''
            if (!raw) return
            const key = /^\d{4}-\d{2}-\d{2}$/.test(raw)
              ? raw
              : (() => {
                  const dateObj = new Date(raw)
                  if (Number.isNaN(dateObj.getTime())) return null
                  const year = dateObj.getUTCFullYear()
                  const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0')
                  const day = String(dateObj.getUTCDate()).padStart(2, '0')
                  return `${year}-${month}-${day}`
                })()
            if (!key) return
            
            if (r.jumlah > 0) nextAmount[key] = String(r.jumlah)
            if (r.kerja) nextWork[key] = true
            if (r.libur) nextOff[key] = true
            if (r.note) nextNote[key] = r.note
            if (r.source) nextSource[key] = String(r.source)
            const isSelfieMasuk = String(r.source || '').toUpperCase() === 'SELFIE'
            if (isSelfieMasuk && !r.libur) nextWork[key] = true
            if (r.useHourly) {
              nextHourly[key] = true
              nextHour[key] = r.jamKerja != null ? String(r.jamKerja) : ''
              nextRate[key] = r.ratePerJam != null ? formatRibuanId(String(Math.round(Number(r.ratePerJam) || 0))) : ''
            }
            if (r.uangMakan != null && Number(r.uangMakan) > 0) {
              nextMealEnabled[key] = true
              nextMeal[key] = formatRibuanId(String(Math.round(Number(r.uangMakan) || 0)))
            }
          })
          
          setAbsenMap(nextAmount)
          setAbsenWorkMap(nextWork)
          setAbsenOffMap(nextOff)
          setAbsenNoteMap(nextNote)
          setAbsenSourceMap(nextSource)
          setAbsenHourlyMap(nextHourly)
          setAbsenHourMap(nextHour)
          setAbsenRateMap(nextRate)
          setAbsenMealEnabledMap(nextMealEnabled)
          setAbsenMealMap(nextMeal)
          
          // Also update localStorage to keep it in sync
          const ym = `${absenMonth.getFullYear()}-${String(absenMonth.getMonth() + 1).padStart(2, '0')}`
          const storageKey = `absensi:v2:${kebunKey}:${absenUserId}:${ym}`
          localStorage.setItem(storageKey, JSON.stringify({
            amount: nextAmount,
            work: nextWork,
            off: nextOff,
            note: nextNote,
            source: nextSource,
            hourly: nextHourly,
            hour: nextHour,
            rate: nextRate,
            mealEnabled: nextMealEnabled,
            meal: nextMeal
          }))
        }
      } catch (e) {
        console.error('Failed to load absensi from server', e)
      }
    }
    
    loadServerData()
  }, [selectedKebunId, absenUserId, absenMonth, formatDateKey])

  useEffect(() => {
    const loadBiayaKaryawan = async () => {
      if (!selectedUser?.id) {
        setBiayaKaryawanRows([])
        setBiayaKaryawanTotal(0)
        return
      }
      setBiayaKaryawanLoading(true)
      try {
        const start = new Date(absenMonth.getFullYear(), absenMonth.getMonth(), 1)
        const end = new Date(absenMonth.getFullYear(), absenMonth.getMonth() + 1, 0)
        const sp = new URLSearchParams()
        sp.set('tagScope', 'karyawan')
        sp.set('karyawanId', String(selectedUser.id))
        sp.set('startDate', formatDateKey(start))
        sp.set('endDate', formatDateKey(end))
        sp.set('page', '1')
        sp.set('pageSize', '50')
        const res = await fetch(`/api/reports/cost-center/kas-transaksi?${sp.toString()}`, { cache: 'no-store' })
        const json = await res.json()
        setBiayaKaryawanRows(Array.isArray(json?.data) ? json.data : [])
        setBiayaKaryawanTotal(Number(json?.meta?.totalJumlah || 0))
      } catch {
        setBiayaKaryawanRows([])
        setBiayaKaryawanTotal(0)
      } finally {
        setBiayaKaryawanLoading(false)
      }
    }
    loadBiayaKaryawan()
  }, [absenMonth, formatDateKey, selectedUser?.id])

  // Load attendance from localStorage (fallback/initial)
  useEffect(() => {
    if (!absenUserId) return
    const kebunKey = selectedKebunId ?? 0
    const ym = `${absenMonth.getFullYear()}-${String(absenMonth.getMonth() + 1).padStart(2, '0')}`
    const key = `absensi:v2:${kebunKey}:${absenUserId}:${ym}`
    try {
      const raw = localStorage.getItem(key)
      if (raw) {
        const parsed = JSON.parse(raw) as {
          amount?: Record<string, string>
          work?: Record<string, boolean>
          off?: Record<string, boolean>
          note?: Record<string, string>
          source?: Record<string, string>
          hourly?: Record<string, boolean>
          hour?: Record<string, string>
          rate?: Record<string, string>
          mealEnabled?: Record<string, boolean>
          meal?: Record<string, string>
        }
        // Only set if current maps are empty to avoid overwriting server data if it loaded faster
        const parsedAmount = parsed.amount || {}
        const parsedOff = parsed.off || {}
        const parsedSource = parsed.source || {}
        const parsedWorkBase = parsed.work || {}
        const parsedWork = { ...parsedWorkBase }
        Object.entries(parsedSource).forEach(([date, src]) => {
          const isSelfie = String(src || '').toUpperCase() === 'SELFIE'
          if (isSelfie && !parsedOff[date]) parsedWork[date] = true
        })

        setAbsenMap(prev => Object.keys(prev).length === 0 ? parsedAmount : prev)
        setAbsenWorkMap(prev => Object.keys(prev).length === 0 ? parsedWork : prev)
        setAbsenOffMap(prev => Object.keys(prev).length === 0 ? parsedOff : prev)
        setAbsenNoteMap(prev => Object.keys(prev).length === 0 ? (parsed.note || {}) : prev)
        setAbsenSourceMap(prev => Object.keys(prev).length === 0 ? parsedSource : prev)
        setAbsenHourlyMap(prev => Object.keys(prev).length === 0 ? (parsed.hourly || {}) : prev)
        setAbsenHourMap(prev => Object.keys(prev).length === 0 ? (parsed.hour || {}) : prev)
        setAbsenRateMap(prev => Object.keys(prev).length === 0 ? (parsed.rate || {}) : prev)
        setAbsenMealEnabledMap(prev => Object.keys(prev).length === 0 ? (parsed.mealEnabled || {}) : prev)
        setAbsenMealMap(prev => Object.keys(prev).length === 0 ? (parsed.meal || {}) : prev)
      } else {
        setAbsenMap({})
        setAbsenWorkMap({})
        setAbsenOffMap({})
        setAbsenNoteMap({})
        setAbsenSourceMap({})
        setAbsenHourlyMap({})
        setAbsenHourMap({})
        setAbsenRateMap({})
        setAbsenMealEnabledMap({})
        setAbsenMealMap({})
      }
    } catch {
      setAbsenMap({})
      setAbsenWorkMap({})
      setAbsenOffMap({})
      setAbsenNoteMap({})
      setAbsenHourlyMap({})
      setAbsenHourMap({})
      setAbsenRateMap({})
      setAbsenMealEnabledMap({})
      setAbsenMealMap({})
    }
  }, [selectedKebunId, absenUserId, absenMonth])
  useEffect(() => {
    if (startDate && endDate) return
    const today = new Date()
    const start = new Date(today.getFullYear(), 0, 1)
    const end = new Date(today)
    const startVal = formatDateKey(start)
    const endVal = formatDateKey(end)
    setStartDate(startVal)
    setEndDate(endVal)
    setSummaryStartDate(startVal)
    setSummaryEndDate(endVal)
  }, [formatDateKey, startDate, endDate])
  const dateDisplay = useMemo(() => {
    if (quickRange && quickRange !== 'custom') {
      switch (quickRange) {
        case 'today': return 'Hari Ini'
        case 'yesterday': return 'Kemarin'
        case 'last_week': return '7 Hari Terakhir'
        case 'last_30_days': return '30 Hari Terakhir'
        case 'this_month': return 'Bulan Ini'
        case 'this_year': return 'Tahun Ini'
        default: return 'Pilih Rentang Waktu'
      }
    }
    if (startDate && endDate) {
      return `${format(new Date(startDate), 'dd MMM yyyy', { locale: idLocale })} - ${format(new Date(endDate), 'dd MMM yyyy', { locale: idLocale })}`
    }
    return 'Pilih Rentang Waktu'
  }, [quickRange, startDate, endDate])
  const applyQuickRange = useCallback((val: string) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    setQuickRange(val)
    let start = today
    let end = today
    if (val === 'yesterday') {
      const y = new Date(today)
      y.setDate(today.getDate() - 1)
      start = y
      end = y
    } else if (val === 'last_week') {
      const s = new Date(today)
      s.setDate(today.getDate() - 7)
      start = s
      end = today
    } else if (val === 'last_30_days') {
      const s = new Date(today)
      s.setDate(today.getDate() - 30)
      start = s
      end = today
    } else if (val === 'this_month') {
      start = new Date(today.getFullYear(), today.getMonth(), 1)
      end = today
    } else if (val === 'this_year') {
      start = new Date(today.getFullYear(), 0, 1)
      end = today
    }
    const startVal = formatDateKey(start)
    const endVal = formatDateKey(end)
    setStartDate(startVal)
    setEndDate(endVal)
    setSummaryStartDate(startVal)
    setSummaryEndDate(endVal)
  }, [formatDateKey])
  const loadPaid = useCallback(async (kebunId: number, karyawanId: number, month: Date) => {
    const start = new Date(month.getFullYear(), month.getMonth(), 1)
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 0)
    const params = new URLSearchParams({
      kebunId: String(kebunId),
      karyawanId: String(karyawanId),
      startDate: formatDateKey(start),
      endDate: formatDateKey(end),
    })
    const res = await fetch(`/api/karyawan/operasional/absensi-payments?${params.toString()}`, { cache: 'no-store' })
    if (!res.ok) {
      setAbsenPaidMap({})
      return
    }
    const json = await res.json()
    const next: Record<string, boolean> = {}
    ;(json.data || []).forEach((r: { date: string }) => { 
      if (r.date) {
        const raw = String(r.date).trim()
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
          next[raw] = true
          return
        }
        const d = new Date(raw)
        if (Number.isNaN(d.getTime())) return
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
    if (!absenUserId) {
      setAbsenPaidMap({})
      return
    }
    loadPaid(selectedKebunId ?? 0, absenUserId, absenMonth)
  }, [selectedKebunId, absenUserId, absenMonth, loadPaid])
  useEffect(() => {
    const start = new Date(absenMonth.getFullYear(), absenMonth.getMonth(), 1)
    const end = new Date(absenMonth.getFullYear(), absenMonth.getMonth() + 1, 0)
    setAbsenPayHistoryStart(formatDateKey(start))
    setAbsenPayHistoryEnd(formatDateKey(end))
  }, [absenMonth, formatDateKey])
  const fetchAbsenPayHistory = useCallback(async () => {
    if (!absenUserId) {
      setAbsenPayHistoryRows([])
      return
    }
    const kebunKey = selectedKebunId ?? 0
    const params = new URLSearchParams({
      kebunId: String(kebunKey),
      karyawanId: String(absenUserId),
      startDate: absenPayHistoryStart || formatDateKey(new Date(absenMonth.getFullYear(), absenMonth.getMonth(), 1)),
      endDate: absenPayHistoryEnd || formatDateKey(new Date(absenMonth.getFullYear(), absenMonth.getMonth() + 1, 0)),
      history: '1',
    })
    setAbsenPayHistoryLoading(true)
    try {
      const res = await fetch(`/api/karyawan/operasional/absensi-payments?${params.toString()}`, { cache: 'no-store' })
      if (!res.ok) {
        setAbsenPayHistoryRows([])
        return
      }
      const json = await res.json()
      setAbsenPayHistoryRows(json.data || [])
    } finally {
      setAbsenPayHistoryLoading(false)
    }
  }, [selectedKebunId, absenUserId, absenMonth, formatDateKey, absenPayHistoryStart, absenPayHistoryEnd])
  useEffect(() => {
    fetchAbsenPayHistory()
  }, [fetchAbsenPayHistory])
  const handleDeleteAbsenPay = useCallback(async () => {
    if (!absenUserId) return
    const kebunKey = selectedKebunId ?? 0
    try {
      const params = new URLSearchParams({
        kebunId: String(kebunKey),
        karyawanId: String(absenUserId),
      })
      if (deleteAbsenPayPaidAt) {
        params.set('paidAt', deleteAbsenPayPaidAt)
      } else if (deleteAbsenPayId) {
        params.set('id', String(deleteAbsenPayId))
      } else {
        return
      }
      const res = await fetch(`/api/karyawan/operasional/absensi-payments?${params.toString()}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({} as any))
        throw new Error((err as any).error || 'Gagal menghapus pembayaran')
      }
      toast.success('Pembayaran gaji dihapus')
      await fetchAbsenPayHistory()
      await loadPaid(kebunKey, absenUserId, absenMonth)
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menghapus pembayaran')
    } finally {
      setOpenDeleteAbsenPay(false)
      setDeleteAbsenPayId(null)
      setDeleteAbsenPayPaidAt('')
    }
  }, [deleteAbsenPayId, deleteAbsenPayPaidAt, fetchAbsenPayHistory, selectedKebunId, absenUserId, absenMonth, loadPaid])
  const handleCancelPaidDate = useCallback(async () => {
    if (!cancelPaidDate || !absenUserId) return
    const kebunKey = selectedKebunId ?? 0
    try {
      const params = new URLSearchParams({
        kebunId: String(kebunKey),
        karyawanId: String(absenUserId),
        date: cancelPaidDate,
      })
      const res = await fetch(`/api/karyawan/operasional/absensi-payments?${params.toString()}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({} as any))
        throw new Error((err as any).error || 'Gagal membatalkan pembayaran')
      }
      toast.success('Pembayaran gaji dibatalkan')
      await fetchAbsenPayHistory()
      await loadPaid(kebunKey, absenUserId, absenMonth)
    } catch (e: any) {
      toast.error(e?.message || 'Gagal membatalkan pembayaran')
    } finally {
      setOpenCancelPaid(false)
      setCancelPaidDate('')
    }
  }, [cancelPaidDate, selectedKebunId, absenUserId, fetchAbsenPayHistory, loadPaid, absenMonth])
  useEffect(() => {
    const loadDefault = async () => {
      if (!selectedKebunId || !absenUserId) {
        setAbsenDefaultAmount(0)
        return
      }
      const params = new URLSearchParams({
        kebunId: String(selectedKebunId),
        karyawanId: String(absenUserId),
      })
      const res = await fetch(`/api/karyawan/operasional/absensi-default?${params.toString()}`)
      if (!res.ok) {
        setAbsenDefaultAmount(0)
        return
      }
      const json = await res.json()
      setAbsenDefaultAmount(Number(json.amount) || 0)
    }
    loadDefault()
  }, [selectedKebunId, absenUserId])

  useEffect(() => {
    if (!absenOpen || !absenUseHourly) return
    const hours = parseFloat((absenHour || '').toString().replace(',', '.')) || 0
    const rate = Number((absenRate || '').toString().replace(/\./g, '').replace(/,/g, '')) || 0
    if (hours > 0 && rate > 0) {
      setAbsenWork(true)
      setAbsenOff(false)
    }
  }, [absenOpen, absenUseHourly, absenHour, absenRate])

  const persistAbsensiLocal = (
    amount: Record<string, string>,
    work: Record<string, boolean>,
    off: Record<string, boolean>,
    note: Record<string, string>,
    hourly: Record<string, boolean>,
    hour: Record<string, string>,
    rate: Record<string, string>,
    mealEnabled: Record<string, boolean>,
    meal: Record<string, string>
  ) => {
    if (!absenUserId) return
    const kebunKey = selectedKebunId ?? 0
    const ym = `${absenMonth.getFullYear()}-${String(absenMonth.getMonth() + 1).padStart(2, '0')}`
    const key = `absensi:v2:${kebunKey}:${absenUserId}:${ym}`
    try {
      localStorage.setItem(key, JSON.stringify({ amount, work, off, note, hourly, hour, rate, mealEnabled, meal }))
    } catch {}
  }
  const summaryUrl = useMemo(() => {
    const sp = new URLSearchParams()
    if (selectedKebunId) sp.set('kebunId', String(selectedKebunId))
    if (selectedJobType && selectedJobType !== 'all') sp.set('jobType', selectedJobType)
    if (absenUserId) sp.set('karyawanId', String(absenUserId))
    if (startDate) sp.set('startDate', startDate)
    if (endDate) sp.set('endDate', endDate)
    if (selectedStatus && selectedStatus !== 'all') sp.set('status', selectedStatus)
    return `/api/karyawan/operasional/summary?${sp.toString()}`
  }, [selectedKebunId, selectedJobType, absenUserId, startDate, endDate, selectedStatus])
  const { data: summaryData, isLoading: loadingSummary } = useSWR<{ totalKaryawan: number; gaji: { total: number; paid: number; unpaid: number; byJobType: Array<{ jobType: string; total: number }> }; hutang: { total: number; byJobType: Array<{ jobType: string; hutang: number; pembayaran: number; saldo: number }> } }>(
    summaryUrl,
    fetcher
  )
  const [kebunSummaries, setKebunSummaries] = useState<Array<{ kebunId: number; kebunName: string; gajiTotal: number; gajiPaid: number; gajiUnpaid: number; hutangTotal: number }>>([])
  const [loadingKebunSummaries, setLoadingKebunSummaries] = useState(false)
  useEffect(() => {
    if (!Array.isArray(kebunList) || kebunList.length === 0) {
      setKebunSummaries([])
      return
    }
    const targetKebun = selectedKebunId ? kebunList.filter(k => k.id === selectedKebunId) : kebunList
    const run = async () => {
      setLoadingKebunSummaries(true)
      try {
        const results = await Promise.all(targetKebun.map(async (k) => {
          const sp = new URLSearchParams()
          sp.set('kebunId', String(k.id))
          if (summaryJobType && summaryJobType !== 'all') sp.set('jobType', summaryJobType)
          if (summaryKaryawanId) sp.set('karyawanId', String(summaryKaryawanId))
          if (summaryStartDate) sp.set('startDate', summaryStartDate)
          if (summaryEndDate) sp.set('endDate', summaryEndDate)
          try {
            const res = await fetch(`/api/karyawan/operasional/summary?${sp.toString()}`)
            if (!res.ok) {
              return { kebunId: k.id, kebunName: k.name, gajiTotal: 0, gajiPaid: 0, gajiUnpaid: 0, hutangTotal: 0 }
            }
            const json = await res.json()
            return {
              kebunId: k.id,
              kebunName: k.name,
              gajiTotal: Number(json?.gaji?.total || 0),
              gajiPaid: Number(json?.gaji?.paid || 0),
              gajiUnpaid: Number(json?.gaji?.unpaid || 0),
              hutangTotal: Number(json?.hutang?.total || 0)
            }
          } catch {
            return { kebunId: k.id, kebunName: k.name, gajiTotal: 0, gajiPaid: 0, gajiUnpaid: 0, hutangTotal: 0 }
          }
        }))
        setKebunSummaries(results)
      } finally {
        setLoadingKebunSummaries(false)
      }
    }
    run()
  }, [kebunList, selectedKebunId, summaryJobType, summaryKaryawanId, summaryStartDate, summaryEndDate])
  const query = useMemo(() => {
    const sp = new URLSearchParams()
    if (selectedKebunId) sp.set('kebunId', String(selectedKebunId))
    if (startDate) sp.set('startDate', startDate)
    if (endDate) sp.set('endDate', endDate)
    if (selectedStatus && selectedStatus !== 'all') sp.set('status', selectedStatus)
    if (selectedJobType && selectedJobType !== 'all') sp.set('jobType', selectedJobType)
    if (karyawanSearchApplied) sp.set('search', karyawanSearchApplied)
    if (absenUserId) sp.set('karyawanId', String(absenUserId))
    return `/api/karyawan/operasional?${sp.toString()}`
  }, [selectedKebunId, startDate, endDate, selectedStatus, selectedJobType, karyawanSearchApplied, absenUserId])

  const { data, isLoading, mutate } = useSWR<{ data: Row[] }>(
    accessDenied ? null : query,
    fetcher
  )

  const rows = useMemo(() => {
    if (data && Array.isArray(data.data)) return data.data
    return []
  }, [data])
  const filteredSummaryRows = useMemo(() => {
    if (!Array.isArray(rows)) return []
    if (selectedUser) return rows.filter(r => r.karyawan.id === selectedUser.id)
    return rows
  }, [rows, selectedUser])
  const topGajiRows = useMemo(() => {
    return [...filteredSummaryRows].sort((a, b) => (b.totalGaji || 0) - (a.totalGaji || 0)).slice(0, 3)
  }, [filteredSummaryRows])
  const topHutangRows = useMemo(() => {
    return [...filteredSummaryRows].sort((a, b) => (b.hutangSaldo || 0) - (a.hutangSaldo || 0)).slice(0, 3)
  }, [filteredSummaryRows])
  const topHariKerjaRows = useMemo(() => {
    return [...filteredSummaryRows].sort((a, b) => (b.hariKerja || 0) - (a.hariKerja || 0)).slice(0, 3)
  }, [filteredSummaryRows])
  const jobTypeSummary = useMemo(() => {
    const gaji = summaryData?.gaji?.byJobType || []
    const hutang = summaryData?.hutang?.byJobType || []
    const map = new Map<string, { jobType: string; gaji: number; hutang: number; pembayaran: number; saldo: number }>()
    gaji.forEach(r => {
      const key = r.jobType || 'LAIN'
      map.set(key, { jobType: key, gaji: Number(r.total || 0), hutang: 0, pembayaran: 0, saldo: 0 })
    })
    hutang.forEach(r => {
      const key = r.jobType || 'LAIN'
      const prev = map.get(key) || { jobType: key, gaji: 0, hutang: 0, pembayaran: 0, saldo: 0 }
      map.set(key, { ...prev, hutang: Number(r.hutang || 0), pembayaran: Number(r.pembayaran || 0), saldo: Number(r.saldo || 0) })
    })
    return Array.from(map.values())
  }, [summaryData])
  const potongEffectiveById = useMemo(() => {
    const next: Record<number, number> = {}
    rows.forEach(r => {
      const saldo = Math.max(0, Math.round(r.hutangSaldo || 0))
      const raw = potongMap[r.karyawan.id] || ''
      const num = Number(raw.toString().replace(/\./g, '').replace(/,/g, '')) || 0
      const eff = saldo <= 0 ? 0 : Math.min(Math.max(0, num), saldo)
      next[r.karyawan.id] = eff
    })
    return next
  }, [rows, potongMap])
  const totalPotong = useMemo(() => {
    return Object.values(potongEffectiveById).reduce((acc, n) => acc + (Number.isFinite(n) ? n : 0), 0)
  }, [potongEffectiveById])
  const totalSisa = useMemo(() => {
    return rows.reduce((acc, r) => {
      const saldo = Math.max(0, Math.round(r.hutangSaldo || 0))
      const potong = potongEffectiveById[r.karyawan.id] || 0
      return acc + Math.max(0, saldo - potong)
    }, 0)
  }, [rows, potongEffectiveById])
  const absenSummary = useMemo(() => {
    const ym = `${absenMonth.getFullYear()}-${String(absenMonth.getMonth() + 1).padStart(2, '0')}`
    let hariKerja = 0
    let totalGaji = 0
    Object.entries(absenWorkMap).forEach(([date, work]) => {
      if (work && date.startsWith(ym)) hariKerja += 1
    })
    Object.entries(absenMap).forEach(([date, val]) => {
      if (!date.startsWith(ym)) return
      const num = Number((val || '').toString().replace(/\./g, '').replace(/,/g, '')) || 0
      totalGaji += num
    })
    const hutang = selectedUser ? Math.round(rows.find(r => r.karyawan.id === selectedUser.id)?.hutangSaldo || 0) : 0
    return { hariKerja, totalGaji, hutang }
  }, [absenMonth, absenWorkMap, absenMap, selectedUser, rows])
  const formatJobTypeLabel = useCallback((raw?: string | null) => {
    const val = (raw || '').toString().toUpperCase().trim()
    if (!val || val === 'ALL') return 'Semua Jenis'
    if (val.includes('KEBUN')) return 'Karyawan Kebun'
    if (val.includes('BULANAN')) return 'Karyawan Bulanan'
    if (val.includes('HARIAN')) return 'Pekerja Harian'
    if (val.includes('TUKANG') || val.includes('BANGUNAN')) return 'Tukang Bangunan'
    if (val.includes('OPERATOR')) return 'Operator'
    return val
  }, [])
  const jobTypeOptions = useMemo(() => ([
    { value: 'all', label: 'Semua Jenis Pekerjaan' },
    { value: 'KEBUN', label: 'Karyawan Kebun' },
    { value: 'BULANAN', label: 'Karyawan Bulanan' },
    { value: 'HARIAN', label: 'Pekerja Harian' },
    { value: 'TUKANG BANGUNAN', label: 'Tukang Bangunan' },
    { value: 'OPERATOR', label: 'Operator' },
  ]), [])
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
  const payTotal = useMemo(() => {
    return unpaidDates.reduce((acc, d) => acc + (absenPaySelection[d.date] ? d.amount : 0), 0)
  }, [unpaidDates, absenPaySelection])
  const hutangBeforePay = useMemo(() => {
    if (!selectedUser) return 0
    return Math.max(0, Math.round(rows.find(r => r.karyawan.id === selectedUser.id)?.hutangSaldo || 0))
  }, [rows, selectedUser])
  const potongHutangValue = useMemo(() => {
    return Number((absenPayPotong || '').toString().replace(/\./g, '').replace(/,/g, '')) || 0
  }, [absenPayPotong])
  const potongHutangEffective = useMemo(() => {
    if (hutangBeforePay <= 0) return 0
    return Math.min(potongHutangValue, hutangBeforePay)
  }, [potongHutangValue, hutangBeforePay])
  const hutangAfterPay = useMemo(() => {
    return Math.max(0, hutangBeforePay - potongHutangEffective)
  }, [hutangBeforePay, potongHutangEffective])
  const totalKaryawanPages = Math.max(1, Math.ceil(totalKaryawan / karyawanLimit))
  useEffect(() => {
    if (karyawanPage > totalKaryawanPages) {
      setKaryawanPage(totalKaryawanPages)
    }
  }, [karyawanPage, totalKaryawanPages])

  const formatShort = (d: string) => {
    if (!d) return '-'
    return format(new Date(d), 'dd-MMM-yy', { locale: idLocale })
  }

  const openPayrollModal = () => {
    const initial: Record<number, string> = {}
    rows.forEach(r => { initial[r.karyawan.id] = '' })
    setPotongMap(initial)
    setMassNominal('')
    setMassPercent('')
    setMassDate(endDate || '')
    setMassDesc(`Potong hutang periode ${formatShort(startDate)} s/d ${formatShort(endDate)}`)
    setOpenPayroll(true)
  }

  const submitPayrollCuts = async () => {
    let changed = false
    const nextMap: Record<number, string> = { ...potongMap }
    const payloads = rows.map(r => {
      const saldo = Math.max(0, Math.round(r.hutangSaldo || 0))
      const raw = potongMap[r.karyawan.id] || ''
      const num = Number(raw.toString().replace(/\./g, '').replace(/,/g, '')) || 0
      const amount = saldo <= 0 ? 0 : Math.min(Math.max(0, num), saldo)
      const nextVal = amount > 0 ? formatRibuanId(String(amount)) : ''
      if ((nextMap[r.karyawan.id] || '') !== nextVal) {
        nextMap[r.karyawan.id] = nextVal
        changed = true
      }
      return { id: r.karyawan.id, amount }
    }).filter(p => p.amount > 0)

    if (changed) setPotongMap(nextMap)

    if (payloads.length === 0) {
      toast.error('Tidak ada potongan yang diisi')
      return
    }

    setIsSubmitting(true)
    const dateUse = massDate || endDate || format(new Date(), 'yyyy-MM-dd')
    try {
      await Promise.all(payloads.map(p =>
        fetch('/api/karyawan/operasional/pembayaran', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kebunId: selectedKebunId || null,
            karyawanId: p.id,
            jumlah: p.amount,
            date: dateUse,
            deskripsi: massDesc || `Potong hutang periode ${formatShort(startDate)} s/d ${formatShort(endDate)}`
          })
        })
      ))
      toast.success('Potongan hutang disimpan')
      setOpenPayroll(false)
      await mutate()
    } catch (e) {
      toast.error('Gagal menyimpan potongan massal')
    } finally {
      setIsSubmitting(false)
    }
  }

  const exportPayrollPdf = async () => {
    try {
      const jsPDF = (await import('jspdf')).default
      const autoTable = (await import('jspdf-autotable')).default
      const doc = new jsPDF()
      
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text(
        `DAFTAR HUTANG PERIODE  TGL ${formatShort(startDate)} s/d ${formatShort(endDate)}`,
        14,
        20
      )
      
      const tableBody = rows.map((r, idx) => {
        const raw = potongMap[r.karyawan.id] || ''
        const potong = Number(raw.toString().replace(/\./g, '').replace(/,/g, '')) || 0
        const saldo = Math.round(r.hutangSaldo) || 0
        const sisa = Math.max(0, saldo - potong)
        return [
          String(idx + 1),
          r.karyawan.name,
          format(new Date(endDate || new Date()), 'dd-MMM-yy', { locale: idLocale }),
          `RP. ${saldo.toLocaleString('id-ID')}`,
          `RP. ${potong.toLocaleString('id-ID')}`,
          `RP. ${sisa.toLocaleString('id-ID')}`,
          ''
        ]
      })

      autoTable(doc, {
        head: [['NO', 'NAMA', 'TANGGAL', 'SALDO', 'POTONG', 'SISA', 'KETERANGAN']],
        body: tableBody,
        startY: 28,
        theme: 'grid',
        headStyles: { fillColor: [0, 0, 0] },
        styles: { fontSize: 10 }
      })

      const finalY = (doc as any).lastAutoTable.finalY || 28
      doc.setFontSize(12)
      doc.text(
        `JUMLAH      RP. ${totalPotong.toLocaleString('id-ID')}          RP. ${totalSisa.toLocaleString('id-ID')}`,
        14,
        finalY + 10
      )

      doc.save(`Daftar-Hutang-Periode-${format(new Date(), 'yyyyMMdd')}.pdf`)
    } catch (error) {
      console.error(error)
      toast.error('Gagal export PDF')
    }
  }
  const exportPayrollCsv = async () => {
    try {
      const headers = ['NO', 'NAMA', 'TANGGAL', 'SALDO', 'POTONG', 'SISA', 'KETERANGAN']
      const rowsCsv = rows.map((r, idx) => {
        const raw = potongMap[r.karyawan.id] || ''
        const potong = Number(raw.toString().replace(/\./g, '').replace(/,/g, '')) || 0
        const saldo = Math.round(r.hutangSaldo) || 0
        const sisa = Math.max(0, saldo - potong)
        const tanggal = format(new Date(endDate || new Date()), 'dd-MMM-yy', { locale: idLocale })
        return [
          String(idx + 1),
          r.karyawan.name,
          tanggal,
          `RP. ${saldo.toLocaleString('id-ID')}`,
          `RP. ${potong.toLocaleString('id-ID')}`,
          `RP. ${sisa.toLocaleString('id-ID')}`,
          ''
        ]
      })
      const csvLines = [
        headers.join(','),
        ...rowsCsv.map(cols =>
          cols.map(val => {
            const s = String(val)
            const needsQuote = s.includes(',') || s.includes('"') || s.includes('\n')
            const escaped = s.replace(/"/g, '""')
            return needsQuote ? `"${escaped}"` : escaped
          }).join(',')
        )
      ]
      const csvContent = csvLines.join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Daftar-Hutang-Periode-${format(new Date(), 'yyyyMMdd')}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error(error)
      toast.error('Gagal export CSV')
    }
  }

  // --- Detail summary (hutang/potongan/sisa) ---
  const totalHutangDetail = useMemo(() => {
    return detailRows.reduce((acc, d) => acc + (d.kategori === 'HUTANG_KARYAWAN' ? d.jumlah : 0), 0)
  }, [detailRows])
  const totalPotonganDetail = useMemo(() => {
    return detailRows.reduce((acc, d) => acc + (d.kategori === 'PEMBAYARAN_HUTANG' ? d.jumlah : 0), 0)
  }, [detailRows])
  const lastPotonganDetail = useMemo(() => {
    const found = detailRows.find(d => d.kategori === 'PEMBAYARAN_HUTANG')
    return found ? found.jumlah : 0
  }, [detailRows])
  const sisaHutangDetail = Math.max(0, Math.round(totalHutangDetail - totalPotonganDetail))

  // --- Export Detail (PDF & CSV) ---
  const exportDetailPdf = async () => {
    try {
      const jsPDF = (await import('jspdf')).default
      const autoTable = (await import('jspdf-autotable')).default
      const doc = new jsPDF()
      const kebunName = selectedKebunId ? (kebunList.find(k => k.id === selectedKebunId)?.name || '-') : '-'
      doc.setFontSize(16)
      doc.text(`RINCIAN HUTANG/POTONGAN`, 14, 18)
      doc.setFontSize(11)
      doc.text(`Karyawan: ${selectedUser?.name || '-'}`, 14, 28)
      doc.text(`Kebun: ${kebunName}`, 14, 36)
      doc.text(`Total Hutang: Rp ${Math.round(totalHutangDetail).toLocaleString('id-ID')}   Total Potongan: Rp ${Math.round(totalPotonganDetail).toLocaleString('id-ID')}   Sisa: Rp ${sisaHutangDetail.toLocaleString('id-ID')}`, 14, 44)
      const body = detailRows.map(d => {
        const isHutang = d.kategori === 'HUTANG_KARYAWAN'
        const isPotongan = d.kategori === 'PEMBAYARAN_HUTANG'
        return [
          format(new Date(d.date), 'dd-MMM-yy', { locale: idLocale }),
          isHutang ? `Rp ${Math.round(d.jumlah).toLocaleString('id-ID')}` : '',
          isPotongan ? `Rp ${Math.round(d.jumlah).toLocaleString('id-ID')}` : '',
          d.deskripsi || '',
        ]
      })
      // Tambahkan baris TOTAL di akhir untuk meniru tampilan neraca
      body.push([
        'TOTAL',
        `Rp ${Math.round(totalHutangDetail).toLocaleString('id-ID')}`,
        `Rp ${Math.round(totalPotonganDetail).toLocaleString('id-ID')}`,
        `Sisa: Rp ${sisaHutangDetail.toLocaleString('id-ID')}`,
      ])
      autoTable(doc, {
        head: [['TANGGAL', 'HUTANG (RP)', 'POTONGAN (RP)', 'DESKRIPSI']],
        body,
        startY: 48,
        theme: 'grid',
        styles: { fontSize: 10, lineColor: [220, 220, 220], lineWidth: 0.2 },
        headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: { 3: { cellWidth: 90 } },
        didParseCell: (data: any) => {
          if (data.section === 'body') {
            const isLastRow = data.row.index === body.length - 1
            if (isLastRow) {
              // Footer total bergaya biru muda agar mirip UI
              data.cell.styles.fillColor = [219, 234, 254] // blue-100
              data.cell.styles.textColor = [30, 64, 175] // blue-800
              data.cell.styles.fontStyle = 'bold'
            }
          }
        },
      } as any)
      const safeName = (selectedUser?.name || 'karyawan').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '-')
      doc.save(`Rincian-Hutang-${safeName}-${format(new Date(), 'yyyyMMdd')}.pdf`)
    } catch (e) {
      toast.error('Gagal export PDF')
      console.error(e)
    }
  }
  const exportDetailCsv = () => {
    try {
      const rowsCsv = [
        ['TANGGAL', 'HUTANG_RP', 'POTONGAN_RP', 'DESKRIPSI'],
        ...detailRows.map(d => {
          const isHutang = d.kategori === 'HUTANG_KARYAWAN'
          const isPotongan = d.kategori === 'PEMBAYARAN_HUTANG'
          return [
            format(new Date(d.date), 'yyyy-MM-dd'),
            isHutang ? String(Math.round(d.jumlah)) : '',
            isPotongan ? String(Math.round(d.jumlah)) : '',
            (d.deskripsi || '').replace(/(\r\n|\n|\r)/gm, ' '),
          ]
        }),
        [],
        ['TOTAL', String(Math.round(totalHutangDetail)), String(Math.round(totalPotonganDetail)), `SISA: ${sisaHutangDetail}`],
      ]
      const csv = rowsCsv.map(r => r.map(v => {
        const s = String(v ?? '')
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
      }).join(',')).join('\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const safeName = (selectedUser?.name || 'karyawan').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '-')
      a.href = url
      a.download = `Rincian-Hutang-${safeName}-${format(new Date(), 'yyyyMMdd')}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('CSV berhasil diunduh')
    } catch (e) {
      console.error(e)
      toast.error('Gagal export CSV')
    }
  }
  const exportSummaryCsv = () => {
    const escape = (val: any) => {
      const s = String(val ?? '')
      const needsQuote = s.includes(',') || s.includes('"') || s.includes('\n')
      const escaped = s.replace(/"/g, '""')
      return needsQuote ? `"${escaped}"` : escaped
    }
    const lines: string[] = []
    lines.push('Ringkasan Karyawan')
    lines.push(`Periode Gaji,${escape(dateDisplay)}`)
    lines.push(`Saldo Hutang,Akumulatif`)
    lines.push(`Kebun,${escape(selectedKebunId ? (kebunList.find(k => k.id === selectedKebunId)?.name ?? 'Kebun') : 'Semua Kebun')}`)
    lines.push(`Jenis,${escape(formatJobTypeLabel(summaryJobType))}`)
    lines.push(`Karyawan,${escape(selectedUser?.name || 'Semua Karyawan')}`)
    lines.push('')
    lines.push('Ringkasan Total')
    lines.push(['Total Gaji', summaryData?.gaji?.total || 0].map(escape).join(','))
    lines.push(['Gaji Dibayar', summaryData?.gaji?.paid || 0].map(escape).join(','))
    lines.push(['Gaji Belum Dibayar', summaryData?.gaji?.unpaid || 0].map(escape).join(','))
    lines.push(['Total Hutang (Akumulatif)', summaryData?.hutang?.total || 0].map(escape).join(','))
    lines.push('')
    lines.push('Top Gaji')
    lines.push(['Karyawan', 'Total Gaji'].map(escape).join(','))
    topGajiRows.forEach(r => lines.push([r.karyawan.name, r.totalGaji || 0].map(escape).join(',')))
    lines.push('')
    lines.push('Top Hutang (Akumulatif)')
    lines.push(['Karyawan', 'Saldo Hutang'].map(escape).join(','))
    topHutangRows.forEach(r => lines.push([r.karyawan.name, r.hutangSaldo || 0].map(escape).join(',')))
    lines.push('')
    lines.push('Top Hari Kerja')
    lines.push(['Karyawan', 'Hari Kerja'].map(escape).join(','))
    topHariKerjaRows.forEach(r => lines.push([r.karyawan.name, r.hariKerja || 0].map(escape).join(',')))
    lines.push('')
    lines.push('Ringkasan per Karyawan')
    lines.push(['Karyawan', 'Hari Kerja', 'Total Gaji', 'Saldo Hutang'].map(escape).join(','))
    filteredSummaryRows.forEach(r => lines.push([r.karyawan.name, r.hariKerja || 0, r.totalGaji || 0, r.hutangSaldo || 0].map(escape).join(',')))
    lines.push('')
    lines.push('Ringkasan per Jenis Pekerjaan')
    lines.push(['Jenis Pekerjaan', 'Total Gaji', 'Total Hutang', 'Pembayaran', 'Saldo Hutang'].map(escape).join(','))
    jobTypeSummary.forEach(r => lines.push([formatJobTypeLabel(r.jobType), r.gaji || 0, r.hutang || 0, r.pembayaran || 0, r.saldo || 0].map(escape).join(',')))
    lines.push('')
    lines.push('Ringkasan per Kebun')
    lines.push(['Kebun', 'Total Gaji', 'Gaji Dibayar', 'Gaji Belum Dibayar', 'Total Hutang'].map(escape).join(','))
    ;[...kebunSummaries].sort((a, b) => b.gajiTotal - a.gajiTotal).forEach(r => {
      lines.push([r.kebunName, r.gajiTotal || 0, r.gajiPaid || 0, r.gajiUnpaid || 0, r.hutangTotal || 0].map(escape).join(','))
    })
    const csvContent = lines.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Ringkasan-Karyawan-${format(new Date(), 'yyyyMMdd')}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const exportBiayaTagPdf = async () => {
    try {
      const jsPDF = (await import('jspdf')).default
      const autoTable = (await import('jspdf-autotable')).default
      const doc = new jsPDF({ orientation: 'landscape' })
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('BIAYA (TAG KARYAWAN)', 14, 18)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(`Karyawan: ${selectedUser?.name || '-'}`, 14, 26)
      doc.text(`Periode: ${new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(absenMonth)}`, 14, 31)
      const total = biayaKaryawanRows.reduce((acc, r: any) => acc + (Number(r?.jumlah) || 0), 0)
      autoTable(doc, {
        head: [['Tanggal', 'Deskripsi', 'Kategori', 'Sumber', 'Diinput Oleh', 'Jumlah']],
        body: [
          ...biayaKaryawanRows.map((r: any) => [
            r?.date ? format(new Date(r.date), 'dd MMM yyyy', { locale: idLocale }) : '-',
            String(r?.deskripsi || '-'),
            String(r?.kategori || '-'),
            String(r?.source || 'KAS'),
            String(r?.user?.name || '-'),
            `Rp ${Number(r?.jumlah || 0).toLocaleString('id-ID')}`,
          ]),
          ['', '', '', '', 'Total', `Rp ${Math.round(total).toLocaleString('id-ID')}`],
        ],
        startY: 38,
        theme: 'grid',
        headStyles: { fillColor: [15, 118, 110] },
        styles: { fontSize: 9 },
        columnStyles: { 5: { halign: 'right' }, 4: { cellWidth: 45 }, 1: { cellWidth: 90 } },
      })
      doc.save(`Biaya-Tag-Karyawan-${selectedUser?.name || 'Karyawan'}-${format(absenMonth, 'yyyy-MM')}.pdf`)
    } catch {
      toast.error('Gagal export PDF')
    }
  }

  const exportAbsenPayHistoryPdf = async () => {
    try {
      const jsPDF = (await import('jspdf')).default
      const autoTable = (await import('jspdf-autotable')).default
      const doc = new jsPDF({ orientation: 'landscape' })
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('HISTORY PEMBAYARAN GAJI', 14, 18)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(`Karyawan: ${selectedUser?.name || '-'}`, 14, 26)
      const totalJumlah = absenPayHistoryRows.reduce((acc, r) => acc + (Number(r.jumlah) || 0), 0)
      const totalPotong = absenPayHistoryRows.reduce((acc, r) => acc + (Number(r.potonganHutang) || 0), 0)
      autoTable(doc, {
        head: [['Periode Gaji', 'Dibayar Tanggal', 'Jumlah', 'Potongan Hutang', 'Dibayar Oleh', 'Keterangan']],
        body: [
          ...absenPayHistoryRows.map((r) => [
            r.startDate === r.endDate
              ? format(new Date(r.startDate), 'dd MMM yyyy', { locale: idLocale })
              : `${format(new Date(r.startDate), 'dd MMM yyyy', { locale: idLocale })} - ${format(new Date(r.endDate), 'dd MMM yyyy', { locale: idLocale })}`,
            format(new Date(r.paidAt), 'dd MMM yyyy', { locale: idLocale }),
            `Rp ${Number(r.jumlah || 0).toLocaleString('id-ID')}`,
            `Rp ${Number(r.potonganHutang || 0).toLocaleString('id-ID')}`,
            String(r.userName || '-'),
            String(r.deskripsi || '-'),
          ]),
          ['Total', '', `Rp ${Math.round(totalJumlah).toLocaleString('id-ID')}`, `Rp ${Math.round(totalPotong).toLocaleString('id-ID')}`, '', ''],
        ],
        startY: 32,
        theme: 'grid',
        headStyles: { fillColor: [88, 28, 135] },
        styles: { fontSize: 9 },
        columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 5: { cellWidth: 90 } },
      })
      doc.save(`History-Pembayaran-Gaji-${selectedUser?.name || 'Karyawan'}-${format(new Date(), 'yyyyMMdd')}.pdf`)
    } catch {
      toast.error('Gagal export PDF')
    }
  }

  const exportSummaryPdf = async () => {
    try {
      const jsPDF = (await import('jspdf')).default
      const autoTable = (await import('jspdf-autotable')).default
      const doc = new jsPDF()
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('RINGKASAN KARYAWAN', 14, 18)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(`Periode Gaji: ${dateDisplay}`, 14, 26)
      doc.text(`Saldo Hutang: Akumulatif`, 14, 31)
      doc.text(`Kebun: ${selectedKebunId ? (kebunList.find(k => k.id === selectedKebunId)?.name ?? 'Kebun') : 'Semua Kebun'}`, 14, 36)
      doc.text(`Jenis: ${formatJobTypeLabel(summaryJobType)}`, 14, 41)
      doc.text(`Karyawan: ${selectedUser?.name || 'Semua Karyawan'}`, 14, 46)
      autoTable(doc, {
        head: [['Ringkasan', 'Nilai']],
        body: [
          ['Total Gaji', `Rp ${(summaryData?.gaji?.total || 0).toLocaleString('id-ID')}`],
          ['Gaji Dibayar', `Rp ${(summaryData?.gaji?.paid || 0).toLocaleString('id-ID')}`],
          ['Gaji Belum Dibayar', `Rp ${(summaryData?.gaji?.unpaid || 0).toLocaleString('id-ID')}`],
          ['Total Hutang (Akumulatif)', `Rp ${(summaryData?.hutang?.total || 0).toLocaleString('id-ID')}`],
        ],
        startY: 52,
        theme: 'grid',
        headStyles: { fillColor: [0, 0, 0] },
        styles: { fontSize: 10 }
      })
      const y1 = (doc as any).lastAutoTable.finalY || 60
      autoTable(doc, {
        head: [['Top Gaji', 'Total Gaji']],
        body: topGajiRows.map(r => [r.karyawan.name, `Rp ${Number(r.totalGaji || 0).toLocaleString('id-ID')}`]),
        startY: y1 + 6,
        theme: 'grid',
        headStyles: { fillColor: [0, 0, 0] },
        styles: { fontSize: 9 }
      })
      const y2 = (doc as any).lastAutoTable.finalY || y1 + 20
      autoTable(doc, {
        head: [['Top Hutang (Akumulatif)', 'Saldo Hutang']],
        body: topHutangRows.map(r => [r.karyawan.name, `Rp ${Number(r.hutangSaldo || 0).toLocaleString('id-ID')}`]),
        startY: y2 + 6,
        theme: 'grid',
        headStyles: { fillColor: [0, 0, 0] },
        styles: { fontSize: 9 }
      })
      const y3 = (doc as any).lastAutoTable.finalY || y2 + 20
      autoTable(doc, {
        head: [['Top Hari Kerja', 'Hari Kerja']],
        body: topHariKerjaRows.map(r => [r.karyawan.name, String(r.hariKerja || 0)]),
        startY: y3 + 6,
        theme: 'grid',
        headStyles: { fillColor: [0, 0, 0] },
        styles: { fontSize: 9 }
      })
      const y4 = (doc as any).lastAutoTable.finalY || y3 + 20
      autoTable(doc, {
        head: [['Karyawan', 'Hari Kerja', 'Total Gaji', 'Saldo Hutang']],
        body: filteredSummaryRows.map(r => [
          r.karyawan.name,
          String(r.hariKerja || 0),
          `Rp ${Number(r.totalGaji || 0).toLocaleString('id-ID')}`,
          `Rp ${Number(r.hutangSaldo || 0).toLocaleString('id-ID')}`
        ]),
        startY: y4 + 8,
        theme: 'grid',
        headStyles: { fillColor: [0, 0, 0] },
        styles: { fontSize: 9 }
      })
      const y5 = (doc as any).lastAutoTable.finalY || y4 + 30
      autoTable(doc, {
        head: [['Jenis Pekerjaan', 'Total Gaji', 'Total Hutang', 'Pembayaran', 'Saldo Hutang']],
        body: jobTypeSummary.map(r => [
          formatJobTypeLabel(r.jobType),
          `Rp ${Number(r.gaji || 0).toLocaleString('id-ID')}`,
          `Rp ${Number(r.hutang || 0).toLocaleString('id-ID')}`,
          `Rp ${Number(r.pembayaran || 0).toLocaleString('id-ID')}`,
          `Rp ${Number(r.saldo || 0).toLocaleString('id-ID')}`
        ]),
        startY: y5 + 8,
        theme: 'grid',
        headStyles: { fillColor: [0, 0, 0] },
        styles: { fontSize: 9 }
      })
      const y6 = (doc as any).lastAutoTable.finalY || y5 + 30
      autoTable(doc, {
        head: [['Kebun', 'Total Gaji', 'Gaji Dibayar', 'Gaji Belum Dibayar', 'Total Hutang']],
        body: [...kebunSummaries].sort((a, b) => b.gajiTotal - a.gajiTotal).map(r => [
          r.kebunName,
          `Rp ${Number(r.gajiTotal || 0).toLocaleString('id-ID')}`,
          `Rp ${Number(r.gajiPaid || 0).toLocaleString('id-ID')}`,
          `Rp ${Number(r.gajiUnpaid || 0).toLocaleString('id-ID')}`,
          `Rp ${Number(r.hutangTotal || 0).toLocaleString('id-ID')}`
        ]),
        startY: y6 + 8,
        theme: 'grid',
        headStyles: { fillColor: [0, 0, 0] },
        styles: { fontSize: 9 }
      })
      doc.save(`Ringkasan-Karyawan-${format(new Date(), 'yyyyMMdd')}.pdf`)
    } catch (error) {
      console.error(error)
      toast.error('Gagal export PDF')
    }
  }

  const openHutangModal = (user: User) => {
    setHutangModalUser(user)
    setHutangJumlah('')
    setHutangTanggal('')
    setHutangDeskripsi('Hutang Karyawan')
    if (!selectedKebunId && typeof user.kebunId === 'number') {
      setSelectedKebunId(user.kebunId)
      setSummaryKebunSet(true)
      setSummaryKebunId(user.kebunId)
    }
    setActiveTab('hutang')
    setOpenHutang(true)
  }

  const openPotongModal = (user: User) => {
    setHutangModalUser(user)
    setPotongJumlah('')
    setPotongTanggal('')
    setPotongDeskripsi('Pembayaran Hutang Karyawan')
    if (!selectedKebunId && typeof user.kebunId === 'number') {
      setSelectedKebunId(user.kebunId)
      setSummaryKebunSet(true)
      setSummaryKebunId(user.kebunId)
    }
    setActiveTab('hutang')
    setOpenPotong(true)
  }
  const openDetailModal = async (u: User) => {
    setHutangModalUser(u)
    setActiveTab('hutang')
    setDetailLoading(true)
    setOpenDetail(true)
    try {
      const sp = new URLSearchParams()
      sp.set('karyawanId', String(u.id))
      if (selectedKebunId) sp.set('kebunId', String(selectedKebunId))
      const res = await fetch(`/api/karyawan/operasional/detail?${sp.toString()}`)
      const json = await res.json()
      setDetailRows(json.data || [])
    } catch {
      setDetailRows([])
    } finally {
      setDetailLoading(false)
    }
  }
  const openEditDetailModal = (d: { id: number; date: string; jumlah: number; deskripsi: string }) => {
    setEditDetailId(d.id)
    setEditDetailDate(format(new Date(d.date), 'yyyy-MM-dd'))
    setEditDetailJumlah(formatRibuanId(String(Math.round(d.jumlah))))
    setEditDetailDeskripsi(d.deskripsi || '')
    setOpenEditDetail(true)
  }
  const submitEditDetail = async () => {
    if (!editDetailId) return
    try {
      const payload = {
        id: editDetailId,
        date: editDetailDate || undefined,
        jumlah: Number(editDetailJumlah.toString().replace(/\D/g, '')) || undefined,
        deskripsi: editDetailDeskripsi,
      }
      const res = await fetch('/api/karyawan/operasional/detail', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        toast.success('Transaksi diperbarui')
        setOpenEditDetail(false)
        await mutate()
        // refresh detail
        if (hutangModalUser) {
          const sp = new URLSearchParams()
          sp.set('karyawanId', String(hutangModalUser.id))
          if (selectedKebunId) sp.set('kebunId', String(selectedKebunId))
          const resp = await fetch(`/api/karyawan/operasional/detail?${sp.toString()}`)
          const json = await resp.json()
          setDetailRows(json.data || [])
        }
      } else {
        const err = await res.json()
        toast.error(err.error || 'Gagal memperbarui transaksi')
      }
    } catch {
      toast.error('Gagal memperbarui transaksi')
    }
  }
  const openDeleteDetailModal = (d: { id: number; date: string; jumlah: number; kategori: string; deskripsi: string }) => {
    setDeleteDetail({ id: d.id, date: d.date, jumlah: d.jumlah, kategori: d.kategori, deskripsi: d.deskripsi || '' })
    setOpenDeleteDetail(true)
  }
  const confirmDeleteDetail = async () => {
    if (!deleteDetail) return
    setDeleteLoading(true)
    try {
      const res = await fetch(`/api/karyawan/operasional/detail?id=${deleteDetail.id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Transaksi dihapus')
        setOpenDeleteDetail(false)
        setDeleteDetail(null)
        await mutate()
        if (hutangModalUser) {
          const sp = new URLSearchParams()
          sp.set('karyawanId', String(hutangModalUser.id))
          if (selectedKebunId) sp.set('kebunId', String(selectedKebunId))
          const resp = await fetch(`/api/karyawan/operasional/detail?${sp.toString()}`)
          const json = await resp.json()
          setDetailRows(json.data || [])
        }
      } else {
        const err = await res.json()
        toast.error(err.error || 'Gagal menghapus transaksi')
      }
    } catch {
      toast.error('Gagal menghapus transaksi')
    } finally {
      setDeleteLoading(false)
    }
  }

  const submitHutang = async () => {
    if (!hutangModalUser) {
      toast.error('Pilih karyawan terlebih dahulu')
      return
    }
    if (!hutangJumlah) {
      toast.error('Jumlah wajib diisi')
      return
    }
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/karyawan/operasional/hutang', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kebunId: selectedKebunId || null,
          karyawanId: hutangModalUser.id,
          jumlah: Number(hutangJumlah.toString().replace(/\./g, '').replace(/,/g, '')),
          date: hutangTanggal || undefined,
          deskripsi: hutangDeskripsi,
        }),
      })
      if (res.ok) {
        setOpenHutang(false)
        toast.success('Hutang karyawan disimpan')
        await mutate()
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Gagal menyimpan hutang')
      }
    } catch {
      toast.error('Gagal menyimpan hutang')
    } finally {
      setIsSubmitting(false)
    }
  }

  const submitPotong = async () => {
    if (!hutangModalUser) {
      toast.error('Pilih karyawan terlebih dahulu')
      return
    }
    if (!potongJumlah) {
      toast.error('Jumlah wajib diisi')
      return
    }
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/karyawan/operasional/pembayaran', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kebunId: selectedKebunId || null,
          karyawanId: hutangModalUser.id,
          jumlah: Number(potongJumlah.toString().replace(/\./g, '').replace(/,/g, '')),
          date: potongTanggal || undefined,
          deskripsi: potongDeskripsi,
        }),
      })
      if (res.ok) {
        setOpenPotong(false)
        toast.success('Pembayaran hutang disimpan')
        await mutate()
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Gagal menyimpan pembayaran hutang')
      }
    } catch {
      toast.error('Gagal menyimpan pembayaran hutang')
    } finally {
      setIsSubmitting(false)
    }
  }

  const [refreshing, setRefreshing] = useState(false)
  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await Promise.all([mutateKaryawan(), mutate()])
      if (openDetail && hutangModalUser) {
        try {
          const sp = new URLSearchParams()
          sp.set('karyawanId', String(hutangModalUser.id))
          if (selectedKebunId) sp.set('kebunId', String(selectedKebunId))
          const res = await fetch(`/api/karyawan/operasional/detail?${sp.toString()}`)
          const json = await res.json()
          setDetailRows(json.data || [])
        } catch {
          // ignore
        }
      }
      toast.success('Data diperbarui')
    } finally {
      setRefreshing(false)
    }
  }

  const handleApproveDeleteRequest = async (requestId: number) => {
    try {
      const res = await fetch(`/api/karyawan/delete-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'APPROVE' }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({} as any))
        throw new Error((err as any).error || 'Gagal menyetujui')
      }
      toast.success('Permintaan disetujui')
      await Promise.all([mutateDeleteRequests(), mutateKaryawan()])
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menyetujui')
    }
  }

  const handleRejectDeleteRequest = async (requestId: number) => {
    try {
      const res = await fetch(`/api/karyawan/delete-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REJECT' }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({} as any))
        throw new Error((err as any).error || 'Gagal menolak')
      }
      toast.success('Permintaan ditolak')
      await mutateDeleteRequests()
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menolak')
    }
  }

  const handleMove = async () => {
    if (!moveUser || !moveLocationId || !moveDate) return
    setMoveLoading(true)
    try {
      const res = await fetch('/api/karyawan/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: moveUser.id,
          locationId: moveLocationId,
          startDate: moveDate,
        }),
      })
      if (!res.ok) throw new Error('Gagal memindahkan')
      toast.success('Karyawan dipindahkan')
      setOpenMove(false)
      setMoveUser(null)
      await Promise.all([mutateKaryawan(), mutate()])
    } catch {
      toast.error('Gagal memindahkan karyawan')
    } finally {
      setMoveLoading(false)
    }
  }

  return (
    <main className="p-4 md:p-8">
      {accessDenied && (
        <div className="fixed inset-0 z-50 bg-white/90 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="max-w-xl w-full bg-white rounded-2xl border shadow p-6 text-center">
            <h1 className="text-xl font-bold mb-1">Akses Ditolak</h1>
            <p className="text-sm text-gray-600">Menu Karyawan hanya dapat diakses oleh Admin atau Pemilik. Silakan kelola karyawan melalui halaman Detail Kebun pada tab Absensi.</p>
          </div>
        </div>
      )}
      <KaryawanHeader
        refreshing={refreshing}
        onRefresh={handleRefresh}
        onAdd={() => {
          setEditKaryawan(null)
          setFormName('')
          setFormPhotoFile(null)
          setFormPhotoPreview(null)
          setFormKebunId(null)
          setFormJobType('KEBUN')
          setFormStatus('AKTIF')
          setFormRole('KARYAWAN')
          setFormTanggalMulaiBekerja(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()))
          setFormKendaraanPlatNomor('')
          setOpenAddEditKaryawan(true)
        }}
      />

      <KaryawanSummaryCards
        totalKaryawan={summaryData?.totalKaryawan ?? 0}
        totalGaji={Number(summaryData?.gaji?.total ?? 0)}
        totalHutang={Number(summaryData?.hutang?.total ?? 0)}
      />

      <div className="bg-white p-4 md:p-6 rounded-lg shadow mb-6">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold">Filter</div>
          <button
            type="button"
            onClick={() => {
              if (filterExpanded) {
                setOpenJobTypeCombo(false)
                setOpenKebunFilterCombo(false)
                setOpenKaryawanFilterCombo(false)
              }
              setFilterExpanded(v => !v)
            }}
            className="h-8 w-8 rounded-full border border-gray-200 bg-white flex items-center justify-center hover:bg-gray-50 transition-colors"
            aria-label={filterExpanded ? 'Minimize filter' : 'Maximize filter'}
            title={filterExpanded ? 'Minimize' : 'Maximize'}
          >
            <ChevronDownIcon className={`w-4 h-4 text-gray-600 transition-transform duration-300 ${filterExpanded ? 'rotate-180' : 'rotate-0'}`} />
          </button>
        </div>
        <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${filterExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
          <div className={`overflow-hidden transition-all duration-300 ${filterExpanded ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1 pointer-events-none'}`}>
            <div className="flex flex-wrap gap-2 w-full mt-3">
              <Popover open={openJobTypeCombo} onOpenChange={setOpenJobTypeCombo}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="input-style rounded-full text-sm w-full sm:w-56 flex items-center justify-between"
                  aria-haspopup="listbox"
                >
                  <span>{jobTypeOptions.find(o => o.value === selectedJobType)?.label || 'Semua Jenis Pekerjaan'}</span>
                  <ChevronDownIcon className="w-4 h-4 text-gray-500" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="p-2 w-[--radix-popover-trigger-width] max-h-60 overflow-y-auto bg-white rounded-xl border shadow-sm">
                <div className="relative mb-2">
                  <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    autoFocus
                    placeholder="Cari jenis pekerjaan…"
                    value={jobTypeQuery}
                    onChange={(e) => setJobTypeQuery(e.target.value)}
                    className="rounded-lg pl-9"
                  />
                </div>
                <div role="listbox" className="space-y-1">
                  {jobTypeOptions
                    .filter(o => o.label.toLowerCase().includes(jobTypeQuery.toLowerCase()))
                    .map(o => (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => {
                          setSelectedJobType(o.value)
                          setSummaryJobType(o.value)
                          if (o.value !== 'KEBUN') {
                            setSelectedKebunId(null)
                            setSummaryKebunSet(true)
                            setSummaryKebunId(null)
                          }
                          setOpenJobTypeCombo(false)
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 ${o.value === selectedJobType ? 'bg-emerald-50 text-emerald-700' : ''}`}
                      >
                        {o.label}
                      </button>
                    ))}
                  {jobTypeOptions.filter(o => o.label.toLowerCase().includes(jobTypeQuery.toLowerCase())).length === 0 && (
                    <div className="px-3 py-2 text-sm text-gray-500">Tidak ditemukan</div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
            {selectedJobType === 'KEBUN' && (
              <Popover open={openKebunFilterCombo} onOpenChange={setOpenKebunFilterCombo}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="input-style rounded-full text-sm w-full sm:w-56 flex items-center justify-between"
                    aria-haspopup="listbox"
                  >
                    <span>
                      {selectedKebunId
                        ? (kebunList.find(k => k.id === selectedKebunId)?.name ?? 'Pilih kebun')
                        : 'Semua Kebun'}
                    </span>
                    <ChevronDownIcon className="w-4 h-4 text-gray-500" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="p-2 w-[--radix-popover-trigger-width] max-h-60 overflow-y-auto bg-white rounded-xl border shadow-sm">
                  <div className="relative mb-2">
                    <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                      autoFocus
                      placeholder="Cari kebun…"
                      value={kebunFilterQuery}
                      onChange={(e) => setKebunFilterQuery(e.target.value)}
                      className="rounded-lg pl-9"
                    />
                  </div>
                  <div role="listbox" className="space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedKebunId(null)
                        setSummaryKebunSet(true)
                        setSummaryKebunId(null)
                        setOpenKebunFilterCombo(false)
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 ${selectedKebunId === null ? 'bg-emerald-50 text-emerald-700' : ''}`}
                    >
                      Semua Kebun
                    </button>
                    {kebunList
                      .filter(k => k.name.toLowerCase().includes(kebunFilterQuery.toLowerCase()))
                      .map(k => (
                        <button
                          key={k.id}
                          type="button"
                          onClick={() => {
                            setSelectedKebunId(k.id)
                            setSummaryKebunSet(true)
                            setSummaryKebunId(k.id)
                            setOpenKebunFilterCombo(false)
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 ${selectedKebunId === k.id ? 'bg-emerald-50 text-emerald-700' : ''}`}
                        >
                          {k.name}
                        </button>
                      ))}
                    {kebunList.filter(k => k.name.toLowerCase().includes(kebunFilterQuery.toLowerCase())).length === 0 && (
                      <div className="px-3 py-2 text-sm text-gray-500">Tidak ditemukan</div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            )}
            <select
              className="input-style rounded-full text-sm w-full sm:w-56"
              value={selectedLocationFilterId === 'all' ? 'all' : String(selectedLocationFilterId)}
              onChange={(e) => {
                const val = e.target.value
                const next = val === 'all' ? 'all' : Number(val)
                setSelectedLocationFilterId(next)
                setOpenAbsenSection(false)
              }}
            >
              <option value="all">Semua Lokasi</option>
              {workLocations.map((loc) => (
                <option key={loc.id} value={loc.id}>{getLocationLabel(loc)}</option>
              ))}
            </select>
            <select
              className="input-style rounded-full text-sm w-full sm:w-56"
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value)
                setOpenAbsenSection(false)
              }}
            >
              <option value="all">Semua Status</option>
              <option value="AKTIF">Aktif</option>
              <option value="NONAKTIF">Nonaktif</option>
            </select>
            {selectedJobType !== 'KEBUN' && (
              <Popover open={openKaryawanFilterCombo} onOpenChange={setOpenKaryawanFilterCombo}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="input-style rounded-full text-sm w-full sm:w-56 flex items-center justify-between"
                    aria-haspopup="listbox"
                  >
                    <span>{selectedUser?.name || 'Semua Karyawan'}</span>
                    <ChevronDownIcon className="w-4 h-4 text-gray-500" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="p-2 w-[--radix-popover-trigger-width] max-h-60 overflow-y-auto bg-white rounded-xl border shadow-sm">
                  <div className="relative mb-2">
                    <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                      autoFocus
                      placeholder="Cari karyawan…"
                      value={karyawanFilterQuery}
                      onChange={(e) => setKaryawanFilterQuery(e.target.value)}
                      className="rounded-lg pl-9"
                    />
                  </div>
                  <div role="listbox" className="space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedUser(null)
                        setAbsenUserId(null)
                        setSummaryKaryawanId(null)
                        setOpenAbsenSection(false)
                        setOpenKaryawanFilterCombo(false)
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 ${!selectedUser ? 'bg-emerald-50 text-emerald-700' : ''}`}
                    >
                      Semua Karyawan
                    </button>
                    {filteredKaryawanList
                      .filter(k => k.name.toLowerCase().includes(karyawanFilterQuery.toLowerCase()))
                      .map(k => (
                        <button
                          key={k.id}
                          type="button"
                          onClick={() => {
                            setSelectedUser(k)
                            setAbsenUserId(k.id)
                            setSummaryKaryawanId(k.id)
                            setOpenAbsenSection(true)
                            setOpenKaryawanFilterCombo(false)
                            setTimeout(() => {
                              absenSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                            }, 0)
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 ${selectedUser?.id === k.id ? 'bg-emerald-50 text-emerald-700' : ''}`}
                        >
                          {k.name}
                        </button>
                      ))}
                    {filteredKaryawanList.filter(k => k.name.toLowerCase().includes(karyawanFilterQuery.toLowerCase())).length === 0 && (
                      <div className="px-3 py-2 text-sm text-gray-500">Tidak ditemukan</div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            )}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={`w-full sm:w-56 justify-start text-left font-normal bg-white rounded-full ${!startDate ? 'text-muted-foreground' : ''}`}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateDisplay}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-4 bg-white" align="start">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h4 className="font-medium leading-none">Rentang Waktu</h4>
                    <p className="text-sm text-muted-foreground">
                      Pilih rentang waktu cepat
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" onClick={() => applyQuickRange('today')} className={quickRange === 'today' ? 'bg-accent' : ''}>Hari Ini</Button>
                    <Button variant="outline" size="sm" onClick={() => applyQuickRange('yesterday')} className={quickRange === 'yesterday' ? 'bg-accent' : ''}>Kemarin</Button>
                    <Button variant="outline" size="sm" onClick={() => applyQuickRange('last_week')} className={quickRange === 'last_week' ? 'bg-accent' : ''}>7 Hari</Button>
                    <Button variant="outline" size="sm" onClick={() => applyQuickRange('last_30_days')} className={quickRange === 'last_30_days' ? 'bg-accent' : ''}>30 Hari</Button>
                    <Button variant="outline" size="sm" onClick={() => applyQuickRange('this_month')} className={quickRange === 'this_month' ? 'bg-accent' : ''}>Bulan Ini</Button>
                    <Button variant="outline" size="sm" onClick={() => applyQuickRange('this_year')} className={quickRange === 'this_year' ? 'bg-accent' : ''}>Tahun Ini</Button>
                  </div>
                  <div className="border-t pt-4 space-y-2">
                    <h4 className="font-medium leading-none">Kustom</h4>
                    <div className="grid gap-2">
                      <div className="grid grid-cols-3 items-center gap-4">
                        <Label className="text-xs">Dari</Label>
                        <Input
                          type="date"
                          className="col-span-2 h-8"
                          value={startDate}
                          onChange={(e) => {
                            const val = e.target.value
                            setStartDate(val)
                            setSummaryStartDate(val)
                            setQuickRange('custom')
                          }}
                        />
                      </div>
                      <div className="grid grid-cols-3 items-center gap-4">
                        <Label className="text-xs">Sampai</Label>
                        <Input
                          type="date"
                          className="col-span-2 h-8"
                          value={endDate}
                          onChange={(e) => {
                            const val = e.target.value
                            setEndDate(val)
                            setSummaryEndDate(val)
                            setQuickRange('custom')
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <div className="relative w-full sm:w-56">
              <Input
                className="rounded-full w-full pr-10"
                placeholder="Cari nama..."
                value={karyawanSearch}
                onChange={(e) => {
                  const next = e.target.value
                  setKaryawanSearch(next)
                  if (!String(next || '').trim()) {
                    setKaryawanSearchApplied('')
                    setKaryawanPage(1)
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    applyKaryawanSearch()
                  }
                }}
              />
              <button
                type="button"
                onClick={applyKaryawanSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                aria-label="Cari"
              >
                <MagnifyingGlassIcon className="h-5 w-5" />
              </button>
            </div>
            </div>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <KaryawanTabs />

        <TabsContent value="karyawan">
          {canDelete && (
            <div className="bg-white p-4 md:p-6 rounded-lg shadow mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Permintaan Hapus Karyawan</h2>
              </div>
              {loadingDeleteRequests ? (
                <div className="text-sm text-gray-500">Memuat...</div>
              ) : deleteRequests.length === 0 ? (
                <div className="text-sm text-gray-500">Tidak ada permintaan</div>
              ) : (
                <div className="space-y-3">
                  {deleteRequests.map((req) => (
                    <div key={req.id} className="rounded-xl border border-gray-100 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div className="space-y-1">
                        <div className="text-sm font-semibold text-gray-900">{req.karyawan?.name || '-'}</div>
                        <div className="text-xs text-gray-500">Diajukan oleh {req.requester?.name || '-'}</div>
                        <div className="text-xs text-gray-500">{format(new Date(req.createdAt), 'dd-MMM-yy HH:mm', { locale: idLocale })}</div>
                        {req.reason ? <div className="text-xs text-gray-500">Alasan: {req.reason}</div> : null}
                      </div>
                      <div className="flex items-center gap-2 justify-end">
                        <Button className="rounded-full" variant="outline" onClick={() => handleRejectDeleteRequest(req.id)}>Tolak</Button>
                        <Button className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleApproveDeleteRequest(req.id)}>Setujui</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="bg-white p-4 md:p-6 rounded-lg shadow mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Daftar Karyawan</h2>
              <button
                type="button"
                onClick={() => setOpenKaryawanTable(v => !v)}
                aria-label="Toggle daftar karyawan"
                className="h-8 w-8 rounded-full border border-gray-200 bg-white flex items-center justify-center hover:bg-gray-50 transition-colors"
              >
                <ChevronDownIcon className={`h-4 w-4 transition-transform ${openKaryawanTable ? 'rotate-180' : ''}`} />
              </button>
            </div>
            {openKaryawanTable && (
              <>
              <div className="md:hidden space-y-3">
                {loadingKaryawan ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  ))
                ) : filteredKaryawanList.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center text-sm text-gray-500">
                    Tidak ada karyawan
                  </div>
                ) : (
                  <>
                    {filteredKaryawanList.map(k => {
                      const statusValue = (k.status || 'AKTIF').toString().toUpperCase()
                      const statusLabel = statusValue.includes('NON') ? 'Nonaktif' : 'Aktif'
                      const statusClass = statusValue.includes('NON') ? 'bg-gray-100 text-gray-600' : 'bg-emerald-100 text-emerald-700'
                      const jobLabel = (() => {
                        const raw = (k.jenisPekerjaan || k.jobType || (typeof k.kebunId === 'number' ? 'KEBUN' : '')).toString().toUpperCase().trim();
                        if (!raw) return '-';
                        if (raw.includes('KEBUN')) return 'Karyawan Kebun';
                        if (raw.includes('HARIAN')) return 'Pekerja Harian';
                        if (raw.includes('TUKANG') || raw.includes('BANGUNAN')) return 'Tukang Bangunan';
                        if (raw.includes('OPERATOR')) return 'Operator';
                        return raw;
                      })()
                      return (
                        <div
                          key={`card-${k.id}`}
                          onClick={(e) => {
                            const target = e.target as HTMLElement
                            if (target.closest('button, a, input, [role="button"]')) return
                            openDetailKaryawan(k)
                          }}
                          className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-4 transition-colors hover:bg-gray-50/50"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              {k.photoUrl ? (
                                <img
                                  src={k.photoUrl}
                                  alt={k.name}
                                  className="w-12 h-12 rounded-full object-cover border border-gray-200 shrink-0"
                                />
                              ) : (
                                <div className="w-12 h-12 bg-gray-900 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0">
                                  {k.name.charAt(0)}
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="font-bold text-gray-900 truncate text-base">{k.name}</div>
                                <div className={`mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full w-fit uppercase tracking-wider ${statusClass}`}>
                                  {statusLabel}
                                </div>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="rounded-full bg-emerald-50 text-emerald-700 shrink-0"
                              onClick={() => openDetailKaryawan(k)}
                            >
                              <EyeIcon className="w-5 h-5" />
                            </Button>
                          </div>

                          <div className="grid grid-cols-2 gap-y-2 gap-x-4 pt-2 border-t border-gray-50">
                            <div className="space-y-0.5">
                              <p className="text-[10px] text-gray-400 uppercase font-medium">Pekerjaan</p>
                              <p className="text-xs font-medium text-gray-700 truncate">{jobLabel}</p>
                            </div>
                            <div className="space-y-0.5">
                              <p className="text-[10px] text-gray-400 uppercase font-medium">No. HP</p>
                              <p className="text-xs font-medium text-gray-700 truncate">{k.noHp || k.phone || '-'}</p>
                            </div>
                            <div className="space-y-0.5 col-span-2">
                              <p className="text-[10px] text-gray-400 uppercase font-medium">Lokasi Aktif</p>
                              <p className="text-xs font-medium text-gray-700 truncate">{getActiveLocationLabel(k)}</p>
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-50">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-9 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 flex-1"
                              onClick={() => { setEditKaryawan(k); setFormName(k.name); setFormPhotoFile(null); setFormPhotoPreview(k.photoUrl || null); setFormKebunId(typeof k.kebunId !== 'undefined' ? (k.kebunId ?? null) : null); setFormJobType((k.jenisPekerjaan || k.jobType || 'KEBUN').toString().toUpperCase()); setFormStatus((k.status || 'AKTIF').toString().toUpperCase()); setFormRole((k.role || 'KARYAWAN').toString().toUpperCase()); setFormTanggalMulaiBekerja((k as any).tanggalMulaiBekerja ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date((k as any).tanggalMulaiBekerja)) : ''); setFormKendaraanPlatNomor(k.kendaraanPlatNomor || ''); setOpenAddEditKaryawan(true) }}
                            >
                              <PencilSquareIcon className="w-4 h-4 mr-1.5" />
                              <span className="text-xs font-semibold">Edit</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-9 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 flex-1"
                              onClick={() => openHistoryModal(k)}
                            >
                              <ClockIcon className="w-4 h-4 mr-1.5" />
                              <span className="text-xs font-semibold">Riwayat</span>
                            </Button>
                            {canMove && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-9 w-9 p-0 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                onClick={() => openMoveModal(k)}
                                title="Pindahkan"
                              >
                                <ArrowPathIcon className="w-4 h-4" />
                              </Button>
                            )}
                            {canShowDelete && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-9 w-9 p-0 rounded-xl bg-red-50 text-red-700 hover:bg-red-100"
                                onClick={() => { setDeleteKaryawanId(k.id); setOpenDeleteKaryawan(true) }}
                                title="Hapus"
                              >
                                <TrashIcon className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-gray-700">Total Gaji</span>
                        <span className="font-semibold text-gray-900">Rp {rows.reduce((sum, r) => sum + Number(r.totalGaji || 0), 0).toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="font-semibold text-red-600">Total Hutang</span>
                        <span className="font-semibold text-red-600">Rp {rows.reduce((sum, r) => sum + Number(r.hutangSaldo || 0), 0).toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="font-semibold text-gray-700">Total Potongan</span>
                        <span className="font-semibold text-gray-900">Rp {rows.reduce((sum, r) => sum + Number((r as any).lastPotongan?.jumlah || 0), 0).toLocaleString('id-ID')}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-[760px] w-full divide-y divide-gray-200 whitespace-nowrap">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap w-[56px]">No</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Nama</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden lg:table-cell whitespace-nowrap">Lokasi</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden lg:table-cell whitespace-nowrap">No HP</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Jenis Pekerjaan</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Aksi</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loadingKaryawan ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-10" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-40" /></td>
                      <td className="px-4 py-3 hidden lg:table-cell"><Skeleton className="h-4 w-32" /></td>
                      <td className="px-4 py-3 hidden lg:table-cell"><Skeleton className="h-4 w-28" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-40" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                      <td className="px-4 py-3 text-right"><Skeleton className="h-6 w-32 ml-auto" /></td>
                    </tr>
                  ))
                ) : filteredKaryawanList.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-center text-gray-500" colSpan={7}>Tidak ada karyawan</td>
                  </tr>
                ) : (
                  filteredKaryawanList.map((k, idx) => (
                    <tr
                      key={k.id}
                      onClick={(e) => {
                        const target = e.target as HTMLElement
                        if (target.closest('button, a, input, [role="button"]')) return
                        openDetailKaryawan(k)
                      }}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      title="Klik baris untuk melihat absensi & hutang"
                    >
                      <td className="px-4 py-3 text-sm font-semibold text-gray-600">
                        {(karyawanPage - 1) * karyawanLimit + idx + 1}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 min-w-0">
                          {k.photoUrl ? (
                            <img
                              src={k.photoUrl}
                              alt={k.name}
                              className="w-8 h-8 rounded-full object-cover border border-gray-200"
                            />
                          ) : (
                            <div className="w-8 h-8 bg-gray-900 rounded-full flex items-center justify-center text-white font-bold text-xs">
                              {k.name.charAt(0)}
                            </div>
                          )}
                          <span className="truncate max-w-[220px]">{k.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell truncate max-w-[260px]">{getActiveLocationLabel(k)}</td>
                      <td className="px-4 py-3 hidden lg:table-cell whitespace-nowrap">{k.noHp || k.phone || '-'}</td>
                      <td className="px-4 py-3">
                        {(() => {
                          const raw = (k.jenisPekerjaan || k.jobType || (typeof k.kebunId === 'number' ? 'KEBUN' : '')).toString().toUpperCase().trim();
                          if (!raw) return '-';
                          if (raw.includes('KEBUN')) return 'Karyawan Kebun';
                          if (raw.includes('HARIAN')) return 'Pekerja Harian';
                          if (raw.includes('TUKANG') || raw.includes('BANGUNAN')) return 'Tukang Bangunan';
                          if (raw.includes('OPERATOR')) return 'Operator';
                          return raw;
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        {(() => {
                          const statusValue = (k.status || 'AKTIF').toString().toUpperCase()
                          const isInactive = statusValue.includes('NON')
                          return (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${isInactive ? 'bg-gray-100 text-gray-600' : 'bg-emerald-100 text-emerald-700'}`}>
                              {isInactive ? 'Nonaktif' : 'Aktif'}
                            </span>
                          )
                        })()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2 flex-nowrap">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            onClick={() => openDetailKaryawan(k)}
                            aria-label="Detail Karyawan"
                            title="Detail"
                          >
                            <EyeIcon className="w-5 h-5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            onClick={() => { setEditKaryawan(k); setFormName(k.name); setFormPhotoFile(null); setFormPhotoPreview(k.photoUrl || null); setFormKebunId(typeof k.kebunId !== 'undefined' ? (k.kebunId ?? null) : null); setFormJobType((k.jenisPekerjaan || k.jobType || 'KEBUN').toString().toUpperCase()); setFormStatus((k.status || 'AKTIF').toString().toUpperCase()); setFormRole((k.role || 'KARYAWAN').toString().toUpperCase()); setFormTanggalMulaiBekerja((k as any).tanggalMulaiBekerja ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date((k as any).tanggalMulaiBekerja)) : ''); setFormKendaraanPlatNomor(k.kendaraanPlatNomor || ''); setOpenAddEditKaryawan(true) }}
                            aria-label="Edit Karyawan"
                            title="Edit"
                          >
                            <PencilSquareIcon className="w-5 h-5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            onClick={() => openHistoryModal(k)}
                            aria-label="Riwayat Penugasan"
                            title="Riwayat"
                          >
                            <ClockIcon className="w-5 h-5" />
                          </Button>
                          {canMove && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              onClick={() => openMoveModal(k)}
                              aria-label="Pindahkan Karyawan"
                              title="Pindahkan"
                            >
                              <ArrowPathIcon className="w-5 h-5" />
                            </Button>
                          )}
                          {canShowDelete && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="rounded-full bg-red-50 text-red-700 hover:bg-red-100"
                              onClick={() => { setDeleteKaryawanId(k.id); setOpenDeleteKaryawan(true) }}
                              aria-label="Hapus Karyawan"
                              title="Hapus"
                            >
                              <TrashIcon className="w-5 h-5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col md:flex-row items-center justify-center md:justify-between gap-3 mt-4 pt-4 border-t border-gray-100">
            <div className="text-sm text-gray-500">
              Menampilkan <span className="font-medium text-gray-800">{totalKaryawan === 0 ? 0 : Math.min((karyawanPage - 1) * karyawanLimit + 1, totalKaryawan)}</span> - <span className="font-medium text-gray-800">{Math.min(karyawanPage * karyawanLimit, totalKaryawan)}</span> dari <span className="font-medium text-gray-800">{totalKaryawan}</span> karyawan
            </div>
            <div className="flex items-center gap-2">
              <select
                className="input-style rounded-full text-sm"
                value={karyawanLimit}
                onChange={(e) => { setKaryawanLimit(Number(e.target.value)); setKaryawanPage(1); }}
                title="Jumlah per halaman"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
              <button
                onClick={() => setKaryawanPage(p => Math.max(1, p - 1))}
                disabled={karyawanPage <= 1}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-full hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Sebelumnya
              </button>
              <button
                onClick={() => setKaryawanPage(p => Math.min(totalKaryawanPages, p + 1))}
                disabled={karyawanPage >= totalKaryawanPages}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-full hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Berikutnya
              </button>
            </div>
              </div>
              </>
            )}
          </div>
          {selectedUser ? (
          <div ref={absenSectionRef} className="bg-white p-4 md:p-6 rounded-lg shadow mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-900 rounded-full flex items-center justify-center text-white font-bold">
                  {selectedUser?.name?.charAt(0) || 'K'}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{selectedUser?.name}</h3>
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Kalender Absensi - {new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(absenMonth)}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="ghost" size="sm" className="rounded-full text-gray-500 hover:text-gray-900" onClick={() => setSelectedUser(null)}>
                  Tutup Kalender
                </Button>
                <div className="flex items-center gap-1 bg-gray-50 rounded-full p-1 border border-gray-100">
                  <Button variant="ghost" size="sm" className="rounded-full h-8 w-8 p-0" onClick={() => setAbsenMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>
                    <ChevronDownIcon className="w-4 h-4 rotate-90" />
                  </Button>
                  <Button variant="ghost" size="sm" className="rounded-full h-8 w-8 p-0" onClick={() => setAbsenMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>
                    <ChevronDownIcon className="w-4 h-4 -rotate-90" />
                  </Button>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 shadow-sm">
                <p className="text-xs font-medium text-emerald-600 uppercase tracking-wider mb-1">Hari Kerja</p>
                <p className="text-2xl font-bold text-emerald-900">{absenSummary.hariKerja} <span className="text-sm font-normal text-emerald-600">Hari</span></p>
              </div>
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 shadow-sm">
                <p className="text-xs font-medium text-emerald-600 uppercase tracking-wider mb-1">Gaji Berjalan</p>
                <p className="text-2xl font-bold text-emerald-900">Rp {absenSummary.totalGaji.toLocaleString('id-ID')}</p>
              </div>
              <div className="p-4 rounded-2xl bg-red-50 border border-red-100 shadow-sm">
                <p className="text-xs font-medium text-red-600 uppercase tracking-wider mb-1">Saldo Hutang</p>
                <p className="text-2xl font-bold text-red-900">Rp {absenSummary.hutang.toLocaleString('id-ID')}</p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 shadow-sm">
                <p className="text-xs font-medium text-slate-600 uppercase tracking-wider mb-1">Biaya (Tag)</p>
                <p className="text-2xl font-bold text-slate-900">
                  {biayaKaryawanLoading ? '...' : `Rp ${biayaKaryawanTotal.toLocaleString('id-ID')}`}
                </p>
              </div>
            </div>
            {openAbsenSection && (
              <>
            <div className="flex flex-col md:flex-row items-start md:items-center gap-3 mb-4">
              <div className="flex-1"></div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="rounded-full"
                  onClick={() => {
                    const ym = `${absenMonth.getFullYear()}-${String(absenMonth.getMonth()+1).padStart(2,'0')}`
                    const rows: string[] = ['Tanggal,Jumlah (Rp),Kerja,Libur,Keterangan']
                    const start = new Date(absenMonth.getFullYear(), absenMonth.getMonth(), 1)
                    const end = new Date(absenMonth.getFullYear(), absenMonth.getMonth()+1, 0)
                    for (let d = new Date(start); d <= end; d.setDate(d.getDate()+1)) {
                      const key = new Intl.DateTimeFormat('en-CA').format(d)
                      const val = absenMap[key] || ''
                      const work = absenWorkMap[key] ? 'YA' : 'TIDAK'
                      const off = absenOffMap[key] ? 'YA' : 'TIDAK'
                      const note = (absenNoteMap[key] || '').replace(/"/g, '""')
                      rows.push(`${key},${val},${work},${off},"${note}"`)
                    }
                    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
                    const a = document.createElement('a')
                    a.href = URL.createObjectURL(blob)
                    a.download = `Absensi-${ym}.csv`
                    a.click()
                  }}
                >
                  Export CSV
                </Button>
                <Button
                  className="rounded-full bg-emerald-600 text-white hover:bg-emerald-700 border border-emerald-600"
                  onClick={() => {
                    const next: Record<string, boolean> = {}
                    unpaidDates.forEach(d => { next[d.date] = true })
                    setAbsenPaySelection(next)
                    setAbsenPayPotong('')
                    setAbsenPayPotongDesc('Potong Hutang dari Pembayaran Gaji')
                    setAbsenPayOpen(true)
                  }}
                  disabled={!absenUserId || unpaidDates.length === 0}
                >
                  Bayar Gaji
                </Button>
              </div>
            </div>
            <div className="-mx-4 sm:mx-0 overflow-x-auto no-scrollbar pb-4">
              <div className="grid grid-cols-7 gap-1 sm:gap-2 min-w-[600px] md:min-w-0 px-4 sm:px-0">
                {['Min','Sen','Sel','Rab','Kam','Jum','Sab'].map((d) => (
                  <div key={d} className="text-center text-[10px] sm:text-xs font-bold text-gray-400 py-2">{d}</div>
                ))}
                {(() => {
                  const cells: JSX.Element[] = []
                  const firstDay = new Date(absenMonth.getFullYear(), absenMonth.getMonth(), 1)
                  const startOffset = (firstDay.getDay() + 6) % 7
                  for (let i=0;i<startOffset;i++) cells.push(<div key={`pad-${i}`} />)
                  const daysInMonth = new Date(absenMonth.getFullYear(), absenMonth.getMonth()+1, 0).getDate()
                  for (let d=1; d<=daysInMonth; d++) {
                    const date = new Date(absenMonth.getFullYear(), absenMonth.getMonth(), d)
                    const key = new Intl.DateTimeFormat('en-CA').format(date)
                    const val = absenMap[key]
                    const num = Number((val||'').toString().replace(/\./g,'').replace(/,/g,'')) || 0
                    const isOff = !!absenOffMap[key]
                    const isWork = !!absenWorkMap[key]
                    const isSelfie = String(absenSourceMap[key] || '').toUpperCase() === 'SELFIE'
                    const isPaid = !!absenPaidMap[key]
                    const isFilled = !!val || isOff || isWork || !!absenNoteMap[key]
                    const color = isOff
                      ? 'bg-red-50 border-red-100 text-red-700'
                      : isPaid
                        ? 'bg-purple-50 border-purple-100 text-purple-700'
                        : (isWork ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : num > 0 ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : num < 0 ? 'bg-red-50 border-red-100 text-red-700' : 'bg-white border-gray-100 text-gray-700')
                    cells.push(
                      <button
                        key={key}
                        onClick={() => {
                          setAbsenSelectedDate(key);
                          if (val) {
                            setAbsenValue(val);
                          } else if (absenDefaultAmount > 0) {
                            setAbsenValue(formatRibuanId(String(absenDefaultAmount)));
                          } else {
                            setAbsenValue('');
                          }
                          const nextHasAmount = !!val || absenDefaultAmount > 0;
                          setAbsenWork(isSelfie || !!absenWorkMap[key] || nextHasAmount);
                          setAbsenOff(!!absenOffMap[key]);
                          setAbsenUseHourly(!!absenHourlyMap[key]);
                          setAbsenHour(absenHourMap[key] || '');
                          setAbsenRate(absenRateMap[key] || '');
                          setAbsenMealEnabled(!!absenMealEnabledMap[key]);
                          setAbsenMealAmount(absenMealMap[key] || '');
                          setAbsenNote(absenNoteMap[key] || '');
                          setAbsenSetDefault(false);
                          
                          if (isFilled) {
                            setOpenAbsenView(true);
                          } else {
                            setAbsenOpen(true);
                          }
                        }}
                        className={`relative h-20 sm:h-24 md:h-28 rounded-xl sm:rounded-2xl border p-1.5 sm:p-2 text-left hover:bg-gray-50 transition-all hover:ring-2 hover:ring-gray-200 group ${color}`}
                        disabled={!absenUserId}
                        title={key}
                      >
                        <div className="flex justify-between items-start mb-1 sm:mb-2">
                          <span className="text-[10px] sm:text-xs font-bold">{d}</span>
                          {isFilled && <CheckCircleIcon className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${isOff ? 'text-red-500' : isWork ? 'text-emerald-600' : 'text-blue-500'}`} />}
                        </div>
                        
                        <div className="space-y-0.5 sm:space-y-1">
                          {isOff ? (
                            <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-tight text-red-600">
                              Libur
                            </div>
                          ) : isWork ? (
                            <div className="flex flex-col gap-0.5">
                              <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-tight text-emerald-700">
                                Masuk Kerja
                              </div>
                              {isSelfie ? (
                                <div>
                                  <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 px-2 py-0.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wide">
                                    Selfie
                                  </span>
                                </div>
                              ) : null}
                              {num > 0 ? (
                                <span className="text-[10px] sm:text-xs font-bold truncate">Rp {num.toLocaleString('id-ID')}</span>
                              ) : null}
                            </div>
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
            <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-3">
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b">
                  <div className="text-sm font-semibold text-gray-900">Biaya (Tag Karyawan)</div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      onClick={exportBiayaTagPdf}
                      disabled={biayaKaryawanLoading || biayaKaryawanRows.length === 0}
                    >
                      Export PDF
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="rounded-full text-gray-600 hover:text-gray-900"
                      onClick={() => setBiayaKaryawanOpen(v => !v)}
                    >
                      {biayaKaryawanOpen ? 'Sembunyikan' : 'Tampilkan'}
                    </Button>
                  </div>
                </div>
                {biayaKaryawanOpen ? (
                  biayaKaryawanLoading ? (
                    <div className="px-4 py-4 text-sm text-gray-500">Memuat...</div>
                  ) : biayaKaryawanRows.length === 0 ? (
                    <div className="px-4 py-4 text-sm text-gray-500">Tidak ada biaya pada periode ini.</div>
                  ) : (
                    <div className="w-full overflow-x-auto">
                      <table className="min-w-[720px] w-full text-sm">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tanggal</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Deskripsi</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Kategori</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Sumber</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Diinput Oleh</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Jumlah</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {biayaKaryawanRows.slice(0, 20).map((r: any) => (
                            <tr key={`${r.source || 'KAS'}-${r.id}`} className="hover:bg-gray-50/50 transition-colors">
                              <td className="px-4 py-3 whitespace-nowrap text-gray-700">{format(new Date(r.date), 'dd-MMM-yy', { locale: idLocale })}</td>
                              <td className="px-4 py-3 text-gray-900">{r.deskripsi || '-'}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-gray-700">{r.kategori || '-'}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-gray-700">{String(r.source || 'KAS')}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-gray-700">{r?.user?.name || '-'}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-right text-gray-900">Rp {Number(r.jumlah || 0).toLocaleString('id-ID')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                ) : null}
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-3">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-2">
                  <h3 className="text-sm font-semibold text-gray-700">History Pembayaran Gaji</h3>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      onClick={exportAbsenPayHistoryPdf}
                      disabled={absenPayHistoryLoading || absenPayHistoryRows.length === 0}
                    >
                      Export PDF
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-full"
                      onClick={() => setAbsenPayHistoryOpen(v => !v)}
                      aria-label="Toggle history pembayaran gaji"
                    >
                      <ChevronDownIcon className={`h-4 w-4 transition-transform ${absenPayHistoryOpen ? 'rotate-180' : ''}`} />
                    </Button>
                  </div>
                </div>
                {absenPayHistoryOpen && (
                  <>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Dari</span>
                        <Input
                          type="date"
                          className="input-style h-8 rounded-full text-xs"
                          value={absenPayHistoryStart}
                          onChange={e => setAbsenPayHistoryStart(e.target.value)}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Sampai</span>
                        <Input
                          type="date"
                          className="input-style h-8 rounded-full text-xs"
                          value={absenPayHistoryEnd}
                          onChange={e => setAbsenPayHistoryEnd(e.target.value)}
                        />
                      </div>
                    </div>
                    {absenPayHistoryLoading ? (
                      <div className="text-xs text-gray-500">Memuat...</div>
                    ) : absenPayHistoryRows.length === 0 ? (
                      <div className="text-xs text-gray-500">Belum ada pembayaran gaji di rentang ini.</div>
                    ) : (
                      <div className="overflow-x-auto -mx-3 sm:mx-0">
                        <table className="min-w-[600px] w-full text-xs sm:text-sm border whitespace-nowrap">
                          <thead>
                            <tr className="border">
                              <th className="p-2 border text-left">Periode Gaji</th>
                              <th className="p-2 border text-left">Dibayar Tanggal</th>
                              <th className="p-2 border text-right">Jumlah</th>
                              <th className="p-2 border text-right">Potongan Hutang</th>
                              <th className="p-2 border text-left">Dibayar Oleh</th>
                              <th className="p-2 border text-left">Keterangan</th>
                              {canDelete && (
                                <th className="p-2 border text-center">Aksi</th>
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {absenPayHistoryRows.map(r => (
                              <tr key={r.id} className="border">
                                <td className="p-2 border">
                                  {r.startDate === r.endDate
                                    ? format(new Date(r.startDate), 'dd MMM yyyy', { locale: idLocale })
                                    : `${format(new Date(r.startDate), 'dd MMM yyyy', { locale: idLocale })} - ${format(new Date(r.endDate), 'dd MMM yyyy', { locale: idLocale })}`}
                                </td>
                                <td className="p-2 border">{format(new Date(r.paidAt), 'dd MMM yyyy', { locale: idLocale })}</td>
                                <td className="p-2 border text-right">Rp {Number(r.jumlah).toLocaleString('id-ID')}</td>
                                <td className="p-2 border text-right">Rp {Number(r.potonganHutang || 0).toLocaleString('id-ID')}</td>
                                <td className="p-2 border">{r.userName || '-'}</td>
                                <td className="p-2 border">{r.deskripsi || '-'}</td>
                                {canDelete && (
                                  <td className="p-2 border text-center">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 rounded-full text-red-600 hover:bg-red-50"
                                      onClick={() => {
                                        setDeleteAbsenPayId(r.id)
                                        setDeleteAbsenPayPaidAt(r.paidAt)
                                        setOpenDeleteAbsenPay(true)
                                      }}
                                    >
                                      <TrashIcon className="h-4 w-4" />
                                    </Button>
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border font-semibold">
                              <td className="p-2 border">Total</td>
                              <td className="p-2 border"></td>
                              <td className="p-2 border text-right">
                                Rp {absenPayHistoryRows.reduce((acc, r) => acc + (Number(r.jumlah) || 0), 0).toLocaleString('id-ID')}
                              </td>
                              <td className="p-2 border text-right">
                                Rp {absenPayHistoryRows.reduce((acc, r) => acc + (Number(r.potonganHutang) || 0), 0).toLocaleString('id-ID')}
                              </td>
                              <td className="p-2 border" colSpan={canDelete ? 3 : 2}></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
              </>
            )}
          </div>
          ) : (
            <div className="bg-white p-4 md:p-6 rounded-lg shadow mb-6 text-sm text-gray-500">
              Pilih karyawan terlebih dahulu untuk melihat absensi.
            </div>
          )}
        </TabsContent>

        <TabsContent value="ringkasan">
          <div className="bg-white p-4 md:p-6 rounded-lg shadow mb-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div className="text-lg font-semibold">Ringkasan</div>
              <div className="flex flex-wrap items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" className="rounded-full">Export</Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={exportSummaryCsv}>Export CSV/Sheet</DropdownMenuItem>
                    <DropdownMenuItem onClick={exportSummaryPdf}>Export PDF</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                  <span className="px-3 py-1 rounded-full bg-gray-100">Periode Gaji: {dateDisplay}</span>
                  <span className="px-3 py-1 rounded-full bg-gray-100">Saldo Hutang: Akumulatif</span>
                  <span className="px-3 py-1 rounded-full bg-gray-100">Kebun: {selectedKebunId ? (kebunList.find(k => k.id === selectedKebunId)?.name ?? 'Kebun') : 'Semua Kebun'}</span>
                  <span className="px-3 py-1 rounded-full bg-gray-100">Jenis: {formatJobTypeLabel(summaryJobType)}</span>
                  <span className="px-3 py-1 rounded-full bg-gray-100">Karyawan: {selectedUser?.name || 'Semua Karyawan'}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
            <div className="bg-white rounded-lg border p-4">
              <div className="text-xs text-gray-500">Total Gaji</div>
              <div className="text-lg font-semibold">Rp {(summaryData?.gaji?.total || 0).toLocaleString('id-ID')}</div>
            </div>
            <div className="bg-white rounded-lg border p-4">
              <div className="text-xs text-gray-500">Gaji Dibayar</div>
              <div className="text-lg font-semibold">Rp {(summaryData?.gaji?.paid || 0).toLocaleString('id-ID')}</div>
            </div>
            <div className="bg-white rounded-lg border p-4">
              <div className="text-xs text-gray-500">Gaji Belum Dibayar</div>
              <div className="text-lg font-semibold">Rp {(summaryData?.gaji?.unpaid || 0).toLocaleString('id-ID')}</div>
            </div>
            <div className="bg-white rounded-lg border p-4">
              <div className="text-xs text-gray-500">Total Hutang</div>
              <div className="text-lg font-semibold">Rp {(summaryData?.hutang?.total || 0).toLocaleString('id-ID')}</div>
              <div className="text-xs text-gray-400 mt-1">Akumulatif</div>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            <div className="bg-white rounded-lg border p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-semibold">Top Gaji</div>
                <span className="text-xs text-gray-500">{dateDisplay}</span>
              </div>
              {topGajiRows.length === 0 ? (
                <div className="text-xs text-gray-500">Tidak ada data.</div>
              ) : (
                <div className="space-y-2 text-sm">
                  {topGajiRows.map(r => (
                    <div key={r.karyawan.id} className="flex items-center justify-between">
                      <span className="text-gray-600">{r.karyawan.name}</span>
                      <span className="font-medium">Rp {Number(r.totalGaji || 0).toLocaleString('id-ID')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="bg-white rounded-lg border p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-semibold">Top Hutang</div>
                <span className="text-xs text-gray-500">Akumulatif</span>
              </div>
              {topHutangRows.length === 0 ? (
                <div className="text-xs text-gray-500">Tidak ada data.</div>
              ) : (
                <div className="space-y-2 text-sm">
                  {topHutangRows.map(r => (
                    <div key={r.karyawan.id} className="flex items-center justify-between">
                      <span className="text-gray-600">{r.karyawan.name}</span>
                      <span className="font-medium">Rp {Number(r.hutangSaldo || 0).toLocaleString('id-ID')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="bg-white rounded-lg border p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-semibold">Top Hari Kerja</div>
                <span className="text-xs text-gray-500">{dateDisplay}</span>
              </div>
              {topHariKerjaRows.length === 0 ? (
                <div className="text-xs text-gray-500">Tidak ada data.</div>
              ) : (
                <div className="space-y-2 text-sm">
                  {topHariKerjaRows.map(r => (
                    <div key={r.karyawan.id} className="flex items-center justify-between">
                      <span className="text-gray-600">{r.karyawan.name}</span>
                      <span className="font-medium">{Number(r.hariKerja || 0).toLocaleString('id-ID')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="bg-white p-4 md:p-6 rounded-lg shadow mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold">Ringkasan per Karyawan</div>
              <span className="text-xs text-gray-500">{dateDisplay}</span>
            </div>
            {filteredSummaryRows.length === 0 ? (
              <div className="text-xs text-gray-500">Tidak ada data karyawan.</div>
            ) : (
              <div className="overflow-x-auto -mx-3 sm:mx-0">
                <table className="min-w-[500px] w-full text-xs sm:text-sm border whitespace-nowrap">
                  <thead>
                    <tr className="border">
                      <th className="p-2 border text-left">Karyawan</th>
                      <th className="p-2 border text-right">Hari Kerja</th>
                      <th className="p-2 border text-right">Total Gaji</th>
                      <th className="p-2 border text-right">Saldo Hutang</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSummaryRows.map(r => (
                      <tr key={r.karyawan.id} className="border">
                        <td className="p-2 border">{r.karyawan.name}</td>
                        <td className="p-2 border text-right">{Number(r.hariKerja || 0).toLocaleString('id-ID')}</td>
                        <td className="p-2 border text-right">Rp {Number(r.totalGaji || 0).toLocaleString('id-ID')}</td>
                        <td className="p-2 border text-right">Rp {Number(r.hutangSaldo || 0).toLocaleString('id-ID')}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border font-semibold">
                      <td className="p-2 border">Total</td>
                      <td className="p-2 border text-right">
                        {filteredSummaryRows.reduce((acc, r) => acc + Number(r.hariKerja || 0), 0).toLocaleString('id-ID')}
                      </td>
                      <td className="p-2 border text-right">
                        Rp {filteredSummaryRows.reduce((acc, r) => acc + Number(r.totalGaji || 0), 0).toLocaleString('id-ID')}
                      </td>
                      <td className="p-2 border text-right">
                        Rp {filteredSummaryRows.reduce((acc, r) => acc + Number(r.hutangSaldo || 0), 0).toLocaleString('id-ID')}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
          <div className="bg-white p-4 md:p-6 rounded-lg shadow mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold">Ringkasan per Jenis Pekerjaan</div>
              <span className="text-xs text-gray-500">{dateDisplay}</span>
            </div>
            {loadingSummary ? (
              <div className="text-xs text-gray-500">Memuat ringkasan...</div>
            ) : jobTypeSummary.length === 0 ? (
              <div className="text-xs text-gray-500">Tidak ada data.</div>
            ) : (
              <div className="overflow-x-auto -mx-3 sm:mx-0">
                <table className="min-w-[600px] w-full text-xs sm:text-sm border whitespace-nowrap">
                  <thead>
                    <tr className="border">
                      <th className="p-2 border text-left">Jenis Pekerjaan</th>
                      <th className="p-2 border text-right">Total Gaji</th>
                      <th className="p-2 border text-right">Total Hutang</th>
                      <th className="p-2 border text-right">Pembayaran</th>
                      <th className="p-2 border text-right">Saldo Hutang</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobTypeSummary.map(r => (
                      <tr key={r.jobType} className="border">
                        <td className="p-2 border">{formatJobTypeLabel(r.jobType)}</td>
                        <td className="p-2 border text-right">Rp {Number(r.gaji || 0).toLocaleString('id-ID')}</td>
                        <td className="p-2 border text-right">Rp {Number(r.hutang || 0).toLocaleString('id-ID')}</td>
                        <td className="p-2 border text-right">Rp {Number(r.pembayaran || 0).toLocaleString('id-ID')}</td>
                        <td className="p-2 border text-right">Rp {Number(r.saldo || 0).toLocaleString('id-ID')}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border font-semibold">
                      <td className="p-2 border">Total</td>
                      <td className="p-2 border text-right">
                        Rp {jobTypeSummary.reduce((acc, r) => acc + Number(r.gaji || 0), 0).toLocaleString('id-ID')}
                      </td>
                      <td className="p-2 border text-right">
                        Rp {jobTypeSummary.reduce((acc, r) => acc + Number(r.hutang || 0), 0).toLocaleString('id-ID')}
                      </td>
                      <td className="p-2 border text-right">
                        Rp {jobTypeSummary.reduce((acc, r) => acc + Number(r.pembayaran || 0), 0).toLocaleString('id-ID')}
                      </td>
                      <td className="p-2 border text-right">
                        Rp {jobTypeSummary.reduce((acc, r) => acc + Number(r.saldo || 0), 0).toLocaleString('id-ID')}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
          <div className="bg-white p-4 md:p-6 rounded-lg shadow mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold">Ringkasan per Kebun</div>
              <span className="text-xs text-gray-500">{dateDisplay}</span>
            </div>
            {loadingKebunSummaries ? (
              <div className="text-xs text-gray-500">Memuat ringkasan...</div>
            ) : kebunSummaries.length === 0 ? (
              <div className="text-xs text-gray-500">Tidak ada data kebun.</div>
            ) : (
              <div className="overflow-x-auto -mx-3 sm:mx-0">
                <table className="min-w-[600px] w-full text-xs sm:text-sm border whitespace-nowrap">
                  <thead>
                    <tr className="border">
                      <th className="p-2 border text-left">Kebun</th>
                      <th className="p-2 border text-right">Total Gaji</th>
                      <th className="p-2 border text-right">Gaji Dibayar</th>
                      <th className="p-2 border text-right">Gaji Belum Dibayar</th>
                      <th className="p-2 border text-right">Total Hutang</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...kebunSummaries].sort((a, b) => b.gajiTotal - a.gajiTotal).map(r => (
                      <tr key={r.kebunId} className="border">
                        <td className="p-2 border">{r.kebunName}</td>
                        <td className="p-2 border text-right">Rp {Number(r.gajiTotal || 0).toLocaleString('id-ID')}</td>
                        <td className="p-2 border text-right">Rp {Number(r.gajiPaid || 0).toLocaleString('id-ID')}</td>
                        <td className="p-2 border text-right">Rp {Number(r.gajiUnpaid || 0).toLocaleString('id-ID')}</td>
                        <td className="p-2 border text-right">Rp {Number(r.hutangTotal || 0).toLocaleString('id-ID')}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border font-semibold">
                      <td className="p-2 border">Total</td>
                      <td className="p-2 border text-right">
                        Rp {kebunSummaries.reduce((acc, r) => acc + Number(r.gajiTotal || 0), 0).toLocaleString('id-ID')}
                      </td>
                      <td className="p-2 border text-right">
                        Rp {kebunSummaries.reduce((acc, r) => acc + Number(r.gajiPaid || 0), 0).toLocaleString('id-ID')}
                      </td>
                      <td className="p-2 border text-right">
                        Rp {kebunSummaries.reduce((acc, r) => acc + Number(r.gajiUnpaid || 0), 0).toLocaleString('id-ID')}
                      </td>
                      <td className="p-2 border text-right">
                        Rp {kebunSummaries.reduce((acc, r) => acc + Number(r.hutangTotal || 0), 0).toLocaleString('id-ID')}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

      <TabsContent value="hutang">
      <div ref={daftarHutangRef} className="bg-white rounded-lg shadow overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 px-4 py-3">
          <h2 className="text-lg font-semibold">Daftar Hutang Karyawan{selectedUser ? `: ${selectedUser.name}` : ''}</h2>
          <div className="flex flex-wrap md:flex-nowrap gap-2 w-full md:w-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="rounded-full w-full md:w-auto whitespace-nowrap" variant="destructive" disabled={(selectedUser ? rows.filter(r => r.karyawan.id === selectedUser.id) : rows).length === 0}>Export</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportPayrollCsv}>Export CSV</DropdownMenuItem>
                <DropdownMenuItem onClick={exportPayrollPdf}>Export PDF</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" className="rounded-full w-full md:w-auto whitespace-nowrap bg-emerald-500 text-white hover:bg-emerald-600" onClick={() => selectedUser && openHutangModal(selectedUser)} disabled={!selectedUser}>Tambah Hutang</Button>
            <Button size="sm" className="rounded-full w-full md:w-auto whitespace-nowrap bg-emerald-600 text-white hover:bg-emerald-700" onClick={openPayrollModal} disabled={(selectedUser ? rows.filter(r => r.karyawan.id === selectedUser.id) : rows).length === 0}>Potong Hutang Masal</Button>
          </div>
        </div>
        <div className="md:hidden space-y-3 p-4">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-28" />
              </div>
            ))
          ) : (selectedUser ? rows.filter(r => r.karyawan.id === selectedUser.id) : rows).length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center text-sm text-gray-500">
              Tidak ada data
            </div>
          ) : (
            <>
              {(selectedUser ? rows.filter(r => r.karyawan.id === selectedUser.id) : rows).map(r => {
                const lp = (r as any).lastPotongan
                return (
                  <div
                    key={`hutang-card-${r.karyawan.id}`}
                    onClick={(e) => {
                      const target = e.target as HTMLElement
                      if (target.closest('button, a, input, [role="button"]')) return
                      openDetailModal(r.karyawan)
                    }}
                    className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-4 transition-colors hover:bg-gray-50/50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {r.karyawan.photoUrl ? (
                          <img
                            src={r.karyawan.photoUrl}
                            alt={r.karyawan.name}
                            className="w-12 h-12 rounded-full object-cover border border-gray-200 shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-gray-900 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0">
                            {r.karyawan.name.charAt(0)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-bold text-gray-900 truncate text-base">{r.karyawan.name}</div>
                          <div className="mt-1 text-xs font-semibold text-gray-500">
                            Saldo: <span className={r.hutangSaldo > 0 ? 'text-red-600' : 'text-green-700'}>Rp {Math.round(r.hutangSaldo).toLocaleString('id-ID')}</span>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full bg-emerald-50 text-emerald-700 shrink-0"
                        onClick={() => openDetailModal(r.karyawan)}
                      >
                        <EyeIcon className="w-5 h-5" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-50">
                      <div className="space-y-0.5">
                        <p className="text-[10px] text-gray-400 uppercase font-medium">Hutang</p>
                        <p className="text-sm font-bold text-gray-900">Rp {Math.round(r.totalPengeluaran).toLocaleString('id-ID')}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[10px] text-gray-400 uppercase font-medium">Pembayaran</p>
                        <p className="text-sm font-bold text-emerald-700">Rp {Math.round(r.totalPembayaran).toLocaleString('id-ID')}</p>
                      </div>
                      <div className="space-y-0.5 col-span-2">
                        <p className="text-[10px] text-gray-400 uppercase font-medium">Potongan Terakhir</p>
                        <p className="text-sm font-medium text-gray-700">
                          {lp ? (
                            <>
                              Rp {Math.round(lp.jumlah).toLocaleString('id-ID')} <span className="text-xs text-gray-400 font-normal ml-1">({format(new Date(lp.date), 'dd MMM yy', { locale: idLocale })})</span>
                            </>
                          ) : '-'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-3 border-t border-gray-50">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 flex-1"
                        onClick={() => openHutangModal(r.karyawan)}
                      >
                        <PlusCircleIcon className="w-4 h-4 mr-1.5" />
                        <span className="text-xs font-semibold">Tambah Hutang</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 flex-1"
                        onClick={() => openPotongModal(r.karyawan)}
                      >
                        <MinusCircleIcon className="w-4 h-4 mr-1.5" />
                        <span className="text-xs font-semibold">Potong</span>
                      </Button>
                    </div>
                  </div>
                )
              })}
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-700">Total Hutang</span>
                  <span className="font-semibold text-gray-900">Rp {Math.round((selectedUser ? rows.filter(r => r.karyawan.id === selectedUser.id) : rows).reduce((a, r) => a + r.totalPengeluaran, 0)).toLocaleString('id-ID')}</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="font-semibold text-emerald-700">Total Pembayaran</span>
                  <span className="font-semibold text-emerald-700">Rp {Math.round((selectedUser ? rows.filter(r => r.karyawan.id === selectedUser.id) : rows).reduce((a, r) => a + r.totalPembayaran, 0)).toLocaleString('id-ID')}</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="font-semibold text-red-600">Total Saldo</span>
                  <span className="font-semibold text-red-600">Rp {Math.round((selectedUser ? rows.filter(r => r.karyawan.id === selectedUser.id) : rows).reduce((a, r) => a + r.hutangSaldo, 0)).toLocaleString('id-ID')}</span>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Karyawan</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Hutang</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Pembayaran</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Saldo Hutang</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Potongan Terakhir</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-40" /></td>
                    <td className="px-4 py-3 text-right"><Skeleton className="h-4 w-24 ml-auto" /></td>
                    <td className="px-4 py-3 text-right"><Skeleton className="h-4 w-24 ml-auto" /></td>
                    <td className="px-4 py-3 text-right"><Skeleton className="h-4 w-24 ml-auto" /></td>
                    <td className="px-4 py-3 text-right"><Skeleton className="h-8 w-48 ml-auto" /></td>
                  </tr>
                ))
              ) : (selectedUser ? rows.filter(r => r.karyawan.id === selectedUser.id) : rows).length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-gray-500" colSpan={7}>
                    Tidak ada data
                  </td>
                </tr>
              ) : (
                (selectedUser ? rows.filter(r => r.karyawan.id === selectedUser.id) : rows).map(r => (
                  <tr
                    key={r.karyawan.id}
                    onClick={(e) => {
                      const target = e.target as HTMLElement
                      if (target.closest('button, a, input, [role="button"]')) return
                      openDetailModal(r.karyawan)
                    }}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    title="Klik baris untuk melihat detail hutang"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
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
                        <div>
                          <div className="font-medium">{r.karyawan.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">Rp {Math.round(r.totalPengeluaran).toLocaleString('id-ID')}</td>
                    <td className="px-4 py-3 text-right">Rp {Math.round(r.totalPembayaran).toLocaleString('id-ID')}</td>
                    <td className="px-4 py-3 text-right font-semibold">
                      <span className={r.hutangSaldo > 0 ? 'text-red-600' : 'text-green-700'}>
                        Rp {Math.round(r.hutangSaldo).toLocaleString('id-ID')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {(() => {
                        const lp = (r as any).lastPotongan
                        if (!lp) return '-'
                        const dateStr = format(new Date(lp.date), 'dd-MMM-yy', { locale: idLocale })
                        return <>Rp {Math.round(lp.jumlah).toLocaleString('id-ID')} <span className="text-xs text-gray-500">({dateStr})</span></>
                      })()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" className="rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-200" aria-label="Tambah Hutang" onClick={() => openHutangModal(r.karyawan)}>
                          <PlusCircleIcon className="w-5 h-5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-200" aria-label="Potong Hutang" onClick={() => openPotongModal(r.karyawan)}>
                          <MinusCircleIcon className="w-5 h-5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-200" aria-label="Detail" onClick={() => openDetailModal(r.karyawan)}>
                          <EyeIcon className="w-5 h-5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot className="bg-gray-50">
              <tr>
                <td className="px-4 py-3 font-medium">Total</td>
                <td className="px-4 py-3">
                  Rp {Math.round((selectedUser ? rows.filter(r => r.karyawan.id === selectedUser.id) : rows).reduce((a, r) => a + r.totalPengeluaran, 0)).toLocaleString('id-ID')}
                </td>
                <td className="px-4 py-3">
                  Rp {Math.round((selectedUser ? rows.filter(r => r.karyawan.id === selectedUser.id) : rows).reduce((a, r) => a + r.totalPembayaran, 0)).toLocaleString('id-ID')}
                </td>
                <td className="px-4 py-3 text-right font-semibold">
                  Rp {Math.round((selectedUser ? rows.filter(r => r.karyawan.id === selectedUser.id) : rows).reduce((a, r) => a + r.hutangSaldo, 0)).toLocaleString('id-ID')}
                </td>
                <td className="px-4 py-3"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      </TabsContent>
      </Tabs>

      <KaryawanPageModals
        {...{
          canDelete,
          canRequestDelete,
          selectedKebunId,
          selectedUser,
          absenUserId,
          absenMonth,
          endDate,
          mutate,
          mutateKaryawan,
          persistAbsensiLocal,
          fetchAbsenPayHistory,
          loadPaid,
          formatRibuanId,
          formatShort,
          getLocationLabel,
          workLocations,
          rows,
          unpaidDates,
          payTotal,
          hutangBeforePay,
          potongHutangEffective,
          hutangAfterPay,
          handleCancelPaidDate,
          handleDeleteAbsenPay,
          handleMove,
          exportDetailPdf,
          exportDetailCsv,
          exportPayrollCsv,
          exportPayrollPdf,
          submitHutang,
          submitPotong,
          confirmDeleteDetail,
          openEditDetailModal,
          openDeleteDetailModal,
          submitEditDetail,
          submitPayrollCuts,
          isSubmitting,
          openAbsenView,
          setOpenAbsenView,
          openDeleteAbsenConfirm,
          setOpenDeleteAbsenConfirm,
          openCancelGajiConfirm,
          setOpenCancelGajiConfirm,
          isCancellingGaji,
          setIsCancellingGaji,
          openDeleteKaryawan,
          setOpenDeleteKaryawan,
          deleteKaryawanId,
          setDeleteKaryawanId,
          openHutang,
          setOpenHutang,
          openPotong,
          setOpenPotong,
          hutangModalUser,
          setHutangModalUser,
          hutangJumlah,
          setHutangJumlah,
          hutangTanggal,
          setHutangTanggal,
          hutangDeskripsi,
          setHutangDeskripsi,
          potongJumlah,
          setPotongJumlah,
          potongTanggal,
          setPotongTanggal,
          potongDeskripsi,
          setPotongDeskripsi,
          openDeleteDetail,
          setOpenDeleteDetail,
          deleteDetail,
          deleteLoading,
          openDetail,
          setOpenDetail,
          detailLoading,
          detailRows,
          totalHutangDetail,
          totalPotonganDetail,
          lastPotonganDetail,
          sisaHutangDetail,
          openEditDetail,
          setOpenEditDetail,
          editDetailId,
          editDetailDate,
          setEditDetailDate,
          editDetailJumlah,
          setEditDetailJumlah,
          editDetailDeskripsi,
          setEditDetailDeskripsi,
          openHistory,
          setOpenHistory,
          historyUser,
          historyLoading,
          historyItems,
          openMove,
          setOpenMove,
          moveUser,
          moveLoading,
          moveLocationId,
          setMoveLocationId,
          moveDate,
          setMoveDate,
          absenSelectedDate,
          absenMap,
          setAbsenMap,
          absenWorkMap,
          setAbsenWorkMap,
          absenOffMap,
          setAbsenOffMap,
          absenNoteMap,
          setAbsenNoteMap,
          absenHourlyMap,
          setAbsenHourlyMap,
          absenHourMap,
          setAbsenHourMap,
          absenRateMap,
          setAbsenRateMap,
          absenMealEnabledMap,
          setAbsenMealEnabledMap,
          absenMealMap,
          setAbsenMealMap,
          absenPaidMap,
          setAbsenPaidMap,
          absenSourceMap,
          isDeletingAbsen,
          setIsDeletingAbsen,
          absenOpen,
          setAbsenOpen,
          absenWork,
          setAbsenWork,
          absenOff,
          setAbsenOff,
          absenValue,
          setAbsenValue,
          absenDefaultAmount,
          setAbsenDefaultAmount,
          absenUseHourly,
          setAbsenUseHourly,
          absenHour,
          setAbsenHour,
          absenRate,
          setAbsenRate,
          absenMealEnabled,
          setAbsenMealEnabled,
          absenMealAmount,
          setAbsenMealAmount,
          absenSetDefault,
          setAbsenSetDefault,
          absenNote,
          setAbsenNote,
          absenSaving,
          setAbsenSaving,
          setAbsenSaved,
          absenSaveTimerRef,
          absenPayOpen,
          setAbsenPayOpen,
          absenPaySelection,
          setAbsenPaySelection,
          absenPayPotong,
          setAbsenPayPotong,
          absenPayPotongDesc,
          setAbsenPayPotongDesc,
          openCancelPaid,
          setOpenCancelPaid,
          setCancelPaidDate,
          openDeleteAbsenPay,
          setOpenDeleteAbsenPay,
          setDeleteAbsenPayId,
          setDeleteAbsenPayPaidAt,
          openAddEditKaryawan,
          setOpenAddEditKaryawan,
          editKaryawan,
          setEditKaryawan,
          formName,
          setFormName,
          formPhotoFile,
          setFormPhotoFile,
          formPhotoPreview,
          setFormPhotoPreview,
          formKebunId,
          setFormKebunId,
          formJobType,
          setFormJobType,
          formStatus,
          setFormStatus,
          formRole,
          setFormRole,
          formTanggalMulaiBekerja,
          setFormTanggalMulaiBekerja,
          formKendaraanPlatNomor,
          setFormKendaraanPlatNomor,
          alatBeratList,
          kebunList,
          openKebunCombo,
          setOpenKebunCombo,
          kebunQuery,
          setKebunQuery,
          openPayroll,
          setOpenPayroll,
          massNominal,
          setMassNominal,
          massDate,
          setMassDate,
          massDesc,
          setMassDesc,
          potongMap,
          setPotongMap,
          potongEffectiveById,
          totalPotong,
          totalSisa,
        }}
      />

    </main>
  )
}
