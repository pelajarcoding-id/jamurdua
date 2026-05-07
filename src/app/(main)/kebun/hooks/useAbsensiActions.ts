import { useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { User, Row } from '../types'

export function useAbsensiActions(kebunId: number, mutateSummary: () => void, mutateKaryawanList: () => void) {
  const [openAddKaryawan, setOpenAddKaryawan] = useState(false)
  const [addKaryawanLoading, setAddKaryawanLoading] = useState(false)
  const [addKaryawanName, setAddKaryawanName] = useState('')
  const [addKaryawanStatus, setAddKaryawanStatus] = useState<'AKTIF' | 'NONAKTIF'>('AKTIF')
  const [addKaryawanPhotoFile, setAddKaryawanPhotoFile] = useState<File | null>(null)
  const [addKaryawanPhotoPreview, setAddKaryawanPhotoPreview] = useState<string | null>(null)

  const [openEditKaryawan, setOpenEditKaryawan] = useState(false)
  const [editKaryawanSubmitting, setEditKaryawanSubmitting] = useState(false)
  const [editKaryawanTarget, setEditKaryawanTarget] = useState<User | null>(null)
  const [editKaryawanName, setEditKaryawanName] = useState('')
  const [editKaryawanStatus, setEditKaryawanStatus] = useState<'AKTIF' | 'NONAKTIF'>('AKTIF')
  const [editKaryawanPhotoFile, setEditKaryawanPhotoFile] = useState<File | null>(null)
  const [editKaryawanPhotoPreview, setEditKaryawanPhotoPreview] = useState<string | null>(null)

  const [openDeleteKaryawan, setOpenDeleteKaryawan] = useState(false)
  const [deleteKaryawanId, setDeleteKaryawanId] = useState<number | null>(null)

  const handleCreateKaryawan = async () => {
    const name = addKaryawanName.trim()
    if (!name) {
      toast.error('Nama wajib diisi')
      return
    }
    setAddKaryawanLoading(true)
    const loadingToast = toast.loading('Menyimpan karyawan...')
    try {
      let photoUrl: string | null = null
      if (addKaryawanPhotoFile) {
        const fd = new FormData()
        fd.append('file', addKaryawanPhotoFile)
        const up = await fetch('/api/upload', { method: 'POST', body: fd })
        const upJson = await up.json().catch(() => ({} as any))
        if (!up.ok || !upJson?.success) throw new Error(upJson?.error || 'Upload foto profil gagal')
        photoUrl = upJson.url
      }

      const res = await fetch('/api/karyawan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          kebunId,
          jobType: 'KEBUN',
          role: 'KARYAWAN',
          status: addKaryawanStatus,
          ...(photoUrl ? { photoUrl } : {}),
        }),
      })
      const json = await res.json().catch(() => ({} as any))
      if (!res.ok) throw new Error((json as any)?.error || 'Gagal menambah karyawan')
      toast.success('Karyawan berhasil ditambahkan', { id: loadingToast })
      setOpenAddKaryawan(false)
      setAddKaryawanName('')
      setAddKaryawanStatus('AKTIF')
      setAddKaryawanPhotoFile(null)
      setAddKaryawanPhotoPreview(null)
      await Promise.all([mutateKaryawanList(), mutateSummary()])
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menambah karyawan', { id: loadingToast })
    } finally {
      setAddKaryawanLoading(false)
    }
  }

  const openEditKaryawanModal = useCallback((karyawan: User) => {
    setEditKaryawanTarget(karyawan)
    setEditKaryawanName(karyawan.name || '')
    setEditKaryawanStatus((karyawan.status as any) === 'NONAKTIF' ? 'NONAKTIF' : 'AKTIF')
    setEditKaryawanPhotoFile(null)
    setEditKaryawanPhotoPreview(karyawan.photoUrl || null)
    setOpenEditKaryawan(true)
  }, [])

  const handleUpdateKaryawan = useCallback(async (selectedUser: User | null, setSelectedUser: (u: any) => void) => {
    if (!editKaryawanTarget) return
    const name = editKaryawanName.trim()
    if (!name) {
      toast.error('Nama wajib diisi')
      return
    }
    setEditKaryawanSubmitting(true)
    const loadingToast = toast.loading('Menyimpan perubahan...')
    try {
      let photoUrl: string | null | undefined = undefined
      if (editKaryawanPhotoFile) {
        const fd = new FormData()
        fd.append('file', editKaryawanPhotoFile)
        const up = await fetch('/api/upload', { method: 'POST', body: fd })
        const upJson = await up.json().catch(() => ({} as any))
        if (!up.ok || !upJson?.success) throw new Error(upJson?.error || 'Upload foto profil gagal')
        photoUrl = upJson.url
      } else if (editKaryawanPhotoPreview === null && editKaryawanTarget.photoUrl) {
        photoUrl = null
      }

      const res = await fetch(`/api/karyawan/${editKaryawanTarget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          status: editKaryawanStatus,
          ...(typeof photoUrl !== 'undefined' ? { photoUrl } : {}),
        }),
      })
      const json = await res.json().catch(() => ({} as any))
      if (!res.ok) throw new Error((json as any)?.error || 'Gagal menyimpan perubahan')
      toast.success('Perubahan tersimpan', { id: loadingToast })
      setOpenEditKaryawan(false)
      setEditKaryawanTarget(null)
      await Promise.all([mutateKaryawanList(), mutateSummary()])
      if (selectedUser?.id === editKaryawanTarget.id) {
        setSelectedUser((prev: any) => prev ? { ...prev, name, status: editKaryawanStatus, photoUrl: typeof photoUrl === 'undefined' ? prev.photoUrl : photoUrl } : prev)
      }
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menyimpan perubahan', { id: loadingToast })
    } finally {
      setEditKaryawanSubmitting(false)
    }
  }, [editKaryawanTarget, editKaryawanName, editKaryawanStatus, editKaryawanPhotoFile, editKaryawanPhotoPreview, mutateKaryawanList, mutateSummary])

  const requestDeleteKaryawan = useCallback((id: number) => {
    setDeleteKaryawanId(id)
    setOpenDeleteKaryawan(true)
  }, [])

  const handleConfirmDeleteKaryawan = useCallback(async (rows: Row[]) => {
    if (deleteKaryawanId == null) return
    try {
      const alreadyPending = rows.find((r) => r.karyawan.id === deleteKaryawanId)?.karyawan?.deleteRequestPending
      if (alreadyPending) {
        toast.error('Permohonan hapus sudah diajukan')
        return
      }
      const res = await fetch(`/api/karyawan/delete-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ karyawanId: deleteKaryawanId, reason: 'Permintaan dari Detail Kebun (Absensi)' }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({} as any))
        toast.error((err as any).error || 'Gagal mengajukan permintaan penghapusan')
        return
      }
      toast.success('Permintaan penghapusan diajukan')
      await Promise.all([mutateKaryawanList(), mutateSummary()])
    } finally {
      setOpenDeleteKaryawan(false)
      setDeleteKaryawanId(null)
    }
  }, [deleteKaryawanId, mutateKaryawanList, mutateSummary])

  return {
    openAddKaryawan, setOpenAddKaryawan,
    addKaryawanLoading,
    addKaryawanName, setAddKaryawanName,
    addKaryawanStatus, setAddKaryawanStatus,
    addKaryawanPhotoFile, setAddKaryawanPhotoFile,
    addKaryawanPhotoPreview, setAddKaryawanPhotoPreview,
    handleCreateKaryawan,
    openEditKaryawan, setOpenEditKaryawan,
    editKaryawanSubmitting,
    editKaryawanTarget,
    editKaryawanName, setEditKaryawanName,
    editKaryawanStatus, setEditKaryawanStatus,
    editKaryawanPhotoFile, setEditKaryawanPhotoFile,
    editKaryawanPhotoPreview, setEditKaryawanPhotoPreview,
    openEditKaryawanModal,
    handleUpdateKaryawan,
    openDeleteKaryawan, setOpenDeleteKaryawan,
    requestDeleteKaryawan,
    handleConfirmDeleteKaryawan,
  }
}
