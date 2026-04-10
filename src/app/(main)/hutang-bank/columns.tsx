'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Eye, Trash, Banknote } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type HutangBank = {
  id: number;
  namaBank: string;
  jumlahHutang: number;
  angsuranBulanan: number;
  lamaPinjaman: number;
  tanggalMulai: string;
  keterangan: string | null;
  status: string;
  sisaPinjaman: number;
  jatuhTempo: number;
};

const computeTanggalJatuhTempoAkhir = (loan: HutangBank) => {
  const start = new Date(loan.tanggalMulai)
  if (Number.isNaN(start.getTime())) return null
  const monthsToAdd = Math.max(0, Number(loan.lamaPinjaman || 0) - 1)
  const targetYear = start.getFullYear()
  const targetMonth = start.getMonth() + monthsToAdd
  const base = new Date(targetYear, targetMonth, 1)
  const daysInMonth = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate()
  const day = Math.min(Math.max(1, Number(loan.jatuhTempo || 1)), daysInMonth)
  return new Date(base.getFullYear(), base.getMonth(), day)
}

const formatDateId = (d: Date | null) => {
  if (!d) return '-'
  try {
    return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(d)
  } catch {
    return '-'
  }
}

export const columns = (
  onView: (loan: HutangBank) => void,
  onPay: (loan: HutangBank) => void,
  onDelete: (loan: HutangBank) => void
): ColumnDef<HutangBank>[] => [
  {
    accessorKey: 'namaBank',
    header: 'Nama Bank / Kreditur',
    footer: 'TOTAL',
  },
  {
    accessorKey: 'jumlahHutang',
    header: 'Total Pinjaman',
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue('jumlahHutang'));
      return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
      }).format(amount);
    },
    footer: ({ table }) => {
      const total = table.getFilteredRowModel().rows.reduce((sum, row) => sum + (row.getValue('jumlahHutang') as number), 0);
      return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
      }).format(total);
    },
  },
  {
    accessorKey: 'angsuranBulanan',
    header: 'Angsuran / Bln',
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue('angsuranBulanan'));
      return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
      }).format(amount);
    },
    footer: ({ table }) => {
      const total = table.getFilteredRowModel().rows.reduce((sum, row) => sum + (row.getValue('angsuranBulanan') as number), 0);
      return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
      }).format(total);
    },
  },
  {
    accessorKey: 'lamaPinjaman',
    header: 'Lama (Bulan)',
    cell: ({ row }) => `${row.getValue('lamaPinjaman')} Bulan`,
  },
  {
    accessorKey: 'jatuhTempo',
    header: 'Tgl Angsuran',
    cell: ({ row }) => `Tgl ${row.getValue('jatuhTempo')}`,
  },
  {
    id: 'tanggalJatuhTempo',
    header: 'Jatuh Tempo',
    cell: ({ row }) => {
      const d = computeTanggalJatuhTempoAkhir(row.original)
      return formatDateId(d)
    },
  },
  {
    accessorKey: 'sisaPinjaman',
    header: 'Sisa Pinjaman',
    cell: ({ row }) => {
      const amount = row.original.sisaPinjaman;
      return (
        <span className={amount > 0 ? 'text-red-600 font-semibold' : 'text-green-600 font-semibold'}>
          {new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
          }).format(amount)}
        </span>
      );
    },
    footer: ({ table }) => {
      const total = table.getFilteredRowModel().rows.reduce((sum, row) => sum + (row.original as HutangBank).sisaPinjaman, 0);
      return (
        <span className="text-red-600 font-bold">
          {new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
          }).format(total)}
        </span>
      );
    },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.getValue('status') as string;
      return (
        <Badge variant={status === 'AKTIF' ? 'default' : 'secondary'}>
          {status}
        </Badge>
      );
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const loan = row.original;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Aksi</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onView(loan)}>
              <Eye className="mr-2 h-4 w-4" /> Detail & Riwayat
            </DropdownMenuItem>
            {loan.status === 'AKTIF' && (
              <DropdownMenuItem onClick={() => onPay(loan)}>
                <Banknote className="mr-2 h-4 w-4" /> Bayar Angsuran
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onDelete(loan)} className="text-red-600">
              <Trash className="mr-2 h-4 w-4" /> Hapus
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
