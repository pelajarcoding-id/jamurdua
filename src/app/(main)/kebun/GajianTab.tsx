'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import { DetailGajianModal } from '../gajian/detail-modal'
import type { BiayaLainGajian, DetailGajian, DetailGajianKaryawan, Gajian, Kebun as KebunEntity, Kendaraan, NotaSawit, PotonganGajian, Timbangan, User } from '@prisma/client'
import { getCurrentWIBDateParts } from '@/lib/wib-date'

type UnpaidKaryawan = {
  karyawanId: number
  name: string
  total: number
  hariKerja?: number
}

type BiayaLainItem = {
  deskripsi: string
  total: number
  karyawan?: string
  jumlah?: number
  satuan?: string
  hargaSatuan?: number
  isAutoKg?: boolean
}

type PotonganItem = {
  id: string
  deskripsi: string
  total: number
  keterangan?: string
  tanggal?: string
}

type GajianHistoryItem = {
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

type GajianWithDetails = Gajian & {
  kebun: KebunEntity
  detailGajian: DetailGajianWithRelations[]
  biayaLain: (BiayaLainGajian & { keterangan?: string | null })[]
  potongan: (PotonganGajian & { keterangan?: string | null })[]
  detailKaryawan: (DetailGajianKaryawan & { user: User })[]
}

export default function GajianTab({ kebunId }: { kebunId: number }) {
  const { year, month: monthIndex } = getCurrentWIBDateParts()
  const month = monthIndex + 1
  const monthKey = String(month).padStart(2, '0')
  const endDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const defaultStart = `${year}-${monthKey}-01`
  const defaultEnd = `${year}-${monthKey}-${String(endDay).padStart(2, '0')}`
  const defaultHistoryStart = `${year}-01-01`
  const defaultHistoryEnd = `${year}-12-31`

  const [startDate, setStartDate] = useState(defaultStart)
  const [endDate, setEndDate] = useState(defaultEnd)
  const [historyStartDate, setHistoryStartDate] = useState(defaultHistoryStart)
  const [historyEndDate, setHistoryEndDate] = useState(defaultHistoryEnd)

  const [unpaidList, setUnpaidList] = useState<UnpaidKaryawan[]>([])
  const [biayaLain, setBiayaLain] = useState<BiayaLainItem[]>([])
  const [potonganList, setPotonganList] = useState<PotonganItem[]>([])
  const [editingPotonganId, setEditingPotonganId] = useState<string | null>(null)
  const [savedPotonganIds, setSavedPotonganIds] = useState<Record<string, true>>({})
  const [notaSawitCount, setNotaSawitCount] = useState(0)
  const [notaSawitTotalKg, setNotaSawitTotalKg] = useState(0)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyPerView, setHistoryPerView] = useState(10)
  const [historyPage, setHistoryPage] = useState(1)
  const [drafts, setDrafts] = useState<GajianHistoryItem[]>([])
  const [finalized, setFinalized] = useState<GajianHistoryItem[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [selectedGajian, setSelectedGajian] = useState<GajianWithDetails | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const formatCurrency = useCallback(
    (num: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num),
    [],
  )
  const formatNumber = useCallback((num: number, maxFractionDigits = 0) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: maxFractionDigits }).format(num), [])

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

  const handleDeleteSavedPotongan = useCallback(
    async (itemId: string) => {
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
    },
    [kebunId, startDate, endDate],
  )

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

  const handleOpenDetail = useCallback(async (id: number) => {
    setDetailLoading(true)
    try {
      const response = await fetch(`/api/gajian/${id}`)
      if (!response.ok) throw new Error('Gagal mengambil detail gajian')
      const data = await response.json()
      setSelectedGajian(data)
      setIsDetailOpen(true)
    } catch {
      toast.error('Gagal mengambil detail gajian.')
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const handleCloseDetail = () => {
    setIsDetailOpen(false)
    setSelectedGajian(null)
  }

  useEffect(() => {
    fetchPreview()
    fetchHistory()
  }, [])

  const totalGajiUnpaid = useMemo(() => unpaidList.reduce((acc, curr) => acc + (Number(curr.total) || 0), 0), [unpaidList])
  const totalBiayaLain = useMemo(() => biayaLain.reduce((acc, curr) => acc + (Number(curr.total) || 0), 0), [biayaLain])
  const totalPotongan = useMemo(() => potonganList.reduce((acc, curr) => acc + (Number(curr.total) || 0), 0), [potonganList])
  const totalPengajuan = totalGajiUnpaid + totalBiayaLain - totalPotongan

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
      fetchHistory()
      fetchPreview()
    } catch (e: any) {
      toast.error(e?.message || 'Gagal mengajukan gajian')
    } finally {
      setIsSubmitting(false)
      setIsConfirmOpen(false)
    }
  }, [biayaLain, kebunId, fetchHistory, fetchPreview, startDate, endDate, unpaidList, potonganList])

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-end gap-4 justify-between">
          <div>
            <h2 className="text-lg md:text-xl font-bold text-gray-900 capitalize">Preview Pengajuan Gajian</h2>
            <p className="text-xs md:text-sm text-gray-500">Hitung gaji yang belum dibayar dan biaya lain sebelum diajukan.</p>
          </div>
          <div className="w-full lg:hidden">
            <div className="grid grid-cols-2 gap-3 items-end">
              <div className="space-y-1 col-span-1">
                <Label>Mulai</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-10 w-full bg-white !rounded-full pr-10" />
              </div>
              <div className="space-y-1 col-span-1">
                <Label>Selesai</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-10 w-full bg-white !rounded-full pr-10" />
              </div>
              <Button onClick={fetchPreview} variant="outline" className="rounded-full h-10 w-full whitespace-nowrap col-span-1">
                Refresh
              </Button>
              <Button
                onClick={() => setIsConfirmOpen(true)}
                disabled={isSubmitting}
                className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white h-10 w-full whitespace-nowrap col-span-1"
              >
                {isSubmitting ? 'Mengajukan...' : 'Ajukan Gajian'}
              </Button>
            </div>
          </div>

          <div className="hidden lg:flex items-end gap-3">
            <div className="space-y-1">
              <Label>Mulai</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-10 bg-white !rounded-full pr-10" />
            </div>
            <div className="space-y-1">
              <Label>Selesai</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-10 bg-white !rounded-full pr-10" />
            </div>
            <Button onClick={fetchPreview} variant="outline" className="rounded-full h-10 whitespace-nowrap">
              Refresh
            </Button>
            <Button onClick={() => setIsConfirmOpen(true)} disabled={isSubmitting} className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white h-10 whitespace-nowrap">
              {isSubmitting ? 'Mengajukan...' : 'Ajukan Gajian'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
            <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Total Gaji Belum Dibayar</div>
            <div className="text-xl sm:text-2xl font-bold text-emerald-900 mt-2 leading-tight break-words">{formatCurrency(totalGajiUnpaid)}</div>
          </div>
          <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100">
            <div className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Total Biaya Lain</div>
            <div className="text-xl sm:text-2xl font-bold text-blue-900 mt-2 leading-tight break-words">{formatCurrency(totalBiayaLain)}</div>
          </div>
          <div className="p-4 rounded-2xl bg-white border border-gray-100">
            <div className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Total Nota Sawit Belum Digaji</div>
            <div className="text-xl sm:text-2xl font-bold text-gray-900 mt-2 leading-tight">
              {formatNumber(notaSawitCount)} <span className="text-base font-semibold text-gray-500">| {formatNumber(Math.round(notaSawitTotalKg || 0))} kg</span>
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-gray-900 text-white">
            <div className="text-xs font-semibold uppercase tracking-wider">Total Pengajuan</div>
            <div className="text-xl sm:text-2xl font-bold mt-2 leading-tight break-words">{formatCurrency(totalPengajuan)}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="border border-gray-100 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 font-semibold text-gray-700 text-sm">Detail Gaji Karyawan (Belum Dibayar)</div>
            <div className="md:hidden space-y-3 p-4">
              {previewLoading ? (
                <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center text-sm text-gray-400">Memuat...</div>
              ) : unpaidList.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center text-sm text-gray-500">Tidak ada gaji belum dibayar</div>
              ) : (
                unpaidList.map((u) => (
                  <div key={`unpaid-${u.karyawanId}`} className="rounded-2xl border border-gray-100 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-gray-900 truncate">{u.name}</div>
                      <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-700 px-2 py-0.5 text-[10px] font-bold whitespace-nowrap">
                        {Number(u.hariKerja || 0)} HK
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">Total</div>
                    <div className="font-semibold text-emerald-700">{formatCurrency(Number(u.total) || 0)}</div>
                  </div>
                ))
              )}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white">
                  <tr>
                    <th className="px-4 py-2 text-left text-gray-500 font-semibold">Karyawan</th>
                    <th className="px-4 py-2 text-right text-gray-500 font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {previewLoading ? (
                    <tr>
                      <td colSpan={2} className="px-4 py-6 text-center text-gray-400">
                        Memuat...
                      </td>
                    </tr>
                  ) : unpaidList.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="px-4 py-6 text-center text-gray-400">
                        Tidak ada gaji belum dibayar
                      </td>
                    </tr>
                  ) : (
                    unpaidList.map((u) => (
                      <tr key={u.karyawanId}>
                        <td className="px-4 py-2">
                          <div className="flex items-center justify-between gap-3">
                            <span className="truncate">{u.name}</span>
                            <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-700 px-2 py-0.5 text-[10px] font-bold whitespace-nowrap">
                              {Number(u.hariKerja || 0)} HK
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right font-semibold">{formatCurrency(Number(u.total) || 0)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="border border-gray-100 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 font-semibold text-gray-700 text-sm">Biaya Gaji & Borongan</div>
            <div className="md:hidden space-y-3 p-4">
              {previewLoading ? (
                <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center text-sm text-gray-400">Memuat...</div>
              ) : biayaLain.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center text-sm text-gray-500">Tidak ada biaya lain</div>
              ) : (
                biayaLain.map((b, idx) => (
                  <div key={`${b.deskripsi}-${idx}`} className="rounded-2xl border border-gray-100 bg-white p-4">
                    <div className="text-sm font-semibold text-gray-900">{b.deskripsi}</div>
                    {b.karyawan ? <div className="text-xs text-gray-500 mt-1 truncate">Karyawan: {b.karyawan}</div> : null}
                    {b.isAutoKg ? (
                      <div className="text-xs text-gray-500 mt-1">
                      {formatNumber(Number(b.jumlah || 0), 2)} {b.satuan || ''} x {formatCurrency(Number(b.hargaSatuan || 0))}
                    </div>
                    ) : null}
                    <div className="text-xs text-gray-400 mt-1">Total</div>
                    <div className="font-semibold text-blue-700">{formatCurrency(Number(b.total) || 0)}</div>
                  </div>
                ))
              )}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white">
                  <tr>
                    <th className="px-4 py-2 text-left text-gray-500 font-semibold">Deskripsi</th>
                    <th className="px-4 py-2 text-right text-gray-500 font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {previewLoading ? (
                    <tr>
                      <td colSpan={2} className="px-4 py-6 text-center text-gray-400">
                        Memuat...
                      </td>
                    </tr>
                  ) : biayaLain.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="px-4 py-6 text-center text-gray-400">
                        Tidak ada biaya lain
                      </td>
                    </tr>
                  ) : (
                    biayaLain.map((b, idx) => (
                      <tr key={`${b.deskripsi}-${idx}`}>
                        <td className="px-4 py-2">
                          <div className="font-medium text-gray-900">{b.deskripsi}</div>
                          {b.karyawan ? <div className="text-xs text-gray-500 truncate">Karyawan: {b.karyawan}</div> : null}
                          {b.isAutoKg ? (
                            <div className="text-xs text-gray-500">
                              {formatNumber(Number(b.jumlah || 0), 2)} {b.satuan || ''} x {formatCurrency(Number(b.hargaSatuan || 0))}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-2 text-right font-semibold">{formatCurrency(Number(b.total) || 0)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="border border-gray-100 rounded-2xl overflow-hidden lg:col-span-2">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 font-semibold text-gray-700 text-sm flex items-center justify-between gap-3">
              <span>Potongan</span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full h-8 text-xs"
                  onClick={() => {
                    const newId = `p-${Date.now()}`
                    setPotonganList((prev) => [...prev, { id: newId, deskripsi: '', total: 0, keterangan: '', tanggal: '' }])
                    setEditingPotonganId(newId)
                  }}
                >
                  + Tambah
                </Button>
              </div>
            </div>
            <div className="p-4 space-y-3">
              {potonganList.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center text-sm text-gray-500">Tidak ada potongan</div>
              ) : (
                potonganList.map((p) => (
                  <div key={p.id} className="rounded-2xl border border-gray-100 bg-white p-4 space-y-2">
                    {editingPotonganId === p.id ? (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs text-gray-600">Deskripsi</Label>
                            <Input
                              value={p.deskripsi}
                              onChange={(e) => setPotonganList((prev) => prev.map((x) => (x.id === p.id ? { ...x, deskripsi: e.target.value } : x)))}
                              className="h-10 rounded-full"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-gray-600">Total</Label>
                            <Input
                              inputMode="numeric"
                              value={formatNumber(Number(p.total || 0))}
                              onChange={(e) => {
                                const numericValue = Number(String(e.target.value || '').replace(/\D/g, '')) || 0
                                setPotonganList((prev) => prev.map((x) => (x.id === p.id ? { ...x, total: numericValue } : x)))
                              }}
                              className="h-10 rounded-full text-right"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs text-gray-600">Tanggal</Label>
                            <Input
                              type="date"
                              min={startDate}
                              max={endDate}
                              value={p.tanggal || ''}
                              onChange={(e) => setPotonganList((prev) => prev.map((x) => (x.id === p.id ? { ...x, tanggal: e.target.value } : x)))}
                              className="h-10 bg-white !rounded-md pr-10"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-gray-600">Keterangan</Label>
                            <Input
                              value={p.keterangan || ''}
                              onChange={(e) => setPotonganList((prev) => prev.map((x) => (x.id === p.id ? { ...x, keterangan: e.target.value } : x)))}
                              className="h-10 rounded-full"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" className="rounded-full" onClick={handleSavePotongan}>
                            Simpan
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="rounded-full"
                            onClick={() => {
                              setPotonganList((prev) => prev.filter((x) => x.id !== p.id))
                              setEditingPotonganId(null)
                            }}
                          >
                            Hapus
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="text-sm font-semibold text-gray-900 break-words">{p.deskripsi || '-'}</div>
                            {p.tanggal && <div className="text-xs text-gray-400">{format(new Date(p.tanggal), 'dd MMM yyyy', { locale: localeId })}</div>}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 rounded-full text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                              onClick={() => setEditingPotonganId(p.id)}
                            >
                              <PencilSquareIcon className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 rounded-full text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => {
                                if (savedPotonganIds[p.id]) {
                                  handleDeleteSavedPotongan(p.id)
                                } else {
                                  setPotonganList((prev) => prev.filter((x) => x.id !== p.id))
                                  setEditingPotonganId((prev) => (prev === p.id ? null : prev))
                                }
                              }}
                            >
                              <TrashIcon className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">Total</span>
                          <span className="font-semibold text-gray-900">{formatCurrency(Number(p.total || 0))}</span>
                        </div>
                        {p.keterangan ? <div className="text-xs text-gray-500">{p.keterangan}</div> : null}
                      </div>
                    )}
                  </div>
                ))
              )}
              {potonganList.length > 0 && (
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-700">Total Potongan</span>
                    <span className="font-semibold text-red-600">-{formatCurrency(totalPotongan)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-end gap-4 justify-between">
          <div>
            <h2 className="text-lg md:text-xl font-bold text-gray-900 capitalize">Riwayat Pengajuan Gajian</h2>
            <p className="text-xs md:text-sm text-gray-500">Lihat draft dan gajian final berdasarkan periode pembuatan.</p>
          </div>
          <div className="flex flex-col sm:flex-row items-end gap-3">
            <div className="space-y-1 w-full sm:w-auto">
              <Label>Mulai</Label>
              <Input type="date" value={historyStartDate} onChange={(e) => setHistoryStartDate(e.target.value)} className="h-10 w-full sm:w-auto bg-white !rounded-full pr-10" />
            </div>
            <div className="space-y-1 w-full sm:w-auto">
              <Label>Selesai</Label>
              <Input type="date" value={historyEndDate} onChange={(e) => setHistoryEndDate(e.target.value)} className="h-10 w-full sm:w-auto bg-white !rounded-full pr-10" />
            </div>
            <Button onClick={fetchHistory} variant="outline" className="rounded-full h-10 w-full sm:w-auto">
              Terapkan
            </Button>
          </div>
        </div>

        <div className="md:hidden space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-gray-500">
              Menampilkan {historyItems.length === 0 ? 0 : historyStartIndex + 1} - {Math.min(historyStartIndex + historyPerView, historyItems.length)} dari {historyItems.length}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Per View</span>
              <select
                className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={historyPerView}
                onChange={(e) => setHistoryPerView(Number(e.target.value))}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
          {historyLoading ? (
            <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center text-sm text-gray-400">Memuat riwayat...</div>
          ) : historyItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center text-sm text-gray-500">Belum ada riwayat gajian</div>
          ) : (
            pagedHistoryItems.map((g) => (
              <div key={`history-${g.id}`} className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-xs text-gray-400">Periode</div>
                    <div className="font-semibold text-gray-900">
                      {format(new Date(g.tanggalMulai), 'dd MMM yyyy', { locale: localeId })} - {format(new Date(g.tanggalSelesai), 'dd MMM yyyy', { locale: localeId })}
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${g.status === 'FINALIZED' ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {g.status === 'FINALIZED' ? 'FINAL' : 'DRAFT'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-gray-400">Gaji Harian</div>
                    <div className="font-semibold text-gray-900">{formatCurrency(Number((g as any).totalGajiHarian) || 0)}</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Total Gajian</div>
                    <div className="font-semibold text-gray-900">{formatCurrency(Number((g as any).totalJumlahGaji) || 0)}</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Potongan</div>
                    <div className="font-semibold text-red-600">-{formatCurrency(Number(g.totalPotongan) || 0)}</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Gaji Bersih</div>
                    <div className="font-semibold text-gray-900">{formatCurrency(Number(g.totalGaji) || 0)}</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Dibuat</div>
                    <div className="font-medium text-gray-700">{format(new Date(g.createdAt), 'dd MMM yyyy', { locale: localeId })}</div>
                  </div>
                </div>
                <div className="pt-2 flex justify-end">
                  <Button size="sm" variant="outline" className="rounded-full" onClick={() => handleOpenDetail(g.id)}>
                    Detail
                  </Button>
                </div>
              </div>
            ))
          )}
          {!historyLoading && historyItems.length > 0 && (
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" className="rounded-full" disabled={historyPage <= 1} onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}>
                Sebelumnya
              </Button>
              <span className="text-xs text-gray-600">
                Halaman {historyPage} / {historyTotalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                disabled={historyPage >= historyTotalPages}
                onClick={() => setHistoryPage((p) => Math.min(historyTotalPages, p + 1))}
              >
                Berikutnya
              </Button>
            </div>
          )}
        </div>

        <div className="hidden md:block overflow-x-auto rounded-2xl border border-gray-100">
          <div className="flex items-center justify-between gap-2 p-3 border-b border-gray-100 bg-white">
            <div className="text-xs text-gray-500">
              Menampilkan {historyItems.length === 0 ? 0 : historyStartIndex + 1} - {Math.min(historyStartIndex + historyPerView, historyItems.length)} dari {historyItems.length}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Per View</span>
              <select
                className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={historyPerView}
                onChange={(e) => setHistoryPerView(Number(e.target.value))}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Periode</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Status</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Gaji Harian</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Total Gajian</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Potongan</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Gaji Bersih</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Dibuat</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {historyLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    Memuat riwayat...
                  </td>
                </tr>
              ) : historyItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    Belum ada riwayat gajian
                  </td>
                </tr>
              ) : (
                pagedHistoryItems.map((g) => (
                  <tr key={g.id}>
                    <td className="px-4 py-3">
                      {format(new Date(g.tanggalMulai), 'dd MMM yyyy', { locale: localeId })} - {format(new Date(g.tanggalSelesai), 'dd MMM yyyy', { locale: localeId })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${g.status === 'FINALIZED' ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {g.status === 'FINALIZED' ? 'FINAL' : 'DRAFT'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{formatCurrency(Number((g as any).totalGajiHarian) || 0)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatCurrency(Number((g as any).totalJumlahGaji) || 0)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-red-600">-{formatCurrency(Number(g.totalPotongan) || 0)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatCurrency(Number(g.totalGaji) || 0)}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{format(new Date(g.createdAt), 'dd MMM yyyy', { locale: localeId })}</td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="outline" className="rounded-full" onClick={() => handleOpenDetail(g.id)}>
                        Detail
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {!historyLoading && historyItems.length > 0 && (
            <div className="flex items-center justify-end gap-2 p-3 border-t border-gray-100 bg-white">
              <Button variant="outline" size="sm" className="rounded-full" disabled={historyPage <= 1} onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}>
                Sebelumnya
              </Button>
              <span className="text-xs text-gray-600">
                Halaman {historyPage} / {historyTotalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                disabled={historyPage >= historyTotalPages}
                onClick={() => setHistoryPage((p) => Math.min(historyTotalPages, p + 1))}
              >
                Berikutnya
              </Button>
            </div>
          )}
        </div>
        <DetailGajianModal isOpen={isDetailOpen} onClose={handleCloseDetail} gajian={selectedGajian} isLoading={detailLoading} showApprovalFields={true} />
      </div>

      <ConfirmationModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleSubmit}
        title="Konfirmasi Ajukan Gajian"
        description={`Ajukan gajian periode ${format(new Date(`${startDate}T00:00:00+07:00`), 'dd MMM yyyy', { locale: localeId })} - ${format(new Date(`${endDate}T00:00:00+07:00`), 'dd MMM yyyy', { locale: localeId })}?`}
        variant="emerald"
      />
    </div>
  )
}
