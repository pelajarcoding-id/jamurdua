'use client';
 
import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
 import { Button } from '@/components/ui/button';
 import { Label } from '@/components/ui/label';
 import { KasTransaksi } from '@/types/kasir';
import { ArrowDownTrayIcon, DocumentTextIcon, PencilSquareIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { ModalContentWrapper, ModalFooter, ModalHeader } from '@/components/ui/modal-elements';
 
 interface DetailTransaksiModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaksi: KasTransaksi | null;
  formatKeterangan?: (ket?: string | null) => string;
  getPerusahaanTags?: (ket?: string | null) => string[];
  onEdit?: (trx: KasTransaksi) => void;
  onDelete?: (trx: KasTransaksi) => void;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value);
};

const formatDate = (value: string) => {
  try {
    const d = new Date(value);
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Jakarta'
    }).format(d);
  } catch {
    return value;
  }
};

const DetailTransaksiModal: React.FC<DetailTransaksiModalProps> = ({ isOpen, onClose, transaksi, formatKeterangan, getPerusahaanTags, onEdit, onDelete }) => {
  const [exporting, setExporting] = useState(false)
  const [buktiOpen, setBuktiOpen] = useState(false)
  const [buktiUrl, setBuktiUrl] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  if (!transaksi) return null;

  // Helper to parse description for PENJUALAN_SAWIT
  const getPenjualanSawitInfo = (desc: string) => {
    if (transaksi.kategori !== 'PENJUALAN_SAWIT') return null;

    // Try newest format first: ... - Supir: Name
    const fullMatch = desc.match(/Penjualan Sawit #\d+ - (.*?) - (.*?) \((.*?)\) - Supir: (.*)/);
    if (fullMatch) {
      return {
        plat: fullMatch[1],
        pabrik: fullMatch[2],
        tglBongkar: fullMatch[3],
        supir: fullMatch[4]
      };
    }
    
    // Try format without Supir
    const mediumMatch = desc.match(/Penjualan Sawit #\d+ - (.*?) - (.*?) \((.*?)\)$/);
    if (mediumMatch) {
      return {
        plat: mediumMatch[1],
        pabrik: mediumMatch[2],
        tglBongkar: mediumMatch[3],
        supir: null
      };
    }

    return null;
  };

  const sawitInfo = getPenjualanSawitInfo(transaksi.deskripsi);
  const keteranganDisplay = formatKeterangan ? formatKeterangan(transaksi.keterangan) : (transaksi.keterangan || '-')
  const perusahaanTags = (getPerusahaanTags ? getPerusahaanTags(transaksi.keterangan) : []).filter(Boolean)
  const tagChips: string[] = []
  if (transaksi.kebun?.name) tagChips.push(`Kebun: ${transaksi.kebun.name}`)
  if (transaksi.kendaraan?.platNomor) tagChips.push(`Kendaraan: ${transaksi.kendaraan.platNomor}`)
  if (transaksi.karyawan?.name) tagChips.push(`Karyawan: ${transaksi.karyawan.name}`)
  for (const p of perusahaanTags) tagChips.push(`Perusahaan: ${p}`)

  const handleExportPdf = async () => {
    if (exporting) return
    setExporting(true)
    try {
      const jsPDF = (await import('jspdf')).default
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

      const pageW = doc.internal.pageSize.getWidth()
      const pageH = doc.internal.pageSize.getHeight()

      const boxW = Math.min(170, pageW - 20)
      const boxH = Math.round(pageH / 3)
      const boxX = (pageW - boxW) / 2
      const boxY = 12

      doc.setDrawColor(200)
      doc.setLineWidth(0.3)
      doc.roundedRect(boxX, boxY, boxW, boxH, 3, 3)

      let y = boxY + 10
      const left = boxX + 8
      const right = boxX + boxW - 8

      doc.setFontSize(13)
      doc.setFont('helvetica', 'bold')
      doc.text('Detail Transaksi Kas', pageW / 2, y, { align: 'center' })
      y += 8

      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')

      const writeRow = (label: string, value: string) => {
        const labelW = 28
        const lines = doc.splitTextToSize(value || '-', right - (left + labelW))
        doc.setFont('helvetica', 'bold')
        doc.text(`${label}`, left, y)
        doc.setFont('helvetica', 'normal')
        doc.text(lines, left + labelW, y)
        y += Math.max(5, lines.length * 4)
      }

      writeRow('Tanggal', formatDate(transaksi.date))
      writeRow('Tipe', transaksi.tipe)
      writeRow('Kategori', transaksi.kategori || 'Umum')
      writeRow('Deskripsi', (sawitInfo ? transaksi.deskripsi.split(' - ')[0] : transaksi.deskripsi) || '-')
      writeRow('Jumlah', formatCurrency(transaksi.jumlah))
      writeRow('Keterangan', keteranganDisplay)
      if (transaksi.kebun?.name) writeRow('Tag Kebun', transaksi.kebun.name)
      if (transaksi.kendaraan?.platNomor || transaksi.kendaraanPlatNomor) writeRow('Tag Kendaraan', transaksi.kendaraan?.platNomor || transaksi.kendaraanPlatNomor || '')
      if (transaksi.karyawan?.name) writeRow('Tag Karyawan', transaksi.karyawan.name)
      if (perusahaanTags.length > 0) writeRow('Tag Perusahaan', perusahaanTags.join(', '))

      if (sawitInfo) {
        writeRow('Pabrik', sawitInfo.pabrik || '-')
        writeRow('Tgl Bongkar', sawitInfo.tglBongkar || '-')
        if (sawitInfo.supir) writeRow('Supir', sawitInfo.supir)
        if (!transaksi.kendaraan) writeRow('Plat', sawitInfo.plat || '-')
      }

      if (transaksi.user?.name) writeRow('Diinput', transaksi.user.name)
      if (transaksi.kebun?.name) writeRow('Kebun', transaksi.kebun.name)
      if (transaksi.kendaraan?.platNomor) writeRow('Kendaraan', `${transaksi.kendaraan.platNomor} - ${transaksi.kendaraan.merk}`)
      if (transaksi.karyawan?.name) writeRow('Karyawan', transaksi.karyawan.name)

      if (transaksi.gambarUrl) {
        try {
          const res = await fetch(transaksi.gambarUrl, { cache: 'no-store' })
          const blob = await res.blob()
          const reader = new FileReader()
          const dataUrl: string = await new Promise(resolve => {
            reader.onload = () => resolve(reader.result as string)
            reader.readAsDataURL(blob)
          })

          const imgW = 42
          const imgH = 42
          const imgX = right - imgW
          const imgY = Math.min(boxY + boxH - imgH - 8, y + 2)
          doc.setFont('helvetica', 'bold')
          doc.text('Bukti', imgX + imgW / 2, imgY - 2, { align: 'center' })
          doc.setFont('helvetica', 'normal')
          const type = String(dataUrl).startsWith('data:image/png') ? 'PNG' : 'JPEG'
          doc.addImage(dataUrl, type, imgX, imgY, imgW, imgH)
        } catch {}
      }

      const safeDate = (() => {
        try {
          const d = new Date(transaksi.date)
          const yyyy = d.getFullYear()
          const mm = String(d.getMonth() + 1).padStart(2, '0')
          const dd = String(d.getDate()).padStart(2, '0')
          return `${yyyy}-${mm}-${dd}`
        } catch {
          return 'tanggal'
        }
      })()

      doc.save(`detail-transaksi-kas-${transaksi.id}-${safeDate}.pdf`)
    } finally {
      setExporting(false)
    }
  }

  const openBukti = (url: string) => {
    setBuktiUrl(url)
    setBuktiOpen(true)
  }

  const handleDownloadBukti = async () => {
    if (!buktiUrl || downloading) return
    setDownloading(true)
    try {
      const res = await fetch(buktiUrl, { cache: 'no-store' })
      const blob = await res.blob()
      const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg'
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.href = url
      link.download = `bukti-transaksi-${transaksi.id}.${ext}`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch {
      const link = document.createElement('a')
      link.href = buktiUrl
      link.target = '_blank'
      document.body.appendChild(link)
      link.click()
      link.remove()
    } finally {
      setDownloading(false)
    }
  }

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden flex flex-col [&>button.absolute]:hidden">
        <ModalHeader
          title="Detail Transaksi Kas"
          variant="emerald"
          icon={<DocumentTextIcon className="h-5 w-5 text-white" />}
          onClose={onClose}
        />
        <ModalContentWrapper className="grid gap-4 flex-1 min-h-0 overflow-y-auto">
          <div className="grid grid-cols-3 items-center gap-2">
            <Label className="text-left">Tanggal</Label>
            <div className="col-span-2">{formatDate(transaksi.date)}</div>
          </div>
          <div className="grid grid-cols-3 items-center gap-2">
            <Label className="text-left">Tipe</Label>
            <div className="col-span-2">{transaksi.tipe}</div>
          </div>
          
          {/* Special display for Sawit Info */}
          {sawitInfo ? (
            <>
                <div className="grid grid-cols-3 items-center gap-2">
                    <Label className="text-left">Deskripsi</Label>
                    <div className="col-span-2">{transaksi.deskripsi.split(' - ')[0]}</div>
                </div>
                <div className="grid grid-cols-3 items-center gap-2">
                    <Label className="text-left">Pabrik</Label>
                    <div className="col-span-2 font-medium">{sawitInfo.pabrik}</div>
                </div>
                <div className="grid grid-cols-3 items-center gap-2">
                    <Label className="text-left">Tgl Bongkar</Label>
                    <div className="col-span-2">{sawitInfo.tglBongkar}</div>
                </div>
                {sawitInfo.supir && (
                    <div className="grid grid-cols-3 items-center gap-2">
                        <Label className="text-left">Supir</Label>
                        <div className="col-span-2">{sawitInfo.supir}</div>
                    </div>
                )}
                 {/* Fallback/Explicit Plat check if not in standard Kendaraan relation */}
                 {!transaksi.kendaraan && (
                    <div className="grid grid-cols-3 items-center gap-2">
                        <Label className="text-left">Plat Nomor</Label>
                        <div className="col-span-2">{sawitInfo.plat}</div>
                    </div>
                )}
            </>
          ) : (
            <div className="grid grid-cols-3 items-center gap-2">
                <Label className="text-left">Deskripsi</Label>
                <div className="col-span-2">{transaksi.deskripsi}</div>
            </div>
          )}

          <div className="grid grid-cols-3 items-center gap-2">
            <Label className="text-left">Jumlah</Label>
            <div className="col-span-2">{formatCurrency(transaksi.jumlah)}</div>
          </div>
          <div className="grid grid-cols-3 items-center gap-2">
            <Label className="text-left">Keterangan</Label>
            <div className="col-span-2">{keteranganDisplay}</div>
          </div>
          <div className="grid grid-cols-3 items-center gap-2">
            <Label className="text-left">Kategori</Label>
            <div className="col-span-2">{transaksi.kategori || 'Umum'}</div>
          </div>
          <div className="grid grid-cols-3 items-start gap-2">
            <Label className="text-left mt-1">Tag</Label>
            <div className="col-span-2">
              {tagChips.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {tagChips.map((t) => (
                    <span key={t} className="px-2 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-semibold">
                      {t}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-500">-</div>
              )}
            </div>
          </div>
          {transaksi.user && (
            <div className="grid grid-cols-3 items-center gap-2">
              <Label className="text-left">Diinput oleh</Label>
              <div className="col-span-2">{transaksi.user.name}</div>
            </div>
          )}
          {transaksi.kebun && (
            <div className="grid grid-cols-3 items-center gap-2">
              <Label className="text-left">Nama Kebun</Label>
              <div className="col-span-2">{transaksi.kebun.name}</div>
            </div>
          )}
          {transaksi.kendaraan && (
            <div className="grid grid-cols-3 items-center gap-2">
              <Label className="text-left">Kendaraan</Label>
              <div className="col-span-2">{transaksi.kendaraan.platNomor} - {transaksi.kendaraan.merk}</div>
            </div>
          )}
          {transaksi.karyawan && (
            <div className="grid grid-cols-3 items-center gap-2">
              <Label className="text-left">Karyawan</Label>
              <div className="col-span-2">{transaksi.karyawan.name}</div>
            </div>
          )}
          {transaksi.gambarUrl && (
            <div className="grid grid-cols-3 items-start gap-2">
              <Label className="text-left">Bukti Foto</Label>
              <div className="col-span-2">
                <button
                  type="button"
                  onClick={() => openBukti(transaksi.gambarUrl as string)}
                  className="inline-flex rounded-md border border-gray-200 overflow-hidden hover:bg-gray-50"
                  aria-label="Lihat bukti foto"
                  title="Klik untuk lihat"
                >
                  <img
                    src={transaksi.gambarUrl}
                    alt="Bukti Transaksi"
                    className="w-48 h-32 object-cover"
                  />
                </button>
              </div>
            </div>
          )}
        </ModalContentWrapper>
        <ModalFooter className="flex-row items-center justify-center sm:justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => { onEdit?.(transaksi) }}
            className="rounded-full border border-emerald-600 bg-emerald-600 hover:bg-emerald-700 hover:border-emerald-700"
            aria-label="Edit"
            title="Edit"
          >
            <PencilSquareIcon className="h-4 w-4 text-white" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => { onDelete?.(transaksi) }}
            className="rounded-full border border-red-600 bg-red-600 hover:bg-red-700 hover:border-red-700"
            aria-label="Hapus"
            title="Hapus"
          >
            <TrashIcon className="h-4 w-4 text-white" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleExportPdf}
            disabled={exporting}
            className="rounded-full border border-emerald-600 bg-emerald-600 hover:bg-emerald-700 hover:border-emerald-700 disabled:opacity-60"
            aria-label="Export PDF"
            title="Export PDF"
          >
            <ArrowDownTrayIcon className="h-4 w-4 text-white" />
          </Button>
        </ModalFooter>
      </DialogContent>
    </Dialog>
    <Dialog
      open={buktiOpen}
      onOpenChange={(v) => {
        setBuktiOpen(v)
        if (!v) setBuktiUrl(null)
      }}
    >
      <DialogContent className="max-w-3xl p-0 overflow-hidden [&>button.absolute]:hidden">
        <div className="w-full flex items-center justify-between gap-3 px-6 py-4 border-b bg-gradient-to-r from-emerald-600 to-emerald-500 text-white pr-16">
          <div className="min-w-0 flex items-center gap-2">
            <DocumentTextIcon className="h-5 w-5 text-white" />
            <div className="min-w-0">
              <div className="text-white text-base font-semibold">Bukti Foto</div>
              <div className="text-xs text-white/90 truncate">Transaksi #{transaksi.id}</div>
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
            <img src={buktiUrl} alt="Bukti" className="max-h-[70vh] w-auto max-w-full object-contain rounded-xl" />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
};
 
 export default DetailTransaksiModal;
