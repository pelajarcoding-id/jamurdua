'use client'

import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { ClockIcon, CurrencyDollarIcon, InformationCircleIcon } from '@heroicons/react/24/outline'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ModalHeader, ModalContentWrapper, ModalFooter } from '@/components/ui/modal-elements'
import { User, AttendanceDraft } from '../../types'

interface AbsensiInputModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: User | null
  draft: AttendanceDraft
  onChange: (patch: Partial<AttendanceDraft>) => void
  saving: boolean
  onSave: () => void
  formatRibuanId: (val: string) => string
}

function computeTotal(draft: AttendanceDraft) {
  const parseNominal = (s: string) => Number(s.replace(/\D/g, '')) || 0
  const base = parseNominal(draft.amount)
  const hourly = draft.useHourly
    ? Math.round((parseFloat((draft.hour || '').replace(',', '.')) || 0) * parseNominal(draft.rate))
    : 0
  const meal = draft.mealEnabled ? parseNominal(draft.mealAmount) : 0
  return base + hourly + meal
}

export function AbsensiInputModal({
  open,
  onOpenChange,
  target,
  draft,
  onChange,
  saving,
  onSave,
  formatRibuanId
}: AbsensiInputModalProps) {
  const grandTotal = computeTotal(draft)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[92vw] sm:w-full sm:max-w-md bg-white rounded-3xl p-0 overflow-hidden shadow-2xl border-none [&>button.absolute]:hidden flex flex-col max-h-[85vh]">
        <DialogTitle className="sr-only">Input Absensi {target?.name}</DialogTitle>
        <DialogDescription className="sr-only">Formulir untuk memasukkan data absensi harian karyawan.</DialogDescription>
        <ModalHeader
          title={target?.name || 'Input Absensi'}
          subtitle={draft.date ? format(new Date(draft.date), 'EEEE, dd MMMM yyyy', { locale: idLocale }) : ''}
          variant="emerald"
          onClose={() => onOpenChange(false)}
        />

        <ModalContentWrapper className="space-y-5 overflow-y-auto scrollbar-hide flex-1" id="absen-input-content-kebun">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => { onChange({ work: true, off: false }) }}
              className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all gap-2 ${draft.work ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200'}`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${draft.work ? 'bg-emerald-100' : 'bg-gray-50'}`}>
                <span className="text-xl">✅</span>
              </div>
              <span className="text-xs font-bold uppercase tracking-wider">Masuk</span>
            </button>
            <button
              onClick={() => { onChange({ off: true, work: false, amount: '' }) }}
              className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all gap-2 ${draft.off ? 'bg-red-50 border-red-500 text-red-700' : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200'}`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${draft.off ? 'bg-red-100' : 'bg-gray-50'}`}>
                <span className="text-xl">🏠</span>
              </div>
              <span className="text-xs font-bold uppercase tracking-wider">Libur</span>
            </button>
          </div>

          {!draft.off && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="p-4 rounded-2xl bg-gray-50/50 border border-gray-100 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                      <ClockIcon className="w-4 h-4 text-indigo-600" />
                    </div>
                    <Label className="text-sm font-bold text-gray-700">Hitung Per Jam</Label>
                  </div>
                  <Switch checked={draft.useHourly} onCheckedChange={(v) => onChange({ useHourly: v })} />
                </div>

                {draft.useHourly && (
                  <div className="grid grid-cols-2 gap-3 animate-in zoom-in-95 duration-200">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Durasi (Jam)</Label>
                      <Input
                        type="text"
                        placeholder="0"
                        value={draft.hour}
                        onChange={(e) => onChange({ hour: e.target.value.replace(',', '.') })}
                        className="rounded-xl h-10 bg-white border-2 border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-600 transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Upah / Jam</Label>
                      <Input
                        type="text"
                        placeholder="0"
                        value={draft.rate}
                        onChange={(e) => onChange({ rate: formatRibuanId(e.target.value) })}
                        className="rounded-xl h-10 bg-white border-2 border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-600 transition-all"
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                      <CurrencyDollarIcon className="w-4 h-4 text-orange-600" />
                    </div>
                    <Label className="text-sm font-bold text-gray-700">Uang Makan</Label>
                  </div>
                  <Switch checked={draft.mealEnabled} onCheckedChange={(v) => onChange({ mealEnabled: v })} />
                </div>

                {draft.mealEnabled && (
                  <div className="animate-in zoom-in-95 duration-200">
                    <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Jumlah Uang Makan</Label>
                    <Input
                      type="text"
                      placeholder="0"
                      value={draft.mealAmount}
                      onChange={(e) => onChange({ mealAmount: formatRibuanId(e.target.value) })}
                      className="rounded-xl h-10 bg-white border-2 border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-600 transition-all mt-1.5"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                    <Label className="text-sm font-bold text-gray-700">Gaji Harian / Tambahan</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full text-gray-400">
                                <InformationCircleIcon className="w-4 h-4" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 text-xs bg-white p-3 rounded-xl shadow-xl border-gray-100">
                            Masukkan nominal gaji harian manual di sini. Jika menggunakan &quot;Hitung Per Jam&quot;, nilai ini akan ditambahkan ke total.
                        </PopoverContent>
                    </Popover>
                </div>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">Rp</div>
                  <Input
                    placeholder="0"
                    value={draft.amount}
                    onChange={(e) => onChange({ amount: formatRibuanId(e.target.value) })}
                    className="rounded-2xl h-14 pl-12 text-lg font-black border-2 border-emerald-500 bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-600 transition-all duration-200 shadow-md text-gray-900"
                  />
                </div>
              </div>

              {/* Total */}
              <div className="flex items-center justify-between px-2 pt-3 border-t border-gray-100">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Diterima</span>
                <span className="text-xl font-black text-gray-900 tracking-tight">Rp {grandTotal.toLocaleString('id-ID')}</span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-sm font-bold text-gray-700 px-1">Catatan</Label>
            <Input
              placeholder="Contoh: Lembur 2 jam, Izin pulang cepat..."
              value={draft.note}
              onChange={(e) => onChange({ note: e.target.value })}
              className="rounded-2xl h-12 border-2 border-emerald-500 bg-gray-50/50 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-600 transition-all"
            />
          </div>
        </ModalContentWrapper>

        <ModalFooter className="sm:justify-between items-center gap-3">
          <Button
            variant="ghost"
            className="rounded-full text-gray-400 hover:text-gray-600"
            onClick={() => onOpenChange(false)}
          >
            Batal
          </Button>
          <Button
            className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white px-8 h-12 font-bold shadow-lg shadow-emerald-200"
            onClick={onSave}
            disabled={saving || (!draft.work && !draft.off)}
          >
            {saving ? 'Menyimpan...' : 'Simpan Absensi'}
          </Button>
        </ModalFooter>
      </DialogContent>
    </Dialog>
  )
}
