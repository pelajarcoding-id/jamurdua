'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { DataTable } from '@/components/data-table'
import { columns, NotaSawitData } from './columns'
import ModalUbah from './modal'
import ModalDetail from './detail-modal';
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import toast from 'react-hot-toast'
import { UbahStatusModal } from './ubah-status-modal'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { ArrowDownTrayIcon, XMarkIcon, CalendarIcon, PlusIcon, ArrowPathIcon, ClipboardDocumentListIcon, DocumentTextIcon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { convertImageFileToWebp } from '@/lib/image-webp';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox'
import { ModalHeader, ModalContentWrapper, ModalFooter } from '@/components/ui/modal-elements'
 




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
  totalBerat: number;
  totalPembayaran: number;
  totalNota: number;
  lunasCount: number;
  totalPembayaranLunas: number;
  belumLunasCount: number;
  totalPembayaranBelumLunas: number;
}

import { useAuth } from '@/components/AuthProvider';

export default function NotaSawitPage() {
  const { role, id: userId } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [data, setData] = useState<NotaSawitData[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalNotas, setTotalNotas] = useState(0);
  const [limit, setLimit] = useState(10);
  const [refreshToggle, setRefreshToggle] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);
  const [isBulkUbahStatusOpen, setIsBulkUbahStatusOpen] = useState(false);
  const [isBulkHargaOpen, setIsBulkHargaOpen] = useState(false)
  const [bulkHargaValue, setBulkHargaValue] = useState('')
  const [bulkHargaSubmitting, setBulkHargaSubmitting] = useState(false)
  const [duplicateWarningOpen, setDuplicateWarningOpen] = useState(false)
  const [duplicateCandidates, setDuplicateCandidates] = useState<any[]>([])
  const [pendingDuplicatePayload, setPendingDuplicatePayload] = useState<any | null>(null)
  const [submittingDuplicateProceed, setSubmittingDuplicateProceed] = useState(false)
  const [isUbahStatusModalOpen, setIsUbahStatusModalOpen] = useState(false);
  const [selectedNota, setSelectedNota] = useState<NotaSawitData | null>(null);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [rowSelection, setRowSelection] = useState({});
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const debouncedSearchQuery = useDebounce(searchQuery, 500);
  const [cursorId, setCursorId] = useState<number | null>(null);
  const [cursorStack, setCursorStack] = useState<number[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  
  // Date filter state - Default "all"
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [quickRange, setQuickRange] = useState('all');

  useEffect(() => {
    // Initialize with all time - no date filter
    setStartDate(undefined);
    setEndDate(undefined);
  }, []);

  const [kebunList, setKebunList] = useState<{ id: number; name: string }[]>([]);
  const [selectedKebun, setSelectedKebun] = useState<string>('');
  const [pabrikList, setPabrikList] = useState<{ id: number; name: string }[]>([]);
  const [selectedPabrik, setSelectedPabrik] = useState<string>(searchParams.get('pabrikId') || '');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [viewImageUrl, setViewImageUrl] = useState<string | null>(null);
  const [viewImageError, setViewImageError] = useState(false);


  useEffect(() => {
    const paramsSearch = searchParams.get('search') || '';
    if (paramsSearch !== searchQuery) {
      setSearchQuery(paramsSearch);
    }
  }, [searchParams, searchQuery]);

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

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setPage(1);
    setCursorId(null);
    setCursorStack([]);
    setNextCursor(null);
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set('search', value);
    } else {
      params.delete('search');
    }
    router.replace(`?${params.toString()}`);
  };

  const refreshData = useCallback(() => setRefreshToggle(prev => !prev), []);
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    try {
      refreshData();
      toast.success('Data diperbarui');
    } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  }, [refreshData]);

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

  const handleDetail = useCallback((nota: NotaSawitData) => {
    setSelectedNota(nota);
    setIsDetailModalOpen(true);
  }, []);

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
  }, [debouncedSearchQuery, startDate, endDate, selectedKebun, selectedPabrik, selectedStatus, role, userId, limit]);

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
    
    let finalGambarUrl = selectedNota?.gambarNotaUrl || '';

    const toastId = toast.loading(selectedNota ? 'Menyimpan nota...' : 'Menambahkan nota...');

    try {
      if (file) {
          const uploadFormData = new FormData();
          const converted = await convertImageFileToWebp(file, { quality: 0.9, maxDimension: 1920 })
          uploadFormData.append('file', converted);
          
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
             console.error('Upload request failed:', uploadRes.statusText);
             toast.error('Gagal upload gambar: Server Error', { id: toastId });
             return;
          }
      }

      const payload: any = {
        kendaraanPlatNomor: formDataRaw.kendaraanPlatNomor || '',
        supirId: Number(formDataRaw.supirId),
        pabrikSawitId: Number(formDataRaw.pabrikSawitId),
        potongan: Number(formDataRaw.potongan),
        hargaPerKg: Number(formDataRaw.hargaPerKg || 0),
        statusPembayaran: formDataRaw.statusPembayaran || 'BELUM_LUNAS',
        pembayaranAktual: (formDataRaw.pembayaranAktual !== undefined && formDataRaw.pembayaranAktual !== null) ? Number(formDataRaw.pembayaranAktual) : null,
        tanggalBongkar: formDataRaw.tanggalBongkar || undefined,
        keterangan: formDataRaw.keterangan ? String(formDataRaw.keterangan).trim() : null,
        bruto: formDataRaw.bruto !== undefined ? Number(formDataRaw.bruto) : undefined,
        tara: formDataRaw.tara !== undefined ? Number(formDataRaw.tara) : undefined,
        netto: formDataRaw.netto !== undefined ? Number(formDataRaw.netto) : undefined,
        pph25: formDataRaw.pph25 !== undefined ? Number(formDataRaw.pph25) : undefined,
        gambarNotaUrl: finalGambarUrl,
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
      const params = new URLSearchParams({
        page: '1',
        limit: '1',
        search: String(id),
      })
      const res = await fetch(`/api/nota-sawit?${params.toString()}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Gagal memuat detail nota')
      const json = await res.json()
      const nota = Array.isArray(json?.data) ? json.data[0] : null
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
        throw new Error('Gagal menghapus data');
      }

      refreshData();
      toast.success('Nota berhasil dihapus', { id: toastId })
    } catch (error) {
      setData(previousData);
      toast.error('Gagal menghapus data, mengembalikan perubahan.', { id: toastId });
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
        throw new Error('Gagal menghapus nota');
      }

      refreshData();
      toast.success('Nota terpilih berhasil dihapus', { id: toastId })
    } catch (error) {
      setData(previousData);
      toast.error('Gagal menghapus nota, mengembalikan perubahan.', { id: toastId });
      console.error(error);
    }
  }, [rowSelection, data, refreshData]);

  const handleBulkUbahStatus = useCallback(async (status: 'LUNAS' | 'BELUM_LUNAS') => {
    const selectedIds = Object.keys(rowSelection).map(index => data[parseInt(index, 10)].id);
    if (selectedIds.length === 0) return;

    // Validation for LUNAS
    if (status === 'LUNAS') {
        const selectedNotas = Object.keys(rowSelection).map(index => data[parseInt(index, 10)]);
        const invalidNotas = selectedNotas.filter(nota => !nota.hargaPerKg || nota.hargaPerKg <= 0);
        
        if (invalidNotas.length > 0) {
            toast.error(`Gagal: ${invalidNotas.length} nota terpilih belum memiliki harga. Harap isi harga terlebih dahulu.`);
            return;
        }
    }

    const previousData = [...data];
    const updatedData = data.map(item => 
      selectedIds.includes(item.id) ? { ...item, statusPembayaran: status } : item
    );
    setData(updatedData);
    setIsBulkUbahStatusOpen(false);

    const toastId = toast.loading('Mengubah status nota terpilih...')
    try {
      const response = await fetch('/api/nota-sawit/bulk-ubah-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds, status }),
      });

      if (!response.ok) {
        throw new Error('Gagal mengubah status nota');
      }

      refreshData();
      toast.success('Status nota terpilih berhasil diubah', { id: toastId })
    } catch (error) {
      setData(previousData);
      toast.error('Gagal mengubah status nota, mengembalikan perubahan.', { id: toastId });
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
      const pph = Math.round(totalPembayaran * 0.0025)
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
  }, [bulkHargaValue, data, refreshData, rowSelection])

  const handleBulkPrint = async () => {
    const selectedIds = Object.keys(rowSelection);
    if (selectedIds.length === 0) {
      toast.error('Tidak ada nota yang dipilih.');
      return;
    }

    const selectedNotas = selectedIds.map(index => data[parseInt(index, 10)]);
    const jsPDF = (await import('jspdf')).default;
    const autoTable = (await import('jspdf-autotable')).default;
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
      doc.text(`${nota.pabrikSawit.name} • ${nota.supir.name}`, contentMargin, currentY);
      currentY += 6;

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
          { label: 'Potongan PPh (0.25%)', value: `- ${formatCurrency(nota.pph)}` },
          { label: 'Total Pembayaran (Net)', value: formatCurrency(nota.pembayaranSetelahPph), isBold: true },
        ];
        if ((nota as any).pembayaranAktual !== null && (nota as any).pembayaranAktual !== undefined) {
          financeRows.push({ label: 'Pembayaran Aktual', value: formatCurrency((nota as any).pembayaranAktual), isBold: true, color: '#1D4ED8' });
        }
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
        const finalAmount = (nota as any).pembayaranAktual ?? nota.pembayaranSetelahPph;
        doc.text(formatCurrency(finalAmount), rightContentRight, fy, { align: 'right' });
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

    setLoading(true);
    setRowSelection({}); // Reset row selection

    const fetchData = async () => {
      try {
        const startDateString = startDate?.toISOString();
        const endDateString = endDate?.toISOString();

        const params = new URLSearchParams({
          page: String(page),
          limit: String(limit),
          search: debouncedSearchQuery,
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

        const [dataRes, summaryRes] = await Promise.all([
          fetch(`/api/nota-sawit?${queryString}`, { cache: 'no-store' }),
          fetch(`/api/nota-sawit/summary?${queryString}`, { cache: 'no-store' }),
        ]);

        if (!dataRes.ok || !summaryRes.ok) {
          throw new Error('Failed to fetch data');
        }

        const dataPayload = await dataRes.json();
        const summaryPayload = await summaryRes.json();

        if (ignore) return;

        setData(dataPayload.data);
        setTotalNotas(dataPayload.total);
        setSummary(summaryPayload);
        setNextCursor(dataPayload.nextCursor || null);
      } catch (error) {
        if (ignore) return;
        toast.error('Gagal memuat data.');
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    fetchData();

    return () => {
      ignore = true;
    };
  }, [refreshToggle, page, limit, debouncedSearchQuery, startDate, endDate, selectedKebun, selectedPabrik, selectedStatus, role, userId, cursorId, quickRange]);

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

  const tableColumns = useMemo(() => {
    if (role === 'SUPIR') {
      return columns.filter(col => {
        const key = (col as any).accessorKey;
        return !['hargaPerKg', 'totalPembayaran', 'statusPembayaran'].includes(key);
      });
    }
    return columns;
  }, [role]);

  const formatNumber = useCallback((num: number) => new Intl.NumberFormat('id-ID').format(num), [])
  const formatCurrency = useCallback((num: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num), [])

  return (
    <main className="p-4 md:p-8 space-y-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800 tracking-tight">Daftar Nota Sawit</h1>
            <p className="text-gray-500 mt-2 md:mt-0">Kelola data nota sawit Anda di sini.</p>
        </div>

        {loading ? (
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
        ) : summary && (
          <div className="mb-8">
            <div className="card-style p-4 rounded-2xl">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                    <ClipboardDocumentListIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Ringkasan Nota Sawit</p>
                    <p className="text-xs text-gray-500">Status pembayaran dan total tonase</p>
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  Periode: <span className="font-semibold text-gray-900">{dateDisplay}</span>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-xl bg-emerald-50/60 px-3 py-2">
                  <p className="text-xs text-emerald-700">Total Nota</p>
                  <p className="text-lg font-semibold text-gray-900" title={summary.totalNota.toLocaleString('id-ID')}>
                    {summary.totalNota.toLocaleString('id-ID')}
                  </p>
                </div>
                <div className="rounded-xl bg-amber-50/70 px-3 py-2">
                  <p className="text-xs text-amber-700">Total Tonase (Berat Akhir)</p>
                  <p className="text-lg font-semibold text-gray-900" title={`${summary.totalBerat.toLocaleString('id-ID')} Kg`}>
                    {summary.totalBerat.toLocaleString('id-ID')} Kg
                  </p>
                </div>
                {role !== 'SUPIR' && (
                  <>
                    <div className="rounded-xl bg-sky-50/70 px-3 py-2">
                      <p className="text-xs text-sky-700">Total Pembayaran</p>
                      <p className="text-lg font-semibold text-gray-900" title={formatCurrency(summary.totalPembayaran)}>
                        {formatCurrency(summary.totalPembayaran)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-emerald-50/60 px-3 py-2">
                      <p className="text-xs text-emerald-700">Lunas / Belum Lunas</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {summary.lunasCount.toLocaleString('id-ID')} / {summary.belumLunasCount.toLocaleString('id-ID')}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="card-style">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
            <div className="grid grid-cols-2 lg:flex lg:flex-row lg:flex-nowrap items-start lg:items-center gap-4 flex-1 w-full lg:w-auto">
              <div className="col-span-2 w-full lg:w-auto lg:flex-1">
                <Input
                    type="text"
                    placeholder="Cari supir atau plat nomor..."
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="input-style rounded-lg"
                />
              </div>
              <div className="col-span-1 w-full lg:w-auto lg:flex-1 flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="date"
                      variant={"outline"}
                      className={cn(
                        "w-full lg:w-full justify-start text-left font-normal bg-white",
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
                        <Button variant="outline" size="sm" onClick={() => applyQuickRange('all')} className={quickRange === 'all' ? 'bg-accent' : ''}>Semua</Button>
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
                              value={startDate ? toWibYmd(startDate) : ''}
                              onChange={(e) => {
                                setStartDate(e.target.value ? wibStartFromYmd(e.target.value) : undefined);
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
                              value={endDate ? toWibYmd(endDate) : ''}
                              onChange={(e) => {
                                setEndDate(e.target.value ? wibEndFromYmd(e.target.value) : undefined);
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
              <select
                value={selectedKebun}
                onChange={(e) => setSelectedKebun(e.target.value)}
                className="w-full lg:w-auto lg:flex-1 input-style rounded-lg"
              >
                <option value="">Semua Kebun</option>
                {kebunList.map((kebun) => (
                  <option key={kebun.id} value={kebun.id}>
                    {kebun.name}
                  </option>
                ))}
              </select>
              <select
                value={selectedPabrik}
                onChange={(e) => setSelectedPabrik(e.target.value)}
                className="w-full lg:w-auto lg:flex-1 input-style rounded-lg"
              >
                <option value="">Semua Pabrik</option>
                {pabrikList.map((pabrik) => (
                  <option key={pabrik.id} value={pabrik.id}>
                    {pabrik.name}
                  </option>
                ))}
              </select>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="col-span-1 w-full lg:w-auto lg:flex-1 input-style rounded-lg"
              >
                <option value="">Semua Status</option>
                <option value="LUNAS">Lunas</option>
                <option value="BELUM_LUNAS">Belum Lunas</option>
              </select>
              <div className="col-span-1 w-full lg:w-auto lg:flex-1 flex items-center">
                <Button
                  onClick={handleRefresh}
                  variant="outline"
                  size="icon"
                  className="rounded-full"
                  title="Refresh data"
                  aria-label="Refresh data"
                >
                  <ArrowPathIcon className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
          </div>

          {Object.keys(rowSelection).length > 0 && (
          <div className="mb-6 p-4 bg-blue-50 rounded-2xl border border-blue-100 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
              <span className="text-sm font-semibold text-blue-700 sm:mr-2">{Object.keys(rowSelection).length} terpilih:</span>
              {role !== 'SUPIR' ? (
                <>
                  <Button variant="destructive" onClick={() => setIsBulkDeleteConfirmOpen(true)} className="rounded-full w-full sm:w-auto">
                    Hapus
                  </Button>
                  <Button onClick={() => setIsBulkUbahStatusOpen(true)} className="rounded-full w-full sm:w-auto">
                    Ubah Status
                  </Button>
                  <Button onClick={() => setIsBulkHargaOpen(true)} className="rounded-full w-full sm:w-auto">
                    Update Harga
                  </Button>
                </>
              ) : null}
              <Button variant="destructive" onClick={handleBulkPrint} className="inline-flex items-center gap-2 rounded-full w-full sm:w-auto">
                <ArrowDownTrayIcon className="w-4 h-4" />
                Ekspor PDF
              </Button>
            </div>
          )}

          <div className="md:hidden space-y-3">
            {loading ? (
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
      </div>

      {isModalOpen && (
        <ModalUbah
          nota={selectedNota}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onSave={handleSave}
        />
      )}

      <ConfirmationModal
        isOpen={isConfirmOpen}
        onClose={handleCloseConfirm}
        onConfirm={handleDelete}
        title="Konfirmasi Hapus"
        description="Apakah Anda yakin ingin menghapus data ini?"
        variant="emerald"
      />

      <ConfirmationModal
        isOpen={isBulkDeleteConfirmOpen}
        onClose={() => setIsBulkDeleteConfirmOpen(false)}
        onConfirm={handleBulkDelete}
        title="Konfirmasi Hapus Massal"
        description={`Apakah Anda yakin ingin menghapus ${Object.keys(rowSelection).length} nota yang dipilih? Aksi ini tidak dapat dibatalkan.`}
        variant="emerald"
      />

      {isDetailModalOpen && selectedNota && (
        <ModalDetail
          nota={selectedNota}
          onClose={handleCloseDetailModal}
          onEdit={handleEditFromDetail}
          onDelete={handleDeleteFromDetail}
        />
      )}

      <UbahStatusModal
        isOpen={isUbahStatusModalOpen}
        onClose={handleCloseUbahStatusModal}
        nota={selectedNota}
        onSave={handleSaveStatus}
      />

      {isBulkUbahStatusOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
          <div className="bg-white w-[92vw] sm:w-full sm:max-w-[520px] max-h-[92vh] rounded-2xl overflow-hidden shadow-xl p-0 flex flex-col">
            <ModalHeader
              title="Ubah Status Pembayaran Massal"
              subtitle={`Pilih status baru untuk ${Object.keys(rowSelection).length} nota yang dipilih.`}
              variant="emerald"
              icon={<ClipboardDocumentListIcon className="h-5 w-5 text-white" />}
              onClose={() => setIsBulkUbahStatusOpen(false)}
            />
            <ModalContentWrapper className="flex-1 min-h-0 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <div className="flex flex-col space-y-4">
                <button 
                  onClick={() => handleBulkUbahStatus('LUNAS')} 
                  className="w-full px-4 py-2 rounded-md text-white bg-green-500 border border-green-600 hover:bg-green-600"
                >
                  Ubah menjadi LUNAS
                </button>
                <button 
                  onClick={() => handleBulkUbahStatus('BELUM_LUNAS')} 
                  className="w-full px-4 py-2 rounded-md text-white bg-yellow-500 border border-yellow-600 hover:bg-yellow-600"
                >
                  Ubah menjadi BELUM LUNAS
                </button>
              </div>
            </ModalContentWrapper>
            <ModalFooter className="sm:justify-end">
              <Button variant="outline" className="rounded-full" onClick={() => setIsBulkUbahStatusOpen(false)}>
                Batal
              </Button>
            </ModalFooter>
          </div>
        </div>
      )}

      {isBulkHargaOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
          <div className="bg-white w-[92vw] sm:w-full sm:max-w-[520px] max-h-[92vh] rounded-2xl overflow-hidden shadow-xl p-0 flex flex-col">
            <ModalHeader
              title="Update Harga Massal"
              subtitle={`Set harga per kg untuk ${Object.keys(rowSelection).length} nota yang dipilih.`}
              variant="emerald"
              icon={<ClipboardDocumentListIcon className="h-5 w-5 text-white" />}
              onClose={() => { if (!bulkHargaSubmitting) setIsBulkHargaOpen(false) }}
            />
            <ModalContentWrapper className="flex-1 min-h-0 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Harga / Kg</Label>
                  <Input
                    inputMode="numeric"
                    value={bulkHargaValue}
                    onChange={(e) => setBulkHargaValue(e.target.value)}
                    placeholder="contoh: 2000"
                    className="rounded-xl"
                    disabled={bulkHargaSubmitting}
                  />
                  <div className="text-xs text-gray-500">
                    Catatan: jika ada nota yang sudah LUNAS, nilai pemasukan kas & jurnal akan disesuaikan otomatis.
                  </div>
                </div>
              </div>
            </ModalContentWrapper>
            <ModalFooter className="sm:justify-end">
              <Button variant="outline" className="rounded-full" onClick={() => setIsBulkHargaOpen(false)} disabled={bulkHargaSubmitting}>
                Batal
              </Button>
              <Button className="rounded-full" onClick={handleBulkUpdateHarga} disabled={bulkHargaSubmitting}>
                {bulkHargaSubmitting ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </ModalFooter>
          </div>
        </div>
      )}

      <Dialog
        open={duplicateWarningOpen}
        onOpenChange={(open) => {
          if (!open && !submittingDuplicateProceed) {
            setDuplicateWarningOpen(false)
            setDuplicateCandidates([])
            setPendingDuplicatePayload(null)
          }
        }}
      >
        <DialogContent className="w-[96vw] sm:w-full sm:max-w-2xl max-h-[92vh] p-0 overflow-hidden rounded-2xl shadow-2xl border-none flex flex-col [&>button.absolute]:hidden">
          <ModalHeader
            title="Peringatan Duplikasi Nota"
            subtitle="Ditemukan nota lain dengan data identik. Pastikan ini bukan input ganda."
            variant="emerald"
            icon={<DocumentTextIcon className="h-5 w-5 text-white" />}
            onClose={() => {
              if (submittingDuplicateProceed) return
              setDuplicateWarningOpen(false)
              setDuplicateCandidates([])
              setPendingDuplicatePayload(null)
            }}
          />
          <ModalContentWrapper className="flex-1 min-h-0 overflow-y-auto">
            <div className="space-y-3">
              <div className="text-sm text-gray-700">
                Sistem menemukan nota dengan kombinasi yang sama: Tanggal Bongkar, Pabrik, Supir, Kendaraan, Bruto, Tara, Netto, Potongan, dan Berat Akhir.
              </div>
              <div className="space-y-2">
                {(duplicateCandidates || []).length === 0 ? (
                  <div className="text-sm text-gray-500">Tidak ada kandidat.</div>
                ) : (
                  duplicateCandidates.map((d: any) => (
                    <div key={String(d?.id)} className="rounded-xl border border-gray-100 bg-white p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold text-gray-900">Nota #{d?.id}</div>
                          <div className="text-xs text-gray-500">
                            {d?.tanggalBongkar ? new Date(d.tanggalBongkar).toLocaleDateString('id-ID') : '-'} • {d?.kebunName || '-'} • {d?.pabrikSawit?.name || '-'} • {d?.supir?.name || '-'} • {d?.kendaraanPlatNomor || '-'}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          className="rounded-full"
                          onClick={() => {
                            handleViewDuplicateNota(Number(d?.id))
                          }}
                        >
                          Lihat
                        </Button>
                      </div>
                      <div className="mt-2 grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                        <div className="rounded-lg bg-gray-50 px-2 py-1">
                          <div className="text-gray-500">Bruto</div>
                          <div className="font-semibold text-gray-900">{formatNumber(Number(d?.bruto || 0))}</div>
                        </div>
                        <div className="rounded-lg bg-gray-50 px-2 py-1">
                          <div className="text-gray-500">Tara</div>
                          <div className="font-semibold text-gray-900">{formatNumber(Number(d?.tara || 0))}</div>
                        </div>
                        <div className="rounded-lg bg-gray-50 px-2 py-1">
                          <div className="text-gray-500">Netto</div>
                          <div className="font-semibold text-gray-900">{formatNumber(Number(d?.netto || 0))}</div>
                        </div>
                        <div className="rounded-lg bg-gray-50 px-2 py-1">
                          <div className="text-gray-500">Potongan</div>
                          <div className="font-semibold text-gray-900">{formatNumber(Number(d?.potongan || 0))}</div>
                        </div>
                        <div className="rounded-lg bg-gray-50 px-2 py-1">
                          <div className="text-gray-500">Berat Akhir</div>
                          <div className="font-semibold text-gray-900">{formatNumber(Number(d?.beratAkhir || 0))}</div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </ModalContentWrapper>
          <ModalFooter className="sm:justify-between">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => {
                if (submittingDuplicateProceed) return
                setDuplicateWarningOpen(false)
                setDuplicateCandidates([])
                setPendingDuplicatePayload(null)
              }}
              disabled={submittingDuplicateProceed}
            >
              Batal
            </Button>
            <Button
              className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleProceedDuplicateCreate}
              disabled={submittingDuplicateProceed || !pendingDuplicatePayload}
            >
              {submittingDuplicateProceed ? 'Menyimpan...' : 'Tetap Simpan'}
            </Button>
          </ModalFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewImageUrl} onOpenChange={(open) => !open && setViewImageUrl(null)}>
        <DialogContent className="max-w-5xl w-[95vw] p-0 overflow-hidden border-none bg-white shadow-2xl [&>button.absolute]:hidden">
          {viewImageUrl && (
            <div className="flex flex-col h-full max-h-[90vh]">
              <ModalHeader
                title="Pratinjau Nota"
                subtitle="Gambar lampiran nota sawit"
                variant="emerald"
                icon={<DocumentTextIcon className="h-5 w-5 text-white" />}
                onClose={() => { setViewImageUrl(null); setViewImageError(false); }}
              />

              {/* Image Content */}
              <div className="flex-1 overflow-auto flex items-center justify-center p-4 md:p-8 min-h-0 bg-gray-50/50">
                {!viewImageError ? (
                  <img
                    src={viewImageUrl}
                    alt="Bukti Nota"
                    className="max-w-full max-h-[65vh] md:max-h-[70vh] w-auto h-auto object-contain shadow-2xl rounded-md border border-gray-100"
                    onError={() => setViewImageError(true)}
                  />
                ) : (
                  <div className="flex items-center justify-center w-full h-[40vh]">
                    <div className="px-4 py-3 rounded-md bg-white shadow text-gray-700">
                      Gambar tidak ditemukan atau tidak dapat dimuat.
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              {!viewImageError && (
                <ModalFooter className="sm:justify-center">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 rounded-md border border-white bg-white text-emerald-600 hover:bg-gray-50 hover:text-emerald-700 shadow-sm transition-colors"
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = viewImageUrl;
                      link.download = `Nota-Sawit-${Date.now()}.jpg`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    title="Download Gambar"
                  >
                    <ArrowDownTrayIcon className="w-4 h-4" />
                  </Button>
                </ModalFooter>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {role !== 'SUPIR' ? (
        <Button
          onClick={() => { setSelectedNota(null); setIsModalOpen(true); }}
          className="fixed bottom-6 right-6 w-14 h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center z-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
          title="Tambah Nota"
          size="icon"
        >
          <PlusIcon className="w-8 h-8" />
        </Button>
      ) : null}

    </main>
  )
}
