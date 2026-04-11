'use client'

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArchiveBoxIcon, BuildingOfficeIcon, CheckIcon, ChevronDownIcon, MagnifyingGlassIcon, PencilSquareIcon, PhotoIcon, PlusCircleIcon, TagIcon, TruckIcon, TrashIcon } from "@heroicons/react/24/outline";
import type { User, Kendaraan, UangJalan } from "@prisma/client";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { SesiUangJalanWithDetails } from "./page";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { ModalContentWrapper, ModalFooter, ModalHeader } from "@/components/ui/modal-elements";
import { convertImageFileToWebp } from "@/lib/image-webp";

const stripTagMarkers = (text: string) => {
    return String(text || '').replace(/\s*\[(KENDARAAN|KEBUN|PERUSAHAAN|KARYAWAN):[^\]]+\]/g, '').trim()
}

const parseTagMarkers = (text: string) => {
    const kendaraanPlatNomor = (String(text || '').match(/\[KENDARAAN:([^\]]+)\]/)?.[1] || '').trim()
    const kebunId = (String(text || '').match(/\[KEBUN:(\d+)\]/)?.[1] || '').trim()
    const perusahaanId = (String(text || '').match(/\[PERUSAHAAN:(\d+)\]/)?.[1] || '').trim()
    const karyawanId = (String(text || '').match(/\[KARYAWAN:(\d+)\]/)?.[1] || '').trim()
    return {
        kendaraanPlatNomor: kendaraanPlatNomor || '',
        kebunId: kebunId || '',
        perusahaanId: perusahaanId || '',
        karyawanId: karyawanId || '',
    }
}

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (data: any) => Promise<{ ok: boolean; createdSesiId?: number }>;
    title: string;
    initialData?: SesiUangJalanWithDetails | null;
    createdSesi?: SesiUangJalanWithDetails | null;
    onAddRincian?: (data: FormData) => Promise<boolean>;
    onUpdateRincian?: (rincianId: number, data: FormData) => Promise<boolean>;
    onDeleteRincian?: (rincianId: number, sesiId: number) => Promise<boolean>;
    supirList: User[];
    karyawanList: User[];
    kendaraanList: Kendaraan[];
    kebunList: any[];
    perusahaanList: any[];
}

