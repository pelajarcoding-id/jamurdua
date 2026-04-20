'use client'

import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BanknotesIcon, ClipboardDocumentListIcon } from '@heroicons/react/24/outline'

export function NotaSawitTabs(props: {
  value: 'nota' | 'pembayaran'
}) {
  return (
    <TabsList className="w-full sm:w-auto flex items-center gap-1 h-12 rounded-2xl bg-gray-50 border border-gray-100 p-1">
      <TabsTrigger
        value="nota"
        className="flex-1 rounded-xl px-4 h-10 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
      >
        <ClipboardDocumentListIcon className="h-4 w-4 mr-2" />
        Daftar Nota Sawit
      </TabsTrigger>
      <TabsTrigger
        value="pembayaran"
        className="flex-1 rounded-xl px-4 h-10 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
      >
        <BanknotesIcon className="h-4 w-4 mr-2" />
        Pembayaran Nota Sawit
      </TabsTrigger>
    </TabsList>
  )
}
