'use client'

import { useState, useEffect, useCallback, useMemo } from 'react';
import { DataTable } from "@/components/ui/data-table";
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { SetStateAction } from 'react';
import { columns, SupirData } from './columns';
import { useDebounce } from '@/hooks/useDebounce';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ArrowDownTrayIcon, CalendarIcon, UsersIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';

export default function SupirPage() {
  const [data, setData] = useState<SupirData[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [limit, setLimit] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 500);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [quickRange, setQuickRange] = useState('this_month');
  const [supirList, setSupirList] = useState<{ id: number; name: string }[]>([]);
  const [selectedSupirId, setSelectedSupirId] = useState<string>('all');
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const q = searchParams.get('search') || '';
    if (q !== searchQuery) setSearchQuery(q);
  }, [searchParams, searchQuery]);

  useEffect(() => {
    const fetchSupirs = async () => {
      try {
        const res = await fetch('/api/supir/list', { cache: 'no-store' });
        if (res.ok) {
          const result = await res.json();
          setSupirList(Array.isArray(result) ? result : (result.data || []));
        }
      } catch (error) {
        console.error('Failed to fetch supir list', error);
      }
    };
    fetchSupirs();
  }, []);

  useEffect(() => {
    // Initialize dates on client side to avoid hydration mismatch
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today);
    end.setHours(23, 59, 59, 999);
    
    setStartDate(start);
    setEndDate(end);
  }, []);

  const [summary, setSummary] = useState({
    totalSupir: 0,
    totalNota: 0,
    totalTonase: 0,
    totalSaldoUangJalan: 0,
  });

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailSupir, setDetailSupir] = useState<SupirData | null>(null);
  const [detailData, setDetailData] = useState<any | null>(null);
  const [detailExporting, setDetailExporting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const startDateString = startDate ? format(startDate, 'yyyy-MM-dd') : '';
      const endDateString = endDate ? format(endDate, 'yyyy-MM-dd') : '';
      const res = await fetch(`/api/supir?page=${page}&limit=${limit}&search=${debouncedSearchQuery}&startDate=${startDateString}&endDate=${endDateString}&supirId=${selectedSupirId}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Gagal mengambil data');
      const result = await res.json();
      setData(result.data);
      setTotalItems(result.total);
    } catch (error) {
      toast.error('Gagal memuat data. Coba lagi nanti.');
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearchQuery, startDate, endDate, selectedSupirId]);


  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (data.length > 0) {
      const totalNota = data.reduce((acc, supir) => acc + supir.jumlahNota, 0);
      const totalTonase = data.reduce((acc, supir) => acc + (Number(supir.totalBerat || 0)), 0);
      const totalSaldoUangJalan = data.reduce((acc, supir) => acc + (Number(supir.saldoUangJalan || 0)), 0);
      setSummary({
        totalSupir: totalItems,
        totalNota,
        totalTonase,
        totalSaldoUangJalan,
      });
    } else {
        setSummary({
        totalSupir: 0,
        totalNota: 0,
        totalTonase: 0,
        totalSaldoUangJalan: 0,
      });
    }
  }, [data, totalItems]);

  const formatCurrency = useCallback((n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Number(n || 0)), []);
  const formatWIBDateTime = useCallback((value: string | Date) => {
    try {
      const d = value instanceof Date ? value : new Date(value);
      return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).format(d);
    } catch {
      return String(value);
    }
  }, []);

  const handleOpenDetail = useCallback(async (row: SupirData) => {
    setDetailSupir(row);
    setDetailData(null);
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const start = startDate ? format(startDate, 'yyyy-MM-dd') : '';
      const end = endDate ? format(endDate, 'yyyy-MM-dd') : '';
      const res = await fetch(`/api/supir/${row.supirId}/details?startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}`, { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.error) throw new Error(json.error || 'Gagal memuat detail supir');
      setDetailData(json);
    } catch (e: any) {
      toast.error(e?.message || 'Gagal memuat detail supir');
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  }, [startDate, endDate]);

  const handleExportDetailPdf = useCallback(async () => {
    if (!detailData || !detailSupir || detailExporting) return
    setDetailExporting(true)
    try {
      const jsPDF = (await import('jspdf')).default
      const autoTable = (await import('jspdf-autotable')).default
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })

      const periode = startDate && endDate ? `${format(startDate, 'dd MMM yyyy', { locale: idLocale })} - ${format(endDate, 'dd MMM yyyy', { locale: idLocale })}` : '-'
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.text('DETAIL SUPIR', 20, 28)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text(`Supir: ${detailSupir.supir}`, 20, 46)
      doc.text(`Periode: ${periode}`, 20, 60)

      const notas = Array.isArray(detailData?.notas) ? detailData.notas : []
      const totalBerat = notas.reduce((acc: number, n: any) => acc + Number(n?.beratAkhir || 0), 0)

      autoTable(doc, {
        startY: 78,
        head: [['TANGGAL', 'KEBUN', 'PABRIK', 'KENDARAAN', 'BERAT (KG)']],
        body: notas.map((n: any) => ([
          formatWIBDateTime(n.createdAt),
          n.kebun?.name || '-',
          n.pabrikSawit?.name || '-',
          n.kendaraanPlatNomor || '-',
          `${Math.round(Number(n.beratAkhir || 0)).toLocaleString('id-ID')}`,
        ])),
        foot: [[
          { content: 'TOTAL', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } },
          { content: `${Math.round(totalBerat).toLocaleString('id-ID')} kg`, styles: { halign: 'right', fontStyle: 'bold' } },
        ]] as any,
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 3, valign: 'middle' },
        headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: 'bold' } as any,
        footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42] } as any,
        columnStyles: {
          0: { cellWidth: 110 },
          1: { cellWidth: 150 },
          2: { cellWidth: 150 },
          3: { cellWidth: 90 },
          4: { cellWidth: 90, halign: 'right' },
        },
        margin: { left: 20, right: 20 },
      } as any)

      doc.addPage()
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.text('RINCIAN UANG JALAN', 20, 28)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text(`Supir: ${detailSupir.supir}`, 20, 46)
      doc.text(`Periode: ${periode}`, 20, 60)

      const sesi = Array.isArray(detailData?.sesiUangJalan) ? detailData.sesiUangJalan : []
      const totalDiberikan = sesi.reduce((acc: number, s: any) => acc + Number(s?.totalDiberikan || 0), 0)
      const totalPengeluaran = sesi.reduce((acc: number, s: any) => acc + Number(s?.totalPengeluaran || 0), 0)
      const totalSaldo = sesi.reduce((acc: number, s: any) => acc + Number(s?.saldo || 0), 0)

      autoTable(doc, {
        startY: 78,
        head: [['TANGGAL MULAI', 'KENDARAAN', 'STATUS', 'DIBERIKAN', 'PENGELUARAN', 'SALDO']],
        body: sesi.map((s: any) => ([
          formatWIBDateTime(s.tanggalMulai),
          s.kendaraanPlatNomor || '-',
          s.status || '-',
          new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Number(s.totalDiberikan || 0)),
          new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Number(s.totalPengeluaran || 0)),
          new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Number(s.saldo || 0)),
        ])),
        foot: [[
          { content: 'TOTAL', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } },
          { content: new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(totalDiberikan), styles: { halign: 'right', fontStyle: 'bold' } },
          { content: new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(totalPengeluaran), styles: { halign: 'right', fontStyle: 'bold' } },
          { content: new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(totalSaldo), styles: { halign: 'right', fontStyle: 'bold' } },
        ]] as any,
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 3, valign: 'middle' },
        headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: 'bold' } as any,
        footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42] } as any,
        columnStyles: {
          0: { cellWidth: 120 },
          1: { cellWidth: 110 },
          2: { cellWidth: 90 },
          3: { cellWidth: 100, halign: 'right' },
          4: { cellWidth: 110, halign: 'right' },
          5: { cellWidth: 90, halign: 'right' },
        },
        margin: { left: 20, right: 20 },
      } as any)

      const fileName = `Detail-Supir-${detailSupir.supir}-${format(new Date(), 'yyyyMMdd-HHmm')}.pdf`.replace(/\s+/g, '-')
      doc.save(fileName)
    } catch {
      toast.error('Gagal export PDF')
    } finally {
      setDetailExporting(false)
    }
  }, [detailData, detailSupir, detailExporting, endDate, formatWIBDateTime, startDate]);

  const tableColumns = useMemo(() => columns(handleOpenDetail), [handleOpenDetail]);

  const refreshData = useCallback(() => {
    fetchData();
  }, [fetchData]);

  const handleSearchChange = useCallback((value: SetStateAction<string>) => {
    const next = typeof value === 'function' ? value(searchQuery) : value;
    setSearchQuery(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next) {
      params.set('search', next);
    } else {
      params.delete('search');
    }
    router.replace(`${pathname}?${params.toString()}`);
  }, [pathname, router, searchParams, searchQuery]);

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

  const applyQuickRange = useCallback((val: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    setQuickRange(val);
    
    if (val === 'today') {
      setStartDate(today);
      setEndDate(endOfDay);
    } else if (val === 'yesterday') {
      const y = new Date(today);
      y.setDate(today.getDate() - 1);
      
      const yEnd = new Date(endOfDay);
      yEnd.setDate(endOfDay.getDate() - 1);

      setStartDate(y);
      setEndDate(yEnd);
    } else if (val === 'last_week') {
      const start = new Date(today);
      start.setDate(today.getDate() - 7);
      setStartDate(start);
      setEndDate(endOfDay);
    } else if (val === 'last_30_days') {
      const start = new Date(today);
      start.setDate(today.getDate() - 30);
      setStartDate(start);
      setEndDate(endOfDay);
    } else if (val === 'this_month') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(start);
      setEndDate(endOfDay);
    } else if (val === 'this_year') {
      const start = new Date(today.getFullYear(), 0, 1);
      setStartDate(start);
      setEndDate(endOfDay);
    }
  }, []);

  return (
    <main className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Laporan Supir</h1>

            <div className="mb-6">
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                                <UsersIcon className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-gray-900">Ringkasan Supir</p>
                                <p className="text-xs text-gray-500">Jumlah supir, nota, dan uang jalan</p>
                            </div>
                        </div>
                        <div className="text-xs text-gray-500">
                            Periode: <span className="font-semibold text-gray-900">{dateDisplay}</span>
                        </div>
                    </div>
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="rounded-xl bg-emerald-50/60 px-3 py-2">
                            <p className="text-xs text-emerald-700">Total Supir</p>
                            <p className="text-lg font-semibold text-gray-900">{summary.totalSupir.toLocaleString('id-ID')}</p>
                        </div>
                        <div className="rounded-xl bg-amber-50/70 px-3 py-2">
                            <p className="text-xs text-amber-700">Total Nota</p>
                            <p className="text-lg font-semibold text-gray-900">{summary.totalNota.toLocaleString('id-ID')}</p>
                        </div>
                        <div className="rounded-xl bg-sky-50/70 px-3 py-2">
                            <p className="text-xs text-sky-700">Total Tonase</p>
                            <p className="text-lg font-semibold text-gray-900">{Number(summary.totalTonase || 0).toLocaleString('id-ID')} kg</p>
                        </div>
                        <div className="rounded-xl bg-indigo-50/70 px-3 py-2">
                            <p className="text-xs text-indigo-700">Saldo Uang Jalan</p>
                            <p className="text-lg font-semibold text-gray-900">{formatCurrency(summary.totalSaldoUangJalan)}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
                <DataTable
                    columns={tableColumns}
                    data={data}
                    refreshData={refreshData}
                    page={page}
                    limit={limit}
                    totalItems={totalItems}
                    onPageChange={setPage}
                    onLimitChange={setLimit}
                    showPageSizeSelector
                    searchQuery={searchQuery}
                    onSearchChange={handleSearchChange}
                    searchPlaceholder="Cari nama supir..."
                    isLoading={loading}
                    extraFilters={
                        <div className="flex gap-2 w-full md:w-auto">
                            <Select value={selectedSupirId} onValueChange={setSelectedSupirId}>
                                <SelectTrigger className="w-full md:w-[200px] h-11 rounded-xl bg-white">
                                    <SelectValue placeholder="Pilih Supir" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Semua Supir</SelectItem>
                                    {supirList.map((supir) => (
                                        <SelectItem key={supir.id} value={supir.id.toString()}>
                                            {supir.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    id="date"
                                    variant={"outline"}
                                    className={cn(
                                        "w-full md:w-[300px] justify-start text-left font-normal rounded-xl h-11",
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
                                          value={startDate ? format(startDate, 'yyyy-MM-dd') : ''}
                                          onChange={(e) => {
                                            if (e.target.value) {
                                              const [y, m, d] = e.target.value.split('-').map(Number);
                                              const date = new Date(y, m - 1, d);
                                              setStartDate(date);
                                            } else {
                                              setStartDate(undefined);
                                            }
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
                                          value={endDate ? format(endDate, 'yyyy-MM-dd') : ''}
                                          onChange={(e) => {
                                            if (e.target.value) {
                                              const [y, m, d] = e.target.value.split('-').map(Number);
                                              const date = new Date(y, m - 1, d);
                                              date.setHours(23, 59, 59, 999);
                                              setEndDate(date);
                                            } else {
                                              setEndDate(undefined);
                                            }
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
                    }
                />
            </div>
        </div>

        <Dialog open={detailOpen} onOpenChange={(v) => { setDetailOpen(v); if (!v) { setDetailSupir(null); setDetailData(null); } }}>
          <DialogContent className="sm:max-w-[900px] p-0 overflow-hidden [&>button.absolute]:hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <DialogTitle className="text-white">Detail Supir</DialogTitle>
                  <div className="text-xs text-white/90 mt-1">
                    {detailSupir?.supir || '-'} {startDate && endDate ? `• Periode: ${format(startDate, 'dd MMM yyyy', { locale: idLocale })} - ${format(endDate, 'dd MMM yyyy', { locale: idLocale })}` : ''}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setDetailOpen(false); setDetailSupir(null); setDetailData(null); }}
                  className="h-9 w-9 rounded-md border border-white bg-white text-emerald-600 flex items-center justify-center hover:bg-white/90"
                  aria-label="Tutup"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="px-6 py-5 space-y-4">
              {detailLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-6 w-64" />
                  <Skeleton className="h-28 w-full" />
                  <Skeleton className="h-64 w-full" />
                </div>
              ) : detailData ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-xl bg-gray-50 px-3 py-2">
                      <div className="text-xs text-gray-500">Jumlah Nota</div>
                      <div className="text-lg font-semibold text-gray-900">{Number(detailData?.notaSummary?.jumlahNota || 0).toLocaleString('id-ID')}</div>
                    </div>
                    <div className="rounded-xl bg-gray-50 px-3 py-2">
                      <div className="text-xs text-gray-500">Total Tonase</div>
                      <div className="text-lg font-semibold text-gray-900">{Number(detailData?.notaSummary?.totalBerat || 0).toLocaleString('id-ID')} kg</div>
                    </div>
                    <div className="rounded-xl bg-gray-50 px-3 py-2">
                      <div className="text-xs text-gray-500">Saldo Uang Jalan</div>
                      <div className="text-lg font-semibold text-gray-900">{formatCurrency(Number(detailData?.uangJalanSummary?.saldo || 0))}</div>
                    </div>
                  </div>

                  <Tabs defaultValue="nota">
                    <TabsList className="bg-gray-100">
                      <TabsTrigger value="nota">Nota Sawit</TabsTrigger>
                      <TabsTrigger value="uang-jalan">Uang Jalan</TabsTrigger>
                    </TabsList>

                    <TabsContent value="nota">
                      <div className="rounded-xl border border-gray-100 overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                            <tr>
                              <th className="px-3 py-2 text-left">Tanggal</th>
                              <th className="px-3 py-2 text-left">Kebun</th>
                              <th className="px-3 py-2 text-left">Pabrik</th>
                              <th className="px-3 py-2 text-left">Kendaraan</th>
                              <th className="px-3 py-2 text-right">Berat</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {(detailData?.notas || []).length === 0 ? (
                              <tr><td colSpan={5} className="px-3 py-3 text-center text-sm text-gray-500">Tidak ada nota pada periode ini.</td></tr>
                            ) : (
                              (detailData?.notas || []).map((n: any) => (
                                <tr key={n.id}>
                                  <td className="px-3 py-2">{formatWIBDateTime(n.createdAt)}</td>
                                  <td className="px-3 py-2">{n.kebun?.name || '-'}</td>
                                  <td className="px-3 py-2">{n.pabrikSawit?.name || '-'}</td>
                                  <td className="px-3 py-2">{n.kendaraanPlatNomor || '-'}</td>
                                  <td className="px-3 py-2 text-right">{Number(n.beratAkhir || 0).toLocaleString('id-ID')} kg</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                          {(detailData?.notas || []).length > 0 && (
                            <tfoot className="bg-gray-50 border-t border-gray-200">
                              <tr>
                                <td className="px-3 py-2 font-bold text-gray-900 text-right" colSpan={4}>TOTAL</td>
                                <td className="px-3 py-2 font-bold text-gray-900 text-right">
                                  {Math.round((detailData?.notas || []).reduce((acc: number, n: any) => acc + Number(n?.beratAkhir || 0), 0)).toLocaleString('id-ID')} kg
                                </td>
                              </tr>
                            </tfoot>
                          )}
                        </table>
                      </div>
                    </TabsContent>

                    <TabsContent value="uang-jalan">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                        <div className="rounded-xl bg-gray-50 px-3 py-2">
                          <div className="text-xs text-gray-500">Total Diberikan</div>
                          <div className="text-base font-semibold text-gray-900">{formatCurrency(Number(detailData?.uangJalanSummary?.totalDiberikan || 0))}</div>
                        </div>
                        <div className="rounded-xl bg-gray-50 px-3 py-2">
                          <div className="text-xs text-gray-500">Total Pengeluaran</div>
                          <div className="text-base font-semibold text-gray-900">{formatCurrency(Number(detailData?.uangJalanSummary?.totalPengeluaran || 0))}</div>
                        </div>
                        <div className="rounded-xl bg-gray-50 px-3 py-2">
                          <div className="text-xs text-gray-500">Saldo</div>
                          <div className="text-base font-semibold text-gray-900">{formatCurrency(Number(detailData?.uangJalanSummary?.saldo || 0))}</div>
                        </div>
                      </div>
                      <div className="rounded-xl border border-gray-100 overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                            <tr>
                              <th className="px-3 py-2 text-left">Tanggal Mulai</th>
                              <th className="px-3 py-2 text-left">Kendaraan</th>
                              <th className="px-3 py-2 text-left">Status</th>
                              <th className="px-3 py-2 text-right">Diberikan</th>
                              <th className="px-3 py-2 text-right">Pengeluaran</th>
                              <th className="px-3 py-2 text-right">Saldo</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {(detailData?.sesiUangJalan || []).length === 0 ? (
                              <tr><td colSpan={6} className="px-3 py-3 text-center text-sm text-gray-500">Tidak ada uang jalan pada periode ini.</td></tr>
                            ) : (
                              (detailData?.sesiUangJalan || []).map((s: any) => (
                                <tr key={s.id}>
                                  <td className="px-3 py-2">{formatWIBDateTime(s.tanggalMulai)}</td>
                                  <td className="px-3 py-2">{s.kendaraanPlatNomor || '-'}</td>
                                  <td className="px-3 py-2">{s.status || '-'}</td>
                                  <td className="px-3 py-2 text-right">{formatCurrency(Number(s.totalDiberikan || 0))}</td>
                                  <td className="px-3 py-2 text-right">{formatCurrency(Number(s.totalPengeluaran || 0))}</td>
                                  <td className="px-3 py-2 text-right">{formatCurrency(Number(s.saldo || 0))}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                          {(detailData?.sesiUangJalan || []).length > 0 && (
                            <tfoot className="bg-gray-50 border-t border-gray-200">
                              <tr>
                                <td className="px-3 py-2 font-bold text-gray-900 text-right" colSpan={3}>TOTAL</td>
                                <td className="px-3 py-2 font-bold text-gray-900 text-right">
                                  {formatCurrency((detailData?.sesiUangJalan || []).reduce((acc: number, s: any) => acc + Number(s?.totalDiberikan || 0), 0))}
                                </td>
                                <td className="px-3 py-2 font-bold text-gray-900 text-right">
                                  {formatCurrency((detailData?.sesiUangJalan || []).reduce((acc: number, s: any) => acc + Number(s?.totalPengeluaran || 0), 0))}
                                </td>
                                <td className="px-3 py-2 font-bold text-gray-900 text-right">
                                  {formatCurrency((detailData?.sesiUangJalan || []).reduce((acc: number, s: any) => acc + Number(s?.saldo || 0), 0))}
                                </td>
                              </tr>
                            </tfoot>
                          )}
                        </table>
                      </div>
                    </TabsContent>
                  </Tabs>
                </>
              ) : (
                <div className="text-sm text-gray-500">Tidak ada data.</div>
              )}
            </div>
            <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between gap-2">
              <Button variant="outline" className="rounded-full" onClick={() => { setDetailOpen(false); setDetailSupir(null); setDetailData(null); }}>
                Tutup
              </Button>
              <Button
                className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleExportDetailPdf}
                disabled={!detailData || detailExporting}
              >
                <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                {detailExporting ? 'Export...' : 'Export PDF'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
    </main>
  );
}
