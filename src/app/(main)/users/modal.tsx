'use client'

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import ImageUpload from "@/components/ui/ImageUpload";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { User } from "@prisma/client";
import { useEffect, useState, useRef } from "react";
import toast from "react-hot-toast";
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { useAuth } from "@/components/AuthProvider";
import { Checkbox } from "@/components/ui/checkbox";
import { UserData } from "./columns";
import { DocumentDuplicateIcon, XMarkIcon, CheckIcon, ExclamationTriangleIcon, EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import { ModalContentWrapper, ModalFooter, ModalHeader } from '@/components/ui/modal-elements'

// Function to generate cropped image
function getCroppedImg(
    image: HTMLImageElement,
    crop: Crop,
    fileName: string
): Promise<File> {
    const canvas = document.createElement("canvas");
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    
    // Set canvas size to the actual resolution of the cropped image to preserve quality
    canvas.width = Math.floor(crop.width * scaleX);
    canvas.height = Math.floor(crop.height * scaleY);
    
    const ctx = canvas.getContext("2d");

    if (!ctx) {
        throw new Error('No 2d context');
    }

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
        canvas.toBlob(blob => {
            if (!blob) {
                reject(new Error('Canvas is empty'));
                return;
            }
            const base = String(fileName || 'image').replace(/\.[^/.]+$/, '')
            const outName = `${base}.webp`
            const file = new File([blob], outName, { type: 'image/webp' });
            resolve(file);
        }, 'image/webp', 0.9);
    });
}

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (data: any) => void;
    title: string;
    initialData?: User | null;
}

