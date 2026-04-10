'use client'

import { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';

export type SupirData = {
  supirId: number;
  supir: string;
  jumlahNota: number;
  totalDiberikan: number;
  totalPengeluaran: number;
  saldoUangJalan: number;
  totalBerat: number;
  rataRataBerat: number;
};

export const columns = (onDetail: (row: SupirData) => void): ColumnDef<SupirData>[] => [
  {
    accessorKey: 'supir',
    header: () => <div className="text-left">Supir</div>,
    cell: ({ row }) => <div className="text-left">{row.getValue('supir')}</div>,
  },
  {
    accessorKey: 'jumlahNota',
    header: () => <div className="text-center">Jumlah Nota</div>,
    cell: ({ row }) => <div className="text-center">{row.getValue('jumlahNota')}</div>,
  },
  {
    accessorKey: 'totalDiberikan',
    header: () => <div className="text-right">Uang Jalan Diberikan</div>,
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue('totalDiberikan'));
      const formatted = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
      }).format(amount);

      return <div className="text-right font-medium">{formatted}</div>;
    },
  },
  {
    accessorKey: 'totalPengeluaran',
    header: () => <div className="text-right">Uang Jalan Pengeluaran</div>,
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue('totalPengeluaran'));
      const formatted = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
      }).format(amount);

      return <div className="text-right font-medium">{formatted}</div>;
    },
  },
  {
    accessorKey: 'saldoUangJalan',
    header: () => <div className="text-right">Saldo Uang Jalan</div>,
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue('saldoUangJalan'));
      const formatted = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
      }).format(amount);

      return <div className="text-right font-semibold">{formatted}</div>;
    },
  },
  {
    accessorKey: 'totalBerat',
    header: () => <div className="text-right">Total Berat Nota Sawit</div>,
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue('totalBerat'));
      const formatted = new Intl.NumberFormat('id-ID').format(amount);

      return <div className="text-right font-medium">{formatted} kg</div>;
    },
  },
  {
    accessorKey: 'rataRataBerat',
    header: () => <div className="text-right">Rata-rata Berat / Nota</div>,
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue('rataRataBerat'));
      const formatted = new Intl.NumberFormat('id-ID', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(amount);

      return <div className="text-right font-medium">{formatted} kg</div>;
    },
  },
  {
    id: 'aksi',
    header: () => <div className="text-right">Aksi</div>,
    cell: ({ row }) => (
      <div className="flex justify-end">
        <Button variant="outline" className="h-8 rounded-full" onClick={() => onDetail(row.original)}>
          Detail
        </Button>
      </div>
    ),
  },
];
