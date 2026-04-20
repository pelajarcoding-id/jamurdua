'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { DataTable } from '@/components/data-table'
import { columns, NotaSawitData } from './columns'
import type { ColumnDef } from '@tanstack/react-table'
import toast from 'react-hot-toast'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowDownTrayIcon, CalendarIcon, ClipboardDocumentListIcon, PlusIcon, ArrowPathIcon, BanknotesIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { convertImageFileToWebp } from '@/lib/image-webp';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox'
import { PembayaranTab } from './PembayaranTab'
import { usePembayaranNotaSawit } from './usePembayaranNotaSawit'
import NotaSawitPageModals from './NotaSawitPageModals'
import { useNotaSawitModalsState } from './useNotaSawitModalsState'
import { NotaSawitTabs } from './NotaSawitTabs'
import { NotaSawitSummary } from './NotaSawitSummary'
import { NotaSawitBulkActionsBar } from './NotaSawitBulkActionsBar'
import { NotaSawitToolbar } from './NotaSawitToolbar'

interface SummaryData {
  totalBerat: number;
  totalPembayaran: number;
  totalNota: number;
  lunasCount: number;
  totalPembayaranLunas: number;
  belumLunasCount: number;
  totalPembayaranBelumLunas: number;
  tonaseByKebun?: Array<{ kebunId: number; name: string; totalBerat: number }>;
}

import { useAuth } from '@/components/AuthProvider';