export function SesiUangJalanModal({ isOpen, onClose, onConfirm, title, initialData, createdSesi, onAddRincian, onUpdateRincian, onDeleteRincian, supirList, karyawanList, kendaraanList, kebunList, perusahaanList }: ModalProps) {
    const [formData, setFormData] = useState({ supirId: '', keterangan: '', amount: '', kendaraanPlatNomor: '', tanggalMulai: '' });
    const [openSupirCombo, setOpenSupirCombo] = useState(false);
    const [supirQuery, setSupirQuery] = useState('');
    const [openKendaraanCombo, setOpenKendaraanCombo] = useState(false);
    const [kendaraanQuery, setKendaraanQuery] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [rincianForm, setRincianForm] = useState({ tipe: 'PENGELUARAN', amount: '', description: '', date: '' });
    const [rincianTag, setRincianTag] = useState<{ kendaraanPlatNomor: string; kebunId: string; perusahaanId: string; karyawanId: string }>({ kendaraanPlatNomor: '', kebunId: '', perusahaanId: '', karyawanId: '' })
    const [isTagPickerOpen, setIsTagPickerOpen] = useState(false)
    const [tagQueryKendaraan, setTagQueryKendaraan] = useState('')
    const [tagQueryKebun, setTagQueryKebun] = useState('')
    const [tagQueryPerusahaan, setTagQueryPerusahaan] = useState('')
    const [tagQueryKaryawan, setTagQueryKaryawan] = useState('')
    const [rincianFile, setRincianFile] = useState<File | null>(null);
    const [submittingRincian, setSubmittingRincian] = useState(false);
    const [rincianExpanded, setRincianExpanded] = useState(false);
    const [rincianPreviewUrl, setRincianPreviewUrl] = useState<string | null>(null);
    const rincianPreviewUrlRef = useRef<string | null>(null);
    const [editingRincianId, setEditingRincianId] = useState<number | null>(null);
    const [openDeleteRincian, setOpenDeleteRincian] = useState(false);
    const [deleteRincianTarget, setDeleteRincianTarget] = useState<any>(null);

    const rincianTagSummary = () => {
        if (rincianTag.kendaraanPlatNomor) return `Kendaraan: ${rincianTag.kendaraanPlatNomor}`
        if (rincianTag.kebunId) {
            const kb = kebunList.find((k: any) => String(k?.id) === String(rincianTag.kebunId))
            return `Kebun: ${String(kb?.name || kb?.nama || rincianTag.kebunId)}`
        }
        if (rincianTag.perusahaanId) {
            const p = perusahaanList.find((x: any) => String(x?.id) === String(rincianTag.perusahaanId))
            return `Perusahaan: ${String(p?.name || rincianTag.perusahaanId)}`
        }
        if (rincianTag.karyawanId) {
            const u = karyawanList.find((x: any) => String(x?.id) === String(rincianTag.karyawanId))
            return `Karyawan: ${String(u?.name || `#${rincianTag.karyawanId}`)}`
        }
        return 'Tanpa tag'
    }

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

    const isEditMode = !!(initialData && initialData.id);

    const getTodayWIB = () => {
        return new Intl.DateTimeFormat('en-CA', { 
            timeZone: 'Asia/Jakarta',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(new Date());
    };

    useEffect(() => {
        if (isOpen) {
            const today = getTodayWIB();
            if (initialData) {
                setFormData({
                    supirId: initialData.supirId ? initialData.supirId.toString() : '',
                    keterangan: initialData.keterangan || '',
                    amount: initialData.rincian?.find((r: UangJalan) => r.tipe === 'DIBERIKAN')?.amount.toString() || '',
                    kendaraanPlatNomor: initialData.kendaraanPlatNomor || '',
                    tanggalMulai: initialData.tanggalMulai ? new Date(initialData.tanggalMulai).toISOString().split('T')[0] : today,
                });
            } else {
                setFormData({ supirId: '', keterangan: '', amount: '', kendaraanPlatNomor: '', tanggalMulai: today });
            }
            setSubmitting(false);
            setRincianForm({ tipe: 'PENGELUARAN', amount: '', description: '', date: today });
            setRincianTag({ kendaraanPlatNomor: '', kebunId: '', perusahaanId: '', karyawanId: '' })
            setIsTagPickerOpen(false)
            setTagQueryKendaraan('')
            setTagQueryKebun('')
            setTagQueryPerusahaan('')
            setTagQueryKaryawan('')
            setRincianFile(null);
            setSubmittingRincian(false);
            setRincianExpanded(false);
            if (rincianPreviewUrlRef.current) URL.revokeObjectURL(rincianPreviewUrlRef.current);
            rincianPreviewUrlRef.current = null;
            setRincianPreviewUrl(null);
        }
    }, [initialData, isOpen]);

    useEffect(() => {
        if (!rincianFile) {
            if (rincianPreviewUrlRef.current) URL.revokeObjectURL(rincianPreviewUrlRef.current);
            rincianPreviewUrlRef.current = null;
            setRincianPreviewUrl(null);
            return;
        }

        const url = URL.createObjectURL(rincianFile);
        if (rincianPreviewUrlRef.current) URL.revokeObjectURL(rincianPreviewUrlRef.current);
        rincianPreviewUrlRef.current = url;
        setRincianPreviewUrl(url);
    }, [rincianFile]);

    const handleSubmit = async () => {
        if (submitting) return;
        const tanggalMulai = formData.tanggalMulai || getTodayWIB();

        if (isEditMode) {
            setSubmitting(true);
            const res = await onConfirm({ 
                keterangan: formData.keterangan,
                kendaraanPlatNomor: formData.kendaraanPlatNomor || null,
                tanggalMulai,
            });
            setSubmitting(false);
            if (res.ok && !createdSesi) onClose();
            return;
        }

        const dataToSubmit = {
            supirId: parseInt(formData.supirId, 10),
            amount: parseFloat(formData.amount),
            keterangan: formData.keterangan,
            kendaraanPlatNomor: formData.kendaraanPlatNomor === 'no-vehicle' ? null : formData.kendaraanPlatNomor || null,
            tanggalMulai,
        };

        if (!dataToSubmit.supirId || !dataToSubmit.amount) {
            toast.error("Supir dan Nominal harus diisi.");
            return;
        }

        setSubmitting(true);
        const res = await onConfirm(dataToSubmit);
        setSubmitting(false);
        if (!res.ok) return;
    };

    const fmtCurrency = (n: number) => {
        return `Rp ${Math.round(Number(n || 0)).toLocaleString('id-ID')}`;
    };

    const handleAddRincian = async (mode: 'keep' | 'close') => {
        if (!createdSesi) return;
        if (!onAddRincian) return;
        if (submittingRincian) return;
        if (!rincianForm.amount) {
            toast.error('Nominal harus diisi.')
            return
        }
        if (rincianFile) {
            const MAX_BYTES = 5 * 1024 * 1024;
            const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
            if (typeof (rincianFile as any).size === 'number' && (rincianFile as any).size > MAX_BYTES) {
                toast.error('Ukuran file maksimal 5MB')
                return
            }
            if (rincianFile.type && !allowedTypes.includes(rincianFile.type)) {
                toast.error('Format file harus JPG/PNG/WEBP')
                return
            }
        }

        const data = new FormData();
        data.append('sesiUangJalanId', String(createdSesi.id));
        data.append('tipe', rincianForm.tipe);
        data.append('amount', parseRupiah(rincianForm.amount));
        data.append('description', rincianForm.description || '');
        if (rincianForm.date) data.append('date', rincianForm.date);
        if (rincianFile) data.append('gambar', rincianFile);
        if (rincianTag.kendaraanPlatNomor) data.append('tagKendaraanPlatNomor', rincianTag.kendaraanPlatNomor)
        if (rincianTag.kebunId) data.append('tagKebunId', rincianTag.kebunId)
        if (rincianTag.perusahaanId) data.append('tagPerusahaanId', rincianTag.perusahaanId)
        if (rincianTag.karyawanId) data.append('tagKaryawanId', rincianTag.karyawanId)

        setSubmittingRincian(true);
        const ok = await onAddRincian(data);
        setSubmittingRincian(false);
        if (!ok) return;

        if (mode === 'close') {
            onClose();
            return;
        }

        setRincianForm(prev => ({ ...prev, amount: '', description: '' }));
        setRincianTag({ kendaraanPlatNomor: '', kebunId: '', perusahaanId: '', karyawanId: '' })
        setRincianFile(null);
    };

    const startEditRincian = (r: any) => {
        const date = r?.date ? new Date(r.date) : new Date()
        const rawDesc = String(r.description || '')
        const tags = parseTagMarkers(rawDesc)
        setEditingRincianId(Number(r.id))
        setRincianExpanded(true)
        setRincianForm({
            tipe: String(r.tipe || 'PENGELUARAN'),
            amount: String(Math.round(Number(r.amount || 0))),
            description: stripTagMarkers(rawDesc),
            date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date),
        })
        setRincianTag(tags)
        setRincianFile(null)
    }

    const cancelEditRincian = () => {
        setEditingRincianId(null)
        setRincianForm(prev => ({ ...prev, amount: '', description: '' }))
        setRincianTag({ kendaraanPlatNomor: '', kebunId: '', perusahaanId: '', karyawanId: '' })
        setRincianFile(null)
    }

    const submitEditRincian = async (mode: 'keep' | 'close') => {
        if (!createdSesi) return
        if (!onUpdateRincian) return
        if (!editingRincianId) return
        if (submittingRincian) return
        if (!rincianForm.amount) {
            toast.error('Nominal harus diisi.')
            return
        }

        const data = new FormData()
        data.append('sesiUangJalanId', String(createdSesi.id))
        data.append('tipe', rincianForm.tipe)
        data.append('amount', parseRupiah(rincianForm.amount))
        data.append('description', rincianForm.description || '')
        if (rincianForm.date) data.append('date', rincianForm.date)
        if (rincianFile) data.append('gambar', rincianFile)
        if (rincianTag.kendaraanPlatNomor) data.append('tagKendaraanPlatNomor', rincianTag.kendaraanPlatNomor)
        if (rincianTag.kebunId) data.append('tagKebunId', rincianTag.kebunId)
        if (rincianTag.perusahaanId) data.append('tagPerusahaanId', rincianTag.perusahaanId)
        if (rincianTag.karyawanId) data.append('tagKaryawanId', rincianTag.karyawanId)

        setSubmittingRincian(true)
        const ok = await onUpdateRincian(editingRincianId, data)
        setSubmittingRincian(false)
        if (!ok) return

        setEditingRincianId(null)
        setRincianForm(prev => ({ ...prev, amount: '', description: '' }))
        setRincianTag({ kendaraanPlatNomor: '', kebunId: '', perusahaanId: '', karyawanId: '' })
        setRincianFile(null)
        if (mode === 'close') onClose()
    }

    const handleDeleteOneRincian = async (r: any) => {
        if (!createdSesi) return
        if (!onDeleteRincian) return
        const id = Number(r?.id)
        if (!id) return
        setDeleteRincianTarget(r)
        setOpenDeleteRincian(true)
    }

    return (
        <>
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-white w-[95vw] sm:max-w-lg max-h-[92vh] rounded-2xl p-0 overflow-hidden [&>button.absolute]:hidden flex flex-col">
                <ModalHeader
                    title={title}
                    subtitle={createdSesi ? "Kelola rincian sesi uang jalan" : "Buat sesi uang jalan baru"}
                    variant="emerald"
                    icon={<PlusCircleIcon className="h-5 w-5 text-white" />}
                    onClose={onClose}
                />
                <ModalContentWrapper className="grid gap-4 flex-1 min-h-0 overflow-y-auto scrollbar-hide">
                    {createdSesi ? (
                        <div className="space-y-3">
                            <div className="grid grid-cols-3 gap-2">
                                <div className="p-3 rounded-xl border bg-gray-50">
                                    <div className="text-[11px] text-gray-600">Total Pemasukan</div>
                                    <div className="font-semibold text-gray-900">{fmtCurrency(createdSesi.totalDiberikan || 0)}</div>
                                </div>
                                <div className="p-3 rounded-xl border bg-gray-50">
                                    <div className="text-[11px] text-gray-600">Total Pengeluaran</div>
                                    <div className="font-semibold text-gray-900">{fmtCurrency(createdSesi.totalPengeluaran || 0)}</div>
                                </div>
                                <div className="p-3 rounded-xl border bg-gray-50">
                                    <div className="text-[11px] text-gray-600">Sisa</div>
                                    <div className="font-semibold text-emerald-700">{fmtCurrency(createdSesi.saldo || 0)}</div>
                                </div>
                            </div>

                            {isEditMode ? (
                                <div className="rounded-xl border overflow-hidden">
                                    <div className="px-3 py-2 bg-gray-50 text-xs font-semibold text-gray-700">Ubah Keterangan</div>
                                    <div className="p-3 space-y-3">
                                        <Input
                                            value={formData.keterangan}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, keterangan: e.target.value })}
                                            className="input-style rounded-full"
                                            placeholder="Keterangan sesi (opsional)"
                                        />
                                        <Button
                                            className="rounded-full"
                                            variant="outline"
                                            onClick={handleSubmit}
                                            disabled={submitting}
                                        >
                                            Simpan Keterangan
                                        </Button>
                                    </div>
                                </div>
                            ) : null}

                            <div className="rounded-xl border overflow-hidden">
                                <div className="px-3 py-2 bg-gray-50 text-xs font-semibold text-gray-700 flex items-center justify-between">
                                    <div>Rincian Transaksi</div>
                                    <div className="text-gray-500">{createdSesi.rincian?.length || 0} item</div>
                                </div>
                                <div className="max-h-48 overflow-y-auto divide-y">
                                    {(createdSesi.rincian || []).slice().reverse().map((r: any) => (
                                        <div key={r.id} className="px-3 py-2 flex items-center justify-between text-sm">
                                            <div className="truncate">
                                                <div className="font-semibold text-gray-900">{r.tipe}</div>
                                                <div className="text-xs text-gray-500 truncate">{stripTagMarkers(r.description || '-') || '-'}</div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className={r.tipe === 'PENGELUARAN' ? 'font-semibold text-rose-700' : 'font-semibold text-emerald-700'}>
                                                    {fmtCurrency(r.amount || 0)}
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => startEditRincian(r)}
                                                    className="h-8 w-8 inline-flex items-center justify-center rounded-full border border-gray-200 bg-white hover:bg-gray-50"
                                                    title="Edit"
                                                    aria-label="Edit"
                                                >
                                                    <PencilSquareIcon className="h-4 w-4 text-gray-700" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteOneRincian(r)}
                                                    className="h-8 w-8 inline-flex items-center justify-center rounded-full border border-gray-200 bg-white hover:bg-gray-50"
                                                    title="Hapus"
                                                    aria-label="Hapus"
                                                >
                                                    <TrashIcon className="h-4 w-4 text-rose-600" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="rounded-xl border overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => setRincianExpanded((v) => !v)}
                                    className="w-full px-3 py-2 bg-gray-50 text-xs font-semibold text-gray-700 flex items-center justify-between"
                                >
                                    <div className="flex items-center gap-2">
                                        <PlusCircleIcon className="h-4 w-4 text-emerald-600" />
                                        <span>Tambah Rincian</span>
                                    </div>
                                    <ChevronDownIcon className={`h-4 w-4 text-gray-500 transition-transform ${rincianExpanded ? 'rotate-180' : ''}`} />
                                </button>
                                {rincianExpanded ? (
                                <div className="p-3 space-y-3">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-xs text-gray-600">Tanggal</Label>
                                            <Input
                                                type="date"
                                                value={rincianForm.date}
                                                onChange={(e) => setRincianForm(prev => ({ ...prev, date: e.target.value }))}
                                                className="input-style rounded-full"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs text-gray-600">Tipe</Label>
                                            <select
                                                className="input-style rounded-full h-10 w-full bg-white"
                                                value={rincianForm.tipe}
                                                onChange={(e) => setRincianForm(prev => ({ ...prev, tipe: e.target.value }))}
                                            >
                                                <option value="PENGELUARAN">Pengeluaran</option>
                                                <option value="PEMASUKAN">Pemasukan</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <Label className="text-xs text-gray-600">Nominal</Label>
                                        <Input
                                            value={formatRupiah(rincianForm.amount)}
                                            onChange={(e) => {
                                                const rawValue = parseRupiah(e.target.value);
                                                if (!isNaN(Number(rawValue))) {
                                                    setRincianForm(prev => ({ ...prev, amount: rawValue }));
                                                }
                                            }}
                                            className="input-style rounded-full"
                                            inputMode="numeric"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <Label className="text-xs text-gray-600">Keterangan</Label>
                                        <Input
                                            value={rincianForm.description}
                                            onChange={(e) => setRincianForm(prev => ({ ...prev, description: e.target.value }))}
                                            className="input-style rounded-full"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <Label className="text-xs text-gray-600">Tag (untuk laporan biaya)</Label>
                                        <button
                                            type="button"
                                            onClick={() => setIsTagPickerOpen(true)}
                                            className="input-style rounded-full flex items-center justify-between gap-2 w-full"
                                        >
                                            <div className="truncate text-left text-sm text-gray-900">{rincianTagSummary()}</div>
                                            <TagIcon className="h-4 w-4 text-emerald-600 shrink-0" />
                                        </button>
                                    </div>

                                    <div className="space-y-1">
                                        <Label className="text-xs text-gray-600">Bukti (JPG/PNG/WEBP)</Label>
                                        <div className="flex items-center gap-2">
                                            <label className={submittingRincian ? 'opacity-50 pointer-events-none' : ''}>
                                                <span className="inline-flex items-center justify-center rounded-full border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer">
                                                    <PhotoIcon className="h-4 w-4 mr-2" />
                                                    Upload Gambar
                                                </span>
                                                <input
                                                    type="file"
                                                    accept="image/jpeg,image/png,image/webp"
                                                    className="sr-only"
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0] || null
                                                        e.target.value = ''
                                                        if (!file) {
                                                            setRincianFile(null)
                                                            return
                                                        }
                                                        ;(async () => {
                                                            const converted = await convertImageFileToWebp(file, { quality: 0.9, maxDimension: 1920 })
                                                            setRincianFile(converted)
                                                        })()
                                                    }}
                                                />
                                            </label>
                                            {rincianFile ? (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    className="rounded-full"
                                                    onClick={() => setRincianFile(null)}
                                                    disabled={submittingRincian}
                                                >
                                                    <TrashIcon className="h-4 w-4 mr-2" />
                                                    Hapus
                                                </Button>
                                            ) : null}
                                        </div>
                                        {rincianPreviewUrl ? (
                                            <div className="mt-2 rounded-xl border overflow-hidden w-full">
                                                <img src={rincianPreviewUrl} alt="Preview" className="w-full h-44 object-cover" />
                                            </div>
                                        ) : null}
                                    </div>

                                    {editingRincianId ? (
                                        <div className="flex flex-col sm:flex-row gap-2">
                                            <Button variant="outline" className="rounded-full" onClick={cancelEditRincian} disabled={submittingRincian}>
                                                Batal Edit
                                            </Button>
                                            <Button className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => submitEditRincian('keep')} disabled={submittingRincian || !onUpdateRincian}>
                                                {submittingRincian ? 'Menyimpan...' : 'Simpan Perubahan'}
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col sm:flex-row gap-2">
                                            <Button variant="outline" className="rounded-full" onClick={() => handleAddRincian('keep')} disabled={submittingRincian || !onAddRincian}>
                                                {submittingRincian ? 'Menyimpan...' : 'Simpan & Tambah Lagi'}
                                            </Button>
                                            <Button className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleAddRincian('close')} disabled={submittingRincian || !onAddRincian}>
                                                {submittingRincian ? 'Menyimpan...' : 'Simpan & Tutup'}
                                            </Button>
                                        </div>
                                    )}
                                </div>
                                ) : (
                                    <div className="px-3 py-3 text-sm text-gray-500">Klik tombol + untuk menambah rincian transaksi.</div>
                                )}
                            </div>
                        </div>
                    ) : null}

                    {createdSesi ? null : (
                    <>
                    <div className="grid gap-2">
                        <Label htmlFor="tanggalMulai" className="text-gray-700 font-medium">Tanggal</Label>
                        <Input
                            id="tanggalMulai"
                            type="date"
                            value={formData.tanggalMulai}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, tanggalMulai: e.target.value })}
                            className="input-style rounded-full"
                            placeholder="Pilih tanggal sesi"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="supirId" className="text-gray-700 font-medium">Supir</Label>
                        <Popover open={openSupirCombo} onOpenChange={setOpenSupirCombo}>
                            <PopoverTrigger asChild>
                                <button
                                    type="button"
                                    className={`input-style rounded-full flex items-center justify-between ${isEditMode ? 'opacity-60 pointer-events-none' : ''}`}
                                    aria-haspopup="listbox"
                                >
                                    <span>{formData.supirId ? supirList.find(s => s.id.toString() === formData.supirId)?.name : "Pilih supir"}</span>
                                    <ChevronDownIcon className="w-4 h-4 text-gray-500" />
                                </button>
                            </PopoverTrigger>
                            <PopoverContent align="start" className="p-2 w-[--radix-popover-trigger-width] max-h-60 overflow-y-auto bg-white rounded-xl border shadow-sm">
                                <div className="relative mb-2">
                                    <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <Input
                                        autoFocus
                                        placeholder="Cari supir…"
                                        value={supirQuery}
                                        onChange={(e) => setSupirQuery(e.target.value)}
                                        className="rounded-lg pl-9"
                                    />
                                </div>
                                <div role="listbox" className="space-y-1">
                                    {supirList
                                        .filter(s => s.name.toLowerCase().includes(supirQuery.toLowerCase()))
                                        .map(s => (
                                            <button
                                                key={s.id}
                                                type="button"
                                                onClick={() => {
                                                    setFormData({ ...formData, supirId: s.id.toString() })
                                                    setOpenSupirCombo(false)
                                                }}
                                                className={`w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 ${formData.supirId === s.id.toString() ? 'bg-emerald-50 text-emerald-700' : ''}`}
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
                    <div className="grid gap-2">
                        <Label htmlFor="kendaraanPlatNomor" className="text-gray-700 font-medium">Kendaraan</Label>
                        <Popover open={openKendaraanCombo} onOpenChange={setOpenKendaraanCombo}>
                            <PopoverTrigger asChild>
                                <button
                                    type="button"
                                    className="input-style rounded-full flex items-center justify-between"
                                    aria-haspopup="listbox"
                                >
                                    <span>
                                        {formData.kendaraanPlatNomor
                                            ? kendaraanList.find(k => k.platNomor === formData.kendaraanPlatNomor)?.platNomor
                                            : "Pilih kendaraan (opsional)"}
                                    </span>
                                    <ChevronDownIcon className="w-4 h-4 text-gray-500" />
                                </button>
                            </PopoverTrigger>
                            <PopoverContent align="start" className="p-2 w-[--radix-popover-trigger-width] max-h-60 overflow-y-auto bg-white rounded-xl border shadow-sm">
                                <div className="relative mb-2">
                                    <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <Input
                                        autoFocus
                                        placeholder="Cari kendaraan…"
                                        value={kendaraanQuery}
                                        onChange={(e) => setKendaraanQuery(e.target.value)}
                                        className="rounded-lg pl-9"
                                    />
                                </div>
                                <div role="listbox" className="space-y-1">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setFormData({ ...formData, kendaraanPlatNomor: '' })
                                            setOpenKendaraanCombo(false)
                                        }}
                                        className={`w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 ${!formData.kendaraanPlatNomor ? 'bg-emerald-50 text-emerald-700' : ''}`}
                                    >
                                        Tidak ada
                                    </button>
                                    {kendaraanList
                                        .filter(k => `${k.platNomor} ${k.merk || ''}`.toLowerCase().includes(kendaraanQuery.toLowerCase()))
                                        .map(k => (
                                            <button
                                                key={k.platNomor}
                                                type="button"
                                                onClick={() => {
                                                    setFormData({ ...formData, kendaraanPlatNomor: k.platNomor })
                                                    setOpenKendaraanCombo(false)
                                                }}
                                                className={`w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 ${formData.kendaraanPlatNomor === k.platNomor ? 'bg-emerald-50 text-emerald-700' : ''}`}
                                            >
                                                {k.platNomor} {k.merk ? `- ${k.merk}` : ''}
                                            </button>
                                        ))}
                                    {kendaraanList.filter(k => `${k.platNomor} ${k.merk || ''}`.toLowerCase().includes(kendaraanQuery.toLowerCase())).length === 0 && (
                                        <div className="px-3 py-2 text-sm text-gray-500">Tidak ditemukan</div>
                                    )}
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="keterangan" className="text-gray-700 font-medium">Keterangan</Label>
                        <Input
                            id="keterangan"
                            value={formData.keterangan}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, keterangan: e.target.value })}
                            className="input-style rounded-full"
                            placeholder="Contoh: Uang jalan minggu 1"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="amount" className="text-gray-700 font-medium">Nominal Awal</Label>
                        <Input
                            id="amount"
                            type="text"
                            value={formatRupiah(formData.amount)}
                            onChange={handleAmountChange}
                            className="input-style rounded-full"
                            disabled={isEditMode}
                            placeholder="Masukkan nominal awal"
                        />
                    </div>
                    </>
                    )}
                </ModalContentWrapper>
                <ModalFooter className="gap-2 sm:gap-3 sm:justify-between">
                    <Button variant="outline" className="rounded-full" onClick={onClose} disabled={submitting}>Batal</Button>
                    {createdSesi ? (
                        <>
                            <Button className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white" onClick={onClose} disabled={submitting}>Selesai</Button>
                        </>
                    ) : (
                        <Button className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleSubmit} disabled={submitting}>Simpan</Button>
                    )}
                </ModalFooter>
            </DialogContent>
        </Dialog>
        <Dialog open={isTagPickerOpen} onOpenChange={setIsTagPickerOpen}>
            <DialogContent className="bg-white w-[95vw] sm:max-w-lg max-h-[92vh] rounded-2xl p-0 overflow-hidden [&>button.absolute]:hidden flex flex-col">
                <ModalHeader
                    title="Pilih Tag"
                    subtitle={rincianTagSummary()}
                    variant="emerald"
                    icon={<TagIcon className="h-5 w-5 text-white" />}
                    onClose={() => setIsTagPickerOpen(false)}
                />
                <ModalContentWrapper className="space-y-4 flex-1 min-h-0 overflow-y-auto scrollbar-hide">
                    <div className="flex justify-end">
                        <Button
                            type="button"
                            variant="outline"
                            className="rounded-full"
                            onClick={() => setRincianTag({ kendaraanPlatNomor: '', kebunId: '', perusahaanId: '', karyawanId: '' })}
                        >
                            Reset Tag
                        </Button>
                    </div>

                    <div className="rounded-xl border border-gray-100 p-3">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <TruckIcon className="h-4 w-4 text-gray-700" />
                                <div className="text-sm font-semibold text-gray-900">Kendaraan</div>
                            </div>
                            <div className="text-xs text-gray-500">{rincianTag.kendaraanPlatNomor ? 'Dipilih' : 'Tidak'}</div>
                        </div>
                        <div className="mt-2 relative">
                            <MagnifyingGlassIcon className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                value={tagQueryKendaraan}
                                onChange={(e) => setTagQueryKendaraan(e.target.value)}
                                className="input-style w-full pl-9"
                                placeholder="Cari plat / merk..."
                            />
                        </div>
                        <div className="mt-3 max-h-44 overflow-y-auto pr-1 space-y-2">
                            {kendaraanList
                                .filter((k: any) => {
                                    const q = tagQueryKendaraan.trim().toLowerCase()
                                    if (!q) return true
                                    const plat = String(k?.platNomor || '').toLowerCase()
                                    const merk = String(k?.merk || '').toLowerCase()
                                    return plat.includes(q) || merk.includes(q)
                                })
                                .map((k: any) => {
                                    const plat = String(k?.platNomor || '')
                                    const checked = rincianTag.kendaraanPlatNomor === plat
                                    return (
                                        <button
                                            key={plat}
                                            type="button"
                                            onClick={() => setRincianTag({ kendaraanPlatNomor: checked ? '' : plat, kebunId: '', perusahaanId: '', karyawanId: '' })}
                                            className={`w-full flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-gray-50 ${checked ? 'bg-emerald-50/60' : ''}`}
                                        >
                                            <div className="text-sm text-gray-900 text-left">
                                                {plat} <span className="text-gray-500">({k?.merk || '-'})</span>
                                            </div>
                                            {checked ? <CheckIcon className="h-4 w-4 text-emerald-700" /> : <span className="h-4 w-4" />}
                                        </button>
                                    )
                                })}
                            {kendaraanList.length === 0 ? <div className="px-2 py-2 text-sm text-gray-500">Tidak ada data kendaraan</div> : null}
                        </div>
                    </div>

                    <div className="rounded-xl border border-gray-100 p-3">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <ArchiveBoxIcon className="h-4 w-4 text-gray-700" />
                                <div className="text-sm font-semibold text-gray-900">Kebun</div>
                            </div>
                            <div className="text-xs text-gray-500">{rincianTag.kebunId ? 'Dipilih' : 'Tidak'}</div>
                        </div>
                        <div className="mt-2 relative">
                            <MagnifyingGlassIcon className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                value={tagQueryKebun}
                                onChange={(e) => setTagQueryKebun(e.target.value)}
                                className="input-style w-full pl-9"
                                placeholder="Cari nama kebun..."
                            />
                        </div>
                        <div className="mt-3 max-h-44 overflow-y-auto pr-1 space-y-2">
                            {kebunList
                                .filter((kb: any) => {
                                    const q = tagQueryKebun.trim().toLowerCase()
                                    if (!q) return true
                                    const name = String(kb?.name || kb?.nama || '').toLowerCase()
                                    return name.includes(q)
                                })
                                .map((kb: any) => {
                                    const idVal = String(kb?.id)
                                    const label = String(kb?.name || kb?.nama || `Kebun #${kb?.id}`)
                                    const checked = rincianTag.kebunId === idVal
                                    return (
                                        <button
                                            key={idVal}
                                            type="button"
                                            onClick={() => setRincianTag({ kendaraanPlatNomor: '', kebunId: checked ? '' : idVal, perusahaanId: '', karyawanId: '' })}
                                            className={`w-full flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-gray-50 ${checked ? 'bg-emerald-50/60' : ''}`}
                                        >
                                            <div className="text-sm text-gray-900 text-left">{label}</div>
                                            {checked ? <CheckIcon className="h-4 w-4 text-emerald-700" /> : <span className="h-4 w-4" />}
                                        </button>
                                    )
                                })}
                            {kebunList.length === 0 ? <div className="px-2 py-2 text-sm text-gray-500">Tidak ada data kebun</div> : null}
                        </div>
                    </div>

                    <div className="rounded-xl border border-gray-100 p-3">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <BuildingOfficeIcon className="h-4 w-4 text-gray-700" />
                                <div className="text-sm font-semibold text-gray-900">Perusahaan</div>
                            </div>
                            <div className="text-xs text-gray-500">{rincianTag.perusahaanId ? 'Dipilih' : 'Tidak'}</div>
                        </div>
                        <div className="mt-2 relative">
                            <MagnifyingGlassIcon className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                value={tagQueryPerusahaan}
                                onChange={(e) => setTagQueryPerusahaan(e.target.value)}
                                className="input-style w-full pl-9"
                                placeholder="Cari perusahaan..."
                            />
                        </div>
                        <div className="mt-3 max-h-44 overflow-y-auto pr-1 space-y-2">
                            {perusahaanList
                                .filter((p: any) => {
                                    const q = tagQueryPerusahaan.trim().toLowerCase()
                                    if (!q) return true
                                    const name = String(p?.name || '').toLowerCase()
                                    return name.includes(q)
                                })
                                .map((p: any) => {
                                    const idVal = String(p?.id)
                                    const label = String(p?.name || `Perusahaan #${idVal}`)
                                    const checked = rincianTag.perusahaanId === idVal
                                    return (
                                        <button
                                            key={idVal}
                                            type="button"
                                            onClick={() => setRincianTag({ kendaraanPlatNomor: '', kebunId: '', perusahaanId: checked ? '' : idVal, karyawanId: '' })}
                                            className={`w-full flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-gray-50 ${checked ? 'bg-emerald-50/60' : ''}`}
                                        >
                                            <div className="text-sm text-gray-900 text-left">{label}</div>
                                            {checked ? <CheckIcon className="h-4 w-4 text-emerald-700" /> : <span className="h-4 w-4" />}
                                        </button>
                                    )
                                })}
                            {perusahaanList.length === 0 ? <div className="px-2 py-2 text-sm text-gray-500">Tidak ada data perusahaan</div> : null}
                        </div>
                    </div>

                    <div className="rounded-xl border border-gray-100 p-3">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <MagnifyingGlassIcon className="h-4 w-4 text-gray-700" />
                                <div className="text-sm font-semibold text-gray-900">Karyawan</div>
                            </div>
                            <div className="text-xs text-gray-500">{rincianTag.karyawanId ? 'Dipilih' : 'Tidak'}</div>
                        </div>
                        <div className="mt-2 relative">
                            <MagnifyingGlassIcon className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                value={tagQueryKaryawan}
                                onChange={(e) => setTagQueryKaryawan(e.target.value)}
                                className="input-style w-full pl-9"
                                placeholder="Cari nama karyawan..."
                            />
                        </div>
                        <div className="mt-3 max-h-44 overflow-y-auto pr-1 space-y-2">
                            {karyawanList
                                .filter((u: any) => {
                                    const q = tagQueryKaryawan.trim().toLowerCase()
                                    if (!q) return true
                                    const name = String(u?.name || '').toLowerCase()
                                    return name.includes(q)
                                })
                                .map((u: any) => {
                                    const idVal = String(u?.id)
                                    const label = String(u?.name || `User #${idVal}`)
                                    const checked = rincianTag.karyawanId === idVal
                                    return (
                                        <button
                                            key={idVal}
                                            type="button"
                                            onClick={() => setRincianTag({ kendaraanPlatNomor: '', kebunId: '', perusahaanId: '', karyawanId: checked ? '' : idVal })}
                                            className={`w-full flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-gray-50 ${checked ? 'bg-emerald-50/60' : ''}`}
                                        >
                                            <div className="text-sm text-gray-900 text-left">{label}</div>
                                            {checked ? <CheckIcon className="h-4 w-4 text-emerald-700" /> : <span className="h-4 w-4" />}
                                        </button>
                                    )
                                })}
                            {karyawanList.length === 0 ? <div className="px-2 py-2 text-sm text-gray-500">Tidak ada data karyawan</div> : null}
                        </div>
                    </div>
                </ModalContentWrapper>
                <ModalFooter className="justify-end">
                    <Button type="button" className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setIsTagPickerOpen(false)}>
                        Selesai
                    </Button>
                </ModalFooter>
            </DialogContent>
        </Dialog>

        <ConfirmationModal
            isOpen={openDeleteRincian}
            onClose={() => { setOpenDeleteRincian(false); setDeleteRincianTarget(null) }}
            onConfirm={async () => {
                if (!createdSesi) return
                if (!createdSesi) return
                if (!onDeleteRincian) return
                const id = Number(deleteRincianTarget?.id)
                if (!id) return
                setOpenDeleteRincian(false)
                setDeleteRincianTarget(null)
                setSubmittingRincian(true)
                const ok = await onDeleteRincian(id, createdSesi.id)
                setSubmittingRincian(false)
                if (ok && editingRincianId === id) cancelEditRincian()
            }}
            title="Konfirmasi Hapus Rincian"
            description="Apakah Anda yakin ingin menghapus rincian transaksi ini?"
            variant="emerald"
        />
        </>
    );
}
