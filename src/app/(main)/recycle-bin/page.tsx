'use client'

import { useEffect, useMemo, useState } from 'react'
import RoleGate from '@/components/RoleGate'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import toast from 'react-hot-toast'
import {
  ArrowPathIcon,
  ArrowUturnLeftIcon,
  BanknotesIcon,
  ClipboardDocumentListIcon,
  CubeIcon,
  DocumentArrowDownIcon,
  EyeIcon,
  TrashIcon,
  TruckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { format } from 'date-fns'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount || 0)
}

type RecycleKasir = {
  id: number
  date: string
  tipe: string
  deskripsi: string
  jumlah: number
  kategori: string | null
  gambarUrl: string | null
  deletedAt: string
  deletedById: number | null
  deletedBy?: { id: number; name: string } | null
  deletedByName?: string | null
}

type RecycleNota = {
  id: number
  tanggalBongkar: string | null
  totalPembayaran: number
  statusPembayaran: string
  kendaraanPlatNomor: string | null
  gambarNotaUrl: string | null
  deletedAt: string
  deletedById: number | null
  deletedBy?: { id: number; name: string } | null
  deletedByName?: string | null
  supir: { id: number; name: string } | null
  pabrikSawit: { id: number; name: string } | null
}

type RecycleInventory = {
  id: number
  sku: string
  name: string
  unit: string
  category: string | null
  stock: number
  imageUrl: string | null
  deletedAt: string
  deletedById: number | null
  deletedBy?: { id: number; name: string } | null
  deletedByName?: string | null
}

type RecycleSesiUangJalan = {
  id: number
  tanggalMulai: string
  status: string
  keterangan: string | null
  kendaraanPlatNomor: string | null
  deletedAt: string
  deletedById: number | null
  deletedBy?: { id: number; name: string } | null
  deletedByName?: string | null
  supir: { id: number; name: string }
}

type PendingDeletion = {
  id: number
  url: string
  key: string | null
  driver: string
  entity: string | null
  entityId: string | null
  reason: string | null
  deleteAt: string
  createdAt: string
}

