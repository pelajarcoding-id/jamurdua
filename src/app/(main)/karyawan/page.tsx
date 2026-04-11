'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import useSWR from 'swr'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import { ModalHeader, ModalContentWrapper, ModalFooter } from '@/components/ui/modal-elements'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { PencilSquareIcon, TrashIcon, ChevronDownIcon, PlusCircleIcon, MinusCircleIcon, EyeIcon, ArrowPathIcon, CheckCircleIcon, CalendarIcon, MagnifyingGlassIcon, XMarkIcon, ClockIcon, UserGroupIcon, BanknotesIcon, CreditCardIcon, CurrencyDollarIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useDebounce } from '@/hooks/useDebounce'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import useSWRImmutable from 'swr/immutable'
import ImageUpload from '@/components/ui/ImageUpload'

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
  const [quickRange, setQuickRange] = useState('this_month')
  const [summaryKebunId, setSummaryKebunId] = useState<number | null>(null)
  const [summaryKebunSet, setSummaryKebunSet] = useState(false)
  const [summaryJobType, setSummaryJobType] = useState<string>('all')
  const [summaryKaryawanId, setSummaryKaryawanId] = useState<number | null>(null)
  const [summaryStartDate, setSummaryStartDate] = useState<string>('')
  const [summaryEndDate, setSummaryEndDate] = useState<string>('')

  const [openHutang, setOpenHutang] = useState(false)
  const [openPotong, setOpenPotong] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [hutangModalUser, setHutangModalUser] = useState<User | null>(null)
  const [hutangJumlah, setHutangJumlah] = useState<string>('')
  const [hutangTanggal, setHutangTanggal] = useState<string>('')
  const [hutangDeskripsi, setHutangDeskripsi] = useState<string>('Hutang Karyawan')
  const [potongJumlah, setPotongJumlah] = useState<string>('')
  const [potongTanggal, setPotongTanggal] = useState<string>('')
  const [potongDeskripsi, setPotongDeskripsi] = useState<string>('Pembayaran Hutang Karyawan')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [openDetail, setOpenDetail] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailRows, setDetailRows] = useState<Array<{ id: number; date: string; jumlah: number; tipe: string; kategori: string; deskripsi: string }>>([])
  const [openEditDetail, setOpenEditDetail] = useState(false)
  const [editDetailId, setEditDetailId] = useState<number | null>(null)
  const [editDetailDate, setEditDetailDate] = useState<string>('')
  const [editDetailJumlah, setEditDetailJumlah] = useState<string>('')
  const [editDetailDeskripsi, setEditDetailDeskripsi] = useState<string>('')
  const [openDeleteDetail, setOpenDeleteDetail] = useState(false)
  const [deleteDetail, setDeleteDetail] = useState<{ id: number; date: string; jumlah: number; kategori: string; deskripsi: string } | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [openPayroll, setOpenPayroll] = useState(false)
  const [potongMap, setPotongMap] = useState<Record<number, string>>({})
  const [massNominal, setMassNominal] = useState<string>('')
  const [massPercent, setMassPercent] = useState<string>('') // 0-100
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
  const debouncedKaryawanSearch = useDebounce(karyawanSearch, 400)
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
    if (debouncedKaryawanSearch.trim()) sp.set('search', debouncedKaryawanSearch.trim())
    return `/api/karyawan?${sp.toString()}`
  }, [karyawanLimit, karyawanPage, selectedJobType, selectedKebunId, selectedLocationFilterId, debouncedKaryawanSearch, selectedStatus])
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
  const [openAddEditKaryawan, setOpenAddEditKaryawan] = useState(false)
  const [editKaryawan, setEditKaryawan] = useState<User | null>(null)
  const [formName, setFormName] = useState('')
  const [formPhotoFile, setFormPhotoFile] = useState<File | null>(null)
  const [formPhotoPreview, setFormPhotoPreview] = useState<string | null>(null)
  const [formKebunId, setFormKebunId] = useState<number | null>(null)
  const [formJobType, setFormJobType] = useState<string>('KEBUN')
  const [formStatus, setFormStatus] = useState<string>('AKTIF')
  const [formRole, setFormRole] = useState<string>('KARYAWAN')
  const [formKendaraanPlatNomor, setFormKendaraanPlatNomor] = useState<string>('')
  const [alatBeratList, setAlatBeratList] = useState<Array<{ platNomor: string; merk?: string | null; jenis?: string | null }>>([])
  const [openKebunCombo, setOpenKebunCombo] = useState(false)
  const [kebunQuery, setKebunQuery] = useState('')
  const [openKaryawanTable, setOpenKaryawanTable] = useState(true)
  const [absenMonth, setAbsenMonth] = useState<Date>(new Date())
  const [absenMap, setAbsenMap] = useState<Record<string, string>>({})
  const [absenUserId, setAbsenUserId] = useState<number | null>(null)
  const [absenOpen, setAbsenOpen] = useState(false)
  const [absenSelectedDate, setAbsenSelectedDate] = useState<string>('')
  const [absenValue, setAbsenValue] = useState<string>('')
  const [absenWorkMap, setAbsenWorkMap] = useState<Record<string, boolean>>({})
  const [absenOffMap, setAbsenOffMap] = useState<Record<string, boolean>>({})
  const [absenNoteMap, setAbsenNoteMap] = useState<Record<string, string>>({})
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
  const [absenSaved, setAbsenSaved] = useState(false)
  const absenSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [absenPayOpen, setAbsenPayOpen] = useState(false)
  const [absenPaySelection, setAbsenPaySelection] = useState<Record<string, boolean>>({})
  const [absenPayHistoryRows, setAbsenPayHistoryRows] = useState<Array<{ id: number; startDate: string; endDate: string; paidAt: string; jumlah: number; deskripsi: string; userName: string | null; potonganHutang: number; kebunId: number; karyawanId: number }>>([])
  const [absenPayHistoryLoading, setAbsenPayHistoryLoading] = useState(false)
  const [absenPayHistoryStart, setAbsenPayHistoryStart] = useState<string>('')
  const [absenPayHistoryEnd, setAbsenPayHistoryEnd] = useState<string>('')
  const [absenPayHistoryOpen, setAbsenPayHistoryOpen] = useState(false)
  const [absenPayPotong, setAbsenPayPotong] = useState<string>('')
  const [absenPayPotongDesc, setAbsenPayPotongDesc] = useState<string>('Potong Hutang dari Pembayaran Gaji')
  const [openDeleteAbsenPay, setOpenDeleteAbsenPay] = useState(false)
  const [deleteAbsenPayId, setDeleteAbsenPayId] = useState<number | null>(null)
  const [deleteAbsenPayPaidAt, setDeleteAbsenPayPaidAt] = useState<string>('')
  const [openCancelPaid, setOpenCancelPaid] = useState(false)
  const [cancelPaidDate, setCancelPaidDate] = useState<string>('')
  const [openAbsenSection, setOpenAbsenSection] = useState(false)
  const [openDeleteKaryawan, setOpenDeleteKaryawan] = useState(false)
  const [deleteKaryawanId, setDeleteKaryawanId] = useState<number | null>(null)
  const [openAbsenView, setOpenAbsenView] = useState(false)
  const [isDeletingAbsen, setIsDeletingAbsen] = useState(false)
  const [openDeleteAbsenConfirm, setOpenDeleteAbsenConfirm] = useState(false)
  const [openCancelGajiConfirm, setOpenCancelGajiConfirm] = useState(false)
  const [isCancellingGaji, setIsCancellingGaji] = useState(false)

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
  const [openMove, setOpenMove] = useState(false)
  const [moveUser, setMoveUser] = useState<User | null>(null)
  const [moveLocationId, setMoveLocationId] = useState<number | null>(null)
  const [moveDate, setMoveDate] = useState<string>('')
  const [moveLoading, setMoveLoading] = useState(false)
  const [openHistory, setOpenHistory] = useState(false)
  const [historyUser, setHistoryUser] = useState<User | null>(null)
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
  }, [selectedJobType, selectedKebunId, selectedLocationFilterId, selectedStatus, debouncedKaryawanSearch])

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
      if (!selectedKebunId || !absenUserId) return
      
      const start = new Date(absenMonth.getFullYear(), absenMonth.getMonth(), 1)
      const end = new Date(absenMonth.getFullYear(), absenMonth.getMonth() + 1, 0)
      
      const params = new URLSearchParams({
        kebunId: String(selectedKebunId),
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
          })
          
          setAbsenMap(nextAmount)
          setAbsenWorkMap(nextWork)
          setAbsenOffMap(nextOff)
          setAbsenNoteMap(nextNote)
          
          // Also update localStorage to keep it in sync
          const ym = `${absenMonth.getFullYear()}-${String(absenMonth.getMonth() + 1).padStart(2, '0')}`
          const storageKey = `absensi:v2:${selectedKebunId}:${absenUserId}:${ym}`
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
  }, [selectedKebunId, absenUserId, absenMonth, formatDateKey])

  // Load attendance from localStorage (fallback/initial)
  useEffect(() => {
    if (!selectedKebunId || !absenUserId) return
    const ym = `${absenMonth.getFullYear()}-${String(absenMonth.getMonth() + 1).padStart(2, '0')}`
    const key = `absensi:v2:${selectedKebunId}:${absenUserId}:${ym}`
    try {
      const raw = localStorage.getItem(key)
      if (raw) {
        const parsed = JSON.parse(raw) as {
          amount?: Record<string, string>
          work?: Record<string, boolean>
          off?: Record<string, boolean>
          note?: Record<string, string>
          hourly?: Record<string, boolean>
          hour?: Record<string, string>
          rate?: Record<string, string>
          mealEnabled?: Record<string, boolean>
          meal?: Record<string, string>
        }
        // Only set if current maps are empty to avoid overwriting server data if it loaded faster
        setAbsenMap(prev => Object.keys(prev).length === 0 ? (parsed.amount || {}) : prev)
        setAbsenWorkMap(prev => Object.keys(prev).length === 0 ? (parsed.work || {}) : prev)
        setAbsenOffMap(prev => Object.keys(prev).length === 0 ? (parsed.off || {}) : prev)
        setAbsenNoteMap(prev => Object.keys(prev).length === 0 ? (parsed.note || {}) : prev)
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
    const start = new Date(today.getFullYear(), today.getMonth(), 1)
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
    if (!selectedKebunId || !absenUserId) {
      setAbsenPaidMap({})
      return
    }
    loadPaid(selectedKebunId, absenUserId, absenMonth)
  }, [selectedKebunId, absenUserId, absenMonth, loadPaid])
  useEffect(() => {
    const start = new Date(absenMonth.getFullYear(), absenMonth.getMonth(), 1)
    const end = new Date(absenMonth.getFullYear(), absenMonth.getMonth() + 1, 0)
    setAbsenPayHistoryStart(formatDateKey(start))
    setAbsenPayHistoryEnd(formatDateKey(end))
  }, [absenMonth, formatDateKey])
  const fetchAbsenPayHistory = useCallback(async () => {
    if (!selectedKebunId || !absenUserId) {
      setAbsenPayHistoryRows([])
      return
    }
    const params = new URLSearchParams({
      kebunId: String(selectedKebunId),
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
    if (!selectedKebunId || !absenUserId) return
    try {
      const params = new URLSearchParams({
        kebunId: String(selectedKebunId),
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
      await loadPaid(selectedKebunId, absenUserId, absenMonth)
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menghapus pembayaran')
    } finally {
      setOpenDeleteAbsenPay(false)
      setDeleteAbsenPayId(null)
      setDeleteAbsenPayPaidAt('')
    }
  }, [deleteAbsenPayId, deleteAbsenPayPaidAt, fetchAbsenPayHistory, selectedKebunId, absenUserId, absenMonth, loadPaid])
  const handleCancelPaidDate = useCallback(async () => {
    if (!cancelPaidDate || !selectedKebunId || !absenUserId) return
    try {
      const params = new URLSearchParams({
        kebunId: String(selectedKebunId),
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
      await loadPaid(selectedKebunId, absenUserId, absenMonth)
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
    if (!selectedKebunId || !absenUserId) return
    const ym = `${absenMonth.getFullYear()}-${String(absenMonth.getMonth() + 1).padStart(2, '0')}`
    const key = `absensi:v2:${selectedKebunId}:${absenUserId}:${ym}`
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
    if (debouncedKaryawanSearch) sp.set('search', debouncedKaryawanSearch)
    if (absenUserId) sp.set('karyawanId', String(absenUserId))
    return `/api/karyawan/operasional?${sp.toString()}`
  }, [selectedKebunId, startDate, endDate, selectedStatus, selectedJobType, debouncedKaryawanSearch, absenUserId])

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
  const totalSaldo = rows.reduce((acc, r) => acc + r.hutangSaldo, 0)
  const totalBiaya = rows.reduce((acc, r) => acc + r.pekerjaanTotalBiaya, 0)
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
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold">Karyawan</h1>
          <p className="text-sm text-gray-500 mt-1">Untuk pekerja yang dikelola absensi, upah, penugasan, dan hutang.</p>
        </div>
        <div className="flex flex-wrap md:flex-nowrap gap-2 w-full md:w-auto">
          <Button
            size="icon"
            variant="outline"
            className="rounded-full"
            onClick={handleRefresh}
            title="Refresh data"
            aria-label="Refresh data"
          >
            <ArrowPathIcon className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            size="sm"
            className="rounded-full w-full md:w-auto whitespace-nowrap bg-emerald-600 hover:bg-emerald-700 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
            onClick={() => { setEditKaryawan(null); setFormName(''); setFormPhotoFile(null); setFormPhotoPreview(null); setFormKebunId(null); setFormJobType('KEBUN'); setFormStatus('AKTIF'); setFormRole('KARYAWAN'); setFormKendaraanPlatNomor(''); setOpenAddEditKaryawan(true) }}
          >
            Tambah Karyawan
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-50 rounded-lg">
              <UserGroupIcon className="w-5 h-5 text-emerald-600" />
            </div>
            <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">Total Karyawan</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900">
              {summaryData?.totalKaryawan ?? 0}
            </span>
            <span className="text-sm text-gray-500 font-medium">Orang</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-50 rounded-lg">
              <BanknotesIcon className="w-5 h-5 text-emerald-600" />
            </div>
            <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">Total Gaji</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-sm font-bold text-gray-900">Rp</span>
            <span className="text-3xl font-bold text-gray-900">
              {(summaryData?.gaji?.total ?? 0).toLocaleString('id-ID')}
            </span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-red-50 rounded-lg">
              <CreditCardIcon className="w-5 h-5 text-red-600" />
            </div>
            <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">Total Hutang</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-sm font-bold text-red-600">Rp</span>
            <span className="text-3xl font-bold text-red-600">
              {(summaryData?.hutang?.total ?? 0).toLocaleString('id-ID')}
            </span>
          </div>
        </div>
      </div>

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
            <Input
              className="rounded-full w-full sm:w-56"
              placeholder="Cari nama..."
              value={karyawanSearch}
              onChange={(e) => setKaryawanSearch(e.target.value)}
            />
            </div>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
      <TabsList className="w-full bg-gray-100 rounded-full p-1 gap-1 grid grid-cols-3 h-auto md:inline-flex md:w-auto md:h-9">
          <TabsTrigger value="karyawan" className="rounded-full px-2 md:px-4">Data Karyawan</TabsTrigger>
          <TabsTrigger value="ringkasan" className="rounded-full px-2 md:px-4">Ringkasan</TabsTrigger>
          <TabsTrigger value="hutang" className="rounded-full px-2 md:px-4">Hutang</TabsTrigger>
        </TabsList>

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
                              onClick={() => { setEditKaryawan(k); setFormName(k.name); setFormPhotoFile(null); setFormPhotoPreview(k.photoUrl || null); setFormKebunId(typeof k.kebunId !== 'undefined' ? (k.kebunId ?? null) : null); setFormJobType((k.jenisPekerjaan || k.jobType || 'KEBUN').toString().toUpperCase()); setFormStatus((k.status || 'AKTIF').toString().toUpperCase()); setFormRole((k.role || 'KARYAWAN').toString().toUpperCase()); setFormKendaraanPlatNomor(k.kendaraanPlatNomor || ''); setOpenAddEditKaryawan(true) }}
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
                    <td className="px-4 py-6 text-center text-gray-500" colSpan={6}>Tidak ada karyawan</td>
                  </tr>
                ) : (
                  filteredKaryawanList.map(k => (
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
                            onClick={() => { setEditKaryawan(k); setFormName(k.name); setFormPhotoFile(null); setFormPhotoPreview(k.photoUrl || null); setFormKebunId(typeof k.kebunId !== 'undefined' ? (k.kebunId ?? null) : null); setFormJobType((k.jenisPekerjaan || k.jobType || 'KEBUN').toString().toUpperCase()); setFormStatus((k.status || 'AKTIF').toString().toUpperCase()); setFormRole((k.role || 'KARYAWAN').toString().toUpperCase()); setFormKendaraanPlatNomor(k.kendaraanPlatNomor || ''); setOpenAddEditKaryawan(true) }}
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
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
                    if (!selectedKebunId) {
                      toast.error('Pilih kebun terlebih dahulu')
                      return
                    }
                    const next: Record<string, boolean> = {}
                    unpaidDates.forEach(d => { next[d.date] = true })
                    setAbsenPaySelection(next)
                    setAbsenPayPotong('')
                    setAbsenPayPotongDesc('Potong Hutang dari Pembayaran Gaji')
                    setAbsenPayOpen(true)
                  }}
                  disabled={!selectedKebunId || !absenUserId || unpaidDates.length === 0}
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
                    const isPaid = !!absenPaidMap[key]
                    const isFilled = !!val || isOff || isWork || !!absenNoteMap[key]
                    const color = isOff
                      ? 'bg-red-50 border-red-100 text-red-700'
                      : isPaid
                        ? 'bg-purple-50 border-purple-100 text-purple-700'
                        : (num > 0 ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : num < 0 ? 'bg-red-50 border-red-100 text-red-700' : 'bg-white border-gray-100 text-gray-700')
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
                          setAbsenWork(!!absenWorkMap[key] || nextHasAmount);
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
            <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-2">
                <h3 className="text-sm font-semibold text-gray-700">History Pembayaran Gaji</h3>
                <div className="flex items-center gap-2">
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

      <Dialog open={openAbsenView} onOpenChange={setOpenAbsenView}>
        <DialogContent className="w-[92vw] sm:w-full sm:max-w-md bg-white rounded-3xl p-0 overflow-hidden shadow-2xl border-none [&>button.absolute]:hidden">
          <ModalHeader
            title={selectedUser?.name || 'Detail Absensi'}
            subtitle={absenSelectedDate ? format(new Date(absenSelectedDate), 'EEEE, dd MMMM yyyy', { locale: idLocale }) : ''}
            variant="emerald"
            onClose={() => setOpenAbsenView(false)}
          />

          <ModalContentWrapper className="space-y-5" id="absen-view-content">
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
                <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-sm">
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
                className="rounded-xl w-10 h-10 border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-all shadow-sm"
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
                      <div style="padding: 15px; background-color: #ecfdf5; border: 1px solid #d1fae5; border-radius: 8px; font-size: 14px; color: #065f46; min-height: 60px;">
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
              {absenPaidMap[absenSelectedDate] ? (
                <Button
                  variant="outline"
                  className="rounded-xl h-10 border-amber-200 text-amber-600 hover:bg-amber-50 transition-all shadow-sm px-4 font-semibold text-xs"
                  title="Batalkan Gaji"
                  onClick={() => setOpenCancelGajiConfirm(true)}
                >
                  <ArrowPathIcon className="w-4 h-4 mr-1.5" />
                  Batalkan Gaji
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-xl w-10 h-10 border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-all shadow-sm"
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
        description={`Apakah Anda yakin ingin menghapus data absensi tanggal ${absenSelectedDate ? format(new Date(absenSelectedDate), 'dd MMMM yyyy', { locale: idLocale }) : ''}? Tindakan ini tidak dapat dibatalkan.`}
        variant="emerald"
        onConfirm={async () => {
          if (!selectedKebunId || !absenUserId || !absenSelectedDate) return;
          
          setIsDeletingAbsen(true);
          try {
            const res = await fetch(`/api/karyawan/operasional/absensi?kebunId=${selectedKebunId}&karyawanId=${absenUserId}&date=${absenSelectedDate}`, {
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
              
              persistAbsensiLocal(nextAmount, nextWork, nextOff, nextNote, absenHourlyMap, absenHourMap, absenRateMap, absenMealEnabledMap, absenMealMap);
              toast.success('Absensi dihapus');
              setOpenAbsenView(false);
              await mutate();
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

      <ConfirmationModal
        isOpen={openCancelGajiConfirm}
        onClose={() => setOpenCancelGajiConfirm(false)}
        title="Batalkan Pembayaran Gaji"
        description={`Apakah Anda yakin ingin membatalkan pembayaran gaji untuk tanggal ${absenSelectedDate ? format(new Date(absenSelectedDate), 'dd MMMM yyyy', { locale: idLocale }) : ''}? Seluruh transaksi kas yang terkait dengan pembayaran hari ini akan dihapus.`}
        variant="emerald"
        onConfirm={async () => {
          if (!selectedKebunId || !absenUserId || !absenSelectedDate) return;
          
          setIsCancellingGaji(true);
          try {
            const res = await fetch(`/api/karyawan-kebun/absensi-payments?kebunId=${selectedKebunId}&karyawanId=${absenUserId}&date=${absenSelectedDate}`, {
              method: 'DELETE'
            });
            if (res.ok) {
              const nextPaid = { ...absenPaidMap };
              delete nextPaid[absenSelectedDate];
              setAbsenPaidMap(nextPaid);
              toast.success('Pembayaran gaji dibatalkan');
              setOpenCancelGajiConfirm(false);
              await mutate();
            } else {
              const err = await res.json().catch(() => ({}));
              toast.error(err.error || 'Gagal membatalkan pembayaran');
            }
          } catch {
            toast.error('Kesalahan jaringan');
          } finally {
            setIsCancellingGaji(false);
          }
        }}
      />

      <Dialog open={absenOpen} onOpenChange={setAbsenOpen}>
        <DialogContent className="w-[92vw] sm:w-full sm:max-w-md bg-white rounded-3xl p-0 overflow-hidden max-h-[90vh] [&>button.absolute]:hidden flex flex-col">
          <ModalHeader
            title="Input Absensi"
            subtitle={absenSelectedDate ? format(new Date(absenSelectedDate), 'EEEE, dd MMMM yyyy', { locale: idLocale }) : ''}
            variant="emerald"
            icon={<CalendarIcon className="h-5 w-5 text-white" />}
            onClose={() => setAbsenOpen(false)}
          />
          <ModalContentWrapper className="space-y-6 flex-1 min-h-0 overflow-y-auto no-scrollbar">
            {absenSelectedDate && absenPaidMap[absenSelectedDate] && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 text-xs text-amber-700">
                Tanggal ini sudah digaji. Batalkan digaji untuk mengubah data.
              </div>
            )}
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 border border-gray-100">
                <div className="space-y-0.5">
                  <Label className="text-sm font-semibold">Masuk Kerja</Label>
                  <p className="text-xs text-gray-500">Karyawan hadir bekerja</p>
                </div>
                <Switch 
                  checked={absenWork} 
                  disabled={!!absenSelectedDate && !!absenPaidMap[absenSelectedDate]}
                  onCheckedChange={(v) => {
                    setAbsenWork(v);
                    if (v) {
                      setAbsenOff(false);
                      if (!absenValue && absenDefaultAmount > 0) {
                        setAbsenValue(formatRibuanId(String(absenDefaultAmount)));
                      }
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
                  disabled={!!absenSelectedDate && !!absenPaidMap[absenSelectedDate]}
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
                    disabled={!!absenSelectedDate && !!absenPaidMap[absenSelectedDate]}
                    onChange={(e) => {
                      const next = formatRibuanId(e.target.value)
                      setAbsenValue(next)
                      if (next) {
                        setAbsenWork(true)
                        setAbsenOff(false)
                      } else {
                        setAbsenWork(false)
                      }
                    }}
                  />
                  {absenDefaultAmount > 0 && (
                    <p className="text-xs text-gray-500">Default saat ini: Rp {absenDefaultAmount.toLocaleString('id-ID')}</p>
                  )}
                </div>

                <div className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 border border-gray-100">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-semibold">Hitung per jam</Label>
                    <p className="text-xs text-gray-500">Gunakan rate per jam</p>
                  </div>
                  <Switch
                    checked={absenUseHourly}
                    disabled={!!absenSelectedDate && !!absenPaidMap[absenSelectedDate]}
                    onCheckedChange={setAbsenUseHourly}
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
                        disabled={!!absenSelectedDate && !!absenPaidMap[absenSelectedDate]}
                        onChange={e => setAbsenHour(e.target.value)}
                        placeholder="7.5"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Rate/Jam</Label>
                      <Input
                        className="rounded-xl h-11"
                        value={absenRate}
                        disabled={!!absenSelectedDate && !!absenPaidMap[absenSelectedDate]}
                        onChange={e => setAbsenRate(formatRibuanId(e.target.value))}
                        placeholder="15.000"
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
                      disabled={!!absenSelectedDate && !!absenPaidMap[absenSelectedDate]}
                      onCheckedChange={setAbsenMealEnabled}
                    />
                  </div>
                  {absenMealEnabled && (
                    <Input
                      className="rounded-xl h-11"
                      value={absenMealAmount}
                      disabled={!!absenSelectedDate && !!absenPaidMap[absenSelectedDate]}
                      onChange={e => {
                        const next = formatRibuanId(e.target.value)
                        setAbsenMealAmount(next)
                        if (next) {
                          setAbsenWork(true)
                          setAbsenOff(false)
                        }
                      }}
                      placeholder="contoh: 20.000"
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

            <div className="flex items-center gap-2">
              <Switch
                checked={absenSetDefault}
                disabled={!!absenSelectedDate && !!absenPaidMap[absenSelectedDate]}
                onCheckedChange={setAbsenSetDefault}
              />
              <Label className="text-xs text-gray-500">Jadikan upah ini sebagai default harian</Label>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-gray-700">Keterangan (Opsional)</Label>
              <Input
                className="rounded-xl"
                placeholder="Contoh: Lembur, Izin, dll"
                value={absenNote}
                onChange={(e) => setAbsenNote(e.target.value)}
                disabled={!!absenSelectedDate && !!absenPaidMap[absenSelectedDate]}
              />
            </div>
          </ModalContentWrapper>
          <ModalFooter className="gap-2">
            {canDelete && absenSelectedDate && absenPaidMap[absenSelectedDate] && (
              <Button
                className="rounded-full bg-red-500 text-white hover:bg-red-600 w-full sm:w-auto mr-auto"
                onClick={() => {
                  setCancelPaidDate(absenSelectedDate)
                  setOpenCancelPaid(true)
                }}
              >
                Batalkan Gaji
              </Button>
            )}
            <Button variant="outline" className="rounded-full" onClick={() => setAbsenOpen(false)}>Batal</Button>
            <Button 
              className="rounded-full bg-emerald-600 text-white hover:bg-emerald-700 px-8" 
              disabled={absenSaving || (!!absenSelectedDate && !!absenPaidMap[absenSelectedDate])}
              onClick={async () => {
                if (!absenSelectedDate) return
                const baseManual = Number((absenValue || '').toString().replace(/\./g, '').replace(/,/g, '')) || 0
                const hours = parseFloat((absenHour || '').toString().replace(',', '.')) || 0
                const rate = Number((absenRate || '').toString().replace(/\./g, '').replace(/,/g, '')) || 0
                const baseHourly = hours * rate
                const useHourly = absenUseHourly && hours > 0 && rate > 0
                const mealVal = absenMealEnabled ? (Number((absenMealAmount || '').toString().replace(/\./g, '').replace(/,/g, '')) || 0) : 0
                const totalAmount = Math.round(((useHourly ? baseHourly : 0) + baseManual) + mealVal)
                const totalFormatted = totalAmount ? formatRibuanId(String(totalAmount)) : ''
                const nextAmount = { ...absenMap, [absenSelectedDate]: totalFormatted }
                const nextWork = { ...absenWorkMap, [absenSelectedDate]: absenWork || totalAmount > 0 }
                const nextOff = { ...absenOffMap, [absenSelectedDate]: absenOff }
                const nextNote = { ...absenNoteMap, [absenSelectedDate]: absenNote }
                const nextHourly = { ...absenHourlyMap, [absenSelectedDate]: absenUseHourly }
                const nextHour = { ...absenHourMap, [absenSelectedDate]: absenUseHourly ? absenHour : '' }
                const nextRate = { ...absenRateMap, [absenSelectedDate]: absenUseHourly ? absenRate : '' }
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
                persistAbsensiLocal(nextAmount, nextWork, nextOff, nextNote, nextHourly, nextHour, nextRate, nextMealEnabled, nextMeal)
                if (selectedKebunId && absenUserId) {
                  const jumlah = totalAmount
                  const entries = [{
                    date: absenSelectedDate,
                    jumlah,
                    kerja: absenWork || totalAmount > 0,
                    libur: absenOff,
                    note: absenNote || '',
                  }]
                  setAbsenSaving(true)
                  let savedOk = false
                  try {
                    const res = await fetch('/api/karyawan/operasional/absensi', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ kebunId: selectedKebunId, karyawanId: absenUserId, entries }),
                    })
                    savedOk = res.ok
                  } catch {
                    savedOk = false
                  } finally {
                    setAbsenSaving(false)
                  }
                  if (savedOk) {
                    setAbsenSaved(true)
                    if (absenSaveTimerRef.current) clearTimeout(absenSaveTimerRef.current)
                    absenSaveTimerRef.current = setTimeout(() => setAbsenSaved(false), 1500)
                  }
                }
                if (absenSetDefault && selectedKebunId && absenUserId) {
                  const num = Number((absenValue || '').toString().replace(/\./g, '').replace(/,/g, '')) || 0
                  if (num > 0) {
                    fetch('/api/karyawan/operasional/absensi-default', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ kebunId: selectedKebunId, karyawanId: absenUserId, amount: num }),
                    }).then(() => {}).catch(() => {})
                    setAbsenDefaultAmount(num)
                  }
                }
                setAbsenOpen(false)
              }}
            >
              {absenSaving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </ModalFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={absenPayOpen} onOpenChange={setAbsenPayOpen}>
        <DialogContent className="w-[92vw] sm:w-full sm:max-w-lg max-h-[92vh] rounded-2xl p-0 overflow-hidden [&>button.absolute]:hidden flex flex-col">
          <ModalHeader
            title={`Bayar Gaji - ${selectedUser?.name || ''}`}
            variant="emerald"
            icon={<BanknotesIcon className="h-5 w-5 text-white" />}
            onClose={() => setAbsenPayOpen(false)}
          />
          <ModalContentWrapper className="space-y-3 overflow-y-auto flex-1 min-h-0">
            {unpaidDates.length === 0 ? (
              <div className="text-sm text-gray-500">Tidak ada tanggal yang belum digaji.</div>
            ) : (
              <div className="max-h-64 overflow-y-auto border rounded-lg divide-y">
                {unpaidDates.map(d => (
                  <label key={d.date} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span>{format(new Date(d.date), 'dd MMM yyyy', { locale: idLocale })}</span>
                    <span className="flex items-center gap-3">
                      <span className="text-gray-700">Rp {d.amount.toLocaleString('id-ID')}</span>
                      <input
                        type="checkbox"
                        checked={!!absenPaySelection[d.date]}
                        onChange={(e) => setAbsenPaySelection(prev => ({ ...prev, [d.date]: e.target.checked }))}
                      />
                    </span>
                  </label>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between text-sm font-semibold">
              <span>Total Dibayar</span>
              <span>Rp {payTotal.toLocaleString('id-ID')}</span>
            </div>
            <div className="border rounded-lg p-3 space-y-2">
              <div className="text-sm font-semibold">Potong Hutang</div>
              <div className="text-xs text-gray-500">
                Saldo hutang saat ini: Rp {hutangBeforePay.toLocaleString('id-ID')}
              </div>
              <Input
                className="input-style h-10 rounded-full"
                value={absenPayPotong}
                onChange={e => setAbsenPayPotong(formatRibuanId(e.target.value))}
                placeholder="Nominal potong hutang"
                disabled={hutangBeforePay === 0}
              />
              <Input
                className="input-style h-10 rounded-full"
                value={absenPayPotongDesc}
                onChange={e => setAbsenPayPotongDesc(e.target.value)}
                placeholder="Keterangan potongan"
                disabled={hutangBeforePay === 0}
              />
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-md bg-gray-50 p-2">
                  <div className="text-gray-500">Sebelum</div>
                  <div className="font-semibold">Rp {hutangBeforePay.toLocaleString('id-ID')}</div>
                </div>
                <div className="rounded-md bg-gray-50 p-2">
                  <div className="text-gray-500">Potong</div>
                  <div className="font-semibold">Rp {potongHutangEffective.toLocaleString('id-ID')}</div>
                </div>
                <div className="rounded-md bg-gray-50 p-2">
                  <div className="text-gray-500">Sesudah</div>
                  <div className="font-semibold">Rp {hutangAfterPay.toLocaleString('id-ID')}</div>
                </div>
              </div>
            </div>
          </ModalContentWrapper>
          <ModalFooter className="sm:justify-end">
            <Button className="rounded-full w-full sm:w-auto" variant="outline" onClick={() => setAbsenPayOpen(false)}>Batal</Button>
            <Button
              className="rounded-full w-full sm:w-auto bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={async () => {
                if (!selectedKebunId || !absenUserId) {
                  toast.error('Pilih kebun dan karyawan terlebih dahulu')
                  return
                }
                const selectedEntries = unpaidDates.filter(d => absenPaySelection[d.date])
                const entries = selectedEntries.map(d => ({ date: d.date, jumlah: d.amount }))
                if (entries.length === 0) {
                  toast.error('Pilih minimal 1 tanggal yang akan dibayar')
                  return
                }
                try {
                  const batchKey = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
                  const res = await fetch('/api/karyawan/operasional/absensi-payments', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      kebunId: selectedKebunId,
                      karyawanId: absenUserId,
                      entries,
                      batchKey,
                    }),
                  })
                  if (!res.ok) {
                    let msg = 'Gagal menyimpan pembayaran'
                    try {
                      const j = await res.json()
                      if (j?.error) msg = j.error
                    } catch {}
                    toast.error(msg)
                    return
                  }
                  if (potongHutangEffective > 0) {
                    const lastDate = selectedEntries[selectedEntries.length - 1]?.date
                    const potongRes = await fetch('/api/karyawan/operasional/pembayaran', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        kebunId: selectedKebunId,
                        karyawanId: absenUserId,
                        jumlah: potongHutangEffective,
                        date: lastDate || undefined,
                        deskripsi: `${absenPayPotongDesc || 'Potong Hutang dari Pembayaran Gaji'} | Batch ${batchKey}`,
                      }),
                    })
                    if (!potongRes.ok) {
                      toast.error('Gagal menyimpan potongan hutang')
                    } else {
                      await mutate()
                    }
                  }
                  await fetchAbsenPayHistory()
                  await loadPaid(selectedKebunId, absenUserId, absenMonth)
                  setAbsenPaySelection({})
                  setAbsenPayPotong('')
                  setAbsenPayPotongDesc('Potong Hutang dari Pembayaran Gaji')
                  setAbsenPayOpen(false)
                  toast.success('Pembayaran gaji tersimpan')
                } catch {
                  toast.error('Gagal menyimpan pembayaran (network)')
                }
              }}
              disabled={!selectedKebunId || !absenUserId || payTotal <= 0}
            >
              Simpan
            </Button>
          </ModalFooter>
        </DialogContent>
      </Dialog>

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

      <Dialog open={openHutang} onOpenChange={(v) => { setOpenHutang(v); if (!v) setHutangModalUser(null) }}>
        <DialogContent className="w-[92vw] sm:w-full sm:max-w-md rounded-2xl p-0 overflow-hidden [&>button.absolute]:hidden">
          <ModalHeader
            title="Tambah Hutang"
            variant="emerald"
            icon={<PlusCircleIcon className="h-5 w-5 text-white" />}
            onClose={() => setOpenHutang(false)}
          />
          <ModalContentWrapper className="space-y-4">
            <div>
              <Label>Nama</Label>
              <div className="mt-1 text-sm">{hutangModalUser?.name}</div>
            </div>
            <div>
              <Label>Jumlah</Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">Rp</span>
                <Input
                  className="input-style h-10 pl-10 rounded-full"
                  value={hutangJumlah}
                  onChange={e => setHutangJumlah(formatRibuanId(e.target.value))}
                  placeholder="contoh: 100.000"
                />
              </div>
              {!hutangJumlah && (
                <div className="mt-1 text-xs text-red-600">Jumlah wajib diisi</div>
              )}
            </div>
            <div>
              <Label>Tanggal</Label>
              <Input type="date" className="input-style h-10 rounded-full mt-1" value={hutangTanggal} onChange={e => setHutangTanggal(e.target.value)} />
            </div>
            <div>
              <Label>Deskripsi</Label>
              <Input className="input-style h-10 rounded-full mt-1" value={hutangDeskripsi} onChange={e => setHutangDeskripsi(e.target.value)} placeholder="Hutang Karyawan" />
            </div>
          </ModalContentWrapper>
          <ModalFooter className="sm:justify-between">
            <Button className="rounded-full w-full sm:w-auto" variant="outline" onClick={() => setOpenHutang(false)}>Batal</Button>
            <Button className="rounded-full w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white" onClick={submitHutang} disabled={isSubmitting}>Simpan</Button>
          </ModalFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={openDeleteDetail} onOpenChange={setOpenDeleteDetail}>
        <DialogContent className="w-[92vw] sm:w-full sm:max-w-md rounded-2xl p-0 overflow-hidden [&>button.absolute]:hidden">
          <ModalHeader
            title="Hapus Transaksi"
            subtitle="Konfirmasi penghapusan transaksi"
            variant="emerald"
            icon={<TrashIcon className="h-5 w-5 text-white" />}
            onClose={() => setOpenDeleteDetail(false)}
          />
          <ModalContentWrapper className="space-y-3">
            <p className="text-sm text-gray-600">
              Apakah Anda yakin ingin menghapus transaksi ini? Tindakan tidak dapat dibatalkan.
            </p>
            {deleteDetail && (
              <div className="rounded-xl border bg-gray-50 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Tanggal</span>
                  <span className="font-medium">
                    {format(new Date(deleteDetail.date), 'dd-MMM-yy', { locale: idLocale })}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-gray-600">Kategori</span>
                  <span className="font-medium">{deleteDetail.kategori}</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-gray-600">Jumlah</span>
                  <span className={`font-semibold ${deleteDetail.kategori === 'HUTANG_KARYAWAN' ? 'text-red-600' : 'text-green-600'}`}>
                    Rp {Math.round(deleteDetail.jumlah).toLocaleString('id-ID')}
                  </span>
                </div>
                {deleteDetail.deskripsi ? (
                  <div className="mt-2">
                    <div className="text-gray-600">Deskripsi</div>
                    <div className="mt-0.5">{deleteDetail.deskripsi}</div>
                  </div>
                ) : null}
              </div>
            )}
          </ModalContentWrapper>
          <ModalFooter className="sm:justify-between">
            <Button className="rounded-full w-full sm:w-auto" variant="outline" onClick={() => setOpenDeleteDetail(false)} disabled={deleteLoading}>Batal</Button>
            <Button className="rounded-full w-full sm:w-auto" variant="destructive" onClick={confirmDeleteDetail} disabled={deleteLoading}>
              {deleteLoading ? 'Menghapus...' : 'Hapus'}
            </Button>
          </ModalFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={openDetail} onOpenChange={(v) => { setOpenDetail(v); if (!v) setHutangModalUser(null) }}>
        <DialogContent className="w-[92vw] sm:w-full sm:max-w-3xl max-h-[92vh] rounded-2xl p-0 overflow-hidden flex flex-col [&>button.absolute]:hidden">
          <ModalHeader
            title="Detail Hutang & Potongan"
            subtitle={hutangModalUser?.name || ''}
            variant="emerald"
            icon={<CreditCardIcon className="h-5 w-5 text-white" />}
            onClose={() => setOpenDetail(false)}
          />
          <ModalContentWrapper className="flex-1 min-h-0 overflow-y-auto">
            <div className="mb-4">
              <div className="flex items-center gap-3 text-sm mb-2">
                {hutangModalUser?.photoUrl ? (
                  <img
                    src={hutangModalUser.photoUrl}
                    alt={hutangModalUser.name}
                    className="w-10 h-10 rounded-full object-cover border border-gray-200"
                  />
                ) : (
                  <div className="w-10 h-10 bg-gray-900 rounded-full flex items-center justify-center text-white font-bold">
                    {hutangModalUser?.name ? hutangModalUser.name.charAt(0) : '?'}
                  </div>
                )}
                <div>
                  <div className="text-xs text-gray-500">Karyawan</div>
                  <div className="font-medium">{hutangModalUser?.name}</div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl border bg-gray-50">
                  <div className="text-xs text-gray-600">Saldo Hutang</div>
                  <div className="text-base font-semibold">Rp {Math.round(totalHutangDetail).toLocaleString('id-ID')}</div>
                </div>
                <div className="p-3 rounded-xl border bg-gray-50">
                  <div className="text-xs text-gray-600">Potongan Terakhir</div>
                  <div className="text-base font-semibold">Rp {Math.round(lastPotonganDetail).toLocaleString('id-ID')}</div>
                </div>
                <div className="p-3 rounded-xl border bg-gray-50">
                  <div className="text-xs text-gray-600">Sisa Hutang</div>
                  <div className={`text-base font-semibold ${sisaHutangDetail > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    Rp {sisaHutangDetail.toLocaleString('id-ID')}
                  </div>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto rounded-xl border shadow-sm overflow-hidden -mx-2 sm:mx-0">
              <table className="min-w-[600px] w-full text-sm whitespace-nowrap">
              <thead className="bg-emerald-600 text-white">
                <tr>
                  <th className="p-3 text-left">TANGGAL</th>
                  <th className="p-3 text-right">HUTANG (RP)</th>
                  <th className="p-3 text-right">POTONGAN (RP)</th>
                  <th className="p-3 text-left">DESKRIPSI</th>
                  <th className="p-3 text-right">AKSI</th>
                </tr>
              </thead>
              <tbody>
                {detailLoading ? (
                  <tr><td className="p-2 border text-center" colSpan={5}>Memuat...</td></tr>
                ) : detailRows.length === 0 ? (
                  <tr><td className="p-2 border text-center" colSpan={5}>Tidak ada data</td></tr>
                ) : (
                  detailRows.map(d => (
                    <tr key={d.id} className="border">
                      <td className="p-2 border">{format(new Date(d.date), 'dd-MMM-yy', { locale: idLocale })}</td>
                      <td className="p-2 border text-right">
                        {d.kategori === 'HUTANG_KARYAWAN' ? `Rp ${Math.round(d.jumlah).toLocaleString('id-ID')}` : ''}
                      </td>
                      <td className="p-2 border text-right">
                        {d.kategori === 'PEMBAYARAN_HUTANG' ? `Rp ${Math.round(d.jumlah).toLocaleString('id-ID')}` : ''}
                      </td>
                      <td className="p-2 border">{d.deskripsi}</td>
                      <td className="p-2 border text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" className="rounded-full" aria-label="Edit" onClick={() => openEditDetailModal(d)}>
                            <PencilSquareIcon className="w-4 h-4" />
                          </Button>
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-red-600 hover:text-red-700"
                              aria-label="Hapus"
                              onClick={() => openDeleteDetailModal(d)}
                            >
                              <TrashIcon className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-emerald-50 text-emerald-800">
                <tr>
                  <td className="p-3 font-medium text-right">TOTAL</td>
                  <td className="p-3 text-right font-semibold">Rp {Math.round(totalHutangDetail).toLocaleString('id-ID')}</td>
                  <td className="p-3 text-right font-semibold">Rp {Math.round(totalPotonganDetail).toLocaleString('id-ID')}</td>
                  <td className="p-3 font-medium" colSpan={2}>
                    Sisa Hutang: <span className={`${sisaHutangDetail > 0 ? 'text-red-600' : 'text-green-600'} font-semibold`}>Rp {sisaHutangDetail.toLocaleString('id-ID')}</span>
                  </td>
                </tr>
              </tfoot>
            </table>
            </div>
          </ModalContentWrapper>
          <ModalFooter className="flex-row flex-nowrap gap-2 justify-end">
            <Button className="rounded-full" variant="outline" onClick={() => setOpenDetail(false)}>Tutup</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="rounded-full" variant="destructive">Export</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-white">
                <DropdownMenuItem onClick={exportDetailPdf}>Export PDF</DropdownMenuItem>
                <DropdownMenuItem onClick={exportDetailCsv}>Export CSV</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </ModalFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={openEditDetail} onOpenChange={setOpenEditDetail}>
        <DialogContent className="w-[92vw] sm:w-full sm:max-w-md rounded-2xl p-0 overflow-hidden [&>button.absolute]:hidden">
          <ModalHeader
            title="Edit Transaksi"
            variant="emerald"
            icon={<PencilSquareIcon className="h-5 w-5 text-white" />}
            onClose={() => setOpenEditDetail(false)}
          />
          <ModalContentWrapper className="space-y-3">
            <div>
              <Label>Tanggal</Label>
              <Input type="date" className="input-style h-10 rounded-full mt-1" value={editDetailDate} onChange={e => setEditDetailDate(e.target.value)} />
            </div>
            <div>
              <Label>Jumlah</Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">Rp</span>
                <Input
                  className="input-style h-10 pl-10 rounded-full"
                  value={editDetailJumlah}
                  onChange={e => setEditDetailJumlah(formatRibuanId(e.target.value))}
                  placeholder="contoh: 100.000"
                />
              </div>
            </div>
            <div>
              <Label>Deskripsi</Label>
              <Input className="input-style h-10 rounded-full mt-1" value={editDetailDeskripsi} onChange={e => setEditDetailDeskripsi(e.target.value)} />
            </div>
          </ModalContentWrapper>
          <ModalFooter className="sm:justify-between">
            <Button className="rounded-full w-full sm:w-auto" variant="outline" onClick={() => setOpenEditDetail(false)}>Batal</Button>
            <Button className="rounded-full w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white" onClick={submitEditDetail} disabled={!editDetailId}>Simpan</Button>
          </ModalFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openHistory} onOpenChange={setOpenHistory}>
        <DialogContent className="w-[92vw] sm:w-full sm:max-w-lg max-h-[92vh] rounded-2xl p-0 overflow-hidden flex flex-col [&>button.absolute]:hidden">
          <ModalHeader
            title="Riwayat Penugasan"
            subtitle={historyUser?.name || ''}
            variant="emerald"
            icon={<ClockIcon className="h-5 w-5 text-white" />}
            onClose={() => setOpenHistory(false)}
          />
          <ModalContentWrapper className="space-y-3 flex-1 min-h-0 overflow-y-auto">
            <div className="text-sm">Karyawan: <span className="font-medium">{historyUser?.name || '-'}</span></div>
            {historyLoading ? (
              <div className="text-sm text-gray-500">Memuat...</div>
            ) : historyItems.length === 0 ? (
              <div className="text-sm text-gray-500">Belum ada riwayat penugasan</div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {historyItems.map((h) => (
                  <div key={h.id} className="rounded-lg border border-gray-100 p-3">
                    <div className="text-sm font-semibold text-gray-900">{getLocationLabel(h.location)}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {format(new Date(h.startDate), 'dd-MMM-yy', { locale: idLocale })} - {h.endDate ? format(new Date(h.endDate), 'dd-MMM-yy', { locale: idLocale }) : 'Sekarang'}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Status: {(h.status || '').toString().toUpperCase()}</div>
                  </div>
                ))}
              </div>
            )}
          </ModalContentWrapper>
          <ModalFooter className="sm:justify-end">
            <Button className="rounded-full" variant="outline" onClick={() => setOpenHistory(false)}>Tutup</Button>
          </ModalFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openMove} onOpenChange={setOpenMove}>
        <DialogContent className="w-[92vw] sm:w-full sm:max-w-md max-h-[92vh] rounded-2xl p-0 overflow-hidden flex flex-col [&>button.absolute]:hidden">
          <ModalHeader
            title="Pindahkan Karyawan"
            subtitle={moveUser?.name || ''}
            variant="emerald"
            icon={<ArrowPathIcon className="h-5 w-5 text-white" />}
            onClose={() => setOpenMove(false)}
          />
          <ModalContentWrapper className="space-y-4 flex-1 min-h-0 overflow-y-auto">
            <div>
              <Label>Nama</Label>
              <div className="mt-1 text-sm">{moveUser?.name || '-'}</div>
            </div>
            <div>
              <Label>Lokasi Tujuan</Label>
              <select
                className="input-style w-full rounded-full mt-1"
                value={moveLocationId ?? ''}
                onChange={(e) => setMoveLocationId(Number(e.target.value))}
              >
                <option value="" disabled>Pilih lokasi</option>
                {workLocations.map((loc) => (
                  <option key={loc.id} value={loc.id}>{getLocationLabel(loc)}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Tanggal Mulai</Label>
              <Input
                type="date"
                className="input-style h-10 rounded-full mt-1"
                value={moveDate}
                onChange={(e) => setMoveDate(e.target.value)}
              />
            </div>
          </ModalContentWrapper>
          <ModalFooter className="sm:justify-between">
            <Button className="rounded-full w-full sm:w-auto" variant="outline" onClick={() => setOpenMove(false)}>Batal</Button>
            <Button className="rounded-full w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleMove} disabled={moveLoading || !moveUser || !moveLocationId || !moveDate}>Simpan</Button>
          </ModalFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openPotong} onOpenChange={(v) => { setOpenPotong(v); if (!v) setHutangModalUser(null) }}>
        <DialogContent className="w-[92vw] sm:w-full sm:max-w-md rounded-2xl p-0 overflow-hidden [&>button.absolute]:hidden">
          <ModalHeader
            title="Potong Hutang"
            variant="emerald"
            icon={<MinusCircleIcon className="h-5 w-5 text-white" />}
            onClose={() => setOpenPotong(false)}
          />
          <ModalContentWrapper className="space-y-4">
            <div>
              <Label>Nama</Label>
              <div className="mt-1 text-sm">{hutangModalUser?.name}</div>
            </div>
            <div>
              <Label>Jumlah</Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">Rp</span>
                <Input
                  className="input-style h-10 pl-10 rounded-full"
                  value={potongJumlah}
                  onChange={e => setPotongJumlah(formatRibuanId(e.target.value))}
                  placeholder="contoh: 100.000"
                />
              </div>
            </div>
            <div>
              <Label>Tanggal</Label>
              <Input type="date" className="input-style h-10 rounded-full mt-1" value={potongTanggal} onChange={e => setPotongTanggal(e.target.value)} />
            </div>
            <div>
              <Label>Deskripsi</Label>
              <Input className="input-style h-10 rounded-full mt-1" value={potongDeskripsi} onChange={e => setPotongDeskripsi(e.target.value)} placeholder="Pembayaran Hutang Karyawan" />
            </div>
          </ModalContentWrapper>
          <ModalFooter className="sm:justify-between">
            <Button className="rounded-full w-full sm:w-auto" variant="outline" onClick={() => setOpenPotong(false)}>Batal</Button>
            <Button className="rounded-full w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white" onClick={submitPotong} disabled={isSubmitting}>Simpan</Button>
          </ModalFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={openAddEditKaryawan} onOpenChange={setOpenAddEditKaryawan}>
        <DialogContent className="w-[92vw] sm:w-full sm:max-w-xl max-h-[92vh] rounded-2xl p-0 overflow-hidden flex flex-col [&>button.absolute]:hidden">
          <ModalHeader
            title={editKaryawan ? 'Edit Karyawan' : 'Tambah Karyawan'}
            variant="emerald"
            icon={<UserGroupIcon className="h-5 w-5 text-white" />}
            onClose={() => setOpenAddEditKaryawan(false)}
          />
          <ModalContentWrapper className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0 overflow-y-auto">
            <div className="space-y-2">
              <Label>Nama</Label>
              <Input className="rounded-full" value={formName} onChange={e => setFormName(e.target.value)} placeholder="Nama lengkap" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Foto Profil (Opsional)</Label>
              <ImageUpload
                previewUrl={formPhotoPreview}
                onFileChange={(file) => {
                  setFormPhotoFile(file)
                  if (!file) {
                    setFormPhotoPreview(null)
                    return
                  }
                  setFormPhotoPreview(URL.createObjectURL(file))
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Jenis Pekerjaan</Label>
              <select
                className="input-style w-full rounded-full"
                value={formJobType}
                onChange={e => {
                  const val = e.target.value;
                  setFormJobType(val);
                  if (val !== 'KEBUN') setFormKebunId(null);
                  if (val !== 'OPERATOR') setFormKendaraanPlatNomor('');
                }}
              >
                <option value="KEBUN">Karyawan Kebun</option>
                <option value="BULANAN">Karyawan Bulanan</option>
                <option value="HARIAN">Pekerja Harian</option>
                <option value="TUKANG BANGUNAN">Tukang Bangunan</option>
                <option value="OPERATOR">Operator</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Peran (Role)</Label>
              <select
                className="input-style w-full rounded-full"
                value={formRole}
                onChange={e => setFormRole(e.target.value)}
              >
                <option value="KARYAWAN">Karyawan</option>
                <option value="SUPIR">Supir</option>
                <option value="MANDOR">Mandor</option>
                <option value="MANAGER">Manager</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <select
                className="input-style w-full rounded-full"
                value={formStatus}
                onChange={e => setFormStatus(e.target.value)}
              >
                <option value="AKTIF">Aktif</option>
                <option value="NONAKTIF">Nonaktif</option>
              </select>
            </div>
            {formJobType === 'OPERATOR' && (
              <div className="space-y-2">
                <Label>Kendaraan (Alat Berat)</Label>
                <select
                  className="input-style w-full rounded-full"
                  value={formKendaraanPlatNomor}
                  onChange={(e) => setFormKendaraanPlatNomor(e.target.value)}
                >
                  <option value="">Pilih kendaraan</option>
                  {alatBeratList.map((k) => (
                    <option key={k.platNomor} value={k.platNomor}>
                      {k.platNomor}{k.merk ? ` - ${k.merk}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {formJobType === 'KEBUN' && (
              <div className="space-y-2">
                <Label>Kebun</Label>
                <Popover open={openKebunCombo} onOpenChange={setOpenKebunCombo}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="input-style w-full rounded-full flex items-center justify-between"
                      aria-haspopup="listbox"
                    >
                      <span>
                        {formKebunId
                          ? (kebunList.find(k => k.id === formKebunId)?.name ?? 'Pilih kebun')
                          : 'Pilih kebun'}
                      </span>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.939l3.71-3.71a.75.75 0 111.06 1.061l-4.24 4.24a.75.75 0 01-1.06 0l-4.24-4.24a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="p-2 w-[--radix-popover-trigger-width] max-h-60 overflow-y-auto bg-white rounded-xl border shadow-sm">
                    <Input
                      autoFocus
                      placeholder="Cari kebun…"
                      value={kebunQuery}
                      onChange={(e) => setKebunQuery(e.target.value)}
                      className="mb-2 rounded-full"
                    />
                    <div role="listbox" className="space-y-1">
                      {kebunList
                        .filter(k => k.name.toLowerCase().includes(kebunQuery.toLowerCase()))
                        .map(k => (
                          <button
                            key={k.id}
                            type="button"
                            onClick={() => { setFormKebunId(k.id); setOpenKebunCombo(false); }}
                            className={`w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 ${formKebunId === k.id ? 'bg-emerald-50 text-emerald-700' : ''}`}
                          >
                            {k.name}
                          </button>
                        ))}
                      {kebunList.filter(k => k.name.toLowerCase().includes(kebunQuery.toLowerCase())).length === 0 && (
                        <div className="px-3 py-2 text-sm text-gray-500">Tidak ditemukan</div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </ModalContentWrapper>
          <ModalFooter className="sm:justify-between">
            <Button className="rounded-full w-full sm:w-auto" variant="outline" onClick={() => setOpenAddEditKaryawan(false)}>Batal</Button>
            <Button className="rounded-full w-full sm:w-auto bg-emerald-600 text-white hover:bg-emerald-700" onClick={async () => {
              if (!formName) {
                toast.error('Nama wajib diisi')
                return
              }
              let photoUrl: string | null | undefined = undefined
              if (formPhotoFile) {
                const fd = new FormData()
                fd.append('file', formPhotoFile)
                const up = await fetch('/api/upload', { method: 'POST', body: fd })
                const upJson = await up.json().catch(() => ({} as any))
                if (!up.ok || !upJson?.success) {
                  toast.error(upJson?.error || 'Upload foto profil gagal')
                  return
                }
                photoUrl = upJson.url
              } else if (editKaryawan?.photoUrl && !formPhotoPreview) {
                photoUrl = null
              }
              const payload: any = { 
                name: formName, 
                jobType: formJobType,
                jenisPekerjaan: formJobType,
                status: formStatus,
                role: formRole,
              }
              if (typeof photoUrl !== 'undefined') payload.photoUrl = photoUrl
              payload.kendaraanPlatNomor = formJobType === 'OPERATOR' ? (formKendaraanPlatNomor || null) : null
              if (formJobType === 'KEBUN') {
                if (formKebunId) payload.kebunId = formKebunId
              } else {
                payload.kebunId = null
              }
              const res = await fetch(editKaryawan ? `/api/karyawan/${editKaryawan.id}` : '/api/karyawan', {
                method: editKaryawan ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
              })
              if (res.ok) {
                setOpenAddEditKaryawan(false)
                setEditKaryawan(null)
                setFormName(''); setFormPhotoFile(null); setFormPhotoPreview(null); setFormKebunId(null); setFormJobType('KEBUN'); setFormStatus('AKTIF'); setFormRole('KARYAWAN'); setFormKendaraanPlatNomor('')
                toast.success(editKaryawan ? 'Karyawan diperbarui' : 'Karyawan ditambahkan')
                await mutateKaryawan()
              } else {
                const err = await res.json()
                toast.error(err.error || 'Gagal menyimpan karyawan')
              }
            }}>{editKaryawan ? 'Simpan' : 'Tambah'}</Button>
          </ModalFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openPayroll} onOpenChange={setOpenPayroll}>
        <DialogContent className="w-[92vw] sm:w-full sm:max-w-4xl max-h-[92vh] rounded-2xl p-0 overflow-hidden [&>button.absolute]:hidden flex flex-col">
          <ModalHeader
            title="Potong Hutang Masal"
            variant="emerald"
            icon={<MinusCircleIcon className="h-5 w-5 text-white" />}
            onClose={() => setOpenPayroll(false)}
          />

          <ModalContentWrapper className="space-y-4 overflow-y-auto flex-1 min-h-0">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>Nominal</Label>
                <Input className="rounded-full mt-1" value={massNominal} onChange={e => setMassNominal(formatRibuanId(e.target.value))} placeholder="contoh: 100.000" />
                <div className="mt-2">
                  <Button className="rounded-full bg-emerald-600 text-white hover:bg-emerald-700 w-full md:w-auto" onClick={() => {
                    const val = Number(massNominal.toString().replace(/\D/g, '')) || 0
                    const next: Record<number, string> = {}
                    rows.forEach(r => {
                      const saldo = Math.max(0, Math.round(r.hutangSaldo || 0))
                      if (saldo <= 0 || val <= 0) {
                        next[r.karyawan.id] = ''
                        return
                      }
                      const amount = Math.min(val, saldo)
                      next[r.karyawan.id] = amount > 0 ? formatRibuanId(String(amount)) : ''
                    })
                    setPotongMap(next)
                  }}>Isi ke semua karyawan</Button>
                </div>
              </div>
              <div>
                <Label>Tanggal</Label>
                <Input type="date" className="mt-1 rounded-full" value={massDate} onChange={e => setMassDate(e.target.value)} />
              </div>
              <div>
                <Label>Deskripsi</Label>
                <Input className="mt-1 rounded-full" value={massDesc} onChange={e => setMassDesc(e.target.value)} placeholder="Deskripsi potongan" />
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="border-b">
                    <th className="p-2 text-left">NO</th>
                    <th className="p-2 text-left">NAMA</th>
                    <th className="p-2 text-left">TANGGAL</th>
                    <th className="p-2 text-right">SALDO</th>
                    <th className="p-2 text-right">POTONG</th>
                    <th className="p-2 text-right">SISA</th>
                    <th className="p-2 text-left">KETERANGAN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((r, idx) => {
                    const saldo = Math.round(r.hutangSaldo)
                    const safeSaldo = Math.max(0, saldo || 0)
                    const sisa = Math.max(0, safeSaldo - (potongEffectiveById[r.karyawan.id] || 0))
                    return (
                      <tr key={r.karyawan.id}>
                        <td className="p-2">{idx + 1}</td>
                        <td className="p-2">{r.karyawan.name}</td>
                        <td className="p-2">{formatShort(endDate || format(new Date(), 'yyyy-MM-dd'))}</td>
                        <td className="p-2 text-right">Rp {safeSaldo.toLocaleString('id-ID')}</td>
                        <td className="p-2">
                          <Input
                            className="rounded-full h-9 text-right"
                            value={potongMap[r.karyawan.id] || ''}
                            onChange={e => setPotongMap(prev => ({ ...prev, [r.karyawan.id]: formatRibuanId(e.target.value) }))}
                            onBlur={() => {
                              setPotongMap(prev => {
                                const raw = prev[r.karyawan.id] || ''
                                const num = Number(raw.toString().replace(/\./g, '').replace(/,/g, '')) || 0
                                const amount = safeSaldo <= 0 ? 0 : Math.min(Math.max(0, num), safeSaldo)
                                const nextVal = amount > 0 ? formatRibuanId(String(amount)) : ''
                                if ((prev[r.karyawan.id] || '') === nextVal) return prev
                                return { ...prev, [r.karyawan.id]: nextVal }
                              })
                            }}
                            placeholder="0"
                            disabled={safeSaldo <= 0}
                          />
                        </td>
                        <td className="p-2 text-right">Rp {sisa.toLocaleString('id-ID')}</td>
                        <td className="p-2" />
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot className="bg-gray-50 border-t">
                  <tr>
                    <td className="p-2 font-medium" colSpan={4}>JUMLAH</td>
                    <td className="p-2 font-semibold text-right">Rp {Math.round(totalPotong).toLocaleString('id-ID')}</td>
                    <td className="p-2 font-semibold text-right">Rp {Math.round(totalSisa).toLocaleString('id-ID')}</td>
                    <td className="p-2" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </ModalContentWrapper>

          <ModalFooter className="sm:justify-between">
            <Button className="rounded-full w-full sm:w-auto" variant="outline" onClick={() => setOpenPayroll(false)} disabled={isSubmitting}>Batal</Button>
            <Button className="rounded-full w-full sm:w-auto bg-emerald-600 text-white hover:bg-emerald-700" onClick={submitPayrollCuts} disabled={isSubmitting}>Simpan</Button>
          </ModalFooter>
        </DialogContent>
      </Dialog>

      <ConfirmationModal
        isOpen={openCancelPaid}
        onClose={() => { setOpenCancelPaid(false); setCancelPaidDate('') }}
        onConfirm={handleCancelPaidDate}
        title="Konfirmasi Batalkan Pembayaran Gaji"
        description="Apakah Anda yakin ingin membatalkan pembayaran gaji untuk tanggal ini? Tindakan tidak dapat dibatalkan."
        variant="emerald"
      />

      <ConfirmationModal
        isOpen={openDeleteAbsenPay}
        onClose={() => { setOpenDeleteAbsenPay(false); setDeleteAbsenPayId(null); setDeleteAbsenPayPaidAt('') }}
        onConfirm={handleDeleteAbsenPay}
        title="Konfirmasi Hapus Pembayaran Gaji"
        description="Apakah Anda yakin ingin menghapus pembayaran gaji ini? Tindakan tidak dapat dibatalkan."
        variant="emerald"
      />

      <ConfirmationModal
        isOpen={openDeleteKaryawan}
        onClose={() => { setOpenDeleteKaryawan(false); setDeleteKaryawanId(null) }}
        onConfirm={async () => {
          if (deleteKaryawanId == null) return
          const res = await fetch(`/api/karyawan/${deleteKaryawanId}`, { method: 'DELETE' })
          if (res.ok) {
            toast.success('Karyawan dihapus')
            await mutateKaryawan()
          } else if (res.status === 202) {
            toast.success('Permintaan penghapusan diajukan')
          } else {
            const err = await res.json().catch(() => ({} as any))
            toast.error((err as any).error || 'Gagal menghapus karyawan')
          }
          setOpenDeleteKaryawan(false)
          setDeleteKaryawanId(null)
        }}
        title="Konfirmasi Hapus Karyawan"
        description={canRequestDelete ? 'Permintaan Anda akan dikirim untuk persetujuan admin/pemilik.' : 'Apakah Anda yakin ingin menghapus karyawan ini? Tindakan tidak dapat dibatalkan.'}
        variant="emerald"
      />

    </main>
  )
}
