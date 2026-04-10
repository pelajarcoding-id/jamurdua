'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { BuildingOfficeIcon, DocumentTextIcon, BanknotesIcon, ArrowPathIcon, MapPinIcon, PhoneIcon, EnvelopeIcon, TrashIcon, EyeIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { ModalHeader } from '@/components/ui/modal-elements'

type Perusahaan = {
  id: number
  name: string
  address?: string | null
  email?: string | null
  phone?: string | null
  logoUrl?: string | null
}

type NotaPreview = {
  id: number
  tanggalBongkar: string | null
  supir?: { name: string } | null
  kebunName?: string | null
  beratAkhir: number
  hargaPerKg: number
  totalPembayaran: number
}

type InvoicePreview = {
  id: number
  number: string
  status: string
  year: number
  month: number
  grandTotal: number
  signedPdfUrl?: string | null
  pabrik?: { name?: string } | null
  detailMode?: string | null
}

type PabrikPreview = {
  id: number
  name: string
  address: string | null
  totalNota: number
  totalBerat: number
  totalNilai: number
}

type PerusahaanDocument = {
  id: number
  type: string
  fileName: string
  fileUrl: string
  updatedAt?: string
}

function formatCurrency(val: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val)
}

function labelDocType(type: string) {
  switch (type) {
    case 'NPWP':
      return 'NPWP'
    case 'AKTA_NOTARIS':
      return 'Akta Notaris'
    case 'AKTA_PERUBAHAN':
      return 'Akta Perubahan'
    case 'KTP_DIREKTUR':
      return 'KTP Direktur'
    default:
      return type
  }
}

