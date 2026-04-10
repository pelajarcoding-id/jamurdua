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
        accessorKey: "supir.name",
        header: "Supir",
    },
    {
        accessorKey: "kendaraan.platNomor",
        header: "Kendaraan",
        cell: ({ row }) => row.original.kendaraan?.platNomor || '-',
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
