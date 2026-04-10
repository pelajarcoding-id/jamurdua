'use client'

import type { ElementType } from 'react';
import {
  ArchiveBoxIcon,
  BanknotesIcon,
  ClipboardDocumentListIcon,
  CurrencyDollarIcon,
  DocumentDuplicateIcon,
  TruckIcon,
  UsersIcon,
  UserIcon,
  HomeIcon,
  ClockIcon,
  CubeIcon,
  PhotoIcon,
  BuildingOfficeIcon,
  ArchiveBoxXMarkIcon
} from '@heroicons/react/24/outline';

export interface SubLink {
    name: string;
    href: string;
}

export interface NavLink {
    name: string;
    href: string;
  icon: ElementType;
    subLinks?: SubLink[];
}

export const links: NavLink[] = [
    {
        name: 'Dashboard',
        href: '/',
        icon: HomeIcon,
    },
    {
        name: 'Kebun',
        href: '/kebun',
        icon: ArchiveBoxIcon,
    },
    {
        name: 'Perusahaan',
        href: '/perusahaan',
        icon: BuildingOfficeIcon,
        subLinks: [
            {
                name: 'Invoice TBS Bulanan',
                href: '/invoice-tbs',
            },
        ],
    },
    {
        name: 'Karyawan',
        href: '/karyawan',
        icon: UsersIcon,
    },
    {
        name: 'Timbangan',
        href: '/timbangan',
        icon: DocumentDuplicateIcon,
    },
    {
            name: 'Nota Sawit',
            href: '/nota-sawit',
            icon: ClipboardDocumentListIcon,
            subLinks: [
                {
                    name: 'Laporan Nota Sawit',
                    href: '/laporan-nota-sawit',
                },
            ],
        },
        {
            name: 'Gajian',
            href: '/gajian',
            icon: CurrencyDollarIcon,
        },
    {
        name: 'Kasir',
        href: '/kasir',
        icon: BanknotesIcon,
    },
    {
        name: 'Hutang Bank',
        href: '/hutang-bank',
        icon: BuildingOfficeIcon,
    },
    {
        name: 'Uang Jalan',
        href: '/uang-jalan',
        icon: TruckIcon,
        subLinks: [
            {
                name: 'Laporan Uang Jalan',
                href: '/laporan-uang-jalan',
            },
        ],
    },
    {
        name: 'Supir',
        href: '/supir',
        icon: UserIcon,
    },
    {
        name: 'Kendaraan',
        href: '/kendaraan',
        icon: TruckIcon,
    },
    {
        name: 'Pabrik Sawit',
        href: '/pabrik-sawit',
        icon: ArchiveBoxIcon,
    },
    {
        name: 'Inventory',
        href: '/inventory',
        icon: CubeIcon,
    },
    {
        name: 'Gambar',
        href: '/gambar',
        icon: PhotoIcon,
    },
    {
        name: 'Laporan Biaya',
        href: '/reports/cost-center',
        icon: BanknotesIcon,
    },
    {
        name: 'Audit Trail',
        href: '/audit-trail',
        icon: ClockIcon,
    },
    {
        name: 'Recycle Bin',
        href: '/recycle-bin',
        icon: ArchiveBoxXMarkIcon,
    },
    {
        name: 'Akun Pengguna',
        href: '/users',
        icon: UsersIcon,
    },
];
