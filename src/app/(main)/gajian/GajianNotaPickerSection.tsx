'use client'

import { ArrowRightIcon, ClipboardDocumentListIcon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { DataTable } from '@/components/data-table'

export function GajianNotaPickerSection(props: {
  notas: any[]
  totalNotas: number
  notaFetchLimit: number
  rowSelection: Record<string, boolean>
  setRowSelection: (updater: any) => void
  canProcessNota: boolean
  onMoveToProcess: () => void
  onClearSelection: () => void
  formatDate: (d: Date) => string
  formatNumber: (n: number) => string
  getNotaNetto: (nota: any) => number | null
  columns: any
}) {
  if (!props.notas || props.notas.length === 0) return null

  const selectedCount = Object.keys(props.rowSelection || {}).length

  return (
    <>
      <h3 className="text-base md:text-lg font-semibold mb-4 flex items-center gap-2">
        <ClipboardDocumentListIcon className="h-5 w-5 text-indigo-600" />
        4. Pilih Nota Yang Akan Digaji
      </h3>

      <div className="md:hidden space-y-3">
        {props.notas.map((nota, index) => {
          const isPaid = String(nota?.statusGajian || '').toUpperCase() === 'DIPROSES'
          const isSelected = !!(props.rowSelection as any)[index]
          return (
            <div
              key={`nota-card-${nota.id}`}
              onClick={() => {
                if (isPaid) return
                props.setRowSelection((prev: any) => {
                  const next = { ...prev }
                  if (next[index]) delete next[index]
                  else next[index] = true
                  return next
                })
              }}
              className={`rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-3 transition-colors ${isSelected ? 'ring-2 ring-emerald-500' : 'hover:bg-gray-50/50'} ${isPaid ? 'opacity-90' : ''}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="font-semibold text-gray-900">{nota.kendaraan?.platNomor || '-'}</div>
                  {isPaid ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[10px] font-semibold">
                      Sudah Digaji
                    </span>
                  ) : null}
                  <div className="text-xs text-gray-500">{nota.supir?.name || '-'}</div>
                  <div className="text-xs text-gray-500">{nota.timbangan?.kebun?.name || nota.kebun?.name || '-'}</div>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={isSelected}
                    disabled={isPaid}
                    onCheckedChange={(v) => {
                      props.setRowSelection((prev: any) => {
                        const next = { ...prev }
                        if (v) next[index] = true
                        else delete next[index]
                        return next
                      })
                    }}
                    aria-label="Pilih nota"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-gray-400">Tanggal Bongkar</div>
                  <div className="font-medium text-gray-800">{nota.tanggalBongkar ? props.formatDate(new Date(nota.tanggalBongkar)) : '-'}</div>
                </div>
                <div>
                  <div className="text-gray-400">Netto (Kg)</div>
                  <div className="font-semibold text-gray-900">
                    {typeof props.getNotaNetto(nota) === 'number' ? props.formatNumber(props.getNotaNetto(nota) as number) : '-'}
                  </div>
                </div>
                <div>
                  <div className="text-gray-400">Potongan</div>
                  <div className="font-semibold text-red-600">{props.formatNumber(nota.potongan || 0)}</div>
                </div>
                <div>
                  <div className="text-gray-400">Berat Akhir</div>
                  <div className="font-semibold text-gray-900">{props.formatNumber(nota.beratAkhir || 0)}</div>
                </div>
              </div>
            </div>
          )
        })}

        <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-gray-700">Jumlah Netto</span>
            <span className="font-semibold text-gray-900">
              {props.formatNumber(props.notas.reduce((sum, n) => sum + (Number(props.getNotaNetto(n)) || 0), 0))} Kg
            </span>
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="font-semibold text-red-600">Jumlah Potongan</span>
            <span className="font-semibold text-red-600">{props.formatNumber(props.notas.reduce((sum, n) => sum + (Number(n.potongan) || 0), 0))} Kg</span>
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="font-semibold text-gray-700">Jumlah Berat Akhir</span>
            <span className="font-semibold text-gray-900">{props.formatNumber(props.notas.reduce((sum, n) => sum + (Number(n.beratAkhir) || 0), 0))} Kg</span>
          </div>
        </div>
      </div>

      <div className="hidden md:block">
        <DataTable columns={props.columns} data={props.notas} rowSelection={props.rowSelection} setRowSelection={props.setRowSelection} />
      </div>

      <div className="mt-4 text-xs md:text-sm text-gray-700">
        Total nota ditemukan: {props.totalNotas} • Ditampilkan: {props.notas.length}
        {props.totalNotas > props.notas.length ? ` (dibatasi ${props.notaFetchLimit} data)` : ''}
      </div>

      <div className="flex flex-col md:flex-row justify-end mt-6 gap-4">
        {selectedCount > 0 ? (
          <Button onClick={props.onClearSelection} variant="secondary" className="w-full md:w-auto h-auto min-h-[40px] px-3 py-2 text-sm md:text-base whitespace-normal break-words">
            Batalkan Pilihan ({selectedCount})
          </Button>
        ) : null}

        <Button
          onClick={props.onMoveToProcess}
          disabled={!props.canProcessNota}
          className={cn(
            'w-full md:w-auto h-auto min-h-[40px] px-3 py-2 text-sm md:text-base whitespace-normal break-words border rounded-xl',
            props.canProcessNota ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600' : 'border-gray-300 bg-gray-50 text-gray-400',
          )}
        >
          5. Proses Nota Terpilih <ArrowRightIcon className="ml-2 h-4 w-4 flex-shrink-0" />
        </Button>
      </div>
    </>
  )
}
