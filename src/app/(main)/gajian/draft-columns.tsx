'use client';

import type { ColumnDef } from '@tanstack/react-table';
import type { Gajian, Kebun } from '@prisma/client';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EllipsisHorizontalIcon, TrashIcon, ArrowRightIcon, EyeIcon } from '@heroicons/react/24/outline';

const formatDate = (date: Date) => new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(date);
const formatNumber = (num: number) => new Intl.NumberFormat('id-ID').format(num);

export const createDraftColumns = (
  onContinue: (id: number) => void,
  onDelete: (id: number) => void,
  onDetail: (id: number) => void
): ColumnDef<(Gajian & { kebun: Kebun })>[] => [
  {
    accessorKey: 'kebun.name',
    header: 'Kebun',
  },
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
    accessorKey: 'totalBiayaLain',
    header: () => <div className="text-right">Total Gaji (Rp)</div>,
    cell: ({ row }) => <div className="text-right">{formatNumber(row.original.totalBiayaLain || 0)}</div>,
  },
  {
    accessorKey: 'totalPotongan',
    header: () => <div className="text-right">Potongan (Rp)</div>,
    cell: ({ row }) => <div className="text-right text-red-600">-{formatNumber(row.original.totalPotongan || 0)}</div>,
  },
  {
    accessorKey: 'totalGaji',
    header: () => <div className="text-right">Jumlah Gaji (Rp)</div>,
    cell: ({ row }) => <div className="text-right">{formatNumber(row.original.totalGaji || 0)}</div>,
  },
  {
    accessorKey: 'updatedAt',
    header: 'Terakhir Diubah',
    cell: ({ row }) => formatDate(new Date(row.original.updatedAt)),
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const gajian = row.original;
      return (
        <div className="text-right">
          <Button
            onClick={() => onContinue(gajian.id)}
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            Lanjutkan
            <ArrowRightIcon className="ml-2 h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0 ml-2">
                <span className="sr-only">Buka menu</span>
                <EllipsisHorizontalIcon className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Aksi Lain</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => onDetail(gajian.id)}>
                <EyeIcon className="mr-2 h-4 w-4" />
                <span>Lihat Detail</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-red-600"
                onClick={() => onDelete(gajian.id)}
              >
                <TrashIcon className="mr-2 h-4 w-4" />
                <span>Hapus Draft</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
  },
];
