'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import toast from 'react-hot-toast'
import { getCurrentWIBDateParts } from '@/lib/wib-date'
import type { BiayaLainGajian, DetailGajian, DetailGajianKaryawan, Gajian, Kebun as KebunEntity, Kendaraan, NotaSawit, PotonganGajian, Timbangan, User } from '@prisma/client'

export type UnpaidKaryawan = {
  karyawanId: number
  name: string
  total: number
  hariKerja?: number
}

export type BiayaLainItem = {
  deskripsi: string
  total: number
  karyawan?: string
  jumlah?: number
  satuan?: string
  hargaSatuan?: number
  isAutoKg?: boolean
}

export type PotonganItem = {
  id: string
  deskripsi: string
  total: number
  keterangan?: string
  tanggal?: string
}

export type GajianHistoryItem = {
  id: number
  kebunId: number
  tanggalMulai: string
  tanggalSelesai: string
  status: string
  totalGaji: number
  totalBiayaLain: number
  totalPotongan: number
  createdAt: string
  updatedAt: string
}

type NotaSawitWithRelations = NotaSawit & {
  supir: User
  timbangan?: Timbangan | null
  kebun?: KebunEntity | null
  kendaraan?: Kendaraan | null
}

type DetailGajianWithRelations = DetailGajian & {
  notaSawit: NotaSawitWithRelations
  keterangan?: string | null
}

export type GajianWithDetails = Gajian & {
  kebun: KebunEntity
  detailGajian: DetailGajianWithRelations[]
  biayaLain: (BiayaLainGajian & { keterangan?: string | null })[]
  potongan: (PotonganGajian & { keterangan?: string | null })[]
  detailKaryawan: (DetailGajianKaryawan & { user: User })[]
}

interface UseGajianDataProps {
  kebunId: number
}

