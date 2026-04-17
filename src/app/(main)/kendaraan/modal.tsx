'use client'

import { useEffect, useState, ChangeEvent, FormEvent } from 'react'
import ImageUpload from '@/components/ui/ImageUpload';
import toast from 'react-hot-toast';
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModalContentWrapper, ModalFooter, ModalHeader } from "@/components/ui/modal-elements";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { TruckIcon, XMarkIcon, CheckIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";


import type { Kendaraan } from '@prisma/client'

interface KendaraanModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (formData: any) => void;
    title: string;
    initialData: Kendaraan | null;
}

export function KendaraanModal({ isOpen, onClose, onConfirm, title, initialData }: KendaraanModalProps) {
    const [formData, setFormData] = useState({ 
        platNomor: '', 
        merk: '', 
        jenis: '', 
        tanggalMatiStnk: '',
        tanggalPajakTahunan: '',
        tanggalIzinTrayek: '',
        speksi: '',
        imageUrl: '',
        fotoStnkUrl: '',
        fotoIzinTrayekUrl: '',
        fotoSpeksiUrl: '',
    });
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    
    const [izinTrayekFile, setIzinTrayekFile] = useState<File | null>(null);
    const [previewIzinTrayekUrl, setPreviewIzinTrayekUrl] = useState<string | null>(null);

    const [speksiFile, setSpeksiFile] = useState<File | null>(null);
    const [previewSpeksiUrl, setPreviewSpeksiUrl] = useState<string | null>(null);

    const [uploading, setUploading] = useState(false);
    const [errors, setErrors] = useState<{ [key: string]: string }>({});

    useEffect(() => {
        if (initialData) {
            const izinTrayekUrl = ((initialData as any).fotoIzinTrayekUrl ?? '') as string
            const izinTrayekDate = (initialData as any).tanggalIzinTrayek ?? null
            setFormData({
                platNomor: initialData.platNomor,
                merk: initialData.merk,
                jenis: initialData.jenis,
                tanggalMatiStnk: initialData.tanggalMatiStnk ? new Date(initialData.tanggalMatiStnk).toISOString().split('T')[0] : '',
                tanggalPajakTahunan: initialData.tanggalPajakTahunan ? new Date(initialData.tanggalPajakTahunan).toISOString().split('T')[0] : '',
                tanggalIzinTrayek: izinTrayekDate ? new Date(izinTrayekDate).toISOString().split('T')[0] : '',
                speksi: initialData.speksi ? new Date(initialData.speksi).toISOString().split('T')[0] : '',
                imageUrl: initialData.imageUrl || '',
                fotoStnkUrl: initialData.fotoStnkUrl || '',
                fotoIzinTrayekUrl: izinTrayekUrl,
                fotoSpeksiUrl: initialData.fotoSpeksiUrl || '',
            });
            setPreviewUrl(initialData.imageUrl || initialData.fotoStnkUrl || null);
            setPreviewIzinTrayekUrl(izinTrayekUrl || null);
            setPreviewSpeksiUrl(initialData.fotoSpeksiUrl || null);
            
            setImageFile(null);
            setIzinTrayekFile(null);
            setSpeksiFile(null);
            setErrors({});
        } else {
            setFormData({ 
                platNomor: '', 
                merk: '', 
                jenis: '', 
                tanggalMatiStnk: '',
                tanggalPajakTahunan: '',
                tanggalIzinTrayek: '',
                speksi: '',
                imageUrl: '',
                fotoStnkUrl: '',
                fotoIzinTrayekUrl: '',
                fotoSpeksiUrl: '',
            });
            setPreviewUrl(null);
            setPreviewIzinTrayekUrl(null);
            setPreviewSpeksiUrl(null);

            setImageFile(null);
            setIzinTrayekFile(null);
            setSpeksiFile(null);
            setErrors({});
        }
    }, [initialData, isOpen]);

    if (!isOpen) return null;

    const validate = () => {
        const newErrors: { [key: string]: string } = {};
        if (!formData.platNomor) newErrors.platNomor = 'Plat Nomor wajib diisi';
        if (!formData.merk) newErrors.merk = 'Merk wajib diisi';
        if (!formData.jenis) newErrors.jenis = 'Jenis kendaraan wajib dipilih';
        if (!formData.tanggalMatiStnk) newErrors.tanggalMatiStnk = 'Tanggal Mati STNK wajib diisi';
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const val = name === 'platNomor' ? value.toUpperCase() : value;
        setFormData(prev => ({ ...prev, [name]: val }));
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }
    };

    const handleFileChange = (file: File | null) => {
        setImageFile(file);
        if (file) {
            const objectUrl = URL.createObjectURL(file);
            setPreviewUrl(objectUrl);
        } else {
            setPreviewUrl(null);
            setFormData(prev => ({ ...prev, imageUrl: '', fotoStnkUrl: '' }));
        }
    };

    const handleIzinTrayekFileChange = (file: File | null) => {
        setIzinTrayekFile(file);
        if (file) {
            const objectUrl = URL.createObjectURL(file);
            setPreviewIzinTrayekUrl(objectUrl);
        } else {
            setPreviewIzinTrayekUrl(null);
            setFormData(prev => ({ ...prev, fotoIzinTrayekUrl: '' }));
        }
    };

    const handleSpeksiFileChange = (file: File | null) => {
        setSpeksiFile(file);
        if (file) {
            const objectUrl = URL.createObjectURL(file);
            setPreviewSpeksiUrl(objectUrl);
        } else {
            setPreviewSpeksiUrl(null);
            setFormData(prev => ({ ...prev, fotoSpeksiUrl: '' }));
        }
    };

    const uploadFile = async (file: File) => {
        const uploadData = new FormData();
        uploadData.append('file', file);
        const res = await fetch('/api/upload', {
            method: 'POST',
            body: uploadData,
        });
        if (!res.ok) throw new Error('Gagal mengupload gambar');
        const data = await res.json();
        return data.success ? data.url : null;
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        
        if (!validate()) {
            toast.error('Mohon lengkapi data yang wajib diisi');
            return;
        }

        setUploading(true);
        const combinedExistingUrl = formData.imageUrl || formData.fotoStnkUrl
        let finalImageUrl = combinedExistingUrl
        let finalStnkUrl = combinedExistingUrl
        let finalIzinTrayekUrl = formData.fotoIzinTrayekUrl
        let finalSpeksiUrl = formData.fotoSpeksiUrl;

        try {
            if (imageFile) {
                const uploaded = await uploadFile(imageFile)
                if (uploaded) {
                    finalImageUrl = uploaded
                    finalStnkUrl = uploaded
                }
            }
            if (izinTrayekFile) finalIzinTrayekUrl = await uploadFile(izinTrayekFile) || finalIzinTrayekUrl;
            if (speksiFile) finalSpeksiUrl = await uploadFile(speksiFile) || finalSpeksiUrl;

            const dataToSubmit = {
                ...formData,
                imageUrl: finalImageUrl,
                fotoStnkUrl: finalStnkUrl,
                fotoIzinTrayekUrl: finalIzinTrayekUrl,
                fotoSpeksiUrl: finalSpeksiUrl,
                tanggalPajakTahunan: formData.tanggalPajakTahunan ? new Date(formData.tanggalPajakTahunan) : null,
                tanggalIzinTrayek: formData.tanggalIzinTrayek ? new Date(formData.tanggalIzinTrayek) : null,
                speksi: formData.speksi ? new Date(formData.speksi) : null,
            };

            onConfirm(dataToSubmit);
        } catch (error) {
            console.error('Error uploading image:', error);
            toast.error('Gagal mengupload gambar');
        } finally {
            setUploading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] p-0 overflow-hidden flex flex-col [&>button.absolute]:hidden">
                <ModalHeader
                    title={title}
                    variant="emerald"
                    icon={<TruckIcon className="h-5 w-5 text-white" />}
                    onClose={onClose}
                />
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                    <ModalContentWrapper className="grid gap-4 flex-1 min-h-0 overflow-y-auto no-scrollbar">
                        <div className="grid gap-2">
                            <Label htmlFor="platNomor">Plat Nomor</Label>
                            <Input 
                                id="platNomor" 
                                name="platNomor" 
                                value={formData.platNomor} 
                                onChange={handleChange} 
                                placeholder="Plat Nomor" 
                                className={`w-full rounded-xl ${errors.platNomor ? 'border-red-500' : ''}`} 
                            />
                            {errors.platNomor && <p className="text-red-500 text-xs">{errors.platNomor}</p>}
                        </div>
                        
                        <div className="grid gap-2">
                            <Label htmlFor="merk">Merk</Label>
                            <Input 
                                id="merk" 
                                name="merk" 
                                value={formData.merk} 
                                onChange={handleChange} 
                                placeholder="Merk" 
                                className={`w-full rounded-xl ${errors.merk ? 'border-red-500' : ''}`} 
                            />
                            {errors.merk && <p className="text-red-500 text-xs">{errors.merk}</p>}
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="jenis">Jenis</Label>
                            <Select 
                                value={formData.jenis} 
                                onValueChange={(value) => {
                                    setFormData(prev => ({ ...prev, jenis: value }));
                                    if (errors.jenis) setErrors(prev => ({ ...prev, jenis: '' }));
                                }} 
                            >
                                <SelectTrigger id="jenis" className={`w-full rounded-xl ${errors.jenis ? 'border-red-500' : ''}`}>
                                    <SelectValue placeholder="Pilih Jenis Kendaraan" />
                                </SelectTrigger>
                                <SelectContent className="z-[99999]">
                                    <SelectItem value="Mobil Truck">Mobil Truck</SelectItem>
                                    <SelectItem value="Mobil Pribadi">Mobil Pribadi</SelectItem>
                                    <SelectItem value="Mobil Langsir">Mobil Langsir</SelectItem>
                                    <SelectItem value="Alat Berat">Alat Berat</SelectItem>
                                    <SelectItem value="Sepeda Motor">Sepeda Motor</SelectItem>
                                </SelectContent>
                            </Select>
                            {errors.jenis && <p className="text-red-500 text-xs">{errors.jenis}</p>}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="tanggalMatiStnk">Tanggal Mati STNK</Label>
                                <Input 
                                    id="tanggalMatiStnk" 
                                    type="date" 
                                    name="tanggalMatiStnk" 
                                    value={formData.tanggalMatiStnk} 
                                    onChange={handleChange} 
                                    className={`w-full rounded-xl ${errors.tanggalMatiStnk ? 'border-red-500' : ''}`} 
                                />
                                {errors.tanggalMatiStnk && <p className="text-red-500 text-xs">{errors.tanggalMatiStnk}</p>}
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="tanggalPajakTahunan">Pajak Tahunan Mati (Opsional)</Label>
                                <Input id="tanggalPajakTahunan" type="date" name="tanggalPajakTahunan" value={formData.tanggalPajakTahunan} onChange={handleChange} className="w-full rounded-xl" />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="tanggalIzinTrayek">Izin Trayek Mati (Opsional)</Label>
                                <Input id="tanggalIzinTrayek" type="date" name="tanggalIzinTrayek" value={formData.tanggalIzinTrayek} onChange={handleChange} className="w-full rounded-xl" />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="speksi">Speksi (Opsional)</Label>
                                <Input id="speksi" type="date" name="speksi" value={formData.speksi} onChange={handleChange} className="w-full rounded-xl" />
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label>Foto Kendaraan + STNK</Label>
                            <ImageUpload onFileChange={handleFileChange} previewUrl={previewUrl} />
                        </div>

                        <div className="grid gap-2">
                            <Label>Foto Izin Trayek</Label>
                            <ImageUpload onFileChange={handleIzinTrayekFileChange} previewUrl={previewIzinTrayekUrl} />
                        </div>

                        <div className="grid gap-2">
                            <Label>Foto Speksi</Label>
                            <ImageUpload onFileChange={handleSpeksiFileChange} previewUrl={previewSpeksiUrl} />
                        </div>
                    </ModalContentWrapper>
                    <ModalFooter className="sm:justify-between">
                        <Button type="button" variant="outline" onClick={onClose} disabled={uploading} className="rounded-full">
                            <XMarkIcon className="h-4 w-4 mr-2" />
                            Batal
                        </Button>
                        <Button type="submit" disabled={uploading} className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white">
                            <CheckIcon className="h-4 w-4 mr-2" />
                            {uploading ? 'Menyimpan...' : 'Simpan'}
                        </Button>
                    </ModalFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description: string;
}

export function ConfirmationModal({ isOpen, onClose, onConfirm, title, description }: ConfirmationModalProps) {
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-white p-0 overflow-hidden flex flex-col [&>button.absolute]:hidden sm:max-w-[420px]">
                <ModalHeader
                    title={title}
                    subtitle="Konfirmasi tindakan"
                    variant="emerald"
                    icon={<ExclamationTriangleIcon className="h-5 w-5 text-white" />}
                    onClose={onClose}
                />
                <ModalContentWrapper className="text-sm text-gray-700">
                    {description}
                </ModalContentWrapper>
                <ModalFooter className="sm:justify-between">
                    <Button variant="outline" onClick={onClose} className="rounded-full">
                        <XMarkIcon className="h-4 w-4 mr-2" />
                        Batal
                    </Button>
                    <Button variant="destructive" onClick={onConfirm} className="rounded-full">
                        <CheckIcon className="h-4 w-4 mr-2" />
                        Hapus
                    </Button>
                </ModalFooter>
            </DialogContent>
        </Dialog>
    );
}