export default function PerusahaanDetailModal({
  open,
  onClose,
  perusahaan,
}: {
  open: boolean
  onClose: () => void
  perusahaan: Perusahaan | null
}) {
  const [loading, setLoading] = useState(false)
  const [notaList, setNotaList] = useState<NotaPreview[]>([])
  const [invoiceList, setInvoiceList] = useState<InvoicePreview[]>([])
  const [pabrikList, setPabrikList] = useState<PabrikPreview[]>([])
  const [docList, setDocList] = useState<PerusahaanDocument[]>([])
  const [docLoading, setDocLoading] = useState(false)

  const docTypes = useMemo(() => ([
    { type: 'NPWP', accept: 'application/pdf,image/*' },
    { type: 'AKTA_NOTARIS', accept: 'application/pdf,image/*' },
    { type: 'AKTA_PERUBAHAN', accept: 'application/pdf,image/*' },
    { type: 'KTP_DIREKTUR', accept: 'application/pdf,image/*' },
  ]), [])

  const docsByType = useMemo(() => {
    const map = new Map<string, PerusahaanDocument>()
    for (const d of docList) {
      const prev = map.get(d.type)
      if (!prev) {
        map.set(d.type, d)
        continue
      }
      const prevTs = prev.updatedAt ? new Date(prev.updatedAt).getTime() : 0
      const curTs = d.updatedAt ? new Date(d.updatedAt).getTime() : 0
      if (curTs >= prevTs) map.set(d.type, d)
    }
    return map
  }, [docList])

  useEffect(() => {
    if (!open || !perusahaan) return
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const [notaRes, invRes, pabrikRes, docRes] = await Promise.all([
          fetch(`/api/nota-sawit?perusahaanId=${perusahaan!.id}&limit=10`, { cache: 'no-store' }),
          fetch(`/api/invoice-tbs?perusahaanId=${perusahaan!.id}&limit=10`, { cache: 'no-store' }),
          fetch(`/api/pabrik-sawit?perusahaanId=${perusahaan!.id}&limit=10`, { cache: 'no-store' }),
          fetch(`/api/perusahaan/${perusahaan!.id}/documents`, { cache: 'no-store' }),
        ])
        const notaJson = await notaRes.json().catch(() => ({ data: [] }))
        const invJson = await invRes.json().catch(() => ({ data: [] }))
        const pabrikJson = await pabrikRes.json().catch(() => ({ data: [] }))
        const docJson = await docRes.json().catch(() => ({ data: [] }))
        if (cancelled) return
        const list: NotaPreview[] = (notaJson.data || []).map((n: any) => ({
          id: n.id,
          tanggalBongkar: n.tanggalBongkar || null,
          supir: n.supir ? { name: n.supir.name || '-' } : null,
          kebunName: n.timbangan?.kebun?.name || n.kebun?.name || null,
          beratAkhir: Number(n.beratAkhir || 0),
          hargaPerKg: Number(n.hargaPerKg || 0),
          totalPembayaran: Number(n.totalPembayaran || 0),
        }))
        const invoices: InvoicePreview[] = (invJson.data || []).map((inv: any) => ({
          id: inv.id,
          number: String(inv.number || ''),
          status: String(inv.status || ''),
          year: Number(inv.year || 0),
          month: Number(inv.month || 0),
          grandTotal: Number(inv.grandTotal || 0),
          signedPdfUrl: inv.signedPdfUrl || null,
          pabrik: inv.pabrik ? { name: inv.pabrik.name || '-' } : null,
          detailMode: inv.detailMode || null,
        }))
        const pabriks: PabrikPreview[] = (pabrikJson.data || []).map((p: any) => ({
          id: p.id,
          name: String(p.name || ''),
          address: p.address || null,
          totalNota: Number(p.stats?.totalNota || 0),
          totalBerat: Number(p.stats?.totalBerat || 0),
          totalNilai: Number(p.stats?.totalNilai || 0),
        }))
        const docs: PerusahaanDocument[] = (docJson.data || []).map((d: any) => ({
          id: Number(d.id),
          type: String(d.type || ''),
          fileName: String(d.fileName || ''),
          fileUrl: String(d.fileUrl || ''),
          updatedAt: d.updatedAt || null,
        }))
        setNotaList(list)
        setInvoiceList(invoices)
        setPabrikList(pabriks)
        setDocList(docs)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [open, perusahaan])

  if (!perusahaan) return null

  async function handleUploadDoc(type: string, file: File) {
    if (!perusahaan) return
    const fd = new FormData()
    fd.append('file', file)
    const loadingToast = toast.loading('Mengunggah dokumen...')
    setDocLoading(true)
    try {
      const up = await fetch('/api/upload', { method: 'POST', body: fd })
      const upJson = await up.json()
      if (!up.ok || !upJson.success) throw new Error(upJson.error || 'Upload gagal')
      const res = await fetch(`/api/perusahaan/${perusahaan.id}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, fileName: file.name, fileUrl: upJson.url }),
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error || 'Gagal menyimpan dokumen')
      const refreshed = await fetch(`/api/perusahaan/${perusahaan.id}/documents`, { cache: 'no-store' })
      const refreshedJson = await refreshed.json().catch(() => ({ data: [] }))
      setDocList((refreshedJson.data || []).map((d: any) => ({
        id: Number(d.id),
        type: String(d.type || ''),
        fileName: String(d.fileName || ''),
        fileUrl: String(d.fileUrl || ''),
        updatedAt: d.updatedAt || null,
      })))
      toast.success('Dokumen berhasil diunggah', { id: loadingToast })
    } catch (err: any) {
      toast.error(err?.message || 'Gagal mengunggah dokumen', { id: loadingToast })
    } finally {
      setDocLoading(false)
    }
  }

  async function handleDeleteDoc(doc: PerusahaanDocument) {
    if (!perusahaan) return
    const loadingToast = toast.loading('Menghapus dokumen...')
    setDocLoading(true)
    try {
      const res = await fetch(`/api/perusahaan/${perusahaan.id}/documents/${doc.id}`, { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.error) throw new Error(json.error || 'Gagal menghapus dokumen')
      setDocList(prev => prev.filter(d => d.id !== doc.id))
      toast.success('Dokumen dihapus', { id: loadingToast })
    } catch (err: any) {
      toast.error(err?.message || 'Gagal menghapus dokumen', { id: loadingToast })
    } finally {
      setDocLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[92vw] sm:w-auto max-w-4xl max-h-[92vh] p-0 overflow-hidden rounded-2xl shadow-2xl border-none flex flex-col [&>button.absolute]:hidden">
        <ModalHeader
          title="Detail Perusahaan"
          subtitle={perusahaan.name}
          variant="emerald"
          icon={perusahaan.logoUrl ? (
            <img src={`${perusahaan.logoUrl}?t=${Date.now()}`} alt="Logo" className="h-7 w-7 object-contain" />
          ) : (
            <BuildingOfficeIcon className="h-6 w-6 text-white" />
          )}
          onClose={onClose}
        />

        <div className="p-6 space-y-6 flex-1 min-h-0 overflow-y-auto bg-gray-50/30">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BuildingOfficeIcon className="h-4 w-4 text-emerald-600" />
                <h4 className="text-xs font-bold text-gray-700 uppercase">Data Perusahaan</h4>
              </div>
              {loading && <ArrowPathIcon className="h-4 w-4 text-gray-400 animate-spin" />}
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Nama</div>
                <div className="font-semibold text-gray-900 mt-1">{perusahaan.name}</div>
              </div>
              <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                  <EnvelopeIcon className="h-3.5 w-3.5" />
                  Email
                </div>
                <div className="font-semibold text-gray-900 mt-1">{perusahaan.email || '-'}</div>
              </div>
              <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                  <PhoneIcon className="h-3.5 w-3.5" />
                  Telepon
                </div>
                <div className="font-semibold text-gray-900 mt-1">{perusahaan.phone || '-'}</div>
              </div>
              <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                  <MapPinIcon className="h-3.5 w-3.5" />
                  Alamat
                </div>
                <div className="font-semibold text-gray-900 mt-1">{perusahaan.address || '-'}</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DocumentTextIcon className="h-4 w-4 text-emerald-600" />
                <h4 className="text-xs font-bold text-gray-700 uppercase">Dokumen Perusahaan</h4>
              </div>
              {(loading || docLoading) && <ArrowPathIcon className="h-4 w-4 text-gray-400 animate-spin" />}
            </div>
            <div className="p-4 space-y-3">
              {docTypes.map(dt => {
                const doc = docsByType.get(dt.type)
                return (
                  <div key={dt.type} className="rounded-xl border border-gray-100 bg-white p-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[10px] font-black tracking-wider text-gray-500 uppercase">{labelDocType(dt.type)}</div>
                      <div className="text-sm font-semibold text-gray-900 mt-1 truncate">{doc ? doc.fileName : '-'}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {doc ? (
                        <>
                          <a
                            href={doc.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="h-8 w-8 rounded-full border border-gray-200 bg-white text-gray-700 flex items-center justify-center hover:bg-gray-50"
                            aria-label="Lihat dokumen"
                          >
                            <EyeIcon className="h-4 w-4" />
                          </a>
                          <button
                            type="button"
                            onClick={() => handleDeleteDoc(doc)}
                            className="h-8 w-8 rounded-full border border-red-200 bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-100"
                            aria-label="Hapus dokumen"
                            disabled={docLoading}
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </>
                      ) : null}
                      <label className="h-8 w-8 rounded-full border border-amber-200 bg-amber-50 text-amber-700 flex items-center justify-center hover:bg-amber-100 cursor-pointer">
                        <ArrowUpTrayIcon className="h-4 w-4" />
                        <input
                          type="file"
                          accept={dt.accept}
                          className="sr-only"
                          onChange={async (e) => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            await handleUploadDoc(dt.type, file)
                            e.target.value = ''
                          }}
                        />
                      </label>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                <DocumentTextIcon className="h-4 w-4 text-emerald-600" />
                  <h4 className="text-xs font-bold text-gray-700 uppercase">Nota Sawit Terkait</h4>
                </div>
                {loading && <ArrowPathIcon className="h-4 w-4 text-gray-400 animate-spin" />}
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px] uppercase">Tanggal</TableHead>
                      <TableHead className="text-[10px] uppercase">Supir</TableHead>
                      <TableHead className="text-[10px] uppercase">Kebun</TableHead>
                      <TableHead className="text-right text-[10px] uppercase">Berat Akhir</TableHead>
                      <TableHead className="text-right text-[10px] uppercase">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {notaList.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-xs text-gray-500 py-6">Tidak ada data</TableCell>
                      </TableRow>
                    ) : (
                      notaList.map(n => (
                        <TableRow key={n.id}>
                          <TableCell className="text-xs">
                            {n.tanggalBongkar ? new Date(n.tanggalBongkar).toLocaleDateString('id-ID') : '-'}
                          </TableCell>
                          <TableCell className="text-xs">{n.supir?.name || '-'}</TableCell>
                          <TableCell className="text-xs">{n.kebunName || '-'}</TableCell>
                          <TableCell className="text-right text-xs">{n.beratAkhir.toLocaleString('id-ID')} Kg</TableCell>
                          <TableCell className="text-right text-xs font-semibold">{formatCurrency(n.totalPembayaran)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BanknotesIcon className="h-4 w-4 text-emerald-600" />
                  <h4 className="text-xs font-bold text-gray-700 uppercase">Invoice TBS Terkait</h4>
                </div>
                {loading && <ArrowPathIcon className="h-4 w-4 text-gray-400 animate-spin" />}
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px] uppercase">No. Surat</TableHead>
                      <TableHead className="text-[10px] uppercase">Pabrik</TableHead>
                      <TableHead className="text-[10px] uppercase">Periode</TableHead>
                      <TableHead className="text-[10px] uppercase">Status</TableHead>
                      <TableHead className="text-right text-[10px] uppercase">Grand Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoiceList.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-xs text-gray-500 py-6">Tidak ada data</TableCell>
                      </TableRow>
                    ) : (
                      invoiceList.map(inv => (
                        <TableRow key={inv.id}>
                          <TableCell className="text-xs font-medium">{inv.number}</TableCell>
                          <TableCell className="text-xs">{inv.pabrik?.name || '-'}</TableCell>
                          <TableCell className="text-xs">
                            {new Date(inv.year, (inv.month || 1) - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                          </TableCell>
                          <TableCell className="text-xs">{inv.status}</TableCell>
                          <TableCell className="text-right text-xs font-semibold">{formatCurrency(inv.grandTotal)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BuildingOfficeIcon className="h-4 w-4 text-emerald-600" />
                <h4 className="text-xs font-bold text-gray-700 uppercase">Pabrik Terkait</h4>
              </div>
              {loading && <ArrowPathIcon className="h-4 w-4 text-gray-400 animate-spin" />}
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px] uppercase">Nama</TableHead>
                    <TableHead className="text-[10px] uppercase">Alamat</TableHead>
                    <TableHead className="text-right text-[10px] uppercase">Total Nota</TableHead>
                    <TableHead className="text-right text-[10px] uppercase">Total Nilai</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pabrikList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-xs text-gray-500 py-6">Tidak ada data</TableCell>
                    </TableRow>
                  ) : (
                    pabrikList.map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="text-xs font-medium">{p.name}</TableCell>
                        <TableCell className="text-xs">{p.address || '-'}</TableCell>
                        <TableCell className="text-right text-xs">{p.totalNota.toLocaleString('id-ID')}</TableCell>
                        <TableCell className="text-right text-xs font-semibold">{formatCurrency(p.totalNilai)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={onClose} className="rounded-xl">
              Tutup
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
