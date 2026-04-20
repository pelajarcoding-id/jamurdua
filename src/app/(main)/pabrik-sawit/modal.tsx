
'use client'

import { useState, useEffect } from 'react'
import { PabrikSawit } from '@/lib/definitions'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BuildingOfficeIcon, XMarkIcon, CheckIcon } from "@heroicons/react/24/outline";

interface PabrikSawitModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: any) => void
  pabrik: PabrikSawit | null
}

export default function PabrikSawitModal({ isOpen, onClose, onSave, pabrik }: PabrikSawitModalProps) {
  const [formData, setFormData] = useState({ name: '', address: '', perusahaanId: '' });
  const [perusahaanIds, setPerusahaanIds] = useState<number[]>([]);
  const [defaultPerusahaanId, setDefaultPerusahaanId] = useState<string>('');
  const [perusahaans, setPerusahaans] = useState<any[]>([]);

  useEffect(() => {
    const fetchPerusahaans = async () => {
      try {
        const res = await fetch('/api/perusahaan?limit=100');
        const data = await res.json();
        setPerusahaans(data.data);
      } catch (error) {
        console.error('Failed to fetch perusahaans');
      }
    };
    if (isOpen) fetchPerusahaans();
  }, [isOpen]);

  useEffect(() => {
    if (pabrik) {
      const options = Array.isArray((pabrik as any).perusahaanOptions) ? (pabrik as any).perusahaanOptions : []
      const ids = options.map((o: any) => Number(o?.id)).filter((n: number) => Number.isFinite(n) && n > 0)
      const defaultOpt = options.find((o: any) => !!o?.isDefault) || null
      const defaultId = defaultOpt?.id ? String(defaultOpt.id) : (pabrik as any).perusahaanId?.toString() || ''
      setFormData({ 
        name: pabrik.name, 
        address: pabrik.address || '',
        perusahaanId: (pabrik as any).perusahaanId?.toString() || ''
      });
      setPerusahaanIds(ids);
      setDefaultPerusahaanId(defaultId);
    } else {
      setFormData({ name: '', address: '', perusahaanId: '' });
      setPerusahaanIds([]);
      setDefaultPerusahaanId('');
    }
  }, [pabrik]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalIds = Array.from(new Set(perusahaanIds)).filter((n) => Number.isFinite(n) && n > 0)
    const defaultIdNum = defaultPerusahaanId ? Number(defaultPerusahaanId) : null
    const finalDefault = defaultIdNum && Number.isFinite(defaultIdNum) && defaultIdNum > 0 ? defaultIdNum : null
    onSave({ 
      ...formData, 
      id: pabrik?.id,
      perusahaanIds: finalIds,
      defaultPerusahaanId: finalDefault,
      perusahaanId: finalDefault
    });
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 overflow-hidden [&>button.absolute]:hidden rounded-2xl">
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
                <BuildingOfficeIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-white">{pabrik ? 'Ubah Pabrik Sawit' : 'Tambah Pabrik Sawit'}</DialogTitle>
                <DialogDescription className="text-emerald-100 text-xs">
                  Isi formulir di bawah ini untuk {pabrik ? 'mengubah' : 'menambah'} data pabrik sawit.
                </DialogDescription>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="h-9 w-9 rounded-md border border-white/70 bg-white text-emerald-600 flex items-center justify-center hover:bg-white/90"
              aria-label="Tutup"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nama Pabrik</Label>
              <Input 
                id="name"
                type="text" 
                value={formData.name} 
                onChange={e => setFormData({ ...formData, name: e.target.value })} 
                className="rounded-xl border-gray-200" 
                placeholder="Contoh: Pabrik Sawit Utama"
                required 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="perusahaanId">Perusahaan Penjual</Label>
              <select
                id="perusahaanId"
                value={defaultPerusahaanId}
                onChange={e => setDefaultPerusahaanId(e.target.value)}
                className="w-full h-10 px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
              >
                <option value="">-- Pilih Default --</option>
                {perusahaans
                  .filter((p) => perusahaanIds.includes(Number(p.id)))
                  .map((p) => (
                    <option key={p.id} value={p.id.toString()}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Perusahaan Terikat</Label>
              <div className="grid grid-cols-1 gap-2 max-h-44 overflow-y-auto rounded-xl border border-gray-200 p-3">
                {perusahaans.map((p) => {
                  const id = Number(p.id)
                  const checked = perusahaanIds.includes(id)
                  return (
                    <label key={p.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? Array.from(new Set([...perusahaanIds, id]))
                            : perusahaanIds.filter((x) => x !== id)
                          setPerusahaanIds(next)
                          if (!next.includes(Number(defaultPerusahaanId || 0))) setDefaultPerusahaanId(next.length === 1 ? String(next[0]) : '')
                        }}
                      />
                      <span className="text-gray-800">{p.name}</span>
                    </label>
                  )
                })}
              </div>
              <div className="text-xs text-gray-500">Jika lebih dari 1 perusahaan terikat, nota sawit wajib memilih perusahaan.</div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Alamat</Label>
              <Input 
                id="address"
                type="text" 
                value={formData.address} 
                onChange={e => setFormData({ ...formData, address: e.target.value })} 
                className="rounded-xl border-gray-200" 
                placeholder="Alamat lengkap pabrik"
              />
            </div>
          </div>

          <DialogFooter className="bg-gray-50 border-t px-6 py-4 flex flex-col-reverse sm:flex-row gap-3 sm:gap-2 sm:justify-between -mx-6 -mb-5 mt-6">
            <Button type="button" variant="outline" onClick={onClose} className="w-full sm:w-auto rounded-full px-6">
              <XMarkIcon className="h-4 w-4 mr-2" />
              Batal
            </Button>
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 w-full sm:w-auto rounded-full px-6 text-white">
              <CheckIcon className="h-4 w-4 mr-2" />
              Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

