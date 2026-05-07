'use client'

import { useState, useCallback, useEffect } from 'react'
import toast from 'react-hot-toast'

interface KategoriMaster {
  id: number
  name: string
}

interface UseKategoriMasterProps {
  kebunId: number
  mode?: 'aktivitas' | 'borongan'
}

export function useKategoriMaster({ kebunId, mode }: UseKategoriMasterProps) {
  const [kategoriMaster, setKategoriMaster] = useState<KategoriMaster[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [editId, setEditId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [isEditSaving, setIsEditSaving] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<KategoriMaster | null>(null)

  const fetchKategoriMaster = useCallback(async () => {
    if (mode !== 'borongan') return
    try {
      const res = await fetch(`/api/kebun/${kebunId}/borongan/categories`, { cache: 'no-store' })
      if (!res.ok) {
        setKategoriMaster([])
        return
      }
      const json = await res.json().catch(() => ({} as any))
      const rows = Array.isArray(json?.data) ? json.data : []
      const mapped = rows
        .map((r: any) => ({ id: Number(r?.id), name: String(r?.name || '').trim() }))
        .filter((r: any) => Number.isFinite(r.id) && r.id > 0 && r.name)
      setKategoriMaster(mapped)
    } catch {
      setKategoriMaster([])
    }
  }, [kebunId, mode])

  const addKategori = useCallback(async () => {
    if (mode !== 'borongan') return
    if (isSaving) return
    const name = String(draft || '').trim()
    if (!name) return

    setIsSaving(true)
    try {
      const res = await fetch(`/api/kebun/${kebunId}/borongan/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const json = await res.json().catch(() => ({} as any))
      if (!res.ok) throw new Error(json?.error || 'Gagal menambahkan kategori')
      setDraft('')
      await fetchKategoriMaster()
      toast.success('Kategori ditambahkan')
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menambahkan kategori')
    } finally {
      setIsSaving(false)
    }
  }, [draft, fetchKategoriMaster, isSaving, kebunId, mode])

  const deleteKategori = useCallback(async (id: number) => {
    if (mode !== 'borongan') return
    if (deletingId) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/kebun/${kebunId}/borongan/categories?id=${encodeURIComponent(String(id))}`, {
        method: 'DELETE',
      })
      const json = await res.json().catch(() => ({} as any))
      if (!res.ok) throw new Error(json?.error || 'Gagal menghapus kategori')
      await fetchKategoriMaster()
      toast.success('Kategori dihapus')
      return true
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menghapus kategori')
      return false
    } finally {
      setDeletingId(null)
    }
  }, [deletingId, fetchKategoriMaster, kebunId, mode])

  const startEdit = useCallback((k: KategoriMaster) => {
    setEditId(k.id)
    setEditName(k.name)
  }, [])

  const cancelEdit = useCallback(() => {
    setEditId(null)
    setEditName('')
  }, [])

  const saveEdit = useCallback(async () => {
    if (mode !== 'borongan') return
    if (!editId) return
    if (isEditSaving) return
    const name = String(editName || '').trim()
    if (!name) {
      toast.error('Nama kategori wajib diisi')
      return
    }
    setIsEditSaving(true)
    try {
      const res = await fetch(`/api/kebun/${kebunId}/borongan/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editId, name }),
      })
      const json = await res.json().catch(() => ({} as any))
      if (!res.ok) throw new Error(json?.error || 'Gagal mengubah kategori')
      await fetchKategoriMaster()
      toast.success('Kategori diperbarui')
      setEditId(null)
      setEditName('')
    } catch (e: any) {
      toast.error(e?.message || 'Gagal mengubah kategori')
    } finally {
      setIsEditSaving(false)
    }
  }, [editId, editName, fetchKategoriMaster, isEditSaving, kebunId, mode])

  const openDelete = useCallback((k: KategoriMaster) => {
    setDeleteTarget(k)
    setDeleteOpen(true)
  }, [])

  const closeDelete = useCallback(() => {
    setDeleteOpen(false)
    setDeleteTarget(null)
  }, [])

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return
    await deleteKategori(deleteTarget.id)
    closeDelete()
  }, [deleteKategori, deleteTarget, closeDelete])

  useEffect(() => {
    fetchKategoriMaster()
  }, [fetchKategoriMaster])

  return {
    list: kategoriMaster,
    isOpen,
    setIsOpen,
    draft,
    setDraft,
    isSaving,
    deletingId,
    editId,
    editName,
    setEditName,
    isEditSaving,
    deleteOpen,
    deleteTarget,
    fetch: fetchKategoriMaster,
    add: addKategori,
    delete: deleteKategori,
    startEdit,
    cancelEdit,
    saveEdit,
    openDelete,
    closeDelete,
    confirmDelete,
  }
}
