'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { formatKebunText } from '../columns'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import ActivityTab from '../ActivityTab'
import PermintaanTab from '../PermintaanTab'
import AbsensiTab from '../AbsensiTab'
import PanenTab from '../PanenTab'
import InventoryTab from '../InventoryTab'
import DefaultBiayaTab from '../DefaultBiayaTab'
import GajianTab from '../GajianTab'
import RoleGate from '@/components/RoleGate'
import { ArrowLeftIcon, BanknotesIcon, CalendarIcon, ClipboardDocumentListIcon, CubeIcon, MapPinIcon, ShoppingCartIcon, TrashIcon, PencilSquareIcon, Cog6ToothIcon } from '@heroicons/react/24/outline'

type Kebun = {
  id: number
  name: string
  location: string | null
  createdAt: string
}

export default function KebunDetailPage() {
  const params = useParams()
  const kebunId = Number(params.id)
  
  const [kebun, setKebun] = useState<Kebun | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchKebun()
  }, [])

  const fetchKebun = async () => {
    try {
      const res = await fetch(`/api/kebun/${kebunId}`)
      if (res.ok) {
        const data = await res.json()
        setKebun(data)
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 py-4">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-56" />
            </div>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex gap-2 overflow-x-auto">
          {[1,2,3,4,5].map(i => (
            <Skeleton key={i} className="h-10 w-32 rounded-2xl" />
          ))}
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[1,2,3].map(i => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-6 w-40" />
          <div className="space-y-3">
            {[1,2,3,4].map(i => (
              <Skeleton key={i} className="h-12 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
  if (!kebun) return <div className="p-8 text-center text-gray-500">Kebun tidak ditemukan</div>

  return (
    <div className="min-h-screen bg-gray-50/50 pb-12">
      {/* Header Section */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10 backdrop-blur-xl bg-white/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-4 py-4">
                <Link href="/kebun">
                <Button variant="ghost" size="icon" className="rounded-full hover:bg-gray-100 -ml-2">
                    <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
                </Button>
                </Link>
                <div>
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-gray-900">{formatKebunText(kebun.name)}</h1>
                <div className="flex items-center gap-1.5 text-sm text-gray-500 mt-0.5">
                    <MapPinIcon className="w-3.5 h-3.5" />
                    {kebun.location ? formatKebunText(kebun.location) : 'Lokasi belum diatur'}
                </div>
                </div>
            </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="aktivitas" className="w-full space-y-8">
            <div className="w-full overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide">
              <TabsList className="w-max min-w-full justify-start h-12 rounded-2xl bg-gray-50 border border-gray-100 p-1 gap-1">
                <TabsTrigger value="aktivitas" className="rounded-xl px-4 h-10 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm">
                  <ClipboardDocumentListIcon className="h-4 w-4 mr-2" />
                  Aktivitas
                </TabsTrigger>
                <TabsTrigger value="borongan" className="rounded-xl px-4 h-10 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm">
                  <BanknotesIcon className="h-4 w-4 mr-2" />
                  Borongan
                </TabsTrigger>
                <TabsTrigger value="permintaan" className="rounded-xl px-4 h-10 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm">
                  <ShoppingCartIcon className="h-4 w-4 mr-2" />
                  Permintaan
                </TabsTrigger>
                <TabsTrigger value="inventory" className="rounded-xl px-4 h-10 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm">
                  <CubeIcon className="h-4 w-4 mr-2" />
                  Inventory
                </TabsTrigger>
                <TabsTrigger value="absensi" className="rounded-xl px-4 h-10 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm">
                  <BanknotesIcon className="h-4 w-4 mr-2" />
                  Absensi & Gaji
                </TabsTrigger>
                <TabsTrigger value="panen" className="rounded-xl px-4 h-10 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm">
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  Panen
                </TabsTrigger>
                <TabsTrigger value="gajian" className="rounded-xl px-4 h-10 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm">
                  <BanknotesIcon className="h-4 w-4 mr-2" />
                  Pengajuan Gajian
                </TabsTrigger>
                <RoleGate allow={['ADMIN', 'PEMILIK']}>
                  <TabsTrigger value="default-biaya" className="rounded-xl px-4 h-10 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm">
                    <Cog6ToothIcon className="h-4 w-4 mr-2" />
                    Biaya Default
                  </TabsTrigger>
                </RoleGate>
              </TabsList>
            </div>
            
            <TabsContent value="aktivitas" className="mt-0 focus-visible:outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
                <ActivityTab kebunId={kebunId} mode="aktivitas" />
            </TabsContent>

            <TabsContent value="borongan" className="mt-0 focus-visible:outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
                <ActivityTab kebunId={kebunId} mode="borongan" />
            </TabsContent>

            <TabsContent value="permintaan" className="mt-0 focus-visible:outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
                <PermintaanTab kebunId={kebunId} />
            </TabsContent>

            <TabsContent value="inventory" className="mt-0 focus-visible:outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
                <InventoryTab kebunId={kebunId} />
            </TabsContent>

            <TabsContent value="absensi" className="mt-0 focus-visible:outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
                <AbsensiTab kebunId={kebunId} />
            </TabsContent>
            
            <TabsContent value="panen" className="mt-0 focus-visible:outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
                <PanenTab kebunId={kebunId} />
            </TabsContent>
            
            <TabsContent value="gajian" className="mt-0 focus-visible:outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
                <GajianTab kebunId={kebunId} />
            </TabsContent>

            <RoleGate allow={['ADMIN', 'PEMILIK']}>
              <TabsContent value="default-biaya" className="mt-0 focus-visible:outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <DefaultBiayaTab kebunId={kebunId} />
              </TabsContent>
            </RoleGate>
        </Tabs>
      </div>
    </div>
  )
}
