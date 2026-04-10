'use client';

import { useState, useEffect, useMemo } from 'react';
import { DataTable } from '@/components/data-table';
import { columns, HutangBank } from './columns';
import { Button } from '@/components/ui/button';
import { PlusIcon, BuildingOfficeIcon, BanknotesIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import { RefreshCcw } from 'lucide-react';
import HutangBankModal from './modal';
import toast from 'react-hot-toast';
import { ConfirmationModal } from '@/components/ui/confirmation-modal';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

export default function HutangBankPage() {
  const [data, setData] = useState<HutangBank[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'pay' | 'view'>('add');
  const [selectedLoan, setSelectedLoan] = useState<HutangBank | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const stats = useMemo(() => {
    const totalPinjaman = data.reduce((sum, item) => sum + item.jumlahHutang, 0);
    const totalSisa = data.reduce((sum, item) => sum + item.sisaPinjaman, 0);
    const totalAngsuran = data.filter(item => item.status === 'AKTIF').reduce((sum, item) => sum + item.angsuranBulanan, 0);
    const pinjamanAktif = data.filter(item => item.status === 'AKTIF').length;

    return { totalPinjaman, totalSisa, totalAngsuran, pinjamanAktif };
  }, [data]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const computeTanggalJatuhTempoAkhir = (loan: HutangBank) => {
    const start = new Date(loan.tanggalMulai)
    if (Number.isNaN(start.getTime())) return null
    const monthsToAdd = Math.max(0, Number(loan.lamaPinjaman || 0) - 1)
    const targetYear = start.getFullYear()
    const targetMonth = start.getMonth() + monthsToAdd
    const base = new Date(targetYear, targetMonth, 1)
    const daysInMonth = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate()
    const day = Math.min(Math.max(1, Number(loan.jatuhTempo || 1)), daysInMonth)
    return new Date(base.getFullYear(), base.getMonth(), day)
  }

  const formatDateId = (d: Date | null) => {
    if (!d) return '-'
    try {
      return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(d)
    } catch {
      return '-'
    }
  }

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/hutang-bank?page=${page}&limit=${limit}`);
      if (!res.ok) throw new Error('Gagal mengambil data');
      const result = await res.json();
      setData(result.data);
      setMeta(result.meta);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [page]);

  const handleAdd = () => {
    setSelectedLoan(null);
    setModalMode('add');
    setIsModalOpen(true);
  };

  const handleView = (loan: HutangBank) => {
    setSelectedLoan(loan);
    setModalMode('view');
    setIsModalOpen(true);
  };

  const handlePay = (loan: HutangBank) => {
    setSelectedLoan(loan);
    setModalMode('pay');
    setIsModalOpen(true);
  };

  const handleDelete = (loan: HutangBank) => {
    setSelectedLoan(loan);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedLoan) return;
    try {
      const res = await fetch(`/api/hutang-bank/${selectedLoan.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Gagal menghapus');
      }
      toast.success('Pinjaman berhasil dihapus');
      fetchData();
      setIsDeleteModalOpen(false);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Manajemen Hutang Bank</h1>
          <p className="text-sm text-gray-500">Kelola pinjaman bank dan angsuran bulanan yang terintegrasi dengan Kasir.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={fetchData} disabled={isLoading} className="flex-1 sm:flex-none">
            <RefreshCcw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={handleAdd} className="bg-emerald-600 hover:bg-emerald-700 flex-1 sm:flex-none">
            <PlusIcon className="w-4 h-4 mr-2" />
            Pinjaman Baru
          </Button>
        </div>
      </div>

      {/* Ringkasan Statistik */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
            <ChartBarIcon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Ringkasan Hutang & Angsuran</p>
            <p className="text-xs text-gray-500">Total kewajiban dan rencana pembayaran</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl bg-emerald-50/60 px-3 py-2 border border-emerald-100">
            <p className="text-[10px] uppercase font-bold text-emerald-700 mb-1">Total Plafon Pinjaman</p>
            {isLoading ? (
              <Skeleton className="h-6 w-24 mt-1" />
            ) : (
              <p className="text-lg font-bold text-gray-900">{formatCurrency(stats.totalPinjaman)}</p>
            )}
          </div>
          <div className="rounded-xl bg-red-50/60 px-3 py-2 border border-red-100">
            <p className="text-[10px] uppercase font-bold text-red-700 mb-1">Total Sisa Pinjaman</p>
            {isLoading ? (
              <Skeleton className="h-6 w-24 mt-1" />
            ) : (
              <p className="text-lg font-bold text-red-600">{formatCurrency(stats.totalSisa)}</p>
            )}
          </div>
          <div className="rounded-xl bg-amber-50/60 px-3 py-2 border border-amber-100">
            <p className="text-[10px] uppercase font-bold text-amber-700 mb-1">Total Angsuran/Bulan</p>
            {isLoading ? (
              <Skeleton className="h-6 w-24 mt-1" />
            ) : (
              <p className="text-lg font-bold text-gray-900">{formatCurrency(stats.totalAngsuran)}</p>
            )}
          </div>
          <div className="rounded-xl bg-emerald-50/60 px-3 py-2 border border-emerald-100">
            <p className="text-[10px] uppercase font-bold text-emerald-700 mb-1">Pinjaman Aktif</p>
            {isLoading ? (
              <Skeleton className="h-6 w-24 mt-1" />
            ) : (
              <p className="text-lg font-bold text-gray-900">{stats.pinjamanAktif} Pinjaman</p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <DataTable
          columns={columns(handleView, handlePay, handleDelete)}
          data={data}
          isLoading={isLoading}
          renderMobileCards={({ data, isLoading }) => (
            <div className="space-y-4">
              {isLoading ? (
                [...Array(3)].map((_, i) => (
                  <div key={i} className="bg-white p-4 rounded-xl border border-gray-100 space-y-3">
                    <Skeleton className="h-5 w-1/2" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                ))
              ) : data.map((loan: HutangBank) => (
                <div key={loan.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <p className="font-bold text-gray-900">{loan.namaBank}</p>
                      <Badge variant={loan.status === 'AKTIF' ? 'default' : 'secondary'}>
                        {loan.status}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500 font-medium">Tgl {loan.jatuhTempo}</p>
                      <p className="text-[11px] text-gray-500">{formatDateId(computeTanggalJatuhTempoAkhir(loan))}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-50">
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase font-bold">Sisa Pinjaman</p>
                      <p className="text-sm font-bold text-red-600">{formatCurrency(loan.sisaPinjaman)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase font-bold">Angsuran / Bln</p>
                      <p className="text-sm font-bold text-gray-900">{formatCurrency(loan.angsuranBulanan)}</p>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="sm" className="flex-1 rounded-lg" onClick={() => handleView(loan)}>
                      Detail
                    </Button>
                    {loan.status === 'AKTIF' && (
                      <Button size="sm" className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-700" onClick={() => handlePay(loan)}>
                        Bayar
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        />
        
        {/* Pagination */}
        {meta && meta.totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2 py-4 border-t border-gray-50">
            <div className="text-xs text-gray-500 text-center sm:text-left order-2 sm:order-1">
              Menampilkan <span className="font-semibold text-gray-900">{((page - 1) * limit) + 1}</span> sampai <span className="font-semibold text-gray-900">{Math.min(page * limit, meta.total)}</span> dari <span className="font-semibold text-gray-900">{meta.total}</span> data
            </div>
            <div className="flex items-center gap-2 order-1 sm:order-2 w-full sm:w-auto justify-center sm:justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1 || isLoading}
                className="rounded-lg h-8 px-2"
              >
                <span className="hidden sm:inline">Sebelumnya</span>
                <span className="sm:hidden">&larr;</span>
              </Button>
              <div className="flex items-center gap-1 overflow-x-auto max-w-[120px] sm:max-w-none no-scrollbar">
                {[...Array(meta.totalPages)].map((_, i) => (
                  <Button
                    key={i + 1}
                    variant={page === i + 1 ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPage(i + 1)}
                    disabled={isLoading}
                    className={`h-8 w-8 min-w-[2rem] p-0 rounded-lg ${page === i + 1 ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
                  >
                    {i + 1}
                  </Button>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
                disabled={page === meta.totalPages || isLoading}
                className="rounded-lg h-8 px-2"
              >
                <span className="hidden sm:inline">Selanjutnya</span>
                <span className="sm:hidden">&rarr;</span>
              </Button>
            </div>
          </div>
        )}
      </div>

      <HutangBankModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchData}
        loan={selectedLoan}
        mode={modalMode}
      />

      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Hapus Pinjaman"
        description="Apakah Anda yakin ingin menghapus data pinjaman ini? Semua riwayat transaksi di Kasir yang terkait dengan pinjaman ini juga akan ikut terhapus. Tindakan ini tidak dapat dibatalkan."
        variant="emerald"
      />
    </div>
  );
}
