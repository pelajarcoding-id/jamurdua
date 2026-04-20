'use client'

import { BanknotesIcon, StarIcon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type KebunOption = { id: number; name: string }

export function GajianCreateSection(props: {
  editingGajianId: number | null
  refreshingData: boolean
  loading: boolean
  boronganLoading: boolean
  onRefreshDraftData: () => void

  kebunId: string
  kebunList: KebunOption[]
  onKebunIdChange: (id: string) => void

  startDateYmd: string
  endDateYmd: string
  onStartDateYmdChange: (ymd: string) => void
  onEndDateYmdChange: (ymd: string) => void

  onFetchNotas: () => void
  canSearchNota: boolean
  hasDraftConflict: boolean

  draftConflictId: number | null
  onContinueDraft: (id: number) => void
  onDeleteDraft: (id: number) => void
}) {
  return (
    <div className="bg-white p-4 md:p-6 rounded-lg shadow-md">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-3">
        <div className="w-full flex flex-col gap-1">
          <h2 className="text-lg md:text-xl font-semibold flex items-center gap-2">
            <BanknotesIcon className="h-5 w-5 text-blue-600" />
            {props.editingGajianId ? 'Edit Gajian Draft' : 'Buat Gajian Baru'}
          </h2>
          <div className="hidden md:flex items-center gap-2 text-xs text-gray-500">
            <StarIcon className="h-4 w-4 text-red-600" />
            <span>Pilih kebun dan periode gajian terlebih dahulu sebelum mengambil nota.</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {props.editingGajianId ? (
            <Button
              onClick={(e) => {
                e.stopPropagation()
                props.onRefreshDraftData()
              }}
              variant="outline"
              disabled={props.refreshingData || props.loading || props.boronganLoading}
              className="w-full md:w-auto h-9 md:h-10 px-3 md:px-4 text-sm md:text-base whitespace-nowrap"
            >
              {props.refreshingData ? 'Memperbarui...' : 'Perbarui Data'}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="transition-all duration-300 overflow-hidden opacity-100">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start md:items-end mb-6">
          <div className="lg:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">1. Pilih Kebun</label>
            <Select onValueChange={props.onKebunIdChange} value={props.kebunId}>
              <SelectTrigger className="input-style rounded-xl">
                <SelectValue placeholder="Pilih Kebun">
                  {props.kebunId ? props.kebunList.find((k) => String(k.id) === props.kebunId)?.name : 'Pilih Kebun'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {props.kebunList.map((kebun) => (
                  <SelectItem key={kebun.id} value={String(kebun.id)}>
                    {kebun.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="lg:col-span-2 w-full">
            <label className="block text-sm font-medium text-gray-700 mb-1">2. Pilih Periode</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
              <Input
                className="input-style rounded-xl w-full min-w-0"
                type="date"
                value={props.startDateYmd}
                onChange={(e) => props.onStartDateYmdChange(e.target.value)}
              />
              <Input
                className="input-style rounded-xl w-full min-w-0"
                type="date"
                value={props.endDateYmd}
                onChange={(e) => props.onEndDateYmdChange(e.target.value)}
              />
            </div>
          </div>

          <Button
            onClick={props.onFetchNotas}
            disabled={!props.canSearchNota || props.hasDraftConflict}
            className={cn(
              'w-full rounded-xl lg:col-span-1 h-auto min-h-[40px] px-3 py-2 text-sm md:text-base whitespace-normal break-words border',
              props.canSearchNota && !props.hasDraftConflict
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                : 'border-gray-300 bg-gray-50 text-gray-400',
            )}
          >
            {props.loading ? 'Mencari...' : '3. Cari Nota'}
          </Button>
        </div>

        <div className="md:hidden flex items-center gap-2 text-xs text-gray-500 mb-4">
          <StarIcon className="h-4 w-4 text-red-600" />
          <span>Pilih kebun dan periode gajian terlebih dahulu sebelum mengambil nota.</span>
        </div>

        {props.hasDraftConflict ? (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
            <div className="text-sm font-semibold text-amber-900">Draft gajian untuk periode ini sudah ada.</div>
            <div className="text-xs text-amber-800 mt-1">Hapus draft terlebih dahulu atau lanjutkan draft yang sudah ada.</div>
            <div className="mt-3 flex flex-col sm:flex-row gap-2">
              <Button
                onClick={() => props.draftConflictId && props.onContinueDraft(props.draftConflictId)}
                className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Lanjutkan Draft
              </Button>
              <Button
                variant="outline"
                onClick={() => props.draftConflictId && props.onDeleteDraft(props.draftConflictId)}
                className="rounded-full border-emerald-300 text-emerald-900 hover:bg-emerald-50"
              >
                Hapus Draft
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

