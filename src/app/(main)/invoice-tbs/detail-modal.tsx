
'use client'

import React, { useState } from 'react'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { 
  DocumentTextIcon, 
  XMarkIcon, 
  CalendarIcon, 
  BuildingOffice2Icon,
  BanknotesIcon,
  UserIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
  PencilSquareIcon,
  ArrowUpTrayIcon,
  EllipsisHorizontalIcon,
  ArrowUturnLeftIcon
} from '@heroicons/react/24/outline'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import toast from 'react-hot-toast'

interface InvoiceDetailModalProps {
  isOpen: boolean
  onClose: () => void
  invoice: any | null
  onEdit: (invoice: any) => void
  onUpdated?: (invoice: any) => void
  onDownload: (invoice: any) => void
  initialPdfOpen?: boolean
}

export default function InvoiceDetailModal({ isOpen, onClose, invoice, onEdit, onUpdated, onDownload, initialPdfOpen }: InvoiceDetailModalProps) {
  const [pdfOpen, setPdfOpen] = useState(!!initialPdfOpen)
 
  const formatCurrency = (num: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num)
  const formatNumber = (num: number) => new Intl.NumberFormat('id-ID').format(num)
  const isFinalized = String(invoice?.status || '').toUpperCase() === 'FINALIZED'
  const hasSignedPdf = !!invoice?.signedPdfUrl
  const displayRows = React.useMemo(() => {
    const items = Array.isArray(invoice?.items) ? invoice!.items : []
    const mode = String(invoice?.detailMode || 'per_hari')
    if (mode === 'group_harga') {
      const map = new Map<number, { harga: number; jumlahKg: number; jumlahRp: number }>()
      for (const it of items) {
        const h = Number((it as any).harga || 0)
        const kg = Number((it as any).jumlahKg || 0)
        const rp = Number((it as any).jumlahRp || 0)
        const agg = map.get(h) || { harga: h, jumlahKg: 0, jumlahRp: 0 }
        agg.jumlahKg += kg
        agg.jumlahRp += rp
        map.set(h, agg)
      }
      const periodLabel = format(new Date(invoice!.year, invoice!.month - 1, 1), 'MMMM yyyy', { locale: idLocale })
      return Array.from(map.values()).map(g => ({
        bulanLabel: periodLabel,
        harga: g.harga,
        jumlahKg: g.jumlahKg,
        jumlahRp: g.jumlahRp,
      }))
    } else {
      const map = new Map<string, { bulanLabel: string; jumlahKg: number; harga: number }>()
      for (const it of items) {
        const label = String((it as any).bulanLabel || '-')
        const kg = Number((it as any).jumlahKg || 0)
        const harga = Number((it as any).harga || 0)
        const agg = map.get(label) || { bulanLabel: label, jumlahKg: 0, harga: 0 }
        agg.jumlahKg += kg
        if (!agg.harga) agg.harga = harga
        map.set(label, agg)
      }
      return Array.from(map.values()).map(g => ({
        bulanLabel: g.bulanLabel,
        jumlahKg: g.jumlahKg,
        harga: g.harga,
        jumlahRp: Math.round(g.jumlahKg * g.harga),
      }))
    }
  }, [invoice])

  const historyRows = React.useMemo(() => {
    const hs = Array.isArray((invoice as any)?.histories) ? (invoice as any).histories : []
    return hs
      .slice()
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((h: any) => {
        const action = String(h.action || '')
        const details = h.details || {}
        const status = (details as any)?.status ? String((details as any).status) : null
        const signedPdfUrl = (details as any)?.signedPdfUrl ? String((details as any).signedPdfUrl) : null
        const detailMode = (details as any)?.detailMode ? String((details as any).detailMode) : null
        const summaryParts = [
          status ? `Status: ${status}` : null,
          detailMode ? `Mode: ${detailMode === 'group_harga' ? 'Gabung Harga' : 'Per Hari'}` : null,
          signedPdfUrl ? 'PDF Ttd: diupload' : null,
        ].filter(Boolean)
        return {
          id: h.id,
          action,
          createdAt: h.createdAt,
          summary: summaryParts.join(' • '),
        }
      })
  }, [invoice])
  
  React.useEffect(() => {
    if (isOpen) {
      setPdfOpen(!!initialPdfOpen)
    }
  }, [isOpen, initialPdfOpen])

  if (!invoice) return null
  
  async function handleCancelFinalize() {
    try {
      const res = await fetch(`/api/invoice-tbs/${invoice.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DRAFT' }),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        throw new Error(json.error || 'Gagal membatalkan finalisasi')
      }
      toast.success('Invoice dibatalkan dari finalisasi. Silakan edit data.')
      onEdit(json.data || invoice)
    } catch (e: any) {
      toast.error(e?.message || 'Gagal membatalkan finalisasi')
    }
  }

  async function handleUploadSignedPdf(file: File) {
    if (file.type !== 'application/pdf') {
      toast.error('Harap unggah file PDF')
      return
    }
    const fd = new FormData()
    fd.append('file', file)
    const loadingToast = toast.loading('Mengunggah PDF...')
    try {
      const up = await fetch('/api/upload', { method: 'POST', body: fd })
      const upJson = await up.json()
      if (!up.ok || !upJson.success) throw new Error(upJson.error || 'Upload gagal')
      const put = await fetch(`/api/invoice-tbs/${invoice.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ signedPdfUrl: upJson.url }) })
      const putJson = await put.json()
      if (!put.ok || putJson.error) throw new Error(putJson.error || 'Gagal menyimpan URL PDF')
      toast.success('PDF tertandatangani berhasil diunggah', { id: loadingToast })
      onUpdated?.(putJson.data || { ...invoice, signedPdfUrl: upJson.url })
    } catch (err: any) {
      toast.error(err?.message || 'Gagal mengunggah PDF', { id: loadingToast })
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[92vw] sm:w-auto max-w-4xl max-h-[92vh] p-0 overflow-hidden rounded-2xl shadow-2xl border-none flex flex-col [&>button.absolute]:hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-500 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
                <DocumentTextIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-white text-lg font-bold">Detail Invoice</DialogTitle>
                <p className="text-blue-100 text-xs font-medium">{invoice.number}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <XMarkIcon className="h-5 w-5 text-white" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 min-h-0 overflow-y-auto bg-gray-50/30">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Info Section 1 */}
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-white border border-gray-100 shadow-sm">
                <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 border border-blue-100">
                  {invoice.letterLogoUrl ? (
                    <img 
                      src={`${invoice.letterLogoUrl}?t=${Date.now()}`} 
                      alt="Logo" 
                      className="h-8 w-8 object-contain" 
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = 'https://placehold.co/100x100?text=ERR';
                      }}
                    />
                  ) : (
                    <BuildingOffice2Icon className="h-5 w-5 text-blue-500" />
                  )}
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Perusahaan Penjual (Kop)</p>
                  <p className="text-sm font-bold text-gray-900">{invoice.letterName}</p>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{invoice.letterAddress}</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-3 rounded-xl bg-white border border-gray-100 shadow-sm">
                <CalendarIcon className="h-5 w-5 text-emerald-500 mt-0.5" />
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Periode & Pabrik</p>
                  <p className="text-sm font-bold text-gray-900">
                    {format(new Date(invoice.year, invoice.month - 1, 1), 'MMMM yyyy', { locale: idLocale })}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{invoice.pabrik?.name || '-'}</p>
                </div>
              </div>
            </div>

            {/* Info Section 2 */}
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-white border border-gray-100 shadow-sm">
                <UserIcon className="h-5 w-5 text-purple-500 mt-0.5" />
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Ditujukan Ke</p>
                  <p className="text-sm font-bold text-gray-900">{invoice.tujuan || '-'}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{invoice.lokasiTujuan || '-'}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-white border border-gray-100 shadow-sm">
                <BanknotesIcon className="h-5 w-5 text-amber-500 mt-0.5" />
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Informasi Pembayaran</p>
                  <p className="text-sm font-bold text-gray-900">{invoice.bankInfo || '-'}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{invoice.penandatangan} ({invoice.jabatanTtd})</p>
                </div>
              </div>
            </div>
          </div>

          {/* Table Items */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
              <DocumentTextIcon className="h-4 w-4 text-blue-500" />
              <h4 className="text-xs font-bold text-gray-700 uppercase">Rincian Item</h4>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-[10px] font-bold uppercase py-2">Tanggal/Periode</TableHead>
                    <TableHead className="text-right text-[10px] font-bold uppercase py-2">Kg</TableHead>
                    <TableHead className="text-right text-[10px] font-bold uppercase py-2">Harga</TableHead>
                    <TableHead className="text-right text-[10px] font-bold uppercase py-2">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayRows.map((it: any, idx: number) => (
                    <TableRow key={idx} className="hover:bg-gray-50/50">
                      <TableCell className="text-xs font-semibold py-2">{it.bulanLabel}</TableCell>
                      <TableCell className="text-right text-xs py-2">{formatNumber(it.jumlahKg)}</TableCell>
                      <TableCell className="text-right text-xs py-2">{formatCurrency(it.harga)}</TableCell>
                      <TableCell className="text-right text-xs font-bold text-gray-900 py-2">{formatCurrency(it.jumlahRp)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="p-4 bg-blue-50/50 border-t border-blue-100 grid grid-cols-2 gap-y-2">
              <span className="text-xs text-gray-500">Subtotal:</span>
              <span className="text-xs font-bold text-right text-gray-900">{formatCurrency(invoice.totalRp)}</span>
              <span className="text-xs text-gray-500">PPN ({invoice.ppnPct}%):</span>
              <span className="text-xs font-bold text-right text-gray-900">+{formatCurrency(invoice.totalPpn)}</span>
              <span className="text-xs text-gray-500">PPH 22 ({invoice.pph22Pct}%):</span>
              <span className="text-xs font-bold text-right text-gray-900">-{formatCurrency(invoice.totalPph22)}</span>
              <span className="text-sm font-black text-blue-600 mt-1">GRAND TOTAL:</span>
              <span className="text-sm font-black text-right text-blue-600 mt-1">{formatCurrency(invoice.grandTotal)}</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
              <ArrowPathIcon className="h-4 w-4 text-indigo-600" />
              <h4 className="text-xs font-bold text-gray-700 uppercase">Riwayat</h4>
            </div>
            <div className="divide-y divide-gray-100">
              {historyRows.length === 0 ? (
                <div className="p-4 text-sm text-gray-500">Belum ada riwayat</div>
              ) : (
                historyRows.map((h: any) => (
                  <div key={h.id} className="p-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-black tracking-wider text-gray-800 uppercase">{h.action}</div>
                      {h.summary ? (
                        <div className="text-xs text-gray-500 mt-1 break-words">{h.summary}</div>
                      ) : null}
                    </div>
                    <div className="text-[10px] font-semibold text-gray-400 shrink-0">
                      {h.createdAt ? format(new Date(h.createdAt), 'dd MMM yyyy HH:mm', { locale: idLocale }) : '-'}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="bg-gray-50 border-t px-6 py-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <Button variant="outline" onClick={onClose} className="rounded-xl px-6 w-full sm:w-auto">
            <XMarkIcon className="h-4 w-4 mr-2" />
            Tutup
          </Button>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto sm:justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="rounded-xl px-6 w-full sm:w-auto">
                  <EllipsisHorizontalIcon className="h-4 w-4 mr-2" />
                  Aksi
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>Aksi Invoice</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {!isFinalized && (
                  <DropdownMenuItem onClick={() => onEdit(invoice)} className="cursor-pointer">
                    <PencilSquareIcon className="h-4 w-4 mr-2" />
                    Edit Data
                  </DropdownMenuItem>
                )}
                {isFinalized && (
                  <DropdownMenuItem onClick={handleCancelFinalize} className="cursor-pointer">
                    <ArrowUturnLeftIcon className="h-4 w-4 mr-2" />
                    Batalkan Invoice (Jadi Draft)
                  </DropdownMenuItem>
                )}
                {isFinalized && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild disabled={!hasSignedPdf} onSelect={(e) => { if (!hasSignedPdf) e.preventDefault() }}>
                      <button
                        type="button"
                        className="flex items-center w-full"
                        onClick={() => { if (hasSignedPdf) setPdfOpen(true) }}
                      >
                        <DocumentTextIcon className="h-4 w-4 mr-2" />
                        Lihat PDF Tertandatangani
                      </button>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild onSelect={(e) => e.preventDefault()}>
                      <label className="flex items-center w-full cursor-pointer">
                        <ArrowUpTrayIcon className="h-4 w-4 mr-2" />
                        Upload PDF Tertandatangani
                        <input
                          type="file"
                          accept="application/pdf"
                          className="sr-only"
                          onChange={async (e) => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            await handleUploadSignedPdf(file)
                            e.target.value = ''
                          }}
                        />
                      </label>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button 
              onClick={() => onDownload(invoice)}
              className="rounded-xl px-6 bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto"
            >
              <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
      
      {/* Signed PDF Modal */}
      <Dialog open={pdfOpen} onOpenChange={setPdfOpen}>
        <DialogContent className="w-[92vw] sm:w-auto max-w-5xl max-h-[92vh] p-0 overflow-hidden rounded-2xl shadow-2xl border-none flex flex-col [&>button.absolute]:hidden">
          <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DocumentTextIcon className="h-4 w-4 text-indigo-600" />
              <DialogTitle>PDF Tertandatangani</DialogTitle>
            </div>
            <button
              type="button"
              onClick={() => setPdfOpen(false)}
              className="h-8 w-8 rounded-full border bg-white text-gray-700 flex items-center justify-center hover:bg-gray-100"
              aria-label="Tutup"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
          <div className="p-4 flex-1 min-h-0">
            {hasSignedPdf ? (
              <iframe
                src={invoice.signedPdfUrl}
                className="w-full h-full rounded-lg border"
              />
            ) : (
              <div className="p-6 text-center text-gray-500">Belum ada PDF tertandatangani</div>
            )}
          </div>
          <DialogFooter className="px-4 py-3 border-t bg-gray-50 flex justify-end">
            {hasSignedPdf && (
              <a
                href={invoice.signedPdfUrl}
                download={`Invoice-Tertandatangani-${invoice.number || 'file'}.pdf`}
                className="inline-flex items-center rounded-xl px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700"
              >
                <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                Download PDF
              </a>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
