'use client'

import React, { forwardRef } from 'react';
import type { NotaSawitData } from './columns';

interface PrintableBulkNotaProps {
  notas: NotaSawitData[];
}

const formatCurrency = (num: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
const formatDate = (date: Date) => new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

export const PrintableBulkNota = forwardRef<HTMLDivElement, PrintableBulkNotaProps>(({ notas }, ref) => {
  if (!notas || notas.length === 0) return null;

  return (
    <div ref={ref} className="bg-white text-black font-sans">
      {notas.map((nota) => {
        const timbangan = nota.timbangan;
        const beratTotal = (timbangan?.netKg ?? 0) - nota.potongan;

        return (
          <div key={nota.id} className="p-8 break-after-page">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold">Nota Sawit</h1>
            </div>

            <div className="grid grid-cols-2 gap-x-12 mb-8">
              <div>
                <p><strong>Pabrik Sawit:</strong> {nota.pabrikSawit.name}</p>
                <p><strong>Tanggal Bongkar:</strong> {nota.tanggalBongkar ? formatDate(nota.tanggalBongkar) : '-'}</p>
                <p><strong>Supir:</strong> {nota.supir.name}</p>
                <p><strong>Kebun:</strong> {timbangan?.kebun?.name || '-'}</p>
              </div>
              <div>
                <p><strong>No. Polisi:</strong> {nota.kendaraan?.platNomor}</p>
                <p><strong>Kendaraan:</strong> {nota.kendaraan?.merk}</p>
              </div>
            </div>

            <table className="w-full mb-8 border-collapse text-left">
              <thead>
                <tr className="border-b-2 border-black">
                  <th className="p-2">Keterangan</th>
                  <th className="p-2 text-right">Berat (Kg)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="p-2">Bruto</td>
                  <td className="p-2 text-right">{(timbangan?.grossKg ?? 0).toLocaleString('id-ID')}</td>
                </tr>
                <tr className="border-b">
                  <td className="p-2">Tara</td>
                  <td className="p-2 text-right">{(timbangan?.tareKg ?? 0).toLocaleString('id-ID')}</td>
                </tr>
                <tr className="border-b-2 border-black">
                  <td className="p-2"><strong>Netto</strong></td>
                  <td className="p-2 text-right"><strong>{(timbangan?.netKg ?? 0).toLocaleString('id-ID')}</strong></td>
                </tr>
                <tr className="border-b">
                  <td className="p-2">Potongan</td>
                  <td className="p-2 text-right text-red-500">{nota.potongan.toLocaleString('id-ID')}</td>
                </tr>
                <tr className="border-b-2 border-black">
                  <td className="p-2"><strong>Berat Akhir Diterima</strong></td>
                  <td className="p-2 text-right"><strong>{beratTotal.toLocaleString('id-ID')}</strong></td>
                </tr>
              </tbody>
            </table>

            <div className="grid grid-cols-2 gap-x-12">
              <div>
                <p><strong>Harga / Kg:</strong> {formatCurrency(nota.hargaPerKg)}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-lg">TOTAL PEMBAYARAN</p>
                <p className="font-bold text-2xl">{formatCurrency(nota.totalPembayaran)}</p>
                <p className={`font-bold text-lg mt-2 px-3 py-1 rounded-md inline-block ${nota.statusPembayaran === 'LUNAS' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                  {nota.statusPembayaran.replace('_', ' ')}
                </p>
              </div>
            </div>

            {nota.gambarNotaUrl && (
              <div className="mt-8 pt-8" style={{ pageBreakBefore: 'always' }}>
                <h3 className="text-lg font-semibold mb-4 text-center">Lampiran Gambar Nota</h3>
                <div className="flex justify-center">
                  <img src={nota.gambarNotaUrl} alt="Nota Sawit" className="max-w-full h-auto object-contain border p-2" />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});

PrintableBulkNota.displayName = 'PrintableBulkNota';