export default function NotaSawitPage() {
  const { role, id: userId } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'nota' | 'pembayaran'>('nota')
  const [data, setData] = useState<NotaSawitData[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalNotas, setTotalNotas] = useState(0);
  const [limit, setLimit] = useState(50);
  const [refreshToggle, setRefreshToggle] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const {
    isModalOpen,
    setIsModalOpen,
    isDetailModalOpen,
    setIsDetailModalOpen,
    isConfirmOpen,
    setIsConfirmOpen,
    isBulkDeleteConfirmOpen,
    setIsBulkDeleteConfirmOpen,
    isBulkHargaOpen,
    setIsBulkHargaOpen,
    bulkHargaValue,
    setBulkHargaValue,
    bulkHargaSubmitting,
    setBulkHargaSubmitting,
    isBulkReconcileOpen,
    setIsBulkReconcileOpen,
    reconcileSubmitting,
    setReconcileSubmitting,
    reconcileTanggal,
    setReconcileTanggal,
    reconcileJumlahMasuk,
    setReconcileJumlahMasuk,
    reconcileSetLunas,
    setReconcileSetLunas,
    reconcileKeterangan,
    setReconcileKeterangan,
    reconcilePabrikId,
    setReconcilePabrikId,
    reconcileNotas,
    setReconcileNotas,
    reconcileGambarFile,
    setReconcileGambarFile,
    reconcileGambarPreview,
    setReconcileGambarPreview,
    reconcileRangeStart,
    setReconcileRangeStart,
    reconcileRangeEnd,
    setReconcileRangeEnd,
    reconcileRangeLoading,
    setReconcileRangeLoading,
    reconcileRangeCandidates,
    setReconcileRangeCandidates,
    isReconcileDetailOpen,
    setIsReconcileDetailOpen,
    reconcileDetail,
    setReconcileDetail,
    isBuktiTransferOpen,
    setIsBuktiTransferOpen,
    buktiTransferUrl,
    setBuktiTransferUrl,
    isReconcileEditOpen,
    setIsReconcileEditOpen,
    reconcileEditSubmitting,
    setReconcileEditSubmitting,
    reconcileEditingBatchId,
    setReconcileEditingBatchId,
    reconcileEditTanggal,
    setReconcileEditTanggal,
    reconcileEditJumlahMasuk,
    setReconcileEditJumlahMasuk,
    reconcileEditKeterangan,
    setReconcileEditKeterangan,
    reconcileEditSetLunas,
    setReconcileEditSetLunas,
    reconcileEditPabrikId,
    setReconcileEditPabrikId,
    reconcileEditNotas,
    setReconcileEditNotas,
    reconcileEditRangeStart,
    setReconcileEditRangeStart,
    reconcileEditRangeEnd,
    setReconcileEditRangeEnd,
    reconcileEditRangeLoading,
    setReconcileEditRangeLoading,
    reconcileEditRangeCandidates,
    setReconcileEditRangeCandidates,
    reconcileEditGambarFile,
    setReconcileEditGambarFile,
    reconcileEditGambarPreview,
    setReconcileEditGambarPreview,
    reconcileEditGambarExistingUrl,
    setReconcileEditGambarExistingUrl,
    isReconcileDeleteConfirmOpen,
    setIsReconcileDeleteConfirmOpen,
    reconcileDeletingBatchId,
    setReconcileDeletingBatchId,
    reconcileDeleteSubmitting,
    setReconcileDeleteSubmitting,
    duplicateWarningOpen,
    setDuplicateWarningOpen,
    duplicateCandidates,
    setDuplicateCandidates,
    pendingDuplicatePayload,
    setPendingDuplicatePayload,
    submittingDuplicateProceed,
    setSubmittingDuplicateProceed,
    isUbahStatusModalOpen,
    setIsUbahStatusModalOpen,
    selectedNota,
    setSelectedNota,
    viewImageUrl,
    setViewImageUrl,
    viewImageError,
    setViewImageError,
  } = useNotaSawitModalsState()
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [rowSelection, setRowSelection] = useState({});
  const bulkSelectedBeratAkhir = useMemo(() => {
    const keys = Object.keys(rowSelection as any)
    if (keys.length === 0) return 0
    return keys.reduce((sum, key) => {
      const idx = Number(key)
      if (!Number.isFinite(idx)) return sum
      const nota: any = (data as any[])[idx]
      if (!nota) return sum
      const netto = Number(nota?.netto ?? nota?.timbangan?.netKg ?? 0)
      const potongan = Number(nota?.potongan ?? 0)
      const beratAkhir = Math.max(0, Math.round(Number(nota?.beratAkhir ?? (netto - potongan))))
      return sum + (Number.isFinite(beratAkhir) ? beratAkhir : 0)
    }, 0)
  }, [data, rowSelection])
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [searchDraft, setSearchDraft] = useState(searchParams.get('search') || '');
  const [notaSoftLoading, setNotaSoftLoading] = useState(false)
  const [cursorId, setCursorId] = useState<number | null>(null);
  const [cursorStack, setCursorStack] = useState<number[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  
  // Date filter state - Default "all"
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [quickRange, setQuickRange] = useState('this_year');

  useEffect(() => {
    const WIB_OFFSET_MS = 7 * 60 * 60 * 1000
    const now = new Date()
    const wibNow = new Date(now.getTime() + WIB_OFFSET_MS)
    const year = wibNow.getUTCFullYear()
    const month = wibNow.getUTCMonth()
    const day = wibNow.getUTCDate()

    const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0) - WIB_OFFSET_MS)
    const end = new Date(Date.UTC(year, month, day, 23, 59, 59, 999) - WIB_OFFSET_MS)
    setStartDate(start)
    setEndDate(end)
    setQuickRange('this_year')
  }, []);

  const [kebunList, setKebunList] = useState<{ id: number; name: string }[]>([]);
  const [selectedKebun, setSelectedKebun] = useState<string>('');
  const [pabrikList, setPabrikList] = useState<{ id: number; name: string }[]>([]);
  const [selectedPabrik, setSelectedPabrik] = useState<string>(searchParams.get('pabrikId') || '');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const pembayaran = usePembayaranNotaSawit({
    enabled: activeTab === 'pembayaran' && role !== 'SUPIR',
    defaultStartDate: startDate,
    defaultEndDate: endDate,
    defaultQuickRange: 'this_year',
  })
  const notaHasLoadedRef = useRef(false)
  const notaAbortRef = useRef<AbortController | null>(null)
  const refreshToastRef = useRef<string | null>(null)
  const manualRefreshRef = useRef(false)


  useEffect(() => {
    const paramsSearch = searchParams.get('search') || '';
    setSearchQuery((prev: string) => (prev === paramsSearch ? prev : paramsSearch))
    setSearchDraft((prev: string) => (prev === paramsSearch ? prev : paramsSearch))
  }, [searchParams]);

  useEffect(() => {
    const fetchKebun = async () => {
      try {
        const res = await fetch('/api/kebun?limit=1000');
        if (!res.ok) throw new Error('Gagal memuat daftar kebun');
        const data = await res.json();
        setKebunList(data.data || []);
      } catch (error) {
        toast.error('Gagal memuat daftar kebun.');
      }
    };
    const fetchPabrik = async () => {
      try {
        const res = await fetch('/api/pabrik-sawit?limit=1000');
        if (!res.ok) throw new Error('Gagal memuat daftar pabrik sawit');
        const data = await res.json();
        setPabrikList(data.data || []);
      } catch (error) {
        toast.error('Gagal memuat daftar pabrik sawit.');
      }
    };
    fetchKebun();
    fetchPabrik();
  }, []);

  const applySearch = useCallback(() => {
    const trimmed = String(searchDraft || '').trim()
    if (trimmed && trimmed.length < 2 && !/^\d+$/.test(trimmed)) return
    setSearchQuery(trimmed)
    setPage(1)
    setCursorId(null)
    setCursorStack([])
    setNextCursor(null)

    const params = new URLSearchParams(searchParams.toString())
    if (trimmed) params.set('search', trimmed)
    else params.delete('search')
    router.replace(`?${params.toString()}`, { scroll: false })
  }, [router, searchDraft, searchParams])

  const reconcileNotaIds = useMemo(() => {
    const ids = reconcileNotas.map((n: any) => Number(n?.id)).filter((n) => Number.isFinite(n) && n > 0)
    return Array.from(new Set(ids))
  }, [reconcileNotas])

  const reconcileEditNotaIds = useMemo(() => {
    const ids = reconcileEditNotas.map((n: any) => Number(n?.id)).filter((n: number) => Number.isFinite(n) && n > 0)
    return Array.from(new Set(ids))
  }, [reconcileEditNotas])

  const refreshData = useCallback(() => setRefreshToggle(prev => !prev), []);
  const [reconcileEditRemovedNotas, setReconcileEditRemovedNotas] = useState<any[]>([])
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    try {
      manualRefreshRef.current = true
      refreshToastRef.current = toast.loading('Memperbarui data...')
      refreshData();
    } finally {
      setTimeout(() => {
        if (!manualRefreshRef.current) setRefreshing(false)
      }, 500);
    }
  }, [refreshData]);

  const computeSummaryFromNotas = useCallback((rows: any[]): SummaryData => {
    const totalNota = rows.length
    const totalBerat = rows.reduce((sum, r) => {
      const v = Number(r?.beratAkhir || 0)
      return sum + (Number.isFinite(v) ? v : 0)
    }, 0)
    const totalPembayaran = rows.reduce((sum, r) => {
      const v = Number(r?.pembayaranSetelahPph ?? r?.totalPembayaran ?? 0)
      return sum + (Number.isFinite(v) ? v : 0)
    }, 0)
    const lunasCount = rows.filter((r) => String(r?.statusPembayaran) === 'LUNAS').length
    const belumLunasCount = rows.filter((r) => String(r?.statusPembayaran) === 'BELUM_LUNAS').length
    const totalPembayaranLunas = rows.reduce((sum, r) => {
      if (String(r?.statusPembayaran) !== 'LUNAS') return sum
      const v = Number(r?.pembayaranSetelahPph ?? r?.totalPembayaran ?? 0)
      return sum + (Number.isFinite(v) ? v : 0)
    }, 0)
    const totalPembayaranBelumLunas = rows.reduce((sum, r) => {
      if (String(r?.statusPembayaran) !== 'BELUM_LUNAS') return sum
      const v = Number(r?.pembayaranSetelahPph ?? r?.totalPembayaran ?? 0)
      return sum + (Number.isFinite(v) ? v : 0)
    }, 0)

    const tonaseByKebunMap = rows.reduce((acc, r) => {
      const kebun = r?.kebun || r?.timbangan?.kebun || null
      const kebunId = kebun?.id ? Number(kebun.id) : null
      const kebunName = kebun?.name ? String(kebun.name) : null
      if (!kebunId || !kebunName) return acc
      const beratAkhir = Number(r?.beratAkhir || 0)
      const add = Number.isFinite(beratAkhir) ? beratAkhir : 0
      const prev = acc.get(kebunId)
      acc.set(kebunId, { kebunId, name: kebunName, totalBerat: (prev?.totalBerat || 0) + add })
      return acc
    }, new Map<number, { kebunId: number; name: string; totalBerat: number }>())

    const tonaseRaw = Array.from(tonaseByKebunMap.values()) as Array<{ kebunId: number; name: string; totalBerat: number }>
    const tonaseByKebun = tonaseRaw
      .map((r) => ({ ...r, totalBerat: Math.round(Number(r.totalBerat) || 0) }))
      .sort((a, b) => b.totalBerat - a.totalBerat)

    return {
      totalNota,
      totalBerat: Math.round(totalBerat),
      tonaseByKebun,
      totalPembayaran: Math.round(totalPembayaran),
      lunasCount,
      belumLunasCount,
      totalPembayaranLunas: Math.round(totalPembayaranLunas),
      totalPembayaranBelumLunas: Math.round(totalPembayaranBelumLunas),
    }
  }, [])

  const handleOpenModal = useCallback((nota: NotaSawitData) => {
    setSelectedNota(nota);
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedNota(null);
    setIsModalOpen(false);
  }, []);

  const handleOpenConfirm = useCallback((nota: NotaSawitData) => {
    setSelectedNota(nota);
    setIsConfirmOpen(true);
  }, []);

  const handleCloseConfirm = useCallback(() => {
    setSelectedNota(null);
    setIsConfirmOpen(false);
  }, []);

  const handleDetail = useCallback(async (nota: NotaSawitData) => {
    setSelectedNota(nota)
    setIsDetailModalOpen(true)
    try {
      const id = Number((nota as any)?.id)
      if (!Number.isFinite(id) || id <= 0) return
      const res = await fetch(`/api/nota-sawit/${id}`, { cache: 'no-store' })
      if (!res.ok) return
      const json = await res.json().catch(() => ({}))
      if (json?.nota) setSelectedNota(json.nota)
    } catch {
      return
    }
  }, [])

  const handleCloseDetailModal = useCallback(() => {
    setSelectedNota(null);
    setIsDetailModalOpen(false);
  }, []);

  const handleEditFromDetail = useCallback((nota: NotaSawitData) => {
    setSelectedNota(nota)
    setIsDetailModalOpen(false)
    setIsModalOpen(true)
  }, [])

  const handleDeleteFromDetail = useCallback((nota: NotaSawitData) => {
    setSelectedNota(nota)
    setIsDetailModalOpen(false)
    setIsConfirmOpen(true)
  }, [])

  const handleOpenUbahStatusModal = useCallback((nota: NotaSawitData) => {
    setSelectedNota(nota);
    setIsUbahStatusModalOpen(true);
  }, []);

  const handleCloseUbahStatusModal = useCallback(() => {
    setSelectedNota(null);
    setIsUbahStatusModalOpen(false);
  }, []);

  const handleViewImage = useCallback((url: string) => {
    const raw = (url || '').trim();
    if (!raw) {
      setViewImageUrl(null);
      setViewImageError(false);
      return;
    }
    setViewImageError(false);
    setViewImageUrl(raw);
  }, []);

  const dateDisplay = useMemo(() => {
    if (quickRange && quickRange !== 'custom') {
      switch (quickRange) {
        case 'all': return 'Semua';
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

  const toWibYmd = useCallback((dt?: Date) => {
    if (!dt) return ''
    const WIB_OFFSET_MS = 7 * 60 * 60 * 1000
    const wib = new Date(dt.getTime() + WIB_OFFSET_MS)
    const y = wib.getUTCFullYear()
    const m = String(wib.getUTCMonth() + 1).padStart(2, '0')
    const d = String(wib.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }, [])

  const wibStartFromYmd = useCallback((ymd: string) => new Date(`${ymd}T00:00:00+07:00`), [])
  const wibEndFromYmd = useCallback((ymd: string) => new Date(`${ymd}T23:59:59.999+07:00`), [])

  useEffect(() => {
    setCursorId(null);
    setCursorStack([]);
    setNextCursor(null);
  }, [searchQuery, startDate, endDate, selectedKebun, selectedPabrik, selectedStatus, role, userId, limit]);

  const applyQuickRange = useCallback((val: string) => {
    const shiftDays = (dt: Date, days: number) => new Date(dt.getTime() + days * 24 * 60 * 60 * 1000)
    const todayYmd = toWibYmd(new Date())
    const todayStart = wibStartFromYmd(todayYmd)
    const todayEnd = wibEndFromYmd(todayYmd)
    setQuickRange(val);
    
    if (val === 'all') {
      setStartDate(undefined);
      setEndDate(undefined);
    } else if (val === 'today') {
      setStartDate(todayStart);
      setEndDate(todayEnd);
    } else if (val === 'yesterday') {
      const yStart = shiftDays(todayStart, -1)
      const yYmd = toWibYmd(yStart)
      setStartDate(wibStartFromYmd(yYmd));
      setEndDate(wibEndFromYmd(yYmd));
    } else if (val === 'last_week') {
      const start = shiftDays(todayStart, -7)
      setStartDate(start);
      setEndDate(todayEnd);
    } else if (val === 'last_30_days') {
      const start = shiftDays(todayStart, -30)
      setStartDate(start);
      setEndDate(todayEnd);
    } else if (val === 'this_month') {
      const wibToday = new Date(Date.now() + 7 * 60 * 60 * 1000)
      const y = wibToday.getUTCFullYear()
      const m = String(wibToday.getUTCMonth() + 1).padStart(2, '0')
      const startYmd = `${y}-${m}-01`
      setStartDate(wibStartFromYmd(startYmd));
      setEndDate(todayEnd);
    } else if (val === 'this_year') {
      const wibToday = new Date(Date.now() + 7 * 60 * 60 * 1000)
      const y = wibToday.getUTCFullYear()
      const startYmd = `${y}-01-01`
      setStartDate(wibStartFromYmd(startYmd));
      setEndDate(todayEnd);
    }
  }, [toWibYmd, wibEndFromYmd, wibStartFromYmd]);

  const handleSaveStatus = useCallback(async (id: number, status: 'LUNAS' | 'BELUM_LUNAS') => {
    const previousData = [...data];
    const updatedData = data.map(item => 
      item.id === id ? { ...item, statusPembayaran: status } : item
    );
    setData(updatedData);
    handleCloseUbahStatusModal();

    let toastId: string | undefined
    try {
      toastId = toast.loading('Menyimpan status...')
      const response = await fetch(`/api/nota-sawit/ubah-status/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ statusPembayaran: status }),
      });

      if (!response.ok) {
        throw new Error('Gagal memperbarui status');
      }

      refreshData();
      toast.success('Status berhasil diperbarui', { id: toastId })
    } catch (error) {
      setData(previousData);
      if (toastId) toast.dismiss(toastId)
      toast.error('Gagal memperbarui status, mengembalikan perubahan.');
      console.error(error);
    }
  }, [data, refreshData, handleCloseUbahStatusModal]);

  const handleSave = useCallback(async (formDataRaw: any, file?: File) => {
    
    const hapusGambar = formDataRaw?.hapusGambar === true || formDataRaw?.hapusGambar === 'true'
    let finalGambarUrl = hapusGambar ? '' : (selectedNota?.gambarNotaUrl || '');

    const toastId = toast.loading(selectedNota ? 'Menyimpan nota...' : 'Menambahkan nota...');

    try {
      if (file) {
          const uploadFormData = new FormData();
          const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : ''
          const isAppleMobile = /iPhone|iPad|iPod/i.test(ua)
          const targetMaxBytes = isAppleMobile ? 850 * 1024 : 1200 * 1024
          const shouldConvert = !(file.type === 'image/webp' && Number(file.size || 0) > 0 && Number(file.size || 0) <= targetMaxBytes)
          const uploadFile = shouldConvert ? await convertImageFileToWebp(file, { quality: 0.82, maxDimension: 1280, targetMaxBytes }) : file
          uploadFormData.append('file', uploadFile);
          
          const uploadRes = await fetch('/api/upload', {
              method: 'POST',
              body: uploadFormData
          });

          if (uploadRes.ok) {
              const uploadData = await uploadRes.json();
              if (uploadData.success) {
                  finalGambarUrl = uploadData.url;
              } else {
                  console.error('Upload failed:', uploadData.error);
                  toast.error(`Gagal upload gambar: ${uploadData.error}`, { id: toastId });
                  return;
              }
          } else {
             const errText = await uploadRes.text().catch(() => '')
             console.error('Upload request failed:', uploadRes.status, errText || uploadRes.statusText);
             toast.error(`Gagal upload gambar (${uploadRes.status}): ${errText || uploadRes.statusText || 'Server Error'}`, { id: toastId });
             return;
          }
      }

      const payload: any = {
        kendaraanPlatNomor: formDataRaw.kendaraanPlatNomor || '',
        supirId: Number(formDataRaw.supirId),
        pabrikSawitId: Number(formDataRaw.pabrikSawitId),
        perusahaanId: formDataRaw.perusahaanId ? Number(formDataRaw.perusahaanId) : undefined,
        potongan: Number(formDataRaw.potongan),
        hargaPerKg: Number(formDataRaw.hargaPerKg || 0),
        statusPembayaran: formDataRaw.statusPembayaran || 'BELUM_LUNAS',
        tanggalBongkar: formDataRaw.tanggalBongkar || undefined,
        keterangan: formDataRaw.keterangan ? String(formDataRaw.keterangan).trim() : null,
        bruto: formDataRaw.bruto !== undefined ? Number(formDataRaw.bruto) : undefined,
        tara: formDataRaw.tara !== undefined ? Number(formDataRaw.tara) : undefined,
        netto: formDataRaw.netto !== undefined ? Number(formDataRaw.netto) : undefined,
        pph25: formDataRaw.pph25 !== undefined ? Number(formDataRaw.pph25) : undefined,
        gambarNotaUrl: finalGambarUrl,
        hapusGambar,
        isManual: !!formDataRaw.isManual,
        useTimbanganKebun: !!formDataRaw.useTimbanganKebun,
      };

      if (formDataRaw.timbanganId && !formDataRaw.isManual) {
          payload.timbanganId = Number(formDataRaw.timbanganId);
      }

      if (formDataRaw.useTimbanganKebun) {
          payload.grossKg = Number(formDataRaw.grossKg);
          payload.tareKg = Number(formDataRaw.tareKg);
          payload.kebunId = Number(formDataRaw.kebunId);
      } else if (formDataRaw.isManual) {
          payload.grossKg = Number(formDataRaw.manualGross || 0);
          payload.tareKg = Number(formDataRaw.manualTare || 0);
          payload.kebunId = Number(formDataRaw.kebunId);
      } else if (!formDataRaw.timbanganId) {
          payload.kebunId = Number(formDataRaw.kebunId);
      }

      if (selectedNota) {
          // UPDATE (PUT)
          if (formDataRaw.isManual) {
              payload.disconnectTimbangan = true;
          }

          const response = await fetch(`/api/nota-sawit/${selectedNota.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || 'Gagal memperbarui data');
          }

          refreshData();
          if ((selectedNota as any)?.pembayaranBatchItems?.length) {
            await pembayaran.fetchReconcileHistory({ soft: true })
          }
          handleCloseModal();
          toast.success('Nota berhasil diperbarui', { id: toastId });
      } else {
          // CREATE (POST)
          const response = await fetch('/api/nota-sawit', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
          });
           
           if (!response.ok) {
               const errData = await response.json().catch(() => ({}));
               if (response.status === 409 && errData?.code === 'DUPLICATE_NOTA') {
                 setDuplicateCandidates(Array.isArray(errData?.duplicates) ? errData.duplicates : [])
                 setPendingDuplicatePayload(payload)
                 setDuplicateWarningOpen(true)
                 toast.dismiss(toastId)
                 return
               }
               throw new Error(errData.error || 'Gagal menambahkan data');
           }
           
           refreshData();
           handleCloseModal();
           toast.success('Nota berhasil ditambahkan', { id: toastId });
      }
    } catch (error: any) {
         toast.error(error.message || 'Gagal menyimpan data', { id: toastId });
         console.error(error);
    }
  }, [selectedNota, refreshData, handleCloseModal]);

  const handleProceedDuplicateCreate = useCallback(async () => {
    if (!pendingDuplicatePayload || submittingDuplicateProceed) return
    setSubmittingDuplicateProceed(true)
    const toastId = toast.loading('Menambahkan nota...')
    try {
      const response = await fetch('/api/nota-sawit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...pendingDuplicatePayload, forceDuplicate: true }),
      })
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || 'Gagal menambahkan data')
      }
      refreshData()
      handleCloseModal()
      setDuplicateWarningOpen(false)
      setDuplicateCandidates([])
      setPendingDuplicatePayload(null)
      toast.success('Nota berhasil ditambahkan', { id: toastId })
    } catch (error: any) {
      toast.error(error?.message || 'Gagal menambahkan data', { id: toastId })
    } finally {
      setSubmittingDuplicateProceed(false)
    }
  }, [handleCloseModal, pendingDuplicatePayload, refreshData, submittingDuplicateProceed])

  const handleViewDuplicateNota = useCallback(async (id: number) => {
    if (!id) return
    const toastId = toast.loading('Memuat detail nota...')
    try {
      const res = await fetch(`/api/nota-sawit/${id}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Gagal memuat detail nota')
      const json = await res.json()
      const nota = json?.nota || null
      if (!nota) throw new Error('Nota tidak ditemukan')

      setDuplicateWarningOpen(false)
      setDuplicateCandidates([])
      setPendingDuplicatePayload(null)
      handleDetail(nota)
      toast.dismiss(toastId)
    } catch (e: any) {
      toast.error(e?.message || 'Gagal memuat detail nota', { id: toastId })
    }
  }, [handleDetail])

  const handleDelete = useCallback(async () => {
    if (!selectedNota) return;

    const previousData = [...data];
    const updatedData = data.filter(item => item.id !== selectedNota.id);
    setData(updatedData);
    handleCloseConfirm();

    const toastId = toast.loading('Menghapus nota...')
    try {
      const response = await fetch(`/api/nota-sawit/${selectedNota.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Gagal menghapus data');
      }

      refreshData();
      toast.success('Nota berhasil dihapus', { id: toastId })
    } catch (error: any) {
      setData(previousData);
      toast.error(error.message || 'Gagal menghapus data, mengembalikan perubahan.', { id: toastId });
      console.error(error);
    }
  }, [selectedNota, data, refreshData, handleCloseConfirm]);

  const handleBulkDelete = useCallback(async () => {
    const selectedIds = Object.keys(rowSelection).map(index => data[parseInt(index, 10)].id);
    if (selectedIds.length === 0) return;

    const previousData = [...data];
    const updatedData = data.filter(item => !selectedIds.includes(item.id));
    setData(updatedData);
    setIsBulkDeleteConfirmOpen(false);
    setRowSelection({}); // Clear selection immediately

    const toastId = toast.loading('Menghapus nota terpilih...')
    try {
      const response = await fetch('/api/nota-sawit', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Gagal menghapus nota');
      }

      refreshData();
      toast.success('Nota terpilih berhasil dihapus', { id: toastId })
    } catch (error: any) {
      setData(previousData);
      toast.error(error.message || 'Gagal menghapus nota, mengembalikan perubahan.', { id: toastId });
      console.error(error);
    }
  }, [rowSelection, data, refreshData]);

  const handleBulkUpdateHarga = useCallback(async () => {
    const selectedIds = Object.keys(rowSelection).map(index => data[parseInt(index, 10)].id);
    if (selectedIds.length === 0) return;

    const harga = Math.round(Number(String(bulkHargaValue).replace(/[^\d.-]/g, '')) || 0)
    if (harga <= 0) {
      toast.error('Harga per kg harus lebih dari 0.')
      return
    }

    const previousData = [...data]
    const updatedData = data.map(item => {
      if (!selectedIds.includes(item.id)) return item
      const beratAkhir = Math.max(0, Number(item.beratAkhir || 0))
      const totalPembayaran = Math.round(beratAkhir * harga)
      const rate = Number((pabrikList.find((p: any) => Number(p?.id) === Number((item as any)?.pabrikSawitId)) as any)?.pphRate ?? 0.0025)
      const pph = Math.round(totalPembayaran * (Number.isFinite(rate) ? rate : 0.0025))
      const pph25 = Math.round(Number((item as any).pph25 || 0))
      const pembayaranSetelahPph = Math.round(totalPembayaran - pph - pph25)
      return { ...item, hargaPerKg: harga, totalPembayaran, pph, pembayaranSetelahPph }
    })
    setData(updatedData)

    const toastId = toast.loading('Mengupdate harga nota terpilih...')
    setBulkHargaSubmitting(true)
    try {
      const response = await fetch('/api/nota-sawit/bulk-update-harga', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds, hargaPerKg: harga }),
      })
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || 'Gagal update harga')
      }
      setIsBulkHargaOpen(false)
      setBulkHargaValue('')
      refreshData()
      toast.success('Harga nota terpilih berhasil diupdate', { id: toastId })
    } catch (error: any) {
      setData(previousData)
      toast.error(error?.message || 'Gagal update harga, mengembalikan perubahan.', { id: toastId })
    } finally {
      setBulkHargaSubmitting(false)
    }
  }, [bulkHargaValue, data, pabrikList, refreshData, rowSelection])

  const handleOpenBulkReconcileEmpty = useCallback(() => {
    const todayYmd = toWibYmd(new Date())
    const startDt = new Date(`${todayYmd}T00:00:00+07:00`)
    startDt.setDate(startDt.getDate() - 7)
    const startYmd = toWibYmd(startDt)
    setReconcileTanggal(todayYmd)
    setReconcileJumlahMasuk('')
    setReconcileSetLunas(true)
    setReconcileKeterangan('')
    setReconcilePabrikId(String(selectedPabrik || ''))
    setReconcileGambarFile(null)
    setReconcileGambarPreview(null)
    setReconcileNotas([])
    setReconcileRangeStart(startYmd)
    setReconcileRangeEnd(todayYmd)
    setReconcileRangeCandidates([])
    setIsBulkReconcileOpen(true)
  }, [selectedPabrik, toWibYmd])

  const handleOpenEditReconcileBatch = useCallback((b: any) => {
    const id = Number(b?.id)
    if (!Number.isFinite(id) || id <= 0) return
    const todayYmd = toWibYmd(new Date())
    const startDt = new Date(`${todayYmd}T00:00:00+07:00`)
    startDt.setDate(startDt.getDate() - 7)
    const startYmd = toWibYmd(startDt)
    setReconcileEditingBatchId(id)
    setReconcileEditTanggal(toWibYmd(b?.tanggal ? new Date(b.tanggal) : new Date()))
    setReconcileEditJumlahMasuk(String(Math.max(0, Math.round(Number(b?.jumlahMasuk || 0)))))
    setReconcileEditKeterangan(String(b?.keterangan || ''))
    setReconcileEditSetLunas(true)
    setReconcileEditPabrikId(b?.pabrikSawit?.id ? String(b.pabrikSawit.id) : '')
    setReconcileEditNotas(
      (Array.isArray(b?.items) ? b.items : []).map((i: any) => ({
        id: Number(i?.notaSawitId),
        tanggalBongkar: i?.nota?.tanggalBongkar || null,
        beratAkhir: i?.nota?.beratAkhir ?? null,
        hargaPerKg: i?.nota?.hargaPerKg ?? null,
        kendaraanPlatNomor: (i as any)?.nota?.kendaraanPlatNomor || null,
        supir: (i as any)?.nota?.supir || null,
        tagihanNet: Number(i?.tagihanNet || 0),
        kebun: (i as any)?.nota?.kebun || null,
      })),
    )
    setReconcileEditRangeStart(startYmd)
    setReconcileEditRangeEnd(todayYmd)
    setReconcileEditRangeCandidates([])
    setReconcileEditRemovedNotas([])
    setReconcileEditGambarFile(null)
    setReconcileEditGambarExistingUrl(b?.gambarUrl ? String(b.gambarUrl) : null)
    setReconcileEditGambarPreview(b?.gambarUrl ? String(b.gambarUrl) : null)
    setIsReconcileEditOpen(true)
  }, [toWibYmd])

  const handleSubmitEditReconcileBatch = useCallback(async () => {
    if (!reconcileEditingBatchId) return
    const batchId = reconcileEditingBatchId
    const parseMoney = (v: string) => Math.round(Number(String(v || '').replace(/[^\d.-]/g, '')) || 0)
    const jumlahMasuk = parseMoney(reconcileEditJumlahMasuk)
    setReconcileEditSubmitting(true)
    const toastId = toast.loading('Menyimpan perubahan...')
    try {
      let finalGambarUrl: string | null | undefined = reconcileEditGambarExistingUrl
      if (reconcileEditGambarFile) {
        const uploadFormData = new FormData()
        uploadFormData.append('file', reconcileEditGambarFile)
        const uploadRes = await fetch('/api/upload', { method: 'POST', body: uploadFormData })
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json().catch(() => ({}))
          if (uploadData?.success && uploadData?.url) {
            finalGambarUrl = String(uploadData.url)
          } else {
            throw new Error(uploadData?.error || 'Gagal upload gambar')
          }
        } else {
          throw new Error('Gagal upload gambar: Server Error')
        }
      }

      const res = await fetch(`/api/nota-sawit/pembayaran-batch/${batchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tanggal: reconcileEditTanggal,
          jumlahMasuk,
          ids: reconcileEditNotaIds,
          setLunas: reconcileEditSetLunas,
          keterangan: reconcileEditKeterangan,
          gambarUrl: finalGambarUrl,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'Gagal menyimpan perubahan')
      setIsReconcileEditOpen(false)
      setIsReconcileDetailOpen(false)
      setReconcileDetail(null)
      await pembayaran.fetchReconcileHistory({ soft: true })
      refreshData()
      toast.success('Perubahan tersimpan', { id: toastId })
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menyimpan perubahan', { id: toastId })
    } finally {
      setReconcileEditSubmitting(false)
    }
  }, [pembayaran.fetchReconcileHistory, reconcileEditGambarExistingUrl, reconcileEditGambarFile, reconcileEditKeterangan, reconcileEditJumlahMasuk, reconcileEditNotaIds, reconcileEditSetLunas, reconcileEditTanggal, reconcileEditingBatchId, refreshData])

  const handleOpenDeleteReconcileBatch = useCallback((batchId: number) => {
    const id = Number(batchId)
    if (!Number.isFinite(id) || id <= 0) return
    setReconcileDeletingBatchId(id)
    setIsReconcileDeleteConfirmOpen(true)
  }, [])

  const handleConfirmDeleteReconcileBatch = useCallback(async () => {
    if (!reconcileDeletingBatchId) return
    const batchId = reconcileDeletingBatchId
    setReconcileDeleteSubmitting(true)
    const toastId = toast.loading('Menghapus batch...')
    try {
      const res = await fetch(`/api/nota-sawit/pembayaran-batch/${batchId}`, { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'Gagal menghapus batch')
      setIsReconcileDeleteConfirmOpen(false)
      setReconcileDeletingBatchId(null)
      setIsReconcileDetailOpen(false)
      setReconcileDetail(null)
      await pembayaran.fetchReconcileHistory({ soft: true })
      refreshData()
      toast.success('Batch dihapus', { id: toastId })
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menghapus batch', { id: toastId })
    } finally {
      setReconcileDeleteSubmitting(false)
    }
  }, [pembayaran.fetchReconcileHistory, reconcileDeletingBatchId, refreshData])

  const handleReconcileFetchByRange = useCallback(async () => {
    if (!reconcilePabrikId) {
      toast.error('Pilih pabrik terlebih dahulu.')
      return
    }
    if (!reconcileRangeStart || !reconcileRangeEnd) {
      toast.error('Isi rentang tanggal bongkar (Dari - Sampai).')
      return
    }

    setReconcileRangeLoading(true)
    const toastId = toast.loading('Memuat nota dari rentang tanggal...')
    try {
      const start = wibStartFromYmd(reconcileRangeStart)
      const end = wibEndFromYmd(reconcileRangeEnd)
      const params = new URLSearchParams({
        page: '1',
        limit: '500',
        search: '',
        pabrikId: String(reconcilePabrikId),
        statusPembayaran: 'BELUM_LUNAS',
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      })
      const res = await fetch(`/api/nota-sawit?${params.toString()}`, { cache: 'no-store' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'Gagal memuat nota')
      const list = Array.isArray(json?.data) ? (json.data as NotaSawitData[]) : []
      setReconcileRangeCandidates(list)
      toast.success('Nota berhasil dimuat', { id: toastId })
    } catch (e: any) {
      toast.error(e?.message || 'Gagal memuat nota', { id: toastId })
    } finally {
      setReconcileRangeLoading(false)
    }
  }, [reconcilePabrikId, reconcileRangeEnd, reconcileRangeStart, wibEndFromYmd, wibStartFromYmd])

  const handleReconcileEditFetchByRange = useCallback(async () => {
    if (!reconcileEditPabrikId) {
      toast.error('Pabrik batch tidak valid.')
      return
    }
    if (!reconcileEditRangeStart || !reconcileEditRangeEnd) {
      toast.error('Isi rentang tanggal bongkar (Dari - Sampai).')
      return
    }

    setReconcileEditRangeLoading(true)
    const toastId = toast.loading('Memuat nota dari rentang tanggal...')
    try {
      const start = wibStartFromYmd(reconcileEditRangeStart)
      const end = wibEndFromYmd(reconcileEditRangeEnd)
      const params = new URLSearchParams({
        page: '1',
        limit: '500',
        search: '',
        pabrikId: String(reconcileEditPabrikId),
        statusPembayaran: 'BELUM_LUNAS',
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      })
      const res = await fetch(`/api/nota-sawit?${params.toString()}`, { cache: 'no-store' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'Gagal memuat nota')
      const list = Array.isArray(json?.data) ? (json.data as any[]) : []
      const merged: any[] = [...list]
      const existing = new Set(merged.map((n) => Number((n as any)?.id)).filter((n) => Number.isFinite(n) && n > 0))
      for (const n of reconcileEditRemovedNotas) {
        const id = Number((n as any)?.id)
        if (!Number.isFinite(id) || id <= 0) continue
        if (existing.has(id)) continue
        merged.push(n)
        existing.add(id)
      }
      setReconcileEditRangeCandidates(merged)
      toast.success('Nota berhasil dimuat', { id: toastId })
    } catch (e: any) {
      toast.error(e?.message || 'Gagal memuat nota', { id: toastId })
    } finally {
      setReconcileEditRangeLoading(false)
    }
  }, [reconcileEditPabrikId, reconcileEditRangeEnd, reconcileEditRangeStart, reconcileEditRemovedNotas, wibEndFromYmd, wibStartFromYmd])

  const handleReconcileToggleNota = useCallback((nota: NotaSawitData, checked: boolean) => {
    const id = Number((nota as any)?.id)
    if (!Number.isFinite(id) || id <= 0) return
    setReconcileNotas((prev) => {
      const exists = prev.some((n: any) => Number(n?.id) === id)
      if (checked) {
        if (exists) return prev
        return [...prev, nota]
      }
      if (!exists) return prev
      return prev.filter((n: any) => Number(n?.id) !== id)
    })
  }, [])

  const handleReconcileEditToggleNota = useCallback((nota: any, checked: boolean) => {
    const id = Number(nota?.id)
    if (!Number.isFinite(id) || id <= 0) return
    setReconcileEditRemovedNotas((prev) => {
      const exists = prev.some((n: any) => Number(n?.id) === id)
      if (checked) {
        if (!exists) return prev
        return prev.filter((n: any) => Number(n?.id) !== id)
      }
      if (exists) return prev
      return [...prev, nota]
    })
    setReconcileEditNotas((prev) => {
      const exists = prev.some((n: any) => Number(n?.id) === id)
      if (checked) {
        if (exists) return prev
        return [...prev, nota]
      }
      if (!exists) return prev
      return prev.filter((n: any) => Number(n?.id) !== id)
    })
  }, [])

  const handleReconcileEditAddAllCandidates = useCallback(() => {
    if (reconcileEditRangeCandidates.length === 0) {
      toast.error('Tidak ada nota dari rentang tanggal.')
      return
    }
    const existing = new Set(reconcileEditNotaIds)
    const next = [...reconcileEditNotas]
    for (const n of reconcileEditRangeCandidates) {
      const id = Number((n as any)?.id)
      if (!Number.isFinite(id) || id <= 0) continue
      if (existing.has(id)) continue
      next.push(n)
      existing.add(id)
    }
    setReconcileEditNotas(next)
    toast.success('Nota ditambahkan ke pembayaran')
  }, [reconcileEditNotaIds, reconcileEditNotas, reconcileEditRangeCandidates])

  const handleReconcileAddAllCandidates = useCallback(() => {
    if (reconcileRangeCandidates.length === 0) {
      toast.error('Tidak ada nota dari rentang tanggal.')
      return
    }
    const existing = new Set(reconcileNotaIds)
    const next = [...reconcileNotas]
    for (const n of reconcileRangeCandidates) {
      const id = Number((n as any)?.id)
      if (!Number.isFinite(id) || id <= 0) continue
      if (existing.has(id)) continue
      next.push(n)
      existing.add(id)
    }
    setReconcileNotas(next)
    toast.success('Nota ditambahkan ke rekonsiliasi')
  }, [reconcileNotaIds, reconcileNotas, reconcileRangeCandidates])

  const handleBulkReconcileSubmit = useCallback(async () => {
    const selectedIds = reconcileNotaIds
    if (!reconcilePabrikId) {
      toast.error('Pilih pabrik terlebih dahulu.')
      return
    }

    const parseMoney = (v: string) => Math.round(Number(String(v || '').replace(/[^\d.-]/g, '')) || 0)
    const jumlahMasuk = parseMoney(reconcileJumlahMasuk)

    setReconcileSubmitting(true)
    const toastId = toast.loading('Menyimpan rekonsiliasi...')
    try {
      let finalGambarUrl: string | null = null
      if (reconcileGambarFile) {
        const uploadFormData = new FormData()
        uploadFormData.append('file', reconcileGambarFile)
        const uploadRes = await fetch('/api/upload', { method: 'POST', body: uploadFormData })
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json().catch(() => ({}))
          if (uploadData?.success && uploadData?.url) {
            finalGambarUrl = String(uploadData.url)
          } else {
            throw new Error(uploadData?.error || 'Gagal upload gambar')
          }
        } else {
          throw new Error('Gagal upload gambar: Server Error')
        }
      }

      const res = await fetch('/api/nota-sawit/pembayaran-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: selectedIds,
          pabrikSawitId: reconcilePabrikId,
          tanggal: reconcileTanggal,
          jumlahMasuk,
          setLunas: selectedIds.length > 0 ? reconcileSetLunas : false,
          keterangan: reconcileKeterangan,
          gambarUrl: finalGambarUrl,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'Gagal menyimpan rekonsiliasi')
      setIsBulkReconcileOpen(false)
      setRowSelection({})
      await pembayaran.fetchReconcileHistory({ soft: true })
      refreshData()
      const batchId = json?.batchId ? Number(json.batchId) : null
      toast.success(batchId ? `Rekonsiliasi berhasil (Batch #${batchId})` : 'Rekonsiliasi pembayaran berhasil', { id: toastId })
      if (reconcileSetLunas && selectedStatus === 'BELUM_LUNAS') {
        toast('Catatan: jika filter status BELUM LUNAS aktif, nota yang sudah direkonsiliasi (LUNAS) tidak akan muncul di tabel.')
      }
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menyimpan rekonsiliasi', { id: toastId })
    } finally {
      setReconcileSubmitting(false)
    }
  }, [pembayaran.fetchReconcileHistory, reconcileGambarFile, reconcileJumlahMasuk, reconcileKeterangan, reconcileNotaIds, reconcilePabrikId, reconcileSetLunas, reconcileTanggal, refreshData, selectedStatus])

  const handleExportPembayaranBatchPdf = useCallback(async () => {
    if (!reconcileDetail?.id) {
      toast.error('Pilih batch pembayaran dulu untuk export PDF.')
      return
    }
    const batchId = Number(reconcileDetail.id)
    const formatNumberLocal = (num: number) => new Intl.NumberFormat('id-ID').format(num)
    const formatCurrencyLocal = (num: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num)
    const jsPDF = (await import('jspdf')).default
    const autoTable = (await import('jspdf-autotable')).default
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    const marginX = 14
    const contentW = pageW - marginX * 2

    const tanggalText = reconcileDetail?.tanggal
      ? new Date(reconcileDetail.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
      : '-'
    const pabrikName = String(reconcileDetail?.pabrikSawit?.name || '-')
    const toNum = (v: any) => {
      const n = Number(v)
      return Number.isFinite(n) ? n : 0
    }
    const countNum = Math.round(toNum(reconcileDetail?.count))
    const totalTagihanFromItems = (Array.isArray(reconcileDetail?.items) ? reconcileDetail.items : []).reduce((sum: number, it: any) => sum + Math.round(toNum(it?.tagihanNet)), 0)
    const totalTagihan = Math.round(toNum(reconcileDetail?.totalTagihan || totalTagihanFromItems))
    const jumlahDitransfer = Math.round(toNum(reconcileDetail?.jumlahMasuk))
    const selisihComputed = Math.round(jumlahDitransfer - totalTagihan)
    const selisih = Math.round(toNum(reconcileDetail?.selisih ?? selisihComputed))
    const jumlahNota = formatNumberLocal(countNum)
    const keteranganText = reconcileDetail?.keterangan ? String(reconcileDetail.keterangan) : ''

    doc.setFillColor(16, 185, 129)
    doc.rect(0, 0, pageW, 28, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.text('Detail Pembayaran Nota Sawit', marginX, 14)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.text(`Batch #${batchId} • ${pabrikName}`, marginX, 22)

    doc.setTextColor(17, 24, 39)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text(`Batch #${batchId} • ${pabrikName}`, marginX, 38)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.text(`Ditransfer: ${tanggalText} • ${jumlahNota} nota`, marginX, 45)

    doc.setFontSize(10)
    doc.setTextColor(107, 114, 128)
    const ketLineHeight = 5
    const ketRaw = `Keterangan: ${keteranganText ? keteranganText : '-'}`
    const ketLines = (doc as any).splitTextToSize ? (doc as any).splitTextToSize(ketRaw, contentW) : [ketRaw]
    doc.text(ketLines, marginX, 51)

    const cardY = 51 + ketLines.length * ketLineHeight + 2
    const cardGap = 4
    const cardW = (contentW - cardGap * 2) / 3
    const cardH = 22
    const cards = [
      { label: 'Jumlah Dibayar/Ditransfer', value: formatCurrencyLocal(jumlahDitransfer), color: [17, 24, 39] as [number, number, number] },
      { label: 'Jumlah Sesuai Nota Sawit', value: formatCurrencyLocal(totalTagihan), color: [17, 24, 39] as [number, number, number] },
      { label: 'Selisih Pembayaran', value: formatCurrencyLocal(selisih), color: selisih < 0 ? ([225, 29, 72] as any) : ([5, 150, 105] as any) },
    ]
    for (let i = 0; i < cards.length; i++) {
      const x = marginX + i * (cardW + cardGap)
      doc.setFillColor(249, 250, 251)
      doc.setDrawColor(229, 231, 235)
      doc.roundedRect(x, cardY, cardW, cardH, 3, 3, 'DF')
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9.5)
      doc.setTextColor(107, 114, 128)
      doc.text(cards[i].label, x + 4, cardY + 7)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(cards[i].color[0], cards[i].color[1], cards[i].color[2])
      doc.text(cards[i].value, x + 4, cardY + 16)
    }

    const rows = (Array.isArray(reconcileDetail?.items) ? reconcileDetail.items : []).map((i: any) => {
      const nota = i?.nota
      const kebunName = nota?.kebun?.name || '-'
      const tglNota = nota?.tanggalBongkar
        ? new Date(nota.tanggalBongkar).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
        : '-'
      const plat = String(nota?.kendaraanPlatNomor || '-')
      const supirName = String(nota?.supir?.name || '-')
      const beratAkhir = Math.round(Number(nota?.beratAkhir || 0))
      const hargaPerKg = Math.round(Number(nota?.hargaPerKg || 0))
      const nominal = Math.round(Number(i?.tagihanNet || 0))
      const ket = keteranganText ? keteranganText : '-'
      return [tanggalText, kebunName, tglNota, plat, supirName, beratAkhir, hargaPerKg, nominal, ket]
    })
    const totalBeratAkhir = (Array.isArray(reconcileDetail?.items) ? reconcileDetail.items : []).reduce(
      (sum: number, i: any) => sum + Math.round(Number(i?.nota?.beratAkhir || 0)),
      0,
    )

    autoTable(doc, {
      startY: cardY + cardH + 10,
      margin: { left: marginX, right: marginX },
      tableWidth: contentW,
      head: [['Tanggal Transfer', 'Kebun', 'Tanggal Nota', 'Plat', 'Supir', 'Berat Akhir', 'Harga', 'Nominal', 'Keterangan']],
      body: rows,
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [16, 185, 129] },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 32 },
        2: { cellWidth: 30 },
        3: { cellWidth: 24 },
        4: { cellWidth: 30 },
        5: { halign: 'right', cellWidth: 20, font: 'courier' },
        6: { halign: 'right', cellWidth: 22, font: 'courier' },
        7: { halign: 'right', cellWidth: 34, font: 'courier' },
        8: { cellWidth: 47, overflow: 'linebreak' },
      },
      didParseCell: (data: any) => {
        if (data?.column?.index === 5) {
          data.cell.styles.halign = 'right'
          if (data.section === 'head') data.cell.styles.font = 'helvetica'
          if (data.section === 'body') {
            const n = Math.round(Number(data.cell.raw || 0))
            data.cell.text = [formatNumberLocal(Number.isFinite(n) ? n : 0)]
            data.cell.styles.font = 'courier'
          }
          if (data.section === 'foot') {
            const n = Math.round(Number(data.cell.raw || 0))
            data.cell.text = [formatNumberLocal(Number.isFinite(n) ? n : 0)]
            data.cell.styles.font = 'courier'
            data.cell.styles.fontStyle = 'bold'
          }
          if (data.section === 'foot') {
            data.cell.styles.font = 'courier'
            data.cell.styles.fontStyle = 'bold'
          }
        }
        if (data?.column?.index === 6) {
          data.cell.styles.halign = 'right'
          if (data.section === 'head') data.cell.styles.font = 'helvetica'
          if (data.section === 'body') {
            const n = Math.round(Number(data.cell.raw || 0))
            data.cell.text = [formatCurrencyLocal(Number.isFinite(n) ? n : 0)]
            data.cell.styles.font = 'courier'
          }
          if (data.section === 'foot') {
            data.cell.styles.font = 'courier'
            data.cell.styles.fontStyle = 'bold'
          }
        }
        if (data?.column?.index === 7) {
          data.cell.styles.halign = 'right'
          if (data.section === 'head') data.cell.styles.font = 'helvetica'
          if (data.section === 'body') {
            const n = Number(data.cell.raw || 0)
            data.cell.text = [formatCurrencyLocal(n)]
            data.cell.styles.font = 'courier'
          }
          if (data.section === 'foot') {
            data.cell.styles.font = 'courier'
            data.cell.styles.fontStyle = 'bold'
          }
        }
      },
      foot: [
        [
          { content: 'Total', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold' } },
          Math.round(Number(totalBeratAkhir || 0)),
          { content: '' },
          { content: formatCurrencyLocal(totalTagihan), styles: { halign: 'right', font: 'courier', fontStyle: 'bold' } },
          { content: '' },
        ],
      ],
      footStyles: { fillColor: [249, 250, 251], textColor: [17, 24, 39], fontStyle: 'bold' },
    })

    const toDataURL = (url: string): Promise<string> =>
      new Promise((resolve, reject) => {
        const img = new window.Image()
        img.crossOrigin = 'Anonymous'
        img.onload = () => {
          const canvas = document.createElement('CANVAS') as HTMLCanvasElement
          const ctx = canvas.getContext('2d')
          if (!ctx) return reject(new Error('Failed to get canvas context'))
          canvas.height = img.naturalHeight
          canvas.width = img.naturalWidth
          ctx.drawImage(img, 0, 0)
          resolve(canvas.toDataURL('image/jpeg', 0.9))
        }
        img.onerror = reject
        img.src = url
      })

    const gambarUrl = reconcileDetail?.gambarUrl ? String(reconcileDetail.gambarUrl) : ''
    if (gambarUrl) {
      try {
        const imgData = await toDataURL(gambarUrl)
        const imgProps = doc.getImageProperties(imgData as any)
        const maxW = contentW
        const maxH = pageH - 28 - 20
        const ratio = Math.min(maxW / imgProps.width, maxH / imgProps.height)
        const imgW = imgProps.width * ratio
        const imgH = imgProps.height * ratio
        doc.addPage()
        doc.setFillColor(16, 185, 129)
        doc.rect(0, 0, pageW, 28, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(16)
        doc.text('Bukti Transfer', marginX, 14)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(11)
        doc.text(`Batch #${batchId} • ${pabrikName}`, marginX, 22)
        doc.setTextColor(17, 24, 39)
        doc.addImage(imgData, 'JPEG', marginX, 36, imgW, imgH)
      } catch {
        return
      }
    }

    doc.save(`pembayaran-nota-sawit-batch-${batchId}.pdf`)
  }, [reconcileDetail])

  const handleExportPembayaranHistoryPdf = useCallback(async () => {
    const toastId = toast.loading('Mempersiapkan PDF pembayaran...')
    try {
      const formatNumberLocal = (num: number) => new Intl.NumberFormat('id-ID').format(num)
      const formatCurrencyLocal = (num: number) =>
        new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num)
      const toNum = (v: any) => {
        const n = Number(v)
        return Number.isFinite(n) ? n : 0
      }

      const fetchAll = async () => {
        const pageSize = 200
        let page = 1
        let total = 0
        const all: any[] = []

        while (true) {
          const params = new URLSearchParams({ page: String(page), limit: String(pageSize) })
          if (pembayaran.pembayaranPabrikId) params.append('pabrikId', String(pembayaran.pembayaranPabrikId))
          if (String(pembayaran.pembayaranSearch || '').trim()) params.append('search', String(pembayaran.pembayaranSearch || '').trim())
          if (pembayaran.pembayaranSort) params.append('sort', pembayaran.pembayaranSort)
          if (pembayaran.pembayaranStartDate) params.append('startDate', pembayaran.pembayaranStartDate.toISOString())
          if (pembayaran.pembayaranEndDate) params.append('endDate', pembayaran.pembayaranEndDate.toISOString())

          const res = await fetch(`/api/nota-sawit/pembayaran-batch?${params.toString()}`, { cache: 'no-store' })
          const json = await res.json().catch(() => ({}))
          if (!res.ok) throw new Error((json as any)?.error || 'Gagal mengambil data pembayaran')
          const rows = Array.isArray((json as any)?.data) ? (json as any).data : []
          total = Math.max(total, Number((json as any)?.total || 0))
          all.push(...rows)
          if (rows.length < pageSize) break
          if (total > 0 && all.length >= total) break
          page += 1
          if (page > 200) break
        }

        return { all, total }
      }

      const { all } = await fetchAll()
      if (all.length === 0) {
        toast.error('Tidak ada data pembayaran untuk diekspor.', { id: toastId })
        return
      }

      const jsPDF = (await import('jspdf')).default
      const autoTable = (await import('jspdf-autotable')).default
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

      const pageW = doc.internal.pageSize.getWidth()
      const marginX = 14
      const headerH = 22

      const pabrikName =
        pembayaran.pembayaranPabrikId && Number(pembayaran.pembayaranPabrikId)
          ? pabrikList.find((p) => Number(p.id) === Number(pembayaran.pembayaranPabrikId))?.name || 'Pabrik'
          : 'Semua Pabrik'
      const periodeText = pembayaran.pembayaranDateDisplay || 'Semua Periode'
      const searchText = String(pembayaran.pembayaranSearch || '').trim()

      doc.setFillColor(16, 185, 129)
      doc.rect(0, 0, pageW, headerH, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.text('Pembayaran Nota Sawit', marginX, 14)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text(`${pabrikName} • ${periodeText}`, marginX, 20)

      doc.setTextColor(17, 24, 39)

      const rows = all.map((b: any, idx: number) => {
        const tanggal = b?.tanggal
          ? new Date(b.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
          : '-'
        const count = Math.round(toNum(b?.count))
        const totalTagihan = Math.round(toNum(b?.totalTagihan))
        const kasMasuk = Math.round(toNum(b?.totalKasMasuk ?? (toNum(b?.jumlahMasuk) - toNum(b?.adminBank))))
        const selisih = Math.round(toNum(b?.selisih ?? (kasMasuk - totalTagihan)))
        return [
          idx + 1,
          `#${b?.id ?? ''}`,
          tanggal,
          b?.pabrikSawit?.name || '-',
          count,
          totalTagihan,
          kasMasuk,
          selisih,
          b?.keterangan ? String(b.keterangan) : '-',
        ]
      })

      const totalNota = all.reduce((sum: number, b: any) => sum + Math.round(toNum(b?.count)), 0)
      const totalTagihan = all.reduce((sum: number, b: any) => sum + Math.round(toNum(b?.totalTagihan)), 0)
      const totalKasMasuk = all.reduce(
        (sum: number, b: any) => sum + Math.round(toNum(b?.totalKasMasuk ?? (toNum(b?.jumlahMasuk) - toNum(b?.adminBank)))),
        0,
      )
      const totalSelisih = all.reduce((sum: number, b: any) => {
        const tagihan = Math.round(toNum(b?.totalTagihan))
        const kasMasuk = Math.round(toNum(b?.totalKasMasuk ?? (toNum(b?.jumlahMasuk) - toNum(b?.adminBank))))
        const selisih = Math.round(toNum(b?.selisih ?? (kasMasuk - tagihan)))
        return sum + selisih
      }, 0)

      autoTable(doc, {
        startY: headerH + 8,
        showFoot: 'lastPage',
        head: [['No', 'Batch', 'Tanggal Dibayar', 'Pabrik', 'Nota', 'Total Tagihan', 'Jumlah Ditransfer', 'Selisih', 'Keterangan']],
        body: rows,
        styles: { font: 'helvetica', fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [16, 185, 129] },
        columnStyles: {
          0: { halign: 'right', cellWidth: 10, font: 'courier' },
          1: { cellWidth: 16 },
          2: { cellWidth: 34 },
          3: { cellWidth: 46 },
          4: { halign: 'right', cellWidth: 16, font: 'courier' },
          5: { halign: 'right', cellWidth: 32, font: 'courier' },
          6: { halign: 'right', cellWidth: 32, font: 'courier' },
          7: { halign: 'right', cellWidth: 28, font: 'courier' },
          8: { cellWidth: 68 },
        },
        didParseCell: (data: any) => {
          if (data.section === 'body' && data.column.index === 0) {
            data.cell.text = [formatNumberLocal(Number(data.cell.raw || 0))]
          }
          if (data.section === 'body' && data.column.index === 4) {
            data.cell.text = [formatNumberLocal(Number(data.cell.raw || 0))]
          }
          if (data.section === 'body' && [5, 6, 7].includes(data.column.index)) {
            data.cell.text = [formatCurrencyLocal(Number(data.cell.raw || 0))]
          }
          if (data.section === 'foot' && [5, 6, 7].includes(data.column.index)) {
            data.cell.text = [formatCurrencyLocal(Number(data.cell.raw || 0))]
            data.cell.styles.halign = 'right'
            data.cell.styles.font = 'courier'
            data.cell.styles.fontStyle = 'bold'
          }
          if (data.section === 'foot' && data.column.index === 4) {
            data.cell.text = [formatNumberLocal(Number(data.cell.raw || 0))]
            data.cell.styles.halign = 'right'
            data.cell.styles.font = 'courier'
            data.cell.styles.fontStyle = 'bold'
          }
        },
        foot: [
          [
            { content: 'Total', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } },
            totalNota,
            totalTagihan,
            totalKasMasuk,
            totalSelisih,
            '',
          ],
        ],
        footStyles: { fillColor: [249, 250, 251], textColor: [17, 24, 39], fontStyle: 'bold' },
      })

      if (searchText) {
        const finalY = (doc as any).lastAutoTable?.finalY || headerH + 16
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.setTextColor(107, 114, 128)
        doc.text(`Filter pencarian: ${searchText}`, marginX, Math.min(finalY + 8, doc.internal.pageSize.getHeight() - 10))
      }

      const startKey = pembayaran.toWibYmd(pembayaran.pembayaranStartDate) || 'all'
      const endKey = pembayaran.toWibYmd(pembayaran.pembayaranEndDate) || 'all'
      doc.save(`pembayaran-nota-sawit-${startKey}-sampai-${endKey}.pdf`)
      toast.success('PDF pembayaran berhasil diunduh', { id: toastId })
    } catch (e: any) {
      toast.error(e?.message || 'Gagal export PDF pembayaran', { id: toastId })
    }
  }, [
    pembayaran,
    pabrikList,
  ])

  const handleBulkPrint = async () => {
    const selectedIds = Object.keys(rowSelection);
    if (selectedIds.length === 0) {
      toast.error('Tidak ada nota yang dipilih.');
      return;
    }

    const selectedNotas = selectedIds.map(index => data[parseInt(index, 10)]);
    const jsPDF = (await import('jspdf')).default;
    const doc = new jsPDF();
    let isFirstPage = true;

    const toDataURL = (url: string): Promise<string> => new Promise((resolve, reject) => {
      const img = new window.Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        const canvas = document.createElement('CANVAS') as HTMLCanvasElement;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Failed to get canvas context'));
        }
        canvas.height = img.naturalHeight;
        canvas.width = img.naturalWidth;
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg'));
      };
      img.onerror = reject;
      img.src = url;
    });

    const formatCurrency = (num: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
    const formatDate = (date: Date) => new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    const fetchCreatedBy = async (id: number): Promise<string | null> => {
      try {
        const res = await fetch(`/api/nota-sawit/${id}`, { cache: 'no-store' });
        if (!res.ok) return null;
        const data = await res.json();
        return data?.createdBy?.name ?? null;
      } catch {
        return null;
      }
    };

    toast.loading('Mempersiapkan PDF...');

    for (const nota of selectedNotas) {
      if (!isFirstPage) {
        doc.addPage();
      }

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 12;
      const boxPadding = 3;
      const contentMargin = margin + boxPadding;
      const gutter = 12;
      const contentWidth = Math.floor(((pageWidth - margin * 2) - gutter) * 0.5);
      const contentRight = margin + contentWidth - boxPadding;
      const rightColumnX = margin + contentWidth + gutter;
      const rightContentMargin = rightColumnX + boxPadding;
      const rightContentRight = rightColumnX + contentWidth - boxPadding;
      let currentY = margin + 8;
      let rightY = margin + 8;

      // --- Header ---
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor('#111827');
      const capitalize = (str: string) => str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
      doc.text("Detail Nota Sawit", contentMargin, currentY);
      currentY += 12;

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      const titleText = `${capitalize(nota.timbangan?.kebun.name || nota.kebun?.name || '-')} - ${nota.kendaraan?.platNomor || '-'}`;
      doc.text(titleText, contentMargin, currentY);
      currentY += 5;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor('#6B7280');
      const subText = `${nota.pabrikSawit.name} • ${(nota as any).perusahaan?.name || '-'} • ${nota.supir.name}`
      const subLines = (doc as any).splitTextToSize ? (doc as any).splitTextToSize(subText, contentWidth) : [subText]
      doc.text(subLines, contentMargin, currentY);
      currentY += 6 + (subLines.length - 1) * 4;

      const lineHeight = 9;
      const formatWeight = (num: number) => `${num.toLocaleString('id-ID')} kg`;
      const tanggalBongkarRow = { label: 'Tanggal Bongkar', value: nota.tanggalBongkar ? formatDate(nota.tanggalBongkar) : '-' };
      const effectiveNetto = (nota.netto && nota.netto > 0) ? nota.netto : (nota.timbangan?.netKg || 0);
      const brutoPabrik = nota.bruto || 0
      const brutoKebun = nota.timbangan?.grossKg || 0
      const selisihBruto = brutoPabrik - brutoKebun
      const selisihBrutoLabel =
        selisihBruto === 0
          ? 'Timbangan Pabrik Sama'
          : selisihBruto > 0
            ? `Timbangan Pabrik Lebih ${formatWeight(Math.abs(selisihBruto))}`
            : `Timbangan Pabrik Kurang ${formatWeight(Math.abs(selisihBruto))}`
      const isManualMode = !(nota.timbangan && typeof nota.timbangan.netKg === 'number');
      const timbanganRows = isManualMode
        ? [{ label: 'Status', value: 'Data timbangan tidak tersedia' }]
        : [
            ...(nota.timbangan?.date ? [{ label: 'Tanggal', value: formatDate(nota.timbangan.date) }] : []),
            ...(nota.timbangan?.supir ? [{ label: 'Supir', value: nota.timbangan.supir.name }] : []),
            ...(typeof nota.timbangan?.grossKg === 'number' ? [{ label: 'Bruto', value: formatWeight(nota.timbangan.grossKg) }] : []),
            ...(brutoPabrik > 0 ? [{ label: 'Selisih Bruto', value: selisihBrutoLabel }] : []),
          ];
      const factoryRows = [
        { label: 'Bruto', value: formatWeight(nota.bruto || 0) },
        { label: 'Tara', value: formatWeight(nota.tara || 0) },
        { label: 'Netto', value: formatWeight(nota.netto || 0) },
      ];

      // fetch creator name for "Input Oleh"
      const creatorName = await fetchCreatedBy(nota.id);

      // Left column: Tanggal Bongkar + Input Oleh
      const grayBoxHeight = (2 * lineHeight) + (boxPadding * 2) + 8;
      rightY = currentY;
      doc.setFillColor('#F9FAFB');
      doc.roundedRect(margin, currentY, contentWidth, grayBoxHeight, 3, 3, 'F');
      let rowY = currentY + boxPadding + 5;
      doc.setFontSize(11);
      doc.setTextColor('#6B7280');
      doc.setFont('helvetica', 'normal');
      doc.text(tanggalBongkarRow.label, contentMargin, rowY);
      doc.setTextColor('#111827');
      doc.setFont('helvetica', 'bold');
      doc.text(tanggalBongkarRow.value, contentRight, rowY, { align: 'right' });
      rowY += lineHeight + 3;
      doc.setFontSize(11);
      doc.setTextColor('#6B7280');
      doc.setFont('helvetica', 'normal');
      doc.text('Di Input Oleh', contentMargin, rowY);
      doc.setTextColor('#111827');
      doc.setFont('helvetica', 'bold');
      doc.text(creatorName || '-', contentRight, rowY, { align: 'right' });
      currentY += grayBoxHeight + 10;

      // Left column: Data Nota Pabrik (Utama)
      const sectionHeaderHeight = 8;
      const greenBoxHeight = sectionHeaderHeight + (factoryRows.length * lineHeight) + (boxPadding * 2) + 8;
      doc.setFillColor('#ECFDF5');
      doc.roundedRect(margin, currentY, contentWidth, greenBoxHeight, 3, 3, 'F');
      rowY = currentY + boxPadding + 5;
      doc.setFontSize(9);
      doc.setTextColor('#15803D');
      doc.setFont('helvetica', 'bold');
      doc.text("DATA NOTA PABRIK (UTAMA)", contentMargin, rowY);
      rowY += 6;
      factoryRows.forEach(row => {
        doc.setFontSize(10);
        doc.setTextColor('#6B7280');
        doc.setFont('helvetica', 'normal');
        doc.text(row.label, contentMargin, rowY);
        doc.setTextColor('#15803D');
        doc.setFont('helvetica', 'bold');
        doc.text(row.value, contentRight, rowY, { align: 'right' });
        rowY += lineHeight;
      });
      currentY += greenBoxHeight + 10;

      // Left column: Perhitungan Akhir
      const beratTotal = effectiveNetto - nota.potongan;
      const calcBoxHeight = (2 * lineHeight) + (boxPadding * 2) + 8;
      doc.setFillColor('#F9FAFB');
      doc.roundedRect(margin, currentY, contentWidth, calcBoxHeight, 3, 3, 'F');
      rowY = currentY + boxPadding + 5;
      doc.setFontSize(10);
      doc.setTextColor('#6B7280');
      doc.setFont('helvetica', 'normal');
      doc.text(`Potongan (${(effectiveNetto > 0 ? (nota.potongan / effectiveNetto) * 100 : 0).toLocaleString('id-ID', { maximumFractionDigits: 2 })}%)`, contentMargin, rowY);
      doc.setTextColor('#111827');
      doc.setFont('helvetica', 'bold');
      doc.text(formatWeight(nota.potongan), contentRight, rowY, { align: 'right' });
      rowY += lineHeight;
      doc.setFontSize(10);
      doc.setTextColor('#15803D');
      doc.setFont('helvetica', 'bold');
      doc.text("Total Berat (Net)", contentMargin, rowY);
      doc.text(formatWeight(beratTotal), contentRight, rowY, { align: 'right' });
      currentY += calcBoxHeight + 10;

      // Right column: Informasi Harga boxed + TOTAL DITERIMA + Status Pembayaran
      if (role !== 'SUPIR') {
        const financeRows: { label: string; value: string; isBold?: boolean; color?: string }[] = [
          { label: 'Harga / Kg', value: formatCurrency(nota.hargaPerKg) },
          { label: 'Total', value: formatCurrency(nota.totalPembayaran) },
          { label: 'Potongan PPh', value: `- ${formatCurrency(nota.pph)}` },
          { label: 'Total Pembayaran (Net)', value: formatCurrency(nota.pembayaranSetelahPph), isBold: true },
        ];
        const financeHeaderH = 6;
        const rowH = 9 * financeRows.length;
        const dividerH = 8 + 4;
        const totalH = 8 + 12;
        const financeBoxHeight = financeHeaderH + rowH + dividerH + totalH + (boxPadding * 2) + 8;
        doc.setFillColor('#F9FAFB');
        doc.setDrawColor('#E5E7EB');
        doc.roundedRect(rightColumnX, rightY, contentWidth, financeBoxHeight, 3, 3, 'DF');
        let fy = rightY + boxPadding + 5;
        doc.setFontSize(9);
        doc.setTextColor('#6B7280');
        doc.setFont('helvetica', 'bold');
        doc.text("INFORMASI HARGA", rightContentMargin, fy);
        fy += 6;
        financeRows.forEach(row => {
          doc.setFontSize(10);
          doc.setTextColor('#6B7280');
          doc.setFont('helvetica', 'normal');
          doc.text(row.label, rightContentMargin, fy);
          doc.setTextColor(row.color || '#111827');
          doc.setFont('helvetica', row.isBold ? 'bold' : 'normal');
          doc.text(row.value, rightContentRight, fy, { align: 'right' });
          fy += 9;
        });
        fy += 4;
        doc.setDrawColor('#E5E7EB');
        doc.line(rightContentMargin, fy, rightContentRight, fy);
        doc.setFontSize(10);
        doc.setTextColor('#16A34A');
        doc.setFont('helvetica', 'bold');
        doc.text("TOTAL DITERIMA", rightContentRight, fy, { align: 'right' });
        doc.setFontSize(10);
        doc.setTextColor(nota.statusPembayaran === 'LUNAS' ? '#15803D' : '#A16207');
        doc.setFont('helvetica', 'bold');
        doc.text(`Status Pembayaran: ${nota.statusPembayaran === 'LUNAS' ? 'Lunas' : 'Pending'}`, rightContentMargin, fy);
        fy += 8;
        doc.setFontSize(16);
        doc.setTextColor('#16A34A');
        doc.setFont('helvetica', 'bold');
        doc.text(formatCurrency(nota.pembayaranSetelahPph), rightContentRight, fy, { align: 'right' });
        rightY += financeBoxHeight + 10;
      }

      // Right column: Timbangan (Pembanding) boxed
      const tryLineHeights = [lineHeight, 8, 7];
      let chosenLH = lineHeight;
      let baseHeaderH = 16;
      const timbanganRowsCount = isManualMode ? 1 : timbanganRows.length;
      const spaceBottom = (pageHeight - margin) - rightY;
      for (const lh of tryLineHeights) {
        const needed = baseHeaderH + (timbanganRowsCount * lh);
        if (needed <= spaceBottom) {
          chosenLH = lh;
          break;
        }
      }
      const headerH = 6;
      const bodyH = isManualMode ? chosenLH : (timbanganRowsCount * chosenLH);
      const timbangBoxHeight = 10 + headerH + bodyH + (boxPadding * 2) + 6;
      doc.setFillColor('#F9FAFB');
      doc.setDrawColor('#E5E7EB');
      doc.roundedRect(rightColumnX, rightY, contentWidth, timbangBoxHeight, 3, 3, 'DF');
      let ty = rightY + boxPadding + 5;
      doc.setFontSize(9);
      doc.setTextColor('#6B7280');
      doc.setFont('helvetica', 'bold');
      doc.text("DATA TIMBANGAN (PEMBANDING)", rightContentMargin, ty);
      ty += 6;
      const labelFont = chosenLH < lineHeight ? 9 : 10;
      const valueFont = chosenLH < lineHeight ? 9 : 10;
      if (isManualMode) {
        doc.setFontSize(labelFont);
        doc.setTextColor('#6B7280');
        doc.setFont('helvetica', 'normal');
        doc.text('Status', rightContentMargin, ty);
        doc.setTextColor('#6B7280');
        doc.setFont('helvetica', 'italic');
        doc.text('Data timbangan tidak tersedia', rightContentRight, ty, { align: 'right' });
      } else {
        timbanganRows.forEach(row => {
          doc.setFontSize(labelFont);
          doc.setTextColor('#6B7280');
          doc.setFont('helvetica', 'normal');
          doc.text(row.label, rightContentMargin, ty);
          doc.setTextColor('#111827');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(valueFont);
          doc.text(row.value, rightContentRight, ty, { align: 'right' });
          doc.setDrawColor('#E5E7EB');
          doc.line(rightContentMargin, ty + 2.5, rightContentRight, ty + 2.5);
          ty += chosenLH;
        });
      }
      rightY += timbangBoxHeight + 10;

      // --- Images ---
      let imagesStarted = false;
      const addImageToPdf = async (url: string, title: string) => {
          try {
              if (!imagesStarted) {
                doc.addPage();
                imagesStarted = true;
              }
              const imgData = await toDataURL(url);
              const img = new window.Image();
              img.src = imgData;
              await new Promise((resolve) => { img.onload = resolve; });

              // Calculate dimensions first
              const aspectRatio = img.width / img.height;
              const availableWidth = pageWidth - contentMargin * 2;
              let imgWidth = availableWidth;
              let imgHeight = imgWidth / aspectRatio;
              
              // Reserve space for title (approx 15 units)
              const titleHeight = 15; 
              const maxImgHeight = pageHeight - margin * 2 - titleHeight;

              if (imgHeight > maxImgHeight) {
                   imgHeight = maxImgHeight;
                   imgWidth = imgHeight * aspectRatio;
              }

              // New images page starts at margin
              let y = margin + 10;

              // Print Title
              doc.setFontSize(10);
              doc.setTextColor('#6B7280'); // Gray 500
              doc.setFont('helvetica', 'bold');
              doc.text(title.toUpperCase(), contentMargin, y);
              
              y += 8; // spacing between title and image

              // Print Image
              const x = (pageWidth - imgWidth) / 2;
              doc.addImage(imgData, 'JPEG', x, y, imgWidth, imgHeight);
              
              // spacing after (not used further on images page)

          } catch (error) {
              console.error("Error adding image to PDF:", error);
          }
      };

      if (nota.gambarNotaUrl) await addImageToPdf(nota.gambarNotaUrl, 'Lampiran Gambar Nota');
      if (nota.timbangan?.photoUrl) await addImageToPdf(nota.timbangan.photoUrl, 'Lampiran Bukti Timbangan');

      isFirstPage = false;
    }

    toast.dismiss();
    toast.success('PDF berhasil dibuat!');
    doc.save(`nota-sawit-terpilih-${new Date().toISOString().split('T')[0]}.pdf`);
    setRowSelection({});
  };

  useEffect(() => {
    let ignore = false;
    
    // Skip fetching if dates are not yet initialized for a quick range (unless all)
    if (quickRange !== 'custom' && quickRange !== 'all' && (!startDate || !endDate)) {
      return;
    }
    const soft = notaHasLoadedRef.current
    if (soft) setNotaSoftLoading(true)
    else setLoading(true)
    setRowSelection({})

    const fetchData = async () => {
      try {
        notaAbortRef.current?.abort()
        const controller = new AbortController()
        notaAbortRef.current = controller
        const startDateString = startDate?.toISOString();
        const endDateString = endDate?.toISOString();

        const params = new URLSearchParams({
          page: String(page),
          limit: String(limit),
          search: searchQuery,
        });

        if (startDateString) params.append('startDate', startDateString);
        if (endDateString) params.append('endDate', endDateString);
        if (selectedKebun) params.append('kebunId', selectedKebun);
        if (selectedPabrik) params.append('pabrikId', selectedPabrik);
        if (selectedStatus) params.append('statusPembayaran', selectedStatus);
        if (role === 'SUPIR' && userId) {
          params.append('supirId', userId);
        }
        if (cursorId) params.append('cursorId', String(cursorId));

        const queryString = params.toString();

        const dataRes = await fetch(`/api/nota-sawit?${queryString}`, { cache: 'no-store', signal: controller.signal })
        if (!dataRes.ok) throw new Error('Failed to fetch data')
        const dataPayload = await dataRes.json()

        if (ignore) return;

        setData(dataPayload.data);
        setTotalNotas(dataPayload.total);
        setNextCursor(dataPayload.nextCursor || null);

        try {
          const summaryRes = await fetch(`/api/nota-sawit/summary?${queryString}`, { cache: 'no-store', signal: controller.signal })
          if (!summaryRes.ok) throw new Error('Failed to fetch summary')
          const summaryPayload = await summaryRes.json()
          if (ignore) return
          setSummary(summaryPayload)
        } catch {
          if (ignore) return
          setSummary(computeSummaryFromNotas(Array.isArray(dataPayload.data) ? dataPayload.data : []))
        }
      } catch (error) {
        if ((error as any)?.name === 'AbortError') return
        if (ignore) return;
        if (manualRefreshRef.current && refreshToastRef.current) {
          toast.error('Gagal memuat data.', { id: refreshToastRef.current })
          refreshToastRef.current = null
          manualRefreshRef.current = false
          setRefreshing(false)
          return
        }
        toast.error('Gagal memuat data.');
      } finally {
        if (ignore) return
        notaHasLoadedRef.current = true
        if (soft) setNotaSoftLoading(false)
        else setLoading(false)

        if (manualRefreshRef.current && refreshToastRef.current) {
          toast.success('Data diperbarui', { id: refreshToastRef.current })
          refreshToastRef.current = null
          manualRefreshRef.current = false
          setRefreshing(false)
        }
      }
    };

    fetchData();

    return () => {
      ignore = true;
    };
  }, [refreshToggle, page, limit, searchQuery, startDate, endDate, selectedKebun, selectedPabrik, selectedStatus, role, userId, cursorId, quickRange]);

  const tableMeta = useMemo(() => ({
    role,
    onUbah: handleOpenModal,
    onHapus: handleOpenConfirm,
    onDetail: handleDetail,
    onRowClick: handleDetail,
    onUbahStatus: handleOpenUbahStatusModal,
    onViewImage: handleViewImage,
    refreshData,
  }), [role, refreshData, handleOpenUbahStatusModal, handleOpenModal, handleOpenConfirm, handleDetail, handleViewImage]);

  const formatNumber = useCallback((num: number) => new Intl.NumberFormat('id-ID').format(num), [])
  const formatCurrency = useCallback((num: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num), [])

  const tableColumns = useMemo(() => {
    if (role === 'SUPIR') {
      return columns.filter(col => {
        const key = (col as any).accessorKey;
        return !['hargaPerKg', 'totalPembayaran', 'statusPembayaran'].includes(key);
      });
    }
    return columns;
  }, [role]);

  const pembayaranColumns = useMemo<ColumnDef<any>[]>(() => {
    return [
      {
        id: 'no',
        header: 'No',
        cell: ({ row }) => <div className="text-gray-700 tabular-nums whitespace-nowrap">{row.index + 1}</div>,
        footer: () => <div className="font-bold text-gray-700">Jumlah</div>,
      },
      {
        id: 'batch',
        header: 'Batch',
        cell: ({ row }) => <div className="font-extrabold text-gray-900 whitespace-nowrap">#{row.original?.id}</div>,
      },
      {
        id: 'tanggal',
        header: 'Tanggal Dibayar',
        cell: ({ row }) => (
          <div className="text-gray-700 whitespace-nowrap">
            {row.original?.tanggal ? new Date(row.original.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : '-'}
          </div>
        ),
      },
      {
        id: 'pabrik',
        header: 'Pabrik',
        cell: ({ row }) => <div className="text-gray-700 truncate max-w-[240px]" title={row.original?.pabrikSawit?.name || '-'}>{row.original?.pabrikSawit?.name || '-'}</div>,
      },
      {
        id: 'nota',
        header: () => <div className="text-right whitespace-nowrap">Nota</div>,
        cell: ({ row }) => <div className="text-right font-semibold text-gray-900 tabular-nums whitespace-nowrap">{formatNumber(Number(row.original?.count || 0))}</div>,
        footer: ({ table }) => {
          const total = table.getRowModel().rows.reduce((sum, r) => {
            const n = Number((r.original as any)?.count)
            return sum + (Number.isFinite(n) ? n : 0)
          }, 0)
          return <div className="text-right font-bold tabular-nums whitespace-nowrap text-gray-900">{formatNumber(total)}</div>
        },
      },
      {
        id: 'totalTagihan',
        header: () => <div className="text-right whitespace-nowrap">Jumlah Tagihan Nota</div>,
        cell: ({ row }) => <div className="text-right font-semibold text-gray-700 tabular-nums whitespace-nowrap">{formatCurrency(Number(row.original?.totalTagihan || 0))}</div>,
        footer: ({ table }) => {
          const total = table.getRowModel().rows.reduce((sum, r) => {
            const n = Number((r.original as any)?.totalTagihan)
            return sum + (Number.isFinite(n) ? n : 0)
          }, 0)
          return <div className="text-right font-bold tabular-nums whitespace-nowrap text-gray-900">{formatCurrency(total)}</div>
        },
      },
      {
        id: 'jumlahMasuk',
        header: () => <div className="text-right whitespace-nowrap">Jumlah Ditransfer</div>,
        cell: ({ row }) => <div className="text-right font-extrabold text-gray-900 tabular-nums whitespace-nowrap">{formatCurrency(Number(row.original?.jumlahMasuk || 0))}</div>,
        footer: ({ table }) => {
          const total = table.getRowModel().rows.reduce((sum, r) => {
            const n = Number((r.original as any)?.jumlahMasuk)
            return sum + (Number.isFinite(n) ? n : 0)
          }, 0)
          return <div className="text-right font-bold tabular-nums whitespace-nowrap text-gray-900">{formatCurrency(total)}</div>
        },
      },
      {
        id: 'selisih',
        header: () => <div className="text-right whitespace-nowrap">Selisih</div>,
        cell: ({ row }) => {
          const val = Number(row.original?.selisih || 0)
          return (
            <div className={cn("text-right font-extrabold tabular-nums whitespace-nowrap", val === 0 ? "text-emerald-700" : val > 0 ? "text-emerald-700" : "text-rose-700")}>
              {formatCurrency(val)}
            </div>
          )
        },
        footer: ({ table }) => {
          const total = table.getRowModel().rows.reduce((sum, r) => {
            const n = Number((r.original as any)?.selisih)
            return sum + (Number.isFinite(n) ? n : 0)
          }, 0)
          return <div className="text-right font-bold tabular-nums whitespace-nowrap text-gray-900">{formatCurrency(total)}</div>
        },
      },
      {
        id: 'keterangan',
        header: 'Keterangan',
        cell: ({ row }) => (
          <div
            className="text-gray-700 truncate max-w-[280px] whitespace-nowrap"
            title={row.original?.keterangan || ''}
          >
            {row.original?.keterangan || '-'}
          </div>
        ),
      },
    ]
  }, [cn, formatCurrency, formatNumber])

  return (
    <main className="p-4 md:p-8 space-y-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800 tracking-tight">Daftar Nota Sawit</h1>
            <p className="text-gray-500 mt-2 md:mt-0">Kelola data nota sawit Anda di sini.</p>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-6">
          <NotaSawitTabs value={activeTab} />

          <TabsContent value="nota" className="space-y-8">
        {loading && data.length === 0 ? (
          <div className="mb-8">
            <div className="card-style p-4 rounded-2xl space-y-4">
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
        ) : summary ? (
          <NotaSawitSummary summary={summary as any} role={role} dateDisplay={dateDisplay} formatNumber={formatNumber} formatCurrency={formatCurrency} />
        ) : null}

        <div className="card-style">
          {role !== 'SUPIR' ? (
            <div className="hidden lg:flex justify-start mb-3">
              <Button
                onClick={() => { setSelectedNota(null); setIsModalOpen(true); }}
                className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white whitespace-nowrap"
                title="Tambah Nota Sawit"
              >
                <PlusIcon className="w-4 h-4 mr-2" />
                Tambah Nota Sawit
              </Button>
            </div>
          ) : null}
          <NotaSawitToolbar
            role={role}
            searchDraft={searchDraft}
            notaSoftLoading={notaSoftLoading}
            onSearchDraftChange={(value) => {
              const next = value
              setSearchDraft(next)
              if (!String(next || '').trim()) {
                setSearchQuery('')
                setPage(1)
                setCursorId(null)
                setCursorStack([])
                setNextCursor(null)
                const params = new URLSearchParams(searchParams.toString())
                params.delete('search')
                router.replace(`?${params.toString()}`, { scroll: false })
              }
            }}
            onSearchSubmit={applySearch}
            dateDisplay={dateDisplay}
            quickRange={quickRange}
            onQuickRange={applyQuickRange}
            startDateYmd={startDate ? toWibYmd(startDate) : ''}
            endDateYmd={endDate ? toWibYmd(endDate) : ''}
            onStartDateYmdChange={(ymd) => {
              setStartDate(ymd ? wibStartFromYmd(ymd) : undefined)
              setQuickRange('custom')
            }}
            onEndDateYmdChange={(ymd) => {
              setEndDate(ymd ? wibEndFromYmd(ymd) : undefined)
              setQuickRange('custom')
            }}
            selectedKebun={selectedKebun}
            kebunList={kebunList}
            onSelectedKebunChange={setSelectedKebun}
            selectedPabrik={selectedPabrik}
            pabrikList={pabrikList}
            onSelectedPabrikChange={setSelectedPabrik}
            selectedStatus={selectedStatus}
            onSelectedStatusChange={setSelectedStatus}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            onAddNota={() => {
              setSelectedNota(null)
              setIsModalOpen(true)
            }}
          />

          <NotaSawitBulkActionsBar
            selectedCount={Object.keys(rowSelection).length}
            totalBeratAkhir={Number(bulkSelectedBeratAkhir || 0)}
            role={role}
            onDelete={() => setIsBulkDeleteConfirmOpen(true)}
            onUpdateHarga={() => setIsBulkHargaOpen(true)}
            onExportPdf={handleBulkPrint}
          />

          <div className="md:hidden space-y-3">
            {loading && data.length === 0 ? (
              [...Array(3)].map((_, i) => (
                <div key={i} className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-40" />
                </div>
              ))
            ) : data.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center text-sm text-gray-500">
                Belum ada data nota
              </div>
            ) : (
              data.map((nota, index) => {
                const isSelected = !!(rowSelection as any)[index]
                const kebunName = nota.timbangan?.kebun?.name || nota.kebun?.name || '-'
                const bruto = nota.bruto || nota.timbangan?.grossKg || 0
                const tara = nota.tara || nota.timbangan?.tareKg || 0
                const netto = nota.netto || nota.timbangan?.netKg || 0
                const beratAkhir = Math.max(0, Math.round(Number((nota as any)?.beratAkhir ?? (Number(netto || 0) - Number((nota as any)?.potongan || 0)))))
                const statusClass = nota.statusPembayaran === 'LUNAS' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                const showFinance = role !== 'SUPIR'
                const imageUrl = nota.gambarNotaUrl || null
                return (
                  <div
                    key={nota.id}
                    onClick={() => handleDetail(nota)}
                    className={cn(
                      "rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-3 transition-colors",
                      isSelected ? "ring-2 ring-blue-500" : "hover:bg-gray-50/50"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="font-semibold text-gray-900">{nota.kendaraan?.platNomor || nota.kendaraanPlatNomor || '-'}</div>
                        <div className="text-xs text-gray-500">{nota.supir?.name || '-'}</div>
                        <div className="text-xs text-gray-500">{nota.pabrikSawit?.name || '-'} • {kebunName}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {showFinance && (
                          <span className={cn("px-2 py-0.5 text-xs font-semibold rounded-full", statusClass)}>
                            {nota.statusPembayaran?.replace('_', ' ') || '-'}
                          </span>
                        )}
                        <div onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(v) => {
                              setRowSelection((prev: any) => {
                                const next = { ...prev }
                                if (v) next[index] = true
                                else delete next[index]
                                return next
                              })
                            }}
                            aria-label="Pilih nota"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                      <div>
                        <div className="text-gray-400">Tanggal Bongkar</div>
                        <div className="font-medium text-gray-800">{nota.tanggalBongkar ? new Date(nota.tanggalBongkar).toLocaleDateString('id-ID') : '-'}</div>
                      </div>
                      <div>
                        <div className="text-gray-400">Netto</div>
                        <div className="font-medium text-gray-800">{formatNumber(netto)} Kg</div>
                      </div>
                      <div>
                        <div className="text-gray-400">Bruto</div>
                        <div className="font-medium text-gray-800">{formatNumber(bruto)} Kg</div>
                      </div>
                      <div>
                        <div className="text-gray-400">Tara</div>
                        <div className="font-medium text-gray-800">{formatNumber(tara)} Kg</div>
                      </div>
                    </div>
                    <div className="rounded-xl bg-amber-50/70 px-3 py-2">
                      <div className="text-xs text-amber-700">Berat Akhir</div>
                      <div className="text-lg font-extrabold text-gray-900">{formatNumber(beratAkhir)} Kg</div>
                    </div>

                    {showFinance && (
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <div className="text-gray-400">Total</div>
                          <div className="font-semibold text-gray-900">{formatCurrency(nota.totalPembayaran || 0)}</div>
                        </div>
                        <div>
                          <div className="text-gray-400">Total Net</div>
                          <div className="font-semibold text-emerald-700">{formatCurrency(nota.pembayaranSetelahPph || 0)}</div>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button size="sm" variant="outline" className="rounded-full" onClick={(e) => { e.stopPropagation(); handleDetail(nota) }}>
                        Detail
                      </Button>
                      <Button size="sm" variant="outline" className="rounded-full" onClick={(e) => { e.stopPropagation(); handleOpenModal(nota) }}>
                        Ubah
                      </Button>
                      {showFinance && (
                        <Button size="sm" variant="outline" className="rounded-full" onClick={(e) => { e.stopPropagation(); handleOpenUbahStatusModal(nota) }}>
                          Ubah Status
                        </Button>
                      )}
                      {imageUrl && (
                        <Button size="sm" variant="outline" className="rounded-full" onClick={(e) => { e.stopPropagation(); handleViewImage(imageUrl) }}>
                          Gambar
                        </Button>
                      )}
                      <Button size="sm" variant="destructive" className="rounded-full" onClick={(e) => { e.stopPropagation(); handleOpenConfirm(nota) }}>
                        Hapus
                      </Button>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <div className="hidden md:block overflow-hidden rounded-2xl border border-gray-100">
             <DataTable 
               columns={tableColumns} 
               data={data} 
               meta={tableMeta} 
               rowSelection={rowSelection} 
               setRowSelection={setRowSelection} 
               isLoading={loading}
             />
          </div>
          
          <div className="flex flex-col md:flex-row items-center justify-center md:justify-between gap-4 mt-6 pt-4 border-t border-gray-100">
            <div className="text-sm text-gray-500">
              Menampilkan <span className="font-medium text-gray-800">{Math.min((page - 1) * limit + 1, totalNotas)}</span> - <span className="font-medium text-gray-800">{Math.min(page * limit, totalNotas)}</span> dari <span className="font-medium text-gray-800">{totalNotas}</span> nota
            </div>
            <div className="flex items-center gap-2">
              <select
                className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition-colors"
                value={limit}
                onChange={(e) => {
                  const next = Number(e.target.value)
                  setLimit(next)
                  setPage(1)
                  setCursorId(null)
                  setCursorStack([])
                  setNextCursor(null)
                }}
                title="Per halaman"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
              <button
                onClick={() => {
                  if (cursorStack.length > 0) {
                    const prev = cursorStack[cursorStack.length - 1];
                    setCursorStack(cursorStack.slice(0, -1));
                    setCursorId(prev);
                  } else {
                    setPage(page - 1);
                  }
                }}
                disabled={page <= 1 || loading}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Sebelumnya
              </button>
              <button
                onClick={() => {
                  if (nextCursor) {
                    if (cursorId) setCursorStack([...cursorStack, cursorId]);
                    setCursorId(nextCursor);
                  } else {
                    setPage(page + 1);
                  }
                }}
                disabled={(page * limit >= totalNotas && !nextCursor) || loading}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Berikutnya
              </button>
            </div>
          </div>
        </div>

          </TabsContent>

          <TabsContent value="pembayaran" className="space-y-6">
            <PembayaranTab
              role={role}
              fetchReconcileHistory={pembayaran.fetchReconcileHistory}
              onExportPdf={handleExportPembayaranHistoryPdf}
              reconcileHistoryLoading={pembayaran.reconcileHistoryLoading}
              reconcileHistorySoftLoading={pembayaran.reconcileHistorySoftLoading}
              reconcileHistorySummary={pembayaran.reconcileHistorySummary}
              handleOpenBulkReconcileEmpty={handleOpenBulkReconcileEmpty}
              pembayaranSearch={pembayaran.pembayaranSearch}
              setPembayaranSearch={pembayaran.setPembayaranSearch}
              setReconcileHistoryPage={pembayaran.setReconcileHistoryPage}
              pembayaranPabrikId={pembayaran.pembayaranPabrikId}
              setPembayaranPabrikId={pembayaran.setPembayaranPabrikId}
              pabrikList={pabrikList}
              pembayaranSort={pembayaran.pembayaranSort}
              setPembayaranSort={pembayaran.setPembayaranSort}
              pembayaranDateDisplay={pembayaran.pembayaranDateDisplay}
              pembayaranStartDate={pembayaran.pembayaranStartDate}
              pembayaranEndDate={pembayaran.pembayaranEndDate}
              pembayaranQuickRange={pembayaran.pembayaranQuickRange}
              applyPembayaranQuickRange={pembayaran.applyPembayaranQuickRange}
              toWibYmd={pembayaran.toWibYmd}
              wibStartFromYmd={pembayaran.wibStartFromYmd}
              wibEndFromYmd={pembayaran.wibEndFromYmd}
              setPembayaranStartDate={pembayaran.setPembayaranStartDate}
              setPembayaranEndDate={pembayaran.setPembayaranEndDate}
              setPembayaranQuickRange={pembayaran.setPembayaranQuickRange}
              pembayaranColumns={pembayaranColumns}
              reconcileHistory={pembayaran.reconcileHistory}
              setReconcileDetail={setReconcileDetail}
              setIsReconcileDetailOpen={setIsReconcileDetailOpen}
              reconcileHistoryPage={pembayaran.reconcileHistoryPage}
              reconcileHistoryLimit={pembayaran.reconcileHistoryLimit}
              reconcileHistoryTotal={pembayaran.reconcileHistoryTotal}
              setReconcileHistoryLimit={pembayaran.setReconcileHistoryLimit}
              formatNumber={formatNumber}
              formatCurrency={formatCurrency}
            />
          </TabsContent>
        </Tabs>
      </div>
      <NotaSawitPageModals
        selectedNota={selectedNota}
        isModalOpen={isModalOpen}
        handleCloseModal={handleCloseModal}
        handleSave={handleSave}
        isConfirmOpen={isConfirmOpen}
        handleCloseConfirm={handleCloseConfirm}
        handleDelete={handleDelete}
        isBulkDeleteConfirmOpen={isBulkDeleteConfirmOpen}
        setIsBulkDeleteConfirmOpen={setIsBulkDeleteConfirmOpen}
        handleBulkDelete={handleBulkDelete}
        bulkSelectionCount={Object.keys(rowSelection).length}
        isDetailModalOpen={isDetailModalOpen}
        handleCloseDetailModal={handleCloseDetailModal}
        handleEditFromDetail={handleEditFromDetail}
        handleDeleteFromDetail={handleDeleteFromDetail}
        isUbahStatusModalOpen={isUbahStatusModalOpen}
        handleCloseUbahStatusModal={handleCloseUbahStatusModal}
        handleSaveStatus={handleSaveStatus}
        isBulkHargaOpen={isBulkHargaOpen}
        setIsBulkHargaOpen={setIsBulkHargaOpen}
        bulkHargaValue={bulkHargaValue}
        setBulkHargaValue={setBulkHargaValue}
        bulkHargaSubmitting={bulkHargaSubmitting}
        handleBulkUpdateHarga={handleBulkUpdateHarga}
        isBulkReconcileOpen={isBulkReconcileOpen}
        setIsBulkReconcileOpen={setIsBulkReconcileOpen}
        reconcileSubmitting={reconcileSubmitting}
        reconcilePabrikId={reconcilePabrikId}
        setReconcilePabrikId={setReconcilePabrikId}
        pabrikList={pabrikList}
        reconcileTanggal={reconcileTanggal}
        setReconcileTanggal={setReconcileTanggal}
        reconcileJumlahMasuk={reconcileJumlahMasuk}
        setReconcileJumlahMasuk={setReconcileJumlahMasuk}
        reconcileNotas={reconcileNotas}
        reconcileNotaIds={reconcileNotaIds}
        handleReconcileToggleNota={handleReconcileToggleNota}
        reconcileRangeStart={reconcileRangeStart}
        setReconcileRangeStart={setReconcileRangeStart}
        reconcileRangeEnd={reconcileRangeEnd}
        setReconcileRangeEnd={setReconcileRangeEnd}
        reconcileRangeLoading={reconcileRangeLoading}
        reconcileRangeCandidates={reconcileRangeCandidates}
        handleReconcileFetchByRange={handleReconcileFetchByRange}
        handleReconcileAddAllCandidates={handleReconcileAddAllCandidates}
        reconcileSetLunas={reconcileSetLunas}
        setReconcileSetLunas={setReconcileSetLunas}
        reconcileKeterangan={reconcileKeterangan}
        setReconcileKeterangan={setReconcileKeterangan}
        reconcileGambarPreview={reconcileGambarPreview}
        setReconcileGambarFile={setReconcileGambarFile}
        setReconcileGambarPreview={setReconcileGambarPreview}
        handleBulkReconcileSubmit={handleBulkReconcileSubmit}
        formatNumber={formatNumber}
        formatCurrency={formatCurrency}
        isReconcileDetailOpen={isReconcileDetailOpen}
        setIsReconcileDetailOpen={setIsReconcileDetailOpen}
        reconcileDetail={reconcileDetail}
        setReconcileDetail={setReconcileDetail}
        handleExportPembayaranBatchPdf={handleExportPembayaranBatchPdf}
        handleOpenEditReconcileBatch={handleOpenEditReconcileBatch}
        handleOpenDeleteReconcileBatch={handleOpenDeleteReconcileBatch}
        isBuktiTransferOpen={isBuktiTransferOpen}
        setIsBuktiTransferOpen={setIsBuktiTransferOpen}
        buktiTransferUrl={buktiTransferUrl}
        setBuktiTransferUrl={setBuktiTransferUrl}
        isReconcileEditOpen={isReconcileEditOpen}
        setIsReconcileEditOpen={setIsReconcileEditOpen}
        reconcileEditSubmitting={reconcileEditSubmitting}
        reconcileEditingBatchId={reconcileEditingBatchId}
        reconcileEditPabrikId={reconcileEditPabrikId}
        setReconcileEditTanggal={setReconcileEditTanggal}
        reconcileEditTanggal={reconcileEditTanggal}
        reconcileEditJumlahMasuk={reconcileEditJumlahMasuk}
        setReconcileEditJumlahMasuk={setReconcileEditJumlahMasuk}
        reconcileEditNotas={reconcileEditNotas}
        reconcileEditNotaIds={reconcileEditNotaIds}
        handleReconcileEditToggleNota={handleReconcileEditToggleNota}
        reconcileEditRangeStart={reconcileEditRangeStart}
        setReconcileEditRangeStart={setReconcileEditRangeStart}
        reconcileEditRangeEnd={reconcileEditRangeEnd}
        setReconcileEditRangeEnd={setReconcileEditRangeEnd}
        reconcileEditRangeLoading={reconcileEditRangeLoading}
        reconcileEditRangeCandidates={reconcileEditRangeCandidates}
        handleReconcileEditFetchByRange={handleReconcileEditFetchByRange}
        handleReconcileEditAddAllCandidates={handleReconcileEditAddAllCandidates}
        reconcileEditSetLunas={reconcileEditSetLunas}
        setReconcileEditSetLunas={setReconcileEditSetLunas}
        reconcileEditKeterangan={reconcileEditKeterangan}
        setReconcileEditKeterangan={setReconcileEditKeterangan}
        reconcileEditGambarPreview={reconcileEditGambarPreview}
        setReconcileEditGambarFile={setReconcileEditGambarFile}
        setReconcileEditGambarPreview={setReconcileEditGambarPreview}
        setReconcileEditGambarExistingUrl={setReconcileEditGambarExistingUrl}
        handleSubmitEditReconcileBatch={handleSubmitEditReconcileBatch}
        isReconcileDeleteConfirmOpen={isReconcileDeleteConfirmOpen}
        setIsReconcileDeleteConfirmOpen={setIsReconcileDeleteConfirmOpen}
        reconcileDeleteSubmitting={reconcileDeleteSubmitting}
        reconcileDeletingBatchId={reconcileDeletingBatchId}
        handleConfirmDeleteReconcileBatch={handleConfirmDeleteReconcileBatch}
        duplicateWarningOpen={duplicateWarningOpen}
        setDuplicateWarningOpen={setDuplicateWarningOpen}
        submittingDuplicateProceed={submittingDuplicateProceed}
        duplicateCandidates={duplicateCandidates}
        setDuplicateCandidates={setDuplicateCandidates}
        pendingDuplicatePayload={pendingDuplicatePayload}
        setPendingDuplicatePayload={setPendingDuplicatePayload}
        handleViewDuplicateNota={handleViewDuplicateNota}
        handleProceedDuplicateCreate={handleProceedDuplicateCreate}
        viewImageUrl={viewImageUrl}
        setViewImageUrl={setViewImageUrl}
        viewImageError={viewImageError}
        setViewImageError={setViewImageError}
      />

    </main>
  )
}
