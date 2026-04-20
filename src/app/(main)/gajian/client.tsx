'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { DataTable } from '@/components/data-table';
import { createColumns, createProcessingColumns, ProcessingNotaSawit } from './columns';
import { createDraftColumns } from './draft-columns'; // Import draft columns
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import toast from 'react-hot-toast';
import type { NotaSawit, Kebun, Kendaraan, Timbangan, User, Gajian } from '@prisma/client';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { AdjustmentsHorizontalIcon, BanknotesIcon, ClipboardDocumentListIcon, ClockIcon, EllipsisHorizontalIcon, PrinterIcon, TrashIcon, ArrowRightIcon, ArrowDownTrayIcon, UserIcon, StarIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ColumnDef } from '@tanstack/react-table';
import type { BiayaLainGajian, DetailGajian, PotonganGajian, DetailGajianKaryawan } from '@prisma/client';
import { createWIBDate, formatWIBDateForInput, getCurrentWIBDateParts, parseWIBDateFromInput } from '@/lib/wib-date';
import { useGajianModalsState } from './useGajianModalsState';
import GajianPageModals from './GajianPageModals';


interface GajianClientProps {
  kebunList: Kebun[];
  initialGajianHistory: {
    drafts: (Gajian & { kebun: Kebun })[];
    finalized: (Gajian & { kebun: Kebun })[];
  };
}

type NotaSawitWithRelations = NotaSawit & {
  supir: User;
  kendaraan: Kendaraan | null;
  timbangan?: (Timbangan & { kebun: Kebun }) | null;
  kebun?: Kebun | null;
};

type DetailGajianWithRelations = DetailGajian & {
  notaSawit: NotaSawitWithRelations;
};

type GajianWithDetails = Gajian & {
  kebun: Kebun;
  detailGajian: DetailGajianWithRelations[];
  biayaLain: BiayaLainGajian[];
  potongan: PotonganGajian[];
  detailKaryawan: (DetailGajianKaryawan & { user: User })[];
  hutangTambahan?: Array<{ userId: number; jumlah: number; date: string | null; deskripsi: string | null }>;
  pekerjaanKebun?: Array<any>;
  dibuatOlehName?: string | null;
  disetujuiOlehName?: string | null;
};

interface BiayaLain {
  id: string;
  deskripsi: string;
  jumlah: number;
  satuan: string;
  hargaSatuan: number;
  total?: number;
  keterangan?: string;
  isAutoKg?: boolean;
}

