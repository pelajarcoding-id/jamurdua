'use client'

import { useState, useEffect, useRef, SyntheticEvent } from 'react'
import { TimbanganData } from './columns'
import { Kebun, User, Kendaraan } from '@prisma/client'
import toast from 'react-hot-toast'
import ImageUpload from '@/components/ui/ImageUpload';
import ReactCrop, { type Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Button } from "@/components/ui/button";
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { DocumentDuplicateIcon, MapPinIcon, ArrowUpIcon, ArrowDownIcon, UserIcon, TruckIcon, PencilSquareIcon, PhotoIcon, XMarkIcon, CheckIcon } from '@heroicons/react/24/outline'
import { ModalContentWrapper, ModalFooter, ModalHeader } from '@/components/ui/modal-elements'

interface TimbanganModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: any) => void
  timbangan: TimbanganData | null
  kebunList: Kebun[]
  supirList: User[]
  kendaraanList: Kendaraan[]
}

export default function TimbanganModal({ isOpen, onClose, onSave, timbangan, kebunList, supirList, kendaraanList }: TimbanganModalProps) {
  const [formData, setFormData] = useState({ 
    kebunId: '', 
    grossKg: '', 
    tareKg: '', 
    supirId: '', 
    kendaraanPlatNomor: '', 
    notes: '',
    photoUrl: ''
  });
  const [kebunQuery, setKebunQuery] = useState('');
  const [supirQuery, setSupirQuery] = useState('');
  const [kendaraanQuery, setKendaraanQuery] = useState('');
  const [openKebun, setOpenKebun] = useState(false);
  const [openSupir, setOpenSupir] = useState(false);
  const [openKendaraan, setOpenKendaraan] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<Crop>();
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (timbangan) {
      setFormData({ 
        kebunId: timbangan.kebunId?.toString() || '', 
        grossKg: timbangan.grossKg?.toString() || '', 
        tareKg: timbangan.tareKg?.toString() || '', 
        supirId: timbangan.supir?.id?.toString() || '', 
        kendaraanPlatNomor: timbangan.kendaraan?.platNomor || '', 
        notes: timbangan.notes || '',
        photoUrl: timbangan.photoUrl || ''
      });
      setPreview(timbangan.photoUrl || null);
    } else {
      setFormData({ 
        kebunId: '', 
        grossKg: '', 
        tareKg: '', 
        supirId: '', 
        kendaraanPlatNomor: '', 
        notes: '',
        photoUrl: ''
      });
      setPreview(null);
    }
    setSelectedFile(null);
  }, [timbangan]);

  const handleFileChangeForCrop = (file: File | null) => {
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
        setIsCropping(true);
      };
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
      setSelectedFile(null);
    }
  };

  function onImageLoad(e: SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget;
    setCrop({
        unit: '%',
        width: 90,
        height: 90,
        x: 5,
        y: 5
    });
  }

  async function getCroppedImg(image: HTMLImageElement, crop: Crop, fileName: string): Promise<File> {
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    
    // Set canvas size to the actual resolution of the cropped image to preserve quality
    canvas.width = Math.floor(crop.width * scaleX);
    canvas.height = Math.floor(crop.height * scaleY);
    
    const ctx = canvas.getContext('2d');

    if (!ctx) throw new Error('No 2d context');

    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      canvas.width,
      canvas.height,
    );

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Canvas is empty'));
            return;
          }
          const base = String(fileName || 'image').replace(/\.[^/.]+$/, '')
          const outName = `${base}.webp`
          resolve(new File([blob], outName, { type: 'image/webp' }));
        }, 'image/webp', 0.9);
    });
  }

  const handleCropConfirm = async () => {
    if (completedCrop?.width && completedCrop?.height && imgRef.current) {
      const croppedImageFile = await getCroppedImg(imgRef.current, completedCrop, 'cropped-timbangan.webp');
      setSelectedFile(croppedImageFile);
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(croppedImageFile);
      setIsCropping(false);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let photoUrl = formData.photoUrl;

    if (selectedFile) {
      const fileData = new FormData();
      fileData.append('file', selectedFile);

      try {
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: fileData,
        });

        if (!response.ok) {
          throw new Error('Gagal mengunggah file');
        }

        const result = await response.json();
        photoUrl = result.url;
      } catch (error) {
        console.error(error);
        toast.error('Gagal mengunggah foto.');
        return;
      }
    }

    const netKg = parseFloat(formData.grossKg) - parseFloat(formData.tareKg);
    if (netKg < 0) {
        toast.error('Gross Kg harus lebih besar dari Tare Kg');
        return;
    }
    onSave({ ...formData, id: timbangan?.id, photoUrl });
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] p-0 overflow-hidden flex flex-col [&>button.absolute]:hidden">
        <ModalHeader
          title={`${timbangan ? 'Edit' : 'Tambah'} Timbangan`}
          subtitle="Isi data timbang kebun secara lengkap"
          variant="emerald"
          className="from-emerald-600 to-emerald-500"
          icon={<DocumentDuplicateIcon className="h-5 w-5 text-white" />}
          onClose={onClose}
        />

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <ModalContentWrapper className="space-y-4 flex-1 min-h-0 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <div>
              <label className="block text-sm font-medium text-gray-700 flex items-center gap-2">
                <MapPinIcon className="h-4 w-4 text-blue-500" />
                Kebun
              </label>
            <Popover open={openKebun} onOpenChange={setOpenKebun}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="input-style w-full flex items-center justify-between rounded-xl"
                  aria-haspopup="listbox"
                >
                  <span>
                    {formData.kebunId
                      ? (kebunList.find(k => String(k.id) === String(formData.kebunId))?.name ?? 'Pilih Kebun')
                      : 'Pilih Kebun'}
                  </span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.939l3.71-3.71a.75.75 0 111.06 1.061l-4.24 4.24a.75.75 0 01-1.06 0l-4.24-4.24a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="p-2 w-[--radix-popover-trigger-width] max-h-60 overflow-y-auto bg-white rounded-xl border shadow-sm">
                <Input
                  autoFocus
                  placeholder="Cari kebun…"
                  value={kebunQuery}
                  onChange={(e) => setKebunQuery(e.target.value)}
                  className="mb-2 rounded-lg"
                />
                <div role="listbox" className="space-y-1">
                  {kebunList
                    .filter(k => k.name.toLowerCase().includes(kebunQuery.toLowerCase()))
                    .map(k => (
                      <button
                        key={k.id}
                        type="button"
                        onClick={() => { setFormData({ ...formData, kebunId: String(k.id) }); setOpenKebun(false); }}
                        className={`w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 ${String(formData.kebunId) === String(k.id) ? 'bg-blue-50 text-blue-700' : ''}`}
                      >
                        {k.name}
                      </button>
                    ))}
                  {kebunList.filter(k => k.name.toLowerCase().includes(kebunQuery.toLowerCase())).length === 0 && (
                    <div className="px-3 py-2 text-sm text-gray-500">Tidak ditemukan</div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 flex items-center gap-2">
                <ArrowUpIcon className="h-4 w-4 text-emerald-600" />
                Gross (Kg)
              </label>
            <input 
              type="number" 
              value={formData.grossKg} 
              onChange={e => setFormData({ ...formData, grossKg: e.target.value })} 
              className="input-style w-full rounded-xl" 
              required 
            />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 flex items-center gap-2">
                <ArrowDownIcon className="h-4 w-4 text-amber-600" />
                Tare (Kg)
              </label>
            <input 
              type="number" 
              value={formData.tareKg} 
              onChange={e => setFormData({ ...formData, tareKg: e.target.value })} 
              className="input-style w-full rounded-xl" 
            />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 flex items-center gap-2">
                <UserIcon className="h-4 w-4 text-blue-500" />
                Supir
              </label>
            <Popover open={openSupir} onOpenChange={setOpenSupir}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="input-style w-full flex items-center justify-between rounded-xl"
                  aria-haspopup="listbox"
                >
                  <span>
                    {formData.supirId
                      ? (supirList.find(s => String(s.id) === String(formData.supirId))?.name ?? 'Pilih Supir')
                      : 'Pilih Supir'}
                  </span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.939l3.71-3.71a.75.75 0 111.06 1.061l-4.24 4.24a.75.75 0 01-1.06 0l-4.24-4.24a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="p-2 w-[--radix-popover-trigger-width] max-h-60 overflow-y-auto bg-white rounded-xl border shadow-sm">
                <Input
                  autoFocus
                  placeholder="Cari supir…"
                  value={supirQuery}
                  onChange={(e) => setSupirQuery(e.target.value)}
                  className="mb-2 rounded-lg"
                />
                <div role="listbox" className="space-y-1">
                  {supirList
                    .filter(s => s.name.toLowerCase().includes(supirQuery.toLowerCase()))
                    .map(s => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => { setFormData({ ...formData, supirId: String(s.id) }); setOpenSupir(false); }}
                        className={`w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 ${String(formData.supirId) === String(s.id) ? 'bg-emerald-50 text-emerald-700' : ''}`}
                      >
                        {s.name}
                      </button>
                    ))}
                  {supirList.filter(s => s.name.toLowerCase().includes(supirQuery.toLowerCase())).length === 0 && (
                    <div className="px-3 py-2 text-sm text-gray-500">Tidak ditemukan</div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 flex items-center gap-2">
                <TruckIcon className="h-4 w-4 text-blue-500" />
                Kendaraan
              </label>
            <Popover open={openKendaraan} onOpenChange={setOpenKendaraan}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="input-style w-full flex items-center justify-between rounded-xl"
                  aria-haspopup="listbox"
                >
                  <span>
                    {formData.kendaraanPlatNomor
                      ? formData.kendaraanPlatNomor
                      : 'Pilih Kendaraan'}
                  </span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.939l3.71-3.71a.75.75 0 111.06 1.061l-4.24 4.24a.75.75 0 01-1.06 0l-4.24-4.24a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="p-2 w-[--radix-popover-trigger-width] max-h-60 overflow-y-auto bg-white rounded-xl border shadow-sm">
                <Input
                  autoFocus
                  placeholder="Cari kendaraan…"
                  value={kendaraanQuery}
                  onChange={(e) => setKendaraanQuery(e.target.value)}
                  className="mb-2 rounded-lg"
                />
                <div role="listbox" className="space-y-1">
                  {kendaraanList
                    .filter(k => (k as any).jenis?.toLowerCase?.() === 'mobil truck' || /truck/i.test((k as any).jenis || ''))
                    .filter(k => (k.platNomor + ' ' + ((k as any).merk || '')).toLowerCase().includes(kendaraanQuery.toLowerCase()))
                    .map(k => (
                      <button
                        key={k.platNomor}
                        type="button"
                        onClick={() => { setFormData({ ...formData, kendaraanPlatNomor: k.platNomor }); setOpenKendaraan(false); }}
                        className={`w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 ${String(formData.kendaraanPlatNomor) === String(k.platNomor) ? 'bg-blue-50 text-blue-700' : ''}`}
                      >
                        {k.platNomor} {(k as any).merk ? `- ${(k as any).merk}` : ''}
                      </button>
                    ))}
                  {kendaraanList
                    .filter(k => (k as any).jenis?.toLowerCase?.() === 'mobil truck' || /truck/i.test((k as any).jenis || ''))
                    .filter(k => (k.platNomor + ' ' + ((k as any).merk || '')).toLowerCase().includes(kendaraanQuery.toLowerCase()))
                    .length === 0 && (
                    <div className="px-3 py-2 text-sm text-gray-500">Tidak ditemukan</div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 flex items-center gap-2">
                <PencilSquareIcon className="h-4 w-4 text-blue-500" />
                Notes
              </label>
            <textarea 
              value={formData.notes} 
              onChange={e => setFormData({ ...formData, notes: e.target.value })} 
              className="input-style w-full rounded-xl"
              rows={3}
            />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                <PhotoIcon className="h-4 w-4 text-blue-500" />
                Foto
              </label>
            <ImageUpload 
                onFileChange={handleFileChangeForCrop}
                previewUrl={preview}
            />
            </div>
          </ModalContentWrapper>
          <ModalFooter>
            <Button className="w-full sm:w-auto rounded-full" type="button" variant="outline" onClick={onClose}>
              <XMarkIcon className="h-4 w-4 mr-2" />
              Batal
            </Button>
            <Button className="w-full sm:w-auto rounded-full bg-emerald-600 hover:bg-emerald-700" type="submit">
              <CheckIcon className="h-4 w-4 mr-2" />
              Simpan
            </Button>
          </ModalFooter>
        </form>
      </DialogContent>
    </Dialog>

      <Dialog open={isCropping} onOpenChange={setIsCropping}>
        <DialogContent className="max-w-xl p-0 overflow-hidden [&>button.absolute]:hidden">
            <ModalHeader
                title="Potong Gambar"
                variant="emerald"
                icon={<PhotoIcon className="h-5 w-5 text-white" />}
                onClose={() => { setIsCropping(false); setPreview(null); setSelectedFile(null); }}
            />
            <div className="flex justify-center bg-black/5 p-4 overflow-auto max-h-[60vh]">
                {preview && (
                    <ReactCrop
                        crop={crop}
                        onChange={(_, percentCrop) => setCrop(percentCrop)}
                        onComplete={(c) => setCompletedCrop(c)}
                        aspect={undefined}
                    >
                        <img
                            ref={imgRef}
                            src={preview}
                            alt="Crop preview"
                            onLoad={onImageLoad}
                        />
                    </ReactCrop>
                )}
            </div>
            <ModalFooter>
                <Button className="w-full sm:w-auto rounded-full" variant="outline" onClick={() => { setIsCropping(false); setPreview(null); setSelectedFile(null); }}>
                    <XMarkIcon className="h-4 w-4 mr-2" />
                    Batal
                </Button>
                <Button className="w-full sm:w-auto rounded-full bg-emerald-600 hover:bg-emerald-700" onClick={handleCropConfirm}>
                    Potong & Simpan
                </Button>
            </ModalFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
