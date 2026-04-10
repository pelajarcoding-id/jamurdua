import React, { useState, useEffect } from 'react';
import { NotaSawitData } from './columns';

interface PrintableNotaProps {
  nota: NotaSawitData;
}

const formatCurrency = (num: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
const formatDate = (date: Date) => new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

export const PrintableNota = React.forwardRef<HTMLDivElement, PrintableNotaProps>(({ nota }, ref) => {
  const [imageBase64, setImageBase64] = useState<string | null>(null);

  useEffect(() => {
    if (nota.gambarNotaUrl) {
      fetch(nota.gambarNotaUrl)
        .then(response => response.blob())
        .then(blob => {
          const reader = new FileReader();
          reader.onloadend = () => {
            setImageBase64(reader.result as string);
          };
          reader.readAsDataURL(blob);
        });
    }
  }, [nota.gambarNotaUrl]);

  if (!nota) return null;

  const timbangan = nota.timbangan;
  const beratTotal = (timbangan?.netKg ?? 0) - nota.potongan;

  return (
    <div ref={ref} className="p-8 font-sans">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold">Nota Sawit</h1>
        <p className="text-sm"></p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 mb-8">
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
          
          <div className="mt-2 pt-2 border-t border-gray-300">
             <div className="flex justify-end items-center gap-4">
               <span className="text-sm">PPh (0.25%)</span>
               <span className="font-bold text-red-600">{formatCurrency(nota.pph || 0)}</span>
             </div>
             <div className="flex justify-end items-center gap-4 mt-1">
               <span className="font-bold text-lg text-blue-800">BAYAR SETELAH PPH</span>
               <span className="font-bold text-2xl text-blue-800">{formatCurrency(nota.pembayaranSetelahPph || nota.totalPembayaran)}</span>
             </div>
          </div>

          <p className={`font-bold text-lg mt-4 px-3 py-1 rounded-md inline-block ${nota.statusPembayaran === 'LUNAS' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
            {nota.statusPembayaran.replace('_', ' ')}
          </p>
        </div>
      </div>

      {imageBase64 && (
        <div className="mt-8 pt-8" style={{ pageBreakBefore: 'always' }}>
          <h3 className="text-lg font-semibold mb-4 text-center">Lampiran Gambar Nota</h3>
          <div className="flex justify-center">
            <img src={imageBase64} alt="Nota Sawit" className="max-w-full h-auto object-contain border p-2" />
          </div>
        </div>
      )}


    </div>
  );
});

PrintableNota.displayName = 'PrintableNota';
