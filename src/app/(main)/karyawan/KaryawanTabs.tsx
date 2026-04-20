'use client'

import { TabsList, TabsTrigger } from '@/components/ui/tabs'

export function KaryawanTabs() {
  return (
    <TabsList className="w-full bg-gray-100 rounded-full p-1 gap-1 grid grid-cols-3 h-auto md:inline-flex md:w-auto md:h-9">
      <TabsTrigger value="karyawan" className="rounded-full px-2 md:px-4">
        Data Karyawan
      </TabsTrigger>
      <TabsTrigger value="ringkasan" className="rounded-full px-2 md:px-4">
        Ringkasan
      </TabsTrigger>
      <TabsTrigger value="hutang" className="rounded-full px-2 md:px-4">
        Hutang
      </TabsTrigger>
    </TabsList>
  )
}

