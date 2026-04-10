'use client'

import { ColumnDef } from "@tanstack/react-table"
import type { User } from "@prisma/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { EllipsisHorizontalIcon } from "@heroicons/react/24/outline"

export type UserData = User & {
    kebunIds?: number[];
    kebuns?: Array<{ id: number, name: string }>;
};

export const formatUserName = (name?: string | null) => {
  if (!name) return '';
  return name
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const columns = (
  onEdit: (user: UserData) => void,
  onDelete: (user: UserData) => void,
  onDetail: (user: UserData) => void
): ColumnDef<UserData>[] => [
    {
        accessorKey: "photoUrl",
        header: "Foto",
        cell: ({ row }) => {
            const photoUrl = row.original.photoUrl;
            return photoUrl ? <img src={photoUrl} alt="Foto Profil" className="h-10 w-10 rounded-full" /> : null;
        },
    },
    {
        accessorKey: "name",
        header: "Nama",
        cell: ({ row }) => formatUserName(row.original.name),
    },
    {
        accessorKey: "email",
        header: "Email",
    },
    {
        accessorKey: "role",
        header: "Role",
        cell: ({ row }) => {
            const role = row.original.role
            let className = "bg-gray-500"
            switch (role) {
                case "ADMIN":
                    className = "bg-red-500"
                    break;
                case "PEMILIK":
                    className = "bg-blue-500"
                    break;
                case "KASIR":
                    className = "bg-green-500"
                    break;
                case "MANDOR":
                    className = "bg-amber-500"
                    break;
                case "MANAGER":
                    className = "bg-indigo-500"
                    break;
                case "KARYAWAN":
                    className = "bg-emerald-500"
                    break;
            }
            return <Badge className={className}>{role}</Badge>
        }
    },
    {
        accessorKey: "jobType",
        header: "Jenis Pekerjaan",
        cell: ({ row }) => {
            const val = row.original.jobType;
            if (!val) return "-";
            if (val.includes('KEBUN')) return 'Karyawan Kebun';
            if (val.includes('HARIAN')) return 'Pekerja Harian';
            if (val.includes('TUKANG') || val.includes('BANGUNAN')) return 'Tukang Bangunan';
            if (val.includes('OPERATOR')) return 'Operator';
            return val;
        }
    },
    {
        id: "actions",
        cell: ({ row }) => {
            const user = row.original;
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
                    <DropdownMenuItem onClick={() => onDetail(user)}>
                      Detail
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onEdit(user)}>
                      Ubah
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onEdit(user)}>
                      Reset Password
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onDelete(user)} className="text-red-500">
                      Hapus
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
            );
        },
    },
]
