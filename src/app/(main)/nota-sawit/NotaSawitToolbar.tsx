'use client'

import { ArrowPathIcon, CalendarIcon, MagnifyingGlassIcon, PlusIcon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

type SimpleEntity = { id: number; name: string }

export function NotaSawitToolbar(props: {
  role: string
  searchDraft: string
  notaSoftLoading: boolean
  onSearchDraftChange: (value: string) => void
  onSearchSubmit: () => void

  dateDisplay: string
  quickRange: string
  onQuickRange: (key: string) => void
  startDateYmd: string
  endDateYmd: string
  onStartDateYmdChange: (ymd: string) => void
  onEndDateYmdChange: (ymd: string) => void

  selectedKebun: string
  kebunList: SimpleEntity[]
  onSelectedKebunChange: (value: string) => void

  selectedPabrik: string
  pabrikList: SimpleEntity[]
  onSelectedPabrikChange: (value: string) => void

  selectedStatus: string
  onSelectedStatusChange: (value: string) => void

  refreshing: boolean
  onRefresh: () => void
  onAddNota: () => void
}) {
  return (
    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
      <div className="grid grid-cols-2 gap-4 w-full lg:flex lg:flex-wrap lg:items-center lg:gap-3">
        <div className="col-span-2 w-full min-w-0 lg:flex-1 lg:min-w-[320px] lg:max-w-[640px]">
          <div className="relative">
            <Input
              type="text"
              placeholder="Cari semua kolom (supir, plat, pabrik, perusahaan, kebun, angka, dll)..."
              value={props.searchDraft}
              onChange={(e) => props.onSearchDraftChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') props.onSearchSubmit()
              }}
              className="input-style rounded-lg pr-10"
            />
            {props.notaSoftLoading ? (
              <ArrowPathIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />
            ) : (
              <button
                type="button"
                onClick={props.onSearchSubmit}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                aria-label="Cari"
              >
                <MagnifyingGlassIcon className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        <div className="col-span-1 w-full lg:flex-none lg:w-[260px] flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="date"
                variant="outline"
                className={cn('w-full lg:w-full justify-start text-left font-normal bg-white', !props.startDateYmd && 'text-muted-foreground')}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {props.dateDisplay}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-4 bg-white" align="start">
              <div className="space-y-4">
                <div className="space-y-2">
                  <h4 className="font-medium leading-none">Rentang Waktu</h4>
                  <p className="text-sm text-muted-foreground">Pilih rentang waktu cepat</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ['all', 'Semua'],
                    ['today', 'Hari Ini'],
                    ['yesterday', 'Kemarin'],
                    ['last_week', '7 Hari'],
                    ['last_30_days', '30 Hari'],
                    ['this_month', 'Bulan Ini'],
                    ['this_year', 'Tahun Ini'],
                  ].map(([key, label]) => (
                    <Button
                      key={key}
                      variant="outline"
                      size="sm"
                      onClick={() => props.onQuickRange(key)}
                      className={props.quickRange === key ? 'bg-accent' : ''}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                <div className="border-t pt-4 space-y-2">
                  <h4 className="font-medium leading-none">Kustom</h4>
                  <div className="grid gap-2">
                    <div className="grid grid-cols-3 items-center gap-4">
                      <Label htmlFor="start-date" className="text-xs">
                        Dari
                      </Label>
                      <Input
                        id="start-date"
                        type="date"
                        className="col-span-2 h-8"
                        value={props.startDateYmd}
                        onChange={(e) => props.onStartDateYmdChange(e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-3 items-center gap-4">
                      <Label htmlFor="end-date" className="text-xs">
                        Sampai
                      </Label>
                      <Input
                        id="end-date"
                        type="date"
                        className="col-span-2 h-8"
                        value={props.endDateYmd}
                        onChange={(e) => props.onEndDateYmdChange(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <select
          value={props.selectedKebun}
          onChange={(e) => props.onSelectedKebunChange(e.target.value)}
          className="w-full lg:flex-none lg:w-[220px] input-style rounded-lg"
        >
          <option value="">Semua Kebun</option>
          {props.kebunList.map((kebun) => (
            <option key={kebun.id} value={kebun.id}>
              {kebun.name}
            </option>
          ))}
        </select>

        <select
          value={props.selectedPabrik}
          onChange={(e) => props.onSelectedPabrikChange(e.target.value)}
          className="w-full lg:flex-none lg:w-[220px] input-style rounded-lg"
        >
          <option value="">Semua Pabrik</option>
          {props.pabrikList.map((pabrik) => (
            <option key={pabrik.id} value={pabrik.id}>
              {pabrik.name}
            </option>
          ))}
        </select>

        <select
          value={props.selectedStatus}
          onChange={(e) => props.onSelectedStatusChange(e.target.value)}
          className="col-span-1 w-full lg:flex-none lg:w-[180px] input-style rounded-lg"
        >
          <option value="">Semua Status</option>
          <option value="LUNAS">Lunas</option>
          <option value="BELUM_LUNAS">Belum Lunas</option>
        </select>

        <div className="col-span-2 w-full lg:w-auto lg:flex-none lg:ml-auto flex items-center gap-2 justify-between lg:justify-end">
          {props.role !== 'SUPIR' ? (
            <Button
              onClick={props.onAddNota}
              className="flex-1 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white justify-center lg:hidden"
              title="Tambah Nota Sawit"
            >
              <PlusIcon className="w-4 h-4 mr-2" />
              Tambah Nota Sawit
            </Button>
          ) : null}

          <Button
            onClick={props.onRefresh}
            variant="outline"
            size="icon"
            className="rounded-full shrink-0"
            title="Refresh data"
            aria-label="Refresh data"
          >
            <ArrowPathIcon className={`w-5 h-5 ${props.refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>
    </div>
  )
}

