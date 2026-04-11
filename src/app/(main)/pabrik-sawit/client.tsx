'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { DataTable } from '@/components/data-table';
import { createPabrikSawitColumns } from './columns';
import { Button } from '@/components/ui/button';
import { PabrikSawit } from '@/lib/definitions';
import { toast } from 'sonner';
import { ConfirmationModal } from '@/components/ui/confirmation-modal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, PlusIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import PabrikSawitModal from './modal';
import Link from 'next/link';

interface PabrikSawitSummary {
  totalPabrik: number;
  bestAvgPrice?: {
    pabrikSawitId: number
    name: string
    rataRataHarga: number
    totalBerat: number
    totalNilai: number
    totalNota: number
  } | null
  highestPotonganPercent?: {
    pabrikSawitId: number
    name: string
    potonganPercent: number
    totalPotongan: number
    totalBeratNetto: number
    totalNota: number
  } | null
  highestTonase?: {
    pabrikSawitId: number
    name: string
    totalBerat: number
    totalNota: number
  } | null
  highestPembayaran?: {
    pabrikSawitId: number
    name: string
    totalNilai: number
    totalNota: number
  } | null
  selisihPerPabrik?: Array<{
    pabrikSawitId: number
    pabrikName: string
    jumlahNota: number
    totalBrutoKebun: number
    totalBrutoPabrik: number
    totalSelisihKg: number
    selisihPercent: number
    avgHargaPerKg: number
    estimasiPendapatanSelisih: number
    totalPembayaran: number
    totalBeratAkhir: number
  }>
}

