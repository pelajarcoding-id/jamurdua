
'use client'

import { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  PencilSquareIcon, 
  TrashIcon, 
  BuildingOfficeIcon
} from '@heroicons/react/24/outline'
import Link from 'next/link'

export type PerusahaanData = {
  id: number
  name: string
  address: string | null
  logoUrl: string | null
  email: string | null
  phone: string | null
  createdAt: string
  updatedAt: string
}

export const columns = (
  onEdit: (perusahaan: PerusahaanData) => void,
  onDelete: (id: number) => void
): ColumnDef<PerusahaanData>[] => [
  {
    accessorKey: 'logoUrl',
    header: 'Logo',
    cell: ({ row }) => {
      const logoUrl = row.getValue('logoUrl') as string
      return (
        <div className="h-10 w-10 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden">
          {logoUrl ? (
            <img 
              src={`${logoUrl}?t=${Date.now()}`} 
              alt="Logo" 
              className="h-8 w-8 object-contain" 
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = 'https://placehold.co/100x100?text=ERR';
              }}
            />
          ) : (
            <BuildingOfficeIcon className="h-5 w-5 text-gray-300" />
          )}
        </div>
      )
    }
  },
  {
    accessorKey: 'name',
    header: 'Nama Perusahaan',
    cell: ({ row }) => (
      <div className="font-medium text-gray-900">{row.getValue('name')}</div>
    )
  },
  {
    accessorKey: 'email',
    header: 'Email',
    cell: ({ row }) => row.getValue('email') || '-'
  },
  {
    accessorKey: 'phone',
    header: 'Telepon',
    cell: ({ row }) => row.getValue('phone') || '-'
  },
  {
    accessorKey: 'address',
    header: 'Alamat',
    cell: ({ row }) => (
      <div className="max-w-[200px] truncate" title={row.getValue('address') || ''}>
        {row.getValue('address') || '-'}
      </div>
    )
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const perusahaan = row.original

      return (
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" asChild className="text-emerald-600 hover:text-emerald-800">
            <Link href={`/perusahaan/${perusahaan.id}`}>Detail</Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(perusahaan)}
            className="text-emerald-600 hover:text-emerald-800"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(perusahaan.id)}
            className="text-red-600 hover:text-red-800"
          >
            <TrashIcon className="h-4 w-4" />
          </Button>
        </div>
      )
    }
  }
]
