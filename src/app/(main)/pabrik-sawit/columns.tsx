'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ArrowsUpDownIcon, EllipsisHorizontalIcon, PencilSquareIcon, TrashIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { PabrikSawit } from '@/lib/definitions';
import Link from 'next/link';

export const createPabrikSawitColumns = (
  onEdit: (pabrik: PabrikSawit) => void,
  onDelete: (pabrik: PabrikSawit) => void
): ColumnDef<PabrikSawit>[] => [
  {
    accessorKey: 'name',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Nama
          <ArrowsUpDownIcon className="ml-2 h-4 w-4" />
        </Button>
      );
    },
  },
  {
    accessorKey: 'perusahaan.name',
    header: 'Perusahaan Penjual',
    cell: ({ row }) => (row.original as any).perusahaan?.name || '-',
  },
  {
    accessorKey: 'address',
    header: 'Alamat',
  },
  {
    id: 'totalBeratNetto',
    header: 'Berat Netto',
    cell: ({ row }) => {
      const stats = row.original.stats;
      if (!stats || stats.totalBeratNetto === 0) return '-';
      return new Intl.NumberFormat('id-ID').format(stats.totalBeratNetto) + ' kg';
    },
    footer: ({ table }) => {
      const total = table.getFilteredRowModel().rows.reduce((acc, row) => {
        return acc + (row.original.stats?.totalBeratNetto || 0);
      }, 0);
      return total > 0 ? new Intl.NumberFormat('id-ID').format(total) + ' kg' : '-';
    },
  },
  {
    id: 'totalPotongan',
    header: 'Total Potongan',
    cell: ({ row }) => {
      const stats = row.original.stats;
      if (!stats || stats.totalPotongan === 0) return '-';
      return new Intl.NumberFormat('id-ID').format(stats.totalPotongan) + ' kg';
    },
    footer: ({ table }) => {
      const total = table.getFilteredRowModel().rows.reduce((acc, row) => {
        return acc + (row.original.stats?.totalPotongan || 0);
      }, 0);
      return total > 0 ? new Intl.NumberFormat('id-ID').format(total) + ' kg' : '-';
    },
  },
  {
    id: 'totalBerat',
    header: 'Total Berat',
    cell: ({ row }) => {
      const stats = row.original.stats;
      if (!stats || stats.totalBerat === 0) return '-';
      return new Intl.NumberFormat('id-ID').format(stats.totalBerat) + ' kg';
    },
    footer: ({ table }) => {
      const total = table.getFilteredRowModel().rows.reduce((acc, row) => {
        return acc + (row.original.stats?.totalBerat || 0);
      }, 0);
      return total > 0 ? new Intl.NumberFormat('id-ID').format(total) + ' kg' : '-';
    },
  },
  {
    id: 'rataRataHarga',
    header: 'Rata-rata Harga',
    cell: ({ row }) => {
      const stats = row.original.stats;
      if (!stats || stats.rataRataHarga === 0) return '-';
      return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(stats.rataRataHarga);
    },
    footer: ({ table }) => {
      const rows = table.getFilteredRowModel().rows;
      const totalNilai = rows.reduce((acc, row) => acc + (row.original.stats?.totalNilai || 0), 0);
      const totalBerat = rows.reduce((acc, row) => acc + (row.original.stats?.totalBerat || 0), 0);
      const avg = totalBerat > 0 ? totalNilai / totalBerat : 0;
      return avg > 0 ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(avg) : '-';
    },
  },
  {
    id: 'totalNilai',
    header: 'Total Penjualan',
    cell: ({ row }) => {
      const stats = row.original.stats;
      if (!stats || stats.totalNilai === 0) return '-';
      return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(stats.totalNilai);
    },
    footer: ({ table }) => {
      const total = table.getFilteredRowModel().rows.reduce((acc, row) => {
        return acc + (row.original.stats?.totalNilai || 0);
      }, 0);
      return total > 0 ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(total) : '-';
    },
  },
  {
    id: 'ppn',
    header: 'PPn 11%',
    cell: ({ row }) => {
      const stats = row.original.stats;
      if (!stats || stats.totalNilai === 0) return '-';
      const ppn = stats.totalNilai * 0.11;
      return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(ppn);
    },
    footer: ({ table }) => {
      const totalNilai = table.getFilteredRowModel().rows.reduce((acc, row) => {
        return acc + (row.original.stats?.totalNilai || 0);
      }, 0);
      const totalPPn = totalNilai * 0.11;
      return totalPPn > 0 ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(totalPPn) : '-';
    },
  },
  {
    id: 'pph',
    header: 'PPh 0.25%',
    cell: ({ row }) => {
      const stats = row.original.stats;
      if (!stats || stats.totalNilai === 0) return '-';
      const pph = stats.totalNilai * 0.0025;
      return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(pph);
    },
    footer: ({ table }) => {
      const totalNilai = table.getFilteredRowModel().rows.reduce((acc, row) => {
        return acc + (row.original.stats?.totalNilai || 0);
      }, 0);
      const totalPPh = totalNilai * 0.0025;
      return totalPPh > 0 ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(totalPPh) : '-';
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const pabrik = row.original;
      return (
        <div className="text-right">
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
                <Link href={`/nota-sawit?pabrikId=${pabrik.id}`} className="flex items-center cursor-pointer">
                  <DocumentTextIcon className="mr-2 h-4 w-4" />
                  <span>Lihat Nota</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(pabrik)}>
                <PencilSquareIcon className="mr-2 h-4 w-4" />
                <span>Ubah</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-red-600"
                onClick={() => onDelete(pabrik)}
              >
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
