'use client'

import { ColumnDef } from '@tanstack/react-table'
import type { Kendaraan } from '@prisma/client'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import {
  EllipsisHorizontalIcon,
  PencilSquareIcon,
  TrashIcon,
  WrenchIcon,
  IdentificationIcon,
  RectangleStackIcon
} from "@heroicons/react/24/outline"

export type KendaraanData = Kendaraan;

export const columns = (
  onEdit: (kendaraan: KendaraanData) => void,
  onDelete: (kendaraan: KendaraanData) => void,
  onService: (kendaraan: KendaraanData) => void,
  onDetail: (kendaraan: KendaraanData) => void,
  onRenewDocument: (kendaraan: KendaraanData) => void
): ColumnDef<KendaraanData>[] => [
  {
    accessorKey: 'platNomor',
    header: 'Plat Nomor',
  },
  {
    accessorKey: 'merk',
    header: 'Merk',
  },
  {
    accessorKey: 'jenis',
    header: 'Jenis',
  },
  {
    accessorKey: 'tanggalMatiStnk',
    header: 'Tgl Mati STNK',
    cell: ({ row }) => {
      const date = new Date(row.original.tanggalMatiStnk);
      return date.toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const kendaraan = row.original;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <EllipsisHorizontalIcon className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Aksi</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onDetail(kendaraan)}>
              <IdentificationIcon className="mr-2 h-4 w-4" /> Detail & Riwayat
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onService(kendaraan)}>
              <WrenchIcon className="mr-2 h-4 w-4" /> Catat Servis
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onRenewDocument(kendaraan)}>
              <RectangleStackIcon className="mr-2 h-4 w-4" /> Perpanjang Dokumen
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onEdit(kendaraan)}>
              <PencilSquareIcon className="mr-2 h-4 w-4" /> Edit Data
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDelete(kendaraan)} className="text-red-600">
              <TrashIcon className="mr-2 h-4 w-4" /> Hapus Kendaraan
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
