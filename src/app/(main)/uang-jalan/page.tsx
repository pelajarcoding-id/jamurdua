'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { DataTable } from "@/components/data-table"
import { Button } from '@/components/ui/button'
import { columns } from './columns'
import type { SesiUangJalan, User, UangJalan, Kendaraan } from '@prisma/client'
import { SesiUangJalanModal } from './sesi-modal'
import { DetailUangJalanModal } from './detail-modal' // Modal baru
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import toast from 'react-hot-toast'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, MagnifyingGlassIcon, PlusIcon, ArrowPathIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useSearchParams, useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

import { useAuth } from '@/components/AuthProvider';

type UangJalanWithSoftDelete = UangJalan & {
    gambarUrl?: string | null;
    deletedAt?: Date | null;
    deletedById?: number | null;
};

export type SesiUangJalanWithDetails = SesiUangJalan & {
    supir: User;
    kendaraan: Kendaraan | null;
    kendaraanPlatNomor?: string | null;
    deletedAt?: Date | null;
    deletedById?: number | null;
    rincian: UangJalanWithSoftDelete[];
    totalDiberikan: number;
    totalPengeluaran: number;
    totalKembalian?: number;
    saldo: number;
};

interface SummaryData {
    totalDiberikan: number;
    totalPengeluaran: number;
    totalKembalian?: number;
    totalSaldo: number;
    totalSesi: number;
}

const getCurrentWIBDateParts = () => {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
    });
    const parts = formatter.formatToParts(now);
    const getPart = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0');
    return {
        year: getPart('year'),
        month: getPart('month') - 1, // 0-indexed
        day: getPart('day')
    };
};

const createWIBDate = (year: number, month: number, day: number, isEnd: boolean = false) => {
    // 00:00 WIB = -7h UTC
    // 23:59:59 WIB = 16:59:59 UTC
    const hour = isEnd ? 16 : -7;
    const minute = isEnd ? 59 : 0;
    const second = isEnd ? 59 : 0;
    const ms = isEnd ? 999 : 0;
    return new Date(Date.UTC(year, month, day, hour, minute, second, ms));
};

