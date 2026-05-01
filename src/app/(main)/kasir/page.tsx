'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { useAuth } from '@/components/AuthProvider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from '@/components/ui/button';
import { DocumentTextIcon, CalendarIcon, PlusIcon, ArrowPathIcon, ArrowDownTrayIcon, TagIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

import { columns } from './columns';
import { DataTable } from '@/components/data-table';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import KasirPageModals from './KasirPageModals';
import { useKasirModalsState } from './useKasirModalsState';
import { createWIBDate, formatWIBDateDisplay, formatWIBDateForInput, getCurrentWIBDateParts, parseWIBDateFromInput } from '@/lib/wib-date';

import { KasirData, KasTransaksi } from '@/types/kasir';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value);
};

const formatDateDisplay = formatWIBDateDisplay;

type KasTransaksiUI = KasTransaksi & {
  __optimistic?: boolean
  __optimisticKey?: string
}

type KasirDataUI = Omit<KasirData, 'transactions'> & {
  transactions: KasTransaksiUI[]
}

const KasirPage = () => {
  const [data, setData] = useState<KasirDataUI | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Date state as Date objects
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  
  useEffect(() => {
    // Initialize dates using WIB
    const { year, month, day } = getCurrentWIBDateParts();
    const start = createWIBDate(year, 0, 1);
    const end = createWIBDate(year, month, day, true);
    
    setQuickRange('this_year')
    setStartDate(start);
    setEndDate(end);
  }, []);
  const [quickRange, setQuickRange] = useState('this_year');
  const [refreshing, setRefreshing] = useState(false);
  const {
    isFormOpen,
    setIsFormOpen,
    editingTransaction,
    setEditingTransaction,
    isDetailOpen,
    setIsDetailOpen,
    detailTransaction,
    setDetailTransaction,
    openDelete,
    setOpenDelete,
    deleteId,
    setDeleteId,
    viewImageUrl,
    setViewImageUrl,
  } = useKasirModalsState()

  // Auth & Admin features
  const { role, id: currentUserId } = useAuth();
  const isAdmin = role === 'ADMIN' || role === 'PEMILIK';
  const [users, setUsers] = useState<{ id: number; name: string }[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [hasSetDefaultUser, setHasSetDefaultUser] = useState(false);
  const [perusahaanList, setPerusahaanList] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    if ((role === 'ADMIN' || role === 'PEMILIK') && currentUserId && !hasSetDefaultUser) {
      setSelectedUserId(String(currentUserId)); // Default: tampilkan transaksi user sendiri untuk ADMIN/PEMILIK
      setHasSetDefaultUser(true);
    }
  }, [role, currentUserId, hasSetDefaultUser]);

  useEffect(() => {
    if (isAdmin) {
      fetch('/api/users?limit=1000')
        .then(res => res.json())
        .then(data => {
          if (data.data) {
            // Filter only ADMIN, PEMILIK, and KASIR roles
            const allowedRoles = ['ADMIN', 'PEMILIK', 'KASIR'];
            const filteredUsers = data.data.filter((u: any) => allowedRoles.includes(u.role));
            setUsers(filteredUsers);
          }
        })
        .catch(err => console.error('Failed to fetch users', err));
    }
  }, [isAdmin]);

  useEffect(() => {
    fetch('/api/perusahaan?limit=1000')
      .then(res => res.json())
      .then(json => {
        const data = Array.isArray(json?.data) ? json.data : []
        setPerusahaanList(data)
      })
      .catch(() => setPerusahaanList([]))
  }, [])

  // Pagination state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTipe, setSelectedTipe] = useState<'all' | 'PEMASUKAN' | 'PENGELUARAN'>('all');
  const [userQuery, setUserQuery] = useState('');
  const [categoryQuery, setCategoryQuery] = useState('');
  const [kasKategoriOptions, setKasKategoriOptions] = useState<Array<{ value: string; label: string }>>([])
  useEffect(() => {
    const fetchKategori = async () => {
      try {
        const res = await fetch('/api/kas-kategori')
        if (!res.ok) return
        const data = await res.json()
        if (!Array.isArray(data)) return
        const mapped = data
          .map((r: any) => ({
            value: String(r?.code || '').toUpperCase(),
            label: String(r?.label || r?.code || '').toUpperCase(),
          }))
          .filter((r: any) => !!r.value)
        setKasKategoriOptions(mapped)
      } catch {
        setKasKategoriOptions([])
      }
    }
    fetchKategori()
  }, [])

  const categoryOptions = useMemo(() => {
    const fallback = [
      { value: 'UMUM', label: 'UMUM' },
      { value: 'KEBUN', label: 'KEBUN' },
      { value: 'KENDARAAN', label: 'KENDARAAN' },
      { value: 'GAJI', label: 'GAJI' },
      { value: 'HUTANG_KARYAWAN', label: 'HUTANG KARYAWAN' },
      { value: 'PEMBAYARAN_HUTANG', label: 'PEMBAYARAN HUTANG' },
      { value: 'PENJUALAN_SAWIT', label: 'PENJUALAN SAWIT' },
    ]
    const list = kasKategoriOptions.length > 0 ? kasKategoriOptions : fallback
    return [{ value: 'all', label: 'Semua Kategori' }, ...list]
  }, [kasKategoriOptions])

  const categoryLabelMap: Record<string, string> = useMemo(
    () => categoryOptions.reduce((acc, c) => { acc[c.value] = c.label; return acc }, {} as Record<string, string>),
    [categoryOptions]
  )
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const q = searchParams.get('search') || '';
    setSearchQuery((prev) => (prev === q ? prev : q))
    setSearchDraft((prev) => (prev === q ? prev : q))
  }, [searchParams]);

  const dateDisplay = () => {
    if (quickRange && quickRange !== 'custom') {
      switch (quickRange) {
        case 'today': return 'Hari Ini';
        case 'yesterday': return 'Kemarin';
        case 'last_week': return 'Minggu Lalu';
        case 'this_month': return 'Bulan Ini';
        case 'this_year': return 'Tahun Ini';
        default: return 'Pilih Rentang Waktu';
      }
    }
    if (startDate && endDate) {
       const fmt = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' });
       return `${fmt.format(startDate)} - ${fmt.format(endDate)}`;
    }
    return 'Pilih Rentang Waktu';
  };

  const applyQuickRange = (val: string) => {
    const { year, month, day } = getCurrentWIBDateParts();
    setQuickRange(val);
    
    if (val === 'today') {
      setStartDate(createWIBDate(year, month, day));
      setEndDate(createWIBDate(year, month, day, true));
    } else if (val === 'yesterday') {
      setStartDate(createWIBDate(year, month, day - 1));
      setEndDate(createWIBDate(year, month, day - 1, true));
    } else if (val === 'last_week') {
      setStartDate(createWIBDate(year, month, day - 7));
      setEndDate(createWIBDate(year, month, day, true));
    } else if (val === 'this_month') {
      setStartDate(createWIBDate(year, month, 1));
      setEndDate(createWIBDate(year, month, day, true));
    } else if (val === 'this_year') {
      setStartDate(createWIBDate(year, 0, 1));
      setEndDate(createWIBDate(year, month, day, true));
    }
  };

  const fetchData = useCallback(async () => {
    if (!startDate || !endDate) return;

    setIsLoading(true);
    try {
      let url = `/api/kasir?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}&page=${page}&limit=${limit}&search=${encodeURIComponent(searchQuery)}`;
      if (selectedUserId !== 'all') {
        url += `&filterUserId=${selectedUserId}`;
      }
      if (selectedCategory !== 'all') {
        url += `&kategori=${selectedCategory}`;
      }
      if (selectedTipe !== 'all') {
        url += `&tipe=${selectedTipe}`;
      }
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Gagal mengambil data kasir');
      }
      const result = await response.json();
      setData(result);
      setErrorMessage(null);
    } catch (error) {
      console.error(error);
      const msg = error instanceof Error ? error.message : 'Gagal mengambil data kasir.';
      toast.error(msg);
      setErrorMessage(msg);
      setData(null); // Clear data on error
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate, page, limit, searchQuery, selectedUserId, selectedCategory, selectedTipe]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchData();
      toast.success('Data diperbarui');
    } finally {
      setRefreshing(false);
    }
  }, [fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const applySearch = useCallback(() => {
    const trimmed = String(searchDraft || '').trim()
    if (trimmed && trimmed.length < 2) return
    setSearchQuery(trimmed)
    setPage(1)
    const params = new URLSearchParams(searchParams.toString())
    if (trimmed) params.set('search', trimmed)
    else params.delete('search')
    router.replace(`${pathname}?${params.toString()}`)
  }, [pathname, router, searchDraft, searchParams])

  const handleEdit = (trx: KasTransaksi) => {
    setEditingTransaction(trx);
    setIsFormOpen(true);
  };
  
  const handleDetail = (trx: KasTransaksi) => {
    setDetailTransaction(trx);
    setIsDetailOpen(true);
  };

  const handleSaveTransaksi = useCallback(async (formData: any) => {
    // Store previous state for rollback
    const previousData = data;
    const isEdit = !!editingTransaction;
    const optimisticKey = `${Date.now()}-${Math.random().toString(16).slice(2)}`
    const optimisticId = -Math.floor(Date.now() / 1000);

    // Optimistic Update
    setData(prev => {
        if (!prev) return null;
        
        let newTransactions = [...prev.transactions];
        let totalPemasukan = prev.totalPemasukan;
        let totalPengeluaran = prev.totalPengeluaran;
        let saldoAkhir = prev.saldoAkhir;
        let totalItems = prev.totalItems;

        const amount = formData.jumlah;
        const isPemasukan = formData.tipe === 'PEMASUKAN';

        if (isEdit && editingTransaction) {
             // Revert old transaction stats
             const oldTrx = editingTransaction;
             const oldIsPemasukan = oldTrx.tipe === 'PEMASUKAN';
             totalPemasukan = oldIsPemasukan ? totalPemasukan - oldTrx.jumlah : totalPemasukan;
             totalPengeluaran = !oldIsPemasukan ? totalPengeluaran - oldTrx.jumlah : totalPengeluaran;
             saldoAkhir = oldIsPemasukan ? saldoAkhir - oldTrx.jumlah : saldoAkhir + oldTrx.jumlah;

             // Add new transaction stats
             totalPemasukan = isPemasukan ? totalPemasukan + amount : totalPemasukan;
             totalPengeluaran = !isPemasukan ? totalPengeluaran + amount : totalPengeluaran;
             saldoAkhir = isPemasukan ? saldoAkhir + amount : saldoAkhir - amount;

             // Update list
             newTransactions = newTransactions.map(t => t.id === editingTransaction.id ? { ...t, ...formData, updatedAt: new Date().toISOString(), __optimistic: true, __optimisticKey: optimisticKey } : t);
        } else {
             // Create Logic
             const optimisticItem: KasTransaksiUI = {
                 id: optimisticId,
                 ...formData,
                 createdAt: new Date().toISOString(),
                 updatedAt: new Date().toISOString(),
                 __optimistic: true,
                 __optimisticKey: optimisticKey,
             };
             newTransactions = [optimisticItem, ...newTransactions];
             totalPemasukan = isPemasukan ? totalPemasukan + amount : totalPemasukan;
             totalPengeluaran = !isPemasukan ? totalPengeluaran + amount : totalPengeluaran;
             saldoAkhir = isPemasukan ? saldoAkhir + amount : saldoAkhir - amount;
             totalItems += 1;
        }

        return {
            ...prev,
            transactions: newTransactions,
            totalPemasukan,
            totalPengeluaran,
            saldoAkhir,
            totalItems
        };
    });

    // Perform API call
    const performApiCall = async () => {
        try {
            const method = isEdit ? 'PUT' : 'POST';
            const body = isEdit ? { ...formData, id: editingTransaction?.id } : formData;

            const response = await fetch('/api/kasir', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                cache: 'no-store',
                credentials: 'include',
            });

            if (!response.ok) {
                const errJson = await response.json().catch(() => ({} as any))
                throw new Error(errJson?.error || 'Gagal menyimpan transaksi')
            }

            const serverData = await response.json().catch(() => null)
            const serverId = serverData?.id ? Number(serverData.id) : null
            const serverCreatedAt = serverData?.createdAt ? String(serverData.createdAt) : null
            const serverUpdatedAt = serverData?.updatedAt ? String(serverData.updatedAt) : null
            setData(prev => {
              if (!prev) return prev
              const next = prev.transactions.map(t => {
                if (t.__optimisticKey !== optimisticKey) return t
                const base: KasTransaksiUI = { ...t, __optimistic: false, __optimisticKey: undefined }
                if (!isEdit && serverId) base.id = serverId
                if (serverCreatedAt) base.createdAt = serverCreatedAt
                if (serverUpdatedAt) base.updatedAt = serverUpdatedAt
                return base
              })
              return { ...prev, transactions: next }
            })
            
            toast.success(`Transaksi berhasil ${isEdit ? 'diperbarui' : 'disimpan'}!`);
            fetchData();

        } catch (error) {
            console.error(error);
            const message =
              error instanceof Error
                ? error.message
                : 'Gagal menyimpan transaksi'
            const isNetworkError =
              typeof message === 'string' &&
              (message.toLowerCase().includes('failed to fetch') || message.toLowerCase().includes('networkerror'))
            toast.error(
              isNetworkError
                ? 'Gagal menyimpan transaksi (koneksi bermasalah/offline).'
                : `Gagal menyimpan transaksi: ${message}`
            );
            setData(previousData); // Rollback
        }
    };

    await performApiCall();
    
  }, [data, fetchData, editingTransaction]);

  const handleDelete = (id: number) => {
    setDeleteId(id);
    setOpenDelete(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteId) return;

    const previousData = data;

    setData(prev => {
        if (!prev) return null;
        const deletedItem = prev.transactions.find(t => t.id === deleteId);
        if (!deletedItem) return prev;

        const isPemasukan = deletedItem.tipe === 'PEMASUKAN';
        const amount = deletedItem.jumlah;

        return {
            ...prev,
            transactions: prev.transactions.filter(t => t.id !== deleteId),
            totalPemasukan: isPemasukan ? prev.totalPemasukan - amount : prev.totalPemasukan,
            totalPengeluaran: !isPemasukan ? prev.totalPengeluaran - amount : prev.totalPengeluaran,
            saldoAkhir: isPemasukan ? prev.saldoAkhir - amount : prev.saldoAkhir + amount,
            totalItems: prev.totalItems - 1
        };
    });

    try {
        const res = await fetch(`/api/kasir?id=${deleteId}`, { method: 'DELETE' });
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({} as any))
          throw new Error((errJson as any)?.error || 'Gagal menghapus')
        }
        toast.success('Transaksi dihapus');
        fetchData();
    } catch (err) {
        console.error(err);
        toast.error(err instanceof Error ? err.message : 'Gagal menghapus transaksi');
        setData(previousData);
    } finally {
        setOpenDelete(false);
        setDeleteId(null);
    }
  };

  const handleExportPdf = async () => {
    try {
      if (!startDate || !endDate) {
        toast.error('Rentang waktu harus dipilih');
        return;
      }
      toast.loading('Mempersiapkan PDF...');
      // Fetch all data for the selected range (ignoring pagination limits for export)
      let url = `/api/kasir?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}&page=1&limit=10000&search=${searchQuery}`;
      if (selectedUserId !== 'all') {
        url += `&filterUserId=${selectedUserId}`;
      }
      if (selectedCategory !== 'all') {
        url += `&kategori=${selectedCategory}`;
      }
      if (selectedTipe !== 'all') {
        url += `&tipe=${selectedTipe}`;
      }
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Gagal mengambil data untuk ekspor');
      }
      
      const result = await response.json();
      const transactions: KasTransaksi[] = result.transactions || [];

      if (transactions.length === 0) {
        toast.dismiss();
        toast.error('Tidak ada data untuk diekspor');
        return;
      }

      const jsPDF = (await import('jspdf')).default;
      const autoTable = (await import('jspdf-autotable')).default;

      const doc = new jsPDF({ orientation: 'landscape' });

      // Title
      doc.setFontSize(18);
      doc.text('Laporan Transaksi Kasir', 14, 22);

      // Period and User Info
      doc.setFontSize(11);
      const formattedStart = format(new Date(startDate), 'dd MMMM yyyy', { locale: id });
      const formattedEnd = format(new Date(endDate), 'dd MMMM yyyy', { locale: id });
      doc.text(`Periode: ${formattedStart} - ${formattedEnd}`, 14, 30);

      if (selectedUserId !== 'all') {
        const selectedUser = users.find(u => u.id.toString() === selectedUserId);
        if (selectedUser) {
            doc.text(`User: ${selectedUser.name}`, 14, 36);
        }
      } else if (isAdmin) {
          doc.text(`User: Semua User`, 14, 36);
      }

      // Summary
      doc.setFontSize(10);
      const summaryStartY = selectedUserId !== 'all' || isAdmin ? 46 : 40;
      const saldoAwal = typeof result?.saldoAwal === 'number' ? result.saldoAwal : 0
      const totalPemasukan = typeof result?.totalPemasukan === 'number' ? result.totalPemasukan : 0
      const totalPengeluaran = typeof result?.totalPengeluaran === 'number' ? result.totalPengeluaran : 0
      const saldoAkhir = typeof result?.saldoAkhir === 'number' ? result.saldoAkhir : saldoAwal + totalPemasukan - totalPengeluaran
      doc.text(`Saldo Awal: ${formatCurrency(saldoAwal)}`, 14, summaryStartY);
      doc.text(`Total Pemasukan: ${formatCurrency(totalPemasukan)}`, 14, summaryStartY + 5);
      doc.text(`Total Pengeluaran: ${formatCurrency(totalPengeluaran)}`, 14, summaryStartY + 10);
      doc.text(`Saldo Akhir: ${formatCurrency(saldoAkhir)}`, 14, summaryStartY + 15);

      // Prepare data with images and categories
      const tableRows = await Promise.all(transactions.map(async (t) => {
        let imgData: string | null = null;
        if (t.gambarUrl) {
          try {
            // Load image for PDF
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.src = t.gambarUrl;
            await new Promise((resolve, reject) => {
              img.onload = resolve;
              img.onerror = reject;
            });
            
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0);
              imgData = canvas.toDataURL('image/jpeg');
            }
          } catch (error) {
            console.error('Gagal memuat gambar untuk PDF:', error);
          }
        }

        // Format Category
        let categoryDisplay = t.kategori || 'UMUM';
        if (t.kategori === 'KEBUN' && t.kebun) {
          categoryDisplay = `KEBUN: ${t.kebun.name}`;
        } else if (t.kategori === 'KENDARAAN' && t.kendaraan) {
          categoryDisplay = `KENDARAAN: ${t.kendaraan.platNomor}`;
        } else if (t.kategori === 'GAJI' && t.karyawan) {
          categoryDisplay = `GAJI: ${t.karyawan.name}`;
        } else if (t.kategori === 'HUTANG_KARYAWAN' && t.karyawan) {
          categoryDisplay = `HUTANG: ${t.karyawan.name}`;
        } else if (t.kategori === 'PEMBAYARAN_HUTANG' && t.karyawan) {
          categoryDisplay = `BAYAR HUTANG: ${t.karyawan.name}`;
        }

        return {
          date: format(new Date(t.date), 'dd/MM/yyyy'),
          tipe: t.tipe,
          deskripsi: t.deskripsi,
          jumlah: formatCurrency(t.jumlah),
          kategori: categoryDisplay,
          keterangan: formatKeterangan(t.keterangan),
          imgData: imgData
        };
      }));

      const bodyData = tableRows.map(row => [
        row.date,
        row.tipe,
        row.deskripsi,
        row.jumlah,
        row.kategori,
        row.keterangan,
        '' // Placeholder for image
      ]);

      autoTable(doc, {
        head: [['Tanggal', 'Tipe', 'Deskripsi', 'Jumlah', 'Kategori', 'Keterangan', 'Bukti']],
        body: bodyData,
        startY: selectedUserId !== 'all' || isAdmin ? 70 : 60,
        theme: 'grid',
        headStyles: { fillColor: [22, 160, 133] },
        styles: { fontSize: 9, cellPadding: 2, valign: 'middle' },
        rowPageBreak: 'avoid', // Prevent rows from splitting
        margin: { bottom: 20 }, // Ensure bottom margin
        columnStyles: {
            0: { cellWidth: 25 },
            1: { cellWidth: 25 },
            3: { cellWidth: 35, halign: 'right' },
            4: { cellWidth: 40 },
            6: { cellWidth: 25, minCellHeight: 25 } // Kolom Bukti with min height for layout calculation
        },
        didDrawCell: (data: any) => {
            if (data.column.index === 6 && data.cell.section === 'body') {
                const rowIndex = data.row.index;
                const imgData = tableRows[rowIndex]?.imgData;
                if (imgData) {
                    // Use fixed size for consistency
                    const imgSize = 20; 
                    
                    // Center the image in the cell
                    const x = data.cell.x + (data.cell.width - imgSize) / 2;
                    const y = data.cell.y + (data.cell.height - imgSize) / 2;
                    
                    doc.addImage(imgData, 'JPEG', x, y, imgSize, imgSize);
                }
            }
        }
      });

      doc.save(`laporan-kasir-${startDate}-sd-${endDate}.pdf`);
      toast.dismiss();
      toast.success('PDF berhasil diunduh');
    } catch (error) {
      console.error(error);
      toast.dismiss();
      toast.error('Gagal mengekspor PDF');
    }
  };

  const totals = useMemo(() => {
    if (!data) return { pemasukan: 0, pengeluaran: 0, saldo: 0, saldoAwal: 0 };
    if (selectedCategory === 'all') {
      return {
        pemasukan: data.totalPemasukan ?? 0,
        pengeluaran: data.totalPengeluaran ?? 0,
        saldo: data.saldoAkhir ?? 0,
        saldoAwal: data.saldoAwal ?? 0,
      };
    }
    const tx = data.transactions ?? [];
    const filtered = tx.filter(t => t.kategori === selectedCategory);
    const pemasukan = filtered.filter(t => t.tipe === 'PEMASUKAN').reduce((acc, t) => acc + t.jumlah, 0);
    const pengeluaran = filtered.filter(t => t.tipe === 'PENGELUARAN').reduce((acc, t) => acc + t.jumlah, 0);
    const saldo = pemasukan - pengeluaran;
    return { pemasukan, pengeluaran, saldo, saldoAwal: data.saldoAwal ?? 0 };
  }, [data, selectedCategory]);

  const perusahaanNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const p of perusahaanList) {
      if (typeof p?.id === 'number' && p?.name) m.set(p.id, p.name)
    }
    return m
  }, [perusahaanList])

  const formatKeterangan = useCallback((ket?: string | null) => {
    const raw = (ket || '').trim()
    if (!raw) return '-'

    const matches = Array.from(raw.matchAll(/\[PERUSAHAAN:(\d+)\]/g))
    if (matches.length === 0) return raw

    const ids = Array.from(new Set(matches.map(m => Number(m[1])).filter(n => Number.isFinite(n))))
    const names = ids.map(idNum => perusahaanNameById.get(idNum) || `Perusahaan #${idNum}`)
    const cleaned = raw.replace(/\[PERUSAHAAN:\d+\]/g, '').trim()

    if (!cleaned) return names.join(', ')
    return `${cleaned} • ${names.join(', ')}`
  }, [perusahaanNameById])

  const getPerusahaanTags = useCallback((ket?: string | null) => {
    const raw = (ket || '').trim()
    if (!raw) return []
    const matches = Array.from(raw.matchAll(/\[PERUSAHAAN:(\d+)\]/g))
    if (matches.length === 0) return []
    const ids = Array.from(new Set(matches.map(m => Number(m[1])).filter(n => Number.isFinite(n))))
    return ids.map(idNum => perusahaanNameById.get(idNum) || `Perusahaan #${idNum}`)
  }, [perusahaanNameById])

  return (
    <div className="p-4 md:p-8 space-y-8">
      <div className="max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">Buku Kas Harian</h1>
      </div>

      {/* Ringkasan Saldo */}
      <div className="mb-8">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <DocumentTextIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Ringkasan Kas Harian</p>
                <p className="text-xs text-gray-500">Saldo dan arus kas periode terpilih</p>
              </div>
            </div>
            <div className="text-xs text-gray-500">
              Periode: <span className="font-semibold text-gray-900">{dateDisplay()}</span>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl bg-emerald-50/60 px-3 py-2">
              <p className="text-xs text-emerald-700">Saldo Awal</p>
              {isLoading ? (
                <Skeleton className="h-6 w-24 mt-1" />
              ) : (
                <p className="text-lg font-semibold text-gray-900" title={formatCurrency(totals.saldoAwal)}>{formatCurrency(totals.saldoAwal)}</p>
              )}
            </div>
            <div className="rounded-xl bg-sky-50/70 px-3 py-2">
              <p className="text-xs text-sky-700">Pemasukan</p>
              {isLoading ? (
                <Skeleton className="h-6 w-24 mt-1" />
              ) : (
                <p className="text-lg font-semibold text-gray-900" title={formatCurrency(totals.pemasukan)}>{formatCurrency(totals.pemasukan)}</p>
              )}
            </div>
            <div className="rounded-xl bg-amber-50/70 px-3 py-2">
              <p className="text-xs text-amber-700">Pengeluaran</p>
              {isLoading ? (
                <Skeleton className="h-6 w-24 mt-1" />
              ) : (
                <p className="text-lg font-semibold text-gray-900" title={formatCurrency(totals.pengeluaran)}>{formatCurrency(totals.pengeluaran)}</p>
              )}
            </div>
            <div className="rounded-xl bg-emerald-50/60 px-3 py-2">
              <p className="text-xs text-emerald-700">Saldo Akhir</p>
              {isLoading ? (
                <Skeleton className="h-6 w-24 mt-1" />
              ) : (
                <p className="text-lg font-semibold text-gray-900" title={formatCurrency(totals.saldo)}>{formatCurrency(totals.saldo)}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabel Transaksi */}
      <div className="card-style">
        {errorMessage && (
          <div className="w-full mb-4 rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3">
            {errorMessage}
          </div>
        )}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
          <div className="flex flex-col md:flex-row flex-wrap items-start md:items-center gap-4 flex-1 w-full lg:w-auto">
             <div className="w-full md:w-64 flex-shrink-0">
               <div className="relative">
                 <Input
                   placeholder="Cari transaksi..."
                   value={searchDraft}
                   onChange={(e) => {
                     const next = e.target.value
                     setSearchDraft(next)
                     if (!String(next || '').trim()) {
                       setSearchQuery('')
                       setPage(1)
                       const params = new URLSearchParams(searchParams.toString())
                       params.delete('search')
                       router.replace(`${pathname}?${params.toString()}`)
                     }
                   }}
                   onKeyDown={(e) => {
                     if (e.key === 'Enter') {
                       applySearch()
                     }
                   }}
                   className="input-style rounded-xl pr-10"
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

             
             {isAdmin && (
               <div className="w-full md:w-[200px]">
                 <Popover>
                   <PopoverTrigger asChild>
                     <button
                       type="button"
                       className="w-full bg-white rounded-xl border border-gray-200 h-10 px-3 flex items-center justify-between"
                       aria-haspopup="listbox"
                     >
                       <span className="text-sm">
                         {selectedUserId === 'all'
                           ? 'Semua User'
                           : (users.find(u => String(u.id) === selectedUserId)?.name ?? 'Pilih User')}
                       </span>
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.939l3.71-3.71a.75.75 0 111.06 1.061l-4.24 4.24a.75.75 0 01-1.06 0l-4.24-4.24a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
                     </button>
                   </PopoverTrigger>
                   <PopoverContent align="start" className="p-2 w-[--radix-popover-trigger-width] max-h-60 overflow-y-auto bg-white rounded-xl border shadow-sm">
                     <Input
                       autoFocus
                       placeholder="Cari user…"
                       value={userQuery}
                       onChange={(e) => setUserQuery(e.target.value)}
                       className="mb-2 rounded-lg"
                     />
                     <div role="listbox" className="space-y-1">
                       {[{ id: 'all', name: 'Semua User' }, ...users.map(u => ({ id: String(u.id), name: u.name }))].filter(u => u.name.toLowerCase().includes(userQuery.toLowerCase())).map(u => (
                         <button
                           key={u.id}
                           type="button"
                           onClick={() => { setSelectedUserId(String(u.id)); }}
                           className={`w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 ${selectedUserId === String(u.id) ? 'bg-blue-50 text-blue-700' : ''}`}
                         >
                           {u.name}
                         </button>
                       ))}
                       {[{ id: 'all', name: 'Semua User' }, ...users.map(u => ({ id: String(u.id), name: u.name }))].filter(u => u.name.toLowerCase().includes(userQuery.toLowerCase())).length === 0 && (
                         <div className="px-3 py-2 text-sm text-gray-500">Tidak ditemukan</div>
                       )}
                     </div>
                   </PopoverContent>
                 </Popover>
               </div>
             )}

             <div className="w-full md:w-[200px]">
               <Popover>
                 <PopoverTrigger asChild>
                   <button
                     type="button"
                     className="w-full bg-white rounded-xl border border-gray-200 h-10 px-3 flex items-center justify-between"
                     aria-haspopup="listbox"
                   >
                     <span className="text-sm">
                       {categoryLabelMap[selectedCategory] || 'Kategori'}
                     </span>
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.939l3.71-3.71a.75.75 0 111.06 1.061l-4.24 4.24a.75.75 0 01-1.06 0l-4.24-4.24a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
                   </button>
                 </PopoverTrigger>
                 <PopoverContent align="start" className="p-2 w-[--radix-popover-trigger-width] max-h-60 overflow-y-auto bg-white rounded-xl border shadow-sm">
                   <Input
                     autoFocus
                     placeholder="Cari kategori…"
                     value={categoryQuery}
                     onChange={(e) => setCategoryQuery(e.target.value)}
                     className="mb-2 rounded-lg"
                   />
                   <div role="listbox" className="space-y-1">
                     {categoryOptions
                       .filter(c => c.label.toLowerCase().includes(categoryQuery.toLowerCase()))
                       .map(c => (
                         <button
                           key={c.value}
                           type="button"
                           onClick={() => { setSelectedCategory(c.value); setPage(1); }}
                           className={`w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 ${selectedCategory === c.value ? 'bg-blue-50 text-blue-700' : ''}`}
                         >
                           {c.label}
                         </button>
                       ))}
                     {categoryOptions.filter(c => c.label.toLowerCase().includes(categoryQuery.toLowerCase())).length === 0 && (
                       <div className="px-3 py-2 text-sm text-gray-500">Tidak ditemukan</div>
                     )}
                   </div>
                 </PopoverContent>
               </Popover>
             </div>

            <div className="w-full md:w-[180px]">
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="w-full bg-white rounded-xl border border-gray-200 h-10 px-3 flex items-center justify-between"
                    aria-haspopup="listbox"
                  >
                    <span className="text-sm">
                      {selectedTipe === 'all' ? 'Semua Tipe' : (selectedTipe === 'PEMASUKAN' ? 'Pemasukan' : 'Pengeluaran')}
                    </span>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.939l3.71-3.71a.75.75 0 111.06 1.061l-4.24 4.24a.75.75 0 01-1.06 0l-4.24-4.24a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="p-2 w-[--radix-popover-trigger-width] bg-white rounded-xl border shadow-sm">
                  <div role="listbox" className="space-y-1">
                    {[
                      { v: 'all', l: 'Semua Tipe' },
                      { v: 'PEMASUKAN', l: 'Pemasukan' },
                      { v: 'PENGELUARAN', l: 'Pengeluaran' },
                    ].map(opt => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => { setSelectedTipe(opt.v as any); setPage(1); }}
                        className={`w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 ${selectedTipe === opt.v ? 'bg-blue-50 text-blue-700' : ''}`}
                      >
                        {opt.l}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

             <div className="flex flex-wrap gap-2 items-center w-full md:w-auto">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="date"
                      variant={"outline"}
                      className={cn(
                        "w-full sm:w-[260px] justify-start text-left font-normal rounded-xl",
                        !startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateDisplay()}
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
                        <Button variant="outline" size="sm" onClick={() => { setQuickRange('today'); applyQuickRange('today'); }} className={quickRange === 'today' ? 'bg-accent' : ''}>Hari Ini</Button>
                        <Button variant="outline" size="sm" onClick={() => { setQuickRange('yesterday'); applyQuickRange('yesterday'); }} className={quickRange === 'yesterday' ? 'bg-accent' : ''}>Kemarin</Button>
                        <Button variant="outline" size="sm" onClick={() => { setQuickRange('last_week'); applyQuickRange('last_week'); }} className={quickRange === 'last_week' ? 'bg-accent' : ''}>Minggu Lalu</Button>
                        <Button variant="outline" size="sm" onClick={() => { setQuickRange('this_month'); applyQuickRange('this_month'); }} className={quickRange === 'this_month' ? 'bg-accent' : ''}>Bulan Ini</Button>
                        <Button variant="outline" size="sm" onClick={() => { setQuickRange('this_year'); applyQuickRange('this_year'); }} className={quickRange === 'this_year' ? 'bg-accent' : ''}>Tahun Ini</Button>
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
                              value={formatWIBDateForInput(startDate)}
                              onChange={(e) => {
                                setStartDate(parseWIBDateFromInput(e.target.value));
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
                              value={formatWIBDateForInput(endDate)}
                              onChange={(e) => {
                                setEndDate(parseWIBDateFromInput(e.target.value, true));
                                setQuickRange('custom');
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
                <Button
                    onClick={handleRefresh}
                    variant="outline"
                    size="icon"
                    className="rounded-full"
                    title="Refresh data"
                >
                    <ArrowPathIcon className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="w-full sm:w-auto gap-2 rounded-full whitespace-nowrap"
                  title="Master Kategori Kas"
                >
                  <Link href="/kasir/kategori">
                    <TagIcon className="w-4 h-4" />
                    <span>Master Kategori</span>
                  </Link>
                </Button>
                <Button
                    onClick={handleExportPdf}
                    variant="destructive"
                    className="w-full sm:w-auto gap-2 rounded-full whitespace-nowrap"
                    title="Export PDF"
                >
                    <DocumentTextIcon className="w-4 h-4" />
                    <span>Export PDF</span>
                </Button>
            </div>
          </div>
          <Button
            onClick={() => { setEditingTransaction(null); setIsFormOpen(true); }}
            className="fixed bottom-6 right-6 w-14 h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center z-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
            title="Tambah Transaksi"
            size="icon"
          >
            <PlusIcon className="w-8 h-8" />
          </Button>
        </div>

          <div className="md:hidden space-y-3">
            {isLoading ? (
              [...Array(3)].map((_, i) => (
                <div key={i} className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-40" />
                </div>
              ))
            ) : (data?.transactions ?? []).length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center text-sm text-gray-500">
                Belum ada transaksi
              </div>
            ) : (
              (data?.transactions ?? []).map((trx) => {
                const kategoriDisplay = (() => {
                  if (trx.kategori === 'KEBUN' && trx.kebun) return `KEBUN: ${trx.kebun.name}`;
                  if (trx.kategori === 'KENDARAAN' && trx.kendaraan) return `KENDARAAN: ${trx.kendaraan.platNomor}`;
                  if (trx.kategori === 'GAJI' && trx.karyawan) return `GAJI: ${trx.karyawan.name}`;
                  if (trx.kategori === 'HUTANG_KARYAWAN' && trx.karyawan) return `HUTANG: ${trx.karyawan.name}`;
                  if (trx.kategori === 'PEMBAYARAN_HUTANG' && trx.karyawan) return `BAYAR HUTANG: ${trx.karyawan.name}`;
                  return trx.kategori || 'UMUM';
                })();
                const isMasuk = trx.tipe === 'PEMASUKAN';
                return (
                  <div
                    key={trx.id}
                    onClick={() => handleDetail(trx)}
                    className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-3 transition-colors hover:bg-gray-50/50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="font-semibold text-gray-900">{trx.deskripsi || '-'}</div>
                          {(trx as any).__optimistic ? (
                            <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
                              Menyimpan...
                            </span>
                          ) : null}
                        </div>
                        <div className="text-xs text-gray-500">{formatDateDisplay(trx.date)}</div>
                        <div className="text-xs text-gray-500">{kategoriDisplay}</div>
                      </div>
                      <div className={cn("px-2 py-0.5 text-xs font-semibold rounded-full", isMasuk ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700")}>
                        {isMasuk ? 'Pemasukan' : 'Pengeluaran'}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <div className="text-gray-400">Jumlah</div>
                        <div className={cn("text-base font-semibold", isMasuk ? "text-emerald-700" : "text-red-600")}>
                          {formatCurrency(trx.jumlah || 0)}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-400">Keterangan</div>
                        <div className="font-medium text-gray-800">{formatKeterangan(trx.keterangan)}</div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button size="sm" variant="outline" className="rounded-full" onClick={(e) => { e.stopPropagation(); handleDetail(trx); }}>
                        Detail
                      </Button>
                      {(trx as any).__optimistic ? null : (
                        <Button size="sm" variant="outline" className="rounded-full" onClick={(e) => { e.stopPropagation(); handleEdit(trx); }}>
                          Ubah
                        </Button>
                      )}
                      {trx.gambarUrl && (
                        <Button size="sm" variant="outline" className="rounded-full" onClick={(e) => { e.stopPropagation(); setViewImageUrl(trx.gambarUrl as string); }}>
                          Gambar
                        </Button>
                      )}
                      {(trx as any).__optimistic ? null : (
                        <Button size="sm" variant="destructive" className="rounded-full" onClick={(e) => { e.stopPropagation(); handleDelete(trx.id); }}>
                          Hapus
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="hidden md:block">
            <DataTable<KasTransaksiUI, any>
              columns={columns(handleDelete, handleEdit, handleDetail, setViewImageUrl, formatKeterangan)}    
              data={data?.transactions ?? []}
              meta={{ onRowClick: handleDetail, page, limit }}
              isLoading={isLoading}
              virtualize={{ enabled: false, rowHeight: 56 }}
            />
          </div>

        <div className="flex flex-col md:flex-row items-center justify-center md:justify-between gap-4 mt-6 pt-4 border-t border-gray-100">
          <div className="text-sm text-gray-500">
            Menampilkan <span className="font-medium text-gray-800">{Math.min((page - 1) * limit + 1, data?.totalItems ?? 0)}</span> - <span className="font-medium text-gray-800">{Math.min(page * limit, data?.totalItems ?? 0)}</span> dari <span className="font-medium text-gray-800">{data?.totalItems ?? 0}</span> transaksi
          </div>
          <div className="flex items-center gap-2">
            <select
              className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition-colors"
              value={limit}
              onChange={(e) => {
                const next = Number(e.target.value)
                setLimit(next)
                setPage(1)
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
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1 || isLoading}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Sebelumnya
            </button>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page >= Math.ceil((data?.totalItems ?? 0) / limit) || isLoading}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Berikutnya
            </button>
          </div>
        </div>
      </div>

      <KasirPageModals
        isFormOpen={isFormOpen}
        setIsFormOpen={setIsFormOpen}
        editingTransaction={editingTransaction}
        setEditingTransaction={setEditingTransaction}
        selectedDate={formatWIBDateForInput(endDate)}
        onSaveTransaksi={handleSaveTransaksi}
        isDetailOpen={isDetailOpen}
        setIsDetailOpen={setIsDetailOpen}
        detailTransaction={detailTransaction}
        setDetailTransaction={setDetailTransaction}
        formatKeterangan={formatKeterangan}
        getPerusahaanTags={getPerusahaanTags}
        openDelete={openDelete}
        setOpenDelete={setOpenDelete}
        deleteId={deleteId}
        setDeleteId={setDeleteId}
        onConfirmDelete={handleConfirmDelete}
        viewImageUrl={viewImageUrl}
        setViewImageUrl={setViewImageUrl}
      />
      </div>
    </div>
  );
};

export default KasirPage;
