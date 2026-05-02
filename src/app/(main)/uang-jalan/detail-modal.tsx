'use client'

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { SesiUangJalanWithDetails } from "./page";
import { Badge } from "@/components/ui/badge";
import { useReactToPrint } from 'react-to-print';
import { useRef, useState } from 'react';
import { PrintableUangJalan } from './printable-uang-jalan';
import type { UangJalan } from '@prisma/client';
import { ModalContentWrapper, ModalFooter, ModalHeader } from "@/components/ui/modal-elements";
import { ArrowDownTrayIcon, DocumentTextIcon, PencilSquareIcon, PrinterIcon, TrashIcon, XMarkIcon } from "@heroicons/react/24/outline";

type RincianUangJalan = UangJalan & { gambarUrl?: string | null };

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    data: SesiUangJalanWithDetails | null;
    onEdit?: (data: SesiUangJalanWithDetails) => void;
    onDelete?: (data: SesiUangJalanWithDetails) => void;
}

const formatCurrency = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
const formatDate = (date: string | Date) => new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(date));
const stripTagMarkers = (text: string) => String(text || '').replace(/\s*\[(KENDARAAN|KEBUN|PERUSAHAAN|KARYAWAN):[^\]]+\]/g, '').trim()
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
const tagSummaryFromDescription = (text: string) => {
    const tags = parseTagMarkers(text)
    const parts: string[] = []
    if (tags.kendaraanPlatNomor) parts.push(`Kendaraan: ${tags.kendaraanPlatNomor}`)
    if (tags.kebunId) parts.push(`Kebun: #${tags.kebunId}`)
    if (tags.perusahaanId) parts.push(`Perusahaan: #${tags.perusahaanId}`)
    if (tags.karyawanId) parts.push(`Karyawan: #${tags.karyawanId}`)
    return parts.length > 0 ? parts.join(' • ') : '-'
}

