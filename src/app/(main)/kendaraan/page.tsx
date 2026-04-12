'use client'

import { useState, useEffect, useMemo, useCallback, useRef, type SetStateAction } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { DataTable } from '@/components/ui/data-table'
import { columns, KendaraanData } from './columns'
import { KendaraanModal, ConfirmationModal } from './modal'
import { ServiceModal } from './service-modal'
import { DocumentRenewalModal } from './document-renewal-modal'
import { DetailModal } from './detail-modal'
import VehicleSummary from './components/VehicleSummary'
import type { Kendaraan } from '@prisma/client'
import toast from 'react-hot-toast'
import { useDebounce } from '@/hooks/useDebounce'
import RoleGate from '@/components/RoleGate'
import { PlusIcon, ArrowDownOnSquareIcon, ArrowPathIcon, ArrowDownTrayIcon, DocumentTextIcon, PhotoIcon, XMarkIcon, CalendarIcon } from '@heroicons/react/24/outline'
import useSWR, { mutate as swrMutate } from 'swr'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import Image from 'next/image';
import ImageViewer from '@/components/ui/ImageViewer';
import { Skeleton } from '@/components/ui/skeleton';

export default function KendaraanPage() {
  const [data, setData] = useState<KendaraanData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshingMain, setRefreshingMain] = useState(false);
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [limit, setLimit] = useState(10);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [isDocumentRenewalModalOpen, setIsDocumentRenewalModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedKendaraan, setSelectedKendaraan] = useState<KendaraanData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [jenisFilter, setJenisFilter] = useState<string>('all')
  const [jenisOptions, setJenisOptions] = useState<string[]>([])
  const debouncedSearchQuery = useDebounce(searchQuery, 500);
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const q = searchParams.get('search') || '';
    if (q !== searchQuery) setSearchQuery(q);
  }, [searchParams, searchQuery]);

  useEffect(() => {
    const j = searchParams.get('jenis') || 'all'
    if (j !== jenisFilter) setJenisFilter(j)
  }, [searchParams, jenisFilter])

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/kendaraan/jenis-list', { cache: 'no-store' })
        const json = await res.json()
        const list = Array.isArray(json?.data) ? (json.data as string[]) : []
        setJenisOptions(list)
      } catch {
        setJenisOptions([])
      }
    }
    load()
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', String(limit))
      if (debouncedSearchQuery) params.set('search', debouncedSearchQuery)
      if (jenisFilter && jenisFilter !== 'all') params.set('jenis', jenisFilter)
      const res = await fetch(`/api/kendaraan?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Gagal mengambil data');
      const kendaraanData = await res.json();
      setData(kendaraanData.data);
      setTotalItems(kendaraanData.total);
    } catch (error) {
      toast.error('Gagal memuat data. Coba lagi nanti.');
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearchQuery, jenisFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefreshMain = useCallback(async () => {
    setRefreshingMain(true);
    try {
      await fetchData();
      toast.success('Data diperbarui');
    } finally {
      setRefreshingMain(false);
    }
  }, [fetchData]);

  const handleOpenModal = useCallback((kendaraan: KendaraanData | null = null) => {
    setSelectedKendaraan(kendaraan);
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedKendaraan(null);
    setIsModalOpen(false);
  }, []);

  const handleOpenConfirm = useCallback((kendaraan: KendaraanData) => {
    setSelectedKendaraan(kendaraan);
    setIsConfirmOpen(true);
  }, []);

  const handleCloseConfirm = useCallback(() => {
    setIsConfirmOpen(false);
    setSelectedKendaraan(null);
  }, []);

  const handleOpenService = useCallback((kendaraan: KendaraanData) => {
    setSelectedKendaraan(kendaraan);
    setIsServiceModalOpen(true);
  }, []);

  const handleCloseService = useCallback(() => {
    setIsServiceModalOpen(false);
    setSelectedKendaraan(null);
  }, []);

  const handleOpenDocumentRenewal = useCallback((kendaraan: KendaraanData) => {
    setSelectedKendaraan(kendaraan);
    setIsDocumentRenewalModalOpen(true);
  }, []);

  const handleCloseDocumentRenewal = useCallback(() => {
    setIsDocumentRenewalModalOpen(false);
    setSelectedKendaraan(null);
  }, []);

  const handleOpenDetail = useCallback((kendaraan: KendaraanData) => {
    setSelectedKendaraan(kendaraan);
    setIsDetailModalOpen(true);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setIsDetailModalOpen(false);
    setSelectedKendaraan(null);
  }, []);

  const handleSave = useCallback(async (formData: any) => {
    const isEditing = !!selectedKendaraan;
    
    const previousData = [...data];
    const previousTotal = totalItems;
    const optimisticPlat = String(formData?.platNomor || '').trim().toUpperCase()

    if (isEditing) {
      setData(prev =>
        prev.map(item => item.platNomor === selectedKendaraan.platNomor ? { ...item, ...formData } : item)
      );
    } else {
      const newItem: KendaraanData = {
        ...formData,
        platNomor: optimisticPlat,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setData(prev => [newItem, ...prev].slice(0, limit));
      setTotalItems(prev => prev + 1);
    }
    handleCloseModal();

    const url = isEditing ? `/api/kendaraan/${selectedKendaraan.platNomor}` : '/api/kendaraan';
    const method = isEditing ? 'PUT' : 'POST';

    let toastId: string | undefined
    try {
      toastId = toast.loading('Menyimpan kendaraan...')
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Gagal menyimpan data');
      }

      const saved = await res.json()
      if (isEditing) {
        const oldPlat = selectedKendaraan.platNomor
        const newPlat = String(saved?.platNomor || oldPlat)
        setData(prev => prev.map(item => item.platNomor === oldPlat ? { ...item, ...saved, platNomor: newPlat } : item))
      } else {
        const createdPlat = String(saved?.platNomor || optimisticPlat)
        setData(prev => {
          const withoutOptimistic = prev.filter(x => x.platNomor !== optimisticPlat)
          return [{ ...saved, platNomor: createdPlat }, ...withoutOptimistic].slice(0, limit)
        })
      }

      swrMutate('/api/kendaraan/alerts')
      toast.success(`Data kendaraan berhasil ${isEditing ? 'diperbarui' : 'ditambahkan'}`, { id: toastId })
    } catch (error: any) {
      setData(previousData);
      setTotalItems(previousTotal);
      if (toastId) toast.dismiss(toastId)
      toast.error(error.message || 'Gagal menyimpan data, mengembalikan perubahan.');
    }
  }, [selectedKendaraan, data, totalItems, handleCloseModal, limit]);

  const handleSearchChange = useCallback((value: SetStateAction<string>) => {
    const next = typeof value === 'function' ? value(searchQuery) : value;
    setSearchQuery(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next) {
      params.set('search', next as string);
    } else {
      params.delete('search');
    }
    router.replace(`${pathname}?${params.toString()}`);
  }, [pathname, router, searchParams, searchQuery]);

  const handleJenisChange = useCallback((value: string) => {
    setJenisFilter(value)
    setPage(1)
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== 'all') {
      params.set('jenis', value)
    } else {
      params.delete('jenis')
    }
    router.replace(`${pathname}?${params.toString()}`)
  }, [pathname, router, searchParams])

  const handleDelete = useCallback(async () => {
    if (!selectedKendaraan) return;

    const previousData = [...data];
    const previousTotal = totalItems;

    setData(prev => prev.filter(item => item.platNomor !== selectedKendaraan.platNomor));
    setTotalItems(prev => prev - 1);
    handleCloseConfirm();

    let toastId: string | undefined
    try {
      toastId = toast.loading('Menghapus kendaraan...')
      const res = await fetch(`/api/kendaraan/${selectedKendaraan.platNomor}`, { method: 'DELETE' });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Gagal menghapus data');
      }

      swrMutate('/api/kendaraan/alerts')
      toast.success('Kendaraan berhasil dihapus', { id: toastId })
    } catch (error: any) {
      setData(previousData);
      setTotalItems(previousTotal);
      if (toastId) toast.dismiss(toastId)
      toast.error(error.message || 'Gagal menghapus data, mengembalikan perubahan.');
    }
  }, [selectedKendaraan, data, totalItems, handleCloseConfirm]);

  const tableColumns = useMemo(
    () => columns(handleOpenModal, handleOpenConfirm, handleOpenService, handleOpenDetail, handleOpenDocumentRenewal),
    [handleOpenModal, handleOpenConfirm, handleOpenService, handleOpenDetail, handleOpenDocumentRenewal]
  );

  const refreshData = useCallback(() => {
    fetchData();
  }, [fetchData]);

  interface ServiceLog {
    id: number;
    kendaraanPlat: string;
    date: string;
    description: string;
    cost: number;
    odometer: number | null;
    nextServiceDate: string | null;
    fotoUrl?: string | null;
  }

  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [quickRange, setQuickRange] = useState<string>('this_year');
  const [isRangeOpen, setIsRangeOpen] = useState(false);
  useEffect(() => {
    const now = new Date();
    const s = new Date(now.getFullYear(), 0, 1);
    const e2 = new Date(now.getFullYear(), 11, 31);
    setStartDate(s.toISOString().split('T')[0]);
    setEndDate(e2.toISOString().split('T')[0]);
  }, []);
  const dateDisplay = useMemo(() => {
    if (quickRange && quickRange !== 'custom') {
      switch (quickRange) {
        case 'today': return 'Hari Ini';
        case 'yesterday': return 'Kemarin';
        case 'last_7_days': return '7 Hari';
        case 'last_30_days': return '30 Hari';
        case 'this_month': return 'Bulan Ini';
        case 'this_year': return 'Tahun Ini';
        default: return 'Pilih Rentang Waktu';
      }
    }
    if (startDate && endDate) {
      try {
        const s = new Date(startDate);
        const e = new Date(endDate);
        return `${format(s, 'dd MMM yyyy', { locale: idLocale })} - ${format(e, 'dd MMM yyyy', { locale: idLocale })}`;
      } catch {
        return 'Pilih Rentang Waktu';
      }
    }
    return 'Pilih Rentang Waktu';
  }, [quickRange, startDate, endDate]);

  const [servicePage, setServicePage] = useState(1);
  const [serviceLimit, setServiceLimit] = useState(10);
  const [serviceTotal, setServiceTotal] = useState(0);
  const [serviceCursor, setServiceCursor] = useState<number | null>(null);
  const [serviceCursorStack, setServiceCursorStack] = useState<number[]>([]);
  const [serviceSearch, setServiceSearch] = useState('');
  const debouncedServiceSearch = useDebounce(serviceSearch, 500);

  useEffect(() => {
    setServicePage(1);
    setServiceCursor(null);
    setServiceCursorStack([]);
  }, [debouncedServiceSearch]);

  const serviceLogsUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', new Date(startDate).toISOString());
    if (endDate) params.set('endDate', new Date(endDate).toISOString());
    if (debouncedServiceSearch) params.set('search', debouncedServiceSearch);
    if (serviceCursor != null) {
      params.set('cursorId', String(serviceCursor));
    } else {
      params.set('page', String(servicePage));
    }
    params.set('limit', String(serviceLimit));
    return `/api/kendaraan/service?${params.toString()}`;
  }, [startDate, endDate, servicePage, serviceLimit, serviceCursor, debouncedServiceSearch]);

  const { data: allServiceLogsResp } = useSWR<{ data: ServiceLog[]; total: number; nextCursor: number | null }>(
    serviceLogsUrl,
    (url: string) => fetch(url, { cache: 'no-store' }).then(res => res.json()),
    { revalidateOnFocus: false, revalidateOnReconnect: false, dedupingInterval: 10000, keepPreviousData: true }
  );
  const allServiceLogs = useMemo(() => allServiceLogsResp?.data ?? [], [allServiceLogsResp?.data]);
  useEffect(() => {
    if (allServiceLogsResp?.total != null) setServiceTotal(allServiceLogsResp.total);
  }, [allServiceLogsResp]);

  const totalServiceCost = useMemo(() => {
    return (allServiceLogs ?? []).reduce((sum, l) => sum + Number(l.cost || 0), 0);
  }, [allServiceLogs]);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [viewingImageError, setViewingImageError] = useState(false);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const [tableScrollTop, setTableScrollTop] = useState(0);
  const [tableHeight, setTableHeight] = useState(0);
  useEffect(() => {
    setTableHeight(tableScrollRef.current?.clientHeight ?? 0);
  }, []);

  const refreshServiceLogs = useCallback(() => {
    swrMutate(serviceLogsUrl);
  }, [serviceLogsUrl]);

  const exportGlobalServiceCSV = useCallback(() => {
    const rows = (allServiceLogs ?? []).map((log) => ({
      tanggal: format(new Date(log.date), 'dd/MM/yyyy', { locale: idLocale }),
      plat: log.kendaraanPlat,
      deskripsi: log.description,
      biaya: Number(log.cost || 0),
      km: log.odometer ?? '',
      servis_berikutnya: log.nextServiceDate ? format(new Date(log.nextServiceDate), 'dd/MM/yyyy', { locale: idLocale }) : ''
    }));
    const header = ['Tanggal', 'Plat Nomor', 'Deskripsi', 'Biaya', 'KM', 'Servis Berikutnya'];
    const csv = [
      header.join(','),
      ...rows.map(r => [
        r.tanggal,
        `"${(r.plat ?? '').replace(/"/g, '""')}"`,
        `"${(r.deskripsi ?? '').replace(/"/g, '""')}"`,
        r.biaya,
        r.km,
        r.servis_berikutnya
      ].join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `riwayat-servis-semua-kendaraan.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [allServiceLogs]);

  const printRef = useRef<HTMLDivElement>(null);

  const exportGlobalServicePDF = useCallback(async () => {
    if (!printRef.current) return;
    const html2canvas = (await import('html2canvas')).default;
    const jsPDF = (await import('jspdf')).default;
    const element = printRef.current;
    const clone = element.cloneNode(true) as HTMLElement;
    const pdfWidthPx = 1400;
    clone.style.position = 'absolute';
    clone.style.left = '-9999px';
    clone.style.top = '0';
    clone.style.width = `${pdfWidthPx}px`;
    clone.style.height = 'auto';
    clone.style.overflow = 'visible';
    clone.style.background = 'white';
    clone.style.padding = '20px';
    try {
      const header = document.createElement('div');
      header.style.marginBottom = '20px';
      const title = document.createElement('div');
      title.style.fontSize = '18px';
      title.style.fontWeight = '600';
      title.innerText = `Riwayat Servis Semua Kendaraan`;
      header.appendChild(title);
      const subinfo = document.createElement('div');
      subinfo.style.fontSize = '12px';
      subinfo.style.color = '#555';
      const dateInfo = document.createElement('div');
      dateInfo.style.fontWeight = '700';
      dateInfo.style.color = '#000';
      dateInfo.innerText = `Rentang Waktu: ${dateDisplay}`;
      subinfo.appendChild(dateInfo);
      const costInfo = document.createElement('div');
      costInfo.style.fontWeight = '700';
      costInfo.style.color = '#000';
      costInfo.innerText = `Jumlah Pengeluaran: Rp ${new Intl.NumberFormat('id-ID').format(totalServiceCost)}`;
      subinfo.appendChild(costInfo);
      header.appendChild(subinfo);
      clone.insertBefore(header, clone.firstChild);
    } catch {}
    const tableContainer = clone.querySelector('.overflow-x-auto');
    if (tableContainer) {
      (tableContainer as HTMLElement).classList.remove('overflow-x-auto');
      (tableContainer as HTMLElement).style.overflow = 'visible';
    }
    document.body.appendChild(clone);
    await new Promise(resolve => setTimeout(resolve, 300));
    const canvas = await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      windowWidth: pdfWidthPx,
      windowHeight: clone.scrollHeight + 100,
    } as any);
    document.body.removeChild(clone);
    const imgData = canvas.toDataURL('image/jpeg', 1.0);
    const pdf = new jsPDF('l', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pdfWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;
    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
    heightLeft -= pdfHeight;
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;
    }
    pdf.save(`riwayat-servis-semua-kendaraan.pdf`);
  }, [dateDisplay, totalServiceCost]);

  return (
    <div className="w-full">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Manajemen Kendaraan</h1>
        <VehicleSummary />
        <RoleGate allow={["ADMIN", "KASIR", "PEMILIK"]}>
            <div className="bg-white p-4 md:p-6 rounded-lg shadow-md">
            <div className="flex justify-end mb-3">
              <Button variant="outline" size="icon" onClick={handleRefreshMain} className="rounded-full">
                <ArrowPathIcon className={`h-4 w-4 ${refreshingMain ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            <DataTable 
                columns={tableColumns} 
                data={data} 
                onRowClick={(row) => handleOpenDetail(row)}
                extraFilters={
                  <div className="w-full md:w-56">
                    <select
                      value={jenisFilter}
                      onChange={(e) => handleJenisChange(e.target.value)}
                      className="w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm"
                    >
                      <option value="all">Semua Jenis</option>
                      {jenisOptions.map((j) => (
                        <option key={j} value={j}>{j}</option>
                      ))}
                    </select>
                  </div>
                }
                renderMobileCards={({ data, isLoading }) => (
                  <div className="space-y-3">
                    {isLoading ? (
                      Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-4 w-40" />
                          <Skeleton className="h-4 w-24" />
                        </div>
                      ))
                    ) : data.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center text-sm text-gray-500">
                        Tidak ada kendaraan
                      </div>
                    ) : (
                      data.map((kendaraan) => (
                        <div
                          key={kendaraan.platNomor}
                          onClick={() => handleOpenDetail(kendaraan)}
                          className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-3 transition-colors hover:bg-gray-50/50"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="font-semibold text-gray-900">{kendaraan.platNomor}</div>
                              <div className="text-xs text-gray-500">{kendaraan.merk} • {kendaraan.jenis}</div>
                              <div className="text-xs text-gray-500">
                                STNK: {format(new Date(kendaraan.tanggalMatiStnk), 'dd MMM yyyy', { locale: idLocale })}
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 pt-1">
                            <Button size="sm" variant="outline" className="rounded-full" onClick={(e) => { e.stopPropagation(); handleOpenDetail(kendaraan); }}>
                              Detail
                            </Button>
                            <Button size="sm" variant="outline" className="rounded-full" onClick={(e) => { e.stopPropagation(); handleOpenService(kendaraan); }}>
                              Catat Servis
                            </Button>
                            <Button size="sm" variant="outline" className="rounded-full" onClick={(e) => { e.stopPropagation(); handleOpenDocumentRenewal(kendaraan); }}>
                              Perpanjang Dokumen
                            </Button>
                            <Button size="sm" variant="outline" className="rounded-full" onClick={(e) => { e.stopPropagation(); handleOpenModal(kendaraan); }}>
                              Edit
                            </Button>
                            <Button size="sm" variant="destructive" className="rounded-full" onClick={(e) => { e.stopPropagation(); handleOpenConfirm(kendaraan); }}>
                              Hapus
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
                refreshData={refreshData}
                page={page}
                limit={limit}
                totalItems={totalItems}
                onPageChange={setPage}
                onLimitChange={setLimit}
                searchQuery={searchQuery}
                onSearchChange={handleSearchChange}
                searchPlaceholder="Cari plat nomor..."
                isLoading={loading}
                showPageSizeSelector
                pageSizeOptions={[10, 20, 50, 100]}
            />
            </div>
        </RoleGate>

        <div className="mt-6 bg-white p-4 md:p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Riwayat Servis Semua Kendaraan</h2>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="rounded-md bg-gray-50 px-3 py-2 text-sm">
              Jumlah Pengeluaran: Rp {new Intl.NumberFormat('id-ID').format(totalServiceCost)}
            </div>
            <div className="rounded-md bg-gray-50 px-3 py-2 text-sm">
              Total Entri: {serviceTotal}
            </div>
          </div>
          <div className="w-full flex flex-wrap items-center gap-2 gap-y-3 mb-4">
            <input
              type="text"
              placeholder="Cari plat / deskripsi..."
              value={serviceSearch}
              onChange={(e) => setServiceSearch(e.target.value)}
              className="h-9 w-full sm:w-[220px] rounded-xl border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <Popover open={isRangeOpen} onOpenChange={setIsRangeOpen}>
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant={"outline"}
                  className="min-w-[140px] sm:w-[260px] shrink-0 h-9 whitespace-nowrap justify-start text-left font-normal bg-white rounded-xl"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateDisplay}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[min(95vw,420px)] sm:w-[420px] max-h-[calc(100vh-160px)] overflow-auto p-4 bg-white rounded-xl shadow-md"
                align="start"
                side="bottom"
                sideOffset={8}
                collisionPadding={12}
              >
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h4 className="font-medium leading-none">Rentang Waktu</h4>
                    <p className="text-sm text-muted-foreground">
                      Pilih rentang waktu cepat
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setQuickRange('today'); const t=new Date(); const s=new Date(t); s.setHours(0,0,0,0); const e=new Date(t); e.setHours(23,59,59,999); setStartDate(s.toISOString().split('T')[0]); setEndDate(e.toISOString().split('T')[0]); }} className={quickRange === 'today' ? 'bg-accent' : ''}>Hari Ini</Button>
                    <Button variant="outline" size="sm" onClick={() => { setQuickRange('yesterday'); const t=new Date(); t.setDate(t.getDate()-1); const s=new Date(t); s.setHours(0,0,0,0); const e=new Date(t); e.setHours(23,59,59,999); setStartDate(s.toISOString().split('T')[0]); setEndDate(e.toISOString().split('T')[0]); }} className={quickRange === 'yesterday' ? 'bg-accent' : ''}>Kemarin</Button>
                    <Button variant="outline" size="sm" onClick={() => { setQuickRange('last_7_days'); const t=new Date(); const s=new Date(t); s.setDate(s.getDate()-6); const e=new Date(t); e.setHours(23,59,59,999); setStartDate(s.toISOString().split('T')[0]); setEndDate(e.toISOString().split('T')[0]); }} className={quickRange === 'last_7_days' ? 'bg-accent' : ''}>7 Hari</Button>
                    <Button variant="outline" size="sm" onClick={() => { setQuickRange('last_30_days'); const t=new Date(); const s=new Date(t); s.setDate(s.getDate()-29); const e=new Date(t); e.setHours(23,59,59,999); setStartDate(s.toISOString().split('T')[0]); setEndDate(e.toISOString().split('T')[0]); }} className={quickRange === 'last_30_days' ? 'bg-accent' : ''}>30 Hari</Button>
                    <Button variant="outline" size="sm" onClick={() => { setQuickRange('this_month'); const t=new Date(); const s=new Date(t.getFullYear(), t.getMonth(), 1); const e=new Date(t.getFullYear(), t.getMonth()+1, 0); setStartDate(s.toISOString().split('T')[0]); setEndDate(e.toISOString().split('T')[0]); }} className={quickRange === 'this_month' ? 'bg-accent' : ''}>Bulan Ini</Button>
                    <Button variant="outline" size="sm" onClick={() => { setQuickRange('this_year'); const t=new Date(); const s=new Date(t.getFullYear(), 0, 1); const e=new Date(t.getFullYear(), 11, 31); setStartDate(s.toISOString().split('T')[0]); setEndDate(e.toISOString().split('T')[0]); }} className={quickRange === 'this_year' ? 'bg-accent' : ''}>Tahun Ini</Button>
                  </div>
                  <div className="border-t pt-4 space-y-2">
                    <h4 className="font-medium leading-none">Kustom</h4>
                    <div className="grid gap-2">
                      <div className="grid grid-cols-3 items-center gap-4">
                        <label className="text-xs">Dari</label>
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => { setStartDate(e.target.value); setQuickRange('custom'); }}
                          className="col-span-2 rounded-xl border px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="grid grid-cols-3 items-center gap-4">
                        <label className="text-xs">Sampai</label>
                        <input
                          type="date"
                          value={endDate}
                          onChange={(e) => { setEndDate(e.target.value); setQuickRange('custom'); }}
                          className="col-span-2 rounded-xl border px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="flex justify-end pt-2">
                        <Button
                          size="sm"
                          onClick={() => setIsRangeOpen(false)}
                          className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <ArrowDownOnSquareIcon className="mr-2 h-4 w-4" />
                          Simpan
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Button variant="outline" size="icon" onClick={refreshServiceLogs} className="rounded-full shrink-0 h-9 w-9">
                <ArrowPathIcon className="h-4 w-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="rounded-full bg-red-600 hover:bg-red-700 text-white shrink-0 h-9 whitespace-nowrap">
                    <ArrowDownTrayIcon className="mr-2 h-4 w-4" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={exportGlobalServiceCSV}>
                    <ArrowDownTrayIcon className="mr-2 h-4 w-4" />
                    Export CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportGlobalServicePDF}>
                    <DocumentTextIcon className="mr-2 h-4 w-4" />
                    Export PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div ref={printRef} className="border rounded-lg">
            <div
              ref={tableScrollRef}
              className="overflow-x-auto"
              style={{ contentVisibility: 'auto', overflowY: 'auto', maxHeight: '60vh' }}
              onScroll={(e) => setTableScrollTop((e.target as HTMLElement).scrollTop)}
            >
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Plat Nomor</TableHead>
                  <TableHead>Deskripsi</TableHead>
                  <TableHead>Biaya</TableHead>
                  <TableHead>KM</TableHead>
                  <TableHead>Foto</TableHead>
                  <TableHead>Servis Berikutnya</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  const rowHeight = 44;
                  const totalRows = (allServiceLogs ?? []).length;
                  const startIndex = Math.max(0, Math.floor(tableScrollTop / rowHeight));
                  const visibleCount = Math.max(1, Math.ceil((tableHeight || 1) / rowHeight) + 5);
                  const endIndex = Math.min(totalRows, startIndex + visibleCount);
                  const topSpacer = startIndex * rowHeight;
                  const bottomSpacer = (totalRows - endIndex) * rowHeight;
                  const rows = (allServiceLogs ?? []).slice(startIndex, endIndex);
                  return (
                    <>
                      <TableRow>
                        <TableCell colSpan={7} style={{ height: topSpacer }} />
                      </TableRow>
                      {rows.map((log) => (
                        <TableRow key={`${log.kendaraanPlat}-${log.id}`}>
                          <TableCell className="whitespace-nowrap">
                            {format(new Date(log.date), 'dd/MM/yyyy', { locale: idLocale })}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{log.kendaraanPlat}</TableCell>
                          <TableCell className="max-w-[250px] truncate" title={log.description}>{log.description}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            Rp {new Intl.NumberFormat('id-ID').format(Number(log.cost || 0))}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {log.odometer ? `${log.odometer} km` : '-'}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {log.fotoUrl ? (
                              <button
                                onClick={() => { setViewingImageError(false); setViewingImage((log.fotoUrl as string).trim()); }}
                                className="inline-flex items-center justify-center h-8 w-8 rounded-md text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50"
                                title="Lihat Foto/Nota"
                              >
                                <PhotoIcon className="h-4 w-4" />
                              </button>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {log.nextServiceDate ? format(new Date(log.nextServiceDate), 'dd/MM/yyyy', { locale: idLocale }) : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell colSpan={7} style={{ height: bottomSpacer }} />
                      </TableRow>
                    </>
                  );
                })()}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3} />
                  <TableCell className="whitespace-nowrap font-semibold">
                    Total: Rp {new Intl.NumberFormat('id-ID').format(totalServiceCost)}
                  </TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              </TableFooter>
            </Table>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 gap-y-3">
            <div className="text-sm text-muted-foreground flex-1 min-w-0 break-words">
              Menampilkan {(allServiceLogs ?? []).length} dari {serviceTotal} entri
            </div>
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <label className="text-sm">Per halaman</label>
              <select
                value={serviceLimit}
                onChange={(e) => { setServiceLimit(Number(e.target.value)); setServicePage(1); setServiceCursor(null); setServiceCursorStack([]); }}
                className="h-9 rounded-md border px-2 text-sm shrink-0"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                {(() => {
                  const displayedPage = serviceCursorStack.length > 0 ? serviceCursorStack.length + 1 : servicePage;
                  const totalPages = Math.max(1, Math.ceil(serviceTotal / serviceLimit));
                  const prevDisabled = serviceCursorStack.length <= 0 && servicePage <= 1;
                  const nextDisabled = serviceCursorStack.length <= 0 ? displayedPage >= totalPages : false;
                  return (
                    <>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (serviceCursorStack.length > 1) {
                      const newStack = serviceCursorStack.slice(0, -1);
                      setServiceCursorStack(newStack);
                      setServiceCursor(newStack.length > 0 ? newStack[newStack.length - 1] : null);
                    } else {
                      setServiceCursor(null);
                      setServicePage(p => Math.max(1, p - 1));
                    }
                  }}
                  disabled={prevDisabled}
                  className="h-9 shrink-0"
                >
                  Sebelumnya
                </Button>
                <span className="text-sm">Hal {displayedPage} / {totalPages}</span>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (allServiceLogsResp?.nextCursor) {
                      const next = allServiceLogsResp.nextCursor as number;
                      setServiceCursorStack(prev => [...prev, next]);
                      setServiceCursor(next);
                    } else {
                      setServicePage(p => p + 1);
                    }
                  }}
                  disabled={nextDisabled}
                  className="h-9 shrink-0"
                >
                  Berikutnya
                </Button>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {viewingImage && (
        <ImageViewer
          src={viewingImage}
          alt="Preview Bukti Servis"
          onClose={() => { setViewingImage(null); setViewingImageError(false); }}
          downloadable
        />
      )}

      <Button
        onClick={() => handleOpenModal()}
        className="fixed bottom-4 right-4 md:bottom-6 md:right-6 w-12 h-12 md:w-14 md:h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center z-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
        title="Tambah Kendaraan"
        size="icon"
      >
        <PlusIcon className="w-6 h-6 md:w-8 md:h-8" />
      </Button>

      <KendaraanModal 
        isOpen={isModalOpen} 
        onClose={handleCloseModal} 
        onConfirm={handleSave} 
        title={selectedKendaraan ? 'Ubah Kendaraan' : 'Tambah Kendaraan'}
        initialData={selectedKendaraan}
      />

      <ServiceModal
        isOpen={isServiceModalOpen}
        onClose={handleCloseService}
        platNomor={selectedKendaraan?.platNomor || null}
      />

      <DocumentRenewalModal
        isOpen={isDocumentRenewalModalOpen}
        onClose={handleCloseDocumentRenewal}
        platNomor={selectedKendaraan?.platNomor || null}
      />

      <DetailModal
        isOpen={isDetailModalOpen}
        onClose={handleCloseDetail}
        kendaraan={selectedKendaraan}
        onEdit={(kendaraan) => {
          handleCloseDetail();
          handleOpenModal(kendaraan);
        }}
        onDelete={(kendaraan) => {
          handleCloseDetail();
          handleOpenConfirm(kendaraan);
        }}
        onRenewDocument={(kendaraan) => {
          handleCloseDetail();
          handleOpenDocumentRenewal(kendaraan);
        }}
        onService={(kendaraan) => {
          handleCloseDetail();
          handleOpenService(kendaraan);
        }}
      />

      <ConfirmationModal
        isOpen={isConfirmOpen}
        onClose={handleCloseConfirm}
        onConfirm={handleDelete}
        title="Konfirmasi Hapus"
        description="Apakah Anda yakin ingin menghapus kendaraan ini?"
      />
    </div>
  )
}
