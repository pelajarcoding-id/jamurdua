'use client'

import { useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { User, PaymentDetail, HutangHistoryItem } from '../types'

export function useAbsensiDetail(kebunId: number) {
  const [openPayDetail, setOpenPayDetail] = useState(false)
  const [payDetail, setPayDetail] = useState<PaymentDetail | null>(null)
  const [payDetailLoading, setPayDetailLoading] = useState(false)
  const [payDetailExporting, setPayDetailExporting] = useState(false)

  const [openDetailHutang, setOpenDetailHutang] = useState(false)
  const [detailTarget, setDetailTarget] = useState<User | null>(null)
  const [detailRows, setDetailRows] = useState<HutangHistoryItem[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailExporting, setDetailExporting] = useState(false)

  const handleShowPayDetail = useCallback(async (row: { lastPaymentId?: number | null }) => {
    if (!row.lastPaymentId) return
    setPayDetailLoading(true)
    setOpenPayDetail(true)
    try {
      const res = await fetch(`/api/karyawan-kebun/absensi-payments/${row.lastPaymentId}`)
      if (res.ok) {
        const json = await res.json()
        setPayDetail(json.data as PaymentDetail)
      }
    } catch {
      toast.error('Gagal memuat detail pembayaran')
    } finally {
      setPayDetailLoading(false)
    }
  }, [])

  const handleShowDetailHutang = useCallback(async (user: User) => {
    setDetailTarget(user)
    setDetailLoading(true)
    setOpenDetailHutang(true)
    try {
      const res = await fetch(`/api/karyawan-kebun/hutang-history?kebunId=${kebunId}&karyawanId=${user.id}`)
      if (res.ok) {
        const json = await res.json()
        setDetailRows((json.data || []) as HutangHistoryItem[])
      }
    } catch {
      toast.error('Gagal memuat riwayat hutang')
    } finally {
      setDetailLoading(false)
    }
  }, [kebunId])

  return {
    openPayDetail,
    setOpenPayDetail,
    payDetail,
    payDetailLoading,
    payDetailExporting,
    setPayDetailExporting,
    openDetailHutang,
    setOpenDetailHutang,
    detailTarget,
    detailRows,
    detailLoading,
    detailExporting,
    setDetailExporting,
    handleShowPayDetail,
    handleShowDetailHutang,
  }
}
