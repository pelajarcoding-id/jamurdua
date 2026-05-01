'use client'

import { ColumnDef, RowData, TableMeta } from "@tanstack/react-table"
import { EllipsisHorizontalIcon } from "@heroicons/react/24/outline"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { SesiUangJalanWithDetails } from "./page"



const formatCurrency = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
const formatDate = (date: Date) => new Intl.DateTimeFormat('id-ID', { 
    day: '2-digit', 
    month: 'long', 
    year: 'numeric',
    timeZone: 'Asia/Jakarta'
}).format(new Date(date));

export const columns: ColumnDef<SesiUangJalanWithDetails>[] = [
    {
        id: "no",
        header: "No",
        cell: ({ row, table }) => {
            const meta = table.options.meta as any
            const page = Number(meta?.page || 1)
            const limit = Number(meta?.limit || 0)
            const base = Number.isFinite(page) && page > 0 && Number.isFinite(limit) && limit > 0 ? (page - 1) * limit : 0
            return <div className="text-gray-600 tabular-nums">{base + row.index + 1}</div>
        },
    },
    {
        accessorKey: "supir.name",
        header: "Supir",
    },
    {
        id: "kendaraan",
        header: "Kendaraan",
        cell: ({ row }) => {
          const platNomor = row.original.kendaraan?.platNomor || row.original.kendaraanPlatNomor;
          const merk = row.original.kendaraan?.merk;
          if (platNomor && merk) {
            return `${platNomor} - ${merk}`;
          }
          return platNomor || '-';
        },
    },
    {
        accessorKey: "tanggalMulai",
        header: "Tanggal Mulai",
        cell: ({ row }) => formatDate(row.original.tanggalMulai),
    },
    {
        accessorKey: "totalDiberikan",
        header: "Total Diberikan",
        cell: ({ row }) => <div className="text-right">{formatCurrency(row.original.totalDiberikan)}</div>,
    },
    {
        accessorKey: "totalPengeluaran",
        header: "Total Pengeluaran",
        cell: ({ row }) => <div className="text-right">{formatCurrency(row.original.totalPengeluaran)}</div>,
    },
    {
        accessorKey: "saldo",
        header: "Saldo",
        cell: ({ row }) => <div className="text-right font-bold">{formatCurrency(row.original.saldo)}</div>,
    },
    {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
            const status = row.original.status;
            return <Badge className={status === 'SELESAI' ? 'bg-green-500' : 'bg-yellow-500'}>{status}</Badge>
        }
    },
    {
        id: "actions",
        cell: ({ row, table }) => {
            const sesi = row.original
            const { meta } = table.options

            return (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0" onClick={(e) => e.stopPropagation()}>
                            <span className="sr-only">Open menu</span>
                            <EllipsisHorizontalIcon className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Aksi</DropdownMenuLabel>
                        <DropdownMenuItem
                            onClick={(e) => { e.stopPropagation(); (table.options.meta as any)?.onViewDetails?.(sesi); }}
                        >
                            Lihat Detail
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={(e) => { e.stopPropagation(); (table.options.meta as any)?.onAddRincian?.(sesi); }}
                        >
                            Tambah Rincian
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={(e) => { e.stopPropagation(); (table.options.meta as any)?.onEdit?.(sesi); }}
                        >
                            Ubah Keterangan
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={(e) => { e.stopPropagation(); (table.options.meta as any)?.onUpdateStatus?.(sesi); }}
                        >
                            Selesaikan Sesi
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                            <Button
                                variant="ghost"
                                className="w-full justify-start text-red-600 hover:text-red-700"
                                onClick={(e) => { e.stopPropagation(); (table.options.meta as any)?.onDelete?.(sesi); }}
                            >
                                Hapus Sesi
                            </Button>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            )
        },
    },
]
