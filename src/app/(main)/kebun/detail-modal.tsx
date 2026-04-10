'use client'

import { Dialog, DialogContent, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { KebunData, formatKebunText } from "./columns"
import { format } from "date-fns"
import { id } from "date-fns/locale"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useEffect, useState, useCallback } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ConfirmationModal } from "@/components/ui/confirmation-modal"
import toast from "react-hot-toast"
import { ArrowPathIcon, PlusIcon, TrashIcon, MapPinIcon, XMarkIcon } from "@heroicons/react/24/outline"
import { ModalHeader, ModalContentWrapper, ModalFooter } from '@/components/ui/modal-elements'

interface DetailModalProps {
    isOpen: boolean
    onClose: () => void
    kebun: KebunData | null
    onUpdated?: () => void
}

export function DetailKebunModal({ isOpen, onClose, kebun, onUpdated }: DetailModalProps) {
    const [activeTab, setActiveTab] = useState("info")
    const [panenList, setPanenList] = useState<any[]>([])
    const [pekerjaanList, setPekerjaanList] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [userList, setUserList] = useState<any[]>([])
    const [editMode, setEditMode] = useState(false)
    const [localName, setLocalName] = useState("")
    const [localLocation, setLocalLocation] = useState("")
    const [savingKebun, setSavingKebun] = useState(false)
    const [openDeleteKebunConfirm, setOpenDeleteKebunConfirm] = useState(false)
    const today = new Date()
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0]
    const [startDate, setStartDate] = useState<string>(startOfMonth)
    const [endDate, setEndDate] = useState<string>(endOfMonth)

    // Form State for Pekerjaan
    const [jenisPekerjaan, setJenisPekerjaan] = useState("")
    const [keterangan, setKeterangan] = useState("")
    const [biaya, setBiaya] = useState("")
    const [userId, setUserId] = useState<string>("")
    const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0])
    const [submitting, setSubmitting] = useState(false)

    const fetchData = useCallback(async () => {
        if (!kebun) return
        setLoading(true)
        try {
            const qs = `?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`
            const [panenRes, pekerjaanRes] = await Promise.all([
                fetch(`/api/kebun/${kebun.id}/panen${qs}`),
                fetch(`/api/kebun/${kebun.id}/pekerjaan${qs}`)
            ])
            
            if (panenRes.ok) setPanenList(await panenRes.json())
            if (pekerjaanRes.ok) setPekerjaanList(await pekerjaanRes.json())
        } catch (error) {
            console.error(error)
            toast.error("Gagal memuat data detail")
        } finally {
            setLoading(false)
        }
    }, [kebun, startDate, endDate])

    const fetchUsers = useCallback(async () => {
        try {
            const res = await fetch('/api/users?limit=100') // Get all users for selection
            if (res.ok) {
                const data = await res.json()
                // If the API returns { data: [...] } or [...]
                setUserList(Array.isArray(data) ? data : data.data || [])
            }
        } catch (error) {
            console.error("Failed to fetch users")
        }
    }, [])

    useEffect(() => {
        if (isOpen && kebun) {
            setLocalName(kebun.name || "")
            setLocalLocation(kebun.location || "")
            fetchData()
            fetchUsers()
        }
    }, [isOpen, kebun, fetchData, fetchUsers])

    const handleAddPekerjaan = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!kebun) return

        setSubmitting(true)
        try {
            const res = await fetch(`/api/kebun/${kebun.id}/pekerjaan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date,
                    jenisPekerjaan,
                    keterangan,
                    biaya,
                    userId
                })
            })

            if (!res.ok) throw new Error('Gagal menambah pekerjaan')

            const newPekerjaan = await res.json()
            
            // Refresh list (Optimistic or fetch)
            // Ideally re-fetch to get relations
            const pekerjaanRes = await fetch(`/api/kebun/${kebun.id}/pekerjaan`)
            if (pekerjaanRes.ok) setPekerjaanList(await pekerjaanRes.json())

            // Reset form
            setJenisPekerjaan("")
            setKeterangan("")
            setBiaya("")
            setUserId("")
            toast.success("Pekerjaan berhasil ditambahkan")
        } catch (error) {
            toast.error("Gagal menyimpan data")
        } finally {
            setSubmitting(false)
        }
    }

    const handleDeletePekerjaan = async (id: number) => {
        if (!confirm("Hapus catatan pekerjaan ini?")) return

        try {
            const res = await fetch(`/api/kebun/pekerjaan/${id}`, { method: 'DELETE' })
            if (!res.ok) throw new Error('Gagal menghapus')
            
            setPekerjaanList(prev => prev.filter(p => p.id !== id))
            toast.success("Data dihapus")
        } catch (error) {
            toast.error("Gagal menghapus data")
        }
    }

    const handleSaveKebun = async () => {
        if (!kebun) return
        setSavingKebun(true)
        try {
            const res = await fetch(`/api/kebun/${kebun.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: localName, location: localLocation })
            })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                throw new Error(err.error || 'Gagal menyimpan perubahan kebun')
            }
            toast.success('Data kebun diperbarui')
            setEditMode(false)
            onUpdated && onUpdated()
        } catch (e: any) {
            toast.error(e.message || 'Gagal menyimpan perubahan kebun')
        } finally {
            setSavingKebun(false)
        }
    }

    const handleDeleteKebun = async () => {
        if (!kebun) return
        try {
            const res = await fetch(`/api/kebun/${kebun.id}`, { method: 'DELETE' })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                throw new Error(err.error || 'Gagal menghapus kebun')
            }
            toast.success('Kebun dihapus')
            onUpdated && onUpdated()
            onClose()
        } catch (e: any) {
            toast.error(e.message || 'Gagal menghapus kebun')
        }
    }

    const totalNetto = panenList.reduce((sum, p) => sum + (Number(p.netKg) || 0), 0)
    const totalGross = panenList.reduce((sum, p) => sum + (Number(p.grossKg) || 0), 0)
    const totalPekerjaan = pekerjaanList.reduce((sum, p) => sum + (Number(p.biaya) || 0), 0)

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount)
    }

    if (!kebun) return null

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="bg-white sm:max-w-[900px] max-h-[90vh] overflow-y-auto p-0 [&>button.absolute]:hidden">
                <ModalHeader
                    title={`Detail & Manajemen Kebun: ${formatKebunText(kebun.name)}`}
                    variant="emerald"
                    icon={<MapPinIcon className="h-5 w-5 text-white" />}
                    onClose={onClose}
                />

                <ModalContentWrapper>
                <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="flex gap-2 items-end">
                        <div className="flex-1">
                            <Label>Mulai</Label>
                            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                        </div>
                        <div className="flex-1">
                            <Label>Selesai</Label>
                            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                        </div>
                        <Button variant="outline" onClick={fetchData} className="h-10">
                            <ArrowPathIcon className="w-4 h-4 mr-2" /> Terapkan
                        </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 md:col-span-2">
                        <div className="p-3 border rounded-md bg-gray-50">
                            <div className="text-xs text-gray-500">Total Panen (Netto)</div>
                            <div className="text-lg font-semibold">{new Intl.NumberFormat('id-ID').format(totalNetto)} Kg</div>
                        </div>
                        <div className="p-3 border rounded-md bg-gray-50">
                            <div className="text-xs text-gray-500">Total Panen (Bruto)</div>
                            <div className="text-lg font-semibold">{new Intl.NumberFormat('id-ID').format(totalGross)} Kg</div>
                        </div>
                        <div className="p-3 border rounded-md bg-gray-50">
                            <div className="text-xs text-gray-500">Total Biaya Pekerjaan</div>
                            <div className="text-lg font-semibold">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(totalPekerjaan)}</div>
                        </div>
                    </div>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="info">Info Kebun</TabsTrigger>
                        <TabsTrigger value="panen">Catatan Panen</TabsTrigger>
                        <TabsTrigger value="pekerjaan">Pekerjaan & Upah</TabsTrigger>
                    </TabsList>

                    <TabsContent value="info" className="py-4 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold">Info Kebun</h3>
                            <div className="flex gap-2">
                                {!editMode ? (
                                    <>
                                        <Button variant="outline" onClick={() => setEditMode(true)}>Ubah</Button>
                                        <Button variant="destructive" onClick={() => setOpenDeleteKebunConfirm(true)}>Hapus</Button>
                                    </>
                                ) : (
                                    <>
                                        <Button variant="ghost" onClick={() => { setEditMode(false); setLocalName(kebun.name || ''); setLocalLocation(kebun.location || ''); }}>Batal</Button>
                                        <Button onClick={handleSaveKebun} disabled={savingKebun}>
                                            {savingKebun ? <ArrowPathIcon className="w-4 h-4 animate-spin mr-2" /> : null}
                                            Simpan
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>
                        {!editMode ? (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="text-gray-500">Nama Kebun</Label>
                                    <div className="font-medium text-lg">{formatKebunText(kebun.name)}</div>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-gray-500">Lokasi</Label>
                                    <div className="font-medium text-lg">{kebun.location ? formatKebunText(kebun.location) : '-'}</div>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-gray-500">Tanggal Dibuat</Label>
                                    <div className="font-medium">{format(new Date(kebun.createdAt), 'dd MMMM yyyy', { locale: id })}</div>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Nama Kebun</Label>
                                    <Input value={localName} onChange={e => setLocalName(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Lokasi</Label>
                                    <Input value={localLocation} onChange={e => setLocalLocation(e.target.value)} />
                                </div>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="panen" className="py-4 space-y-4">
                        {loading ? <Skeleton className="h-40 w-full" /> : (
                            <div className="border rounded-md">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Tanggal</TableHead>
                                            <TableHead>Supir</TableHead>
                                            <TableHead>Plat Nomor</TableHead>
                                            <TableHead className="text-right">Bruto (Kg)</TableHead>
                                            <TableHead className="text-right">Netto (Kg)</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {panenList.length > 0 ? (
                                            panenList.map((item: any) => (
                                                <TableRow key={item.id}>
                                                    <TableCell>{format(new Date(item.date), 'dd MMM yyyy', { locale: id })}</TableCell>
                                                    <TableCell>{item.supir?.name || '-'}</TableCell>
                                                    <TableCell>{item.kendaraan?.platNomor || '-'}</TableCell>
                                                    <TableCell className="text-right">{item.grossKg}</TableCell>
                                                    <TableCell className="text-right font-bold">{item.netKg}</TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center py-8 text-gray-500">Belum ada data panen (Timbangan)</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="pekerjaan" className="py-4 space-y-6">
                        {/* Form Input */}
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-4">
                            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                                <PlusIcon className="w-4 h-4" /> Catat Pekerjaan Baru
                            </h3>
                            <form onSubmit={handleAddPekerjaan} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Tanggal</Label>
                                    <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
                                </div>
                                <div className="space-y-2">
                                    <Label>Jenis Pekerjaan</Label>
                                    <Select value={jenisPekerjaan} onValueChange={setJenisPekerjaan}>
                                        <SelectTrigger className="bg-white">
                                            <SelectValue placeholder="Pilih Jenis" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Pemupukan">Pemupukan</SelectItem>
                                            <SelectItem value="Penyemprotan">Penyemprotan</SelectItem>
                                            <SelectItem value="Pruning">Pruning</SelectItem>
                                            <SelectItem value="Panen Manual">Panen Manual</SelectItem>
                                            <SelectItem value="Perawatan Jalan">Perawatan Jalan</SelectItem>
                                            <SelectItem value="Lainnya">Lainnya</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Pekerja (Opsional)</Label>
                                    <Select value={userId} onValueChange={setUserId}>
                                        <SelectTrigger className="bg-white">
                                            <SelectValue placeholder="Pilih Pegawai" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {userList.map((u: any) => (
                                                <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Biaya / Upah (Rp)</Label>
                                    <Input 
                                        type="number" 
                                        placeholder="0" 
                                        value={biaya} 
                                        onChange={e => setBiaya(e.target.value)} 
                                        className="bg-white"
                                    />
                                </div>
                                <div className="col-span-1 md:col-span-2 space-y-2">
                                    <Label>Keterangan</Label>
                                    <Textarea 
                                        placeholder="Detail pekerjaan..." 
                                        value={keterangan} 
                                        onChange={e => setKeterangan(e.target.value)} 
                                        className="bg-white h-20"
                                    />
                                </div>
                                <div className="col-span-1 md:col-span-2">
                                    <Button type="submit" disabled={submitting || !jenisPekerjaan} className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-700 text-white">
                                        {submitting ? <ArrowPathIcon className="w-4 h-4 animate-spin mr-2" /> : <PlusIcon className="w-4 h-4 mr-2" />}
                                        Simpan Pekerjaan
                                    </Button>
                                </div>
                            </form>
                        </div>

                        {/* Table List */}
                        {loading ? <Skeleton className="h-40 w-full" /> : (
                            <div className="border rounded-md">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Tanggal</TableHead>
                                            <TableHead>Jenis</TableHead>
                                            <TableHead>Pekerja</TableHead>
                                            <TableHead>Keterangan</TableHead>
                                            <TableHead className="text-right">Biaya</TableHead>
                                            <TableHead className="w-[50px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {pekerjaanList.length > 0 ? (
                                            pekerjaanList.map((item: any) => (
                                                <TableRow key={item.id}>
                                                    <TableCell>{format(new Date(item.date), 'dd MMM yyyy', { locale: id })}</TableCell>
                                                    <TableCell><Badge variant="outline">{item.jenisPekerjaan}</Badge></TableCell>
                                                    <TableCell>{item.user?.name || '-'}</TableCell>
                                                    <TableCell className="max-w-[200px] truncate" title={item.keterangan}>{item.keterangan || '-'}</TableCell>
                                                    <TableCell className="text-right font-medium">{formatCurrency(item.biaya)}</TableCell>
                                                    <TableCell>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleDeletePekerjaan(item.id)}>
                                                            <TrashIcon className="w-4 h-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center py-8 text-gray-500">Belum ada catatan pekerjaan</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </TabsContent>
                </Tabs>

                </ModalContentWrapper>
                <ModalFooter>
                    <Button onClick={onClose} className="rounded-full" variant="outline">
                        <XMarkIcon className="h-4 w-4 mr-2" />
                        Tutup
                    </Button>
                </ModalFooter>
                </DialogContent>
            </Dialog>
            <ConfirmationModal
                isOpen={openDeleteKebunConfirm}
                onClose={() => setOpenDeleteKebunConfirm(false)}
                onConfirm={() => {
                    setOpenDeleteKebunConfirm(false)
                    handleDeleteKebun()
                }}
                title="Konfirmasi Hapus Kebun"
                description="Apakah Anda yakin ingin menghapus kebun ini? Tindakan ini tidak dapat dibatalkan."
                variant="emerald"
            />
        </>
    )
}
