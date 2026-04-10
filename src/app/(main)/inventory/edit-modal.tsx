'use client'

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useRef, useEffect } from "react";
import toast from "react-hot-toast";
import ImageUpload from "@/components/ui/ImageUpload";
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { ArchiveBoxIcon, XMarkIcon, CheckIcon } from "@heroicons/react/24/outline";
import { ModalContentWrapper, ModalFooter, ModalHeader } from '@/components/ui/modal-elements'

interface EditModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: any;
    onSuccess: () => void;
}

function centerAspectCrop(mediaWidth: number, mediaHeight: number, aspect: number) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight,
    ),
    mediaWidth,
    mediaHeight,
  )
}

// --- Helper Functions ---
const formatNumber = (value: number | string) => {
  if (typeof value === 'string') {
    // Remove dots, replace comma with dot
    value = parseFloat(value.replace(/\./g, '').replace(',', '.')) || 0;
  }
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value);
};

const parseNumber = (value: string) => {
  // Remove dots (thousands), replace comma with dot (decimal)
  return parseFloat(value.replace(/\./g, '').replace(',', '.')) || 0;
};

// Internal component for formatted input
const FormattedNumberInput = ({ 
  value, 
  onChange, 
  name, 
  disabled, 
  readOnly, 
  className,
  placeholder,
  defaultValue
}: any) => {
  const [localValue, setLocalValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  // Initialize with defaultValue if provided and value is undefined
  useEffect(() => {
    if (defaultValue !== undefined && value === undefined) {
        setLocalValue(formatNumber(defaultValue));
    }
  }, [defaultValue, value]);

  // Sync with external value when not focused
  useEffect(() => {
      if (!isFocused && value !== undefined) {
          setLocalValue(formatNumber(value));
      }
  }, [value, isFocused]);

  const handleFocus = () => {
      setIsFocused(true);
      if (localValue === '0') {
          setLocalValue("");
      }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      if (!/^[0-9.,]*$/.test(val)) return;
      setLocalValue(val);
      if (onChange) {
          onChange(e);
      }
  };

  const handleBlur = () => {
      setIsFocused(false);
      const num = parseNumber(localValue);
      setLocalValue(formatNumber(num));
  };

  return (
      <Input
          name={name}
          value={localValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={disabled}
          readOnly={readOnly}
          className={className}
          placeholder={placeholder}
          type="text"
          autoComplete="off"
      />
  );
};

export function EditModal({ isOpen, onClose, item, onSuccess }: EditModalProps) {
    const [loading, setLoading] = useState(false);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [removeImage, setRemoveImage] = useState(false);
    
    // Crop State
    const [crop, setCrop] = useState<Crop>();
    const [completedCrop, setCompletedCrop] = useState<Crop>();
    const [isCropping, setIsCropping] = useState(false);
    const imgRef = useRef<HTMLImageElement>(null);

    useEffect(() => {
        if (isOpen && item) {
            setPreviewUrl(item.imageUrl || null);
            setImageFile(null);
            setRemoveImage(false);
        }
    }, [isOpen, item]);

    function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
        const { width, height } = e.currentTarget;
        setCrop(centerAspectCrop(width, height, 1));
    }

    async function getCroppedImg(image: HTMLImageElement, crop: Crop, fileName: string): Promise<File> {
        const canvas = document.createElement('canvas');
        const scaleX = image.naturalWidth / image.width;
        const scaleY = image.naturalHeight / image.height;
        
        // Set canvas size to the actual resolution of the cropped image to preserve quality
        canvas.width = Math.floor(crop.width * scaleX);
        canvas.height = Math.floor(crop.height * scaleY);
        
        const ctx = canvas.getContext('2d');
    
        if (!ctx) {
            throw new Error('No 2d context');
        }
    
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
            canvas.toBlob(
                (blob) => {
                    if (!blob) {
                        reject(new Error('Canvas is empty'));
                        return;
                    }
                    const base = String(fileName || 'image').replace(/\.[^/.]+$/, '')
                    const outName = `${base}.webp`
                    const file = new File([blob], outName, { type: 'image/webp' });
                    resolve(file);
                },
                'image/webp',
                0.9,
            );
        });
    }

    const handleFileChange = (file: File | null) => {
        if (file) {
            const objectUrl = URL.createObjectURL(file);
            setPreviewUrl(objectUrl);
            setIsCropping(true);
            setRemoveImage(false);
        } else {
            setPreviewUrl(null);
            setImageFile(null);
            setRemoveImage(true);
        }
    };

    const handleCropConfirm = async () => {
        if (completedCrop && imgRef.current && previewUrl) {
            const croppedFile = await getCroppedImg(imgRef.current, completedCrop, 'edited-item.webp');
            setImageFile(croppedFile);
            setPreviewUrl(URL.createObjectURL(croppedFile)); // Show cropped result
            setIsCropping(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!item) return;

        setLoading(true);
        const form = e.currentTarget;
        const formData = new FormData(form);
        
        // Clean price format
        const priceRaw = formData.get('price') as string;
        if (priceRaw) {
            const priceClean = priceRaw.replace(/\./g, '').replace(',', '.');
            formData.set('price', priceClean);
        }

        if (imageFile) {
            formData.append('image', imageFile);
        }
        
        if (removeImage) {
            formData.append('removeImage', 'true');
        }

        try {
            const res = await fetch(`/api/inventory/${item.id}`, {
                method: 'PATCH',
                body: formData
            });

            if (res.ok) {
                toast.success('Barang berhasil diupdate');
                onSuccess();
                onClose();
            } else {
                const data = await res.json();
                toast.error(data.error || 'Gagal update barang');
            }
        } catch (error) {
            toast.error('Terjadi kesalahan');
        } finally {
            setLoading(false);
        }
    };

    if (!item) return null;

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="w-[90%] max-w-2xl max-h-[90vh] p-0 overflow-hidden flex flex-col [&>button.absolute]:hidden">
                    <ModalHeader
                        title="Edit Barang"
                        variant="emerald"
                        icon={<ArchiveBoxIcon className="h-5 w-5 text-white" />}
                        onClose={onClose}
                    />
                    <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                        <ModalContentWrapper className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0 overflow-y-auto">
                            <div className="md:col-span-2">
                                <Label>Foto Barang</Label>
                                <div className="mt-2">
                                    <ImageUpload onFileChange={handleFileChange} previewUrl={previewUrl} />
                                </div>
                            </div>
                            <div>
                                <Label>Kode (SKU)</Label>
                                <Input name="sku" defaultValue={item.sku} required />
                            </div>
                            <div>
                                <Label>Nama Barang</Label>
                                <Input name="name" defaultValue={item.name} required />
                            </div>
                            <div>
                                <Label>Satuan</Label>
                                <Input name="unit" defaultValue={item.unit} required />
                            </div>
                            <div>
                                <Label>Kategori</Label>
                                <Input name="category" defaultValue={item.category} />
                            </div>
                            <div>
                                <Label>Stok</Label>
                                <Input name="stock" type="number" defaultValue={item.stock} />
                            </div>
                            <div>
                                <Label>Harga Satuan (Rp)</Label>
                                <FormattedNumberInput name="price" defaultValue={item.price || 0} />
                            </div>
                            <div>
                                <Label>Min. Stok</Label>
                                <Input name="minStock" type="number" defaultValue={item.minStock} />
                            </div>
                        </ModalContentWrapper>
                        <ModalFooter className="sm:justify-between">
                            <Button type="button" variant="outline" onClick={onClose} className="rounded-full">
                                <XMarkIcon className="h-4 w-4 mr-2" />
                                Batal
                            </Button>
                            <Button type="submit" disabled={loading} className="rounded-full bg-emerald-600 hover:bg-emerald-700">
                                <CheckIcon className="h-4 w-4 mr-2" />
                                {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
                            </Button>
                        </ModalFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Crop Modal */}
            <Dialog open={isCropping} onOpenChange={setIsCropping}>
                <DialogContent className="max-w-xl p-0 overflow-hidden flex flex-col [&>button.absolute]:hidden">
                    <ModalHeader
                        title="Potong Gambar"
                        variant="emerald"
                        icon={<ArchiveBoxIcon className="h-5 w-5 text-white" />}
                        onClose={() => { setIsCropping(false); setImageFile(null); setPreviewUrl(item?.imageUrl || null); }}
                    />
                    <div className="flex justify-center bg-black/5 p-4 rounded-lg overflow-auto max-h-[60vh]">
                        {previewUrl && (
                            <ReactCrop
                                crop={crop}
                                onChange={(_, percentCrop) => setCrop(percentCrop)}
                                onComplete={(c) => setCompletedCrop(c)}
                                aspect={1} // Square for items
                            >
                                <img 
                                    ref={imgRef} 
                                    src={previewUrl} 
                                    onLoad={onImageLoad} 
                                    alt="Crop preview" 
                                />
                            </ReactCrop>
                        )}
                    </div>
                    <ModalFooter className="sm:justify-between">
                        <Button variant="outline" onClick={() => { setIsCropping(false); setImageFile(null); setPreviewUrl(item?.imageUrl || null); }} className="rounded-full">
                            <XMarkIcon className="h-4 w-4 mr-2" />
                            Batal
                        </Button>
                        <Button onClick={handleCropConfirm} className="rounded-full bg-emerald-600 hover:bg-emerald-700">
                            <CheckIcon className="h-4 w-4 mr-2" />
                            Potong & Simpan
                        </Button>
                    </ModalFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
