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
import { ChevronDownIcon, ChevronUpIcon, TruckIcon, XMarkIcon, CheckIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";


import type { Kendaraan } from '@prisma/client'

interface CollapsibleSectionProps {
    title: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
}

const CollapsibleSection = ({ title, children, defaultOpen = false }: CollapsibleSectionProps) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className="border rounded-xl overflow-hidden">
            <button 
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex justify-between items-center p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
                <span className="font-medium text-sm text-gray-700">{title}</span>
                {isOpen ? <ChevronUpIcon className="w-4 h-4 text-gray-500" /> : <ChevronDownIcon className="w-4 h-4 text-gray-500" />}
            </button>
            {isOpen && (
                <div className="p-4 bg-white border-t">
                    {children}
                </div>
            )}
        </div>
    );
}

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
        speksi: '',
        imageUrl: '',
        fotoStnkUrl: '',
        fotoPajakUrl: '',
        fotoSpeksiUrl: '',
    });
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    
    const [stnkFile, setStnkFile] = useState<File | null>(null);
    const [previewStnkUrl, setPreviewStnkUrl] = useState<string | null>(null);

    const [pajakFile, setPajakFile] = useState<File | null>(null);
    const [previewPajakUrl, setPreviewPajakUrl] = useState<string | null>(null);

    const [speksiFile, setSpeksiFile] = useState<File | null>(null);
    const [previewSpeksiUrl, setPreviewSpeksiUrl] = useState<string | null>(null);

    const [uploading, setUploading] = useState(false);
    const [errors, setErrors] = useState<{ [key: string]: string }>({});

    useEffect(() => {
        if (initialData) {
            setFormData({
                platNomor: initialData.platNomor,
                merk: initialData.merk,
                jenis: initialData.jenis,
                tanggalMatiStnk: initialData.tanggalMatiStnk ? new Date(initialData.tanggalMatiStnk).toISOString().split('T')[0] : '',
                tanggalPajakTahunan: initialData.tanggalPajakTahunan ? new Date(initialData.tanggalPajakTahunan).toISOString().split('T')[0] : '',
                speksi: initialData.speksi ? new Date(initialData.speksi).toISOString().split('T')[0] : '',
                imageUrl: initialData.imageUrl || '',
                fotoStnkUrl: initialData.fotoStnkUrl || '',
                fotoPajakUrl: initialData.fotoPajakUrl || '',
                fotoSpeksiUrl: initialData.fotoSpeksiUrl || '',
            });
            setPreviewUrl(initialData.imageUrl || null);
            setPreviewStnkUrl(initialData.fotoStnkUrl || null);
            setPreviewPajakUrl(initialData.fotoPajakUrl || null);
            setPreviewSpeksiUrl(initialData.fotoSpeksiUrl || null);
            
            setImageFile(null);
            setStnkFile(null);
            setPajakFile(null);
            setSpeksiFile(null);
            setErrors({});
        } else {
            setFormData({ 
                platNomor: '', 
                merk: '', 
                jenis: '', 
                tanggalMatiStnk: '',
                tanggalPajakTahunan: '',
                speksi: '',
                imageUrl: '',
                fotoStnkUrl: '',
                fotoPajakUrl: '',
                fotoSpeksiUrl: '',
            });
            setPreviewUrl(null);
            setPreviewStnkUrl(null);
            setPreviewPajakUrl(null);
            setPreviewSpeksiUrl(null);

            setImageFile(null);
            setStnkFile(null);
            setPajakFile(null);
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
            setFormData(prev => ({ ...prev, imageUrl: '' }));
        }
    };

    const handleStnkFileChange = (file: File | null) => {
        setStnkFile(file);
        if (file) {
            const objectUrl = URL.createObjectURL(file);
            setPreviewStnkUrl(objectUrl);
        } else {
            setPreviewStnkUrl(null);
            setFormData(prev => ({ ...prev, fotoStnkUrl: '' }));
        }
    };

    const handlePajakFileChange = (file: File | null) => {
        setPajakFile(file);
        if (file) {
            const objectUrl = URL.createObjectURL(file);
            setPreviewPajakUrl(objectUrl);
        } else {
            setPreviewPajakUrl(null);
            setFormData(prev => ({ ...prev, fotoPajakUrl: '' }));
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
        let finalImageUrl = formData.imageUrl;
        let finalStnkUrl = formData.fotoStnkUrl;
        let finalPajakUrl = formData.fotoPajakUrl;
        let finalSpeksiUrl = formData.fotoSpeksiUrl;

        try {
            if (imageFile) finalImageUrl = await uploadFile(imageFile) || finalImageUrl;
            if (stnkFile) finalStnkUrl = await uploadFile(stnkFile) || finalStnkUrl;
            if (pajakFile) finalPajakUrl = await uploadFile(pajakFile) || finalPajakUrl;
            if (speksiFile) finalSpeksiUrl = await uploadFile(speksiFile) || finalSpeksiUrl;

            const dataToSubmit = {
                ...formData,
                imageUrl: finalImageUrl,
                fotoStnkUrl: finalStnkUrl,
                fotoPajakUrl: finalPajakUrl,
                fotoSpeksiUrl: finalSpeksiUrl,
                tanggalPajakTahunan: formData.tanggalPajakTahunan ? new Date(formData.tanggalPajakTahunan) : null,
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
                                <Label htmlFor="speksi">Speksi (Opsional)</Label>
                                <Input id="speksi" type="date" name="speksi" value={formData.speksi} onChange={handleChange} className="w-full rounded-xl" />
                            </div>
                        </div>

                        <CollapsibleSection title="Foto Kendaraan" defaultOpen={!!previewUrl}>
                            <div className="grid gap-2">
                                <ImageUpload 
                                    onFileChange={handleFileChange}
                                    previewUrl={previewUrl}
                                />
                            </div>
                        </CollapsibleSection>

                        <CollapsibleSection title="Foto STNK" defaultOpen={!!previewStnkUrl}>
                            <div className="grid gap-2">
                                <ImageUpload 
                                    onFileChange={handleStnkFileChange}
                                    previewUrl={previewStnkUrl}
                                />
                            </div>
                        </CollapsibleSection>

                        <CollapsibleSection title="Foto Pajak Tahunan" defaultOpen={!!previewPajakUrl}>
                            <div className="grid gap-2">
                                <ImageUpload 
                                    onFileChange={handlePajakFileChange}
                                    previewUrl={previewPajakUrl}
                                />
                            </div>
                        </CollapsibleSection>

                        <CollapsibleSection title="Foto Speksi" defaultOpen={!!previewSpeksiUrl}>
                            <div className="grid gap-2">
                                <ImageUpload 
                                    onFileChange={handleSpeksiFileChange}
                                    previewUrl={previewSpeksiUrl}
                                />
                            </div>
                        </CollapsibleSection>
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
