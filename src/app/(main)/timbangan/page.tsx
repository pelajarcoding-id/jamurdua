'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { DataTable } from '@/components/data-table'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { columns, TimbanganData } from './columns'
import { Skeleton } from '@/components/ui/skeleton'
import TimbanganModal from './modal'
import ModalDetail from './detail-modal'
import type { Kebun, User, Kendaraan } from '@prisma/client'
import toast from 'react-hot-toast'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { CalendarIcon, ScaleIcon } from "@heroicons/react/24/outline"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { format } from "date-fns"
import { id } from "date-fns/locale"
import { ConfirmationModal } from "@/components/ui/confirmation-modal"
import { useAuth } from '@/components/AuthProvider'

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

interface SummaryData {
  totalTimbangan: number;
  totalKendaraan: number;
  totalSupir: number;
}

export default function TimbanganPage() {
  const { role } = useAuth()
  const [data, setData] = useState<TimbanganData[]>([]);
  const [kebunList, setKebunList] = useState<Kebun[]>([]);
  const [supirList, setSupirList] = useState<User[]>([]);
  const [kendaraanList, setKendaraanList] = useState<Kendaraan[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [limit, setLimit] = useState(10);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [editingTimbangan, setEditingTimbangan] = useState<TimbanganData | null>(null);
  const [selectedTimbangan, setSelectedTimbangan] = useState<TimbanganData | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 500);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    const q = searchParams.get('search') || ''
    if (q !== searchQuery) setSearchQuery(q)
  }, [searchParams, searchQuery])

  useEffect(() => {
    // Initialize dates on client side to avoid hydration mismatch
    const today = new Date();
    const end = new Date(today);
    const start = new Date(today);
    start.setDate(today.getDate() - 30);
    
    setStartDate(start);
    setEndDate(end);
  }, []);

  const [statusFilter, setStatusFilter] = useState('all');
  const [statusQuery, setStatusQuery] = useState('');
  const [openStatus, setOpenStatus] = useState(false);
  const [refreshToggle, setRefreshToggle] = useState(false);
  const [quickRange, setQuickRange] = useState<string>('today');
  const [openIdProcessed, setOpenIdProcessed] = useState<string | null>(null);

  const applyQuickRange = useCallback((val: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setQuickRange(val);
    
    if (val === 'today') {
      setStartDate(today);
      setEndDate(today);
    } else if (val === 'yesterday') {
      const y = new Date(today);
      y.setDate(today.getDate() - 1);
      setStartDate(y);
      setEndDate(y);
    } else if (val === 'last_week') {
      const w = new Date(today);
      w.setDate(today.getDate() - 7);
      setStartDate(w);
      setEndDate(today);
    } else if (val === 'last_30_days') {
      const m = new Date(today);
      m.setDate(today.getDate() - 30);
      setStartDate(m);
      setEndDate(today);
    } else if (val === 'this_month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(firstDay);
      setEndDate(today);
    }
  }, []);

  const dateDisplay = useMemo(() => {
    if (!startDate) return <span>Pilih tanggal</span>;
    if (startDate && endDate) {
      if (startDate.getTime() === endDate.getTime()) {
        return format(startDate, "dd MMM yyyy", { locale: id });
      }
      return (
        <>
          {format(startDate, "dd MMM yyyy", { locale: id })} -{" "}
          {format(endDate, "dd MMM yyyy", { locale: id })}
        </>
      );
    }
    return format(startDate, "dd MMM yyyy", { locale: id });
  }, [startDate, endDate]);

  const fetchData = useCallback(async () => {
    if (!startDate || !endDate) return;

    setLoading(true);
    try {
      const startDateString = startDate?.toISOString();
      const endDateString = endDate?.toISOString();

      const [timbanganRes, kebunRes, summaryRes, supirRes, kendaraanRes] = await Promise.all([
        fetch(`/api/timbangan?page=${page}&limit=${limit}&search=${debouncedSearchQuery}&startDate=${startDateString}&endDate=${endDateString}&status=${statusFilter}`, { cache: 'no-store' }),
        fetch('/api/kebun?limit=1000', { cache: 'no-store' }),
        fetch(`/api/timbangan/summary?search=${debouncedSearchQuery}&startDate=${startDateString}&endDate=${endDateString}`, { cache: 'no-store' }),
        fetch('/api/users?role=SUPIR&limit=1000', { cache: 'no-store' }),
        fetch('/api/kendaraan?limit=1000', { cache: 'no-store' })
      ]);

      if (!timbanganRes.ok || !kebunRes.ok || !summaryRes.ok) {
        throw new Error('Gagal mengambil data');
      }

      const timbanganData = await timbanganRes.json();
      const kebunData = await kebunRes.json();
      const summaryData = await summaryRes.json();
      const supirData = await supirRes.json();
      const kendaraanData = await kendaraanRes.json();

      setData(timbanganData.data);
      setTotalItems(timbanganData.total);
      setKebunList(kebunData.data || []);
      setSupirList(supirData.data || []);
      setKendaraanList(kendaraanData.data || []);
      setSummary(summaryData);
    } catch (error) {
      toast.error('Gagal memuat data. Coba lagi nanti.');
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearchQuery, startDate, endDate, statusFilter])

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const openId = searchParams.get('openId');
    if (!openId || openIdProcessed === openId) return;
    (async () => {
      try {
        const res = await fetch(`/api/timbangan/list?includeId=${encodeURIComponent(openId)}`, { cache: 'no-store' });
        if (!res.ok) return;
        const items: TimbanganData[] = await res.json();
        const found = items.find(it => String(it.id) === String(openId));
        if (found) {
          setSelectedTimbangan(found);
          setIsDetailModalOpen(true);
          setOpenIdProcessed(openId);
        }
      } catch {}
    })();
  }, [searchParams, openIdProcessed]);

  const handleOpenModal = useCallback((timbangan: TimbanganData | null = null) => {
    setEditingTimbangan(timbangan);
    setIsModalOpen(true);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value)
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set('search', value)
    } else {
      params.delete('search')
    }
    router.replace(`${pathname}?${params.toString()}`)
  }, [pathname, router, searchParams])

  const handleCloseModal = useCallback(() => {
    setEditingTimbangan(null);
    setIsModalOpen(false);
  }, []);

  const handleOpenDetailModal = useCallback((timbangan: TimbanganData) => {
    setSelectedTimbangan(timbangan);
    setIsDetailModalOpen(true);
  }, []);

  const handleCloseDetailModal = useCallback(() => {
    setSelectedTimbangan(null);
    setIsDetailModalOpen(false);
  }, []);

  const handleSave = useCallback(async (formData: any) => {
    const isEditing = !!formData.id;
    
    const previousData = [...data];
    const previousTotal = totalItems;
    
    // Helper to find related objects for optimistic UI
    const kebun = kebunList.find(k => k.id === Number(formData.kebunId)) || { id: 0, name: 'Loading...', createdAt: new Date(), updatedAt: new Date(), code: '' };
    const supir = supirList.find(s => s.id === Number(formData.supirId)) || null;
    const kendaraan = kendaraanList.find(k => k.platNomor === formData.kendaraanPlatNomor) || null;

    const optimisticItem: TimbanganData = {
        id: isEditing ? formData.id : Math.random(),
        ...formData,
        kebun,
        supir,
        kendaraan,
        createdAt: new Date(),
        updatedAt: new Date(),
        photoUrl: null, // Assuming no photo update in optimistic for now
        kebunId: Number(formData.kebunId),
        supirId: Number(formData.supirId),
        kendaraanPlatNomor: formData.kendaraanPlatNomor,
        grossKg: Number(formData.grossKg),
        tareKg: Number(formData.tareKg),
        netKg: Number(formData.netKg),
        date: new Date(formData.date),
    };

    if (isEditing) {
        setData(prev => prev.map(item => item.id === formData.id ? { ...item, ...optimisticItem } : item));
    } else {
        setData(prev => [optimisticItem, ...prev]);
        setTotalItems(prev => prev + 1);
    }

    handleCloseModal();

    const url = isEditing ? `/api/timbangan/${formData.id}` : '/api/timbangan';
    const method = isEditing ? 'PUT' : 'POST';

    let toastId: string | undefined
    try {
      toastId = toast.loading('Menyimpan data timbangan...')
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
      toast.success(`Data timbangan berhasil ${isEditing ? 'diperbarui' : 'ditambahkan'}`, { id: toastId })
    } catch (error: any) {
      setData(previousData);
      setTotalItems(previousTotal);
      if (toastId) toast.dismiss(toastId)
      toast.error(error.message || 'Gagal menyimpan data, mengembalikan perubahan.');
    }
  }, [data, totalItems, kebunList, supirList, kendaraanList, fetchData, handleCloseModal]);

  const handleDelete = useCallback(async (id: number) => {
    const previousData = [...data];
    const previousTotal = totalItems;

    setData(prev => prev.filter(item => item.id !== id));
    setTotalItems(prev => prev - 1);

    let toastId: string | undefined
    try {
      toastId = toast.loading('Menghapus data timbangan...')
      const res = await fetch(`/api/timbangan/${id}`, { method: 'DELETE' });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Gagal menghapus data');
      }

      fetchData();
      toast.success('Data timbangan berhasil dihapus', { id: toastId })
    } catch (error: any) {
      setData(previousData);
      setTotalItems(previousTotal);
      if (toastId) toast.dismiss(toastId)
      toast.error(error.message || 'Gagal menghapus data, mengembalikan perubahan.');
    }
  }, [data, totalItems, fetchData]);

  const handleOpenDeleteConfirm = useCallback((id: number) => {
    setDeleteTargetId(id);
    setIsDeleteConfirmOpen(true);
  }, []);

  const handleCloseDeleteConfirm = useCallback(() => {
    setIsDeleteConfirmOpen(false);
    setDeleteTargetId(null);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (deleteTargetId === null) return;
    handleDelete(deleteTargetId);
    handleCloseDeleteConfirm();
  }, [deleteTargetId, handleDelete, handleCloseDeleteConfirm]);
  
  const canMutate = String(role || '').toUpperCase() !== 'SUPIR'
  const tableColumns = useMemo(() => columns(page, limit, handleOpenDetailModal, handleOpenModal, handleOpenDeleteConfirm, canMutate), [page, limit, handleOpenDetailModal, handleOpenModal, handleOpenDeleteConfirm, canMutate]);
  const tableMeta = useMemo(() => ({
    onRowClick: handleOpenDetailModal,
  }), [handleOpenDetailModal]);
  const formatNumber = useCallback((value: number) => value.toLocaleString('id-ID'), []);
  const formatDate = useCallback((value: Date) => new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }), []);

  return (
    <main className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Manajemen Timbangan</h1>

        {loading ? (
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
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="rounded-xl bg-gray-50 px-3 py-2 space-y-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-6 w-24" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : summary && (
          <div className="mb-6">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                    <ScaleIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Ringkasan Timbangan</p>
                    <p className="text-xs text-gray-500">Total data dan akumulasi berat</p>
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  Periode: <span className="font-semibold text-gray-900">{dateDisplay}</span>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl bg-emerald-50/60 px-3 py-2">
                  <p className="text-xs text-emerald-700">Total Timbangan</p>
                  <p className="text-lg font-semibold text-gray-900" title={summary.totalTimbangan.toLocaleString('id-ID')}>
                    {summary.totalTimbangan.toLocaleString('id-ID')}
                  </p>
                </div>
                <div className="rounded-xl bg-amber-50/70 px-3 py-2">
                  <p className="text-xs text-amber-700">Total Kendaraan</p>
                  <p className="text-lg font-semibold text-gray-900" title={summary.totalKendaraan.toLocaleString('id-ID')}>
                    {summary.totalKendaraan.toLocaleString('id-ID')}
                  </p>
                </div>
                <div className="rounded-xl bg-sky-50/70 px-3 py-2">
                  <p className="text-xs text-sky-700">Total Supir</p>
                  <p className="text-lg font-semibold text-gray-900" title={summary.totalSupir.toLocaleString('id-ID')}>
                    {summary.totalSupir.toLocaleString('id-ID')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="card-style">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
            <div className="flex flex-col md:flex-row flex-wrap items-start md:items-center gap-4 flex-1 w-full lg:w-auto">
              <div className="w-full md:w-64 flex-shrink-0">
                <Input
                  placeholder="Cari kebun, supir, nopol..."
                  value={searchQuery}
                  onChange={(event) => handleSearchChange(event.target.value)}
                  className="input-style rounded-xl"
                />
              </div>
              <div className="w-full md:w-auto flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="date"
                      variant={"outline"}
                      className={cn(
                        "w-full sm:w-[260px] justify-start text-left font-normal bg-white rounded-xl",
                        !startDate && "text-muted-foreground"
                      )}
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
                            <Label htmlFor="start-date" className="text-xs">Dari</Label>
                            <Input
                              id="start-date"
                              type="date"
                              className="col-span-2 h-8"
                              value={startDate ? startDate.toISOString().split('T')[0] : ''}
                              onChange={(e) => {
                                setStartDate(e.target.value ? new Date(e.target.value) : undefined);
                                setQuickRange('custom');
                              }}
                            />
                          </div>
                          <div className="grid grid-cols-3 items-center gap-4">
                            <Label htmlFor="end-date" className="text-xs">Sampai</Label>
                            <Input
                              id="end-date"
                              type="date"
                              className="col-span-2 h-8"
                              value={endDate ? endDate.toISOString().split('T')[0] : ''}
                              onChange={(e) => {
                                setEndDate(e.target.value ? new Date(e.target.value) : undefined);
                                setQuickRange('custom');
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="w-full md:w-48">
                <Popover open={openStatus} onOpenChange={setOpenStatus}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="input-style w-full flex items-center justify-between rounded-xl"
                      aria-haspopup="listbox"
                    >
                      <span>
                        {statusFilter === 'all' ? 'Semua Status' : statusFilter === 'processed' ? 'Sudah Diproses' : 'Belum Diproses'}
                      </span>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.939l3.71-3.71a.75.75 0 111.06 1.061l-4.24 4.24a.75.75 0 01-1.06 0l-4.24-4.24a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="p-2 w-[--radix-popover-trigger-width] max-h-60 overflow-y-auto bg-white rounded-xl border shadow-sm">
                    <Input
                      placeholder="Cari status…"
                      value={statusQuery}
                      onChange={(e) => setStatusQuery(e.target.value)}
                      className="mb-2 rounded-lg"
                    />
                    <div role="listbox" className="space-y-1">
                      {[
                        { val: 'all', label: 'Semua Status' },
                        { val: 'processed', label: 'Sudah Diproses' },
                        { val: 'unprocessed', label: 'Belum Diproses' },
                      ]
                        .filter(s => s.label.toLowerCase().includes(statusQuery.toLowerCase()))
                        .map(s => (
                          <button
                            key={s.val}
                            type="button"
                            onClick={() => { setStatusFilter(s.val); setOpenStatus(false); }}
                            className={`w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 ${statusFilter === s.val ? 'bg-blue-50 text-blue-700' : ''}`}
                          >
                            {s.label}
                          </button>
                        ))}
                      {[
                        { val: 'all', label: 'Semua Status' },
                        { val: 'processed', label: 'Sudah Diproses' },
                        { val: 'unprocessed', label: 'Belum Diproses' },
                      ].filter(s => s.label.toLowerCase().includes(statusQuery.toLowerCase())).length === 0 && (
                        <div className="px-3 py-2 text-sm text-gray-500">Tidak ditemukan</div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <button onClick={() => handleOpenModal()} className="flex items-center justify-center gap-2 whitespace-nowrap w-full lg:w-auto rounded-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 font-semibold shadow-sm">
              Tambah Timbangan
            </button>
          </div>

          <div className="md:hidden space-y-3">
            {loading ? (
              [...Array(3)].map((_, i) => (
                <div key={i} className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))
            ) : data.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center text-sm text-gray-500">
                Belum ada data timbangan
              </div>
            ) : (
              data.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleOpenDetailModal(item)}
                  className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-3 transition-colors hover:bg-gray-50/50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="font-semibold text-gray-900">{item.kebun?.name || '-'}</div>
                      <div className="text-xs text-gray-500">{formatDate(item.date)}</div>
                      <div className="text-xs text-gray-500">{item.supir?.name || '-'} • {item.kendaraan?.platNomor || '-'}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <div className="text-gray-400">Bruto</div>
                      <div className="font-semibold text-gray-900">{formatNumber(item.grossKg)} Kg</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Tara</div>
                      <div className="font-semibold text-gray-900">{formatNumber(item.tareKg)} Kg</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Netto</div>
                      <div className="font-semibold text-emerald-700">{formatNumber(item.netKg)} Kg</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button size="sm" variant="outline" className="rounded-full" onClick={(e) => { e.stopPropagation(); handleOpenDetailModal(item); }}>
                      Detail
                    </Button>
                    <Button size="sm" variant="outline" className="rounded-full" onClick={(e) => { e.stopPropagation(); handleOpenModal(item); }}>
                      Ubah
                    </Button>
                    <Button size="sm" variant="destructive" className="rounded-full" onClick={(e) => { e.stopPropagation(); handleOpenDeleteConfirm(item.id); }}>
                      Hapus
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="hidden md:block overflow-hidden rounded-xl border border-gray-100">
            <DataTable 
              columns={tableColumns} 
              data={data} 
              meta={tableMeta}
              isLoading={loading}
            />
          </div>

          <div className="flex flex-col md:flex-row items-center justify-center md:justify-between gap-4 mt-6 pt-4 border-t border-gray-100">
            <div className="text-sm text-gray-500">
              Menampilkan <span className="font-medium text-gray-800">{Math.min((page - 1) * limit + 1, totalItems)}</span> - <span className="font-medium text-gray-800">{Math.min(page * limit, totalItems)}</span> dari <span className="font-medium text-gray-800">{totalItems}</span> data
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Per halaman</span>
                <select
                  value={limit}
                  onChange={(e) => { setLimit(Number(e.target.value) || 10); setPage(1); }}
                  className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
              <div className="flex space-x-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1 || loading}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Sebelumnya
              </button>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page * limit >= totalItems || loading}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Berikutnya
              </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <TimbanganModal 
        isOpen={isModalOpen} 
        onClose={handleCloseModal} 
        onSave={handleSave} 
        timbangan={editingTimbangan} 
        kebunList={kebunList}
        supirList={supirList}
        kendaraanList={kendaraanList}
      />

      {isDetailModalOpen && selectedTimbangan && (
        <ModalDetail 
          timbangan={selectedTimbangan} 
          onClose={handleCloseDetailModal} 
        />
      )}

      <ConfirmationModal
        isOpen={isDeleteConfirmOpen}
        onClose={handleCloseDeleteConfirm}
        onConfirm={handleConfirmDelete}
        title="Konfirmasi Hapus"
        description="Apakah Anda yakin ingin menghapus data timbangan ini?"
        variant="emerald"
      />
    </main>
  )
}
