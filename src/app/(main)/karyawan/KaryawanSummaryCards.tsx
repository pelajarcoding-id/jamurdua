'use client'

import { BanknotesIcon, CreditCardIcon, UserGroupIcon } from '@heroicons/react/24/outline'

export function KaryawanSummaryCards(props: {
  totalKaryawan: number
  totalGaji: number
  totalHutang: number
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-emerald-50 rounded-lg">
            <UserGroupIcon className="w-5 h-5 text-emerald-600" />
          </div>
          <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">Total Karyawan</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-gray-900">{props.totalKaryawan}</span>
          <span className="text-sm text-gray-500 font-medium">Orang</span>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-emerald-50 rounded-lg">
            <BanknotesIcon className="w-5 h-5 text-emerald-600" />
          </div>
          <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">Total Gaji</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-sm font-bold text-gray-900">Rp</span>
          <span className="text-3xl font-bold text-gray-900">{props.totalGaji.toLocaleString('id-ID')}</span>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-red-50 rounded-lg">
            <CreditCardIcon className="w-5 h-5 text-red-600" />
          </div>
          <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">Total Hutang</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-sm font-bold text-red-600">Rp</span>
          <span className="text-3xl font-bold text-red-600">{props.totalHutang.toLocaleString('id-ID')}</span>
        </div>
      </div>
    </div>
  )
}

