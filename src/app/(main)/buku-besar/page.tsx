'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Skeleton } from '@/components/ui/skeleton';

interface AkunSaldo {
  akun: string;
  totalDebit: number;
  totalKredit: number;
  saldo: number;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value);
};

const BukuBesarPage = () => {
  const [data, setData] = useState<AkunSaldo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/buku-besar');
        if (!response.ok) {
          throw new Error('Gagal mengambil data buku besar');
        }
        const result = await response.json();
        setData(result);
      } catch (error) {
        console.error(error);
        toast.error('Gagal mengambil data buku besar.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Buku Besar</h1>
      <div className="rounded-md border">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Akun</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Debit</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Kredit</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Saldo Akhir</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>
                  <td className="px-6 py-4"><Skeleton className="h-5 w-48" /></td>
                  <td className="px-6 py-4"><Skeleton className="h-5 w-32 ml-auto" /></td>
                  <td className="px-6 py-4"><Skeleton className="h-5 w-32 ml-auto" /></td>
                  <td className="px-6 py-4"><Skeleton className="h-5 w-32 ml-auto" /></td>
                </tr>
              ))
            ) : data.length > 0 ? (
              data.map((akun) => (
                <tr key={akun.akun}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600 hover:underline">
                    <Link href={`/buku-besar/${encodeURIComponent(akun.akun)}`}>
                      {akun.akun}
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right">{formatCurrency(akun.totalDebit)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right">{formatCurrency(akun.totalKredit)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold">{formatCurrency(akun.saldo)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="h-24 text-center">Tidak ada data jurnal untuk ditampilkan.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BukuBesarPage;
