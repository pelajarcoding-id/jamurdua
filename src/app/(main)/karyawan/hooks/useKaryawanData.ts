'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import useSWR from 'swr'
import useSWRImmutable from 'swr/immutable'
import { User, Kebun, WorkLocation, Assignment, fetcher } from '../types'

export function useKaryawanData() {
  // Filter states
  const [karyawanPage, setKaryawanPage] = useState(1)
  const [karyawanLimit, setKaryawanLimit] = useState(10)
  const [selectedJobType, setSelectedJobType] = useState<string>('all')
  const [selectedKebunId, setSelectedKebunId] = useState<number | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<string>('AKTIF')
  const [karyawanSearch, setKaryawanSearch] = useState('')
  const [karyawanSearchApplied, setKaryawanSearchApplied] = useState('')
  const [selectedLocationFilterId, setSelectedLocationFilterId] = useState<number | 'all'>('all')
  const [filterExpanded, setFilterExpanded] = useState(false)
  
  // Popover states
  const [openJobTypeCombo, setOpenJobTypeCombo] = useState(false)
  const [jobTypeQuery, setJobTypeQuery] = useState('')
  const [openKebunFilterCombo, setOpenKebunFilterCombo] = useState(false)
  const [kebunFilterQuery, setKebunFilterQuery] = useState('')
  const [openKaryawanFilterCombo, setOpenKaryawanFilterCombo] = useState(false)
  const [karyawanFilterQuery, setKaryawanFilterQuery] = useState('')

  // User access
  const { data: me } = useSWRImmutable<{ id: number; name: string; role: string }>('/api/auth/me', (u: string) => fetch(u).then(r => r.ok ? r.json() : null))
  const canDelete = (me?.role === 'ADMIN' || me?.role === 'PEMILIK')
  const canMove = (me?.role === 'ADMIN' || me?.role === 'PEMILIK' || me?.role === 'MANAGER')
  const canRequestDelete = (me?.role === 'MANAGER')
  const canShowDelete = canDelete || canRequestDelete
  const accessDenied = !!(me && (me.role === 'MANAGER' || me.role === 'MANDOR'))

  // Kebun list
  const [kebunList, setKebunList] = useState<Kebun[]>([])
  
  useEffect(() => {
    fetch('/api/kebun/list')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data?.data)) {
          setKebunList(data.data)
        }
      })
      .catch(() => setKebunList([]))
  }, [])

  // Fetch karyawan
  const karyawanUrl = useMemo(() => {
    const sp = new URLSearchParams()
    const needWideFetch = selectedLocationFilterId !== 'all'
    sp.set('limit', String(needWideFetch ? 1000 : karyawanLimit))
    sp.set('page', String(needWideFetch ? 1 : karyawanPage))
    if (selectedJobType !== 'all') sp.set('jobType', selectedJobType)
    if (selectedJobType === 'KEBUN' && selectedKebunId) sp.set('kebunId', String(selectedKebunId))
    if (selectedStatus !== 'all') sp.set('status', selectedStatus)
    if (karyawanSearchApplied.trim()) sp.set('search', karyawanSearchApplied.trim())
    return `/api/karyawan?${sp.toString()}`
  }, [karyawanLimit, karyawanPage, selectedJobType, selectedKebunId, selectedLocationFilterId, karyawanSearchApplied, selectedStatus])

  const { data: karyawanData, isLoading: loadingKaryawan, mutate: mutateKaryawan } = useSWR<{ data: User[]; total: number; page: number; limit: number }>(
    accessDenied ? null : karyawanUrl,
    (url: string) => fetch(url).then(r => r.json()),
    { keepPreviousData: true }
  )

  const karyawanList = useMemo(() => {
    if (karyawanData && Array.isArray(karyawanData.data)) return karyawanData.data
    return []
  }, [karyawanData])

  const totalKaryawan = karyawanData?.total ?? 0

  // Fetch active assignments
  const activeAssignmentsUrl = useMemo(() => {
    if (!Array.isArray(karyawanList) || karyawanList.length === 0) return null
    const ids = karyawanList.map(k => k.id).join(',')
    return `/api/karyawan/assignments?userIds=${ids}&active=1`
  }, [karyawanList])

  const { data: activeAssignmentsData } = useSWR<{ data: Assignment[] }>(
    accessDenied ? null : activeAssignmentsUrl,
    fetcher
  )

  const activeAssignments = useMemo(() => {
    return activeAssignmentsData?.data || []
  }, [activeAssignmentsData])

  const activeAssignmentMap = useMemo(() => {
    const map: Record<number, WorkLocation> = {}
    activeAssignments.forEach((a: Assignment) => {
      map[a.userId] = a.location
    })
    return map
  }, [activeAssignments])

  // Helpers
  const getLocationLabel = useCallback((loc: WorkLocation) => {
    if (!loc) return '-'
    return `${loc.name} (${loc.type})`
  }, [])

  const getActiveLocationLabel = useCallback((k: User) => {
    const loc = activeAssignmentMap[k.id]
    if (!loc) return '-'
    return `${loc.name} (${loc.type})`
  }, [activeAssignmentMap])

  // Filter by location if needed
  const filteredKaryawanList = useMemo(() => {
    if (selectedLocationFilterId === 'all') return karyawanList
    return karyawanList.filter(k => {
      const loc = activeAssignmentMap[k.id]
      return loc?.id === selectedLocationFilterId
    })
  }, [karyawanList, selectedLocationFilterId, activeAssignmentMap])

  // Search
  const applyKaryawanSearch = useCallback(() => {
    setKaryawanSearchApplied(karyawanSearch)
    setKaryawanPage(1)
  }, [karyawanSearch])

  // Job type options
  const jobTypeOptions = useMemo(() => [
    { value: 'all', label: 'Semua' },
    { value: 'KEBUN', label: 'Kebun' },
    { value: 'TRANSPORTASI', label: 'Transportasi' },
    { value: 'KANTOR', label: 'Kantor' },
  ], [])

  const formatJobTypeLabel = useCallback((raw?: string | null) => {
    if (!raw) return '-'
    if (raw === 'KEBUN') return 'Kebun'
    if (raw === 'TRANSPORTASI') return 'Transportasi'
    if (raw === 'KANTOR') return 'Kantor'
    return raw
  }, [])

  return {
    // Data
    karyawanList: filteredKaryawanList,
    totalKaryawan,
    loadingKaryawan,
    mutateKaryawan,
    kebunList,
    activeAssignmentMap,
    
    // Pagination
    karyawanPage,
    setKaryawanPage,
    karyawanLimit,
    setKaryawanLimit,
    
    // Filters
    selectedJobType,
    setSelectedJobType,
    selectedKebunId,
    setSelectedKebunId,
    selectedStatus,
    setSelectedStatus,
    selectedLocationFilterId,
    setSelectedLocationFilterId,
    karyawanSearch,
    setKaryawanSearch,
    karyawanSearchApplied,
    applyKaryawanSearch,
    filterExpanded,
    setFilterExpanded,
    
    // Popover states
    openJobTypeCombo,
    setOpenJobTypeCombo,
    jobTypeQuery,
    setJobTypeQuery,
    openKebunFilterCombo,
    setOpenKebunFilterCombo,
    kebunFilterQuery,
    setKebunFilterQuery,
    openKaryawanFilterCombo,
    setOpenKaryawanFilterCombo,
    karyawanFilterQuery,
    setKaryawanFilterQuery,
    
    // Helpers
    getLocationLabel,
    getActiveLocationLabel,
    jobTypeOptions,
    formatJobTypeLabel,
    
    // Access
    canDelete,
    canMove,
    canRequestDelete,
    canShowDelete,
    accessDenied,
    me,
  }
}
