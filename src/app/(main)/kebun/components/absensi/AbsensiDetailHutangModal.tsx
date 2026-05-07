'use client'

import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { ArrowDownTrayIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ModalHeader, ModalContentWrapper, ModalFooter } from '@/components/ui/modal-elements'
import { User, HutangDetailRow } from '../../types'

interface AbsensiDetailHutangModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: User | null
  rows: HutangDetailRow[]
  loading: boolean
  exporting: boolean
  onExport: () => void
}

export function AbsensiDetailHutangModal({
  open,
  onOpenChange,
  target,
  rows,
  loading,
  exporting,
  onExport
}: AbsensiDetailHutangModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[92vw] sm:w-full sm:max-w-2xl max-h-[92vh] rounded-2xl p-0 overflow-hidden [&>button.absolute]:hidden flex flex-col">
        <ModalHeader
          title={`Detail Hutang: ${target?.name || ''}`}
          variant="emerald"
          onClose={() => onOpenChange(false)}
        />

        <ModalContentWrapper className="flex-1 overflow-y-auto p-0" id="hutang-detail-content">
          <div className="p-4 md:p-6 space-y-4">
            {loading ? (
              <div className="py-20 text-center text-gray-400">Memuat detail...</div>
            ) : rows.length === 0 ? (
              <div className="py-20 text-center text-gray-500 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                Belum ada riwayat hutang/potongan
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-100">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Tanggal</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Keterangan</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-600">Masuk</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-600">Keluar</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-600">Saldo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.map((r, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                          {format(new Date(r.date), 'dd/MM/yy', { locale: idLocale })}
                        </td>
                        <td className="px-4 py-3 text-gray-700 min-w-[150px]">{r.description ?? (r.deskripsi || '-')}</td>
                        <td className="px-4 py-3 text-right text-emerald-600 font-medium">
                          {(r.type ?? r.tipe) === 'HUTANG' ? `Rp ${((r.amount ?? r.jumlah) || 0).toLocaleString('id-ID')}` : '-'}
                        </td>
                        <td className="px-4 py-3 text-right text-red-600 font-medium">
                          {(r.type ?? r.tipe) === 'POTONGAN' ? `Rp ${((r.amount ?? r.jumlah) || 0).toLocaleString('id-ID')}` : '-'}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-gray-900">
                          Rp {(r.balance ?? 0).toLocaleString('id-ID')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </ModalContentWrapper>

        <ModalFooter className="bg-gray-50 border-t border-gray-100 sm:justify-between items-center gap-3">
          <div className="hidden sm:block text-xs text-gray-500">
            Total {rows.length} riwayat ditemukan
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              className="rounded-full flex-1 sm:flex-none"
              onClick={() => onOpenChange(false)}
            >
              Tutup
            </Button>
            <Button
              className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex-1 sm:flex-none"
              onClick={onExport}
              disabled={exporting || rows.length === 0}
            >
              <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
              {exporting ? 'Exporting...' : 'Export PDF'}
            </Button>
          </div>
        </ModalFooter>
      </DialogContent>
    </Dialog>
  )
}
