import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useDebounce } from '@/hooks/useDebounce'

export function usePembayaranNotaSawit(args: {
  enabled: boolean
  defaultStartDate?: Date
  defaultEndDate?: Date
  defaultQuickRange?: string
}) {
  const { enabled, defaultStartDate, defaultEndDate, defaultQuickRange = 'this_year' } = args

  const [pembayaranSearch, setPembayaranSearch] = useState('')
  const debouncedPembayaranSearch = useDebounce(pembayaranSearch, 250)
  const [pembayaranPabrikId, setPembayaranPabrikId] = useState<string>('')
  const [pembayaranKebunId, setPembayaranKebunId] = useState<string>('')
  const [pembayaranStartDate, setPembayaranStartDate] = useState<Date | undefined>(undefined)
  const [pembayaranEndDate, setPembayaranEndDate] = useState<Date | undefined>(undefined)
  const [pembayaranQuickRange, setPembayaranQuickRange] = useState(defaultQuickRange)

  const [reconcileHistoryLoading, setReconcileHistoryLoading] = useState(false)
  const [reconcileHistorySoftLoading, setReconcileHistorySoftLoading] = useState(false)
  const [reconcileHistory, setReconcileHistory] = useState<any[]>([])
  const [reconcileHistoryPage, setReconcileHistoryPage] = useState(1)
  const [reconcileHistoryLimit, setReconcileHistoryLimit] = useState(20)
  const [reconcileHistoryTotal, setReconcileHistoryTotal] = useState(0)

  const initRef = useRef(false)
  const reconcileHistoryHasLoadedRef = useRef(false)
  const reconcileHistoryAbortRef = useRef<AbortController | null>(null)

  const toWibYmd = useCallback((dt?: Date) => {
    if (!dt) return ''
    const WIB_OFFSET_MS = 7 * 60 * 60 * 1000
    const wib = new Date(dt.getTime() + WIB_OFFSET_MS)
    const y = wib.getUTCFullYear()
    const m = String(wib.getUTCMonth() + 1).padStart(2, '0')
    const d = String(wib.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }, [])

  const wibStartFromYmd = useCallback((ymd: string) => new Date(`${ymd}T00:00:00+07:00`), [])
  const wibEndFromYmd = useCallback((ymd: string) => new Date(`${ymd}T23:59:59.999+07:00`), [])

  useEffect(() => {
    if (initRef.current) return
    if (!defaultStartDate || !defaultEndDate) return
    setPembayaranStartDate(defaultStartDate)
    setPembayaranEndDate(defaultEndDate)
    setPembayaranQuickRange(defaultQuickRange)
    initRef.current = true
  }, [defaultEndDate, defaultQuickRange, defaultStartDate])

  const pembayaranDateDisplay = useMemo(() => {
    if (pembayaranQuickRange && pembayaranQuickRange !== 'custom') {
      switch (pembayaranQuickRange) {
        case 'all':
          return 'Semua'
        case 'today':
          return 'Hari Ini'
        case 'this_week':
          return 'Minggu Ini'
        case 'this_month':
          return 'Bulan Ini'
        case 'this_year':
          return 'Tahun Ini'
        default:
          return 'Pilih Rentang Waktu'
      }
    }
    if (pembayaranStartDate && pembayaranEndDate) {
      const s = new Date(pembayaranStartDate).toLocaleDateString('id-ID')
      const e = new Date(pembayaranEndDate).toLocaleDateString('id-ID')
      return `${s} - ${e}`
    }
    return 'Pilih Rentang Waktu'
  }, [pembayaranEndDate, pembayaranQuickRange, pembayaranStartDate])

  const applyPembayaranQuickRange = useCallback(
    (val: string) => {
      const shiftDays = (dt: Date, days: number) => new Date(dt.getTime() + days * 24 * 60 * 60 * 1000)
      const todayYmd = toWibYmd(new Date())
      const todayStart = wibStartFromYmd(todayYmd)
      const todayEnd = wibEndFromYmd(todayYmd)
      setPembayaranQuickRange(val)

      if (val === 'all') {
        setPembayaranStartDate(undefined)
        setPembayaranEndDate(undefined)
        return
      }

      if (val === 'today') {
        setPembayaranStartDate(todayStart)
        setPembayaranEndDate(todayEnd)
        return
      }

      if (val === 'this_week') {
        const wibToday = new Date(Date.now() + 7 * 60 * 60 * 1000)
        const day = wibToday.getUTCDay()
        const diffToMon = day === 0 ? 6 : day - 1
        const monStart = shiftDays(todayStart, -diffToMon)
        setPembayaranStartDate(monStart)
        setPembayaranEndDate(todayEnd)
        return
      }

      if (val === 'this_month') {
        const wibToday = new Date(Date.now() + 7 * 60 * 60 * 1000)
        const y = wibToday.getUTCFullYear()
        const m = String(wibToday.getUTCMonth() + 1).padStart(2, '0')
        const startYmd = `${y}-${m}-01`
        setPembayaranStartDate(wibStartFromYmd(startYmd))
        setPembayaranEndDate(todayEnd)
        return
      }

      if (val === 'this_year') {
        const wibToday = new Date(Date.now() + 7 * 60 * 60 * 1000)
        const y = wibToday.getUTCFullYear()
        const startYmd = `${y}-01-01`
        setPembayaranStartDate(wibStartFromYmd(startYmd))
        setPembayaranEndDate(todayEnd)
        return
      }
    },
    [toWibYmd, wibEndFromYmd, wibStartFromYmd],
  )

  const fetchReconcileHistory = useCallback(
    async (opts?: { soft?: boolean }) => {
      const shouldSoft = !!opts?.soft && reconcileHistoryHasLoadedRef.current
      if (shouldSoft) {
        setReconcileHistorySoftLoading(true)
      } else {
        setReconcileHistoryLoading(true)
      }
      try {
        reconcileHistoryAbortRef.current?.abort()
        const controller = new AbortController()
        reconcileHistoryAbortRef.current = controller
        const pabrikId = pembayaranPabrikId ? String(pembayaranPabrikId) : ''
        const kebunId = pembayaranKebunId ? String(pembayaranKebunId) : ''
        const params = new URLSearchParams({ page: String(reconcileHistoryPage), limit: String(reconcileHistoryLimit) })
        if (pabrikId) params.append('pabrikId', pabrikId)
        if (kebunId) params.append('kebunId', kebunId)
        if (debouncedPembayaranSearch.trim()) params.append('search', debouncedPembayaranSearch.trim())
        if (pembayaranStartDate) params.append('startDate', pembayaranStartDate.toISOString())
        if (pembayaranEndDate) params.append('endDate', pembayaranEndDate.toISOString())
        const res = await fetch(`/api/nota-sawit/pembayaran-batch?${params.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error((json as any)?.error || 'Gagal memuat riwayat rekonsiliasi')
        setReconcileHistory(Array.isArray((json as any)?.data) ? (json as any).data : [])
        setReconcileHistoryTotal(Math.max(0, Number((json as any)?.total || 0)))
      } catch (e: any) {
        if (String(e?.name) === 'AbortError') return
        toast.error(e?.message || 'Gagal memuat riwayat rekonsiliasi')
        setReconcileHistory([])
        setReconcileHistoryTotal(0)
      } finally {
        reconcileHistoryHasLoadedRef.current = true
        if (shouldSoft) {
          setReconcileHistorySoftLoading(false)
        } else {
          setReconcileHistoryLoading(false)
        }
      }
    },
    [
      debouncedPembayaranSearch,
      pembayaranEndDate,
      pembayaranKebunId,
      pembayaranPabrikId,
      pembayaranStartDate,
      reconcileHistoryLimit,
      reconcileHistoryPage,
    ],
  )

  useEffect(() => {
    if (!enabled) return
    fetchReconcileHistory({ soft: true })
  }, [enabled, fetchReconcileHistory])

  return {
    pembayaranSearch,
    setPembayaranSearch,
    pembayaranPabrikId,
    setPembayaranPabrikId,
    pembayaranKebunId,
    setPembayaranKebunId,
    pembayaranStartDate,
    setPembayaranStartDate,
    pembayaranEndDate,
    setPembayaranEndDate,
    pembayaranQuickRange,
    setPembayaranQuickRange,
    pembayaranDateDisplay,
    applyPembayaranQuickRange,
    toWibYmd,
    wibStartFromYmd,
    wibEndFromYmd,
    reconcileHistoryLoading,
    reconcileHistorySoftLoading,
    reconcileHistory,
    reconcileHistoryPage,
    setReconcileHistoryPage,
    reconcileHistoryLimit,
    setReconcileHistoryLimit,
    reconcileHistoryTotal,
    fetchReconcileHistory,
  }
}

