'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import { parseIdThousandInt, formatIdThousands } from '@/lib/utils'

export interface AbsensiState {
  amount: Record<string, string>
  work: Record<string, boolean>
  off: Record<string, boolean>
  note: Record<string, string>
  source: Record<string, string>
  hourly: Record<string, boolean>
  hour: Record<string, string>
  rate: Record<string, string>
  mealEnabled: Record<string, boolean>
  meal: Record<string, string>
  paid: Record<string, boolean>
}

export function useAbsensiKaryawan({
  selectedKebunId,
}: {
  selectedKebunId: number | null
}) {
  const formatDateKey = useCallback((d: Date) => new Intl.DateTimeFormat('en-CA').format(d), [])
  // Month and user
  const [absenMonth, setAbsenMonth] = useState<Date>(new Date())
  const [absenUserId, setAbsenUserId] = useState<number | null>(null)
  
  // Maps
  const [absenMap, setAbsenMap] = useState<Record<string, string>>({})
  const [absenWorkMap, setAbsenWorkMap] = useState<Record<string, boolean>>({})
  const [absenOffMap, setAbsenOffMap] = useState<Record<string, boolean>>({})
  const [absenNoteMap, setAbsenNoteMap] = useState<Record<string, string>>({})
  const [absenSourceMap, setAbsenSourceMap] = useState<Record<string, string>>({})
  const [absenHourlyMap, setAbsenHourlyMap] = useState<Record<string, boolean>>({})
  const [absenHourMap, setAbsenHourMap] = useState<Record<string, string>>({})
  const [absenRateMap, setAbsenRateMap] = useState<Record<string, string>>({})
  const [absenMealEnabledMap, setAbsenMealEnabledMap] = useState<Record<string, boolean>>({})
  const [absenMealMap, setAbsenMealMap] = useState<Record<string, string>>({})
  const [absenPaidMap, setAbsenPaidMap] = useState<Record<string, boolean>>({})

  // Form state
  const [absenSelectedDate, setAbsenSelectedDate] = useState<string>('')
  const [absenValue, setAbsenValue] = useState<string>('')
  const [absenWork, setAbsenWork] = useState<boolean>(false)
  const [absenOff, setAbsenOff] = useState<boolean>(false)
  const [absenNote, setAbsenNote] = useState<string>('')
  const [absenUseHourly, setAbsenUseHourly] = useState(false)
  const [absenHour, setAbsenHour] = useState<string>('')
  const [absenRate, setAbsenRate] = useState<string>('')
  const [absenMealEnabled, setAbsenMealEnabled] = useState(false)
  const [absenMealAmount, setAbsenMealAmount] = useState<string>('')
  const [absenDefaultAmount, setAbsenDefaultAmount] = useState<number>(0)
  const [absenSetDefault, setAbsenSetDefault] = useState<boolean>(false)
  const [absenSaving, setAbsenSaving] = useState(false)
  const [absenSaved, setAbsenSaved] = useState(false)
  const absenSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Payment history
  const [absenPaySelection, setAbsenPaySelection] = useState<Record<string, boolean>>({})
  const [absenPayHistoryRows, setAbsenPayHistoryRows] = useState<Array<{
    id: number
    startDate: string
    endDate: string
    paidAt: string
    jumlah: number
    deskripsi: string
    userName: string | null
    potonganHutang: number
    kebunId: number
    karyawanId: number
  }>>([])
  const [absenPayHistoryLoading, setAbsenPayHistoryLoading] = useState(false)
  const [absenPayHistoryStart, setAbsenPayHistoryStart] = useState<string>('')
  const [absenPayHistoryEnd, setAbsenPayHistoryEnd] = useState<string>('')
  const [absenPayPotong, setAbsenPayPotong] = useState<string>('')
  const [absenPayPotongDesc, setAbsenPayPotongDesc] = useState<string>('Potong Hutang dari Pembayaran Gaji')
  const [openAbsenSection, setOpenAbsenSection] = useState(false)
  const [isDeletingAbsen, setIsDeletingAbsen] = useState(false)

  // UI refs
  const absenSectionRef = useRef<HTMLDivElement | null>(null)

  // Load absensi data
  const loadAbsensi = useCallback(async () => {
    if (!absenUserId) return
    const kebunKey = selectedKebunId ?? 0
    const start = new Date(absenMonth.getFullYear(), absenMonth.getMonth(), 1)
    const end = new Date(absenMonth.getFullYear(), absenMonth.getMonth() + 1, 0)
    const params = new URLSearchParams({
      kebunId: String(kebunKey),
      karyawanId: String(absenUserId),
      startDate: formatDateKey(start),
      endDate: formatDateKey(end),
    })
    try {
      const res = await fetch(`/api/karyawan/operasional/absensi?${params.toString()}`, { cache: 'no-store' })
      if (!res.ok) {
        throw new Error('Failed to load')
      }
      const json = await res.json()
      const data = json.data || []
      const nextAmount: Record<string, string> = {}
      const nextWork: Record<string, boolean> = {}
      const nextOff: Record<string, boolean> = {}
      const nextNote: Record<string, string> = {}
      const nextSource: Record<string, string> = {}
      const nextHourly: Record<string, boolean> = {}
      const nextHour: Record<string, string> = {}
      const nextRate: Record<string, string> = {}
      const nextMealEnabled: Record<string, boolean> = {}
      const nextMeal: Record<string, string> = {}
      data.forEach((r: any) => {
        const date = r.date
        if (!date) return
        nextAmount[date] = String(r.amount || '')
        nextWork[date] = !!r.work
        nextOff[date] = !!r.off
        nextNote[date] = String(r.note || '')
        nextSource[date] = String(r.source || '')
        nextHourly[date] = !!r.hourly
        nextHour[date] = String(r.hour || '')
        nextRate[date] = String(r.rate || '')
        nextMealEnabled[date] = !!r.mealEnabled
        nextMeal[date] = String(r.meal || '')
      })
      setAbsenMap(nextAmount)
      setAbsenWorkMap(nextWork)
      setAbsenOffMap(nextOff)
      setAbsenNoteMap(nextNote)
      setAbsenSourceMap(nextSource)
      setAbsenHourlyMap(nextHourly)
      setAbsenHourMap(nextHour)
      setAbsenRateMap(nextRate)
      setAbsenMealEnabledMap(nextMealEnabled)
      setAbsenMealMap(nextMeal)
      // Persist to localStorage
      const ym = `${absenMonth.getFullYear()}-${String(absenMonth.getMonth() + 1).padStart(2, '0')}`
      const storageKey = `absensi:v2:${kebunKey}:${absenUserId}:${ym}`
      try {
        localStorage.setItem(storageKey, JSON.stringify({
          amount: nextAmount,
          work: nextWork,
          off: nextOff,
          note: nextNote,
          hourly: nextHourly,
          hour: nextHour,
          rate: nextRate,
          mealEnabled: nextMealEnabled,
          meal: nextMeal,
        }))
      } catch {}
    } catch (e) {
      console.error('Failed to load absensi from server', e)
    }
  }, [selectedKebunId, absenUserId, absenMonth])

  // Load from localStorage on mount
  useEffect(() => {
    if (!absenUserId) return
    const kebunKey = selectedKebunId ?? 0
    const ym = `${absenMonth.getFullYear()}-${String(absenMonth.getMonth() + 1).padStart(2, '0')}`
    const key = `absensi:v2:${kebunKey}:${absenUserId}:${ym}`
    try {
      const raw = localStorage.getItem(key)
      if (raw) {
        const parsed = JSON.parse(raw)
        setAbsenMap(prev => Object.keys(prev).length === 0 ? parsed.amount || {} : prev)
        setAbsenWorkMap(prev => Object.keys(prev).length === 0 ? parsed.work || {} : prev)
        setAbsenOffMap(prev => Object.keys(prev).length === 0 ? parsed.off || {} : prev)
        setAbsenNoteMap(prev => Object.keys(prev).length === 0 ? parsed.note || {} : prev)
        setAbsenSourceMap(prev => Object.keys(prev).length === 0 ? parsed.source || {} : prev)
        setAbsenHourlyMap(prev => Object.keys(prev).length === 0 ? parsed.hourly || {} : prev)
        setAbsenHourMap(prev => Object.keys(prev).length === 0 ? parsed.hour || {} : prev)
        setAbsenRateMap(prev => Object.keys(prev).length === 0 ? parsed.rate || {} : prev)
        setAbsenMealEnabledMap(prev => Object.keys(prev).length === 0 ? parsed.mealEnabled || {} : prev)
        setAbsenMealMap(prev => Object.keys(prev).length === 0 ? parsed.meal || {} : prev)
      }
    } catch {}
  }, [absenUserId, absenMonth, selectedKebunId])

  // Load paid status
  const loadPaid = useCallback(async () => {
    if (!absenUserId) {
      setAbsenPaidMap({})
      return
    }
    const kebunKey = selectedKebunId ?? 0
    const start = new Date(absenMonth.getFullYear(), absenMonth.getMonth(), 1)
    const end = new Date(absenMonth.getFullYear(), absenMonth.getMonth() + 1, 0)
    const params = new URLSearchParams({
      kebunId: String(kebunKey),
      karyawanId: String(absenUserId),
      startDate: formatDateKey(start),
      endDate: formatDateKey(end),
    })
    const res = await fetch(`/api/karyawan/operasional/absensi-payments?${params.toString()}`, { cache: 'no-store' })
    if (!res.ok) {
      setAbsenPaidMap({})
      return
    }
    const json = await res.json()
    const next: Record<string, boolean> = {}
    ;(json.data || []).forEach((r: { date: string }) => {
      if (r.date) {
        const raw = String(r.date).trim()
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
          next[raw] = true
          return
        }
        const d = new Date(raw)
        if (Number.isNaN(d.getTime())) return
        const year = d.getUTCFullYear()
        const month = String(d.getUTCMonth() + 1).padStart(2, '0')
        const day = String(d.getUTCDate()).padStart(2, '0')
        const key = `${year}-${month}-${day}`
        next[key] = true
      }
    })
    setAbsenPaidMap(next)
  }, [selectedKebunId, absenUserId, absenMonth])

  useEffect(() => {
    loadPaid()
  }, [loadPaid])

  // Load default amount
  useEffect(() => {
    const loadDefault = async () => {
      if (!selectedKebunId || !absenUserId) {
        setAbsenDefaultAmount(0)
        return
      }
      const params = new URLSearchParams({
        kebunId: String(selectedKebunId),
        karyawanId: String(absenUserId),
      })
      const res = await fetch(`/api/karyawan/operasional/absensi-default?${params.toString()}`)
      if (!res.ok) {
        setAbsenDefaultAmount(0)
        return
      }
      const json = await res.json()
      setAbsenDefaultAmount(Number(json.amount) || 0)
    }
    loadDefault()
  }, [selectedKebunId, absenUserId])

  // Fetch payment history
  const fetchAbsenPayHistory = useCallback(async (startDate?: string, endDate?: string) => {
    if (!absenUserId) {
      setAbsenPayHistoryRows([])
      return
    }
    const kebunKey = selectedKebunId ?? 0
    const monthStart = new Date(absenMonth.getFullYear(), absenMonth.getMonth(), 1)
    const monthEnd = new Date(absenMonth.getFullYear(), absenMonth.getMonth() + 1, 0)
    const params = new URLSearchParams({
      kebunId: String(kebunKey),
      karyawanId: String(absenUserId),
      startDate: absenPayHistoryStart || startDate || formatDateKey(monthStart),
      endDate: absenPayHistoryEnd || endDate || formatDateKey(monthEnd),
      history: '1',
    })
    setAbsenPayHistoryLoading(true)
    try {
      const res = await fetch(`/api/karyawan/operasional/absensi-payments?${params.toString()}`, { cache: 'no-store' })
      if (!res.ok) {
        setAbsenPayHistoryRows([])
        return
      }
      const json = await res.json()
      setAbsenPayHistoryRows(json.data || [])
    } finally {
      setAbsenPayHistoryLoading(false)
    }
  }, [selectedKebunId, absenUserId, absenMonth, absenPayHistoryStart, absenPayHistoryEnd])

  // Auto-calculate hourly
  useEffect(() => {
    if (!absenUseHourly) return
    const hours = parseFloat((absenHour || '').toString().replace(',', '.')) || 0
    const rate = parseIdThousandInt(absenRate)
    if (hours > 0 && rate > 0) {
      setAbsenWork(true)
      setAbsenOff(false)
    }
  }, [absenUseHourly, absenHour, absenRate])

  // Save absensi
  const saveAbsensi = useCallback(async () => {
    if (!absenUserId || !absenSelectedDate) return
    const kebunKey = selectedKebunId ?? 0
    setAbsenSaving(true)
    try {
      const hours = parseFloat((absenHour || '').toString().replace(',', '.')) || 0
      const rate = parseIdThousandInt(absenRate)
      const baseHourly = hours * rate
      const useHourly = absenUseHourly && hours > 0 && rate > 0
      const mealVal = absenMealEnabled ? parseIdThousandInt(absenMealAmount) : 0
      const totalAmount = Math.round(((useHourly ? baseHourly : 0) + parseIdThousandInt(absenValue)) + mealVal)
      const entries = [{
        date: absenSelectedDate,
        jumlah: totalAmount,
        kerja: absenWork || totalAmount > 0,
        libur: absenOff,
        note: absenNote || '',
        jamKerja: useHourly ? hours : null,
        ratePerJam: useHourly ? rate : null,
        uangMakan: absenMealEnabled ? mealVal : null,
        useHourly,
      }]
      const payload = {
        kebunId: kebunKey,
        karyawanId: absenUserId,
        entries,
      }
      const res = await fetch('/api/karyawan/operasional/absensi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({} as any))
        throw new Error((err as any).error || 'Gagal menyimpan absensi')
      }
      toast.success('Absensi disimpan')
      setAbsenSaved(true)
      if (absenSaveTimerRef.current) clearTimeout(absenSaveTimerRef.current)
      absenSaveTimerRef.current = setTimeout(() => setAbsenSaved(false), 2000)
      if (absenSetDefault && totalAmount > 0) {
        fetch('/api/karyawan/operasional/absensi-default', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kebunId: kebunKey, karyawanId: absenUserId, amount: totalAmount }),
        }).then(() => {}).catch(() => {})
        setAbsenDefaultAmount(totalAmount)
      }
      // Update maps
      const formattedTotal = totalAmount ? formatIdThousands(String(totalAmount)) : ''
      setAbsenMap(prev => ({ ...prev, [absenSelectedDate]: formattedTotal }))
      setAbsenWorkMap(prev => ({ ...prev, [absenSelectedDate]: absenWork }))
      setAbsenOffMap(prev => ({ ...prev, [absenSelectedDate]: absenOff }))
      setAbsenNoteMap(prev => ({ ...prev, [absenSelectedDate]: absenNote }))
      setAbsenHourlyMap(prev => ({ ...prev, [absenSelectedDate]: absenUseHourly }))
      setAbsenHourMap(prev => ({ ...prev, [absenSelectedDate]: absenHour }))
      setAbsenRateMap(prev => ({ ...prev, [absenSelectedDate]: absenRate }))
      setAbsenMealEnabledMap(prev => ({ ...prev, [absenSelectedDate]: absenMealEnabled }))
      setAbsenMealMap(prev => ({ ...prev, [absenSelectedDate]: absenMealAmount }))
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menyimpan absensi')
    } finally {
      setAbsenSaving(false)
    }
  }, [absenUserId, absenSelectedDate, selectedKebunId, absenValue, absenWork, absenOff, absenNote, absenUseHourly, absenHour, absenRate, absenMealEnabled, absenMealAmount, absenSetDefault])

  // Delete payment
  const deletePayment = useCallback(async (paymentId?: number, paidAt?: string) => {
    if (!absenUserId) return
    const kebunKey = selectedKebunId ?? 0
    try {
      const params = new URLSearchParams({
        kebunId: String(kebunKey),
        karyawanId: String(absenUserId),
      })
      if (paidAt) {
        params.set('paidAt', paidAt)
      } else if (paymentId) {
        params.set('id', String(paymentId))
      } else {
        return
      }
      const res = await fetch(`/api/karyawan/operasional/absensi-payments?${params.toString()}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({} as any))
        throw new Error((err as any).error || 'Gagal menghapus pembayaran')
      }
      toast.success('Pembayaran gaji dihapus')
      await fetchAbsenPayHistory()
      await loadPaid()
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menghapus pembayaran')
    }
  }, [absenUserId, selectedKebunId, fetchAbsenPayHistory, loadPaid])

  // Cancel paid date
  const cancelPaidDate = useCallback(async (date: string) => {
    if (!absenUserId || !date) return
    const kebunKey = selectedKebunId ?? 0
    try {
      const params = new URLSearchParams({
        kebunId: String(kebunKey),
        karyawanId: String(absenUserId),
        date,
      })
      const res = await fetch(`/api/karyawan/operasional/absensi-payments?${params.toString()}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({} as any))
        throw new Error((err as any).error || 'Gagal membatalkan pembayaran')
      }
      toast.success('Pembayaran gaji dibatalkan')
      await fetchAbsenPayHistory()
      await loadPaid()
    } catch (e: any) {
      toast.error(e?.message || 'Gagal membatalkan pembayaran')
    }
  }, [absenUserId, selectedKebunId, fetchAbsenPayHistory, loadPaid])

  // Open absensi section for user
  const openAbsensiForUser = useCallback((userId: number, scrollToSection?: boolean) => {
    setAbsenUserId(userId)
    setOpenAbsenSection(true)
    if (scrollToSection && absenSectionRef.current) {
      setTimeout(() => {
        absenSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }, [])

  // Computed values
  const totalHariKerja = Object.values(absenWorkMap).filter(Boolean).length
  const totalGaji = Object.values(absenMap).reduce((acc, val) => acc + parseIdThousandInt(val), 0)

  return {
    // State
    absenMonth,
    setAbsenMonth,
    absenUserId,
    absenMap,
    absenWorkMap,
    absenOffMap,
    absenNoteMap,
    absenSourceMap,
    absenHourlyMap,
    absenHourMap,
    absenRateMap,
    absenMealEnabledMap,
    absenMealMap,
    absenPaidMap,
    absenSelectedDate,
    setAbsenSelectedDate,
    absenValue,
    setAbsenValue,
    absenWork,
    setAbsenWork,
    absenOff,
    setAbsenOff,
    absenNote,
    setAbsenNote,
    absenUseHourly,
    setAbsenUseHourly,
    absenHour,
    setAbsenHour,
    absenRate,
    setAbsenRate,
    absenMealEnabled,
    setAbsenMealEnabled,
    absenMealAmount,
    setAbsenMealAmount,
    absenDefaultAmount,
    absenSetDefault,
    setAbsenSetDefault,
    absenSaving,
    absenSaved,
    absenPaySelection,
    setAbsenPaySelection,
    absenPayHistoryRows,
    absenPayHistoryLoading,
    absenPayHistoryStart,
    setAbsenPayHistoryStart,
    absenPayHistoryEnd,
    setAbsenPayHistoryEnd,
    absenPayPotong,
    setAbsenPayPotong,
    absenPayPotongDesc,
    setAbsenPayPotongDesc,
    openAbsenSection,
    setOpenAbsenSection,
    isDeletingAbsen,
    setIsDeletingAbsen,
    absenSectionRef,
    
    // Actions
    loadAbsensi,
    loadPaid,
    fetchAbsenPayHistory,
    saveAbsensi,
    deletePayment,
    cancelPaidDate,
    openAbsensiForUser,
    setAbsenMap,
    setAbsenWorkMap,
    setAbsenOffMap,
    setAbsenNoteMap,
    setAbsenSourceMap,
    setAbsenHourlyMap,
    setAbsenHourMap,
    setAbsenRateMap,
    setAbsenMealEnabledMap,
    setAbsenMealMap,
    setAbsenPaidMap,
    
    // Computed
    totalHariKerja,
    totalGaji,
  }
}