export function DetailUangJalanModal({ isOpen, onClose, data, onEdit, onDelete }: ModalProps) {
    const componentRef = useRef<HTMLDivElement>(null);
    const handlePrint = useReactToPrint({
        contentRef: componentRef,
        documentTitle: data ? `Laporan Uang Jalan - ${data.supir.name} - ${formatDate(data.tanggalMulai)}` : 'Laporan Uang Jalan',
    });
    const [buktiOpen, setBuktiOpen] = useState(false)
    const [buktiUrl, setBuktiUrl] = useState<string | null>(null)
    const [buktiTitle, setBuktiTitle] = useState('Bukti Uang Jalan')
    const [downloading, setDownloading] = useState(false)

    const openBukti = (url: string, title: string) => {
        setBuktiUrl(url)
        setBuktiTitle(title)
        setBuktiOpen(true)
    }

    const handleDownloadBukti = async () => {
        if (!buktiUrl || downloading) return
        setDownloading(true)
        try {
            const res = await fetch(buktiUrl, { cache: 'no-store' })
            const blob = await res.blob()
            const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg'
            const blobUrl = window.URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = blobUrl
            link.download = `bukti-uang-jalan.${ext}`
            document.body.appendChild(link)
            link.click()
            link.remove()
            window.URL.revokeObjectURL(blobUrl)
        } catch {
            window.open(buktiUrl, '_blank')
        } finally {
            setDownloading(false)
        }
    }

    if (!data) return null;

    return (
        <>
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="w-[94vw] sm:w-full sm:max-w-[760px] md:max-w-[980px] lg:max-w-[1100px] max-h-[92vh] p-0 overflow-hidden bg-white rounded-2xl flex flex-col [&>button.absolute]:hidden">
                <ModalHeader
                    title="Detail Uang Jalan"
                    subtitle={`${data.supir.name} • ${formatDate(data.tanggalMulai)}`}
                    variant="emerald"
                    onClose={onClose}
                />
                <ModalContentWrapper className="space-y-6 flex-1 min-h-0 overflow-y-auto">
                    {/* Informasi Utama */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-lg bg-gray-50">
                        <div>
                            <p className="text-sm text-gray-500">Supir</p>
                            <p className="font-semibold">{data.supir.name}</p>
                        </div>
                        {data.kendaraan && (
                            <div>
                                <p className="text-sm text-gray-500">Kendaraan</p>
                                <p className="font-semibold">{data.kendaraan.platNomor} - {data.kendaraan.merk}</p>
                            </div>
                        )}
                        <div>
                            <p className="text-sm text-gray-500">Tanggal Mulai</p>
                            <p className="font-semibold">{formatDate(data.tanggalMulai)}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Di Input Oleh</p>
                            <p className="font-semibold">{(data as any).createdBy?.name || '-'}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Keterangan</p>
                            <p className="font-semibold">{data.keterangan || '-'}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Status</p>
                            <Badge className={data.status === 'SELESAI' ? 'bg-green-500' : 'bg-yellow-500'}>{data.status}</Badge>
                        </div>
                    </div>

                    {/* Rincian Transaksi */}
                    <div>
                        <h3 className="font-semibold mb-2">Rincian Transaksi</h3>
                        <div className="border rounded-lg overflow-x-auto">
                            <table className="min-w-[920px] w-full text-sm">
                                <thead className="bg-gray-100">
                                    <tr>
                                        <th className="p-2 text-left">Tanggal</th>
                                        <th className="p-2 text-right">Pemasukan</th>
                                        <th className="p-2 text-right">Pengeluaran</th>
                                        <th className="p-2 text-left">Keterangan</th>
                                        <th className="p-2 text-left">Tag Biaya</th>
                                        <th className="p-2 text-center">Gambar</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.rincian.map((r: RincianUangJalan) => (
                                        <tr key={r.id} className="border-b last:border-none">
                                            {(() => {
                                                const tipe = String(r.tipe || '').toUpperCase()
                                                const isIn = tipe === 'PEMASUKAN'
                                                const isOut = tipe === 'PENGELUARAN'
                                                const descRaw = String(r.description || '').trim()
                                                const cleanDesc = stripTagMarkers(descRaw) || '-'
                                                const tagText = tagSummaryFromDescription(descRaw)
                                                return (
                                                    <>
                                            <td className="p-2">{formatDate(r.date)}</td>
                                            <td className="p-2 text-right text-emerald-700 font-semibold">{isIn ? formatCurrency(r.amount) : '-'}</td>
                                            <td className="p-2 text-right text-red-600 font-semibold">{isOut ? formatCurrency(r.amount) : '-'}</td>
                                            <td className="p-2">{cleanDesc}</td>
                                            <td className="p-2 text-xs text-gray-600">{tagText}</td>
                                            <td className="p-2 text-center">
                                                {r.gambarUrl ? (
                                                    <img
                                                        src={r.gambarUrl}
                                                        alt="Bukti"
                                                        className="h-10 w-10 object-cover rounded-md mx-auto cursor-pointer"
                                                        onClick={() => openBukti(r.gambarUrl as string, 'Bukti Uang Jalan')}
                                                    />
                                                ) : (
                                                    <span>-</span>
                                                )}
                                            </td>
                                                    </>
                                                )
                                            })()}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Total */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t">
                        <div className="p-4 rounded-lg bg-emerald-50">
                            <p className="text-sm text-gray-500">Total Diberikan</p>
                            <p className="font-bold text-lg">{formatCurrency(data.totalDiberikan)}</p>
                        </div>
                        <div className="p-4 rounded-lg bg-red-50">
                            <p className="text-sm text-gray-500">Total Pengeluaran</p>
                            <p className="font-bold text-lg">{formatCurrency(data.totalPengeluaran)}</p>
                        </div>
                        <div className="p-4 rounded-lg bg-gray-100">
                            <p className="text-sm text-gray-500">Saldo Akhir</p>
                            <p className="font-bold text-lg">{formatCurrency(data.saldo)}</p>
                        </div>
                    </div>
                </ModalContentWrapper>
                <ModalFooter className="sm:justify-end">
                    {onEdit ? (
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => onEdit(data)}
                            className="rounded-full text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                            aria-label="Edit"
                            title="Edit"
                        >
                            <PencilSquareIcon className="h-4 w-4" />
                        </Button>
                    ) : null}
                    {onDelete ? (
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => onDelete(data)}
                            className="rounded-full text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                            aria-label="Hapus"
                            title="Hapus"
                        >
                            <TrashIcon className="h-4 w-4" />
                        </Button>
                    ) : null}
                    <Button variant="outline" onClick={onClose} className="rounded-full">Tutup</Button>
                    <Button onClick={handlePrint} className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white">
                        <PrinterIcon className="h-4 w-4 mr-2" />
                        Export / Cetak
                    </Button>
                </ModalFooter>
                <div style={{ display: 'none' }}>
                    <PrintableUangJalan ref={componentRef} data={data} />
                </div>
            </DialogContent>
        </Dialog>
        <Dialog
            open={buktiOpen}
            onOpenChange={(v) => {
                setBuktiOpen(v)
                if (!v) {
                    setBuktiUrl(null)
                    setBuktiTitle('Bukti Uang Jalan')
                }
            }}
        >
            <DialogContent className="max-w-3xl p-0 overflow-hidden [&>button.absolute]:hidden">
                <div className="w-full flex items-center justify-between gap-3 px-6 py-4 border-b bg-gradient-to-r from-emerald-600 to-emerald-500 text-white pr-16">
                    <div className="min-w-0 flex items-center gap-2">
                        <DocumentTextIcon className="h-5 w-5 text-white" />
                        <div className="min-w-0">
                            <div className="text-white text-base font-semibold">{buktiTitle}</div>
                            <div className="text-xs text-white/90 truncate">Sesi Uang Jalan #{data?.id ?? '-'}</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={handleDownloadBukti}
                            disabled={!buktiUrl || downloading}
                            className="h-10 w-10 rounded-full border border-white/30 text-white hover:bg-white/10 disabled:opacity-50 inline-flex items-center justify-center"
                            aria-label="Download"
                            title={downloading ? 'Downloading...' : 'Download'}
                        >
                            <ArrowDownTrayIcon className="h-5 w-5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => { setBuktiOpen(false); setBuktiUrl(null) }}
                            className="h-10 w-10 rounded-full border border-white/30 text-white hover:bg-white/10 inline-flex items-center justify-center"
                            aria-label="Tutup"
                            title="Tutup"
                        >
                            <XMarkIcon className="h-5 w-5" />
                        </button>
                    </div>
                </div>
                <div className="bg-black/5 p-4 flex items-center justify-center">
                    {buktiUrl ? (
                        <img src={buktiUrl} alt={buktiTitle} className="max-h-[70vh] w-auto max-w-full object-contain rounded-xl" />
                    ) : null}
                </div>
            </DialogContent>
        </Dialog>
        </>
    );
}
