
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
      setFormData({ 
        name: pabrik.name, 
        address: pabrik.address || '',
        perusahaanId: (pabrik as any).perusahaanId?.toString() || ''
      });
    } else {
      setFormData({ name: '', address: '', perusahaanId: '' });
    }
  }, [pabrik]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ 
      ...formData, 
      id: pabrik?.id,
      perusahaanId: (formData.perusahaanId && formData.perusahaanId !== 'none') ? parseInt(formData.perusahaanId) : null
    });
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 overflow-hidden [&>button.absolute]:hidden rounded-2xl">
        <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-500 text-white">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
                <BuildingOfficeIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-white">{pabrik ? 'Ubah Pabrik Sawit' : 'Tambah Pabrik Sawit'}</DialogTitle>
                <DialogDescription className="text-blue-100 text-xs">
                  Isi formulir di bawah ini untuk {pabrik ? 'mengubah' : 'menambah'} data pabrik sawit.
                </DialogDescription>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="h-9 w-9 rounded-md border border-white/70 bg-white text-blue-600 flex items-center justify-center hover:bg-white/90"
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
                value={formData.perusahaanId}
                onChange={e => setFormData({ ...formData, perusahaanId: e.target.value })}
                className="w-full h-10 px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              >
                <option value="none">Tanpa Perusahaan</option>
                {perusahaans.map((p) => (
                  <option key={p.id} value={p.id.toString()}>
                    {p.name}
                  </option>
                ))}
              </select>
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
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto rounded-full px-6 text-white">
              <CheckIcon className="h-4 w-4 mr-2" />
              Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

