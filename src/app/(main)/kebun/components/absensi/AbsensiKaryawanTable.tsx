'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { PencilSquareIcon, TrashIcon, MagnifyingGlassIcon, PlusIcon, UserGroupIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { Row, User } from '../../types'
import { Input } from '@/components/ui/input'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'

interface AbsensiKaryawanTableProps {
  rows: Row[]
  totalCount: number
  startIndex: number
  onRowClick: (u: User) => void
  selectedUserId: number | null
  onEdit: (u: User) => void
  onDelete: (id: number) => void
  onShowDebt: (u: User) => void
  onShowPayment: (r: Row) => void
  search: string
  onSearchChange: (s: string) => void
  page: number
  onPageChange: (p: number) => void
  totalPages: number
  perView: number
  onPerViewChange: (v: number) => void
  onAddClick: () => void
  isAdminOrOwner: boolean
  loading: boolean
  totals: {
    totalHariKerja: number
    totalGajiBerjalan: number
    totalGajiDibayar: number
    totalSaldoHutang: number
  }
  absenMonth: Date
  setAbsenMonth: (d: Date) => void
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 1)
}

function formatRupiah(n: number) {
  return `Rp ${n.toLocaleString('id-ID')}`
}

export function AbsensiKaryawanTable({
  rows,
  totalCount,
  startIndex,
  onRowClick,
  selectedUserId,
  onEdit,
  onDelete,
  search,
  onSearchChange,
  page,
  onPageChange,
  totalPages,
  perView,
  onPerViewChange,
  onAddClick,
  isAdminOrOwner,
  loading,
  totals,
  absenMonth,
  setAbsenMonth,
}: AbsensiKaryawanTableProps) {
  const endIndex = startIndex + rows.length

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-5 sm:p-6 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">Tabel Karyawan Kebun</h2>
          <p className="text-sm text-gray-500 mt-0.5">Pilih karyawan untuk mengelola absensi.</p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative w-full sm:w-56">
            <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="Cari karyawan..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="rounded-xl pl-10 h-10 border-gray-200 bg-white text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center rounded-xl border border-gray-200 overflow-hidden">
            <Button
              variant="ghost"
              size="sm"
              className="rounded-none h-10 w-10 p-0 border-r border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              onClick={() => setAbsenMonth(new Date(absenMonth.getFullYear(), absenMonth.getMonth() - 1, 1))}
            >
              <ChevronLeftIcon className="w-4 h-4" />
            </Button>
            <div className="h-10 px-5 flex items-center bg-white text-gray-800 min-w-[120px] justify-center">
              <span className="text-sm font-bold uppercase tracking-wide">{format(absenMonth, 'MMMM yyyy', { locale: idLocale })}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-none h-10 w-10 p-0 border-l border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              onClick={() => setAbsenMonth(new Date(absenMonth.getFullYear(), absenMonth.getMonth() + 1, 1))}
            >
              <ChevronRightIcon className="w-4 h-4" />
            </Button>
          </div>

          {isAdminOrOwner && (
            <Button
              size="sm"
              className="rounded-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-5 shadow-sm transition-all active:scale-95"
              onClick={onAddClick}
            >
              <PlusIcon className="h-4 w-4 mr-1.5 stroke-[3]" />
              Tambah Karyawan
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead>
            <tr className="bg-gray-50 border-y border-gray-100">
              <th className="px-5 py-3 text-left font-semibold text-gray-500 text-xs">No</th>
              <th className="px-5 py-3 text-left font-semibold text-gray-500 text-xs">Nama</th>
              <th className="px-5 py-3 text-right font-semibold text-gray-500 text-xs">Hari Kerja</th>
              <th className="px-5 py-3 text-right font-semibold text-gray-500 text-xs">Gaji Berjalan</th>
              <th className="px-5 py-3 text-right font-semibold text-gray-500 text-xs">Gaji Dibayar</th>
              <th className="px-5 py-3 text-right font-semibold text-gray-500 text-xs">Saldo Hutang</th>
              <th className="px-5 py-3 text-center font-semibold text-gray-500 text-xs">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="bg-white">
                  <td className="px-5 py-3"><Skeleton className="h-4 w-6" /></td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <Skeleton className="h-4 w-28" />
                    </div>
                  </td>
                  <td className="px-5 py-3"><Skeleton className="h-4 w-16 ml-auto" /></td>
                  <td className="px-5 py-3"><Skeleton className="h-4 w-20 ml-auto" /></td>
                  <td className="px-5 py-3"><Skeleton className="h-4 w-20 ml-auto" /></td>
                  <td className="px-5 py-3"><Skeleton className="h-4 w-20 ml-auto" /></td>
                  <td className="px-5 py-3"><Skeleton className="h-8 w-16 mx-auto rounded-lg" /></td>
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr className="bg-white">
                <td colSpan={7} className="px-5 py-16 text-center">
                  <div className="flex flex-col items-center justify-center grayscale opacity-40">
                    <UserGroupIcon className="w-10 h-10 mb-2 text-gray-400" />
                    <p className="text-sm font-medium text-gray-500">Data karyawan tidak ditemukan</p>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((r, idx) => {
                const status = r.karyawan.status?.toUpperCase()
                const isNonaktif = status === 'NONAKTIF'
                return (
                  <tr
                    key={r.karyawan.id}
                    onClick={() => onRowClick(r.karyawan)}
                    className={`group bg-white hover:bg-gray-50 cursor-pointer transition-colors ${selectedUserId === r.karyawan.id ? 'bg-emerald-50/30' : ''}`}
                  >
                    <td className="px-5 py-3 text-gray-500 text-xs">{startIndex + idx + 1}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-gray-900 flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {r.karyawan.photoUrl ? (
                            <img src={r.karyawan.photoUrl} alt={r.karyawan.name} className="w-full h-full object-cover rounded-full" />
                          ) : (
                            getInitials(r.karyawan.name)
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-gray-900 text-sm capitalize truncate">{r.karyawan.name}</p>
                            {isNonaktif && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-700">
                                Dipindah
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right text-emerald-600 text-sm font-semibold">
                      {r.hariKerja} Hari
                    </td>
                    <td className="px-5 py-3 text-right text-gray-900 text-sm font-semibold">
                      {formatRupiah(r.totalGajiBelumDibayar)}
                    </td>
                    <td className="px-5 py-3 text-right text-emerald-600 text-sm font-semibold">
                      {formatRupiah(r.totalGajiDibayar)}
                    </td>
                    <td className="px-5 py-3 text-right text-red-600 text-sm font-semibold">
                      {formatRupiah(r.hutangSaldo)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); onEdit(r.karyawan); }}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <PencilSquareIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onDelete(r.karyawan.id); }}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                          disabled={!!r.karyawan.deleteRequestPending}
                          title="Hapus"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>

          {/* Total row */}
          {!loading && rows.length > 0 && (
            <tfoot>
              <tr className="bg-gray-50 border-t border-gray-100 font-bold text-sm">
                <td className="px-5 py-3 text-gray-900 text-right" colSpan={2}>TOTAL</td>
                <td className="px-5 py-3 text-right text-emerald-600">{totals.totalHariKerja} Hari</td>
                <td className="px-5 py-3 text-right text-gray-900">{formatRupiah(totals.totalGajiBerjalan)}</td>
                <td className="px-5 py-3 text-right text-emerald-600">{formatRupiah(totals.totalGajiDibayar)}</td>
                <td className="px-5 py-3 text-right text-red-600">{formatRupiah(totals.totalSaldoHutang)}</td>
                <td className="px-5 py-3" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Footer */}
      <div className="p-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-100">
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span>
            Menampilkan <span className="font-semibold text-gray-900">{totalCount > 0 ? startIndex + 1 : 0} - {endIndex}</span> dari <span className="font-semibold text-gray-900">{totalCount}</span>
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs">Per View</span>
            <select
              className="bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-900 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
              value={perView}
              onChange={(e) => onPerViewChange(Number(e.target.value))}
            >
              {[10, 20, 50, 100].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg h-9 px-4 text-xs font-semibold text-gray-600 border-gray-200 hover:bg-gray-50 disabled:opacity-40"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Sebelumnya
          </Button>
          <div className="h-9 px-4 flex items-center rounded-lg bg-gray-100 text-gray-700">
            <span className="text-xs font-semibold">Halaman {page} / {totalPages}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg h-9 px-4 text-xs font-semibold text-gray-600 border-gray-200 hover:bg-gray-50 disabled:opacity-40"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Berikutnya
          </Button>
        </div>
      </div>
    </div>
  )
}
