'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import toast from 'react-hot-toast'
import { normalizeDateKey, parseThousandInt } from '@/app/(main)/kebun/utils'
import { AttendanceRecord, AttendanceDraft } from '../types'

const emptyRecord = (): AttendanceRecord => ({
  amount: '',
  work: false,
  off: false,
  note: '',
  source: null,
  useHourly: false,
  hour: '',
  rate: '',
  mealEnabled: false,
  mealAmount: '',
})

export function useAttendance(
  kebunId: number,
  absenUserId: number | null,
  absenMonth: Date,
  formatDateKey: (d: Date) => string
) {
  const [records, setRecords] = useState<Record<string, AttendanceRecord>>({})
  const [paidMap, setPaidMap] = useState<Record<string, boolean>>({})

  const [draft, setDraft] = useState<AttendanceDraft>({ ...emptyRecord(), date: '' })
  const [absenOpen, setAbsenOpen] = useState(false)
  const [openAbsenView, setOpenAbsenView] = useState(false)

  const [absenSaving, setAbsenSaving] = useState(false)
  const [isDeletingAbsen, setIsDeletingAbsen] = useState(false)
  const [openDeleteAbsenConfirm, setOpenDeleteAbsenConfirm] = useState(false)

  const formatRibuanId = useCallback((val: string) => {
    const num = val.replace(/\D/g, '')
    if (!num) return ''
    return Number(num).toLocaleString('id-ID')
  }, [])

  const loadServerData = useCallback(async () => {
    if (!kebunId || !absenUserId) {
      setRecords({})
      return
    }
    const firstDay = new Date(absenMonth.getFullYear(), absenMonth.getMonth(), 1)
    const lastDay = new Date(absenMonth.getFullYear(), absenMonth.getMonth() + 1, 0)

    const params = new URLSearchParams({
      kebunId: String(kebunId),
      karyawanId: String(absenUserId),
      startDate: formatDateKey(firstDay),
      endDate: formatDateKey(lastDay),
    })

    try {
      const res = await fetch(`/api/karyawan-kebun/absensi?${params.toString()}`, { cache: 'no-store' })
      if (!res.ok) return
      const json = await res.json()
      const data = json.data || []

      const next: Record<string, AttendanceRecord> = {}
      data.forEach((r: any) => {
        const key = r.date ? normalizeDateKey(r.date) : ''
        if (!key) return
        const hourlyTotal = r.useHourly
          ? Math.round((parseFloat(String(r.jamKerja || 0)) || 0) * (parseFloat(String(r.ratePerJam || 0)) || 0))
          : 0
        const meal = Number(r.uangMakan || 0)
        const total = Number(r.jumlah || 0)
        const baseAmount = Math.max(0, total - hourlyTotal - meal)
        next[key] = {
          amount: baseAmount > 0 ? formatRibuanId(String(baseAmount)) : '',
          work: !!r.kerja,
          off: !!r.libur,
          note: r.note || '',
          source: r.source || null,
          useHourly: !!r.useHourly,
          hour: r.jamKerja ? String(r.jamKerja) : '',
          rate: r.ratePerJam ? formatRibuanId(String(r.ratePerJam)) : '',
          mealEnabled: meal > 0,
          mealAmount: meal > 0 ? formatRibuanId(String(meal)) : '',
        }
      })
      setRecords(next)
    } catch (e) {
      console.error('Failed to load attendance', e)
    }
  }, [kebunId, absenUserId, absenMonth, formatDateKey, formatRibuanId])

  useEffect(() => {
    loadServerData()
  }, [loadServerData])

  const loadPaid = useCallback(async () => {
    if (!kebunId || !absenUserId) {
      setPaidMap({})
      return
    }
    const start = new Date(absenMonth.getFullYear(), absenMonth.getMonth(), 1)
    const end = new Date(absenMonth.getFullYear(), absenMonth.getMonth() + 1, 0)
    const params = new URLSearchParams({
      kebunId: String(kebunId),
      karyawanId: String(absenUserId),
      startDate: formatDateKey(start),
      endDate: formatDateKey(end),
    })
    try {
      const res = await fetch(`/api/karyawan-kebun/absensi-payments?${params.toString()}`, { cache: 'no-store' })
      if (!res.ok) return
      const json = await res.json()
      const next: Record<string, boolean> = {}
      ;(json.data || []).forEach((r: any) => {
        const key = r.date ? normalizeDateKey(r.date) : ''
        if (key) next[key] = true
      })
      setPaidMap(next)
    } catch (e) {}
  }, [kebunId, absenUserId, absenMonth, formatDateKey])

  useEffect(() => {
    loadPaid()
  }, [loadPaid])

  const openDraftForDate = useCallback((dateKey: string, isPaid: boolean, isFilled: boolean) => {
    const rec = records[dateKey] || emptyRecord()
    setDraft({ ...rec, date: dateKey })
    if (isPaid || isFilled) {
      setOpenAbsenView(true)
    } else {
      setAbsenOpen(true)
    }
  }, [records])

  const setDraftField = useCallback((patch: Partial<AttendanceDraft>) => {
    setDraft(prev => {
      const next = { ...prev, ...patch }
      if ('amount' in patch) {
        const num = Number(String(patch.amount).replace(/\D/g, ''))
        if (num > 0) {
          next.work = true
          next.off = false
        }
      }
      if ('work' in patch && patch.work === true) next.off = false
      if ('off' in patch && patch.off === true) {
        next.work = false
        next.amount = ''
      }
      return next
    })
  }, [])

  const handleSaveAbsen = useCallback(async (mutateSummary: () => Promise<any>) => {
    if (!absenUserId || !draft.date) return
    setAbsenSaving(true)
    if (!kebunId || !absenUserId || !draft.date) {
      toast.error('Data tidak lengkap (ID atau Tanggal kosong)')
      setAbsenSaving(false)
      return
    }

    try {
      const amount = parseThousandInt(draft.amount)
      const hourlyVal = !draft.useHourly
        ? 0
        : (parseFloat((draft.hour || '').toString().replace(',', '.')) || 0) * parseThousandInt(draft.rate)
      const mealVal = !draft.mealEnabled ? 0 : parseThousandInt(draft.mealAmount)
      const total = Math.round(
        (Number.isFinite(amount) ? amount : 0) +
        (Number.isFinite(hourlyVal) ? hourlyVal : 0) +
        (Number.isFinite(mealVal) ? mealVal : 0)
      )

      const entry = {
        date: draft.date,
        amount,
        kerja: !!draft.work,
        libur: !!draft.off,
        note: (draft.note || '').trim(),
        useHourly: !!draft.useHourly,
        jamKerja: draft.useHourly ? parseFloat((draft.hour || '').toString().replace(',', '.')) || 0 : 0,
        ratePerJam: draft.useHourly ? parseThousandInt(draft.rate) : 0,
        uangMakan: mealVal,
      }

      const res = await fetch('/api/karyawan-kebun/absensi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kebunId: Number(kebunId),
          karyawanId: Number(absenUserId),
          entries: [entry],
        }),
      })

      if (res.ok) {
        toast.success('Absensi disimpan')
        setAbsenOpen(false)
        setOpenAbsenView(false)
        await loadServerData()
        await mutateSummary()
      } else {
        const errJson = await res.json().catch(() => ({}))
        toast.error(errJson.error || 'Gagal menyimpan')
      }
    } catch {
      toast.error('Terjadi kesalahan')
    } finally {
      setAbsenSaving(false)
    }
  }, [kebunId, absenUserId, draft, loadServerData])

  const handleDeleteAbsen = useCallback(async (mutateSummary: () => Promise<any>) => {
    if (!kebunId || !absenUserId || !draft.date) return
    setIsDeletingAbsen(true)
    try {
      const res = await fetch(
        `/api/karyawan-kebun/absensi?kebunId=${kebunId}&karyawanId=${absenUserId}&date=${draft.date}`,
        { method: 'DELETE' }
      )
      if (res.ok) {
        toast.success('Absensi dihapus')
        setOpenAbsenView(false)
        setOpenDeleteAbsenConfirm(false)
        await loadServerData()
        await mutateSummary()
      } else {
        toast.error('Gagal menghapus')
      }
    } catch {
      toast.error('Kesalahan jaringan')
    } finally {
      setIsDeletingAbsen(false)
    }
  }, [kebunId, absenUserId, draft.date, loadServerData])

  const isPaid = useMemo(() => !!paidMap[draft.date], [paidMap, draft.date])

  return {
    records,
    paidMap,
    draft,
    absenOpen,
    setAbsenOpen,
    openAbsenView,
    setOpenAbsenView,
    absenSaving,
    isDeletingAbsen,
    openDeleteAbsenConfirm,
    setOpenDeleteAbsenConfirm,
    isPaid,
    formatRibuanId,
    openDraftForDate,
    setDraftField,
    handleSaveAbsen,
    handleDeleteAbsen,
    loadServerData,
    loadPaid,
  }
}
