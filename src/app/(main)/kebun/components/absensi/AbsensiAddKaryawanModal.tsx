'use client'

import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { ModalHeader, ModalContentWrapper, ModalFooter } from '@/components/ui/modal-elements'
import ImageUpload from '@/components/ui/ImageUpload'

interface AbsensiAddKaryawanModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  name: string
  onNameChange: (val: string) => void
  status: string
  onStatusChange: (val: string) => void
  photoPreview: string | null
  onPhotoChange: (file: File | null) => void
  onPhotoPreviewChange: (url: string | null) => void
  loading: boolean
  onSubmit: () => void
}

export function AbsensiAddKaryawanModal({
  open,
  onOpenChange,
  name,
  onNameChange,
  status,
  onStatusChange,
  photoPreview,
  onPhotoChange,
  onPhotoPreviewChange,
  loading,
  onSubmit
}: AbsensiAddKaryawanModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[92vw] sm:w-full sm:max-w-md bg-white rounded-3xl p-0 overflow-hidden shadow-2xl border-none [&>button.absolute]:hidden flex flex-col max-h-[85vh]">
        <ModalHeader
          title="Tambah Karyawan Baru"
          subtitle="Masukkan informasi dasar karyawan"
          variant="emerald"
          onClose={() => onOpenChange(false)}
        />
        <ModalContentWrapper className="space-y-5 overflow-y-auto scrollbar-hide flex-1">
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Nama Lengkap</Label>
            <Input
              placeholder="Contoh: Budi Santoso"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              className="rounded-2xl h-12 border-gray-100 bg-gray-50/50 focus:bg-white transition-all"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Status Awal</Label>
            <div className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-4">
              <div className="text-sm text-gray-700">{status === 'AKTIF' ? 'Aktif' : 'Nonaktif'}</div>
              <Switch
                checked={status === 'AKTIF'}
                onCheckedChange={(checked) => onStatusChange(checked ? 'AKTIF' : 'NONAKTIF')}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Foto Profil (Opsional)</Label>
            <ImageUpload
              previewUrl={photoPreview}
              onFileChange={(file) => {
                onPhotoChange(file)
                if (!file) {
                  onPhotoPreviewChange(null)
                  return
                }
                onPhotoPreviewChange(URL.createObjectURL(file))
              }}
            />
          </div>
        </ModalContentWrapper>
        <ModalFooter className="sm:justify-end">
          <Button className="rounded-full w-full sm:w-auto" variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button
            className="rounded-full w-full sm:w-auto bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={onSubmit}
            disabled={loading}
          >
            {loading ? 'Menyimpan...' : 'Simpan Karyawan'}
          </Button>
        </ModalFooter>
      </DialogContent>
    </Dialog>
  )
}