export default function UangJalanPage() {
    const { role, id: userId } = useAuth();
    const searchParams = useSearchParams();
    const router = useRouter();
    const [data, setData] = useState<SesiUangJalanWithDetails[]>([])
    const [supirList, setSupirList] = useState<User[]>([])
    const [kendaraanList, setKendaraanList] = useState<Kendaraan[]>([])
    const [kebunList, setKebunList] = useState<any[]>([])
    const [perusahaanList, setPerusahaanList] = useState<any[]>([])
    const [isSesiModalOpen, setIsSesiModalOpen] = useState(false)
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
    const [isConfirmOpen, setIsConfirmOpen] = useState(false)
    const [isStatusConfirmOpen, setIsStatusConfirmOpen] = useState(false)
    const [selectedSesi, setSelectedSesi] = useState<SesiUangJalanWithDetails | null>(null)
    const [createdSesiIdInModal, setCreatedSesiIdInModal] = useState<number | null>(null)
    const [createdSesiFallback, setCreatedSesiFallback] = useState<SesiUangJalanWithDetails | null>(null)
    const [modalTitle, setModalTitle] = useState('')
    const [rowSelection, setRowSelection] = useState({});

    const [summary, setSummary] = useState<SummaryData | null>(null);
    const [startDate, setStartDate] = useState<Date | undefined>(undefined);
    const [endDate, setEndDate] = useState<Date | undefined>(undefined);
    const [quickRange, setQuickRange] = useState('this_month');
    const [selectedSupirId, setSelectedSupirId] = useState<string>('all');
    const [supirQuery, setSupirQuery] = useState('');
    const [openSupir, setOpenSupir] = useState(false);

    useEffect(() => {
        // Initialize dates using WIB
        const { year, month, day } = getCurrentWIBDateParts();
        const start = createWIBDate(year, month, 1);
        const end = createWIBDate(year, month, day, true);
        
        setStartDate(start);
        setEndDate(end);
    }, []);
    const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
    const debouncedSearchQuery = useDebounce(searchQuery, 500);

    const [refreshToggle, setRefreshToggle] = useState(false);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [totalItems, setTotalItems] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchData = useCallback(async (background = false) => {
        setRowSelection({}); // Reset row selection
        if (!background) setIsLoading(true);
        try {
            const startDateString = startDate?.toISOString();
            const endDateString = endDate?.toISOString();

            let url = `/api/uang-jalan?page=${page}&limit=${limit}`;
            
            if (startDateString) url += `&startDate=${startDateString}`;
            if (endDateString) url += `&endDate=${endDateString}`;
            if (debouncedSearchQuery) url += `&search=${debouncedSearchQuery}`;

            if (role === 'SUPIR' && userId) {
                url += `&supirId=${userId}`;
            } else if (selectedSupirId && selectedSupirId !== 'all') {
                url += `&supirId=${selectedSupirId}`;
            }

            const [sesiRes, supirRes, kendaraanRes, kebunRes, perusahaanRes] = await Promise.all([
                fetch(url, { cache: 'no-store' }),
                fetch('/api/users?role=SUPIR&limit=1000', { cache: 'no-store' }),
                fetch('/api/kendaraan?limit=1000', { cache: 'no-store' }),
                fetch('/api/kebun?limit=1000', { cache: 'no-store' }),
                fetch('/api/perusahaan?limit=1000', { cache: 'no-store' }),
            ]);
            const sesiData = await sesiRes.json();
            const supirData = await supirRes.json();
            const kendaraanData = await kendaraanRes.json();
            const kebunData = await kebunRes.json();
            const perusahaanData = await perusahaanRes.json();

            setData(sesiData.data);
            setTotalItems(sesiData.total);
            setSupirList(supirData.data || []);
            setKendaraanList(kendaraanData.data || []);
            setKebunList(kebunData.data || []);
            setPerusahaanList(perusahaanData.data || []);
            setSummary(sesiData.summary);
        } catch (error) {
            toast.error('Gagal memuat data.')
            console.error(error)
        } finally {
            setIsLoading(false);
        }
    }, [startDate, endDate, page, limit, role, userId, debouncedSearchQuery, selectedSupirId])

    useEffect(() => {
        const paramsSearch = searchParams.get('search') || '';
        if (paramsSearch !== searchQuery) {
            setSearchQuery(paramsSearch);
        }
    }, [searchParams, searchQuery]);

    useEffect(() => {
        fetchData()
    }, [fetchData, refreshToggle])

    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            await fetchData(true);
            toast.success('Data diperbarui');
        } finally {
            setRefreshing(false);
        }
    }, [fetchData]);

    const handleSearchChange = (value: string) => {
        setSearchQuery(value);
        const params = new URLSearchParams(searchParams.toString());
        if (value) {
            params.set('search', value);
        } else {
            params.delete('search');
        }
        router.replace(`?${params.toString()}`);
    };

    const dateDisplay = useMemo(() => {
        if (quickRange && quickRange !== 'custom') {
            switch (quickRange) {
                case 'today': return 'Hari Ini';
                case 'yesterday': return 'Kemarin';
                case 'last_week': return '7 Hari Terakhir';
                case 'last_30_days': return '30 Hari Terakhir';
                case 'this_month': return 'Bulan Ini';
                default: return 'Pilih Rentang Waktu';
            }
        }
        if (startDate && endDate) {
            return `${format(startDate, 'dd MMM yyyy', { locale: idLocale })} - ${format(endDate, 'dd MMM yyyy', { locale: idLocale })}`;
        }
        return 'Pilih Rentang Waktu';
    }, [quickRange, startDate, endDate]);

    const applyQuickRange = useCallback((val: string) => {
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
        } else if (val === 'last_30_days') {
            setStartDate(createWIBDate(year, month, day - 30));
            setEndDate(createWIBDate(year, month, day, true));
        } else if (val === 'this_month') {
            setStartDate(createWIBDate(year, month, 1));
            setEndDate(createWIBDate(year, month, day, true));
        }
    }, []);

    // Handlers untuk Sesi Modal
    const handleOpenSesiModal = useCallback((sesi: SesiUangJalanWithDetails | null = null, supirId: number | null = null) => {
        setCreatedSesiIdInModal(null)
        setCreatedSesiFallback(null)
        if (sesi) {
            setSelectedSesi(sesi);
            setCreatedSesiIdInModal(sesi.id)
            setCreatedSesiFallback(sesi)
            setModalTitle('Ubah Sesi Uang Jalan');
        } else {
            // Create a partial initialData object with supirId if provided
            const initialData = supirId ? { supirId: supirId, rincian: [] } as unknown as SesiUangJalanWithDetails : null;
            setSelectedSesi(initialData);
            setModalTitle('Tambah Sesi Uang Jalan');
        }
        setIsSesiModalOpen(true);
    }, []);

    const handleCloseSesiModal = useCallback(() => {
        setIsSesiModalOpen(false)
        setSelectedSesi(null)
        setCreatedSesiIdInModal(null)
        setCreatedSesiFallback(null)
    }, [])

    // Handlers untuk Detail Modal
    const handleOpenDetailModal = useCallback((sesi: SesiUangJalanWithDetails) => {
        setSelectedSesi(sesi)
        setIsDetailModalOpen(true)
    }, [])

    const handleCloseDetailModal = useCallback(() => {
        setIsDetailModalOpen(false)
        setSelectedSesi(null)
    }, [])

    const handleEditFromDetailModal = useCallback((sesi: SesiUangJalanWithDetails) => {
        setIsDetailModalOpen(false)
        setSelectedSesi(null)
        setTimeout(() => {
            handleOpenSesiModal(sesi)
        }, 0)
    }, [handleOpenSesiModal])

    // Handlers untuk konfirmasi
    const handleOpenConfirm = useCallback((sesi: SesiUangJalanWithDetails) => {
        setSelectedSesi(sesi)
        setIsConfirmOpen(true)
    }, [])

    const handleCloseConfirm = useCallback(() => {
        setIsConfirmOpen(false)
        setSelectedSesi(null)
    }, [])

    const handleOpenStatusConfirm = useCallback((sesi: SesiUangJalanWithDetails) => {
        setSelectedSesi(sesi)
        setIsStatusConfirmOpen(true)
    }, [])

    const handleCloseStatusConfirm = useCallback(() => {
        setIsStatusConfirmOpen(false)
        setSelectedSesi(null)
    }, [])

    const handleSaveSesi = useCallback(async (formData: any) => {
        const isEditing = !!(selectedSesi && selectedSesi.id);
        
        // 1. Store previous state
        const previousData = [...data];
        const previousSummary = summary ? { ...summary } : null;
        const previousTotalItems = totalItems;

        if (!isEditing) {
            try {
                const response = await fetch('/api/uang-jalan', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData),
                })

                if (!response.ok) {
                    const errorData = await response.json()
                    throw new Error(errorData.error || 'Gagal menyimpan data.')
                }

                const created = await response.json()
                const rincian = Array.isArray(created?.rincian) ? created.rincian : []
                const totalPemasukan = rincian.filter((r: any) => r.tipe === 'PEMASUKAN').reduce((acc: number, r: any) => acc + Number(r.amount || 0), 0)
                const totalPengeluaran = rincian.filter((r: any) => r.tipe === 'PENGELUARAN').reduce((acc: number, r: any) => acc + Number(r.amount || 0), 0)

                const fallback: SesiUangJalanWithDetails = {
                    id: created.id,
                    supirId: created.supirId,
                    kendaraanPlatNomor: created.kendaraanPlatNomor ?? null,
                    status: created.status ?? 'BERJALAN',
                    createdAt: created.createdAt ? new Date(created.createdAt) : new Date(),
                    updatedAt: created.updatedAt ? new Date(created.updatedAt) : new Date(),
                    tanggalMulai: created.tanggalMulai ? new Date(created.tanggalMulai) : new Date(),
                    keterangan: created.keterangan ?? null,
                    deletedAt: null,
                    deletedById: null,
                    supir: supirList.find(s => s.id === Number(created.supirId))!,
                    kendaraan: kendaraanList.find(k => k.platNomor === created.kendaraanPlatNomor) || null,
                    rincian: rincian.map((r: any) => ({
                        ...r,
                        createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
                        updatedAt: r.updatedAt ? new Date(r.updatedAt) : new Date(),
                        date: r.date ? new Date(r.date) : new Date(),
                        deletedAt: r.deletedAt ? new Date(r.deletedAt) : null,
                        deletedById: r.deletedById ?? null,
                    })),
                    totalDiberikan: totalPemasukan,
                    totalPengeluaran,
                    saldo: totalPemasukan - totalPengeluaran,
                }

                setCreatedSesiIdInModal(Number(created.id))
                setCreatedSesiFallback(fallback)
                toast.success('Sesi berhasil dibuat. Silakan tambah rincian transaksi.')
                fetchData(true)
                return { ok: true, createdSesiId: Number(created.id) }
            } catch (error: any) {
                setData(previousData)
                setTotalItems(previousTotalItems)
                if (previousSummary) setSummary(previousSummary)
                toast.error(error.message || 'Gagal menyimpan data.')
                return { ok: false }
            }
        }

        // 2. Optimistic Update
        const tanggalMulaiValue = formData.tanggalMulai
            ? new Date(formData.tanggalMulai)
            : isEditing
            ? selectedSesi.tanggalMulai
            : new Date();

        const optimisticSesi: SesiUangJalanWithDetails = {
            id: isEditing ? selectedSesi.id : Math.random(),
            supirId: isEditing ? selectedSesi.supirId : Number(formData.supirId),
            kendaraanPlatNomor: formData.kendaraanPlatNomor || null,
            status: isEditing ? selectedSesi.status : 'BERJALAN',
            createdAt: isEditing ? selectedSesi.createdAt : new Date(),
            updatedAt: new Date(),
            tanggalMulai: tanggalMulaiValue,
            keterangan: formData.keterangan || null,
            deletedAt: isEditing ? selectedSesi.deletedAt : null,
            deletedById: isEditing ? selectedSesi.deletedById : null,
            // Mock relationships and other fields
            supir: isEditing ? selectedSesi.supir : supirList.find(s => s.id === Number(formData.supirId))!,
            kendaraan: kendaraanList.find(k => k.platNomor === formData.kendaraanPlatNomor) || null,
            rincian: isEditing ? selectedSesi.rincian : [],
            totalDiberikan: isEditing ? selectedSesi.totalDiberikan : (Number(formData.amount) || 0),
            totalPengeluaran: isEditing ? selectedSesi.totalPengeluaran : 0,
            saldo: isEditing ? selectedSesi.saldo : (Number(formData.amount) || 0),
        };

        if (isEditing) {
            setData(prev => prev.map(item => item.id === optimisticSesi.id ? { ...item, ...optimisticSesi } : item));
        } else {
            setData(prev => [optimisticSesi, ...prev]);
            setTotalItems(prev => prev + 1);
            if (summary) {
                setSummary({ ...summary, totalSesi: summary.totalSesi + 1 });
            }
        }

        let toastId: string | undefined
        try {
            toastId = toast.loading('Menyimpan sesi uang jalan...')
            const method = isEditing ? 'PUT' : 'POST';
            const url = isEditing ? `/api/uang-jalan/${selectedSesi.id}` : '/api/uang-jalan';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Gagal menyimpan data.');
            }

            // 3. Sync
            fetchData();
            toast.success(`Sesi berhasil ${isEditing ? 'diubah' : 'dibuat'}`, { id: toastId })
            return { ok: true }
        } catch (error: any) {
            // 4. Rollback
            setData(previousData);
            setTotalItems(previousTotalItems);
            if (previousSummary) setSummary(previousSummary);
            if (toastId) toast.dismiss(toastId)
            toast.error(error.message || 'Gagal menyimpan data, mengembalikan perubahan.');
            return { ok: false }
        }
    }, [selectedSesi, data, totalItems, summary, supirList, kendaraanList, fetchData]);

    const handleSaveRincian = useCallback(async (formData: FormData) => {
        const sesiId = Number(formData.get('sesiUangJalanId'));
        const tipe = formData.get('tipe') as string;
        const amount = Number(formData.get('amount'));
        const description = formData.get('description') as string;
        const dateString = formData.get('date') as string | null;
        const dateValue = dateString ? new Date(dateString) : new Date();

        // Store previous state for rollback
        const previousData = data;
        const previousSummary = summary;

        // Optimistic Update
        const tempId = Math.random();
        const tempRincian: UangJalan & { gambarUrl?: string | null } = {
            id: tempId,
            sesiUangJalanId: sesiId,
            tipe,
            amount,
            description,
            gambarUrl: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            date: dateValue,
            deletedAt: null,
            deletedById: null
        };

        // Update Data State
        setData(prevData => prevData.map(sesi => {
            if (sesi.id === sesiId) {
                const newRincian = [tempRincian, ...sesi.rincian];
                const totalPemasukan = newRincian.filter(r => r.tipe === 'PEMASUKAN').reduce((acc, r) => acc + r.amount, 0);
                const totalPengeluaran = newRincian.filter(r => r.tipe === 'PENGELUARAN').reduce((acc, r) => acc + r.amount, 0);

                return {
                    ...sesi,
                    rincian: newRincian,
                    totalDiberikan: totalPemasukan,
                    totalPengeluaran,
                    saldo: totalPemasukan - totalPengeluaran
                };
            }
            return sesi;
        }));

        // Update Summary State
        if (summary) {
            setSummary(prev => {
                if (!prev) return null;
                const isPemasukan = tipe === 'PEMASUKAN';
                return {
                    ...prev,
                    totalDiberikan: isPemasukan ? prev.totalDiberikan + amount : prev.totalDiberikan,
                    totalPengeluaran: !isPemasukan ? prev.totalPengeluaran + amount : prev.totalPengeluaran,
                    totalSaldo: isPemasukan ? prev.totalSaldo + amount : prev.totalSaldo - amount,
                };
            });
        }

        try {
            const response = await fetch('/api/uang-jalan/rincian', {
                method: 'POST',
                body: formData,
            })

            if (response.ok) {
                toast.success('Rincian berhasil ditambahkan.')
                fetchData(true)
                return true
            } else {
                const errorData = await response.json()
                throw new Error(errorData.error || 'Gagal menyimpan data.')
            }
        } catch (error) {
            setData(previousData);
            setSummary(previousSummary);
            toast.error(error instanceof Error ? error.message : 'Gagal menyimpan data.')
            return false
        }
    }, [data, summary, fetchData])

    const handleUpdateRincian = useCallback(async (rincianId: number, formData: FormData) => {
        const sesiId = Number(formData.get('sesiUangJalanId'))
        const tipe = formData.get('tipe') as string
        const amount = Number(formData.get('amount'))
        const description = formData.get('description') as string
        const dateString = formData.get('date') as string | null
        const dateValue = dateString ? new Date(dateString) : new Date()

        const previousData = data
        const previousSummary = summary

        setData(prevData => prevData.map(sesi => {
            if (sesi.id === sesiId) {
                const newRincian = sesi.rincian.map(r => r.id === rincianId ? { ...r, tipe, amount, description, date: dateValue } as any : r)
                const totalPemasukan = newRincian.filter(r => r.tipe === 'PEMASUKAN').reduce((acc, r) => acc + r.amount, 0)
                const totalPengeluaran = newRincian.filter(r => r.tipe === 'PENGELUARAN').reduce((acc, r) => acc + r.amount, 0)

                return {
                    ...sesi,
                    rincian: newRincian,
                    totalDiberikan: totalPemasukan,
                    totalPengeluaran,
                    saldo: totalPemasukan - totalPengeluaran
                }
            }
            return sesi
        }))

        if (previousSummary) {
            const prevTotalPemasukan = data.reduce((acc, s) => acc + (s.totalDiberikan || 0), 0)
            const prevTotalPengeluaran = data.reduce((acc, s) => acc + (s.totalPengeluaran || 0), 0)
            const nextData = previousData.map(sesi => sesi.id === sesiId ? {
                ...sesi,
                rincian: sesi.rincian.map(r => r.id === rincianId ? { ...r, tipe, amount, description, date: dateValue } as any : r),
            } : sesi)
            const nextTotalPemasukan = nextData.reduce((acc, s) => acc + (s.rincian?.filter(r => r.tipe === 'PEMASUKAN').reduce((a, r) => a + r.amount, 0) || 0), 0)
            const nextTotalPengeluaran = nextData.reduce((acc, s) => acc + (s.rincian?.filter(r => r.tipe === 'PENGELUARAN').reduce((a, r) => a + r.amount, 0) || 0), 0)
            setSummary({ ...previousSummary, totalDiberikan: previousSummary.totalDiberikan - prevTotalPemasukan + nextTotalPemasukan, totalPengeluaran: previousSummary.totalPengeluaran - prevTotalPengeluaran + nextTotalPengeluaran })
        }

        try {
            const response = await fetch(`/api/uang-jalan/rincian/${rincianId}`, {
                method: 'PUT',
                body: formData,
            })
            if (response.ok) {
                toast.success('Rincian berhasil diperbarui.')
                fetchData(true)
                return true
            } else {
                const errorData = await response.json()
                throw new Error(errorData.error || 'Gagal menyimpan data.')
            }
        } catch (error) {
            setData(previousData)
            setSummary(previousSummary)
            toast.error(error instanceof Error ? error.message : 'Gagal menyimpan data.')
            return false
        }
    }, [data, summary, fetchData])

    const handleDeleteRincian = useCallback(async (rincianId: number, sesiId: number) => {
        const previousData = data
        const previousSummary = summary

        setData(prevData => prevData.map(sesi => {
            if (sesi.id === sesiId) {
                const newRincian = sesi.rincian.filter(r => r.id !== rincianId)
                const totalPemasukan = newRincian.filter(r => r.tipe === 'PEMASUKAN').reduce((acc, r) => acc + r.amount, 0)
                const totalPengeluaran = newRincian.filter(r => r.tipe === 'PENGELUARAN').reduce((acc, r) => acc + r.amount, 0)
                return {
                    ...sesi,
                    rincian: newRincian,
                    totalDiberikan: totalPemasukan,
                    totalPengeluaran,
                    saldo: totalPemasukan - totalPengeluaran
                }
            }
            return sesi
        }))

        try {
            const response = await fetch(`/api/uang-jalan/rincian/${rincianId}`, { method: 'DELETE' })
            if (response.ok) {
                toast.success('Rincian berhasil dihapus.')
                fetchData(true)
                return true
            } else {
                const errorData = await response.json()
                throw new Error(errorData.error || 'Gagal menghapus data.')
            }
        } catch (error) {
            setData(previousData)
            setSummary(previousSummary)
            toast.error(error instanceof Error ? error.message : 'Gagal menghapus data.')
            return false
        }
    }, [data, summary, fetchData])

    const handleDelete = useCallback(async () => {
        if (!selectedSesi) return

        const previousData = [...data];
        const previousTotalItems = totalItems;
        const previousSummary = summary ? { ...summary } : null;

        // Optimistic Update
        setData(prev => prev.filter(item => item.id !== selectedSesi.id));
        setTotalItems(prev => prev - 1);
        
        if (summary) {
            setSummary({
                ...summary,
                totalSesi: summary.totalSesi - 1,
                totalDiberikan: summary.totalDiberikan - selectedSesi.totalDiberikan,
                totalPengeluaran: summary.totalPengeluaran - selectedSesi.totalPengeluaran,
                totalSaldo: summary.totalSaldo - selectedSesi.saldo
            });
        }
        handleCloseConfirm();

        let toastId: string | undefined
        try {
            toastId = toast.loading('Menghapus sesi...')
            const response = await fetch(`/api/uang-jalan/${selectedSesi.id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                throw new Error('Gagal menghapus data.');
            }
            
            // Sync
            fetchData();
            toast.success('Sesi berhasil dihapus', { id: toastId })
        } catch (error: any) {
            // Rollback
            setData(previousData);
            setTotalItems(previousTotalItems);
            if (previousSummary) setSummary(previousSummary);
            if (toastId) toast.dismiss(toastId)
            toast.error(error.message || 'Gagal menghapus data, mengembalikan perubahan.');
        }
    }, [selectedSesi, data, totalItems, summary, fetchData, handleCloseConfirm])

    const handleUpdateStatus = useCallback(async () => {
        if (!selectedSesi) return

        const previousData = [...data];

        // Optimistic Update
        setData(prev => prev.map(item => item.id === selectedSesi.id ? { ...item, status: 'SELESAI' } : item));
        handleCloseStatusConfirm();

        let toastId: string | undefined
        try {
            toastId = toast.loading('Mengubah status...')
            const response = await fetch(`/api/uang-jalan/${selectedSesi.id}` , {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'SELESAI' }),
            })

            if (!response.ok) {
                throw new Error('Gagal mengubah status.');
            }

            // Sync
            fetchData();
            toast.success('Status berhasil diubah menjadi SELESAI', { id: toastId })
        } catch (error: any) {
            // Rollback
            setData(previousData);
            if (toastId) toast.dismiss(toastId)
            toast.error(error.message || 'Gagal mengubah status, mengembalikan perubahan.');
        }
    }, [selectedSesi, data, fetchData, handleCloseStatusConfirm])

    const tableMeta = useMemo(() => ({
        onEdit: handleOpenSesiModal,
        onDelete: handleOpenConfirm,
        onUpdateStatus: handleOpenStatusConfirm,
        onAddRincian: handleOpenSesiModal,
        onOpenNewSesi: (supirId: number) => handleOpenSesiModal(null, supirId),
        onViewDetails: handleOpenDetailModal, // Tambahkan ini
        onRowClick: handleOpenDetailModal,
    }), [handleOpenSesiModal, handleOpenConfirm, handleOpenStatusConfirm, handleOpenDetailModal]);

    const formatCurrency = (num: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);

    return (
        <main className="p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-2xl font-bold mb-6">Manajemen Uang Jalan</h1>

                {isLoading ? (
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
                                        <CurrencyDollarIcon className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-gray-900">Ringkasan Uang Jalan</p>
                                        <p className="text-xs text-gray-500">Total sesi dan saldo uang jalan</p>
                                    </div>
                                </div>
                                <div className="text-xs text-gray-500">
                                    Periode: <span className="font-semibold text-gray-900">{dateDisplay}</span>
                                </div>
                            </div>
                            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                <div className="rounded-xl bg-emerald-50/60 px-3 py-2">
                                    <p className="text-xs text-emerald-700">Total Sesi</p>
                                    <p className="text-lg font-semibold text-gray-900">{summary.totalSesi.toLocaleString('id-ID')}</p>
                                </div>
                                <div className="rounded-xl bg-amber-50/70 px-3 py-2">
                                    <p className="text-xs text-amber-700">Total Diberikan</p>
                                    <p className="text-lg font-semibold text-gray-900">{formatCurrency(summary.totalDiberikan)}</p>
                                </div>
                                <div className="rounded-xl bg-sky-50/70 px-3 py-2">
                                    <p className="text-xs text-sky-700">Total Pengeluaran</p>
                                    <p className="text-lg font-semibold text-gray-900">{formatCurrency(summary.totalPengeluaran)}</p>
                                </div>
                                <div className="rounded-xl bg-emerald-50/60 px-3 py-2">
                                    <p className="text-xs text-emerald-700">Total Saldo</p>
                                    <p className="text-lg font-semibold text-gray-900">{formatCurrency(summary.totalSaldo)}</p>
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
                                    type="text"
                                    placeholder="Cari supir atau plat nomor..."
                                    value={searchQuery}
                                    onChange={(e) => handleSearchChange(e.target.value)}
                                    className="input-style rounded-lg"
                                />
                            </div>
                            <div className="w-full md:w-auto flex items-center gap-2">
                                {role !== 'SUPIR' && (
                                  <Popover open={openSupir} onOpenChange={setOpenSupir}>
                                    <PopoverTrigger asChild>
                                      <button
                                        type="button"
                                        className="w-[180px] bg-white rounded-lg border border-gray-200 h-10 px-3 flex items-center justify-between"
                                        aria-haspopup="listbox"
                                      >
                                        <span className="text-sm">
                                          {selectedSupirId === 'all'
                                            ? 'Semua Supir'
                                            : (supirList.find(s => String(s.id) === selectedSupirId)?.name ?? 'Pilih Supir')}
                                        </span>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.939l3.71-3.71a.75.75 0 111.06 1.061l-4.24 4.24a.75.75 0 01-1.06 0l-4.24-4.24a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
                                      </button>
                                    </PopoverTrigger>
                                    <PopoverContent align="start" className="p-2 w-[--radix-popover-trigger-width] max-h-60 overflow-y-auto bg-white rounded-xl border shadow-sm">
                                      <Input
                                        autoFocus
                                        placeholder="Cari supir…"
                                        value={supirQuery}
                                        onChange={(e) => setSupirQuery(e.target.value)}
                                        className="mb-2 rounded-lg"
                                      />
                                      <div role="listbox" className="space-y-1">
                                        {[{ id: 'all', name: 'Semua Supir' }, ...supirList.map(s => ({ id: String(s.id), name: s.name }))].filter(s => s.name.toLowerCase().includes(supirQuery.toLowerCase())).map(s => (
                                          <button
                                            key={s.id}
                                            type="button"
                                            onClick={() => { setSelectedSupirId(String(s.id)); setOpenSupir(false); }}
                                            className={`w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 ${selectedSupirId === String(s.id) ? 'bg-emerald-50 text-emerald-700' : ''}`}
                                          >
                                            {s.name}
                                          </button>
                                        ))}
                                        {[{ id: 'all', name: 'Semua Supir' }, ...supirList.map(s => ({ id: String(s.id), name: s.name }))].filter(s => s.name.toLowerCase().includes(supirQuery.toLowerCase())).length === 0 && (
                                          <div className="px-3 py-2 text-sm text-gray-500">Tidak ditemukan</div>
                                        )}
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                )}
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            id="date"
                                            variant={"outline"}
                                            className={cn(
                                                "w-full sm:w-[260px] justify-start text-left font-normal bg-white rounded-lg",
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
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="rounded-full"
                                    onClick={handleRefresh}
                                    title="Refresh data"
                                    aria-label="Refresh data"
                                >
                                    <ArrowPathIcon className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
                                </Button>
                            </div>
                        </div>
                        <Button
                            onClick={() => handleOpenSesiModal()}
                            className="fixed bottom-6 right-6 w-14 h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center z-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                            title="Tambah Sesi"
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
                                    <Skeleton className="h-4 w-40" />
                                    <Skeleton className="h-4 w-24" />
                                </div>
                            ))
                        ) : data.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center text-sm text-gray-500">
                                Belum ada sesi uang jalan
                            </div>
                        ) : (
                            data.map((sesi) => {
                                const statusClass = sesi.status === 'SELESAI' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                                return (
                                    <div
                                        key={sesi.id}
                                        onClick={() => handleOpenDetailModal(sesi)}
                                        className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-3 transition-colors hover:bg-gray-50/50"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="space-y-1">
                                                <div className="font-semibold text-gray-900">{sesi.supir?.name || '-'}</div>
                                                <div className="text-xs text-gray-500">{sesi.kendaraan?.platNomor || sesi.kendaraanPlatNomor || '-'}</div>
                                                <div className="text-xs text-gray-500">{format(new Date(sesi.tanggalMulai), 'dd MMM yyyy', { locale: idLocale })}</div>
                                            </div>
                                            <span className={cn("px-2 py-0.5 text-xs font-semibold rounded-full", statusClass)}>
                                                {sesi.status}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div>
                                                <div className="text-gray-400">Total Diberikan</div>
                                                <div className="font-semibold text-gray-900">{formatCurrency(sesi.totalDiberikan)}</div>
                                            </div>
                                            <div>
                                                <div className="text-gray-400">Total Pengeluaran</div>
                                                <div className="font-semibold text-gray-900">{formatCurrency(sesi.totalPengeluaran)}</div>
                                            </div>
                                            <div>
                                                <div className="text-gray-400">Saldo</div>
                                                <div className="font-semibold text-emerald-700">{formatCurrency(sesi.saldo)}</div>
                                            </div>
                                            <div>
                                                <div className="text-gray-400">Rincian</div>
                                                <div className="font-semibold text-gray-900">{sesi.rincian?.length || 0} item</div>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap gap-2 pt-1">
                                            <Button size="sm" variant="outline" className="rounded-full" onClick={(e) => { e.stopPropagation(); handleOpenDetailModal(sesi); }}>
                                                Detail
                                            </Button>
                                            <Button size="sm" variant="outline" className="rounded-full" onClick={(e) => { e.stopPropagation(); handleOpenSesiModal(sesi); }}>
                                                Tambah Rincian
                                            </Button>
                                            <Button size="sm" variant="outline" className="rounded-full" onClick={(e) => { e.stopPropagation(); handleOpenSesiModal(sesi); }}>
                                                Ubah
                                            </Button>
                                            <Button size="sm" variant="outline" className="rounded-full" onClick={(e) => { e.stopPropagation(); handleOpenStatusConfirm(sesi); }}>
                                                Selesaikan
                                            </Button>
                                            <Button size="sm" variant="destructive" className="rounded-full" onClick={(e) => { e.stopPropagation(); handleOpenConfirm(sesi); }}>
                                                Hapus
                                            </Button>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>

                    <div className="hidden md:block overflow-hidden rounded-lg border border-gray-100">
                        <DataTable columns={columns} data={data} meta={tableMeta} rowSelection={rowSelection} setRowSelection={setRowSelection} isLoading={isLoading} virtualize={{ enabled: true, rowHeight: 56, maxHeight: 70 }} />
                    </div>

                    <div className="flex flex-col md:flex-row items-center justify-center md:justify-between gap-4 mt-6 pt-4 border-t border-gray-100">
                        <div className="text-sm text-gray-500">
                            Menampilkan <span className="font-medium text-gray-800">{Math.min((page - 1) * limit + 1, totalItems)}</span> - <span className="font-medium text-gray-800">{Math.min(page * limit, totalItems)}</span> dari <span className="font-medium text-gray-800">{totalItems}</span> sesi
                        </div>
                        <div className="flex space-x-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(page - 1)}
                                disabled={page <= 1 || isLoading}
                            >
                                Sebelumnya
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(page + 1)}
                                disabled={page * limit >= totalItems || isLoading}
                            >
                                Berikutnya
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <SesiUangJalanModal
                isOpen={isSesiModalOpen}
                onClose={handleCloseSesiModal}
                onConfirm={handleSaveSesi}
                title={modalTitle}
                initialData={selectedSesi}
                createdSesi={createdSesiIdInModal ? (data.find(s => s.id === createdSesiIdInModal) || createdSesiFallback) : null}
                onAddRincian={handleSaveRincian}
                onUpdateRincian={handleUpdateRincian}
                onDeleteRincian={handleDeleteRincian}
                supirList={supirList}
                kendaraanList={kendaraanList}
                kebunList={kebunList}
                perusahaanList={perusahaanList}
            />

            <DetailUangJalanModal
                isOpen={isDetailModalOpen}
                onClose={handleCloseDetailModal}
                data={selectedSesi}
                onEdit={handleEditFromDetailModal}
            />

            <ConfirmationModal
                isOpen={isConfirmOpen}
                onClose={handleCloseConfirm}
                onConfirm={handleDelete}
                title="Konfirmasi Hapus Sesi"
                description="Apakah Anda yakin ingin menghapus sesi ini? Semua rincian di dalamnya akan ikut terhapus."
                variant="emerald"
            />

            <ConfirmationModal
                isOpen={isStatusConfirmOpen}
                onClose={handleCloseStatusConfirm}
                onConfirm={handleUpdateStatus}
                title="Konfirmasi Selesaikan Sesi"
                description="Apakah Anda yakin ingin mengubah status sesi menjadi SELESAI?"
                variant="emerald"
            />
        </main>
    )
}
