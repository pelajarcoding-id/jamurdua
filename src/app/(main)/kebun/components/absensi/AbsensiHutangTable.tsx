'use client'

import { Button } from '@/components/ui/button'
import { CreditCardIcon } from '@heroicons/react/24/outline'
import { Row, User } from '../../types'

interface AbsensiHutangTableProps {
  rows: Row[]
  startIndex: number
  page: number
  onPageChange: (page: number) => void
  totalPages: number
  perView: number
  onPerViewChange: (val: number) => void
  onShowDebt: (u: User) => void
  canSeeDebtDetail: boolean
}

export function AbsensiHutangTable({
  rows,
  startIndex,
  page,
  onPageChange,
  totalPages,
  perView,
  onPerViewChange,
  onShowDebt,
  canSeeDebtDetail,
}: AbsensiHutangTableProps) {
  return (
    <div className="bg-white p-4 sm:p-8 rounded-3xl border border-gray-100 shadow-sm overflow-hidden mt-8">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 mb-10">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-red-50 flex items-center justify-center text-red-600 shadow-inner shrink-0">
            <CreditCardIcon className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">Rincian Hutang</h2>
            <p className="text-xs sm:text-sm text-gray-500 font-medium">Monitoring pinjaman dan pelunasan karyawan.</p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-gray-50/30 scrollbar-hide">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-6 py-4 text-left font-bold text-gray-600 uppercase tracking-widest text-[10px]">No</th>
              <th className="px-6 py-4 text-left font-bold text-gray-600 uppercase tracking-widest text-[10px]">Karyawan</th>
              <th className="px-6 py-4 text-right font-bold text-gray-600 uppercase tracking-widest text-[10px]">Saldo Sebelum Potong</th>
              <th className="px-6 py-4 text-right font-bold text-gray-600 uppercase tracking-widest text-[10px]">Potongan Terakhir</th>
              <th className="px-6 py-4 text-right font-bold text-gray-600 uppercase tracking-widest text-[10px]">Saldo Hutang</th>
              <th className="px-6 py-4 text-center font-bold text-gray-600 uppercase tracking-widest text-[10px]">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-400 font-medium">Tidak ada data hutang</td>
              </tr>
            ) : (
              rows.map((r, idx) => (
                <tr key={r.karyawan.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 font-bold text-gray-400">{startIndex + idx + 1}</td>
                  <td className="px-6 py-4 font-bold text-gray-900 capitalize">{r.karyawan.name}</td>
                  <td className="px-6 py-4 text-right font-semibold text-gray-400">
                    Rp {Math.round((r.hutangSaldo || 0) + (r.lastPotongan?.jumlah || 0)).toLocaleString('id-ID')}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-emerald-600">
                    {r.lastPotongan?.jumlah ? `Rp ${Math.round(r.lastPotongan.jumlah).toLocaleString('id-ID')}` : '-'}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-red-600 text-lg">
                    Rp {Math.round(r.hutangSaldo || 0).toLocaleString('id-ID')}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {canSeeDebtDetail ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-xl text-blue-600 hover:bg-blue-50 font-bold"
                        onClick={() => onShowDebt(r.karyawan)}
                      >
                        Detail
                      </Button>
                    ) : '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Per View</span>
          <select
            className="h-9 rounded-xl border border-gray-200 bg-gray-50 px-3 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
            value={perView}
            onChange={(e) => onPerViewChange(Number(e.target.value))}
          >
            {[10, 20, 50, 100].map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl h-9 px-4 font-bold text-gray-600"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Prev
          </Button>
          <div className="bg-gray-50 h-9 px-4 flex items-center rounded-xl border border-gray-100">
            <span className="text-xs font-bold text-gray-900">{page} / {totalPages}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl h-9 px-4 font-bold text-gray-600"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
