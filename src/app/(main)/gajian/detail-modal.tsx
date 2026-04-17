'use client';

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/AuthProvider";
import type { Gajian, Kebun, DetailGajian, NotaSawit, Timbangan, User, BiayaLainGajian, PotonganGajian, Kendaraan, DetailGajianKaryawan } from '@prisma/client';
import { useEffect, useRef, useState } from 'react';
import { ArrowPathIcon, DocumentArrowDownIcon, DocumentTextIcon, PrinterIcon, XMarkIcon } from "@heroicons/react/24/outline";
import toast from "react-hot-toast";
import { ModalHeader } from "@/components/ui/modal-elements";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";

// Define extended types to match the API response
type NotaSawitWithRelations = NotaSawit & {
  supir: User;
  timbangan?: Timbangan | null;
  kebun?: Kebun | null;
  kendaraan?: Kendaraan | null;
};

type DetailGajianWithRelations = DetailGajian & {
  notaSawit: NotaSawitWithRelations;
  keterangan?: string | null;
};

type DetailGajianKaryawanWithUser = DetailGajianKaryawan & {
  user: User
  saldoHutang?: number
}

type HutangTambahanRow = {
  userId: number
  jumlah: number
  date: Date | string | null
  deskripsi: string | null
}

type GajianWithDetails = Gajian & {
  kebun: Kebun;
  detailGajian: DetailGajianWithRelations[];
  biayaLain: (BiayaLainGajian & { keterangan?: string | null })[];
  potongan: (PotonganGajian & { keterangan?: string | null })[];
  detailKaryawan: DetailGajianKaryawanWithUser[];
  hutangTambahan?: HutangTambahanRow[];
};

const formatNumber = (num: number, maxFractionDigits = 0) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: maxFractionDigits }).format(num);
const formatDate = (date: Date | string) => new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(date));

const normalizeBoronganJenis = (raw: any) => {
  const s = String(raw || '').trim()
  if (!s) return ''
  if (!/^upah\s*borongan/i.test(s)) return s
  const rest = s.replace(/^upah\s*borongan\s*-\s*/i, '').trim()
  if (!rest) return ''
  const parts = rest.split(' - ').map((p) => p.trim()).filter(Boolean)
  return parts.length > 0 ? parts[parts.length - 1] : rest
}

const formatKgNota = (nota?: NotaSawitWithRelations | null) => {
  if (!nota) return ''
  const kg = nota.beratAkhir
  if (!Number.isFinite(kg)) return ''
  return formatNumber(kg)
}

const formatTanggalNota = (nota?: NotaSawitWithRelations | null) => {
  if (!nota) return ''
  const d = nota.tanggalBongkar ?? nota.createdAt
  return formatDate(d)
}

const cleanBiayaKeterangan = (value: any) => {
  const s = String(value || '').trim()
  if (!s) return ''
  if (/^tanggal\s*:/i.test(s)) return ''
  return s
}

interface DetailGajianModalProps {
  isOpen: boolean;
  onClose: () => void;
  gajian: GajianWithDetails | null;
  isPreview?: boolean;
  onConfirm?: (payload: { dibuatOlehName: string; disetujuiOlehName: string }) => void;
  isLoading?: boolean;
  showApprovalFields?: boolean;
  onRevert?: () => void;
}

