'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import toast from 'react-hot-toast'
import { Pekerjaan } from '../types'
import { formatWIBDateForInput } from '@/lib/wib-date'

const formatWibYmd = (date: Date) => formatWIBDateForInput(date)

export type ActivityFilterType = 'month' | 'year' | 'range'
export type ActivityType = 'all' | 'upah' | 'aktivitas'
export type StatusFilter = 'all' | 'draft' | 'penggajian' | 'dibayar'

interface UseActivityDataProps {
  kebunId: number
  mode?: 'aktivitas' | 'borongan'
}

export function useActivityData({ kebunId, mode }: UseActivityDataProps) {
  const [activities, setActivities] = useState<Pekerjaan[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [perView, setPerView] = useState(mode === 'borongan' ? 50 : 20)

  // Search & Filter
  const [searchDraft, setSearchDraft] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [kategoriFilter, setKategoriFilter] = useState<string>('all')
  const [activityFilter, setActivityFilter] = useState<ActivityType>(() => {
    if (mode === 'borongan') return 'upah'
    if (mode === 'aktivitas') return 'aktivitas'
    return 'all'
  })

  // Date Filter
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [filterType, setFilterType] = useState<ActivityFilterType>('month')
  const [dateRange, setDateRange] = useState({
    start: formatWibYmd(new Date()),
    end: formatWibYmd(new Date()),
  })

  // Apply search
  const applySearch = useCallback(() => {
    setSearchQuery(String(searchDraft || '').trim())
    setCurrentPage(1)
  }, [searchDraft])

  // Fetch activities
  const fetchActivities = useCallback(async () => {
    try {
      setIsLoading(true)
      let startYmd: string
      let endYmd: string

      if (filterType === 'month') {
        const ymd = formatWibYmd(selectedDate)
        const y = Number(ymd.slice(0, 4))
        const m = Number(ymd.slice(5, 7))
        const endDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
        startYmd = `${ymd.slice(0, 8)}01`
        endYmd = `${ymd.slice(0, 5)}${String(m).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`
      } else if (filterType === 'year') {
        const y = Number(formatWibYmd(selectedDate).slice(0, 4))
        startYmd = `${y}-01-01`
        endYmd = `${y}-12-31`
      } else {
        startYmd = dateRange.start
        endYmd = dateRange.end
      }

      const baseUrl = new URL(`/api/kebun/${kebunId}/pekerjaan`, window.location.origin)
      baseUrl.searchParams.set('startDate', startYmd)
      baseUrl.searchParams.set('endDate', endYmd)
      if (activityFilter === 'upah') baseUrl.searchParams.set('upahBorongan', '1')
      if (activityFilter === 'aktivitas') baseUrl.searchParams.set('aktivitas', '1')

      const res = await fetch(baseUrl.toString())
      if (!res.ok) throw new Error('Gagal mengambil data')
      const data = await res.json()
      const rows = Array.isArray(data) ? data : []

      if (mode === 'borongan') {
        setActivities(rows)
        return
      }

      // Group activities for non-borongan mode
      const grouped = new Map<string, Pekerjaan>()
      rows.forEach((item: Pekerjaan) => {
        const dateKey = item.date ? formatWibYmd(new Date(item.date)) : ''
        const key = item.upahBorongan
          ? `${dateKey}|${item.jenisPekerjaan}|${item.keterangan || ''}|${item.biaya || 0}|${item.jumlah || 0}|${item.satuan || ''}|${item.hargaSatuan || 0}|${item.imageUrl || ''}`
          : `${dateKey}|${item.jenisPekerjaan}|${item.keterangan || ''}|${item.imageUrl || ''}`
        const isPaid = !!(item.upahBorongan && item.gajianStatus === 'FINALIZED')
        const isInGajian = !!(item.upahBorongan && item.gajianId)

        if (!grouped.has(key)) {
          grouped.set(key, {
            ...item,
            ids: [item.id],
            users: item.user ? [item.user] : [],
            paidCount: isPaid ? 1 : 0,
            totalCount: 1,
            inGajianCount: isInGajian ? 1 : 0,
            finalizedCount: isPaid ? 1 : 0,
          })
          return
        }
        const existing = grouped.get(key)!
        existing.ids = [...(existing.ids || []), item.id]
        if (item.user) existing.users = [...(existing.users || []), item.user]
        existing.totalCount = (existing.totalCount || 0) + 1
        existing.paidCount = (existing.paidCount || 0) + (isPaid ? 1 : 0)
        existing.inGajianCount = (existing.inGajianCount || 0) + (isInGajian ? 1 : 0)
        existing.finalizedCount = (existing.finalizedCount || 0) + (isPaid ? 1 : 0)
      })
      setActivities(Array.from(grouped.values()))
    } catch (error) {
      console.error(error)
      toast.error('Gagal memuat riwayat pekerjaan')
    } finally {
      setIsLoading(false)
    }
  }, [kebunId, selectedDate, filterType, dateRange, activityFilter, mode])

  // Filtered activities
  const filteredActivities = useMemo(() => {
    const q = String(searchQuery || '').trim().toLowerCase()
    const filtered = activities.filter((item) => {
      if (activityFilter === 'upah' && !item.upahBorongan) return false
      if (activityFilter === 'aktivitas' && item.upahBorongan) return false

      if (mode === 'borongan') {
        const isPaid = !!(item.upahBorongan && item.gajianStatus === 'FINALIZED')
        const isInGajian = !!(item.upahBorongan && item.gajianId && !isPaid)
        const isDraft = !!(item.upahBorongan && !isPaid && !isInGajian)

        if (statusFilter === 'dibayar' && !isPaid) return false
        if (statusFilter === 'penggajian' && !isInGajian) return false
        if (statusFilter === 'draft' && !isDraft) return false

        if (kategoriFilter !== 'all') {
          const kategori = String(item.kategoriBorongan || '').trim()
          if (kategoriFilter === '__none__') {
            if (kategori) return false
          } else {
            if (kategori.toLowerCase() !== String(kategoriFilter).toLowerCase()) return false
          }
        }
      }

      if (!q) return true

      const userNames = item.users?.length
        ? item.users.map((u) => u.name).join(' ')
        : item.user?.name || ''
      const kendaraanText = `${item.kendaraan?.platNomor || item.kendaraanPlatNomor || ''} ${item.kendaraan?.merk || ''} ${item.kendaraan?.jenis || ''}`
      const kategoriText = String(item.kategoriBorongan || '')
      const haystack = `${kategoriText} ${item.jenisPekerjaan || ''} ${item.keterangan || ''} ${userNames} ${kendaraanText}`.toLowerCase()
      return haystack.includes(q)
    })

    if (mode === 'borongan') {
      return [...filtered].sort((a, b) => {
        const aj = String(a?.jenisPekerjaan || '').trim()
        const bj = String(b?.jenisPekerjaan || '').trim()
        const cmp = aj.localeCompare(bj, 'id-ID', { sensitivity: 'base' })
        if (cmp !== 0) return cmp
        const ad = a?.date ? new Date(a.date).getTime() : 0
        const bd = b?.date ? new Date(b.date).getTime() : 0
        if (ad !== bd) return ad - bd
        return Number(a?.id || 0) - Number(b?.id || 0)
      })
    }
    return filtered
  }, [activities, activityFilter, kategoriFilter, mode, searchQuery, statusFilter])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredActivities.length / perView))
  const startIndex = (currentPage - 1) * perView
  const pagedActivities = filteredActivities.slice(startIndex, startIndex + perView)

  // Stats for borongan mode
  const boronganFooter = useMemo(() => {
    if (mode !== 'borongan') return null
    const totalJumlah = filteredActivities.reduce((acc, curr) => acc + Number(curr.jumlah || 0), 0)
    const totalBiaya = filteredActivities.reduce((acc, curr) => acc + Number(curr.biaya || 0), 0)
    const avgHargaSatuan = totalJumlah > 0 ? Math.round(totalBiaya / totalJumlah) : 0
    return { totalJumlah, totalBiaya, avgHargaSatuan }
  }, [filteredActivities, mode])

  // Reset page on filter change
  useEffect(() => {
    setCurrentPage(1)
  }, [kebunId, selectedDate, filterType, dateRange, activityFilter, statusFilter, kategoriFilter])

  // Initial fetch
  useEffect(() => {
    fetchActivities()
  }, [fetchActivities])

  // Mode change effect
  useEffect(() => {
    if (mode === 'borongan') setActivityFilter('upah')
    if (mode === 'aktivitas') setActivityFilter('aktivitas')
    if (mode !== 'borongan') setStatusFilter('all')
    if (mode !== 'borongan') setKategoriFilter('all')
  }, [mode])

  return {
    activities,
    isLoading,
    fetchActivities,
    // Pagination
    currentPage,
    setCurrentPage,
    perView,
    setPerView,
    totalPages,
    pagedActivities,
    startIndex,
    // Search
    searchDraft,
    setSearchDraft,
    searchQuery,
    setSearchQuery,
    applySearch,
    // Filters
    statusFilter,
    setStatusFilter,
    kategoriFilter,
    setKategoriFilter,
    activityFilter,
    setActivityFilter,
    // Date
    selectedDate,
    setSelectedDate,
    filterType,
    setFilterType,
    dateRange,
    setDateRange,
    // Stats
    filteredActivities,
    boronganFooter,
  }
}
