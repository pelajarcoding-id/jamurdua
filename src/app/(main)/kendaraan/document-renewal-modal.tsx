
'use client'

import { useState } from 'react'
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
import { ChevronDownIcon, ChevronUpIcon, RectangleStackIcon, XMarkIcon, CheckIcon } from "@heroicons/react/24/outline";
import ImageUpload from '@/components/ui/ImageUpload';
import { useSWRConfig } from 'swr';

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

interface DocumentRenewalModalProps {
    isOpen: boolean;
    onClose: () => void;
    platNomor: string | null;
}

export function DocumentRenewalModal({ isOpen, onClose, platNomor }: DocumentRenewalModalProps) {
    const { mutate } = useSWRConfig();
    const [formData, setFormData] = useState({
        jenis: '',
        berlakuHingga: '',
        biaya: '',
        keterangan: '',
        fotoUrl: ''
    });
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);

    // Format helpers
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
        return rupiah ? 'Rp ' + rupiah : '';
    };

    const parseRupiah = (rupiah: string) => {
        if (typeof rupiah !== 'string') return 0;
        return parseInt(rupiah.replace(/[^0-9]/g, '')) || 0;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        if (name === 'biaya') {
            const rawValue = value.replace(/[^0-9]/g, ''); // Keep only numbers
            const formattedValue = formatRupiah(rawValue);
            setFormData(prev => ({ ...prev, [name]: formattedValue }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleFileChange = (file: File | null) => {
        setImageFile(file);
        if (file) {
            const objectUrl = URL.createObjectURL(file);
            setPreviewUrl(objectUrl);
        } else {
            setPreviewUrl(null);
            setFormData(prev => ({ ...prev, fotoUrl: '' }));
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!platNomor) return;
        if (!formData.jenis || !formData.berlakuHingga) {
            toast.error('Mohon lengkapi jenis dokumen dan tanggal berlaku');
            return;
        }

        setUploading(true);
        try {
            let finalImageUrl = formData.fotoUrl;
            if (imageFile) {
                finalImageUrl = await uploadFile(imageFile) || finalImageUrl;
            }

            const res = await fetch(`/api/kendaraan/${platNomor}/document-history`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    biaya: parseRupiah(formData.biaya),
                    fotoUrl: finalImageUrl
                }),
            });

            if (!res.ok) throw new Error('Gagal menyimpan riwayat dokumen');

            toast.success('Perpanjangan dokumen berhasil disimpan');
            mutate(`/api/kendaraan/${platNomor}/document-history`);
            mutate('/api/kendaraan'); // Refresh list to update status colors
            mutate('/api/kendaraan/alerts'); // Refresh dashboard alerts
            onClose();
            
            // Reset form
            setFormData({
                jenis: '',
                berlakuHingga: '',
                biaya: '',
                keterangan: '',
                fotoUrl: ''
            });
            setImageFile(null);
            setPreviewUrl(null);

        } catch (error) {
            console.error(error);
            toast.error('Gagal menyimpan riwayat dokumen');
        } finally {
            setUploading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] p-0 overflow-hidden flex flex-col [&>button.absolute]:hidden">
                <ModalHeader
                    title="Perpanjang Dokumen Kendaraan"
                    subtitle={platNomor || ''}
                    variant="emerald"
                    icon={<RectangleStackIcon className="h-5 w-5 text-white" />}
                    onClose={onClose}
                />
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                    <ModalContentWrapper className="grid gap-4 flex-1 min-h-0 overflow-y-auto">
                        <div className="grid gap-2">
                            <Label htmlFor="jenis">Jenis Dokumen</Label>
                            <Select 
                                value={formData.jenis} 
                                onValueChange={(value) => setFormData(prev => ({ ...prev, jenis: value }))} 
                            >
                                <SelectTrigger id="jenis" className="rounded-xl">
                                    <SelectValue placeholder="Pilih Jenis Dokumen" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="STNK">STNK</SelectItem>
                                    <SelectItem value="PAJAK">Pajak Tahunan</SelectItem>
                                    <SelectItem value="SPEKSI">Speksi (KIR)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="berlakuHingga">Berlaku Hingga</Label>
                            <Input 
                                id="berlakuHingga" 
                                type="date" 
                                name="berlakuHingga" 
                                value={formData.berlakuHingga} 
                                onChange={handleChange}
                                className="rounded-xl"
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="biaya">Biaya Perpanjangan</Label>
                            <Input 
                                id="biaya" 
                                type="text" 
                                name="biaya" 
                                value={formData.biaya} 
                                onChange={handleChange}
                                placeholder="Rp 0" 
                                className="rounded-xl"
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="keterangan">Keterangan (Opsional)</Label>
                            <Input 
                                id="keterangan" 
                                name="keterangan" 
                                value={formData.keterangan} 
                                onChange={handleChange}
                                placeholder="Contoh: Perpanjangan 5 tahunan" 
                                className="rounded-xl"
                            />
                        </div>

                        <CollapsibleSection title="Foto Dokumen Baru (Opsional)" defaultOpen={!!previewUrl}>
                            <div className="grid gap-2">
                                <ImageUpload 
                                    onFileChange={handleFileChange}
                                    previewUrl={previewUrl}
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
