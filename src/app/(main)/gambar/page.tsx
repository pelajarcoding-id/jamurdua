'use client'

import useSWR from 'swr'
import { useEffect, useMemo, useState, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { XMarkIcon, ArrowDownTrayIcon, CalendarIcon, DocumentTextIcon } from '@heroicons/react/24/outline'
import NextImage from 'next/image'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type ImageItem = {
  id: string
  url: string
  category: string
  label?: string
  createdAt?: string | null
  entity?: string
  entityId?: string
}

const fetcher = (u: string) => fetch(u).then(r => r.json())

export default function GambarGalleryPage() {
  const { data, isLoading } = useSWR<{ data: ImageItem[]; categories: string[] }>('/api/images', fetcher)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<string>('SEMUA')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [open, setOpen] = useState(false)
  const [preview, setPreview] = useState<ImageItem | null>(null)
  const [exporting, setExporting] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [startDate, setStartDate] = useState<Date | undefined>(undefined)
  const [endDate, setEndDate] = useState<Date | undefined>(undefined)
  const [quickRange, setQuickRange] = useState<string>('this_month')

  useEffect(() => {
    const today = new Date()
    const start = new Date(today.getFullYear(), today.getMonth(), 1)
    setStartDate(start)
    setEndDate(today)
  }, [])

  const dateDisplay = useMemo(() => {
    if (quickRange && quickRange !== 'custom') {
      switch (quickRange) {
        case 'today': return 'Hari Ini'
        case 'yesterday': return 'Kemarin'
        case 'last_week': return '7 Hari Terakhir'
        case 'last_30_days': return '30 Hari Terakhir'
        case 'this_month': return 'Bulan Ini'
        default: return 'Pilih Rentang Waktu'
      }
    }
    if (startDate && endDate) {
      return `${format(startDate, 'dd MMM yyyy')} - ${format(endDate, 'dd MMM yyyy')}`
    }
    return 'Pilih Rentang Waktu'
  }, [quickRange, startDate, endDate])

  const applyQuickRange = useCallback((val: string) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    setQuickRange(val)
    if (val === 'today') {
      setStartDate(today)
      setEndDate(today)
    } else if (val === 'yesterday') {
      const y = new Date(today)
      y.setDate(today.getDate() - 1)
      setStartDate(y)
      setEndDate(y)
    } else if (val === 'last_week') {
      const s = new Date(today)
      s.setDate(today.getDate() - 7)
      setStartDate(s)
      setEndDate(today)
    } else if (val === 'last_30_days') {
      const s = new Date(today)
      s.setDate(today.getDate() - 30)
      setStartDate(s)
      setEndDate(today)
    } else if (val === 'this_month') {
      const s = new Date(today.getFullYear(), today.getMonth(), 1)
      setStartDate(s)
      setEndDate(new Date())
    }
  }, [])

  const categories = useMemo(() => ['SEMUA', ...(data?.categories ?? [])], [data?.categories])
  const items = data?.data ?? []

  const filtered = useMemo(() => {
    return items.filter(i => {
      if (cat !== 'SEMUA' && i.category !== cat) return false
      if (q) {
        const s = (i.label || '') + ' ' + i.category + ' ' + (i.entity || '')
        if (!s.toLowerCase().includes(q.toLowerCase())) return false
      }
      if (startDate || endDate) {
        if (!i.createdAt) return false
        const t = Date.parse(i.createdAt)
        if (isNaN(t)) return false
        const d = new Date(t)
        if (startDate && d < new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())) return false
        if (endDate) {
          const to = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999)
          if (d > to) return false
        }
      }
      return true
    })
  }, [items, cat, q, startDate, endDate])

  useEffect(() => {
    setPage(1)
  }, [q, cat, startDate, endDate, perPage])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filtered.length / perPage)), [filtered.length, perPage])
  const paged = useMemo(() => {
    const safePage = Math.min(Math.max(page, 1), totalPages)
    const start = (safePage - 1) * perPage
    return filtered.slice(start, start + perPage)
  }, [filtered, page, perPage, totalPages])

  const handleDownloadPreview = useCallback(async () => {
    if (!preview?.url || downloading) return
    setDownloading(true)
    try {
      const res = await fetch(preview.url, { cache: 'no-store' })
      const blob = await res.blob()
      const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${preview.label || preview.id}.${ext}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      const a = document.createElement('a')
      a.href = preview.url
      a.target = '_blank'
      document.body.appendChild(a)
      a.click()
      a.remove()
    } finally {
      setDownloading(false)
    }
  }, [downloading, preview])

  return (
    <main className="p-4 md:p-8">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold">Galeri Gambar</h1>
      </div>

      <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <Input
              className="input-style"
              placeholder="Cari label/kategori/entitas"
              value={q}
              onChange={e => setQ(e.target.value)}
            />
          </div>
          <div>
            <select className="input-style" value={cat} onChange={e => setCat(e.target.value)}>
              {categories.map(c => (
                <option key={c} value={c}>{c.split('_').join(' ')}</option>        
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant={'outline'}
                  className={cn('w-full justify-start text-left font-normal bg-white', !startDate && 'text-muted-foreground')}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateDisplay}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-4 bg-white" align="start">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h4 className="font-medium leading-none">Rentang Waktu</h4>
                    <p className="text-sm text-muted-foreground">Pilih rentang waktu cepat</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" onClick={() => applyQuickRange('today')} className={quickRange === 'today' ? 'bg-accent' : ''}>Hari Ini</Button>
                    <Button variant="outline" size="sm" onClick={() => applyQuickRange('yesterday')} className={quickRange === 'yesterday' ? 'bg-accent' : ''}>Kemarin</Button>
                    <Button variant="outline" size="sm" onClick={() => applyQuickRange('last_week')} className={quickRange === 'last_week' ? 'bg-accent' : ''}>7 Hari</Button>
                    <Button variant="outline" size="sm" onClick={() => applyQuickRange('last_30_days')} className={quickRange === 'last_30_days' ? 'bg-accent' : ''}>30 Hari</Button>
                    <Button variant="outline" size="sm" onClick={() => applyQuickRange('this_month')} className={quickRange === 'this_month' ? 'bg-accent' : ''}>Bulan Ini</Button>
                  </div>
                  <div className="border-t pt-4 space-y-2">
                    <h4 className="font-medium leading-none">Kustom</h4>
                    <div className="grid gap-2">
                      <div className="grid grid-cols-3 items-center gap-4">
                        <Label htmlFor="start-date" className="text-xs">Dari</Label>
                        <Input
                          id="start-date"
                          type="date"
                          className="col-span-2 h-8"
                          value={startDate ? startDate.toISOString().split('T')[0] : ''}
                          onChange={(e) => {
                            setStartDate(e.target.value ? new Date(e.target.value) : undefined)
                            setQuickRange('custom')
                          }}
                        />
                      </div>
                      <div className="grid grid-cols-3 items-center gap-4">
                        <Label htmlFor="end-date" className="text-xs">Sampai</Label>
                        <Input
                          id="end-date"
                          type="date"
                          className="col-span-2 h-8"
                          value={endDate ? endDate.toISOString().split('T')[0] : ''}
                          onChange={(e) => {
                            setEndDate(e.target.value ? new Date(e.target.value) : undefined)
                            setQuickRange('custom')
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <Button variant="outline" className="rounded-full" onClick={() => { setQ(''); setCat('SEMUA') }}>
              Reset
            </Button>
            <Button className="rounded-full bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 whitespace-nowrap"
              onClick={async () => {
                if (!data?.data || data.data.length === 0) {
                  toast.error('Tidak ada gambar untuk diekspor')
                  return
                }
                try {
                  setExporting(true)
                  toast.loading('Mempersiapkan PDF...', { id: 'export' })
                  const list = filtered
                  const { jsPDF } = await import('jspdf')
                  const pdf = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4', compress: true })
                  const pageW = pdf.internal.pageSize.getWidth()
                  const pageH = pdf.internal.pageSize.getHeight()
                  const margin = 24
                  const loadImage = (url: string) => new Promise<HTMLImageElement>((resolve, reject) => {
                    const im = new window.Image()
                    im.crossOrigin = 'anonymous'
                    im.onload = () => resolve(im)
                    im.onerror = reject
                    im.src = url
                  })
                  for (let i = 0; i < list.length; i++) {
                    const it = list[i]
                    const im = await loadImage(it.url)
                    const canvas = document.createElement('canvas')
                    canvas.width = im.naturalWidth || im.width
                    canvas.height = im.naturalHeight || im.height
                    const ctx = canvas.getContext('2d')!
                    ctx.drawImage(im, 0, 0)
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
                    const iw = canvas.width
                    const ih = canvas.height
                    const scale = Math.min((pageW - margin * 2) / iw, (pageH - margin * 2) / ih)
                    const dw = iw * scale
                    const dh = ih * scale
                    const x = (pageW - dw) / 2
                    const y = (pageH - dh) / 2
                    if (i > 0) pdf.addPage()
                    pdf.addImage(dataUrl, 'JPEG', x, y, dw, dh, undefined, 'FAST')
                    if (it.label || it.category) {
                      pdf.setFontSize(10)
                      pdf.setTextColor(80)
                      const caption = `${it.label || it.id} • ${it.category}`
                      pdf.text(caption, margin, pageH - margin / 2, { baseline: 'bottom' })
                    }
                  }
                  pdf.save(`galeri-${Date.now()}.pdf`)
                  toast.success('PDF berhasil dibuat', { id: 'export' })
                } catch (e) {
                  console.error(e)
                  toast.error('Gagal membuat PDF', { id: 'export' })
                } finally {
                  setExporting(false)
                }
              }}
              disabled={exporting}
            >
              {exporting ? 'Mengekspor...' : 'Export PDF'}
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100">
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="w-full h-32 rounded-xl" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-gray-500 py-12">Tidak ada gambar</div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="text-xs text-gray-600">
                {(() => {
                  const from = (page - 1) * perPage + 1
                  const to = Math.min(filtered.length, page * perPage)
                  return `Menampilkan ${from}-${to} dari ${filtered.length}`
                })()}
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                <select
                  className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm"
                  value={perPage}
                  onChange={(e) => setPerPage(Number(e.target.value))}
                >
                  {[20, 50, 100, 200].map((n) => (
                    <option key={n} value={n}>{n} / halaman</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="h-9 rounded-xl"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Prev
                  </Button>
                  <Button
                    variant="outline"
                    className="h-9 rounded-xl"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {paged.map(img => (
                <div key={img.id} className="space-y-2">
                  <button
                    onClick={() => { setPreview(img); setOpen(true) }}
                    className="block w-full"
                    aria-label="Lihat gambar"
                  >
                    <NextImage
                      src={img.url}
                      alt={img.label || img.id}
                      width={400}
                      height={256}
                      className="w-full h-32 object-cover rounded-xl border border-gray-100"
                      sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 16vw"
                      priority={false}
                      unoptimized
                    />
                  </button>
                  <div className="text-xs text-gray-800 truncate">{img.label || img.id}</div>
                  <div className="text-[10px] text-gray-500">{img.category.split('_').join(' ')}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl p-0 overflow-hidden [&>button.absolute]:hidden">
          <div className="w-full flex items-center justify-between gap-3 px-6 py-4 border-b bg-gradient-to-r from-emerald-600 to-emerald-500 text-white pr-16">
            <div className="min-w-0 flex items-center gap-2">
              <DocumentTextIcon className="h-5 w-5 text-white" />
              <div className="min-w-0">
                <div className="text-white text-base font-semibold">Preview Gambar</div>
                <div className="text-xs text-white/90 truncate">
                  {preview ? `${(preview.label || preview.id)} • ${preview.category.split('_').join(' ')}` : ''}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleDownloadPreview}
                disabled={!preview?.url || downloading}
                className="h-10 w-10 rounded-full border border-white/30 text-white hover:bg-white/10 disabled:opacity-50 inline-flex items-center justify-center"
                aria-label="Download"
                title={downloading ? 'Downloading...' : 'Download'}
              >
                <ArrowDownTrayIcon className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-10 w-10 rounded-full border border-white/30 text-white hover:bg-white/10 inline-flex items-center justify-center"
                aria-label="Tutup"
                title="Tutup"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="flex items-center justify-center bg-black min-h-[50vh]">
            {preview && (
              <div className="relative w-full h-[85vh]">
                <NextImage
                  src={preview.url}
                  alt={preview.label || preview.id}
                  fill
                  className="object-contain"
                  sizes="80vw"
                  priority
                  unoptimized
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </main>
  )
}
