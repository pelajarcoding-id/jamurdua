'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { BuildingOfficeIcon, XMarkIcon, CheckIcon, BanknotesIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ModalContentWrapper, ModalFooter, ModalHeader } from '@/components/ui/modal-elements'

interface HutangBankModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  loan?: any; // For view/edit/pay
  mode: 'add' | 'pay' | 'view';
}

// Helper for formatting currency while typing
const formatCurrency = (value: number | string) => {
  if (!value && value !== 0) return '';
  const number = typeof value === 'string' ? parseInt(value.replace(/\D/g, '')) || 0 : value;
  return new Intl.NumberFormat('id-ID', {
    style: 'decimal',
    minimumFractionDigits: 0,
  }).format(number);
};

const parseCurrency = (value: string) => {
  return parseInt(value.replace(/\D/g, '')) || 0;
};

const computeTanggalJatuhTempoAkhir = (tanggalMulai: string, lamaPinjaman: number, jatuhTempo: number) => {
  const start = new Date(tanggalMulai)
  if (Number.isNaN(start.getTime())) return null
  const monthsToAdd = Math.max(0, Number(lamaPinjaman || 0) - 1)
  const targetYear = start.getFullYear()
  const targetMonth = start.getMonth() + monthsToAdd
  const base = new Date(targetYear, targetMonth, 1)
  const daysInMonth = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate()
  const day = Math.min(Math.max(1, Number(jatuhTempo || 1)), daysInMonth)
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

const FormattedCurrencyInput = ({ value, onChange, id, required, placeholder, disabled }: any) => {
  const [displayValue, setDisplayValue] = useState(formatCurrency(value));

  useEffect(() => {
    setDisplayValue(formatCurrency(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const numericValue = parseCurrency(rawValue);
    setDisplayValue(formatCurrency(numericValue));
    onChange(numericValue);
  };

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">Rp</span>
      <Input
        id={id}
        required={required}
        value={displayValue}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        className="pl-10 font-semibold rounded-xl border-gray-200"
      />
    </div>
  );
};

export default function HutangBankModal({
  isOpen,
  onClose,
  onSuccess,
  loan,
  mode,
}: HutangBankModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    namaBank: '',
    jumlahHutang: 0,
    angsuranBulanan: 0,
    lamaPinjaman: 12,
    tanggalMulai: format(new Date(), 'yyyy-MM-dd'),
    jatuhTempo: 1,
    keterangan: '',
    jumlahBayar: 0,
    tanggalBayar: format(new Date(), 'yyyy-MM-dd'),
    keteranganBayar: '',
  });

  useEffect(() => {
    if (loan) {
      setFormData((prev) => ({
        ...prev,
        namaBank: loan.namaBank || '',
        jumlahHutang: loan.jumlahHutang || 0,
        angsuranBulanan: loan.angsuranBulanan || 0,
        lamaPinjaman: loan.lamaPinjaman || 12,
        tanggalMulai: loan.tanggalMulai ? format(new Date(loan.tanggalMulai), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
        jatuhTempo: loan.jatuhTempo || 1,
        keterangan: loan.keterangan || '',
        jumlahBayar: loan.angsuranBulanan || 0,
      }));
    } else {
      setFormData({
        namaBank: '',
        jumlahHutang: 0,
        angsuranBulanan: 0,
        lamaPinjaman: 12,
        tanggalMulai: format(new Date(), 'yyyy-MM-dd'),
        jatuhTempo: 1,
        keterangan: '',
        jumlahBayar: 0,
        tanggalBayar: format(new Date(), 'yyyy-MM-dd'),
        keteranganBayar: '',
      });
    }
  }, [loan, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      let url = '/api/hutang-bank';
      let method = 'POST';
      let body: any = {};

      if (mode === 'add') {
        body = {
          namaBank: formData.namaBank,
          jumlahHutang: Number(formData.jumlahHutang),
          angsuranBulanan: Number(formData.angsuranBulanan),
          lamaPinjaman: Number(formData.lamaPinjaman),
          tanggalMulai: formData.tanggalMulai,
          jatuhTempo: Number(formData.jatuhTempo),
          keterangan: formData.keterangan,
        };
      } else if (mode === 'pay') {
        url = `/api/hutang-bank/${loan.id}/bayar`;
        body = {
          jumlah: Number(formData.jumlahBayar),
          tanggal: formData.tanggalBayar,
          keterangan: formData.keteranganBayar,
        };
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Terjadi kesalahan');
      }

      toast.success(mode === 'add' ? 'Pinjaman berhasil ditambahkan' : 'Pembayaran berhasil dicatat');
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!loan) return;

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      // Header
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('RINCIAN PINJAMAN BANK', pageWidth / 2, 15, { align: 'center' });
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Dicetak pada: ${format(new Date(), 'dd MMMM yyyy HH:mm', { locale: idLocale })}`, pageWidth / 2, 22, { align: 'center' });

      // Loan Info
      doc.setDrawColor(200);
      doc.line(14, 28, pageWidth - 14, 28);
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('INFORMASI PINJAMAN', 14, 35);
      
      const infoRows = [
        ['Nama Bank / Kreditur', `: ${loan.namaBank}`],
        ['Total Pinjaman', `: ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(loan.jumlahHutang)}`],
        ['Sisa Pinjaman', `: ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(loan.sisaPinjaman)}`],
        ['Angsuran Bulanan', `: ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(loan.angsuranBulanan)}`],
        ['Lama Pinjaman', `: ${loan.lamaPinjaman} Bulan`],
        ['Tanggal Angsuran', `: Setiap Tanggal ${loan.jatuhTempo || 1}`],
        ['Status', `: ${loan.status}`],
      ];

      autoTable(doc, {
        startY: 38,
        body: infoRows,
        theme: 'plain',
        styles: { fontSize: 10, cellPadding: 1.5 },
        columnStyles: { 0: { cellWidth: 45, fontStyle: 'bold' } },
      });

      // Payment History
      const finalY = (doc as any).lastAutoTable.finalY;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('RIWAYAT PEMBAYARAN ANGSURAN (KASIR)', 14, finalY + 12);

      const historyData = loan.kasTransaksi
        ?.filter((t: any) => t.tipe === 'PENGELUARAN')
        .map((trx: any, index: number) => [
          String(index + 1),
          format(new Date(trx.date), 'dd MMM yyyy', { locale: idLocale }),
          trx.deskripsi,
          new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(trx.jumlah)
        ]);

      if (historyData && historyData.length > 0) {
        autoTable(doc, {
          startY: finalY + 15,
          head: [['NO', 'TANGGAL', 'KETERANGAN', 'JUMLAH']],
          body: historyData,
          headStyles: { fillColor: [37, 99, 235], halign: 'center' }, // Blue-600
          styles: { fontSize: 9, valign: 'middle' },
          columnStyles: { 
            0: { cellWidth: 10, halign: 'center' },
            1: { cellWidth: 35, halign: 'center' },
            3: { cellWidth: 40, halign: 'right' } 
          },
        });
      } else {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'italic');
        doc.text('Belum ada riwayat pembayaran angsuran.', 14, finalY + 20);
      }

      // Footer
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Halaman ${i} dari ${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
        doc.text('Aplikasi Sarakan - Sistem ERP Sawit', 14, doc.internal.pageSize.getHeight() - 10);
      }

      doc.save(`Rincian_Pinjaman_${loan.namaBank.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`);
      toast.success('PDF berhasil diunduh');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Gagal membuat PDF');
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl top-[calc(12px+env(safe-area-inset-top))] translate-y-0 sm:top-[50%] sm:translate-y-[-50%] max-h-[calc(100dvh-24px-env(safe-area-inset-top)-env(safe-area-inset-bottom))] sm:max-h-[90vh] p-0 overflow-hidden flex flex-col [&>button.absolute]:hidden">
        <ModalHeader
          title={mode === 'add' ? 'Tambah Pinjaman Bank' : mode === 'pay' ? 'Bayar Angsuran' : 'Detail Pinjaman'}
          subtitle={mode === 'add' ? 'Isi formulir untuk menambah pinjaman baru.' : mode === 'pay' ? `Pembayaran untuk ${loan?.namaBank || ''}` : `Informasi pinjaman ${loan?.namaBank || ''}`}
          variant="emerald"
          icon={mode === 'pay' ? <BanknotesIcon className="h-5 w-5 text-white" /> : <BuildingOfficeIcon className="h-5 w-5 text-white" />}
          onClose={onClose}
        />

          {mode === 'view' ? (
            <div className="flex flex-col flex-1 min-h-0">
              <ModalContentWrapper className="space-y-6 flex-1 min-h-0 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <div className="grid grid-cols-2 gap-6 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <div>
                  <Label className="text-gray-500 text-xs uppercase tracking-wider">Nama Bank / Kreditur</Label>
                  <p className="font-bold text-lg text-gray-800">{loan?.namaBank}</p>
                </div>
                <div>
                  <Label className="text-gray-500 text-xs uppercase tracking-wider">Status Pinjaman</Label>
                  <div className="mt-1">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${loan?.status === 'AKTIF' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                      {loan?.status}
                    </span>
                  </div>
                </div>
                <div>
                  <Label className="text-gray-500 text-xs uppercase tracking-wider">Total Pinjaman</Label>
                  <p className="font-bold text-xl text-emerald-700">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(loan?.jumlahHutang || 0)}</p>
                </div>
                <div>
                  <Label className="text-gray-500 text-xs uppercase tracking-wider">Sisa Pinjaman</Label>
                  <p className="font-bold text-xl text-red-600">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(loan?.sisaPinjaman || 0)}</p>
                </div>
                <div>
                  <Label className="text-gray-500 text-xs uppercase tracking-wider">Angsuran Bulanan</Label>
                  <p className="font-semibold text-gray-700">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(loan?.angsuranBulanan || 0)}</p>
                </div>
                <div>
                  <Label className="text-gray-500 text-xs uppercase tracking-wider">Lama Pinjaman</Label>
                  <p className="font-semibold text-gray-700">{loan?.lamaPinjaman} Bulan</p>
                </div>
                <div>
                  <Label className="text-gray-500 text-xs uppercase tracking-wider">Tanggal Angsuran</Label>
                  <p className="font-semibold text-gray-700">Setiap Tanggal {loan?.jatuhTempo || 1}</p>
                </div>
              </div>

              <div className="mt-8">
                <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-600"></div>
                  Riwayat Pembayaran (Kasir)
                </h3>
                <div className="overflow-hidden rounded-2xl border border-gray-100">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left text-gray-500 border-b border-gray-100">
                        <th className="p-4 font-semibold">Tanggal</th>
                        <th className="p-4 font-semibold">Deskripsi</th>
                        <th className="p-4 text-right font-semibold">Jumlah</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {loan?.kasTransaksi?.filter((t: any) => t.tipe === 'PENGELUARAN').map((trx: any) => (
                        <tr key={trx.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="p-4 text-gray-600">{format(new Date(trx.date), 'dd MMM yyyy')}</td>
                          <td className="p-4 text-gray-700 font-medium">{trx.deskripsi}</td>
                          <td className="p-4 text-right font-bold text-red-600">
                            {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(trx.jumlah)}
                          </td>
                        </tr>
                      ))}
                      {loan?.kasTransaksi?.filter((t: any) => t.tipe === 'PENGELUARAN').length === 0 && (
                        <tr>
                          <td colSpan={3} className="p-8 text-center text-gray-400 italic">Belum ada riwayat pembayaran</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              </ModalContentWrapper>

              <ModalFooter className="sm:justify-between">
                <Button type="button" variant="outline" onClick={onClose} className="rounded-full px-6">
                  <XMarkIcon className="h-4 w-4 mr-2" />
                  Tutup
                </Button>
                <Button
                  type="button"
                  onClick={handleDownloadPDF}
                  className="bg-emerald-600 hover:bg-emerald-700 rounded-full px-6 shadow-md shadow-emerald-200"
                >
                  <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
              </ModalFooter>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
              {mode === 'add' ? (
                <ModalContentWrapper className="space-y-6 flex-1 min-h-0 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="namaBank" className="text-gray-700 font-medium">Nama Bank / Kreditur</Label>
                      <Input
                        id="namaBank"
                        required
                        value={formData.namaBank}
                        onChange={(e) => setFormData({ ...formData, namaBank: e.target.value })}
                        placeholder="Contoh: Bank BRI / Koperasi Mandiri"
                        className="rounded-xl border-gray-200 focus:ring-emerald-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="jumlahHutang" className="text-gray-700 font-medium">Total Pinjaman</Label>
                      <FormattedCurrencyInput
                        id="jumlahHutang"
                        required
                        value={formData.jumlahHutang}
                        onChange={(val: number) => setFormData({ ...formData, jumlahHutang: val })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="angsuranBulanan" className="text-gray-700 font-medium">Angsuran Bulanan</Label>
                      <FormattedCurrencyInput
                        id="angsuranBulanan"
                        required
                        value={formData.angsuranBulanan}
                        onChange={(val: number) => setFormData({ ...formData, angsuranBulanan: val })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lamaPinjaman" className="text-gray-700 font-medium">Lama Pinjaman (Bulan)</Label>
                      <Input
                        id="lamaPinjaman"
                        type="number"
                        required
                        value={formData.lamaPinjaman}
                        onChange={(e) => setFormData({ ...formData, lamaPinjaman: Number(e.target.value) })}
                        className="rounded-xl border-gray-200"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tanggalMulai" className="text-gray-700 font-medium">Tanggal Pencairan</Label>
                      <Input
                        id="tanggalMulai"
                        type="date"
                        required
                        value={formData.tanggalMulai}
                        onChange={(e) => setFormData({ ...formData, tanggalMulai: e.target.value })}
                        className="rounded-xl border-gray-200"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="jatuhTempo" className="text-gray-700 font-medium">Tanggal Angsuran (1-31)</Label>
                      <Input
                        id="jatuhTempo"
                        type="number"
                        min="1"
                        max="31"
                        required
                        value={formData.jatuhTempo}
                        onChange={(e) => setFormData({ ...formData, jatuhTempo: Number(e.target.value) })}
                        placeholder="Contoh: 5"
                        className="rounded-xl border-gray-200"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-700 font-medium">Tanggal Jatuh Tempo (Akhir)</Label>
                      <Input
                        value={formatDateId(computeTanggalJatuhTempoAkhir(formData.tanggalMulai, formData.lamaPinjaman, formData.jatuhTempo))}
                        disabled
                        className="rounded-xl border-gray-200 bg-gray-50"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="keterangan" className="text-gray-700 font-medium">Keterangan Tambahan</Label>
                    <Textarea
                      id="keterangan"
                      value={formData.keterangan}
                      onChange={(e) => setFormData({ ...formData, keterangan: e.target.value })}
                      placeholder="Catatan tambahan jika ada..."
                      className="rounded-xl border-gray-200 min-h-[100px]"
                    />
                  </div>
                </ModalContentWrapper>
              ) : (
                <ModalContentWrapper className="space-y-6 flex-1 min-h-0 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  <div className="grid grid-cols-2 gap-4 bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                    <div className="space-y-1">
                      <span className="text-xs text-emerald-700 uppercase font-bold tracking-wider">Sisa Pinjaman</span>
                      <p className="font-bold text-lg text-emerald-900">
                        {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(loan?.sisaPinjaman || 0)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-emerald-700 uppercase font-bold tracking-wider">Angsuran Normal</span>
                      <p className="font-bold text-lg text-emerald-900">
                        {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(loan?.angsuranBulanan || 0)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="jumlahBayar" className="text-gray-700 font-medium">Jumlah Pembayaran</Label>
                      <FormattedCurrencyInput
                        id="jumlahBayar"
                        required
                        value={formData.jumlahBayar}
                        onChange={(val: number) => setFormData({ ...formData, jumlahBayar: val })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tanggalBayar" className="text-gray-700 font-medium">Tanggal Pembayaran</Label>
                      <Input
                        id="tanggalBayar"
                        type="date"
                        required
                        value={formData.tanggalBayar}
                        onChange={(e) => setFormData({ ...formData, tanggalBayar: e.target.value })}
                        className="rounded-xl border-gray-200"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="keteranganBayar" className="text-gray-700 font-medium">Keterangan Pembayaran</Label>
                      <Input
                        id="keteranganBayar"
                        value={formData.keteranganBayar}
                        onChange={(e) => setFormData({ ...formData, keteranganBayar: e.target.value })}
                        placeholder="Contoh: Angsuran Bulan April 2024"
                        className="rounded-xl border-gray-200"
                      />
                    </div>
                  </div>
                </ModalContentWrapper>
              )}
              
              <ModalFooter className="sm:justify-between">
                <Button type="button" variant="outline" onClick={onClose} disabled={isLoading} className="rounded-full px-6">
                  <XMarkIcon className="h-4 w-4 mr-2" />
                  Batal
                </Button>
                <Button type="submit" disabled={isLoading} className="bg-emerald-600 hover:bg-emerald-700 rounded-full px-8 shadow-md shadow-emerald-200">
                  {isLoading ? 'Menyimpan...' : (
                    <>
                      <CheckIcon className="h-4 w-4 mr-2" />
                      {mode === 'add' ? 'Tambah Pinjaman' : 'Simpan Pembayaran'}
                    </>
                  )}
                </Button>
              </ModalFooter>
            </form>
          )}
      </DialogContent>
    </Dialog>
  );
}
