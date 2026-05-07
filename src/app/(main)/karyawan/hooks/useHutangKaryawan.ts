'use client'

import { useState, useCallback, useMemo } from 'react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { User, HutangDetailRow } from '../types'
import { parseIdThousandInt } from '@/lib/utils'

export function useHutangKaryawan({
  selectedKebunId,
}: {
  selectedKebunId: number | null
}) {
  // Detail modal state
  const [detailRows, setDetailRows] = useState<HutangDetailRow[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)

  // Form state
  const [hutangJumlah, setHutangJumlah] = useState<string>('')
  const [hutangTanggal, setHutangTanggal] = useState<string>('')
  const [hutangDeskripsi, setHutangDeskripsi] = useState<string>('Hutang Karyawan')
  const [potongJumlah, setPotongJumlah] = useState<string>('')
  const [potongTanggal, setPotongTanggal] = useState<string>('')
  const [potongDeskripsi, setPotongDeskripsi] = useState<string>('Pembayaran Hutang Karyawan')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Edit detail
  const [editDetailId, setEditDetailId] = useState<number | null>(null)
  const [editDetailDate, setEditDetailDate] = useState<string>('')
  const [editDetailJumlah, setEditDetailJumlah] = useState<string>('')
  const [editDetailDeskripsi, setEditDetailDeskripsi] = useState<string>('')

  // Delete
  const [deleteDetail, setDeleteDetail] = useState<HutangDetailRow | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Load detail
  const loadDetail = useCallback(async (user: User) => {
    setDetailLoading(true)
    setSelectedUser(user)
    try {
      const params = new URLSearchParams({
        kebunId: String(selectedKebunId ?? 0),
        karyawanId: String(user.id),
      })
      const res = await fetch(`/api/karyawan/hutang-detail?${params.toString()}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load')
      const json = await res.json()
      setDetailRows(json.data || [])
    } catch {
      toast.error('Gagal memuat detail hutang')
      setDetailRows([])
    } finally {
      setDetailLoading(false)
    }
  }, [selectedKebunId])

  // Submit hutang
  const submitHutang = useCallback(async () => {
    if (!selectedUser) return
    const jumlah = parseIdThousandInt(hutangJumlah)
    if (!jumlah || jumlah <= 0) {
      toast.error('Jumlah hutang harus lebih dari 0')
      return
    }
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/karyawan/hutang', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kebunId: selectedKebunId ?? 0,
          karyawanId: selectedUser.id,
          jumlah,
          tanggal: hutangTanggal || format(new Date(), 'yyyy-MM-dd'),
          deskripsi: hutangDeskripsi,
        }),
      })
      if (!res.ok) throw new Error('Failed to save')
      toast.success('Hutang berhasil ditambahkan')
      await loadDetail(selectedUser)
      setHutangJumlah('')
      setHutangTanggal('')
    } catch {
      toast.error('Gagal menambahkan hutang')
    } finally {
      setIsSubmitting(false)
    }
  }, [selectedUser, selectedKebunId, hutangJumlah, hutangTanggal, hutangDeskripsi, loadDetail])

  // Submit potongan
  const submitPotongan = useCallback(async () => {
    if (!selectedUser) return
    const jumlah = parseIdThousandInt(potongJumlah)
    if (!jumlah || jumlah <= 0) {
      toast.error('Jumlah potongan harus lebih dari 0')
      return
    }
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/karyawan/potongan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kebunId: selectedKebunId ?? 0,
          karyawanId: selectedUser.id,
          jumlah,
          tanggal: potongTanggal || format(new Date(), 'yyyy-MM-dd'),
          deskripsi: potongDeskripsi,
        }),
      })
      if (!res.ok) throw new Error('Failed to save')
      toast.success('Potongan berhasil ditambahkan')
      await loadDetail(selectedUser)
      setPotongJumlah('')
      setPotongTanggal('')
    } catch {
      toast.error('Gagal menambahkan potongan')
    } finally {
      setIsSubmitting(false)
    }
  }, [selectedUser, selectedKebunId, potongJumlah, potongTanggal, potongDeskripsi, loadDetail])

  // Update detail
  const updateDetail = useCallback(async () => {
    if (!selectedUser || !editDetailId) return
    const jumlah = parseIdThousandInt(editDetailJumlah)
    if (!jumlah || jumlah <= 0) {
      toast.error('Jumlah harus lebih dari 0')
      return
    }
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/karyawan/hutang-detail/${editDetailId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jumlah,
          tanggal: editDetailDate,
          deskripsi: editDetailDeskripsi,
        }),
      })
      if (!res.ok) throw new Error('Failed to update')
      toast.success('Data berhasil diupdate')
      await loadDetail(selectedUser)
      setEditDetailId(null)
    } catch {
      toast.error('Gagal mengupdate data')
    } finally {
      setIsSubmitting(false)
    }
  }, [selectedUser, editDetailId, editDetailJumlah, editDetailDate, editDetailDeskripsi, loadDetail])

  // Delete detail
  const deleteDetailItem = useCallback(async () => {
    if (!selectedUser || !deleteDetail) return
    setDeleteLoading(true)
    try {
      const res = await fetch(`/api/karyawan/hutang-detail/${deleteDetail.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      toast.success('Data berhasil dihapus')
      await loadDetail(selectedUser)
      setDeleteDetail(null)
    } catch {
      toast.error('Gagal menghapus data')
    } finally {
      setDeleteLoading(false)
    }
  }, [selectedUser, deleteDetail, loadDetail])

  // Computed
  const totalHutang = useMemo(() => {
    return detailRows.reduce((acc, d) => acc + (d.kategori === 'HUTANG_KARYAWAN' ? d.jumlah : 0), 0)
  }, [detailRows])

  const totalPotongan = useMemo(() => {
    return detailRows.reduce((acc, d) => acc + (d.kategori === 'PEMBAYARAN_HUTANG' ? d.jumlah : 0), 0)
  }, [detailRows])

  const sisaHutang = useMemo(() => {
    return Math.max(0, totalHutang - totalPotongan)
  }, [totalHutang, totalPotongan])

  const lastPotongan = useMemo(() => {
    const found = detailRows.find(d => d.kategori === 'PEMBAYARAN_HUTANG')
    return found ? found.jumlah : 0
  }, [detailRows])

  return {
    // State
    detailRows,
    detailLoading,
    selectedUser,
    hutangJumlah,
    setHutangJumlah,
    hutangTanggal,
    setHutangTanggal,
    hutangDeskripsi,
    setHutangDeskripsi,
    potongJumlah,
    setPotongJumlah,
    potongTanggal,
    setPotongTanggal,
    potongDeskripsi,
    setPotongDeskripsi,
    isSubmitting,
    editDetailId,
    setEditDetailId,
    editDetailDate,
    setEditDetailDate,
    editDetailJumlah,
    setEditDetailJumlah,
    editDetailDeskripsi,
    setEditDetailDeskripsi,
    deleteDetail,
    setDeleteDetail,
    deleteLoading,

    // Actions
    loadDetail,
    submitHutang,
    submitPotongan,
    updateDetail,
    deleteDetailItem,
    setSelectedUser,

    // Computed
    totalHutang,
    totalPotongan,
    sisaHutang,
    lastPotongan,
  }
}
