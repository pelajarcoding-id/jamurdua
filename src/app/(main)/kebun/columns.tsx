'use client'

import { ColumnDef } from '@tanstack/react-table'
import type { Kebun } from '@prisma/client'
import Link from 'next/link'

export type KebunData = Kebun & {
  perusahaan?: {
    name: string
  } | null
}

export const formatKebunText = (value?: string | null) => {
  if (!value) return '';
  return value
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const columns = (
  onEdit: (kebun: KebunData) => void,
  onDelete: (id: number) => void
): ColumnDef<KebunData>[] => [
  {
    accessorKey: 'id',
    header: 'ID',
  },
  {
    accessorKey: 'name',
    header: 'Nama Kebun',
    cell: ({ row }) => formatKebunText(row.original.name),
  },
  {
    accessorKey: 'location',
    header: 'Lokasi',
    cell: ({ row }) => formatKebunText(row.original.location) || '-',
  },
  {
    accessorKey: 'createdAt',
    header: 'Tanggal Dibuat',
    cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString('id-ID'),
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const kebun = row.original
      return (
        <div className="flex space-x-2">
          <Link
            href={`/kebun/${kebun.id}`}
            className="text-green-600 hover:text-green-800 font-medium"
          >
            Kelola
          </Link>
          <button
            onClick={() => onEdit(kebun)}
            className="text-blue-500 hover:text-blue-700"
          >
            Ubah
          </button>
          <button
            onClick={() => onDelete(kebun.id)}
            className="text-red-500 hover:text-red-700"
          >
            Hapus
          </button>
        </div>
      )
    },
  },
]
