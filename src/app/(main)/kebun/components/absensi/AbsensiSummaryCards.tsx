'use client'

import { BanknotesIcon, CreditCardIcon, UserGroupIcon, CalendarDaysIcon } from '@heroicons/react/24/outline'

interface AbsensiSummaryCardsProps {
  loading: boolean
  totals: {
    totalGajiBerjalan: number
    totalGajiDibayar: number
    totalSaldoHutang: number
    totalHariKerja: number
  }
}

export function AbsensiSummaryCards({ totals, loading }: AbsensiSummaryCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 animate-pulse">
            <div className="h-4 w-24 bg-gray-100 rounded mb-4"></div>
            <div className="h-8 w-32 bg-gray-100 rounded"></div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Hari Kerja */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-emerald-50 rounded-lg">
            <CalendarDaysIcon className="w-5 h-5 text-emerald-600" />
          </div>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Hari Kerja</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-gray-900">{totals.totalHariKerja}</span>
          <span className="text-sm text-gray-500 font-medium">Hari</span>
        </div>
      </div>

      {/* Gaji Berjalan */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-emerald-50 rounded-lg">
            <BanknotesIcon className="w-5 h-5 text-emerald-600" />
          </div>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Gaji Berjalan</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-sm font-bold text-gray-900">Rp</span>
          <span className="text-3xl font-bold text-gray-900">{totals.totalGajiBerjalan.toLocaleString('id-ID')}</span>
        </div>
      </div>

      {/* Gaji Dibayar */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-emerald-50 rounded-lg">
            <BanknotesIcon className="w-5 h-5 text-emerald-600" />
          </div>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Gaji Dibayar</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-sm font-bold text-emerald-600">Rp</span>
          <span className="text-3xl font-bold text-emerald-600">{totals.totalGajiDibayar.toLocaleString('id-ID')}</span>
        </div>
      </div>

      {/* Saldo Hutang */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-red-50 rounded-lg">
            <CreditCardIcon className="w-5 h-5 text-red-600" />
          </div>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Saldo Hutang</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-sm font-bold text-red-600">Rp</span>
          <span className="text-3xl font-bold text-red-600">{totals.totalSaldoHutang.toLocaleString('id-ID')}</span>
        </div>
      </div>
    </div>
  )
}
