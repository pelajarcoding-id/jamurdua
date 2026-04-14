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

import { format, differenceInDays } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'

export type KendaraanData = Kendaraan;

export const columns = (
  onEdit: (kendaraan: KendaraanData) => void,
  onDelete: (kendaraan: KendaraanData) => void,
  onService: (kendaraan: KendaraanData) => void,
  onDetail: (kendaraan: KendaraanData) => void,
  onRenewDocument: (kendaraan: KendaraanData) => void
): ColumnDef<KendaraanData>[] => [
  {
    id: 'no',
    header: () => <span className="font-semibold">No</span>,
    cell: ({ row }) => <span className="text-gray-600 tabular-nums">{row.index + 1}</span>,
  },
  {
    accessorKey: 'platNomor',
    header: () => <span className="font-semibold">Plat Nomor</span>,
    cell: ({ row }) => <span className="font-bold">{row.original.platNomor}</span>,
  },
  {
    id: 'merkJenis',
    header: () => <span className="font-semibold">Merk / Jenis</span>,
    cell: ({ row }) => (
      <div>
        <div className="text-sm">{row.original.merk}</div>
        <div className="text-xs text-gray-500">{row.original.jenis}</div>
      </div>
    ),
  },
  {
    accessorKey: 'tanggalMatiStnk',
    header: () => <span className="font-semibold text-amber-700">Mati STNK</span>,
    cell: ({ row }) => {
      const today = new Date();
      const date = new Date(row.original.tanggalMatiStnk);
      const days = differenceInDays(date, today);
      return (
        <div>
          <div className={`text-sm font-medium ${days < 0 ? 'text-red-600' : days <= 7 ? 'text-amber-600' : 'text-gray-700'}`}>
            {format(date, 'dd MMM yyyy', { locale: idLocale })}
          </div>
          <div className="text-xs text-gray-500">
            {days < 0 ? `Telat ${Math.abs(days)} hari` : `${days} hari lagi`}
          </div>
        </div>
      );
    },
  },
  {
    id: 'pajak',
    header: () => <span className="font-semibold text-blue-700">Mati Pajak</span>,
    cell: ({ row }) => {
      const date = row.original.tanggalPajakTahunan;
      if (!date) return <span className="text-xs text-gray-400 italic">Data belum diisi</span>;
      
      const today = new Date();
      const days = differenceInDays(new Date(date), today);
      return (
        <div>
          <div className={`text-sm font-medium ${days < 0 ? 'text-red-600' : days <= 7 ? 'text-amber-600' : 'text-gray-700'}`}>
            {format(new Date(date), 'dd MMM yyyy', { locale: idLocale })}
          </div>
          <div className="text-xs text-gray-500">
            {days < 0 ? `Telat ${Math.abs(days)} hari` : `${days} hari lagi`}
          </div>
        </div>
      );
    },
  },
  {
    id: 'izinTrayek',
    header: () => <span className="font-semibold text-indigo-700">Izin Trayek</span>,
    cell: ({ row }) => {
      const date = (row.original as any).tanggalIzinTrayek;
      if (!date) return <span className="text-xs text-gray-400 italic">Data belum diisi</span>;
      
      const today = new Date();
      const days = differenceInDays(new Date(date), today);
      return (
        <div>
          <div className={`text-sm font-medium ${days < 0 ? 'text-red-600' : days <= 7 ? 'text-amber-600' : 'text-gray-700'}`}>
            {format(new Date(date), 'dd MMM yyyy', { locale: idLocale })}
          </div>
          <div className="text-xs text-gray-500">
            {days < 0 ? `Telat ${Math.abs(days)} hari` : `${days} hari lagi`}
          </div>
        </div>
      );
    },
  },
  {
    id: 'speksi',
    header: () => <span className="font-semibold text-purple-700">Speksi</span>,
    cell: ({ row }) => {
      const date = row.original.speksi;
      if (!date) return <span className="text-xs text-gray-400 italic">Data belum diisi</span>;
      
      const today = new Date();
      const days = differenceInDays(new Date(date), today);
      return (
        <div>
          <div className={`text-sm font-medium ${days < 0 ? 'text-red-600' : days <= 7 ? 'text-amber-600' : 'text-gray-700'}`}>
            {format(new Date(date), 'dd MMM yyyy', { locale: idLocale })}
          </div>
          <div className="text-xs text-gray-500">
            {days < 0 ? `Telat ${Math.abs(days)} hari` : `${days} hari lagi`}
          </div>
        </div>
      );
    },
  },
  {
    id: 'status',
    header: () => <span className="font-semibold">Status</span>,
    cell: ({ row }) => {
      const today = new Date();
      const stnkDays = differenceInDays(new Date(row.original.tanggalMatiStnk), today);
      const pajakDate = row.original.tanggalPajakTahunan;
      const pajakDays = pajakDate ? differenceInDays(new Date(pajakDate), today) : 999;
      const izinDate = (row.original as any).tanggalIzinTrayek;
      const izinDays = izinDate ? differenceInDays(new Date(izinDate), today) : 999;
      const speksiDate = row.original.speksi;
      const speksiDays = speksiDate ? differenceInDays(new Date(speksiDate), today) : 999;
      
      const isLate = stnkDays < 0 || pajakDays < 0 || izinDays < 0 || speksiDays < 0;
      const isUrgent = !isLate && (stnkDays <= 7 || pajakDays <= 7 || izinDays <= 7 || speksiDays <= 7);
      const isWarning = !isLate && !isUrgent && (stnkDays <= 30 || pajakDays <= 30 || izinDays <= 30 || speksiDays <= 30);

      if (isLate) return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Sudah Mati</span>;
      if (isUrgent) return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">Segera Habis</span>;
      if (isWarning) return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Perhatian</span>;
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">Aktif</span>;
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const kendaraan = row.original;
      return (
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0" onClick={(e) => e.stopPropagation()}>
                <span className="sr-only">Open menu</span>
                <EllipsisHorizontalIcon className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Aksi</DropdownMenuLabel>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDetail(kendaraan); }}>
                <IdentificationIcon className="mr-2 h-4 w-4" /> Detail & Riwayat
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onService(kendaraan); }}>
                <WrenchIcon className="mr-2 h-4 w-4" /> Catat Servis
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRenewDocument(kendaraan); }}>
                <RectangleStackIcon className="mr-2 h-4 w-4" /> Perpanjang Dokumen
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(kendaraan); }}>
                <PencilSquareIcon className="mr-2 h-4 w-4" /> Edit Data
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(kendaraan); }} className="text-red-600">
                <TrashIcon className="mr-2 h-4 w-4" /> Hapus Kendaraan
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
  },
];
