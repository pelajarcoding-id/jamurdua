
import React from 'react';
import { SesiUangJalanWithDetails } from './page';
import type { UangJalan } from '@prisma/client';

interface PrintableUangJalanProps {
    data: SesiUangJalanWithDetails;
}

const formatCurrency = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
const formatDate = (date: string | Date) => new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(date));

export const PrintableUangJalan = React.forwardRef<HTMLDivElement, PrintableUangJalanProps>(({ data }, ref) => {
    return (
        <div ref={ref} className="p-8 font-sans">
            <header className="text-center mb-8">
                <h1 className="text-2xl font-bold">Laporan Rincian Uang Jalan</h1>
                <p className="text-sm text-gray-600">Periode: {formatDate(data.tanggalMulai)}</p>
            </header>

            {/* Informasi Utama */}
            <section className="mb-6 border-b pb-4">
                <h2 className="text-lg font-semibold mb-2">Informasi Sesi</h2>
                <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                    <div><strong>Supir:</strong> {data.supir.name}</div>
                    <div><strong>Status:</strong> {data.status}</div>
                    <div><strong>Keterangan:</strong> {data.keterangan || '-'}</div>
                    {data.kendaraan && <div><strong>Kendaraan:</strong> {data.kendaraan.platNomor} - {data.kendaraan.merk}</div>}
                </div>
            </section>

            {/* Rincian Transaksi */}
            <section className="mb-6">
                <h2 className="text-lg font-semibold mb-2">Rincian Transaksi</h2>
                <table className="w-full text-sm border-collapse border border-gray-300">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="p-2 border border-gray-300 text-left">Tanggal</th>
                            <th className="p-2 border border-gray-300 text-left">Keterangan</th>
                            <th className="p-2 border border-gray-300 text-left">Tipe</th>
                            <th className="p-2 border border-gray-300 text-right">Nominal</th>
                            <th className="p-2 border border-gray-300 text-center">Gambar</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.rincian.map((r: UangJalan & { gambarUrl?: string | null }) => (
                            <tr key={r.id}>
                                <td className="p-2 border border-gray-300">{formatDate(r.date)}</td>
                                <td className="p-2 border border-gray-300">{r.description || '-'}</td>
                                <td className="p-2 border border-gray-300">{r.tipe}</td>
                                <td className="p-2 border border-gray-300 text-right">{formatCurrency(r.amount)}</td>
                                <td className="p-2 border border-gray-300 text-center">
                                    {r.gambarUrl ? 'Ada' : '-'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>

            {/* Ringkasan Keuangan */}
            <section className="mt-8">
                <h2 className="text-lg font-semibold mb-2">Ringkasan Keuangan</h2>
                <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="p-4 bg-blue-100 rounded-lg">
                        <p className="text-sm font-semibold">Total Diberikan</p>
                        <p className="text-xl font-bold">{formatCurrency(data.totalDiberikan)}</p>
                    </div>
                    <div className="p-4 bg-red-100 rounded-lg">
                        <p className="text-sm font-semibold">Total Pengeluaran</p>
                        <p className="text-xl font-bold">{formatCurrency(data.totalPengeluaran)}</p>
                    </div>
                    <div className="p-4 bg-gray-200 rounded-lg">
                        <p className="text-sm font-semibold">Saldo Akhir</p>
                        <p className="text-xl font-bold">{formatCurrency(data.saldo)}</p>
                    </div>
                </div>
            </section>

            {/* Lampiran Gambar */}
            <section className="mt-8 pt-8 border-t-2 border-dashed">
                <h2 className="text-lg font-semibold mb-4 text-center">Lampiran Gambar</h2>
                <div className="grid grid-cols-3 gap-4">
                    {data.rincian.filter((r: UangJalan & { gambarUrl?: string | null }) => r.gambarUrl).map((r: UangJalan & { gambarUrl?: string | null }) => (
                        <div key={r.id} className="border rounded-lg p-2 break-inside-avoid">
                            <img src={r.gambarUrl!} alt={r.description || 'Gambar Rincian'} className="w-full h-auto rounded-md mb-2" />
                            <p className="text-xs text-gray-600">{formatDate(r.date)}</p>
                            <p className="text-sm font-semibold">{r.description || 'Tanpa Keterangan'}</p>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
});

PrintableUangJalan.displayName = 'PrintableUangJalan';
