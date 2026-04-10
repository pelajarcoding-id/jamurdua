'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { CalendarIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { DateRange } from 'react-day-picker';
import toast from 'react-hot-toast';
import { useReactToPrint } from 'react-to-print';
import { Skeleton } from '@/components/ui/skeleton';

interface SupirReportData {
  supirId: number;
  supirName: string;
  totalRit: number;
  totalNetKg: number;
}

const LaporanSupirPage = () => {
  const [date, setDate] = useState<DateRange | undefined>();
  const [reportData, setReportData] = useState<SupirReportData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [summary, setSummary] = useState({
    totalSupir: 0,
    totalRit: 0,
    totalTonase: 0,
  });

  const printableRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printableRef,
    documentTitle:
      date?.from && date?.to
        ? `Laporan Supir ${format(date.from, 'dd-MM-yyyy')} - ${format(date.to, 'dd-MM-yyyy')}`
        : 'Laporan Supir',
    pageStyle: `
      @media print {
        body {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      }
    `,
  });

  useEffect(() => {
    if (reportData.length > 0) {
      const totalRit = reportData.reduce((acc, supir) => acc + supir.totalRit, 0);
      const totalTonase = reportData.reduce((acc, supir) => acc + supir.totalNetKg, 0);
      setSummary({
        totalSupir: reportData.length,
        totalRit,
        totalTonase,
      });
    } else {
        setSummary({
            totalSupir: 0,
            totalRit: 0,
            totalTonase: 0,
        });
    }
  }, [reportData]);

  const fetchReport = async () => {
    if (!date || !date.from || !date.to) {
      toast.error('Silakan pilih rentang tanggal terlebih dahulu.');
      return;
    }

    setIsLoading(true);
    try {
      const start = format(date.from, 'yyyy-MM-dd')
      const end = format(date.to, 'yyyy-MM-dd')
      const response = await fetch(
        `/api/laporan-supir?startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}`
      );
      if (!response.ok) {
        throw new Error('Gagal mengambil data laporan');
      }
      const data = await response.json();
      setReportData(data);
    } catch (error) {
      console.error(error);
      toast.error('Gagal mengambil data laporan.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Laporan Supir</h1>

      <div className="flex items-center gap-4 mb-4">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className="w-[300px] justify-start text-left font-normal"
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date?.from ? (
                date.to ? (
                  <>{format(date.from, 'LLL dd, y')} - {format(date.to, 'LLL dd, y')}</>
                ) : (
                  format(date.from, 'LLL dd, y')
                )
              ) : (
                <span>Pilih tanggal</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={date?.from}
              selected={date}
              onSelect={setDate}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
        <Button onClick={fetchReport} disabled={isLoading}>
          {isLoading ? 'Memuat...' : 'Tampilkan Laporan'}
        </Button>
        <Button onClick={() => handlePrint()} variant="outline" disabled={reportData.length === 0 || isLoading}>
          Cetak
        </Button>
      </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg shadow-md">
                <h3 className="text-lg font-semibold text-gray-500 truncate" title="Total Supir">Total Supir</h3>
                {isLoading ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-2xl font-bold truncate" title={summary.totalSupir.toString()}>{summary.totalSupir}</p>
                )}
            </div>
            <div className="bg-white p-4 rounded-lg shadow-md">
                <h3 className="text-lg font-semibold text-gray-500 truncate" title="Total Rit">Total Rit</h3>
                {isLoading ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-2xl font-bold truncate" title={summary.totalRit.toString()}>{summary.totalRit}</p>
                )}
            </div>
            <div className="bg-white p-4 rounded-lg shadow-md">
                <h3 className="text-lg font-semibold text-gray-500 truncate" title="Total Tonase (Kg)">Total Tonase (Kg)</h3>
                {isLoading ? (
                  <Skeleton className="h-8 w-24 mt-1" />
                ) : (
                  <p className="text-2xl font-bold truncate" title={summary.totalTonase.toLocaleString('id-ID')}>{summary.totalTonase.toLocaleString('id-ID')}</p>
                )}
            </div>
        </div>

      <div ref={printableRef} className="p-4 border rounded-md">
        <h2 className="text-xl font-semibold text-center mb-4">Laporan Supir</h2>
        {date?.from && date?.to && (
          <p className="text-center mb-4">
            Periode: {format(date.from, 'dd MMMM yyyy')} - {format(date.to, 'dd MMMM yyyy')}
          </p>
        )}
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-200">
              <th className="border p-2">Nama Supir</th>
              <th className="border p-2">Total Rit</th>
              <th className="border p-2">Total Tonase (Kg)</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
               [...Array(5)].map((_, i) => (
                 <tr key={i}>
                   <td className="border p-2"><Skeleton className="h-4 w-full" /></td>
                   <td className="border p-2"><Skeleton className="h-4 w-full" /></td>
                   <td className="border p-2"><Skeleton className="h-4 w-full" /></td>
                 </tr>
               ))
            ) : reportData.length > 0 ? (
              reportData.map((row) => (
                <tr key={row.supirId}>
                  <td className="border p-2">{row.supirName}</td>
                  <td className="border p-2 text-center">{row.totalRit}</td>
                  <td className="border p-2 text-right">{row.totalNetKg.toLocaleString('id-ID')}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="border p-2 text-center">Tidak ada data untuk ditampilkan.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LaporanSupirPage;