export default function RecycleBinPage() {
  const [loadingRecycle, setLoadingRecycle] = useState(true)
  const [loadingFiles, setLoadingFiles] = useState(true)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [processingFiles, setProcessingFiles] = useState(false)
  const [deletingFileId, setDeletingFileId] = useState<number | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailEntity, setDetailEntity] = useState<'KASIR' | 'NOTA_SAWIT' | 'INVENTORY_ITEM' | 'SESI_UANG_JALAN' | null>(null)
  const [detailData, setDetailData] = useState<any>(null)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [filePreviewOpen, setFilePreviewOpen] = useState(false)
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null)
  const [filePreviewError, setFilePreviewError] = useState(false)

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [confirmDeleteData, setConfirmDeleteData] = useState<{ entity: string; id: number; label?: string } | null>(null)

  const [kasir, setKasir] = useState<RecycleKasir[]>([])
  const [notaSawit, setNotaSawit] = useState<RecycleNota[]>([])
  const [inventory, setInventory] = useState<RecycleInventory[]>([])
  const [sesiUangJalan, setSesiUangJalan] = useState<RecycleSesiUangJalan[]>([])

  const [pendingFiles, setPendingFiles] = useState<PendingDeletion[]>([])
  const [pendingDueCount, setPendingDueCount] = useState(0)

  const counts = useMemo(() => {
    return {
      kasir: kasir.length,
      nota: notaSawit.length,
      inventory: inventory.length,
      uangJalan: sesiUangJalan.length,
      pendingFiles: pendingFiles.length,
    }
  }, [kasir, notaSawit, inventory, sesiUangJalan, pendingFiles])

  const fetchRecycle = async () => {
    setLoadingRecycle(true)
    try {
      const res = await fetch('/api/recycle-bin', { cache: 'no-store' })
      if (!res.ok) throw new Error('Gagal mengambil data Recycle Bin')
      const json = await res.json()
      setKasir(json.kasir || [])
      setNotaSawit(json.notaSawit || [])
      setInventory(json.inventory || [])
      setSesiUangJalan(json.sesiUangJalan || [])
    } catch (e: any) {
      toast.error(e.message || 'Gagal memuat Recycle Bin')
    } finally {
      setLoadingRecycle(false)
    }
  }

  const fetchPendingFiles = async () => {
    setLoadingFiles(true)
    try {
      const res = await fetch('/api/file-retention/pending?status=all&limit=200', { cache: 'no-store' })
      if (!res.ok) throw new Error('Gagal mengambil daftar file retention')
      const json = await res.json()
      setPendingFiles(json.data || [])
      setPendingDueCount(Number(json.dueCount || 0))
    } catch (e: any) {
      toast.error(e.message || 'Gagal memuat file retention')
    } finally {
      setLoadingFiles(false)
    }
  }

  useEffect(() => {
    fetchRecycle()
    fetchPendingFiles()
  }, [])

  const openDetail = (entity: 'KASIR' | 'NOTA_SAWIT' | 'INVENTORY_ITEM' | 'SESI_UANG_JALAN', data: any) => {
    setDetailEntity(entity)
    setDetailData(data)
    setDetailOpen(true)
  }

  const openFilePreview = (url: string) => {
    setFilePreviewUrl(url)
    setFilePreviewError(false)
    setFilePreviewOpen(true)
  }

  const exportDetailPdf = async () => {
    if (!detailEntity || !detailData) return
    try {
      setExportingPdf(true)
      const jsPDF = (await import('jspdf')).default
      const autoTable = (await import('jspdf-autotable')).default
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('DETAIL RECYCLE BIN', 14, 16)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(`Modul: ${detailEntity}`, 14, 23)
      doc.text(`ID: ${detailData?.id ?? '-'}`, 14, 28)
      doc.text(`Dihapus: ${detailData?.deletedAt ? format(new Date(detailData.deletedAt), 'dd/MM/yyyy HH:mm') : '-'}`, 14, 33)
      doc.text(`Dihapus Oleh: ${detailData?.deletedByName || detailData?.deletedBy?.name || (detailData?.deletedById != null ? `User #${detailData.deletedById}` : '-')}`, 14, 38)

      const rows: Array<[string, string]> = []
      rows.push(['Dihapus Oleh', detailData?.deletedByName || detailData?.deletedBy?.name || (detailData?.deletedById != null ? `User #${detailData.deletedById}` : '-')])

      if (detailEntity === 'KASIR') {
        rows.push(
          ['Tanggal', detailData?.date ? format(new Date(detailData.date), 'dd/MM/yyyy') : '-'],
          ['Tipe', String(detailData?.tipe ?? '-')],
          ['Kategori', String(detailData?.kategori ?? '-')],
          ['Deskripsi', String(detailData?.deskripsi ?? '-')],
          ['Jumlah', formatCurrency(Number(detailData?.jumlah || 0))],
          ['URL Bukti', String(detailData?.gambarUrl ?? '-')],
        )
      } else if (detailEntity === 'NOTA_SAWIT') {
        rows.push(
          ['Tanggal Bongkar', detailData?.tanggalBongkar ? format(new Date(detailData.tanggalBongkar), 'dd/MM/yyyy') : '-'],
          ['Pabrik', String(detailData?.pabrikSawit?.name ?? '-')],
          ['Supir', String(detailData?.supir?.name ?? '-')],
          ['Plat', String(detailData?.kendaraanPlatNomor ?? '-')],
          ['Status', String(detailData?.statusPembayaran ?? '-')],
          ['Total', formatCurrency(Number(detailData?.totalPembayaran || 0))],
          ['URL Bukti', String(detailData?.gambarNotaUrl ?? '-')],
        )
      } else if (detailEntity === 'INVENTORY_ITEM') {
        rows.push(
          ['SKU', String(detailData?.sku ?? '-')],
          ['Nama', String(detailData?.name ?? '-')],
          ['Kategori', String(detailData?.category ?? '-')],
          ['Stok', `${Number(detailData?.stock || 0)} ${String(detailData?.unit ?? '')}`.trim()],
          ['URL Foto', String(detailData?.imageUrl ?? '-')],
        )
      } else if (detailEntity === 'SESI_UANG_JALAN') {
        rows.push(
          ['Tanggal Mulai', detailData?.tanggalMulai ? format(new Date(detailData.tanggalMulai), 'dd/MM/yyyy') : '-'],
          ['Supir', String(detailData?.supir?.name ?? '-')],
          ['Status', String(detailData?.status ?? '-')],
          ['Plat', String(detailData?.kendaraanPlatNomor ?? '-')],
          ['Keterangan', String(detailData?.keterangan ?? '-')],
        )
      }

      autoTable(doc, {
        head: [['Field', 'Nilai']],
        body: rows,
        startY: 45,
        theme: 'grid',
        styles: { fontSize: 10, cellPadding: 3 },
        headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: { 0: { cellWidth: 48, fontStyle: 'bold' } },
      } as any)

      const safeEntity = detailEntity.toLowerCase()
      doc.save(`recycle-bin-${safeEntity}-${detailData?.id ?? 'detail'}.pdf`)
    } catch (e) {
      toast.error('Gagal download PDF')
    } finally {
      setExportingPdf(false)
    }
  }

  const restore = async (entity: string, id: number) => {
    const key = `${entity}:${id}`
    setRestoringId(key)
    try {
      const res = await fetch('/api/recycle-bin/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity, id }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Gagal restore data')
      toast.success('Berhasil restore')
      await fetchRecycle()
      await fetchPendingFiles()
    } catch (e: any) {
      toast.error(e.message || 'Gagal restore')
    } finally {
      setRestoringId(null)
    }
  }

  const deletePermanent = async (entity: string, id: number) => {
    const key = `${entity}:${id}`
    setDeletingId(key)
    try {
      const res = await fetch(`/api/recycle-bin/delete?entity=${entity}&id=${id}`, {
        method: 'DELETE',
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Gagal hapus permanen')
      toast.success('Berhasil hapus permanen')
      await fetchRecycle()
      setConfirmDeleteOpen(false)
      setConfirmDeleteData(null)
    } catch (e: any) {
      toast.error(e.message || 'Gagal hapus permanen')
    } finally {
      setDeletingId(null)
    }
  }

  const openConfirmDelete = (entity: string, id: number, label?: string) => {
    setConfirmDeleteData({ entity, id, label })
    setConfirmDeleteOpen(true)
  }

  const processFiles = async () => {
    if (!confirm('Proses penghapusan file sekarang? Ini akan menghapus file yang masa berlakunya sudah habis.')) return
    setProcessingFiles(true)
    try {
      const res = await fetch('/api/file-retention/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true, limit: 100 }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Gagal memproses file retention')
      toast.success(`Berhasil memproses ${json.processed} file. ${json.deletedCount} terhapus, ${json.skippedReferenced} dilewati karena masih dipakai.`)
      await fetchPendingFiles()
    } catch (e: any) {
      toast.error(e.message || 'Gagal memproses file retention')
    } finally {
      setProcessingFiles(false)
    }
  }

  const deleteFile = async (id: number) => {
    if (!confirm('Hapus file ini secara permanen?')) return
    setDeletingFileId(id)
    try {
      const res = await fetch(`/api/file-retention/delete?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Gagal menghapus file')
      toast.success('File terhapus')
      await fetchPendingFiles()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setDeletingFileId(null)
    }
  }

  return (
    <RoleGate allow={['ADMIN']}>
      <div className="p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Audit & Kepatuhan</h1>
            <p className="text-sm text-gray-500">Recycle Bin untuk restore, dan daftar file yang akan dihapus sesuai retensi.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { fetchRecycle(); fetchPendingFiles(); }} disabled={loadingRecycle || loadingFiles}>
              <ArrowPathIcon className={`w-4 h-4 mr-2 ${(loadingRecycle || loadingFiles) ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="rounded-2xl border bg-white p-4">
            <div className="text-xs text-gray-500 font-semibold uppercase">Kasir</div>
            <div className="text-2xl font-bold text-gray-900">{loadingRecycle ? <Skeleton className="h-8 w-16 mt-2" /> : counts.kasir}</div>
          </div>
          <div className="rounded-2xl border bg-white p-4">
            <div className="text-xs text-gray-500 font-semibold uppercase">Nota Sawit</div>
            <div className="text-2xl font-bold text-gray-900">{loadingRecycle ? <Skeleton className="h-8 w-16 mt-2" /> : counts.nota}</div>
          </div>
          <div className="rounded-2xl border bg-white p-4">
            <div className="text-xs text-gray-500 font-semibold uppercase">Inventory</div>
            <div className="text-2xl font-bold text-gray-900">{loadingRecycle ? <Skeleton className="h-8 w-16 mt-2" /> : counts.inventory}</div>
          </div>
          <div className="rounded-2xl border bg-white p-4">
            <div className="text-xs text-gray-500 font-semibold uppercase">Uang Jalan</div>
            <div className="text-2xl font-bold text-gray-900">{loadingRecycle ? <Skeleton className="h-8 w-16 mt-2" /> : counts.uangJalan}</div>
          </div>
          <div className="rounded-2xl border bg-white p-4">
            <div className="text-xs text-gray-500 font-semibold uppercase">File Retention</div>
            <div className="flex items-center gap-2 mt-2">
              {loadingFiles ? (
                <Skeleton className="h-6 w-24" />
              ) : (
                <>
                  <div className="text-xl font-bold text-gray-900">{counts.pendingFiles}</div>
                  {pendingDueCount > 0 && <Badge className="bg-amber-500 hover:bg-amber-500">Due {pendingDueCount}</Badge>}
                </>
              )}
            </div>
          </div>
        </div>

        <Tabs defaultValue="recycle" className="bg-white rounded-2xl border">
          <div className="px-4 pt-4">
            <TabsList className="grid grid-cols-2 w-full sm:w-[420px]">
              <TabsTrigger value="recycle">Recycle Bin</TabsTrigger>
              <TabsTrigger value="files">File Retention</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="recycle" className="p-4 pt-6 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-2xl border bg-white overflow-hidden">
                <div className="px-4 py-3 border-b flex items-center justify-between">
                  <div className="flex items-center gap-2 font-semibold text-gray-900">
                    <span className="h-9 w-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                      <BanknotesIcon className="h-5 w-5" />
                    </span>
                    Kasir
                  </div>
                  <Badge variant="secondary">{kasir.length}</Badge>
                </div>
                <div className="p-4 space-y-3">
                  {loadingRecycle ? (
                    Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
                  ) : kasir.length === 0 ? (
                    <div className="text-sm text-gray-500">Tidak ada data.</div>
                  ) : (
                    kasir.slice(0, 10).map((t) => (
                      <div key={t.id} className="rounded-xl border p-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold text-gray-900 truncate">{t.deskripsi}</div>
                          <div className="text-xs text-gray-500">
                            {format(new Date(t.date), 'dd/MM/yyyy')} • {t.tipe} • {formatCurrency(t.jumlah)}
                          </div>
                          <div className="text-[11px] text-gray-400">Dihapus: {format(new Date(t.deletedAt), 'dd/MM/yyyy HH:mm')}</div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="icon"
                            variant="outline"
                            className="rounded-md"
                            onClick={() => openDetail('KASIR', t)}
                            title="Detail"
                          >
                            <EyeIcon className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="outline"
                            className="rounded-md"
                            onClick={() => restore('KASIR', t.id)}
                            disabled={restoringId === `KASIR:${t.id}` || deletingId === `KASIR:${t.id}`}
                            title="Restore"
                          >
                            <ArrowUturnLeftIcon className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="outline"
                            className="rounded-md text-red-600 hover:text-red-700 hover:bg-red-50 border-red-100"
                            onClick={() => openConfirmDelete('KASIR', t.id, t.deskripsi)}
                            disabled={restoringId === `KASIR:${t.id}` || deletingId === `KASIR:${t.id}`}
                            title="Hapus Permanen"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-2xl border bg-white overflow-hidden">
                <div className="px-4 py-3 border-b flex items-center justify-between">
                  <div className="flex items-center gap-2 font-semibold text-gray-900">
                    <span className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                      <ClipboardDocumentListIcon className="h-5 w-5" />
                    </span>
                    Nota Sawit
                  </div>
                  <Badge variant="secondary">{notaSawit.length}</Badge>
                </div>
                <div className="p-4 space-y-3">
                  {loadingRecycle ? (
                    Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
                  ) : notaSawit.length === 0 ? (
                    <div className="text-sm text-gray-500">Tidak ada data.</div>
                  ) : (
                    notaSawit.slice(0, 10).map((n) => (
                      <div key={n.id} className="rounded-xl border p-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold text-gray-900 truncate">Nota #{n.id} • {n.pabrikSawit?.name || '-'}</div>
                          <div className="text-xs text-gray-500">
                            {n.supir?.name || '-'} • {formatCurrency(n.totalPembayaran)}
                          </div>
                          <div className="text-[11px] text-gray-400">Dihapus: {format(new Date(n.deletedAt), 'dd/MM/yyyy HH:mm')}</div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="icon"
                            variant="outline"
                            className="rounded-md"
                            onClick={() => openDetail('NOTA_SAWIT', n)}
                            title="Detail"
                          >
                            <EyeIcon className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="outline"
                            className="rounded-md"
                            onClick={() => restore('NOTA_SAWIT', n.id)}
                            disabled={restoringId === `NOTA_SAWIT:${n.id}` || deletingId === `NOTA_SAWIT:${n.id}`}
                            title="Restore"
                          >
                            <ArrowUturnLeftIcon className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="outline"
                            className="rounded-md text-red-600 hover:text-red-700 hover:bg-red-50 border-red-100"
                            onClick={() => openConfirmDelete('NOTA_SAWIT', n.id, `Nota #${n.id}`)}
                            disabled={restoringId === `NOTA_SAWIT:${n.id}` || deletingId === `NOTA_SAWIT:${n.id}`}
                            title="Hapus Permanen"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-2xl border bg-white overflow-hidden">
                <div className="px-4 py-3 border-b flex items-center justify-between">
                  <div className="flex items-center gap-2 font-semibold text-gray-900">
                    <span className="h-9 w-9 rounded-xl bg-orange-50 text-orange-700 flex items-center justify-center">
                      <CubeIcon className="h-5 w-5" />
                    </span>
                    Inventory
                  </div>
                  <Badge variant="secondary">{inventory.length}</Badge>
                </div>
                <div className="p-4 space-y-3">
                  {loadingRecycle ? (
                    Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
                  ) : inventory.length === 0 ? (
                    <div className="text-sm text-gray-500">Tidak ada data.</div>
                  ) : (
                    inventory.slice(0, 10).map((it) => (
                      <div key={it.id} className="rounded-xl border p-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold text-gray-900 truncate">{it.name}</div>
                          <div className="text-xs text-gray-500">SKU {it.sku} • Stok {it.stock} {it.unit}</div>
                          <div className="text-[11px] text-gray-400">Dihapus: {format(new Date(it.deletedAt), 'dd/MM/yyyy HH:mm')}</div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="icon"
                            variant="outline"
                            className="rounded-md"
                            onClick={() => openDetail('INVENTORY_ITEM', it)}
                            title="Detail"
                          >
                            <EyeIcon className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="outline"
                            className="rounded-md"
                            onClick={() => restore('INVENTORY_ITEM', it.id)}
                            disabled={restoringId === `INVENTORY_ITEM:${it.id}` || deletingId === `INVENTORY_ITEM:${it.id}`}
                            title="Restore"
                          >
                            <ArrowUturnLeftIcon className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="outline"
                            className="rounded-md text-red-600 hover:text-red-700 hover:bg-red-50 border-red-100"
                            onClick={() => openConfirmDelete('INVENTORY_ITEM', it.id, it.name)}
                            disabled={restoringId === `INVENTORY_ITEM:${it.id}` || deletingId === `INVENTORY_ITEM:${it.id}`}
                            title="Hapus Permanen"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-2xl border bg-white overflow-hidden">
                <div className="px-4 py-3 border-b flex items-center justify-between">
                  <div className="flex items-center gap-2 font-semibold text-gray-900">
                    <span className="h-9 w-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
                      <TruckIcon className="h-5 w-5" />
                    </span>
                    Uang Jalan (Sesi)
                  </div>
                  <Badge variant="secondary">{sesiUangJalan.length}</Badge>
                </div>
                <div className="p-4 space-y-3">
                  {loadingRecycle ? (
                    Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
                  ) : sesiUangJalan.length === 0 ? (
                    <div className="text-sm text-gray-500">Tidak ada data.</div>
                  ) : (
                    sesiUangJalan.slice(0, 10).map((s) => (
                      <div key={s.id} className="rounded-xl border p-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold text-gray-900 truncate">Sesi #{s.id} • {s.supir?.name || '-'}</div>
                          <div className="text-xs text-gray-500">
                            {format(new Date(s.tanggalMulai), 'dd/MM/yyyy')} • {s.status}
                          </div>
                          <div className="text-[11px] text-gray-400">Dihapus: {format(new Date(s.deletedAt), 'dd/MM/yyyy HH:mm')}</div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="icon"
                            variant="outline"
                            className="rounded-md"
                            onClick={() => openDetail('SESI_UANG_JALAN', s)}
                            title="Detail"
                          >
                            <EyeIcon className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="outline"
                            className="rounded-md"
                            onClick={() => restore('SESI_UANG_JALAN', s.id)}
                            disabled={restoringId === `SESI_UANG_JALAN:${s.id}` || deletingId === `SESI_UANG_JALAN:${s.id}`}
                            title="Restore"
                          >
                            <ArrowUturnLeftIcon className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="outline"
                            className="rounded-md text-red-600 hover:text-red-700 hover:bg-red-50 border-red-100"
                            onClick={() => openConfirmDelete('SESI_UANG_JALAN', s.id, `Sesi #${s.id}`)}
                            disabled={restoringId === `SESI_UANG_JALAN:${s.id}` || deletingId === `SESI_UANG_JALAN:${s.id}`}
                            title="Hapus Permanen"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="files" className="p-4 pt-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-sm text-gray-600">
                {loadingFiles ? (
                  <Skeleton className="h-4 w-64" />
                ) : (
                  <>Total {pendingFiles.length} file. Due {pendingDueCount} file.</>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={fetchPendingFiles} disabled={loadingFiles}>
                  <ArrowPathIcon className={`w-4 h-4 mr-2 ${loadingFiles ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                <Button onClick={processFiles} disabled={processingFiles} className="bg-blue-600 hover:bg-blue-700">
                  <TrashIcon className={`w-4 h-4 mr-2 ${processingFiles ? 'animate-spin' : ''}`} />
                  Proses Sekarang
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50 text-sm font-semibold text-gray-900">Daftar File Menunggu Penghapusan</div>
              <div className="p-4 space-y-3">
                {loadingFiles ? (
                  Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
                ) : pendingFiles.length === 0 ? (
                  <div className="text-sm text-gray-500">Tidak ada file.</div>
                ) : (
                  pendingFiles.slice(0, 50).map((f) => {
                    const due = new Date(f.deleteAt).getTime() <= Date.now()
                    return (
                      <div key={f.id} className="rounded-xl border p-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="font-semibold text-gray-900 truncate">{f.entity || '-'} {f.entityId ? `#${f.entityId}` : ''}</div>
                            {due ? <Badge className="bg-amber-500 hover:bg-amber-500">Due</Badge> : <Badge variant="secondary">Upcoming</Badge>}
                            <Badge variant="outline">{(f.driver || 'local').toUpperCase()}</Badge>
                          </div>
                          <div className="text-xs text-gray-500 truncate">{f.url}</div>
                          <div className="text-[11px] text-gray-400">
                            DeleteAt: {format(new Date(f.deleteAt), 'dd/MM/yyyy HH:mm')} • Reason: {f.reason || '-'}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="icon"
                            variant="outline"
                            className="rounded-md"
                            onClick={() => openFilePreview(f.url)}
                            title="Preview"
                          >
                            <EyeIcon className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="outline"
                            className="rounded-md text-red-600 hover:text-red-700 hover:bg-red-50 border-red-100"
                            onClick={() => deleteFile(f.id)}
                            disabled={deletingFileId === f.id}
                            title="Hapus Sekarang"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="w-[96vw] sm:w-auto max-w-2xl max-h-[92vh] p-0 overflow-hidden rounded-2xl shadow-2xl border-none flex flex-col [&>button.absolute]:hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-500 text-white">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
                  {detailEntity === 'KASIR' ? (
                    <BanknotesIcon className="h-5 w-5 text-white" />
                  ) : detailEntity === 'NOTA_SAWIT' ? (
                    <ClipboardDocumentListIcon className="h-5 w-5 text-white" />
                  ) : detailEntity === 'INVENTORY_ITEM' ? (
                    <CubeIcon className="h-5 w-5 text-white" />
                  ) : (
                    <TruckIcon className="h-5 w-5 text-white" />
                  )}
                </div>
                <div className="min-w-0">
                  <DialogTitle className="text-white">Detail</DialogTitle>
                  <DialogDescription className="text-blue-100">
                    {detailEntity || '-'} • ID: {detailData?.id ?? '-'}
                  </DialogDescription>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9 rounded-md border border-white/70 bg-white text-blue-600 hover:bg-white/90"
                  onClick={exportDetailPdf}
                  disabled={exportingPdf}
                  title="Download PDF"
                >
                  <DocumentArrowDownIcon className={`h-4 w-4 ${exportingPdf ? 'opacity-70' : ''}`} />
                </Button>

                <DialogClose asChild>
                  <button
                    type="button"
                    className="h-9 w-9 rounded-md border border-white/70 bg-white text-blue-600 flex items-center justify-center hover:bg-white/90"
                    aria-label="Tutup"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </DialogClose>
              </div>
            </div>
          </div>

          <div className="p-6 flex-1 min-h-0 overflow-y-auto bg-gray-50/30 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-xl border bg-white p-3">
                <div className="text-[11px] text-gray-500 font-semibold uppercase">Modul</div>
                <div className="text-sm font-bold text-gray-900">{detailEntity || '-'}</div>
              </div>
              <div className="rounded-xl border bg-white p-3">
                <div className="text-[11px] text-gray-500 font-semibold uppercase">ID</div>
                <div className="text-sm font-bold text-gray-900">{detailData?.id ?? '-'}</div>
              </div>
              <div className="rounded-xl border bg-white p-3">
                <div className="text-[11px] text-gray-500 font-semibold uppercase">Dihapus</div>
                <div className="text-sm font-bold text-gray-900">
                  {detailData?.deletedAt ? format(new Date(detailData.deletedAt), 'dd/MM/yyyy HH:mm') : '-'}
                </div>
              </div>
              <div className="rounded-xl border bg-white p-3">
                <div className="text-[11px] text-gray-500 font-semibold uppercase">Dihapus Oleh</div>
                <div className="text-sm font-bold text-gray-900 truncate" title={detailData?.deletedByName || detailData?.deletedBy?.name || ''}>
                  {detailData?.deletedByName || detailData?.deletedBy?.name || (detailData?.deletedById != null ? `User #${detailData.deletedById}` : '-')}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border bg-white overflow-hidden">
              <div className="px-4 py-3 border-b bg-white text-sm font-semibold text-gray-900">Detail Data</div>
              <div className="p-4">
                <pre className="text-xs text-slate-800 font-mono whitespace-pre-wrap break-words">
                  {detailData ? JSON.stringify(detailData, null, 2) : '{}'}
                </pre>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={filePreviewOpen} onOpenChange={(open) => { setFilePreviewOpen(open); if (!open) setFilePreviewUrl(null); }}>
        <DialogContent className="max-w-5xl w-[95vw] p-0 overflow-hidden border-none bg-white shadow-2xl [&>button.absolute]:hidden">
          {filePreviewUrl && (
            <div className="flex flex-col h-full max-h-[90vh]">
              <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-500 text-white">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
                      <EyeIcon className="h-5 w-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <DialogTitle className="text-white">Pratinjau File</DialogTitle>
                      <DialogDescription className="text-blue-100 truncate">
                        {filePreviewUrl}
                      </DialogDescription>
                    </div>
                  </div>
                  <DialogClose asChild>
                    <button
                      type="button"
                      onClick={() => { setFilePreviewUrl(null); setFilePreviewError(false); }}
                      className="h-9 w-9 rounded-md border border-white/70 bg-white text-blue-600 flex items-center justify-center hover:bg-white/90"
                      aria-label="Tutup"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  </DialogClose>
                </div>
              </div>

              <div className="flex-1 overflow-auto flex items-center justify-center p-4 md:p-8 min-h-0 bg-gray-50/50">
                {!filePreviewError ? (
                  <img
                    src={filePreviewUrl}
                    alt="Preview"
                    className="max-w-full max-h-[65vh] md:max-h-[70vh] w-auto h-auto object-contain shadow-2xl rounded-md border border-gray-100"
                    onError={() => setFilePreviewError(true)}
                  />
                ) : (
                  <div className="flex items-center justify-center w-full h-[40vh]">
                    <div className="px-4 py-3 rounded-md bg-white shadow text-gray-700 text-sm">
                      File tidak dapat dimuat sebagai gambar. Gunakan tombol download/lihat file dari URL.
                    </div>
                  </div>
                )}
              </div>

              {!filePreviewError && (
                <div className="flex items-center justify-center px-4 py-3 bg-gray-50 border-t border-gray-100">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 rounded-md border border-white bg-white text-blue-600 hover:bg-gray-50 hover:text-blue-700 shadow-sm transition-colors"
                    onClick={() => {
                      const link = document.createElement('a')
                      link.href = filePreviewUrl
                      link.download = `file-retention-${Date.now()}.jpg`
                      document.body.appendChild(link)
                      link.click()
                      document.body.removeChild(link)
                    }}
                    title="Download Gambar"
                  >
                    <DocumentArrowDownIcon className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent className="w-[92vw] sm:w-full sm:max-w-md rounded-2xl p-0 overflow-hidden [&>button.absolute]:hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-red-600 to-red-500 text-white flex items-center justify-between">
            <DialogTitle className="text-white">Hapus Permanen</DialogTitle>
            <button
              type="button"
              onClick={() => setConfirmDeleteOpen(false)}
              className="h-9 w-9 rounded-full border border-white/30 bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
              aria-label="Tutup"
              title="Tutup"
            >
              <XMarkIcon className="h-5 w-5 text-white" />
            </button>
          </div>
          <div className="px-6 py-5 space-y-3">
            <p className="text-sm text-gray-600">
              Apakah Anda yakin ingin menghapus data ini secara <strong>PERMANEN</strong>? Tindakan ini tidak dapat dibatalkan.
            </p>
            {confirmDeleteData && (
              <div className="rounded-xl border bg-gray-50 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Modul</span>
                  <span className="font-medium">{confirmDeleteData.entity}</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-gray-600">ID</span>
                  <span className="font-medium">#{confirmDeleteData.id}</span>
                </div>
                {confirmDeleteData.label && (
                  <div className="mt-2">
                    <div className="text-gray-600">Keterangan</div>
                    <div className="mt-0.5 font-medium">{confirmDeleteData.label}</div>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="px-6 pb-6 pt-2 flex flex-col-reverse sm:flex-row gap-3 sm:gap-2 sm:justify-between">
            <Button className="rounded-full w-full sm:w-auto" variant="outline" onClick={() => setConfirmDeleteOpen(false)} disabled={!!deletingId}>Batal</Button>
            <Button 
              className="rounded-full w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white" 
              onClick={() => confirmDeleteData && deletePermanent(confirmDeleteData.entity, confirmDeleteData.id)} 
              disabled={!!deletingId}
            >
              {deletingId ? 'Menghapus...' : 'Hapus Permanen'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </RoleGate>
  )
}
