'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { PencilSquareIcon, TrashIcon, PlusIcon, BanknotesIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'

interface KebunDefaultBiaya {
  id: number
  kebunId: number
  deskripsi: string
  hargaSatuan: number
  satuan: string
  isAutoKg: boolean
  createdAt: Date | string
  updatedAt: Date | string
}

export default function DefaultBiayaTab({ kebunId }: { kebunId: number }) {
  const [data, setData] = useState<KebunDefaultBiaya[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsConfirmOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  
  const [isEditing, setIsEditing] = useState(false)
  const [selectedItem, setSelectedItem] = useState<KebunDefaultBiaya | null>(null)
  
  const [form, setForm] = useState({
    deskripsi: '',
    hargaSatuan: 0,
    satuan: 'Kg',
    isAutoKg: false,
  })

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/kebun/${kebunId}/default-biaya`)
      if (res.ok) {
        const json = await res.json()
        setData(json.data || [])
      }
    } catch (error) {
      console.error(error)
      toast.error('Gagal mengambil data biaya default')
    } finally {
      setLoading(false)
    }
  }, [kebunId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const url = isEditing 
      ? `/api/kebun/${kebunId}/default-biaya/${selectedItem?.id}`
      : `/api/kebun/${kebunId}/default-biaya`
    
    try {
      const res = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      
      if (res.ok) {
        toast.success(isEditing ? 'Biaya diperbarui' : 'Biaya ditambahkan')
        resetForm()
        fetchData()
      } else {
        const json = await res.json()
        throw new Error(json.error || 'Gagal menyimpan data')
      }
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      const res = await fetch(`/api/kebun/${kebunId}/default-biaya/${deleteId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        toast.success('Biaya dihapus')
        fetchData()
      } else {
        throw new Error('Gagal menghapus data')
      }
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsConfirmOpen(false)
      setDeleteId(null)
    }
  }

  const resetForm = () => {
    setForm({ deskripsi: '', hargaSatuan: 0, satuan: 'Kg', isAutoKg: false })
    setIsEditing(false)
    setSelectedItem(null)
  }

  const startEdit = (item: KebunDefaultBiaya) => {
    setSelectedItem(item)
    setForm({
      deskripsi: item.deskripsi,
      hargaSatuan: item.hargaSatuan,
      satuan: item.satuan,
      isAutoKg: item.isAutoKg,
    })
    setIsEditing(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const formatCurrency = (num: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num)

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-50 rounded-lg">
            <BanknotesIcon className="w-5 h-5 text-blue-600" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">Pengaturan Biaya Default</h2>
        </div>

        <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end bg-gray-50/50 p-4 rounded-2xl border border-dashed border-gray-200 mb-8">
          <div className="space-y-1.5 lg:col-span-2">
            <Label className="text-xs font-semibold uppercase text-gray-500">Deskripsi Biaya</Label>
            <Input 
              placeholder="Contoh: Biaya Panen" 
              value={form.deskripsi} 
              onChange={e => setForm({...form, deskripsi: e.target.value})}
              className="rounded-xl h-10 bg-white"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase text-gray-500">Harga Satuan</Label>
            <Input 
              type="number" 
              placeholder="0" 
              value={form.hargaSatuan} 
              onChange={e => setForm({...form, hargaSatuan: Number(e.target.value)})}
              className="rounded-xl h-10 bg-white"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase text-gray-500">Satuan</Label>
            <Input 
              placeholder="Kg, HK, dll" 
              value={form.satuan} 
              onChange={e => setForm({...form, satuan: e.target.value})}
              className="rounded-xl h-10 bg-white"
              required
            />
          </div>
          <div className="flex items-center gap-2 h-10">
            <Checkbox 
              id="isAutoKg" 
              checked={form.isAutoKg} 
              onCheckedChange={(checked) => setForm({...form, isAutoKg: !!checked})}
            />
            <Label htmlFor="isAutoKg" className="text-sm font-medium cursor-pointer">Auto-KG?</Label>
          </div>
          <div className="flex gap-2 lg:col-span-5 justify-end mt-2">
            {isEditing && (
              <Button type="button" variant="ghost" onClick={resetForm} className="rounded-full">Batal</Button>
            )}
            <Button type="submit" className="rounded-full bg-blue-600 hover:bg-blue-700 px-8">
              <PlusIcon className="w-4 h-4 mr-2" />
              {isEditing ? 'Simpan Perubahan' : 'Tambah Biaya'}
            </Button>
          </div>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left">
                <th className="px-4 py-3 font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Deskripsi</th>
                <th className="px-4 py-3 font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Harga</th>
                <th className="px-4 py-3 font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Satuan</th>
                <th className="px-4 py-3 font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Auto-KG</th>
                <th className="px-4 py-3 font-semibold text-gray-500 uppercase tracking-wider text-[10px] text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                Array.from({length: 3}).map((_, i) => (
                  <tr key={i}><td colSpan={5} className="px-4 py-4"><Skeleton className="h-10 w-full rounded-xl" /></td></tr>
                ))
              ) : data.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Belum ada biaya default yang diatur.</td></tr>
              ) : (
                data.map((item) => (
                  <tr key={item.id} className="group hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-4 font-medium text-gray-900">{item.deskripsi}</td>
                    <td className="px-4 py-4 text-gray-700 font-semibold">{formatCurrency(item.hargaSatuan)}</td>
                    <td className="px-4 py-4 text-gray-500">{item.satuan}</td>
                    <td className="px-4 py-4">
                      {item.isAutoKg ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-100 uppercase">Ya</span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full bg-gray-50 text-gray-500 text-[10px] font-bold border border-gray-100 uppercase">Tidak</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full text-blue-600 hover:bg-blue-50" onClick={() => startEdit(item)}>
                          <PencilSquareIcon className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full text-red-600 hover:bg-red-50" onClick={() => { setDeleteId(item.id); setIsConfirmOpen(true) }}>
                          <TrashIcon className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmationModal 
        isOpen={isModalOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Hapus Biaya Default"
        description="Apakah Anda yakin ingin menghapus biaya default ini? Data yang sudah digunakan pada gajian sebelumnya tidak akan terpengaruh."
        variant="red"
      />
    </div>
  )
}
