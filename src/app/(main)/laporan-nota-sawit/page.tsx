'use client'
import { useState, useEffect, useMemo, useCallback } from 'react';
import { DataTable } from '@/components/data-table';
import { columns, NotaSawitLaporanData } from './columns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { CalendarIcon, ChartBarIcon, CheckIcon, ChevronUpDownIcon } from '@heroicons/react/24/outline';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import toast from 'react-hot-toast';
import ModalDetailNota from '@/app/(main)/nota-sawit/detail-modal';
import type { NotaSawitData } from '@/app/(main)/nota-sawit/columns';

import { Kebun, User, PabrikSawit, Kendaraan } from '@prisma/client';

interface MonthlyData {
  month: string;
  totalPembayaran: number;
  totalBerat: number;
  previousBerat?: number;
  growthKg?: number;
  growthPercentage?: number;
  isUp?: boolean;
}

interface MonthlyDataPerKebun {
  kebunName: string;
  data: MonthlyData[];
}

interface TopKebunData {
  nama: string;
  totalBerat: number;
}

interface KpiData {
  totalTonase: number;
  totalPotongan: number;
  totalNetto: number;
  totalPembayaran: number;
  jumlahNota: number;
  rataRataHargaPerKg: number;
  rataRataTonasePerNota: number;
  totalPph: number;
  totalPph25: number;
  totalNet: number;
  totalAktual: number;
  selisih: number;
}

type SearchOption = { value: string; label: string }

