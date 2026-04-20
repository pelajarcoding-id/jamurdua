'use client'

import { ClipboardDocumentListIcon } from '@heroicons/react/24/outline'
import { cn } from '@/lib/utils'

export type NotaSawitSummaryData = {
  totalBerat: number
  totalPembayaran: number
  totalNota: number
  lunasCount: number
  totalPembayaranLunas: number
  belumLunasCount: number
  totalPembayaranBelumLunas: number
  tonaseByKebun?: Array<{ kebunId: number; name: string; totalBerat: number }>
}

export function NotaSawitSummary(props: {
  summary: NotaSawitSummaryData
  role: string
  dateDisplay: string
  formatNumber: (value: number) => string
  formatCurrency: (value: number) => string
}) {
  return (
    <div className="mb-8">
      <div className="card-style p-4 rounded-2xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <ClipboardDocumentListIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Ringkasan Nota Sawit</p>
              <p className="text-xs text-gray-500">Status pembayaran dan total tonase</p>
            </div>
          </div>
          <div className="text-xs text-gray-500">
            <span className="whitespace-nowrap">Periode: </span>
            <span className="font-semibold text-gray-900 whitespace-nowrap">{props.dateDisplay}</span>
          </div>
        </div>
        <div
          className={cn(
            'mt-4 grid gap-3 items-stretch',
            props.role !== 'SUPIR' ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2',
          )}
        >
          <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/80 to-white p-3 h-full flex flex-col">
            <div className="text-xs font-semibold text-emerald-700 whitespace-nowrap">Total Nota</div>
            <div
              className="mt-0.5 text-xl font-extrabold text-gray-900 tabular-nums whitespace-nowrap"
              title={props.summary.totalNota.toLocaleString('id-ID')}
            >
              {props.summary.totalNota.toLocaleString('id-ID')}
            </div>
            {props.role !== 'SUPIR' ? (
              <div className="mt-1 text-[11px] text-gray-600 whitespace-nowrap">
                Nota dibayar:{' '}
                <span className="font-semibold text-gray-900">{props.summary.lunasCount.toLocaleString('id-ID')}</span> • Nota belum dibayar:{' '}
                <span className="font-semibold text-gray-900">{props.summary.belumLunasCount.toLocaleString('id-ID')}</span>
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50/80 to-white p-3 h-full flex flex-col">
            <div className="text-xs font-semibold text-amber-700 whitespace-nowrap">Total Tonase</div>
            <div
              className="mt-0.5 text-xl font-extrabold text-gray-900 tabular-nums whitespace-nowrap"
              title={`${props.summary.totalBerat.toLocaleString('id-ID')} Kg`}
            >
              {props.summary.totalBerat.toLocaleString('id-ID')}{' '}
              <span className="text-sm font-semibold text-gray-500">Kg</span>
            </div>
            <div className="mt-1 space-y-1">
              {Array.isArray(props.summary.tonaseByKebun) && props.summary.tonaseByKebun.length > 0 ? (
                <div className="max-h-24 overflow-y-auto pr-1 space-y-1">
                  {props.summary.tonaseByKebun.map((r) => (
                    <div key={String(r.kebunId)} className="flex items-center justify-between gap-2 text-[11px] text-gray-600">
                      <div className="min-w-0 truncate">{r.name}</div>
                      <div className="font-semibold text-gray-900 tabular-nums whitespace-nowrap">
                        {props.formatNumber(Number(r.totalBerat || 0))} Kg
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[11px] text-gray-600 whitespace-nowrap">Berat akhir nota</div>
              )}
            </div>
          </div>

          {props.role !== 'SUPIR' ? (
            <div className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50/80 to-white p-3 h-full flex flex-col">
              <div className="text-xs font-semibold text-sky-700 whitespace-nowrap">Pembayaran</div>
              <div
                className="mt-0.5 text-lg font-extrabold text-gray-900 tabular-nums whitespace-nowrap"
                title={props.formatCurrency(props.summary.totalPembayaran)}
              >
                {props.formatCurrency(props.summary.totalPembayaran)}
              </div>
              <div className="mt-1 grid grid-cols-1 gap-2">
                <div className="rounded-xl border border-sky-100 bg-white/70 px-3 py-1.5 min-w-0">
                  <div className="text-[11px] font-semibold text-sky-700 whitespace-nowrap">Nota Sawit Lunas</div>
                  <div
                    className="text-sm font-extrabold text-gray-900 tabular-nums whitespace-nowrap truncate leading-tight"
                    title={props.formatCurrency(props.summary.totalPembayaranLunas)}
                  >
                    {props.formatCurrency(props.summary.totalPembayaranLunas)}
                  </div>
                </div>
                <div className="rounded-xl border border-sky-100 bg-white/70 px-3 py-1.5 min-w-0">
                  <div className="text-[11px] font-semibold text-sky-700 whitespace-nowrap">Nota Sawit Belum Lunas</div>
                  <div
                    className="text-sm font-extrabold text-gray-900 tabular-nums whitespace-nowrap truncate leading-tight"
                    title={props.formatCurrency(props.summary.totalPembayaranBelumLunas)}
                  >
                    {props.formatCurrency(props.summary.totalPembayaranBelumLunas)}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

