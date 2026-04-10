'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MapPinIcon, XMarkIcon, CheckIcon } from '@heroicons/react/24/outline'
import { ModalHeader, ModalContentWrapper, ModalFooter } from '@/components/ui/modal-elements'

interface KebunModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: any) => void
  kebun: any | null
}

export default function KebunModal({ isOpen, onClose, onSave, kebun }: KebunModalProps) {
  const [formData, setFormData] = useState({ name: '', location: '' });

  useEffect(() => {
    if (kebun) {
      setFormData({ 
        name: kebun.name, 
        location: kebun.location || ''
      });
    } else {
      setFormData({ name: '', location: '' });
    }
  }, [kebun]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ 
      ...formData, 
      id: kebun?.id
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-white w-[95vw] sm:max-w-md rounded-2xl p-0 overflow-hidden [&>button.absolute]:hidden">
        <ModalHeader
          title={kebun ? 'Edit Kebun' : 'Tambah Kebun Baru'}
          variant="emerald"
          icon={<MapPinIcon className="h-5 w-5 text-white" />}
          onClose={onClose}
        />

        <form onSubmit={handleSubmit}>
          <ModalContentWrapper className="space-y-4">
            <div className="space-y-2">
              <Label>Nama Kebun</Label>
              <Input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="Contoh: Kebun Sarakan Utama"
                className="rounded-xl"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Lokasi</Label>
              <Input
                type="text"
                value={formData.location}
                onChange={e => setFormData({ ...formData, location: e.target.value })}
                placeholder="Contoh: Sei Rumbia, Labuhanbatu"
                className="rounded-xl"
              />
            </div>
          </ModalContentWrapper>
          <ModalFooter>
            <Button type="button" variant="outline" onClick={onClose} className="rounded-full">
              <XMarkIcon className="h-4 w-4 mr-2" />
              Batal
            </Button>
            <Button type="submit" className="rounded-full bg-emerald-600 hover:bg-emerald-700">
              <CheckIcon className="h-4 w-4 mr-2" />
              Simpan
            </Button>
          </ModalFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
