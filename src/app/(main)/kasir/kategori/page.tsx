'use client'

import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/components/AuthProvider'
import { ModalHeader, ModalContentWrapper } from '@/components/ui/modal-elements'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import { TagIcon } from '@heroicons/react/24/outline'
import { cn } from '@/lib/utils'

type KasKategoriRow = {
  code: string
  label: string
  tipe: 'PEMASUKAN' | 'PENGELUARAN' | 'BOTH'
  isActive: boolean
}

export default function KasKategoriPage() {
  const { role } = useAuth()
  const canManage = role === 'ADMIN' || role === 'PEMILIK'

  const [rows, setRows] = useState<KasKategoriRow[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [filterTipe, setFilterTipe] = useState<'ALL' | 'PEMASUKAN' | 'PENGELUARAN' | 'BOTH'>('ALL')

  const [newCode, setNewCode] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [newTipe, setNewTipe] = useState<'PEMASUKAN' | 'PENGELUARAN' | 'BOTH'>('BOTH')

  const [editCode, setEditCode] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editTipe, setEditTipe] = useState<'PEMASUKAN' | 'PENGELUARAN' | 'BOTH'>('BOTH')
  const [editActive, setEditActive] = useState(true)
  const [deleteCode, setDeleteCode] = useState<string | null>(null)

  const normalizeTipe = (v: any): KasKategoriRow['tipe'] => {
    const t = String(v || 'BOTH').toUpperCase()
    if (t === 'PEMASUKAN' || t === 'PENGELUARAN' || t === 'BOTH') return t
    return 'BOTH'
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => {
      if (filterTipe !== 'ALL' && r.tipe !== filterTipe) return false
      if (!q) return true
      return r.code.toLowerCase().includes(q) || r.label.toLowerCase().includes(q)
    })
  }, [rows, query, filterTipe])

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/kas-kategori?activeOnly=false')
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || 'Gagal memuat kategori')
      }
      const data = await res.json()
      const mapped: KasKategoriRow[] = Array.isArray(data)
        ? data.map((r: any) => ({
            code: String(r?.code || '').toUpperCase(),
            label: String(r?.label || r?.code || '').trim() || String(r?.code || '').toUpperCase(),
            tipe: normalizeTipe(r?.tipe),
            isActive: !!r?.isActive,
          }))
        : []
      setRows(mapped.filter((r) => !!r.code))
    } catch (e: any) {
      toast.error(e?.message || 'Gagal memuat kategori')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const startEdit = (r: KasKategoriRow) => {
    setEditCode(r.code)
    setEditLabel(r.label)
    setEditTipe(r.tipe)
    setEditActive(r.isActive)
  }

  const cancelEdit = () => {
    setEditCode(null)
    setEditLabel('')
    setEditTipe('BOTH')
    setEditActive(true)
  }

  const handleDelete = async () => {
    if (!canManage) return
    if (!deleteCode) return
    try {
      setLoading(true)
      const res = await fetch(`/api/kas-kategori?code=${encodeURIComponent(deleteCode)}`, { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'Gagal menghapus kategori')
      toast.success('Kategori berhasil dihapus')
      await load()
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menghapus kategori')
    } finally {
      setLoading(false)
      setDeleteCode(null)
    }
  }

  const save = async (payload: { code: string; label: string; tipe: KasKategoriRow['tipe']; isActive: boolean }) => {
    const res = await fetch('/api/kas-kategori', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json?.error || 'Gagal menyimpan kategori')
  }

  const submitNew = async () => {
    if (!canManage) return
    const code = newCode.trim().toUpperCase()
    const label = newLabel.trim()
    if (!code || !label) {
      toast.error('Kode dan label wajib diisi')
      return
    }
    try {
      setLoading(true)
      await save({ code, label, tipe: newTipe, isActive: true })
      setNewCode('')
      setNewLabel('')
      setNewTipe('BOTH')
      await load()
      toast.success('Kategori berhasil disimpan')
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menyimpan kategori')
    } finally {
      setLoading(false)
    }
  }

  const submitEdit = async () => {
    if (!canManage) return
    if (!editCode) return
    const code = editCode
    const label = editLabel.trim()
    if (!label) {
      toast.error('Label wajib diisi')
      return
    }
    try {
      setLoading(true)
      await save({ code, label, tipe: editTipe, isActive: editActive })
      await load()
      cancelEdit()
      toast.success('Kategori berhasil diperbarui')
    } catch (e: any) {
      toast.error(e?.message || 'Gagal memperbarui kategori')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <ModalHeader
            title="Master Kategori Kas"
            subtitle="Kelola kategori transaksi kas berdasarkan tipe pemasukan/pengeluaran"
            variant="emerald"
            icon={<TagIcon className="h-5 w-5 text-white" />}
            onClose={() => history.back()}
          />

          <ModalContentWrapper className="space-y-6">
            <ConfirmationModal
              isOpen={!!deleteCode}
              onClose={() => setDeleteCode(null)}
              onConfirm={handleDelete}
              title="Hapus Kategori"
              description={`Hapus kategori ${deleteCode || ''}? Kategori hanya bisa dihapus jika belum ada transaksi.`}
              variant="red"
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <Label>Cari</Label>
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari kode atau label..." className="rounded-xl" />
              </div>
              <div>
                <Label>Filter Tipe</Label>
                <select
                  className="input-style rounded-xl w-full"
                  value={filterTipe}
                  onChange={(e) => setFilterTipe(e.target.value as any)}
                >
                  <option value="ALL">Semua</option>
                  <option value="PEMASUKAN">Pemasukan</option>
                  <option value="PENGELUARAN">Pengeluaran</option>
                  <option value="BOTH">Bisa Keduanya</option>
                </select>
              </div>
            </div>

            {canManage && (
              <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4 space-y-3">
                <div className="text-sm font-semibold text-gray-900">Tambah Kategori</div>
                <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
                  <div className="md:col-span-2">
                    <Label>Kode</Label>
                    <Input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="MISAL: BBM" className="rounded-xl" />
                  </div>
                  <div className="md:col-span-3">
                    <Label>Label</Label>
                    <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Misal: BBM / Solar" className="rounded-xl" />
                  </div>
                  <div className="md:col-span-1">
                    <Label>Tipe</Label>
                    <select className="input-style rounded-xl w-full" value={newTipe} onChange={(e) => setNewTipe(e.target.value as any)}>
                      <option value="BOTH">BOTH</option>
                      <option value="PEMASUKAN">MASUK</option>
                      <option value="PENGELUARAN">KELUAR</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white" onClick={submitNew} disabled={loading}>
                    Simpan
                  </Button>
                </div>
              </div>
            )}

            {!canManage && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                Hanya ADMIN/PEMILIK yang bisa mengubah master kategori. Anda bisa melihat daftar kategori.
              </div>
            )}

            <div className="rounded-2xl border border-gray-100 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-xs font-semibold text-gray-600">
                  <tr>
                    <th className="px-4 py-3 text-left">Kode</th>
                    <th className="px-4 py-3 text-left">Label</th>
                    <th className="px-4 py-3 text-left">Tipe</th>
                    <th className="px-4 py-3 text-right">Aktif</th>
                    {canManage && <th className="px-4 py-3 text-right">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={canManage ? 5 : 4} className="px-4 py-6 text-center text-gray-500">Tidak ada kategori</td>
                    </tr>
                  ) : (
                    filtered.map((r) => {
                      const isEditing = editCode === r.code
                      if (isEditing) {
                        return (
                          <tr key={r.code} className="bg-emerald-50/40">
                            <td className="px-4 py-3 font-semibold text-gray-900 align-middle">{r.code}</td>
                            <td className="px-4 py-3">
                              <Input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} className="rounded-xl" />
                            </td>
                            <td className="px-4 py-3">
                              <select className="input-style rounded-xl w-full" value={editTipe} onChange={(e) => setEditTipe(e.target.value as any)}>
                                <option value="BOTH">BOTH</option>
                                <option value="PEMASUKAN">MASUK</option>
                                <option value="PENGELUARAN">KELUAR</option>
                              </select>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-3">
                                <Switch checked={editActive} onCheckedChange={(v) => setEditActive(!!v)} />
                              </div>
                            </td>
                            {canManage && (
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap justify-end gap-2">
                                  <Button
                                    variant="outline"
                                    className="rounded-full"
                                    onClick={cancelEdit}
                                    disabled={loading}
                                  >
                                    Batal
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    className="rounded-full"
                                    onClick={() => setDeleteCode(r.code)}
                                    disabled={loading}
                                  >
                                    Hapus
                                  </Button>
                                  <Button
                                    className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white"
                                    onClick={submitEdit}
                                    disabled={loading}
                                  >
                                    Simpan
                                  </Button>
                                </div>
                              </td>
                            )}
                          </tr>
                        )
                      }
                      return (
                        <tr key={r.code} className="bg-white">
                          <td className="px-4 py-3 font-semibold text-gray-900">{r.code}</td>
                          <td className="px-4 py-3 text-gray-700">{r.label}</td>
                          <td className="px-4 py-3 text-gray-700">{r.tipe}</td>
                          <td className="px-4 py-3 text-right">
                            <span className={cn("text-xs font-semibold", r.isActive ? "text-emerald-700" : "text-gray-400")}>
                              {r.isActive ? 'Aktif' : 'Nonaktif'}
                            </span>
                          </td>
                          {canManage && (
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-2">
                                <Button variant="outline" className="rounded-full" onClick={() => startEdit(r)} disabled={loading}>
                                  Ubah
                                </Button>
                                <Button variant="destructive" className="rounded-full" onClick={() => setDeleteCode(r.code)} disabled={loading}>
                                  Hapus
                                </Button>
                              </div>
                            </td>
                          )}
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </ModalContentWrapper>
        </div>
      </div>
    </main>
  )
}
