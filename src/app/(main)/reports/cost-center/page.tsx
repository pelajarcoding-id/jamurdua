'use client'

import { useEffect, useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import RoleGate from '@/components/RoleGate';
import { ArchiveBoxIcon, BuildingOfficeIcon, TruckIcon, UsersIcon, ArrowDownTrayIcon, ChevronDownIcon, EyeIcon } from '@heroicons/react/24/outline';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then(res => res.json());

export default function CostCenterPage() {
    const [startDate, setStartDate] = useState(() => {
        const now = new Date()
        const start = new Date(now.getFullYear(), now.getMonth(), 1)
        return start.toISOString().slice(0, 10)
    })
    const [endDate, setEndDate] = useState(() => {
        const now = new Date()
        return now.toISOString().slice(0, 10)
    })
    const [quickRange, setQuickRange] = useState<'today' | 'yesterday' | 'last_week' | 'last_30_days' | 'this_month' | 'this_year' | 'custom'>('this_month')
    const [kebunList, setKebunList] = useState<Array<{ id: number; name: string }>>([]);
    const [kendaraanList, setKendaraanList] = useState<Array<{ platNomor: string; merk: string }>>([]);
    const [perusahaanList, setPerusahaanList] = useState<Array<{ id: number; name: string }>>([]);
    const [selectedKebunId, setSelectedKebunId] = useState<string>('all');
    const [selectedKendaraan, setSelectedKendaraan] = useState<string>('all');
    const [selectedPerusahaanId, setSelectedPerusahaanId] = useState<string>('all');
    const [tab, setTab] = useState<'kebun' | 'perusahaan' | 'kendaraan' | 'gaji'>('kebun');
    const [kendaraanKasPage, setKendaraanKasPage] = useState(1)
    const [kebunKasPage, setKebunKasPage] = useState(1)
    const [perusahaanKasPage, setPerusahaanKasPage] = useState(1)
    const [perusahaanBiayaPage, setPerusahaanBiayaPage] = useState(1)
    const [gajianPage, setGajianPage] = useState(1)
    const pageSize = 20
    const { mutate } = useSWRConfig()
    const periodKey = `${startDate}${endDate ? `-${endDate}` : ''}`

    const applyQuickRange = (val: typeof quickRange) => {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        setQuickRange(val)
        if (val === 'today') {
            const d = today.toISOString().slice(0, 10)
            setStartDate(d)
            setEndDate(d)
        } else if (val === 'yesterday') {
            const y = new Date(today)
            y.setDate(today.getDate() - 1)
            const d = y.toISOString().slice(0, 10)
            setStartDate(d)
            setEndDate(d)
        } else if (val === 'last_week') {
            const s = new Date(today)
            s.setDate(today.getDate() - 6)
            setStartDate(s.toISOString().slice(0, 10))
            setEndDate(today.toISOString().slice(0, 10))
        } else if (val === 'last_30_days') {
            const s = new Date(today)
            s.setDate(today.getDate() - 29)
            setStartDate(s.toISOString().slice(0, 10))
            setEndDate(today.toISOString().slice(0, 10))
        } else if (val === 'this_month') {
            const s = new Date(today.getFullYear(), today.getMonth(), 1)
            setStartDate(s.toISOString().slice(0, 10))
            setEndDate(today.toISOString().slice(0, 10))
        } else if (val === 'this_year') {
            const s = new Date(today.getFullYear(), 0, 1)
            setStartDate(s.toISOString().slice(0, 10))
            setEndDate(today.toISOString().slice(0, 10))
        }
    }

    useEffect(() => {
        const loadFilters = async () => {
            try {
                const res = await fetch('/api/kebun/list');
                const json = await res.json();
                const data = json.data || json;
                setKebunList(Array.isArray(data) ? data : []);
            } catch {
                setKebunList([]);
            }
        };
        const loadKendaraan = async () => {
            try {
                const res = await fetch('/api/kendaraan?limit=500');
                const json = await res.json();
                const data = json.data || json;
                setKendaraanList(Array.isArray(data) ? data : []);
            } catch {
                setKendaraanList([]);
            }
        };
        const loadPerusahaan = async () => {
            try {
                const res = await fetch('/api/perusahaan?limit=500');
                const json = await res.json();
                const data = json.data || json;
                setPerusahaanList(Array.isArray(data) ? data : []);
            } catch {
                setPerusahaanList([]);
            }
        }
        loadFilters();
        loadKendaraan();
        loadPerusahaan();
    }, []);

    useEffect(() => {
        setKendaraanKasPage(1)
        setKebunKasPage(1)
        setPerusahaanKasPage(1)
        setPerusahaanBiayaPage(1)
        setGajianPage(1)
    }, [endDate, selectedKendaraan, selectedKebunId, selectedPerusahaanId, startDate])

    const kendaraanKasParams = new URLSearchParams()
    kendaraanKasParams.set('startDate', startDate)
    kendaraanKasParams.set('endDate', endDate)
    kendaraanKasParams.set('tagScope', 'kendaraan')
    if (selectedKendaraan !== 'all') kendaraanKasParams.set('kendaraanPlatNomor', selectedKendaraan)
    kendaraanKasParams.set('page', String(kendaraanKasPage))
    kendaraanKasParams.set('pageSize', String(pageSize))

    const kebunKasParams = new URLSearchParams()
    kebunKasParams.set('startDate', startDate)
    kebunKasParams.set('endDate', endDate)
    kebunKasParams.set('tagScope', 'kebun')
    if (selectedKebunId !== 'all') kebunKasParams.set('kebunId', selectedKebunId)
    kebunKasParams.set('page', String(kebunKasPage))
    kebunKasParams.set('pageSize', String(pageSize))

    const perusahaanKasParams = new URLSearchParams()
    perusahaanKasParams.set('startDate', startDate)
    perusahaanKasParams.set('endDate', endDate)
    perusahaanKasParams.set('tagScope', 'perusahaan')
    if (selectedPerusahaanId !== 'all') perusahaanKasParams.set('perusahaanId', selectedPerusahaanId)
    perusahaanKasParams.set('page', String(perusahaanKasPage))
    perusahaanKasParams.set('pageSize', String(pageSize))

    const perusahaanBiayaParams = new URLSearchParams()
    perusahaanBiayaParams.set('startDate', startDate)
    perusahaanBiayaParams.set('endDate', endDate)
    if (selectedPerusahaanId !== 'all') perusahaanBiayaParams.set('perusahaanId', selectedPerusahaanId)
    perusahaanBiayaParams.set('page', String(perusahaanBiayaPage))
    perusahaanBiayaParams.set('pageSize', String(pageSize))

    const karyawanGajiParams = new URLSearchParams()
    karyawanGajiParams.set('startDate', startDate)
    karyawanGajiParams.set('endDate', endDate)
    if (selectedKebunId !== 'all') karyawanGajiParams.set('kebunId', selectedKebunId)
    karyawanGajiParams.set('page', String(gajianPage))
    karyawanGajiParams.set('pageSize', String(pageSize))

    const kebunProfitParams = new URLSearchParams()
    kebunProfitParams.set('startDate', startDate)
    kebunProfitParams.set('endDate', endDate)
    if (selectedKebunId !== 'all') kebunProfitParams.set('kebunId', selectedKebunId)

    const { data: kendaraanKasRows, isLoading: loadingKendaraanKas } = useSWR(
        tab === 'kendaraan' ? `/api/reports/cost-center/kas-transaksi?${kendaraanKasParams.toString()}` : null,
        fetcher
    )
    const { data: kebunKasRows, isLoading: loadingKebunKas } = useSWR(
        tab === 'kebun' ? `/api/reports/cost-center/kas-transaksi?${kebunKasParams.toString()}` : null,
        fetcher
    )
    const { data: kebunProfitRows, isLoading: loadingKebunProfit } = useSWR(
        tab === 'kebun' ? `/api/reports/cost-center/by-kebun?${kebunProfitParams.toString()}` : null,
        fetcher
    )
    const { data: perusahaanKasRows, isLoading: loadingPerusahaanKas } = useSWR(
        tab === 'perusahaan' ? `/api/reports/cost-center/kas-transaksi?${perusahaanKasParams.toString()}` : null,
        fetcher
    )
    const { data: perusahaanBiayaRows, isLoading: loadingPerusahaanBiaya } = useSWR(
        tab === 'perusahaan' ? `/api/reports/cost-center/perusahaan-biaya?${perusahaanBiayaParams.toString()}` : null,
        fetcher
    )
    const { data: karyawanGajiRows, isLoading: loadingKaryawanGajiRows } = useSWR(
        tab === 'gaji' ? `/api/reports/cost-center/karyawan-gaji?${karyawanGajiParams.toString()}` : null,
        fetcher
    )
    const buildCsv = (headers: string[], rows: Array<Record<string, any>>) => {
        const esc = (v: any) => {
            if (v === null || v === undefined) return ''
            const s = String(v).replace(/"/g, '""')
            return `"${s}"`
        }
        const lines = []
        lines.push(headers.join(','))
        for (const r of rows) {
            lines.push(headers.map(h => esc(r[h])).join(','))
        }
        const csv = '\ufeff' + lines.join('\r\n')
        return new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    }
    const saveBlob = (blob: Blob, filename: string) => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
    }

    const [exporting, setExporting] = useState<{kendaraan:boolean;kebun:boolean;perusahaan:boolean;perusahaanKas:boolean;gaji:boolean}>({kendaraan:false,kebun:false,perusahaan:false,perusahaanKas:false,gaji:false})
    const [exportMenuOpen, setExportMenuOpen] = useState<{kendaraan:boolean;kebun:boolean;perusahaan:boolean;perusahaanKas:boolean;gaji:boolean}>({kendaraan:false,kebun:false,perusahaan:false,perusahaanKas:false,gaji:false})
    const [buktiOpen, setBuktiOpen] = useState(false)
    const [buktiUrl, setBuktiUrl] = useState<string | null>(null)
    const [profitDetailOpen, setProfitDetailOpen] = useState(false)
    const [profitDetailKebun, setProfitDetailKebun] = useState<{ id: number; name: string } | null>(null)
    const [profitDetailLoading, setProfitDetailLoading] = useState(false)
    const [profitDetailKas, setProfitDetailKas] = useState<any | null>(null)
    const [profitDetailGaji, setProfitDetailGaji] = useState<any | null>(null)
    const [profitDetailIncome, setProfitDetailIncome] = useState<number>(0)
    const [profitDetailExporting, setProfitDetailExporting] = useState(false)

    const handleExportKendaraan = async () => {
        if (exporting.kendaraan) return
        setExporting(s => ({...s, kendaraan: true}))
        try {
            const p = new URLSearchParams()
            p.set('startDate', startDate)
            p.set('endDate', endDate)
            p.set('tagScope', 'kendaraan')
            if (selectedKendaraan !== 'all') p.set('kendaraanPlatNomor', selectedKendaraan)
            p.set('page', '1')
            p.set('pageSize', '10000')
            const res = await fetch(`/api/reports/cost-center/kas-transaksi?${p.toString()}`, { cache: 'no-store' })
            const json = await res.json()
            const rows = (json?.data || []).map((r: any) => ({
                Tanggal: formatDateId(r.date),
                Deskripsi: r.deskripsi || '',
                Keterangan: cleanKeterangan(r.keterangan),
                Sumber: labelSource(r.source),
                Kendaraan: r.kendaraan?.platNomor || r.kendaraanPlatNomor || '',
                Bukti: r.gambarUrl || '',
                Jumlah: r.jumlah,
            }))
            const blob = buildCsv(['Tanggal','Deskripsi','Keterangan','Sumber','Kendaraan','Bukti','Jumlah'], rows)
            const suffix = selectedKendaraan !== 'all' ? `-${selectedKendaraan}` : ''
            saveBlob(blob, `transaksi-kas-kendaraan${suffix}-${periodKey}.csv`)
        } finally {
            setExporting(s => ({...s, kendaraan: false}))
        }
    }

    const handleExportKendaraanPdf = async () => {
        if (exporting.kendaraan) return
        setExporting(s => ({...s, kendaraan: true}))
        try {
            const p = new URLSearchParams()
            p.set('startDate', startDate)
            p.set('endDate', endDate)
            p.set('tagScope', 'kendaraan')
            if (selectedKendaraan !== 'all') p.set('kendaraanPlatNomor', selectedKendaraan)
            p.set('page', '1')
            p.set('pageSize', '10000')
            const res = await fetch(`/api/reports/cost-center/kas-transaksi?${p.toString()}`, { cache: 'no-store' })
            const json = await res.json()
            const dataArr = (json?.data || [])
            const rows = dataArr.map((r: any) => [
                formatDateId(r.date),
                r.deskripsi || '',
                cleanKeterangan(r.keterangan),
                labelSource(r.source),
                r.kendaraan?.platNomor || r.kendaraanPlatNomor || '',
                '', // Bukti (image)
                new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(r.jumlah || 0),
            ])
            const images: (string|null)[] = await (async () => {
                const urls = dataArr.map((r: any) => r.gambarUrl || '')
                const limit = Math.min(urls.length, 50)
                const out: (string|null)[] = new Array(urls.length).fill(null)
                await Promise.all(
                    urls.slice(0, limit).map(async (u: string, idx: number) => {
                        if (!u) return
                        try {
                            const resp = await fetch(u)
                            const blob = await resp.blob()
                            const reader = new FileReader()
                            const dataUrl: string = await new Promise(res => { reader.onload = () => res(reader.result as string); reader.readAsDataURL(blob) })
                            out[idx] = dataUrl
                        } catch {}
                    })
                )
                return out
            })()
            const jsPDF = (await import('jspdf')).default
            const autoTable = (await import('jspdf-autotable')).default
            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
            doc.setFontSize(12)
            doc.text(`Transaksi (Kas + Uang Jalan) Tag Kendaraan - ${periodKey}`, 12, 12)
            autoTable(doc, {
                startY: 18,
                head: [['Tanggal','Deskripsi','Keterangan','Sumber','Kendaraan','Bukti','Jumlah']],
                body: rows,
                styles: { fontSize: 9, cellPadding: 2, valign: 'middle' },
                headStyles: { fillColor: [220,38,38], textColor: 255, fontStyle: 'bold' },
                columnStyles: { 5: { cellWidth: 24, halign: 'center' }, 6: { halign: 'right' } },
                didParseCell: (data: any) => {
                    if (data.section === 'body' && data.column.index === 5) {
                        data.cell.styles.minCellHeight = 16
                    }
                },
                didDrawCell: (data: any) => {
                    if (data.section === 'body' && data.column.index === 5) {
                        const idx = data.row.index
                        const img = images[idx]
                        if (img) {
                            const padding = 1
                            const maxW = Math.max(0, data.cell.width - padding * 2)
                            const maxH = Math.max(0, data.cell.height - padding * 2)
                            const w = Math.min(18, maxW)
                            const h = Math.min(12, maxH)
                            const x = data.cell.x + (data.cell.width - w) / 2
                            const y = data.cell.y + (data.cell.height - h) / 2
                            const type = String(img).startsWith('data:image/png') ? 'PNG' : 'JPEG'
                            doc.addImage(img, type, x, y, w, h)
                        }
                    }
                }
            })
            const suffix = selectedKendaraan !== 'all' ? `-${selectedKendaraan}` : ''
            doc.save(`transaksi-kas-kendaraan${suffix}-${periodKey}.pdf`)
        } finally {
            setExporting(s => ({...s, kendaraan: false}))
        }
    }

    const handleExportKebun = async () => {
        if (exporting.kebun) return
        setExporting(s => ({...s, kebun: true}))
        try {
            const p = new URLSearchParams()
            p.set('startDate', startDate)
            p.set('endDate', endDate)
            p.set('tagScope', 'kebun')
            if (selectedKebunId !== 'all') p.set('kebunId', selectedKebunId)
            p.set('page', '1')
            p.set('pageSize', '10000')
            const res = await fetch(`/api/reports/cost-center/kas-transaksi?${p.toString()}`, { cache: 'no-store' })
            const json = await res.json()
            const rows = (json?.data || []).map((r: any) => ({
                Tanggal: formatDateId(r.date),
                Deskripsi: r.deskripsi || '',
                Keterangan: cleanKeterangan(r.keterangan),
                Sumber: labelSource(r.source),
                Kebun: r.kebun?.name || '',
                Bukti: r.gambarUrl || '',
                Jumlah: r.jumlah,
            }))
            const blob = buildCsv(['Tanggal','Deskripsi','Keterangan','Sumber','Kebun','Bukti','Jumlah'], rows)
            const suffix = selectedKebunId !== 'all' ? `-kebun-${selectedKebunId}` : ''
            saveBlob(blob, `transaksi-kas-kebun${suffix}-${periodKey}.csv`)
        } finally {
            setExporting(s => ({...s, kebun: false}))
        }
    }

    const handleExportKebunPdf = async () => {
        if (exporting.kebun) return
        setExporting(s => ({...s, kebun: true}))
        try {
            const p = new URLSearchParams()
            p.set('startDate', startDate)
            p.set('endDate', endDate)
            p.set('tagScope', 'kebun')
            if (selectedKebunId !== 'all') p.set('kebunId', selectedKebunId)
            p.set('page', '1')
            p.set('pageSize', '10000')
            const res = await fetch(`/api/reports/cost-center/kas-transaksi?${p.toString()}`, { cache: 'no-store' })
            const json = await res.json()
            const dataArr = (json?.data || [])
            const rows = dataArr.map((r: any) => [
                formatDateId(r.date),
                r.deskripsi || '',
                cleanKeterangan(r.keterangan),
                labelSource(r.source),
                r.kebun?.name || '',
                '', // Bukti
                new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(r.jumlah || 0),
            ])
            const images: (string|null)[] = await (async () => {
                const urls = dataArr.map((r: any) => r.gambarUrl || '')
                const limit = Math.min(urls.length, 50)
                const out: (string|null)[] = new Array(urls.length).fill(null)
                await Promise.all(
                    urls.slice(0, limit).map(async (u: string, idx: number) => {
                        if (!u) return
                        try {
                            const resp = await fetch(u)
                            const blob = await resp.blob()
                            const reader = new FileReader()
                            const dataUrl: string = await new Promise(res => { reader.onload = () => res(reader.result as string); reader.readAsDataURL(blob) })
                            out[idx] = dataUrl
                        } catch {}
                    })
                )
                return out
            })()
            const jsPDF = (await import('jspdf')).default
            const autoTable = (await import('jspdf-autotable')).default
            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
            doc.setFontSize(12)
            doc.text(`Transaksi (Kas + Uang Jalan) Tag Kebun - ${periodKey}`, 12, 12)
            autoTable(doc, {
                startY: 18,
                head: [['Tanggal','Deskripsi','Keterangan','Sumber','Kebun','Bukti','Jumlah']],
                body: rows,
                styles: { fontSize: 9, cellPadding: 2, valign: 'middle' },
                headStyles: { fillColor: [220,38,38], textColor: 255, fontStyle: 'bold' },
                columnStyles: { 5: { cellWidth: 24, halign: 'center' }, 6: { halign: 'right' } },
                didParseCell: (data: any) => {
                    if (data.section === 'body' && data.column.index === 5) {
                        data.cell.styles.minCellHeight = 16
                    }
                },
                didDrawCell: (data: any) => {
                    if (data.section === 'body' && data.column.index === 5) {
                        const idx = data.row.index
                        const img = images[idx]
                        if (img) {
                            const padding = 1
                            const maxW = Math.max(0, data.cell.width - padding * 2)
                            const maxH = Math.max(0, data.cell.height - padding * 2)
                            const w = Math.min(18, maxW)
                            const h = Math.min(12, maxH)
                            const x = data.cell.x + (data.cell.width - w) / 2
                            const y = data.cell.y + (data.cell.height - h) / 2
                            const type = String(img).startsWith('data:image/png') ? 'PNG' : 'JPEG'
                            doc.addImage(img, type, x, y, w, h)
                        }
                    }
                }
            })
            const suffix = selectedKebunId !== 'all' ? `-kebun-${selectedKebunId}` : ''
            doc.save(`transaksi-kas-kebun${suffix}-${periodKey}.pdf`)
        } finally {
            setExporting(s => ({...s, kebun: false}))
        }
    }

    const handleExportPerusahaan = async () => {
        if (exporting.perusahaan) return
        setExporting(s => ({...s, perusahaan: true}))
        try {
            const p = new URLSearchParams()
            p.set('startDate', startDate)
            p.set('endDate', endDate)
            if (selectedPerusahaanId !== 'all') p.set('perusahaanId', selectedPerusahaanId)
            p.set('page', '1')
            p.set('pageSize', '10000')
            const res = await fetch(`/api/reports/cost-center/perusahaan-biaya?${p.toString()}`, { cache: 'no-store' })
            const json = await res.json()
            const rows = (json?.data || []).map((r: any) => ({
                Tanggal: formatDateId(r.date),
                Perusahaan: r.perusahaan?.name || `Perusahaan #${r.perusahaanId}`,
                Kategori: r.kategori || 'UMUM',
                Deskripsi: r.deskripsi || '',
                Bukti: r.gambarUrl || '',
                Jumlah: r.jumlah,
            }))
            const blob = buildCsv(['Tanggal','Perusahaan','Kategori','Deskripsi','Bukti','Jumlah'], rows)
            const suffix = selectedPerusahaanId !== 'all' ? `-perusahaan-${selectedPerusahaanId}` : ''
            saveBlob(blob, `biaya-perusahaan${suffix}-${periodKey}.csv`)
        } finally {
            setExporting(s => ({...s, perusahaan: false}))
        }
    }

    const handleExportPerusahaanKas = async () => {
        if (exporting.perusahaanKas) return
        setExporting(s => ({...s, perusahaanKas: true}))
        try {
            const p = new URLSearchParams()
            p.set('startDate', startDate)
            p.set('endDate', endDate)
            p.set('tagScope', 'perusahaan')
            if (selectedPerusahaanId !== 'all') p.set('perusahaanId', selectedPerusahaanId)
            p.set('page', '1')
            p.set('pageSize', '10000')
            const res = await fetch(`/api/reports/cost-center/kas-transaksi?${p.toString()}`, { cache: 'no-store' })
            const json = await res.json()
            const rows = (json?.data || []).map((r: any) => ({
                Tanggal: formatDateId(r.date),
                Deskripsi: r.deskripsi || '',
                Keterangan: cleanKeterangan(r.keterangan),
                Sumber: labelSource(r.source),
                Perusahaan: extractPerusahaanName(r.keterangan),
                Bukti: r.gambarUrl || '',
                Jumlah: r.jumlah,
            }))
            const blob = buildCsv(['Tanggal','Deskripsi','Keterangan','Sumber','Perusahaan','Bukti','Jumlah'], rows)
            const suffix = selectedPerusahaanId !== 'all' ? `-perusahaan-${selectedPerusahaanId}` : ''
            saveBlob(blob, `transaksi-kas-perusahaan${suffix}-${periodKey}.csv`)
        } finally {
            setExporting(s => ({...s, perusahaanKas: false}))
        }
    }

    const handleExportPerusahaanKasPdf = async () => {
        if (exporting.perusahaanKas) return
        setExporting(s => ({...s, perusahaanKas: true}))
        try {
            const p = new URLSearchParams()
            p.set('startDate', startDate)
            p.set('endDate', endDate)
            p.set('tagScope', 'perusahaan')
            if (selectedPerusahaanId !== 'all') p.set('perusahaanId', selectedPerusahaanId)
            p.set('page', '1')
            p.set('pageSize', '10000')
            const res = await fetch(`/api/reports/cost-center/kas-transaksi?${p.toString()}`, { cache: 'no-store' })
            const json = await res.json()
            const dataArr = (json?.data || [])
            const rows = dataArr.map((r: any) => [
                formatDateId(r.date),
                r.deskripsi || '',
                cleanKeterangan(r.keterangan),
                labelSource(r.source),
                extractPerusahaanName(r.keterangan),
                '', // Bukti
                new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(r.jumlah || 0),
            ])
            const images: (string|null)[] = await (async () => {
                const urls = dataArr.map((r: any) => r.gambarUrl || '')
                const limit = Math.min(urls.length, 50)
                const out: (string|null)[] = new Array(urls.length).fill(null)
                await Promise.all(
                    urls.slice(0, limit).map(async (u: string, idx: number) => {
                        if (!u) return
                        try {
                            const resp = await fetch(u)
                            const blob = await resp.blob()
                            const reader = new FileReader()
                            const dataUrl: string = await new Promise(res => { reader.onload = () => res(reader.result as string); reader.readAsDataURL(blob) })
                            out[idx] = dataUrl
                        } catch {}
                    })
                )
                return out
            })()
            const jsPDF = (await import('jspdf')).default
            const autoTable = (await import('jspdf-autotable')).default
            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
            doc.setFontSize(12)
            doc.text(`Transaksi (Kas + Uang Jalan) Tag Perusahaan - ${periodKey}`, 12, 12)
            autoTable(doc, {
                startY: 18,
                head: [['Tanggal','Deskripsi','Keterangan','Sumber','Perusahaan','Bukti','Jumlah']],
                body: rows,
                styles: { fontSize: 9, cellPadding: 2, valign: 'middle' },
                headStyles: { fillColor: [220,38,38], textColor: 255, fontStyle: 'bold' },
                columnStyles: { 5: { cellWidth: 24, halign: 'center' }, 6: { halign: 'right' } },
                didParseCell: (data: any) => {
                    if (data.section === 'body' && data.column.index === 5) {
                        data.cell.styles.minCellHeight = 16
                    }
                },
                didDrawCell: (data: any) => {
                    if (data.section === 'body' && data.column.index === 5) {
                        const idx = data.row.index
                        const img = images[idx]
                        if (img) {
                            const padding = 1
                            const maxW = Math.max(0, data.cell.width - padding * 2)
                            const maxH = Math.max(0, data.cell.height - padding * 2)
                            const w = Math.min(18, maxW)
                            const h = Math.min(12, maxH)
                            const x = data.cell.x + (data.cell.width - w) / 2
                            const y = data.cell.y + (data.cell.height - h) / 2
                            const type = String(img).startsWith('data:image/png') ? 'PNG' : 'JPEG'
                            doc.addImage(img, type, x, y, w, h)
                        }
                    }
                }
            })
            const suffix = selectedPerusahaanId !== 'all' ? `-perusahaan-${selectedPerusahaanId}` : ''
            doc.save(`transaksi-kas-perusahaan${suffix}-${periodKey}.pdf`)
        } finally {
            setExporting(s => ({...s, perusahaanKas: false}))
        }
    }

    const handleExportPerusahaanPdf = async () => {
        if (exporting.perusahaan) return
        setExporting(s => ({...s, perusahaan: true}))
        try {
            const p = new URLSearchParams()
            p.set('startDate', startDate)
            p.set('endDate', endDate)
            if (selectedPerusahaanId !== 'all') p.set('perusahaanId', selectedPerusahaanId)
            p.set('page', '1')
            p.set('pageSize', '10000')
            const res = await fetch(`/api/reports/cost-center/perusahaan-biaya?${p.toString()}`, { cache: 'no-store' })
            const json = await res.json()
            const dataArr = (json?.data || [])
            const rows = dataArr.map((r: any) => [
                formatDateId(r.date),
                r.perusahaan?.name || `Perusahaan #${r.perusahaanId}`,
                r.kategori || 'UMUM',
                r.deskripsi || '',
                '', // Bukti
                new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(r.jumlah || 0),
            ])
            const images: (string|null)[] = await (async () => {
                const urls = dataArr.map((r: any) => r.gambarUrl || '')
                const limit = Math.min(urls.length, 50)
                const out: (string|null)[] = new Array(urls.length).fill(null)
                await Promise.all(
                    urls.slice(0, limit).map(async (u: string, idx: number) => {
                        if (!u) return
                        try {
                            const resp = await fetch(u)
                            const blob = await resp.blob()
                            const reader = new FileReader()
                            const dataUrl: string = await new Promise(res => { reader.onload = () => res(reader.result as string); reader.readAsDataURL(blob) })
                            out[idx] = dataUrl
                        } catch {}
                    })
                )
                return out
            })()
            const jsPDF = (await import('jspdf')).default
            const autoTable = (await import('jspdf-autotable')).default
            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
            doc.setFontSize(12)
            doc.text(`Biaya Manual Perusahaan - ${periodKey}`, 12, 12)
            autoTable(doc, {
                startY: 18,
                head: [['Tanggal','Perusahaan','Kategori','Deskripsi','Bukti','Jumlah']],
                body: rows,
                styles: { fontSize: 9, cellPadding: 2, valign: 'middle' },
                headStyles: { fillColor: [220,38,38], textColor: 255, fontStyle: 'bold' },
                columnStyles: { 4: { cellWidth: 24, halign: 'center' }, 5: { halign: 'right' } },
                didParseCell: (data: any) => {
                    if (data.section === 'body' && data.column.index === 4) {
                        data.cell.styles.minCellHeight = 16
                    }
                },
                didDrawCell: (data: any) => {
                    if (data.section === 'body' && data.column.index === 4) {
                        const idx = data.row.index
                        const img = images[idx]
                        if (img) {
                            const padding = 1
                            const maxW = Math.max(0, data.cell.width - padding * 2)
                            const maxH = Math.max(0, data.cell.height - padding * 2)
                            const w = Math.min(18, maxW)
                            const h = Math.min(12, maxH)
                            const x = data.cell.x + (data.cell.width - w) / 2
                            const y = data.cell.y + (data.cell.height - h) / 2
                            const type = String(img).startsWith('data:image/png') ? 'PNG' : 'JPEG'
                            doc.addImage(img, type, x, y, w, h)
                        }
                    }
                }
            })
            const suffix = selectedPerusahaanId !== 'all' ? `-perusahaan-${selectedPerusahaanId}` : ''
            doc.save(`biaya-perusahaan${suffix}-${periodKey}.pdf`)
        } finally {
            setExporting(s => ({...s, perusahaan: false}))
        }
    }

    const handleExportGajian = async () => {
        if (exporting.gaji) return
        setExporting(s => ({...s, gaji: true}))
        try {
            const p = new URLSearchParams()
            p.set('startDate', startDate)
            p.set('endDate', endDate)
            if (selectedKebunId !== 'all') p.set('kebunId', selectedKebunId)
            p.set('page', '1')
            p.set('pageSize', '10000')
            const res = await fetch(`/api/reports/cost-center/karyawan-gaji?${p.toString()}`, { cache: 'no-store' })
            const json = await res.json()
            const rows = (json?.data || []).map((r: any) => ({
                Karyawan: r.karyawanName || `Karyawan #${r.karyawanId}`,
                'Gaji Berjalan': Number(r.gajiBerjalan || 0),
                'Gaji Dibayar': Number(r.gajiDibayar || 0),
                Total: Number(r.total || 0),
            }))
            const blob = buildCsv(['Karyawan','Gaji Berjalan','Gaji Dibayar','Total'], rows)
            const suffix = selectedKebunId !== 'all' ? `-kebun-${selectedKebunId}` : ''
            saveBlob(blob, `biaya-gaji-karyawan${suffix}-${periodKey}.csv`)
        } finally {
            setExporting(s => ({...s, gaji: false}))
        }
    }

    const handleExportGajianPdf = async () => {
        if (exporting.gaji) return
        setExporting(s => ({...s, gaji: true}))
        try {
            const p = new URLSearchParams()
            p.set('startDate', startDate)
            p.set('endDate', endDate)
            if (selectedKebunId !== 'all') p.set('kebunId', selectedKebunId)
            p.set('page', '1')
            p.set('pageSize', '10000')
            const res = await fetch(`/api/reports/cost-center/karyawan-gaji?${p.toString()}`, { cache: 'no-store' })
            const json = await res.json()
            const rows = (json?.data || []).map((r: any) => ([
                r.karyawanName || `Karyawan #${r.karyawanId}`,
                new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(Number(r.gajiBerjalan || 0)),
                new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(Number(r.gajiDibayar || 0)),
                new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(Number(r.total || 0)),
            ]))
            const jsPDF = (await import('jspdf')).default
            const autoTable = (await import('jspdf-autotable')).default
            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
            doc.setFontSize(12)
            doc.text(`Biaya Gaji Karyawan - ${periodKey}`, 12, 12)
            autoTable(doc, {
                startY: 18,
                head: [['Karyawan','Gaji Berjalan','Gaji Dibayar','Total']],
                body: rows,
                styles: { fontSize: 9, cellPadding: 2 },
                headStyles: { fillColor: [5, 150, 105], textColor: 255, fontStyle: 'bold' },
                columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
            })
            const suffix = selectedKebunId !== 'all' ? `-kebun-${selectedKebunId}` : ''
            doc.save(`biaya-gaji-karyawan${suffix}-${periodKey}.pdf`)
        } finally {
            setExporting(s => ({...s, gaji: false}))
        }
    }

    const formatCurrency = (value: number) => 
        new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
    const formatDateId = (value: string | Date) => {
        try {
            return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
        } catch {
            return String(value)
        }
    }
    const daysInRangeInclusive = (start: string, end: string) => {
        const s = new Date(`${start}T00:00:00`)
        const e = new Date(`${end}T00:00:00`)
        if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 1
        const diff = Math.floor((e.getTime() - s.getTime()) / (24 * 60 * 60 * 1000))
        return Math.max(1, diff + 1)
    }
    const formatPaginationInfo = (meta: any) => {
        if (!meta) return ''
        const from = (meta.page - 1) * meta.pageSize + 1
        const to = Math.min(meta.totalItems, meta.page * meta.pageSize)
        if (meta.totalItems === 0) return '0 data'
        return `${from}-${to} dari ${meta.totalItems}`
    }
    const openBukti = (url: string) => {
        setBuktiUrl(url)
        setBuktiOpen(true)
    }

    const handleDownloadBukti = async () => {
        if (!buktiUrl) return
        try {
            const res = await fetch(buktiUrl, { cache: 'no-store' })
            const blob = await res.blob()
            const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg'
            saveBlob(blob, `bukti-${periodKey}.${ext}`)
        } catch {
            const a = document.createElement('a')
            a.href = buktiUrl
            a.download = `bukti-${periodKey}`
            document.body.appendChild(a)
            a.click()
            a.remove()
        }
    }

    const openProfitDetail = async (row: any) => {
        const kebunId = Number(row?.kebunId)
        if (!kebunId) return
        setProfitDetailOpen(true)
        setProfitDetailKebun({ id: kebunId, name: String(row?.kebunName || `Kebun #${kebunId}`) })
        setProfitDetailIncome(Number(row?.income || 0))
        setProfitDetailLoading(true)
        try {
            const kasParams = new URLSearchParams()
            kasParams.set('startDate', startDate)
            kasParams.set('endDate', endDate)
            kasParams.set('tagScope', 'kebun')
            kasParams.set('kebunId', String(kebunId))
            kasParams.set('page', '1')
            kasParams.set('pageSize', '200')

            const gajiParams = new URLSearchParams()
            gajiParams.set('startDate', startDate)
            gajiParams.set('endDate', endDate)
            gajiParams.set('kebunId', String(kebunId))
            gajiParams.set('page', '1')
            gajiParams.set('pageSize', '200')

            const [kasRes, gajiRes] = await Promise.all([
                fetch(`/api/reports/cost-center/kas-transaksi?${kasParams.toString()}`, { cache: 'no-store' }),
                fetch(`/api/reports/cost-center/gajian-records?${gajiParams.toString()}`, { cache: 'no-store' }),
            ])
            const kasJson = await kasRes.json().catch(() => null)
            const gajiJson = await gajiRes.json().catch(() => null)
            setProfitDetailKas(kasJson)
            setProfitDetailGaji(gajiJson)
        } finally {
            setProfitDetailLoading(false)
        }
    }

    const handleExportProfitDetailPdf = async () => {
        if (profitDetailExporting) return
        if (!profitDetailKebun) return
        setProfitDetailExporting(true)
        try {
            const jsPDF = (await import('jspdf')).default
            const autoTable = (await import('jspdf-autotable')).default
            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

            const title = `Detail Profit Kebun`
            const subtitle = `${profitDetailKebun.name} • ${startDate} s/d ${endDate}`
            const income = Number(profitDetailIncome || 0)
            const totalKas = Number(profitDetailKas?.meta?.totalJumlah || 0)
            const totalGaji = Number(profitDetailGaji?.meta?.totalJumlah || 0)
            const totalBiaya = totalKas + totalGaji
            const profit = income - totalBiaya

            doc.setFontSize(13)
            doc.text(title, 12, 12)
            doc.setFontSize(10)
            doc.text(subtitle, 12, 18)
            doc.setFontSize(10)
            doc.text(`Pendapatan: ${formatCurrency(income)}`, 12, 25)
            doc.text(`Total Biaya Kas: ${formatCurrency(totalKas)}`, 12, 30)
            doc.text(`Total Biaya Gaji: ${formatCurrency(totalGaji)}`, 12, 35)
            doc.text(`Total Biaya: ${formatCurrency(totalBiaya)}`, 12, 40)
            doc.text(`Profit: ${formatCurrency(profit)}`, 12, 45)

            const kasRows = (profitDetailKas?.data || []).map((r: any) => [
                formatDateId(r.date),
                String(r.deskripsi || ''),
                cleanKeterangan(r.keterangan),
                formatCurrency(Number(r.jumlah || 0)),
            ])

            autoTable(doc, {
                startY: 52,
                head: [['Tanggal', 'Deskripsi', 'Keterangan', 'Jumlah']],
                body: kasRows,
                styles: { fontSize: 9, cellPadding: 2, valign: 'middle' },
                headStyles: { fillColor: [5, 150, 105], textColor: 255, fontStyle: 'bold' },
                columnStyles: { 3: { halign: 'right' } },
            })

            const yAfterKas = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 8 : 50

            doc.setFontSize(11)
            doc.text('Biaya Gaji', 12, yAfterKas)

            const gajiRows = (profitDetailGaji?.data || []).map((g: any) => [
                `${formatDateId(g.tanggalMulai)} - ${formatDateId(g.tanggalSelesai)}`,
                formatCurrency(Number(g.totalGaji || 0)),
            ])

            autoTable(doc, {
                startY: yAfterKas + 4,
                head: [['Periode', 'Total']],
                body: gajiRows,
                styles: { fontSize: 9, cellPadding: 2, valign: 'middle' },
                headStyles: { fillColor: [5, 150, 105], textColor: 255, fontStyle: 'bold' },
                columnStyles: { 1: { halign: 'right' } },
            })

            const safeName = String(profitDetailKebun.name || `kebun-${profitDetailKebun.id}`).replace(/[^\w.-]+/g, '-')
            doc.save(`detail-profit-kebun-${safeName}-${startDate}-${endDate}.pdf`)
        } finally {
            setProfitDetailExporting(false)
        }
    }

    const extractPerusahaanName = (ket: string) => {
        if (!ket) return '-';
        const match = ket.match(/\[PERUSAHAAN:(\d+)\]/);
        if (match && match[1]) {
            const pid = parseInt(match[1]);
            const p = perusahaanList.find(x => x.id === pid);
            return p ? p.name : `Perusahaan #${pid}`;
        }
        return '-';
    }

    const cleanKeterangan = (ket: string) => {
        if (!ket) return '-';
        return ket.replace(/\s*\[(KENDARAAN|KEBUN|PERUSAHAAN|KARYAWAN):[^\]]+\]/g, '').trim() || '-';
    }

    const labelSource = (source: any) => {
        const s = String(source || '').toUpperCase()
        if (s === 'UANG_JALAN') return 'Uang Jalan'
        return 'Kas'
    }

    const allowedKategori = ['UMUM','KEBUN','KENDARAAN','GAJI']
    const updateKasKategori = async (row: any, kategoriBaru: string) => {
        try {
            const payload = {
                id: row.id,
                tipe: row.tipe || 'PENGELUARAN',
                deskripsi: row.deskripsi || '',
                jumlah: Number(row.jumlah || 0),
                keterangan: row.keterangan || '',
                gambarUrl: row.gambarUrl || '',
                date: new Date(row.date).toISOString(),
                kendaraanPlatNomor: row.kendaraanPlatNomor || null,
                kebunId: row.kebunId || null,
                karyawanId: row.karyawanId || null,
                kategori: kategoriBaru,
            }
            const res = await fetch('/api/kasir', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
            if (!res.ok) throw new Error('Gagal mengubah kategori')
            if (tab === 'perusahaan') {
                mutate(`/api/reports/cost-center/kas-transaksi?${perusahaanKasParams.toString()}`)
            }
        } catch {}
    }

    return (
        <RoleGate allow={['ADMIN', 'PEMILIK', 'KEUANGAN']}>
            <div className="p-4 md:p-8 space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <h1 className="text-2xl font-bold">Laporan Biaya Operasional (Cost Center)</h1>
                    <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
                        <select
                            value={quickRange}
                            onChange={(e) => applyQuickRange(e.target.value as any)}
                            className="h-10 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none w-full md:w-56"
                        >
                            <option value="today">Hari Ini</option>
                            <option value="yesterday">Kemarin</option>
                            <option value="last_week">7 Hari Terakhir</option>
                            <option value="last_30_days">30 Hari Terakhir</option>
                            <option value="this_month">Bulan Ini</option>
                            <option value="this_year">Tahun Ini</option>
                            <option value="custom">Kustom</option>
                        </select>
                        {quickRange === 'custom' ? (
                            <>
                                <Input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => { setStartDate(e.target.value); setQuickRange('custom') }}
                                    className="w-full md:w-44 input-style"
                                />
                                <Input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => { setEndDate(e.target.value); setQuickRange('custom') }}
                                    className="w-full md:w-44 input-style"
                                />
                            </>
                        ) : null}
                    </div>
                </div>

                <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full space-y-6">
                    <div className="w-full overflow-x-auto pb-2 scrollbar-hide">
                        <TabsList className="w-max min-w-full justify-start h-12 rounded-2xl bg-gray-50 border border-gray-100 p-1 gap-1">
                            <TabsTrigger value="kebun" className="rounded-xl px-4 h-10 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm">
                                <ArchiveBoxIcon className="h-4 w-4 mr-2" />
                                Kebun
                            </TabsTrigger>
                            <TabsTrigger value="perusahaan" className="rounded-xl px-4 h-10 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm">
                                <BuildingOfficeIcon className="h-4 w-4 mr-2" />
                                Perusahaan
                            </TabsTrigger>
                            <TabsTrigger value="kendaraan" className="rounded-xl px-4 h-10 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm">
                                <TruckIcon className="h-4 w-4 mr-2" />
                                Kendaraan
                            </TabsTrigger>
                            <TabsTrigger value="gaji" className="rounded-xl px-4 h-10 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm">
                                <UsersIcon className="h-4 w-4 mr-2" />
                                Karyawan
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="kendaraan" className="mt-0 focus-visible:outline-none">
                        <div className="flex flex-col md:flex-row gap-2 w-full">
                            <select
                                value={selectedKendaraan}
                                onChange={(e) => setSelectedKendaraan(e.target.value)}
                                className="h-10 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none w-full md:w-72"
                            >
                                <option value="all">Semua Kendaraan</option>
                                {kendaraanList.map((k) => (
                                    <option key={k.platNomor} value={k.platNomor}>{k.platNomor} ({k.merk})</option>
                                ))}
                            </select>
                        </div>

                        <div className="card-style p-0 overflow-hidden mt-6">
                                    <div className="px-6 py-4 border-b bg-gray-50 flex items-center justify-between">
                                        <div>
                                            <div className="text-sm font-semibold text-gray-900">Transaksi Kas (Tag Kendaraan)</div>
                                            <div className="text-xs text-gray-500">Menampilkan pengeluaran kas yang memiliki tag kendaraan pada periode terpilih.</div>
                                        </div>
                                        <div className="relative">
                                            <button
                                                type="button"
                                                onClick={() => setExportMenuOpen(s => ({...s, kendaraan: !s.kendaraan}))}
                                                disabled={exporting.kendaraan}
                                                className="h-9 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white border border-red-700 disabled:opacity-50 inline-flex items-center gap-2"
                                            >
                                                <ArrowDownTrayIcon className="h-4 w-4" />
                                                {exporting.kendaraan ? 'Export...' : 'Export'}
                                                <ChevronDownIcon className="h-4 w-4 opacity-90" />
                                            </button>
                                            {exportMenuOpen.kendaraan ? (
                                                <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded-xl shadow-lg z-10">
                                                    <button
                                                        type="button"
                                                        onClick={async () => { setExportMenuOpen(s => ({...s, kendaraan: false})); await handleExportKendaraanPdf(); }}
                                                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-t-xl"
                                                    >
                                                        PDF
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={async () => { setExportMenuOpen(s => ({...s, kendaraan: false})); await handleExportKendaraan(); }}
                                                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-b-xl"
                                                    >
                                                        CSV
                                                    </button>
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                    <div className="px-6 py-4 bg-white border-b">
                                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                                                <div className="text-xs text-gray-500">Total Biaya</div>
                                                <div className="mt-1 text-base font-bold text-gray-900">{loadingKendaraanKas ? '...' : formatCurrency(Number(kendaraanKasRows?.meta?.totalJumlah || 0))}</div>
                                            </div>
                                            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                                                <div className="text-xs text-gray-500">Jumlah Transaksi</div>
                                                <div className="mt-1 text-base font-bold text-gray-900">{loadingKendaraanKas ? '...' : Number(kendaraanKasRows?.meta?.totalItems || 0).toLocaleString('id-ID')}</div>
                                            </div>
                                            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                                                <div className="text-xs text-gray-500">Rata / Transaksi</div>
                                                <div className="mt-1 text-base font-bold text-gray-900">
                                                    {loadingKendaraanKas ? '...' : formatCurrency(
                                                        Number(kendaraanKasRows?.meta?.totalItems || 0) > 0
                                                            ? Number(kendaraanKasRows?.meta?.totalJumlah || 0) / Number(kendaraanKasRows?.meta?.totalItems || 1)
                                                            : 0
                                                    )}
                                                </div>
                                            </div>
                                            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                                                <div className="text-xs text-gray-500">Rata / Hari</div>
                                                <div className="mt-1 text-base font-bold text-gray-900">
                                                    {loadingKendaraanKas ? '...' : formatCurrency(Number(kendaraanKasRows?.meta?.totalJumlah || 0) / daysInRangeInclusive(startDate, endDate))}
                                                </div>
                                            </div>
                                            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                                                <div className="text-xs text-gray-500">Transaksi Terbesar</div>
                                                <div className="mt-1 text-base font-bold text-gray-900">{loadingKendaraanKas ? '...' : formatCurrency(Number(kendaraanKasRows?.meta?.maxJumlah || 0))}</div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="w-full overflow-x-auto">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-white">
                                                <tr>
                                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tanggal</th>
                                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Deskripsi</th>
                                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Keterangan</th>
                                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Sumber</th>
                                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Kendaraan</th>
                                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Bukti</th>
                                                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Jumlah</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {loadingKendaraanKas ? (
                                                    <tr><td colSpan={7} className="px-6 py-6 text-sm text-gray-500">Memuat...</td></tr>
                                                ) : (kendaraanKasRows?.data || []).length === 0 ? (
                                                    <tr><td colSpan={7} className="px-6 py-6 text-sm text-gray-500">Tidak ada transaksi pada periode ini.</td></tr>
                                                ) : (
                                                    (kendaraanKasRows?.data || []).map((r: any) => (
                                                        <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                                                            <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-700">{formatDateId(r.date)}</td>
                                                            <td className="px-6 py-3 text-sm font-medium text-gray-900">{r.deskripsi}</td>
                                                            <td className="px-6 py-3 text-sm text-gray-600">{cleanKeterangan(r.keterangan)}</td>
                                                            <td className="px-6 py-3 whitespace-nowrap">
                                                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${String(r.source || 'KAS') === 'UANG_JALAN' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-50 text-slate-700 border border-slate-200'}`}>
                                                                    {labelSource(r.source)}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-700">{r.kendaraan?.platNomor || r.kendaraanPlatNomor || '-'}</td>
                                                            <td className="px-6 py-3 whitespace-nowrap text-sm text-blue-600">
                                                                {r.gambarUrl ? (
                                                                    <button type="button" onClick={() => openBukti(r.gambarUrl)} className="inline-flex items-center gap-1 hover:underline">
                                                                        <EyeIcon className="h-4 w-4" /> Lihat
                                                                    </button>
                                                                ) : '-'}
                                                            </td>
                                                            <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900 text-right">{formatCurrency(r.jumlah)}</td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                            <tfoot className="bg-gray-50">
                                                <tr>
                                                    <td className="px-6 py-3 text-right text-xs font-semibold text-gray-600" colSpan={6}>Total</td>
                                                    <td className="px-6 py-3 text-right text-sm font-bold text-gray-900">{formatCurrency(kendaraanKasRows?.meta?.totalJumlah || 0)}</td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                    <div className="px-6 py-4 border-t bg-white flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                        <div className="text-xs text-gray-500">{formatPaginationInfo(kendaraanKasRows?.meta)}</div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                className="h-9 px-3 rounded-xl border border-gray-200 bg-white text-sm disabled:opacity-50"
                                                disabled={!kendaraanKasRows?.meta || kendaraanKasRows.meta.page <= 1 || loadingKendaraanKas}
                                                onClick={() => setKendaraanKasPage(p => Math.max(1, p - 1))}
                                            >
                                                Prev
                                            </button>
                                            <button
                                                type="button"
                                                className="h-9 px-3 rounded-xl border border-gray-200 bg-white text-sm disabled:opacity-50"
                                                disabled={!kendaraanKasRows?.meta || kendaraanKasRows.meta.page >= kendaraanKasRows.meta.totalPages || loadingKendaraanKas}
                                                onClick={() => setKendaraanKasPage(p => p + 1)}
                                            >
                                                Next
                                            </button>
                                        </div>
                                    </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="kebun" className="mt-0 focus-visible:outline-none">
                        <div className="flex flex-col md:flex-row gap-2 w-full">
                            <select
                                value={selectedKebunId}
                                onChange={(e) => setSelectedKebunId(e.target.value)}
                                className="h-10 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none w-full md:w-64"
                            >
                                <option value="all">Semua Kebun</option>
                                {kebunList.map((k) => (
                                    <option key={k.id} value={String(k.id)}>{k.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="card-style p-0 overflow-hidden mt-6">
                            <div className="px-6 py-4 border-b bg-gray-50">
                                <div className="text-sm font-semibold text-gray-900">Profit Kebun</div>
                                <div className="text-xs text-gray-500">Pendapatan (Nota Sawit) - Biaya (Kas tag kebun + Uang Jalan tag kebun + Gajian).</div>
                            </div>
                            {loadingKebunProfit ? (
                                <div className="px-6 py-6 text-sm text-gray-500">Memuat...</div>
                            ) : !Array.isArray(kebunProfitRows) || kebunProfitRows.length === 0 ? (
                                <div className="px-6 py-6 text-sm text-gray-500">Tidak ada data profit.</div>
                            ) : (
                                <>
                                    <div className="md:hidden p-4 space-y-3">
                                        {kebunProfitRows.map((r: any) => (
                                            <div key={r.kebunId} className="rounded-2xl border border-gray-100 bg-white p-4 space-y-2">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="font-semibold text-gray-900">{r.kebunName || `Kebun #${r.kebunId}`}</div>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => openProfitDetail(r)}
                                                            className="h-8 px-3 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-100 text-xs font-semibold inline-flex items-center gap-2"
                                                        >
                                                            <EyeIcon className="h-4 w-4" />
                                                            Detail
                                                        </button>
                                                        <div className={`text-sm font-bold ${Number(r.grossProfit || 0) >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{formatCurrency(Number(r.grossProfit || 0))}</div>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 text-xs">
                                                    <div>
                                                        <div className="text-gray-400">Pendapatan</div>
                                                        <div className="font-semibold text-gray-900">{formatCurrency(Number(r.income || 0))}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-gray-400">Total Biaya</div>
                                                        <div className="font-semibold text-gray-900">{formatCurrency(Number(r.totalCost || 0))}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-gray-400">Biaya Kas</div>
                                                        <div className="font-medium text-gray-800">{formatCurrency(Number(r.kasCost || 0))}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-gray-400">Biaya Uang Jalan</div>
                                                        <div className="font-medium text-gray-800">{formatCurrency(Number(r.uangJalanCost || 0))}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-gray-400">Biaya Gaji</div>
                                                        <div className="font-medium text-gray-800">{formatCurrency(Number(r.gajiCost || 0))}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-gray-400">Trip</div>
                                                        <div className="font-medium text-gray-800">{Number(r.totalTrips || 0).toLocaleString('id-ID')}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="hidden md:block w-full overflow-x-auto">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-white">
                                                <tr>
                                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Kebun</th>
                                                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Trip</th>
                                                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Pendapatan</th>
                                                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Biaya Kas</th>
                                                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Biaya Uang Jalan</th>
                                                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Biaya Gaji</th>
                                                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Biaya</th>
                                                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Profit</th>
                                                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Aksi</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {kebunProfitRows.map((r: any) => (
                                                    <tr key={r.kebunId} className="hover:bg-gray-50/50 transition-colors">
                                                        <td className="px-6 py-3 text-sm font-medium text-gray-900">{r.kebunName || `Kebun #${r.kebunId}`}</td>
                                                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-700 text-right">{Number(r.totalTrips || 0).toLocaleString('id-ID')}</td>
                                                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900 text-right">{formatCurrency(Number(r.income || 0))}</td>
                                                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900 text-right">{formatCurrency(Number(r.kasCost || 0))}</td>
                                                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900 text-right">{formatCurrency(Number(r.uangJalanCost || 0))}</td>
                                                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900 text-right">{formatCurrency(Number(r.gajiCost || 0))}</td>
                                                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900 text-right">{formatCurrency(Number(r.totalCost || 0))}</td>
                                                        <td className={`px-6 py-3 whitespace-nowrap text-sm font-bold text-right ${Number(r.grossProfit || 0) >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{formatCurrency(Number(r.grossProfit || 0))}</td>
                                                        <td className="px-6 py-3 whitespace-nowrap text-right">
                                                            <button
                                                                type="button"
                                                                onClick={() => openProfitDetail(r)}
                                                                className="h-9 px-3 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-100 text-sm font-semibold inline-flex items-center gap-2"
                                                            >
                                                                <EyeIcon className="h-4 w-4" />
                                                                Detail
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot className="bg-gray-50">
                                                <tr>
                                                    <td className="px-6 py-3 text-sm font-semibold text-gray-600">Total</td>
                                                    <td className="px-6 py-3 text-right text-sm font-bold text-gray-900">
                                                        {Number(kebunProfitRows.reduce((acc: number, r: any) => acc + Number(r.totalTrips || 0), 0)).toLocaleString('id-ID')}
                                                    </td>
                                                    <td className="px-6 py-3 text-right text-sm font-bold text-gray-900">
                                                        {formatCurrency(kebunProfitRows.reduce((acc: number, r: any) => acc + Number(r.income || 0), 0))}
                                                    </td>
                                                    <td className="px-6 py-3 text-right text-sm font-bold text-gray-900">
                                                        {formatCurrency(kebunProfitRows.reduce((acc: number, r: any) => acc + Number(r.kasCost || 0), 0))}
                                                    </td>
                                                    <td className="px-6 py-3 text-right text-sm font-bold text-gray-900">
                                                        {formatCurrency(kebunProfitRows.reduce((acc: number, r: any) => acc + Number(r.uangJalanCost || 0), 0))}
                                                    </td>
                                                    <td className="px-6 py-3 text-right text-sm font-bold text-gray-900">
                                                        {formatCurrency(kebunProfitRows.reduce((acc: number, r: any) => acc + Number(r.gajiCost || 0), 0))}
                                                    </td>
                                                    <td className="px-6 py-3 text-right text-sm font-bold text-gray-900">
                                                        {formatCurrency(kebunProfitRows.reduce((acc: number, r: any) => acc + Number(r.totalCost || 0), 0))}
                                                    </td>
                                                    <td className={`px-6 py-3 text-right text-sm font-bold ${kebunProfitRows.reduce((acc: number, r: any) => acc + Number(r.grossProfit || 0), 0) >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                                                        {formatCurrency(kebunProfitRows.reduce((acc: number, r: any) => acc + Number(r.grossProfit || 0), 0))}
                                                    </td>
                                                    <td className="px-6 py-3" />
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="card-style p-0 overflow-hidden mt-6">
                            <div className="px-6 py-4 border-b bg-gray-50 flex items-center justify-between">
                                <div>
                                    <div className="text-sm font-semibold text-gray-900">Transaksi (Kas + Uang Jalan) Tag Kebun</div>
                                    <div className="text-xs text-gray-500">Menampilkan pengeluaran (kas dan uang jalan) yang memiliki tag kebun pada periode terpilih.</div>
                                </div>
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setExportMenuOpen(s => ({...s, kebun: !s.kebun}))}
                                        disabled={exporting.kebun}
                                        className="h-9 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white border border-red-700 disabled:opacity-50 inline-flex items-center gap-2"
                                    >
                                        <ArrowDownTrayIcon className="h-4 w-4" />
                                        {exporting.kebun ? 'Export...' : 'Export'}
                                        <ChevronDownIcon className="h-4 w-4 opacity-90" />
                                    </button>
                                    {exportMenuOpen.kebun ? (
                                        <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded-xl shadow-lg z-10">
                                            <button
                                                type="button"
                                                onClick={async () => { setExportMenuOpen(s => ({...s, kebun: false})); await handleExportKebunPdf(); }}
                                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-t-xl"
                                            >
                                                PDF
                                            </button>
                                            <button
                                                type="button"
                                                onClick={async () => { setExportMenuOpen(s => ({...s, kebun: false})); await handleExportKebun(); }}
                                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-b-xl"
                                            >
                                                CSV
                                            </button>
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                            <div className="px-6 py-4 bg-white border-b">
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                                        <div className="text-xs text-gray-500">Total Biaya</div>
                                        <div className="mt-1 text-base font-bold text-gray-900">{loadingKebunKas ? '...' : formatCurrency(Number(kebunKasRows?.meta?.totalJumlah || 0))}</div>
                                    </div>
                                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                                        <div className="text-xs text-gray-500">Jumlah Transaksi</div>
                                        <div className="mt-1 text-base font-bold text-gray-900">{loadingKebunKas ? '...' : Number(kebunKasRows?.meta?.totalItems || 0).toLocaleString('id-ID')}</div>
                                    </div>
                                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                                        <div className="text-xs text-gray-500">Rata / Transaksi</div>
                                        <div className="mt-1 text-base font-bold text-gray-900">
                                            {loadingKebunKas ? '...' : formatCurrency(
                                                Number(kebunKasRows?.meta?.totalItems || 0) > 0
                                                    ? Number(kebunKasRows?.meta?.totalJumlah || 0) / Number(kebunKasRows?.meta?.totalItems || 1)
                                                    : 0
                                            )}
                                        </div>
                                    </div>
                                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                                        <div className="text-xs text-gray-500">Rata / Hari</div>
                                        <div className="mt-1 text-base font-bold text-gray-900">
                                            {loadingKebunKas ? '...' : formatCurrency(Number(kebunKasRows?.meta?.totalJumlah || 0) / daysInRangeInclusive(startDate, endDate))}
                                        </div>
                                    </div>
                                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                                        <div className="text-xs text-gray-500">Transaksi Terbesar</div>
                                        <div className="mt-1 text-base font-bold text-gray-900">{loadingKebunKas ? '...' : formatCurrency(Number(kebunKasRows?.meta?.maxJumlah || 0))}</div>
                                    </div>
                                </div>
                            </div>
                            <div className="w-full overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-white">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tanggal</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Deskripsi</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Keterangan</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Sumber</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Kebun</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Bukti</th>
                                            <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Jumlah</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {loadingKebunKas ? (
                                            <tr><td colSpan={7} className="px-6 py-6 text-sm text-gray-500">Memuat...</td></tr>
                                        ) : (kebunKasRows?.data || []).length === 0 ? (
                                            <tr><td colSpan={7} className="px-6 py-6 text-sm text-gray-500">Tidak ada transaksi pada periode ini.</td></tr>
                                        ) : (
                                            (kebunKasRows?.data || []).map((r: any) => (
                                                <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                                                    <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-700">{formatDateId(r.date)}</td>
                                                    <td className="px-6 py-3 text-sm font-medium text-gray-900">{r.deskripsi}</td>
                                                    <td className="px-6 py-3 text-sm text-gray-600">{cleanKeterangan(r.keterangan)}</td>
                                                    <td className="px-6 py-3 whitespace-nowrap">
                                                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${String(r.source || 'KAS') === 'UANG_JALAN' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-50 text-slate-700 border border-slate-200'}`}>
                                                            {labelSource(r.source)}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-700">{r.kebun?.name || '-'}</td>
                                                    <td className="px-6 py-3 whitespace-nowrap text-sm text-blue-600">
                                                        {r.gambarUrl ? (
                                                            <button type="button" onClick={() => openBukti(r.gambarUrl)} className="inline-flex items-center gap-1 hover:underline">
                                                                <EyeIcon className="h-4 w-4" /> Lihat
                                                            </button>
                                                        ) : '-'}
                                                    </td>
                                                    <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900 text-right">{formatCurrency(r.jumlah)}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                    <tfoot className="bg-gray-50">
                                        <tr>
                                            <td className="px-6 py-3 text-right text-xs font-semibold text-gray-600" colSpan={6}>Total</td>
                                            <td className="px-6 py-3 text-right text-sm font-bold text-gray-900">{formatCurrency(kebunKasRows?.meta?.totalJumlah || 0)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                            <div className="px-6 py-4 border-t bg-white flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                <div className="text-xs text-gray-500">{formatPaginationInfo(kebunKasRows?.meta)}</div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        className="h-9 px-3 rounded-xl border border-gray-200 bg-white text-sm disabled:opacity-50"
                                        disabled={!kebunKasRows?.meta || kebunKasRows.meta.page <= 1 || loadingKebunKas}
                                        onClick={() => setKebunKasPage(p => Math.max(1, p - 1))}
                                    >
                                        Prev
                                    </button>
                                    <button
                                        type="button"
                                        className="h-9 px-3 rounded-xl border border-gray-200 bg-white text-sm disabled:opacity-50"
                                        disabled={!kebunKasRows?.meta || kebunKasRows.meta.page >= kebunKasRows.meta.totalPages || loadingKebunKas}
                                        onClick={() => setKebunKasPage(p => p + 1)}
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="perusahaan" className="mt-0 focus-visible:outline-none">
                        <div className="flex flex-col md:flex-row gap-2 w-full">
                            <select
                                value={selectedPerusahaanId}
                                onChange={(e) => setSelectedPerusahaanId(e.target.value)}
                                className="h-10 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none w-full md:w-72"
                            >
                                <option value="all">Semua Perusahaan</option>
                                {perusahaanList.map((p) => (
                                    <option key={p.id} value={String(p.id)}>{p.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="card-style p-0 overflow-hidden mt-6">
                            <div className="px-6 py-4 border-b bg-gray-50 flex items-center justify-between">
                                <div>
                                    <div className="text-sm font-semibold text-gray-900">Transaksi Kas (Tag Perusahaan)</div>
                                    <div className="text-xs text-gray-500">Menampilkan pengeluaran kas yang memiliki tag perusahaan pada periode terpilih.</div>
                                </div>
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setExportMenuOpen(s => ({...s, perusahaanKas: !s.perusahaanKas}))}
                                        disabled={exporting.perusahaanKas}
                                        className="h-9 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white border border-red-700 disabled:opacity-50 inline-flex items-center gap-2"
                                    >
                                        <ArrowDownTrayIcon className="h-4 w-4" />
                                        {exporting.perusahaanKas ? 'Export...' : 'Export'}
                                        <ChevronDownIcon className="h-4 w-4 opacity-90" />
                                    </button>
                                    {exportMenuOpen.perusahaanKas ? (
                                        <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded-xl shadow-lg z-10">
                                            <button
                                                type="button"
                                                onClick={async () => { setExportMenuOpen(s => ({...s, perusahaanKas: false})); await handleExportPerusahaanKasPdf(); }}
                                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-t-xl"
                                            >
                                                PDF
                                            </button>
                                            <button
                                                type="button"
                                                onClick={async () => { setExportMenuOpen(s => ({...s, perusahaanKas: false})); await handleExportPerusahaanKas(); }}
                                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-b-xl"
                                            >
                                                CSV
                                            </button>
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                            <div className="px-6 py-4 bg-white border-b">
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                                        <div className="text-xs text-gray-500">Total Biaya</div>
                                        <div className="mt-1 text-base font-bold text-gray-900">{loadingPerusahaanKas ? '...' : formatCurrency(Number(perusahaanKasRows?.meta?.totalJumlah || 0))}</div>
                                    </div>
                                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                                        <div className="text-xs text-gray-500">Jumlah Transaksi</div>
                                        <div className="mt-1 text-base font-bold text-gray-900">{loadingPerusahaanKas ? '...' : Number(perusahaanKasRows?.meta?.totalItems || 0).toLocaleString('id-ID')}</div>
                                    </div>
                                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                                        <div className="text-xs text-gray-500">Rata / Transaksi</div>
                                        <div className="mt-1 text-base font-bold text-gray-900">
                                            {loadingPerusahaanKas ? '...' : formatCurrency(
                                                Number(perusahaanKasRows?.meta?.totalItems || 0) > 0
                                                    ? Number(perusahaanKasRows?.meta?.totalJumlah || 0) / Number(perusahaanKasRows?.meta?.totalItems || 1)
                                                    : 0
                                            )}
                                        </div>
                                    </div>
                                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                                        <div className="text-xs text-gray-500">Rata / Hari</div>
                                        <div className="mt-1 text-base font-bold text-gray-900">
                                            {loadingPerusahaanKas ? '...' : formatCurrency(Number(perusahaanKasRows?.meta?.totalJumlah || 0) / daysInRangeInclusive(startDate, endDate))}
                                        </div>
                                    </div>
                                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                                        <div className="text-xs text-gray-500">Transaksi Terbesar</div>
                                        <div className="mt-1 text-base font-bold text-gray-900">{loadingPerusahaanKas ? '...' : formatCurrency(Number(perusahaanKasRows?.meta?.maxJumlah || 0))}</div>
                                    </div>
                                </div>
                            </div>
                            <div className="w-full overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-white">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tanggal</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Deskripsi</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Keterangan</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Kategori</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Sumber</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Perusahaan</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Bukti</th>
                                            <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Jumlah</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {loadingPerusahaanKas ? (
                                            <tr><td colSpan={8} className="px-6 py-6 text-sm text-gray-500">Memuat...</td></tr>
                                        ) : (perusahaanKasRows?.data || []).length === 0 ? (
                                            <tr><td colSpan={8} className="px-6 py-6 text-sm text-gray-500">Tidak ada transaksi pada periode ini.</td></tr>
                                        ) : (
                                            (perusahaanKasRows?.data || []).map((r: any) => (
                                                <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                                                    <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-700">{formatDateId(r.date)}</td>
                                                    <td className="px-6 py-3 text-sm font-medium text-gray-900">{r.deskripsi}</td>
                                                    <td className="px-6 py-3 text-sm text-gray-600">{cleanKeterangan(r.keterangan)}</td>
                                                    <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-700">
                                                        {String(r.source || 'KAS') === 'UANG_JALAN' ? (
                                                            <span className="text-xs font-semibold text-gray-800">{r.kategori || 'UANG_JALAN'}</span>
                                                        ) : (
                                                            <select
                                                                value={r.kategori || 'UMUM'}
                                                                onChange={(e) => updateKasKategori(r, e.target.value)}
                                                                className="h-8 rounded-lg border border-gray-200 bg-white px-2 text-xs focus:outline-none"
                                                            >
                                                                {allowedKategori.map((k) => (<option key={k} value={k}>{k}</option>))}
                                                            </select>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-3 whitespace-nowrap">
                                                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${String(r.source || 'KAS') === 'UANG_JALAN' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-50 text-slate-700 border border-slate-200'}`}>
                                                            {labelSource(r.source)}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-700">{extractPerusahaanName(r.keterangan)}</td>
                                                    <td className="px-6 py-3 whitespace-nowrap text-sm text-blue-600">
                                                        {r.gambarUrl ? (
                                                            <button type="button" onClick={() => openBukti(r.gambarUrl)} className="inline-flex items-center gap-1 hover:underline">
                                                                <EyeIcon className="h-4 w-4" /> Lihat
                                                            </button>
                                                        ) : '-'}
                                                    </td>
                                                    <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900 text-right">{formatCurrency(r.jumlah)}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                    <tfoot className="bg-gray-50">
                                        <tr>
                                            <td className="px-6 py-3 text-right text-xs font-semibold text-gray-600" colSpan={7}>Total</td>
                                            <td className="px-6 py-3 text-right text-sm font-bold text-gray-900">{formatCurrency(perusahaanKasRows?.meta?.totalJumlah || 0)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                            <div className="px-6 py-4 border-t bg-white flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                <div className="text-xs text-gray-500">{formatPaginationInfo(perusahaanKasRows?.meta)}</div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        className="h-9 px-3 rounded-xl border border-gray-200 bg-white text-sm disabled:opacity-50"
                                        disabled={!perusahaanKasRows?.meta || perusahaanKasRows.meta.page <= 1 || loadingPerusahaanKas}
                                        onClick={() => setPerusahaanKasPage(p => Math.max(1, p - 1))}
                                    >
                                        Prev
                                    </button>
                                    <button
                                        type="button"
                                        className="h-9 px-3 rounded-xl border border-gray-200 bg-white text-sm disabled:opacity-50"
                                        disabled={!perusahaanKasRows?.meta || perusahaanKasRows.meta.page >= perusahaanKasRows.meta.totalPages || loadingPerusahaanKas}
                                        onClick={() => setPerusahaanKasPage(p => p + 1)}
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="card-style p-0 overflow-hidden mt-6">
                            <div className="px-6 py-4 border-b bg-gray-50 flex items-center justify-between">
                                <div>
                                    <div className="text-sm font-semibold text-gray-900">Biaya Manual Perusahaan</div>
                                    <div className="text-xs text-gray-500">Menampilkan data biaya manual (Perusahaan Biaya) pada periode terpilih.</div>
                                </div>
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setExportMenuOpen(s => ({...s, perusahaan: !s.perusahaan}))}
                                        disabled={exporting.perusahaan}
                                        className="h-9 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white border border-red-700 disabled:opacity-50 inline-flex items-center gap-2"
                                    >
                                        <ArrowDownTrayIcon className="h-4 w-4" />
                                        {exporting.perusahaan ? 'Export...' : 'Export'}
                                        <ChevronDownIcon className="h-4 w-4 opacity-90" />
                                    </button>
                                    {exportMenuOpen.perusahaan ? (
                                        <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded-xl shadow-lg z-10">
                                            <button
                                                type="button"
                                                onClick={async () => { setExportMenuOpen(s => ({...s, perusahaan: false})); await handleExportPerusahaanPdf(); }}
                                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-t-xl"
                                            >
                                                PDF
                                            </button>
                                            <button
                                                type="button"
                                                onClick={async () => { setExportMenuOpen(s => ({...s, perusahaan: false})); await handleExportPerusahaan(); }}
                                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-b-xl"
                                            >
                                                CSV
                                            </button>
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                            <div className="w-full overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-white">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tanggal</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Perusahaan</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Kategori</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Deskripsi</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Bukti</th>
                                            <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Jumlah</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {loadingPerusahaanBiaya ? (
                                            <tr><td colSpan={6} className="px-6 py-6 text-sm text-gray-500">Memuat...</td></tr>
                                        ) : (perusahaanBiayaRows?.data || []).length === 0 ? (
                                            <tr><td colSpan={6} className="px-6 py-6 text-sm text-gray-500">Tidak ada biaya manual perusahaan.</td></tr>
                                        ) : (
                                            (perusahaanBiayaRows?.data || []).map((r: any) => (
                                                <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                                                    <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-700">{formatDateId(r.date)}</td>
                                                    <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">{r.perusahaan?.name || `Perusahaan #${r.perusahaanId}`}</td>
                                                    <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-700">{r.kategori || 'UMUM'}</td>
                                                    <td className="px-6 py-3 text-sm text-gray-700">{r.deskripsi || '-'}</td>
                                                    <td className="px-6 py-3 whitespace-nowrap text-sm text-blue-600">
                                                        {r.gambarUrl ? (
                                                            <button type="button" onClick={() => openBukti(r.gambarUrl)} className="inline-flex items-center gap-1 hover:underline">
                                                                <EyeIcon className="h-4 w-4" /> Lihat
                                                            </button>
                                                        ) : '-'}
                                                    </td>
                                                    <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900 text-right">{formatCurrency(r.jumlah)}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                    <tfoot className="bg-gray-50">
                                        <tr>
                                            <td className="px-6 py-3 text-right text-xs font-semibold text-gray-600" colSpan={5}>Total</td>
                                            <td className="px-6 py-3 text-right text-sm font-bold text-gray-900">{formatCurrency(perusahaanBiayaRows?.meta?.totalJumlah || 0)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                            <div className="px-6 py-4 border-t bg-white flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                <div className="text-xs text-gray-500">{formatPaginationInfo(perusahaanBiayaRows?.meta)}</div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        className="h-9 px-3 rounded-xl border border-gray-200 bg-white text-sm disabled:opacity-50"
                                        disabled={!perusahaanBiayaRows?.meta || perusahaanBiayaRows.meta.page <= 1 || loadingPerusahaanBiaya}
                                        onClick={() => setPerusahaanBiayaPage(p => Math.max(1, p - 1))}
                                    >
                                        Prev
                                    </button>
                                    <button
                                        type="button"
                                        className="h-9 px-3 rounded-xl border border-gray-200 bg-white text-sm disabled:opacity-50"
                                        disabled={!perusahaanBiayaRows?.meta || perusahaanBiayaRows.meta.page >= perusahaanBiayaRows.meta.totalPages || loadingPerusahaanBiaya}
                                        onClick={() => setPerusahaanBiayaPage(p => p + 1)}
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="gaji" className="mt-0 focus-visible:outline-none">
                        <div className="flex flex-col md:flex-row gap-2 w-full">
                            <select
                                value={selectedKebunId}
                                onChange={(e) => setSelectedKebunId(e.target.value)}
                                className="h-10 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none w-full md:w-64"
                            >
                                <option value="all">Semua Kebun</option>
                                {kebunList.map((k) => (
                                    <option key={k.id} value={String(k.id)}>{k.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="card-style p-0 overflow-hidden mt-6">
                            <div className="px-6 py-4 border-b bg-gray-50 flex items-center justify-between">
                                <div>
                                    <div className="text-sm font-semibold text-gray-900">Biaya Gaji (Karyawan)</div>
                                    <div className="text-xs text-gray-500">Menampilkan total gaji berjalan + gaji dibayar per karyawan pada periode terpilih.</div>
                                </div>
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setExportMenuOpen(s => ({...s, gaji: !s.gaji}))}
                                        disabled={exporting.gaji}
                                        className="h-9 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700 disabled:opacity-50 inline-flex items-center gap-2"
                                    >
                                        <ArrowDownTrayIcon className="h-4 w-4" />
                                        {exporting.gaji ? 'Export...' : 'Export'}
                                        <ChevronDownIcon className="h-4 w-4 opacity-90" />
                                    </button>
                                    {exportMenuOpen.gaji ? (
                                        <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded-xl shadow-lg z-10">
                                            <button
                                                type="button"
                                                onClick={async () => { setExportMenuOpen(s => ({...s, gaji: false})); await handleExportGajianPdf(); }}
                                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-t-xl"
                                            >
                                                PDF
                                            </button>
                                            <button
                                                type="button"
                                                onClick={async () => { setExportMenuOpen(s => ({...s, gaji: false})); await handleExportGajian(); }}
                                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-b-xl"
                                            >
                                                CSV
                                            </button>
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                            <div className="w-full overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-white">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Karyawan</th>
                                            <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Gaji Berjalan</th>
                                            <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Gaji Dibayar</th>
                                            <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {loadingKaryawanGajiRows ? (
                                            <tr><td colSpan={4} className="px-6 py-6 text-sm text-gray-500">Memuat...</td></tr>
                                        ) : (karyawanGajiRows?.data || []).length === 0 ? (
                                            <tr><td colSpan={4} className="px-6 py-6 text-sm text-gray-500">Tidak ada data biaya gaji.</td></tr>
                                        ) : (
                                            (karyawanGajiRows?.data || []).map((r: any) => {
                                                const berjalan = Number(r.gajiBerjalan || 0)
                                                const dibayar = Number(r.gajiDibayar || 0)
                                                const total = Number(r.total || 0)
                                                return (
                                                    <tr key={r.karyawanId} className="hover:bg-gray-50/50 transition-colors">
                                                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">{r.karyawanName || `Karyawan #${r.karyawanId}`}</td>
                                                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900 text-right">{formatCurrency(berjalan)}</td>
                                                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900 text-right">{formatCurrency(dibayar)}</td>
                                                        <td className="px-6 py-3 whitespace-nowrap text-sm font-semibold text-gray-900 text-right">{formatCurrency(total)}</td>
                                                    </tr>
                                                )
                                            })
                                        )}
                                    </tbody>
                                    <tfoot className="bg-gray-50">
                                        <tr>
                                            <td className="px-6 py-3 text-right text-xs font-semibold text-gray-600">Total</td>
                                            <td className="px-6 py-3 text-right text-sm font-bold text-gray-900">{formatCurrency(Number(karyawanGajiRows?.meta?.sumBerjalan || 0))}</td>
                                            <td className="px-6 py-3 text-right text-sm font-bold text-gray-900">{formatCurrency(Number(karyawanGajiRows?.meta?.sumDibayar || 0))}</td>
                                            <td className="px-6 py-3 text-right text-sm font-bold text-gray-900">{formatCurrency(Number(karyawanGajiRows?.meta?.sumTotal || 0))}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                            <div className="px-6 py-4 border-t bg-white flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                <div className="text-xs text-gray-500">{formatPaginationInfo(karyawanGajiRows?.meta)}</div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        className="h-9 px-3 rounded-xl border border-gray-200 bg-white text-sm disabled:opacity-50"
                                        disabled={!karyawanGajiRows?.meta || karyawanGajiRows.meta.page <= 1 || loadingKaryawanGajiRows}
                                        onClick={() => setGajianPage(p => Math.max(1, p - 1))}
                                    >
                                        Prev
                                    </button>
                                    <button
                                        type="button"
                                        className="h-9 px-3 rounded-xl border border-gray-200 bg-white text-sm disabled:opacity-50"
                                        disabled={!karyawanGajiRows?.meta || karyawanGajiRows.meta.page >= karyawanGajiRows.meta.totalPages || loadingKaryawanGajiRows}
                                        onClick={() => setGajianPage(p => p + 1)}
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>

                
                <Dialog open={buktiOpen} onOpenChange={(v) => { setBuktiOpen(v); if (!v) setBuktiUrl(null) }}>
                    <DialogContent className="max-w-3xl p-0 overflow-hidden">
                        <div className="w-full flex items-center justify-between gap-3 px-6 py-4 border-b bg-gradient-to-r from-red-600 to-red-500 text-white pr-16">
                            <div className="min-w-0">
                                <DialogTitle className="text-white">Bukti</DialogTitle>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleDownloadBukti}
                                    disabled={!buktiUrl}
                                    className="h-9 px-3 rounded-xl bg-white/15 hover:bg-white/20 text-white border border-white/30 disabled:opacity-50 inline-flex items-center gap-2"
                                >
                                    <ArrowDownTrayIcon className="h-4 w-4" />
                                    Download
                                </button>
                            </div>
                        </div>
                        <div className="p-6 bg-white">
                            {buktiUrl ? (
                                <div className="w-full">
                                    <img src={buktiUrl} alt="Bukti" className="w-full h-auto rounded-lg border" />
                                </div>
                            ) : null}
                        </div>
                    </DialogContent>
                </Dialog>

                <Dialog
                    open={profitDetailOpen}
                    onOpenChange={(v) => {
                        setProfitDetailOpen(v)
                        if (!v) {
                            setProfitDetailKebun(null)
                            setProfitDetailKas(null)
                            setProfitDetailGaji(null)
                    setProfitDetailIncome(0)
                        }
                    }}
                >
                    <DialogContent className="max-w-5xl p-0 overflow-hidden">
                        <div className="w-full flex items-center justify-between gap-3 px-6 py-4 border-b bg-gradient-to-r from-emerald-600 to-emerald-500 text-white pr-16">
                            <div className="min-w-0">
                                <DialogTitle className="text-white">Detail Profit Kebun</DialogTitle>
                                <div className="text-xs text-white/90 truncate">{profitDetailKebun?.name || ''} • {startDate} s/d {endDate}</div>
                            </div>
                        </div>
                        <div className="p-6 bg-white space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                                    <div className="text-xs text-gray-500">Pendapatan</div>
                                    <div className="mt-1 text-lg font-bold text-gray-900">
                                        {profitDetailLoading ? '...' : formatCurrency(Number(profitDetailIncome || 0))}
                                    </div>
                                </div>
                                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                                    <div className="text-xs text-gray-500">Total Biaya</div>
                                    <div className="mt-1 text-lg font-bold text-gray-900">
                                        {profitDetailLoading ? '...' : formatCurrency(Number(profitDetailKas?.meta?.totalJumlah || 0) + Number(profitDetailGaji?.meta?.totalJumlah || 0))}
                                    </div>
                                    <div className="mt-1 text-xs text-gray-500">
                                        {profitDetailLoading ? '' : `Kas ${formatCurrency(Number(profitDetailKas?.meta?.totalJumlah || 0))} • Gaji ${formatCurrency(Number(profitDetailGaji?.meta?.totalJumlah || 0))}`}
                                    </div>
                                </div>
                                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                                    <div className="text-xs text-gray-500">Profit</div>
                                    <div className={`mt-1 text-lg font-bold ${profitDetailLoading ? 'text-gray-900' : (Number(profitDetailIncome || 0) - (Number(profitDetailKas?.meta?.totalJumlah || 0) + Number(profitDetailGaji?.meta?.totalJumlah || 0)) >= 0 ? 'text-emerald-700' : 'text-red-600')}`}>
                                        {profitDetailLoading ? '...' : formatCurrency(Number(profitDetailIncome || 0) - (Number(profitDetailKas?.meta?.totalJumlah || 0) + Number(profitDetailGaji?.meta?.totalJumlah || 0)))}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="rounded-2xl border border-gray-100 overflow-hidden">
                                    <div className="px-5 py-4 bg-gray-50 border-b">
                                        <div className="text-sm font-semibold text-gray-900">Biaya Kas (Tag Kebun)</div>
                                        <div className="text-xs text-gray-500">Menampilkan max 200 baris terbaru. Total mengikuti seluruh data pada periode.</div>
                                    </div>
                                    <div className="w-full overflow-x-auto">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-white">
                                                <tr>
                                                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tanggal</th>
                                                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Deskripsi</th>
                                                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Keterangan</th>
                                                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Jumlah</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {profitDetailLoading ? (
                                                    <tr><td colSpan={4} className="px-5 py-6 text-sm text-gray-500">Memuat...</td></tr>
                                                ) : (profitDetailKas?.data || []).length === 0 ? (
                                                    <tr><td colSpan={4} className="px-5 py-6 text-sm text-gray-500">Tidak ada transaksi kas tag kebun.</td></tr>
                                                ) : (
                                                    (profitDetailKas?.data || []).map((r: any) => (
                                                        <tr key={r.id} className="hover:bg-gray-50/50">
                                                            <td className="px-5 py-3 whitespace-nowrap text-sm text-gray-700">{formatDateId(r.date)}</td>
                                                            <td className="px-5 py-3 text-sm font-medium text-gray-900">{r.deskripsi}</td>
                                                            <td className="px-5 py-3 text-sm text-gray-600">{cleanKeterangan(r.keterangan)}</td>
                                                            <td className="px-5 py-3 whitespace-nowrap text-sm text-gray-900 text-right">{formatCurrency(r.jumlah)}</td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                            <tfoot className="bg-gray-50">
                                                <tr>
                                                    <td className="px-5 py-3 text-right text-xs font-semibold text-gray-600" colSpan={3}>Total</td>
                                                    <td className="px-5 py-3 text-right text-sm font-bold text-gray-900">
                                                        {profitDetailLoading ? '...' : formatCurrency(Number(profitDetailKas?.meta?.totalJumlah || 0))}
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-gray-100 overflow-hidden">
                                    <div className="px-5 py-4 bg-gray-50 border-b">
                                        <div className="text-sm font-semibold text-gray-900">Biaya Gaji</div>
                                        <div className="text-xs text-gray-500">Berdasarkan gajian dengan status FINAL pada periode yang di pilih.</div>
                                    </div>
                                    <div className="w-full overflow-x-auto">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-white">
                                                <tr>
                                                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Periode</th>
                                                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {profitDetailLoading ? (
                                                    <tr><td colSpan={2} className="px-5 py-6 text-sm text-gray-500">Memuat...</td></tr>
                                                ) : (profitDetailGaji?.data || []).length === 0 ? (
                                                    <tr><td colSpan={2} className="px-5 py-6 text-sm text-gray-500">Tidak ada data gajian pada periode.</td></tr>
                                                ) : (
                                                    (profitDetailGaji?.data || []).map((g: any) => {
                                                        const total = Number(g.totalGaji || 0)
                                                        return (
                                                            <tr key={g.id} className="hover:bg-gray-50/50">
                                                                <td className="px-5 py-3 whitespace-nowrap text-sm text-gray-700">{formatDateId(g.tanggalMulai)} - {formatDateId(g.tanggalSelesai)}</td>
                                                                <td className="px-5 py-3 whitespace-nowrap text-sm text-gray-900 text-right">{formatCurrency(total)}</td>
                                                            </tr>
                                                        )
                                                    })
                                                )}
                                            </tbody>
                                            <tfoot className="bg-gray-50">
                                                <tr>
                                                    <td className="px-5 py-3 text-right text-xs font-semibold text-gray-600">Total</td>
                                                    <td className="px-5 py-3 text-right text-sm font-bold text-gray-900">
                                                        {profitDetailLoading ? '...' : formatCurrency(Number(profitDetailGaji?.meta?.totalJumlah || 0))}
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t bg-white flex items-center justify-end">
                            <button
                                type="button"
                                onClick={handleExportProfitDetailPdf}
                                disabled={profitDetailExporting || profitDetailLoading || !profitDetailKebun}
                                className="h-10 w-10 rounded-full border border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50 inline-flex items-center justify-center"
                                title={profitDetailExporting ? 'Exporting...' : 'Export PDF'}
                                aria-label="Export PDF"
                            >
                                <ArrowDownTrayIcon className="h-5 w-5" />
                            </button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </RoleGate>
    );
}
