'use client'

import type { ColumnDef } from '@tanstack/react-table'
import type { NotaSawit, Timbangan, Kebun, User, Kendaraan } from '@prisma/client'

const formatNumber = (num: number) => new Intl.NumberFormat('id-ID').format(num);
const formatCurrency = (num: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);

export type NotaSawitLaporanData = NotaSawit & {
  supir: User;
  timbangan: (Timbangan & { kebun: Kebun }) | null;
  kendaraan: Kendaraan | null;
  kebun?: Kebun | null;
  pembayaranAktual?: number | null;
};

export const columns: ColumnDef<NotaSawitLaporanData>[] = [
  {
    accessorKey: 'id',
    header: 'ID',
    cell: ({ row, table }) => {
      const meta = table.options.meta as any;
      const page = Number(meta?.page || 1);
      const limit = Number(meta?.limit || 10);
      return (page - 1) * limit + row.index + 1;
    },
  },
  {
    accessorKey: 'timbangan.date',
    header: 'Tanggal',
    cell: ({ row }) => {
      const dateValue = row.original.timbangan?.date || row.original.tanggalBongkar || row.original.createdAt;
      return dateValue ? new Date(dateValue).toLocaleDateString('id-ID') : '-';
    },
  },
  {
    accessorKey: 'kendaraan.platNomor',
    header: 'Plat Nomor',
  },
  {
    accessorKey: 'supir.name',
    header: 'Supir',
  },
  {
    accessorKey: 'timbangan.kebun.name',
    header: 'Kebun',
    footer: () => <div className="text-right font-bold">Total</div>,
    cell: ({ row }) => row.original.timbangan?.kebun?.name ?? row.original.kebun?.name ?? '-',
  },
  {
    accessorKey: 'timbangan.netKg',
    header: () => <div className="text-right">Netto (Kg)</div>,
    cell: ({ row }) => {
      const netto = row.original.timbangan?.netKg ?? row.original.netto;
      return <div className="text-right">{typeof netto === 'number' ? formatNumber(netto) : '-'}</div>;
    },
    footer: ({ table }) => {
      const kpi = (table.options.meta as any)?.kpi;
      return <div className="text-right font-bold">{formatNumber(kpi?.totalNetto || 0)}</div>;
    },
  },
  {
    accessorKey: 'potongan',
    header: () => <div className="text-right">Potongan</div>,
    cell: ({ row }) => <div className="text-right text-red-500">{formatNumber(row.original.potongan)}</div>,
    footer: ({ table }) => {
      const kpi = (table.options.meta as any)?.kpi;
      return <div className="text-right font-bold text-red-500">{formatNumber(kpi?.totalPotongan || 0)}</div>;
    },
  },
  {
    accessorKey: 'beratAkhir',
    header: () => <div className="text-right">Berat Akhir (Kg)</div>,
    cell: ({ row }) => <div className="text-right font-bold">{formatNumber(row.original.beratAkhir)}</div>,
    footer: ({ table }) => {
      const kpi = (table.options.meta as any)?.kpi;
      return <div className="text-right font-bold">{formatNumber(kpi?.totalTonase || 0)}</div>;
    },
  },
  {
    accessorKey: 'hargaPerKg',
    header: () => <div className="text-right">Harga/Kg</div>,
    cell: ({ row }) => <div className="text-right">{formatCurrency(row.original.hargaPerKg)}</div>,
    footer: ({ table }) => {
      const kpi = (table.options.meta as any)?.kpi;
      return <div className="text-right font-bold">{formatCurrency(kpi?.rataRataHargaPerKg || 0)}</div>;
    },
  },
  {
    accessorKey: 'totalPembayaran',
    header: () => <div className="text-right">Total</div>,
    cell: ({ row }) => <div className="text-right font-bold">{formatCurrency(row.original.totalPembayaran)}</div>,
    footer: ({ table }) => {
      const kpi = (table.options.meta as any)?.kpi;
      return <div className="text-right font-bold">{formatCurrency(kpi?.totalPembayaran || 0)}</div>;
    },
  },
  {
    accessorKey: 'pph',
    header: () => <div className="text-right">PPh 25</div>,
    cell: ({ row }) => <div className="text-right text-red-500">{formatCurrency(row.original.pph)}</div>,
    footer: ({ table }) => {
      const kpi = (table.options.meta as any)?.kpi;
      return <div className="text-right font-bold text-red-500">{formatCurrency(kpi?.totalPph || 0)}</div>;
    },
  },
  {
    accessorKey: 'pembayaranSetelahPph',
    header: () => <div className="text-right">Total Bayar Net</div>,
    cell: ({ row }) => <div className="text-right font-bold">{formatCurrency(row.original.pembayaranSetelahPph)}</div>,
    footer: ({ table }) => {
      const kpi = (table.options.meta as any)?.kpi;
      return <div className="text-right font-bold">{formatCurrency(kpi?.totalNet || 0)}</div>;
    },
  },
  {
    accessorKey: 'pembayaranAktual',
    header: () => <div className="text-right">Pembayaran Aktual</div>,
    cell: ({ row }) => <div className="text-right font-bold text-blue-600">{row.original.pembayaranAktual ? formatCurrency(row.original.pembayaranAktual) : '-'}</div>,
    footer: ({ table }) => {
      const kpi = (table.options.meta as any)?.kpi;
      return <div className="text-right font-bold text-blue-600">{formatCurrency(kpi?.totalAktual || 0)}</div>;
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
    cell: ({ row }) => {
      const url = row.original.gambarNotaUrl;
      return url ? <img src={url} alt="Nota" className="w-16 h-16 object-cover rounded" /> : '-';
    },
  },
]
