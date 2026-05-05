'use client'

import { AdjustmentsHorizontalIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function GajianPotonganSection(props: {
  kebunId: string
  startDate?: Date
  endDate?: Date
  formatDate: (d: Date) => string
  formatCurrency: (n: number) => string
  formatNumber: (n: number) => string

  importPotonganLoading: boolean
  onImportPotonganPengajuan: () => void
  onAddPotongan: () => void

  manualPotonganRows: any[]
  editingPotonganId: string | null
  setEditingPotonganId: (id: string | null) => void
  onPotonganChange: (id: string, field: string, value: any) => void
  onRemoveSavedPotongan: (id: string) => void
}) {
  return (
    <div>
      <div className="mb-2">
        <div className="flex items-start justify-between gap-3 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex items-start gap-2 shrink-0">
            <AdjustmentsHorizontalIcon className="h-5 w-5 text-rose-600 mt-0.5 shrink-0" />
            <h3 className="text-base md:text-lg font-semibold leading-tight text-gray-900">Potongan</h3>
          </div>
          <div className="flex items-center gap-2 flex-nowrap shrink-0">
            <Button
              variant="outline"
              onClick={props.onImportPotonganPengajuan}
              disabled={!props.kebunId || !props.startDate || !props.endDate || props.importPotonganLoading}
              className="h-10 px-4 rounded-full border-red-500 text-red-700 bg-white hover:bg-red-50 text-xs sm:text-sm whitespace-nowrap inline-flex items-center justify-center shrink-0 w-[160px]"
            >
              {props.importPotonganLoading ? (
                'Memuat...'
              ) : (
                <>
                  <span className="sm:hidden">Tarik</span>
                  <span className="hidden sm:inline">Tarik Potongan</span>
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={props.onAddPotongan}
              className="h-10 px-4 rounded-full border-red-600 bg-red-600 text-white hover:bg-red-700 hover:border-red-700 text-xs sm:text-sm whitespace-nowrap inline-flex items-center justify-center shrink-0 w-[160px]"
            >
              <span className="sm:hidden">Tambah</span>
              <span className="hidden sm:inline">+ Tambah Potongan</span>
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
        {props.manualPotonganRows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-4 text-sm text-gray-500">
            Tambahkan potongan lain (di luar potongan hutang) untuk mengurangi total gaji.
          </div>
        ) : null}

        {props.manualPotonganRows.map((item) => (
          <div key={item.id} className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
            {props.editingPotonganId === item.id ? (
              <>
                <Input
                  placeholder="Deskripsi"
                  value={item.deskripsi}
                  onChange={(e) => props.onPotonganChange(item.id, 'deskripsi', e.target.value)}
                  className="h-10 rounded-full"
                />
                <Input
                  placeholder="Keterangan (opsional)"
                  value={item.keterangan || ''}
                  onChange={(e) => props.onPotonganChange(item.id, 'keterangan', e.target.value)}
                  className="h-10 rounded-full"
                />
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="Total"
                  value={item.total ? props.formatNumber(item.total) : ''}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\\D/g, '')
                    const numericValue = digits ? Number(digits) : 0
                    props.onPotonganChange(item.id, 'total', numericValue)
                  }}
                  className="h-10 rounded-full text-right"
                />
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" className="rounded-full" onClick={() => props.setEditingPotonganId(null)}>
                    Simpan
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="rounded-full"
                    onClick={() => {
                      props.onRemoveSavedPotongan(item.id)
                      props.setEditingPotonganId(null)
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
                    {item.keterangan ? <div className="text-xs text-gray-500 break-words mt-1">{item.keterangan}</div> : null}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-full text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                      onClick={() => props.setEditingPotonganId(item.id)}
                    >
                      <PencilSquareIcon className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-full text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => props.onRemoveSavedPotongan(item.id)}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Total</span>
                  <span className="font-semibold text-gray-900">{props.formatCurrency(Number(item.total || 0))}</span>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {props.manualPotonganRows.length > 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 mt-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-gray-700">Total Potongan</span>
            <span className="text-lg font-extrabold text-red-600">
              -{props.formatCurrency(props.manualPotonganRows.reduce((sum, p) => sum + (Number(p.total) || 0), 0))}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  )
}
