'use client'

import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  BanknotesIcon,
  BuildingOffice2Icon,
  BuildingOfficeIcon,
  ClipboardDocumentListIcon,
  DocumentTextIcon,
  ScaleIcon,
  TagIcon,
} from '@heroicons/react/24/outline'

export function PerusahaanDetailTabs() {
  return (
    <div className="w-full overflow-x-auto">
      <TabsList className="w-max min-w-full justify-start h-12 rounded-2xl bg-gray-50 border border-gray-100 p-1 gap-1">
        <TabsTrigger value="profil" className="rounded-xl px-4 h-10 data-[state=active]:bg-white data-[state=active]:shadow-sm">
          <BuildingOfficeIcon className="h-4 w-4 mr-2" />
          Profil
        </TabsTrigger>
        <TabsTrigger value="dokumen" className="rounded-xl px-4 h-10 data-[state=active]:bg-white data-[state=active]:shadow-sm">
          <DocumentTextIcon className="h-4 w-4 mr-2" />
          Dokumen
        </TabsTrigger>
        <TabsTrigger value="nota" className="rounded-xl px-4 h-10 data-[state=active]:bg-white data-[state=active]:shadow-sm">
          <ClipboardDocumentListIcon className="h-4 w-4 mr-2" />
          Nota Sawit
        </TabsTrigger>
        <TabsTrigger value="invoice" className="rounded-xl px-4 h-10 data-[state=active]:bg-white data-[state=active]:shadow-sm">
          <BanknotesIcon className="h-4 w-4 mr-2" />
          Invoice TBS
        </TabsTrigger>
        <TabsTrigger value="pabrik" className="rounded-xl px-4 h-10 data-[state=active]:bg-white data-[state=active]:shadow-sm">
          <BuildingOffice2Icon className="h-4 w-4 mr-2" />
          Pabrik
        </TabsTrigger>
        <TabsTrigger value="keuangan" className="rounded-xl px-4 h-10 data-[state=active]:bg-white data-[state=active]:shadow-sm">
          <ScaleIcon className="h-4 w-4 mr-2" />
          Keuangan
        </TabsTrigger>
        <TabsTrigger value="harta" className="rounded-xl px-4 h-10 data-[state=active]:bg-white data-[state=active]:shadow-sm">
          <TagIcon className="h-4 w-4 mr-2" />
          Daftar Harta
        </TabsTrigger>
        <TabsTrigger value="ppn" className="rounded-xl px-4 h-10 data-[state=active]:bg-white data-[state=active]:shadow-sm">
          <DocumentTextIcon className="h-4 w-4 mr-2" />
          PPN
        </TabsTrigger>
      </TabsList>
    </div>
  )
}

