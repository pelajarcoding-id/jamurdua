'use client'

import Link from 'next/link'
import { ArrowLeftIcon, ArrowPathIcon, BuildingOfficeIcon, EnvelopeIcon, MapPinIcon, PhoneIcon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

type Perusahaan = {
  id: number
  name: string
  address: string | null
  email: string | null
  phone: string | null
  logoUrl: string | null
}

export function PerusahaanDetailHeader(props: {
  loading: boolean
  perusahaan: Perusahaan | null
  backHref: string
  onRefresh: () => void
  refreshSpinning: boolean
}) {
  return (
    <>
      <div className="flex items-center justify-between">
        <Button variant="outline" asChild className="rounded-xl">
          <Link href={props.backHref}>
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Kembali
          </Link>
        </Button>
        <Button variant="ghost" onClick={props.onRefresh} className="rounded-xl">
          <ArrowPathIcon className={`h-4 w-4 mr-2 ${props.refreshSpinning ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm bg-white">
        <div className="px-6 py-5 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="h-14 w-14 rounded-2xl bg-white/15 ring-1 ring-white/25 flex items-center justify-center overflow-hidden shrink-0">
                {props.loading ? (
                  <Skeleton className="h-10 w-10 rounded-xl" />
                ) : props.perusahaan?.logoUrl ? (
                  <img src={`${props.perusahaan.logoUrl}?t=${Date.now()}`} alt="Logo" className="h-12 w-12 object-contain" />
                ) : (
                  <BuildingOfficeIcon className="h-7 w-7 text-white" />
                )}
              </div>
              <div className="min-w-0">
                {props.loading ? (
                  <>
                    <Skeleton className="h-6 w-56" />
                    <Skeleton className="h-4 w-40 mt-2" />
                  </>
                ) : (
                  <>
                    <h1 className="text-xl sm:text-2xl font-extrabold truncate">{props.perusahaan?.name}</h1>
                    <p className="text-xs sm:text-sm text-emerald-100 font-semibold mt-1">ID: {props.perusahaan?.id}</p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="p-4 sm:p-6 bg-white">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <div className="text-[10px] font-black tracking-wider uppercase text-gray-400 flex items-center gap-1">
                <EnvelopeIcon className="h-3.5 w-3.5" />
                Email
              </div>
              <div className="text-sm font-semibold text-gray-900 mt-1">{props.loading ? '-' : props.perusahaan?.email || '-'}</div>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <div className="text-[10px] font-black tracking-wider uppercase text-gray-400 flex items-center gap-1">
                <PhoneIcon className="h-3.5 w-3.5" />
                Telepon
              </div>
              <div className="text-sm font-semibold text-gray-900 mt-1">{props.loading ? '-' : props.perusahaan?.phone || '-'}</div>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 sm:col-span-3">
              <div className="text-[10px] font-black tracking-wider uppercase text-gray-400 flex items-center gap-1">
                <MapPinIcon className="h-3.5 w-3.5" />
                Alamat
              </div>
              <div className="text-sm font-semibold text-gray-900 mt-1">{props.loading ? '-' : props.perusahaan?.address || '-'}</div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

