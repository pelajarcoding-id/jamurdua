'use client'

import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/button'

export function KaryawanHeader(props: {
  refreshing: boolean
  onRefresh: () => void
  onAdd: () => void
}) {
  return (
    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mb-4">
      <div>
        <h1 className="text-2xl font-bold">Karyawan</h1>
        <p className="text-sm text-gray-500 mt-1">Untuk pekerja yang dikelola absensi, upah, penugasan, dan hutang.</p>
      </div>
      <div className="flex flex-wrap md:flex-nowrap gap-2 w-full md:w-auto">
        <Button
          size="icon"
          variant="outline"
          className="rounded-full"
          onClick={props.onRefresh}
          title="Refresh data"
          aria-label="Refresh data"
        >
          <ArrowPathIcon className={`w-5 h-5 ${props.refreshing ? 'animate-spin' : ''}`} />
        </Button>
        <Button
          size="sm"
          className="rounded-full w-full md:w-auto whitespace-nowrap bg-emerald-600 hover:bg-emerald-700 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
          onClick={props.onAdd}
        >
          Tambah Karyawan
        </Button>
      </div>
    </div>
  )
}