export function UserModal({ isOpen, onClose, onConfirm, title, initialData }: ModalProps) {
    const { role: currentUserRole, id: currentUserId } = useAuth();
    const [formData, setFormData] = useState({ 
        name: '', 
        email: '', 
        role: '', 
        jenisPekerjaan: '',
        password: '', 
        oldPassword: '', 
        photoUrl: '',
        kebunId: null as number | null,
        kebunIds: [] as number[]
    });
    const [kebunList, setKebunList] = useState<Array<{ id: number, name: string }>>([]);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [imgSrc, setImgSrc] = useState('');
    const [crop, setCrop] = useState<Crop>();
    const [completedCrop, setCompletedCrop] = useState<Crop>();
    const [isCropping, setIsCropping] = useState(false);
    const imgRef = useRef<HTMLImageElement | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [showOldPassword, setShowOldPassword] = useState(false);

    useEffect(() => {
        // Fetch kebun list
        fetch('/api/kebun?limit=100')
            .then(res => res.json())
            .then(data => {
                setKebunList(data.data || []);
            })
            .catch(err => console.error("Failed to fetch kebun list", err));
    }, []);

    useEffect(() => {
        if (initialData) {
            const userData = initialData as UserData;
            const initialKebunIds =
                Array.isArray((userData as any).kebunIds) ? ((userData as any).kebunIds as number[]) :
                userData.kebuns?.map(k => k.id) || [];
            setFormData({
                name: userData.name || '',
                email: userData.email || '',
                role: userData.role,
                jenisPekerjaan: userData.jobType || '',
                password: '', // Password tidak diisi untuk edit
                oldPassword: '',
                photoUrl: userData.photoUrl || '',
                kebunId: userData.kebunId || null,
                kebunIds: initialKebunIds
            });
        } else {
            setFormData({ 
                name: '', 
                email: '', 
                role: '', 
                jenisPekerjaan: '',
                password: '', 
                oldPassword: '', 
                photoUrl: '',
                kebunId: null,
                kebunIds: []
            });
        }
        // Reset file-related states
        setSelectedFile(null);
        setImgSrc('');
        setCrop(undefined);
        setCompletedCrop(undefined);
        setIsCropping(false);
        setShowPassword(false);
        setShowOldPassword(false);
    }, [initialData, isOpen]); // Reset on open and when data changes

    const handleFileChange = (file: File | null) => {
        if (file) {
            const reader = new FileReader();
            reader.addEventListener('load', () => setImgSrc(reader.result?.toString() || ''));
            reader.readAsDataURL(file);
            setIsCropping(true);
        } else {
            setSelectedFile(null);
            setFormData(prev => ({ ...prev, photoUrl: '' }));
        }
    };

    const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        imgRef.current = e.currentTarget;
        const { width, height } = e.currentTarget;
        const crop = centerCrop(
            makeAspectCrop(
                {
                    unit: '%',
                    width: 90,
                },
                1, // Aspect ratio 1:1
                width,
                height
            ),
            width,
            height
        );
        setCrop(crop);
    };

    const handleCrop = async () => {
        if (completedCrop && imgRef.current) {
            try {
                const croppedImageFile = await getCroppedImg(
                    imgRef.current,
                    completedCrop,
                    'cropped-profile.webp'
                );
                setSelectedFile(croppedImageFile);
                setIsCropping(false);
            } catch (e) {
                console.error(e);
                toast.error("Gagal memotong gambar.");
            }
        }
    };

    const handleSubmit = () => {
        if (!formData.name || !formData.email || !formData.role) {
            toast.error("Nama, Email, dan Role harus diisi.");
            return;
        }
        if (!initialData && !formData.password) {
            toast.error("Password harus diisi untuk pengguna baru.");
            return;
        }
        if (formData.role === 'MANDOR' && !formData.kebunId) {
            toast.error("Kebun wajib dipilih untuk role MANDOR.");
            return;
        }
        if (formData.role === 'MANAGER' && (!formData.kebunIds || formData.kebunIds.length === 0)) {
            toast.error("Minimal 1 kebun harus dipilih untuk role MANAGER.");
            return;
        }

        const isPrivilegedUser = currentUserRole === 'ADMIN' || currentUserRole === 'PEMILIK';
        // Check types to ensure safe comparison (convert to string if needed, assuming IDs are numbers or compatible strings)
        const isEditingOtherUser = initialData && String(initialData.id) !== String(currentUserId);
        const canBypassOldPassword = isPrivilegedUser && isEditingOtherUser;

        if (initialData && formData.password && !formData.oldPassword && !canBypassOldPassword) {
            toast.error("Password lama harus diisi jika ingin mengubah password.");
            return;
        }
        onConfirm({ ...formData, photo: selectedFile });
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-white p-0 overflow-hidden flex flex-col [&>button.absolute]:hidden">
                {!isCropping ? (
                    <>
                        <ModalHeader
                            title={title}
                            variant="emerald"
                            icon={<DocumentDuplicateIcon className="h-5 w-5 text-white" />}
                            onClose={onClose}
                        />
                        <ModalContentWrapper className="grid gap-4 flex-1 min-h-0 overflow-y-auto">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="name" className="text-right">Nama</Label>
                                <Input
                                    id="name"
                                    value={formData.name}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, name: e.target.value })}
                                    className="col-span-3 rounded-xl"
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="email" className="text-right">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={formData.email}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, email: e.target.value })}
                                    className="col-span-3 rounded-xl"
                                />
                            </div>
                            <div className="grid grid-cols-4 items-start gap-4">
                                <Label className="text-right mt-2">Foto Profil</Label>
                                <div className="col-span-3">
                                    <ImageUpload
                                        onFileChange={handleFileChange}
                                        previewUrl={selectedFile ? URL.createObjectURL(selectedFile) : formData.photoUrl}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="role" className="text-right">Role</Label>
                                <Select
                                    value={formData.role}
                                    onValueChange={(value: string) => setFormData({
                                        ...formData,
                                        role: value,
                                        kebunId: value === 'MANDOR' ? formData.kebunId : null,
                                        kebunIds: value === 'MANAGER' ? formData.kebunIds : []
                                    })}
                                >
                                    <SelectTrigger className="col-span-3 rounded-xl">
                                        {formData.role ? formData.role.charAt(0).toUpperCase() + formData.role.slice(1).toLowerCase() : 'Pilih Role'}
                                    </SelectTrigger>
                                    <SelectContent className="bg-white rounded-xl">
                                        {["ADMIN", "PEMILIK", "KASIR", "SUPIR", "MANDOR", "MANAGER", "KARYAWAN"].map((role) => (
                                            <SelectItem key={role} value={role}>{role}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="jenisPekerjaan" className="text-right">Jenis Pekerjaan</Label>
                                <Select
                                    value={formData.jenisPekerjaan}
                                    onValueChange={(value: string) => setFormData({ ...formData, jenisPekerjaan: value })}
                                >
                                    <SelectTrigger className="col-span-3 rounded-xl">
                                        {formData.jenisPekerjaan || 'Pilih Jenis Pekerjaan (Opsional)'}
                                    </SelectTrigger>
                                    <SelectContent className="bg-white rounded-xl">
                                        <SelectItem value="none">Tidak Ada</SelectItem>
                                        <SelectItem value="KEBUN">Karyawan Kebun</SelectItem>
                                        <SelectItem value="BULANAN">Karyawan Bulanan</SelectItem>
                                        <SelectItem value="HARIAN">Pekerja Harian</SelectItem>
                                        <SelectItem value="TUKANG BANGUNAN">Tukang Bangunan</SelectItem>
                                        <SelectItem value="OPERATOR">Operator</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {(formData.role === 'MANDOR') && (
                                <div className="grid grid-cols-4 items-center gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <Label htmlFor="kebunId" className="text-right">Kebun</Label>
                                    <Select
                                        value={formData.kebunId?.toString() || ''}
                                        onValueChange={(value: string) => setFormData({ ...formData, kebunId: Number(value) })}
                                    >
                                        <SelectTrigger className="col-span-3 rounded-xl">
                                            {formData.kebunId ? kebunList.find(k => k.id === formData.kebunId)?.name : 'Pilih Kebun'}
                                        </SelectTrigger>
                                        <SelectContent className="bg-white rounded-xl">
                                            {kebunList.map((kebun) => (
                                                <SelectItem key={kebun.id} value={kebun.id.toString()}>{kebun.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {formData.role === 'MANAGER' && (
                                <div className="grid grid-cols-4 items-start gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <Label className="text-right mt-2">Kebun (Multi)</Label>
                                    <div className="col-span-3 border rounded-xl p-3 max-h-40 overflow-y-auto space-y-2">
                                        {kebunList.map((kebun) => (
                                            <div key={kebun.id} className="flex items-center space-x-2">
                                                <Checkbox 
                                                    id={`kebun-${kebun.id}`} 
                                                    checked={formData.kebunIds.includes(kebun.id)}
                                                    onCheckedChange={(checked) => {
                                                        if (checked === true) {
                                                            setFormData({ ...formData, kebunIds: [...formData.kebunIds, kebun.id] });
                                                        } else {
                                                            setFormData({ ...formData, kebunIds: formData.kebunIds.filter(id => id !== kebun.id) });
                                                        }
                                                    }}
                                                />
                                                <label htmlFor={`kebun-${kebun.id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                                                    {kebun.name}
                                                </label>
                                            </div>
                                        ))}
                                        {kebunList.length === 0 && <p className="text-xs text-gray-500 italic">Memuat daftar kebun...</p>}
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="password" className="text-right">{initialData ? "Password Baru" : "Password"}</Label>
                                <div className="col-span-3 relative">
                                    <Input
                                        id="password"
                                        type={showPassword ? "text" : "password"}
                                        placeholder={initialData ? "Kosongkan jika tidak ingin diubah" : ""}
                                        value={formData.password}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, password: e.target.value })}
                                        className="rounded-xl pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(v => !v)}
                                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500"
                                        aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                                    >
                                        {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                                    </button>
                                </div>
                            </div>
                            {initialData && formData.password && !(
                                (currentUserRole === 'ADMIN' || currentUserRole === 'PEMILIK') && 
                                String(initialData.id) !== String(currentUserId)
                            ) && (
                                <div className="grid grid-cols-4 items-center gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <Label htmlFor="oldPassword" className="text-right">Password Lama</Label>
                                    <div className="col-span-3 relative">
                                        <Input
                                            id="oldPassword"
                                            type={showOldPassword ? "text" : "password"}
                                            placeholder="Masukkan password lama"
                                            value={formData.oldPassword}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, oldPassword: e.target.value })}
                                            className="rounded-xl pr-10"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowOldPassword(v => !v)}
                                            className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500"
                                            aria-label={showOldPassword ? "Sembunyikan password" : "Tampilkan password"}
                                        >
                                            {showOldPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </ModalContentWrapper>
                        <ModalFooter className="sm:justify-between">
                            <Button variant="outline" onClick={onClose} className="rounded-full">
                                <XMarkIcon className="h-4 w-4 mr-2" />
                                Batal
                            </Button>
                            <Button onClick={handleSubmit} className="rounded-full bg-emerald-600 hover:bg-emerald-700">
                                <CheckIcon className="h-4 w-4 mr-2" />
                                Simpan
                            </Button>
                        </ModalFooter>
                    </>
                ) : (
                    <>
                        <ModalHeader
                            title="Potong Gambar"
                            variant="emerald"
                            icon={<DocumentDuplicateIcon className="h-5 w-5 text-white" />}
                            onClose={() => setIsCropping(false)}
                        />
                        <div className="flex flex-col items-center px-6 py-5 flex-1 min-h-0 overflow-y-auto">
                            <ReactCrop
                                crop={crop}
                                onChange={c => setCrop(c)}
                                onComplete={c => setCompletedCrop(c)}
                                aspect={1}
                            >
                                <img ref={imgRef} src={imgSrc} onLoad={onImageLoad} alt="Crop me" style={{ maxHeight: '70vh' }} />
                            </ReactCrop>
                        </div>
                        <ModalFooter className="sm:justify-between">
                            <Button variant="outline" onClick={() => setIsCropping(false)} className="rounded-full">
                                <XMarkIcon className="h-4 w-4 mr-2" />
                                Batal
                            </Button>
                            <Button onClick={handleCrop} className="rounded-full bg-emerald-600 hover:bg-emerald-700">
                                <CheckIcon className="h-4 w-4 mr-2" />
                                Potong & Simpan
                            </Button>
                        </ModalFooter>
                    </>
                )}
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
            <DialogContent className="bg-white p-0 overflow-hidden flex flex-col [&>button.absolute]:hidden">
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
                        Konfirmasi
                    </Button>
                </ModalFooter>
            </DialogContent>
        </Dialog>
    );
}
