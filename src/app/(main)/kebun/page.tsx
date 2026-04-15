'use client'

import { useState, useEffect, useMemo, useCallback, type SetStateAction } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { DataTable } from '@/components/ui/data-table'
import { columns, KebunData, formatKebunText } from './columns'
import KebunModal from './modal'
import type { Kebun } from '@prisma/client'
import toast from 'react-hot-toast'
 
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import { 
  PlusIcon, 
  MapPinIcon, 
  CalendarDaysIcon, 
  MagnifyingGlassIcon, 
  PencilSquareIcon, 
  TrashIcon, 
  ArrowTopRightOnSquareIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  BuildingOfficeIcon
} from '@heroicons/react/24/outline'
import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/components/AuthProvider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function KebunPage() {
  const { role: currentUserRole, kebunId: currentUserKebunId } = useAuth();
  const [data, setData] = useState<KebunData[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [limit, setLimit] = useState(12); // Use 12 for grid consistency (3 or 4 per row)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingKebun, setEditingKebun] = useState<KebunData | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [perusahaanId, setPerusahaanId] = useState<string>('all');
  const [summary, setSummary] = useState<{
    totalProduksi: number
    totalBeratAkhir?: number
    totalBayarNet?: number
    totalBiaya: number
    produksiPerKebun: Array<{ kebunId: number; kebunName: string; totalProduksi?: number; totalBeratAkhir?: number }>
  } | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const q = searchParams.get('search') || '';
    setSearchQuery((prev) => (prev === q ? prev : q))
    setSearchDraft((prev) => (prev === q ? prev : q))
  }, [searchParams]);
  
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const startDateString = startDate?.toISOString() || '';
      const endDateString = endDate?.toISOString() || '';
      const res = await fetch(`/api/kebun?page=${page}&limit=${limit}&search=${encodeURIComponent(searchQuery)}&startDate=${startDateString}&endDate=${endDateString}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Gagal mengambil data');
      const kebunData = await res.json();
      setData(kebunData.data);
      setTotalItems(kebunData.total);
      setSummaryLoading(true)
      try {
        const summaryRes = await fetch(`/api/kebun/summary?search=${encodeURIComponent(searchQuery)}&startDate=${startDateString}&endDate=${endDateString}`, { cache: 'no-store' })
        if (!summaryRes.ok) throw new Error('Gagal mengambil ringkasan kebun')
        const summaryJson = await summaryRes.json()
        setSummary(summaryJson)
      } finally {
        setSummaryLoading(false)
      }
    } catch (error) {
      toast.error('Gagal memuat data. Coba lagi nanti.');
    } finally {
      setLoading(false);
    }
  }, [page, limit, searchQuery, startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenModal = useCallback((kebun: KebunData | null = null) => {
    setEditingKebun(kebun);
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setEditingKebun(null);
    setIsModalOpen(false);
  }, []);

  const handleSave = useCallback(async (formData: any) => {
    const isEditing = !!formData.id;
    
    const previousData = [...data];
    const previousTotal = totalItems;
    
    if (isEditing) {
        setData(prev => prev.map(item => item.id === formData.id ? { ...item, ...formData } : item));
    } else {
        const tempId = Math.random(); // Temp ID for UI
        const newItem = { ...formData, id: tempId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        setData(prev => [newItem, ...prev]);
        setTotalItems(prev => prev + 1);
    }
    
    handleCloseModal();

    const url = isEditing ? `/api/kebun/${formData.id}` : '/api/kebun';
    const method = isEditing ? 'PUT' : 'POST';

    let toastId: string | undefined
    try {
      toastId = toast.loading('Menyimpan kebun...')
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Gagal menyimpan data');
      }

      fetchData();
      toast.success(`Kebun berhasil ${isEditing ? 'diperbarui' : 'ditambahkan'}`, { id: toastId })
    } catch (error: any) {
      setData(previousData);
      setTotalItems(previousTotal);
      if (toastId) toast.dismiss(toastId)
      toast.error(error.message || 'Gagal menyimpan data, mengembalikan perubahan.');
    }
  }, [data, totalItems, fetchData, handleCloseModal]);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteConfirmId) return;
    const previousData = [...data];
    const previousTotal = totalItems;

    setData(prev => prev.filter(item => item.id !== deleteConfirmId));
    setTotalItems(prev => prev - 1);

    let toastId: string | undefined
    try {
      toastId = toast.loading('Menghapus kebun...')
      const res = await fetch(`/api/kebun/${deleteConfirmId}`, { method: 'DELETE' });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Gagal menghapus data');
      }

      fetchData();
      toast.success('Kebun berhasil dihapus', { id: toastId })
    } catch (error: any) {
      setData(previousData);
      setTotalItems(previousTotal);
      if (toastId) toast.dismiss(toastId)
      toast.error(error.message || 'Gagal menghapus data, mengembalikan perubahan.');
    } finally {
      setDeleteConfirmId(null);
    }
  }, [data, totalItems, fetchData, deleteConfirmId]);

  const applySearch = useCallback(() => {
    const trimmed = String(searchDraft || '').trim()
    if (trimmed && trimmed.length < 2) return
    setSearchQuery(trimmed)
    const params = new URLSearchParams(searchParams.toString());
    if (trimmed) {
      params.set('search', trimmed);
    } else {
      params.delete('search');
    }
    setPage(1)
    router.replace(`${pathname}?${params.toString()}`);
  }, [pathname, router, searchDraft, searchParams]);

  const totalPages = Math.ceil(totalItems / limit);
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value)
  const dateDisplay = useMemo(() => {
    if (!startDate || !endDate) return 'Semua waktu'
    const formatter = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' })
    return `${formatter.format(startDate)} - ${formatter.format(endDate)}`
  }, [startDate, endDate])

  // Nonaktifkan auto-redirect: MANAGER/MANDOR tetap melihat daftar kebun dulu

  return (
    <main className="p-4 md:p-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Manajemen Kebun</h1>
            <p className="text-gray-500 mt-1">Kelola data kebun dan operasional harian Anda.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="relative group w-full md:w-80">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
              </div>
              <input
                type="text"
                className="block w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm shadow-sm transition-all"
                placeholder="Cari kebun..."
                value={searchDraft}
                onChange={(e) => {
                  const next = e.target.value
                  setSearchDraft(next)
                  if (!String(next || '').trim()) {
                    setSearchQuery('')
                    setPage(1)
                    const params = new URLSearchParams(searchParams.toString())
                    params.delete('search')
                    router.replace(`${pathname}?${params.toString()}`)
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    applySearch()
                  }
                }}
              />
              <button
                type="button"
                onClick={applySearch}
                className="absolute inset-y-0 right-2 flex items-center rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                aria-label="Cari"
              >
                <MagnifyingGlassIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {(currentUserRole === 'ADMIN' || currentUserRole === 'PEMILIK') && (loading || summaryLoading) ? (
          <div className="mb-6">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-28" />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[1,2,3,4].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
              </div>
            </div>
          </div>
        ) : (currentUserRole === 'ADMIN' || currentUserRole === 'PEMILIK') ? (
          <div className="mb-6">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                    <MapPinIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Ringkasan Kebun</p>
                    <p className="text-xs text-gray-500">Produksi dan biaya per kebun</p>
                  </div>
                </div>
                <div className="flex flex-col sm:items-end gap-2 text-xs text-gray-500">
                  <div className="flex items-center gap-2">
                    <CalendarDaysIcon className="h-4 w-4 text-gray-400" />
                    <input
                      type="date"
                      value={startDate ? startDate.toISOString().slice(0, 10) : ''}
                      onChange={(event) => {
                        const value = event.target.value
                        setStartDate(value ? new Date(value) : undefined)
                        setPage(1)
                      }}
                      className="h-8 rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                    <span>-</span>
                    <input
                      type="date"
                      value={endDate ? endDate.toISOString().slice(0, 10) : ''}
                      onChange={(event) => {
                        const value = event.target.value
                        setEndDate(value ? new Date(value) : undefined)
                        setPage(1)
                      }}
                      className="h-8 rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </div>
                  <div>
                    Periode: <span className="font-semibold text-gray-900">{dateDisplay}</span>
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-xl bg-emerald-50/60 px-3 py-2">
                  <p className="text-xs text-emerald-700">Total Kebun</p>
                  <p className="text-lg font-semibold text-gray-900">{totalItems.toLocaleString('id-ID')}</p>
                </div>
                <div className="rounded-xl bg-amber-50/70 px-3 py-2">
                  <p className="text-xs text-amber-700">Total Produksi (Berat Akhir)</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {summary?.totalBeratAkhir || summary?.totalProduksi
                      ? `${Number(summary?.totalBeratAkhir ?? summary?.totalProduksi ?? 0).toLocaleString('id-ID')} Kg`
                      : '0 Kg'}
                  </p>
                </div>
                <div className="rounded-xl bg-sky-50/70 px-3 py-2">
                  <p className="text-xs text-sky-700">Total Bayar Net</p>
                  <p className="text-lg font-semibold text-gray-900">{formatCurrency(summary?.totalBayarNet ?? summary?.totalBiaya ?? 0)}</p>
                </div>
                <div className="rounded-xl bg-emerald-50/60 px-3 py-2">
                  <p className="text-xs text-emerald-700">Daftar Produksi Kebun (Berat Akhir)</p>
                  <div className="mt-1 space-y-1 text-sm text-gray-800">
                    {(summary?.produksiPerKebun || []).slice(0, 3).map(item => (
                      <div key={item.kebunId} className="flex items-center justify-between gap-2">
                        <span className="truncate">{formatKebunText(item.kebunName)}</span>
                        <span className="text-xs text-gray-500">{Number(item.totalBeratAkhir ?? item.totalProduksi ?? 0).toLocaleString('id-ID')} Kg</span>
                      </div>
                    ))}
                    {(!summary || summary.produksiPerKebun.length === 0) && (
                      <div className="text-xs text-gray-500">Belum ada data produksi</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
                <Skeleton className="h-6 w-3/4 rounded-lg" />
                <Skeleton className="h-4 w-1/2 rounded-lg" />
                <div className="pt-4 flex gap-2">
                  <Skeleton className="h-9 w-full rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl shadow-sm border border-gray-100">
            <div className="bg-blue-50 p-4 rounded-full mb-4">
              <MapPinIcon className="h-10 w-10 text-blue-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Tidak ada kebun ditemukan</h3>
            <p className="text-gray-500 mt-1 max-w-xs text-center">Coba cari dengan kata kunci lain atau tambah kebun baru.</p>
            {(currentUserRole === 'ADMIN' || currentUserRole === 'PEMILIK') && (
              <button
                onClick={() => handleOpenModal()}
                className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <PlusIcon className="h-5 w-5" />
                Tambah Kebun Baru
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {data.map((kebun) => (
                <div 
                  key={kebun.id} 
                  className="group bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-200 transition-all duration-300 overflow-hidden"
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="bg-blue-50 p-2.5 rounded-xl text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <MapPinIcon className="h-6 w-6" />
                      </div>
                      {(currentUserRole === 'ADMIN' || currentUserRole === 'PEMILIK') && (
                        <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleOpenModal(kebun)}
                            className="p-2 md:p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Ubah"
                          >
                            <PencilSquareIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(kebun.id)}
                            className="p-2 md:p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Hapus"
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        </div>
                      )}
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                      {formatKebunText(kebun.name)}
                    </h3>
                    {kebun.location && (
                      <p className="text-gray-500 text-sm mt-1 flex items-center gap-1.5">
                        <MapPinIcon className="h-4 w-4 shrink-0" />
                        <span className="line-clamp-1">{formatKebunText(kebun.location)}</span>
                      </p>
                    )}
                    <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <CalendarDaysIcon className="h-3.5 w-3.5" />
                        {new Date(kebun.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-500 font-medium uppercase tracking-wider">
                        ID: {kebun.id}
                      </span>
                    </div>
                  </div>
                  <Link
                    href={`/kebun/${kebun.id}`}
                    className="block w-full py-3 bg-gray-50 group-hover:bg-blue-600 text-center text-sm font-bold text-gray-600 group-hover:text-white transition-all border-t border-gray-100 group-hover:border-blue-600 flex items-center justify-center gap-2"
                  >
                    <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                    Kelola Kebun
                  </Link>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-12 flex items-center justify-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-xl border border-gray-200 bg-white text-gray-500 disabled:opacity-50 hover:bg-gray-50 transition-colors"
                >
                  <ChevronLeftIcon className="h-5 w-5" />
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setPage(i + 1)}
                      className={`w-10 h-10 rounded-xl text-sm font-bold transition-all ${
                        page === i + 1 
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-200' 
                        : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 rounded-xl border border-gray-200 bg-white text-gray-500 disabled:opacity-50 hover:bg-gray-50 transition-colors"
                >
                  <ChevronRightIcon className="h-5 w-5" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

        {currentUserRole === 'ADMIN' || currentUserRole === 'PEMILIK' ? (
          <button
            onClick={() => handleOpenModal()}
            className="fixed bottom-8 right-8 w-16 h-16 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl shadow-xl shadow-emerald-200 hover:shadow-2xl transition-all duration-300 flex items-center justify-center z-50 group active:scale-95"
            title="Tambah Kebun"
          >
            <PlusIcon className="w-8 h-8 group-hover:rotate-90 transition-transform duration-300" />
          </button>
        ) : null}

        <KebunModal 
          isOpen={isModalOpen} 
          onClose={handleCloseModal} 
          onSave={handleSave} 
          kebun={editingKebun} 
        />

      <ConfirmationModal
        isOpen={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={handleConfirmDelete}
        title="Konfirmasi Hapus Kebun"
        description="Apakah Anda yakin ingin menghapus data kebun ini?"
        variant="emerald"
      />
    </main>
  )
}
