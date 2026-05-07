'use client'

import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { ArrowDownTrayIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { PaymentDetail } from '../../types'

interface AbsensiDetailPayModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  loading: boolean
  detail: PaymentDetail | null
  onExport: () => void
  exporting: boolean
}

export function AbsensiDetailPayModal({
  open,
  onOpenChange,
  loading,
  detail,
  onExport,
  exporting
}: AbsensiDetailPayModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[92vw] sm:w-full sm:max-w-2xl max-h-[92vh] rounded-2xl p-0 overflow-hidden [&>button.absolute]:hidden flex flex-col">
        <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-500 text-white flex items-center justify-between">
          <DialogTitle className="text-white">Detail Pembayaran Gaji</DialogTitle>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="p-1 hover:bg-white/20 rounded-full transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6" id="pay-detail-content">
          {loading ? (
            <div className="py-20 text-center text-gray-400">Memuat detail pembayaran...</div>
          ) : !detail ? (
            <div className="py-20 text-center text-gray-500">Detail tidak ditemukan</div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 bg-blue-50 p-4 rounded-2xl border border-blue-100">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-blue-600 font-bold mb-1">Tanggal Bayar</div>
                  <div className="text-sm font-bold text-blue-900">{detail.paidAt ? format(new Date(detail.paidAt), 'EEEE, dd MMMM yyyy', { locale: idLocale }) : '-'}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-blue-600 font-bold mb-1">Total Bersih</div>
                  <div className="text-lg font-black text-blue-900">Rp {Number(detail.jumlah).toLocaleString('id-ID')}</div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Rincian Kehadiran</h4>
                <div className="overflow-hidden rounded-2xl border border-gray-100">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-bold text-gray-500">Tanggal</th>
                        <th className="px-4 py-2 text-right text-xs font-bold text-gray-500">Nilai</th>
                        <th className="px-4 py-2 text-left text-xs font-bold text-gray-500">Tipe</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {detail.items?.map((it: any, idx: number) => (
                        <tr key={idx}>
                          <td className="px-4 py-2 text-gray-700">{format(new Date(it.date), 'dd/MM/yy')}</td>
                          <td className="px-4 py-2 text-right font-medium">Rp {Number(it.value).toLocaleString('id-ID')}</td>
                          <td className="px-4 py-2">
                            {it.type === 'HOURLY' ? (
                                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">{it.hours} Jam</span>
                            ) : (
                                <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">Harian</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t border-dashed border-gray-200">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">Subtotal Gaji</span>
                  <span className="font-bold text-gray-900">Rp {(Number(detail.jumlah) + Number(detail.potonganHutang || 0)).toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between items-center text-sm text-red-600">
                  <span className="font-medium">Potongan Hutang</span>
                  <span className="font-bold">- Rp {Number(detail.potonganHutang || 0).toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                  <span className="text-base font-bold text-gray-900">Total Diterima Karyawan</span>
                  <span className="text-lg font-black text-blue-600">Rp {Number(detail.jumlah).toLocaleString('id-ID')}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <Button variant="outline" className="rounded-full h-10 px-6" onClick={() => onOpenChange(false)}>
            Tutup
          </Button>
          <Button 
            className="rounded-full h-10 px-6 bg-blue-600 hover:bg-blue-700 text-white"
            onClick={onExport}
            disabled={exporting || !detail}
          >
            <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
            {exporting ? 'Exporting...' : 'Simpan PDF'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
