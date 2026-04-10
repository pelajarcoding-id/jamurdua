'use client';

import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { useReactToPrint } from 'react-to-print';
import { format, parseISO } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

interface ReportData {
  pendapatan: { akun: string; total: number }[];
  totalPendapatan: number;
  beban: { akun: string; total: number }[];
  totalBeban: number;
  labaBersih: number;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value);
};

const LabaRugiPage = () => {
  const [data, setData] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  });

  const printableRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printableRef,
    documentTitle: `Laporan Laba Rugi ${startDate} - ${endDate}`,
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!startDate || !endDate) return;

      setIsLoading(true);
      try {
        const response = await fetch(`/api/laporan/laba-rugi?startDate=${startDate}&endDate=${endDate}`);
        if (!response.ok) {
          throw new Error('Gagal mengambil data laporan');
        }
        const result = await response.json();
        setData(result);
      } catch (error) {
        console.error(error);
        toast.error('Gagal mengambil data laporan.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [startDate, endDate]);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Laporan Laba Rugi</h1>

      <div className="bg-white p-4 rounded-lg shadow-md mb-4 print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">Tanggal Mulai</label>
            <input type="date" id="startDate" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input-style w-full" />
          </div>
          <div>
            <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">Tanggal Akhir</label>
            <input type="date" id="endDate" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input-style w-full" />
          </div>
          <button onClick={handlePrint} className="btn-primary w-full">Cetak Laporan</button>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white p-8 rounded-lg shadow-md">
          <div className="text-center mb-6">
            <Skeleton className="h-8 w-48 mx-auto mb-2" />
            <Skeleton className="h-4 w-64 mx-auto" />
          </div>

          {/* Pendapatan Skeleton */}
          <div className="mb-6">
            <Skeleton className="h-6 w-32 mb-4" />
            {[...Array(3)].map((_, i) => (
              <div key={`p-${i}`} className="flex justify-between py-1">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
            <div className="flex justify-between border-t pt-2 mt-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-5 w-36" />
            </div>
          </div>

          {/* Beban Skeleton */}
          <div className="mb-6">
            <Skeleton className="h-6 w-32 mb-4" />
            {[...Array(4)].map((_, i) => (
              <div key={`b-${i}`} className="flex justify-between py-1">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
            <div className="flex justify-between border-t pt-2 mt-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-5 w-36" />
            </div>
          </div>

          {/* Laba Bersih Skeleton */}
          <div className="flex justify-between border-t-2 pt-4 mt-4">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-7 w-40" />
          </div>
        </div>
      ) : data ? (
        <div ref={printableRef} className="bg-white p-8 rounded-lg shadow-md">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold">Laporan Laba Rugi</h2>
            <p className="text-sm">Periode {format(parseISO(startDate), 'dd MMMM yyyy')} - {format(parseISO(endDate), 'dd MMMM yyyy')}</p>
          </div>

          {/* Pendapatan */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold border-b pb-2 mb-2">Pendapatan</h3>
            {data.pendapatan.map((item) => (
              <div key={item.akun} className="flex justify-between py-1">
                <span>{item.akun}</span>
                <span>{formatCurrency(item.total)}</span>
              </div>
            ))}
            <div className="flex justify-between font-bold border-t pt-2 mt-2">
              <span>Total Pendapatan</span>
              <span>{formatCurrency(data.totalPendapatan)}</span>
            </div>
          </div>

          {/* Beban */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold border-b pb-2 mb-2">Beban</h3>
            {data.beban.map((item) => (
              <div key={item.akun} className="flex justify-between py-1">
                <span>{item.akun}</span>
                <span>{formatCurrency(item.total)}</span>
              </div>
            ))}
            <div className="flex justify-between font-bold border-t pt-2 mt-2">
              <span>Total Beban</span>
              <span>{formatCurrency(data.totalBeban)}</span>
            </div>
          </div>

          {/* Laba Bersih */}
          <div className={`flex justify-between text-lg font-bold border-t-2 pt-4 mt-4 ${data.labaBersih >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            <span>Laba (Rugi) Bersih</span>
            <span>{formatCurrency(data.labaBersih)}</span>
          </div>
        </div>
      ) : (
        <div className="text-center p-8">Tidak ada data untuk ditampilkan.</div>
      )}
    </div>
  );
};

export default LabaRugiPage;