function SearchableFilter({
  label,
  value,
  onChange,
  options,
  allLabel,
  searchPlaceholder,
}: {
  label: string
  value: string
  onChange: (next: string) => void
  options: SearchOption[]
  allLabel: string
  searchPlaceholder: string
}) {
  const [open, setOpen] = useState(false)
  const selectedLabel = value ? (options.find((o) => o.value === value)?.label || value) : allLabel

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between bg-white border-gray-300 rounded-xl"
        >
          <span className="truncate">{selectedLabel}</span>
          <ChevronUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>Tidak ada data.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value={allLabel}
                onSelect={() => {
                  onChange('')
                  setOpen(false)
                }}
              >
                <CheckIcon className={cn('mr-2 h-4 w-4', !value ? 'opacity-100' : 'opacity-0')} />
                {allLabel}
              </CommandItem>
              {options.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={opt.label}
                  onSelect={() => {
                    onChange(opt.value)
                    setOpen(false)
                  }}
                >
                  <CheckIcon className={cn('mr-2 h-4 w-4', value === opt.value ? 'opacity-100' : 'opacity-0')} />
                  {opt.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export default function LaporanNotaSawitPage() {
  const [items, setItems] = useState<NotaSawitLaporanData[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const toYmd = useCallback((d: Date | undefined) => (d ? format(d, 'yyyy-MM-dd') : ''), []);
  
  // Date filter state - Default "this_month"
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [quickRange, setQuickRange] = useState('this_year');

  useEffect(() => {
    // Initialize dates on client side to avoid hydration mismatch
    const today = new Date();
    const start = new Date(today.getFullYear(), 0, 1);
    const end = new Date(today);
    end.setHours(0, 0, 0, 0);
    
    setQuickRange('this_year');
    setStartDate(start);
    setEndDate(end);
  }, []);

  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [monthlyDataPerKebun, setMonthlyDataPerKebun] = useState<MonthlyDataPerKebun[]>([]);
  const [selectedGrowthKebun, setSelectedGrowthKebun] = useState<string>('total');

  const [topKebun, setTopKebun] = useState<TopKebunData[]>([]);
  const [kpi, setKpi] = useState<KpiData | null>(null);
  const [kebunList, setKebunList] = useState<Kebun[]>([]);
  const [supirList, setSupirList] = useState<User[]>([]);
  const [pabrikList, setPabrikList] = useState<PabrikSawit[]>([]);
  const [kendaraanList, setKendaraanList] = useState<Kendaraan[]>([]);
  const [selectedKebun, setSelectedKebun] = useState('');
  const [selectedSupir, setSelectedSupir] = useState('');
  const [selectedPabrik, setSelectedPabrik] = useState('');
  const [selectedKendaraan, setSelectedKendaraan] = useState('');
  const [isStatsLoading, setIsStatsLoading] = useState(true);
  const [isTableLoading, setIsTableLoading] = useState(true);
  const [detailNota, setDetailNota] = useState<NotaSawitData | null>(null);

  const handleOpenDetailNota = useCallback((nota: any) => {
    setDetailNota(nota as any);
  }, []);

  const handleCloseDetailNota = useCallback(() => {
    setDetailNota(null);
  }, []);

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
      const start = new Date(today);
      start.setDate(today.getDate() - 7);
      setStartDate(start);
      setEndDate(today);
    } else if (val === 'last_30_days') {
      const start = new Date(today);
      start.setDate(today.getDate() - 30);
      setStartDate(start);
      setEndDate(today);
    } else if (val === 'this_month') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(start);
      setEndDate(today);
    } else if (val === 'this_year') {
      const start = new Date(today.getFullYear(), 0, 1);
      setStartDate(start);
      setEndDate(today);
    }
  }, []);

  useEffect(() => {
    async function fetchFilters() {
      try {
        const res = await fetch('/api/laporan-nota-sawit/filters');
        if (!res.ok) throw new Error('Gagal mengambil data filter');
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setKebunList(data.kebun || []);
        setSupirList(data.supir || []);
        setPabrikList(data.pabrik || []);
        setKendaraanList(data.kendaraan || []);
      } catch (e: any) {
        console.error(e.message);
      }
    }
    fetchFilters();
  }, []);

  useEffect(() => {
    async function fetchData() {
      const startDateString = toYmd(startDate);
      const endDateString = toYmd(endDate);

      if (!startDateString || !endDateString) {
        setItems([]);
        setTotalItems(0);
        return;
      }
      setIsTableLoading(true);
      try {
        const params = new URLSearchParams({
          startDate: startDateString,
          endDate: endDateString,
          page: page.toString(),
          limit: limit.toString(),
        });
        if (selectedKebun) params.append('kebunId', selectedKebun);
        if (selectedSupir) params.append('supirId', selectedSupir);
        if (selectedPabrik) params.append('pabrikId', selectedPabrik);
        if (selectedKendaraan) params.append('kendaraanPlatNomor', selectedKendaraan);

        const res = await fetch(`/api/nota-sawit?${params.toString()}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('Gagal mengambil data tabel');
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setItems(Array.isArray(data.data) ? data.data : []);
        setTotalItems(data.total);
      } catch (e: any) {
        console.error('Error fetching stats:', e);
      } finally {
        setIsTableLoading(false);
      }
    }
    fetchData();
  }, [startDate, endDate, page, limit, selectedKebun, selectedSupir, selectedPabrik, selectedKendaraan, toYmd]);

  useEffect(() => {
    async function fetchStats() {
      const startDateString = toYmd(startDate);
      const endDateString = toYmd(endDate);

      if (!startDateString || !endDateString) {
        setMonthlyData([]);
        setTopKebun([]);
        setKpi(null);
        return;
      }
      setIsStatsLoading(true);
      try {
        const params = new URLSearchParams({
          startDate: startDateString,
          endDate: endDateString,
        });
        if (selectedKebun) params.append('kebunId', selectedKebun);
        if (selectedSupir) params.append('supirId', selectedSupir);
        if (selectedPabrik) params.append('pabrikId', selectedPabrik);
        if (selectedKendaraan) params.append('kendaraanPlatNomor', selectedKendaraan);

        const res = await fetch(`/api/laporan-nota-sawit/statistik?${params.toString()}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('Gagal mengambil data statistik');
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setKpi(data.kpi || null);
        setMonthlyData(data.monthlyData || []);
        setMonthlyDataPerKebun(data.monthlyDataPerKebun || []);
        setTopKebun(data.topKebun || []);
      } catch (e: any) {
        console.error('Error fetching stats:', e);
      } finally {
        setIsStatsLoading(false);
      }
    }
    fetchStats();
  }, [startDate, endDate, selectedKebun, selectedSupir, selectedPabrik, selectedKendaraan, toYmd]);

  const growthKebunOptions = useMemo(() => {
    return Array.from(new Set((monthlyDataPerKebun || []).map((k) => k.kebunName))).sort((a, b) => a.localeCompare(b))
  }, [monthlyDataPerKebun])

  useEffect(() => {
    if (selectedGrowthKebun !== 'total' && !growthKebunOptions.includes(selectedGrowthKebun)) {
      setSelectedGrowthKebun('total')
    }
  }, [growthKebunOptions, selectedGrowthKebun])

  const handleExport = async () => {
    try {
      const startDateString = toYmd(startDate);
      const endDateString = toYmd(endDate);
      if (!startDate || !endDate || !startDateString || !endDateString) {
        toast.error('Rentang waktu belum dipilih')
        return
      }
      toast.loading('Mempersiapkan CSV...', { id: 'export-nota-sawit' })
      
      const params = new URLSearchParams({
        startDate: startDateString || '',
        endDate: endDateString || '',
      });
      if (selectedKebun) params.append('kebunId', selectedKebun);
      if (selectedSupir) params.append('supirId', selectedSupir);
      if (selectedPabrik) params.append('pabrikId', selectedPabrik);
      if (selectedKendaraan) params.append('kendaraanPlatNomor', selectedKendaraan);

      const res = await fetch(`/api/nota-sawit?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Gagal mengambil data untuk ekspor');
      const exportData = await res.json();
      if (exportData.error) throw new Error(exportData.error);
      const dataToExport = Array.isArray(exportData) ? exportData : exportData.data;

      if (!Array.isArray(dataToExport)) {
        throw new Error('Format data ekspor tidak valid');
      }

      const totals = dataToExport.reduce((acc, item) => {
        acc.grossKg += Number(item.timbangan?.grossKg ?? item.bruto ?? 0) || 0;
        acc.tareKg += Number(item.timbangan?.tareKg ?? item.tara ?? 0) || 0;
        acc.netKg += Number(item.timbangan?.netKg ?? item.netto ?? 0) || 0;
        acc.potongan += Number(item.potongan ?? 0) || 0;
        acc.beratAkhir += Number(item.beratAkhir ?? 0) || 0;
        acc.hargaPerKg += Number(item.hargaPerKg ?? 0) || 0;
        acc.totalPembayaran += Number(item.totalPembayaran ?? 0) || 0;
        acc.pph += Number(item.pph ?? 0) || 0;
        acc.pembayaranSetelahPph += Number(item.pembayaranSetelahPph ?? 0) || 0;
        acc.pembayaranAktual += Number(item.pembayaranAktual ?? 0) || 0;
        return acc;
      }, { grossKg: 0, tareKg: 0, netKg: 0, potongan: 0, beratAkhir: 0, hargaPerKg: 0, totalPembayaran: 0, pph: 0, pembayaranSetelahPph: 0, pembayaranAktual: 0 });

      const avgHargaPerKg = dataToExport.length > 0 ? totals.hargaPerKg / dataToExport.length : 0;

      const jumlahNota = dataToExport.length;
      const totalLunas = dataToExport.filter(item => (item.statusPembayaran || '').trim().toUpperCase() === 'LUNAS').reduce((acc, item) => acc + Number(item.totalPembayaran || 0), 0);
      const totalBelumLunas = dataToExport.filter(item => (item.statusPembayaran || '').trim().toUpperCase() === 'BELUM_LUNAS').reduce((acc, item) => acc + Number(item.totalPembayaran), 0);

      const csvHeader = [
        'No',
        'Tanggal Bongkar',
        'Pabrik Sawit',
        'Supir',
        'Plat Nomor',
        'Kebun',
        'Berat Bruto (kg)',
        'Berat Tara (kg)',
        'Berat Bersih (kg)',
        'Potongan (kg)',
        'Berat Akhir (kg)',
        'Harga/kg (Rp)',
        'Total Pembayaran (Rp)',
        'PPh 25 (Rp)',
        'Total Bayar Net (Rp)',
        'Pembayaran Aktual (Rp)',
        'Status Pembayaran',
      ];

      const escapeCsv = (str: any) => {
        const string = String(str ?? '');
        if (string.includes(',') || string.includes('\n') || string.includes('"')) {
          return `"${string.replace(/"/g, '""')}"`;
        }
        return string;
      };

      const csvRows = dataToExport.map((item, index) => [
        index + 1,
        escapeCsv(item.tanggalBongkar ? new Date(item.tanggalBongkar).toLocaleDateString('id-ID') : 'N/A'),
        escapeCsv(item.pabrikSawit?.name ?? '-'),
        escapeCsv(item.supir?.name ?? '-'),
        escapeCsv(item.kendaraanPlatNomor ?? '-'),
        escapeCsv(item.timbangan?.kebun?.name ?? item.kebun?.name ?? '-'),
        escapeCsv(Number(item.timbangan?.grossKg ?? item.bruto ?? 0) || 0),
        escapeCsv(Number(item.timbangan?.tareKg ?? item.tara ?? 0) || 0),
        escapeCsv(Number(item.timbangan?.netKg ?? item.netto ?? 0) || 0),
        escapeCsv(Number(item.potongan ?? 0) || 0),
        escapeCsv(Number(item.beratAkhir ?? 0) || 0),
        escapeCsv(Number(item.hargaPerKg ?? 0) || 0),
        escapeCsv(Number(item.totalPembayaran ?? 0) || 0),
        escapeCsv(Number(item.pph ?? 0) || 0),
        escapeCsv(Number(item.pembayaranSetelahPph ?? 0) || 0),
        escapeCsv(Number(item.pembayaranAktual ?? 0) || 0),
        escapeCsv(item.statusPembayaran ?? ''),
      ].join(','));

      const summaryRow = [
        'Total', '', '', '', '', '',
        totals.grossKg,
        totals.tareKg,
        totals.netKg,
        totals.potongan,
        totals.beratAkhir,
        Math.round(avgHargaPerKg),
        totals.totalPembayaran,
        totals.pph,
        totals.pembayaranSetelahPph,
        totals.pembayaranAktual,
        ''
      ].join(',');

      const summaryLunas = `Jumlah Nota,${jumlahNota}`;
      const summaryTotalLunas = `Total Pembayaran Lunas,${Math.round(totalLunas)}`;
      const summaryTotalBelumLunas = `Total Pembayaran Belum Lunas,${Math.round(totalBelumLunas)}`;

      const csvString = [csvHeader.join(','), ...csvRows, '', summaryRow, summaryLunas, summaryTotalLunas, summaryTotalBelumLunas].join('\n');
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      const startKey = format(startDate, 'yyyy-MM-dd')
      const endKey = format(endDate, 'yyyy-MM-dd')
      link.setAttribute('download', `laporan-nota-sawit-${startKey}-sampai-${endKey}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('CSV berhasil diunduh', { id: 'export-nota-sawit' })

    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Gagal mengekspor data', { id: 'export-nota-sawit' })
    }
  };

  const handleExportPdf = async () => {
    try {
      const startDateString = toYmd(startDate);
      const endDateString = toYmd(endDate);
      if (!startDate || !endDate || !startDateString || !endDateString) {
        toast.error('Rentang waktu belum dipilih')
        return
      }
      toast.loading('Mempersiapkan PDF...', { id: 'export-nota-sawit' })
      
      const params = new URLSearchParams({
        startDate: startDateString || '',
        endDate: endDateString || '',
      });
      if (selectedKebun) params.append('kebunId', selectedKebun);
      if (selectedSupir) params.append('supirId', selectedSupir);
      if (selectedPabrik) params.append('pabrikId', selectedPabrik);

      const res = await fetch(`/api/nota-sawit?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Gagal mengambil data untuk ekspor');
      const exportData = await res.json();
      if (exportData.error) throw new Error(exportData.error);
      const dataToExport = Array.isArray(exportData) ? exportData : exportData.data;

      if (!Array.isArray(dataToExport)) {
        throw new Error('Format data ekspor tidak valid');
      }

      const jsPDF = (await import('jspdf')).default;
      const autoTable = (await import('jspdf-autotable')).default;

      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      // Add title and date range
      doc.setFontSize(16);
      doc.setTextColor(5, 150, 105);
      doc.text('Laporan Nota Sawit', 14, 15);
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text(`Periode: ${startDate ? format(startDate, 'dd MMM yyyy', { locale: idLocale }) : ''} - ${endDate ? format(endDate, 'dd MMM yyyy', { locale: idLocale }) : ''}`, 14, 22);

      const totals = dataToExport.reduce((acc, item) => {
        acc.grossKg += Number(item.timbangan?.grossKg ?? item.bruto ?? 0) || 0;
        acc.tareKg += Number(item.timbangan?.tareKg ?? item.tara ?? 0) || 0;
        acc.netKg += Number(item.timbangan?.netKg ?? item.netto ?? 0) || 0;
        acc.potongan += Number(item.potongan ?? 0) || 0;
        acc.beratAkhir += Number(item.beratAkhir ?? 0) || 0;
        acc.hargaPerKg += Number(item.hargaPerKg ?? 0) || 0;
        acc.totalPembayaran += Number(item.totalPembayaran ?? 0) || 0;
        acc.pph += Number(item.pph ?? 0) || 0;
        acc.pembayaranSetelahPph += Number(item.pembayaranSetelahPph ?? 0) || 0;
        acc.pembayaranAktual += Number(item.pembayaranAktual ?? 0) || 0;
        return acc;
      }, { grossKg: 0, tareKg: 0, netKg: 0, potongan: 0, beratAkhir: 0, hargaPerKg: 0, totalPembayaran: 0, pph: 0, pembayaranSetelahPph: 0, pembayaranAktual: 0 });

      const avgHargaPerKg = dataToExport.length > 0 ? totals.hargaPerKg / dataToExport.length : 0;
      const jumlahNota = dataToExport.length;
      const totalLunas = dataToExport.filter(item => (item.statusPembayaran || '').trim().toUpperCase() === 'LUNAS').reduce((acc, item) => acc + Number(item.totalPembayaran), 0);
      const totalBelumLunas = dataToExport.filter(item => (item.statusPembayaran || '').trim().toUpperCase() === 'BELUM_LUNAS').reduce((acc, item) => acc + Number(item.totalPembayaran), 0);

      const tableColumn = [
        'No', 'Tgl Bongkar', 'Pabrik', 'Supir', 'Plat No', 'Kebun', 
        'Bruto', 'Tara', 'Netto', 'Potongan', 'Berat Akhir', 'Harga/kg', 'Total', 'PPh 25', 'Net', 'Aktual', 'Status'
      ];
      
      const tableRows = dataToExport.map((item, index) => [
        index + 1,
        item.tanggalBongkar ? new Date(item.tanggalBongkar).toLocaleDateString('id-ID') : 'N/A',
        item.pabrikSawit?.name ?? '-',
        item.supir?.name ?? '-',
        item.kendaraanPlatNomor ?? '-',
        item.timbangan?.kebun?.name ?? item.kebun?.name ?? '-',
        (Number(item.timbangan?.grossKg ?? item.bruto ?? 0) || 0).toLocaleString('id-ID'),
        (Number(item.timbangan?.tareKg ?? item.tara ?? 0) || 0).toLocaleString('id-ID'),
        (Number(item.timbangan?.netKg ?? item.netto ?? 0) || 0).toLocaleString('id-ID'),
        (Number(item.potongan ?? 0) || 0).toLocaleString('id-ID'),
        (Number(item.beratAkhir ?? 0) || 0).toLocaleString('id-ID'),
        new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(Number(item.hargaPerKg ?? 0) || 0),
        new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(Number(item.totalPembayaran ?? 0) || 0),
        new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(Number(item.pph ?? 0) || 0),
        new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(Number(item.pembayaranSetelahPph ?? 0) || 0),
        (Number(item.pembayaranAktual ?? 0) || 0) ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(Number(item.pembayaranAktual ?? 0) || 0) : '-',
        (item.statusPembayaran || '').replace('BELUM_LUNAS', 'B.LUNAS'),
      ]);

      const footerRow = [
        {
          content: 'Total',
          colSpan: 6,
          styles: { textAlign: 'right', fontStyle: 'bold' as 'bold' },
        },
        { content: Math.round(totals.grossKg).toLocaleString('id-ID'), styles: { fontStyle: 'bold' as 'bold' } },
        { content: Math.round(totals.tareKg).toLocaleString('id-ID'), styles: { fontStyle: 'bold' as 'bold' } },
        { content: Math.round(totals.netKg).toLocaleString('id-ID'), styles: { fontStyle: 'bold' as 'bold' } },
        { content: Math.round(totals.potongan).toLocaleString('id-ID'), styles: { fontStyle: 'bold' as 'bold' } },
        { content: Math.round(totals.beratAkhir).toLocaleString('id-ID'), styles: { fontStyle: 'bold' as 'bold' } },
        { content: new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(avgHargaPerKg)), styles: { fontStyle: 'bold' as 'bold' } },
        { content: new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(totals.totalPembayaran)), styles: { fontStyle: 'bold' as 'bold' } },
        { content: new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(totals.pph)), styles: { fontStyle: 'bold' as 'bold' } },
        { content: new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(totals.pembayaranSetelahPph)), styles: { fontStyle: 'bold' as 'bold' } },
        { content: new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(totals.pembayaranAktual)), styles: { fontStyle: 'bold' as 'bold' } },
        { content: '', styles: { fontStyle: 'bold' as 'bold' } },
      ];

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        foot: [footerRow],
        startY: 35,
        theme: 'grid',
        styles: {
          fontSize: 7,
          cellPadding: 1.5,
        },
        headStyles: {
          fillColor: [5, 150, 105],
          textColor: 255,
          fontStyle: 'bold' as 'bold',
        },
        footStyles: {
          fillColor: [230, 230, 230],
          textColor: 0,
          fontStyle: 'bold' as 'bold',
        },
      });

      const finalY = (doc as any).lastAutoTable.finalY;
      doc.setFontSize(10);
      doc.text(`Jumlah Nota: ${jumlahNota}`, 14, finalY + 10);
      doc.text(`Total Pembayaran Lunas: ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(totalLunas))}`, 14, finalY + 15);
      doc.text(`Total Pembayaran Belum Lunas: ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(totalBelumLunas))}`, 14, finalY + 20);

      const startKey = format(startDate, 'yyyy-MM-dd')
      const endKey = format(endDate, 'yyyy-MM-dd')
      doc.save(`laporan-nota-sawit-${startKey}-sampai-${endKey}.pdf`);
      toast.success('PDF berhasil diunduh', { id: 'export-nota-sawit' })

    } catch (e: any) {
      console.error('Error exporting PDF:', e);
      toast.error(e?.message || 'Gagal mengekspor PDF', { id: 'export-nota-sawit' })
    }
  };

  return (
    <main className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Laporan Nota Sawit</h1>

        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
          <h2 className="text-xl font-semibold mb-4">Filter Laporan</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
             <div className="flex flex-col space-y-2">
                <Label className="text-sm font-medium text-gray-700">Rentang Waktu</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="date"
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal bg-white border-gray-300",
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
            
            <div className="flex flex-col space-y-2">
              <Label className="text-sm font-medium text-gray-700">Filter per Kebun</Label>
              <SearchableFilter
                label="Kebun"
                value={selectedKebun}
                onChange={(v) => { setSelectedKebun(v); setPage(1) }}
                allLabel="Semua Kebun"
                searchPlaceholder="Cari kebun..."
                options={kebunList.map((k) => ({ value: String(k.id), label: k.name }))}
              />
            </div>
            <div className="flex flex-col space-y-2">
              <Label className="text-sm font-medium text-gray-700">Filter per Supir</Label>
              <SearchableFilter
                label="Supir"
                value={selectedSupir}
                onChange={(v) => { setSelectedSupir(v); setPage(1) }}
                allLabel="Semua Supir"
                searchPlaceholder="Cari supir..."
                options={supirList.map((s) => ({ value: String(s.id), label: s.name }))}
              />
            </div>
            <div className="flex flex-col space-y-2">
              <Label className="text-sm font-medium text-gray-700">Filter per Pabrik</Label>
              <SearchableFilter
                label="Pabrik"
                value={selectedPabrik}
                onChange={(v) => { setSelectedPabrik(v); setPage(1) }}
                allLabel="Semua Pabrik"
                searchPlaceholder="Cari pabrik..."
                options={pabrikList.map((p) => ({ value: String(p.id), label: p.name }))}
              />
            </div>
                <div className="flex flex-col space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Filter per Kendaraan</Label>
                  <SearchableFilter
                    label="Kendaraan"
                    value={selectedKendaraan}
                    onChange={(v) => { setSelectedKendaraan(v); setPage(1) }}
                    allLabel="Semua Kendaraan"
                    searchPlaceholder="Cari plat..."
                    options={kendaraanList.map((k) => ({ value: k.platNomor, label: `${k.platNomor}${k.merk ? ` • ${k.merk}` : ''}` }))}
                  />
                </div>
          </div>
        </div>

        {(kpi || isStatsLoading) && (
          <div className="mb-8">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                    <ChartBarIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Ringkasan Laporan Nota Sawit</p>
                    <p className="text-xs text-gray-500">Tonase dan nilai pembayaran</p>
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  Periode: <span className="font-semibold text-gray-900">{dateDisplay}</span>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-xl bg-emerald-50/60 px-3 py-2">
                  <p className="text-xs text-emerald-700">Total Tonase</p>
                  {isStatsLoading ? <Skeleton className="h-6 w-24 mt-1" /> : (
                    <>
                      <p className="text-lg font-semibold text-gray-900">
                        {kpi ? new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(kpi.totalTonase)) : 0} kg
                      </p>
                      <p className="text-xs text-gray-500">
                        {kpi?.jumlahNota} Nota | Rata-rata {kpi ? new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(kpi.rataRataTonasePerNota || 0)) : 0} kg
                      </p>
                    </>
                  )}
                </div>
                <div className="rounded-xl bg-amber-50/70 px-3 py-2">
                  <p className="text-xs text-amber-700">Total Pembayaran</p>
                  {isStatsLoading ? <Skeleton className="h-6 w-28 mt-1" /> : (
                    <p className="text-lg font-semibold text-gray-900">{kpi?.totalPembayaran ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(kpi.totalPembayaran)) : 'Rp 0'}</p>
                  )}
                </div>
                <div className="rounded-xl bg-sky-50/70 px-3 py-2">
                  <p className="text-xs text-sky-700">Rata-rata Harga</p>
                  {isStatsLoading ? <Skeleton className="h-6 w-28 mt-1" /> : (
                    <p className="text-lg font-semibold text-gray-900" title={kpi?.rataRataHargaPerKg ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(kpi.rataRataHargaPerKg)) : 'Rp 0'}>
                      {kpi?.rataRataHargaPerKg ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(kpi.rataRataHargaPerKg)) : 'Rp 0'} /kg
                    </p>
                  )}
                </div>
                <div className="rounded-xl bg-amber-50/70 px-3 py-2">
                  <p className="text-xs text-amber-700">Total PPh 25</p>
                  {isStatsLoading ? <Skeleton className="h-6 w-28 mt-1" /> : (
                    <p className="text-lg font-semibold text-gray-900">{kpi?.totalPph ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(kpi.totalPph)) : 'Rp 0'}</p>
                  )}
                </div>
                <div className="rounded-xl bg-sky-50/70 px-3 py-2">
                  <p className="text-xs text-sky-700">Total Bayar Net</p>
                  {isStatsLoading ? <Skeleton className="h-6 w-28 mt-1" /> : (
                    <p className="text-lg font-semibold text-gray-900">{kpi?.totalNet ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(kpi.totalNet)) : 'Rp 0'}</p>
                  )}
                </div>
                <div className="rounded-xl bg-emerald-50/60 px-3 py-2">
                  <p className="text-xs text-emerald-700">Pembayaran Aktual</p>
                  {isStatsLoading ? <Skeleton className="h-6 w-28 mt-1" /> : (
                    <p className="text-lg font-semibold text-gray-900">{kpi?.totalAktual ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(kpi.totalAktual)) : 'Rp 0'}</p>
                  )}
                </div>
                <div className="rounded-xl bg-emerald-50/60 px-3 py-2">
                  <p className="text-xs text-emerald-700">Selisih</p>
                  {isStatsLoading ? <Skeleton className="h-6 w-28 mt-1" /> : (
                    <p className="text-lg font-semibold text-gray-900">{kpi?.selisih ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(kpi.selisih)) : 'Rp 0'}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Statistik Produksi Kebun</h2>
            {isStatsLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                  <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                  <Tooltip formatter={(value, name) => {
                    if (name === 'Total Pembayaran') return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(value as number);
                    if (name === 'Total Berat') return `${(value as number).toLocaleString('id-ID')} kg`;
                    return value;
                  }} />
                  <Legend />
                  <Bar yAxisId="left" dataKey="totalPembayaran" fill="#8884d8" name="Total Pembayaran" />
                  <Bar yAxisId="right" dataKey="totalBerat" fill="#82ca9d" name="Total Berat" />
                </BarChart>
              </ResponsiveContainer>
            )}

            {!isStatsLoading && monthlyData.length > 0 && (
              <div className="mt-6 overflow-x-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-600">Analisa Pertumbuhan Produksi</h3>
                  <Select value={selectedGrowthKebun} onValueChange={setSelectedGrowthKebun}>
                    <SelectTrigger className="w-[200px] h-8 text-sm">
                      <SelectValue placeholder="Pilih Kebun" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="total">Total Semua Kebun</SelectItem>
                      {growthKebunOptions.map((name) => (
                        <SelectItem key={name} value={name}>{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="py-2 px-3 text-left">Bulan</th>
                      <th className="py-2 px-3 text-right">Total Berat</th>
                      <th className="py-2 px-3 text-right">Pertumbuhan (kg)</th>
                      <th className="py-2 px-3 text-right">Pertumbuhan (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyData.map((totalItem, index) => {
                       let data = totalItem;
                       if (selectedGrowthKebun !== 'total') {
                         data = monthlyDataPerKebun.find(k => k.kebunName === selectedGrowthKebun)?.data.find(d => d.month === totalItem.month) || {
                           month: totalItem.month,
                           totalBerat: 0,
                           totalPembayaran: 0,
                           previousBerat: 0,
                           growthKg: 0,
                           growthPercentage: 0,
                           isUp: false
                         };
                       }
                       
                       return (
                      <tr key={data.month} className="border-t">
                        <td className="py-2 px-3">{data.month}</td>
                        <td className="py-2 px-3 text-right">{data.totalBerat.toLocaleString('id-ID')} kg</td>
                        <td className={`py-2 px-3 text-right ${index === 0 ? 'text-gray-400' : (data.isUp ? 'text-green-600' : 'text-red-600')}`}>
                          {index === 0 ? '-' : `${data.isUp ? '+' : ''}${(data.growthKg || 0).toLocaleString('id-ID')} kg`}
                        </td>
                         <td className={`py-2 px-3 text-right ${index === 0 ? 'text-gray-400' : (data.isUp ? 'text-green-600' : 'text-red-600')}`}>
                          {index === 0 ? '-' : `${data.isUp ? '+' : ''}${(data.growthPercentage || 0).toFixed(2)}%`}
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Kebun Paling Produktif</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white">
                <thead>
                  <tr>
                    <th className="py-2 px-4 border-b">Peringkat</th>
                    <th className="py-2 px-4 border-b">Nama Kebun</th>
                    <th className="py-2 px-4 border-b text-right">Total Berat Bersih</th>
                  </tr>
                </thead>
                <tbody>
                  {isStatsLoading ? (
                     [...Array(5)].map((_, i) => (
                       <tr key={i}>
                         <td className="py-2 px-4 border-b"><Skeleton className="h-4 w-full" /></td>
                         <td className="py-2 px-4 border-b"><Skeleton className="h-4 w-full" /></td>
                         <td className="py-2 px-4 border-b"><Skeleton className="h-4 w-full" /></td>
                       </tr>
                     ))
                  ) : topKebun.map((kebun, index) => (
                    <tr key={index}>
                      <td className="py-2 px-4 border-b text-center">{index + 1}</td>
                      <td className="py-2 px-4 border-b">{kebun.nama}</td>
                      <td className="py-2 px-4 border-b text-right">{(kebun.totalBerat || 0).toLocaleString('id-ID')} kg</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
              <h2 className="text-xl font-semibold">Detail Riwayat Nota Sawit</h2>
              <div className="flex flex-row gap-2 w-full md:w-auto">
                <button 
                  onClick={handleExport}
                  disabled={isTableLoading}
                  className="flex-1 md:flex-none px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-xl hover:bg-green-700 disabled:opacity-50 text-center justify-center flex items-center"
                >
                  Ekspor ke CSV
                </button>
                <button 
                  onClick={handleExportPdf}
                  disabled={isTableLoading}
                  className="flex-1 md:flex-none px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-xl hover:bg-red-700 disabled:opacity-50 text-center justify-center flex items-center"
                >
                  Ekspor ke PDF
                </button>
              </div>
            </div>
            <div className="md:hidden space-y-3">
              {isTableLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                ))
              ) : items.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center text-sm text-gray-500">
                  Tidak ada data nota sawit
                </div>
              ) : (
                items.map((item, index) => {
                  const dateValue = item.timbangan?.date || item.tanggalBongkar || item.createdAt;
                  const kebunName = item.timbangan?.kebun?.name ?? item.kebun?.name ?? '-';
                  const netto = item.timbangan?.netKg ?? item.netto;
                  return (
                    <div key={item.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-3">
                      <button
                        type="button"
                        onClick={() => handleOpenDetailNota(item)}
                        className="w-full text-left"
                      >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="font-semibold text-gray-900">#{(page - 1) * limit + index + 1}</div>
                          <div className="text-xs text-gray-500">{dateValue ? new Date(dateValue).toLocaleDateString('id-ID') : '-'}</div>
                          <div className="text-xs text-gray-500">{kebunName}</div>
                          <div className="text-xs text-gray-500">{item.supir?.name || '-'}</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <div className="text-gray-400">Netto (Kg)</div>
                          <div className="font-semibold text-gray-900">{typeof netto === 'number' ? netto.toLocaleString('id-ID') : '-'}</div>
                        </div>
                        <div>
                          <div className="text-gray-400">Total</div>
                          <div className="font-semibold text-emerald-700">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(item.totalPembayaran || 0)}</div>
                        </div>
                        <div>
                          <div className="text-gray-400">Potongan</div>
                          <div className="font-semibold text-red-600">{new Intl.NumberFormat('id-ID').format(item.potongan || 0)}</div>
                        </div>
                        <div>
                          <div className="text-gray-400">Status</div>
                          <div className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${item.statusPembayaran === 'LUNAS' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                            {item.statusPembayaran?.replace('_', ' ') || '-'}
                          </div>
                        </div>
                      </div>
                      </button>
                    </div>
                  )
                })
              )}
            </div>

            <div className="hidden md:block">
              <DataTable
                columns={columns}
                data={items}
                isLoading={isTableLoading}
                meta={{ kpi, page, limit, onRowClick: handleOpenDetailNota }}
              />
            </div>
            <div className="flex flex-col md:flex-row items-center justify-between mt-4 gap-4">
            <div className="text-sm text-gray-700 text-center md:text-left">
              Menampilkan {items.length > 0 ? (page - 1) * limit + 1 : 0} - {Math.min(page * limit, totalItems)} dari {totalItems} data
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto justify-center md:justify-end">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Per halaman</span>
                <select
                  value={limit}
                  onChange={(e) => {
                    const next = Number(e.target.value) || 10
                    setLimit(next)
                    setPage(1)
                  }}
                  className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                </select>
              </div>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || isTableLoading} className="flex-1 md:flex-none px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50">Sebelumnya</button>
              <button onClick={() => setPage(p => Math.min(p + 1, Math.ceil(totalItems / limit)))} disabled={page * limit >= totalItems || isTableLoading} className="flex-1 md:flex-none px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50">Berikutnya</button>
            </div>
          </div>
        </div>
      </div>
      <ModalDetailNota nota={detailNota} onClose={handleCloseDetailNota} readonly />
    </main>
  );
}