export function DetailGajianModal({ isOpen, onClose, gajian: gajianProp, isPreview, onConfirm, isLoading, showApprovalFields = true, onRevert }: DetailGajianModalProps) {
  const { name: currentUserName, role } = useAuth()
  const printRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isReverting, setIsReverting] = useState(false);
  const [isRevertConfirmOpen, setIsRevertConfirmOpen] = useState(false);
  const [dibuatOlehName, setDibuatOlehName] = useState('')
  const [disetujuiOlehName, setDisetujuiOlehName] = useState('')

  const handleRevert = async () => {
    if (!gajianProp?.id) return;
    setIsRevertConfirmOpen(true)
  };

  const handleConfirmRevert = async () => {
    if (!gajianProp?.id || isReverting) return
    setIsRevertConfirmOpen(false)
    setIsReverting(true);
    try {
      const response = await fetch(`/api/gajian/${gajianProp.id}/revert`, {
        method: 'POST',
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Gagal membatalkan finalisasi');
      }

      toast.success('Berhasil membatalkan finalisasi gajian');
      onRevert?.();
      onClose();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsReverting(false);
    }
  };
  const [pemilikName, setPemilikName] = useState('')
  const [hutangSaldoByUserId, setHutangSaldoByUserId] = useState<Record<number, number>>({})
  const [gajianFull, setGajianFull] = useState<GajianWithDetails | null>(null)

  const gajian = gajianProp ? (isPreview ? gajianProp : (gajianFull ?? gajianProp)) : null

  useEffect(() => {
    if (!isOpen) return
    ;(async () => {
      try {
        const res = await fetch('/api/pemilik', { cache: 'no-store' })
        const json = await res.json().catch(() => ({} as any))
        const name = String((json as any)?.data?.name || '').trim()
        setPemilikName(name)
        setDibuatOlehName(currentUserName || name || '')
        setDisetujuiOlehName(name || currentUserName || '')
      } catch {
        setPemilikName('')
        setDibuatOlehName(currentUserName || '')
        setDisetujuiOlehName('')
      }
    })()
  }, [currentUserName, gajian?.id, isOpen])

  useEffect(() => {
    if (!isOpen || !gajianProp || isPreview) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/gajian/${gajianProp.id}`, { cache: 'no-store' })
        if (!res.ok) throw new Error('Gagal memuat detail gajian')
        const json = await res.json().catch(() => null)
        if (!cancelled) setGajianFull(json as any)
      } catch {
        if (!cancelled) setGajianFull(null)
      }
    })()
    return () => { cancelled = true }
  }, [gajianProp?.id, isOpen, isPreview])

  useEffect(() => {
    if (!isOpen || !gajian) return
    let cancelled = false
    ;(async () => {
      try {
        const hutangTambahan = Array.isArray((gajian as any).hutangTambahan) ? (gajian as any).hutangTambahan : []
        const userIds = Array.from(new Set([
          ...(gajian.detailKaryawan || []).map((d) => d.userId),
          ...hutangTambahan.map((h: any) => Number(h?.userId)),
        ])).filter((n) => Number.isFinite(n) && Number(n) > 0)
        const res = await fetch(`/api/karyawan-kebun/hutang-saldo?userIds=${encodeURIComponent(userIds.join(','))}`, { cache: 'no-store' })
        const json = await res.json().catch(() => ({} as any))
        const map = (json as any)?.data && typeof (json as any).data === 'object' ? (json as any).data : {}
        if (!cancelled) setHutangSaldoByUserId(map)
      } catch {
        if (!cancelled) setHutangSaldoByUserId({})
      }
    })()
    return () => { cancelled = true }
  }, [gajian?.id, isOpen])

  const dibuatOlehDisplay = (isPreview ? dibuatOlehName : (gajian as any)?.dibuatOlehName) || pemilikName || 'Nama Terang'
  const disetujuiOlehDisplay = (isPreview ? disetujuiOlehName : (gajian as any)?.disetujuiOlehName) || pemilikName || 'Nama Terang'

  const handleExportPdf = async () => {
    if (!gajian || isExporting) return
    setIsExporting(true)
    try {
      const jsPDF = (await import('jspdf')).default
      const autoTable = (await import('jspdf-autotable')).default

      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })

      const primary = [5, 150, 105] as const
      const footerBg = [15, 23, 42] as const
      const headerHeight = 56
      const footerHeight = 24
      const topContentY = headerHeight + 18

      const periodText = `Periode ${formatDate(gajian.tanggalMulai)} S/D ${formatDate(gajian.tanggalSelesai)}`
      const titleText = `Gajian Kebun ${gajian.kebun.name}`
      const noteText = gajian.keterangan ? `Catatan: ${gajian.keterangan}` : ''
      const dibuatOlehText = dibuatOlehDisplay
      const disetujuiOlehText = disetujuiOlehDisplay

      const drawChrome = (pageNumber: number, totalPages: number) => {
        const pageWidth = doc.internal.pageSize.getWidth()
        const pageHeight = doc.internal.pageSize.getHeight()

        doc.setFillColor(primary[0], primary[1], primary[2])
        doc.rect(0, 0, pageWidth, headerHeight, 'F')

        doc.setTextColor(255, 255, 255)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(14)
        doc.text(titleText, 20, 24)

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        doc.text(periodText, 20, 40)

        if (noteText) {
          doc.setFont('helvetica', 'italic')
          doc.setFontSize(9)
          doc.text(noteText, 20, 52, { maxWidth: pageWidth - 40 })
        }

        doc.setFillColor(footerBg[0], footerBg[1], footerBg[2])
        doc.rect(0, pageHeight - footerHeight, pageWidth, footerHeight, 'F')

        doc.setTextColor(255, 255, 255)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.text(`Halaman ${pageNumber} / ${totalPages}`, pageWidth - 20, pageHeight - 8, { align: 'right' })
        doc.text(`Dicetak: ${formatDate(new Date())}`, 20, pageHeight - 8)
      }

      // Table Body
      const tableBody = combinedData.map((item, index) => [
        index + 1,
        item.detail ? formatTanggalNota(item.detail.notaSawit) : '',
        item.detail?.notaSawit?.kendaraanPlatNomor || '',
        item.detail?.notaSawit?.supir?.name || '',
        item.detail ? formatKgNota(item.detail.notaSawit) : '',
        item.detail?.keterangan || '',
        normalizeBoronganJenis(item.biaya?.deskripsi || ''),
        item.biaya?.jumlah ? `${formatNumber(item.biaya.jumlah, 2)} ${item.biaya.satuan || ''}` : '',
        item.biaya?.hargaSatuan ? formatNumber(item.biaya.hargaSatuan) : '',
        item.biaya ? formatNumber(item.biaya.total) : '',
        cleanBiayaKeterangan(item.biaya?.keterangan || ''),
      ])

      // Potongan Rows
      const potonganRows = (gajian.potongan || []).map((item, index) => [
        combinedData.length + index + 1,
        '', '', '', '', '',
        item.deskripsi || '',
        '', '',
        `-${formatNumber(item.total)}`,
        item.keterangan || '',
      ])

      const finalBody = [...tableBody, ...potonganRows]

      // Footer Rows (Total)
      const footerRows = [
        [
          { content: 'JUMLAH', colSpan: 4, styles: { halign: 'center', fontStyle: 'bold' } },
          { content: formatNumber(gajian.totalBerat), styles: { fontStyle: 'bold' } },
          { content: '', colSpan: 1 },
          { content: 'TOTAL', colSpan: 3, styles: { halign: 'center', fontStyle: 'bold' } },
          { content: formatNumber(totalJumlahGaji), styles: { fontStyle: 'bold' } },
          { content: '', colSpan: 1 }
        ],
        [
          { content: '', colSpan: 4 },
          { content: '' },
          { content: '' },
          { content: 'POTONGAN', colSpan: 3, styles: { halign: 'center', fontStyle: 'bold' } },
          { content: formatNumber(totalPotonganAll), styles: { fontStyle: 'bold' } },
          { content: '' }
        ],
        [
          { content: '', colSpan: 4 },
          { content: '' },
          { content: '' },
          { content: 'TOTAL DITERIMA', colSpan: 3, styles: { halign: 'center', fontStyle: 'bold' } },
          { content: formatNumber(totalJumlahGaji - totalPotonganAll), styles: { fontStyle: 'bold' } },
          { content: '' }
        ]
      ]

      autoTable(doc, {
        startY: topContentY,
        head: [[
          'NO', 'TANGGAL BONGKAR', 'NO POLISI', 'SUPIR', 'KG', 'KETERANGAN',
          'JENIS PEKERJAAN', 'JUMLAH TBS/HK', 'GAJI / HK (RP)', 'JUMLAH GAJI (RP)', 'KETERANGAN'
        ]],
        body: finalBody as any,
        foot: footerRows as any,
        showFoot: 'lastPage',
        showHead: 'everyPage',
        theme: 'grid',
        styles: { 
          fontSize: 8, 
          cellPadding: 3, 
          valign: 'middle', 
          halign: 'center', 
          lineColor: [226, 232, 240], 
          lineWidth: 0.5,
          font: 'helvetica',
          textColor: [15, 23, 42]
        },
        headStyles: { 
          fillColor: primary as any, 
          textColor: [255, 255, 255], 
          fontStyle: 'bold', 
          lineWidth: 0.5,
          halign: 'center'
        },
        footStyles: { 
          fillColor: [241, 245, 249], 
          textColor: [15, 23, 42], 
          lineWidth: 0.5 
        },
        bodyStyles: {
          textColor: [15, 23, 42]
        },
        columnStyles: {
          0: { cellWidth: 25 }, // No
          1: { cellWidth: 60 }, // Tanggal
          2: { cellWidth: 60 }, // Plat
          3: { cellWidth: 70 }, // Supir
          4: { cellWidth: 50 }, // Kg
          5: { cellWidth: 80 }, // Keterangan Nota
          6: { cellWidth: 110, halign: 'left' }, // Jenis Pekerjaan
          7: { cellWidth: 70 }, // Jumlah
          8: { cellWidth: 70 }, // Harga
          9: { cellWidth: 70 }, // Total
          10: { cellWidth: 110, halign: 'left' } // Keterangan Biaya
        },
        margin: { top: topContentY, left: 20, right: 20, bottom: footerHeight + 14 },
      })

      if (showApprovalFields) {
        const pageHeight = doc.internal.pageSize.getHeight()
        const pageWidth = doc.internal.pageSize.getWidth()
        const lastY = ((doc as any).lastAutoTable?.finalY as number | undefined) ?? topContentY

        const signatureBlockHeight = 78
        const signatureTop = lastY + 22
        const signatureBottomLimit = pageHeight - footerHeight - 16

        let sigY = signatureTop
        if (signatureTop + signatureBlockHeight > signatureBottomLimit) {
          doc.addPage()
          sigY = topContentY
        }

        const blockWidth = 260
        const lineWidth = 180
        const gap = 60
        const totalWidth = blockWidth * 2 + gap
        const startX = Math.max(20, (pageWidth - totalWidth) / 2)
        const xLeft = startX
        const xRight = startX + blockWidth + gap

        doc.setTextColor(15, 23, 42)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.text('Dibuat Oleh,', xLeft + blockWidth / 2, sigY, { align: 'center' })
        doc.text('Disetujui Oleh,', xRight + blockWidth / 2, sigY, { align: 'center' })

        doc.setDrawColor(15, 23, 42)
        doc.setLineWidth(0.8)
        const lineY = sigY + 50
        const leftLineX1 = xLeft + (blockWidth - lineWidth) / 2
        const leftLineX2 = xLeft + (blockWidth + lineWidth) / 2
        const rightLineX1 = xRight + (blockWidth - lineWidth) / 2
        const rightLineX2 = xRight + (blockWidth + lineWidth) / 2
        doc.line(leftLineX1, lineY, leftLineX2, lineY)
        doc.line(rightLineX1, lineY, rightLineX2, lineY)

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.text(dibuatOlehText, xLeft + blockWidth / 2, lineY + 14, { align: 'center', maxWidth: blockWidth })
        doc.text(disetujuiOlehText, xRight + blockWidth / 2, lineY + 14, { align: 'center', maxWidth: blockWidth })
      }

      const hutangTambahanRows = Array.isArray((gajian as any).hutangTambahan) ? (gajian as any).hutangTambahan : []
      const hutangTambahanMap = new Map<number, { jumlah: number; deskripsi: string }>()
      hutangTambahanRows.forEach((h: any) => {
        const userId = Number(h?.userId)
        const jumlah = Number(h?.jumlah || 0)
        if (!Number.isFinite(userId) || userId <= 0) return
        if (!Number.isFinite(jumlah) || jumlah <= 0) return
        const prev = hutangTambahanMap.get(userId)
        hutangTambahanMap.set(userId, { jumlah: (prev?.jumlah || 0) + jumlah, deskripsi: String(h?.deskripsi || prev?.deskripsi || 'Hutang Karyawan') })
      })

      const hutangAll = (gajian.detailKaryawan || [])
        .map((d: any) => ({
          userId: Number(d.userId),
          name: d.user?.name || '-',
          hutangBaru: Number(hutangTambahanMap.get(Number(d.userId))?.jumlah || 0),
          potong: Number(d.potongan || 0),
          saldoHutang: d.saldoHutang,
          keterangan: (() => {
            const hutangBaru = Number(hutangTambahanMap.get(Number(d.userId))?.jumlah || 0)
            const base = String(hutangTambahanMap.get(Number(d.userId))?.deskripsi || d.keterangan || '')
            if (hutangBaru > 0) return `${base} (Rp ${formatNumber(Math.round(hutangBaru))})`
            return base
          })(),
        }))

      const ensureSaldoMap = async (userIds: number[]) => {
          if (hutangSaldoByUserId && Object.keys(hutangSaldoByUserId).length > 0) return hutangSaldoByUserId
          try {
            const res = await fetch(`/api/karyawan-kebun/hutang-saldo?userIds=${encodeURIComponent(userIds.join(','))}`, { cache: 'no-store' })
            const json = await res.json().catch(() => ({} as any))
            const map = (json as any)?.data && typeof (json as any).data === 'object' ? (json as any).data : {}
            return map as Record<number, number>
          } catch {
            return {} as Record<number, number>
          }
        }

      const hutangUserIds = Array.from(new Set(hutangAll.map((h) => h.userId))).filter((n) => Number.isFinite(n) && n > 0)
      const saldoMap = hutangUserIds.length > 0 ? await ensureSaldoMap(hutangUserIds) : {}
      const hutangList = hutangAll.filter((h) => {
        const currentSaldo = typeof (saldoMap as any)[h.userId] === 'number' ? Number((saldoMap as any)[h.userId]) : null
        const snapshotSaldo = h.saldoHutang ?? currentSaldo ?? 0
        return snapshotSaldo > 0 || Number(h?.potong || 0) > 0 || Number(h?.hutangBaru || 0) > 0
      })

      if (hutangList.length > 0) {
        doc.addPage()

        const pageHeight = doc.internal.pageSize.getHeight()
        const pageWidth = doc.internal.pageSize.getWidth()

        doc.setTextColor(15, 23, 42)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(12)
        doc.text('DAFTAR HUTANG KARYAWAN', 20, topContentY)

        const computedHutangList = hutangList
          .map((h) => {
            const currentSaldo = typeof (saldoMap as any)[h.userId] === 'number' ? Number((saldoMap as any)[h.userId]) : null
            const snapshotSaldo = h.saldoHutang ?? currentSaldo ?? 0
            const saldoBefore = Math.max(0, Math.round(Number(snapshotSaldo) || 0))
            const sisaAfter = Math.max(0, Math.round(saldoBefore + (Number(h.hutangBaru) || 0) - (Number(h.potong) || 0)))
            return { ...h, saldoBefore, sisaAfter }
          })
          .sort((a: any, b: any) => {
            const aNoPotong = (Number(a?.potong || 0) || 0) <= 0
            const bNoPotong = (Number(b?.potong || 0) || 0) <= 0
            if (aNoPotong !== bNoPotong) return aNoPotong ? -1 : 1
            const saldoDiff = Number(b?.saldoBefore || 0) - Number(a?.saldoBefore || 0)
            if (saldoDiff !== 0) return saldoDiff
            return String(a?.name || '').localeCompare(String(b?.name || ''), 'id-ID')
          })

        const hutangRowsPdf = computedHutangList.map((h: any, idx: number) => {
          return [
            idx + 1,
            h.name,
            formatNumber(h.saldoBefore),
            h.hutangBaru > 0 ? formatNumber(h.hutangBaru) : '-',
            formatNumber(h.potong),
            formatNumber(h.sisaAfter),
            h.keterangan || '',
          ]
        })

        const totalSaldoBefore = computedHutangList.reduce((sum: number, h: any) => sum + (Number(h?.saldoBefore) || 0), 0)
        const totalHutangBaru = computedHutangList.reduce((sum: number, h: any) => sum + (Number(h?.hutangBaru) || 0), 0)
        const totalPotong = computedHutangList.reduce((sum: number, h: any) => sum + (Number(h?.potong) || 0), 0)
        const totalSisaAfter = computedHutangList.reduce((sum: number, h: any) => sum + (Number(h?.sisaAfter) || 0), 0)
        const hasSaldoData = computedHutangList.length > 0

        autoTable(doc, {
          startY: topContentY + 16,
          head: [['NO', 'NAMA', 'SALDO', 'HUTANG', 'POTONG', 'SISA', 'KETERANGAN']],
          body: hutangRowsPdf as any,
          foot: [[
            { content: 'TOTAL', colSpan: 2, styles: { halign: 'center', fontStyle: 'bold' } },
            { content: hasSaldoData ? formatNumber(totalSaldoBefore) : '-', styles: { fontStyle: 'bold' } },
            { content: totalHutangBaru > 0 ? formatNumber(totalHutangBaru) : '-', styles: { fontStyle: 'bold' } },
            { content: formatNumber(totalPotong), styles: { fontStyle: 'bold' } },
            { content: hasSaldoData ? formatNumber(totalSisaAfter) : '-', styles: { fontStyle: 'bold' } },
            { content: '', styles: { fontStyle: 'bold' } },
          ]] as any,
          theme: 'grid',
          styles: {
            fontSize: 9,
            cellPadding: 3,
            valign: 'middle',
            lineColor: [226, 232, 240],
            lineWidth: 0.5,
            font: 'helvetica',
            textColor: [15, 23, 42],
          },
          headStyles: {
            fillColor: primary as any,
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            lineWidth: 0.5,
            halign: 'center',
          },
          footStyles: {
            fillColor: [241, 245, 249],
            textColor: [15, 23, 42],
            lineWidth: 0.5,
          },
          columnStyles: {
            0: { cellWidth: 36, halign: 'center' },
            1: { cellWidth: 170 },
            2: { cellWidth: 86, halign: 'right' },
            3: { cellWidth: 86, halign: 'right' },
            4: { cellWidth: 86, halign: 'right' },
            5: { cellWidth: 86, halign: 'right' },
            6: { cellWidth: 'auto' },
          },
          margin: { top: topContentY, left: 20, right: 20, bottom: footerHeight + 14 },
        } as any)

        if (showApprovalFields) {
          const lastY = ((doc as any).lastAutoTable?.finalY as number | undefined) ?? topContentY
          const signatureBlockHeight = 78
          const signatureTop = lastY + 22
          const signatureBottomLimit = pageHeight - footerHeight - 16

          let sigY = signatureTop
          if (signatureTop + signatureBlockHeight > signatureBottomLimit) {
            doc.addPage()
            sigY = topContentY
          }

          const blockWidth = 260
          const lineWidth = 180
          const gap = 60
          const totalWidth = blockWidth * 2 + gap
          const startX = Math.max(20, (pageWidth - totalWidth) / 2)
          const xLeft = startX
          const xRight = startX + blockWidth + gap

          doc.setTextColor(15, 23, 42)
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(10)
          doc.text('Dibuat Oleh,', xLeft + blockWidth / 2, sigY, { align: 'center' })
          doc.text('Disetujui Oleh,', xRight + blockWidth / 2, sigY, { align: 'center' })

          doc.setDrawColor(15, 23, 42)
          doc.setLineWidth(0.8)
          const lineY = sigY + 50
          const leftLineX1 = xLeft + (blockWidth - lineWidth) / 2
          const leftLineX2 = xLeft + (blockWidth + lineWidth) / 2
          const rightLineX1 = xRight + (blockWidth - lineWidth) / 2
          const rightLineX2 = xRight + (blockWidth + lineWidth) / 2
          doc.line(leftLineX1, lineY, leftLineX2, lineY)
          doc.line(rightLineX1, lineY, rightLineX2, lineY)

          doc.setFont('helvetica', 'normal')
          doc.setFontSize(9)
          doc.text(dibuatOlehText, xLeft + blockWidth / 2, lineY + 14, { align: 'center', maxWidth: blockWidth })
          doc.text(disetujuiOlehText, xRight + blockWidth / 2, lineY + 14, { align: 'center', maxWidth: blockWidth })
        }
      }

      if (showApprovalFields && (gajian.detailKaryawan || []).length > 0) {
        doc.addPage()

        doc.setTextColor(15, 23, 42)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(12)
        doc.text('DAFTAR GAJI KARYAWAN', 20, topContentY)

        const rows = (gajian.detailKaryawan || []).map((d: any, idx: number) => {
          const hariKerja = Number(d.hariKerja || 0)
          const gaji = Math.round(Number(d?.gajiPokok || 0))
          const potong = Math.round(Number(d?.potongan || 0))
          const sisa = Math.round(Number(d?.total || (gaji - potong) || 0))
          return [idx + 1, d.user?.name || '-', formatNumber(hariKerja), formatNumber(gaji), formatNumber(potong), formatNumber(sisa)]
        })

        const totalHariKerja = (gajian.detailKaryawan || []).reduce((sum, d: any) => sum + Number(d?.hariKerja || 0), 0)
        const totalGaji = (gajian.detailKaryawan || []).reduce((sum, d: any) => sum + Math.round(Number(d?.gajiPokok || 0)), 0)
        const totalPotong = (gajian.detailKaryawan || []).reduce((sum, d: any) => sum + Math.round(Number(d?.potongan || 0)), 0)
        const totalSisa = (gajian.detailKaryawan || []).reduce(
          (sum, d: any) => sum + Math.round(Number(d?.total || (Number(d?.gajiPokok || 0) - Number(d?.potongan || 0)) || 0)),
          0,
        )

        autoTable(doc, {
          startY: topContentY + 16,
          head: [['NO', 'NAMA', 'HARI KERJA', 'JUMLAH GAJI', 'POTONGAN', 'SISA GAJI']],
          body: rows as any,
          foot: [[
            { content: 'TOTAL', colSpan: 2, styles: { halign: 'center', fontStyle: 'bold' } },
            { content: formatNumber(totalHariKerja), styles: { fontStyle: 'bold', halign: 'right' } },
            { content: formatNumber(totalGaji), styles: { fontStyle: 'bold', halign: 'right' } },
            { content: formatNumber(totalPotong), styles: { fontStyle: 'bold', halign: 'right' } },
            { content: formatNumber(totalSisa), styles: { fontStyle: 'bold', halign: 'right' } },
          ]] as any,
          theme: 'grid',
          styles: {
            fontSize: 9,
            cellPadding: 3,
            valign: 'middle',
            lineColor: [226, 232, 240],
            lineWidth: 0.5,
            font: 'helvetica',
            textColor: [15, 23, 42],
          },
          headStyles: {
            fillColor: primary as any,
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            lineWidth: 0.5,
            halign: 'center',
          },
          footStyles: {
            fillColor: [241, 245, 249],
            textColor: [15, 23, 42],
            lineWidth: 0.5,
          },
          columnStyles: {
            0: { cellWidth: 36, halign: 'center' },
            1: { cellWidth: 220 },
            2: { cellWidth: 86, halign: 'right' },
            3: { cellWidth: 110, halign: 'right' },
            4: { cellWidth: 110, halign: 'right' },
            5: { cellWidth: 110, halign: 'right' },
          },
          margin: { top: topContentY, left: 20, right: 20, bottom: footerHeight + 14 },
        } as any)
      }

      const totalPages = doc.getNumberOfPages()
      for (let page = 1; page <= totalPages; page++) {
        doc.setPage(page)
        drawChrome(page, totalPages)
      }

      const fileName = `Gajian-Periode-${formatDate(gajian.tanggalMulai)}-${formatDate(gajian.tanggalSelesai)}.pdf`.replace(/\s+/g, '-')
      doc.save(fileName)

    } catch (error) {
      console.error('Error generating PDF:', error)
    } finally {
      setIsExporting(false)
    }
  }

  if (!gajian) return null;

  const maxRows = Math.max(gajian.detailGajian.length, gajian.biayaLain.length);
  const combinedData = Array.from({ length: maxRows }).map((_, index) => {
    const detail = gajian.detailGajian[index];
    const biaya = gajian.biayaLain[index];
    return { detail, biaya };
  });

  const totalBiayaLain = (gajian.biayaLain || []).reduce((sum, item) => sum + item.total, 0);
  const totalGajiPokokKaryawan = (gajian.detailKaryawan || []).reduce((sum, item) => sum + (Number((item as any).gajiPokok) || 0), 0)
  const hasSalaryInBiaya = (gajian.biayaLain || []).some((b) => String((b as any)?.deskripsi || '') === 'Total Gaji Karyawan')
  const totalJumlahGaji = totalBiayaLain + (hasSalaryInBiaya ? 0 : totalGajiPokokKaryawan);
  const totalPotongan = (gajian.potongan || []).reduce((sum, item) => sum + item.total, 0);
  const hasAutoPotonganHutang = (gajian.potongan || []).some((p) => String((p as any)?.deskripsi || '') === 'Potongan Hutang Karyawan')
  const hutangTambahanRows = Array.isArray((gajian as any).hutangTambahan) ? (gajian as any).hutangTambahan : []
  const hutangTambahanMap = new Map<number, { jumlah: number; deskripsi: string }>()
  hutangTambahanRows.forEach((h: any) => {
    const userId = Number(h?.userId)
    const jumlah = Number(h?.jumlah || 0)
    if (!Number.isFinite(userId) || userId <= 0) return
    if (!Number.isFinite(jumlah) || jumlah <= 0) return
    const prev = hutangTambahanMap.get(userId)
    hutangTambahanMap.set(userId, { jumlah: (prev?.jumlah || 0) + jumlah, deskripsi: String(h?.deskripsi || prev?.deskripsi || 'Hutang Karyawan') })
  })
  const hutangRows: Array<{ id: number; userId: number; name: string; hutangBaru: number; potong: number; keterangan: string }> = (gajian.detailKaryawan || [])
    .map((d) => ({
      id: d.id,
      userId: d.userId,
      name: d.user?.name || '-',
      hutangBaru: Number(hutangTambahanMap.get(Number(d.userId))?.jumlah || 0),
      potong: Number(d.potongan || 0),
      keterangan: (() => {
        const hutangBaru = Number(hutangTambahanMap.get(Number(d.userId))?.jumlah || 0)
        const base = String(hutangTambahanMap.get(Number(d.userId))?.deskripsi || d.keterangan || '')
        if (hutangBaru > 0) return `${base} (Rp ${formatNumber(Math.round(hutangBaru))})`
        return base
      })(),
    }))
    .filter((d) => {
      const originalDetail = (gajian.detailKaryawan || []).find(x => x.userId === d.userId)
      const currentSaldo = typeof hutangSaldoByUserId[d.userId] === 'number' ? Number(hutangSaldoByUserId[d.userId]) : null
      const snapshotSaldo = originalDetail?.saldoHutang ?? currentSaldo ?? 0
      return Number(d?.potong || 0) > 0 || Number(d?.hutangBaru || 0) > 0 || snapshotSaldo > 0
    })
  const totalPotonganHutang = hutangRows.reduce((sum: number, r) => sum + r.potong, 0)
  const totalHutangBaru = hutangRows.reduce((sum: number, r) => sum + r.hutangBaru, 0)
  const totalPotonganAll = hasAutoPotonganHutang ? totalPotongan : (totalPotongan + totalPotonganHutang)

  const hutangCalculations = hutangRows.map((r) => {
    const d = (gajian.detailKaryawan || []).find(x => x.userId === r.userId)
    const currentSaldo = typeof hutangSaldoByUserId[r.userId] === 'number' ? Number(hutangSaldoByUserId[r.userId]) : null
    const snapshotSaldo = d?.saldoHutang ?? currentSaldo
    
    if (snapshotSaldo === null) return null
    
    const saldoBefore = snapshotSaldo
    const sisaAfter = Math.max(0, snapshotSaldo + r.hutangBaru - r.potong)
    
    return { saldoBefore, sisaAfter }
  })

  const totalSaldoBeforeHutang = hutangCalculations.reduce((sum, v) => sum + (v?.saldoBefore || 0), 0)
  const totalSisaAfterHutang = hutangCalculations.reduce((sum, v) => sum + (v?.sisaAfter || 0), 0)
  const hasSaldoHutangData = hutangCalculations.some(v => v !== null)
  const sortedHutangRows = hutangRows
    .map((r) => {
      const d = (gajian.detailKaryawan || []).find(x => x.userId === r.userId)
      const currentSaldo = typeof hutangSaldoByUserId[r.userId] === 'number' ? Number(hutangSaldoByUserId[r.userId]) : null
      const snapshotSaldo = d?.saldoHutang ?? currentSaldo ?? 0
      const saldoBefore = Math.max(0, Math.round(Number(snapshotSaldo) || 0))
      return { ...r, saldoBefore }
    })
    .sort((a: any, b: any) => {
      const aNoPotong = (Number(a?.potong || 0) || 0) <= 0
      const bNoPotong = (Number(b?.potong || 0) || 0) <= 0
      if (aNoPotong !== bNoPotong) return aNoPotong ? -1 : 1
      const saldoDiff = Number(b?.saldoBefore || 0) - Number(a?.saldoBefore || 0)
      if (saldoDiff !== 0) return saldoDiff
      return String(a?.name || '').localeCompare(String(b?.name || ''), 'id-ID')
    })

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-white w-[98vw] sm:max-w-6xl lg:max-w-7xl max-h-[96vh] p-0 overflow-hidden flex flex-col [&>button.absolute]:hidden">
        <ModalHeader
          title="Detail Gajian"
          subtitle={`Gajian Kebun ${gajian.kebun.name} • Periode ${formatDate(gajian.tanggalMulai)} S/D ${formatDate(gajian.tanggalSelesai)}`}
          variant="emerald"
          icon={<DocumentTextIcon className="h-5 w-5 text-white" />}
          onClose={onClose}
        />
        <div className="flex-1 min-h-0 overflow-y-auto p-6">
          {isPreview && showApprovalFields ? (
            <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="text-xs font-semibold text-gray-700">Dibuat Oleh (Nama Terang)</div>
                <Input value={dibuatOlehName} onChange={(e) => setDibuatOlehName(e.target.value)} className="mt-1 h-10 rounded-xl" />
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-700">Disetujui Oleh (Nama Terang)</div>
                <Input value={disetujuiOlehName} onChange={(e) => setDisetujuiOlehName(e.target.value)} className="mt-1 h-10 rounded-xl" />
              </div>
            </div>
          ) : null}

          <div className="overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <div ref={printRef} className="bg-white p-4 font-mono text-xs min-w-[800px]">
              <div className="text-center mb-4">
            <h1 className="font-bold text-lg">Gajian Kebun {gajian.kebun.name}</h1>
            <p className="text-sm">Periode {formatDate(gajian.tanggalMulai)} S/D {formatDate(gajian.tanggalSelesai)}</p>
            {gajian.keterangan && (
              <p className="text-sm mt-1 italic">Catatan: {gajian.keterangan}</p>
            )}
          </div>
          <table className="w-full border-collapse border border-black text-center">
              <thead>
                <tr className="border border-black">
                  <th className="border border-black p-2 align-middle whitespace-nowrap">NO</th>
                  <th className="border border-black p-2 align-middle whitespace-nowrap">TANGGAL BONGKAR</th>
                  <th className="border border-black p-2 align-middle whitespace-nowrap">NO POLISI</th>
                  <th className="border border-black p-2 align-middle whitespace-nowrap">SUPIR</th>
                  <th className="border border-black p-2 align-middle whitespace-nowrap">KG</th>
                  <th className="border border-black p-2 align-middle whitespace-nowrap">KETERANGAN</th>
                  <th className="border border-black p-2 align-middle whitespace-nowrap text-left">JENIS PEKERJAAN</th>
                  <th className="border border-black p-2 align-middle whitespace-nowrap">JUMLAH TBS/HK</th>
                  <th className="border border-black p-2 align-middle whitespace-nowrap">GAJI / HK (RP)</th>
                  <th className="border border-black p-2 align-middle whitespace-nowrap">JUMLAH GAJI (RP)</th>
                  <th className="border border-black p-2 align-middle whitespace-nowrap">KETERANGAN</th>
                </tr>
              </thead>
              <tbody>
                {combinedData.map((item, index) => (
                  <tr key={index} className="border border-black">
                    <td className="border border-black p-2 align-middle whitespace-nowrap">{index + 1}</td>
                    <td className="border border-black p-2 align-middle whitespace-nowrap">{item.detail ? formatTanggalNota(item.detail.notaSawit) : ''}</td>
                    <td className="border border-black p-2 align-middle whitespace-nowrap">{item.detail?.notaSawit?.kendaraanPlatNomor || ''}</td>
                    <td className="border border-black p-2 align-middle whitespace-nowrap">{item.detail?.notaSawit?.supir?.name || ''}</td>
                    <td className="border border-black p-2 align-middle whitespace-nowrap">{item.detail ? formatKgNota(item.detail.notaSawit) : ''}</td>
                    <td className="border border-black p-2 align-middle whitespace-nowrap">{item.detail?.keterangan || ''}</td>
                    <td className="border border-black p-2 align-middle whitespace-nowrap text-left">{normalizeBoronganJenis(item.biaya?.deskripsi || '')}</td>
                    <td className="border border-black p-2 align-middle whitespace-nowrap">{item.biaya?.jumlah ? `${formatNumber(item.biaya.jumlah, 2)} ${item.biaya.satuan || ''}` : ''}</td>
                    <td className="border border-black p-2 align-middle whitespace-nowrap">{item.biaya?.hargaSatuan ? formatNumber(item.biaya.hargaSatuan) : ''}</td>
                    <td className="border border-black p-2 align-middle whitespace-nowrap">{item.biaya ? formatNumber(item.biaya.total) : ''}</td>
                    <td className="border border-black p-2 align-middle whitespace-nowrap">{cleanBiayaKeterangan(item.biaya?.keterangan || '')}</td>
                  </tr>
                ))}
                {(gajian.potongan || []).map((item, index) => (
                  <tr key={`potongan-${item.id}`} className="border border-black">
                    <td className="border border-black p-2 align-middle whitespace-nowrap">{combinedData.length + index + 1}</td>
                    <td className="border border-black p-2 align-middle whitespace-nowrap">{(item as any).tanggal ? formatDate((item as any).tanggal) : ''}</td>
                    <td className="border border-black p-2 align-middle whitespace-nowrap"></td>
                    <td className="border border-black p-2 align-middle whitespace-nowrap"></td>
                    <td className="border border-black p-2 align-middle whitespace-nowrap"></td>
                    <td className="border border-black p-2 align-middle whitespace-nowrap"></td>
                    <td className="border border-black p-2 align-middle whitespace-nowrap">{item.deskripsi}</td>
                    <td className="border border-black p-2 align-middle whitespace-nowrap"></td>
                    <td className="border border-black p-2 align-middle whitespace-nowrap"></td>
                    <td className="border border-black p-2 align-middle whitespace-nowrap">-{formatNumber(item.total)}</td>
                    <td className="border border-black p-2 align-middle whitespace-nowrap">{item.keterangan || ''}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border border-black font-bold">
                  <td colSpan={4} className="border border-black p-2 text-center align-middle">JUMLAH</td>
                  <td className="border border-black p-2 align-middle">{formatNumber(gajian.totalBerat)}</td>
                  <td className="border border-black p-2 align-middle"></td>
                  <td colSpan={3} className="border border-black p-2 text-center align-middle">TOTAL</td>
                  <td className="border border-black p-2 align-middle">{formatNumber(totalJumlahGaji)}</td>
                  <td className="border border-black p-2 align-middle"></td>
                </tr>
                <tr className="border border-black font-bold">
                  <td colSpan={4} className="border border-black p-2 text-center align-middle"></td>
                  <td className="border border-black p-2 align-middle"></td>
                  <td className="border border-black p-2 align-middle"></td>
                  <td colSpan={3} className="border border-black p-2 text-center align-middle">POTONGAN</td>
                  <td className="border border-black p-2 align-middle">{formatNumber(totalPotonganAll)}</td>
                  <td className="border border-black p-2 align-middle"></td>
                </tr>
                <tr className="border border-black font-bold">
                  <td colSpan={4} className="border border-black p-2 text-center align-middle"></td>
                  <td className="border border-black p-2 align-middle"></td>
                  <td className="border border-black p-2 align-middle"></td>
                  <td colSpan={3} className="border border-black p-2 text-center align-middle">TOTAL DITERIMA</td>
                  <td className="border border-black p-2 align-middle">{formatNumber(totalJumlahGaji - totalPotonganAll)}</td>
                  <td className="border border-black p-2 align-middle"></td>
                </tr>
              </tfoot>
            </table>
            {showApprovalFields ? (
              <div className="mt-8 flex justify-end">
                <div className="w-full flex justify-between gap-8">
                  <div className="w-[260px] text-center">
                    <div className="font-bold">Dibuat Oleh,</div>
                    <div className="h-16" />
                    <div className="w-[180px] mx-auto border-t border-black pt-1">{dibuatOlehDisplay}</div>
                  </div>
                  <div className="w-[260px] text-center">
                    <div className="font-bold">Disetujui Oleh,</div>
                    <div className="h-16" />
                    <div className="w-[180px] mx-auto border-t border-black pt-1">{disetujuiOlehDisplay}</div>
                  </div>
                </div>
              </div>
            ) : null}
            {showApprovalFields && hutangRows.length > 0 ? (
              <div className="mt-6" style={{ pageBreakBefore: 'always' }}>
                <div className="text-center mb-2">
                  <h2 className="font-bold text-sm">DAFTAR HUTANG KARYAWAN</h2>
                </div>
                <table className="w-full border-collapse border border-black text-center">
                  <thead>
                    <tr className="border border-black">
                      <th className="border border-black p-2 align-middle">NO</th>
                      <th className="border border-black p-2 align-middle">NAMA</th>
                      <th className="border border-black p-2 align-middle">SALDO</th>
                      <th className="border border-black p-2 align-middle">HUTANG</th>
                      <th className="border border-black p-2 align-middle">POTONG</th>
                      <th className="border border-black p-2 align-middle">SISA</th>
                      <th className="border border-black p-2 align-middle">KETERANGAN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedHutangRows.map((item: any, index: number) => {
                      const d = (gajian.detailKaryawan || []).find(x => x.userId === item.userId)
                      const currentSaldo = typeof hutangSaldoByUserId[item.userId] === 'number' ? Number(hutangSaldoByUserId[item.userId]) : null
                      
                      // Snapshot from DB (for finalized) or current from API (for draft)
                      const snapshotSaldo = d?.saldoHutang ?? currentSaldo
                      
                      let saldoBefore: number | null = null
                      let sisaAfter: number | null = null

                      if (snapshotSaldo !== null) {
                        if (isPreview) {
                          // In Preview, currentSaldo is BEFORE the transactions
                          saldoBefore = snapshotSaldo
                          sisaAfter = Math.max(0, snapshotSaldo + item.hutangBaru - item.potong)
                        } else {
                          // In Finalized, saldoHutang is the snapshot BEFORE finalization
                          saldoBefore = snapshotSaldo
                          sisaAfter = Math.max(0, snapshotSaldo + item.hutangBaru - item.potong)
                        }
                      }

                      return (
                        <tr key={`potongan-hutang-${item.id}`} className="border border-black">
                          <td className="border border-black p-2 align-middle">{index + 1}</td>
                          <td className="border border-black p-2 align-middle">{item.name}</td>
                          <td className="border border-black p-2 align-middle">{saldoBefore === null ? '-' : formatNumber(Math.round(saldoBefore))}</td>
                          <td className="border border-black p-2 align-middle">{item.hutangBaru > 0 ? formatNumber(Math.round(item.hutangBaru)) : '-'}</td>
                          <td className="border border-black p-2 align-middle">{formatNumber(Math.round(item.potong))}</td>
                          <td className="border border-black p-2 align-middle">{sisaAfter === null ? '-' : formatNumber(Math.round(sisaAfter))}</td>
                          <td className="border border-black p-2 align-middle">{item.keterangan || ''}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border border-black font-bold">
                      <td className="border border-black p-2 align-middle" colSpan={2}>TOTAL</td>
                      <td className="border border-black p-2 align-middle">{hasSaldoHutangData ? formatNumber(totalSaldoBeforeHutang) : '-'}</td>
                      <td className="border border-black p-2 align-middle">{totalHutangBaru > 0 ? formatNumber(totalHutangBaru) : '-'}</td>
                      <td className="border border-black p-2 align-middle">{formatNumber(totalPotonganHutang)}</td>
                      <td className="border border-black p-2 align-middle">{hasSaldoHutangData ? formatNumber(totalSisaAfterHutang) : '-'}</td>
                      <td className="border border-black p-2 align-middle"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : null}
            {showApprovalFields && (gajian.detailKaryawan || []).length > 0 ? (
              <div className="mt-6" style={{ pageBreakBefore: 'always' }}>
                <div className="text-center mb-2">
                  <h2 className="font-bold text-sm">DAFTAR GAJI KARYAWAN</h2>
                </div>
                <table className="w-full border-collapse border border-black text-center">
                  <thead>
                    <tr className="border border-black">
                      <th className="border border-black p-2 align-middle">NO</th>
                      <th className="border border-black p-2 align-middle">NAMA</th>
                      <th className="border border-black p-2 align-middle">HARI KERJA</th>
                      <th className="border border-black p-2 align-middle">JUMLAH GAJI</th>
                      <th className="border border-black p-2 align-middle">POTONGAN</th>
                      <th className="border border-black p-2 align-middle">SISA GAJI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(gajian.detailKaryawan || []).map((d, index) => {
                      const hariKerja = Number(d.hariKerja || 0)
                      const gaji = Math.round(Number((d as any).gajiPokok || 0))
                      const potong = Math.round(Number((d as any).potongan || 0))
                      const sisa = Math.round(Number((d as any).total || (gaji - potong) || 0))
                      return (
                        <tr key={`gaji-karyawan-${d.id}`} className="border border-black">
                          <td className="border border-black p-2 align-middle">{index + 1}</td>
                          <td className="border border-black p-2 align-middle">{d.user?.name || '-'}</td>
                          <td className="border border-black p-2 align-middle">{formatNumber(hariKerja)}</td>
                          <td className="border border-black p-2 align-middle">{formatNumber(gaji)}</td>
                          <td className="border border-black p-2 align-middle">{formatNumber(potong)}</td>
                          <td className="border border-black p-2 align-middle">{formatNumber(sisa)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border border-black font-bold">
                      <td className="border border-black p-2 align-middle" colSpan={2}>TOTAL</td>
                      <td className="border border-black p-2 align-middle">
                        {formatNumber((gajian.detailKaryawan || []).reduce((sum, d) => sum + Number(d.hariKerja || 0), 0))}
                      </td>
                      <td className="border border-black p-2 align-middle">
                        {formatNumber((gajian.detailKaryawan || []).reduce((sum, d: any) => sum + Math.round(Number(d?.gajiPokok || 0)), 0))}
                      </td>
                      <td className="border border-black p-2 align-middle">
                        {formatNumber((gajian.detailKaryawan || []).reduce((sum, d: any) => sum + Math.round(Number(d?.potongan || 0)), 0))}
                      </td>
                      <td className="border border-black p-2 align-middle">
                        {formatNumber((gajian.detailKaryawan || []).reduce((sum, d: any) => sum + Math.round(Number(d?.total || (Number(d?.gajiPokok || 0) - Number(d?.potongan || 0)) || 0)), 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : null}
            </div>
          </div>
        </div>
        <DialogFooter className="flex-shrink-0 border-t bg-white px-6 py-4 pb-[calc(16px+env(safe-area-inset-bottom))] flex flex-row justify-between items-center gap-2">
          <div className="flex gap-2">
            {!isPreview && gajian?.status === 'FINALIZED' && (role === 'ADMIN' || role === 'PEMILIK') && (
              <Button
                variant="outline"
                className="rounded-full border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                onClick={handleRevert}
                disabled={isReverting}
              >
                <ArrowPathIcon className={`w-4 h-4 mr-2 ${isReverting ? 'animate-spin' : ''}`} />
                {isReverting ? 'Memproses...' : 'Batalkan Finalisasi'}
              </Button>
            )}
            {!isPreview && (
              <Button variant="outline" className="rounded-full border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={handleExportPdf} disabled={isExporting}>
                <DocumentArrowDownIcon className="w-4 h-4 mr-2" />
                {isExporting ? 'Memproses PDF...' : 'Download PDF'}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {isPreview ? (
              <>
                <Button variant="outline" className="rounded-full" onClick={onClose} disabled={isLoading}>
                  Kembali
                </Button>
                <Button className="rounded-full bg-emerald-600 hover:bg-emerald-700" onClick={() => onConfirm?.({ dibuatOlehName, disetujuiOlehName })} disabled={isLoading}>
                  {isLoading ? 'Memproses...' : 'Konfirmasi & Simpan'}
                </Button>
              </>
            ) : (
              <Button variant="outline" className="rounded-full" onClick={onClose}>
                Tutup
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
      <ConfirmationModal
        isOpen={isRevertConfirmOpen}
        onClose={() => setIsRevertConfirmOpen(false)}
        onConfirm={handleConfirmRevert}
        title="Konfirmasi Batalkan Finalisasi"
        description="Apakah Anda yakin ingin membatalkan finalisasi gajian ini? Status akan kembali menjadi DRAFT dan relasi ke nota/aktivitas akan dilepas."
        variant="emerald"
        confirmLabel={isReverting ? 'Memproses...' : 'Batalkan'}
        confirmDisabled={isReverting}
      />
    </Dialog>
  );
}
