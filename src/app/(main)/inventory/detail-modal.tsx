'use client'

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ModalFooter, ModalHeader } from '@/components/ui/modal-elements'
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
    ArrowDownTrayIcon,
    ArrowUpTrayIcon,
    ArchiveBoxIcon,
    CalendarIcon,
    PrinterIcon,
    BanknotesIcon,
    XMarkIcon
} from "@heroicons/react/24/outline";
import ImageViewer from '@/components/ui/ImageViewer';

interface DetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: any;
}

export function DetailModal({ isOpen, onClose, item }: DetailModalProps) {
    const [history, setHistory] = useState<any[]>([]);
    const [summary, setSummary] = useState({ totalIn: 0, totalOut: 0, totalAdjustment: 0 });
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [viewImageUrl, setViewImageUrl] = useState<string | null>(null);

    const fetchHistory = useCallback(async (pageNum: number, reset = false) => {
        if (!item) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/inventory/${item.id}/history?page=${pageNum}&limit=10`);
            const data = await res.json();
            
            if (reset) {
                setHistory(data.data);
            } else {
                setHistory(prev => [...prev, ...data.data]);
            }
            
            if (data.summary) {
                setSummary(data.summary);
            }
            
            setHasMore(data.page < data.totalPages);
            setPage(pageNum);
        } catch (error) {
            console.error('Failed to fetch history', error);
        } finally {
            setLoading(false);
        }
    }, [item]);

    useEffect(() => {
        if (isOpen && item) {
            fetchHistory(1, true);
        }
    }, [isOpen, item, fetchHistory]);
    const loadMore = () => {
        if (!loading && hasMore) {
            fetchHistory(page + 1);
        }
    };

    const handlePrint = async () => {
        const jsPDF = (await import('jspdf')).default;
        const autoTable = (await import('jspdf-autotable')).default;

        const doc = new jsPDF();
        
        // Header
        doc.setFontSize(18);
        doc.text('Laporan Detail Barang & Riwayat Stok', 14, 22);
        
        doc.setFontSize(11);
        doc.text(`Dicetak: ${format(new Date(), 'dd MMM yyyy HH:mm', { locale: idLocale })}`, 14, 30);
        
        // Item Info
        doc.setFontSize(14);
        doc.text(item.name, 14, 40);
        
        doc.setFontSize(10);
        doc.text(`SKU: ${item.sku}`, 14, 46);
        doc.text(`Kategori: ${item.category || '-'}`, 14, 52);
        doc.text(`Stok Saat Ini: ${item.stock} ${item.unit}`, 14, 58);
        
        // Stats
        doc.text(`Total Masuk: ${summary.totalIn}`, 100, 46);
        doc.text(`Total Keluar: ${summary.totalOut}`, 100, 52);
        doc.text(`Min. Stok: ${item.minStock} ${item.unit}`, 100, 58);

        // Table
        const tableData = history.map(tx => [
            format(new Date(tx.createdAt), 'dd/MM/yyyy HH:mm'),
            tx.type === 'IN' ? 'Masuk' : tx.type === 'OUT' ? 'Keluar' : 'Adjust',
            `${tx.type === 'OUT' ? '-' : '+'}${tx.quantity} ${item.unit}`,
            tx.user?.name || '-',
            tx.notes || '-'
        ]);

        autoTable(doc, {
            head: [['Tanggal', 'Aktivitas', 'Jumlah', 'Oleh', 'Catatan']],
            body: tableData,
            startY: 65,
            theme: 'grid',
            headStyles: { fillColor: [5, 150, 105] },
        });

        doc.save(`detail-stok-${item.sku}-${format(new Date(), 'yyyyMMdd')}.pdf`);
    };

    if (!item) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="w-[90%] max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden [&>button.absolute]:hidden">
                <ModalHeader
                    title={item.name}
                    subtitle={`${item.sku} • ${item.category || 'Tanpa Kategori'}`}
                    variant="emerald"
                    icon={<ArchiveBoxIcon className="w-5 h-5 text-white" />}
                    onClose={onClose}
                />
                
                <div className="flex-1 overflow-y-auto p-6">
                    {/* Item Info & Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        {/* Initial Stock */}
                        <div className="bg-white border rounded-xl p-4 shadow-sm flex items-center gap-4">
                            <div className="p-3 bg-gray-100 rounded-full text-gray-600">
                                <ArchiveBoxIcon className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Stok Awal</p>
                                <p className="text-2xl font-bold">{item.initialStock || 0} <span className="text-sm font-normal text-gray-400">{item.unit}</span></p>
                            </div>
                        </div>

                        {/* Current Stock */}
                        <div className="bg-white border rounded-xl p-4 shadow-sm flex items-center gap-4">
                            <div className="p-3 bg-emerald-100 rounded-full text-emerald-600">
                                <ArchiveBoxIcon className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Sisa Stok</p>
                                <p className="text-2xl font-bold">{item.stock} <span className="text-sm font-normal text-gray-400">{item.unit}</span></p>
                            </div>
                        </div>

                        {/* Nilai Aset */}
                        <div className="bg-white border rounded-xl p-4 shadow-sm flex items-center gap-4">
                            <div className="p-3 bg-emerald-100 rounded-full text-emerald-600">
                                <BanknotesIcon className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Nilai Aset</p>
                                <p className="text-lg font-bold text-emerald-700">
                                    {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format((item.stock || 0) * (item.price || 0))}
                                </p>
                            </div>
                        </div>

                        {/* Total In */}
                        <div className="bg-white border rounded-xl p-4 shadow-sm flex items-center gap-4">
                            <div className="p-3 bg-green-100 rounded-full text-green-600">
                                <ArrowDownTrayIcon className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Total Masuk</p>
                                <p className="text-2xl font-bold text-green-600">+{summary.totalIn}</p>
                            </div>
                        </div>

                        {/* Total Out */}
                        <div className="bg-white border rounded-xl p-4 shadow-sm flex items-center gap-4">
                            <div className="p-3 bg-red-100 rounded-full text-red-600">
                                <ArrowUpTrayIcon className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Total Keluar</p>
                                <p className="text-2xl font-bold text-red-600">-{summary.totalOut}</p>
                            </div>
                        </div>
                    </div>

                    {/* Image & Detailed Info */}
                    <div className="flex flex-col md:flex-row gap-6 mb-8">
                        <div className="w-full md:w-1/3">
                            <div className="aspect-square bg-gray-100 rounded-xl overflow-hidden border flex items-center justify-center">
                                {item.imageUrl ? (
                                    <img
                                      src={item.imageUrl}
                                      alt={item.name}
                                      className="w-full h-full object-cover cursor-zoom-in"
                                      onClick={() => setViewImageUrl(item.imageUrl)}
                                    />
                                  ) : (
                                    <ArchiveBoxIcon className="w-20 h-20 text-gray-300" />
                                  )}
                            </div>
                        </div>
                        <div className="flex-1 space-y-4">
                            <h3 className="font-semibold text-lg border-b pb-2">Informasi Detail</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-gray-500">Harga Satuan</p>
                                    <p className="font-medium">
                                        {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(item.price || 0)}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Minimum Stok</p>
                                    <p className="font-medium">{item.minStock} {item.unit}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Tanggal Dibuat</p>
                                    <p className="font-medium">
                                        {item.createdAt ? format(new Date(item.createdAt), 'dd MMM yyyy', { locale: idLocale }) : '-'}
                                    </p>
                                </div>
                                <div className="col-span-2">
                                    <p className="text-sm text-gray-500">Status Stok</p>
                                    <Badge className={item.stock <= item.minStock ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}>
                                        {item.stock <= item.minStock ? 'Perlu Restock' : 'Stok Aman'}
                                    </Badge>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* History Table */}
                    <div>
                        <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                            <CalendarIcon className="w-5 h-5" />
                            Riwayat Perubahan Stok
                        </h3>
                        <div className="border rounded-lg overflow-hidden">
                            <Table>
                                <TableHeader className="bg-gray-50">
                                    <TableRow>
                                        <TableHead>Tanggal</TableHead>
                                        <TableHead>Aktivitas</TableHead>
                                        <TableHead>Jumlah</TableHead>
                                        <TableHead>Oleh</TableHead>
                                        <TableHead>Catatan</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {history.length === 0 && !loading ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                                                Belum ada riwayat transaksi
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        history.map((tx) => (
                                            <TableRow key={tx.id}>
                                                <TableCell className="whitespace-nowrap">
                                                    <div className="font-medium">
                                                        {format(new Date(tx.createdAt), 'dd MMM yyyy', { locale: idLocale })}
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        {format(new Date(tx.createdAt), 'HH:mm')}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={tx.type === 'IN' ? 'default' : tx.type === 'OUT' ? 'destructive' : 'secondary'}>
                                                        {tx.type === 'IN' ? 'Barang Masuk' : tx.type === 'OUT' ? 'Barang Keluar' : 'Opname / Adjust'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="font-bold">
                                                    {tx.type === 'OUT' ? '-' : '+'}{tx.quantity} {item.unit}
                                                </TableCell>
                                                <TableCell>{tx.user?.name || '-'}</TableCell>
                                                <TableCell className="max-w-[200px] truncate" title={tx.notes}>
                                                    {tx.notes || '-'}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                            {hasMore && (
                                <div className="p-4 text-center border-t bg-gray-50">
                                    <button 
                                        onClick={loadMore} 
                                        disabled={loading}
                                        className="text-sm text-emerald-700 hover:underline disabled:opacity-50"
                                    >
                                        {loading ? 'Memuat...' : 'Muat Lebih Banyak'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <ModalFooter className="sm:justify-between">
                    <Button onClick={onClose} className="rounded-full" variant="outline">
                        <XMarkIcon className="h-4 w-4 mr-2" />
                        Tutup
                    </Button>
                    <Button onClick={handlePrint} className="rounded-full bg-emerald-600 hover:bg-emerald-700">
                        <PrinterIcon className="h-4 w-4 mr-2" />
                        Cetak PDF
                    </Button>
                </ModalFooter>
                {viewImageUrl && (
                  <ImageViewer
                    src={viewImageUrl}
                    alt={item.name}
                    onClose={() => setViewImageUrl(null)}
                    downloadable
                  />
                )}
            </DialogContent>
        </Dialog>
    );
}
