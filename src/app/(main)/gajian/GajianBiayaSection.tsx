'use client'

import { BanknotesIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export function GajianBiayaSection(props: {
  kebunId: string
  startDate?: Date
  endDate?: Date
  formatDate: (d: Date) => string
  formatCurrency: (n: number) => string
  formatNumber: (n: number, decimals?: number) => string

  boronganLoading: boolean
  onImportUpahBorongan: () => void
  onAddBiaya: () => void

  savedBiaya: any[]
  editingBiayaId: string | null
  setEditingBiayaId: (id: string | null) => void
  biayaFieldErrors: Record<string, any>
  cleanBiayaKeterangan: (v: any) => string
  onBiayaChange: (id: string, field: string, value: any) => void
  onRemoveSavedBiaya: (id: string) => void
}) {
  return (
    <div>
      <div className="mb-2">
        <div className="flex items-start justify-between gap-3 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex items-start gap-2 shrink-0">
            <BanknotesIcon className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
            <h3 className="text-base md:text-lg font-semibold leading-tight text-gray-900">Biaya Gaji</h3>
          </div>
          <div className="flex items-center gap-2 flex-nowrap shrink-0">
            <Button
              variant="outline"
              onClick={props.onImportUpahBorongan}
              disabled={!props.kebunId || !props.startDate || !props.endDate || props.boronganLoading}
              className="h-10 px-4 rounded-full border-red-500 text-red-700 bg-white hover:bg-red-50 text-xs sm:text-sm whitespace-nowrap inline-flex items-center justify-center shrink-0 w-[160px]"
            >
              {props.boronganLoading ? 'Memuat...' : 'Tarik Biaya Kebun'}
            </Button>
            <Button
              variant="outline"
              onClick={props.onAddBiaya}
              className="h-10 px-4 rounded-full border-emerald-600 text-emerald-700 bg-white hover:bg-emerald-50 text-xs sm:text-sm whitespace-nowrap inline-flex items-center justify-center shrink-0 w-[160px]"
            >
              <span className="sm:hidden">Tambah Biaya</span>
              <span className="hidden sm:inline">+ Tambah Biaya Gaji</span>
            </Button>
          </div>
        </div>
        <div className="mt-1 pl-7 text-xs text-gray-500">
          <span>Periode:</span>{' '}
          <span className="font-semibold text-gray-900">{props.startDate ? props.formatDate(props.startDate) : '-'}</span>{' '}
          <span className="text-gray-400">-</span>{' '}
          <span className="font-semibold text-gray-900">{props.endDate ? props.formatDate(props.endDate) : '-'}</span>
        </div>
      </div>

      <div className="space-y-4">
        {props.savedBiaya.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-4 text-sm text-gray-500">
            Tambahkan biaya gaji untuk menambah total gajian.
          </div>
        ) : null}

        {props.savedBiaya.map((item) => (
          <div
            key={item.id}
            data-biaya-row={item.id}
            className={cn(
              'rounded-2xl border bg-white p-4 space-y-3',
              props.biayaFieldErrors[item.id] ? 'border-red-300 ring-2 ring-red-200' : 'border-gray-100',
            )}
          >
            {props.editingBiayaId === item.id ? (
              <>
                <Input
                  placeholder="Deskripsi"
                  value={item.deskripsi}
                  onChange={(e) => props.onBiayaChange(item.id, 'deskripsi', e.target.value)}
                  data-biaya-id={item.id}
                  data-biaya-field="deskripsi"
                  className={cn(
                    'h-10 rounded-full',
                    props.biayaFieldErrors[item.id]?.deskripsi ? 'border-red-500 ring-2 ring-red-500/20' : '',
                  )}
                />
                <Input
                  placeholder="Keterangan (opsional)"
                  value={item.keterangan || ''}
                  onChange={(e) => props.onBiayaChange(item.id, 'keterangan', e.target.value)}
                  className="h-10 rounded-full"
                />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Input
                    type="number"
                    step="any"
                    placeholder="Jumlah"
                    value={item.jumlah || ''}
                    onChange={(e) => {
                      const val = e.target.value
                      const numericValue = val ? parseFloat(val) : 0
                      props.onBiayaChange(item.id, 'jumlah', numericValue)
                    }}
                    data-biaya-id={item.id}
                    data-biaya-field="jumlah"
                    className={cn(
                      'h-10 rounded-full text-right',
                      props.biayaFieldErrors[item.id]?.jumlah ? 'border-red-500 ring-2 ring-red-500/20' : '',
                    )}
                  />
                  <Input
                    placeholder="Satuan"
                    value={item.satuan}
                    onChange={(e) => props.onBiayaChange(item.id, 'satuan', e.target.value)}
                    className="h-10 rounded-full"
                  />
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="Harga Satuan"
                    value={item.hargaSatuan ? props.formatNumber(item.hargaSatuan) : ''}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '')
                      const numericValue = digits ? Number(digits) : 0
                      props.onBiayaChange(item.id, 'hargaSatuan', numericValue)
                    }}
                    data-biaya-id={item.id}
                    data-biaya-field="hargaSatuan"
                    className={cn(
                      'h-10 rounded-full text-right',
                      props.biayaFieldErrors[item.id]?.hargaSatuan ? 'border-red-500 ring-2 ring-red-500/20' : '',
                    )}
                  />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Total</span>
                  <span className="font-semibold text-gray-900">
                    {props.formatCurrency(Math.round(Number(item.jumlah || 0) * Number(item.hargaSatuan || 0)))}
                  </span>
                </div>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" className="rounded-full" onClick={() => props.setEditingBiayaId(null)}>
                    Simpan
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="rounded-full"
                    onClick={() => {
                      props.onRemoveSavedBiaya(item.id)
                      props.setEditingBiayaId(null)
                    }}
                  >
                    Hapus
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900 break-words">{item.deskripsi || '-'}</div>
                    {props.cleanBiayaKeterangan(item.keterangan) ? (
                      <div className="text-xs text-gray-500 break-words mt-1">{props.cleanBiayaKeterangan(item.keterangan)}</div>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-full text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                      onClick={() => props.setEditingBiayaId(item.id)}
                    >
                      <PencilSquareIcon className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-full text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => props.onRemoveSavedBiaya(item.id)}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="text-xs text-gray-600 flex flex-wrap items-center gap-1">
                  <span className="font-semibold text-gray-900">{props.formatNumber(Number(item.jumlah || 0), 2)}</span>
                  <span>{String(item.satuan || '').trim()}</span>
                  <span className="text-gray-400">x</span>
                  <span className="font-semibold text-gray-900">{props.formatCurrency(Number(item.hargaSatuan || 0))}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Total</span>
                  <span className="font-semibold text-gray-900">
                    {props.formatCurrency(Math.round(Number(item.jumlah || 0) * Number(item.hargaSatuan || 0)))}
                  </span>
                </div>
              </>
            )}
          </div>
        ))}

        {props.savedBiaya.length > 0 ? (
          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-gray-700">Jumlah Biaya</span>
              <span className="text-lg font-extrabold text-gray-900">
                {props.formatCurrency(props.savedBiaya.reduce((sum, b) => sum + Math.round(Number(b.jumlah || 0) * Number(b.hargaSatuan || 0)), 0))}
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

