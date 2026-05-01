'use client'

import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BanknotesIcon, ChartBarIcon, UsersIcon } from '@heroicons/react/24/outline'

export function KaryawanTabs() {
  return (
    <TabsList className="w-full bg-gray-100 rounded-full p-1 gap-1 grid grid-cols-3 h-auto md:inline-flex md:w-auto md:h-10">
      <TabsTrigger
        value="karyawan"
        className="group rounded-full px-2 md:px-4 py-2 flex gap-2 items-center justify-center text-gray-700 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-md [&>svg]:w-4 [&>svg]:h-4 [&>svg]:text-emerald-600 data-[state=active]:[&>svg]:text-white"
      >
        <UsersIcon />
        <span className="truncate">Data Karyawan</span>
      </TabsTrigger>
      <TabsTrigger
        value="ringkasan"
        className="group rounded-full px-2 md:px-4 py-2 flex gap-2 items-center justify-center text-gray-700 data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md [&>svg]:w-4 [&>svg]:h-4 [&>svg]:text-indigo-600 data-[state=active]:[&>svg]:text-white"
      >
        <ChartBarIcon />
        <span className="truncate">Ringkasan</span>
      </TabsTrigger>
      <TabsTrigger
        value="hutang"
        className="group rounded-full px-2 md:px-4 py-2 flex gap-2 items-center justify-center text-gray-700 data-[state=active]:bg-amber-600 data-[state=active]:text-white data-[state=active]:shadow-md [&>svg]:w-4 [&>svg]:h-4 [&>svg]:text-amber-600 data-[state=active]:[&>svg]:text-white"
      >
        <BanknotesIcon />
        <span className="truncate">Hutang</span>
      </TabsTrigger>
    </TabsList>
  )
}
