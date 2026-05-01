'use client'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { DataTable } from '@/components/data-table';
import { columns, NotaSawitLaporanData } from './columns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { ArrowDownTrayIcon, CalendarIcon, ChartBarIcon, DocumentTextIcon, MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import toast from 'react-hot-toast';
import ModalDetailNota from '@/app/(main)/nota-sawit/detail-modal';
import type { NotaSawitData } from '@/app/(main)/nota-sawit/columns';

import { Kebun, User, PabrikSawit, Kendaraan, Perusahaan } from '@prisma/client';

interface MonthlyData {
  month: string;
  totalPembayaran: number;
  totalBerat: number;
  previousBerat?: number;
  growthKg?: number;
  growthPercentage?: number;
  isUp?: boolean;
}

interface MonthlyDataPerGroup {
  groupName: string;
  data: MonthlyData[];
}

interface TopKebunData {
  nama: string;
  totalBerat: number;
}

type KebunProduksiTahunanRow = {
  kebunName: string;
  months: Array<{ kg: number; pct: number | null }>;
  totalKg: number;
};

type TransposedKebunProduksiRow = {
  month: string;
  kebuns: Array<{ name: string; kg: number; pct: number | null }>;
  totalKg: number;
};

interface KpiData {
  totalTonase: number;
  totalPotongan: number;
  totalNetto: number;
  totalPembayaran: number;
  lunasCount: number;
  belumLunasCount: number;
  totalPembayaranLunas: number;
  totalPembayaranBelumLunas: number;
  jumlahNota: number;
  rataRataHargaPerKg: number;
  rataRataTonasePerNota: number;
  totalPph: number;
  totalPph25: number;
  totalNet: number;
  totalPembayaranNotaSawit: number;
  selisih: number;
}

type SearchOption = { value: string; label: string }

