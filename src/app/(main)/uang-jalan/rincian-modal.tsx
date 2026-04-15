'use client'

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useState, useRef } from "react";
import toast from "react-hot-toast";
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import ImageUpload from '@/components/ui/ImageUpload';
import { XMarkIcon } from "@heroicons/react/24/outline";
import { ModalContentWrapper, ModalFooter, ModalHeader } from "@/components/ui/modal-elements";

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (data: any) => Promise<boolean>;
    sesiId: number;
}

export function RincianUangJalanModal({ isOpen, onClose, onConfirm, sesiId }: ModalProps) {
    const [formData, setFormData] = useState({ tipe: '', amount: '', description: '', date: '' });
    const [gambar, setGambar] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [crop, setCrop] = useState<Crop>();
    const [completedCrop, setCompletedCrop] = useState<Crop>();
    const [isCropping, setIsCropping] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const imgRef = useRef<HTMLImageElement>(null);

    const formatRupiah = (angka: string) => {
        if (typeof angka !== 'string') return '';
        const number_string = angka.replace(/[^,\d]/g, '').toString();
        const split = number_string.split(',');
        const sisa = split[0].length % 3;
        let rupiah = split[0].substr(0, sisa);
        const ribuan = split[0].substr(sisa).match(/\d{3}/gi);

        if (ribuan) {
            const separator = sisa ? '.' : '';
            rupiah += separator + ribuan.join('.');
        }

        rupiah = split[1] !== undefined ? rupiah + ',' + split[1] : rupiah;
        return rupiah;
    };

    const parseRupiah = (rupiah: string) => {
        if (typeof rupiah !== 'string') return '';
        return rupiah.replace(/\./g, '');
    };

    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = parseRupiah(e.target.value);
        if (!isNaN(Number(rawValue))) {
            setFormData({ ...formData, amount: rawValue });
        }
    };

    useEffect(() => {
        if (isOpen) {
            const today = new Date().toISOString().split('T')[0];
            setFormData({ tipe: '', amount: '', description: '', date: today });
            setGambar(null);
            setPreview(null);
            setCrop(undefined);
            setCompletedCrop(undefined);
            setSubmitting(false);
        }
    }, [isOpen]);

    // --- Image Crop Functions ---
    function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
        const { width, height } = e.currentTarget;
        const crop = centerCrop(
            makeAspectCrop({ unit: '%', width: 100 }, width / height, width, height),
            width,
            height
        );
        setCrop(crop);
    }

    async function getCroppedImg(
        image: HTMLImageElement,
        crop: Crop,
        fileName: string
    ): Promise<File> {
        const canvas = document.createElement('canvas');
        const scaleX = image.naturalWidth / image.width;
        const scaleY = image.naturalHeight / image.height;
        
        const srcCropW = Math.floor(crop.width * scaleX);
        const srcCropH = Math.floor(crop.height * scaleY);
        const maxDimension = 1280;
        const resizeScale = Math.min(1, maxDimension / Math.max(srcCropW, srcCropH));

        canvas.width = Math.max(1, Math.floor(srcCropW * resizeScale));
        canvas.height = Math.max(1, Math.floor(srcCropH * resizeScale));
        
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            throw new Error('No 2d context');
        }

        ctx.imageSmoothingEnabled = true;
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
            canvas.height
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
                0.82
            );
        });
    }

    const handleCropConfirm = async () => {
        if (completedCrop?.width && completedCrop?.height && imgRef.current) {
            const croppedImageFile = await getCroppedImg(
                imgRef.current,
                completedCrop,
                'cropped-rincian.webp'
            );
            setGambar(croppedImageFile);
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreview(reader.result as string);
            };
            reader.readAsDataURL(croppedImageFile);
            setIsCropping(false);
        }
    };

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
            setGambar(null);
        }
    };

    const normalizeNumber = (s: string) => {
        const cleaned = s.replace(/[^\d.,]/g, '').replace(/\s+/g, '');
        if (!cleaned) return null;
        if (cleaned.includes(',') && cleaned.includes('.')) {
            const lastComma = cleaned.lastIndexOf(',');
            const intPart = cleaned.slice(0, lastComma).replace(/\./g, '');
            const fracPart = cleaned.slice(lastComma + 1);
            return Number(`${intPart}.${fracPart}`);
        }
        if (cleaned.includes(',')) {
            const parts = cleaned.split(',');
            if (parts[1]?.length > 0) {
                return Number(`${parts[0].replace(/\./g, '')}.${parts[1]}`);
            }
            return Number(parts[0].replace(/\./g, ''));
        }
        return Number(cleaned.replace(/\./g, ''));
    };

    const parseLikelyAmount = (text: string) => {
        const matches = text.match(/\d{1,3}(?:[.\s]\d{3})+(?:,\d+)?|\d+(?:,\d+)?/g) || [];
        let best: number | null = null;
        for (const m of matches) {
            const n = normalizeNumber(m);
            if (typeof n === 'number' && !isNaN(n)) {
                if (best === null || n > best) best = n;
            }
        }
        return best;
    };

    const parseLikelyDate = (text: string) => {
        const m = text.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
        if (!m) return null;
        const d = Number(m[1]);
        const mo = Number(m[2]);
        const y = Number(m[3].length === 2 ? `20${m[3]}` : m[3]);
        const date = new Date(y, mo - 1, d);
        if (isNaN(date.getTime())) return null;
        return date.toISOString().split('T')[0];
    };

    const handleScanFromImage = async () => {
        if (!gambar && !preview) {
            toast.error('Unggah gambar dulu.');
            return;
        }
        try {
            toast.loading('Memindai gambar...');
            let bitmap: ImageBitmap | null = null;
            if (gambar) {
                bitmap = await createImageBitmap(gambar);
            } else if (preview) {
                const res = await fetch(preview);
                const blob = await res.blob();
                bitmap = await createImageBitmap(blob);
            }
            let extractedText = '';
            const anyWindow = window as any;
            if ('TextDetector' in anyWindow) {
                const detector = new anyWindow.TextDetector();
                const results = await detector.detect(bitmap!);
                extractedText = results.map((r: any) => r.rawValue || '').join(' ');
            } else {
                toast.dismiss();
                toast.error('Pemindai teks tidak didukung browser ini.');
                return;
            }
            const amount = parseLikelyAmount(extractedText);
            const dateStr = parseLikelyDate(extractedText);
            const next = { ...formData };
            if (amount && amount > 0) next.amount = String(Math.round(amount));
            if (dateStr) next.date = dateStr;
            if (extractedText) next.description = next.description || extractedText.slice(0, 200);
            if (!next.tipe) next.tipe = 'PENGELUARAN';
            setFormData(next);
            toast.dismiss();
            toast.success('Hasil pindai diterapkan.');
        } catch (err) {
            toast.dismiss();
            toast.error('Gagal memindai gambar.');
            console.error(err);
        }
    };

    const clearAfterSubmit = (keep: { tipe: string; date: string }) => {
        setFormData({ tipe: keep.tipe, amount: '', description: '', date: keep.date });
        setGambar(null);
        setPreview(null);
        setCrop(undefined);
        setCompletedCrop(undefined);
        setIsCropping(false);
    };

    const submit = async (mode: 'close' | 'keep') => {
        if (!formData.tipe || !formData.amount) {
            toast.error("Tipe dan Nominal harus diisi.");
            return;
        }
        if (submitting) return;

        const payload = {
            sesiUangJalanId: sesiId,
            tipe: formData.tipe,
            amount: parseRupiah(formData.amount),
            description: formData.description || '',
            date: formData.date || undefined,
            gambar: gambar, // Pass the file object
        };

        setSubmitting(true);
        const ok = await onConfirm(payload);
        setSubmitting(false);
        if (!ok) return;
        if (mode === 'close') {
            onClose();
            return;
        }
        clearAfterSubmit({ tipe: formData.tipe, date: formData.date });
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="bg-white max-w-lg p-0 overflow-hidden flex flex-col [&>button.absolute]:hidden">
                    <ModalHeader
                        title="Tambah Rincian Uang Jalan"
                        subtitle="Catat pemasukan/pengeluaran dan lampiran bukti"
                        variant="emerald"
                        onClose={onClose}
                    />
                    <ModalContentWrapper className="grid gap-4 flex-1 min-h-0 overflow-y-auto">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="date" className="text-right">Tanggal</Label>
                            <Input
                                id="date"
                                type="date"
                                value={formData.date}
                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                className="col-span-3"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="tipe" className="text-right">Tipe</Label>
                            <Select
                                value={formData.tipe} // Pastikan nilai ini terikat
                                onValueChange={(value: string) => setFormData({ ...formData, tipe: value })}
                            >
                                <SelectTrigger className="col-span-3 bg-white">
                                    <SelectValue placeholder="Pilih Tipe" />
                                </SelectTrigger>
                                <SelectContent className="bg-white">
                                    <SelectItem value="PENGELUARAN">Pengeluaran</SelectItem>
                                    <SelectItem value="PEMASUKAN">Pemasukan</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="amount" className="text-right">Nominal</Label>
                            <Input
                                id="amount"
                                type="text"
                                value={formatRupiah(formData.amount)}
                                onChange={handleAmountChange}
                                className="col-span-3"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="description" className="text-right">Keterangan</Label>
                            <Input
                                id="description"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className="col-span-3"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="gambar" className="text-right">Gambar</Label>
                            <div className="col-span-3">
                                <ImageUpload onFileChange={handleFileChangeForCrop} previewUrl={preview} />
                            <div className="mt-2 flex gap-2">
                                <Button variant="outline" onClick={handleScanFromImage}>Scan dari Gambar</Button>
                                {isCropping && <span className="text-xs text-gray-500">Sedang memilih area gambar</span>}
                            </div>
                            </div>
                        </div>
                    </ModalContentWrapper>
                    <ModalFooter className="sm:justify-between">
                        <Button variant="outline" onClick={onClose} disabled={submitting}>Batal</Button>
                        <Button variant="outline" onClick={() => submit('keep')} disabled={submitting}>Simpan & Tambah Lagi</Button>
                        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => submit('close')} disabled={submitting}>Simpan</Button>
                    </ModalFooter>
                </DialogContent>
            </Dialog>

            {isCropping && preview && (
                <Dialog open={isCropping} onOpenChange={() => setIsCropping(false)}>
                    <DialogContent className="bg-white max-w-3xl p-0 overflow-hidden flex flex-col [&>button.absolute]:hidden">
                        <ModalHeader
                            title="Sesuaikan Gambar"
                            variant="emerald"
                            onClose={() => setIsCropping(false)}
                        />
                        <div className="p-4 flex-1 min-h-0 overflow-y-auto">
                            <ReactCrop
                                crop={crop}
                                onChange={(_, percentCrop) => setCrop(percentCrop)}
                                onComplete={(c) => setCompletedCrop(c)}
                            >
                                <img ref={imgRef} src={preview} onLoad={onImageLoad} alt="Crop preview" style={{ maxHeight: '70vh' }} />
                            </ReactCrop>
                        </div>
                        <ModalFooter className="sm:justify-between">
                            <Button className="rounded-full" variant="outline" onClick={() => setIsCropping(false)}>
                                <XMarkIcon className="h-4 w-4 mr-2" />
                                Batal
                            </Button>
                            <Button className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleCropConfirm}>Konfirmasi</Button>
                        </ModalFooter>
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
}