export function useGajianData({ kebunId }: UseGajianDataProps) {
  // Initialize dates
  const { year, month: monthIndex } = getCurrentWIBDateParts()
  const month = monthIndex + 1
  const monthKey = String(month).padStart(2, '0')
  const endDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const defaultStart = `${year}-${monthKey}-01`
  const defaultEnd = `${year}-${monthKey}-${String(endDay).padStart(2, '0')}`
  const defaultHistoryStart = `${year}-01-01`
  const defaultHistoryEnd = `${year}-12-31`

  // Preview date range
  const [startDate, setStartDate] = useState(defaultStart)
  const [endDate, setEndDate] = useState(defaultEnd)

  // History date range
  const [historyStartDate, setHistoryStartDate] = useState(defaultHistoryStart)
  const [historyEndDate, setHistoryEndDate] = useState(defaultHistoryEnd)

  // Data states
  const [unpaidList, setUnpaidList] = useState<UnpaidKaryawan[]>([])
  const [biayaLain, setBiayaLain] = useState<BiayaLainItem[]>([])
  const [potonganList, setPotonganList] = useState<PotonganItem[]>([])
  const [savedPotonganIds, setSavedPotonganIds] = useState<Record<string, true>>({})
  const [notaSawitCount, setNotaSawitCount] = useState(0)
  const [notaSawitTotalKg, setNotaSawitTotalKg] = useState(0)
  const [drafts, setDrafts] = useState<GajianHistoryItem[]>([])
  const [finalized, setFinalized] = useState<GajianHistoryItem[]>([])

  // UI states
  const [previewLoading, setPreviewLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingPotonganId, setEditingPotonganId] = useState<string | null>(null)

  // History pagination
  const [historyPerView, setHistoryPerView] = useState(10)
  const [historyPage, setHistoryPage] = useState(1)

  // Detail modal
  const [selectedGajian, setSelectedGajian] = useState<GajianWithDetails | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Totals
  const totalGajiUnpaid = useMemo(() => unpaidList.reduce((acc, curr) => acc + (Number(curr.total) || 0), 0), [unpaidList])
  const totalBiayaLain = useMemo(() => biayaLain.reduce((acc, curr) => acc + (Number(curr.total) || 0), 0), [biayaLain])
  const totalPotongan = useMemo(() => potonganList.reduce((acc, curr) => acc + (Number(curr.total) || 0), 0), [potonganList])
  const totalPengajuan = totalGajiUnpaid + totalBiayaLain - totalPotongan

  // Fetch preview data (unpaid salaries, biaya lain, nota sawit, potongan)
  const fetchPreview = useCallback(async () => {
    setPreviewLoading(true)
    try {
      const [unpaidRes, actRes, notaRes, potonganRes, defaultBiayaRes] = await Promise.all([
        fetch(`/api/karyawan-kebun/absensi?kebunId=${kebunId}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&unpaid=1`, { cache: 'no-store' }),
        fetch(`/api/kebun/${kebunId}/pekerjaan?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&unpaid=1&upahBorongan=1`),
        fetch(`/api/nota-sawit/summary?kebunId=${kebunId}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&statusGajian=BELUM_DIPROSES`, { cache: 'no-store' }),
        fetch(`/api/kebun/${kebunId}/gajian-potongan-draft?startDate=${startDate}&endDate=${endDate}`, { cache: 'no-store' }),
        fetch(`/api/kebun/${kebunId}/default-biaya`),
      ])

      let totalKg = 0
      if (notaRes.ok) {
        const json = await notaRes.json().catch(() => ({} as any))
        setNotaSawitCount(Number(json?.count || 0))
        totalKg = Number(json?.totalBerat || 0)
        setNotaSawitTotalKg(totalKg)
      } else {
        setNotaSawitCount(0)
        setNotaSawitTotalKg(0)
      }

      const mappedBiaya: BiayaLainItem[] = []

      if (actRes.ok) {
        const activities = await actRes.json()
        const list = Array.isArray(activities) ? activities : []
        list.forEach((curr: any) => {
          if (!curr?.upahBorongan) return
          const total = Number(curr?.biaya || 0)
          if (!Number.isFinite(total) || total <= 0) return
          const jenis = String(curr?.jenisPekerjaan || 'Borongan').trim() || 'Borongan'
          const deskripsi = jenis
          const karyawan = Array.isArray(curr?.users)
            ? curr.users.map((u: any) => String(u?.name || '').trim()).filter(Boolean).join(', ')
            : (curr?.user?.name ? String(curr.user.name).trim() : '')
          const jumlah = Number(curr?.jumlah || 0)
          const hargaSatuan = Number(curr?.hargaSatuan || 0)
          const normalizedJumlah = Number.isFinite(jumlah) && jumlah > 0 ? jumlah : 1
          const normalizedHarga = Number.isFinite(hargaSatuan) && hargaSatuan > 0 ? hargaSatuan : Math.round(total / normalizedJumlah)
          const satuan = String(curr?.satuan || '').trim() || 'Paket'
          mappedBiaya.push({
            deskripsi,
            total,
            karyawan: karyawan || undefined,
            jumlah: normalizedJumlah,
            satuan,
            hargaSatuan: normalizedHarga,
          })
        })
      }

      if (defaultBiayaRes.ok) {
        const json = await defaultBiayaRes.json()
        const defaults = Array.isArray(json.data) ? json.data : []
        defaults.forEach((db: any) => {
          if (db.isAutoKg) {
            mappedBiaya.push({
              deskripsi: db.deskripsi,
              total: Math.round(totalKg * (db.hargaSatuan || 0)),
              jumlah: totalKg,
              satuan: 'kg',
              hargaSatuan: Number(db.hargaSatuan || 0),
              isAutoKg: true,
            })
          } else {
            mappedBiaya.push({
              deskripsi: db.deskripsi,
              total: 0,
            })
          }
        })
      }

      setBiayaLain(
        mappedBiaya
          .filter((item) => item.total > 0 || (item.deskripsi && !item.deskripsi.startsWith('Upah Borongan')))
          .sort((a, b) => String(a?.deskripsi || '').localeCompare(String(b?.deskripsi || ''), 'id-ID', { sensitivity: 'base' })),
      )

      if (unpaidRes.ok) {
        const json = await unpaidRes.json()
        const list = Array.isArray(json.data) ? json.data : []
        setUnpaidList(
          [...list].sort((a: any, b: any) => String(a?.name || '').localeCompare(String(b?.name || ''), 'id-ID', { sensitivity: 'base' })),
        )
      } else {
        setUnpaidList([])
      }

      if (potonganRes.ok) {
        const json = await potonganRes.json().catch(() => ({} as any))
        const items = Array.isArray(json?.items) ? json.items : []
        setPotonganList(items)
        setSavedPotonganIds(Object.fromEntries(items.map((x: any) => [String(x?.id), true])))
        setEditingPotonganId(null)
      }
    } catch {
      setUnpaidList([])
      setBiayaLain([])
      setNotaSawitCount(0)
      setPotonganList([])
      setSavedPotonganIds({})
      setEditingPotonganId(null)
    } finally {
      setPreviewLoading(false)
    }
  }, [kebunId, startDate, endDate])

  // Fetch history data
  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const params = new URLSearchParams({ fetchHistory: 'true', kebunId: String(kebunId) })
      if (historyStartDate && historyEndDate) {
        params.set('startDate', historyStartDate)
        params.set('endDate', historyEndDate)
      }
      const res = await fetch(`/api/gajian?${params.toString()}`, { cache: 'no-store' })
      if (res.ok) {
        const json = await res.json()
        setDrafts(Array.isArray(json.drafts) ? json.drafts : [])
        setFinalized(Array.isArray(json.finalized) ? json.finalized : [])
      } else {
        setDrafts([])
        setFinalized([])
      }
    } catch {
      setDrafts([])
      setFinalized([])
    } finally {
      setHistoryLoading(false)
    }
  }, [kebunId, historyStartDate, historyEndDate])

  // Auto-refresh when dates change
  useEffect(() => {
    fetchPreview()
  }, [fetchPreview])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  // History pagination logic
  const historyItems = useMemo(() => {
    return [...drafts, ...finalized].sort(
      (a, b) => new Date(b.tanggalSelesai).getTime() - new Date(a.tanggalSelesai).getTime(),
    )
  }, [drafts, finalized])

  const historyTotalPages = useMemo(() => Math.max(1, Math.ceil(historyItems.length / historyPerView)), [historyItems.length, historyPerView])
  const historyStartIndex = useMemo(() => (historyPage - 1) * historyPerView, [historyPage, historyPerView])
  const pagedHistoryItems = useMemo(() => historyItems.slice(historyStartIndex, historyStartIndex + historyPerView), [historyItems, historyStartIndex, historyPerView])

  useEffect(() => {
    setHistoryPage(1)
  }, [historyStartDate, historyEndDate, historyPerView])

  useEffect(() => {
    if (historyPage > historyTotalPages) {
      setHistoryPage(historyTotalPages)
    }
  }, [historyPage, historyTotalPages])

  // Save potongan
  const handleSavePotongan = useCallback(async () => {
    const startKey = String(startDate || '').trim()
    const endKey = String(endDate || '').trim()
    if (startKey && endKey) {
      const invalid = potonganList.find((p) => {
        const t = String((p as any)?.tanggal || '').trim()
        if (!t) return false
        return t < startKey || t > endKey
      })
      if (invalid) {
        toast.error(`Tanggal potongan harus dalam periode ${startKey} s/d ${endKey}`)
        return
      }
    }
    try {
      const res = await fetch(`/api/kebun/${kebunId}/gajian-potongan-draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate, items: potonganList }),
      })
      if (!res.ok) throw new Error('Gagal menyimpan potongan')
      const json = await res.json().catch(() => ({} as any))
      const items = Array.isArray(json?.items) ? json.items : []
      setPotonganList(items)
      setSavedPotonganIds(Object.fromEntries(items.map((x: any) => [String(x?.id), true])))
      setEditingPotonganId(null)
      toast.success('Potongan disimpan')
    } catch {
      toast.error('Gagal menyimpan potongan')
    }
  }, [kebunId, startDate, endDate, potonganList])

  // Delete potongan
  const handleDeleteSavedPotongan = useCallback(async (itemId: string) => {
    try {
      const qs = new URLSearchParams({ startDate, endDate, itemId })
      const res = await fetch(`/api/kebun/${kebunId}/gajian-potongan-draft?${qs.toString()}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Gagal menghapus potongan')
      const json = await res.json().catch(() => ({} as any))
      const items = Array.isArray(json?.items) ? json.items : []
      setPotonganList(items)
      setSavedPotonganIds(Object.fromEntries(items.map((x: any) => [String(x?.id), true])))
      setEditingPotonganId((prev) => (prev === itemId ? null : prev))
      toast.success('Potongan dihapus')
    } catch {
      toast.error('Gagal menghapus potongan')
    }
  }, [kebunId, startDate, endDate])

  // Open detail
  const handleOpenDetail = useCallback(async (id: number) => {
    setDetailLoading(true)
    try {
      const response = await fetch(`/api/gajian/${id}`)
      if (!response.ok) throw new Error('Gagal mengambil detail gajian')
      const data = await response.json()
      setSelectedGajian(data)
      return data
    } catch {
      toast.error('Gagal mengambil detail gajian.')
      return null
    } finally {
      setDetailLoading(false)
    }
  }, [])

  // Submit gajian
  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true)
    try {
      const detailKaryawan = unpaidList
        .filter((u) => Number(u.total) > 0)
        .map((u) => ({
          userId: u.karyawanId,
          hariKerja: Number(u.hariKerja || 0),
          gajiPokok: Math.round(Number(u.total) || 0),
          potongan: 0,
          total: Math.round(Number(u.total) || 0),
        }))

      if (detailKaryawan.length === 0 && biayaLain.length === 0) {
        toast.error('Tidak ada gaji harian yang belum dibayar pada periode ini.')
        return
      }

      const payload = {
        kebunId,
        tanggalMulai: startDate,
        tanggalSelesai: endDate,
        detailKaryawan,
        biayaLain,
        potongan: potonganList
          .map((p) => ({
            deskripsi: String(p.deskripsi || '').trim(),
            total: Math.round(Number(p.total || 0)),
            keterangan: p.keterangan || undefined,
            tanggal: p.tanggal || undefined,
          }))
          .filter((p) => p.deskripsi && p.total > 0),
      }

      const res = await fetch('/api/gajian/create-from-kebun', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Gagal mengajukan gajian')
      toast.success('Pengajuan gajian berhasil dibuat sebagai draft')
      await fetchHistory()
      await fetchPreview()
    } catch (e: any) {
      toast.error(e?.message || 'Gagal mengajukan gajian')
    } finally {
      setIsSubmitting(false)
    }
  }, [biayaLain, kebunId, fetchHistory, fetchPreview, startDate, endDate, unpaidList, potonganList])

  return {
    // Date states
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    historyStartDate,
    setHistoryStartDate,
    historyEndDate,
    setHistoryEndDate,
    // Data
    unpaidList,
    biayaLain,
    setBiayaLain,
    potonganList,
    setPotonganList,
    savedPotonganIds,
    notaSawitCount,
    notaSawitTotalKg,
    // History
    drafts,
    finalized,
    historyItems,
    pagedHistoryItems,
    historyPage,
    setHistoryPage,
    historyPerView,
    setHistoryPerView,
    historyTotalPages,
    historyStartIndex,
    // UI states
    previewLoading,
    historyLoading,
    isSubmitting,
    editingPotonganId,
    setEditingPotonganId,
    selectedGajian,
    setSelectedGajian,
    detailLoading,
    // Totals
    totalGajiUnpaid,
    totalBiayaLain,
    totalPotongan,
    totalPengajuan,
    // Actions
    fetchPreview,
    fetchHistory,
    handleSavePotongan,
    handleDeleteSavedPotongan,
    handleOpenDetail,
    handleSubmit,
  }
}
