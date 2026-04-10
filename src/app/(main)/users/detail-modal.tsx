'use client'

import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { UserData } from "./columns"
import { format } from "date-fns"
import { id } from "date-fns/locale"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useEffect, useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { UserIcon, XMarkIcon } from "@heroicons/react/24/outline"
import { ModalContentWrapper, ModalFooter, ModalHeader } from "@/components/ui/modal-elements"

interface DetailModalProps {
    isOpen: boolean
    onClose: () => void
    user: UserData | null
}

export function DetailModal({ isOpen, onClose, user }: DetailModalProps) {
    const [history, setHistory] = useState<{ kebunTerikat?: Array<{ id: number; name: string }>, riwayatGaji: any[], riwayatHutang: any[] } | null>(null)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (isOpen && user) {
            setLoading(true)
            fetch(`/api/users/${user.id}/details`)
                .then(res => res.json())
                .then(data => setHistory(data))
                .catch(err => console.error(err))
                .finally(() => setLoading(false))
        }
    }, [isOpen, user])

    if (!user) return null

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount)
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-white sm:max-w-[800px] max-h-[90vh] p-0 overflow-hidden flex flex-col [&>button.absolute]:hidden">
                <ModalHeader
                    title="Detail Pengguna"
                    subtitle={user.name || user.email || ''}
                    variant="emerald"
                    icon={<UserIcon className="h-5 w-5 text-white" />}
                    onClose={onClose}
                />
                
                <ModalContentWrapper className="flex-1 min-h-0 overflow-y-auto">
                <Tabs defaultValue="info" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="info">Info Umum</TabsTrigger>
                        <TabsTrigger value="gaji">Riwayat Gaji</TabsTrigger>
                        <TabsTrigger value="hutang">Riwayat Hutang</TabsTrigger>
                    </TabsList>

                    <TabsContent value="info" className="space-y-6 py-4">
                        {/* Photo Section */}
                    <div className="flex justify-center">
                        {user.photoUrl ? (
                            <img 
                                src={user.photoUrl} 
                                alt={user.name || 'User'} 
                                className="w-24 h-24 rounded-full object-cover border-4 border-gray-100 shadow-sm"
                            />
                        ) : (
                            <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-3xl font-semibold border-4 border-gray-100">
                                {(user.name || 'U').charAt(0).toUpperCase()}
                            </div>
                        )}
                    </div>

                    {/* Info Grid */}
                    <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-1">
                            <h4 className="text-sm font-medium text-gray-500">Nama Lengkap</h4>
                            <p className="text-base font-semibold text-gray-900">{user.name}</p>
                        </div>

                        <div className="space-y-1">
                            <h4 className="text-sm font-medium text-gray-500">Email</h4>
                            <p className="text-base text-gray-900">{user.email}</p>
                        </div>

                        <div className="space-y-1">
                            <h4 className="text-sm font-medium text-gray-500">Role</h4>
                            <div>
                                <Badge className={
                                    user.role === 'ADMIN' ? 'bg-red-500' :
                                    user.role === 'PEMILIK' ? 'bg-blue-500' :
                                    user.role === 'KASIR' ? 'bg-green-500' :
                                    user.role === 'MANDOR' ? 'bg-amber-500' :
                                    user.role === 'MANAGER' ? 'bg-indigo-500' :
                                    'bg-gray-500'
                                }>
                                    {user.role}
                                </Badge>
                            </div>
                        </div>

                        {(user.role === 'MANDOR' || user.role === 'MANAGER') && (
                            <div className="space-y-2">
                                <h4 className="text-sm font-medium text-gray-500">Kebun Terikat</h4>
                                {loading ? (
                                    <div className="flex gap-2">
                                        <Skeleton className="h-6 w-24" />
                                        <Skeleton className="h-6 w-24" />
                                    </div>
                                ) : (
                                    <div className="flex flex-wrap gap-2">
                                        {history?.kebunTerikat && history.kebunTerikat.length > 0 ? (
                                            history.kebunTerikat.map(k => (
                                                <Badge key={k.id} className="bg-gray-900">{k.name}</Badge>
                                            ))
                                        ) : (
                                            <span className="text-sm text-gray-700">-</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4 pt-2">
                            <div className="space-y-1">
                                <h4 className="text-xs font-medium text-gray-500 uppercase">Dibuat</h4>
                                <p className="text-sm text-gray-700">
                                    {user.createdAt ? format(new Date(user.createdAt), 'dd MMM yyyy HH:mm', { locale: id }) : '-'}
                                </p>
                            </div>
                            <div className="space-y-1">
                                <h4 className="text-xs font-medium text-gray-500 uppercase">Diperbarui</h4>
                                <p className="text-sm text-gray-700">
                                    {user.updatedAt ? format(new Date(user.updatedAt), 'dd MMM yyyy HH:mm', { locale: id }) : '-'}
                                </p>
                            </div>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="gaji" className="space-y-4 py-4">
                    {loading ? (
                        <div className="space-y-2">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                    ) : (
                        <div className="border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Tanggal</TableHead>
                                        <TableHead>Sumber</TableHead>
                                        <TableHead className="text-right">Jumlah</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {history?.riwayatGaji && history.riwayatGaji.length > 0 ? (
                                        history.riwayatGaji.map((item: any) => (
                                            <TableRow key={item.id}>
                                                <TableCell>{format(new Date(item.tanggalBongkar || item.createdAt), 'dd MMM yyyy', { locale: id })}</TableCell>
                                                <TableCell>{item.pabrikSawit?.name || 'Nota Sawit'}</TableCell>
                                                <TableCell className="text-right font-medium">{formatCurrency(item.pembayaranAktual || item.pembayaranSetelahPph || 0)}</TableCell>
                                                <TableCell>
                                                    <Badge variant={item.statusGajian === 'SELESAI' || item.gajianId ? 'default' : 'secondary'}>
                                                        {item.gajianId ? 'Digaji' : (item.statusGajian || 'Belum')}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-4 text-gray-500">Tidak ada riwayat gaji</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="hutang" className="space-y-4 py-4">
                        {loading ? (
                        <div className="space-y-2">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                    ) : (
                        <div className="border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Tanggal</TableHead>
                                        <TableHead>Deskripsi</TableHead>
                                        <TableHead>Tipe</TableHead>
                                        <TableHead className="text-right">Jumlah</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {history?.riwayatHutang && history.riwayatHutang.length > 0 ? (
                                        history.riwayatHutang.map((item: any) => (
                                            <TableRow key={item.id}>
                                                <TableCell>{format(new Date(item.date), 'dd MMM yyyy', { locale: id })}</TableCell>
                                                <TableCell>{item.deskripsi}</TableCell>
                                                <TableCell>
                                                    <Badge variant={item.tipe === 'PENGELUARAN' ? 'destructive' : 'default'}>
                                                        {item.tipe === 'PENGELUARAN' ? 'Hutang/Kasbon' : 'Bayar'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right font-medium">{formatCurrency(item.jumlah)}</TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-4 text-gray-500">Tidak ada riwayat hutang</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </TabsContent>
                </Tabs>
                </ModalContentWrapper>
                <ModalFooter className="sm:justify-end">
                    <Button onClick={onClose} className="w-full sm:w-auto rounded-full" variant="outline">
                        <XMarkIcon className="h-4 w-4 mr-2" />
                        Tutup
                    </Button>
                </ModalFooter>
            </DialogContent>
        </Dialog>
    )
}
