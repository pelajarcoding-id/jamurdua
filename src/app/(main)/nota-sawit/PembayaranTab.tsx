import React from 'react'
import { ArrowPathIcon, ClipboardDocumentListIcon, PlusIcon } from '@heroicons/react/24/outline'
import { CalendarIcon } from '@heroicons/react/24/solid'

import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/data-table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

type ListOption = { id: number; name: string }

export function PembayaranTab(props: {
  role: string
  fetchReconcileHistory: () => void
  reconcileHistoryLoading: boolean
  reconcileHistorySoftLoading: boolean
  handleOpenBulkReconcileEmpty: () => void
  pembayaranSearch: string
  setPembayaranSearch: (v: string) => void
  setReconcileHistoryPage: (v: number | ((p: number) => number)) => void
  pembayaranPabrikId: string
  setPembayaranPabrikId: (v: string) => void
  pabrikList: ListOption[]
  pembayaranKebunId: string
  setPembayaranKebunId: (v: string) => void
  kebunList: ListOption[]
  pembayaranDateDisplay: string
  pembayaranStartDate?: Date
  pembayaranEndDate?: Date
  pembayaranQuickRange: string
  applyPembayaranQuickRange: (val: string) => void
  toWibYmd: (dt?: Date) => string
  wibStartFromYmd: (ymd: string) => Date
  wibEndFromYmd: (ymd: string) => Date
  setPembayaranStartDate: (d: Date | undefined) => void
  setPembayaranEndDate: (d: Date | undefined) => void
  setPembayaranQuickRange: (v: string) => void
  pembayaranColumns: any[]
  reconcileHistory: any[]
  setReconcileDetail: (b: any) => void
  setIsReconcileDetailOpen: (v: boolean) => void
  reconcileHistoryPage: number
  reconcileHistoryLimit: number
  reconcileHistoryTotal: number
  setReconcileHistoryLimit: (v: number) => void
  formatNumber: (n: number) => string
  formatCurrency: (n: number) => string
}) {
  const {
    role,
    fetchReconcileHistory,
    reconcileHistoryLoading,
    reconcileHistorySoftLoading,
    handleOpenBulkReconcileEmpty,
    pembayaranSearch,
    setPembayaranSearch,
    setReconcileHistoryPage,
    pembayaranPabrikId,
    setPembayaranPabrikId,
    pabrikList,
    pembayaranKebunId,
    setPembayaranKebunId,
    kebunList,
    pembayaranDateDisplay,
    pembayaranStartDate,
    pembayaranEndDate,
    pembayaranQuickRange,
    applyPembayaranQuickRange,
    toWibYmd,
    wibStartFromYmd,
    wibEndFromYmd,
    setPembayaranStartDate,
    setPembayaranEndDate,
    setPembayaranQuickRange,
    pembayaranColumns,
    reconcileHistory,
    setReconcileDetail,
    setIsReconcileDetailOpen,
    reconcileHistoryPage,
    reconcileHistoryLimit,
    reconcileHistoryTotal,
    setReconcileHistoryLimit,
    formatNumber,
    formatCurrency,
  } = props

  if (role === 'SUPIR') {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center text-sm text-gray-500">
        Menu pembayaran tidak tersedia untuk role SUPIR.
      </div>
    )
  }

  return (
    <div className="card-style p-4 rounded-2xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
            <ClipboardDocumentListIcon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Pembayaran Nota Sawit</p>
            <p className="text-xs text-gray-500">Riwayat rekonsiliasi pembayaran (batch transfer)</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => fetchReconcileHistory()}
            disabled={reconcileHistoryLoading || reconcileHistorySoftLoading}
          >
            <ArrowPathIcon
              className={cn(
                'w-4 h-4 mr-2',
                reconcileHistoryLoading || reconcileHistorySoftLoading ? 'animate-spin' : ''
              )}
            />
            Refresh
          </Button>
          <Button onClick={handleOpenBulkReconcileEmpty} className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white">
            <PlusIcon className="w-4 h-4 mr-2" />
            Pembayaran
          </Button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase text-gray-500">Cari</Label>
          <div className="relative">
            <Input
              value={pembayaranSearch}
              onChange={(e) => {
                setPembayaranSearch(e.target.value)
                setReconcileHistoryPage(1)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setReconcileHistoryPage(1)
                }
              }}
              placeholder="Cari batch / pabrik / kebun..."
              className="rounded-xl h-10 pr-10"
              disabled={reconcileHistoryLoading}
            />
            {reconcileHistorySoftLoading ? (
              <ArrowPathIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />
            ) : null}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase text-gray-500">Pabrik</Label>
          <select
            value={pembayaranPabrikId}
            onChange={(e) => {
              setPembayaranPabrikId(e.target.value)
              setReconcileHistoryPage(1)
            }}
            className="w-full input-style rounded-xl border-gray-200 h-10"
            disabled={reconcileHistoryLoading}
          >
            <option value="">Semua Pabrik</option>
            {pabrikList.map((pabrik) => (
              <option key={pabrik.id} value={pabrik.id}>
                {pabrik.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase text-gray-500">Kebun</Label>
          <select
            value={pembayaranKebunId}
            onChange={(e) => {
              setPembayaranKebunId(e.target.value)
              setReconcileHistoryPage(1)
            }}
            className="w-full input-style rounded-xl border-gray-200 h-10"
            disabled={reconcileHistoryLoading}
          >
            <option value="">Semua Kebun</option>
            {kebunList.map((kebun: any) => (
              <option key={kebun.id} value={kebun.id}>
                {kebun.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase text-gray-500">Periode</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="pembayaran-date"
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal bg-white rounded-xl h-10',
                  !pembayaranStartDate && 'text-muted-foreground'
                )}
                disabled={reconcileHistoryLoading}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {pembayaranDateDisplay}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-4 bg-white" align="start">
              <div className="space-y-4">
                <div className="space-y-2">
                  <h4 className="font-medium leading-none">Periode</h4>
                  <p className="text-sm text-muted-foreground">Pilih periode cepat atau rentang waktu</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      applyPembayaranQuickRange('all')
                      setReconcileHistoryPage(1)
                    }}
                    className={pembayaranQuickRange === 'all' ? 'bg-accent' : ''}
                  >
                    Semua
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      applyPembayaranQuickRange('today')
                      setReconcileHistoryPage(1)
                    }}
                    className={pembayaranQuickRange === 'today' ? 'bg-accent' : ''}
                  >
                    Hari Ini
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      applyPembayaranQuickRange('this_week')
                      setReconcileHistoryPage(1)
                    }}
                    className={pembayaranQuickRange === 'this_week' ? 'bg-accent' : ''}
                  >
                    Minggu Ini
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      applyPembayaranQuickRange('this_month')
                      setReconcileHistoryPage(1)
                    }}
                    className={pembayaranQuickRange === 'this_month' ? 'bg-accent' : ''}
                  >
                    Bulan Ini
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      applyPembayaranQuickRange('this_year')
                      setReconcileHistoryPage(1)
                    }}
                    className={pembayaranQuickRange === 'this_year' ? 'bg-accent' : ''}
                  >
                    Tahun Ini
                  </Button>
                </div>
                <div className="border-t pt-4 space-y-2">
                  <h4 className="font-medium leading-none">Rentang Waktu</h4>
                  <div className="grid gap-2">
                    <div className="grid grid-cols-3 items-center gap-4">
                      <Label htmlFor="pembayaran-start-date" className="text-xs">
                        Dari
                      </Label>
                      <Input
                        id="pembayaran-start-date"
                        type="date"
                        className="col-span-2 h-8"
                        value={pembayaranStartDate ? toWibYmd(pembayaranStartDate) : ''}
                        onChange={(e) => {
                          setPembayaranStartDate(e.target.value ? wibStartFromYmd(e.target.value) : undefined)
                          setPembayaranQuickRange('custom')
                          setReconcileHistoryPage(1)
                        }}
                      />
                    </div>
                    <div className="grid grid-cols-3 items-center gap-4">
                      <Label htmlFor="pembayaran-end-date" className="text-xs">
                        Sampai
                      </Label>
                      <Input
                        id="pembayaran-end-date"
                        type="date"
                        className="col-span-2 h-8"
                        value={pembayaranEndDate ? toWibYmd(pembayaranEndDate) : ''}
                        onChange={(e) => {
                          setPembayaranEndDate(e.target.value ? wibEndFromYmd(e.target.value) : undefined)
                          setPembayaranQuickRange('custom')
                          setReconcileHistoryPage(1)
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="mt-4">
        <DataTable
          columns={pembayaranColumns}
          data={reconcileHistory}
          isLoading={reconcileHistoryLoading}
          meta={{
            onRowClick: (b: any) => {
              setReconcileDetail(b)
              setIsReconcileDetailOpen(true)
            },
          }}
          renderMobileCards={({ data, isLoading }) => {
            if (isLoading) {
              return (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-44" />
                      <Skeleton className="h-4 w-36" />
                    </div>
                  ))}
                </div>
              )
            }
            if (!data || data.length === 0) {
              return (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center text-sm text-gray-500">
                  Belum ada riwayat rekonsiliasi.
                </div>
              )
            }
            return (
              <div className="space-y-3">
                {(data as any[]).map((b) => {
                  const selisih = Number(b?.selisih || 0)
                  return (
                    <div
                      key={String(b?.id)}
                      className="rounded-2xl border border-gray-100 bg-white p-4 hover:bg-gray-50/50 transition-colors cursor-pointer"
                      onClick={() => {
                        setReconcileDetail(b)
                        setIsReconcileDetailOpen(true)
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-extrabold text-gray-900">Batch #{b?.id}</div>
                          <div className="text-xs text-gray-500 truncate">
                            {b?.tanggal
                              ? new Date(b.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
                              : '-'}{' '}
                            • {b?.pabrikSawit?.name || '-'}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-500">Nota</div>
                          <div className="text-sm font-extrabold text-gray-900 tabular-nums">{formatNumber(Number(b?.count || 0))}</div>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-xl bg-gray-50 px-3 py-2 border border-gray-100">
                          <div className="text-gray-500">Jumlah Tagihan Nota</div>
                          <div className="font-extrabold text-gray-900 tabular-nums">{formatCurrency(Number(b?.totalTagihan || 0))}</div>
                        </div>
                        <div className="rounded-xl bg-gray-50 px-3 py-2 border border-gray-100">
                          <div className="text-gray-500">Jumlah Ditransfer</div>
                          <div className="font-extrabold text-gray-900 tabular-nums">{formatCurrency(Number(b?.jumlahMasuk || 0))}</div>
                        </div>
                      </div>

                      <div className="mt-2 flex items-center justify-between text-xs">
                        <div className="text-gray-500">Selisih</div>
                        <div
                          className={cn(
                            'font-extrabold tabular-nums',
                            selisih === 0 ? 'text-emerald-700' : selisih > 0 ? 'text-emerald-700' : 'text-rose-700'
                          )}
                        >
                          {formatCurrency(selisih)}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          }}
        />
      </div>

      <div className="mt-4 flex flex-col sm:flex-row items-center justify-center sm:justify-between gap-3">
        <div className="text-sm text-gray-500">
          Menampilkan{' '}
          <span className="font-medium text-gray-800">
            {Math.min((reconcileHistoryPage - 1) * reconcileHistoryLimit + 1, reconcileHistoryTotal || 0)}
          </span>{' '}
          -{' '}
          <span className="font-medium text-gray-800">
            {Math.min(reconcileHistoryPage * reconcileHistoryLimit, reconcileHistoryTotal || 0)}
          </span>{' '}
          dari <span className="font-medium text-gray-800">{formatNumber(reconcileHistoryTotal || 0)}</span> batch
        </div>
        <div className="flex items-center gap-2">
          <select
            className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition-colors"
            value={reconcileHistoryLimit}
            onChange={(e) => {
              const next = Number(e.target.value)
              setReconcileHistoryLimit(next)
              setReconcileHistoryPage(1)
            }}
            title="Per halaman"
            disabled={reconcileHistoryLoading}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>
          <button
            onClick={() => setReconcileHistoryPage((p) => Math.max(1, p - 1))}
            disabled={reconcileHistoryPage <= 1 || reconcileHistoryLoading}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Sebelumnya
          </button>
          <button
            onClick={() => setReconcileHistoryPage((p) => p + 1)}
            disabled={reconcileHistoryLoading || reconcileHistoryPage * reconcileHistoryLimit >= reconcileHistoryTotal}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Berikutnya
          </button>
        </div>
      </div>
    </div>
  )
}

