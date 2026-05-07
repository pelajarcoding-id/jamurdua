'use client'

import { useMemo } from 'react'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { CheckCircleIcon, ChevronLeftIcon, ChevronRightIcon, XMarkIcon, CheckBadgeIcon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/button'
import { User, AttendanceRecord } from '../../types'

interface AbsensiCalendarProps {
  selectedUser: User | null
  absenMonth: Date
  setAbsenMonth: (d: Date) => void
  totals: {
    totalGajiBerjalan?: number
    totalGajiDibayar?: number
    totalSaldoHutang?: number
    totalHariKerja?: number
  } | null
  formatDateKey: (d: Date) => string
  records: Record<string, AttendanceRecord>
  paidMap: Record<string, boolean>
  onCellClick: (dateKey: string, isPaid: boolean, isFilled: boolean) => void
  onClose?: () => void
}

function buildCalendarCells(
  absenMonth: Date,
  formatDateKey: (d: Date) => string,
  records: Record<string, AttendanceRecord>,
  paidMap: Record<string, boolean>,
  onCellClick: (dateKey: string, isPaid: boolean, isFilled: boolean) => void
) {
  const cells: React.ReactNode[] = []
  const firstDay = new Date(absenMonth.getFullYear(), absenMonth.getMonth(), 1)
  const startOffset = firstDay.getDay()
  for (let i = 0; i < startOffset; i++) {
    cells.push(<div key={`pad-${i}`} className="h-20 sm:h-28" />)
  }

  const daysInMonth = new Date(absenMonth.getFullYear(), absenMonth.getMonth() + 1, 0).getDate()
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(absenMonth.getFullYear(), absenMonth.getMonth(), d)
    const key = formatDateKey(date)
    const rec = records[key]
    const isOff = !!rec?.off
    const isWork = !!rec?.work
    const isPaid = !!paidMap[key]
    const isFilled = !!rec || isPaid
    const parseNominal = (s: string) => Number(s.replace(/\D/g, '')) || 0
    const base = parseNominal(rec?.amount || '')
    const hourlyTotal = rec?.useHourly
      ? Math.round((parseFloat((rec?.hour || '').replace(',', '.')) || 0) * parseNominal(rec?.rate || ''))
      : 0
    const meal = rec?.mealEnabled ? parseNominal(rec?.mealAmount || '') : 0
    const amount = base + hourlyTotal + meal

    let cellClass = 'bg-white border border-gray-100 text-gray-900'
    let labelText: string | null = null
    let labelClass = ''
    let amountClass = 'text-gray-900'
    let iconColor = 'text-gray-400'

    if (isOff) {
      cellClass = 'bg-red-50 border border-red-100 text-red-600'
      labelText = 'LIBUR'
      labelClass = 'text-red-600'
      iconColor = 'text-red-400'
    } else if (isPaid) {
      cellClass = 'bg-purple-50 border border-purple-100 text-purple-700'
      labelText = 'MASUK KERJA'
      labelClass = 'text-purple-700'
      amountClass = 'text-purple-700'
      iconColor = 'text-purple-500'
    } else if (amount > 0 || isWork) {
      cellClass = 'bg-emerald-50 border border-emerald-100 text-emerald-700'
      labelText = 'MASUK KERJA'
      labelClass = 'text-emerald-700'
      amountClass = 'text-emerald-700'
      iconColor = 'text-emerald-500'
    }

    cells.push(
      <button
        key={key}
        onClick={() => onCellClick(key, isPaid, isFilled)}
        className={`h-20 sm:h-28 rounded-xl p-2.5 sm:p-3 text-left transition-all hover:shadow-md active:scale-[0.98] relative group ${cellClass}`}
      >
        <div className="flex justify-between items-start">
          <span className="text-xs sm:text-sm font-bold">{d}</span>
          {isFilled && <CheckCircleIcon className={`w-3.5 h-3.5 ${iconColor}`} />}
        </div>

        <div className="mt-1 space-y-0.5">
          {labelText && (
            <span className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wide block ${labelClass}`}>{labelText}</span>
          )}
          {amount > 0 && (
            <span className={`text-[10px] sm:text-xs font-bold leading-tight block ${amountClass}`}>Rp {amount.toLocaleString('id-ID')}</span>
          )}
        </div>
      </button>
    )
  }
  return cells
}

export function AbsensiCalendar({
  selectedUser,
  absenMonth,
  setAbsenMonth,
  totals,
  formatDateKey,
  records,
  paidMap,
  onCellClick,
  onClose,
}: AbsensiCalendarProps) {
  const cells = useMemo(
    () => buildCalendarCells(absenMonth, formatDateKey, records, paidMap, onCellClick),
    [absenMonth, formatDateKey, records, paidMap, onCellClick]
  )

  const { jamBelumDibayar, jamSudahDibayar, totalJamKerja } = useMemo(() => {
    let belum = 0
    let sudah = 0
    Object.entries(records).forEach(([key, rec]) => {
      if (rec.useHourly) {
        const jam = parseFloat((rec.hour || '').replace(',', '.')) || 0
        if (paidMap[key]) {
          sudah += jam
        } else {
          belum += jam
        }
      }
    })
    return { jamBelumDibayar: belum, jamSudahDibayar: sudah, totalJamKerja: belum + sudah }
  }, [records, paidMap])

  if (!selectedUser) return null

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="px-1 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-gray-900 flex items-center justify-center text-white text-sm font-bold shrink-0">
            {selectedUser.photoUrl ? (
              <img src={selectedUser.photoUrl} alt={selectedUser.name} className="w-full h-full object-cover rounded-full" />
            ) : (
              selectedUser.name.charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900 capitalize">{selectedUser.name}</h3>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Kalender Absensi - {format(absenMonth, 'MMMM yyyy', { locale: idLocale })}</p>
          </div>
        </div>

        {onClose && (
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full h-9 px-4 text-xs font-semibold text-gray-500 hover:text-gray-900 hover:bg-gray-100"
            onClick={onClose}
          >
            <XMarkIcon className="w-4 h-4 mr-1" />
            Tutup Kalender
          </Button>
        )}
      </div>

      {/* Summary Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 sm:px-6 py-4 flex items-center justify-between border-b border-gray-50">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckBadgeIcon className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-gray-900">Ringkasan Absensi</h4>
              <p className="text-[10px] text-gray-500">Rekap hari kerja dan biaya</p>
            </div>
          </div>
          <div className="text-xs text-gray-500">
            Periode: <span className="font-semibold text-gray-900">{format(absenMonth, 'MMMM yyyy', { locale: idLocale })}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 divide-x divide-gray-100">
          <div className="px-5 py-4">
            <p className="text-[11px] font-medium text-emerald-600 mb-1">Hari Kerja</p>
            <p className="text-xl font-bold text-gray-900">{totals?.totalHariKerja || 0} <span className="text-sm font-semibold text-gray-500">Hari</span></p>
          </div>
          <div className="px-5 py-4">
            <p className="text-[11px] font-medium text-indigo-600 mb-1">Jam Kerja (Belum Dibayar)</p>
            <p className="text-xl font-bold text-gray-900">{jamBelumDibayar} <span className="text-sm font-semibold text-gray-500">Jam</span></p>
          </div>
          <div className="px-5 py-4">
            <p className="text-[11px] font-medium text-violet-600 mb-1">Jam Kerja (Sudah Dibayar)</p>
            <p className="text-xl font-bold text-gray-900">{jamSudahDibayar} <span className="text-sm font-semibold text-gray-500">Jam</span></p>
          </div>
          <div className="px-5 py-4">
            <p className="text-[11px] font-medium text-amber-600 mb-1">Total Jam Kerja</p>
            <p className="text-xl font-bold text-gray-900">{totalJamKerja} <span className="text-sm font-semibold text-gray-500">Jam</span></p>
          </div>
          <div className="px-5 py-4">
            <p className="text-[11px] font-medium text-sky-600 mb-1">Gaji Berjalan</p>
            <p className="text-xl font-bold text-gray-900">Rp {(totals?.totalGajiBerjalan || 0).toLocaleString('id-ID')}</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-[11px] font-medium text-rose-600 mb-1">Saldo Hutang</p>
            <p className="text-xl font-bold text-gray-900">Rp {(totals?.totalSaldoHutang || 0).toLocaleString('id-ID')}</p>
          </div>
        </div>
      </div>

      {/* Calendar Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-2 px-3 pt-3 pb-1">
          {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map((day) => (
            <div key={day} className="py-2 text-center font-semibold text-gray-400 uppercase tracking-wider text-[10px]">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-2 p-3 bg-white">
          {cells}
        </div>
      </div>
    </div>
  )
}
