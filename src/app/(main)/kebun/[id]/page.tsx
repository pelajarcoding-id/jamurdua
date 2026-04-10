'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { formatKebunText } from '../columns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import ActivityTab from '../ActivityTab'
import PermintaanTab from '../PermintaanTab'
import AbsensiTab from '../AbsensiTab'
import PanenTab from '../PanenTab'
import InventoryTab from '../InventoryTab'
import { ArrowLeftIcon, BanknotesIcon, CalendarIcon, ClipboardDocumentListIcon, CubeIcon, MapPinIcon, ShoppingCartIcon, TrashIcon, PencilSquareIcon } from '@heroicons/react/24/outline'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import { DetailGajianModal } from '../../gajian/detail-modal'
import type { Gajian, Kebun as KebunEntity, DetailGajian, NotaSawit, Timbangan, User, BiayaLainGajian, PotonganGajian, Kendaraan, DetailGajianKaryawan } from '@prisma/client'

type Kebun = {
  id: number
  name: string
  location: string | null
  createdAt: string
}

type UnpaidKaryawan = {
  karyawanId: number
  name: string
  total: number
}

type BiayaLainItem = {
  deskripsi: string
  total: number
}

type PotonganItem = {
  id: string
  deskripsi: string
  total: number
  keterangan?: string
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

function GajianTab({ kebunId }: { kebunId: number }) {
  const now = new Date()
  const defaultStart = format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM-dd')
  const defaultEnd = format(new Date(now.getFullYear(), now.getMonth() + 1, 0), 'yyyy-MM-dd')
  const defaultHistoryStart = format(new Date(now.getFullYear(), 0, 1), 'yyyy-MM-dd')
  const defaultHistoryEnd = format(new Date(now.getFullYear(), 11, 31), 'yyyy-MM-dd')

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
  const [previewLoading, setPreviewLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [drafts, setDrafts] = useState<GajianHistoryItem[]>([])
  const [finalized, setFinalized] = useState<GajianHistoryItem[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [selectedGajian, setSelectedGajian] = useState<GajianWithDetails | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const formatCurrency = useCallback((num: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num), [])
  const formatNumber = useCallback((num: number) => new Intl.NumberFormat('id-ID').format(num), [])

  const handleSavePotongan = useCallback(async () => {
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
  const historyItems = useMemo(() => {
    return [...drafts, ...finalized].sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
  }, [drafts, finalized])

  const fetchPreview = useCallback(async () => {
    setPreviewLoading(true)
    try {
      const startISO = new Date(startDate).toISOString()
      const endISO = new Date(endDate).toISOString()

      const [unpaidRes, actRes, notaRes, potonganRes] = await Promise.all([
        fetch(`/api/karyawan-kebun/absensi?kebunId=${kebunId}&startDate=${startISO}&endDate=${endISO}&unpaid=1`, { cache: 'no-store' }),
        fetch(`/api/kebun/${kebunId}/pekerjaan?startDate=${startISO}&endDate=${endISO}&unpaid=1`),
        fetch(`/api/nota-sawit/summary?kebunId=${kebunId}&startDate=${startISO}&endDate=${endISO}`, { cache: 'no-store' }),
        fetch(`/api/kebun/${kebunId}/gajian-potongan-draft?startDate=${startDate}&endDate=${endDate}`, { cache: 'no-store' }),
      ])

      if (unpaidRes.ok) {
        const json = await unpaidRes.json()
        setUnpaidList(Array.isArray(json.data) ? json.data : [])
      } else {
        setUnpaidList([])
      }

      if (actRes.ok) {
        const activities = await actRes.json()
        const groupedActivities = activities.reduce((acc: Record<string, number>, curr: any) => {
          if (!curr?.upahBorongan) return acc
          const type = curr.jenisPekerjaan || 'Lainnya'
          if (!acc[type]) acc[type] = 0
          acc[type] += curr.biaya
          return acc
        }, {})
        const mapped: BiayaLainItem[] = Object.entries(groupedActivities)
          .map(([deskripsi, total]) => ({
            deskripsi: `Upah Borongan - ${deskripsi}`,
            total: Number(total) || 0,
          }))
          .filter(item => item.total > 0)
        setBiayaLain(mapped)
      } else {
        setBiayaLain([])
      }

      if (notaRes.ok) {
        const json = await notaRes.json().catch(() => ({} as any))
        setNotaSawitCount(Number(json?.count || 0))
      } else {
        setNotaSawitCount(0)
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
        params.set('startDate', new Date(historyStartDate).toISOString())
        params.set('endDate', new Date(historyEndDate).toISOString())
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
      const startISO = new Date(startDate).toISOString()
      const endISO = new Date(endDate).toISOString()

      const detailKaryawan = unpaidList
        .filter(u => Number(u.total) > 0)
        .map(u => ({
          userId: u.karyawanId,
          hariKerja: 0,
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
        tanggalMulai: startISO,
        tanggalSelesai: endISO,
        detailKaryawan,
        biayaLain,
        potongan: potonganList
          .map((p) => ({
            deskripsi: String(p.deskripsi || '').trim(),
            total: Math.round(Number(p.total || 0)),
            keterangan: p.keterangan || undefined,
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
          <div className="flex flex-col sm:flex-row items-end gap-3">
            <div className="space-y-1 w-full sm:w-auto">
              <Label>Mulai</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="rounded-full h-10 w-full sm:w-auto" />
            </div>
            <div className="space-y-1 w-full sm:w-auto">
              <Label>Selesai</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="rounded-full h-10 w-full sm:w-auto" />
            </div>
            <Button onClick={fetchPreview} variant="outline" className="rounded-full h-10 w-full sm:w-auto">Refresh</Button>
            <Button onClick={() => setIsConfirmOpen(true)} disabled={isSubmitting} className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white h-10 w-full sm:w-auto">
              {isSubmitting ? 'Mengajukan...' : 'Ajukan Gajian'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
            <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Total Gaji Belum Dibayar</div>
            <div className="text-2xl font-bold text-emerald-900 mt-2">{formatCurrency(totalGajiUnpaid)}</div>
          </div>
          <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100">
            <div className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Total Biaya Lain</div>
            <div className="text-2xl font-bold text-blue-900 mt-2">{formatCurrency(totalBiayaLain)}</div>
          </div>
          <div className="p-4 rounded-2xl bg-white border border-gray-100">
            <div className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Total Nota Sawit</div>
            <div className="text-2xl font-bold text-gray-900 mt-2">{formatNumber(notaSawitCount)}</div>
          </div>
          <div className="p-4 rounded-2xl bg-gray-900 text-white">
            <div className="text-xs font-semibold uppercase tracking-wider">Total Pengajuan</div>
            <div className="text-2xl font-bold mt-2">{formatCurrency(totalPengajuan)}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="border border-gray-100 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 font-semibold text-gray-700 text-sm">
              Detail Gaji Karyawan (Belum Dibayar)
            </div>
            <div className="md:hidden space-y-3 p-4">
              {previewLoading ? (
                <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center text-sm text-gray-400">
                  Memuat...
                </div>
              ) : unpaidList.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center text-sm text-gray-500">
                  Tidak ada gaji belum dibayar
                </div>
              ) : (
                unpaidList.map((u) => (
                  <div key={`unpaid-${u.karyawanId}`} className="rounded-2xl border border-gray-100 bg-white p-4">
                    <div className="text-sm font-semibold text-gray-900">{u.name}</div>
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
                    <tr><td colSpan={2} className="px-4 py-6 text-center text-gray-400">Memuat...</td></tr>
                  ) : unpaidList.length === 0 ? (
                    <tr><td colSpan={2} className="px-4 py-6 text-center text-gray-400">Tidak ada gaji belum dibayar</td></tr>
                  ) : (
                    unpaidList.map((u) => (
                      <tr key={u.karyawanId}>
                        <td className="px-4 py-2">{u.name}</td>
                        <td className="px-4 py-2 text-right font-semibold">{formatCurrency(Number(u.total) || 0)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="border border-gray-100 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 font-semibold text-gray-700 text-sm">
              Biaya Lain (Aktivitas Kebun)
            </div>
            <div className="md:hidden space-y-3 p-4">
              {previewLoading ? (
                <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center text-sm text-gray-400">
                  Memuat...
                </div>
              ) : biayaLain.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center text-sm text-gray-500">
                  Tidak ada biaya lain
                </div>
              ) : (
                biayaLain.map((b, idx) => (
                  <div key={`${b.deskripsi}-${idx}`} className="rounded-2xl border border-gray-100 bg-white p-4">
                    <div className="text-sm font-semibold text-gray-900">{b.deskripsi}</div>
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
                    <tr><td colSpan={2} className="px-4 py-6 text-center text-gray-400">Memuat...</td></tr>
                  ) : biayaLain.length === 0 ? (
                    <tr><td colSpan={2} className="px-4 py-6 text-center text-gray-400">Tidak ada biaya lain</td></tr>
                  ) : (
                    biayaLain.map((b, idx) => (
                      <tr key={`${b.deskripsi}-${idx}`}>
                        <td className="px-4 py-2">{b.deskripsi}</td>
                        <td className="px-4 py-2 text-right font-semibold">{formatCurrency(Number(b.total) || 0)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="border border-gray-100 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 font-semibold text-gray-700 text-sm flex items-center justify-between gap-3">
              <span>Potongan</span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => {
                    const newId = `p-${Date.now()}`
                    setPotonganList(prev => [...prev, { id: newId, deskripsi: '', total: 0, keterangan: '' }])
                    setEditingPotonganId(newId)
                  }}
                >
                  + Tambah
                </Button>
              </div>
            </div>
            <div className="p-4 space-y-3">
              {potonganList.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center text-sm text-gray-500">
                  Tidak ada potongan
                </div>
              ) : (
                potonganList.map((p) => (
                  <div key={p.id} className="rounded-2xl border border-gray-100 bg-white p-4 space-y-2">
                    {editingPotonganId === p.id ? (
                      <>
                        <Input
                          placeholder="Deskripsi"
                          value={p.deskripsi}
                          onChange={(e) => setPotonganList(prev => prev.map(x => x.id === p.id ? { ...x, deskripsi: e.target.value } : x))}
                          className="h-10 rounded-full"
                        />
                        <Input
                          placeholder="Total"
                          inputMode="numeric"
                          value={formatNumber(Number(p.total || 0))}
                          onChange={(e) => {
                            const numericValue = Number(String(e.target.value || '').replace(/\D/g, '')) || 0
                            setPotonganList(prev => prev.map(x => x.id === p.id ? { ...x, total: numericValue } : x))
                          }}
                          className="h-10 rounded-full text-right"
                        />
                        <Input
                          placeholder="Keterangan (opsional)"
                          value={p.keterangan || ''}
                          onChange={(e) => setPotonganList(prev => prev.map(x => x.id === p.id ? { ...x, keterangan: e.target.value } : x))}
                          className="h-10 rounded-full"
                        />
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-full"
                            onClick={handleSavePotongan}
                          >
                            Simpan
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="rounded-full"
                            onClick={() => {
                              setPotonganList(prev => prev.filter(x => x.id !== p.id))
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
                          <div className="text-sm font-semibold text-gray-900 break-words">{p.deskripsi || '-'}</div>
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
              <Input type="date" value={historyStartDate} onChange={e => setHistoryStartDate(e.target.value)} className="rounded-full h-10 w-full sm:w-auto" />
            </div>
            <div className="space-y-1 w-full sm:w-auto">
              <Label>Selesai</Label>
              <Input type="date" value={historyEndDate} onChange={e => setHistoryEndDate(e.target.value)} className="rounded-full h-10 w-full sm:w-auto" />
            </div>
            <Button onClick={fetchHistory} variant="outline" className="rounded-full h-10 w-full sm:w-auto">Terapkan</Button>
          </div>
        </div>

        <div className="md:hidden space-y-3">
          {historyLoading ? (
            <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center text-sm text-gray-400">
              Memuat riwayat...
            </div>
          ) : historyItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center text-sm text-gray-500">
              Belum ada riwayat gajian
            </div>
          ) : (
            historyItems.map((g) => (
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
                    <div className="text-gray-400">Total Gaji</div>
                    <div className="font-semibold text-gray-900">{formatCurrency(Number(g.totalBiayaLain) || 0)}</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Potongan</div>
                    <div className="font-semibold text-red-600">-{formatCurrency(Number(g.totalPotongan) || 0)}</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Jumlah Gaji</div>
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
        </div>

        <div className="hidden md:block overflow-x-auto rounded-2xl border border-gray-100">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Periode</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Status</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Total Gaji</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Potongan</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Jumlah Gaji</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Dibuat</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {historyLoading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Memuat riwayat...</td></tr>
              ) : historyItems.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Belum ada riwayat gajian</td></tr>
              ) : (
                historyItems.map((g) => (
                  <tr key={g.id}>
                    <td className="px-4 py-3">
                      {format(new Date(g.tanggalMulai), 'dd MMM yyyy', { locale: localeId })} - {format(new Date(g.tanggalSelesai), 'dd MMM yyyy', { locale: localeId })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${g.status === 'FINALIZED' ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {g.status === 'FINALIZED' ? 'FINAL' : 'DRAFT'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{formatCurrency(Number(g.totalBiayaLain) || 0)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-red-600">-{formatCurrency(Number(g.totalPotongan) || 0)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatCurrency(Number(g.totalGaji) || 0)}</td>
                    <td className="px-4 py-3 text-right text-gray-500">
                      {format(new Date(g.createdAt), 'dd MMM yyyy', { locale: localeId })}
                    </td>
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
        </div>
        <DetailGajianModal
          isOpen={isDetailOpen}
          onClose={handleCloseDetail}
          gajian={selectedGajian}
          isLoading={detailLoading}
          showApprovalFields={true}
        />
      </div>

      <ConfirmationModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleSubmit}
        title="Konfirmasi Ajukan Gajian"
        description={`Ajukan gajian periode ${format(new Date(startDate), 'dd MMM yyyy', { locale: localeId })} - ${format(new Date(endDate), 'dd MMM yyyy', { locale: localeId })}?`}
        variant="emerald"
      />
    </div>
  )
}

export default function KebunDetailPage() {
  const params = useParams()
  const kebunId = Number(params.id)
  
  const [kebun, setKebun] = useState<Kebun | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchKebun()
  }, [])

  const fetchKebun = async () => {
    try {
      const res = await fetch(`/api/kebun/${kebunId}`)
      if (res.ok) {
        const data = await res.json()
        setKebun(data)
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 py-4">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-56" />
            </div>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex gap-2 overflow-x-auto">
          {[1,2,3,4,5].map(i => (
            <Skeleton key={i} className="h-10 w-32 rounded-2xl" />
          ))}
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[1,2,3].map(i => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-6 w-40" />
          <div className="space-y-3">
            {[1,2,3,4].map(i => (
              <Skeleton key={i} className="h-12 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
  if (!kebun) return <div className="p-8 text-center text-gray-500">Kebun tidak ditemukan</div>

  return (
    <div className="min-h-screen bg-gray-50/50 pb-12">
      {/* Header Section */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10 backdrop-blur-xl bg-white/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-4 py-4">
                <Link href="/kebun">
                <Button variant="ghost" size="icon" className="rounded-full hover:bg-gray-100 -ml-2">
                    <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
                </Button>
                </Link>
                <div>
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-gray-900">{formatKebunText(kebun.name)}</h1>
                <div className="flex items-center gap-1.5 text-sm text-gray-500 mt-0.5">
                    <MapPinIcon className="w-3.5 h-3.5" />
                    {kebun.location ? formatKebunText(kebun.location) : 'Lokasi belum diatur'}
                </div>
                </div>
            </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="activity" className="w-full space-y-8">
            <div className="w-full overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide">
              <TabsList className="w-max min-w-full justify-start h-12 rounded-2xl bg-gray-50 border border-gray-100 p-1 gap-1">
                <TabsTrigger value="activity" className="rounded-xl px-4 h-10 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  <ClipboardDocumentListIcon className="h-4 w-4 mr-2" />
                  Aktivitas
                </TabsTrigger>
                <TabsTrigger value="permintaan" className="rounded-xl px-4 h-10 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  <ShoppingCartIcon className="h-4 w-4 mr-2" />
                  Permintaan
                </TabsTrigger>
                <TabsTrigger value="inventory" className="rounded-xl px-4 h-10 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  <CubeIcon className="h-4 w-4 mr-2" />
                  Inventory
                </TabsTrigger>
                <TabsTrigger value="absensi" className="rounded-xl px-4 h-10 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  <BanknotesIcon className="h-4 w-4 mr-2" />
                  Absensi & Gaji
                </TabsTrigger>
                <TabsTrigger value="panen" className="rounded-xl px-4 h-10 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  Panen
                </TabsTrigger>
                <TabsTrigger value="gajian" className="rounded-xl px-4 h-10 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  <BanknotesIcon className="h-4 w-4 mr-2" />
                  Pengajuan Gajian
                </TabsTrigger>
              </TabsList>
            </div>
            
            <TabsContent value="activity" className="mt-0 focus-visible:outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
                <ActivityTab kebunId={kebunId} />
            </TabsContent>

            <TabsContent value="permintaan" className="mt-0 focus-visible:outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
                <PermintaanTab kebunId={kebunId} />
            </TabsContent>

            <TabsContent value="inventory" className="mt-0 focus-visible:outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
                <InventoryTab kebunId={kebunId} />
            </TabsContent>

            <TabsContent value="absensi" className="mt-0 focus-visible:outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
                <AbsensiTab kebunId={kebunId} />
            </TabsContent>
            
            <TabsContent value="panen" className="mt-0 focus-visible:outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
                <PanenTab kebunId={kebunId} />
            </TabsContent>
            
            <TabsContent value="gajian" className="mt-0 focus-visible:outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
                <GajianTab kebunId={kebunId} />
            </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
