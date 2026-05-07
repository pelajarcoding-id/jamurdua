'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import toast from 'react-hot-toast'
import {
  ArrowDownTrayIcon,
  ClipboardDocumentListIcon,
  UserIcon,
  BanknotesIcon,
  CalendarIcon,
  PlusIcon,
  CheckIcon,
  ChevronUpDownIcon,
  XMarkIcon,
  PencilSquareIcon,
  EyeIcon,
  TrashIcon,
  TruckIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import ImageUpload from '@/components/ui/ImageUpload'
import { ModalHeader, ModalContentWrapper, ModalFooter } from '@/components/ui/modal-elements'
import { formatWIBDateForInput } from '@/lib/wib-date'
import { formatIdCurrency, formatIdNumber } from '@/lib/utils'
import { Pekerjaan, Kendaraan, PekerjaanUser } from './types'
import { useActivityData, ActivityFilterType, ActivityType, StatusFilter } from './hooks/useActivityData'
import { useKategoriMaster } from './hooks/useKategoriMaster'
import { useKendaraan } from './hooks/useKendaraan'
import { useUsers } from './hooks/useUsers'
import { FormattedNumberInput } from './components/activity/FormattedNumberInput'

const formatWibYmd = (date: Date) => formatWIBDateForInput(date)
const formatWibYm = (date: Date) => formatWibYmd(date).slice(0, 7)
const formatNumber = (value: number | string, maxFractionDigits = 0) => formatIdNumber(value, maxFractionDigits)
const formatCurrency = (value: number) => formatIdCurrency(value)

const GAJIAN_MANUAL_BIAYA_MARKER = '[GAJIAN_BIAYA_MANUAL]'

const stripGajianManualMarker = (value: any) => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const upper = raw.toUpperCase()
  if (upper.startsWith(GAJIAN_MANUAL_BIAYA_MARKER)) {
    return raw.slice(GAJIAN_MANUAL_BIAYA_MARKER.length).trim()
  }
  return raw
}

interface ActivityTabProps {
  kebunId: number
  mode?: 'aktivitas' | 'borongan'
}

