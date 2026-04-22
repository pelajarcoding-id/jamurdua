'use client'

import type { ColumnDef } from '@tanstack/react-table'
import type { NotaSawit, Timbangan, Kebun, User, Kendaraan, Perusahaan, PabrikSawit } from '@prisma/client'
import { EyeIcon } from '@heroicons/react/24/outline'

const formatNumber = (num: number) => new Intl.NumberFormat('id-ID').format(num);
const formatCurrency = (num: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);

export type NotaSawitLaporanData = NotaSawit & {
  supir: User;
  timbangan: (Timbangan & { kebun: Kebun }) | null;
  kendaraan: Kendaraan | null;
  kebun?: Kebun | null;
  perusahaan?: Perusahaan | null;
  pabrikSawit?: PabrikSawit | null;
  pembayaranBatchItems?: Array<{ batch?: { tanggal?: Date | null } | null }> | null;
  kasTransaksi?: Array<{ date?: Date | null } | null> | null;
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
      const netTimb = Number((row.original as any)?.timbangan?.netKg ?? 0) || 0
      const netNota = Number((row.original as any)?.netto ?? 0) || 0
      const netto = netTimb > 0 ? netTimb : netNota > 0 ? netNota : (netTimb || netNota || 0)
      return <div className="text-right">{formatNumber(netto)}</div>;
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
    accessorKey: 'tanggalDibayar',
    header: 'Tanggal Dibayar',
    cell: ({ row }) => {
      const dt =
        (row.original as any)?.pembayaranBatchItems?.[0]?.batch?.tanggal ||
        (row.original as any)?.kasTransaksi?.[0]?.date ||
        null
      return dt ? new Date(dt).toLocaleDateString('id-ID') : '-'
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
      if (!url) return '-'
      const onOpenImage = (table.options.meta as any)?.onOpenImage as undefined | ((url: string) => void)
      return (
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            if (onOpenImage) {
              onOpenImage(url)
              return
            }
            window.open(url, '_blank', 'noopener,noreferrer')
          }}
          aria-label="Lihat gambar nota"
          title="Lihat gambar nota"
        >
          <EyeIcon className="h-4 w-4" />
        </button>
      )
    },
  },
  {
    accessorKey: 'perusahaan.name',
    header: 'Perusahaan',
    cell: ({ row }) => (row.original as any)?.perusahaan?.name ?? '-',
  },
]
