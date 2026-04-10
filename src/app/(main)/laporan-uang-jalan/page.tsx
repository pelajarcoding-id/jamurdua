'use client'
import type { UangJalan, User as Supir } from '@prisma/client'
import { useState, useEffect } from 'react'
import { Skeleton } from "@/components/ui/skeleton"

type UangJalanItem = UangJalan & { supir: Supir };

export default function LaporanUangJalanPage() {
  const [items, setItems] = useState<UangJalanItem[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/uang-jalan?startDate=${startDate}&endDate=${endDate}&limit=1000`);
        const result = await res.json();
        
        // Flatten the sessions (SesiUangJalan) to get all transactions (UangJalan)
        // and attach the driver (Supir) info to each transaction
        const flattenedItems: UangJalanItem[] = (result.data || []).flatMap((sesi: any) => 
          sesi.rincian.map((rincian: any) => ({
            ...rincian,
            date: rincian.createdAt, // Map createdAt to date
            supir: sesi.supir,
          }))
        ).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

        setItems(flattenedItems);
      } catch (error) {
        console.error('Error fetching data:', error);
        setItems([]);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [startDate, endDate]);

  const totalAmount = items.reduce((acc, item) => {
    if (item.tipe === 'PENGELUARAN') {
      return acc - item.amount;
    }
    return acc + item.amount;
  }, 0);

  const formatCurrency = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

  const handlePrint = () => {
    window.print();
  };

  return (
    <main className="p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Laporan Uang Jalan</h1>
        
        <div className="bg-white p-6 rounded-lg shadow-md mb-8 print:hidden">
          <h2 className="text-xl font-semibold mb-4">Filter Laporan</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">Tanggal Mulai</label>
              <input type="date" id="startDate" name="startDate" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input-style" />
            </div>
            <div>
              <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">Tanggal Akhir</label>
              <input type="date" id="endDate" name="endDate" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input-style" />
            </div>
            <button onClick={handlePrint} className="btn-primary w-full">Cetak</button>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex flex-col md:flex-row justify-between md:items-center mb-4">
            <h2 className="text-xl font-semibold mb-2 md:mb-0">Riwayat Uang Jalan</h2>
            <div className="text-right">
              <p className="text-lg font-bold">Total: <span className="text-blue-600">{formatCurrency(totalAmount)}</span></p>
            </div>
          </div>

          <div className="hidden md:grid md:grid-cols-5 gap-4 font-bold text-gray-600 border-b pb-2 mb-4">
            <div className="th-style">ID</div>
            <div className="th-style">Tanggal</div>
            <div className="th-style">Supir</div>
            <div className="th-style">Deskripsi</div>
            <div className="th-style text-right">Jumlah</div>
          </div>

          <div className="space-y-4">
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <div key={i} className="bg-gray-50 p-4 rounded-lg shadow-sm md:grid md:grid-cols-5 md:gap-4 md:items-center">
                   <div className="md:hidden">
                     <Skeleton className="h-6 w-1/2 mb-2" />
                     <Skeleton className="h-4 w-1/3 mb-2" />
                     <Skeleton className="h-16 w-full mb-2" />
                     <Skeleton className="h-8 w-1/4 ml-auto" />
                   </div>
                   <Skeleton className="hidden md:block h-4 w-full" />
                   <Skeleton className="hidden md:block h-4 w-full" />
                   <Skeleton className="hidden md:block h-4 w-full" />
                   <Skeleton className="hidden md:block h-4 w-full" />
                   <Skeleton className="hidden md:block h-4 w-full" />
                </div>
              ))
            ) : items.map((it) => (
              <div key={it.id} className="bg-gray-50 p-4 rounded-lg shadow-sm md:grid md:grid-cols-5 md:gap-4 md:items-center">
                
                <div className="md:hidden">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-bold text-lg">{it.supir.name}</div>
                      <div className="text-sm text-gray-500">{new Date(it.date).toLocaleDateString('id-ID')} | ID: {it.id}</div>
                    </div>
                  </div>
                  <p className="text-gray-800 mb-3">{it.description}</p>
                  <div className="text-right bg-white p-2 rounded-md">
                    <div className={`${it.tipe === 'PENGELUARAN' ? 'text-red-600' : 'text-blue-600'} font-semibold`}>
                      {it.tipe === 'PENGELUARAN' ? '-' : ''}{formatCurrency(it.amount)}
                    </div>
                  </div>
                </div>

                <div className="hidden md:block td-style font-medium">{it.id}</div>
                <div className="hidden md:block td-style">{new Date(it.date).toLocaleDateString('id-ID')}</div>
                <div className="hidden md:block td-style">{it.supir.name}</div>
                <div className="hidden md:block td-style">{it.description}</div>
                <div className={`hidden md:block td-style text-right ${it.tipe === 'PENGELUARAN' ? 'text-red-600' : 'text-blue-600'}`}>
                  {it.tipe === 'PENGELUARAN' ? '-' : ''}{formatCurrency(it.amount)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