export default function ActivityTab({ kebunId, mode }: ActivityTabProps) {
  // Hooks
  const activityData = useActivityData({ kebunId, mode })
  const kategoriMaster = useKategoriMaster({ kebunId, mode })
  const kendaraan = useKendaraan()
  const users = useUsers({ kebunId })

  // UI State
  const [showForm, setShowForm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailExporting, setDetailExporting] = useState(false)
  const [listExporting, setListExporting] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editKategoriOnly, setEditKategoriOnly] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedActivity, setSelectedActivity] = useState<Pekerjaan | null>(null)

  // Image state
  const [buktiFile, setBuktiFile] = useState<File | null>(null)
  const [buktiPreview, setBuktiPreview] = useState<string | null>(null)
  const [editBuktiFile, setEditBuktiFile] = useState<File | null>(null)
  const [editBuktiPreview, setEditBuktiPreview] = useState<string | null>(null)
  const [viewImageUrl, setViewImageUrl] = useState<string | null>(null)
  const [detailImageError, setDetailImageError] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    date: formatWibYmd(new Date()),
    kategoriBorongan: '',
    jenisPekerjaan: '',
    keterangan: '',
    biaya: 0,
    upahBorongan: mode === 'borongan',
    kendaraanPlatNomor: '',
    jumlah: 0,
    satuan: '',
    hargaSatuan: 0,
  })
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([])
  const [formErrors, setFormErrors] = useState<{ kategoriBorongan?: string; jenisPekerjaan?: string }>({})

  // Edit form state
  const [editForm, setEditForm] = useState({
    date: formatWibYmd(new Date()),
    kategoriBorongan: '',
    jenisPekerjaan: '',
    keterangan: '',
    biaya: 0,
    upahBorongan: mode === 'borongan',
    jumlah: 0,
    satuan: '',
    hargaSatuan: 0,
    userId: '',
    kendaraanPlatNomor: '',
  })
  const [editErrors, setEditErrors] = useState<{ kategoriBorongan?: string; jenisPekerjaan?: string }>({})

  // Popover state
  const [openUserSelect, setOpenUserSelect] = useState(false)
  const [userQuery, setUserQuery] = useState('')
  const [openKendaraanSelect, setOpenKendaraanSelect] = useState(false)
  const [kendaraanQuery, setKendaraanQuery] = useState('')
  const [openKategoriSelect, setOpenKategoriSelect] = useState(false)
  const [kategoriQuery, setKategoriQuery] = useState('')
  const [openEditKategoriSelect, setOpenEditKategoriSelect] = useState(false)
  const [editKategoriQuery, setEditKategoriQuery] = useState('')
  const [openEditUserSelect, setOpenEditUserSelect] = useState(false)
  const [editUserQuery, setEditUserQuery] = useState('')
  const [openEditKendaraanSelect, setOpenEditKendaraanSelect] = useState(false)
  const [editKendaraanQuery, setEditKendaraanQuery] = useState('')

  // Refs
  const kategoriFieldRef = useRef<HTMLDivElement | null>(null)
  const boronganTableRef = useRef<HTMLDivElement | null>(null)
  const jenisFieldRef = useRef<HTMLInputElement | null>(null)
  const editJenisFieldRef = useRef<HTMLInputElement | null>(null)

  // Scroll to form when opened
  useEffect(() => {
    if (!showForm) return
    if (mode !== 'borongan') return
    const el = kategoriFieldRef.current
    if (!el) return
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
    })
  }, [mode, showForm])

  // Kategori options
  const kategoriBoronganOptions = useMemo(() => {
    if (mode !== 'borongan') return [] as string[]
    const set = new Set<string>()
    kategoriMaster.list.forEach((k) => {
      const name = String(k?.name || '').trim()
      if (name) set.add(name)
    })
    activityData.activities.forEach((a) => {
      if (!a?.upahBorongan) return
      const k = String(a.kategoriBorongan || '').trim()
      if (k) set.add(k)
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'id-ID'))
  }, [activityData.activities, kategoriMaster.list, mode])

  // Handlers
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (activityData.filterType === 'month') {
      const raw = String(e.target.value || '').trim()
      if (!raw) return
      const m = raw.match(/^(\d{4})-(\d{2})$/)
      if (!m) return
      const date = new Date(`${m[1]}-${m[2]}-01T00:00:00+07:00`)
      if (date && !isNaN(date.getTime())) activityData.setSelectedDate(date)
    } else if (activityData.filterType === 'year') {
      const year = parseInt(e.target.value)
      if (!isNaN(year)) {
        activityData.setSelectedDate(new Date(`${year}-01-01T00:00:00+07:00`))
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const nextErrors: { kategoriBorongan?: string; jenisPekerjaan?: string } = {}
    if (mode === 'borongan') {
      if (!String(formData.kategoriBorongan || '').trim()) nextErrors.kategoriBorongan = 'Kategori borongan wajib dipilih.'
      if (!String(formData.jenisPekerjaan || '').trim()) nextErrors.jenisPekerjaan = 'Jenis pekerjaan wajib diisi.'
    }
    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors)
      toast.error('Harap lengkapi field wajib.')
      if (nextErrors.kategoriBorongan) {
        kategoriFieldRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      } else if (nextErrors.jenisPekerjaan) {
        jenisFieldRef.current?.focus()
      }
      return
    }

    setFormErrors({})
    setIsSubmitting(true)
    const loadingToast = toast.loading('Menyimpan pekerjaan...')

    try {
      let imageUrl: string | null = null
      if (buktiFile) {
        const fd = new FormData()
        fd.append('file', buktiFile)
        const up = await fetch('/api/upload', { method: 'POST', body: fd })
        const upJson = await up.json().catch(() => ({}))
        if (!up.ok || !upJson?.success) throw new Error(upJson?.error || 'Upload gambar gagal')
        imageUrl = upJson.url
      }

      const effectiveUpahBorongan = mode === 'borongan' ? true : mode === 'aktivitas' ? false : formData.upahBorongan
      const totalBiaya = effectiveUpahBorongan ? Math.round(Number(formData.jumlah || 0) * Number(formData.hargaSatuan || 0)) : 0
      const payload: any = {
        ...formData,
        upahBorongan: effectiveUpahBorongan,
        biaya: totalBiaya,
        userIds: selectedUserIds,
        imageUrl,
      }
      if (mode === 'aktivitas') {
        delete payload.kategoriBorongan
        delete payload.jumlah
        delete payload.satuan
        delete payload.hargaSatuan
        payload.kendaraanPlatNomor = formData.kendaraanPlatNomor || undefined
      } else {
        delete payload.kendaraanPlatNomor
      }

      const res = await fetch(`/api/kebun/${kebunId}/pekerjaan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) throw new Error('Gagal menyimpan')

      toast.success('Pekerjaan berhasil dicatat', { id: loadingToast })
      setFormData({
        date: formatWibYmd(new Date()),
        kategoriBorongan: '',
        jenisPekerjaan: '',
        keterangan: '',
        biaya: 0,
        upahBorongan: mode === 'borongan',
        kendaraanPlatNomor: '',
        jumlah: 0,
        satuan: '',
        hargaSatuan: 0,
      })
      setSelectedUserIds([])
      setBuktiFile(null)
      setBuktiPreview(null)
      setShowForm(false)
      setFormErrors({})
      activityData.fetchActivities()
      const target = boronganTableRef.current
      if (target) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' })
          })
        })
      }
    } catch (error) {
      toast.error('Gagal menyimpan data', { id: loadingToast })
    } finally {
      setIsSubmitting(false)
    }
  }

  const openDetail = (item: Pekerjaan) => {
    setSelectedActivity(item)
    setDetailImageError(false)
    setDetailOpen(true)
  }

  const openEdit = (item: Pekerjaan) => {
    const isPaid = !!(mode === 'borongan' && item.upahBorongan && item.gajianStatus === 'FINALIZED')
    setSelectedActivity(item)
    setEditKategoriOnly(isPaid)
    setEditBuktiFile(null)
    setEditBuktiPreview(item.imageUrl || null)
    const userIds = mode === 'borongan'
      ? (item.user ? [item.user.id] : [])
      : item.users && item.users.length > 0 ? item.users.map((u) => u.id) : item.user ? [item.user.id] : []
    setEditForm({
      date: item.date ? formatWibYmd(new Date(item.date)) : formatWibYmd(new Date()),
      kategoriBorongan: String(item.kategoriBorongan || ''),
      jenisPekerjaan: item.jenisPekerjaan,
      keterangan: item.keterangan || '',
      biaya: item.biaya || 0,
      upahBorongan: mode === 'borongan' ? true : mode === 'aktivitas' ? false : item.upahBorongan ?? (item.biaya || 0) > 0,
      jumlah: item.jumlah || 0,
      satuan: item.satuan || '',
      hargaSatuan: item.hargaSatuan || 0,
      userId: userIds.length === 1 ? String(userIds[0]) : '',
      kendaraanPlatNomor: item.kendaraan?.platNomor || item.kendaraanPlatNomor || '',
    })
    setEditOpen(true)
  }

  const openDelete = (item: Pekerjaan) => {
    setSelectedActivity(item)
    setDeleteOpen(true)
  }

  const handleUpdate = async () => {
    if (!selectedActivity) return
    if (mode === 'borongan' && !String(editForm.kategoriBorongan || '').trim()) {
      setEditErrors({ kategoriBorongan: 'Kategori borongan wajib dipilih.' })
      toast.error('Harap lengkapi field wajib.')
      return
    }
    if (!editKategoriOnly && mode === 'borongan' && !String(editForm.jenisPekerjaan || '').trim()) {
      setEditErrors({ jenisPekerjaan: 'Jenis pekerjaan wajib diisi.' })
      toast.error('Harap lengkapi field wajib.')
      return
    }

    setEditErrors({})
    const loadingToast = toast.loading('Menyimpan perubahan...')
    try {
      const ids = mode === 'borongan'
        ? [selectedActivity.id]
        : selectedActivity.ids && selectedActivity.ids.length > 0 ? selectedActivity.ids : [selectedActivity.id]
      const payload: any = editKategoriOnly
        ? {
            ids,
            kategoriBorongan: String(editForm.kategoriBorongan || '').trim(),
            kategoriOnly: true,
          }
        : (() => {
            const effectiveUpahBorongan = mode === 'borongan' ? true : mode === 'aktivitas' ? false : editForm.upahBorongan
            const totalBiaya = effectiveUpahBorongan ? Math.round(Number(editForm.jumlah || 0) * Number(editForm.hargaSatuan || 0)) : 0
            const base: any = {
              ids,
              ...editForm,
              upahBorongan: effectiveUpahBorongan,
              biaya: totalBiaya,
            }
            if (mode === 'aktivitas') {
              delete base.kategoriBorongan
              delete base.jumlah
              delete base.satuan
              delete base.hargaSatuan
            } else {
              delete base.kendaraanPlatNomor
            }
            return base
          })()

      if (!editKategoriOnly) {
        let imageUrl: string | undefined = undefined
        if (editBuktiFile) {
          const fd = new FormData()
          fd.append('file', editBuktiFile)
          const up = await fetch('/api/upload', { method: 'POST', body: fd })
          const upJson = await up.json().catch(() => ({}))
          if (!up.ok || !upJson?.success) throw new Error(upJson?.error || 'Upload gambar gagal')
          imageUrl = upJson.url
        }
        if (typeof imageUrl !== 'undefined') payload.imageUrl = imageUrl
      }

      const res = await fetch(`/api/kebun/${kebunId}/pekerjaan`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => ({} as any))
      if (!res.ok) throw new Error(json?.error || 'Gagal memperbarui')
      toast.success('Pekerjaan diperbarui', { id: loadingToast })
      setEditOpen(false)
      setEditKategoriOnly(false)
      setSelectedActivity(null)
      setEditBuktiFile(null)
      setEditBuktiPreview(null)
      setEditErrors({})
      activityData.fetchActivities()
    } catch (error) {
      toast.error('Gagal memperbarui data', { id: loadingToast })
    }
  }

  const handleDelete = async () => {
    if (!selectedActivity) return
    try {
      const ids = mode === 'borongan'
        ? [selectedActivity.id]
        : selectedActivity.ids && selectedActivity.ids.length > 0 ? selectedActivity.ids : [selectedActivity.id]
      const res = await fetch(`/api/kebun/${kebunId}/pekerjaan?ids=${ids.join(',')}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Gagal menghapus')
      toast.success('Pekerjaan dihapus')
      setDeleteOpen(false)
      setSelectedActivity(null)
      activityData.fetchActivities()
    } catch (error) {
      toast.error('Gagal menghapus data')
    }
  }

  // Stats
  const stats = useMemo(() => {
    const totalSemua = activityData.filteredActivities.reduce((acc, curr) => acc + Number(curr.biaya || 0), 0)
    const totalUpah = activityData.filteredActivities.reduce((acc, curr) => acc + (curr.upahBorongan ? Number(curr.biaya || 0) : 0), 0)
    const totalAktivitas = totalSemua - totalUpah
    const jumlahItem = activityData.filteredActivities.length
    const jumlahUpah = activityData.filteredActivities.filter((x) => !!x.upahBorongan).length
    const jumlahAktivitas = jumlahItem - jumlahUpah
    const { upahSudahDibayar, upahBelumDibayar, upahSudahDibayarItem, upahBelumDibayarItem } = activityData.filteredActivities.reduce(
      (acc, curr) => {
        if (!curr.upahBorongan) return acc
        const total = Number(curr.biaya || 0)
        const isPaid = mode === 'borongan'
          ? curr.gajianStatus === 'FINALIZED'
          : (() => {
              const paidCount = Number(curr.paidCount || 0)
              const totalCount = Number(curr.totalCount || 0) || 1
              return totalCount > 0 && paidCount > 0 && paidCount === totalCount
            })()
        const paidAmount = isPaid ? total : 0
        const unpaidAmount = total - paidAmount
        acc.upahSudahDibayar += paidAmount
        acc.upahBelumDibayar += unpaidAmount
        if (mode === 'borongan') {
          acc.upahSudahDibayarItem += isPaid ? 1 : 0
          acc.upahBelumDibayarItem += isPaid ? 0 : 1
        } else {
          const paidCount = Number(curr.paidCount || 0)
          const totalCount = Number(curr.totalCount || 0) || 1
          acc.upahSudahDibayarItem += Math.max(0, Math.round(paidCount))
          acc.upahBelumDibayarItem += Math.max(0, Math.round(totalCount - paidCount))
        }
        return acc
      },
      { upahSudahDibayar: 0, upahBelumDibayar: 0, upahSudahDibayarItem: 0, upahBelumDibayarItem: 0 },
    )

    return {
      totalSemua,
      totalUpah,
      totalAktivitas,
      jumlahItem,
      jumlahUpah,
      jumlahAktivitas,
      upahSudahDibayar,
      upahBelumDibayar,
      upahSudahDibayarItem,
      upahBelumDibayarItem,
    }
  }, [activityData.filteredActivities, mode])

  // PDF Export handlers
  const handleExportDetailPdf = async () => {
    if (!selectedActivity || detailExporting) return
    setDetailExporting(true)
    try {
      const jsPDF = (await import('jspdf')).default
      const autoTable = (await import('jspdf-autotable')).default

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()

      const headerBg = [37, 99, 235] as const
      const footerBg = [15, 23, 42] as const
      const headerHeight = 16
      const footerHeight = 10

      const title = 'Detail Pekerjaan'
      const subTitle = `Kebun ID: ${kebunId}`

      const activityDate = selectedActivity.date ? new Date(selectedActivity.date) : null
      const dateText = activityDate
        ? activityDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
        : '-'

      const karyawanText = mode === 'borongan'
        ? selectedActivity.user?.name || '-'
        : selectedActivity.users && selectedActivity.users.length > 0
          ? selectedActivity.users.map((u) => u.name).join(', ')
          : selectedActivity.user
            ? selectedActivity.user.name
            : '-'

      const biayaTotal = Number(selectedActivity.biaya || 0)
      const jumlahText = `${Number(selectedActivity.jumlah || 0).toLocaleString('id-ID')} ${selectedActivity.satuan || ''}`.trim()
      const biayaSatuan = Number(selectedActivity.hargaSatuan || 0)

      const rows: Array<[string, string]> = []
      rows.push(['Jenis Pekerjaan', selectedActivity.jenisPekerjaan || '-'])
      rows.push(['Tanggal', dateText])
      rows.push(['Karyawan', karyawanText])
      if (selectedActivity.upahBorongan) {
        rows.push(['Jumlah', jumlahText || '-'])
        rows.push(['Biaya / Satuan', formatCurrency(biayaSatuan)])
        rows.push(['Total Biaya', formatCurrency(biayaTotal)])
      } else {
        rows.push(['Biaya', formatCurrency(biayaTotal)])
      }
      const displayKet = stripGajianManualMarker(selectedActivity.keterangan)
      rows.push(['Keterangan', displayKet || '-'])

      const drawChrome = (pageNumber: number, totalPages: number) => {
        doc.setFillColor(headerBg[0], headerBg[1], headerBg[2])
        doc.rect(0, 0, pageWidth, headerHeight, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(12)
        doc.text(title, 12, 10)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.text(subTitle, pageWidth - 12, 10, { align: 'right' })

        doc.setFillColor(footerBg[0], footerBg[1], footerBg[2])
        doc.rect(0, pageHeight - footerHeight, pageWidth, footerHeight, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(8)
        doc.text(`Halaman ${pageNumber} / ${totalPages}`, pageWidth - 12, pageHeight - 3, { align: 'right' })
        doc.text(`Dicetak: ${new Date().toLocaleDateString('id-ID')}`, 12, pageHeight - 3)
      }

      autoTable(doc, {
        startY: headerHeight + 10,
        theme: 'grid',
        head: [['Field', 'Nilai']],
        body: rows,
        styles: { fontSize: 9, cellPadding: 3, textColor: [15, 23, 42] },
        headStyles: { fillColor: headerBg as any, textColor: 255, fontStyle: 'bold' as const },
        columnStyles: {
          0: { cellWidth: 45, fontStyle: 'bold' as const },
          1: { cellWidth: pageWidth - 24 - 45 },
        },
        margin: { left: 12, right: 12, top: headerHeight + 10, bottom: footerHeight + 8 },
      })

      const totalPages = doc.getNumberOfPages()
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p)
        drawChrome(p, totalPages)
      }

      const safeJenis = String(selectedActivity.jenisPekerjaan || 'pekerjaan').replace(/[^\p{L}\p{N}\s_-]/gu, '').trim().replace(/\s+/g, '-')
      const safeDate = activityDate ? formatWibYmd(activityDate) : 'tanggal'
      doc.save(`detail-pekerjaan-${safeDate}-${safeJenis}.pdf`)
    } catch {
      toast.error('Gagal export PDF')
    } finally {
      setDetailExporting(false)
    }
  }

  const handleExportListPdf = useCallback(async () => {
    if (listExporting) return
    if (!activityData.filteredActivities || activityData.filteredActivities.length === 0) return
    setListExporting(true)
    try {
      const jsPDF = (await import('jspdf')).default
      const autoTable = (await import('jspdf-autotable')).default

      const isBoronganMode = mode === 'borongan'
      const isAktivitasMode = mode === 'aktivitas'
      const doc = new jsPDF({ orientation: isBoronganMode ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' })
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()

      const headerBg = [5, 150, 105] as const
      const footerBg = [15, 23, 42] as const
      const headerHeight = 16
      const footerHeight = 10

      let startYmd: string
      let endYmd: string
      if (activityData.filterType === 'month') {
        const ymd = formatWibYmd(activityData.selectedDate)
        const y = Number(ymd.slice(0, 4))
        const m = Number(ymd.slice(5, 7))
        const endDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
        startYmd = `${ymd.slice(0, 8)}01`
        endYmd = `${ymd.slice(0, 5)}${String(m).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`
      } else if (activityData.filterType === 'year') {
        const y = Number(formatWibYmd(activityData.selectedDate).slice(0, 4))
        startYmd = `${y}-01-01`
        endYmd = `${y}-12-31`
      } else {
        startYmd = activityData.dateRange.start
        endYmd = activityData.dateRange.end
      }

      const title = isBoronganMode ? 'Laporan Borongan' : isAktivitasMode ? 'Laporan Aktivitas' : 'Laporan Aktivitas & Borongan'
      const period = `Periode ${startYmd} s/d ${endYmd}`

      const drawChrome = (pageNumber: number, totalPages: number) => {
        doc.setFillColor(headerBg[0], headerBg[1], headerBg[2])
        doc.rect(0, 0, pageWidth, headerHeight, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(11)
        doc.text(title, 12, 10)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.text(period, pageWidth - 12, 10, { align: 'right' })

        doc.setFillColor(footerBg[0], footerBg[1], footerBg[2])
        doc.rect(0, pageHeight - footerHeight, pageWidth, footerHeight, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(8)
        doc.text(`Halaman ${pageNumber} / ${totalPages}`, pageWidth - 12, pageHeight - 3, { align: 'right' })
        doc.text(`Dicetak: ${new Date().toLocaleDateString('id-ID')}`, 12, pageHeight - 3)
      }

      const getStatus = (item: Pekerjaan) => {
        const isUpah = !!item.upahBorongan
        const isPaid = isUpah && item.gajianStatus === 'FINALIZED'
        const isInGajian = isUpah && !!item.gajianId && !isPaid
        if (isPaid) return 'Dibayar'
        if (isInGajian) return 'Penggajian'
        if (isUpah) return 'Draft'
        return 'Aktivitas'
      }

      if (isBoronganMode) {
        const exportItems = [...activityData.filteredActivities].sort((a, b) => {
          const aj = String(a?.jenisPekerjaan || '').trim()
          const bj = String(b?.jenisPekerjaan || '').trim()
          const cmp = aj.localeCompare(bj, 'id-ID', { sensitivity: 'base' })
          if (cmp !== 0) return cmp
          const ad = a?.date ? new Date(a.date).getTime() : 0
          const bd = b?.date ? new Date(b.date).getTime() : 0
          if (ad !== bd) return ad - bd
          return Number(a?.id || 0) - Number(b?.id || 0)
        })

        const rows = exportItems.map((item, idx) => {
          const jumlah = Number(item.jumlah || 0)
          const hargaSatuan = Number(item.hargaSatuan || 0) || (jumlah > 0 ? Math.round(Number(item.biaya || 0) / jumlah) : 0)
          const kategori = String(item.kategoriBorongan || '').trim() || 'Tanpa kategori'
          const karyawanText = item.user?.name || ''
          return [
            idx + 1,
            item.date ? new Date(item.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '',
            kategori,
            item.jenisPekerjaan || '',
            karyawanText,
            jumlah ? `${formatNumber(jumlah, 2)} ${item.satuan || ''}` : '',
            hargaSatuan > 0 ? formatNumber(hargaSatuan) : '',
            item.biaya > 0 ? formatNumber(item.biaya) : '',
            getStatus(item),
          ]
        })

        const totalJumlah = exportItems.reduce((acc, curr) => acc + Number(curr.jumlah || 0), 0)
        const totalBiaya = exportItems.reduce((acc, curr) => acc + Number(curr.biaya || 0), 0)

        autoTable(doc, {
          startY: headerHeight + 8,
          head: [['NO', 'TANGGAL', 'KATEGORI', 'PEKERJAAN', 'KARYAWAN', 'JUMLAH', 'HARGA SATUAN', 'JUMLAH BIAYA', 'STATUS']],
          body: rows as any,
          foot: [[
            { content: 'JUMLAH', colSpan: 7, styles: { halign: 'center', fontStyle: 'bold' } },
            { content: totalBiaya > 0 ? formatNumber(totalBiaya) : '-', styles: { fontStyle: 'bold' } },
            { content: '', styles: { fontStyle: 'bold' } },
          ]] as any,
          showFoot: 'lastPage',
          theme: 'grid',
          styles: { fontSize: 8, cellPadding: 2.2, textColor: [15, 23, 42] },
          headStyles: { fillColor: headerBg as any, textColor: 255, fontStyle: 'bold' as const },
          footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' as const },
          margin: { left: 12, right: 12, top: headerHeight + 8, bottom: footerHeight + 8 },
        })

        const kategoriTotals = Array.from(
          exportItems.reduce((acc, curr) => {
            const kategori = String(curr.kategoriBorongan || '').trim() || 'Tanpa kategori'
            acc.set(kategori, (acc.get(kategori) || 0) + Number(curr.biaya || 0))
            return acc
          }, new Map<string, number>()),
        )
          .map(([kategori, total]) => ({ kategori, total }))
          .filter((x) => x.total > 0)
          .sort((a, b) => b.total - a.total)

        if (kategoriTotals.length > 0) {
          const marginX = 12
          const contentBottomY = pageHeight - footerHeight - 8
          const lastAutoTable = (doc as any).lastAutoTable
          let cursorY = Number(lastAutoTable?.finalY || (headerHeight + 8)) + 8

          const ensureSpace = (needHeight: number) => {
            if (cursorY + needHeight <= contentBottomY) return
            doc.addPage()
            cursorY = headerHeight + 8
          }

          ensureSpace(10)
          doc.setTextColor(15, 23, 42)
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(10)
          doc.text('Biaya per Kategori', marginX, cursorY)
          cursorY += 4

          autoTable(doc, {
            startY: cursorY,
            head: [['NO', 'KATEGORI', 'TOTAL BIAYA']],
            body: kategoriTotals.map((k, i) => [
              i + 1,
              String(k.kategori || ''),
              k.total > 0 ? formatNumber(k.total) : '-',
            ]) as any,
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 2.2, textColor: [15, 23, 42] },
            headStyles: { fillColor: headerBg as any, textColor: 255, fontStyle: 'bold' as const },
            columnStyles: {
              0: { cellWidth: 10, halign: 'center' as const },
              1: { cellWidth: 90 },
              2: { cellWidth: 30, halign: 'right' as const },
            },
            margin: { left: marginX, right: marginX, top: headerHeight + 8, bottom: footerHeight + 8 },
          })
        }
      } else {
        const rows = activityData.filteredActivities.map((item, idx) => {
          const karyawanText = item.users && item.users.length > 0
            ? item.users.map((u) => u.name).join(', ')
            : item.user?.name || ''
          return [
            idx + 1,
            item.date ? new Date(item.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '',
            item.jenisPekerjaan || '',
            karyawanText,
            getStatus(item),
          ]
        })

        autoTable(doc, {
          startY: headerHeight + 8,
          head: [['NO', 'TANGGAL', 'PEKERJAAN', 'KARYAWAN', 'STATUS']],
          body: rows as any,
          theme: 'grid',
          styles: { fontSize: 8, cellPadding: 2.2, textColor: [15, 23, 42] },
          headStyles: { fillColor: headerBg as any, textColor: 255, fontStyle: 'bold' as const },
          margin: { left: 12, right: 12, top: headerHeight + 8, bottom: footerHeight + 8 },
        })
      }

      const totalPages = doc.getNumberOfPages()
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p)
        drawChrome(p, totalPages)
      }

      const safeMode = mode === 'borongan' ? 'borongan' : mode === 'aktivitas' ? 'aktivitas' : 'aktivitas-borongan'
      doc.save(`laporan-${safeMode}-${startYmd}-${endYmd}.pdf`)
    } catch {
      toast.error('Gagal export PDF')
    } finally {
      setListExporting(false)
    }
  }, [activityData, listExporting, mode])

  const { totalPages, currentPage, setCurrentPage, perView, setPerView, pagedActivities, startIndex, isLoading, filteredActivities } = activityData

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 capitalize">
              {mode === 'borongan' ? 'Borongan' : mode === 'aktivitas' ? 'Aktivitas' : 'Aktivitas & Pekerjaan'}
            </h2>
            <p className="text-sm text-gray-500">
              {mode === 'borongan'
                ? 'Pekerjaan borongan yang masuk pengajuan gajian'
                : 'Catatan kegiatan di kebun'}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto lg:justify-end">
            <Button
              type="button"
              variant="outline"
              className="rounded-full h-10 w-full sm:w-auto border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={handleExportListPdf}
              disabled={listExporting || filteredActivities.length === 0}
            >
              <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
              {listExporting ? 'Membuat PDF...' : 'Export PDF'}
            </Button>
            <Button
              onClick={() => setShowForm(!showForm)}
              className="whitespace-nowrap rounded-full bg-emerald-600 hover:bg-emerald-700 w-full sm:w-auto"
            >
              <PlusIcon className="w-4 h-4 mr-2" />
              {mode === 'borongan' ? 'Catat Borongan' : 'Catat Aktivitas'}
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="h-10 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 w-full sm:w-auto flex-shrink-0"
              value={activityData.filterType}
              onChange={(e) => activityData.setFilterType(e.target.value as ActivityFilterType)}
            >
              <option value="month">Bulanan</option>
              <option value="year">Tahunan</option>
              <option value="range">Rentang</option>
            </select>

            {activityData.filterType === 'month' && (
              <Input
                type="month"
                className="h-10 w-full sm:w-44 bg-white !rounded-full pr-10"
                value={formatWibYm(activityData.selectedDate)}
                onChange={handleDateChange}
              />
            )}

            {activityData.filterType === 'year' && (
              <select
                className="h-10 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 w-full sm:w-32"
                value={Number(formatWibYmd(activityData.selectedDate).slice(0, 4))}
                onChange={handleDateChange}
              >
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            )}

            {activityData.filterType === 'range' && (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Input
                  type="date"
                  className="h-10 w-full sm:w-36 bg-white !rounded-full pr-10"
                  value={activityData.dateRange.start}
                  onChange={(e) => activityData.setDateRange((prev) => ({ ...prev, start: e.target.value }))}
                />
                <span className="text-gray-500">-</span>
                <Input
                  type="date"
                  className="h-10 w-full sm:w-36 bg-white !rounded-full pr-10"
                  value={activityData.dateRange.end}
                  onChange={(e) => activityData.setDateRange((prev) => ({ ...prev, end: e.target.value }))}
                />
              </div>
            )}

            {!mode ? (
              <select
                className="h-10 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 w-full sm:w-48"
                value={activityData.activityFilter}
                onChange={(e) => activityData.setActivityFilter(e.target.value as ActivityType)}
              >
                <option value="all">Semua aktivitas</option>
                <option value="upah">Upah borongan</option>
                <option value="aktivitas">Aktivitas biasa</option>
              </select>
            ) : null}

            {mode === 'borongan' ? (
              <select
                className="h-10 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 w-full sm:w-40"
                value={activityData.statusFilter}
                onChange={(e) => activityData.setStatusFilter(e.target.value as StatusFilter)}
              >
                <option value="all">Semua status</option>
                <option value="draft">Draft</option>
                <option value="penggajian">Penggajian</option>
                <option value="dibayar">Dibayar</option>
              </select>
            ) : null}

            {mode === 'borongan' ? (
              <select
                className="h-10 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 w-full sm:w-56"
                value={activityData.kategoriFilter}
                onChange={(e) => activityData.setKategoriFilter(e.target.value)}
              >
                <option value="all">Semua kategori</option>
                <option value="__none__">Tanpa kategori</option>
                {kategoriBoronganOptions.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            ) : null}
            {mode === 'borongan' ? (
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-full w-full sm:w-auto border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={() => kategoriMaster.setIsOpen(true)}
              >
                Master Kategori
              </Button>
            ) : null}
          </div>

          <div className="w-full sm:max-w-sm relative">
            <MagnifyingGlassIcon className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={activityData.searchDraft}
              onChange={(e) => {
                const next = e.target.value
                activityData.setSearchDraft(next)
                if (!String(next || '').trim()) {
                  activityData.setSearchQuery('')
                  activityData.setCurrentPage(1)
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  activityData.applySearch()
                }
              }}
              placeholder={mode === 'borongan' ? 'Cari borongan...' : mode === 'aktivitas' ? 'Cari aktivitas...' : 'Cari aktivitas / borongan...'}
              className="pl-9 pr-10 rounded-full h-10"
            />
            <button
              type="button"
              onClick={activityData.applySearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Cari"
            >
              <MagnifyingGlassIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      {mode === 'borongan' || !mode ? (
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <BanknotesIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Statistik Total Upah</p>
              <p className="text-xs text-gray-500">Ringkasan biaya berdasarkan filter periode</p>
            </div>
          </div>
          <div className="mt-4">
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-3 w-full sm:w-1/2 lg:w-1/4">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Upah belum dibayar</p>
              <p className="text-lg font-bold mt-1 text-emerald-900">{formatCurrency(Math.round(stats.upahBelumDibayar || 0))}</p>
              <p className="text-xs text-emerald-700/80 mt-1">{(stats.upahBelumDibayarItem || 0).toLocaleString('id-ID')} item</p>
              <div className="mt-3 border-t border-emerald-100 pt-3 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-emerald-700/90">Upah sudah dibayar</span>
                  <span className="font-semibold text-emerald-900">
                    {formatCurrency(Math.round(stats.upahSudahDibayar || 0))} ({(stats.upahSudahDibayarItem || 0).toLocaleString('id-ID')})
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-emerald-700/90">Total upah</span>
                  <span className="font-semibold text-emerald-900">
                    {formatCurrency(Math.round(stats.totalUpah || 0))} ({(stats.jumlahUpah || 0).toLocaleString('id-ID')})
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-emerald-700/90">Total semua</span>
                  <span className="font-semibold text-emerald-900">
                    {formatCurrency(Math.round(stats.totalSemua || 0))} ({(stats.jumlahItem || 0).toLocaleString('id-ID')})
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-4 animate-in slide-in-from-top-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Tanggal</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
                className="bg-white"
              />
            </div>
            {mode === 'borongan' ? (
              <div ref={kategoriFieldRef}>
                <Label>Kategori Borongan *</Label>
                <Popover open={openKategoriSelect} onOpenChange={setOpenKategoriSelect}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-expanded={openKategoriSelect}
                      className={`w-full h-10 px-3 rounded-md border border-input bg-white text-sm flex items-center justify-between ${formErrors.kategoriBorongan ? 'border-red-500 ring-2 ring-red-500/10' : ''}`}
                    >
                      {formData.kategoriBorongan
                        ? String(formData.kategoriBorongan)
                        : 'Pilih kategori'}
                      <ChevronUpDownIcon className="h-4 w-4 text-gray-400" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[320px] p-3" align="start">
                    <Input
                      autoFocus
                      placeholder="Cari kategori..."
                      value={kategoriQuery}
                      onChange={(e) => setKategoriQuery(e.target.value)}
                      className="mb-2 rounded-lg"
                    />
                    <div className="max-h-56 overflow-y-auto space-y-1">
                      {kategoriBoronganOptions
                        .filter((k) => {
                          const q = kategoriQuery.trim().toLowerCase()
                          if (!q) return true
                          return k.toLowerCase().includes(q)
                        })
                        .map((k) => {
                          const checked = String(formData.kategoriBorongan || '') === String(k)
                          return (
                            <button
                              key={k}
                              type="button"
                              onClick={() => {
                                setFormData((prev) => ({ ...prev, kategoriBorongan: k }))
                                setFormErrors((prev) => ({ ...prev, kategoriBorongan: undefined }))
                                setOpenKategoriSelect(false)
                              }}
                              className={`w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 flex items-center justify-between ${checked ? 'bg-emerald-50 text-emerald-700' : ''}`}
                            >
                              <span className="truncate">{k}</span>
                              {checked ? <CheckIcon className="h-4 w-4" /> : <span className="h-4 w-4" />}
                            </button>
                          )
                        })}
                      {kategoriBoronganOptions.filter((k) => {
                        const q = kategoriQuery.trim().toLowerCase()
                        if (!q) return true
                        return k.toLowerCase().includes(q)
                      }).length === 0 && (
                        <div className="px-3 py-2 text-sm text-gray-500">Kategori tidak ditemukan</div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
                {formErrors.kategoriBorongan ? (
                  <p className="mt-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">{formErrors.kategoriBorongan}</p>
                ) : null}
              </div>
            ) : null}
            <div>
              <Label>{mode === 'borongan' ? 'Jenis Pekerjaan *' : 'Deskripsi'}</Label>
              <Input
                placeholder={mode === 'borongan' ? 'Contoh: Panen, Mupuk...' : 'Contoh : Minyak Kendaraan, Panen , Mupuk ....'}
                value={formData.jenisPekerjaan}
                onChange={(e) => {
                  setFormData({ ...formData, jenisPekerjaan: e.target.value })
                  if (mode === 'borongan') setFormErrors((prev) => ({ ...prev, jenisPekerjaan: undefined }))
                }}
                required
                className="bg-white"
                ref={jenisFieldRef}
              />
              {mode === 'borongan' && formErrors.jenisPekerjaan ? (
                <p className="mt-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">{formErrors.jenisPekerjaan}</p>
              ) : null}
            </div>
            {mode === 'aktivitas' ? (
              <div>
                <Label>Kendaraan</Label>
                <Popover open={openKendaraanSelect} onOpenChange={setOpenKendaraanSelect}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-expanded={openKendaraanSelect}
                      className="w-full h-10 px-3 rounded-md border border-input bg-white text-sm flex items-center justify-between"
                    >
                      {formData.kendaraanPlatNomor
                        ? (kendaraan.list.find((k) => k.platNomor === formData.kendaraanPlatNomor)?.platNomor || formData.kendaraanPlatNomor)
                        : 'Pilih kendaraan'}
                      <ChevronUpDownIcon className="h-4 w-4 text-gray-400" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[320px] p-3" align="start">
                    <Input
                      placeholder="Cari plat / merk..."
                      value={kendaraanQuery}
                      onChange={(e) => setKendaraanQuery(e.target.value)}
                      className="mb-2 rounded-lg"
                    />
                    <div className="max-h-56 overflow-y-auto space-y-1">
                      {kendaraan.list
                        .filter((k) => {
                          const q = kendaraanQuery.trim().toLowerCase()
                          if (!q) return true
                          return k.platNomor.toLowerCase().includes(q) || k.merk.toLowerCase().includes(q)
                        })
                        .map((k) => {
                          const checked = formData.kendaraanPlatNomor === k.platNomor
                          return (
                            <button
                              key={k.platNomor}
                              type="button"
                              onClick={() => {
                                setFormData((prev) => ({ ...prev, kendaraanPlatNomor: checked ? '' : k.platNomor }))
                                setOpenKendaraanSelect(false)
                              }}
                              className={`w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 flex items-center justify-between ${checked ? 'bg-emerald-50 text-emerald-700' : ''}`}
                            >
                              <span className="truncate">{k.platNomor} <span className="text-gray-500">({k.merk} • {k.jenis})</span></span>
                              {checked ? <CheckIcon className="h-4 w-4" /> : <span className="h-4 w-4" />}
                            </button>
                          )
                        })}
                      {kendaraan.list.filter((k) => {
                        const q = kendaraanQuery.trim().toLowerCase()
                        if (!q) return true
                        return k.platNomor.toLowerCase().includes(q) || k.merk.toLowerCase().includes(q)
                      }).length === 0 && (
                        <div className="px-3 py-2 text-sm text-gray-500">Kendaraan tidak ditemukan</div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-gray-500 mt-1">Boleh dikosongkan. Hanya alat berat dan mobil truck.</p>
              </div>
            ) : null}
            <div>
              <Label>Karyawan (Bisa pilih lebih dari satu)</Label>
              <Popover open={openUserSelect} onOpenChange={setOpenUserSelect}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-expanded={openUserSelect}
                    className="w-full h-10 px-3 rounded-md border border-input bg-white text-sm flex items-center justify-between"
                  >
                    {selectedUserIds.length === 0
                      ? 'Pilih karyawan'
                      : `${selectedUserIds.length} karyawan dipilih`}
                    <ChevronUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-2">
                  <Input
                    autoFocus
                    placeholder="Cari karyawan..."
                    value={userQuery}
                    onChange={(e) => setUserQuery(e.target.value)}
                    className="mb-2 rounded-lg"
                  />
                  <div className="max-h-56 overflow-y-auto space-y-1">
                    {users.users
                      .filter((u) => u.name.toLowerCase().includes(userQuery.toLowerCase()))
                      .map((user) => {
                        const isSelected = selectedUserIds.includes(user.id)
                        return (
                          <button
                            key={user.id}
                            type="button"
                            onClick={() => {
                              setSelectedUserIds((prev) =>
                                isSelected ? prev.filter((id) => id !== user.id) : [...prev, user.id]
                              )
                            }}
                            className={`w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 flex items-center justify-between ${isSelected ? 'bg-emerald-50 text-emerald-700' : ''}`}
                          >
                            <span>{user.name}</span>
                            {isSelected && <CheckIcon className="h-4 w-4" />}
                          </button>
                        )
                      })}
                    {users.users.filter((u) => u.name.toLowerCase().includes(userQuery.toLowerCase())).length === 0 && (
                      <div className="px-3 py-2 text-sm text-gray-500">Karyawan tidak ditemukan</div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
              <p className="text-xs text-gray-500 mt-1">Karyawan boleh dikosongkan.</p>
              {selectedUserIds.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedUserIds.map((id) => {
                    const user = users.users.find((u) => u.id === id)
                    if (!user) return null
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 px-3 py-1 text-xs"
                      >
                        {user.name}
                        <button
                          type="button"
                          onClick={() => setSelectedUserIds((prev) => prev.filter((uid) => uid !== id))}
                          className="rounded-full hover:bg-emerald-100"
                        >
                          <XMarkIcon className="h-3 w-3" />
                        </button>
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
            {!mode ? (
              <div>
                <Label>Upah Borongan</Label>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    id="upahBorongan"
                    type="checkbox"
                    checked={formData.upahBorongan}
                    onChange={(e) => setFormData({ ...formData, upahBorongan: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <label htmlFor="upahBorongan" className="text-sm text-gray-700">Masukkan ke penggajian</label>
                </div>
              </div>
            ) : null}
            {(mode === 'borongan' || formData.upahBorongan) && (
              <>
                <div>
                  <Label>Jumlah</Label>
                  <Input
                    type="number"
                    step="any"
                    min="0"
                    value={formData.jumlah === 0 ? '' : formData.jumlah}
                    onChange={(e) => {
                      const val = e.target.value
                      setFormData({ ...formData, jumlah: val === '' ? 0 : Number(val) })
                    }}
                    className="bg-white"
                  />
                </div>
                <div>
                  <Label>Satuan</Label>
                  <Input
                    value={formData.satuan}
                    onChange={(e) => setFormData({ ...formData, satuan: e.target.value })}
                    className="bg-white"
                    placeholder="Contoh: HK, Kg, Ha"
                  />
                </div>
                <div>
                  <Label>Biaya / Satuan (Rp)</Label>
                  <FormattedNumberInput
                    value={formData.hargaSatuan}
                    onChange={(value) => setFormData({ ...formData, hargaSatuan: value })}
                    className="bg-white"
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>Total Biaya (Rp)</Label>
                  <Input
                    value={formatNumber(Math.round(Number(formData.jumlah || 0) * Number(formData.hargaSatuan || 0)))}
                    className="bg-white"
                    readOnly
                  />
                </div>
              </>
            )}
          </div>
          <div>
            <Label>Keterangan Tambahan (Opsional)</Label>
            <Textarea
              placeholder="Detail pekerjaan..."
              value={formData.keterangan}
              onChange={(e) => setFormData({ ...formData, keterangan: e.target.value })}
              className="bg-white"
            />
          </div>
          <div>
            <Label>Upload Gambar (Opsional)</Label>
            <ImageUpload
              previewUrl={buktiPreview}
              onFileChange={(file) => {
                setBuktiFile(file)
                if (!file) {
                  setBuktiPreview(null)
                  return
                }
                setBuktiPreview(URL.createObjectURL(file))
              }}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowForm(false)}
              disabled={isSubmitting}
            >
              Batal
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Menyimpan...' : 'Simpan Pekerjaan'}
            </Button>
          </div>
        </form>
      )}

      {/* Table */}
      <div ref={boronganTableRef} className="space-y-3">
        {isLoading ? (
          <p className="text-center text-gray-500 py-4">Memuat data...</p>
        ) : filteredActivities.length === 0 ? (
          <p className="text-center text-gray-500 py-4 bg-gray-50 rounded-lg border border-dashed">Belum ada riwayat pekerjaan</p>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-1">
              <div className="text-xs text-gray-500">
                Menampilkan {filteredActivities.length === 0 ? 0 : startIndex + 1} - {Math.min(startIndex + perView, filteredActivities.length)} dari {filteredActivities.length} data
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Per View</span>
                <select
                  className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  value={perView}
                  onChange={(e) => {
                    setPerView(Number(e.target.value))
                    setCurrentPage(1)
                  }}
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="grid grid-cols-1 gap-4 md:hidden">
              {pagedActivities.map((item, idx) => {
                const isUpah = !!item.upahBorongan
                const isPaid = isUpah && item.gajianStatus === 'FINALIZED'
                const isInGajian = isUpah && !!item.gajianId && !isPaid
                const isLocked = mode === 'borongan' ? isInGajian : isUpah && !!item.gajianId
                const isUnpaid = isUpah && !isInGajian && !isPaid
                const displayNo = startIndex + idx + 1
                const jumlah = Number(item.jumlah || 0)
                const hargaSatuan = Number(item.hargaSatuan || 0) || (jumlah > 0 ? Math.round(Number(item.biaya || 0) / jumlah) : 0)

                return (
                  <div key={item.id} className="relative bg-white p-4 pt-11 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="absolute top-3 left-3 h-6 min-w-6 px-2 rounded-full bg-gray-100 text-gray-700 text-xs font-bold flex items-center justify-center">
                      {displayNo}
                    </div>
                    <div className="flex flex-col gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          {mode === 'borongan' && item.kategoriBorongan ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                              {String(item.kategoriBorongan)}
                            </span>
                          ) : null}
                          <h4 className="font-semibold text-gray-900">{item.jenisPekerjaan}</h4>
                          {item.upahBorongan && (
                            <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-xs font-semibold">
                              Borongan
                            </span>
                          )}
                          {isPaid && (
                            <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-xs font-semibold">
                              Dibayar
                            </span>
                          )}
                          {isInGajian && (
                            <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-800 px-2 py-0.5 text-xs font-semibold">
                              Masuk penggajian
                            </span>
                          )}
                          {mode === 'borongan' && isUnpaid && (
                            <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-700 px-2 py-0.5 text-xs font-semibold">
                              Belum dibayar
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                          <CalendarIcon className="w-3 h-3" />
                          {new Date(item.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </div>
                        {item.users && item.users.length > 0 ? (
                          <div className="flex items-center gap-2 text-xs text-blue-600 mt-1 flex-wrap">
                            <UserIcon className="w-3 h-3" />
                            <span className="font-medium">{item.users.map((u) => u.name).join(', ')}</span>
                          </div>
                        ) : item.user ? (
                          <div className="flex items-center gap-2 text-xs text-blue-600 mt-1">
                            <UserIcon className="w-3 h-3" />
                            <span className="font-medium">{item.user.name}</span>
                          </div>
                        ) : null}
                      </div>

                      {mode === 'borongan' ? (
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div className="rounded-lg border border-gray-100 bg-gray-50 p-2">
                            <div className="text-[10px] font-black tracking-wider text-gray-400 uppercase">Jumlah</div>
                            <div className="font-semibold text-gray-900">{jumlah ? `${formatNumber(jumlah, 2)} ${item.satuan || ''}` : '-'}</div>
                          </div>
                          <div className="rounded-lg border border-gray-100 bg-gray-50 p-2">
                            <div className="text-[10px] font-black tracking-wider text-gray-400 uppercase">Harga Satuan</div>
                            <div className="font-semibold text-gray-900">{hargaSatuan > 0 ? formatCurrency(hargaSatuan) : '-'}</div>
                          </div>
                          <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-2">
                            <div className="text-[10px] font-black tracking-wider text-emerald-700 uppercase">Jumlah Biaya</div>
                            <div className="font-extrabold text-emerald-800">{item.biaya > 0 ? formatCurrency(item.biaya) : '-'}</div>
                          </div>
                        </div>
                      ) : mode !== 'aktivitas' && item.biaya > 0 ? (
                        <div className="flex items-center gap-1 text-green-600 font-medium bg-green-50 px-2 py-1 rounded-md text-sm w-fit">
                          <BanknotesIcon className="w-4 h-4" />
                          Rp {item.biaya.toLocaleString('id-ID')}
                        </div>
                      ) : null}

                      <div className="flex items-center gap-2 pt-2 border-t border-gray-50">
                        <Button variant="outline" className="h-8 w-8 p-0 rounded-full" onClick={() => openDetail(item)}>
                          <EyeIcon className="h-4 w-4" />
                        </Button>
                        {mode === 'borongan' && isPaid ? (
                          <Button variant="outline" className="h-8 w-8 p-0 rounded-full" onClick={() => openEdit(item)}>
                            <PencilSquareIcon className="h-4 w-4" />
                          </Button>
                        ) : !isLocked ? (
                          <>
                            <Button variant="outline" className="h-8 w-8 p-0 rounded-full" onClick={() => openEdit(item)}>
                              <PencilSquareIcon className="h-4 w-4" />
                            </Button>
                            {!(mode === 'borongan' && isPaid) ? (
                              <Button variant="destructive" className="h-8 w-8 p-0 rounded-full" onClick={() => openDelete(item)}>
                                <TrashIcon className="h-4 w-4" />
                              </Button>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="w-full overflow-x-auto">
                <table className="min-w-[1100px] w-full text-left text-sm border-collapse">
                  <thead className="bg-gray-50 text-gray-500 font-semibold text-xs uppercase tracking-wider">
                    <tr>
                      {mode === 'borongan' ? (
                        <>
                          <th className="px-4 py-3 border-b border-gray-100 text-center w-12">No</th>
                          <th className="px-4 py-3 border-b border-gray-100">Tanggal</th>
                          <th className="px-4 py-3 border-b border-gray-100">Kategori</th>
                          <th className="px-4 py-3 border-b border-gray-100">Pekerjaan</th>
                          <th className="px-4 py-3 border-b border-gray-100">Karyawan</th>
                          <th className="px-4 py-3 border-b border-gray-100">Jumlah</th>
                          <th className="px-4 py-3 border-b border-gray-100 text-right">Harga Satuan</th>
                          <th className="px-4 py-3 border-b border-gray-100 text-right">Jumlah Biaya</th>
                          <th className="px-4 py-3 border-b border-gray-100">Status</th>
                          <th className="px-4 py-3 border-b border-gray-100 text-center w-28">Aksi</th>
                        </>
                      ) : mode === 'aktivitas' ? (
                        <>
                          <th className="px-4 py-3 border-b border-gray-100 text-center w-12">No</th>
                          <th className="px-4 py-3 border-b border-gray-100">Tanggal</th>
                          <th className="px-4 py-3 border-b border-gray-100">Pekerjaan</th>
                          <th className="px-4 py-3 border-b border-gray-100">Karyawan</th>
                          <th className="px-4 py-3 border-b border-gray-100">Status</th>
                          <th className="px-4 py-3 border-b border-gray-100 text-center w-28">Aksi</th>
                        </>
                      ) : (
                        <>
                          <th className="px-4 py-3 border-b border-gray-100 text-center w-12">No</th>
                          <th className="px-4 py-3 border-b border-gray-100">Tanggal</th>
                          <th className="px-4 py-3 border-b border-gray-100">Pekerjaan</th>
                          <th className="px-4 py-3 border-b border-gray-100">Karyawan</th>
                          <th className="px-4 py-3 border-b border-gray-100">Jumlah</th>
                          <th className="px-4 py-3 border-b border-gray-100 text-right">Biaya</th>
                          <th className="px-4 py-3 border-b border-gray-100">Status</th>
                          <th className="px-4 py-3 border-b border-gray-100 text-center w-28">Aksi</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {pagedActivities.map((item, idx) => {
                      const isUpah = !!item.upahBorongan
                      const isPaid = isUpah && item.gajianStatus === 'FINALIZED'
                      const isInGajian = isUpah && !!item.gajianId && !isPaid
                      const isLocked = mode === 'borongan' ? isInGajian : isUpah && !!item.gajianId
                      const isUnpaid = isUpah && !isInGajian && !isPaid
                      const displayNo = startIndex + idx + 1
                      const jumlah = Number(item.jumlah || 0)
                      const hargaSatuan = Number(item.hargaSatuan || 0) || (jumlah > 0 ? Math.round(Number(item.biaya || 0) / jumlah) : 0)

                      return (
                        <tr key={item.id} className="hover:bg-gray-50/50 transition-colors group">
                          <td className="px-4 py-3 text-center text-gray-500 font-medium">{displayNo}</td>
                          <td className="px-4 py-3 text-gray-900 whitespace-nowrap">
                            {new Date(item.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </td>
                          {mode === 'borongan' ? (
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                                {String(item.kategoriBorongan || 'Tanpa kategori')}
                              </span>
                            </td>
                          ) : null}
                          <td className="px-4 py-3">
                            <div className="font-semibold text-gray-900">{item.jenisPekerjaan}</div>
                            {(() => {
                              const ketRaw = typeof item.keterangan === 'string' ? item.keterangan.trim() : ''
                              if (!ketRaw) return null
                              if (ketRaw.toUpperCase().startsWith(GAJIAN_MANUAL_BIAYA_MARKER)) return null
                              return <div className="text-xs text-gray-500 italic truncate max-w-[200px]">{ketRaw}</div>
                            })()}
                          </td>
                          {mode === 'borongan' ? (
                            <>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1.5 text-blue-600 font-medium">
                                  <UserIcon className="w-3.5 h-3.5 shrink-0" />
                                  <span className="truncate max-w-[220px]">
                                    {item.user?.name || '-'}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                                {jumlah ? `${formatNumber(jumlah, 2)} ${item.satuan || ''}` : '-'}
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-gray-800 whitespace-nowrap">
                                {hargaSatuan > 0 ? formatCurrency(hargaSatuan) : '-'}
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-emerald-600 whitespace-nowrap">
                                {item.biaya > 0 ? formatCurrency(item.biaya) : '-'}
                              </td>
                            </>
                          ) : mode === 'aktivitas' ? (
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5 text-blue-600 font-medium">
                                <UserIcon className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate max-w-[220px]">
                                  {item.users && item.users.length > 0 ? item.users.map((u) => u.name).join(', ') : item.user?.name || '-'}
                                </span>
                              </div>
                            </td>
                          ) : (
                            <>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1.5 text-blue-600 font-medium">
                                  <UserIcon className="w-3.5 h-3.5 shrink-0" />
                                  <span className="truncate max-w-[150px]">
                                    {item.users && item.users.length > 0 ? item.users.map((u) => u.name).join(', ') : item.user?.name || '-'}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                                {item.jumlah ? `${formatNumber(item.jumlah, 2)} ${item.satuan || ''}` : '-'}
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-emerald-600 whitespace-nowrap">
                                {item.biaya > 0 ? formatCurrency(item.biaya) : '-'}
                              </td>
                            </>
                          )}
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {isPaid && (
                                <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight">
                                  Dibayar
                                </span>
                              )}
                              {isInGajian && (
                                <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-800 px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight">
                                  Penggajian
                                </span>
                              )}
                              {mode === 'borongan' && isUnpaid && (
                                <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight">
                                  Draft
                                </span>
                              )}
                              {!item.upahBorongan && (
                                <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight">
                                  Aktivitas
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-1">
                              <Button variant="outline" className="h-8 w-8 p-0 rounded-full" onClick={() => openDetail(item)}>
                                <EyeIcon className="h-4 w-4" />
                              </Button>
                              {mode === 'borongan' && isPaid ? (
                                <Button variant="outline" className="h-8 w-8 p-0 rounded-full" onClick={() => openEdit(item)}>
                                  <PencilSquareIcon className="h-4 w-4" />
                                </Button>
                              ) : !isLocked ? (
                                <>
                                  <Button variant="outline" className="h-8 w-8 p-0 rounded-full" onClick={() => openEdit(item)}>
                                    <PencilSquareIcon className="h-4 w-4" />
                                  </Button>
                                  {!(mode === 'borongan' && isPaid) ? (
                                    <Button variant="destructive" className="h-8 w-8 p-0 rounded-full" onClick={() => openDelete(item)}>
                                      <TrashIcon className="h-4 w-4" />
                                    </Button>
                                  ) : null}
                                </>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="rounded-full"
                >
                  Prev
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <Button
                    key={page}
                    variant={currentPage === page ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCurrentPage(page)}
                    className={`rounded-full ${currentPage === page ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
                  >
                    {page}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="rounded-full"
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail Modal */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="w-[92vw] sm:w-full sm:max-w-2xl bg-white rounded-3xl p-0 overflow-hidden shadow-2xl border-none [&>button.absolute]:hidden flex flex-col max-h-[90vh]">
          <DialogTitle className="sr-only">Detail Pekerjaan</DialogTitle>
          <DialogDescription className="sr-only">Detail pekerjaan borongan / aktivitas.</DialogDescription>
          <ModalHeader title="Detail Pekerjaan" variant="emerald" onClose={() => setDetailOpen(false)} />
          <ModalContentWrapper>
            {selectedActivity && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-500">Tanggal</Label>
                    <p className="font-medium">
                      {new Date(selectedActivity.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                  <div>
                    <Label className="text-gray-500">Jenis Pekerjaan</Label>
                    <p className="font-medium">{selectedActivity.jenisPekerjaan}</p>
                  </div>
                  {mode === 'borongan' && (
                    <div>
                      <Label className="text-gray-500">Kategori</Label>
                      <p className="font-medium">{selectedActivity.kategoriBorongan || 'Tanpa kategori'}</p>
                    </div>
                  )}
                  <div>
                    <Label className="text-gray-500">Karyawan</Label>
                    <p className="font-medium">
                      {selectedActivity.users && selectedActivity.users.length > 0
                        ? selectedActivity.users.map((u) => u.name).join(', ')
                        : selectedActivity.user?.name || '-'}
                    </p>
                  </div>
                  {selectedActivity.upahBorongan && (
                    <>
                      <div>
                        <Label className="text-gray-500">Jumlah</Label>
                        <p className="font-medium">
                          {Number(selectedActivity.jumlah || 0).toLocaleString('id-ID')} {selectedActivity.satuan}
                        </p>
                      </div>
                      <div>
                        <Label className="text-gray-500">Harga Satuan</Label>
                        <p className="font-medium">{formatCurrency(Number(selectedActivity.hargaSatuan || 0))}</p>
                      </div>
                      <div>
                        <Label className="text-gray-500">Total Biaya</Label>
                        <p className="font-medium text-emerald-600">{formatCurrency(Number(selectedActivity.biaya || 0))}</p>
                      </div>
                    </>
                  )}
                  {selectedActivity.keterangan && (
                    <div className="col-span-2">
                      <Label className="text-gray-500">Keterangan</Label>
                      <p className="font-medium">{stripGajianManualMarker(selectedActivity.keterangan)}</p>
                    </div>
                  )}
                </div>
                {selectedActivity.imageUrl && (
                  <div>
                    <Label className="text-gray-500">Bukti Pekerjaan</Label>
                    <div className="mt-2">
                      {detailImageError ? (
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                          <p className="text-gray-500">Gagal memuat gambar</p>
                        </div>
                      ) : (
                        <img
                          src={selectedActivity.imageUrl}
                          alt="Bukti pekerjaan"
                          className="max-w-full h-auto rounded-lg border border-gray-200 cursor-pointer"
                          onClick={() => setViewImageUrl(selectedActivity.imageUrl || null)}
                          onError={() => setDetailImageError(true)}
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </ModalContentWrapper>
          <ModalFooter>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>Tutup</Button>
            <Button onClick={handleExportDetailPdf} disabled={detailExporting}>
              {detailExporting ? 'Membuat PDF...' : 'Export PDF'}
            </Button>
          </ModalFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="w-[92vw] sm:w-full sm:max-w-2xl bg-white rounded-3xl p-0 overflow-hidden shadow-2xl border-none [&>button.absolute]:hidden flex flex-col max-h-[90vh]">
          <DialogTitle className="sr-only">Edit Pekerjaan</DialogTitle>
          <DialogDescription className="sr-only">Edit data pekerjaan borongan / aktivitas.</DialogDescription>
          <ModalHeader title="Edit Pekerjaan" variant="emerald" onClose={() => setEditOpen(false)} />
          <ModalContentWrapper className="overflow-y-auto scrollbar-hide flex-1">
            <div className="grid grid-cols-2 gap-4">
              {mode === 'borongan' && (
                <div className="col-span-2">
                  <Label>Kategori Borongan {editKategoriOnly ? '' : '*'}</Label>
                  <Popover open={openEditKategoriSelect} onOpenChange={setOpenEditKategoriSelect}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        aria-expanded={openEditKategoriSelect}
                        className={`w-full h-10 px-3 rounded-md border border-input bg-white text-sm flex items-center justify-between ${editErrors.kategoriBorongan ? 'border-red-500 ring-2 ring-red-500/10' : ''}`}
                      >
                        {editForm.kategoriBorongan
                          ? String(editForm.kategoriBorongan)
                          : 'Pilih kategori'}
                        <ChevronUpDownIcon className="h-4 w-4 text-gray-400" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[320px] p-3" align="start">
                      <Input
                        autoFocus
                        placeholder="Cari kategori..."
                        value={editKategoriQuery}
                        onChange={(e) => setEditKategoriQuery(e.target.value)}
                        className="mb-2 rounded-lg"
                      />
                      <div className="max-h-56 overflow-y-auto space-y-1">
                        {kategoriBoronganOptions
                          .filter((k) => {
                            const q = editKategoriQuery.trim().toLowerCase()
                            if (!q) return true
                            return k.toLowerCase().includes(q)
                          })
                          .map((k) => {
                            const checked = String(editForm.kategoriBorongan || '') === String(k)
                            return (
                              <button
                                key={k}
                                type="button"
                                onClick={() => {
                                  setEditForm((prev) => ({ ...prev, kategoriBorongan: k }))
                                  setEditErrors((prev) => ({ ...prev, kategoriBorongan: undefined }))
                                  setOpenEditKategoriSelect(false)
                                }}
                                className={`w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 flex items-center justify-between ${checked ? 'bg-emerald-50 text-emerald-700' : ''}`}
                              >
                                <span className="truncate">{k}</span>
                                {checked ? <CheckIcon className="h-4 w-4" /> : <span className="h-4 w-4" />}
                              </button>
                            )
                          })}
                      </div>
                    </PopoverContent>
                  </Popover>
                  {editErrors.kategoriBorongan ? (
                    <p className="mt-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">{editErrors.kategoriBorongan}</p>
                  ) : null}
                </div>
              )}
              {editKategoriOnly ? (
                <div className="col-span-2 grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-500">Tanggal</Label>
                    <p className="font-medium">{editForm.date ? new Date(editForm.date + 'T00:00:00+07:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}</p>
                  </div>
                  <div>
                    <Label className="text-gray-500">{mode === 'borongan' ? 'Jenis Pekerjaan' : 'Deskripsi'}</Label>
                    <p className="font-medium">{editForm.jenisPekerjaan || '-'}</p>
                  </div>
                  {mode === 'aktivitas' && editForm.kendaraanPlatNomor && (
                    <div>
                      <Label className="text-gray-500">Kendaraan</Label>
                      <p className="font-medium">{editForm.kendaraanPlatNomor}</p>
                    </div>
                  )}
                  {(mode === 'borongan' || editForm.upahBorongan) && (
                    <>
                      <div>
                        <Label className="text-gray-500">Jumlah</Label>
                        <p className="font-medium">{editForm.jumlah ? `${Number(editForm.jumlah).toLocaleString('id-ID')} ${editForm.satuan || ''}` : '-'}</p>
                      </div>
                      <div>
                        <Label className="text-gray-500">Harga Satuan</Label>
                        <p className="font-medium">{editForm.hargaSatuan ? formatCurrency(editForm.hargaSatuan) : '-'}</p>
                      </div>
                      <div>
                        <Label className="text-gray-500">Total Biaya</Label>
                        <p className="font-medium text-emerald-600">{formatCurrency(Math.round(Number(editForm.jumlah || 0) * Number(editForm.hargaSatuan || 0)))}</p>
                      </div>
                    </>
                  )}
                  {editForm.keterangan && (
                    <div className="col-span-2">
                      <Label className="text-gray-500">Keterangan</Label>
                      <p className="font-medium">{stripGajianManualMarker(editForm.keterangan)}</p>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div>
                    <Label>Tanggal</Label>
                    <Input
                      type="date"
                      value={editForm.date}
                      onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                      className="bg-white"
                    />
                  </div>
                  <div>
                    <Label>{mode === 'borongan' ? 'Jenis Pekerjaan *' : 'Deskripsi'}</Label>
                    <Input
                      value={editForm.jenisPekerjaan}
                      onChange={(e) => {
                        setEditForm({ ...editForm, jenisPekerjaan: e.target.value })
                        if (mode === 'borongan') setEditErrors((prev) => ({ ...prev, jenisPekerjaan: undefined }))
                      }}
                      className="bg-white"
                      ref={editJenisFieldRef}
                    />
                    {mode === 'borongan' && editErrors.jenisPekerjaan ? (
                      <p className="mt-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">{editErrors.jenisPekerjaan}</p>
                    ) : null}
                  </div>
                  {mode === 'aktivitas' && (
                    <div className="col-span-2">
                      <Label>Kendaraan</Label>
                      <Popover open={openEditKendaraanSelect} onOpenChange={setOpenEditKendaraanSelect}>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            aria-expanded={openEditKendaraanSelect}
                            className="w-full h-10 px-3 rounded-md border border-input bg-white text-sm flex items-center justify-between"
                          >
                            {editForm.kendaraanPlatNomor
                              ? (kendaraan.list.find((k) => k.platNomor === editForm.kendaraanPlatNomor)?.platNomor || editForm.kendaraanPlatNomor)
                              : 'Pilih kendaraan'}
                            <ChevronUpDownIcon className="h-4 w-4 text-gray-400" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[320px] p-3" align="start">
                          <Input
                            placeholder="Cari plat / merk..."
                            value={editKendaraanQuery}
                            onChange={(e) => setEditKendaraanQuery(e.target.value)}
                            className="mb-2 rounded-lg"
                          />
                          <div className="max-h-56 overflow-y-auto space-y-1">
                            {kendaraan.list
                              .filter((k) => {
                                const q = editKendaraanQuery.trim().toLowerCase()
                                if (!q) return true
                                return k.platNomor.toLowerCase().includes(q) || k.merk.toLowerCase().includes(q)
                              })
                              .map((k) => {
                                const checked = editForm.kendaraanPlatNomor === k.platNomor
                                return (
                                  <button
                                    key={k.platNomor}
                                    type="button"
                                    onClick={() => {
                                      setEditForm((prev) => ({ ...prev, kendaraanPlatNomor: checked ? '' : k.platNomor }))
                                      setOpenEditKendaraanSelect(false)
                                    }}
                                    className={`w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 flex items-center justify-between ${checked ? 'bg-emerald-50 text-emerald-700' : ''}`}
                                  >
                                    <span className="truncate">{k.platNomor} <span className="text-gray-500">({k.merk} • {k.jenis})</span></span>
                                    {checked ? <CheckIcon className="h-4 w-4" /> : <span className="h-4 w-4" />}
                                  </button>
                                )
                              })}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}
                  {(mode === 'borongan' || editForm.upahBorongan) && (
                    <>
                      <div>
                        <Label>Jumlah</Label>
                        <Input
                          type="number"
                          step="any"
                          min="0"
                          value={editForm.jumlah === 0 ? '' : editForm.jumlah}
                          onChange={(e) => {
                            const val = e.target.value
                            setEditForm({ ...editForm, jumlah: val === '' ? 0 : Number(val) })
                          }}
                          className="bg-white"
                        />
                      </div>
                      <div>
                        <Label>Satuan</Label>
                        <Input
                          value={editForm.satuan}
                          onChange={(e) => setEditForm({ ...editForm, satuan: e.target.value })}
                          className="bg-white"
                        />
                      </div>
                      <div>
                        <Label>Biaya / Satuan (Rp)</Label>
                        <FormattedNumberInput
                          value={editForm.hargaSatuan}
                          onChange={(value) => setEditForm({ ...editForm, hargaSatuan: value })}
                          className="bg-white"
                        />
                      </div>
                      <div>
                        <Label>Total Biaya (Rp)</Label>
                        <Input
                          value={formatNumber(Math.round(Number(editForm.jumlah || 0) * Number(editForm.hargaSatuan || 0)))}
                          className="bg-white"
                          readOnly
                        />
                      </div>
                    </>
                  )}
                  <div className="col-span-2">
                    <Label>Keterangan</Label>
                    <Textarea
                      value={editForm.keterangan}
                      onChange={(e) => setEditForm({ ...editForm, keterangan: e.target.value })}
                      className="bg-white"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>Upload Gambar</Label>
                    <ImageUpload
                      previewUrl={editBuktiPreview}
                      onFileChange={(file) => {
                        setEditBuktiFile(file)
                        if (!file) {
                          setEditBuktiPreview(null)
                          return
                        }
                        setEditBuktiPreview(URL.createObjectURL(file))
                      }}
                    />
                  </div>
                </>
              )}
            </div>
          </ModalContentWrapper>
          <ModalFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Batal</Button>
            <Button onClick={handleUpdate}>Simpan Perubahan</Button>
          </ModalFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmationModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Hapus Pekerjaan?"
        description="Data pekerjaan ini akan dihapus dan tidak bisa dikembalikan."
        variant="emerald"
      />

      {/* Image Viewer */}
      <Dialog open={!!viewImageUrl} onOpenChange={() => setViewImageUrl(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden bg-black/90">
          <DialogTitle className="sr-only">View Image</DialogTitle>
          {viewImageUrl && (
            <img
              src={viewImageUrl}
              alt="Full size"
              className="max-w-full max-h-[85vh] object-contain mx-auto"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Master Kategori Modal */}
      <Dialog open={kategoriMaster.isOpen} onOpenChange={kategoriMaster.setIsOpen}>
        <DialogContent className="w-[92vw] sm:w-full sm:max-w-md bg-white rounded-3xl p-0 overflow-hidden shadow-2xl border-none [&>button.absolute]:hidden flex flex-col max-h-[90vh]">
          <DialogTitle className="sr-only">Master Kategori Borongan</DialogTitle>
          <DialogDescription className="sr-only">Kelola kategori borongan.</DialogDescription>
          <ModalHeader title="Master Kategori Borongan" variant="emerald" onClose={() => kategoriMaster.setIsOpen(false)} />
          <ModalContentWrapper>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Nama kategori baru..."
                  value={kategoriMaster.draft}
                  onChange={(e) => kategoriMaster.setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      kategoriMaster.add()
                    }
                  }}
                />
                <Button onClick={kategoriMaster.add} disabled={kategoriMaster.isSaving}>
                  {kategoriMaster.isSaving ? '...' : 'Tambah'}
                </Button>
              </div>
              <div className="space-y-2">
                {kategoriMaster.list.map((k) => (
                  <div key={k.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    {kategoriMaster.editId === k.id ? (
                      <div className="flex-1 flex gap-2">
                        <Input
                          value={kategoriMaster.editName}
                          onChange={(e) => kategoriMaster.setEditName(e.target.value)}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              kategoriMaster.saveEdit()
                            }
                          }}
                        />
                        <Button size="sm" onClick={kategoriMaster.saveEdit} disabled={kategoriMaster.isEditSaving}>
                          {kategoriMaster.isEditSaving ? '...' : 'Simpan'}
                        </Button>
                        <Button size="sm" variant="outline" onClick={kategoriMaster.cancelEdit}>
                          Batal
                        </Button>
                      </div>
                    ) : (
                      <>
                        <span className="font-medium">{k.name}</span>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => kategoriMaster.startEdit(k)}>
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => kategoriMaster.openDelete(k)}
                            disabled={kategoriMaster.deletingId === k.id}
                          >
                            {kategoriMaster.deletingId === k.id ? '...' : 'Hapus'}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                {kategoriMaster.list.length === 0 && (
                  <p className="text-center text-gray-500 py-4">Belum ada kategori</p>
                )}
              </div>
            </div>
          </ModalContentWrapper>
          <ModalFooter>
            <Button variant="outline" onClick={() => kategoriMaster.setIsOpen(false)}>Tutup</Button>
          </ModalFooter>
        </DialogContent>
      </Dialog>

      {/* Kategori Delete Confirmation */}
      <ConfirmationModal
        isOpen={kategoriMaster.deleteOpen}
        onClose={kategoriMaster.closeDelete}
        onConfirm={kategoriMaster.confirmDelete}
        title="Hapus Kategori?"
        description={`Kategori "${kategoriMaster.deleteTarget?.name}" akan dihapus.`}
        variant="emerald"
      />
    </div>
  )
}