export default function LaporanNotaSawitPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
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
  const [monthlyDataPerGroup, setMonthlyDataPerGroup] = useState<MonthlyDataPerGroup[]>([]);
  const [selectedGrowthGroup, setSelectedGrowthGroup] = useState<string>('total');
  const [groupBy, setGroupBy] = useState<'kebun' | 'perusahaan' | 'pabrik'>('kebun')

  const [topGroups, setTopGroups] = useState<TopKebunData[]>([]);
  const [yearlyKebunMonthly, setYearlyKebunMonthly] = useState<MonthlyDataPerGroup[]>([]);
  const [isYearlyKebunLoading, setIsYearlyKebunLoading] = useState(true);
  const [kpi, setKpi] = useState<KpiData | null>(null);
  const [kebunList, setKebunList] = useState<Kebun[]>([]);
  const [supirList, setSupirList] = useState<User[]>([]);
  const [pabrikList, setPabrikList] = useState<PabrikSawit[]>([]);
  const [kendaraanList, setKendaraanList] = useState<Kendaraan[]>([]);
  const [perusahaanList, setPerusahaanList] = useState<Perusahaan[]>([]);
  const [selectedKebun, setSelectedKebun] = useState('');
  const [selectedSupir, setSelectedSupir] = useState('');
  const [selectedPabrik, setSelectedPabrik] = useState('');
  const [selectedKendaraan, setSelectedKendaraan] = useState('');
  const [selectedPerusahaan, setSelectedPerusahaan] = useState('');
  const [selectedStatusPembayaran, setSelectedStatusPembayaran] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [isStatsLoading, setIsStatsLoading] = useState(true);
  const [isTableLoading, setIsTableLoading] = useState(true);
  const [detailNota, setDetailNota] = useState<NotaSawitData | null>(null);
  const [isProduksiExporting, setIsProduksiExporting] = useState(false);
  const [notaImageOpen, setNotaImageOpen] = useState(false)
  const [notaImageUrl, setNotaImageUrl] = useState<string | null>(null)
  const [notaImageDownloading, setNotaImageDownloading] = useState(false)

  const handleOpenDetailNota = useCallback((nota: any) => {
    setDetailNota(nota as any);
  }, []);

  const handleCloseDetailNota = useCallback(() => {
    setDetailNota(null);
  }, []);

  const handleOpenNotaImage = useCallback((url: string) => {
    setNotaImageUrl(url)
    setNotaImageOpen(true)
  }, [])

  const handleDownloadNotaImage = useCallback(async () => {
    if (!notaImageUrl || notaImageDownloading) return
    try {
      setNotaImageDownloading(true)
      const res = await fetch(notaImageUrl)
      if (!res.ok) throw new Error('Gagal mengunduh gambar')
      const blob = await res.blob()
      const contentType = res.headers.get('content-type') || ''
      const extFromType = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg' : ''
      const extFromUrl = (() => {
        const clean = String(notaImageUrl).split('?')[0]
        const m = clean.match(/\.([a-zA-Z0-9]+)$/)
        return m ? m[1].toLowerCase() : ''
      })()
      const ext = extFromType || extFromUrl || 'jpg'
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `nota-sawit-${Date.now()}.${ext}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(a.href)
    } catch (e: any) {
      toast.error(e?.message || 'Gagal mengunduh gambar')
    } finally {
      setNotaImageDownloading(false)
    }
  }, [notaImageUrl, notaImageDownloading])

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
        setPerusahaanList(data.perusahaan || []);
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
        if (selectedPerusahaan) params.append('perusahaanId', selectedPerusahaan);
        if (selectedStatusPembayaran) params.append('statusPembayaran', selectedStatusPembayaran);
        if (searchQuery) params.append('search', searchQuery);

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
  }, [startDate, endDate, page, limit, searchQuery, selectedKebun, selectedSupir, selectedPabrik, selectedKendaraan, selectedPerusahaan, selectedStatusPembayaran, toYmd]);

  useEffect(() => {
    async function fetchStats() {
      const startDateString = toYmd(startDate);
      const endDateString = toYmd(endDate);

      if (!startDateString || !endDateString) {
        setMonthlyData([]);
        setTopGroups([]);
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
        if (selectedPerusahaan) params.append('perusahaanId', selectedPerusahaan);
        if (selectedStatusPembayaran) params.append('statusPembayaran', selectedStatusPembayaran);
        if (searchQuery) params.append('search', searchQuery);
        params.append('groupBy', groupBy);

        const res = await fetch(`/api/laporan-nota-sawit/statistik?${params.toString()}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('Gagal mengambil data statistik');
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setKpi(data.kpi || null);
        setMonthlyData(data.monthlyData || []);
        setMonthlyDataPerGroup(data.monthlyDataPerGroup || []);
        setTopGroups(data.topGroups || []);
      } catch (e: any) {
        console.error('Error fetching stats:', e);
      } finally {
        setIsStatsLoading(false);
      }
    }
    fetchStats();
  }, [startDate, endDate, searchQuery, selectedKebun, selectedSupir, selectedPabrik, selectedKendaraan, selectedPerusahaan, selectedStatusPembayaran, groupBy, toYmd]);

  useEffect(() => {
    async function fetchYearlyKebun() {
      const refDate = startDate || new Date();
      const year = refDate.getFullYear();
      const startOfYear = new Date(year, 0, 1);
      const endOfYear = new Date(year, 11, 31);
      const startDateString = toYmd(startOfYear);
      const endDateString = toYmd(endOfYear);

      if (!startDateString || !endDateString) {
        setYearlyKebunMonthly([]);
        setIsYearlyKebunLoading(false);
        return;
      }

      setIsYearlyKebunLoading(true);
      try {
        const params = new URLSearchParams({
          startDate: startDateString,
          endDate: endDateString,
          groupBy: 'kebun',
        });
        if (selectedKebun) params.append('kebunId', selectedKebun);
        if (selectedSupir) params.append('supirId', selectedSupir);
        if (selectedPabrik) params.append('pabrikId', selectedPabrik);
        if (selectedKendaraan) params.append('kendaraanPlatNomor', selectedKendaraan);
        if (selectedPerusahaan) params.append('perusahaanId', selectedPerusahaan);
        if (selectedStatusPembayaran) params.append('statusPembayaran', selectedStatusPembayaran);
        if (searchQuery) params.append('search', searchQuery);

        const res = await fetch(`/api/laporan-nota-sawit/statistik?${params.toString()}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('Gagal mengambil data produksi kebun tahunan');
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setYearlyKebunMonthly(data.monthlyDataPerGroup || []);
      } catch (e: any) {
        console.error('Error fetching yearly kebun stats:', e);
        setYearlyKebunMonthly([]);
      } finally {
        setIsYearlyKebunLoading(false);
      }
    }
    fetchYearlyKebun();
  }, [startDate, selectedKebun, selectedSupir, selectedPabrik, selectedKendaraan, selectedPerusahaan, selectedStatusPembayaran, searchQuery, toYmd]);

  const growthKebunOptions = useMemo(() => {
    const safeList = monthlyDataPerGroup || []
    return Array.from(new Set(safeList.map((k) => k.groupName).filter(Boolean))).sort((a, b) => a.localeCompare(b))
  }, [monthlyDataPerGroup])

  const kebunProduksiTahunan = useMemo(() => {
    const refDate = startDate || new Date();
    const year = refDate.getFullYear();
    const monthKeys = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
    const now = new Date()
    const nowYear = now.getFullYear()
    const nowMonthIdx = now.getMonth()

    const rows: KebunProduksiTahunanRow[] = (yearlyKebunMonthly || []).map((g) => {
      const map = new Map<string, number>();
      for (const d of g.data || []) {
        map.set(String(d.month), Number(d.totalBerat || 0) || 0);
      }

      const months = monthKeys.map((k, idx) => {
        const kg = map.get(k) || 0;
        const prevKg = idx > 0 ? (map.get(monthKeys[idx - 1]) || 0) : 0;
        const isFutureMonth = year > nowYear || (year === nowYear && idx > nowMonthIdx)
        const pct =
          idx === 0
            ? null
            : isFutureMonth && kg <= 0
              ? 0
              : prevKg <= 0
                ? null
                : ((kg - prevKg) / prevKg) * 100;
        return { kg, pct };
      });

      const totalKg = months.reduce((acc, m) => acc + (Number(m.kg) || 0), 0);
      return { kebunName: g.groupName, months, totalKg };
    });

    return rows
      .filter((r) => r.kebunName && r.kebunName !== 'Tidak diketahui')
      .sort((a, b) => (b.totalKg || 0) - (a.totalKg || 0));
  }, [startDate, yearlyKebunMonthly]);

  useEffect(() => {
    if (selectedGrowthGroup !== 'total' && !growthKebunOptions.includes(selectedGrowthGroup)) {
      setSelectedGrowthGroup('total')
    }
  }, [growthKebunOptions, selectedGrowthGroup])

  useEffect(() => {
    setSelectedGrowthGroup('total')
  }, [groupBy])

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
      if (selectedPerusahaan) params.append('perusahaanId', selectedPerusahaan);
      if (selectedStatusPembayaran) params.append('statusPembayaran', selectedStatusPembayaran);
      if (searchQuery) params.append('search', searchQuery);
      if (searchQuery) params.append('search', searchQuery);

      const res = await fetch(`/api/nota-sawit?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Gagal mengambil data untuk ekspor');
      const exportData = await res.json();
      if (exportData.error) throw new Error(exportData.error);
      const dataToExport = Array.isArray(exportData) ? exportData : exportData.data;

      if (!Array.isArray(dataToExport)) {
        throw new Error('Format data ekspor tidak valid');
      }

      const resolveNetto = (item: any) => {
        const netTimb = Number(item?.timbangan?.netKg ?? 0) || 0
        const netNota = Number(item?.netto ?? 0) || 0
        return netTimb > 0 ? netTimb : netNota > 0 ? netNota : (netTimb || netNota || 0)
      }

      const resolveTanggalDibayar = (item: any) => {
        const dt = item?.pembayaranBatchItems?.[0]?.batch?.tanggal || item?.kasTransaksi?.[0]?.date || null
        return dt ? new Date(dt).toLocaleDateString('id-ID') : ''
      }

      const totals = dataToExport.reduce((acc, item) => {
        acc.grossKg += Number(item.timbangan?.grossKg ?? item.bruto ?? 0) || 0;
        acc.tareKg += Number(item.timbangan?.tareKg ?? item.tara ?? 0) || 0;
        acc.netKg += resolveNetto(item);
        acc.potongan += Number(item.potongan ?? 0) || 0;
        acc.beratAkhir += Number(item.beratAkhir ?? 0) || 0;
        acc.hargaPerKg += Number(item.hargaPerKg ?? 0) || 0;
        acc.totalPembayaran += Number(item.totalPembayaran ?? 0) || 0;
        acc.pph += Number(item.pph ?? 0) || 0;
        acc.pembayaranSetelahPph += Number(item.pembayaranSetelahPph ?? 0) || 0;
        return acc;
      }, { grossKg: 0, tareKg: 0, netKg: 0, potongan: 0, beratAkhir: 0, hargaPerKg: 0, totalPembayaran: 0, pph: 0, pembayaranSetelahPph: 0 });

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
        'Tanggal Dibayar',
        'Status Pembayaran',
        'Perusahaan',
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
        escapeCsv(resolveNetto(item)),
        escapeCsv(Number(item.potongan ?? 0) || 0),
        escapeCsv(Number(item.beratAkhir ?? 0) || 0),
        escapeCsv(Number(item.hargaPerKg ?? 0) || 0),
        escapeCsv(Number(item.totalPembayaran ?? 0) || 0),
        escapeCsv(Number(item.pph ?? 0) || 0),
        escapeCsv(Number(item.pembayaranSetelahPph ?? 0) || 0),
        escapeCsv(resolveTanggalDibayar(item) || '-'),
        escapeCsv(item.statusPembayaran ?? ''),
        escapeCsv(item.perusahaan?.name ?? '-'),
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
        '',
        '',
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

  const applySearch = useCallback(() => {
    const trimmed = String(searchDraft || '').trim()
    if (trimmed && trimmed.length < 2) return
    setSearchQuery(trimmed)
    setPage(1)
  }, [searchDraft])

  const resetFilters = useCallback(() => {
    const today = new Date()
    const start = new Date(today.getFullYear(), 0, 1)
    const end = new Date(today)
    end.setHours(0, 0, 0, 0)
    setQuickRange('this_year')
    setStartDate(start)
    setEndDate(end)
    setSelectedKebun('')
    setSelectedPerusahaan('')
    setSelectedSupir('')
    setSelectedPabrik('')
    setSelectedKendaraan('')
    setSelectedStatusPembayaran('')
    setSearchQuery('')
    setSearchDraft('')
    setGroupBy('kebun')
    setSelectedGrowthGroup('total')
    setPage(1)
    setLimit(10)
  }, [])

  const urlInitRef = useRef(false)

  useEffect(() => {
    if (urlInitRef.current) return
    if (!startDate || !endDate) return
    const sp = searchParams
    const sStart = sp.get('startDate') || ''
    const sEnd = sp.get('endDate') || ''
    if (sStart && sEnd) {
      setStartDate(new Date(`${sStart}T00:00:00.000Z`))
      setEndDate(new Date(`${sEnd}T00:00:00.000Z`))
      setQuickRange(sp.get('quickRange') || 'custom')
    }
    setSelectedKebun(sp.get('kebunId') || '')
    setSelectedPerusahaan(sp.get('perusahaanId') || '')
    setSelectedSupir(sp.get('supirId') || '')
    setSelectedPabrik(sp.get('pabrikId') || '')
    setSelectedKendaraan(sp.get('kendaraanPlatNomor') || '')
    const st = (sp.get('statusPembayaran') || '').toUpperCase()
    setSelectedStatusPembayaran(st === 'LUNAS' || st === 'BELUM_LUNAS' ? st : '')
    const s = sp.get('search') || ''
    setSearchQuery(s)
    setSearchDraft(s)
    const gb = (sp.get('groupBy') || '').toLowerCase()
    setGroupBy((gb === 'kebun' || gb === 'perusahaan' || gb === 'pabrik') ? (gb as any) : 'kebun')
    const p = Number(sp.get('page') || '1')
    const l = Number(sp.get('limit') || '10')
    if (Number.isFinite(p) && p > 0) setPage(p)
    if (Number.isFinite(l) && l > 0) setLimit(l)
    urlInitRef.current = true
  }, [searchParams, startDate, endDate])

  useEffect(() => {
    if (!urlInitRef.current) return
    const params = new URLSearchParams()
    const sStart = toYmd(startDate)
    const sEnd = toYmd(endDate)
    if (sStart) params.set('startDate', sStart)
    if (sEnd) params.set('endDate', sEnd)
    if (quickRange) params.set('quickRange', quickRange)
    if (selectedKebun) params.set('kebunId', selectedKebun)
    if (selectedPerusahaan) params.set('perusahaanId', selectedPerusahaan)
    if (selectedSupir) params.set('supirId', selectedSupir)
    if (selectedPabrik) params.set('pabrikId', selectedPabrik)
    if (selectedKendaraan) params.set('kendaraanPlatNomor', selectedKendaraan)
    if (selectedStatusPembayaran) params.set('statusPembayaran', selectedStatusPembayaran)
    if (searchQuery) params.set('search', searchQuery)
    if (groupBy) params.set('groupBy', groupBy)
    params.set('page', String(page))
    params.set('limit', String(limit))
    router.replace(`${pathname}?${params.toString()}`)
  }, [
    router,
    pathname,
    toYmd,
    startDate,
    endDate,
    quickRange,
    selectedKebun,
    selectedPerusahaan,
    selectedSupir,
    selectedPabrik,
    selectedKendaraan,
    selectedStatusPembayaran,
    searchQuery,
    groupBy,
    page,
    limit,
  ])

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
      if (selectedKendaraan) params.append('kendaraanPlatNomor', selectedKendaraan);
      if (selectedPerusahaan) params.append('perusahaanId', selectedPerusahaan);
      if (selectedStatusPembayaran) params.append('statusPembayaran', selectedStatusPembayaran);

      const res = await fetch(`/api/nota-sawit?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Gagal mengambil data untuk ekspor');
      const exportData = await res.json();
      if (exportData.error) throw new Error(exportData.error);
      const dataToExport = Array.isArray(exportData) ? exportData : exportData.data;

      if (!Array.isArray(dataToExport)) {
        throw new Error('Format data ekspor tidak valid');
      }

      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      // Add title and date range
      doc.setFontSize(16);
      doc.setTextColor(5, 150, 105);
      doc.text('Laporan Kebun', 14, 15);
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text(`Periode: ${startDate ? format(startDate, 'dd MMM yyyy', { locale: idLocale }) : ''} - ${endDate ? format(endDate, 'dd MMM yyyy', { locale: idLocale }) : ''}`, 14, 22);
      const resolveNetto = (item: any) => {
        const netTimb = Number(item?.timbangan?.netKg ?? 0) || 0
        const netNota = Number(item?.netto ?? 0) || 0
        return netTimb > 0 ? netTimb : netNota > 0 ? netNota : (netTimb || netNota || 0)
      }

      const resolveTanggalDibayar = (item: any) => {
        const dt = item?.pembayaranBatchItems?.[0]?.batch?.tanggal || item?.kasTransaksi?.[0]?.date || null
        return dt ? new Date(dt).toLocaleDateString('id-ID') : '-'
      }


      const totals = dataToExport.reduce((acc, item) => {
        acc.grossKg += Number(item.timbangan?.grossKg ?? item.bruto ?? 0) || 0;
        acc.tareKg += Number(item.timbangan?.tareKg ?? item.tara ?? 0) || 0;
        acc.netKg += resolveNetto(item);
        acc.potongan += Number(item.potongan ?? 0) || 0;
        acc.beratAkhir += Number(item.beratAkhir ?? 0) || 0;
        acc.hargaPerKg += Number(item.hargaPerKg ?? 0) || 0;
        acc.totalPembayaran += Number(item.totalPembayaran ?? 0) || 0;
        acc.pph += Number(item.pph ?? 0) || 0;
        acc.pembayaranAktual += Number(item.pembayaranAktual ?? 0) || 0;
        return acc;
      }, { grossKg: 0, tareKg: 0, netKg: 0, potongan: 0, beratAkhir: 0, hargaPerKg: 0, totalPembayaran: 0, pph: 0, pembayaranSetelahPph: 0 });

      const avgHargaPerKg = dataToExport.length > 0 ? totals.hargaPerKg / dataToExport.length : 0;
      const jumlahNota = dataToExport.length;
      const totalLunas = dataToExport.filter(item => (item.statusPembayaran || '').trim().toUpperCase() === 'LUNAS').reduce((acc, item) => acc + Number(item.totalPembayaran), 0);
      const totalBelumLunas = dataToExport.filter(item => (item.statusPembayaran || '').trim().toUpperCase() === 'BELUM_LUNAS').reduce((acc, item) => acc + Number(item.totalPembayaran), 0);

      const tableColumn = [
        'No', 'Tgl Bongkar', 'Pabrik', 'Supir', 'Plat No', 'Kebun', 
        'Bruto', 'Tara', 'Netto', 'Potongan', 'Berat Akhir', 'Harga/kg', 'Total', 'PPh 25', 'Net', 'Tgl Dibayar', 'Status', 'Perusahaan'
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
        resolveNetto(item).toLocaleString('id-ID'),
        (Number(item.potongan ?? 0) || 0).toLocaleString('id-ID'),
        (Number(item.beratAkhir ?? 0) || 0).toLocaleString('id-ID'),
        new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(Number(item.hargaPerKg ?? 0) || 0),
        new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(Number(item.totalPembayaran ?? 0) || 0),
        new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(Number(item.pph ?? 0) || 0),
        new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(Number(item.pembayaranSetelahPph ?? 0) || 0),
        resolveTanggalDibayar(item),
        (item.statusPembayaran || '').replace('BELUM_LUNAS', 'B.LUNAS'),
        item.perusahaan?.name ?? '-',
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
        { content: '', styles: { fontStyle: 'bold' as 'bold' } },
        { content: '', styles: { fontStyle: 'bold' as 'bold' } },
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
      const fileName = `laporan-nota-sawit-${startKey}-sampai-${endKey}.pdf`
      const pdfBlob = doc.output('blob')
      const url = URL.createObjectURL(pdfBlob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', fileName)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast.success('PDF berhasil diunduh', { id: 'export-nota-sawit' })

    } catch (e: any) {
      console.error('Error exporting PDF:', e);
      toast.error(e?.message || 'Gagal mengekspor PDF', { id: 'export-nota-sawit' })
    }
  };

  const handleExportProduksiPdf = async () => {
    const year = startDate ? startDate.getFullYear() : new Date().getFullYear()
    try {
      if (!kebunProduksiTahunan || kebunProduksiTahunan.length === 0) {
        toast.error('Tidak ada data produksi kebun')
        return
      }
      setIsProduksiExporting(true)
      toast.loading('Mempersiapkan PDF...', { id: 'export-produksi-kebun' })

      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      })
      const tableMargin = { left: 10, right: 10 }

      doc.setFontSize(14)
      doc.setTextColor(5, 150, 105)
      doc.text(`Produksi Kebun per Bulan (Jan–Des) - ${year}`, tableMargin.left, 15)
      doc.setTextColor(0, 0, 0)

      const head = [['Bulan', ...kebunNames, 'Total']]

      const produksiBody = transposedKebunProduksi.map((row) => {
        const kebunCells = row.kebuns.map((k) => Math.round(Number(k.kg) || 0).toLocaleString('id-ID'))
        return [row.month, ...kebunCells, Math.round(Number(row.totalKg) || 0).toLocaleString('id-ID')]
      })

      const produksiFoot = [
        [
          { content: 'Jumlah', styles: { fontStyle: 'bold', halign: 'left' } },
          ...transposedFooter.kebunTotals.map((kt) => ({ content: Math.round(Number(kt.total) || 0).toLocaleString('id-ID'), styles: { fontStyle: 'bold' } })),
          { content: Math.round(Number(transposedFooter.grandTotal) || 0).toLocaleString('id-ID'), styles: { fontStyle: 'bold' } },
        ],
      ]

      const pertumbuhanBody = transposedKebunProduksi.map((row) => {
        const pctCells = row.kebuns.map((k, idx) => {
          const kebunIdx = kebunNames.indexOf(k.name)
          const rowKebun = kebunProduksiTahunan.find(r => r.kebunName === k.name)!
          const monthIdx = monthLabels.indexOf(row.month)
          const pct = rowKebun.months[monthIdx].pct
          if (monthIdx === 0 || pct == null) return '-'
          const pctVal = Number(pct) || 0
          return `${pctVal >= 0 ? '+' : ''}${pctVal.toFixed(2)}%`
        })
        return [row.month, ...pctCells, '-']
      })

      const columnStyles: Record<number, any> = {
        0: { cellWidth: 18, halign: 'left' },
      }
      for (let i = 1; i <= kebunNames.length; i += 1) {
        columnStyles[i] = { cellWidth: Math.max(18, 100 / (kebunNames.length + 2)), halign: 'right' }
      }
      columnStyles[kebunNames.length + 1] = { cellWidth: 22, halign: 'right' }

      doc.setFontSize(10)
      doc.setTextColor(0, 0, 0)
      doc.text('Produksi (kg)', tableMargin.left, 20)

      autoTable(doc, {
        head,
        body: produksiBody,
        foot: produksiFoot as any,
        startY: 22,
        styles: { fontSize: 7, cellPadding: 1.2, overflow: 'hidden', halign: 'right', valign: 'middle' },
        headStyles: { fillColor: [5, 150, 105], textColor: 255, fontStyle: 'bold', halign: 'center' },
        footStyles: { fillColor: [209, 250, 229], textColor: 0, fontStyle: 'bold' },
        columnStyles,
        margin: tableMargin,
      })

      const afterProduksiY = (doc as any).lastAutoTable?.finalY ? Number((doc as any).lastAutoTable.finalY) : 22
      const nextY = Math.min(190, afterProduksiY + 10)
      doc.setFontSize(10)
      doc.setTextColor(0, 0, 0)
      doc.text('Kenaikan / Penurunan (%)', tableMargin.left, nextY)

      autoTable(doc, {
        head,
        body: pertumbuhanBody,
        startY: nextY + 2,
        styles: { fontSize: 7, cellPadding: 1.2, overflow: 'hidden', halign: 'right', valign: 'middle' },
        headStyles: { fillColor: [5, 150, 105], textColor: 255, fontStyle: 'bold', halign: 'center' },
        columnStyles,
        margin: tableMargin,
      })

      const fileName = `produksi-kebun-per-bulan-${year}.pdf`
      const pdfBlob = doc.output('blob')
      const url = URL.createObjectURL(pdfBlob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', fileName)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast.success('PDF berhasil diunduh', { id: 'export-produksi-kebun' })
    } catch (e: any) {
      console.error('Error exporting produksi PDF:', e)
      toast.error(e?.message || 'Gagal mengekspor PDF', { id: 'export-produksi-kebun' })
    } finally {
      setIsProduksiExporting(false)
    }
  }

  const handleExportProduksiCsv = async () => {
    const year = startDate ? startDate.getFullYear() : new Date().getFullYear()
    try {
      if (!kebunProduksiTahunan || kebunProduksiTahunan.length === 0) {
        toast.error('Tidak ada data produksi kebun')
        return
      }
      setIsProduksiExporting(true)
      toast.loading('Mempersiapkan CSV...', { id: 'export-produksi-kebun-csv' })

      const escapeCsv = (str: any) => {
        const string = String(str ?? '')
        if (string.includes(',') || string.includes('\n') || string.includes('"')) {
          return `"${string.replace(/"/g, '""')}"`
        }
        return string
      }

      const header = ['Bulan', ...kebunNames, 'Total']

      const produksiRows = transposedKebunProduksi.map((row) => {
        const cells = row.kebuns.map((k) => Math.round(Number(k.kg) || 0))
        return [row.month, ...cells, Math.round(Number(row.totalKg) || 0)].map(escapeCsv).join(',')
      })

      const produksiFooterRow = ['Jumlah', ...transposedFooter.kebunTotals.map((kt) => Math.round(Number(kt.total) || 0)), Math.round(Number(transposedFooter.grandTotal) || 0)]
        .map(escapeCsv)
        .join(',')

      const pertumbuhanRows = transposedKebunProduksi.map((row) => {
        const pctCells = row.kebuns.map((k, idx) => {
          const rowKebun = kebunProduksiTahunan.find(r => r.kebunName === k.name)!
          const monthIdx = monthLabels.indexOf(row.month)
          const pct = rowKebun.months[monthIdx].pct
          if (monthIdx === 0 || pct == null) return ''
          const pctVal = Number(pct) || 0
          return `${pctVal >= 0 ? '+' : ''}${pctVal.toFixed(2)}%`
        })
        return [row.month, ...pctCells, ''].map(escapeCsv).join(',')
      })

      const csv = [
        `Produksi Kebun per Bulan (Jan–Des) - Tahun ${year}`,
        'Produksi (kg)',
        header.map(escapeCsv).join(','),
        ...produksiRows,
        produksiFooterRow,
        '',
        'Kenaikan / Penurunan (%)',
        header.map(escapeCsv).join(','),
        ...pertumbuhanRows,
      ].join('\n')

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `produksi-kebun-per-bulan-${year}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast.success('CSV berhasil diunduh', { id: 'export-produksi-kebun-csv' })
    } catch (e: any) {
      console.error('Error exporting produksi CSV:', e)
      toast.error(e?.message || 'Gagal mengekspor CSV', { id: 'export-produksi-kebun-csv' })
    } finally {
      setIsProduksiExporting(false)
    }
  }

  const handleExportProduksiExcel = async () => {
    const year = startDate ? startDate.getFullYear() : new Date().getFullYear()
    try {
      if (!kebunProduksiTahunan || kebunProduksiTahunan.length === 0) {
        toast.error('Tidak ada data produksi kebun')
        return
      }
      setIsProduksiExporting(true)
      toast.loading('Mempersiapkan Excel...', { id: 'export-produksi-kebun-excel' })

      const escapeHtml = (v: any) =>
        String(v ?? '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;')

      const theadKg =
        '<thead><tr>' +
        '<th style="white-space:nowrap;background:#059669;color:#fff;">Bulan</th>' +
        kebunNames.map((name) => `<th style="white-space:nowrap;background:#059669;color:#fff;">${escapeHtml(name)}Kg</th>`).join('') +
        '<th style="white-space:nowrap;background:#059669;color:#fff;">TotalKg</th>' +
        '</tr></thead>'

      const theadPct =
        '<thead><tr>' +
        '<th style="white-space:nowrap;background:#059669;color:#fff;">Bulan</th>' +
        kebunNames.map((name) => `<th style="white-space:nowrap;background:#059669;color:#fff;">${escapeHtml(name)}%</th>`).join('') +
        '<th style="white-space:nowrap;background:#059669;color:#fff;">Total%</th>' +
        '</tr></thead>'

      const tbodyKg =
        '<tbody>' +
        transposedKebunProduksi
          .map((row) => {
            const kebunTds = row.kebuns.map((k) => `<td>${escapeHtml(Math.round(Number(k.kg) || 0))}</td>`).join('')
            return `<tr><td>${escapeHtml(row.month)}</td>${kebunTds}<td>${escapeHtml(Math.round(Number(row.totalKg) || 0))}</td></tr>`
          })
          .join('') +
        '</tbody>'

      const tfootKg =
        '<tfoot><tr>' +
        `<td style="font-weight:bold;background:#d1fae5;">${escapeHtml('Jumlah')}</td>` +
        transposedFooter.kebunTotals.map((kt) => `<td style="font-weight:bold;background:#d1fae5;">${escapeHtml(Math.round(Number(kt.total) || 0))}</td>`).join('') +
        `<td style="font-weight:bold;background:#d1fae5;">${escapeHtml(Math.round(Number(transposedFooter.grandTotal) || 0))}</td>` +
        '</tr></tfoot>'

      const tbodyPct =
        '<tbody>' +
        transposedKebunProduksi
          .map((row) => {
            const kebunTds = row.kebuns
              .map((k) => {
                const rowKebun = kebunProduksiTahunan.find(r => r.kebunName === k.name)!
                const monthIdx = monthLabels.indexOf(row.month)
                const pct = rowKebun.months[monthIdx].pct
                if (monthIdx === 0 || pct == null) return `<td></td>`
                const pctVal = Number(pct) || 0
                const pctText = `${pctVal >= 0 ? '+' : ''}${pctVal.toFixed(2)}%`
                return `<td>${escapeHtml(pctText)}</td>`
              })
              .join('')
            return `<tr><td>${escapeHtml(row.month)}</td>${kebunTds}<td></td></tr>`
          })
          .join('') +
        '</tbody>'

      const html =
        '\ufeff' +
        `<html><head><meta charset="utf-8" /><style>th,td{white-space:nowrap;}</style></head><body>` +
        `<div style="font-weight:bold;white-space:nowrap;margin-bottom:6px;">Produksi Kebun per Bulan (Jan–Des) - Tahun ${escapeHtml(year)}</div>` +
        `<div style="font-weight:bold;white-space:nowrap;margin:6px 0;">Produksi (kg)</div>` +
        `<table border="1">` +
        theadKg +
        tbodyKg +
        tfootKg +
        `</table>` +
        `<div style="font-weight:bold;white-space:nowrap;margin:10px 0 6px;">Kenaikan / Penurunan (%)</div>` +
        `<table border="1">` +
        theadPct +
        tbodyPct +
        `</table>` +
        `</body></html>`

      const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `produksi-kebun-per-bulan-${year}.xls`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast.success('Excel berhasil diunduh', { id: 'export-produksi-kebun-excel' })
    } catch (e: any) {
      console.error('Error exporting produksi Excel:', e)
      toast.error(e?.message || 'Gagal mengekspor Excel', { id: 'export-produksi-kebun-excel' })
    } finally {
      setIsProduksiExporting(false)
    }
  }

  const produksiKebunFooter = useMemo(() => {
    const monthTotals = Array.from({ length: 12 }, () => 0)
    let grandTotal = 0
    for (const row of kebunProduksiTahunan || []) {
      grandTotal += Number(row.totalKg) || 0
      for (let i = 0; i < 12; i += 1) {
        monthTotals[i] += Number(row.months?.[i]?.kg) || 0
      }
    }
    return { monthTotals, grandTotal }
  }, [kebunProduksiTahunan])

  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
  const kebunNames = useMemo(() => {
    return (kebunProduksiTahunan || []).map((r) => r.kebunName)
  }, [kebunProduksiTahunan])

  const transposedKebunProduksi = useMemo((): TransposedKebunProduksiRow[] => {
    const safeKebunList = (kebunProduksiTahunan || [])
    return monthLabels.map((month, monthIdx) => {
      let totalKg = 0
      const kebuns = (kebunNames || []).map((kebunName) => {
        const row = safeKebunList.find(r => r.kebunName === kebunName)
        const kg = row?.months?.[monthIdx]?.kg || 0
        const pct = row?.months?.[monthIdx]?.pct ?? null
        totalKg += kg
        return { name: kebunName, kg, pct }
      })
      return { month, kebuns, totalKg }
    })
  }, [kebunProduksiTahunan, kebunNames])

  const transposedFooter = useMemo(() => {
    const safeKebunList = (kebunProduksiTahunan || [])
    const kebunTotals = (kebunNames || []).map((name) => {
      const row = safeKebunList.find(r => r.kebunName === name)
      return { name, total: row?.totalKg || 0 }
    })
    const grandTotal = kebunTotals.reduce((acc, kt) => acc + kt.total, 0)
    return { kebunTotals, grandTotal }
  }, [kebunProduksiTahunan, kebunNames])

  return (
    <main className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Laporan Kebun</h1>

        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-xl font-semibold">Filter Laporan</h2>
            <Button variant="outline" className="rounded-xl" onClick={resetFilters}>
              Reset Filter
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
             <div className="flex flex-col space-y-2">
                <Label className="text-sm font-medium text-gray-700">Rentang Waktu</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="date"
                      type="button"
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
                  <PopoverContent className="w-auto p-4 bg-white z-50" align="start">
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
              <Label className="text-sm font-medium text-gray-700">Cari</Label>
              <div className="relative">
                <Input
                  placeholder="Cari nota/supir/plat..."
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
                  className="w-full bg-white border-gray-300 rounded-xl pr-10"
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
            </div>

            <div className="flex flex-col space-y-2">
              <Label className="text-sm font-medium text-gray-700">Filter per Kebun</Label>
              <Select
                value={selectedKebun || 'all'}
                onValueChange={(v) => {
                  setSelectedKebun(v === 'all' ? '' : v)
                  setPage(1)
                }}
              >
                <SelectTrigger className="w-full bg-white border-gray-300 rounded-xl">
                  <SelectValue placeholder="Semua Kebun" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Kebun</SelectItem>
                  {kebunList.map((k) => (
                    <SelectItem key={k.id} value={String(k.id)}>{k.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col space-y-2">
              <Label className="text-sm font-medium text-gray-700">Status Pembayaran</Label>
              <Select
                value={selectedStatusPembayaran || 'all'}
                onValueChange={(v) => {
                  setSelectedStatusPembayaran(v === 'all' ? '' : v)
                  setPage(1)
                }}
              >
                <SelectTrigger className="w-full bg-white border-gray-300 rounded-xl">
                  <SelectValue placeholder="Semua Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua</SelectItem>
                  <SelectItem value="LUNAS">Lunas</SelectItem>
                  <SelectItem value="BELUM_LUNAS">Belum Lunas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col space-y-2">
              <Label className="text-sm font-medium text-gray-700">Filter per Perusahaan</Label>
              <Select
                value={selectedPerusahaan || 'all'}
                onValueChange={(v) => {
                  setSelectedPerusahaan(v === 'all' ? '' : v)
                  setPage(1)
                }}
              >
                <SelectTrigger className="w-full bg-white border-gray-300 rounded-xl">
                  <SelectValue placeholder="Semua Perusahaan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Perusahaan</SelectItem>
                  {perusahaanList.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col space-y-2">
              <Label className="text-sm font-medium text-gray-700">Filter per Supir</Label>
              <Select
                value={selectedSupir || 'all'}
                onValueChange={(v) => {
                  setSelectedSupir(v === 'all' ? '' : v)
                  setPage(1)
                }}
              >
                <SelectTrigger className="w-full bg-white border-gray-300 rounded-xl">
                  <SelectValue placeholder="Semua Supir" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Supir</SelectItem>
                  {supirList.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col space-y-2">
              <Label className="text-sm font-medium text-gray-700">Filter per Pabrik</Label>
              <Select
                value={selectedPabrik || 'all'}
                onValueChange={(v) => {
                  setSelectedPabrik(v === 'all' ? '' : v)
                  setPage(1)
                }}
              >
                <SelectTrigger className="w-full bg-white border-gray-300 rounded-xl">
                  <SelectValue placeholder="Semua Pabrik" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Pabrik</SelectItem>
                  {pabrikList.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
                <div className="flex flex-col space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Filter per Kendaraan</Label>
                  <Select
                    value={selectedKendaraan || 'all'}
                    onValueChange={(v) => {
                      setSelectedKendaraan(v === 'all' ? '' : v)
                      setPage(1)
                    }}
                  >
                    <SelectTrigger className="w-full bg-white border-gray-300 rounded-xl">
                      <SelectValue placeholder="Semua Kendaraan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Kendaraan</SelectItem>
                      {kendaraanList
                        .filter((k) => String((k as any)?.jenis || '').toLowerCase().includes('truk') || String((k as any)?.jenis || '').toLowerCase().includes('truck'))
                        .map((k) => (
                          <SelectItem key={k.platNomor} value={k.platNomor}>
                            {k.platNomor}{k.merk ? ` • ${k.merk}` : ''}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
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
                    <p className="text-sm font-semibold text-gray-900">Ringkasan Laporan Kebun</p>
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
                <div className="rounded-xl bg-emerald-50/60 px-3 py-2">
                  <p className="text-xs text-emerald-700">Pembayaran Lunas</p>
                  {isStatsLoading ? <Skeleton className="h-6 w-28 mt-1" /> : (
                    <>
                      <p className="text-lg font-semibold text-gray-900">
                        {kpi?.totalPembayaranLunas ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(kpi.totalPembayaranLunas)) : 'Rp 0'}
                      </p>
                      <p className="text-xs text-gray-500">{kpi?.lunasCount || 0} Nota</p>
                    </>
                  )}
                </div>
                <div className="rounded-xl bg-red-50/60 px-3 py-2">
                  <p className="text-xs text-red-700">Pembayaran Belum Lunas</p>
                  {isStatsLoading ? <Skeleton className="h-6 w-28 mt-1" /> : (
                    <>
                      <p className="text-lg font-semibold text-gray-900">
                        {kpi?.totalPembayaranBelumLunas ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(kpi.totalPembayaranBelumLunas)) : 'Rp 0'}
                      </p>
                      <p className="text-xs text-gray-500">{kpi?.belumLunasCount || 0} Nota</p>
                    </>
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
              </div>

              <div className="mt-4 rounded-2xl border border-gray-100 bg-white p-4">
                <div className="text-sm font-semibold text-gray-900">Statistik Pembayaran</div>
                <div className="text-xs text-gray-500">Total tagihan nota sawit, jumlah ditransfer, dan selisih pembayaran.</div>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-xl bg-sky-50/70 px-3 py-2">
                    <p className="text-xs text-sky-700">Total Tagihan Nota Sawit</p>
                    {isStatsLoading ? (
                      <Skeleton className="h-6 w-28 mt-1" />
                    ) : (
                      <p className="text-lg font-semibold text-gray-900">
                        {kpi?.totalNet
                          ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(kpi.totalNet))
                          : 'Rp 0'}
                      </p>
                    )}
                  </div>
                  <div className="rounded-xl bg-emerald-50/60 px-3 py-2">
                    <p className="text-xs text-emerald-700">Jumlah Ditransfer</p>
                    {isStatsLoading ? (
                      <Skeleton className="h-6 w-28 mt-1" />
                    ) : (
                      <p className="text-lg font-semibold text-gray-900">
                        {kpi?.totalPembayaranNotaSawit
                          ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(kpi.totalPembayaranNotaSawit))
                          : 'Rp 0'}
                      </p>
                    )}
                  </div>
                  <div className="rounded-xl bg-gray-50 px-3 py-2">
                    <p className="text-xs text-gray-600">Selisih Pembayaran</p>
                    {isStatsLoading ? (
                      <Skeleton className="h-6 w-28 mt-1" />
                    ) : (
                      <p className={cn('text-lg font-semibold', Number(kpi?.selisih || 0) >= 0 ? 'text-emerald-700' : 'text-red-600')}>
                        {kpi?.selisih
                          ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(kpi.selisih))
                          : 'Rp 0'}
                      </p>
                    )}
                  </div>
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
              <div style={{ width: '100%', height: 300, minWidth: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData || []}>
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
              </div>
            )}

            {!isStatsLoading && monthlyData.length > 0 && (
              <div className="mt-6">
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-gray-600 whitespace-nowrap">Analisa Pertumbuhan Produksi</h3>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Select value={groupBy} onValueChange={(v) => setGroupBy(v as any)}>
                      <SelectTrigger className="w-[190px] h-8 text-sm rounded-full">
                        <SelectValue placeholder="Group By" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kebun">Per Kebun</SelectItem>
                        <SelectItem value="perusahaan">Per Perusahaan</SelectItem>
                        <SelectItem value="pabrik">Per Pabrik</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={selectedGrowthGroup} onValueChange={setSelectedGrowthGroup}>
                      <SelectTrigger className="w-[220px] h-8 text-sm rounded-full">
                        <SelectValue placeholder="Pilih" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="total">Total</SelectItem>
                        {growthKebunOptions.map((name) => (
                          <SelectItem key={name} value={name}>{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="overflow-x-auto">
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
                       if (selectedGrowthGroup !== 'total') {
                         data = monthlyDataPerGroup.find(k => k.groupName === selectedGrowthGroup)?.data.find(d => d.month === totalItem.month) || {
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
              </div>
            )}
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">
              {groupBy === 'kebun' ? 'Kebun Paling Produktif' : groupBy === 'perusahaan' ? 'Perusahaan Paling Produktif' : 'Pabrik Paling Produktif'}
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white">
                <thead>
                  <tr>
                    <th className="py-2 px-4 border-b">Peringkat</th>
                    <th className="py-2 px-4 border-b">Nama</th>
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
                  ) : topGroups.map((kebun, index) => (
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

        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
          <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-xl font-semibold whitespace-nowrap overflow-hidden text-ellipsis">Produksi Kebun per Bulan (Jan–Des)</h2>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <div className="text-xs text-gray-500 whitespace-nowrap shrink-0">Tahun {startDate ? startDate.getFullYear() : new Date().getFullYear()}</div>
              <button
                onClick={handleExportProduksiCsv}
                disabled={isYearlyKebunLoading || isProduksiExporting || kebunProduksiTahunan.length === 0}
                className="px-3 py-2 text-xs font-medium text-white bg-emerald-600 border border-transparent rounded-xl hover:bg-emerald-700 disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                Ekspor CSV
              </button>
              <button
                onClick={handleExportProduksiExcel}
                disabled={isYearlyKebunLoading || isProduksiExporting || kebunProduksiTahunan.length === 0}
                className="px-3 py-2 text-xs font-medium text-white bg-green-600 border border-transparent rounded-xl hover:bg-green-700 disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                Ekspor Excel
              </button>
              <button
                onClick={handleExportProduksiPdf}
                disabled={isYearlyKebunLoading || isProduksiExporting || kebunProduksiTahunan.length === 0}
                className="px-3 py-2 text-xs font-medium text-white bg-red-600 border border-transparent rounded-xl hover:bg-red-700 disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                Ekspor PDF
              </button>
            </div>
          </div>

          {isYearlyKebunLoading ? (
            <Skeleton className="h-[260px] w-full" />
          ) : kebunProduksiTahunan.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center text-sm text-gray-500">
              Tidak ada data produksi kebun
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[1100px] w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="py-2 px-3 text-left sticky left-0 bg-gray-50">Bulan</th>
                    {kebunNames.map((name) => (
                      <th key={name} className="py-2 px-3 text-right">{name}</th>
                    ))}
                    <th className="py-2 px-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {transposedKebunProduksi.map((row) => (
                    <tr key={row.month} className="border-t">
                      <td className="py-2 px-3 font-medium text-gray-900 sticky left-0 bg-white">{row.month}</td>
                      {row.kebuns.map((k, idx) => (
                        <td key={idx} className="py-2 px-3 text-right">
                          <div className="text-gray-900">{(Number(k.kg) || 0).toLocaleString('id-ID')} kg</div>
                          <div className={cn('text-[11px]', k.pct == null ? 'text-gray-400' : k.pct >= 0 ? 'text-emerald-700' : 'text-red-600')}>
                            {k.pct == null ? '-' : `${k.pct >= 0 ? '+' : ''}${k.pct.toFixed(2)}%`}
                          </div>
                        </td>
                      ))}
                      <td className="py-2 px-3 text-right font-semibold text-gray-900">{(Number(row.totalKg) || 0).toLocaleString('id-ID')} kg</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-emerald-50/60">
                    <td className="py-2 px-3 font-semibold text-gray-900 sticky left-0 bg-emerald-50/60">Jumlah</td>
                    {transposedFooter.kebunTotals.map((kt, idx) => (
                      <td key={idx} className="py-2 px-3 text-right font-semibold text-gray-900">
                        {Math.round(Number(kt.total) || 0).toLocaleString('id-ID')} kg
                      </td>
                    ))}
                    <td className="py-2 px-3 text-right font-bold text-gray-900">
                      {Math.round(Number(transposedFooter.grandTotal) || 0).toLocaleString('id-ID')} kg
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
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
                  const netTimb = Number(item.timbangan?.netKg ?? 0) || 0
                  const netNota = Number((item as any)?.netto ?? 0) || 0
                  const netto = netTimb > 0 ? netTimb : netNota > 0 ? netNota : (netTimb || netNota || 0)
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
                meta={{ kpi, page, limit, onRowClick: handleOpenDetailNota, onOpenImage: handleOpenNotaImage }}
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
      <Dialog
        open={notaImageOpen}
        onOpenChange={(v) => {
          setNotaImageOpen(v)
          if (!v) {
            setNotaImageUrl(null)
          }
        }}
      >
        <DialogContent className="max-w-3xl p-0 overflow-hidden [&>button.absolute]:hidden max-h-[90vh] flex flex-col">
          <div className="w-full flex items-center justify-between gap-3 px-6 py-4 border-b bg-gradient-to-r from-emerald-600 to-emerald-500 text-white pr-16">
            <div className="min-w-0 flex items-center gap-2">
              <DocumentTextIcon className="h-5 w-5 text-white" />
              <div className="min-w-0">
                <div className="text-white text-base font-semibold">Gambar Nota Sawit</div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setNotaImageOpen(false)}
                className="h-10 w-10 rounded-full border border-white/30 text-white hover:bg-white/10 inline-flex items-center justify-center"
                aria-label="Tutup"
                title="Tutup"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar bg-black/5 p-4 flex items-center justify-center">
            {notaImageUrl ? (
              <img src={notaImageUrl} alt="Gambar Nota" className="w-auto max-w-full object-contain rounded-xl" />
            ) : null}
          </div>
          <div className="shrink-0 px-6 py-4 border-t bg-white flex items-center justify-end">
            <button
              type="button"
              onClick={handleDownloadNotaImage}
              disabled={!notaImageUrl || notaImageDownloading}
              className="h-10 w-10 rounded-full border border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 hover:border-emerald-700 disabled:opacity-50 inline-flex items-center justify-center"
              aria-label="Download"
              title={notaImageDownloading ? 'Downloading...' : 'Download'}
            >
              <ArrowDownTrayIcon className="h-5 w-5" />
            </button>
          </div>
        </DialogContent>
      </Dialog>
      <ModalDetailNota nota={detailNota} onClose={handleCloseDetailNota} readonly />
    </main>
  );
}
