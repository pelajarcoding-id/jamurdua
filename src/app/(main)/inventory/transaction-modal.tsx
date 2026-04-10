'use client'

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useRef } from "react";
import toast from "react-hot-toast";
import { useAuth } from "@/components/AuthProvider";
import ImageUpload from "@/components/ui/ImageUpload";
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { ArchiveBoxIcon, XMarkIcon, CheckIcon } from "@heroicons/react/24/outline";
import { format } from 'date-fns';
import { ModalContentWrapper, ModalFooter, ModalHeader } from '@/components/ui/modal-elements'

interface TransactionModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: any;
    onSuccess: () => void;
}

function centerAspectCrop(mediaWidth: number, mediaHeight: number) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 90,
      },
      undefined as any, // Free crop
      mediaWidth,
      mediaHeight,
    ),
    mediaWidth,
    mediaHeight,
  )
}

export function TransactionModal({ isOpen, onClose, item, onSuccess }: TransactionModalProps) {
    const { id: userId } = useAuth();
    const [type, setType] = useState('IN'); // IN, OUT, ADJUSTMENT
    const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [quantity, setQuantity] = useState('');
    const [notes, setNotes] = useState('');
    const [image, setImage] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // Crop State
    const [crop, setCrop] = useState<Crop>();
    const [completedCrop, setCompletedCrop] = useState<Crop>();
    const [isCropping, setIsCropping] = useState(false);
    const imgRef = useRef<HTMLImageElement>(null);

    const handleFileChange = (file: File | null) => {
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreviewUrl(reader.result as string);
                setIsCropping(true); // Open crop modal
            };
            reader.readAsDataURL(file);
        } else {
            setPreviewUrl(null);
            setImage(null);
        }
    };

    const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const { width, height } = e.currentTarget;
        setCrop(centerAspectCrop(width, height));
    };

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

    const handleCropConfirm = async () => {
        if (completedCrop?.width && completedCrop?.height && imgRef.current) {
            try {
                const croppedImageFile = await getCroppedImg(
                    imgRef.current,
                    completedCrop,
                    'cropped-transaction-proof.webp'
                );
                setImage(croppedImageFile);
                
                // Update preview to show cropped image
                const reader = new FileReader();
                reader.onloadend = () => {
                    setPreviewUrl(reader.result as string);
                };
                reader.readAsDataURL(croppedImageFile);
                
                setIsCropping(false);
            } catch (e) {
                console.error('Error cropping image:', e);
                toast.error('Gagal memotong gambar');
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!item || !userId) return;

        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('type', type);
            formData.append('date', date);
            formData.append('quantity', quantity);
            formData.append('notes', notes);
            formData.append('userId', String(userId));
            if (image) formData.append('image', image);

            const res = await fetch(`/api/inventory/${item.id}/transaction`, {
                method: 'POST',
                body: formData
            });

            if (!res.ok) throw new Error('Gagal memproses transaksi');

            toast.success('Stok berhasil diperbarui');
            setPreviewUrl(null);
            setImage(null);
            setQuantity('');
            setNotes('');
            onSuccess();
            onClose();
        } catch (error) {
            toast.error('Terjadi kesalahan');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="w-[90%] max-w-lg max-h-[90vh] p-0 overflow-hidden flex flex-col [&>button.absolute]:hidden">
                    <ModalHeader
                        title={`Update Stok: ${item?.name || ''}`}
                        variant="emerald"
                        icon={<ArchiveBoxIcon className="h-5 w-5 text-white" />}
                        onClose={onClose}
                    />
                    <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                        <ModalContentWrapper className="space-y-4 flex-1 min-h-0 overflow-y-auto">
                        <div className="flex gap-4">
                            <Button 
                                type="button" 
                                variant="outline"
                                onClick={() => setType('IN')}
                                className={`flex-1 ${type === 'IN' ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600' : ''}`}
                            >
                                Masuk (+)
                            </Button>
                            <Button 
                                type="button" 
                                variant="outline"
                                onClick={() => setType('OUT')}
                                className={`flex-1 ${type === 'OUT' ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600' : ''}`}
                            >
                                Keluar (-)
                            </Button>
                            <Button 
                                type="button" 
                                variant="outline"
                                onClick={() => setType('ADJUSTMENT')}
                                className={`flex-1 ${type === 'ADJUSTMENT' ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600' : ''}`}
                            >
                                Set (Stok Opname)
                            </Button>
                        </div>

                        <div className="space-y-2">
                            <Label>Tanggal</Label>
                            <Input 
                                type="date" 
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Jumlah {type === 'ADJUSTMENT' ? 'Baru' : item?.unit}</Label>
                            <Input 
                                type="number" 
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                placeholder="0"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Catatan</Label>
                            <Input 
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Contoh: Pembelian baru / Barang rusak"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Bukti / Foto (Opsional)</Label>
                            <ImageUpload onFileChange={handleFileChange} previewUrl={previewUrl} />
                        </div>
                        </ModalContentWrapper>

                        <ModalFooter className="sm:justify-between">
                            <Button type="button" variant="outline" onClick={onClose} className="rounded-full">
                                <XMarkIcon className="h-4 w-4 mr-2" />
                                Batal
                            </Button>
                            <Button type="submit" className="rounded-full bg-emerald-600 hover:bg-emerald-700" disabled={loading}>
                                <CheckIcon className="h-4 w-4 mr-2" />
                                {loading ? 'Menyimpan...' : 'Simpan Transaksi'}
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
                        onClose={() => { setIsCropping(false); setImage(null); setPreviewUrl(null); }}
                    />
                    <div className="flex justify-center bg-black/5 p-4 rounded-lg overflow-auto max-h-[60vh]">
                        {previewUrl && (
                            <ReactCrop
                                crop={crop}
                                onChange={(_, percentCrop) => setCrop(percentCrop)}
                                onComplete={(c) => setCompletedCrop(c)}
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
                        <Button variant="outline" onClick={() => { setIsCropping(false); setImage(null); setPreviewUrl(null); }} className="rounded-full">
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
