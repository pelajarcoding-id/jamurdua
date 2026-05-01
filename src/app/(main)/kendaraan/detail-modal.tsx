'use client'

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useState, useRef } from "react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ModalHeader } from "@/components/ui/modal-elements";
import {
    TruckIcon,
    CalendarIcon,
    WrenchIcon,
    IdentificationIcon,
    RectangleStackIcon,
    EyeIcon,
    ArrowDownTrayIcon,
    XMarkIcon,
    PencilSquareIcon,
    TrashIcon
} from "@heroicons/react/24/outline";
import useSWR from 'swr';
import { KendaraanData } from "./columns";

interface DetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    kendaraan: KendaraanData | null;
    onEdit?: (kendaraan: KendaraanData) => void;
    onDelete?: (kendaraan: KendaraanData) => void;
    onRenewDocument?: (kendaraan: KendaraanData) => void;
    onService?: (kendaraan: KendaraanData) => void;
}

interface ServiceLog {
    id: number;
    date: string;
    description: string;
    cost: number;
    odometer: number | null;
    nextServiceDate: string | null;
    fotoUrl?: string | null;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function DetailModal({ isOpen, onClose, kendaraan, onEdit, onDelete, onRenewDocument, onService }: DetailModalProps) {
    const { data: logsResp, isLoading } = useSWR<{ data: ServiceLog[]; total: number; nextCursor: number | null }>(
        isOpen && kendaraan?.platNomor ? `/api/kendaraan/${kendaraan.platNomor}/service` : null,
        fetcher
    );
    const logs: ServiceLog[] = logsResp?.data ?? [];

    const { data: documentHistory, isLoading: isLoadingDocs } = useSWR<any[]>(
        isOpen && kendaraan?.platNomor ? `/api/kendaraan/${kendaraan.platNomor}/document-history` : null,
        fetcher
    );

    const [viewImageUrl, setViewImageUrl] = useState<string | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const printRef = useRef<HTMLDivElement>(null);
    const escapeHTML = (s: string) =>
        s
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    const fotoGabunganUrl = kendaraan ? (kendaraan.imageUrl || kendaraan.fotoStnkUrl || null) : null
    const izinTrayekUrl = kendaraan
        ? ((kendaraan as any).fotoIzinTrayekUrl || (kendaraan as any).fotoPajakUrlLegacy || (kendaraan as any).fotoPajakUrl || null)
        : null

    const handleExportPDF = async () => {
        if (!printRef.current || !kendaraan) return;
        
        setIsExporting(true);
        try {
            const html2canvas = (await import('html2canvas')).default;
            const jsPDF = (await import('jspdf')).default;
            
            // Create a clone of the element
            const element = printRef.current;
            const clone = element.cloneNode(true) as HTMLElement;
            
            // Define a fixed width for the PDF generation to ensure desktop layout
            const pdfWidthPx = 1000; // Reduced from 1200 for tighter layout
            
            // Setup clone styles to ensure full content is captured with desktop layout
            clone.style.position = 'absolute';
            clone.style.left = '-9999px';
            clone.style.top = '0';
            clone.style.width = `${pdfWidthPx}px`; // Force desktop width
            clone.style.height = 'auto';
            clone.style.overflow = 'visible';
            clone.style.background = 'white';
            clone.style.padding = '20px'; // Reduced padding
            
            // Reduce gaps and margins for PDF compactness
            const gridGaps = clone.querySelectorAll('.gap-6');
            gridGaps.forEach((el) => {
                (el as HTMLElement).classList.remove('gap-6');
                (el as HTMLElement).classList.add('gap-4');
            });
            
            const margins = clone.querySelectorAll('.mb-8');
            margins.forEach((el) => {
                (el as HTMLElement).classList.remove('mb-8');
                (el as HTMLElement).classList.add('mb-4');
            });

            // Modify styles for PDF look (Clean white background, better contrast)
            // 1. Remove gray backgrounds
            const grayElements = clone.querySelectorAll('.bg-gray-50');
            grayElements.forEach((el) => {
                (el as HTMLElement).classList.remove('bg-gray-50');
                (el as HTMLElement).classList.add('bg-white');
            });

            // 2. Fix borders to be more visible but elegant
            const borderElements = clone.querySelectorAll('.border');
            borderElements.forEach((el) => {
                (el as HTMLElement).classList.remove('border');
                (el as HTMLElement).style.border = '1px solid #e5e7eb';
            });

            // 3. Make badges look more like text tags
            const badges = clone.querySelectorAll('[data-pdf-badge]'); 
            badges.forEach((el) => {
                const badge = el as HTMLElement;
                badge.style.background = '#ffffff'; // Force white background
                badge.style.color = '#000000'; // Force black text
                badge.style.border = '1px solid #000000'; // Force black border
                badge.style.borderRadius = '9999px'; // Rounded full
                // Use explicit padding to center visually in PDF (often needs more bottom padding in canvas)
                badge.style.paddingTop = '6px';
                badge.style.paddingBottom = '8px'; // Add extra space at bottom to lift text visually
                badge.style.paddingLeft = '16px';
                badge.style.paddingRight = '16px';
                badge.style.display = 'inline-flex';
                badge.style.alignItems = 'center';
                badge.style.justifyContent = 'center'; // Center text horizontally
                badge.style.textAlign = 'center'; // Ensure text align center
                badge.style.fontSize = '12px';
                badge.style.fontWeight = '500';
                badge.style.boxShadow = 'none'; // Remove any shadow
                badge.style.width = 'auto'; // Prevent shrinking
                badge.style.minWidth = 'fit-content';
                badge.style.lineHeight = 'normal'; // Allow natural line height
                badge.style.height = 'auto'; // Let padding define height

                // Fix parent spacing (distance from Plat Nomor) - Only for header badges (not in table)
                if (badge.parentElement && badge.parentElement.tagName !== 'TD') {
                    badge.parentElement.style.marginTop = '16px'; // More space from Plat Nomor
                    badge.parentElement.style.gap = '10px'; // Space between badges
                }
            });

            // 4. Standardize Image Sizes for PDF
            // Vehicle Image
            const vehicleImages = clone.querySelectorAll('[data-pdf-image="vehicle"]');
            vehicleImages.forEach((el) => {
                const container = el as HTMLElement;
                container.style.height = '250px'; // Fixed height
                container.style.width = 'fit-content'; // Shrink wrap to image width
                container.style.maxWidth = '100%'; // But don't exceed parent
                container.style.display = 'block'; // Block to allow margin handling if needed
                container.style.marginLeft = '0'; // Align Left
                container.style.marginRight = '0';
                container.style.background = 'transparent'; // Remove gray bg
                container.style.border = '1px solid #e5e7eb';
                
                const img = container.querySelector('img');
                if (img) {
                    img.style.objectFit = 'contain';
                    img.style.width = 'auto'; // Allow natural width based on height
                    img.style.maxWidth = '100%'; // Prevent overflow
                    img.style.height = '100%'; // Fill container height
                    img.style.backgroundColor = 'transparent';
                    img.style.objectPosition = 'left center'; // Align image inside container to left
                }
            });

            // Document Images
            const docImages = clone.querySelectorAll('[data-pdf-image="document"]');
            docImages.forEach((el) => {
                const container = el as HTMLElement;
                container.style.height = '180px'; // Reduced height for docs
                // Width is handled by grid, but let's ensure it doesn't stretch weirdly
                container.style.background = 'white';
                
                const img = container.querySelector('img');
                if (img) {
                    img.style.objectFit = 'contain';
                    img.style.width = '100%';
                    img.style.height = '100%';
                }
            });
            
            // Find the scrollable container in the clone and expand it
            const scrollableContainer = clone.querySelector('.overflow-y-auto') as HTMLElement;
            
            // Define PAGE_HEIGHT here so it is accessible throughout the function
            // PDF Page Height in Pixels (A4 at 1000px width)
            // A4 Height = 297mm, Width = 210mm. Ratio = 1.414
            // Page Height = 1000 * 1.414 = ~1414px
            const PAGE_HEIGHT = 1380; // Use slightly less than 1414 for safety margins and bottom spacing

            if (scrollableContainer) {
                scrollableContainer.style.height = 'auto';
                scrollableContainer.style.overflow = 'visible';
                scrollableContainer.style.padding = '0'; // Remove internal padding if outer has it
                
                // Smart Page Break Logic
                // PDF Page Height in Pixels (A4 at 1000px width)
                // A4 Height = 297mm, Width = 210mm. Ratio = 1.414
                // Window Width = 1000px.
                // Page Height = 1000 * 1.414 = ~1414px
                
                let currentHeight = 0;
                
                // Account for Header height (Manual Header + Dialog Header)
                // We can't easily measure rendered height here perfectly without appending, 
                // but we can iterate children after append or just estimate.
                // Better approach: Iterate children of scrollableContainer.
                
                // Note: The clone is not yet in DOM, so offsetHeight might be 0.
                // We need to append it first to measure, but we are modifying it before canvas.
                // Actually, we append clone to body later: document.body.appendChild(clone);
                // We should move the appendChild UP before this logic? 
                // No, we can do it after appendChild.
            }

            // Remove header icons background
            const iconBgs = clone.querySelectorAll('.bg-emerald-50');
            iconBgs.forEach(el => {
                (el as HTMLElement).classList.remove('bg-emerald-50');
                (el as HTMLElement).style.background = 'transparent';
            });

            // Add Header for PDF
            const headerDiv = document.createElement('div');
            headerDiv.style.marginBottom = '10px'; // Reduced margin
            headerDiv.style.borderBottom = '2px solid #000';
            headerDiv.style.paddingBottom = '10px';
            const printedAt = escapeHTML(format(new Date(), 'dd MMMM yyyy HH:mm', { locale: idLocale }));
            headerDiv.innerHTML = `<h1 style="font-size: 24px; font-weight: bold; color: #000; margin-bottom: 5px;">LAPORAN DETAIL KENDARAAN</h1><p style="font-size: 14px; color: #666;">Dicetak pada: ${printedAt}</p>`;
            clone.insertBefore(headerDiv, clone.firstChild);
            
            document.body.appendChild(clone);

            // Apply Smart Page Breaks after appending to DOM (so we can measure heights)
            if (scrollableContainer) {
                const children = Array.from(scrollableContainer.children) as HTMLElement[];
                let cumulativeHeight = headerDiv.offsetHeight + 50; // Start with header offset + reduced buffer
                
                // Add DialogHeader height if present (it's sibling to scrollableContainer in original, but here structure might differ)
                // In current structure: clone > manualHeader > DialogHeader > scrollableWrapper > scrollableContainer
                // Wait, structure in JSX:
                // DialogContent > div(flex) > div(printRef) > [DialogHeader, div(scrollable)]
                // So inside clone (which is printRef):
                // 1. Manual Header (inserted at top)
                // 2. DialogHeader
                // 3. Scrollable Container (div with p-6)
                
                const dialogHeader = clone.querySelector('.border-b') as HTMLElement; // The DialogHeader
                if (dialogHeader) cumulativeHeight += dialogHeader.offsetHeight;

                children.forEach((child) => {
                    const childHeight = child.offsetHeight;
                    // Check if this child would cross the page boundary
                    // Current position on the current page
                    const positionOnPage = cumulativeHeight % PAGE_HEIGHT;
                    
                    // If start + height > page_height, it crosses the boundary
                    // But only if it's not too large to fit on a page anyway (larger than page height)
                    if (childHeight < PAGE_HEIGHT && (positionOnPage + childHeight) > PAGE_HEIGHT) {
                        // It crosses the boundary, push it to next page
                        const spacerHeight = PAGE_HEIGHT - positionOnPage;
                        child.style.marginTop = `${spacerHeight + 40}px`; // Add spacer + extra top margin for next page
                        cumulativeHeight += spacerHeight + 40 + childHeight;
                    } else {
                        cumulativeHeight += childHeight;
                    }
                });
            }
            
            // Generate canvas with fixed window width
            
            // Generate canvas with fixed window width
            const canvas = await html2canvas(clone, {
                scale: 2, // Better quality
                useCORS: true,
                logging: false,
                windowWidth: pdfWidthPx,
                windowHeight: clone.scrollHeight + 100,
                backgroundColor: '#ffffff',
                onclone: (clonedDoc: Document) => {
                    // Optional: Additional styling adjustments for PDF version
                    const clonedElement = clonedDoc.body.querySelector('[data-print-container]') as HTMLElement;
                    if (clonedElement) {
                        clonedElement.style.width = `${pdfWidthPx}px`;
                    }
                }
            } as any);
            
            document.body.removeChild(clone);
            
            // Generate PDF
            const imgData = canvas.toDataURL('image/jpeg', 1.0);
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgWidth = pdfWidth;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            
            let heightLeft = imgHeight;
            let position = 0;
            
            pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
            heightLeft -= pdfHeight;
            
            while (heightLeft > 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
                heightLeft -= pdfHeight;
            }
            
            pdf.save(`Kendaraan-${kendaraan.platNomor}.pdf`);
        } catch (error) {
            console.error('Export PDF failed:', error);
        } finally {
            setIsExporting(false);
        }
    };

    const handleDownload = async (url: string) => {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = url.split('/').pop() || 'dokumen.jpg';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        } catch (error) {
            console.error('Gagal mengunduh gambar:', error);
            // Fallback method
            window.open(url, '_blank');
        }
    };

