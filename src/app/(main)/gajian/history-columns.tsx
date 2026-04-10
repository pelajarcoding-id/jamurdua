'use client';

import type { Gajian } from '@prisma/client';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EllipsisHorizontalIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

const formatNumber = (num: number) => new Intl.NumberFormat('id-ID').format(num);
const formatDate = (date: Date) => new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(date);

export const historyColumns: ColumnDef<Gajian>[] = [
  {
    accessorKey: 'tanggalMulai',
    header: 'Periode',
    cell: ({ row }) => {
      const { tanggalMulai, tanggalSelesai } = row.original;
      return <span>{`${formatDate(new Date(tanggalMulai))} - ${formatDate(new Date(tanggalSelesai))}`}</span>;
    },
  },
  {
    accessorKey: 'totalNota',
    header: 'Total Nota',
  },
  {
    accessorKey: 'totalBerat',
    header: () => <div className="text-right">Total Berat (Kg)</div>,
    cell: ({ row }) => <div className="text-right">{formatNumber(row.original.totalBerat)}</div>,
  },
  {
    accessorKey: 'totalGaji',
    header: () => <div className="text-right">Jumlah Gaji (Rp)</div>,
    cell: ({ row }) => <div className="text-right">{formatNumber(row.original.totalGaji || 0)}</div>,
  },
  {
    accessorKey: 'keterangan',
    header: 'Keterangan',
  },
  {
    accessorKey: 'createdAt',
    header: 'Tanggal Dibuat',
    cell: ({ row }) => formatDate(new Date(row.original.createdAt)),
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const gajian = row.original;

      return (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Buka menu</span>
                <EllipsisHorizontalIcon className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Aksi</DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link href={`/gajian/print/${gajian.id}`} target="_blank">
                  Print
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/gajian/edit/${gajian.id}`}>
                  <PencilIcon className="mr-2 h-4 w-4" />
                  <span>Edit</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem className="text-red-600">
                <TrashIcon className="mr-2 h-4 w-4" />
                <span>Hapus</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
  },
];
