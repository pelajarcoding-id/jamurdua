'use client'

import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { 
  ClockIcon, 
  CurrencyDollarIcon, 
  BanknotesIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  PencilSquareIcon,
  TrashIcon
} from '@heroicons/react/24/outline'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ModalHeader, ModalContentWrapper, ModalFooter } from '@/components/ui/modal-elements'
import { User, AttendanceDraft } from '../../types'

interface AbsensiViewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: User | null
  draft: AttendanceDraft
  isPaid: boolean
  onEdit?: () => void
  onDelete?: () => void
  isDeleting?: boolean
}

export function AbsensiViewModal({
  open,
  onOpenChange,
  target,
  draft,
  isPaid,
  onEdit,
  onDelete,
  isDeleting
}: AbsensiViewModalProps) {
  if (!draft.date) return null

  const parseNominal = (s: string) => Number(s.replace(/\D/g, '')) || 0
  const totalHourly = draft.useHourly ? (parseFloat(draft.hour.replace(',', '.')) || 0) * parseNominal(draft.rate) : 0
  const totalMeal = draft.mealEnabled ? parseNominal(draft.mealAmount) : 0
  const totalExtra = parseNominal(draft.amount)
  const grandTotal = totalHourly + totalMeal + totalExtra

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[92vw] sm:w-full sm:max-w-md bg-white rounded-3xl p-0 overflow-hidden shadow-2xl border-none [&>button.absolute]:hidden flex flex-col max-h-[85vh]">
        <DialogTitle className="sr-only">Detail Absensi {target?.name}</DialogTitle>
        <DialogDescription className="sr-only">Rincian lengkap kehadiran dan upah karyawan.</DialogDescription>
        
        <ModalHeader
          title={target?.name || 'Detail Absensi'}
          subtitle={draft.date ? format(new Date(draft.date), 'EEEE, dd MMMM yyyy', { locale: idLocale }) : ''}
          variant="emerald"
          onClose={() => onOpenChange(false)}
        />

        <ModalContentWrapper className="space-y-4 py-6 overflow-y-auto scrollbar-hide flex-1" id="absen-view-content">
          <div className="p-5 rounded-2xl border border-gray-100 bg-white flex items-center gap-4 shadow-sm">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${draft.work ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
              {draft.work ? <CheckCircleIcon className="w-8 h-8" /> : <XCircleIcon className="w-8 h-8" />}
            </div>
            <div>
              <h4 className="text-sm font-black uppercase tracking-wider text-emerald-900">
                {draft.work ? 'MASUK KERJA' : draft.off ? 'LIBUR / IJIN' : 'TIDAK ADA DATA'}
              </h4>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status Kehadiran</p>
            </div>
          </div>

          <div className="p-5 rounded-2xl border border-gray-100 bg-white flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                <ClockIcon className="w-6 h-6" />
              </div>
              <h4 className="text-[11px] font-black uppercase tracking-widest text-gray-500">Upah Per Jam</h4>
            </div>
            <div className="text-right">
              <p className="text-sm font-black text-gray-900">{draft.useHourly ? `${draft.hour} Jam` : '-'}</p>
              {draft.useHourly && <p className="text-[9px] font-bold text-gray-400 uppercase">@ Rp {draft.rate}</p>}
            </div>
          </div>

          <div className="p-5 rounded-2xl border border-gray-100 bg-white flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
                <CurrencyDollarIcon className="w-6 h-6" />
              </div>
              <h4 className="text-[11px] font-black uppercase tracking-widest text-gray-500">Uang Makan</h4>
            </div>
            <p className="text-sm font-black text-gray-900">Rp {draft.mealEnabled ? draft.mealAmount : '0'}</p>
          </div>

          <div className="p-5 rounded-2xl border border-gray-100 bg-white flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                <BanknotesIcon className="w-6 h-6" />
              </div>
              <h4 className="text-[11px] font-black uppercase tracking-widest text-gray-500">Gaji Harian / Tambahan</h4>
            </div>
            <p className="text-sm font-black text-gray-900">Rp {draft.amount}</p>
          </div>

          {draft.note && (
            <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 italic text-xs text-gray-500">
              &quot;{draft.note}&quot;
            </div>
          )}

          <div className={`mt-4 p-5 rounded-3xl flex items-center justify-center relative overflow-hidden ${isPaid ? 'bg-purple-50 text-purple-700' : 'bg-orange-50 text-orange-700'}`}>
            <span className="text-xs font-black uppercase tracking-[0.2em] z-10">
              {isPaid ? 'SUDAH TERBAYAR / LUNAS' : 'BELUM DIBAYAR'}
            </span>
            {isPaid && (
              <div className="absolute right-[-10px] top-[-10px] opacity-10 rotate-12">
                <div className="border-4 border-purple-700 rounded-full p-4 font-black text-3xl">PAID</div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between px-2 pt-2 border-t border-gray-100">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Diterima</span>
            <span className="text-xl font-black text-gray-900 tracking-tight">Rp {grandTotal.toLocaleString('id-ID')}</span>
          </div>
        </ModalContentWrapper>

        <ModalFooter className="flex items-center gap-2">
          {!isPaid && (
            <>
              <Button
                variant="ghost"
                className="flex-1 rounded-2xl h-12 font-bold text-blue-600 hover:bg-blue-50"
                onClick={onEdit}
              >
                <PencilSquareIcon className="w-5 h-5 mr-2" />
                Ubah
              </Button>
              <Button
                variant="ghost"
                className="flex-1 rounded-2xl h-12 font-bold text-red-600 hover:bg-red-50"
                onClick={onDelete}
                disabled={isDeleting}
              >
                <TrashIcon className="w-5 h-5 mr-2" />
                {isDeleting ? 'Hapus...' : 'Hapus'}
              </Button>
            </>
          )}
          <Button
            className={`rounded-2xl h-12 font-bold ${isPaid ? 'w-full bg-gray-900' : 'w-24 bg-gray-100 hover:bg-gray-200 text-gray-900'} shadow-none transition-all active:scale-95`}
            onClick={() => onOpenChange(false)}
          >
            Tutup
          </Button>
        </ModalFooter>
      </DialogContent>
    </Dialog>
  )
}
