'use client'

import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { EyeIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/button'

export function InventoryOutHistorySection(props: {
  loading: boolean
  transactions: any[]
  onViewImage: (url: string) => void
  onEdit: (trx: any) => void
  onDelete: (trx: any) => void
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Riwayat Pengeluaran</h3>
        <span className="text-xs text-gray-400">20 terakhir</span>
      </div>
      {props.loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : props.transactions.length === 0 ? (
        <div className="text-sm text-gray-500">Belum ada riwayat pengeluaran.</div>
      ) : (
        <>
          <div className="space-y-3 sm:hidden">
            {props.transactions.map((trx) => (
              <div key={trx.id} className="rounded-xl border border-gray-100 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-gray-900">{trx.item.name}</div>
                    <div className="text-xs text-gray-500">
                      {format(new Date(trx.date), 'dd MMM yyyy', { locale: idLocale })} • {trx.user?.name || '-'}
                    </div>
                    {trx.kendaraanPlatNomor ? (
                      <div className="text-xs text-gray-500">
                        Kendaraan: {trx.kendaraan?.platNomor || trx.kendaraanPlatNomor}
                        {trx.kendaraan?.jenis ? ` • ${trx.kendaraan.jenis}` : ''}
                      </div>
                    ) : null}
                    {trx.notes ? <div className="text-xs text-gray-400">{trx.notes}</div> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-bold text-red-600">
                      -{trx.quantity} {trx.item.unit}
                    </div>
                    {trx.imageUrl ? (
                      <Button
                        variant="outline"
                        className="h-8 w-8 p-0 rounded-full"
                        onClick={() => props.onViewImage(trx.imageUrl)}
                        title="Lihat bukti"
                      >
                        <EyeIcon className="h-4 w-4" />
                      </Button>
                    ) : null}
                    <Button variant="outline" className="h-8 w-8 p-0 rounded-full" onClick={() => props.onEdit(trx)}>
                      <PencilSquareIcon className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      className="h-8 w-8 p-0 rounded-full text-red-600 hover:bg-red-50"
                      onClick={() => props.onDelete(trx)}
                      title="Hapus"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden sm:block overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50/80">
                <tr>
                  <th className="px-3 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">Tanggal</th>
                  <th className="px-3 py-3 text-left font-semibold text-gray-700">Barang</th>
                  <th className="px-3 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">Kendaraan</th>
                  <th className="px-3 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">User</th>
                  <th className="px-3 py-3 text-right font-semibold text-gray-700 whitespace-nowrap">Jumlah</th>
                  <th className="px-3 py-3 text-left font-semibold text-gray-700">Keterangan</th>
                  <th className="px-3 py-3 text-right font-semibold text-gray-700 whitespace-nowrap">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {props.transactions.map((trx) => (
                  <tr key={trx.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 whitespace-nowrap text-gray-600">
                      {format(new Date(trx.date), 'dd MMM yyyy', { locale: idLocale })}
                    </td>
                    <td className="px-3 py-2 font-semibold text-gray-900 whitespace-nowrap">{trx.item.name}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-600">
                      {trx.kendaraanPlatNomor ? trx.kendaraan?.platNomor || trx.kendaraanPlatNomor : '-'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-600">{trx.user?.name || '-'}</td>
                    <td className="px-3 py-2 text-right font-bold text-red-600 whitespace-nowrap">
                      -{trx.quantity} {trx.item.unit}
                    </td>
                    <td className="px-3 py-2 text-gray-500 max-w-[360px] truncate">{trx.notes || '-'}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-2">
                        {trx.imageUrl ? (
                          <Button
                            variant="outline"
                            className="h-8 w-8 p-0 rounded-full"
                            onClick={() => props.onViewImage(trx.imageUrl)}
                            title="Lihat bukti"
                          >
                            <EyeIcon className="h-4 w-4" />
                          </Button>
                        ) : null}
                        <Button variant="outline" className="h-8 w-8 p-0 rounded-full" onClick={() => props.onEdit(trx)} title="Edit">
                          <PencilSquareIcon className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          className="h-8 w-8 p-0 rounded-full text-red-600 hover:bg-red-50"
                          onClick={() => props.onDelete(trx)}
                          title="Hapus"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

