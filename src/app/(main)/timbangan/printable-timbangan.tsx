'use client'

import React from 'react';
import { TimbanganData } from './columns';

interface PrintableTimbanganProps {
  timbangan: TimbanganData;
}

const formatDate = (date: Date) => new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

const PrintableTimbangan = React.forwardRef<HTMLDivElement, PrintableTimbanganProps>(({ timbangan }, ref) => {
  if (!timbangan) return null;

  return (
    <div ref={ref} className="p-8 font-sans">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold">Detail Timbangan</h1>
        <p className="text-sm">Kebun: {timbangan.kebun.name}</p>
        <p className="text-sm">Tanggal: {formatDate(timbangan.date)}</p>
        <p className="text-sm">Supir: {timbangan.supir?.name || '-'}</p>
        <p className="text-sm">Kendaraan: {timbangan.kendaraan?.platNomor || '-'}</p>
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
            <td className="p-2 text-right">{timbangan.grossKg.toLocaleString('id-ID')}</td>
          </tr>
          <tr className="border-b">
            <td className="p-2">Tara</td>
            <td className="p-2 text-right">{timbangan.tareKg.toLocaleString('id-ID')}</td>
          </tr>
          <tr className="border-b-2 border-black">
            <td className="p-2"><strong>Netto</strong></td>
            <td className="p-2 text-right"><strong>{timbangan.netKg.toLocaleString('id-ID')}</strong></td>
          </tr>
        </tbody>
      </table>

      {timbangan.notes && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold">Catatan</h2>
          <p>{timbangan.notes}</p>
        </div>
      )}

      {timbangan.photoUrl && (
        <div>
          <h2 className="text-xl font-semibold">Foto</h2>
          <img src={timbangan.photoUrl} alt="Foto Timbangan" className="max-w-full h-auto" />
        </div>
      )}
    </div>
  );
});

PrintableTimbangan.displayName = 'PrintableTimbangan';

export default PrintableTimbangan;
