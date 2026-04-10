'use client'

import { ColumnDef } from '@tanstack/react-table'
import { Timbangan, Kebun, User, Kendaraan } from '@prisma/client'
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

export type TimbanganData = Timbangan & { 
  kebun: Kebun, 
  supir: User | null, 
  kendaraan: Kendaraan | null,
  photoUrl: string | null
};

export const columns = (
    page: number,
    limit: number,
    onDetail: (timbangan: TimbanganData) => void,
    onEdit: (timbangan: TimbanganData) => void, 
    onDelete: (id: number) => void,
    canMutate: boolean
): ColumnDef<TimbanganData>[] => [
  { 
    id: 'no',
    header: 'No',
    cell: ({ row }) => (page - 1) * limit + row.index + 1
  },
  { accessorKey: 'kebun.name', header: 'Kebun' },
  { accessorKey: 'supir.name', header: 'Supir' },
  { accessorKey: 'kendaraan.platNomor', header: 'Kendaraan' },
  {
    accessorKey: 'date',
    header: 'Tanggal',
    cell: ({ row }) => new Date(row.original.date).toLocaleDateString('id-ID'),
  },
  { accessorKey: 'grossKg', header: 'Gross (Kg)', cell: ({ row }) => row.original.grossKg.toLocaleString('id-ID') },
  { accessorKey: 'tareKg', header: 'Tare (Kg)', cell: ({ row }) => row.original.tareKg.toLocaleString('id-ID') },
  { accessorKey: 'netKg', header: 'Net (Kg)', cell: ({ row }) => row.original.netKg.toLocaleString('id-ID') },
  {
    id: 'actions',
    header: 'Aksi',
    cell: ({ row }) => {
      const timbangan = row.original
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Buka menu</span>
              <EllipsisHorizontalIcon className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-white">
            <DropdownMenuLabel>Aksi</DropdownMenuLabel>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDetail(timbangan); }}>
              Detail
            </DropdownMenuItem>
            {canMutate ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(timbangan); }}>Edit</DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(timbangan.id); }} className="text-red-500">Hapus</DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]
