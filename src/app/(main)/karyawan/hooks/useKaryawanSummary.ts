'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import useSWR from 'swr'
import { Kebun, Row, SummaryRow, fetcher } from '../types'

export function useKaryawanSummary({
  selectedKebunId,
  selectedJobType,
  selectedStatus,
  kebunList,
  absenUserId,
  startDate,
  endDate,
  accessDenied,
}: {
  selectedKebunId: number | null
  selectedJobType: string
  selectedStatus: string
  kebunList: Kebun[]
  absenUserId: number | null
  startDate: string
  endDate: string
  accessDenied: boolean
}) {
  // Summary filters
  const [summaryJobType, setSummaryJobType] = useState<string>('all')
  const [summaryKaryawanId, setSummaryKaryawanId] = useState<number | null>(null)
  const [summaryStartDate, setSummaryStartDate] = useState<string>('')
  const [summaryEndDate, setSummaryEndDate] = useState<string>('')

  // Summary data
  const summaryUrl = useMemo(() => {
    const sp = new URLSearchParams()
    if (selectedKebunId) sp.set('kebunId', String(selectedKebunId))
    if (selectedJobType && selectedJobType !== 'all') sp.set('jobType', selectedJobType)
    if (absenUserId) sp.set('karyawanId', String(absenUserId))
    if (startDate) sp.set('startDate', startDate)
    if (endDate) sp.set('endDate', endDate)
    if (selectedStatus && selectedStatus !== 'all') sp.set('status', selectedStatus)
    return `/api/karyawan/operasional/summary?${sp.toString()}`
  }, [selectedKebunId, selectedJobType, absenUserId, startDate, endDate, selectedStatus])

  const { data: summaryData, isLoading: loadingSummary } = useSWR<{ 
    totalKaryawan: number; 
    gaji: { 
      total: number; 
      paid: number; 
      unpaid: number; 
      byJobType: Array<{ jobType: string; total: number }> 
    }; 
    hutang: { 
      total: number; 
      byJobType: Array<{ jobType: string; hutang: number; pembayaran: number; saldo: number }> 
    } 
  }>(
    summaryUrl,
    fetcher
  )

  // Kebun summaries
  const [kebunSummaries, setKebunSummaries] = useState<Array<{ 
    kebunId: number; 
    kebunName: string; 
    gajiTotal: number; 
    gajiPaid: number; 
    gajiUnpaid: number; 
    hutangTotal: number 
  }>>([])
  const [loadingKebunSummaries, setLoadingKebunSummaries] = useState(false)

  useEffect(() => {
    if (!Array.isArray(kebunList) || kebunList.length === 0) {
      setKebunSummaries([])
      return
    }
    const targetKebun = selectedKebunId ? kebunList.filter(k => k.id === selectedKebunId) : kebunList
    const run = async () => {
      setLoadingKebunSummaries(true)
      try {
        const results = await Promise.all(targetKebun.map(async (k) => {
          const sp = new URLSearchParams()
          sp.set('kebunId', String(k.id))
          if (summaryJobType && summaryJobType !== 'all') sp.set('jobType', summaryJobType)
          if (summaryKaryawanId) sp.set('karyawanId', String(summaryKaryawanId))
          if (summaryStartDate) sp.set('startDate', summaryStartDate)
          if (summaryEndDate) sp.set('endDate', summaryEndDate)
          try {
            const res = await fetch(`/api/karyawan/operasional/summary?${sp.toString()}`)
            if (!res.ok) {
              return { kebunId: k.id, kebunName: k.name, gajiTotal: 0, gajiPaid: 0, gajiUnpaid: 0, hutangTotal: 0 }
            }
            const json = await res.json()
            return {
              kebunId: k.id,
              kebunName: k.name,
              gajiTotal: Number(json?.gaji?.total || 0),
              gajiPaid: Number(json?.gaji?.paid || 0),
              gajiUnpaid: Number(json?.gaji?.unpaid || 0),
              hutangTotal: Number(json?.hutang?.total || 0)
            }
          } catch {
            return { kebunId: k.id, kebunName: k.name, gajiTotal: 0, gajiPaid: 0, gajiUnpaid: 0, hutangTotal: 0 }
          }
        }))
        setKebunSummaries(results)
      } finally {
        setLoadingKebunSummaries(false)
      }
    }
    run()
  }, [kebunList, selectedKebunId, summaryJobType, summaryKaryawanId, summaryStartDate, summaryEndDate])

  // Job type summary
  const jobTypeSummary = useMemo(() => {
    const gaji = summaryData?.gaji?.byJobType || []
    const hutang = summaryData?.hutang?.byJobType || []
    const map = new Map<string, { jobType: string; gaji: number; hutang: number; pembayaran: number; saldo: number }>()
    gaji.forEach(r => {
      const key = r.jobType || 'LAIN'
      map.set(key, { jobType: key, gaji: Number(r.total || 0), hutang: 0, pembayaran: 0, saldo: 0 })
    })
    hutang.forEach(r => {
      const key = r.jobType || 'LAIN'
      const prev = map.get(key) || { jobType: key, gaji: 0, hutang: 0, pembayaran: 0, saldo: 0 }
      map.set(key, { ...prev, hutang: Number(r.hutang || 0), pembayaran: Number(r.pembayaran || 0), saldo: Number(r.saldo || 0) })
    })
    return Array.from(map.values())
  }, [summaryData])

  return {
    summaryData,
    loadingSummary,
    kebunSummaries,
    loadingKebunSummaries,
    jobTypeSummary,
    summaryJobType,
    setSummaryJobType,
    summaryKaryawanId,
    setSummaryKaryawanId,
    summaryStartDate,
    setSummaryStartDate,
    summaryEndDate,
    setSummaryEndDate,
  }
}

export function useOperasionalData({
  selectedKebunId,
  startDate,
  endDate,
  selectedStatus,
  selectedJobType,
  karyawanSearchApplied,
  absenUserId,
  accessDenied,
}: {
  selectedKebunId: number | null
  startDate: string
  endDate: string
  selectedStatus: string
  selectedJobType: string
  karyawanSearchApplied: string
  absenUserId: number | null
  accessDenied: boolean
}) {
  const query = useMemo(() => {
    const sp = new URLSearchParams()
    if (selectedKebunId) sp.set('kebunId', String(selectedKebunId))
    if (startDate) sp.set('startDate', startDate)
    if (endDate) sp.set('endDate', endDate)
    if (selectedStatus && selectedStatus !== 'all') sp.set('status', selectedStatus)
    if (selectedJobType && selectedJobType !== 'all') sp.set('jobType', selectedJobType)
    if (karyawanSearchApplied) sp.set('search', karyawanSearchApplied)
    if (absenUserId) sp.set('karyawanId', String(absenUserId))
    return `/api/karyawan/operasional?${sp.toString()}`
  }, [selectedKebunId, startDate, endDate, selectedStatus, selectedJobType, karyawanSearchApplied, absenUserId])

  const { data, isLoading, mutate } = useSWR<{ data: Row[] }>(
    accessDenied ? null : query,
    fetcher
  )

  const rows = useMemo(() => {
    if (data && Array.isArray(data.data)) return data.data
    return []
  }, [data])

  return {
    rows,
    isLoading,
    mutate,
  }
}
