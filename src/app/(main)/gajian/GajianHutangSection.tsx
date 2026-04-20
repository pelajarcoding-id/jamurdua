'use client'

import { BanknotesIcon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function GajianHutangSection(props: {
  kebunId: string
  startDate?: Date
  endDate?: Date
  hutangLoading: boolean

  detailKaryawanLength: number
  hasAnyPotonganHutang: boolean
  hutangTambahanCount: number

  onOpenPotongHutangMassal: () => void
  onResetPotonganHutang: () => void
  onOpenTambahHutang: () => void
  onResetHutangBaru: () => void

  hutangDisplayRows: any[]
  formatNumber: (n: number) => string
  updatePotonganHutangByUserId: (userId: number, raw: string) => void
}) {
  return (
    <div className="mt-6 p-4 border rounded-lg bg-gray-50">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-3">
        <div className="flex items-start gap-2 min-w-0">
          <BanknotesIcon className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <h4 className="text-base md:text-lg font-semibold leading-tight text-gray-900">
            Daftar Hutang Karyawan <span className="text-gray-700">(Periode)</span>
          </h4>
        </div>
        <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:flex-wrap sm:justify-end sm:w-auto">
          <Button
            variant="outline"
            onClick={props.onOpenPotongHutangMassal}
            disabled={!props.kebunId || !props.startDate || !props.endDate || props.detailKaryawanLength === 0 || props.hutangLoading}
            className="border border-gray-300 bg-white hover:bg-gray-50 text-gray-900 w-full sm:w-auto h-10 px-3 text-xs sm:text-sm whitespace-nowrap inline-flex items-center justify-center"
          >
            {props.hutangLoading ? (
              'Memuat...'
            ) : (
              <>
                <span className="sm:hidden">Potong Hutang</span>
                <span className="hidden sm:inline">Potong Hutang Massal</span>
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={props.onResetPotonganHutang}
            disabled={props.detailKaryawanLength === 0 || !props.hasAnyPotonganHutang}
            className="border border-gray-300 bg-white hover:bg-gray-50 text-gray-900 w-full sm:w-auto h-10 px-3 text-xs sm:text-sm whitespace-nowrap inline-flex items-center justify-center"
          >
            <span className="sm:hidden">Reset</span>
            <span className="hidden sm:inline">Reset Potongan</span>
          </Button>
          <Button
            variant="outline"
            onClick={props.onOpenTambahHutang}
            disabled={props.detailKaryawanLength === 0 || props.hutangLoading}
            className="border border-emerald-600 bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto h-10 px-3 text-xs sm:text-sm whitespace-nowrap inline-flex items-center justify-center"
          >
            <span className="sm:hidden">+ Hutang</span>
            <span className="hidden sm:inline">+ Tambah Hutang</span>
          </Button>
          <Button
            variant="outline"
            onClick={props.onResetHutangBaru}
            disabled={props.hutangTambahanCount === 0}
            className="border border-red-200 bg-white hover:bg-red-50 text-red-700 w-full sm:w-auto h-10 px-3 text-xs sm:text-sm whitespace-nowrap inline-flex items-center justify-center"
          >
            <span className="sm:hidden">Reset Hutang</span>
            <span className="hidden sm:inline">Reset Hutang Baru</span>
          </Button>
        </div>
      </div>

      {props.hutangDisplayRows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-4 text-sm text-gray-500">Tidak ada data karyawan untuk ditampilkan.</div>
      ) : (
        <>
          <div className="md:hidden space-y-3">
            {props.hutangDisplayRows.map((r: any, idx: number) => (
              <div key={`hutang-${idx}`} className="rounded-2xl border border-gray-100 bg-white p-4 space-y-2">
                <div className="font-semibold text-gray-900">{r.name}</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-gray-400">Tanggal</div>
                    <div className="font-medium text-gray-800">{r.tanggal}</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Saldo</div>
                    <div className="font-semibold text-gray-900">Rp {Number(r.saldo || 0).toLocaleString('id-ID')}</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Potong</div>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={props.formatNumber(r.potong || 0)}
                      onChange={(e) => props.updatePotonganHutangByUserId(Number(r.userId), e.target.value)}
                      className="h-9 mt-1 text-right"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <div className="text-gray-400">Sisa</div>
                    <div className="font-semibold text-emerald-700">Rp {Number(r.sisa || 0).toLocaleString('id-ID')}</div>
                  </div>
                </div>
                <div className="text-xs text-gray-500">{r.keterangan || '-'}</div>
              </div>
            ))}
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-700">Jumlah Saldo</span>
                <span className="font-semibold text-gray-900">
                  Rp {props.hutangDisplayRows.reduce((a: number, r: any) => a + Number(r.saldo || 0), 0).toLocaleString('id-ID')}
                </span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="font-semibold text-red-600">Total Potong</span>
                <span className="font-semibold text-red-600">
                  Rp {props.hutangDisplayRows.reduce((a: number, r: any) => a + Number(r.potong || 0), 0).toLocaleString('id-ID')}
                </span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="font-semibold text-emerald-700">Total Sisa</span>
                <span className="font-semibold text-emerald-700">
                  Rp {props.hutangDisplayRows.reduce((a: number, r: any) => a + Number(r.sisa || 0), 0).toLocaleString('id-ID')}
                </span>
              </div>
            </div>
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full text-xs md:text-sm border">
              <thead>
                <tr className="border">
                  <th className="p-2 border">NO</th>
                  <th className="p-2 border">NAMA</th>
                  <th className="p-2 border">TANGGAL</th>
                  <th className="p-2 border">SALDO</th>
                  <th className="p-2 border">POTONG</th>
                  <th className="p-2 border">SISA</th>
                  <th className="p-2 border">KETERANGAN</th>
                </tr>
              </thead>
              <tbody>
                {props.hutangDisplayRows.map((r: any, idx: number) => (
                  <tr key={idx} className="border">
                    <td className="p-2 border">{idx + 1}</td>
                    <td className="p-2 border">{r.name}</td>
                    <td className="p-2 border">{r.tanggal}</td>
                    <td className="p-2 border text-right">RP. {Number(r.saldo || 0).toLocaleString('id-ID')}</td>
                    <td className="p-2 border">
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={props.formatNumber(r.potong || 0)}
                        onChange={(e) => props.updatePotonganHutangByUserId(Number(r.userId), e.target.value)}
                        className="w-32 ml-auto text-right"
                        placeholder="0"
                      />
                    </td>
                    <td className="p-2 border text-right">RP. {Number(r.sisa || 0).toLocaleString('id-ID')}</td>
                    <td className="p-2 border">{r.keterangan}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border font-bold">
                  <td className="p-2 border" colSpan={2}></td>
                  <td className="p-2 border text-center">JUMLAH</td>
                  <td className="p-2 border text-right">
                    RP. {props.hutangDisplayRows.reduce((a: number, r: any) => a + Number(r.saldo || 0), 0).toLocaleString('id-ID')}
                  </td>
                  <td className="p-2 border text-right">
                    RP. {props.hutangDisplayRows.reduce((a: number, r: any) => a + Number(r.potong || 0), 0).toLocaleString('id-ID')}
                  </td>
                  <td className="p-2 border text-right">
                    RP. {props.hutangDisplayRows.reduce((a: number, r: any) => a + Number(r.sisa || 0), 0).toLocaleString('id-ID')}
                  </td>
                  <td className="p-2 border"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

