
'use client'

import { useState, useEffect, useCallback } from 'react'
import { DataTable } from '@/components/data-table'
import { columns, PerusahaanData } from './columns'
import PerusahaanModal from './modal'
import toast from 'react-hot-toast'
 
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import { 
  PlusIcon, 
  BuildingOfficeIcon,
  MagnifyingGlassIcon, 
  ChevronLeftIcon,
  ChevronRightIcon,
  CalendarDaysIcon
} from '@heroicons/react/24/outline'
import { Skeleton } from '@/components/ui/skeleton'

export default function PerusahaanPage() {
  const [data, setData] = useState<PerusahaanData[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [limit, setLimit] = useState(10);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPerusahaan, setEditingPerusahaan] = useState<PerusahaanData | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [summary, setSummary] = useState<{
    totalPerusahaan: number;
    totalPabrik: number;
    totalNota: number;
  } | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const startDateString = startDate?.toISOString() || '';
      const endDateString = endDate?.toISOString() || '';
      const res = await fetch(`/api/perusahaan?page=${page}&limit=${limit}&search=${encodeURIComponent(searchQuery)}&startDate=${startDateString}&endDate=${endDateString}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Gagal mengambil data');
      const result = await res.json();
      setData(result.data);
      setTotalItems(result.total);

      setSummaryLoading(true);
      try {
        const summaryRes = await fetch(`/api/perusahaan/summary?search=${encodeURIComponent(searchQuery)}&startDate=${startDateString}&endDate=${endDateString}`, { cache: 'no-store' });
        if (summaryRes.ok) {
          const summaryData = await summaryRes.json();
          setSummary(summaryData);
        }
      } finally {
        setSummaryLoading(false);
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

  const handleOpenModal = useCallback((perusahaan: PerusahaanData | null = null) => {
    setEditingPerusahaan(perusahaan);
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setEditingPerusahaan(null);
    setIsModalOpen(false);
  }, []);

  const handleSave = useCallback(async (formData: any) => {
    const isEditing = !!formData.id;
    const url = isEditing ? `/api/perusahaan/${formData.id}` : '/api/perusahaan';
    const method = isEditing ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Gagal menyimpan data');
      }

      toast.success(`Data perusahaan ${isEditing ? 'diperbarui' : 'disimpan'}`);
      handleCloseModal();
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Gagal menyimpan data');
    }
  }, [fetchData, handleCloseModal]);

  const handleDelete = useCallback(async () => {
    if (!deleteConfirmId) return;
    try {
      const res = await fetch(`/api/perusahaan/${deleteConfirmId}`, { method: 'DELETE' });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Gagal menghapus data');
      }
      toast.success('Data perusahaan berhasil dihapus');
      setDeleteConfirmId(null);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Gagal menghapus data');
    }
  }, [deleteConfirmId, fetchData]);

  const dateDisplay = startDate && endDate 
    ? `${startDate.toLocaleDateString('id-ID')} - ${endDate.toLocaleDateString('id-ID')}`
    : 'Semua Waktu';

  const applySearch = useCallback(() => {
    const trimmed = String(searchDraft || '').trim()
    if (trimmed && trimmed.length < 2) return
    setSearchQuery(trimmed)
    setPage(1)
  }, [searchDraft])

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 max-w-7xl mx-auto w-full min-h-screen bg-gray-50/50">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-emerald-50 flex items-center justify-center border border-emerald-100 shadow-sm">
            <BuildingOfficeIcon className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Manajemen Perusahaan</h1>
            <p className="text-sm text-gray-500 font-medium">Kelola daftar perusahaan mitra</p>
          </div>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl transition-all shadow-md hover:shadow-lg active:scale-95 font-semibold text-sm"
        >
          <PlusIcon className="h-5 w-5" />
          Tambah Perusahaan
        </button>
      </div>

      {/* Filter & Search Section */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <div className="md:col-span-8 relative group">
          <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-emerald-600 transition-colors" />
          <input
            type="text"
            placeholder="Cari berdasarkan nama, email, atau telepon..."
            className="w-full pl-12 pr-11 py-3 bg-gray-50 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none text-sm placeholder:text-gray-400"
            value={searchDraft}
            onChange={(e) => {
              const next = e.target.value
              setSearchDraft(next)
              if (!String(next || '').trim()) {
                setSearchQuery('')
                setPage(1)
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
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Cari"
          >
            <MagnifyingGlassIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="md:col-span-4">
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
                className="h-10 rounded-xl border border-gray-200 bg-gray-50 px-3 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
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
                className="h-10 rounded-xl border border-gray-200 bg-gray-50 px-3 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
              />
            </div>
            <div className="font-medium text-gray-500">
              Periode: <span className="text-emerald-700 font-bold">{dateDisplay}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Statistic Section */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition-all duration-300">
          <div className="h-12 w-12 rounded-xl bg-emerald-50 flex items-center justify-center border border-emerald-100 shadow-sm">
            <BuildingOfficeIcon className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Perusahaan</p>
            {summaryLoading ? (
              <Skeleton className="h-7 w-16 mt-1" />
            ) : (
              <p className="text-2xl font-bold text-gray-900">
                {summary?.totalPerusahaan || 0}
              </p>
            )}
          </div>
        </div>
        
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition-all duration-300">
          <div className="h-12 w-12 rounded-xl bg-emerald-50 flex items-center justify-center border border-emerald-100 shadow-sm">
            <BuildingOfficeIcon className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Pabrik Terkait</p>
            {summaryLoading ? (
              <Skeleton className="h-7 w-16 mt-1" />
            ) : (
              <p className="text-2xl font-bold text-gray-900">
                {summary?.totalPabrik || 0}
              </p>
            )}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition-all duration-300">
          <div className="h-12 w-12 rounded-xl bg-emerald-50 flex items-center justify-center border border-emerald-100 shadow-sm">
            <CalendarDaysIcon className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Nota Sawit</p>
            {summaryLoading ? (
              <Skeleton className="h-7 w-16 mt-1" />
            ) : (
              <p className="text-2xl font-bold text-gray-900">
                {summary?.totalNota || 0}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-4">
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <DataTable 
                columns={columns(handleOpenModal, setDeleteConfirmId)} 
                data={data} 
              />
            </div>
            
            {/* Pagination */}
            <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 bg-gray-50/50 border-t border-gray-100 gap-4">
              <p className="text-sm font-medium text-gray-600 order-2 sm:order-1">
                Menampilkan <span className="text-gray-900 font-bold">{data.length}</span> dari <span className="text-gray-900 font-bold">{totalItems}</span> data
              </p>
              <div className="flex items-center gap-2 order-1 sm:order-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeftIcon className="h-5 w-5" />
                </button>
                <div className="flex items-center gap-1">
                  {[...Array(Math.ceil(totalItems / limit))].map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setPage(i + 1)}
                      className={`h-9 w-9 rounded-lg text-sm font-bold transition-all ${
                        page === i + 1 
                        ? 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-500/20' 
                        : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setPage(p => Math.min(Math.ceil(totalItems / limit), p + 1))}
                  disabled={page >= Math.ceil(totalItems / limit)}
                  className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRightIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <PerusahaanModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSave}
        perusahaan={editingPerusahaan}
      />

      <ConfirmationModal
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={handleDelete}
        title="Hapus Perusahaan"
        description="Apakah Anda yakin ingin menghapus data perusahaan ini? Tindakan ini tidak dapat dibatalkan."
        variant="emerald"
      />
    </div>
  );
}