export default function PabrikSawitClient() {
  const [data, setData] = useState<PabrikSawit[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [quickRange, setQuickRange] = useState('this_year');
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const q = searchParams.get('search') || '';
    if (q !== searchQuery) setSearchQuery(q);
  }, [searchParams, searchQuery]);

  useEffect(() => {
    // Initialize dates on client side to avoid hydration mismatch
    const today = new Date();
    const end = new Date(today);
    const start = new Date(today.getFullYear(), 0, 1);
    setQuickRange('this_year')
    setStartDate(start);
    setEndDate(end);
  }, []);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  const applyQuickRange = (val: string) => {
    setQuickRange(val);
    const today = new Date();
    const toDate = (d: Date) => d;
    
    if (val === 'today') {
      setStartDate(today);
      setEndDate(today);
    } else if (val === 'yesterday') {
      const y = new Date(today);
      y.setDate(today.getDate() - 1);
      setStartDate(y);
      setEndDate(y);
    } else if (val === 'last_week') {
      const end = new Date(today);
      const start = new Date(today);
      start.setDate(today.getDate() - 7);
      setStartDate(start);
      setEndDate(end);
    } else if (val === 'last_30_days') {
      const end = new Date(today);
      const start = new Date(today);
      start.setDate(today.getDate() - 30);
      setStartDate(start);
      setEndDate(end);
    } else if (val === 'this_month') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(start);
      setEndDate(today);
    } else if (val === 'this_year') {
      const start = new Date(today.getFullYear(), 0, 1);
      setStartDate(start);
      setEndDate(today);
    }
  };

  const [selectedPabrik, setSelectedPabrik] = useState<PabrikSawit | null>(null);
  const [rowSelection, setRowSelection] = useState({});
  const [summary, setSummary] = useState<PabrikSawitSummary | null>(null);

  const dateDisplay = useMemo(() => {
    if (quickRange && quickRange !== 'custom') {
      switch (quickRange) {
        case 'today': return 'Hari Ini';
        case 'yesterday': return 'Kemarin';
        case 'last_week': return '7 Hari Terakhir';
        case 'last_30_days': return '30 Hari Terakhir';
        case 'this_month': return 'Bulan Ini';
        case 'this_year': return 'Tahun Ini';
        default: return 'Pilih Rentang Waktu';
      }
    }
    if (startDate && endDate) {
       return `${format(startDate, 'dd MMM yyyy', { locale: idLocale })} - ${format(endDate, 'dd MMM yyyy', { locale: idLocale })}`;
    }
    return 'Pilih Rentang Waktu';
  }, [quickRange, startDate, endDate]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        search: searchQuery,
        ...(startDate && { startDate: startDate.toISOString() }),
        ...(endDate && { endDate: endDate.toISOString() }),
      });

      const summaryParams = new URLSearchParams({
        search: searchQuery,
        ...(startDate && { startDate: startDate.toISOString() }),
        ...(endDate && { endDate: endDate.toISOString() }),
      });

      const [dataRes, summaryRes] = await Promise.all([
        fetch(`/api/pabrik-sawit?${params.toString()}`),
        fetch(`/api/pabrik-sawit/summary?${summaryParams.toString()}`),
      ]);

      if (!dataRes.ok || !summaryRes.ok) {
        throw new Error('Gagal mengambil data');
      }

      const { data: rawData, total } = await dataRes.json();
      const summaryData = await summaryRes.json();

      const data = rawData.map((pabrik: any) => ({
        ...pabrik,
        createdAt: new Date(pabrik.createdAt),
        updatedAt: new Date(pabrik.updatedAt),
      }));

      setData(data);
      setTotalItems(total);
      setSummary(summaryData);
      setRowSelection({});
    } catch (error) {
      toast.error('Gagal mengambil data pabrik sawit');
    } finally {
      setLoading(false);
    }
  }, [page, limit, searchQuery, startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refreshData = useCallback(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenModal = useCallback((pabrik: PabrikSawit | null) => {
    setSelectedPabrik(pabrik);
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedPabrik(null);
    setIsModalOpen(false);
  }, []);

  const handleOpenDeleteConfirm = useCallback((pabrik: PabrikSawit) => {
    setSelectedPabrik(pabrik);
    setIsDeleteConfirmOpen(true);
  }, []);

  const handleCloseDeleteConfirm = useCallback(() => {
    setSelectedPabrik(null);
    setIsDeleteConfirmOpen(false);
  }, []);

  const handleSave = useCallback(async (formData: any) => {
    const previousData = [...data];
    const previousTotal = totalItems;
    const isEditing = !!formData.id;

    if (isEditing) {
      setData(prev => prev.map(item => item.id === formData.id ? { ...item, ...formData, updatedAt: new Date() } : item));
    } else {
      const tempId = Math.random();
      const newItem = { ...formData, id: tempId, createdAt: new Date(), updatedAt: new Date() };
      setData(prev => [newItem, ...prev]);
      setTotalItems(prev => prev + 1);
    }

    handleCloseModal();

    const url = formData.id ? `/api/pabrik-sawit/${formData.id}` : '/api/pabrik-sawit';
    const method = formData.id ? 'PUT' : 'POST';

    let toastId: string | number | undefined
    try {
      toastId = toast.loading('Menyimpan pabrik sawit...')
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        throw new Error('Gagal menyimpan data');
      }

      refreshData();
      toast.success(`Pabrik sawit berhasil ${isEditing ? 'diperbarui' : 'ditambahkan'}`, { id: toastId })
    } catch (error) {
      setData(previousData);
      setTotalItems(previousTotal);
      if (toastId) toast.dismiss(toastId)
      toast.error('Gagal menyimpan pabrik sawit, mengembalikan perubahan.');
    }
  }, [data, totalItems, handleCloseModal, refreshData]);

  const handleDelete = useCallback(async () => {
    if (!selectedPabrik) return;

    const previousData = [...data];
    const previousTotal = totalItems;

    setData(prev => prev.filter(item => item.id !== selectedPabrik.id));
    setTotalItems(prev => prev - 1);
    handleCloseDeleteConfirm();

    let toastId: string | number | undefined
    try {
      toastId = toast.loading('Menghapus pabrik sawit...')
      const res = await fetch(`/api/pabrik-sawit/${selectedPabrik.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Gagal menghapus data');
      }

      refreshData();
      toast.success('Pabrik sawit berhasil dihapus', { id: toastId })
    } catch (error) {
      setData(previousData);
      setTotalItems(previousTotal);
      if (toastId) toast.dismiss(toastId)
      toast.error('Gagal menghapus pabrik sawit, mengembalikan perubahan.');
    }
  }, [selectedPabrik, data, totalItems, handleCloseDeleteConfirm, refreshData]);

  const columns = useMemo(() => createPabrikSawitColumns(handleOpenModal, handleOpenDeleteConfirm), [handleOpenModal, handleOpenDeleteConfirm]);

  const tableMeta = useMemo(() => ({
    onUbah: handleOpenModal,
    onHapus: handleOpenDeleteConfirm,
    refreshData,
  }), [handleOpenModal, handleOpenDeleteConfirm, refreshData]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set('search', value);
    } else {
      params.delete('search');
    }
    router.replace(`${pathname}?${params.toString()}`);
  }, [pathname, router, searchParams]);

  const formatNumber = useCallback((value: number) => new Intl.NumberFormat('id-ID').format(value), []);
  const formatCurrency = useCallback((value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value), []);

  return (
    <main className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-white p-4 rounded-lg shadow-md">
                <Skeleton className="h-4 w-40 mb-2" />
                <Skeleton className="h-8 w-28" />
                <Skeleton className="h-3 w-48 mt-2" />
              </div>
            ))}
          </div>
        ) : summary && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg shadow-md">
              <p className="text-sm font-medium text-gray-500 truncate" title="Total Pabrik Sawit">Total Pabrik Sawit</p>
              <p className="text-2xl font-bold truncate" title={summary.totalPabrik.toString()}>{summary.totalPabrik}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-md">
              <p className="text-sm font-medium text-gray-500 truncate" title="Pabrik Harga Rata-rata Terbaik">Harga Rata-rata Terbaik</p>
              <p className="text-2xl font-bold truncate" title={formatCurrency(Number(summary.bestAvgPrice?.rataRataHarga || 0))}>
                {formatCurrency(Number(summary.bestAvgPrice?.rataRataHarga || 0))}
                <span className="text-sm font-semibold text-gray-500"> /kg</span>
              </p>
              <p className="text-xs text-gray-500 mt-1 truncate" title={summary.bestAvgPrice?.name || '-'}>
                {summary.bestAvgPrice?.name || '-'}
              </p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-md">
              <p className="text-sm font-medium text-gray-500 truncate" title="Pabrik Potongan Persen Terbesar">Potongan % Terbesar</p>
              <p className="text-2xl font-bold truncate" title={`${Number(summary.highestPotonganPercent?.potonganPercent || 0).toFixed(2)}%`}>
                {Number(summary.highestPotonganPercent?.potonganPercent || 0).toFixed(2)}%
              </p>
              <p className="text-xs text-gray-500 mt-1 truncate" title={summary.highestPotonganPercent?.name || '-'}>
                {summary.highestPotonganPercent?.name || '-'}
              </p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-md">
              <p className="text-sm font-medium text-gray-500 truncate" title="Pabrik Tonase Terbesar">Tonase Terbesar</p>
              <p className="text-2xl font-bold truncate" title={`${formatNumber(Number(summary.highestTonase?.totalBerat || 0))} kg`}>
                {formatNumber(Number(summary.highestTonase?.totalBerat || 0))} kg
              </p>
              <p className="text-xs text-gray-500 mt-1 truncate" title={summary.highestTonase?.name || '-'}>
                {summary.highestTonase?.name || '-'}
              </p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-md">
              <p className="text-sm font-medium text-gray-500 truncate" title="Pabrik Nilai Pembayaran Terbesar">Pembayaran Terbesar</p>
              <p className="text-2xl font-bold truncate" title={formatCurrency(Number(summary.highestPembayaran?.totalNilai || 0))}>
                {formatCurrency(Number(summary.highestPembayaran?.totalNilai || 0))}
              </p>
              <p className="text-xs text-gray-500 mt-1 truncate" title={summary.highestPembayaran?.name || '-'}>
                {summary.highestPembayaran?.name || '-'}
              </p>
            </div>
          </div>
        )}

        {!loading && summary?.selisihPerPabrik && summary.selisihPerPabrik.length > 0 ? (
          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold text-gray-900">Selisih Timbangan Kebun vs Pabrik</div>
                <div className="text-xs text-gray-500">Akumulasi selisih bruto per pabrik pada periode terpilih</div>
              </div>
              <div className="text-xs text-gray-500 whitespace-nowrap">Periode: <span className="font-semibold text-gray-900">{dateDisplay}</span></div>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left">Pabrik</th>
                    <th className="px-3 py-2 text-right">Nota</th>
                    <th className="hidden md:table-cell px-3 py-2 text-right">Bruto Kebun</th>
                    <th className="hidden md:table-cell px-3 py-2 text-right">Bruto Pabrik</th>
                    <th className="px-3 py-2 text-right">Selisih</th>
                    <th className="hidden lg:table-cell px-3 py-2 text-right">Selisih %</th>
                    <th className="hidden md:table-cell px-3 py-2 text-right">Harga Rata2</th>
                    <th className="px-3 py-2 text-right">Estimasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {summary.selisihPerPabrik.map((r) => (
                    <tr key={r.pabrikSawitId} className="hover:bg-gray-50/50">
                      <td className="px-3 py-2 text-left font-medium text-gray-900 whitespace-nowrap">{r.pabrikName}</td>
                      <td className="px-3 py-2 text-right text-gray-700">{formatNumber(Number(r.jumlahNota || 0))}</td>
                      <td className="hidden md:table-cell px-3 py-2 text-right text-gray-700">{formatNumber(Math.round(Number(r.totalBrutoKebun || 0)))} kg</td>
                      <td className="hidden md:table-cell px-3 py-2 text-right text-gray-700">{formatNumber(Math.round(Number(r.totalBrutoPabrik || 0)))} kg</td>
                      <td className={`px-3 py-2 text-right font-semibold ${Number(r.totalSelisihKg || 0) >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                        {Number(r.totalSelisihKg || 0) >= 0 ? '+' : ''}{formatNumber(Math.round(Number(r.totalSelisihKg || 0)))} kg
                      </td>
                      <td className={`hidden lg:table-cell px-3 py-2 text-right font-semibold ${Number(r.selisihPercent || 0) >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                        {Number(r.selisihPercent || 0) >= 0 ? '+' : ''}{Number(r.selisihPercent || 0).toFixed(2)}%
                      </td>
                      <td className="hidden md:table-cell px-3 py-2 text-right text-gray-700 whitespace-nowrap" title={formatCurrency(Number(r.avgHargaPerKg || 0))}>
                        {formatCurrency(Number(r.avgHargaPerKg || 0))} /kg
                      </td>
                      <td className={`px-3 py-2 text-right font-semibold whitespace-nowrap ${Number(r.estimasiPendapatanSelisih || 0) >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                        {formatCurrency(Number(r.estimasiPendapatanSelisih || 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t border-gray-200">
                  <tr>
                    <td className="px-3 py-2 font-bold text-gray-900 whitespace-nowrap">TOTAL</td>
                    <td className="px-3 py-2 font-bold text-gray-900 text-right">
                      {formatNumber(summary.selisihPerPabrik.reduce((acc, r) => acc + Number(r.jumlahNota || 0), 0))}
                    </td>
                    <td className="hidden md:table-cell px-3 py-2 font-bold text-gray-900 text-right">
                      {formatNumber(Math.round(summary.selisihPerPabrik.reduce((acc, r) => acc + Number(r.totalBrutoKebun || 0), 0)))} kg
                    </td>
                    <td className="hidden md:table-cell px-3 py-2 font-bold text-gray-900 text-right">
                      {formatNumber(Math.round(summary.selisihPerPabrik.reduce((acc, r) => acc + Number(r.totalBrutoPabrik || 0), 0)))} kg
                    </td>
                    <td className="px-3 py-2 font-bold text-gray-900 text-right">
                      {(() => {
                        const totalSelisih = summary.selisihPerPabrik.reduce((acc, r) => acc + Number(r.totalSelisihKg || 0), 0)
                        return (
                          <span className={totalSelisih >= 0 ? 'text-emerald-700' : 'text-red-600'}>
                            {totalSelisih >= 0 ? '+' : ''}{formatNumber(Math.round(totalSelisih))} kg
                          </span>
                        )
                      })()}
                    </td>
                    <td className="hidden lg:table-cell px-3 py-2 font-bold text-gray-900 text-right">
                      {(() => {
                        const totalKebun = summary.selisihPerPabrik.reduce((acc, r) => acc + Number(r.totalBrutoKebun || 0), 0)
                        const totalSelisih = summary.selisihPerPabrik.reduce((acc, r) => acc + Number(r.totalSelisihKg || 0), 0)
                        const pct = totalKebun > 0 ? (totalSelisih / totalKebun) * 100 : 0
                        return (
                          <span className={pct >= 0 ? 'text-emerald-700' : 'text-red-600'}>
                            {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
                          </span>
                        )
                      })()}
                    </td>
                    <td className="hidden md:table-cell px-3 py-2 font-bold text-gray-900 text-right whitespace-nowrap">
                      {(() => {
                        const totalPembayaran = summary.selisihPerPabrik.reduce((acc, r) => acc + Number(r.totalPembayaran || 0), 0)
                        const totalBeratAkhir = summary.selisihPerPabrik.reduce((acc, r) => acc + Number(r.totalBeratAkhir || 0), 0)
                        const avg = totalBeratAkhir > 0 ? totalPembayaran / totalBeratAkhir : 0
                        return `${formatCurrency(avg)} /kg`
                      })()}
                    </td>
                    <td className="px-3 py-2 font-bold text-gray-900 text-right whitespace-nowrap">
                      {(() => {
                        const est = summary.selisihPerPabrik.reduce((acc, r) => acc + Number(r.estimasiPendapatanSelisih || 0), 0)
                        return (
                          <span className={est >= 0 ? 'text-emerald-700' : 'text-red-600'}>
                            {formatCurrency(est)}
                          </span>
                        )
                      })()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        ) : null}

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
            <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4 w-full lg:w-auto">
              <Input
                type="text"
                placeholder="Cari berdasarkan nama atau alamat..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full lg:w-96 p-2 border border-gray-300 rounded-xl"
              />
              <div className="flex flex-col sm:flex-row items-center gap-2 w-full lg:w-auto">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="date"
                      variant={"outline"}
                      className={cn(
                        "w-full sm:w-[260px] justify-start text-left font-normal",
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
                        <Button variant="outline" size="sm" onClick={() => applyQuickRange('this_year')} className={quickRange === 'this_year' ? 'bg-accent' : ''}>Tahun Ini</Button>
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
            </div>
            <button
            onClick={() => handleOpenModal(null)}
            className="fixed bottom-6 right-6 w-14 h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center z-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
            title="Tambah Pabrik"
          >
            <PlusIcon className="w-8 h-8" />
          </button>
          </div>
          <div className="md:hidden space-y-3">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))
            ) : data.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center text-sm text-gray-500">
                Belum ada pabrik
              </div>
            ) : (
              data.map((pabrik) => (
                <div key={pabrik.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-3">
                  <div className="space-y-1">
                    <div className="font-semibold text-gray-900">{pabrik.name}</div>
                    <div className="text-xs text-gray-500">{pabrik.address || '-'}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-gray-400">Berat Netto</div>
                      <div className="font-semibold text-gray-900">{pabrik.stats?.totalBeratNetto ? `${formatNumber(pabrik.stats.totalBeratNetto)} kg` : '-'}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Total Potongan</div>
                      <div className="font-semibold text-gray-900">{pabrik.stats?.totalPotongan ? `${formatNumber(pabrik.stats.totalPotongan)} kg` : '-'}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Total Berat</div>
                      <div className="font-semibold text-gray-900">{pabrik.stats?.totalBerat ? `${formatNumber(pabrik.stats.totalBerat)} kg` : '-'}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Total Penjualan</div>
                      <div className="font-semibold text-emerald-700">{pabrik.stats?.totalNilai ? formatCurrency(pabrik.stats.totalNilai) : '-'}</div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-gray-400">Rata-rata Harga</div>
                      <div className="font-semibold text-gray-900">{pabrik.stats?.rataRataHarga ? formatCurrency(pabrik.stats.rataRataHarga) : '-'}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button size="sm" variant="outline" className="rounded-full" asChild>
                      <Link href={`/nota-sawit?pabrikId=${pabrik.id}`}>Lihat Nota</Link>
                    </Button>
                    <Button size="sm" variant="outline" className="rounded-full" onClick={() => handleOpenModal(pabrik)}>
                      Ubah
                    </Button>
                    <Button size="sm" variant="destructive" className="rounded-full" onClick={() => handleOpenDeleteConfirm(pabrik)}>
                      Hapus
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="hidden md:block">
            <DataTable columns={columns} data={data} meta={tableMeta} rowSelection={rowSelection} setRowSelection={setRowSelection} isLoading={loading} />
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
            <div className="text-sm text-gray-700 text-center sm:text-left w-full sm:w-auto">
              Menampilkan {Math.min((page - 1) * limit + 1, totalItems)} - {Math.min(page * limit, totalItems)} dari {totalItems} pabrik
            </div>
            <div className="flex w-full sm:w-auto gap-2 justify-center sm:justify-end">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page <= 1 || loading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
              >
                Sebelumnya
              </button>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page * limit >= totalItems || loading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
              >
                Berikutnya
              </button>
            </div>
          </div>
        </div>
      </div>
      <PabrikSawitModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSave}
        pabrik={selectedPabrik}
      />

      <ConfirmationModal
        isOpen={isDeleteConfirmOpen}
        onClose={handleCloseDeleteConfirm}
        onConfirm={handleDelete}
        title="Konfirmasi Hapus"
        description="Apakah Anda yakin ingin menghapus pabrik sawit ini?"
      />
    </main>
  );
}
