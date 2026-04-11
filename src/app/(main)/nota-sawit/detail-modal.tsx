import { useRef, useEffect } from 'react';
import { NotaSawitData } from './columns';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from '@/components/AuthProvider';
import { BuildingOffice2Icon, CalendarIcon, TruckIcon, UserIcon, EllipsisHorizontalIcon, DocumentTextIcon, PencilSquareIcon, TrashIcon, ArrowDownTrayIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ModalHeader, ModalFooter } from '@/components/ui/modal-elements'

interface ModalDetailProps {
  nota: NotaSawitData | null;
  onClose: () => void;
  onEdit?: (nota: NotaSawitData) => void;
  onDelete?: (nota: NotaSawitData) => void;
  readonly?: boolean;
}

const formatCurrency = (num: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
const formatDate = (date: Date) => new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
const formatWeight = (num: number) => `${num.toLocaleString('id-ID')} kg`;

function Row({ label, value, className, valueClassName }: { label: string; value: React.ReactNode; className?: string; valueClassName?: string }) {
  return (
    <div className={`flex justify-between items-center py-2 ${className || ''}`}>
      <span className="text-sm text-gray-500 font-medium">{label}</span>
      <span className={`text-sm font-semibold text-gray-900 ${valueClassName || ''}`}>{value}</span>
    </div>
  );
}

export default function ModalDetail({ nota, onClose, onEdit, onDelete, readonly = false }: ModalDetailProps) {
  const { role } = useAuth();
  const router = useRouter();
  const [buktiOpen, setBuktiOpen] = useState(false)
  const [buktiUrl, setBuktiUrl] = useState<string | null>(null)
  const [buktiTitle, setBuktiTitle] = useState('Bukti Foto')
  const [downloading, setDownloading] = useState(false)
  const [createdBy, setCreatedBy] = useState<{ name: string | null; createdAt: Date | null } | null>(null);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {}
  };

  const buildSummary = (n: NotaSawitData) => {
    const effectiveNetto = (n.netto && n.netto > 0) ? n.netto : (n.timbangan?.netKg || 0);
    const beratTotal = effectiveNetto - n.potongan;
    return [
      `Nota Sawit #${n.id}`,
      `Tanggal Bongkar: ${n.tanggalBongkar ? formatDate(n.tanggalBongkar) : '-'}`,
      `Supir: ${n.supir.name}`,
      `Kendaraan: ${n.kendaraan?.platNomor || '-'}`,
      `Pabrik: ${n.pabrikSawit.name}`,
      `Bruto/Tara/Netto: ${(n.bruto || n.timbangan?.grossKg || 0).toLocaleString('id-ID')} / ${(n.tara || n.timbangan?.tareKg || 0).toLocaleString('id-ID')} / ${(n.netto || n.timbangan?.netKg || 0).toLocaleString('id-ID')} kg`,
      `Potongan: ${n.potongan.toLocaleString('id-ID')} kg`,
      `Total Berat (Net): ${beratTotal.toLocaleString('id-ID')} kg`,
      `Status Pembayaran: ${n.statusPembayaran === 'LUNAS' ? 'Lunas' : 'Pending'}`,
      `Total Diterima: ${formatCurrency((n as any).pembayaranAktual ?? n.pembayaranSetelahPph)}`
    ].join('\n');
  };

  const handleCopySummary = () => {
    if (!nota) return;
    copyToClipboard(buildSummary(nota));
  };

  const handleCopyId = () => {
    if (!nota) return;
    copyToClipboard(String(nota.id));
  };

  const openBukti = (url: string, title: string) => {
    setBuktiUrl(url)
    setBuktiTitle(title)
    setBuktiOpen(true)
  }

  const handleDownloadBukti = async () => {
    if (!buktiUrl || downloading || !nota) return
    setDownloading(true)
    try {
      const res = await fetch(buktiUrl, { cache: 'no-store' })
      const blob = await res.blob()
      const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `bukti-nota-sawit-${nota.id}.${ext}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      const a = document.createElement('a')
      a.href = buktiUrl
      a.target = '_blank'
      document.body.appendChild(a)
      a.click()
      a.remove()
    } finally {
      setDownloading(false)
    }
  }

  const handleDownloadImage = async () => {
    if (!nota?.gambarNotaUrl) return
    try {
      const res = await fetch(nota.gambarNotaUrl, { cache: 'no-store' })
      const blob = await res.blob()
      const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `nota-sawit-${nota.id}.${ext}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      const a = document.createElement('a')
      a.href = nota.gambarNotaUrl
      a.target = '_blank'
      document.body.appendChild(a)
      a.click()
      a.remove()
    }
  }

  const handleOpenTimbangan = () => {
    if (!nota?.timbangan) return;
    const q = encodeURIComponent(String(nota.timbangan.id));
    router.push(`/timbangan?openId=${q}`);
  };

  const handleEditNota = () => {
    if (!nota) return;
    if (onEdit) {
      onEdit(nota)
      return
    }
    const q = encodeURIComponent(String(nota.id));
    router.push(`/nota-sawit?editId=${q}`);
  };

  const handleDeleteNota = () => {
    if (!nota || !onDelete) return
    onDelete(nota)
  }

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!nota) return;
      try {
        const res = await fetch(`/api/nota-sawit/${nota.id}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!active) return;
        setCreatedBy({
          name: data?.createdBy?.name ?? null,
          createdAt: data?.createdAt ? new Date(data.createdAt) : null
        });
      } catch {}
    };
    load();
    return () => { active = false; };
  }, [nota?.id]);

  const toDataURL = (url: string): Promise<string> => new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
        const canvas = document.createElement('CANVAS') as HTMLCanvasElement;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return reject(new Error('Failed to get canvas context'));
        }
        canvas.height = img.naturalHeight;
        canvas.width = img.naturalWidth;
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg'));
    };
    img.onerror = reject;
    img.src = url;
  });

  const handleExportToPdf = async () => {
    if (!nota) return;
    const { jsPDF } = await import('jspdf');

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 12; // tambah jarak margin kiri/kanan
    const boxPadding = 3; // diperkecil untuk kompresi
    const contentMargin = margin + boxPadding;
    const gutter = 12; // jarak antar kolom
    const contentWidth = Math.floor(((pageWidth - margin * 2) - gutter) * 0.5);
    const contentRight = margin + contentWidth - boxPadding;
    const rightColumnX = margin + contentWidth + gutter;
    const rightContentMargin = rightColumnX + boxPadding;
    const rightContentRight = rightColumnX + contentWidth - boxPadding;
    let currentY = margin + 8;
    let rightY = margin + 8;

    // --- Header ---
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor('#111827'); // Gray 900
    doc.text("Detail Nota Sawit", contentMargin, currentY);
    
    currentY += 12; // kompresi spasi

    // Kebun - Plat Info
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    
    // Helper to capitalize each word
    const capitalize = (str: string) => str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
    
    const titleText = `${capitalize(nota.timbangan?.kebun.name || nota.kebun?.name || '-')} - ${nota.kendaraan?.platNomor || '-'}`;
    doc.text(titleText, contentMargin, currentY);
    
    // Subtext: Pabrik • Supir
    currentY += 5;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor('#6B7280'); // Gray 500
    doc.text(`${nota.pabrikSawit.name} • ${nota.supir.name}`, contentMargin, currentY);

    // Spacing after subtext
    currentY += 6;

    // --- Detail Box (Weights) ---
    const lineHeight = 9; // kompresi line height global
    
    // 0. Tanggal Bongkar
    const tanggalBongkarRow = { label: 'Tanggal Bongkar', value: nota.tanggalBongkar ? formatDate(nota.tanggalBongkar) : '-' };

    // 1. Data Timbangan (Pembanding)
    const brutoPabrik = nota.bruto || 0
    const brutoKebun = nota.timbangan?.grossKg || 0
    const selisihBruto = brutoPabrik - brutoKebun
    const selisihBrutoLabel =
      selisihBruto === 0
        ? 'Timbangan Pabrik Sama'
        : selisihBruto > 0
          ? `Timbangan Pabrik Lebih ${formatWeight(Math.abs(selisihBruto))}`
          : `Timbangan Pabrik Kurang ${formatWeight(Math.abs(selisihBruto))}`
    // Tampilkan data timbangan jika objek timbangan ada dan netKg adalah angka
    const isManualMode = !(nota.timbangan && typeof nota.timbangan.netKg === 'number');

    const timbanganRows = isManualMode
      ? [
          { label: 'Status', value: 'Data timbangan tidak tersedia', valueClassName: 'text-gray-500 italic font-normal' }
        ]
      : [
          ...(nota.timbangan?.date ? [{ label: 'Tanggal', value: formatDate(nota.timbangan.date) }] : []),
          ...(nota.timbangan?.supir ? [{ label: 'Supir', value: nota.timbangan.supir.name }] : []),
          ...(typeof nota.timbangan?.grossKg === 'number' ? [{ label: 'Bruto', value: formatWeight(nota.timbangan.grossKg) }] : []),
          ...(brutoPabrik > 0 ? [{ label: 'Selisih Bruto', value: selisihBrutoLabel }] : []),
        ];

    // 2. Data Nota Pabrik (Utama)
    // Always show if we want to be explicit, or check if values exist
    const factoryRows = [
        { label: 'Bruto', value: formatWeight(nota.bruto || 0) },
        { label: 'Tara', value: formatWeight(nota.tara || 0) },
        { label: 'Netto', value: formatWeight(nota.netto || 0) },
    ];

    const grayBoxHeight = (2 * lineHeight) + (boxPadding * 2) + 8;
    // sejajarkan kolom kanan (informasi harga) dengan Tanggal Bongkar
    rightY = currentY;
    doc.setFillColor('#F9FAFB');
    doc.roundedRect(margin, currentY, contentWidth, grayBoxHeight, 3, 3, 'F');
    let rowY = currentY + boxPadding + 5;
    doc.setFontSize(11);
    doc.setTextColor('#6B7280');
    doc.setFont('helvetica', 'normal');
    doc.text(tanggalBongkarRow.label, contentMargin, rowY);
    doc.setTextColor('#111827');
    doc.setFont('helvetica', 'bold');
    doc.text(tanggalBongkarRow.value, contentRight, rowY, { align: 'right' });
    rowY += lineHeight + 3;
    doc.setFontSize(11);
    doc.setTextColor('#6B7280');
    doc.setFont('helvetica', 'normal');
    doc.text('Di Input Oleh', contentMargin, rowY);
    doc.setTextColor('#111827');
    doc.setFont('helvetica', 'bold');
    doc.text(createdBy?.name || '-', contentRight, rowY, { align: 'right' });
    currentY += grayBoxHeight + 10;

    const sectionHeaderHeight = 8;
    const greenBoxHeight = sectionHeaderHeight + (factoryRows.length * lineHeight) + (boxPadding * 2) + 8;
    doc.setFillColor('#ECFDF5');
    doc.roundedRect(margin, currentY, contentWidth, greenBoxHeight, 3, 3, 'F');
    rowY = currentY + boxPadding + 5;
    doc.setFontSize(9);
    doc.setTextColor('#15803D');
    doc.setFont('helvetica', 'bold');
    doc.text("DATA NOTA PABRIK (UTAMA)", contentMargin, rowY);
    rowY += 6;
    factoryRows.forEach(row => {
      doc.setFontSize(10);
      doc.setTextColor('#6B7280');
      doc.setFont('helvetica', 'normal');
      doc.text(row.label, contentMargin, rowY);
      doc.setTextColor('#15803D');
      doc.setFont('helvetica', 'bold');
      doc.text(row.value, contentRight, rowY, { align: 'right' });
      rowY += lineHeight;
    });
    currentY += greenBoxHeight + 10;

    const effectiveNetto = (nota.netto && nota.netto > 0) ? nota.netto : (nota.timbangan?.netKg || 0);
    const beratTotal = effectiveNetto - nota.potongan;
    const calcBoxHeight = (2 * lineHeight) + (boxPadding * 2) + 8;
    doc.setFillColor('#F9FAFB');
    doc.roundedRect(margin, currentY, contentWidth, calcBoxHeight, 3, 3, 'F');
    rowY = currentY + boxPadding + 5;
    doc.setFontSize(10);
    doc.setTextColor('#6B7280');
    doc.setFont('helvetica', 'normal');
    doc.text(`Potongan (${(effectiveNetto > 0 ? (nota.potongan / effectiveNetto) * 100 : 0).toLocaleString('id-ID', { maximumFractionDigits: 2 })}%)`, contentMargin, rowY);
    doc.setTextColor('#111827');
    doc.setFont('helvetica', 'bold');
    doc.text(formatWeight(nota.potongan), contentRight, rowY, { align: 'right' });
    rowY += lineHeight;
    doc.setFontSize(10);
    doc.setTextColor('#15803D');
    doc.setFont('helvetica', 'bold');
    doc.text("Total Berat (Net)", contentMargin, rowY);
    doc.text(formatWeight(beratTotal), contentRight, rowY, { align: 'right' });
    currentY += calcBoxHeight + 10;

    // --- Financials (RIGHT COLUMN, BOXED) ---
    if (role !== 'SUPIR') {
      const financeRows: { label: string; value: string; isBold?: boolean; color?: string }[] = [
        { label: 'Harga / Kg', value: formatCurrency(nota.hargaPerKg) },
        { label: 'Total', value: formatCurrency(nota.totalPembayaran) },
        { label: 'Potongan PPh (0.25%)', value: `- ${formatCurrency(nota.pph)}` },
        { label: 'Total Pembayaran (Net)', value: formatCurrency(nota.pembayaranSetelahPph), isBold: true },
      ];
      if ((nota as any).pembayaranAktual !== null && (nota as any).pembayaranAktual !== undefined) {
        financeRows.push({
          label: 'Pembayaran Aktual',
          value: formatCurrency((nota as any).pembayaranAktual),
          isBold: true,
          color: '#1D4ED8'
        });
      }
      const financeHeaderH = 6;
      const rowH = 9 * financeRows.length;
      const dividerH = 8 + 4;
      const totalH = 8 + 12;
      const ketRaw = (nota as any).keterangan ? String((nota as any).keterangan) : ''
      const ketWidth = rightContentRight - rightContentMargin
      const ketLines = ketRaw ? doc.splitTextToSize(ketRaw, ketWidth) : []
      const ketBlockHeight = ketLines.length > 0 ? (8 + 6 + (ketLines.length * 5)) : 0
      let financeBoxHeight = financeHeaderH + rowH + dividerH + totalH + (boxPadding * 2) + 8 + ketBlockHeight;
      doc.setFillColor('#F9FAFB');
      doc.setDrawColor('#E5E7EB');
      doc.roundedRect(rightColumnX, rightY, contentWidth, financeBoxHeight, 3, 3, 'DF');
      let fy = rightY + boxPadding + 5;
      doc.setFontSize(9);
      doc.setTextColor('#6B7280');
      doc.setFont('helvetica', 'bold');
      doc.text("INFORMASI HARGA", rightContentMargin, fy);
      fy += 6;
      financeRows.forEach(row => {
        doc.setFontSize(10);
        doc.setTextColor('#6B7280');
        doc.setFont('helvetica', 'normal');
        doc.text(row.label, rightContentMargin, fy);
        doc.setTextColor(row.color || '#111827');
        doc.setFont('helvetica', row.isBold ? 'bold' : 'normal');
        doc.text(row.value, rightContentRight, fy, { align: 'right' });
        fy += 9;
      });
      fy += 4;
      doc.setDrawColor('#E5E7EB');
      doc.line(rightContentMargin, fy, rightContentRight, fy);
      fy += 8;
      doc.setFontSize(10);
      doc.setTextColor('#16A34A');
      doc.setFont('helvetica', 'bold');
      doc.text("TOTAL DITERIMA", rightContentRight, fy, { align: 'right' });
      // Status Pembayaran di kiri, TOTAL DITERIMA di kanan pada baris yang sama
      doc.setFontSize(10);
      doc.setTextColor(nota.statusPembayaran === 'LUNAS' ? '#15803D' : '#A16207');
      doc.setFont('helvetica', 'bold');
      doc.text(`Status Pembayaran: ${nota.statusPembayaran === 'LUNAS' ? 'Lunas' : 'Pending'}`, rightContentMargin, fy);
      fy += 8;
      doc.setFontSize(16);
      doc.setTextColor('#16A34A');
      doc.setFont('helvetica', 'bold');
      const finalAmount = (nota as any).pembayaranAktual ?? nota.pembayaranSetelahPph;
      doc.text(formatCurrency(finalAmount), rightContentRight, fy, { align: 'right' });

      if (ketLines.length > 0) {
        fy += 10;
        doc.setDrawColor('#E5E7EB');
        doc.line(rightContentMargin, fy, rightContentRight, fy);
        fy += 8;
        doc.setFontSize(9);
        doc.setTextColor('#6B7280');
        doc.setFont('helvetica', 'bold');
        doc.text('KETERANGAN', rightContentMargin, fy);
        fy += 6;
        doc.setFontSize(10);
        doc.setTextColor('#111827');
        doc.setFont('helvetica', 'normal');
        doc.text(ketLines, rightContentMargin, fy);
      }
      rightY += financeBoxHeight + 10;
    }

    // Timbangan Section (Pembanding) - RIGHT COLUMN (BOXED)
    const timbanganRowsCount = isManualMode ? 1 : timbanganRows.length;
    const spaceBottom = (pageHeight - margin) - rightY;
    const tryLineHeights = [lineHeight, 8, 7];
    let chosenLH = lineHeight;
    let baseHeaderH = 16; // divider(10) + header(6) kompresi
    for (const lh of tryLineHeights) {
      const needed = baseHeaderH + (timbanganRowsCount * lh);
      if (needed <= spaceBottom) {
        chosenLH = lh;
        break;
      }
    }
    // Box height
    const headerH = 6;
    const bodyH = isManualMode ? chosenLH : (timbanganRowsCount * chosenLH);
    const timbangBoxHeight = 10 + headerH + bodyH + (boxPadding * 2) + 6; // +10 top spacer to mimic divider
    doc.setFillColor('#F9FAFB');
    doc.setDrawColor('#E5E7EB');
    doc.roundedRect(rightColumnX, rightY, contentWidth, timbangBoxHeight, 3, 3, 'DF');
    let ty = rightY + boxPadding + 5;
    doc.setFontSize(9);
    doc.setTextColor('#6B7280');
    doc.setFont('helvetica', 'bold');
    doc.text("DATA TIMBANGAN (PEMBANDING)", rightContentMargin, ty);
    ty += 6;
    const labelFont = chosenLH < lineHeight ? 9 : 10;
    const valueFont = chosenLH < lineHeight ? 9 : 10;
    if (isManualMode) {
      doc.setFontSize(labelFont);
      doc.setTextColor('#6B7280');
      doc.setFont('helvetica', 'normal'); 
      doc.text('Status', rightContentMargin, ty);
      doc.setTextColor('#6B7280');
      doc.setFont('helvetica', 'italic');
      doc.text('Data timbangan tidak tersedia', rightContentRight, ty, { align: 'right' });
      ty += chosenLH;
    } else {
      timbanganRows.forEach(row => {
        doc.setFontSize(labelFont);
        doc.setTextColor('#6B7280');
        doc.setFont('helvetica', 'normal'); 
        doc.text(row.label, rightContentMargin, ty);
        doc.setTextColor('#111827');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(valueFont);
        doc.text(row.value, rightContentRight, ty, { align: 'right' });
        doc.setDrawColor('#E5E7EB');
        doc.line(rightContentMargin, ty + 2.5, rightContentRight, ty + 2.5);
        ty += chosenLH;
      });
    }
    rightY += timbangBoxHeight + 10;

    // --- Images ---
    let imagesStarted = false;
    const addImageToPdf = async (url: string, title: string) => {
        try {
            if (!imagesStarted) {
                doc.addPage();
                currentY = margin;
                imagesStarted = true;
            }
            const imgData = await toDataURL(url);
            const img = new Image();
            img.src = imgData;
            await new Promise((resolve) => { img.onload = resolve; });

            // Calculate dimensions first
            const aspectRatio = img.width / img.height;
            const availableWidth = pageWidth - contentMargin * 2;
            let imgWidth = availableWidth;
            let imgHeight = imgWidth / aspectRatio;
            
            // Reserve space for title (approx 15 units)
            const titleHeight = 15; 
            const maxImgHeight = pageHeight - margin * 2 - titleHeight;

            if (imgHeight > maxImgHeight) {
                 imgHeight = maxImgHeight;
                 imgWidth = imgHeight * aspectRatio;
            }

            // Spacing before title (new images page starts at margin)
            currentY += 10;

            // Print Title
            doc.setFontSize(10);
            doc.setTextColor('#6B7280'); // Gray 500
            doc.setFont('helvetica', 'bold');
            doc.text(title.toUpperCase(), contentMargin, currentY);
            
            currentY += 8; // spacing between title and image

            // Print Image
            const x = (pageWidth - imgWidth) / 2;
            doc.addImage(imgData, 'JPEG', x, currentY, imgWidth, imgHeight);
            
            currentY += imgHeight + 10; // spacing after

        } catch (error) {
            console.error("Error adding image to PDF:", error);
        }
    };

    // Gambar akan tetap di halaman 2

    if (nota.gambarNotaUrl) await addImageToPdf(nota.gambarNotaUrl, 'Lampiran Gambar Nota');
    if (nota.timbangan?.photoUrl) await addImageToPdf(nota.timbangan.photoUrl, 'Lampiran Bukti Timbangan');

    doc.save(`Nota Sawit - ${nota.supir.name} - ${formatDate(nota.createdAt)}.pdf`);
  };

  if (!nota) return null;

  const effectiveNetto = (nota.netto && nota.netto > 0) ? nota.netto : (nota.timbangan?.netKg || 0);
  const brutoPabrik = nota.bruto || 0
  const brutoKebun = nota.timbangan?.grossKg || 0
  const selisihBruto = brutoPabrik - brutoKebun
  const selisihBrutoLabel =
    selisihBruto === 0
      ? 'Timbangan Pabrik Sama'
      : selisihBruto > 0
        ? `Timbangan Pabrik Lebih ${formatWeight(Math.abs(selisihBruto))}`
        : `Timbangan Pabrik Kurang ${formatWeight(Math.abs(selisihBruto))}`
  const beratTotal = effectiveNetto - nota.potongan;
  const hasTimbanganAsal = nota.timbangan ? !!(nota.timbangan.supir || nota.timbangan.kendaraan) : false;
  const kebunName = nota.timbangan?.kebun?.name || nota.kebun?.name || '-';

  return (
    <>
    <Dialog open={!!nota} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[92vw] sm:w-full sm:max-w-[520px] p-0 overflow-hidden bg-white border-none shadow-2xl rounded-[20px] gap-0 max-h-[92vh] flex flex-col [&>button.absolute]:hidden">
        <ModalHeader
          title="Detail Nota Sawit"
          subtitle="Rincian data nota sawit"
          variant="emerald"
          icon={<DocumentTextIcon className="h-5 w-5 text-white" />}
          onClose={onClose}
        />

        <div className="px-6 pt-5 pb-2">
          <div className="flex items-start gap-4 mb-4">
            <div className="h-12 w-12 bg-black rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm">
               <BuildingOffice2Icon className="h-6 w-6" />
            </div>
            <div>
               <h3 className="font-bold text-lg text-gray-900 leading-tight">
                  <span className="capitalize">{kebunName}</span> - {nota.kendaraan?.platNomor || '-'}
               </h3>
               <div className="flex items-center gap-1.5 text-gray-500 mt-1">
                  <span className="text-sm font-medium">{nota.pabrikSawit.name} • {nota.supir.name}</span>
               </div>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="px-6 py-2 flex-1 overflow-y-auto min-h-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {/* Detail Box - Tanggal Bongkar */}
           <div className="bg-gray-50 rounded-2xl p-5 mb-4">
              <Row 
                label="Tanggal Bongkar" 
                value={nota.tanggalBongkar ? formatDate(nota.tanggalBongkar) : '-'} 
                className="last:border-0 last:pb-0"
              />
              <Row 
                label="Di Input Oleh" 
                value={createdBy?.name || '-'} 
                className="last:border-0 last:pb-0"
              />
           </div>

           

           {/* Detail Box - Data Nota Pabrik */}
           <div className="bg-green-50 rounded-2xl p-5 mb-4 space-y-4 border border-green-100">
              <h4 className="font-semibold text-green-700 mb-2 uppercase text-xs tracking-wider">Data Nota Pabrik (Utama)</h4>
              <Row 
                label="Bruto" 
                value={formatWeight(nota.bruto || 0)} 
                className="border-b border-green-200/50 pb-3 last:border-0 last:pb-0"
                valueClassName="text-green-900"
              />
              <Row 
                label="Tara" 
                value={formatWeight(nota.tara || 0)} 
                className="border-b border-green-200/50 pb-3 last:border-0 last:pb-0"
                valueClassName="text-green-900"
              />
              <Row 
                label="Netto" 
                value={formatWeight(nota.netto || 0)} 
                className="border-b border-green-200/50 pb-3 last:border-0 last:pb-0"
                valueClassName="text-green-900 font-bold"
              />
           </div>

           {/* Detail Box - Perhitungan Akhir */}
           <div className="bg-gray-50 rounded-2xl p-5 space-y-4">
              <Row 
                label={`Potongan (${(effectiveNetto > 0 ? (nota.potongan / effectiveNetto) * 100 : 0).toLocaleString('id-ID', { maximumFractionDigits: 2 })}%)`}
                value={formatWeight(nota.potongan)}
                className="border-b border-gray-100 pb-3 last:border-0 last:pb-0"
              />
              <div className="flex justify-between items-center pt-2">
                 <span className="text-sm font-bold text-green-700">Total Berat (Net)</span>
                 <span className="text-sm font-bold text-green-700">{formatWeight(beratTotal)}</span>
              </div>
           </div>

           {/* Financials Summary */}
          {role !== 'SUPIR' && (
            <div className="bg-gray-50 rounded-2xl p-5 mb-4 space-y-3 border border-gray-100 mt-6">
                <Row label="Harga / Kg" value={formatCurrency(nota.hargaPerKg)} />
                <Row label="Total" value={formatCurrency(nota.totalPembayaran)} />
                <Row 
                    label="Potongan PPh (0.25%)" 
                    value={`- ${formatCurrency(nota.pph)}`} 
                    valueClassName="text-gray-900"
                />
                <Row 
                    label="Total Pembayaran (Net)" 
                    value={formatCurrency(nota.pembayaranSetelahPph)} 
                    valueClassName="text-gray-900 font-bold"
                />
                {(nota as any).pembayaranAktual !== null && (nota as any).pembayaranAktual !== undefined && (
                   <Row 
                       label="Pembayaran Aktual" 
                       value={formatCurrency((nota as any).pembayaranAktual)} 
                       valueClassName="text-blue-700 font-bold"
                   />
                )}
                <div className="mt-6 pt-6 border-t border-gray-100 flex items-center justify-between">
                  <span className={`${nota.statusPembayaran === 'LUNAS' ? 'text-green-700' : 'text-yellow-700'} text-sm font-semibold`}>
                    Status Pembayaran: {nota.statusPembayaran === 'LUNAS' ? 'Lunas' : 'Pending'}
                  </span>
                  <div className="flex flex-col items-end">
                    <span className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-1">Total Diterima</span>
                    <span className="text-3xl font-bold text-green-600 tracking-tight">
                      {formatCurrency((nota as any).pembayaranAktual ?? nota.pembayaranSetelahPph)}
                    </span>
                  </div>
                </div>
                {(nota as any).keterangan ? (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Keterangan</div>
                    <div className="text-sm text-gray-900 whitespace-pre-wrap break-words">{String((nota as any).keterangan)}</div>
                  </div>
                ) : null}
             </div>
           )}

           <div className="mt-6 border-t border-gray-200" />

          <div className="bg-gray-50 rounded-2xl p-5 mb-4 space-y-4 border border-gray-100">
              <h4 className="font-semibold text-gray-500 mb-2 uppercase text-xs tracking-wider">Data Timbangan (Pembanding)</h4>
              {!(nota.timbangan && typeof nota.timbangan.netKg === 'number') ? (
                <div className="py-2 text-sm text-gray-500 italic text-center bg-gray-100/50 rounded-lg">
                  Data timbangan tidak tersedia
                </div>
              ) : (
                <>
                  <Row 
                    label="Tanggal Timbangan"
                    value={nota.timbangan.date ? formatDate(nota.timbangan.date) : '-'} 
                    className="border-b border-gray-100 pb-3 last:border-0 last:pb-0"
                  />
                  {nota.timbangan.supir && (
                    <Row 
                        label="Supir Timbangan" 
                        value={nota.timbangan.supir.name} 
                        className="border-b border-gray-100 pb-3 last:border-0 last:pb-0"
                    />
                  )}
                  <Row 
                    label="Bruto" 
                    value={typeof nota.timbangan.grossKg === 'number' ? formatWeight(nota.timbangan.grossKg) : '-'} 
                    className="border-b border-gray-100 pb-3 last:border-0 last:pb-0"
                  />
                  {brutoPabrik > 0 && (
                    <Row 
                      label="Selisih Bruto" 
                      value={selisihBrutoLabel} 
                      className="border-b border-gray-100 pb-3 last:border-0 last:pb-0"
                    />
                  )}
                </>
              )}
           </div>

           {nota.gambarNotaUrl && (
             <div className="mt-6">
               <h4 className="font-semibold text-gray-500 mb-2 uppercase text-xs tracking-wider">Lampiran Gambar Nota</h4>
               <div
                 className="relative w-full h-64 rounded-xl overflow-hidden bg-gray-900 border border-gray-200 group cursor-pointer"
                 onClick={() => openBukti(nota.gambarNotaUrl!, 'Lampiran Gambar Nota')}
               >
                 <img
                   src={nota.gambarNotaUrl}
                   alt="Lampiran Nota"
                   className="w-full h-full object-contain"
                 />
                 <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                   <span className="text-white text-sm font-medium">Klik untuk memperbesar</span>
                 </div>
               </div>
             </div>
           )}

           {(nota.timbangan as any)?.photoUrl ? (
             <div className="mt-6">
               <h4 className="font-semibold text-gray-500 mb-2 uppercase text-xs tracking-wider">Lampiran Bukti Timbangan</h4>
               <div
                 className="relative w-full h-64 rounded-xl overflow-hidden bg-gray-900 border border-gray-200 group cursor-pointer"
                 onClick={() => openBukti(String((nota.timbangan as any).photoUrl), 'Lampiran Bukti Timbangan')}
               >
                 <img
                   src={String((nota.timbangan as any).photoUrl)}
                   alt="Lampiran Timbangan"
                   className="w-full h-full object-contain"
                 />
                 <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                   <span className="text-white text-sm font-medium">Klik untuk memperbesar</span>
                 </div>
               </div>
             </div>
           ) : null}
        </div>

        {/* Footer Actions */}
        <ModalFooter className="mt-2 flex-row flex-nowrap items-center justify-end gap-2">
           <Button
             variant="outline"
             size="icon"
             className="h-9 w-9 rounded-md border border-gray-200 bg-white hover:bg-gray-50"
             onClick={handleExportToPdf}
             aria-label="Download Nota (PDF)"
             title="Download Nota (PDF)"
           >
             <ArrowDownTrayIcon className="h-4 w-4 text-gray-700" />
           </Button>

           {!readonly && role !== 'SUPIR' ? (
             <Button
               variant="outline"
               size="icon"
               className="h-9 w-9 rounded-md border border-gray-200 bg-white hover:bg-gray-50"
               onClick={handleEditNota}
               aria-label="Edit Nota"
               title="Edit"
             >
               <PencilSquareIcon className="h-4 w-4 text-emerald-700" />
             </Button>
           ) : null}

           {!readonly && role !== 'SUPIR' ? (
             <Button
               variant="outline"
               size="icon"
               className="h-9 w-9 rounded-md border border-red-200 bg-white text-red-600 hover:bg-red-50"
               onClick={handleDeleteNota}
               disabled={!onDelete}
               aria-label="Hapus Nota"
               title="Hapus"
             >
               <TrashIcon className="h-4 w-4" />
             </Button>
           ) : null}

           {!readonly ? (
             <DropdownMenu>
               <DropdownMenuTrigger asChild>
                 <Button variant="outline" size="icon" className="h-9 w-9 rounded-md border border-gray-200 bg-white hover:bg-gray-50">
                   <EllipsisHorizontalIcon className="h-4 w-4 text-gray-500" />
                 </Button>
               </DropdownMenuTrigger>
               <DropdownMenuContent align="end" className="w-56">
                 <DropdownMenuLabel>Aksi Lain</DropdownMenuLabel>
                 <DropdownMenuSeparator />
                 <DropdownMenuItem onClick={handleOpenTimbangan}>
                   Buka Timbangan Pembanding
                 </DropdownMenuItem>
                 <DropdownMenuItem disabled={!nota?.gambarNotaUrl} onClick={handleDownloadImage}>
                   Unduh Gambar Nota
                 </DropdownMenuItem>
               </DropdownMenuContent>
             </DropdownMenu>
           ) : null}
        </ModalFooter>
      </DialogContent>
    </Dialog>
    <Dialog
      open={buktiOpen}
      onOpenChange={(v) => {
        setBuktiOpen(v)
        if (!v) {
          setBuktiUrl(null)
          setBuktiTitle('Bukti Foto')
        }
      }}
    >
      <DialogContent className="max-w-3xl p-0 overflow-hidden [&>button.absolute]:hidden">
        <div className="w-full flex items-center justify-between gap-3 px-6 py-4 border-b bg-gradient-to-r from-emerald-600 to-emerald-500 text-white pr-16">
          <div className="min-w-0 flex items-center gap-2">
            <DocumentTextIcon className="h-5 w-5 text-white" />
            <div className="min-w-0">
              <div className="text-white text-base font-semibold">{buktiTitle}</div>
              <div className="text-xs text-white/90 truncate">Nota Sawit #{nota?.id ?? '-'}</div>
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
