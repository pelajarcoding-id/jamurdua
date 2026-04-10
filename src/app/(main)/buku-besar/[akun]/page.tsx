'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Jurnal } from '@prisma/client';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value);
};

const BukuBesarDetailPage = () => {
  const params = useParams();
  const akun = params.akun ? decodeURIComponent(params.akun as string) : '';
  const [transactions, setTransactions] = useState<Jurnal[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!akun) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/buku-besar/${encodeURIComponent(akun)}`);
        if (!response.ok) {
          throw new Error('Gagal mengambil detail transaksi');
        }
        const result = await response.json();
        setTransactions(result);
      } catch (error) {
        console.error(error);
        toast.error('Gagal mengambil detail transaksi.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [akun]);

  let runningBalance = 0;

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Buku Besar: {akun}</h1>
        <Link href="/buku-besar" className="text-blue-600 hover:underline">
          &larr; Kembali ke Buku Besar
        </Link>
      </div>
      <div className="rounded-md border">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tanggal</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deskripsi</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Debit</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Kredit</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Saldo</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>
                  <td className="px-6 py-4"><Skeleton className="h-5 w-24" /></td>
                  <td className="px-6 py-4"><Skeleton className="h-5 w-48" /></td>
                  <td className="px-6 py-4"><Skeleton className="h-5 w-32 ml-auto" /></td>
                  <td className="px-6 py-4"><Skeleton className="h-5 w-32 ml-auto" /></td>
                  <td className="px-6 py-4"><Skeleton className="h-5 w-32 ml-auto" /></td>
                </tr>
              ))
            ) : transactions.length > 0 ? (
              transactions.map((trx) => {
                runningBalance += (trx.debit || 0) - (trx.kredit || 0);
                return (
                  <tr key={trx.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{format(new Date(trx.date), 'dd-MM-yyyy')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{trx.deskripsi}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">{formatCurrency(trx.debit || 0)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">{formatCurrency(trx.kredit || 0)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold">{formatCurrency(runningBalance)}</td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="h-24 text-center">Tidak ada transaksi untuk akun ini.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BukuBesarDetailPage;
