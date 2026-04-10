
'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BuildingOfficeIcon, XMarkIcon, PhotoIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { ModalContentWrapper, ModalFooter, ModalHeader } from '@/components/ui/modal-elements'

interface PerusahaanModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: any) => void
  perusahaan: any | null
}

export default function PerusahaanModal({ isOpen, onClose, onSave, perusahaan }: PerusahaanModalProps) {
  const [formData, setFormData] = useState({ 
    name: '', 
    address: '',
    email: '',
    phone: '',
    logoUrl: ''
  });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (perusahaan) {
      setFormData({ 
        name: perusahaan.name, 
        address: perusahaan.address || '',
        email: perusahaan.email || '',
        phone: perusahaan.phone || '',
        logoUrl: perusahaan.logoUrl || ''
      });
    } else {
      setFormData({ 
        name: '', 
        address: '',
        email: '',
        phone: '',
        logoUrl: ''
      });
    }
  }, [perusahaan]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Ukuran file terlalu besar (maks 2MB)');
      return;
    }

    setUploading(true);
    const uploadFormData = new FormData();
    uploadFormData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: uploadFormData,
      });
      const data = await res.json();
      if (data.success) {
        setFormData(prev => ({ ...prev, logoUrl: data.url }));
        toast.success('Logo berhasil diupload');
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast.error('Gagal mengupload logo');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...formData, id: perusahaan?.id });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-white w-[95vw] sm:max-w-md top-[calc(12px+env(safe-area-inset-top))] translate-y-0 sm:top-[50%] sm:translate-y-[-50%] max-h-[calc(100dvh-24px-env(safe-area-inset-top)-env(safe-area-inset-bottom))] sm:max-h-[92vh] rounded-2xl p-0 overflow-hidden flex flex-col [&>button.absolute]:hidden">
        <ModalHeader
          title={perusahaan ? 'Edit Perusahaan' : 'Tambah Perusahaan Baru'}
          variant="emerald"
          icon={<BuildingOfficeIcon className="h-5 w-5 text-white" />}
          onClose={onClose}
        />

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <ModalContentWrapper className="space-y-4 flex-1 min-h-0 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <div className="flex flex-col items-center gap-4 p-4 border-2 border-dashed border-gray-100 rounded-2xl bg-gray-50/50">
              <div className="relative h-24 w-24 rounded-2xl bg-white border border-gray-200 flex items-center justify-center overflow-hidden shadow-sm group">
                {formData.logoUrl ? (
                  <>
                    <img 
                      src={`${formData.logoUrl}?t=${Date.now()}`} 
                      alt="Logo Preview" 
                      className="h-full w-full object-contain p-2"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = 'https://placehold.co/400x400?text=Error+Loading+Logo';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, logoUrl: '' }))}
                      className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <XMarkIcon className="h-6 w-6 text-white" />
                    </button>
                  </>
                ) : (
                  <PhotoIcon className="h-10 w-10 text-gray-300" />
                )}
                {uploading && (
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                    <div className="h-5 w-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
              <div className="flex flex-col items-center gap-1">
                <label className="relative cursor-pointer bg-white px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold text-emerald-700 hover:bg-emerald-50 transition-colors shadow-sm">
                  <span>{formData.logoUrl ? 'Ganti Logo' : 'Upload Logo'}</span>
                  <input 
                    type="file" 
                    className="sr-only" 
                    accept="image/*"
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                </label>
                <p className="text-[10px] text-gray-400">Format PNG/JPG, Maks 2MB</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nama Perusahaan</Label>
              <Input
                id="name"
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="Contoh: CV. SARAKAN JAYA"
                className="rounded-xl"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@perusahaan.com"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telepon</Label>
              <Input
                id="phone"
                type="text"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                placeholder="0812xxxx"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Alamat</Label>
              <Input
                id="address"
                type="text"
                value={formData.address}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
                placeholder="Alamat lengkap perusahaan"
                className="rounded-xl"
              />
            </div>
          </ModalContentWrapper>
          <ModalFooter className="pt-5 pb-[calc(24px+env(safe-area-inset-bottom))] sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-full px-6">
              Batal
            </Button>
            <Button type="submit" className="rounded-full bg-emerald-600 hover:bg-emerald-700 px-6">
              Simpan
            </Button>
          </ModalFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
