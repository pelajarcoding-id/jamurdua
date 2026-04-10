'use client'

import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table'

import type { NotaSawit, Timbangan, Kebun, User, Kendaraan, PabrikSawit } from '@prisma/client'
import ModalUbah from './modal';
import { EllipsisHorizontalIcon, EyeIcon } from "@heroicons/react/24/outline"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { Checkbox } from "@/components/ui/checkbox"

const formatNumber = (num: number) => new Intl.NumberFormat('id-ID').format(num);
const formatCurrency = (num: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);

export type NotaSawitData = NotaSawit & {
  supir: User;
  timbangan: Timbangan & { 
    kebun: Kebun;
    supir?: User | null;
    kendaraan?: Kendaraan | null;
  } | null; // Timbangan can be null now
  kebun?: Kebun | null; // Kebun manual
  kendaraan: Kendaraan | null;
  kendaraanPlatNomor: string | null;
  pabrikSawit: PabrikSawit;
  tanggalBongkar?: Date | null;
  pembayaranAktual?: number | null;
  pph25?: number | null;
};

export const columns: ColumnDef<NotaSawitData>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    header: 'No',
    cell: ({ row }) => row.index + 1,
  },
  {
    accessorKey: 'kendaraan.platNomor',
    header: 'Plat Nomor',
  },
  {
    accessorKey: 'supir.name',
    header: 'Supir',
    id: 'supir_name', // ID unik untuk filter
  },
  {
    accessorKey: 'pabrikSawit.name',
    header: 'Pabrik Sawit',
  },
  {
    accessorKey: 'tanggalBongkar',
    header: 'Tanggal Bongkar',
    cell: ({ row }) => {
      const { tanggalBongkar } = row.original;
      return tanggalBongkar ? new Date(tanggalBongkar).toLocaleDateString('id-ID') : '-';
    },
  },
  {
    accessorKey: 'timbangan.kebun.name',
    header: 'Kebun',
    cell: ({ row }) => {
        const timbanganKebun = row.original.timbangan?.kebun?.name;
        const manualKebun = row.original.kebun?.name;
        return timbanganKebun || manualKebun || '-';
    }
  },
  {
    accessorKey: 'bruto', // Change accessorKey since timbangan can be null
    id: 'bruto', // Use ID for column
    header: () => <div className="text-right">Bruto (Kg)</div>,
    cell: ({ row }) => {
        // Fallback logic handled in backend now, but good to be safe
        const val = row.original.bruto || row.original.timbangan?.grossKg || 0;
        return <div className="text-right">{formatNumber(val)}</div>
    },
    footer: ({ table }) => {
      const total = table.getRowModel().rows.reduce((sum, row) => sum + (row.original.bruto || row.original.timbangan?.grossKg || 0), 0);
      return <div className="text-right font-bold">{formatNumber(total)}</div>
    }
  },
  {
    accessorKey: 'tara', // Change accessorKey
    id: 'tara',
    header: () => <div className="text-right">Tara (Kg)</div>,
    cell: ({ row }) => {
        const val = row.original.tara || row.original.timbangan?.tareKg || 0;
        return <div className="text-right">{formatNumber(val)}</div>
    },
    footer: ({ table }) => {
      const total = table.getRowModel().rows.reduce((sum, row) => sum + (row.original.tara || row.original.timbangan?.tareKg || 0), 0);
      return <div className="text-right">{formatNumber(total)}</div>;
    },
  },
  {
    accessorKey: 'netto', // Change accessorKey
    id: 'netto',
    header: () => <div className="text-right">Netto (Kg)</div>,
    cell: ({ row }) => {
        const val = row.original.netto || row.original.timbangan?.netKg || 0;
        return <div className="text-right">{formatNumber(val)}</div>
    },
    footer: ({ table }) => {
      const total = table.getRowModel().rows.reduce((sum, row) => sum + (row.original.netto || row.original.timbangan?.netKg || 0), 0);
      return <div className="text-right">{formatNumber(total)}</div>;
    },
  },
  {
    accessorKey: 'potongan',
    header: () => <div className="text-right">Potongan</div>,
    cell: ({ row }) => <div className="text-right text-red-500">{formatNumber(row.original.potongan)}</div>,
    footer: ({ table }) => {
      const total = table.getRowModel().rows.reduce((sum, row) => sum + row.original.potongan, 0);
      return <div className="text-right text-red-500">{formatNumber(total)}</div>;
    },
  },
  {
    accessorKey: 'beratAkhir',
    header: () => <div className="text-right">Berat Akhir (Kg)</div>,
    cell: ({ row }) => <div className="text-right font-bold">{formatNumber(row.original.beratAkhir)}</div>,
    footer: ({ table }) => {
      const total = table.getRowModel().rows.reduce((sum, row) => sum + row.original.beratAkhir, 0);
      return <div className="text-right font-bold">{formatNumber(total)}</div>;
    },
  },
  {
    accessorKey: 'hargaPerKg',
    header: () => <div className="text-right">Harga/Kg</div>,
    cell: ({ row }) => <div className="text-right">{formatCurrency(row.original.hargaPerKg)}</div>,
    footer: ({ table }) => {
      const rows = table.getRowModel().rows;
      const totalPembayaran = rows.reduce((sum, row) => sum + row.original.totalPembayaran, 0);
      const totalBerat = rows.reduce((sum, row) => sum + row.original.beratAkhir, 0);
      const avgPrice = totalBerat > 0 ? totalPembayaran / totalBerat : 0;
      return <div className="text-right">{formatCurrency(avgPrice)}</div>;
    },
  },
  {
    accessorKey: 'totalPembayaran',
    header: () => <div className="text-right">Total</div>,
    cell: ({ row }) => <div className="text-right font-bold">{formatCurrency(row.original.totalPembayaran)}</div>,
    footer: ({ table }) => {
      const total = table.getRowModel().rows.reduce((sum, row) => sum + row.original.totalPembayaran, 0);
      return <div className="text-right font-bold">{formatCurrency(total)}</div>;
    },
  },
  {
    accessorKey: 'pph',
    header: () => <div className="text-right">PPh 25</div>,
    cell: ({ row }) => <div className="text-right text-red-500">{formatCurrency(row.original.pph)}</div>,
    footer: ({ table }) => {
      const total = table.getRowModel().rows.reduce((sum, row) => sum + row.original.pph, 0);
      return <div className="text-right text-red-500">{formatCurrency(total)}</div>;
    },
  },
  {
    accessorKey: 'pembayaranSetelahPph',
    header: () => <div className="text-right">Total Bayar (Net)</div>,
    cell: ({ row }) => <div className="text-right font-bold text-green-700">{formatCurrency(row.original.pembayaranSetelahPph)}</div>,
    footer: ({ table }) => {
      const total = table.getRowModel().rows.reduce((sum, row) => sum + row.original.pembayaranSetelahPph, 0);
      return <div className="text-right font-bold text-green-700">{formatCurrency(total)}</div>;
    },
  },
  {
    accessorKey: 'pembayaranAktual',
    header: () => <div className="text-right">Pembayaran Aktual</div>,
    cell: ({ row }) => {
      const val = row.original.pembayaranAktual;
      return <div className="text-right font-bold text-blue-700">{val !== null && val !== undefined ? formatCurrency(val) : '-'}</div>;
    },
    footer: ({ table }) => {
      const total = table.getRowModel().rows.reduce((sum, row) => sum + (row.original.pembayaranAktual || 0), 0);
      return <div className="text-right font-bold text-blue-700">{formatCurrency(total)}</div>;
    },
  },
  {
    accessorKey: 'statusPembayaran',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.original.statusPembayaran;
      const statusClass = status === 'LUNAS' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800';
      return (
        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClass}`}>
          {status.replace('_', ' ')}
        </span>
      );
    },
  },
  {
    accessorKey: 'gambarNotaUrl',
    header: 'Gambar Nota',
    cell: ({ row, table }) => {
      const url = row.original.gambarNotaUrl;
      const { meta } = table.options;
      return url ? (
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => (meta as any)?.onViewImage(url)}
          className="h-8 w-8 text-blue-500 hover:text-blue-700"
          title="Lihat Gambar"
        >
          <EyeIcon className="h-4 w-4" />
        </Button>
      ) : '-';
    },
  },
  {
    id: 'actions',
    cell: ({ row, table }) => {
      const nota = row.original;
      const { meta } = table.options;

      return (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <EllipsisHorizontalIcon className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Aksi</DropdownMenuLabel>
              {(meta as any)?.role !== 'SUPIR' && (
                <DropdownMenuItem onClick={() => { if (meta?.onUbah) meta.onUbah(nota); }}>
                  Ubah
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => { if (meta?.onDetail) meta.onDetail(nota); }}>
                Detail
              </DropdownMenuItem>
              {(meta as any)?.role !== 'SUPIR' && (
                <DropdownMenuItem onClick={() => { if (meta?.onUbahStatus) meta.onUbahStatus(nota); }}>
                  Ubah Status
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {(meta as any)?.role !== 'SUPIR' ? (
                <DropdownMenuItem
                  className="text-red-600"
                  onClick={() => { if (meta?.onHapus) meta.onHapus(nota); }}
                >
                  Hapus
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
  },
]