const formatNumber = (num: number, maxFractionDigits = 0) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: maxFractionDigits }).format(num);
const formatCurrency = (num: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
const formatDate = (date: Date) => new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(date);

const toYmdLocal = (d: Date) => formatWIBDateForInput(d)

const isAutoGajiHarianDesc = (value: any) => {
  const s = String(value || '').trim().toLowerCase()
  return s.startsWith('biaya gaji harian') || s.startsWith('total gaji karyawan')
}

const cleanBiayaKeterangan = (value: any) => {
  const s = String(value || '').trim()
  if (!s) return ''
  if (/^tanggal\s*:/i.test(s)) return ''
  return s
}

const buildGajiHarianDesc = (start?: Date, end?: Date) => {
  if (!start || !end) return 'Biaya Gaji Harian'
  const startDay = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric' }).format(start)
  const endDay = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric' }).format(end)
  const startMonthYear = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', month: 'long', year: 'numeric' }).format(start)
  const endMonthYear = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', month: 'long', year: 'numeric' }).format(end)
  if (startMonthYear === endMonthYear) {
    return `Biaya Gaji Harian (${startDay}-${endDay} ${endMonthYear})`
  }
  return `Biaya Gaji Harian (${formatDate(start)} - ${formatDate(end)})`
}

const createHistoryColumns = (
  onDelete: (id: number) => void,
  onDetail: (id: number) => void,
  totals: { totalNota: number; totalBerat: number; totalGaji: number; totalPotongan: number; totalJumlahGaji: number }
): ColumnDef<(Gajian & { kebun: Kebun })>[] => [
  {
    accessorKey: 'kebun.name',
    header: 'Kebun',
  },
  {
    accessorKey: 'tanggalMulai',
    header: 'Periode',
    cell: ({ row }) => {
      const { tanggalMulai, tanggalSelesai } = row.original;
      return <span>{`${formatDate(new Date(tanggalMulai))} - ${formatDate(new Date(tanggalSelesai))}`}</span>;
    },
    footer: () => <div className="text-right">JUMLAH</div>,
  },
  {
    accessorKey: 'totalNota',
    header: () => <div className="text-right">Total Nota</div>,
    cell: ({ row }) => {
        if (row.original.totalNota === 0 && row.original.totalBerat === 0) return <div className="text-right text-gray-400">-</div>;
        return <div className="text-right">{formatNumber(row.original.totalNota)}</div>;
    },
    footer: () => <div className="text-right">{formatNumber(totals.totalNota)}</div>,
  },
  {
    accessorKey: 'totalBerat',
    header: () => <div className="text-right">Total Berat (Kg)</div>,
    cell: ({ row }) => {
        if (row.original.totalNota === 0 && row.original.totalBerat === 0) return <div className="text-right text-gray-400">-</div>;
        return <div className="text-right">{formatNumber(row.original.totalBerat)}</div>;
    },
    footer: () => <div className="text-right">{formatNumber(totals.totalBerat)}</div>,
  },
  {
    accessorKey: 'totalBiayaLain',
    header: () => <div className="text-right">Total Gaji (Rp)</div>,
    cell: ({ row }) => <div className="text-right">{formatNumber(row.original.totalBiayaLain || 0)}</div>,
    footer: () => <div className="text-right">{formatNumber(totals.totalGaji)}</div>,
  },
  {
    accessorKey: 'totalPotongan',
    header: () => <div className="text-right">Potongan (Rp)</div>,
    cell: ({ row }) => <div className="text-right text-red-600">-{formatNumber(row.original.totalPotongan || 0)}</div>,
    footer: () => <div className="text-right text-red-600">-{formatNumber(totals.totalPotongan)}</div>,
  },
  {
    accessorKey: 'totalGaji',
    header: () => <div className="text-right">Jumlah Gaji (Rp)</div>,
    cell: ({ row }) => <div className="text-right">{formatNumber(row.original.totalGaji || 0)}</div>,
    footer: () => <div className="text-right">{formatNumber(totals.totalJumlahGaji)}</div>,
  },
  {
    accessorKey: 'createdAt',
    header: 'Tanggal Dibuat',
    cell: ({ row }) => formatDate(new Date(row.original.createdAt)),
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const gajian = row.original;
      return (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Buka menu</span>
                <EllipsisHorizontalIcon className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Aksi</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => onDetail(gajian.id)}>
                <PrinterIcon className="mr-2 h-4 w-4" />
                <span>Print / Detail</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-red-600"
                onClick={() => onDelete(gajian.id)}
              >
                <TrashIcon className="mr-2 h-4 w-4" />
                <span>Hapus</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
  },
];

interface Potongan {
  id: string;
  deskripsi: string;
  total: number;
  keterangan?: string;
}

export function GajianClient({ kebunList, initialGajianHistory }: GajianClientProps) {
  const draftKey = 'gajian:draft'
  // State for Gajian History
  const [gajianHistory, setGajianHistory] = useState(initialGajianHistory.finalized || []);
  const [draftsGajian, setDraftsGajian] = useState(initialGajianHistory.drafts || []);
  const {
    isConfirmOpen,
    setIsConfirmOpen,
    selectedGajianId,
    setSelectedGajianId,
    isDetailOpen,
    setIsDetailOpen,
    selectedGajian,
    setSelectedGajian,
    isDraftConfirmOpen,
    setIsDraftConfirmOpen,
    selectedDraftId,
    setSelectedDraftId,
    isResetConfirmOpen,
    setIsResetConfirmOpen,
    isPreviewOpen,
    setIsPreviewOpen,
    previewGajian,
    setPreviewGajian,
    openPotongHutangMassal,
    setOpenPotongHutangMassal,
    massPotongMax,
    setMassPotongMax,
    massPotongAmount,
    setMassPotongAmount,
    openTambahHutang,
    setOpenTambahHutang,
    tambahHutangKaryawanId,
    setTambahHutangKaryawanId,
    tambahHutangJumlah,
    setTambahHutangJumlah,
    tambahHutangTanggal,
    setTambahHutangTanggal,
    tambahHutangDeskripsi,
    setTambahHutangDeskripsi,
    tambahHutangSubmitting,
    setTambahHutangSubmitting,
  } = useGajianModalsState()
  const [editingGajianId, setEditingGajianId] = useState<number | null>(null);

  // State for Draft Deletion
 

  // State for Create New Gajian Form
  const [kebunId, setKebunId] = useState<string>('');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [historyKebunId, setHistoryKebunId] = useState<string>('');
  const [historyStartDate, setHistoryStartDate] = useState<Date | undefined>();
  const [historyEndDate, setHistoryEndDate] = useState<Date | undefined>();
  const [detailKaryawan, setDetailKaryawan] = useState<(DetailGajianKaryawan & { user: User })[]>([]);
  const [importPotonganLoading, setImportPotonganLoading] = useState(false)
  
  // Use separate state for Month and Year selection
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>(String(new Date().getFullYear()));

  // Update historyStartDate and historyEndDate whenever month/year changes
  useEffect(() => {
    const year = parseInt(selectedYear);
    
    if (selectedMonth === 'all') {
      if (!isNaN(year)) {
        const start = new Date(year, 0, 1); // Jan 1st
        const end = new Date(year, 11, 31); // Dec 31st
        setHistoryStartDate(start);
        setHistoryEndDate(end);
      }
    } else {
      const monthIndex = parseInt(selectedMonth);
      if (!isNaN(monthIndex) && !isNaN(year)) {
        const start = new Date(year, monthIndex, 1);
        const end = new Date(year, monthIndex + 1, 0); // Last day of month
        setHistoryStartDate(start);
        setHistoryEndDate(end);
      }
    }
  }, [selectedMonth, selectedYear]);

  const [notas, setNotas] = useState<NotaSawitWithRelations[]>([]);
  const [totalNotas, setTotalNotas] = useState(0);
  const notaFetchLimit = 5000
  const [rowSelection, setRowSelection] = useState({});
  const [notasToProcess, setNotasToProcess] = useState<ProcessingNotaSawit[]>([]);
  const [biayaLain, setBiayaLain] = useState<BiayaLain[]>([]);
  const [potongan, setPotongan] = useState<Potongan[]>([]);
  const [savedBiaya, setSavedBiaya] = useState<BiayaLain[]>([]);
  const [savedPotongan, setSavedPotongan] = useState<Potongan[]>([]);
  const [editingBiayaId, setEditingBiayaId] = useState<string | null>(null)
  const [editingPotonganId, setEditingPotonganId] = useState<string | null>(null)
  const [biayaFieldErrors, setBiayaFieldErrors] = useState<Record<string, { deskripsi?: boolean; jumlah?: boolean; hargaSatuan?: boolean }>>({})
  const [loading, setLoading] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  const getNotaNetto = useCallback((nota: any) => {
    const n = nota?.netto
    if (typeof n === 'number' && n > 0) return n
    const tNet = nota?.timbangan?.netKg
    if (typeof tNet === 'number' && tNet > 0) return tNet
    return null
  }, [])
  const [searchAttempted, setSearchAttempted] = useState(false);
  const [boronganPekerjaanIds, setBoronganPekerjaanIds] = useState<number[]>([])
  const [boronganLoading, setBoronganLoading] = useState(false)
  const [refreshingData, setRefreshingData] = useState(false)
  const [, setHutangRows] = useState<Array<{ name: string; tanggal: string; saldo: number; potong: number; sisa: number; keterangan?: string }>>([]);
  const [hutangSaldoMap, setHutangSaldoMap] = useState<Record<number, number>>({});
  const [hutangLoading, setHutangLoading] = useState(false);
  const [hutangSaldoKey, setHutangSaldoKey] = useState<string>('');
 
  const [hutangTambahanMap, setHutangTambahanMap] = useState<Record<number, { jumlah: number; date: string; deskripsi: string }>>({})
  const [kebunDefaultBiaya, setKebunDefaultBiaya] = useState<any[]>([])

  const isPotonganHutangDesc = (value: any) => /potongan\s*hutang/i.test(String(value || ''))
  const manualPotonganRows = useMemo(() => savedPotongan.filter((p) => !isPotonganHutangDesc(p?.deskripsi)), [savedPotongan])

  useEffect(() => {
    if (kebunId) {
      fetch(`/api/kebun/${kebunId}/default-biaya`)
        .then(res => res.json())
        .then(json => {
          setKebunDefaultBiaya(Array.isArray(json.data) ? json.data : [])
        })
        .catch(err => console.error('Failed to fetch default biaya:', err))
    } else {
      setKebunDefaultBiaya([])
    }
  }, [kebunId])

  const handleResetForm = () => {
    setEditingGajianId(null);
    // Reset to current month
    const { year, month } = getCurrentWIBDateParts()
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
    setStartDate(createWIBDate(year, month, 1))
    setEndDate(createWIBDate(year, month, lastDay, true))
    setNotas([]);
    setRowSelection({});
    setNotasToProcess([]);
    setDetailKaryawan([]);
    setBiayaLain([]);
    setSavedBiaya([]);
    setPotongan([]);
    setSavedPotongan([]);
    setEditingBiayaId(null)
    setEditingPotonganId(null)
    setBiayaFieldErrors({})
    setBoronganPekerjaanIds([])
    setBoronganLoading(false)
    setRefreshingData(false)
    setHutangRows([])
    setHutangSaldoMap({})
    setHutangSaldoKey('')
    setHutangLoading(false)
    setOpenPotongHutangMassal(false)
    setMassPotongMax(true)
    setMassPotongAmount('')
    setHutangTambahanMap({})
    setOpenTambahHutang(false)
    setTambahHutangKaryawanId('')
    setTambahHutangJumlah(0)
    setTambahHutangTanggal('')
    setTambahHutangDeskripsi('Hutang Karyawan')
    setIsPreviewOpen(false)
    setPreviewGajian(null)
    setSearchAttempted(false);
    try { localStorage.removeItem(draftKey) } catch {}
  };
  const handleConfirmReset = () => {
    handleResetForm();
    setKebunId('');
    setIsResetConfirmOpen(false);
  };

  useEffect(() => {
    const { year, month } = getCurrentWIBDateParts()
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
    setStartDate(createWIBDate(year, month, 1))
    setEndDate(createWIBDate(year, month, lastDay, true))
  }, []);
  const [keterangan, setKeterangan] = useState('');
 

  // Removed localStorage auto-restore and auto-save logic as per user request to clear form on reload

  // --- LOGIC FOR UNSAVED CHANGES WARNING --- //
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const hasUnsavedChanges =
        notasToProcess.length > 0 ||
        biayaLain.length > 0 ||
        savedBiaya.length > 0 ||
        savedPotongan.length > 0 ||
        detailKaryawan.length > 0 ||
        Object.keys(hutangTambahanMap).length > 0 ||
        keterangan.length > 0;
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = ''; // Chrome requires returnValue to be set
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [notasToProcess, biayaLain, savedBiaya, savedPotongan, detailKaryawan, hutangTambahanMap, keterangan]);

  // --- LOGIC FOR HISTORY --- //
  const fetchAllHistory = async (filters?: { kebunId?: string; startDate?: Date; endDate?: Date }) => {
    setIsHistoryLoading(true);
    const params = new URLSearchParams({ fetchHistory: 'true' });
    if (filters?.kebunId) {
      params.set('kebunId', filters.kebunId);
    }
    if (filters?.startDate && filters?.endDate) {
      params.set('startDate', filters.startDate.toISOString());
      params.set('endDate', filters.endDate.toISOString());
    }
    const url = `/api/gajian?${params.toString()}`;
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error('Gagal mengambil riwayat gajian');
      const data = await response.json();
      setGajianHistory(data.finalized || []);
      setDraftsGajian(data.drafts || []);
    } catch (error) {
      toast.error('Gagal memperbarui riwayat gajian.');
    } finally {
      setIsHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchAllHistory({
      kebunId: historyKebunId || undefined,
      startDate: historyStartDate,
      endDate: historyEndDate,
    });
  }, []);

  const handleApplyHistoryFilters = useCallback(() => {
    fetchAllHistory({
      kebunId: historyKebunId || undefined,
      startDate: historyStartDate,
      endDate: historyEndDate,
    });
  }, [historyKebunId, historyStartDate, historyEndDate]);

  // Removed localStorage logic for keterangan to prevent persistence on reload

  const handlePreviewGajian = () => {
    if (!kebunId || !startDate || !endDate) {
      toast.error('Data gajian belum lengkap (Kebun/Periode).');
      return;
    }
    if (notasToProcess.length === 0 && savedBiaya.length === 0 && manualPotonganRows.length === 0 && detailKaryawan.length === 0) {
      toast.error('Belum ada data nota, biaya, atau potongan untuk disimpan.');
      return;
    }

    const totalBerat = notasToProcess.reduce((sum, nota) => sum + nota.beratAkhir, 0);
    const totalNota = notasToProcess.length;
    const totalBiayaLain = savedBiaya.reduce((sum, item) => sum + (item.total || 0), 0);
    const totalPotonganManual = manualPotonganRows.reduce((sum, item) => sum + Number(item.total || 0), 0);
    const totalPotonganHutang = detailKaryawan.reduce((sum: number, d: any) => sum + Number(d?.potongan || 0), 0)
    const totalPotongan = totalPotonganManual + totalPotonganHutang;
    const totalGaji = totalBiayaLain - totalPotongan;

    const kebunObj = kebunList.find(k => String(k.id) === kebunId);
    if (!kebunObj) {
        toast.error('Kebun tidak valid');
        return;
    }

    // Construct mock Gajian object for preview
    const mockGajian: GajianWithDetails = {
        id: 0, // Mock ID
        kebunId: Number(kebunId),
        tanggalMulai: startDate,
        tanggalSelesai: endDate,
        totalBerat,
        totalNota,
        totalGaji,
        totalBiayaLain,
        totalPotongan,
        keterangan,
        dibuatOlehName: null,
        disetujuiOlehName: null,
        status: 'DRAFT', // Temporary
        tipe: 'PANEN',
        createdAt: new Date(),
        updatedAt: new Date(),
        kebun: kebunObj,
        detailGajian: notasToProcess.map(n => ({
            id: 0,
            gajianId: 0,
            notaSawitId: n.id,
            harianKerja: n.harianKerja || 0,
            keterangan: n.keterangan || null,
            createdAt: new Date(),
            updatedAt: new Date(),
            notaSawit: {
                ...n,
                kebun: n.kebun ?? kebunObj,
                timbangan: n.timbangan ? { ...n.timbangan, kebun: kebunObj } : null
            }
        })),
        biayaLain: savedBiaya.map(b => ({
            id: 0,
            gajianId: 0,
            deskripsi: b.deskripsi,
            jumlah: b.jumlah,
            satuan: b.satuan,
            hargaSatuan: b.hargaSatuan,
            total: Math.round(Number(b.jumlah || 0) * Number(b.hargaSatuan || 0)),
            keterangan: b.keterangan || null,
            createdAt: new Date(),
            updatedAt: new Date()
        })),
        potongan: manualPotonganRows.map(p => ({
            id: 0,
            gajianId: 0,
            deskripsi: p.deskripsi,
            total: p.total,
            keterangan: p.keterangan || null,
            createdAt: new Date(),
            updatedAt: new Date()
        })),
        detailKaryawan: detailKaryawan.map((d: any) => {
          const baseSaldo = Math.max(0, Math.round(Number(hutangSaldoMap[Number(d.userId)] || 0)))
          return {
          id: 0,
          gajianId: 0,
          userId: d.userId,
          hariKerja: d.hariKerja || 0,
          gajiPokok: d.gajiPokok || 0,
          bonus: 0,
          lembur: 0,
          potongan: d.potongan || 0,
          saldoHutang: baseSaldo,
          total: d.total || 0,
          keterangan: d.keterangan || null,
          createdAt: new Date(),
          updatedAt: new Date(),
          user: d.user,
          }
        }),
        hutangTambahan: Object.entries(hutangTambahanMap).map(([userId, v]) => ({
          userId: Number(userId),
          jumlah: Math.round(Number((v as any)?.jumlah || 0)),
          date: (v as any)?.date || null,
          deskripsi: (v as any)?.deskripsi || 'Hutang Karyawan',
        })) as any,
    };

    setPreviewGajian(mockGajian);
    setIsPreviewOpen(true);
  };

  const handleOpenConfirm = useCallback((id: number) => {
    setSelectedGajianId(id);
    setIsConfirmOpen(true);
  }, []);

  const handleCloseConfirm = () => {
    setSelectedGajianId(null);
    setIsConfirmOpen(false);
  };

  const handleDelete = async () => {
    if (!selectedGajianId) return;
    
    const previousHistory = [...gajianHistory];
    setGajianHistory((prev: (Gajian & { kebun: Kebun })[]) => prev.filter(g => g.id !== selectedGajianId));
    handleCloseConfirm();
    const toastId = toast.loading('Menghapus gajian...')

    setLoading(true);
    setSearchAttempted(true);
    try {
      const response = await fetch(`/api/gajian/${selectedGajianId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Gagal menghapus gajian');
      
      toast.success('Gajian berhasil dihapus', { id: toastId })
    } catch (error) {
      setGajianHistory(previousHistory);
      toast.error('Gajian gagal dihapus, mengembalikan perubahan.', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDetail = useCallback(async (id: number) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/gajian/${id}`);
      if (!response.ok) throw new Error('Gagal mengambil detail gajian');
      const data = await response.json();
      setSelectedGajian(data);
      setIsDetailOpen(true);
    } catch (error) {
      toast.error('Gagal mengambil detail gajian.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCloseDetail = () => {
    setIsDetailOpen(false);
    setSelectedGajian(null);
  };


  const historyTotals = useMemo(() => {
    return {
      totalNota: gajianHistory.reduce((sum, item) => sum + (item.totalNota || 0), 0),
      totalBerat: gajianHistory.reduce((sum, item) => sum + (item.totalBerat || 0), 0),
      totalGaji: gajianHistory.reduce((sum, item) => sum + (item.totalBiayaLain || 0), 0),
      totalPotongan: gajianHistory.reduce((sum, item) => sum + (item.totalPotongan || 0), 0),
      totalJumlahGaji: gajianHistory.reduce((sum, item) => sum + (item.totalGaji || 0), 0),
    };
  }, [gajianHistory]);

  const sortedGajianHistory = useMemo(() => {
    const list = Array.isArray(gajianHistory) ? [...gajianHistory] : []
    list.sort((a: any, b: any) => {
      const aEnd = new Date(a?.tanggalSelesai).getTime()
      const bEnd = new Date(b?.tanggalSelesai).getTime()
      if (bEnd !== aEnd) return bEnd - aEnd
      const aStart = new Date(a?.tanggalMulai).getTime()
      const bStart = new Date(b?.tanggalMulai).getTime()
      return bStart - aStart
    })
    return list
  }, [gajianHistory])

  const historyColumns = useMemo(
    () => createHistoryColumns(handleOpenConfirm, handleOpenDetail, historyTotals),
    [handleOpenConfirm, handleOpenDetail, historyTotals]
  );

  // --- LOGIC FOR DRAFTS --- //
  const handleContinueDraft = useCallback(async (id: number) => {
    setLoading(true);
    try {
      try { localStorage.removeItem(draftKey) } catch {}
      const response = await fetch(`/api/gajian/${id}`);
      if (!response.ok) throw new Error('Gagal memuat data draft');
      const draftData: GajianWithDetails = await response.json();

      // Set form state with draft data
      setEditingGajianId(draftData.id);
      setKebunId(String(draftData.kebunId));
      const startYmd = formatWIBDateForInput(new Date(draftData.tanggalMulai))
      const endYmd = formatWIBDateForInput(new Date(draftData.tanggalSelesai))
      setStartDate(parseWIBDateFromInput(startYmd));
      setEndDate(parseWIBDateFromInput(endYmd, true));
      setNotasToProcess(draftData.detailGajian.map((d: DetailGajianWithRelations) => d.notaSawit));
      setSavedBiaya(draftData.biayaLain.map((b: BiayaLainGajian) => ({ 
        id: String(b.id), 
        deskripsi: b.deskripsi, 
        jumlah: b.jumlah || 0, 
        satuan: b.satuan || '', 
        hargaSatuan: b.hargaSatuan || 0,
        total: b.total || (b.jumlah && b.hargaSatuan ? b.jumlah * b.hargaSatuan : 0)
      })));
      setBiayaLain([]);
      setSavedPotongan(draftData.potongan.map((p: PotonganGajian) => ({ id: String(p.id), deskripsi: p.deskripsi, total: p.total, keterangan: p.keterangan ?? undefined })));
      setPotongan([]);
      setBoronganPekerjaanIds(Array.isArray((draftData as any).pekerjaanKebun) ? (draftData as any).pekerjaanKebun.map((p: any) => Number(p?.id)).filter((n: any) => Number.isFinite(n) && n > 0) : [])
      const activeDetailKaryawan = (draftData.detailKaryawan || []).filter((d: any) => String(d?.user?.status || 'AKTIF').toUpperCase() === 'AKTIF')
      setDetailKaryawan(activeDetailKaryawan);
      setHutangTambahanMap(() => {
        const list = Array.isArray((draftData as any).hutangTambahan) ? (draftData as any).hutangTambahan : []
        const next: Record<number, { jumlah: number; date: string; deskripsi: string }> = {}
        list.forEach((r: any) => {
          const userId = Number(r?.userId)
          const jumlah = Math.round(Number(r?.jumlah || 0))
          if (!Number.isFinite(userId) || userId <= 0) return
          if (!Number.isFinite(jumlah) || jumlah <= 0) return
          next[userId] = {
            jumlah,
            date: (r?.date ? String(r.date) : '') || '',
            deskripsi: (r?.deskripsi ? String(r.deskripsi) : '') || 'Hutang Karyawan',
          }
        })
        return next
      })
      const totalGajiPokokKaryawan = activeDetailKaryawan.reduce((sum: number, d: any) => sum + Number(d?.gajiPokok || 0), 0)
      if (totalGajiPokokKaryawan > 0) {
        setSavedBiaya(prev => {
          const others = prev.filter(b => !isAutoGajiHarianDesc(b.deskripsi))
          return [
            ...others,
            {
              id: `auto-gaji-karyawan-${Date.now()}`,
              deskripsi: buildGajiHarianDesc(parseWIBDateFromInput(startYmd), parseWIBDateFromInput(endYmd, true)),
              jumlah: 1,
              satuan: 'Paket',
              hargaSatuan: Math.round(totalGajiPokokKaryawan),
              total: Math.round(totalGajiPokokKaryawan),
              keterangan: '',
            } as any,
          ]
        })
      }
      
      // Build hutangRows table for the draft's period (same as in proses gajian)
      try {
        const draftStartYmd = formatWIBDateForInput(new Date(draftData.tanggalMulai))
        const draftEndYmd = formatWIBDateForInput(new Date(draftData.tanggalSelesai))
        const adjustedStartDateForHutang = parseWIBDateFromInput(draftStartYmd)
        const adjustedEndDateForHutang = parseWIBDateFromInput(draftEndYmd, true)
        const hutangParams = new URLSearchParams({
          kebunId: String(draftData.kebunId),
          startDate: adjustedStartDateForHutang?.toISOString() || new Date(draftData.tanggalMulai).toISOString(),
          endDate: adjustedEndDateForHutang?.toISOString() || new Date(draftData.tanggalSelesai).toISOString(),
        });
        const hutangRes = await fetch(`/api/karyawan-kebun?${hutangParams.toString()}`, { cache: 'no-store' });
        if (hutangRes.ok) {
          const json = await hutangRes.json();
          const list = Array.isArray(json.data) ? json.data : [];
          const tglLabel = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: '2-digit' }).format(
            (adjustedEndDateForHutang as any) || new Date(draftData.tanggalSelesai)
          );
          const mapped = list.map((r: any) => ({
            name: r.karyawan?.name || '-',
            tanggal: tglLabel,
            saldo: Math.round(Number(r.totalPengeluaran || 0)),
            potong: Math.round(Number(r.totalPembayaran || 0)),
            sisa: Math.max(0, Math.round(Number(r.hutangSaldo || 0))),
            keterangan: '',
          }));
          setHutangRows(mapped);
        } else {
          setHutangRows([]);
        }
      } catch {
        setHutangRows([]);
      }
      
      // Fetch notas that are not yet in the processing list
      const draftStartYmd = formatWIBDateForInput(new Date(draftData.tanggalMulai))
      const draftEndYmd = formatWIBDateForInput(new Date(draftData.tanggalSelesai))
      const adjustedStartDate = parseWIBDateFromInput(draftStartYmd)
      const adjustedEndDate = parseWIBDateFromInput(draftEndYmd, true)
      const params = new URLSearchParams({
        kebunId: String(draftData.kebunId),
        startDate: adjustedStartDate?.toISOString() || new Date(draftData.tanggalMulai).toISOString(),
        endDate: adjustedEndDate?.toISOString() || new Date(draftData.tanggalSelesai).toISOString(),
        page: '1',
        limit: '1000', // Fetch all to compare
      });
      params.append('gajianIdToEdit', String(id));
      const notaResponse = await fetch(`/api/gajian?${params.toString()}`);
      if (!notaResponse.ok) throw new Error('Gagal mengambil data nota');
      const { data: allNotas } = await notaResponse.json();

      const processedNotaIds = new Set(draftData.detailGajian.map((d: DetailGajianWithRelations) => d.notaSawitId));
      setNotas(allNotas.filter((n: NotaSawit) => !processedNotaIds.has(n.id)));

      toast.success('Data draft berhasil dimuat.');
      window.scrollTo(0, 0); // Scroll to top to the form
    } catch (error: any) {
      toast.error(error.message || 'Gagal memuat draft.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleOpenDraftDeleteConfirm = useCallback((id: number) => {
    setSelectedDraftId(id);
    setIsDraftConfirmOpen(true);
  }, []);

  const handleCloseDraftDeleteConfirm = () => {
    setSelectedDraftId(null);
    setIsDraftConfirmOpen(false);
  };

  const handleDeleteDraft = async () => {
    if (!selectedDraftId) return;
    
    const previousDrafts = [...draftsGajian];
    setDraftsGajian((prev: (Gajian & { kebun: Kebun })[]) => prev.filter(d => d.id !== selectedDraftId));
    handleCloseDraftDeleteConfirm();
    const toastId = toast.loading('Menghapus draft...')

    setLoading(true);
    try {
      const response = await fetch(`/api/gajian/${selectedDraftId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Gagal menghapus draft');
      
      toast.success('Draft berhasil dihapus', { id: toastId })
    } catch (error) {
      setDraftsGajian(previousDrafts);
      toast.error('Gagal menghapus draft, mengembalikan perubahan.', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const [isHistoryExpanded, setIsHistoryExpanded] = useState(true);
  const notasSectionRef = useRef<HTMLDivElement>(null);

  const draftColumns = useMemo(() => createDraftColumns(handleContinueDraft, handleOpenDraftDeleteConfirm, handleOpenDetail), [handleContinueDraft, handleOpenDraftDeleteConfirm, handleOpenDetail]);
  const sortedDraftsGajian = useMemo(() => {
    const list = Array.isArray(draftsGajian) ? [...draftsGajian] : []
    list.sort((a: any, b: any) => {
      const aEnd = new Date(a?.tanggalSelesai).getTime()
      const bEnd = new Date(b?.tanggalSelesai).getTime()
      if (bEnd !== aEnd) return bEnd - aEnd
      const aStart = new Date(a?.tanggalMulai).getTime()
      const bStart = new Date(b?.tanggalMulai).getTime()
      return bStart - aStart
    })
    return list
  }, [draftsGajian])

  // --- LOGIC FOR CREATE NEW GAJIAN --- //
  const handleFetchNotas = async () => {
    if (!kebunId || !startDate || !endDate) {
      toast.error('Silakan pilih kebun dan periode tanggal terlebih dahulu.');
      return;
    }
    if (!editingGajianId) {
      const kebunIdNum = Number(kebunId)
      const startKey = formatWIBDateForInput(startDate)
      const endKey = formatWIBDateForInput(endDate)
      const existsDraft = (draftsGajian || []).some((d: any) => {
        const sameKebun = Number(d?.kebunId) === kebunIdNum
        if (!sameKebun) return false
        const dStart = formatWIBDateForInput(new Date(d.tanggalMulai))
        const dEnd = formatWIBDateForInput(new Date(d.tanggalSelesai))
        return dStart === startKey && dEnd === endKey
      })
      if (existsDraft) {
        toast.error('Draft gajian pada periode ini sudah ada. Lanjutkan atau hapus draft terlebih dahulu.')
        return
      }
    }
    setLoading(true);
    setSearchAttempted(true);
    try {
      const params = new URLSearchParams({
        kebunId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        page: '1',
        limit: String(notaFetchLimit),
      });

      if (editingGajianId) {
        params.append('gajianIdToEdit', String(editingGajianId));
      }
      const response = await fetch(`/api/gajian?${params.toString()}`);
      if (!response.ok) throw new Error('Gagal mengambil data nota');
      const { data, total } = await response.json();
      
      // Prevent duplicates by filtering out notas already in notasToProcess
      const processedIds = new Set(notasToProcess.map(n => n.id));
      const filteredData = Array.isArray(data) ? data.filter((n: any) => !processedIds.has(n.id)) : [];
      
      setNotas(filteredData);
      setTotalNotas(total);
      setRowSelection({});

      // Scroll to notas section
      setTimeout(() => {
        notasSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);

    } catch (error) {
      toast.error('Gagal mengambil data nota.');
    } finally {
      setLoading(false);
    }
  };

  const selectedNotas = useMemo(() => {
    const selectedIndexes = Object.keys(rowSelection).map(Number);
    return notas.filter((_, index) => selectedIndexes.includes(index));
  }, [notas, rowSelection]);

  const handleMoveToProcess = async () => {
    if (selectedNotas.length === 0) return;

    // Check for duplicate notas that might have been added manually or otherwise
    const processedIds = new Set(notasToProcess.map(n => n.id));
    const duplicates = selectedNotas.filter(n => processedIds.has(n.id));
    if (duplicates.length > 0) {
      toast.error(`Nota ${duplicates.map(d => d.id).join(', ')} sudah ada di daftar rincian gaji.`);
      return;
    }

    const totalBeratAll = [...notasToProcess, ...selectedNotas].reduce((sum, nota) => sum + (Number(nota.beratAkhir) || 0), 0)

    setSavedBiaya((prev) => {
      if (!kebunId) return prev
      const next = [...prev]

      const normalize = (v: any) => String(v || '').trim().toLowerCase()
      for (const db of kebunDefaultBiaya) {
        const dbId = String((db as any)?.id || '').trim()
        const dbDesc = String((db as any)?.deskripsi || '').trim()
        const dbSatuan = String((db as any)?.satuan || 'Kg').trim() || 'Kg'
        const dbHarga = Number((db as any)?.hargaSatuan || 0)
        const isAutoKg = !!(db as any)?.isAutoKg
        if (!dbDesc) continue

        const stableId = `default-${kebunId}-${dbId || normalize(dbDesc)}`
        const existingIdx = next.findIndex((b: any) => {
          const bid = String((b as any)?.id || '')
          if (bid === stableId) return true
          return normalize((b as any)?.deskripsi) === normalize(dbDesc) && String((b as any)?.satuan || 'Kg').trim() === dbSatuan && Number((b as any)?.hargaSatuan || 0) === dbHarga
        })

        if (!isAutoKg) {
          if (existingIdx === -1) {
            next.push({
              id: stableId,
              deskripsi: dbDesc,
              jumlah: 0,
              satuan: dbSatuan,
              hargaSatuan: dbHarga,
              total: 0,
              isAutoKg: false,
            } as any)
          }
          continue
        }

        const desiredJumlah = totalBeratAll
        const desiredTotal = Math.round(totalBeratAll * dbHarga)

        if (existingIdx === -1) {
          next.push({
            id: stableId,
            deskripsi: dbDesc,
            jumlah: desiredJumlah,
            satuan: dbSatuan,
            hargaSatuan: dbHarga,
            total: desiredTotal,
            isAutoKg: true,
            keterangan: '',
          } as any)
          continue
        }

        const existing: any = next[existingIdx]
        next[existingIdx] = {
          ...existing,
          id: stableId,
          deskripsi: dbDesc,
          satuan: dbSatuan,
          hargaSatuan: dbHarga,
          jumlah: desiredJumlah,
          total: desiredTotal,
          isAutoKg: true,
        }
      }

      return next
    })
    setBiayaLain([]);
    // Create new objects to avoid reference sharing issues
    setNotasToProcess(prev => [...prev, ...selectedNotas.map(n => ({ ...n }))]);
    setNotas(prev => prev.filter(nota => !selectedNotas.map(n => n.id).includes(nota.id)));
    setRowSelection({});

    if (detailKaryawan.length === 0 && kebunId && startDate && endDate) {
      try {
        const paramsActive = new URLSearchParams({
          kebunId,
          jobType: 'KEBUN',
          status: 'AKTIF',
          page: '1',
          limit: '1000',
        })
        const paramsAbsensi = new URLSearchParams({
          kebunId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          unpaid: '1',
        })
        const [resKaryawan, resAbsensi] = await Promise.all([
          fetch(`/api/karyawan?${paramsActive.toString()}`, { cache: 'no-store' }),
          fetch(`/api/karyawan-kebun/absensi?${paramsAbsensi.toString()}`, { cache: 'no-store' }),
        ])
        const jsonKaryawan = await resKaryawan.json().catch(() => ({} as any))
        const jsonAbsensi = await resAbsensi.json().catch(() => ({} as any))
        const karyawanList = Array.isArray((jsonKaryawan as any).data) ? (jsonKaryawan as any).data : []
        const absensiList = Array.isArray((jsonAbsensi as any).data) ? (jsonAbsensi as any).data : []
        const absensiMap = new Map<number, { total: number; hariKerja: number }>(
          absensiList.map((r: any) => ([
            Number(r.karyawanId),
            { total: Number(r.total || 0), hariKerja: Number(r.hariKerja || 0) },
          ] as [number, { total: number; hariKerja: number }]))
        )

        const mapped = karyawanList.map((u: any) => {
          const agg = absensiMap.get(Number(u.id)) ?? { total: 0, hariKerja: 0 }
          const gajiPokok = Math.round(agg.total || 0)
          return {
            userId: u.id,
            user: u,
            hariKerja: agg.hariKerja || 0,
            gajiPokok,
            potongan: 0,
            total: gajiPokok,
            keterangan: '',
          }
        })
        setDetailKaryawan(mapped as any)
        const totalGajiPokokKaryawan = mapped.reduce((sum: number, d: any) => sum + Number(d?.gajiPokok || 0), 0)
        if (totalGajiPokokKaryawan > 0) {
          setSavedBiaya(prev => {
            const others = prev.filter(b => !isAutoGajiHarianDesc(b.deskripsi))
            return [
              ...others,
              {
                id: `auto-gaji-karyawan-${Date.now()}`,
                deskripsi: buildGajiHarianDesc(startDate, endDate),
                jumlah: 1,
                satuan: 'Paket',
                hargaSatuan: Math.round(totalGajiPokokKaryawan),
                total: Math.round(totalGajiPokokKaryawan),
                keterangan: '',
              } as any,
            ]
          })
        }
      } catch {
        setDetailKaryawan([])
      }
    }
  };



  const addBiayaLain = () => {
    const id = `new-${Date.now()}`
    setSavedBiaya(prev => [...prev, { id, deskripsi: '', jumlah: 0, satuan: '', hargaSatuan: 0 }]);
    setEditingBiayaId(id)
    setTimeout(() => {
      const rowEl = document.querySelector<HTMLElement>(`[data-biaya-row="${id}"]`)
      rowEl?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      const inputEl = document.querySelector<HTMLInputElement>(`[data-biaya-id="${id}"][data-biaya-field="deskripsi"]`)
      inputEl?.focus()
    }, 50)
  };

  const refreshNotaSawitDraft = useCallback(async () => {
    if (!editingGajianId) return
    const ids = Array.from(new Set(notasToProcess.map((n: any) => Number(n?.id)).filter((n: any) => Number.isFinite(n) && n > 0)))
    if (ids.length === 0) return
    const res = await fetch(`/api/nota-sawit/bulk?ids=${encodeURIComponent(ids.join(','))}`, { cache: 'no-store' })
    if (!res.ok) throw new Error('Gagal memuat ulang data nota sawit')
    const json = await res.json().catch(() => ({} as any))
    const list = Array.isArray((json as any)?.data) ? (json as any).data : []
    const map = new Map<number, any>(list.map((n: any) => [Number(n.id), n]))
    setNotasToProcess((prev) =>
      prev.map((n: any) => {
        const fresh = map.get(Number(n?.id))
        if (!fresh) return n
        return { ...fresh, harianKerja: n.harianKerja || 0, keterangan: n.keterangan || null }
      }),
    )
  }, [editingGajianId, notasToProcess])

  const refreshGajiKaryawanDraft = useCallback(async () => {
    if (!editingGajianId) return
    if (!kebunId || !startDate || !endDate) throw new Error('Pilih kebun dan periode terlebih dahulu')
    const paramsActive = new URLSearchParams({
      kebunId,
      jobType: 'KEBUN',
      status: 'AKTIF',
      page: '1',
      limit: '1000',
    })
    const paramsAbsensi = new URLSearchParams({
      kebunId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      unpaid: '1',
    })
    const [resKaryawan, resAbsensi] = await Promise.all([
      fetch(`/api/karyawan?${paramsActive.toString()}`, { cache: 'no-store' }),
      fetch(`/api/karyawan-kebun/absensi?${paramsAbsensi.toString()}`, { cache: 'no-store' }),
    ])
    if (!resKaryawan.ok) throw new Error('Gagal mengambil data karyawan')
    if (!resAbsensi.ok) throw new Error('Gagal mengambil data absensi')
    const jsonKaryawan = await resKaryawan.json().catch(() => ({} as any))
    const jsonAbsensi = await resAbsensi.json().catch(() => ({} as any))
    const karyawanList = Array.isArray((jsonKaryawan as any).data) ? (jsonKaryawan as any).data : []
    const absensiList = Array.isArray((jsonAbsensi as any).data) ? (jsonAbsensi as any).data : []
    const absensiMap = new Map<number, { total: number; hariKerja: number }>(
      absensiList.map((r: any) => ([
        Number(r.karyawanId),
        { total: Number(r.total || 0), hariKerja: Number(r.hariKerja || 0) },
      ] as [number, { total: number; hariKerja: number }])),
    )
    const prevMap = new Map<number, any>((detailKaryawan || []).map((d: any) => [Number(d.userId), d]))
    const mapped = karyawanList.map((u: any) => {
      const agg = absensiMap.get(Number(u.id)) ?? { total: 0, hariKerja: 0 }
      const gajiPokok = Math.round(agg.total || 0)
      const prev = prevMap.get(Number(u.id))
      const potonganPrev = Number(prev?.potongan || 0)
      const potongan = Math.max(0, potonganPrev)
      return {
        userId: u.id,
        user: u,
        hariKerja: agg.hariKerja || 0,
        gajiPokok,
        potongan,
        total: gajiPokok - potongan,
        keterangan: prev?.keterangan || '',
      }
    })
    setDetailKaryawan(mapped as any)
    const totalGajiPokokKaryawan = mapped.reduce((sum: number, d: any) => sum + Number(d?.gajiPokok || 0), 0)
    setSavedBiaya((prev) => {
      const others = prev.filter((b) => !isAutoGajiHarianDesc(b.deskripsi))
      if (totalGajiPokokKaryawan <= 0) return others
      return [
        ...others,
        {
          id: `auto-gaji-karyawan-${Date.now()}`,
          deskripsi: buildGajiHarianDesc(startDate, endDate),
          jumlah: 1,
          satuan: 'Paket',
          hargaSatuan: Math.round(totalGajiPokokKaryawan),
          total: Math.round(totalGajiPokokKaryawan),
          keterangan: '',
        } as any,
      ]
    })
  }, [detailKaryawan, editingGajianId, endDate, kebunId, startDate])

  const importUpahBorongan = useCallback(async () => {
    if (!kebunId || !startDate || !endDate) {
      toast.error('Pilih kebun dan periode terlebih dahulu.')
      return
    }
    setBoronganLoading(true)
    try {
      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        unpaid: '1',
        upahBorongan: '1',
      })
      const res = await fetch(`/api/kebun/${kebunId}/pekerjaan?${params.toString()}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Gagal mengambil data upah borongan')
      const rows = await res.json().catch(() => [])
      const list = Array.isArray(rows) ? rows : []

      const allIds: number[] = []

      const imported = list
        .map((p: any) => {
          const id = Number(p?.id)
          if (!Number.isFinite(id) || id <= 0) return null
          const biaya = Number(p?.biaya || 0)
          if (!Number.isFinite(biaya) || biaya <= 0) return null

          allIds.push(id)
          const jenis = String(p?.jenisPekerjaan || 'Borongan').trim() || 'Borongan'
          const deskripsi = jenis
          const jumlah = Number(p?.jumlah || 0)
          const hargaSatuan = Number(p?.hargaSatuan || 0)
          const normalizedJumlah = Number.isFinite(jumlah) && jumlah > 0 ? jumlah : 1
          const normalizedHarga = Number.isFinite(hargaSatuan) && hargaSatuan > 0 ? hargaSatuan : Math.round(biaya / normalizedJumlah)
          const satuan = String(p?.satuan || '').trim() || 'Paket'

          return {
            id: `auto-borongan-${id}`,
            deskripsi,
            jumlah: normalizedJumlah,
            satuan,
            hargaSatuan: Math.round(normalizedHarga),
            total: Math.round(biaya),
            keterangan: '',
          } as any
        })
        .filter(Boolean) as any[]

      setSavedBiaya((prev) => {
        const filtered = prev.filter((b) => !(String((b as any)?.id || '').startsWith('auto-borongan-')))
        return [...filtered, ...imported]
      })
      setBoronganPekerjaanIds(allIds)

      if (allIds.length === 0) {
        toast.success('Tidak ada upah borongan yang belum tergajikan pada periode ini.')
      } else {
        toast.success('Upah borongan berhasil ditambahkan ke biaya gaji')
      }
    } catch (e: any) {
      toast.error(e?.message || 'Gagal mengambil upah borongan')
    } finally {
      setBoronganLoading(false)
    }
  }, [endDate, kebunId, startDate])

  const fetchHutangSaldoForPeriod = useCallback(async () => {
    if (!kebunId || !startDate || !endDate) return {} as Record<number, number>
    const params = new URLSearchParams({
      kebunId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    })
    const res = await fetch(`/api/karyawan-kebun?${params.toString()}`, { cache: 'no-store' })
    if (!res.ok) throw new Error('Gagal mengambil data hutang')
    const json = await res.json()
    const list = Array.isArray(json.data) ? json.data : []
    const nextMap: Record<number, number> = {}
    list.forEach((r: any) => {
      const id = Number(r?.karyawan?.id)
      const saldo = Math.max(0, Math.round(Number(r?.hutangSaldo || 0)))
      if (Number.isFinite(id) && id > 0) nextMap[id] = saldo
    })
    setHutangSaldoMap(nextMap)
    const key = `${kebunId}|${startDate.toISOString()}|${endDate.toISOString()}`
    setHutangSaldoKey(key)
    return nextMap
  }, [kebunId, startDate, endDate])

  const handleRefreshDraftData = useCallback(async () => {
    if (!editingGajianId) return
    setRefreshingData(true)
    try {
      await Promise.all([
        refreshNotaSawitDraft(),
        refreshGajiKaryawanDraft(),
        importUpahBorongan(),
      ])
      const map = await fetchHutangSaldoForPeriod()
      setDetailKaryawan((prev) => {
        const next = (prev || []).map((dk: any) => {
          const userId = Number(dk?.userId)
          const baseSaldo = Math.max(0, Math.round(Number((map as any)?.[userId] || 0)))
          const tambahan = Math.max(0, Math.round(Number(hutangTambahanMap?.[userId]?.jumlah || 0)))
          const saldo = baseSaldo + tambahan
          const gajiPokok = Math.round(Number(dk?.gajiPokok || 0))
          const potongPrev = Math.max(0, Math.round(Number(dk?.potongan || 0)))
          const potong = saldo <= 0 ? 0 : Math.min(potongPrev, saldo)
          return { ...dk, potongan: potong, total: gajiPokok - potong }
        })
        return next as any
      })
      toast.success('Data draft berhasil diperbarui')
    } catch (e: any) {
      toast.error(e?.message || 'Gagal memperbarui data draft')
    } finally {
      setRefreshingData(false)
    }
  }, [editingGajianId, fetchHutangSaldoForPeriod, hutangTambahanMap, importUpahBorongan, refreshGajiKaryawanDraft, refreshNotaSawitDraft])

  const removeBiayaLain = (id: string) => {
    setBiayaLain(prev => prev.filter(item => item.id !== id));
  };

  const removeSavedBiaya = (id: string) => {
    setSavedBiaya(prev => {
      return prev.filter(item => item.id !== id)
    });
    setEditingBiayaId((curr) => (curr === id ? null : curr))
  };

  const handleSaveBiayaInputs = () => {
    if (biayaLain.length === 0) {
      toast.error('Tidak ada baris biaya untuk disimpan.');
      return;
    }
    const valid = biayaLain
      .map(item => ({
        ...item,
        jumlah: Number(item.jumlah || 0),
        hargaSatuan: Number(item.hargaSatuan || 0),
      }))
      .filter(item => item.deskripsi && item.jumlah > 0 && item.hargaSatuan > 0);

    if (valid.length === 0) {
      toast.error('Lengkapi deskripsi, jumlah, dan harga satuan sebelum simpan.');
      return;
    }

    setSavedBiaya(prev => [...prev, ...valid.map(v => ({ ...v, id: `saved-${Date.now()}-${Math.random()}` }))]);
    setBiayaLain([]); // kosongkan input setelah simpan
    toast.success('Biaya berhasil disimpan ke tabel.');
  };

  const handleSavePotonganInputs = () => {
    if (potongan.length === 0) {
      toast.error('Tidak ada baris potongan untuk disimpan.');
      return;
    }
    const valid = potongan
      .map(item => ({
        ...item,
        deskripsi: String(item.deskripsi || '').trim(),
        total: Number(item.total || 0),
      }))
      .filter(item => item.deskripsi && item.total > 0)
      .filter(item => !isPotonganHutangDesc(item.deskripsi));

    if (valid.length === 0) {
      toast.error('Lengkapi deskripsi dan total sebelum simpan.');
      return;
    }

    setSavedPotongan(prev => [...prev, ...valid.map(v => ({ ...v, id: `saved-${Date.now()}-${Math.random()}` }))]);
    setPotongan([]);
    toast.success('Potongan berhasil disimpan ke tabel.');
  };

  const removeSavedPotongan = (id: string) => {
    setSavedPotongan(prev => prev.filter(item => item.id !== id));
  };

  const handleConfirmSave = async (payload: { dibuatOlehName: string; disetujuiOlehName: string }) => {
    await handleSimpanGajian('FINALIZED', payload);
  };

  const handleSimpanGajian = async (status: 'DRAFT' | 'FINALIZED', approval?: { dibuatOlehName: string; disetujuiOlehName: string }) => {
    if (!kebunId || !startDate || !endDate) {
      toast.error('Silakan lengkapi data kebun dan periode.');
      return;
    }
    
    const invalidBiaya = savedBiaya.filter((b) => !String(b.deskripsi || '').trim() || Number(b.jumlah || 0) <= 0 || Number(b.hargaSatuan || 0) <= 0)
    if (invalidBiaya.length > 0) {
      const nextErrors: Record<string, { deskripsi?: boolean; jumlah?: boolean; hargaSatuan?: boolean }> = {}
      invalidBiaya.forEach((b) => {
        const id = b.id
        nextErrors[id] = {
          deskripsi: !String(b.deskripsi || '').trim(),
          jumlah: Number(b.jumlah || 0) <= 0,
          hargaSatuan: Number(b.hargaSatuan || 0) <= 0,
        }
      })
      setBiayaFieldErrors(nextErrors)
      const first = invalidBiaya[0]
      setEditingBiayaId(first.id)
      setTimeout(() => {
        const rowEl = document.querySelector<HTMLElement>(`[data-biaya-row="${first.id}"]`)
        rowEl?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        const e = nextErrors[first.id] || {}
        const field = e.deskripsi ? 'deskripsi' : e.jumlah ? 'jumlah' : 'hargaSatuan'
        const inputEl = document.querySelector<HTMLInputElement>(`[data-biaya-id="${first.id}"][data-biaya-field="${field}"]`)
        inputEl?.focus()
      }, 50)
      toast.error('Masih ada baris biaya gaji yang belum lengkap. Lengkapi deskripsi, jumlah, dan harga satuan.')
      return
    }
    const invalidPotongan = manualPotonganRows.filter((p) => !String(p.deskripsi || '').trim() || Number(p.total || 0) <= 0)
    if (invalidPotongan.length > 0) {
      toast.error('Masih ada baris potongan yang belum lengkap. Lengkapi deskripsi dan total.')
      return
    }

    if (status === 'FINALIZED' && !isPreviewOpen) {
      handlePreviewGajian();
      return;
    }

    setLoading(true);
    try {
      const payload = {
        gajianId: editingGajianId,
        kebunId,
        tanggalMulai: startDate,
        tanggalSelesai: endDate,
        ...(status === 'FINALIZED' && approval ? { dibuatOlehName: approval.dibuatOlehName, disetujuiOlehName: approval.disetujuiOlehName } : {}),
        notas: notasToProcess.map(n => ({ id: n.id, harianKerja: n.harianKerja, keterangan: n.keterangan })),
        biayaLain: savedBiaya.map(b => ({
          deskripsi: b.deskripsi,
          jumlah: b.jumlah,
          satuan: b.satuan,
          hargaSatuan: b.hargaSatuan,
          total: Math.round(Number(b.jumlah || 0) * Number(b.hargaSatuan || 0)),
          keterangan: b.keterangan
        })),
        potongan: manualPotonganRows.map(p => ({
          deskripsi: p.deskripsi,
          total: p.total,
          keterangan: p.keterangan
        })),
        detailKaryawan: detailKaryawan
          .filter((d: any) => String(d?.user?.status || 'AKTIF').toUpperCase() === 'AKTIF')
          .map(d => ({
            userId: d.userId,
            hariKerja: d.hariKerja,
            gajiPokok: d.gajiPokok,
            potongan: d.potongan,
            total: d.total,
            keterangan: d.keterangan
          })),
        hutangTambahan: Object.entries(hutangTambahanMap).map(([userId, v]) => ({
          userId: Number(userId),
          jumlah: Math.round(Number((v as any)?.jumlah || 0)),
          date: (v as any)?.date || undefined,
          deskripsi: (v as any)?.deskripsi || 'Hutang Karyawan',
        })),
        pekerjaanBoronganIds: boronganPekerjaanIds,
        keterangan: keterangan, // Global note
        status,
        payAbsensi: status === 'FINALIZED',
      };
      
      const response = await fetch('/api/gajian', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        let errorText = errorData.error || 'Gagal menyimpan gajian.';
        if (errorData.conflicts) {
            errorText += ` (ID Nota Konflik: ${errorData.conflicts.join(', ')})`;
        }
        throw new Error(errorText);
      }

      const savedGajian = await response.json();
      toast.success(`Gajian berhasil disimpan sebagai ${status === 'DRAFT' ? 'draft' : 'final'}!`);

      // Refresh history/draft list before resetting form
      await fetchAllHistory({
        kebunId: historyKebunId || undefined,
        startDate: historyStartDate,
        endDate: historyEndDate,
      });

      // Reset form state
      handleResetForm();
      setSavedBiaya([]);
      setSavedPotongan([]);
      setKeterangan(''); // Reset global note
      setIsPreviewOpen(false); // Close preview if open

    } catch (error: any) {
      toast.error(error.message || 'Gagal menyimpan gajian.');
    } finally {
      setLoading(false);
    }
  };

  const addPotongan = () => {
    const id = `new-${Date.now()}`
    setSavedPotongan(prev => [...prev, { id, deskripsi: '', total: 0 }]);
    setEditingPotonganId(id)
  };

  const importPotonganPengajuan = useCallback(async () => {
    if (!kebunId || !startDate || !endDate) {
      toast.error('Pilih kebun dan periode terlebih dahulu.')
      return
    }
    setImportPotonganLoading(true)
    try {
      const params = new URLSearchParams({
        startDate: toYmdLocal(startDate),
        endDate: toYmdLocal(endDate),
      })
      const res = await fetch(`/api/kebun/${kebunId}/gajian-potongan-draft?${params.toString()}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Gagal mengambil potongan pengajuan')
      const json = await res.json().catch(() => ({} as any))
      let items = Array.isArray(json?.items) ? json.items : []

      // Fallback: jika draft potongan kosong, ambil dari detail gajian pada periode yang sama.
      if (items.length === 0) {
        const historyParams = new URLSearchParams({
          fetchHistory: 'true',
          kebunId: String(kebunId),
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        })
        const historyRes = await fetch(`/api/gajian?${historyParams.toString()}`, { cache: 'no-store' })
        if (historyRes.ok) {
          const historyJson = await historyRes.json().catch(() => ({} as any))
          const drafts = Array.isArray(historyJson?.drafts) ? historyJson.drafts : []
          const finalized = Array.isArray(historyJson?.finalized) ? historyJson.finalized : []
          const allGajian = [...drafts, ...finalized]
          const pulled: any[] = []
          for (const g of allGajian) {
            const detailRes = await fetch(`/api/gajian/${g.id}`, { cache: 'no-store' })
            if (!detailRes.ok) continue
            const detailJson = await detailRes.json().catch(() => ({} as any))
            const pots = Array.isArray(detailJson?.potongan) ? detailJson.potongan : []
            for (const p of pots) pulled.push(p)
          }
          items = pulled
        }
      }

      if (items.length === 0) {
        toast.error('Tidak ada potongan tersimpan pada pengajuan gajian periode ini.')
        return
      }

      const makeKey = (x: any) => `${String(x?.deskripsi || '').trim()}|${Math.round(Number(x?.total || 0))}|${String(x?.keterangan || '').trim()}`
      const existingKeys = new Set(savedPotongan.map((p) => makeKey(p)))
      const imported = items
        .map((x: any, idx: number) => ({
          id: `pengajuan-${Date.now()}-${idx}`,
          deskripsi: String(x?.deskripsi || '').trim(),
          total: Math.round(Number(x?.total || 0)),
          keterangan: typeof x?.keterangan === 'string' ? x.keterangan : undefined,
        }))
        .filter((x: any) => x.deskripsi && x.total > 0)
        .filter((x: any) => !existingKeys.has(makeKey(x)))

      if (imported.length === 0) {
        toast.error('Potongan pengajuan sudah ada di daftar potongan.')
        return
      }

      setSavedPotongan((prev) => [...prev, ...imported])
      toast.success(`Potongan pengajuan dimuat: ${imported.length} baris`)
    } catch (e: any) {
      toast.error(e?.message || 'Gagal mengambil potongan pengajuan')
    } finally {
      setImportPotonganLoading(false)
    }
  }, [endDate, kebunId, savedPotongan, startDate])

  const resetPotonganHutang = () => {
    setDetailKaryawan(prev => prev.map((dk: any) => ({ ...dk, potongan: 0, total: dk.gajiPokok || 0 })))
    setHutangRows([])
  }

  const resetHutangBaru = useCallback(() => {
    setHutangTambahanMap({})
    setDetailKaryawan(prev => prev.map((dk: any) => {
      const userId = Number(dk.userId)
      const baseSaldo = Math.max(0, Math.round(Number(hutangSaldoMap[userId] || 0)))
      const gajiPokok = Number(dk.gajiPokok || 0)
      const potong = Math.max(0, Math.min(Number(dk.potongan || 0), baseSaldo))
      return { ...dk, potongan: potong, total: gajiPokok - potong }
    }))
    toast.success('Hutang baru dihapus dari proses gajian')
  }, [hutangSaldoMap])

  const handleOpenTambahHutang = useCallback((userId?: number) => {
    const id = typeof userId === 'number' ? String(userId) : (detailKaryawan?.[0]?.userId ? String(detailKaryawan[0].userId) : '')
    const existing = id ? hutangTambahanMap[Number(id)] : undefined
    setTambahHutangKaryawanId(id)
    setTambahHutangJumlah(existing?.jumlah || 0)
    setTambahHutangTanggal(existing?.date || (endDate ? formatWIBDateForInput(endDate) : formatWIBDateForInput(new Date())))
    setTambahHutangDeskripsi(existing?.deskripsi || 'Hutang Karyawan')
    setOpenTambahHutang(true)
  }, [detailKaryawan, endDate, hutangTambahanMap])

  const handleSubmitTambahHutang = useCallback(async () => {
    const karyawanIdNum = Number(tambahHutangKaryawanId)
    if (!karyawanIdNum) {
      toast.error('Pilih karyawan terlebih dahulu')
      return
    }
    if (!tambahHutangJumlah || tambahHutangJumlah <= 0) {
      toast.error('Jumlah hutang wajib diisi')
      return
    }
    setTambahHutangSubmitting(true)
    try {
      setHutangTambahanMap((prev) => ({
        ...prev,
        [karyawanIdNum]: {
          jumlah: Math.round(Number(tambahHutangJumlah) || 0),
          date: tambahHutangTanggal || (endDate ? formatWIBDateForInput(endDate) : formatWIBDateForInput(new Date())),
          deskripsi: tambahHutangDeskripsi || 'Hutang Karyawan',
        },
      }))
      toast.success('Hutang tambahan disiapkan')
      setOpenTambahHutang(false)
      setTambahHutangJumlah(0)
      setTambahHutangDeskripsi('Hutang Karyawan')
      setTambahHutangTanggal('')
      setTambahHutangKaryawanId('')
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menambah hutang')
    } finally {
      setTambahHutangSubmitting(false)
    }
  }, [endDate, tambahHutangDeskripsi, tambahHutangJumlah, tambahHutangKaryawanId, tambahHutangTanggal])

  useEffect(() => {
    if (!kebunId || !startDate || !endDate) return
    if (detailKaryawan.length === 0) return
    const key = `${kebunId}|${startDate.toISOString()}|${endDate.toISOString()}`
    if (hutangSaldoKey === key && Object.keys(hutangSaldoMap).length > 0) return
    let cancelled = false
    ;(async () => {
      try {
        setHutangLoading(true)
        const map = await fetchHutangSaldoForPeriod()
        if (cancelled) return
        setHutangSaldoMap(map)
      } catch {
      } finally {
        if (!cancelled) setHutangLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [kebunId, startDate, endDate, detailKaryawan.length, hutangSaldoKey, hutangSaldoMap, fetchHutangSaldoForPeriod])

  const applyPotongHutangMassal = async (options: { mode: 'MAX' | 'NOMINAL'; amount: number }) => {
    if (!kebunId || !startDate || !endDate) {
      toast.error('Pilih kebun dan periode terlebih dahulu')
      return
    }
    if (detailKaryawan.length === 0) {
      toast.error('Tidak ada data gaji karyawan pada periode ini')
      return
    }
    if (options.mode === 'NOMINAL' && (!options.amount || options.amount <= 0)) {
      toast.error('Nominal potongan wajib diisi')
      return
    }

    setHutangLoading(true)
    try {
      const map = Object.keys(hutangSaldoMap).length > 0 ? hutangSaldoMap : await fetchHutangSaldoForPeriod()
      const tgl = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: '2-digit' }).format(endDate)

      setPotongan(prev => prev.filter(p => p.deskripsi !== 'Potongan Hutang Karyawan Kebun'))

      const nextDetail = detailKaryawan.map((dk: any) => {
        const baseSaldo = Number(map[Number(dk.userId)] || 0)
        const tambahan = Math.max(0, Math.round(Number(hutangTambahanMap[Number(dk.userId)]?.jumlah || 0)))
        const saldo = baseSaldo + tambahan
        const gajiPokok = Number(dk.gajiPokok || 0)
        const raw = options.mode === 'MAX' ? saldo : options.amount
        const potong = Math.max(0, Math.min(raw, saldo))
        return { ...dk, potongan: potong, total: gajiPokok - potong }
      })
      setDetailKaryawan(nextDetail as any)

      const mapped = nextDetail
        .map((dk: any) => {
          const baseSaldo = Number(map[Number(dk.userId)] || 0)
          const tambahan = Math.max(0, Math.round(Number(hutangTambahanMap[Number(dk.userId)]?.jumlah || 0)))
          const saldo = baseSaldo + tambahan
          const potong = Number(dk.potongan || 0)
          return {
            name: dk.user?.name || '-',
            tanggal: tgl,
            saldo,
            potong,
            sisa: Math.max(0, saldo - potong),
            keterangan: dk.keterangan || '',
          }
        })
        .filter((r: any) => r.saldo > 0 || r.potong > 0)
      setHutangRows(mapped)
      toast.success('Potongan hutang diterapkan')
    } catch {
      toast.error('Gagal mengambil data hutang')
    } finally {
      setHutangLoading(false)
    }
  }

  const updatePotonganHutangByUserId = useCallback((userId: number, raw: string) => {
    const numericValue = Number(String(raw || '').replace(/\D/g, '')) || 0
    setDetailKaryawan(prev => {
      const next = [...prev] as any[]
      const idx = next.findIndex((d: any) => Number(d?.userId) === Number(userId))
      if (idx < 0) return prev
      const current = next[idx]
      const gajiPokok = Number(current.gajiPokok || 0)
      const baseSaldo = Math.max(0, Math.round(Number(hutangSaldoMap[Number(userId)] || 0)))
      const tambahan = Math.max(0, Math.round(Number(hutangTambahanMap[Number(userId)]?.jumlah || 0)))
      const saldo = baseSaldo + tambahan
      const potong = Math.max(0, Math.min(numericValue, saldo))
      next[idx] = { ...current, potongan: potong, total: gajiPokok - potong }
      return next as any
    })
  }, [hutangSaldoMap, hutangTambahanMap])
  const importGajiAbsensi = async () => {
  }

  const hutangDisplayRows = useMemo(() => {
    if (!endDate) return [] as Array<{ userId: number; name: string; tanggal: string; saldo: number; potong: number; sisa: number; keterangan?: string }>
    const tgl = endDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: '2-digit' })
    const rows = (detailKaryawan || []).map((dk: any) => {
      const baseSaldo = Math.max(0, Math.round(Number(hutangSaldoMap[Number(dk.userId)] || 0)))
      const tambahan = Math.max(0, Math.round(Number(hutangTambahanMap[Number(dk.userId)]?.jumlah || 0)))
      const saldo = baseSaldo + tambahan
      const potong = Math.max(0, Math.round(Number(dk.potongan || 0)))
      const tambahanKet = hutangTambahanMap[Number(dk.userId)]?.deskripsi
      const tambahanText = tambahan > 0 ? `${formatCurrency(tambahan)}` : ''
      const keteranganBase = tambahanKet ? String(tambahanKet) : (dk.keterangan || '')
      return {
        userId: Number(dk.userId),
        name: dk.user?.name || '-',
        tanggal: tgl,
        saldo,
        potong,
        sisa: Math.max(0, saldo - potong),
        keterangan: tambahan > 0 ? `${keteranganBase} (${tambahanText})` : keteranganBase,
      }
    })
    return rows.sort((a, b) => String(a.name).localeCompare(String(b.name)))
  }, [detailKaryawan, endDate, hutangSaldoMap, hutangTambahanMap])

  const fetchHutangRows = async () => {
    if (!kebunId || !startDate || !endDate) {
      toast.error('Pilih kebun dan periode terlebih dahulu');
      return;
    }
    try {
      const params = new URLSearchParams({
        kebunId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });
      const res = await fetch(`/api/karyawan-kebun?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Gagal mengambil data hutang');
      const json = await res.json();
      const list = Array.isArray(json.data) ? json.data : [];
      const tgl = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: '2-digit' }).format(endDate);
      const mapped = list.map((r: any) => ({
        name: r.karyawan?.name || '-',
        tanggal: tgl,
        saldo: Math.round(Number(r.totalPengeluaran || 0)),
        potong: Math.round(Number(r.totalPembayaran || 0)),
        sisa: Math.max(0, Math.round(Number(r.hutangSaldo || 0))),
        keterangan: '',
      }));
      setHutangRows(mapped);
      if (mapped.length === 0) toast.error('Tidak ada data hutang pada periode ini');
    } catch {
      toast.error('Gagal memuat daftar hutang');
    }
  };

  const exportHutangPdf = async () => {
    if (!kebunId || !startDate || !endDate) {
      toast.error('Pilih kebun dan periode terlebih dahulu');
      return;
    }
    if (hutangDisplayRows.length === 0) {
      toast.error('Daftar hutang kosong');
      return;
    }
    try {
      const jsPDF = (await import('jspdf')).default;
      const autoTable = (await import('jspdf-autotable')).default;
      const doc = new jsPDF();
      const start = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric' }).format(startDate);
      const end = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric' }).format(endDate);
      const monthLabel = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', month: 'long', year: 'numeric' }).format(endDate);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(`DAFTAR HUTANG PERIODE  TGL ${start} s/d ${end} - ${monthLabel}`, 14, 20);
      const body = hutangDisplayRows.map((r, idx) => [
        String(idx + 1),
        r.name,
        r.tanggal,
        `RP. ${r.saldo.toLocaleString('id-ID')}`,
        `RP. ${r.potong.toLocaleString('id-ID')}`,
        `RP. ${r.sisa.toLocaleString('id-ID')}`,
        r.keterangan || '',
      ]);
      autoTable(doc, {
        head: [['NO', 'NAMA', 'TANGGAL', 'SALDO', 'POTONG', 'SISA', 'KETERANGAN']],
        body,
        startY: 28,
        theme: 'grid',
        headStyles: { fillColor: [0, 0, 0] },
        styles: { fontSize: 10 },
      });
      const totals = hutangDisplayRows.reduce(
        (acc, r) => {
          acc.saldo += r.saldo;
          acc.potong += r.potong;
          acc.sisa += r.sisa;
          return acc;
        },
        { saldo: 0, potong: 0, sisa: 0 }
      );
      const finalY = (doc as any).lastAutoTable.finalY || 28;
      autoTable(doc, {
        head: [['', 'JUMLAH', '', `RP. ${totals.saldo.toLocaleString('id-ID')}`, `RP. ${totals.potong.toLocaleString('id-ID')}`, `RP. ${totals.sisa.toLocaleString('id-ID')}`, '']],
        body: [],
        startY: finalY + 2,
        theme: 'grid',
        styles: { fontSize: 10 },
      });
      doc.save(`daftar-hutang-kebun-${kebunId}-${format(startDate!, 'yyyy-MM-dd')}-${format(endDate!, 'yyyy-MM-dd')}.pdf`);
    } catch {
      toast.error('Gagal ekspor PDF hutang');
    }
  };

  const removePotongan = (id: string) => {
    setSavedPotongan(prev => prev.filter(item => item.id !== id));
  };

  const handlePotonganChange = (id: string, field: keyof Omit<Potongan, 'id'>, value: string | number) => {
    setSavedPotongan(prev =>
      prev.map(item => {
        if (item.id === id) {
          return { ...item, [field]: value };
        }
        return item;
      })
    );
  };

  const handleBiayaLainChange = (id: string, field: keyof Omit<BiayaLain, 'id' | 'total'>, value: string | number) => {
    setSavedBiaya(prev =>
      prev.map(item => {
        if (item.id === id) {
          const updatedItem = { ...item, [field]: value };
          return updatedItem;
        }
        return item;
      })
    );
    if (field === 'deskripsi' || field === 'jumlah' || field === 'hargaSatuan') {
      setBiayaFieldErrors((prev) => {
        const current = prev[id]
        if (!current) return prev
        const nextRow = { ...current }
        if (field === 'deskripsi') nextRow.deskripsi = !String(value || '').trim()
        if (field === 'jumlah') nextRow.jumlah = Number(value || 0) <= 0
        if (field === 'hargaSatuan') nextRow.hargaSatuan = Number(value || 0) <= 0
        const hasAny = !!(nextRow.deskripsi || nextRow.jumlah || nextRow.hargaSatuan)
        if (!hasAny) {
          const { [id]: _removed, ...rest } = prev
          return rest
        }
        return { ...prev, [id]: nextRow }
      })
    }
  };

  const totalGajian = useMemo(() => {
    const totalBiayaLain = savedBiaya.reduce((sum, item) => sum + Math.round(Number(item.jumlah || 0) * Number(item.hargaSatuan || 0)), 0);
    const potonganManual = manualPotonganRows.reduce((sum, item) => sum + Number(item.total || 0), 0)
    const potonganHutang = detailKaryawan.reduce((sum: number, d: any) => sum + Number(d?.potongan || 0), 0)
    const totalPotongan = potonganManual + potonganHutang
    return totalBiayaLain - totalPotongan;
  }, [savedBiaya, manualPotonganRows, detailKaryawan]);

  const totalBiayaGaji = useMemo(() => {
    return savedBiaya.reduce((sum, item) => sum + Math.round(Number(item.jumlah || 0) * Number(item.hargaSatuan || 0)), 0)
  }, [savedBiaya])

  const totalPotonganAll = useMemo(() => {
    const potonganManual = manualPotonganRows.reduce((sum, item) => sum + Number(item.total || 0), 0)
    const potonganHutang = detailKaryawan.reduce((sum: number, d: any) => sum + Number(d?.potongan || 0), 0)
    return potonganManual + potonganHutang
  }, [detailKaryawan, manualPotonganRows])

  const summaryData = useMemo(() => {
    const initial = {
      totalBerat: 0,
      totalNota: 0,
      totalHari: 0,
    };

    const summary = notasToProcess.reduce(
      (acc, nota) => {
        acc.totalBerat += nota.beratAkhir;
        acc.totalNota += 1;
        return acc;
      },
      initial
    );

    if (startDate && endDate) {
      const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
      const dayDifference = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      summary.totalHari = dayDifference >= 0 ? dayDifference + 1 : 0;
    }

    return summary;
  }, [notasToProcess, startDate, endDate]);

  useEffect(() => {
    const totalKg = notasToProcess.reduce((sum, nota) => sum + (Number(nota.beratAkhir) || 0), 0)
    setSavedBiaya((prev) => {
      let next = [...prev];
      let hasChanges = false;

      // 1. Sync existing auto-kg items
      next = next.map(item => {
        if (item.isAutoKg) {
          const nextTotal = Math.round((Number(totalKg) || 0) * (Number(item.hargaSatuan) || 0));
          if (item.jumlah !== totalKg || item.total !== nextTotal) {
            hasChanges = true;
            return { ...item, jumlah: totalKg, total: nextTotal };
          }
        }
        return item;
      });

      return hasChanges ? next : prev;
    })
  }, [notasToProcess])



  const handleRemoveFromProcess = useCallback((notaId: number) => {
    const removedNota = notasToProcess.find(nota => nota.id === notaId);
    if (removedNota) {
      // Find the original full nota object from the initial fetch if available,
      // otherwise, use the potentially partial data from notasToProcess.
      // This assumes notasToProcess holds objects that are compatible with NotaSawitWithRelations.
      const notaToAddBack = notas.find(n => n.id === notaId) || removedNota as NotaSawitWithRelations;

      setNotasToProcess(prev => prev.filter(nota => nota.id !== notaId));
      setNotas(prev => [...prev, notaToAddBack].sort((a, b) => {
        const aKey = new Date((a as any).tanggalBongkar || a.createdAt).getTime()
        const bKey = new Date((b as any).tanggalBongkar || b.createdAt).getTime()
        return bKey - aKey
      }));
    }
  }, [notas, notasToProcess]);

  const handleKeteranganChange = useCallback((id: number, val: string) => {
    setNotasToProcess((prev) =>
      prev.map((nota) =>
        nota.id === id ? { ...nota, keterangan: val } : nota
      )
    );
  }, []);

  const columns = useMemo(() => createColumns(), []);
  const processingColumns = useMemo(() => createProcessingColumns(handleRemoveFromProcess, handleKeteranganChange), [handleRemoveFromProcess, handleKeteranganChange]);

  const draftConflict = useMemo(() => {
    if (editingGajianId) return null
    if (!kebunId || !startDate || !endDate) return null
    const kebunIdNum = Number(kebunId)
    if (!Number.isFinite(kebunIdNum)) return null
    const startKey = formatWIBDateForInput(startDate)
    const endKey = formatWIBDateForInput(endDate)
    return (draftsGajian || []).find((d: any) => {
      const sameKebun = Number(d?.kebunId) === kebunIdNum
      if (!sameKebun) return false
      const dStart = formatWIBDateForInput(new Date(d.tanggalMulai))
      const dEnd = formatWIBDateForInput(new Date(d.tanggalSelesai))
      return dStart === startKey && dEnd === endKey
    }) || null
  }, [draftsGajian, editingGajianId, endDate, kebunId, startDate])

  const hasDraftConflict = !!draftConflict

  const canSearchNota = !!kebunId && !!startDate && !!endDate && !loading
  const canProcessNota = selectedNotas.length > 0 && !loading
  const canSaveGajian = !!kebunId && !!startDate && !!endDate && !loading && (notasToProcess.length > 0 || savedBiaya.length > 0 || manualPotonganRows.length > 0 || detailKaryawan.length > 0)

  return (
    <div className="space-y-8">
      {/* Section for Creating New Gajian */}
      <div className="bg-white p-4 md:p-6 rounded-lg shadow-md">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-3">
          <div className="w-full flex flex-col gap-1">
            <h2 className="text-lg md:text-xl font-semibold flex items-center gap-2">
              <BanknotesIcon className="h-5 w-5 text-blue-600" />
              {editingGajianId ? 'Edit Gajian Draft' : 'Buat Gajian Baru'}
            </h2>
            <div className="hidden md:flex items-center gap-2 text-xs text-gray-500">
              <StarIcon className="h-4 w-4 text-red-600" />
              <span>Pilih kebun dan periode gajian terlebih dahulu sebelum mengambil nota.</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {editingGajianId && (
              <Button
                onClick={(e) => { e.stopPropagation(); handleRefreshDraftData(); }}
                variant="outline"
                disabled={refreshingData || loading || boronganLoading}
                className="w-full md:w-auto h-9 md:h-10 px-3 md:px-4 text-sm md:text-base whitespace-nowrap"
              >
                {refreshingData ? 'Memperbarui...' : 'Perbarui Data'}
              </Button>
            )}
          </div>
        </div>
        
        <div className="transition-all duration-300 overflow-hidden opacity-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start md:items-end mb-6">
            <div className="lg:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">1. Pilih Kebun</label>
              <Select onValueChange={id => {
                setKebunId(id);
              }} value={kebunId}>
                <SelectTrigger className="input-style rounded-xl"><SelectValue placeholder="Pilih Kebun">{kebunId ? kebunList.find(k => String(k.id) === kebunId)?.name : "Pilih Kebun"}</SelectValue></SelectTrigger>
                <SelectContent>
                  {kebunList.map(kebun => <SelectItem key={kebun.id} value={String(kebun.id)}>{kebun.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="lg:col-span-2 w-full">
              <label className="block text-sm font-medium text-gray-700 mb-1">2. Pilih Periode</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
                <Input 
                  className="input-style rounded-xl w-full min-w-0" 
                  type="date" 
                  value={startDate ? formatWIBDateForInput(startDate) : ''}
                  onChange={(e) => setStartDate(parseWIBDateFromInput(e.target.value))} 
                />
                <Input 
                  className="input-style rounded-xl w-full min-w-0" 
                  type="date" 
                  value={endDate ? formatWIBDateForInput(endDate) : ''}
                  onChange={(e) => setEndDate(parseWIBDateFromInput(e.target.value, true))} 
                />
              </div>
            </div>
            <Button
              onClick={() => handleFetchNotas()}
              disabled={!canSearchNota || hasDraftConflict}
              className={cn(
                'w-full rounded-xl lg:col-span-1 h-auto min-h-[40px] px-3 py-2 text-sm md:text-base whitespace-normal break-words border',
                canSearchNota && !hasDraftConflict
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                  : 'border-gray-300 bg-gray-50 text-gray-400'
              )}
            >
              {loading ? 'Mencari...' : '3. Cari Nota'}
            </Button>
          </div>
          <div className="md:hidden flex items-center gap-2 text-xs text-gray-500 mb-4">
            <StarIcon className="h-4 w-4 text-red-600" />
            <span>Pilih kebun dan periode gajian terlebih dahulu sebelum mengambil nota.</span>
          </div>
          {hasDraftConflict && (
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
              <div className="text-sm font-semibold text-amber-900">Draft gajian untuk periode ini sudah ada.</div>
              <div className="text-xs text-amber-800 mt-1">
                Hapus draft terlebih dahulu atau lanjutkan draft yang sudah ada.
              </div>
              <div className="mt-3 flex flex-col sm:flex-row gap-2">
                <Button
                  onClick={() => draftConflict && handleContinueDraft(draftConflict.id)}
                  className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  Lanjutkan Draft
                </Button>
                <Button
                  variant="outline"
                  onClick={() => draftConflict && handleOpenDraftDeleteConfirm(draftConflict.id)}
                  className="rounded-full border-emerald-300 text-emerald-900 hover:bg-emerald-50"
                >
                  Hapus Draft
                </Button>
              </div>
            </div>
          )}
        </div>

        {searchAttempted && notas.length === 0 && (
          <div className="mt-6 text-center text-gray-500">
            <p>Tidak ada nota yang ditemukan untuk kebun dan periode yang dipilih.</p>
          </div>
        )}

        {notas.length > 0 && (
          <div className="mt-6" ref={notasSectionRef}>
            <h3 className="text-base md:text-lg font-semibold mb-4 flex items-center gap-2">
              <ClipboardDocumentListIcon className="h-5 w-5 text-indigo-600" />
              4. Pilih Nota Yang Akan Digaji
            </h3>
            <div className="md:hidden space-y-3">
              {notas.map((nota, index) => {
                const isPaid = String((nota as any)?.statusGajian || '').toUpperCase() === 'DIPROSES'
                const isSelected = !!(rowSelection as any)[index];
                return (
                  <div
                    key={`nota-card-${nota.id}`}
                    onClick={() => {
                      if (isPaid) return
                      setRowSelection((prev: any) => {
                        const next = { ...prev };
                        if (next[index]) delete next[index];
                        else next[index] = true;
                        return next;
                      });
                    }}
                    className={`rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-3 transition-colors ${isSelected ? 'ring-2 ring-emerald-500' : 'hover:bg-gray-50/50'} ${isPaid ? 'opacity-90' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="font-semibold text-gray-900">{nota.kendaraan?.platNomor || '-'}</div>
                        {isPaid ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[10px] font-semibold">
                            Sudah Digaji
                          </span>
                        ) : null}
                        <div className="text-xs text-gray-500">{nota.supir?.name || '-'}</div>
                        <div className="text-xs text-gray-500">{nota.timbangan?.kebun?.name || nota.kebun?.name || '-'}</div>
                      </div>
                      <div onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          disabled={isPaid}
                          onCheckedChange={(v) => {
                            setRowSelection((prev: any) => {
                              const next = { ...prev };
                              if (v) next[index] = true;
                              else delete next[index];
                              return next;
                            });
                          }}
                          aria-label="Pilih nota"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <div className="text-gray-400">Tanggal Bongkar</div>
                        <div className="font-medium text-gray-800">{nota.tanggalBongkar ? formatDate(new Date(nota.tanggalBongkar)) : '-'}</div>
                      </div>
                      <div>
                        <div className="text-gray-400">Netto (Kg)</div>
                        <div className="font-semibold text-gray-900">
                          {typeof getNotaNetto(nota) === 'number' ? formatNumber(getNotaNetto(nota) as number) : '-'}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-400">Potongan</div>
                        <div className="font-semibold text-red-600">{formatNumber(nota.potongan || 0)}</div>
                      </div>
                      <div>
                        <div className="text-gray-400">Berat Akhir</div>
                        <div className="font-semibold text-gray-900">{formatNumber(nota.beratAkhir || 0)}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-700">Jumlah Netto</span>
                  <span className="font-semibold text-gray-900">{formatNumber(notas.reduce((sum, n) => sum + (Number(getNotaNetto(n)) || 0), 0))} Kg</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="font-semibold text-red-600">Jumlah Potongan</span>
                  <span className="font-semibold text-red-600">{formatNumber(notas.reduce((sum, n) => sum + (Number(n.potongan) || 0), 0))} Kg</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="font-semibold text-gray-700">Jumlah Berat Akhir</span>
                  <span className="font-semibold text-gray-900">{formatNumber(notas.reduce((sum, n) => sum + (Number(n.beratAkhir) || 0), 0))} Kg</span>
                </div>
              </div>
            </div>

            <div className="hidden md:block">
              <DataTable columns={columns} data={notas} rowSelection={rowSelection} setRowSelection={setRowSelection} />
            </div>
            <div className="mt-4 text-xs md:text-sm text-gray-700">
              Total nota ditemukan: {totalNotas} • Ditampilkan: {notas.length}
              {totalNotas > notas.length ? ` (dibatasi ${notaFetchLimit} data)` : ''}
            </div>
            <div className="flex flex-col md:flex-row justify-end mt-6 gap-4">
              {Object.keys(rowSelection).length > 0 && (
                <Button onClick={() => setRowSelection({})} variant="secondary" className="w-full md:w-auto h-auto min-h-[40px] px-3 py-2 text-sm md:text-base whitespace-normal break-words">
                  Batalkan Pilihan ({Object.keys(rowSelection).length})
                </Button>
              )}
              <Button
                onClick={handleMoveToProcess}
                disabled={!canProcessNota}
                className={cn(
                  'w-full md:w-auto h-auto min-h-[40px] px-3 py-2 text-sm md:text-base whitespace-normal break-words border rounded-xl',
                  canProcessNota
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                    : 'border-gray-300 bg-gray-50 text-gray-400'
                )}
              >
                5. Proses Nota Terpilih <ArrowRightIcon className="ml-2 h-4 w-4 flex-shrink-0" />
              </Button>
            </div>

            {notasToProcess.length === 0 && detailKaryawan.length === 0 && savedBiaya.length === 0 && manualPotonganRows.length === 0 && (
              <div className="mt-6 rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-4 text-sm text-gray-600">
                Rincian gajian akan muncul setelah nota dipilih dan diproses.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Section for Processing Gajian */}
      {(notasToProcess.length > 0 || detailKaryawan.length > 0 || savedBiaya.length > 0 || manualPotonganRows.length > 0) && (
        <div className="bg-white p-4 md:p-6 rounded-lg shadow-md">
          <h2 className="text-lg md:text-xl font-semibold mb-4 flex items-center gap-2">
            <BanknotesIcon className="h-5 w-5 text-emerald-600" />
            5. Rincian Gajian
          </h2>
          
          {notasToProcess.length > 0 && (
            <div className="mb-6">
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                      <ClipboardDocumentListIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Ringkasan Proses Gajian</p>
                      <p className="text-xs text-gray-500">Total tonase, hari, dan jumlah nota</p>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    Periode: <span className="font-semibold text-gray-900">{startDate && endDate ? `${formatDate(startDate)} - ${formatDate(endDate)}` : '-'}</span>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-xl bg-emerald-50/60 px-3 py-2">
                    <p className="text-xs text-emerald-700">Total Tonase (Netto)</p>
                    <p className="text-lg font-semibold text-gray-900">{formatNumber(summaryData.totalBerat)} Kg</p>
                  </div>
                  <div className="rounded-xl bg-amber-50/70 px-3 py-2">
                    <p className="text-xs text-amber-700">Total Hari</p>
                    <p className="text-lg font-semibold text-gray-900">{summaryData.totalHari}</p>
                  </div>
                  <div className="rounded-xl bg-sky-50/70 px-3 py-2">
                    <p className="text-xs text-sky-700">Jumlah Nota</p>
                    <p className="text-lg font-semibold text-gray-900">{summaryData.totalNota}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {notasToProcess.length > 0 && (
            <>
              <div className="md:hidden space-y-3">
                {notasToProcess.map((nota) => (
                  <div key={`process-${nota.id}`} className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="font-semibold text-gray-900">{nota.kendaraan?.platNomor || '-'}</div>
                        <div className="text-xs text-gray-500">{nota.supir?.name || '-'}</div>
                        <div className="text-xs text-gray-500">{nota.timbangan?.kebun?.name || nota.kebun?.name || '-'}</div>
                      </div>
                      <Button
                        variant="ghost"
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                        onClick={() => handleRemoveFromProcess(nota.id)}
                      >
                        <span className="sr-only">Hapus Nota</span>
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <div className="text-gray-400">Tanggal Bongkar</div>
                        <div className="font-medium text-gray-800">{nota.tanggalBongkar ? formatDate(new Date(nota.tanggalBongkar)) : '-'}</div>
                      </div>
                      <div>
                        <div className="text-gray-400">Berat Akhir</div>
                        <div className="font-semibold text-gray-900">{formatNumber(nota.beratAkhir || 0)} Kg</div>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Keterangan</div>
                      <Input
                        value={nota.keterangan || ''}
                        onChange={(e) => handleKeteranganChange(nota.id, e.target.value)}
                        placeholder="Keterangan..."
                        className="h-9"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden md:block">
                <DataTable columns={processingColumns} data={notasToProcess} rowSelection={{}} setRowSelection={() => {}} />
              </div>
            </>
          )}
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <div className="mb-2">
                <div className="flex items-start justify-between gap-3 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <div className="flex items-start gap-2 shrink-0">
                    <BanknotesIcon className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
                    <h3 className="text-base md:text-lg font-semibold leading-tight text-gray-900">
                      Biaya Gaji
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 flex-nowrap shrink-0">
                    <Button
                      variant="outline"
                      onClick={importUpahBorongan}
                      disabled={!kebunId || !startDate || !endDate || boronganLoading}
                      className="h-10 px-4 rounded-full border-red-500 text-red-700 bg-white hover:bg-red-50 text-xs sm:text-sm whitespace-nowrap inline-flex items-center justify-center shrink-0 w-[160px]"
                    >
                      {boronganLoading ? 'Memuat...' : 'Tarik Biaya Kebun'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={addBiayaLain}
                      className="h-10 px-4 rounded-full border-emerald-600 text-emerald-700 bg-white hover:bg-emerald-50 text-xs sm:text-sm whitespace-nowrap inline-flex items-center justify-center shrink-0 w-[160px]"
                    >
                      <span className="sm:hidden">Tambah Biaya</span>
                      <span className="hidden sm:inline">+ Tambah Biaya Gaji</span>
                    </Button>
                  </div>
                </div>
                <div className="mt-1 pl-7 text-xs text-gray-500">
                  <span>Periode:</span>{' '}
                  <span className="font-semibold text-gray-900">{startDate ? formatDate(startDate) : '-'}</span>{' '}
                  <span className="text-gray-400">-</span>{' '}
                  <span className="font-semibold text-gray-900">{endDate ? formatDate(endDate) : '-'}</span>
                </div>
              </div>
            <div className="space-y-4">
              {savedBiaya.length === 0 && (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-4 text-sm text-gray-500">
                  Tambahkan biaya gaji untuk menambah total gajian.
                </div>
              )}
              {savedBiaya.map((item) => (
                <div
                  key={item.id}
                  data-biaya-row={item.id}
                  className={cn(
                    "rounded-2xl border bg-white p-4 space-y-3",
                    biayaFieldErrors[item.id] ? "border-red-300 ring-2 ring-red-200" : "border-gray-100"
                  )}
                >
                  {editingBiayaId === item.id ? (
                    <>
                      <Input
                        placeholder="Deskripsi"
                        value={item.deskripsi}
                        onChange={(e) => handleBiayaLainChange(item.id, 'deskripsi', e.target.value)}
                        data-biaya-id={item.id}
                        data-biaya-field="deskripsi"
                        className={cn(
                          "h-10 rounded-full",
                          biayaFieldErrors[item.id]?.deskripsi ? "border-red-500 ring-2 ring-red-500/20" : ""
                        )}
                      />
                      <Input
                        placeholder="Keterangan (opsional)"
                        value={item.keterangan || ''}
                        onChange={(e) => handleBiayaLainChange(item.id, 'keterangan', e.target.value)}
                        className="h-10 rounded-full"
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <Input
                          type="number"
                          step="any"
                          placeholder="Jumlah"
                          value={item.jumlah || ''}
                          onChange={(e) => {
                            const val = e.target.value
                            const numericValue = val ? parseFloat(val) : 0
                            handleBiayaLainChange(item.id, 'jumlah', numericValue)
                          }}
                          data-biaya-id={item.id}
                          data-biaya-field="jumlah"
                          className={cn(
                            "h-10 rounded-full text-right",
                            biayaFieldErrors[item.id]?.jumlah ? "border-red-500 ring-2 ring-red-500/20" : ""
                          )}
                        />
                        <Input
                          placeholder="Satuan"
                          value={item.satuan}
                          onChange={(e) => handleBiayaLainChange(item.id, 'satuan', e.target.value)}
                          className="h-10 rounded-full"
                        />
                        <Input
                          type="text"
                          inputMode="numeric"
                          placeholder="Harga Satuan"
                          value={item.hargaSatuan ? formatNumber(item.hargaSatuan) : ''}
                          onChange={(e) => {
                            const digits = e.target.value.replace(/\D/g, '')
                            const numericValue = digits ? Number(digits) : 0
                            handleBiayaLainChange(item.id, 'hargaSatuan', numericValue)
                          }}
                          data-biaya-id={item.id}
                          data-biaya-field="hargaSatuan"
                          className={cn(
                            "h-10 rounded-full text-right",
                            biayaFieldErrors[item.id]?.hargaSatuan ? "border-red-500 ring-2 ring-red-500/20" : ""
                          )}
                        />
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Total</span>
                        <span className="font-semibold text-gray-900">{formatCurrency(Math.round(item.jumlah * item.hargaSatuan))}</span>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full"
                          onClick={() => setEditingBiayaId(null)}
                        >
                          Simpan
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="rounded-full"
                          onClick={() => {
                            removeSavedBiaya(item.id)
                            setEditingBiayaId(null)
                          }}
                        >
                          Hapus
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-gray-900 break-words">{item.deskripsi || '-'}</div>
                          {cleanBiayaKeterangan(item.keterangan) ? (
                            <div className="text-xs text-gray-500 break-words mt-1">{cleanBiayaKeterangan(item.keterangan)}</div>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 rounded-full text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                            onClick={() => setEditingBiayaId(item.id)}
                          >
                            <PencilSquareIcon className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 rounded-full text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => removeSavedBiaya(item.id)}
                          >
                            <TrashIcon className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="text-xs text-gray-600 flex flex-wrap items-center gap-1">
                        <span className="font-semibold text-gray-900">{formatNumber(Number(item.jumlah || 0), 2)}</span>
                        <span>{String(item.satuan || '').trim()}</span>
                        <span className="text-gray-400">x</span>
                        <span className="font-semibold text-gray-900">{formatCurrency(Number(item.hargaSatuan || 0))}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Total</span>
                        <span className="font-semibold text-gray-900">{formatCurrency(Math.round(item.jumlah * item.hargaSatuan))}</span>
                      </div>
                    </>
                  )}
                </div>
              ))}
              {savedBiaya.length > 0 && (
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-700">Jumlah Biaya</span>
                    <span className="text-lg font-extrabold text-gray-900">{formatCurrency(savedBiaya.reduce((sum, b) => sum + Math.round(b.jumlah * b.hargaSatuan), 0))}</span>
                  </div>
                </div>
              )}
            </div>
            </div>
            <div>
            <div className="mb-2">
              <div className="flex items-start justify-between gap-3 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="flex items-start gap-2 shrink-0">
                  <AdjustmentsHorizontalIcon className="h-5 w-5 text-rose-600 mt-0.5 shrink-0" />
                  <h3 className="text-base md:text-lg font-semibold leading-tight text-gray-900">
                    Potongan
                  </h3>
                </div>
                <div className="flex items-center gap-2 flex-nowrap shrink-0">
                  <Button
                    variant="outline"
                    onClick={importPotonganPengajuan}
                    disabled={!kebunId || !startDate || !endDate || importPotonganLoading}
                    className="h-10 px-4 rounded-full border-red-500 text-red-700 bg-white hover:bg-red-50 text-xs sm:text-sm whitespace-nowrap inline-flex items-center justify-center shrink-0 w-[160px]"
                  >
                    {importPotonganLoading ? (
                      'Memuat...'
                    ) : (
                      <>
                        <span className="sm:hidden">Tarik</span>
                        <span className="hidden sm:inline">Tarik Potongan</span>
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={addPotongan}
                    className="h-10 px-4 rounded-full border-emerald-600 text-emerald-700 bg-white hover:bg-emerald-50 text-xs sm:text-sm whitespace-nowrap inline-flex items-center justify-center shrink-0 w-[160px]"
                  >
                    <span className="sm:hidden">Tambah</span>
                    <span className="hidden sm:inline">+ Tambah Potongan</span>
                  </Button>
                </div>
              </div>
              <div className="mt-1 pl-7 text-xs text-gray-500">
                <span>Periode:</span>{' '}
                <span className="font-semibold text-gray-900">{startDate ? formatDate(startDate) : '-'}</span>{' '}
                <span className="text-gray-400">-</span>{' '}
                <span className="font-semibold text-gray-900">{endDate ? formatDate(endDate) : '-'}</span>
              </div>
            </div>
            <div className="space-y-4">
              {manualPotonganRows.length === 0 && (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-4 text-sm text-gray-500">
                  Tambahkan potongan lain (di luar potongan hutang) untuk mengurangi total gaji.
                </div>
              )}
              {manualPotonganRows.map((item) => (
                <div key={item.id} className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
                  {editingPotonganId === item.id ? (
                    <>
                      <Input
                        placeholder="Deskripsi"
                        value={item.deskripsi}
                        onChange={(e) => handlePotonganChange(item.id, 'deskripsi', e.target.value)}
                        className="h-10 rounded-full"
                      />
                      <Input
                        placeholder="Keterangan (opsional)"
                        value={item.keterangan || ''}
                        onChange={(e) => handlePotonganChange(item.id, 'keterangan', e.target.value)}
                        className="h-10 rounded-full"
                      />
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="Total"
                        value={item.total ? formatNumber(item.total) : ''}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, '')
                          const numericValue = digits ? Number(digits) : 0
                          handlePotonganChange(item.id, 'total', numericValue)
                        }}
                        className="h-10 rounded-full text-right"
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full"
                          onClick={() => setEditingPotonganId(null)}
                        >
                          Simpan
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="rounded-full"
                          onClick={() => {
                            removeSavedPotongan(item.id)
                            setEditingPotonganId(null)
                          }}
                        >
                          Hapus
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-gray-900 break-words">{item.deskripsi || '-'}</div>
                          {item.keterangan ? <div className="text-xs text-gray-500 break-words mt-1">{item.keterangan}</div> : null}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 rounded-full text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                            onClick={() => setEditingPotonganId(item.id)}
                          >
                            <PencilSquareIcon className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 rounded-full text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => removeSavedPotongan(item.id)}
                          >
                            <TrashIcon className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Total</span>
                        <span className="font-semibold text-gray-900">{formatCurrency(Number(item.total || 0))}</span>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
            {manualPotonganRows.length > 0 ? (
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 mt-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-700">Total Potongan</span>
                  <span className="text-lg font-extrabold text-red-600">-{formatCurrency(manualPotonganRows.reduce((sum, p) => sum + (Number(p.total) || 0), 0))}</span>
                </div>
              </div>
            ) : null}
            </div>
          </div>

            <div className="mt-6 p-4 border rounded-lg bg-gray-50">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-3">
                <div className="flex items-start gap-2 min-w-0">
                  <BanknotesIcon className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                  <h4 className="text-base md:text-lg font-semibold leading-tight text-gray-900">
                    Daftar Hutang Karyawan <span className="text-gray-700">(Periode)</span>
                  </h4>
                </div>
                <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:flex-wrap sm:justify-end sm:w-auto">
                  <Button
                    variant="outline"
                    onClick={() => setOpenPotongHutangMassal(true)}
                    disabled={!kebunId || !startDate || !endDate || detailKaryawan.length === 0 || hutangLoading}
                    className="border border-gray-300 bg-white hover:bg-gray-50 text-gray-900 w-full sm:w-auto h-10 px-3 text-xs sm:text-sm whitespace-nowrap inline-flex items-center justify-center"
                  >
                    {hutangLoading ? (
                      'Memuat...'
                    ) : (
                      <>
                        <span className="sm:hidden">Potong Hutang</span>
                        <span className="hidden sm:inline">Potong Hutang Massal</span>
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={resetPotonganHutang}
                    disabled={detailKaryawan.length === 0 || detailKaryawan.every(d => Number(d.potongan || 0) === 0)}
                    className="border border-gray-300 bg-white hover:bg-gray-50 text-gray-900 w-full sm:w-auto h-10 px-3 text-xs sm:text-sm whitespace-nowrap inline-flex items-center justify-center"
                  >
                    <span className="sm:hidden">Reset</span>
                    <span className="hidden sm:inline">Reset Potongan</span>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleOpenTambahHutang()}
                    disabled={detailKaryawan.length === 0 || hutangLoading}
                    className="border border-emerald-600 bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto h-10 px-3 text-xs sm:text-sm whitespace-nowrap inline-flex items-center justify-center"
                  >
                    <span className="sm:hidden">+ Hutang</span>
                    <span className="hidden sm:inline">+ Tambah Hutang</span>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={resetHutangBaru}
                    disabled={Object.keys(hutangTambahanMap).length === 0}
                    className="border border-red-200 bg-white hover:bg-red-50 text-red-700 w-full sm:w-auto h-10 px-3 text-xs sm:text-sm whitespace-nowrap inline-flex items-center justify-center"
                  >
                    <span className="sm:hidden">Reset Hutang</span>
                    <span className="hidden sm:inline">Reset Hutang Baru</span>
                  </Button>
                </div>
              </div>
              {hutangDisplayRows.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-4 text-sm text-gray-500">
                  Tidak ada data karyawan untuk ditampilkan.
                </div>
              ) : (
                <>
                  <div className="md:hidden space-y-3">
                    {hutangDisplayRows.map((r, idx) => (
                      <div key={`hutang-${idx}`} className="rounded-2xl border border-gray-100 bg-white p-4 space-y-2">
                        <div className="font-semibold text-gray-900">{r.name}</div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <div className="text-gray-400">Tanggal</div>
                            <div className="font-medium text-gray-800">{r.tanggal}</div>
                          </div>
                          <div>
                            <div className="text-gray-400">Saldo</div>
                            <div className="font-semibold text-gray-900">Rp {r.saldo.toLocaleString('id-ID')}</div>
                          </div>
                          <div>
                            <div className="text-gray-400">Potong</div>
                            <Input
                              type="text"
                              inputMode="numeric"
                              value={formatNumber(r.potong || 0)}
                              onChange={(e) => updatePotonganHutangByUserId(Number(r.userId), e.target.value)}
                              className="h-9 mt-1 text-right"
                              placeholder="0"
                            />
                          </div>
                          <div>
                            <div className="text-gray-400">Sisa</div>
                            <div className="font-semibold text-emerald-700">Rp {r.sisa.toLocaleString('id-ID')}</div>
                          </div>
                        </div>
                        <div className="text-xs text-gray-500">{r.keterangan || '-'}</div>
                      </div>
                    ))}
                    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-gray-700">Jumlah Saldo</span>
                        <span className="font-semibold text-gray-900">Rp {hutangDisplayRows.reduce((a, r) => a + r.saldo, 0).toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="font-semibold text-red-600">Total Potong</span>
                        <span className="font-semibold text-red-600">Rp {hutangDisplayRows.reduce((a, r) => a + r.potong, 0).toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="font-semibold text-emerald-700">Total Sisa</span>
                        <span className="font-semibold text-emerald-700">Rp {hutangDisplayRows.reduce((a, r) => a + r.sisa, 0).toLocaleString('id-ID')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="hidden md:block overflow-x-auto">
                    <table className="min-w-full text-xs md:text-sm border">
                    <thead>
                      <tr className="border">
                        <th className="p-2 border">NO</th>
                        <th className="p-2 border">NAMA</th>
                        <th className="p-2 border">TANGGAL</th>
                        <th className="p-2 border">SALDO</th>
                        <th className="p-2 border">POTONG</th>
                        <th className="p-2 border">SISA</th>
                        <th className="p-2 border">KETERANGAN</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hutangDisplayRows.map((r, idx) => (
                        <tr key={idx} className="border">
                          <td className="p-2 border">{idx + 1}</td>
                          <td className="p-2 border">{r.name}</td>
                          <td className="p-2 border">{r.tanggal}</td>
                          <td className="p-2 border text-right">RP. {r.saldo.toLocaleString('id-ID')}</td>
                          <td className="p-2 border">
                            <Input
                              type="text"
                              inputMode="numeric"
                              value={formatNumber(r.potong || 0)}
                              onChange={(e) => updatePotonganHutangByUserId(Number(r.userId), e.target.value)}
                              className="w-32 ml-auto text-right"
                              placeholder="0"
                            />
                          </td>
                          <td className="p-2 border text-right">RP. {r.sisa.toLocaleString('id-ID')}</td>
                          <td className="p-2 border">{r.keterangan}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border font-bold">
                        <td className="p-2 border" colSpan={2}></td>
                        <td className="p-2 border text-center">JUMLAH</td>
                        <td className="p-2 border text-right">RP. {hutangDisplayRows.reduce((a, r) => a + r.saldo, 0).toLocaleString('id-ID')}</td>
                        <td className="p-2 border text-right">RP. {hutangDisplayRows.reduce((a, r) => a + r.potong, 0).toLocaleString('id-ID')}</td>
                        <td className="p-2 border text-right">RP. {hutangDisplayRows.reduce((a, r) => a + r.sisa, 0).toLocaleString('id-ID')}</td>
                        <td className="p-2 border"></td>
                      </tr>
                    </tfoot>
                  </table>
                  </div>
                </>
              )}
            </div>
          {/* Employee Detail Table */}
          {detailKaryawan.length > 0 && (
            <div className="mb-6 mt-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                <h3 className="text-base md:text-lg font-semibold flex items-center gap-2">
                  <UserIcon className="h-5 w-5 text-gray-700" />
                  Detail Gaji Karyawan
                </h3>
              </div>
              <div className="md:hidden space-y-3">
                {detailKaryawan.map((dk, idx) => (
                  <div key={`detail-karyawan-${idx}`} className="rounded-2xl border border-gray-100 bg-white p-4 space-y-2">
                    <div className="font-semibold text-gray-900">{dk.user?.name || '-'}</div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <div className="text-gray-400">Hari Kerja</div>
                        <div className="font-medium text-gray-800">{dk.hariKerja}</div>
                      </div>
                      <div>
                        <div className="text-gray-400">Gaji Pokok</div>
                        <div className="font-semibold text-gray-900">{formatCurrency(dk.gajiPokok)}</div>
                      </div>
                      <div>
                        <div className="text-gray-400">Potongan</div>
                        <div className="font-semibold text-red-600">-{formatCurrency(Number((dk as any).potongan || 0))}</div>
                      </div>
                      <div>
                        <div className="text-gray-400">Total Terima</div>
                        <div className="font-semibold text-emerald-700">{formatCurrency(dk.total)}</div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">{dk.keterangan || '-'}</div>
                  </div>
                ))}
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-700">Total</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(detailKaryawan.reduce((acc, curr) => acc + (curr.gajiPokok || 0), 0))}</span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="font-semibold text-emerald-700">Total Terima</span>
                    <span className="font-semibold text-emerald-700">{formatCurrency(detailKaryawan.reduce((acc, curr) => acc + (curr.total || 0), 0))}</span>
                  </div>
                </div>
              </div>

              <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-700 font-semibold border-b">
                    <tr>
                      <th className="px-4 py-3">Nama Karyawan</th>
                      <th className="px-4 py-3 text-right">Hari Kerja</th>
                      <th className="px-4 py-3 text-right">Gaji Pokok</th>
                      <th className="px-4 py-3 text-right">Potongan</th>
                      <th className="px-4 py-3 text-right">Total Terima</th>
                      <th className="px-4 py-3">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {detailKaryawan.map((dk, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{dk.user?.name || '-'}</td>
                        <td className="px-4 py-3 text-right">{dk.hariKerja}</td>
                        <td className="px-4 py-3 text-right">{formatCurrency(dk.gajiPokok)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-red-600">-{formatCurrency(Number((dk as any).potongan || 0))}</td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-600">{formatCurrency(dk.total)}</td>
                        <td className="px-4 py-3 text-gray-500">{dk.keterangan || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 font-bold border-t">
                    <tr>
                      <td colSpan={2} className="px-4 py-3 text-right">TOTAL</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(detailKaryawan.reduce((acc, curr) => acc + (curr.gajiPokok || 0), 0))}</td>
                      <td className="px-4 py-3 text-right text-red-600">-{formatCurrency(detailKaryawan.reduce((acc, curr: any) => acc + Number(curr?.potongan || 0), 0))}</td>
                      <td className="px-4 py-3 text-right text-emerald-600">{formatCurrency(detailKaryawan.reduce((acc, curr) => acc + (curr.total || 0), 0))}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
          <div className="mt-6 pt-4 border-t">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Catatan / Keterangan Tambahan</label>
              <Input
                placeholder="Masukkan catatan tambahan untuk gajian ini..."
                value={keterangan}
                onChange={(e) => setKeterangan(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600">
                <div className="flex items-center justify-end gap-3">
                  <span>Biaya Gaji</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(totalBiayaGaji)}</span>
                </div>
                <div className="flex items-center justify-end gap-3 mt-1">
                  <span>Potongan</span>
                  <span className="font-semibold text-red-600">-{formatCurrency(totalPotonganAll)}</span>
                </div>
              </div>
              <div className="text-xl font-bold mt-2">Total Gajian: {formatCurrency(totalBiayaGaji - totalPotonganAll)}</div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-2 mt-6 md:flex md:justify-end md:gap-4">
            <Button
              onClick={() => handleSimpanGajian('DRAFT')}
              variant="outline"
              disabled={!canSaveGajian}
              className={cn(
                'w-full md:w-auto h-auto min-h-[40px] px-2 py-2 text-xs sm:text-sm md:text-base whitespace-normal break-words rounded-xl',
                canSaveGajian ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50' : 'opacity-50'
              )}
            >
              <ArrowDownTrayIcon className="mr-1 sm:mr-2 h-4 w-4 flex-shrink-0" />
              {loading ? 'Menyimpan...' : (editingGajianId ? 'Simpan Perubahan Draft' : 'Simpan sebagai Draft')}
            </Button>
            <Button
              onClick={() => handleSimpanGajian('FINALIZED')}
              disabled={!canSaveGajian}
              className={cn(
                'w-full md:w-auto h-auto min-h-[40px] px-2 py-2 text-xs sm:text-sm md:text-base whitespace-normal break-words rounded-xl',
                canSaveGajian ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-gray-200 text-gray-400'
              )}
            >
              {loading ? 'Menyimpan...' : 'Simpan Gajian'}
            </Button>
          </div>
        </div>
      )}

      {/* Section for Gajian History & Drafts */}
      <div className="bg-white p-4 md:p-6 rounded-lg shadow-md">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-3">
          <div className="flex items-center gap-2 cursor-pointer w-full justify-between" onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}>
            <h2 className="text-lg md:text-xl font-semibold flex items-center gap-2">
              <ClockIcon className="h-5 w-5 text-gray-700" />
              Riwayat & Draft
            </h2>
            <div className="flex items-center gap-2">
              {isHistoryExpanded ? (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-gray-500">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-gray-500">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              )}
            </div>
          </div>
        </div>

        <div className={cn("transition-all duration-300 overflow-hidden", isHistoryExpanded ? "opacity-100" : "max-h-0 opacity-0")}>
          <Tabs defaultValue="drafts" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="history">Riwayat Gajian</TabsTrigger>
              <TabsTrigger value="drafts">Draft Tersimpan ({draftsGajian.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="history">
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Kebun</label>
                    <Select onValueChange={(val) => setHistoryKebunId(val === "all" ? "" : val)} value={historyKebunId || "all"}>
                      <SelectTrigger className="input-style rounded-xl">
                        <SelectValue placeholder="Semua Kebun" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua Kebun</SelectItem>
                        {kebunList.map(kebun => (
                          <SelectItem key={kebun.id} value={String(kebun.id)}>
                            {kebun.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="lg:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Periode</label>
                    <div className="flex gap-2">
                      <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                        <SelectTrigger className="w-full input-style rounded-xl">
                          <SelectValue placeholder="Bulan" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Semua Bulan</SelectItem>
                          {Array.from({ length: 12 }, (_, i) => (
                            <SelectItem key={i} value={String(i)}>
                              {format(new Date(2000, i, 1), 'MMMM', { locale: idLocale })}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={selectedYear} onValueChange={setSelectedYear}>
                        <SelectTrigger className="w-full input-style rounded-xl">
                          <SelectValue placeholder="Tahun" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 5 }, (_, i) => {
                            const year = new Date().getFullYear() - 2 + i;
                            return (
                              <SelectItem key={year} value={String(year)}>
                                {year}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button
                    onClick={handleApplyHistoryFilters}
                    disabled={isHistoryLoading}
                    className="border border-gray-400 bg-gray-50 hover:bg-gray-100 text-black w-full h-auto min-h-[40px] px-3 py-2 text-sm md:text-base whitespace-normal break-words"
                  >
                    {isHistoryLoading ? 'Memuat...' : 'Terapkan Filter'}
                  </Button>
                </div>
                <div className="md:hidden space-y-3">
                  {isHistoryLoading ? (
                    <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center text-sm text-gray-400">
                      Memuat riwayat...
                    </div>
                  ) : gajianHistory.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center text-sm text-gray-500">
                      Belum ada riwayat gajian
                    </div>
                  ) : (
                    sortedGajianHistory.map((g) => (
                      <div key={`history-${g.id}`} className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="font-semibold text-gray-900">{g.kebun?.name || '-'}</div>
                            <div className="text-xs text-gray-500">{formatDate(new Date(g.tanggalMulai))} - {formatDate(new Date(g.tanggalSelesai))}</div>
                          </div>
                          <div className="text-xs text-gray-400">{formatDate(new Date(g.createdAt))}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <div className="text-gray-400">Total Nota</div>
                            <div className="font-semibold text-gray-900">{formatNumber(g.totalNota || 0)}</div>
                          </div>
                          <div>
                            <div className="text-gray-400">Total Berat</div>
                            <div className="font-semibold text-gray-900">{formatNumber(g.totalBerat || 0)} Kg</div>
                          </div>
                          <div>
                            <div className="text-gray-400">Total Gaji</div>
                            <div className="font-semibold text-gray-900">{formatNumber(g.totalBiayaLain || 0)}</div>
                          </div>
                          <div>
                            <div className="text-gray-400">Potongan</div>
                            <div className="font-semibold text-red-600">-{formatNumber(g.totalPotongan || 0)}</div>
                          </div>
                          <div>
                            <div className="text-gray-400">Jumlah Gaji</div>
                            <div className="font-semibold text-emerald-700">{formatNumber(g.totalGaji || 0)}</div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" className="rounded-full" onClick={() => handleOpenDetail(g.id)}>
                            Detail
                          </Button>
                          <Button size="sm" variant="destructive" className="rounded-full" onClick={() => handleOpenConfirm(g.id)}>
                            Hapus
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="hidden md:block">
                  <DataTable
                    columns={historyColumns}
                    data={sortedGajianHistory}
                    isLoading={isHistoryLoading}
                    meta={{ onRowClick: (row: Gajian) => handleOpenDetail(row.id) }}
                  />
                </div>
              </div>
            </TabsContent>
            <TabsContent value="drafts">
              <div className="mt-4">
                <div className="md:hidden space-y-3">
                  {isHistoryLoading ? (
                    <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center text-sm text-gray-400">
                      Memuat draft...
                    </div>
                  ) : draftsGajian.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center text-sm text-gray-500">
                      Tidak ada draft
                    </div>
                  ) : (
                    sortedDraftsGajian.map((g) => (
                      <div key={`draft-${g.id}`} className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="font-semibold text-gray-900">{g.kebun?.name || '-'}</div>
                            <div className="text-xs text-gray-500">{formatDate(new Date(g.tanggalMulai))} - {formatDate(new Date(g.tanggalSelesai))}</div>
                          </div>
                          <div className="text-xs text-gray-400">{formatDate(new Date(g.updatedAt))}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <div className="text-gray-400">Total Nota</div>
                            <div className="font-semibold text-gray-900">{formatNumber(g.totalNota || 0)}</div>
                          </div>
                          <div>
                            <div className="text-gray-400">Total Gaji</div>
                            <div className="font-semibold text-gray-900">{formatNumber(g.totalBiayaLain || 0)}</div>
                          </div>
                          <div>
                            <div className="text-gray-400">Potongan</div>
                            <div className="font-semibold text-red-600">-{formatNumber(g.totalPotongan || 0)}</div>
                          </div>
                          <div>
                            <div className="text-gray-400">Jumlah Gaji</div>
                            <div className="font-semibold text-emerald-700">{formatNumber(g.totalGaji || 0)}</div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleContinueDraft(g.id)}>
                            Lanjutkan
                          </Button>
                          <Button size="sm" variant="outline" className="rounded-full" onClick={() => handleOpenDetail(g.id)}>
                            Detail
                          </Button>
                          <Button size="sm" variant="destructive" className="rounded-full" onClick={() => handleOpenDraftDeleteConfirm(g.id)}>
                            Hapus
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="hidden md:block">
                  <DataTable columns={draftColumns} data={sortedDraftsGajian} isLoading={isHistoryLoading} />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <GajianPageModals
        isConfirmOpen={isConfirmOpen}
        handleCloseConfirm={handleCloseConfirm}
        handleDelete={handleDelete}
        isDraftConfirmOpen={isDraftConfirmOpen}
        handleCloseDraftDeleteConfirm={handleCloseDraftDeleteConfirm}
        handleDeleteDraft={handleDeleteDraft}
        isResetConfirmOpen={isResetConfirmOpen}
        setIsResetConfirmOpen={setIsResetConfirmOpen}
        handleConfirmReset={handleConfirmReset}
        openPotongHutangMassal={openPotongHutangMassal}
        setOpenPotongHutangMassal={setOpenPotongHutangMassal}
        massPotongMax={massPotongMax}
        setMassPotongMax={setMassPotongMax}
        massPotongAmount={massPotongAmount}
        setMassPotongAmount={setMassPotongAmount}
        hutangLoading={hutangLoading}
        applyPotongHutangMassal={applyPotongHutangMassal}
        formatNumber={formatNumber}
        openTambahHutang={openTambahHutang}
        setOpenTambahHutang={setOpenTambahHutang}
        tambahHutangKaryawanId={tambahHutangKaryawanId}
        setTambahHutangKaryawanId={setTambahHutangKaryawanId}
        tambahHutangJumlah={tambahHutangJumlah}
        setTambahHutangJumlah={setTambahHutangJumlah}
        tambahHutangTanggal={tambahHutangTanggal}
        setTambahHutangTanggal={setTambahHutangTanggal}
        tambahHutangDeskripsi={tambahHutangDeskripsi}
        setTambahHutangDeskripsi={setTambahHutangDeskripsi}
        tambahHutangSubmitting={tambahHutangSubmitting}
        handleSubmitTambahHutang={handleSubmitTambahHutang}
        hutangTambahanMap={hutangTambahanMap}
        setHutangTambahanMap={setHutangTambahanMap}
        detailKaryawan={detailKaryawan}
        isDetailOpen={isDetailOpen}
        isPreviewOpen={isPreviewOpen}
        setIsPreviewOpen={setIsPreviewOpen}
        selectedGajian={selectedGajian}
        previewGajian={previewGajian}
        handleCloseDetail={handleCloseDetail}
        handleConfirmSave={handleConfirmSave}
        loading={loading}
        handleApplyHistoryFilters={handleApplyHistoryFilters}
      />
    </div>
  );
}
