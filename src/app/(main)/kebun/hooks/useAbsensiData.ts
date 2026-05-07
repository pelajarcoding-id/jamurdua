import { useMemo, useState, useEffect, useCallback } from 'react'
import useSWR from 'swr'
import { Row, User } from '../types'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export function useAbsensiData(kebunId: number, absenMonth: Date, selectedUserId: number | null = null) {
  const [karyawanSearch, setKaryawanSearch] = useState('')
  const [karyawanPerView, setKaryawanPerView] = useState(50)
  const [karyawanPage, setKaryawanPage] = useState(1)
  const [hutangPerView, setHutangPerView] = useState(20)
  const [hutangPage, setHutangPage] = useState(1)

  const formatDateKey = useCallback((d: Date) => {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }, [])

  const startOfMonth = useMemo(() => {
    const d = new Date(absenMonth.getFullYear(), absenMonth.getMonth(), 1)
    return formatDateKey(d)
  }, [absenMonth, formatDateKey])

  const endOfMonth = useMemo(() => {
    const d = new Date(absenMonth.getFullYear(), absenMonth.getMonth() + 1, 0)
    return formatDateKey(d)
  }, [absenMonth, formatDateKey])

  const { data: summaryRowsData, mutate: mutateSummary, isLoading: loadingSummary } = useSWR<{ data: Row[] }>(
    `/api/karyawan-kebun?kebunId=${kebunId}&startDate=${startOfMonth}&endDate=${endOfMonth}`,
    fetcher
  )

  const rows = summaryRowsData?.data ?? []

  const filteredRows = useMemo(() => {
    const base = rows.filter((r) => !r?.karyawan?.deleteRequestPending)
    const s = karyawanSearch.trim().toLowerCase()
    const filtered = s ? base.filter((r) => r.karyawan.name.toLowerCase().includes(s)) : base
    return [...filtered].sort((a, b) => {
      const an = String(a?.karyawan?.name || '')
      const bn = String(b?.karyawan?.name || '')
      const cmp = an.localeCompare(bn, 'id-ID', { sensitivity: 'base' })
      if (cmp !== 0) return cmp
      return Number(a?.karyawan?.id || 0) - Number(b?.karyawan?.id || 0)
    })
  }, [rows, karyawanSearch])

  const karyawanTotalPages = useMemo(() => Math.max(1, Math.ceil(filteredRows.length / karyawanPerView)), [filteredRows.length, karyawanPerView])
  const karyawanStartIndex = useMemo(() => (karyawanPage - 1) * karyawanPerView, [karyawanPage, karyawanPerView])
  const pagedKaryawanRows = useMemo(
    () => filteredRows.slice(karyawanStartIndex, karyawanStartIndex + karyawanPerView),
    [filteredRows, karyawanStartIndex, karyawanPerView],
  )

  const totals = useMemo(() => {
    if (selectedUserId) {
      const row = filteredRows.find(r => r.karyawan.id === selectedUserId)
      if (row) {
        return {
          totalGajiBerjalan: row.totalGajiBelumDibayar || 0,
          totalGajiDibayar: row.totalGajiDibayar || 0,
          totalSaldoHutang: row.hutangSaldo || 0,
          totalHariKerja: row.hariKerja || 0,
        }
      }
    }
    return {
      totalGajiBerjalan: filteredRows.reduce((acc, curr) => acc + (curr.totalGajiBelumDibayar || 0), 0),
      totalGajiDibayar: filteredRows.reduce((acc, curr) => acc + (curr.totalGajiDibayar || 0), 0),
      totalSaldoHutang: filteredRows.reduce((acc, curr) => acc + (curr.hutangSaldo || 0), 0),
      totalHariKerja: filteredRows.reduce((acc, curr) => acc + (curr.hariKerja || 0), 0),
    }
  }, [filteredRows, selectedUserId])

  const hutangTotalPages = useMemo(() => Math.max(1, Math.ceil(filteredRows.length / hutangPerView)), [filteredRows.length, hutangPerView])
  const hutangStartIndex = useMemo(() => (hutangPage - 1) * hutangPerView, [hutangPage, hutangPerView])
  const pagedHutangRows = useMemo(
    () => filteredRows.slice(hutangStartIndex, hutangStartIndex + hutangPerView),
    [filteredRows, hutangStartIndex, hutangPerView],
  )

  useEffect(() => {
    setKaryawanPage(1)
    setHutangPage(1)
  }, [karyawanSearch, absenMonth, kebunId, karyawanPerView, hutangPerView])

  const { data: karyawanData, mutate: mutateKaryawanList } = useSWR<{ data: User[] }>(
    `/api/karyawan?kebunId=${kebunId}&jobType=KEBUN&limit=100`,
    fetcher
  )

  return {
    rows,
    filteredRows,
    pagedKaryawanRows,
    pagedHutangRows,
    loadingSummary,
    karyawanSearch,
    setKaryawanSearch,
    karyawanPage,
    setKaryawanPage,
    karyawanTotalPages,
    karyawanStartIndex,
    karyawanPerView,
    setKaryawanPerView,
    hutangPage,
    setHutangPage,
    hutangTotalPages,
    hutangStartIndex,
    hutangPerView,
    setHutangPerView,
    totals,
    mutateSummary,
    mutateKaryawanList,
    karyawanList: karyawanData?.data ?? [],
    formatDateKey,
  }
}