    if (!kendaraan) return null;

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="w-[90%] max-w-4xl max-h-[90vh] p-0 gap-0 overflow-hidden flex flex-col [&>button.absolute]:hidden">
                    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-white">
                        {/* Wrapper for content to be printed */}
                        <div ref={printRef} data-print-container className="flex-1 flex flex-col min-h-0 overflow-hidden bg-white">
                            <ModalHeader
                                title={kendaraan.platNomor}
                                subtitle={`${kendaraan.merk} • ${kendaraan.jenis}`}
                                variant="emerald"
                                icon={<TruckIcon className="w-5 h-5 text-white" />}
                                onClose={onClose}
                            />
                            
                            <div className="flex-1 overflow-y-auto p-6">
                                {/* Vehicle Info */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                    <div className="bg-gray-50 p-4 rounded-xl border">
                                        <h3 className="font-semibold text-sm text-gray-500 mb-3 flex items-center gap-2">
                                            <IdentificationIcon className="w-4 h-4" />
                                            Informasi Kendaraan
                                        </h3>
                                        <div className="space-y-2">
                                            <div className="flex justify-between">
                                                <span className="text-sm text-gray-600">Plat Nomor</span>
                                                <span className="font-medium">{kendaraan.platNomor}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-sm text-gray-600">Merk</span>
                                                <span className="font-medium">{kendaraan.merk}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-sm text-gray-600">Jenis</span>
                                                <span className="font-medium">{kendaraan.jenis}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-sm text-gray-600">Berat Kosong</span>
                                                <span className="font-medium">{(kendaraan as any).beratKosong ? `${(kendaraan as any).beratKosong.toLocaleString('id-ID')} kg` : '-'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-gray-50 p-4 rounded-xl border">
                                        <h3 className="font-semibold text-sm text-gray-500 mb-3 flex items-center gap-2">
                                            <CalendarIcon className="w-4 h-4" />
                                            Informasi Dokumen
                                        </h3>
                                        <div className="space-y-2">
                                            <div className="flex justify-between">
                                                <span className="text-sm text-gray-600">Masa Berlaku STNK</span>
                                                <span className={`font-medium ${new Date(kendaraan.tanggalMatiStnk) < new Date() ? 'text-red-600' : 'text-green-600'}`}>
                                                    {format(new Date(kendaraan.tanggalMatiStnk), 'dd MMMM yyyy', { locale: idLocale })}
                                                </span>
                                            </div>
                                            {kendaraan.tanggalPajakTahunan && (
                                                <div className="flex justify-between">
                                                    <span className="text-sm text-gray-600">Pajak Tahunan</span>
                                                    <span className={`font-medium ${new Date(kendaraan.tanggalPajakTahunan) < new Date() ? 'text-red-600' : 'text-green-600'}`}>
                                                        {format(new Date(kendaraan.tanggalPajakTahunan), 'dd MMMM yyyy', { locale: idLocale })}
                                                    </span>
                                                </div>
                                            )}
                                            {(kendaraan as any).tanggalIzinTrayek && (
                                                <div className="flex justify-between">
                                                    <span className="text-sm text-gray-600">Izin Trayek</span>
                                                    <span className={`font-medium ${new Date((kendaraan as any).tanggalIzinTrayek) < new Date() ? 'text-red-600' : 'text-green-600'}`}>
                                                        {format(new Date((kendaraan as any).tanggalIzinTrayek), 'dd MMMM yyyy', { locale: idLocale })}
                                                    </span>
                                                </div>
                                            )}
                                            {kendaraan.speksi && (
                                                <div className="flex justify-between">
                                                    <span className="text-sm text-gray-600">Speksi</span>
                                                    <span className={`font-medium ${new Date(kendaraan.speksi) < new Date() ? 'text-red-600' : 'text-green-600'}`}>
                                                        {format(new Date(kendaraan.speksi), 'dd MMMM yyyy', { locale: idLocale })}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {fotoGabunganUrl && (
                                    <div className="bg-gray-50 p-4 rounded-xl border mb-8">
                                            <h3 className="font-semibold text-sm text-gray-500 mb-3 flex items-center gap-2">
                                            <IdentificationIcon className="w-4 h-4" />
                                            Foto Kendaraan + STNK
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div data-pdf-image="vehicle" className="relative w-full h-48 rounded-lg overflow-hidden border bg-white">
                                                <img 
                                                    src={fotoGabunganUrl || undefined} 
                                                    alt={`Foto ${kendaraan.platNomor}`} 
                                                    className="w-full h-full object-contain bg-black/5"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Digital Documents */}
                                {((kendaraan.fotoStnkUrl && kendaraan.fotoStnkUrl !== fotoGabunganUrl) || izinTrayekUrl || kendaraan.fotoSpeksiUrl) && (
                                    <div className="bg-gray-50 p-4 rounded-xl border mb-8">
                                        <h3 className="font-semibold text-sm text-gray-500 mb-3 flex items-center gap-2">
                                            <RectangleStackIcon className="w-4 h-4" />
                                            Dokumen Digital
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            {kendaraan.fotoStnkUrl && kendaraan.fotoStnkUrl !== fotoGabunganUrl && (
                                                <div className="space-y-2">
                                                    <p className="text-sm font-medium text-gray-700">Foto STNK</p>
                                                    <div data-pdf-image="document" className="relative w-full h-48 rounded-lg overflow-hidden border bg-white">
                                                        <img 
                                                            src={kendaraan.fotoStnkUrl || undefined} 
                                                            alt="Foto STNK" 
                                                            className="w-full h-full object-contain"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                            {izinTrayekUrl && (
                                                <div className="space-y-2">
                                                    <p className="text-sm font-medium text-gray-700">Foto Izin Trayek</p>
                                                    <div data-pdf-image="document" className="relative w-full h-48 rounded-lg overflow-hidden border bg-white">
                                                        <img 
                                                            src={izinTrayekUrl || undefined} 
                                                            alt="Foto Izin Trayek" 
                                                            className="w-full h-full object-contain"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                            {kendaraan.fotoSpeksiUrl && (
                                                <div className="space-y-2">
                                                    <p className="text-sm font-medium text-gray-700">Foto Speksi</p>
                                                    <div data-pdf-image="document" className="relative w-full h-48 rounded-lg overflow-hidden border bg-white">
                                                        <img 
                                                            src={kendaraan.fotoSpeksiUrl || undefined} 
                                                            alt="Foto Speksi" 
                                                            className="w-full h-full object-contain"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Document History */}
                                <div className="mb-8">
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                                        <h3 className="font-semibold text-lg flex items-center gap-2">
                                            <RectangleStackIcon className="w-5 h-5" />
                                            Riwayat Dokumen
                                        </h3>
                                        {onRenewDocument && kendaraan ? (
                                            <Button
                                                variant="outline"
                                                className="w-full sm:w-auto rounded-full flex items-center justify-center gap-2"
                                                onClick={() => onRenewDocument(kendaraan)}
                                            >
                                                <RectangleStackIcon className="w-4 h-4" />
                                                Perpanjang Dokumen
                                            </Button>
                                        ) : null}
                                    </div>
                                    <div className="border rounded-lg overflow-x-auto">
                                        <Table>
                                            <TableHeader className="bg-gray-50">
                                                <TableRow>
                                                    <TableHead>Jenis</TableHead>
                                                    <TableHead>Tgl Perpanjangan</TableHead>
                                                    <TableHead>Berlaku Hingga</TableHead>
                                                    <TableHead>Biaya</TableHead>
                                                    <TableHead>Keterangan</TableHead>
                                                    <TableHead>Foto</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {isLoadingDocs ? (
                                                    <TableRow>
                                                        <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                                                            Memuat data...
                                                        </TableCell>
                                                    </TableRow>
                                                ) : documentHistory && documentHistory.length > 0 ? (
                                                    documentHistory.map((doc) => (
                                                        <TableRow key={doc.id}>
                                                            <TableCell>
                                                                {doc.jenis}
                                                            </TableCell>
                                                            <TableCell className="whitespace-nowrap">
                                                                {format(new Date(doc.createdAt), 'dd MMM yyyy', { locale: idLocale })}
                                                            </TableCell>
                                                            <TableCell className="whitespace-nowrap">
                                                                {format(new Date(doc.berlakuHingga), 'dd MMM yyyy', { locale: idLocale })}
                                                            </TableCell>
                                                            <TableCell>
                                                                Rp {doc.biaya.toLocaleString('id-ID')}
                                                            </TableCell>
                                                            <TableCell className="max-w-[200px] truncate" title={doc.keterangan}>
                                                                {doc.keterangan || '-'}
                                                            </TableCell>
                                                            <TableCell>
                                                                {doc.fotoUrl ? (
                                                                    <div className="w-[110px] h-[80px] bg-gray-100 rounded-md overflow-hidden flex items-center justify-center border border-gray-200">
                                                                        <img 
                                                                            src={doc.fotoUrl}
                                                                            alt="Foto Dokumen" 
                                                                            className="w-full h-full object-contain cursor-pointer hover:scale-105 transition-transform"
                                                                            onClick={() => setViewImageUrl(doc.fotoUrl ?? null)}
                                                                        />
                                                                    </div>
                                                                ) : '-'}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))
                                                ) : (
                                                    <TableRow>
                                                        <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                                                            Belum ada riwayat dokumen
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>

                                {/* Service History */}
                                <div>
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                                        <h3 className="font-semibold text-lg flex items-center gap-2">
                                            <WrenchIcon className="w-5 h-5" />
                                            Riwayat Servis
                                        </h3>
                                        {onService && kendaraan ? (
                                            <Button
                                                variant="outline"
                                                className="w-full sm:w-auto rounded-full flex items-center justify-center gap-2"
                                                onClick={() => onService(kendaraan)}
                                            >
                                                <WrenchIcon className="w-4 h-4" />
                                                Catat Servis
                                            </Button>
                                        ) : null}
                                    </div>
                                    <div className="border rounded-lg overflow-x-auto">
                                        <Table>
                                            <TableHeader className="bg-gray-50">
                                                <TableRow>
                                                    <TableHead>Tanggal</TableHead>
                                                    <TableHead>Deskripsi</TableHead>
                                                    <TableHead>Biaya</TableHead>
                                                    <TableHead>KM</TableHead>
                                                    <TableHead>Servis Berikutnya</TableHead>
                                                    <TableHead>Foto</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {isLoading ? (
                                                    <TableRow>
                                                        <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                                                            Memuat data...
                                                        </TableCell>
                                                    </TableRow>
                                                ) : logs && logs.length > 0 ? (
                                                    logs.map((log) => (
                                                        <TableRow key={log.id}>
                                                            <TableCell className="whitespace-nowrap">
                                                                {format(new Date(log.date), 'dd MMM yyyy', { locale: idLocale })}
                                                            </TableCell>
                                                            <TableCell className="max-w-[200px] truncate" title={log.description}>
                                                                {log.description}
                                                            </TableCell>
                                                            <TableCell>
                                                                Rp {log.cost.toLocaleString('id-ID')}
                                                            </TableCell>
                                                            <TableCell>
                                                                {log.odometer ? `${log.odometer.toLocaleString('id-ID')} km` : '-'}
                                                            </TableCell>
                                                            <TableCell>
                                                                {log.nextServiceDate ? format(new Date(log.nextServiceDate), 'dd MMM yyyy', { locale: idLocale }) : '-'}
                                                            </TableCell>
                                                            <TableCell>
                                                                {log.fotoUrl ? (
                                                                    <div className="w-[110px] h-[80px] bg-gray-100 rounded-md overflow-hidden flex items-center justify-center border border-gray-200">
                                                                        <img 
                                                                            src={log.fotoUrl}
                                                                            alt="Foto Servis" 
                                                                            className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                                                                            onClick={() => setViewImageUrl(log.fotoUrl ?? null)}
                                                                        />
                                                                    </div>
                                                                ) : '-'}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))
                                                ) : (
                                                    <TableRow>
                                                        <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                                                            Belum ada riwayat servis
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer with Export Button */}
                        <div className="p-4 border-t bg-gray-50 shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                                {onDelete && kendaraan ? (
                                    <Button
                                        onClick={() => onDelete(kendaraan)}
                                        variant="outline"
                                        className="w-full sm:w-auto rounded-full flex items-center justify-center gap-2 border-red-200 text-red-700 hover:bg-red-50"
                                    >
                                        <TrashIcon className="w-4 h-4" />
                                        Hapus
                                    </Button>
                                ) : null}
                                {onEdit && kendaraan ? (
                                    <Button 
                                        onClick={() => onEdit(kendaraan)}
                                        variant="outline"
                                        className="w-full sm:w-auto rounded-full flex items-center justify-center gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                    >
                                        <PencilSquareIcon className="w-4 h-4" />
                                        Edit Data
                                    </Button>
                                ) : null}
                            </div>
                            <Button 
                                onClick={handleExportPDF}
                                disabled={isExporting}
                                variant="destructive"
                                className="w-full sm:w-auto rounded-full flex items-center justify-center gap-2"
                            >
                                {isExporting ? (
                                    <span className="w-4 h-4 border-2 border-white/50 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <ArrowDownTrayIcon className="w-4 h-4" />
                                )}
                                Export PDF
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={!!viewImageUrl} onOpenChange={(open) => !open && setViewImageUrl(null)}>
                <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden bg-transparent border-none shadow-none flex items-center justify-center [&>button]:hidden">
                    {viewImageUrl && (
                        <div className="relative w-full h-full flex items-center justify-center group">
                            <img 
                                src={viewImageUrl} 
                                alt="Dokumen" 
                                className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl bg-white"
                            />
                            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all focus-within:opacity-100">
                                <button
                                    onClick={() => handleDownload(viewImageUrl)}
                                    className="p-2 bg-white/90 hover:bg-white text-gray-800 rounded-full shadow-lg transition-colors"
                                    title="Download Gambar"
                                >
                                    <ArrowDownTrayIcon className="w-6 h-6" />
                                </button>
                                <button
                                    onClick={() => setViewImageUrl(null)}
                                    className="p-2 bg-white/90 hover:bg-white text-gray-800 rounded-full shadow-lg transition-colors"
                                    title="Tutup"
                                >
                                    <XMarkIcon className="w-6 h-6" />
                                </button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
