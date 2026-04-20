'use client'

import { ArrowDownTrayIcon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/button'

export function NotaSawitBulkActionsBar(props: {
  selectedCount: number
  totalBeratAkhir: number
  role: string
  onDelete: () => void
  onUpdateHarga: () => void
  onExportPdf: () => void
}) {
  if (props.selectedCount <= 0) return null

  return (
    <div className="mb-6 p-4 bg-blue-50 rounded-2xl border border-blue-100 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
      <span className="text-sm font-semibold text-blue-700 sm:mr-2">{props.selectedCount} terpilih:</span>
      <span className="text-sm font-semibold text-blue-700 sm:mr-2 whitespace-nowrap">
        Berat Akhir: {new Intl.NumberFormat('id-ID').format(Math.round(Number(props.totalBeratAkhir || 0)))} kg
      </span>
      {props.role !== 'SUPIR' ? (
        <>
          <Button variant="destructive" onClick={props.onDelete} className="rounded-full w-full sm:w-auto">
            Hapus
          </Button>
          <Button onClick={props.onUpdateHarga} className="rounded-full w-full sm:w-auto">
            Update Harga
          </Button>
        </>
      ) : null}
      <Button variant="destructive" onClick={props.onExportPdf} className="inline-flex items-center gap-2 rounded-full w-full sm:w-auto">
        <ArrowDownTrayIcon className="w-4 h-4" />
        Ekspor PDF
      </Button>
    </div>
  )
}

