'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Checkbox } from '@/components/ui/checkbox';
import type { NotaSawit, User, Kendaraan, Timbangan, Kebun } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { TrashIcon } from '@heroicons/react/24/outline';

type NotaSawitWithRelations = NotaSawit & {
  supir: User;
  kendaraan: Kendaraan | null;
  timbangan?: (Timbangan & { kebun: Kebun }) | null;
  kebun?: Kebun | null;
};

const formatNumber = (num: number) => new Intl.NumberFormat('id-ID').format(num);
const formatDate = (date: string | Date) => new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

const getNotaNetto = (row: any) => {
  const n = row?.netto
  if (typeof n === 'number' && n > 0) return n
  const tNet = row?.timbangan?.netKg
  if (typeof tNet === 'number' && tNet > 0) return tNet
  return null
}

export const createColumns = (): ColumnDef<NotaSawitWithRelations>[] => [
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        onCheckedChange={(value: boolean) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value: boolean) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'tanggalBongkar',
    header: 'Tanggal Bongkar',
    cell: ({ row }) => (row.original.tanggalBongkar ? formatDate(row.original.tanggalBongkar) : '-'),
  },
  {
    id: 'kebun',
    header: 'Kebun',
    cell: ({ row }) => row.original.timbangan?.kebun?.name || row.original.kebun?.name || '-',
  },
  {
    header: 'Supir',
    cell: ({ row }) => row.original.supir?.name || '-',
  },
  {
    accessorKey: 'kendaraan.platNomor',
    header: 'Plat Nomor',
    cell: ({ row }) => row.original.kendaraan?.platNomor || '-',
    footer: () => <div className="text-right font-bold">JUMLAH</div>,
  },
  {
    id: 'netto',
    accessorFn: (row) => getNotaNetto(row),
    header: () => <div className="text-right">Netto (Kg)</div>,
    cell: ({ row }) => {
      const net = getNotaNetto(row.original);
      return <div className="text-right">{typeof net === 'number' ? formatNumber(net) : '-'}</div>;
    },
    footer: ({ table }) => {
      const sum = table.getFilteredRowModel().rows.reduce((acc, r) => {
        const net = getNotaNetto(r.original)
        return acc + (typeof net === 'number' ? net : 0)
      }, 0);
      return <div className="text-right font-bold">{formatNumber(sum)}</div>;
    },
  },
  {
    accessorKey: 'potongan',
    header: () => <div className="text-right">Potongan</div>,
    cell: ({ row }) => <div className="text-right text-red-500">{formatNumber(row.original.potongan)}</div>,
    footer: ({ table }) => {
      const sum = table.getFilteredRowModel().rows.reduce((acc, r) => acc + (Number(r.original.potongan) || 0), 0);
      return <div className="text-right font-bold text-red-500">{formatNumber(sum)}</div>;
    },
  },
  {
    accessorKey: 'beratAkhir',
    header: () => <div className="text-right">Berat Akhir (Kg)</div>,
    cell: ({ row }) => <div className="text-right font-bold">{formatNumber(row.original.beratAkhir)}</div>,
    footer: ({ table }) => {
      const sum = table.getFilteredRowModel().rows.reduce((acc, r) => acc + (Number(r.original.beratAkhir) || 0), 0);
      return <div className="text-right font-bold">{formatNumber(sum)}</div>;
    },
  },
];

import { Input } from '@/components/ui/input';

export type ProcessingNotaSawit = NotaSawitWithRelations & {
  harianKerja?: number;
  keterangan?: string | null;
};

export const createProcessingColumns = (
  onRemove: (id: number) => void,
  onKeteranganChange: (id: number, val: string) => void
): ColumnDef<ProcessingNotaSawit>[] => [
  {
    accessorKey: 'tanggalBongkar',
    header: 'Tanggal Bongkar',
    cell: ({ row }) => (row.original.tanggalBongkar ? formatDate(row.original.tanggalBongkar) : '-'),
  },
  {
    accessorKey: 'supir.name',
    header: 'Supir',
  },
  {
    accessorKey: 'kendaraan.platNomor',
    header: 'Plat Nomor',
    cell: ({ row }) => row.original.kendaraan?.platNomor || '-',
  },
  {
    id: 'kebun',
    header: 'Kebun',
    cell: ({ row }) => row.original.timbangan?.kebun?.name || row.original.kebun?.name || '-',
  },
  {
    accessorKey: 'beratAkhir',
    header: () => <div className="text-right">Berat Akhir (Kg)</div>,
    cell: ({ row }) => <div className="text-right font-bold">{formatNumber(row.original.beratAkhir)}</div>,
  },
  {
    accessorKey: 'keterangan',
    header: 'Keterangan',
    cell: ({ row }) => (
      <Input
        key={row.original.id}
        defaultValue={row.original.keterangan || ''}
        onBlur={(e) => onKeteranganChange(row.original.id, e.target.value)}
        placeholder="Keterangan..."
        className="h-8 min-w-[150px]"
      />
    ),
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const nota = row.original;
      return (
        <Button
          variant="ghost"
          className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
          onClick={() => onRemove(nota.id)}
        >
          <span className="sr-only">Hapus Nota</span>
          <TrashIcon className="h-4 w-4" />
        </Button>
      );
    },
  },
];
