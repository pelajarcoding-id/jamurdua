'use client'

import { ClipboardDocumentListIcon, TrashIcon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DataTable } from '@/components/data-table'

export function GajianProcessNotasSection(props: {
  startDate?: Date
  endDate?: Date
  formatDate: (d: Date) => string
  formatNumber: (n: number) => string
  summaryData: { totalBerat: number; totalHari: number; totalNota: number }
  notasToProcess: any[]
  processingColumns: any
  onRemoveFromProcess: (notaId: number) => void
  onKeteranganChange: (notaId: number, value: string) => void
}) {
  if (!props.notasToProcess || props.notasToProcess.length === 0) return null

  return (
    <>
      <div className="mb-6">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <ClipboardDocumentListIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Ringkasan Proses Gajian</p>
                <p className="text-xs text-gray-500">Total tonase, hari, dan jumlah nota</p>
              </div>
            </div>
            <div className="text-xs text-gray-500">
              Periode:{' '}
              <span className="font-semibold text-gray-900">
                {props.startDate && props.endDate ? `${props.formatDate(props.startDate)} - ${props.formatDate(props.endDate)}` : '-'}
              </span>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl bg-emerald-50/60 px-3 py-2">
              <p className="text-xs text-emerald-700">Total Tonase (Netto)</p>
              <p className="text-lg font-semibold text-gray-900">{props.formatNumber(props.summaryData.totalBerat)} Kg</p>
            </div>
            <div className="rounded-xl bg-amber-50/70 px-3 py-2">
              <p className="text-xs text-amber-700">Total Hari</p>
              <p className="text-lg font-semibold text-gray-900">{props.summaryData.totalHari}</p>
            </div>
            <div className="rounded-xl bg-sky-50/70 px-3 py-2">
              <p className="text-xs text-sky-700">Jumlah Nota</p>
              <p className="text-lg font-semibold text-gray-900">{props.summaryData.totalNota}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="md:hidden space-y-3">
        {props.notasToProcess.map((nota) => (
          <div key={`process-${nota.id}`} className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="font-semibold text-gray-900">{nota.kendaraan?.platNomor || '-'}</div>
                <div className="text-xs text-gray-500">{nota.supir?.name || '-'}</div>
                <div className="text-xs text-gray-500">{nota.timbangan?.kebun?.name || nota.kebun?.name || '-'}</div>
              </div>
              <Button
                variant="ghost"
                className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                onClick={() => props.onRemoveFromProcess(Number(nota.id))}
              >
                <span className="sr-only">Hapus Nota</span>
                <TrashIcon className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-gray-400">Tanggal Bongkar</div>
                <div className="font-medium text-gray-800">
                  {nota.tanggalBongkar ? props.formatDate(new Date(nota.tanggalBongkar)) : '-'}
                </div>
              </div>
              <div>
                <div className="text-gray-400">Berat Akhir</div>
                <div className="font-semibold text-gray-900">{props.formatNumber(nota.beratAkhir || 0)} Kg</div>
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1">Keterangan</div>
              <Input
                value={nota.keterangan || ''}
                onChange={(e) => props.onKeteranganChange(Number(nota.id), e.target.value)}
                placeholder="Keterangan..."
                className="h-9"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="hidden md:block">
        <DataTable columns={props.processingColumns} data={props.notasToProcess} rowSelection={{}} setRowSelection={() => {}} />
      </div>
    </>
  )
}
