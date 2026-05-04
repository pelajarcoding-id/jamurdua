'use client';

import { ColumnDef } from '@tanstack/react-table';
import { KasTransaksi } from '@/types/kasir';
import { Button } from '@/components/ui/button';
import { EllipsisHorizontalIcon, EyeIcon } from '@heroicons/react/24/outline';
import { formatIdCurrency } from '@/lib/utils';
import { formatWIBDateDisplay } from '@/lib/wib-date';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const formatCurrency = formatIdCurrency
const formatDate = formatWIBDateDisplay

type KasTransaksiRow = KasTransaksi & {
  __optimistic?: boolean
  __optimisticKey?: string
}

export const columns = (
  onDelete: (id: number) => void,
  onEdit: (data: KasTransaksi) => void,
  onDetail: (data: KasTransaksi) => void,
  onViewImage: (url: string) => void,
  formatKeterangan: (ket?: string | null) => string
): ColumnDef<KasTransaksiRow>[] => [
  {
    id: 'no',
    header: 'No',
    cell: ({ row, table }) => {
      const meta = table.options.meta as any
      const page = Number(meta?.page || 1)
      const limit = Number(meta?.limit || 0)
      const base = Number.isFinite(page) && page > 0 && Number.isFinite(limit) && limit > 0 ? (page - 1) * limit : 0
      return <div className="text-gray-600 tabular-nums">{base + row.index + 1}</div>
    },
  },
  {
    accessorKey: 'date',
    header: 'Tanggal',
    cell: ({ row }) => (
      <div className="text-gray-700">{formatDate(row.original.date)}</div>
    ),
  },
  {
    accessorKey: 'deskripsi',
    header: 'Deskripsi',
    cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <div className="font-medium max-w-[200px] truncate" title={row.original.deskripsi}>{row.original.deskripsi}</div>
          {row.original.__optimistic ? (
            <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
              Menyimpan...
            </span>
          ) : null}
        </div>
    ),
    footer: () => <div className="text-gray-700">TOTAL</div>,
  },
  {
    accessorKey: 'kategori',
    header: 'Kategori',
    cell: ({ row }) => {
      const trx = row.original;
      let display = trx.kategori || 'UMUM';
      if (trx.kategori === 'KEBUN' && trx.kebun) {
        display = `KEBUN: ${trx.kebun.name}`;
      } else if (trx.kategori === 'KENDARAAN' && trx.kendaraan) {
        display = `KENDARAAN: ${trx.kendaraan.platNomor}`;
      } else if (trx.kategori === 'GAJI' && trx.karyawan) {
        display = `GAJI: ${trx.karyawan.name}`;
      } else if (trx.kategori === 'HUTANG_KARYAWAN' && trx.karyawan) {
        display = `HUTANG: ${trx.karyawan.name}`;
      } else if (trx.kategori === 'PEMBAYARAN_HUTANG' && trx.karyawan) {
        display = `BAYAR HUTANG: ${trx.karyawan.name}`;
      }
      
      return (
        <div className="max-w-[150px] truncate" title={display}>
          {display}
        </div>
      );
    }
  },
  {
    header: 'Pemasukan',
    accessorKey: 'pemasukan',
    cell: ({ row }) => (
      <div className="text-right">
        {row.original.tipe === 'PEMASUKAN' ? formatCurrency(row.original.jumlah) : ''}
      </div>
    ),
    footer: ({ table }) => {
      const total = table.getRowModel().rows.reduce((acc, r) => {
        const tipe = String((r.original as any)?.tipe || '').toUpperCase()
        return tipe === 'PEMASUKAN' ? acc + Number((r.original as any)?.jumlah || 0) : acc
      }, 0)
      return <div className="text-right">{formatCurrency(total)}</div>
    },
  },
  {
    header: 'Pengeluaran',
    accessorKey: 'pengeluaran',
    cell: ({ row }) => (
      <div className="text-right text-red-600">
        {row.original.tipe === 'PENGELUARAN' ? formatCurrency(row.original.jumlah) : ''}
      </div>
    ),
    footer: ({ table }) => {
      const total = table.getRowModel().rows.reduce((acc, r) => {
        const tipe = String((r.original as any)?.tipe || '').toUpperCase()
        return tipe === 'PENGELUARAN' ? acc + Number((r.original as any)?.jumlah || 0) : acc
      }, 0)
      return <div className="text-right text-red-600">{formatCurrency(total)}</div>
    },
  },
  {
    accessorKey: 'keterangan',
    header: 'Keterangan',
    cell: ({ row }) => {
      const text = formatKeterangan(row.original.keterangan)
      return (
        <div className="max-w-[200px] truncate" title={text}>{text}</div>
      )
    }
  },
  {
    accessorKey: 'gambarUrl',
    header: 'Gambar',
    cell: ({ row }) => {
        const url = row.original.gambarUrl;
        return url ? (
            <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation()
                  onViewImage(url)
                }} 
                className="h-8 w-8 text-blue-500 hover:text-blue-700"
                title="Lihat Gambar"
            >
                <EyeIcon className="h-4 w-4" />
            </Button>
        ) : null;
    }
  },
  {
    id: 'actions',
    cell: ({ row }) => {
        const trx = row.original;
        if (trx.__optimistic) {
          return (
            <div className="text-xs text-gray-400 text-right pr-2">
              Menyimpan...
            </div>
          )
        }
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-8 w-8 p-0"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="sr-only">Open menu</span>
                <EllipsisHorizontalIcon className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuLabel>Aksi</DropdownMenuLabel>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(trx) }}>
                Ubah
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDetail(trx) }}>
                Detail
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600"
                onClick={(e) => { e.stopPropagation(); onDelete(trx.id) }}
              >
                Hapus
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
    }
  }
];
