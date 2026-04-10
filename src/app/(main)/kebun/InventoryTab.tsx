'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { useDebounce } from '@/hooks/useDebounce'
import { ArchiveBoxIcon, MagnifyingGlassIcon, XMarkIcon, CheckIcon, PlusIcon, PencilSquareIcon, EyeIcon, ArrowDownTrayIcon, TrashIcon } from '@heroicons/react/24/outline'
import ImageUpload from '@/components/ui/ImageUpload'
import { ModalHeader, ModalContentWrapper, ModalFooter } from '@/components/ui/modal-elements'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'

type InventoryItem = {
  id: number
  name: string
  category?: string | null
  unit: string
  minStock: number
  imageUrl?: string | null
  stock: number
  kendaraanPlatNomor?: string | null
}

type InventoryTransaction = {
  id: number
  type: string
  quantity: number
  notes?: string | null
  imageUrl?: string | null
  date: string
  createdAt: string
  item: {
    id: number
    name: string
    unit: string
    category?: string | null
  }
  user: {
    id: number
    name: string
  }
}

type KendaraanItem = {
  platNomor: string
  jenis: string
}

export default function InventoryTab({ kebunId }: { kebunId: number }) {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([])
  const [kendaraanList, setKendaraanList] = useState<KendaraanItem[]>([])
  const [loadingItems, setLoadingItems] = useState(false)
  const [loadingTrx, setLoadingTrx] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [detailItem, setDetailItem] = useState<InventoryItem | null>(null)
  const [detailTransactions, setDetailTransactions] = useState<InventoryTransaction[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [detailExporting, setDetailExporting] = useState(false)
  const [editingTrx, setEditingTrx] = useState<InventoryTransaction | null>(null)
  const [quantity, setQuantity] = useState('')
  const [notes, setNotes] = useState('')
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [trxFile, setTrxFile] = useState<File | null>(null)
  const [trxPreview, setTrxPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [creating, setCreating] = useState(false)
  const [editQuantity, setEditQuantity] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editDate, setEditDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [editTrxFile, setEditTrxFile] = useState<File | null>(null)
  const [editTrxPreview, setEditTrxPreview] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)
  const [itemFile, setItemFile] = useState<File | null>(null)
  const [itemPreview, setItemPreview] = useState<string | null>(null)
  const [isEditItemOpen, setIsEditItemOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [editItem, setEditItem] = useState({
    name: '',
    category: '',
    unit: '',
    minStock: '',
    kendaraanPlatNomor: '',
  })
  const [editItemFile, setEditItemFile] = useState<File | null>(null)
  const [editItemPreview, setEditItemPreview] = useState<string | null>(null)
  const [updatingItem, setUpdatingItem] = useState(false)
  const [deleteItemOpen, setDeleteItemOpen] = useState(false)
  const [deleteItemTarget, setDeleteItemTarget] = useState<InventoryItem | null>(null)
  const [viewImageUrl, setViewImageUrl] = useState<string | null>(null)
  const [viewImageError, setViewImageError] = useState(false)
  const [newItem, setNewItem] = useState({
    name: '',
    category: '',
    unit: '',
    minStock: '',
    stock: '',
    kendaraanPlatNomor: '',
  })
  const debouncedSearch = useDebounce(search.trim(), 400)

  const lowStockCount = useMemo(
    () => items.filter(item => item.minStock > 0 && item.stock <= item.minStock).length,
    [items]
  )

  const fetchItems = useCallback(async () => {
    try {
      setLoadingItems(true)
      const params = new URLSearchParams()
      if (debouncedSearch) params.set('search', debouncedSearch)
      const res = await fetch(`/api/kebun/${kebunId}/inventory?${params.toString()}`)
      if (!res.ok) throw new Error('Gagal memuat stok inventory')
      const data = await res.json()
      setItems(data.data || [])
    } catch (error: any) {
      toast.error(error.message || 'Gagal memuat stok inventory')
    } finally {
      setLoadingItems(false)
    }
  }, [debouncedSearch, kebunId])

  const fetchTransactions = useCallback(async () => {
    try {
      setLoadingTrx(true)
      const res = await fetch(`/api/kebun/${kebunId}/inventory/transactions?limit=20`)
      if (!res.ok) throw new Error('Gagal memuat riwayat')
      const data = await res.json()
      setTransactions(data.data || [])
    } catch (error: any) {
      toast.error(error.message || 'Gagal memuat riwayat')
    } finally {
      setLoadingTrx(false)
    }
  }, [kebunId])

  const fetchKendaraan = useCallback(async () => {
    try {
      const res = await fetch('/api/kendaraan?limit=500')
      if (!res.ok) return
      const data = await res.json()
      const rows = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : []
      const filtered = rows.filter((k: any) => ['Mobil Truck', 'Alat Berat'].includes(k.jenis))
      setKendaraanList(filtered.map((k: any) => ({ platNomor: k.platNomor, jenis: k.jenis })))
    } catch {
      setKendaraanList([])
    }
  }, [])

  useEffect(() => {
    fetchItems()
    fetchTransactions()
    fetchKendaraan()
  }, [fetchItems, fetchTransactions, fetchKendaraan])

  const openOutModal = (item: InventoryItem) => {
    setSelectedItem(item)
    setQuantity('')
    setNotes('')
    setDate(format(new Date(), 'yyyy-MM-dd'))
    setTrxFile(null)
    setTrxPreview(null)
    setIsModalOpen(true)
  }

  const openEditItemModal = (item: InventoryItem) => {
    setEditingItem(item)
    setEditItem({
      name: item.name || '',
      category: item.category || '',
      unit: item.unit || '',
      minStock: String(item.minStock ?? 0),
      kendaraanPlatNomor: item.kendaraanPlatNomor || '',
    })
    setEditItemFile(null)
    setEditItemPreview(item.imageUrl || null)
    setIsEditItemOpen(true)
  }

  const openDeleteItemModal = (item: InventoryItem) => {
    setDeleteItemTarget(item)
    setDeleteItemOpen(true)
  }

  const openEditModal = (trx: InventoryTransaction) => {
    setEditingTrx(trx)
    setEditQuantity(String(trx.quantity))
    setEditNotes(trx.notes || '')
    setEditDate(format(new Date(trx.date), 'yyyy-MM-dd'))
    setEditTrxFile(null)
    setEditTrxPreview(trx.imageUrl || null)
    setIsEditOpen(true)
  }

  const handleSubmit = async () => {
    if (!selectedItem) return
    const qty = Number(quantity)
    if (!qty || qty <= 0) {
      toast.error('Jumlah harus lebih dari 0')
      return
    }
    setSaving(true)
    const loadingToast = toast.loading('Menyimpan transaksi...')
    try {
      let imageUrl: string | undefined = undefined
      if (trxFile) {
        const fd = new FormData()
        fd.append('file', trxFile)
        const up = await fetch('/api/upload', { method: 'POST', body: fd })
        const upJson = await up.json().catch(() => ({}))
        if (!up.ok || !upJson?.success) throw new Error(upJson?.error || 'Upload gambar gagal')
        imageUrl = upJson.url
      }
      const res = await fetch(`/api/kebun/${kebunId}/inventory/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: selectedItem.id,
          type: 'OUT',
          quantity: qty,
          date,
          notes,
          ...(imageUrl ? { imageUrl } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || 'Gagal menyimpan pengeluaran')
      }
      toast.success('Transaksi berhasil disimpan', { id: loadingToast })
      setIsModalOpen(false)
      setSelectedItem(null)
      setTrxFile(null)
      setTrxPreview(null)
      fetchItems()
      fetchTransactions()
    } catch (error: any) {
      toast.error(error.message || 'Gagal menyimpan transaksi', { id: loadingToast })
    } finally {
      setSaving(false)
    }
  }

  const handleCreateItem = async () => {
    if (!newItem.name.trim() || !newItem.unit.trim()) {
      toast.error('Nama dan satuan wajib diisi')
      return
    }
    setCreating(true)
    const loadingToast = toast.loading('Menyimpan barang...')
    try {
      let imageUrl: string | undefined = undefined
      if (itemFile) {
        const fd = new FormData()
        fd.append('file', itemFile)
        const up = await fetch('/api/upload', { method: 'POST', body: fd })
        const upJson = await up.json().catch(() => ({}))
        if (!up.ok || !upJson?.success) throw new Error(upJson?.error || 'Upload gambar gagal')
        imageUrl = upJson.url
      }
      const res = await fetch(`/api/kebun/${kebunId}/inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newItem.name.trim(),
          category: newItem.category.trim() || undefined,
          unit: newItem.unit.trim(),
          minStock: Number(newItem.minStock) || 0,
          stock: Number(newItem.stock) || 0,
          kendaraanPlatNomor: newItem.category.trim().toLowerCase() === 'kendaraan' ? newItem.kendaraanPlatNomor || undefined : undefined,
          ...(imageUrl ? { imageUrl } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || 'Gagal menambah barang')
      }
      toast.success('Barang berhasil ditambahkan', { id: loadingToast })
      setIsAddOpen(false)
      setNewItem({ name: '', category: '', unit: '', minStock: '', stock: '', kendaraanPlatNomor: '' })
      setItemFile(null)
      setItemPreview(null)
      fetchItems()
    } catch (error: any) {
      toast.error(error.message || 'Gagal menambah barang', { id: loadingToast })
    } finally {
      setCreating(false)
    }
  }

  const handleUpdateTransaction = async () => {
    if (!editingTrx) return
    const qty = Number(editQuantity)
    if (!qty || qty <= 0) {
      toast.error('Jumlah harus lebih dari 0')
      return
    }
    setUpdating(true)
    const loadingToast = toast.loading('Menyimpan perubahan...')
    try {
      let imageUrl: string | undefined = undefined
      if (editTrxFile) {
        const fd = new FormData()
        fd.append('file', editTrxFile)
        const up = await fetch('/api/upload', { method: 'POST', body: fd })
        const upJson = await up.json().catch(() => ({}))
        if (!up.ok || !upJson?.success) throw new Error(upJson?.error || 'Upload gambar gagal')
        imageUrl = upJson.url
      }
      const res = await fetch(`/api/kebun/${kebunId}/inventory/transactions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingTrx.id,
          quantity: qty,
          date: editDate,
          notes: editNotes,
          ...(typeof imageUrl !== 'undefined' ? { imageUrl } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || 'Gagal memperbarui pengeluaran')
      }
      toast.success('Perubahan berhasil disimpan', { id: loadingToast })
      setIsEditOpen(false)
      setEditingTrx(null)
      setEditTrxFile(null)
      setEditTrxPreview(null)
      fetchItems()
      fetchTransactions()
    } catch (error: any) {
      toast.error(error.message || 'Gagal menyimpan perubahan', { id: loadingToast })
    } finally {
      setUpdating(false)
    }
  }

  const handleUpdateItem = async () => {
    if (!editingItem) return
    if (!editItem.name.trim() || !editItem.unit.trim()) {
      toast.error('Nama dan satuan wajib diisi')
      return
    }
    setUpdatingItem(true)
    const loadingToast = toast.loading('Menyimpan perubahan...')
    try {
      let imageUrl: string | undefined = undefined
      if (editItemFile) {
        const fd = new FormData()
        fd.append('file', editItemFile)
        const up = await fetch('/api/upload', { method: 'POST', body: fd })
        const upJson = await up.json().catch(() => ({}))
        if (!up.ok || !upJson?.success) throw new Error(upJson?.error || 'Upload gambar gagal')
        imageUrl = upJson.url
      }
      const res = await fetch(`/api/kebun/${kebunId}/inventory/items/${editingItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editItem.name.trim(),
          category: editItem.category.trim() || undefined,
          unit: editItem.unit.trim(),
          minStock: Number(editItem.minStock) || 0,
          kendaraanPlatNomor: editItem.category.trim().toLowerCase() === 'kendaraan' ? editItem.kendaraanPlatNomor || undefined : undefined,
          ...(typeof imageUrl !== 'undefined' ? { imageUrl } : {}),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Gagal memperbarui barang')
      toast.success('Perubahan berhasil disimpan', { id: loadingToast })
      setIsEditItemOpen(false)
      setEditingItem(null)
      setEditItemFile(null)
      setEditItemPreview(null)
      fetchItems()
    } catch (error: any) {
      toast.error(error.message || 'Gagal menyimpan perubahan', { id: loadingToast })
    } finally {
      setUpdatingItem(false)
    }
  }

  const handleDeleteItem = async () => {
    if (!deleteItemTarget) return
    const loadingToast = toast.loading('Menghapus barang...')
    try {
      const res = await fetch(`/api/kebun/${kebunId}/inventory/items/${deleteItemTarget.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Gagal menghapus barang')
      toast.success('Barang dihapus', { id: loadingToast })
      setDeleteItemOpen(false)
      setDeleteItemTarget(null)
      if (detailItem?.id === deleteItemTarget.id) {
        setIsDetailOpen(false)
        setDetailItem(null)
        setDetailTransactions([])
      }
      fetchItems()
      fetchTransactions()
    } catch (error: any) {
      toast.error(error.message || 'Gagal menghapus barang', { id: loadingToast })
    }
  }

  const openDetailModal = async (item: InventoryItem) => {
    setDetailItem(item)
    setIsDetailOpen(true)
    setLoadingDetail(true)
    try {
      const res = await fetch(`/api/kebun/${kebunId}/inventory/transactions?itemId=${item.id}&limit=50`)
      if (!res.ok) throw new Error('Gagal memuat riwayat')
      const data = await res.json()
      setDetailTransactions(data.data || [])
    } catch (error: any) {
      toast.error(error.message || 'Gagal memuat riwayat')
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleExportDetailPdf = async () => {
    if (!detailItem || detailExporting) return
    setDetailExporting(true)
    const loadingToast = toast.loading('Membuat PDF...')
    try {
      const jsPDF = (await import('jspdf')).default
      const autoTable = (await import('jspdf-autotable')).default

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.text('Detail Barang Inventory Kebun', 14, 16)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text(`Kebun ID: ${kebunId}`, 14, 23)
      doc.text(`Item: ${detailItem.name}`, 14, 28)
      doc.text(`Stok: ${detailItem.stock} ${detailItem.unit}`, 14, 33)

      const rows: Array<[string, string]> = [
        ['Kategori', detailItem.category || '-'],
        ['Min Stock', String(detailItem.minStock || 0)],
        ['Kendaraan', detailItem.kendaraanPlatNomor || '-'],
        ['Foto', detailItem.imageUrl || '-'],
      ]

      autoTable(doc, {
        head: [['Field', 'Nilai']],
        body: rows,
        startY: 38,
        theme: 'grid',
        styles: { fontSize: 10, cellPadding: 3 },
        headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: { 0: { cellWidth: 48, fontStyle: 'bold' } },
      } as any)

      const startY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 6 : 55

      const trxRows = detailTransactions.map((t) => ([
        t.date ? format(new Date(t.date), 'dd/MM/yyyy') : '-',
        t.type,
        `${t.quantity} ${t.item?.unit || ''}`.trim(),
        t.user?.name || '-',
        t.notes || '-',
      ]))

      autoTable(doc, {
        head: [['Tanggal', 'Tipe', 'Qty', 'User', 'Catatan']],
        body: trxRows.length > 0 ? trxRows : [['-', '-', '-', '-', '-']],
        startY,
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 2.5 },
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
      } as any)

      const safeName = String(detailItem.name || 'item').replace(/[^\p{L}\p{N}\s_-]/gu, '').trim().replace(/\s+/g, '-')
      doc.save(`inventory-kebun-${kebunId}-${safeName}.pdf`)
      toast.success('PDF berhasil dibuat', { id: loadingToast })
    } catch {
      toast.error('Gagal export PDF', { id: loadingToast })
    } finally {
      setDetailExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">Stok Inventory Kebun</h2>
          <p className="text-sm text-gray-500">Catat pengeluaran barang kebun harian dan pantau stok.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <div className="w-full sm:w-72 relative">
            <MagnifyingGlassIcon className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari barang..."
              className="pl-9 rounded-full"
            />
          </div>
          <Button
            className="rounded-full bg-emerald-600 hover:bg-emerald-700 w-full sm:w-auto"
            onClick={() => setIsAddOpen(true)}
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Tambah Barang
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-4">
          <div className="text-xs text-gray-500">Total Item</div>
          <div className="text-xl font-bold text-gray-900">{items.length}</div>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4">
          <div className="text-xs text-gray-500">Stok Menipis</div>
          <div className="text-xl font-bold text-red-600">{lowStockCount}</div>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4">
          <div className="text-xs text-gray-500">Update Terbaru</div>
          <div className="text-sm font-semibold text-gray-900">
            {transactions[0]?.date ? format(new Date(transactions[0].date), 'dd MMM yyyy', { locale: idLocale }) : '-'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loadingItems ? (
          Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="rounded-2xl border border-gray-100 bg-white p-4 animate-pulse">
              <div className="h-4 w-2/3 bg-gray-200 rounded mb-2" />
              <div className="h-3 w-1/3 bg-gray-200 rounded mb-4" />
              <div className="h-6 w-1/2 bg-gray-200 rounded" />
            </div>
          ))
        ) : items.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center text-gray-500">
            Belum ada data inventory
          </div>
        ) : (
          items.map(item => {
            const isLow = item.minStock > 0 && item.stock <= item.minStock
            return (
              <div key={item.id} className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="font-semibold text-gray-900 line-clamp-1">{item.name}</div>
                  <div className="text-xs text-gray-500">
                    {item.category || 'Umum'}{item.kendaraanPlatNomor ? ` • ${item.kendaraanPlatNomor}` : ''}
                  </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isLow ? (
                      <Badge className="bg-red-100 text-red-700">Menipis</Badge>
                    ) : (
                      <Badge className="bg-emerald-100 text-emerald-700">Aman</Badge>
                    )}
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      onClick={() => openEditItemModal(item)}
                      title="Edit Barang"
                    >
                      <PencilSquareIcon className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-full text-red-600 hover:bg-red-50"
                      onClick={() => openDeleteItemModal(item)}
                      title="Hapus Barang"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-xs text-gray-500">Stok</div>
                    <div className="text-lg font-bold text-gray-900">
                      {item.stock} {item.unit}
                    </div>
                  </div>
                  <div className="text-xs text-gray-400">Min {item.minStock || 0}</div>
                </div>
                <Button
                  className="w-full rounded-full bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => openOutModal(item)}
                >
                  Catat Pengeluaran
                </Button>
                <Button
                  variant="outline"
                  className="w-full rounded-full"
                  onClick={() => openDetailModal(item)}
                >
                  <EyeIcon className="h-4 w-4 mr-2" />
                  Lihat Detail
                </Button>
              </div>
            )
          })
        )}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Riwayat Pengeluaran</h3>
          <span className="text-xs text-gray-400">20 terakhir</span>
        </div>
        {loadingTrx ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-sm text-gray-500">Belum ada riwayat pengeluaran.</div>
        ) : (
          <div className="space-y-3">
            {transactions.map(trx => (
              <div key={trx.id} className="rounded-xl border border-gray-100 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-gray-900">{trx.item.name}</div>
                    <div className="text-xs text-gray-500">
                      {format(new Date(trx.date), 'dd MMM yyyy', { locale: idLocale })} • {trx.user?.name || '-'}
                    </div>
                    {trx.notes ? <div className="text-xs text-gray-400">{trx.notes}</div> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-bold text-red-600">
                      -{trx.quantity} {trx.item.unit}
                    </div>
                    {trx.imageUrl && (
                      <Button
                        variant="outline"
                        className="h-8 w-8 p-0 rounded-full"
                        onClick={() => { setViewImageUrl(trx.imageUrl || null); setViewImageError(false); }}
                        title="Lihat bukti"
                      >
                        <EyeIcon className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      className="h-8 w-8 p-0 rounded-full"
                      onClick={() => openEditModal(trx)}
                    >
                      <PencilSquareIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="w-[92vw] sm:max-w-md p-0 overflow-hidden [&>button.absolute]:hidden">
          <ModalHeader
            title="Pengeluaran Barang"
            variant="emerald"
            icon={<ArchiveBoxIcon className="h-5 w-5 text-white" />}
            onClose={() => setIsModalOpen(false)}
          />
          <ModalContentWrapper className="space-y-4">
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3">
              <div className="text-sm font-semibold text-gray-900">{selectedItem?.name}</div>
              <div className="text-xs text-gray-500">{selectedItem?.category || 'Umum'} • {selectedItem?.unit}</div>
            </div>
            <div className="space-y-2">
              <Label>Tanggal</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Jumlah</Label>
              <Input
                type="number"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Keterangan</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contoh: pemupukan blok A"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Upload Gambar (Opsional)</Label>
              <ImageUpload
                previewUrl={trxPreview}
                onFileChange={(file) => {
                  setTrxFile(file)
                  if (!file) {
                    setTrxPreview(null)
                    return
                  }
                  setTrxPreview(URL.createObjectURL(file))
                }}
              />
            </div>
          </ModalContentWrapper>
          <ModalFooter>
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="rounded-full">
              <XMarkIcon className="h-4 w-4 mr-2" />
              Batal
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={saving} className="rounded-full bg-emerald-600 hover:bg-emerald-700">
              <CheckIcon className="h-4 w-4 mr-2" />
              {saving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </ModalFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="w-[92vw] sm:max-w-md p-0 overflow-hidden [&>button.absolute]:hidden">
          <ModalHeader
            title="Tambah Barang Kebun"
            variant="emerald"
            icon={<ArchiveBoxIcon className="h-5 w-5 text-white" />}
            onClose={() => setIsAddOpen(false)}
          />
          <ModalContentWrapper className="space-y-4">
            <div className="space-y-2">
              <Label>Nama Barang</Label>
              <Input
                value={newItem.name}
                onChange={(e) => setNewItem(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Contoh: Pupuk NPK"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Kategori</Label>
              <Select
                value={newItem.category}
                onValueChange={(value) => setNewItem(prev => ({ ...prev, category: value }))}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pupuk">Pupuk</SelectItem>
                  <SelectItem value="BBM">BBM</SelectItem>
                  <SelectItem value="Peralatan">Peralatan</SelectItem>
                  <SelectItem value="Kendaraan">Kendaraan</SelectItem>
                  <SelectItem value="Lainnya">Lainnya</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newItem.category.trim().toLowerCase() === 'kendaraan' && (
              <div className="space-y-2">
                <Label>Kendaraan</Label>
                <Select
                  value={newItem.kendaraanPlatNomor}
                  onValueChange={(value) => setNewItem(prev => ({ ...prev, kendaraanPlatNomor: value }))}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Pilih kendaraan" />
                  </SelectTrigger>
                  <SelectContent>
                    {kendaraanList.length === 0 ? (
                      <SelectItem value="-" disabled>Tidak ada kendaraan</SelectItem>
                    ) : (
                      kendaraanList.map((k) => (
                        <SelectItem key={k.platNomor} value={k.platNomor}>
                          {k.platNomor} • {k.jenis}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Satuan</Label>
                <Input
                  value={newItem.unit}
                  onChange={(e) => setNewItem(prev => ({ ...prev, unit: e.target.value }))}
                  placeholder="sak"
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label>Stok Awal</Label>
                <Input
                  type="number"
                  min="0"
                  value={newItem.stock}
                  onChange={(e) => setNewItem(prev => ({ ...prev, stock: e.target.value }))}
                  className="rounded-xl"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Stok Minimum</Label>
              <Input
                type="number"
                min="0"
                value={newItem.minStock}
                onChange={(e) => setNewItem(prev => ({ ...prev, minStock: e.target.value }))}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Foto Barang (Opsional)</Label>
              <ImageUpload
                previewUrl={itemPreview}
                onFileChange={(file) => {
                  setItemFile(file)
                  if (!file) {
                    setItemPreview(null)
                    return
                  }
                  setItemPreview(URL.createObjectURL(file))
                }}
              />
            </div>
          </ModalContentWrapper>
          <ModalFooter>
            <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)} className="rounded-full">
              <XMarkIcon className="h-4 w-4 mr-2" />
              Batal
            </Button>
            <Button type="button" onClick={handleCreateItem} disabled={creating} className="rounded-full bg-emerald-600 hover:bg-emerald-700">
              <CheckIcon className="h-4 w-4 mr-2" />
              {creating ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </ModalFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditItemOpen} onOpenChange={setIsEditItemOpen}>
        <DialogContent className="w-[92vw] sm:max-w-md p-0 overflow-hidden [&>button.absolute]:hidden">
          <ModalHeader
            title="Edit Barang Kebun"
            variant="emerald"
            icon={<PencilSquareIcon className="h-5 w-5 text-white" />}
            onClose={() => setIsEditItemOpen(false)}
          />
          <ModalContentWrapper className="space-y-4">
            <div className="space-y-2">
              <Label>Nama Barang</Label>
              <Input
                value={editItem.name}
                onChange={(e) => setEditItem(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Contoh: Pupuk NPK"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Kategori</Label>
              <Select
                value={editItem.category}
                onValueChange={(value) => setEditItem(prev => ({ ...prev, category: value }))}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pupuk">Pupuk</SelectItem>
                  <SelectItem value="BBM">BBM</SelectItem>
                  <SelectItem value="Peralatan">Peralatan</SelectItem>
                  <SelectItem value="Kendaraan">Kendaraan</SelectItem>
                  <SelectItem value="Lainnya">Lainnya</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editItem.category.trim().toLowerCase() === 'kendaraan' && (
              <div className="space-y-2">
                <Label>Kendaraan</Label>
                <Select
                  value={editItem.kendaraanPlatNomor}
                  onValueChange={(value) => setEditItem(prev => ({ ...prev, kendaraanPlatNomor: value }))}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Pilih kendaraan" />
                  </SelectTrigger>
                  <SelectContent>
                    {kendaraanList.length === 0 ? (
                      <SelectItem value="-" disabled>Tidak ada kendaraan</SelectItem>
                    ) : (
                      kendaraanList.map((k) => (
                        <SelectItem key={k.platNomor} value={k.platNomor}>
                          {k.platNomor} • {k.jenis}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Satuan</Label>
                <Input
                  value={editItem.unit}
                  onChange={(e) => setEditItem(prev => ({ ...prev, unit: e.target.value }))}
                  placeholder="Contoh: Kg"
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label>Min Stok</Label>
                <Input
                  type="number"
                  min="0"
                  value={editItem.minStock}
                  onChange={(e) => setEditItem(prev => ({ ...prev, minStock: e.target.value }))}
                  className="rounded-xl"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Foto Barang (Opsional)</Label>
              <ImageUpload
                previewUrl={editItemPreview}
                onFileChange={(file) => {
                  setEditItemFile(file)
                  if (!file) return
                  setEditItemPreview(URL.createObjectURL(file))
                }}
              />
            </div>
          </ModalContentWrapper>
          <ModalFooter>
            <Button type="button" variant="outline" onClick={() => setIsEditItemOpen(false)} className="rounded-full" disabled={updatingItem}>
              <XMarkIcon className="h-4 w-4 mr-2" />
              Batal
            </Button>
            <Button type="button" onClick={handleUpdateItem} disabled={updatingItem} className="rounded-full bg-emerald-600 hover:bg-emerald-700">
              <CheckIcon className="h-4 w-4 mr-2" />
              {updatingItem ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </ModalFooter>
        </DialogContent>
      </Dialog>

      <ConfirmationModal
        isOpen={deleteItemOpen}
        onClose={() => { setDeleteItemOpen(false); setDeleteItemTarget(null) }}
        onConfirm={handleDeleteItem}
        title="Konfirmasi Hapus Barang"
        description={`Apakah Anda yakin ingin menghapus barang ${deleteItemTarget?.name || ''}? Barang hanya bisa dihapus jika stok = 0 dan belum ada transaksi.`}
        variant="emerald"
      />

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="w-[92vw] sm:max-w-md p-0 overflow-hidden [&>button.absolute]:hidden">
          <ModalHeader
            title="Edit Pengeluaran"
            variant="emerald"
            icon={<ArchiveBoxIcon className="h-5 w-5 text-white" />}
            onClose={() => setIsEditOpen(false)}
          />
          <ModalContentWrapper className="space-y-4">
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3">
              <div className="text-sm font-semibold text-gray-900">{editingTrx?.item.name}</div>
              <div className="text-xs text-gray-500">{editingTrx?.item.category || 'Umum'} • {editingTrx?.item.unit}</div>
            </div>
            <div className="space-y-2">
              <Label>Tanggal</Label>
              <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Jumlah</Label>
              <Input
                type="number"
                min="0"
                value={editQuantity}
                onChange={(e) => setEditQuantity(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Keterangan</Label>
              <Input
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Contoh: koreksi catatan"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Upload Gambar (Opsional)</Label>
              <ImageUpload
                previewUrl={editTrxPreview}
                onFileChange={(file) => {
                  setEditTrxFile(file)
                  if (!file) {
                    setEditTrxPreview(null)
                    return
                  }
                  setEditTrxPreview(URL.createObjectURL(file))
                }}
              />
            </div>
          </ModalContentWrapper>
          <ModalFooter>
            <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)} className="rounded-full">
              <XMarkIcon className="h-4 w-4 mr-2" />
              Batal
            </Button>
            <Button type="button" onClick={handleUpdateTransaction} disabled={updating} className="rounded-full bg-emerald-600 hover:bg-emerald-700">
              <CheckIcon className="h-4 w-4 mr-2" />
              {updating ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </ModalFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="w-[94vw] sm:max-w-2xl p-0 overflow-hidden [&>button.absolute]:hidden">
          <ModalHeader
            title="Detail Barang"
            variant="emerald"
            icon={<ArchiveBoxIcon className="h-5 w-5 text-white" />}
            actions={
              <button
                type="button"
                onClick={handleExportDetailPdf}
                disabled={!detailItem || detailExporting}
                className="h-9 w-9 rounded-md border border-white/70 bg-white text-emerald-600 flex items-center justify-center hover:bg-white/90 disabled:opacity-60"
                aria-label="Export PDF"
                title="Export PDF"
              >
                <ArrowDownTrayIcon className={`h-4 w-4 ${detailExporting ? 'opacity-70' : ''}`} />
              </button>
            }
            onClose={() => setIsDetailOpen(false)}
          />
          <ModalContentWrapper className="space-y-4">
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <div className="text-sm font-semibold text-gray-900">{detailItem?.name}</div>
              <div className="text-xs text-gray-500">
                {detailItem?.category || 'Umum'}
                {detailItem?.kendaraanPlatNomor ? ` • ${detailItem?.kendaraanPlatNomor}` : ''}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-gray-500">Stok</div>
                  <div className="text-lg font-bold text-gray-900">
                    {detailItem?.stock || 0} {detailItem?.unit}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Minimum</div>
                  <div className="text-lg font-bold text-gray-900">{detailItem?.minStock || 0}</div>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-gray-900">Riwayat Barang</h4>
                <span className="text-xs text-gray-400">50 terakhir</span>
              </div>
              {loadingDetail ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, idx) => (
                    <div key={idx} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : detailTransactions.length === 0 ? (
                <div className="text-sm text-gray-500">Belum ada riwayat.</div>
              ) : (
                <div className="space-y-3">
                  {detailTransactions.map(trx => (
                    <div key={trx.id} className="rounded-xl border border-gray-100 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="text-sm font-semibold text-gray-900">{trx.item.name}</div>
                          <div className="text-xs text-gray-500">
                            {format(new Date(trx.date), 'dd MMM yyyy', { locale: idLocale })} • {trx.user?.name || '-'}
                          </div>
                          {trx.notes ? <div className="text-xs text-gray-400">{trx.notes}</div> : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`text-sm font-bold ${trx.type === 'IN' ? 'text-emerald-600' : 'text-red-600'}`}>
                            {trx.type === 'IN' ? '+' : '-'}{trx.quantity} {trx.item.unit}
                          </div>
                          {trx.imageUrl && (
                            <Button
                              variant="outline"
                              className="h-8 w-8 p-0 rounded-full"
                              onClick={() => { setViewImageUrl(trx.imageUrl || null); setViewImageError(false); }}
                              title="Lihat bukti"
                            >
                              <EyeIcon className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ModalContentWrapper>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewImageUrl} onOpenChange={(open) => { if (!open) { setViewImageUrl(null); setViewImageError(false); } }}>
        <DialogContent className="max-w-5xl w-[95vw] p-0 overflow-hidden border-none bg-white shadow-2xl [&>button.absolute]:hidden">
          {viewImageUrl && (
            <div className="flex flex-col h-full max-h-[90vh]">
              <ModalHeader
                title="Bukti Inventory"
                subtitle="Pratinjau lampiran"
                variant="emerald"
                icon={<EyeIcon className="h-5 w-5 text-white" />}
                onClose={() => { setViewImageUrl(null); setViewImageError(false); }}
              />

              <div className="flex-1 overflow-auto flex items-center justify-center p-4 md:p-8 min-h-0 bg-gray-50/50">
                {!viewImageError ? (
                  <img
                    src={viewImageUrl}
                    alt="Bukti Inventory"
                    className="max-w-full max-h-[65vh] md:max-h-[70vh] w-auto h-auto object-contain shadow-2xl rounded-md border border-gray-100"
                    onError={() => setViewImageError(true)}
                  />
                ) : (
                  <div className="flex items-center justify-center w-full h-[40vh]">
                    <div className="px-4 py-3 rounded-md bg-white shadow text-gray-700 text-sm">
                      Gambar tidak dapat dimuat.
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
