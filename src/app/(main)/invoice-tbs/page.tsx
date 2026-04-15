 'use client'
 
 import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
 import { Button } from '@/components/ui/button'
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
 import { Input } from '@/components/ui/input'
 import { Skeleton } from '@/components/ui/skeleton'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import InvoiceDetailModal from './detail-modal'
import { 
  ArrowDownTrayIcon, 
  BuildingOffice2Icon, 
  CalendarIcon, 
  DocumentTextIcon, 
  ArrowPathIcon, 
  EyeIcon, 
  TrashIcon,
  BanknotesIcon,
  BuildingOffice2Icon as BuildingOffice2IconSolid,
  PhotoIcon,
  ArrowUpTrayIcon
} from '@heroicons/react/24/outline'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
 
 type PabrikItem = {
   id: number
   perusahaanId?: number | null
   name: string
   address?: string | null
   createdAt: string
   updatedAt: string
 }

 type PerusahaanItem = {
   id: number
   name: string
   address?: string | null
   email?: string | null
   logoUrl?: string | null
 }
 
 type NotaItem = {
   id: number
   tanggalBongkar: string | null
   pabrikSawit: { id: number; name: string }
  timbangan: { netKg: number }
  kebunName: string
  netto: number
   kendaraan: { platNomor: string; merk: string } | null
   supir: { name: string }
   potongan: number
   beratAkhir: number
   hargaPerKg: number
   totalPembayaran: number
   pembayaranAktual?: number | null
 }
 
 const formatCurrency = (num: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num)
 const formatNumber = (num: number) => new Intl.NumberFormat('id-ID').format(num)
 
 const DEFAULT_COMPANY = {
   name: 'CV. SARAKAN JAYA',
   address: 'JL Peutua Hamzah, PB Teungoh, Langsa Barat, Kota Langsa, Aceh',
   email: 'sarakanjayalangsaa@gmail.com',
   logoUrl: '',
 }
 
const toTerbilang = (num: number) => {
  const satuan = ['','Satu','Dua','Tiga','Empat','Lima','Enam','Tujuh','Delapan','Sembilan','Sepuluh','Sebelas']
  const f = (n: number): string => {
    if (n < 12) return satuan[n]
    if (n < 20) return f(n - 10) + ' Belas'
    if (n < 100) return f(Math.floor(n / 10)) + ' Puluh ' + f(n % 10)
    if (n < 200) return 'Seratus ' + f(n - 100)
    if (n < 1000) return f(Math.floor(n / 100)) + ' Ratus ' + f(n % 100)
    if (n < 2000) return 'Seribu ' + f(n - 1000)
    if (n < 1000000) return f(Math.floor(n / 1000)) + ' Ribu ' + f(n % 1000)
    if (n < 1000000000) return f(Math.floor(n / 1000000)) + ' Juta ' + f(n % 1000000)
    if (n < 1000000000000) return f(Math.floor(n / 1000000000)) + ' Miliar ' + f(n % 1000000000)
    return f(Math.floor(n / 1000000000000)) + ' Triliun ' + f(n % 1000000000000)
  }
  const cleaned = f(Math.floor(num)).replace(/\s+/g,' ').trim()
  return cleaned ? cleaned : 'Nol'
}
 
 export default function InvoiceTbsPage() {
   const [pabrikList, setPabrikList] = useState<PabrikItem[]>([])
   const [loadingPabrik, setLoadingPabrik] = useState(false)
   const [perusahaanList, setPerusahaanList] = useState<PerusahaanItem[]>([])
   const [loadingPerusahaan, setLoadingPerusahaan] = useState(false)
   const [selectedPerusahaanId, setSelectedPerusahaanId] = useState<string>('')
   const [selectedPabrikId, setSelectedPabrikId] = useState<string>('')
   const [month, setMonth] = useState<string>(() => {
     const d = new Date()
     const m = String(d.getMonth() + 1).padStart(2, '0')
     const y = d.getFullYear()
     return `${y}-${m}`
   })
   const [data, setData] = useState<NotaItem[]>([])
   const [loading, setLoading] = useState(false)
   const printRef = useRef<HTMLDivElement>(null)
  const [noSurat, setNoSurat] = useState<string>('')
  const [perihal, setPerihal] = useState<string>('Permohonan Pembayaran')
  const [ditujukanKe, setDitujukanKe] = useState<string>('')
  const [lokasiTujuan, setLokasiTujuan] = useState<string>('')
  const [tanggalSurat, setTanggalSurat] = useState<string>('')
  const [ppnPct, setPpnPct] = useState<number>(10)
  const [pph22Pct, setPph22Pct] = useState<number>(0.25)
  const [bankInfo, setBankInfo] = useState<string>('BSI KC.Langsa no rek 93.93.93.03.03 a.n CV SARAKAN JAYA')
  const [penandatangan, setPenandatangan] = useState<string>('Muhammad Aiyub')
  const [jabatanTtd, setJabatanTtd] = useState<string>('Direktur')
  const [rows, setRows] = useState<Array<{ id: number; bulan: string; jumlahKg: number; harga: number; jumlahRp: number }>>([])
  const [letterName, setLetterName] = useState<string>(DEFAULT_COMPANY.name)
  const [letterAddress, setLetterAddress] = useState<string>(DEFAULT_COMPANY.address)
  const [letterEmail, setLetterEmail] = useState<string>(DEFAULT_COMPANY.email)
   const [letterLogoUrl, setLetterLogoUrl] = useState<string>(DEFAULT_COMPANY.logoUrl)
   const [savedInvoices, setSavedInvoices] = useState<any[]>([])
   const [loadingSaved, setLoadingSaved] = useState(false)
   const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
   const [detailModalOpen, setDetailModalOpen] = useState(false)
   const [selectedInvoiceForDetail, setSelectedInvoiceForDetail] = useState<any | null>(null)
  const [detailShowPdf, setDetailShowPdf] = useState(false)
  const [signedPdfFilter, setSignedPdfFilter] = useState<'all' | 'with' | 'without'>('all')
  const [detailMode, setDetailMode] = useState<'per_hari' | 'group_harga'>('per_hari')
 
   const loadPabrik = useCallback(async () => {
     setLoadingPabrik(true)
     try {
       const res = await fetch('/api/pabrik-sawit?limit=1000')
       const json = await res.json()
       const items = (json.data || []).map((p: any) => ({
         ...p,
         perusahaanId: p.perusahaanId,
         createdAt: new Date(p.createdAt).toISOString(),
         updatedAt: new Date(p.updatedAt).toISOString(),
       }))
       setPabrikList(items)
     } catch {
       toast.error('Gagal mengambil daftar pabrik')
     } finally {
       setLoadingPabrik(false)
     }
   }, [])
 
   const loadPerusahaan = useCallback(async () => {
     setLoadingPerusahaan(true)
     try {
       const res = await fetch('/api/perusahaan?limit=1000')
       const json = await res.json()
       setPerusahaanList(json.data || [])
     } catch {
       toast.error('Gagal mengambil daftar perusahaan')
     } finally {
       setLoadingPerusahaan(false)
     }
   }, [])

   const loadSavedInvoices = useCallback(async () => {
     setLoadingSaved(true)
     try {
       const params = new URLSearchParams()
       if (selectedPabrikId) params.set('pabrikId', selectedPabrikId)
       const res = await fetch(`/api/invoice-tbs?${params.toString()}`)
       const json = await res.json()
       setSavedInvoices(json.data || [])
     } catch {
       console.error('Failed to load saved invoices')
     } finally {
       setLoadingSaved(false)
     }
   }, [selectedPabrikId])

  const filteredSavedInvoices = useMemo(() => {
    if (signedPdfFilter === 'all') return savedInvoices
    if (signedPdfFilter === 'with') return savedInvoices.filter(inv => !!inv.signedPdfUrl)
    return savedInvoices.filter(inv => !inv.signedPdfUrl)
  }, [savedInvoices, signedPdfFilter])
 
   useEffect(() => {
     loadPabrik()
     loadPerusahaan()
     loadSavedInvoices()
   }, [loadPabrik, loadPerusahaan, loadSavedInvoices])
 
   const filteredPabrikList = useMemo(() => {
      if (!selectedPerusahaanId || selectedPerusahaanId === 'all') return pabrikList
      return pabrikList.filter(p => String(p.perusahaanId) === selectedPerusahaanId)
    }, [pabrikList, selectedPerusahaanId])
 
   const handlePerusahaanChange = (val: string) => {
      setSelectedPerusahaanId(val)
      setSelectedPabrikId('')
      if (val === 'all') {
        setLetterName(DEFAULT_COMPANY.name)
        setLetterAddress(DEFAULT_COMPANY.address)
        setLetterEmail(DEFAULT_COMPANY.email)
        setLetterLogoUrl(DEFAULT_COMPANY.logoUrl)
        return
      }
      const p = perusahaanList.find(x => String(x.id) === val)
      if (p) {
        setLetterName(p.name || '')
        setLetterAddress(p.address || '')
        setLetterEmail(p.email || '')
        setLetterLogoUrl(p.logoUrl || '')
      }
    }

  const handlePabrikChange = useCallback((val: string) => {
    setSelectedPabrikId(val)
    const p = pabrikList.find(x => String(x.id) === val)
    if (p) {
      setDitujukanKe(p.name || '')
      setLokasiTujuan(p.address || '')
    }
  }, [pabrikList])

   const startEnd = useMemo(() => {
     if (!month) return { start: null as Date | null, end: null as Date | null }
     const [y, m] = month.split('-').map(Number)
     const start = new Date(y, m - 1, 1)
     const end = new Date(y, m, 0)
     end.setHours(23, 59, 59, 999)
     return { start, end }
   }, [month])
 
   const fetchData = useCallback(async () => {
     if (!selectedPabrikId || !month) {
       setData([])
       return
     }
     setLoading(true)
     try {
       const params = new URLSearchParams()
       if (startEnd.start) params.set('startDate', startEnd.start.toISOString())
       if (startEnd.end) params.set('endDate', startEnd.end.toISOString())
       params.set('pabrikId', selectedPabrikId)
       const res = await fetch(`/api/nota-sawit?${params.toString()}`)
       const json = await res.json()
       const list = Array.isArray(json) ? json : json.data
      const mapped: NotaItem[] = (list || []).map((n: any) => {
        const kebunName = n.timbangan?.kebun?.name || n.kebun?.name || n.kebunName || '-'
        return {
          id: n.id,
          tanggalBongkar: n.tanggalBongkar ? new Date(n.tanggalBongkar).toISOString() : null,
          pabrikSawit: { id: n.pabrikSawit?.id, name: n.pabrikSawit?.name },
          timbangan: { netKg: n.timbangan?.netKg || 0 },
          kebunName,
          netto: (typeof n.netto === 'number' ? n.netto : (n.timbangan?.netKg || 0)),
          kendaraan: n.kendaraan ? { platNomor: n.kendaraan.platNomor, merk: n.kendaraan.merk } : null,
          supir: { name: n.supir?.name || '-' },
          potongan: n.potongan || 0,
          beratAkhir: n.beratAkhir || 0,
          hargaPerKg: n.hargaPerKg || 0,
          totalPembayaran: n.totalPembayaran || 0,
          pembayaranAktual: n.pembayaranAktual ?? null,
        }
      })
       setData(mapped)
      const [yy, mm] = month.split('-').map(Number)
      const label = `${String(mm).padStart(2,'0')}/${yy}`
      const r = mapped.map(n => {
        const kg = n.beratAkhir || n.timbangan.netKg
        const harga = n.hargaPerKg || 0
        const jumlah = Math.round(kg * harga)
        const hariLabel = n.tanggalBongkar ? format(new Date(n.tanggalBongkar), 'dd/MM/yyyy', { locale: idLocale }) : label
        return { id: n.id, bulan: hariLabel, jumlahKg: kg, harga, jumlahRp: jumlah }
      })
      setRows(r)
     } catch {
       toast.error('Gagal mengambil data invoice')
     } finally {
       setLoading(false)
     }
   }, [selectedPabrikId, month, startEnd.start, startEnd.end])
 
   useEffect(() => {
     fetchData()
   }, [fetchData])
 
   const totals = useMemo(() => {
    const base = rows.reduce((acc, r) => {
      acc.totalKg += r.jumlahKg
      acc.totalRp += r.jumlahRp
      return acc
    }, { totalKg: 0, totalRp: 0 })
    const ppn = Math.round((ppnPct / 100) * base.totalRp)
    const pph22 = Math.round((pph22Pct / 100) * base.totalRp)
    const grand = base.totalRp + ppn - pph22
    return { totalKg: base.totalKg, totalRp: base.totalRp, ppn, pph22, grand }
  }, [rows, ppnPct, pph22Pct])

  const loadInvoiceToForm = useCallback(async (inv: any) => {
    try {
      const id = typeof inv === 'object' ? inv.id : inv
      const res = await fetch(`/api/invoice-tbs/${id}`)
      const json = await res.json()
      if (!json.data) throw new Error('Data not found')
      const data = json.data
      if (String(data.status).toUpperCase() === 'FINALIZED') {
        toast.error('Invoice sudah FINALIZED. Batalkan invoice untuk mengedit.')
        return
      }

      setSelectedPabrikId(String(data.pabrikId))
      setSelectedPerusahaanId(data.perusahaanId ? String(data.perusahaanId) : 'all')
      setMonth(`${data.year}-${String(data.month).padStart(2, '0')}`)
      setNoSurat(data.number)
      setPerihal(data.perihal)
      setDitujukanKe(data.tujuan || '')
      setLokasiTujuan(data.lokasiTujuan || '')
      setTanggalSurat(data.tanggalSurat ? new Date(data.tanggalSurat).toISOString().split('T')[0] : '')
      setDetailMode((data.detailMode as any) || 'per_hari')
      setPpnPct(data.ppnPct)
      setPph22Pct(data.pph22Pct)
      setBankInfo(data.bankInfo || '')
      setPenandatangan(data.penandatangan || '')
      setJabatanTtd(data.jabatanTtd || '')
      setLetterName(data.letterName || '')
      setLetterAddress(data.letterAddress || '')
      setLetterEmail(data.letterEmail || '')
      setLetterLogoUrl(data.letterLogoUrl || '')
      
      if (data.items) {
        setRows(data.items.map((it: any) => ({
          id: it.id,
          bulan: it.bulanLabel,
          jumlahKg: it.jumlahKg,
          harga: it.harga,
          jumlahRp: it.jumlahRp,
          notaSawitId: it.notaSawitId
        })))
      }
      toast.success('Data invoice dimuat ke formulir')
      setDetailModalOpen(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      toast.error('Gagal memuat detail invoice')
    }
  }, [])

  const handleOpenDetail = useCallback(async (inv: any) => {
    try {
      const res = await fetch(`/api/invoice-tbs/${inv.id}`)
      const json = await res.json()
      if (json.data) {
        setSelectedInvoiceForDetail(json.data)
        setDetailShowPdf(false)
        setDetailModalOpen(true)
      }
    } catch {
      toast.error('Gagal memuat detail invoice')
    }
  }, [])
  
  const handleOpenSignedPdf = useCallback(async (inv: any) => {
    try {
      const res = await fetch(`/api/invoice-tbs/${inv.id}`)
      const json = await res.json()
      if (json.data) {
        setSelectedInvoiceForDetail(json.data)
        setDetailShowPdf(true)
        setDetailModalOpen(true)
      }
    } catch {
      toast.error('Gagal membuka PDF tertandatangani')
    }
  }, [])
 
  const generatePdf = useCallback(async (params: {
    letterName: string,
    letterAddress: string,
    letterEmail: string,
    letterLogoUrl: string,
    noSurat: string,
    tanggalSurat: string,
    perihal: string,
    ditujukanKe: string,
    lokasiTujuan: string,
    pabrikName: string,
    periodLabel: string,
    rows: any[],
    detailMode?: 'per_hari' | 'group_harga',
    totals: any,
    bankInfo: string,
    penandatangan: string,
    jabatanTtd: string,
    y: number,
    m: number
  }) => {
    try {
      const jsPDF = (await import('jspdf')).default
      const autoTable = (await import('jspdf-autotable')).default
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const margin = 20
      const pageWidth = doc.internal.pageSize.width
      const contentWidth = pageWidth - (margin * 2)
      
      try {
        if (params.letterLogoUrl) {
          const img = await fetch(params.letterLogoUrl).then(r => r.blob()).catch(() => null)
          if (img) {
            const reader = await new Promise<string>((resolve) => {
              const fr = new FileReader()
              fr.onload = () => resolve(fr.result as string)
              fr.readAsDataURL(img)
            })
            doc.addImage(reader, 'PNG', margin + 10, 10, 20, 20)
          }
        }
      } catch {}

      // Kop Surat Layout - Selalu Tengah (Centered)
      const textStartX = pageWidth / 2
      const textAlignCenter = 'center'

      doc.setFontSize(20)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(30, 41, 59) // Slate 800
      doc.text(params.letterName || 'CV. SARAKAN JAYA', textStartX, 16, { align: textAlignCenter })
      
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(71, 85, 105) // Slate 600
      
      let currentYHeader = 21
      if (params.letterAddress) {
        const splitAddress = doc.splitTextToSize(params.letterAddress, contentWidth - 80) // Lebih sempit agar kompak
        doc.text(splitAddress, textStartX, currentYHeader, { align: textAlignCenter })
        currentYHeader += (splitAddress.length * 5)
      }
      
      if (params.letterEmail) {
        doc.text(`Email: ${params.letterEmail}`, textStartX, currentYHeader, { align: textAlignCenter })
        currentYHeader += 5.5
      }
      
      const lineY = Math.max(currentYHeader + 1.5, 31)
      doc.setDrawColor(0, 0, 0) // Hitam pekat
      doc.setLineWidth(0.8) // Garis satu penuh
      doc.line(margin, lineY, pageWidth - margin, lineY) // Garis lurus horizontal
      
      doc.setTextColor(30, 41, 59)
      doc.setFontSize(10)
      autoTable(doc, {
        body: [
          ['Nomor', `: ${params.noSurat}`],
          ['Hal', `: ${params.perihal}`],
        ],
        startY: lineY + 4,
        margin: { left: margin, right: margin },
        styles: { halign: 'left', fontSize: 10, cellPadding: 1, textColor: [30, 41, 59] },
        theme: 'plain',
        columnStyles: { 
          0: { cellWidth: 15 }, // Perkecil lebar kolom label agar titik dua lebih dekat
          1: { cellWidth: contentWidth - 15 } 
        },
      })
      
      const currentY = (doc as any).lastAutoTable.finalY + 8
      doc.setFont('helvetica', 'bold')
      doc.text(`Kepada Yth. ${params.ditujukanKe}`, margin, currentY)
      doc.setFont('helvetica', 'normal')
      doc.text(`Di ${params.lokasiTujuan}`, margin, currentY + 5)
      doc.text('Dengan Hormat,', margin, currentY + 13)
      
      const introText = `Dengan surat ini kami memohon pembayaran TBS ke ${params.pabrikName} periode ${params.periodLabel} dengan rincian:`
      const splitIntro = doc.splitTextToSize(introText, contentWidth)
      doc.text(splitIntro, margin, currentY + 19)
      
      let tableRows = params.rows
      if (params.detailMode === 'group_harga') {
        const grouped = Object.values(
          tableRows.reduce((acc: Record<string, { harga: number; jumlahKg: number; jumlahRp: number }>, r: any) => {
            const key = String(r.harga)
            if (!acc[key]) acc[key] = { harga: r.harga, jumlahKg: 0, jumlahRp: 0 }
            acc[key].jumlahKg += r.jumlahKg
            acc[key].jumlahRp += r.jumlahRp
            return acc
          }, {})
        ).map(g => ({ bulan: params.periodLabel, harga: g.harga, jumlahKg: g.jumlahKg, jumlahRp: Math.round(g.jumlahKg * g.harga) }))
        tableRows = grouped
      } else if (params.detailMode === 'per_hari') {
        // Gabung murni per tanggal: jumlahkan Kg saja, lalu jumlahRp = totalKg * harga (harga dari nota)
        const groupedMap = tableRows.reduce((acc: Record<string, { bulan: string; jumlahKg: number; harga: number }>, r: any) => {
          const key = String(r.bulan)
          const cur = acc[key] || { bulan: r.bulan, jumlahKg: 0, harga: 0 }
          cur.jumlahKg += Number(r.jumlahKg || 0)
          if (!cur.harga) cur.harga = Number(r.harga || 0)
          acc[key] = cur
          return acc
        }, {})
        const grouped = Object.values(groupedMap).map(g => ({
          bulan: g.bulan,
          jumlahKg: g.jumlahKg,
          harga: g.harga,
          jumlahRp: Math.round(g.jumlahKg * g.harga),
        }))
        tableRows = grouped
      }

      const tableBody = tableRows.map((r: any, idx: number) => [
        idx + 1,
        r.bulan,
        formatNumber(r.jumlahKg),
        formatCurrency(r.harga),
        formatCurrency(r.jumlahRp),
      ])
      
      autoTable(doc, {
        head: [['No', 'Bulan/Tahun', 'Jumlah (Kg)', 'Harga (Rp)', 'Jumlah (Rp)']],
        body: [...tableBody, [{ content: 'TOTAL', colSpan: 2, styles: { fontStyle: 'bold', halign: 'left' } }, { content: formatNumber(params.totals.totalKg), styles: { fontStyle: 'bold', halign: 'left' } }, '', { content: formatCurrency(params.totals.totalRp), styles: { fontStyle: 'bold', halign: 'left' } }]],
        startY: currentY + 25 + (splitIntro.length * 4.5),
        margin: { left: margin, right: margin },
        styles: { fontSize: 10, cellPadding: 3, overflow: 'linebreak', halign: 'left' },
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'left' },
        columnStyles: {
          0: { cellWidth: 12, halign: 'left' }, // Perlebar sedikit agar "No" tidak turun
          1: { cellWidth: 48, halign: 'left' }, // Kurangi sedikit untuk kompensasi
          2: { cellWidth: 35, halign: 'left' },
          3: { cellWidth: 40, halign: 'left' },
          4: { cellWidth: 35, halign: 'left' },
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      })
      
      const summaryStartY = (doc as any).lastAutoTable.finalY + 2
      autoTable(doc, {
        body: [
          ['Ditambah : PPN', formatCurrency(params.totals.ppn)],
          ['Dikurangi PPH Pasal 22', formatCurrency(params.totals.pph22)],
          [{ content: 'Total Pembayaran', styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }, { content: formatCurrency(params.totals.grand), styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }],
        ],
        startY: summaryStartY,
        margin: { left: margin, right: margin },
        styles: { fontSize: 10, cellPadding: 3, halign: 'left' }, // Padding disamakan (3) agar teks Rp sejajar vertikal
        theme: 'plain', // Menghilangkan border kotak agar lebih modern dan konsisten
        columnStyles: { 
          0: { cellWidth: 135, halign: 'left' }, 
          1: { cellWidth: 35, halign: 'left' } 
        },
      })
      
      const footerY = (doc as any).lastAutoTable.finalY + 10
      doc.setFontSize(10)
      doc.setTextColor(0, 0, 0) // Hitam pekat
      doc.setFont('helvetica', 'bold') // Bold
      const terbilangText = `Terbilang: "${toTerbilang(params.totals.grand)} Rupiah"`
      const splitTerbilang = doc.splitTextToSize(terbilangText, contentWidth)
      doc.text(splitTerbilang, margin, footerY)
      
      doc.setFont('helvetica', 'normal') // Reset ke normal untuk teks berikutnya
      doc.setTextColor(30, 41, 59)
      const nextFooterY = footerY + (splitTerbilang.length * 6) + 4
      doc.setFont('helvetica', 'italic')
      doc.text(`Pembayaran dapat ditransfer ke ${params.bankInfo}`, margin, nextFooterY)
      doc.setFont('helvetica', 'normal')
      doc.text('Atas kerja sama yang baik kami ucapkan terima kasih.', margin, nextFooterY + 6)
      
      const tglY = nextFooterY + 18
      const tgl = params.tanggalSurat ? format(new Date(params.tanggalSurat), 'dd MMMM yyyy', { locale: idLocale }) : format(new Date(params.y, params.m - 1, 1), 'dd MMMM yyyy', { locale: idLocale })
      doc.text(`Langsa, ${tgl}`, margin, tglY)
      doc.text(params.letterName || 'CV. SARAKAN JAYA', margin, tglY + 6)
      
      doc.setFont('helvetica', 'bold')
      doc.text(params.penandatangan, margin, tglY + 45) // Ditinggikan untuk ruang materai 10rb
      doc.setFont('helvetica', 'normal')
      doc.text(params.jabatanTtd, margin, tglY + 51)
      
      doc.save(`invoice-tbs-${params.pabrikName}-${params.y}-${String(params.m).padStart(2, '0')}.pdf`)
    } catch (e) {
      console.error(e)
      toast.error('Gagal mengekspor PDF')
    }
  }, [])

  const handleExportPdf = useCallback(async () => {
     if (!selectedPabrikId || !month || !data.length) {
       toast.error('Pilih pabrik dan bulan, serta pastikan data tersedia')
       return
     }
     const pabrikName = pabrikList.find(p => String(p.id) === String(selectedPabrikId))?.name || '-'
     const [y, m] = month.split('-').map(Number)
     const periodLabel = format(new Date(y, m - 1, 1), 'MMMM yyyy', { locale: idLocale })
     const nomorLabel = noSurat || `INV-${pabrikName.replace(/\s+/g, '').toUpperCase()}-${y}${String(m).padStart(2, '0')}`
     
      await generatePdf({
       letterName, letterAddress, letterEmail, letterLogoUrl,
       noSurat: nomorLabel, tanggalSurat, perihal, ditujukanKe, lokasiTujuan,
        pabrikName, periodLabel, rows, detailMode, totals, bankInfo,
       penandatangan, jabatanTtd, y, m
     })
  }, [selectedPabrikId, month, data, pabrikList, totals, noSurat, tanggalSurat, perihal, ditujukanKe, lokasiTujuan, bankInfo, penandatangan, jabatanTtd, rows, letterName, letterAddress, letterEmail, letterLogoUrl, generatePdf, detailMode])

  const handleExportSpecificPdf = useCallback(async (inv: any) => {
    try {
      const res = await fetch(`/api/invoice-tbs/${inv.id}`)
      const json = await res.json()
      if (!json.data) throw new Error('Detail not found')
      const data = json.data
      const pName = data.pabrik?.name || '-'
      const periodLabel = format(new Date(data.year, data.month - 1, 1), 'MMMM yyyy', { locale: idLocale })
      
      const mappedRows = (data.items || []).map((it: any) => ({
        id: it.id,
        bulan: it.bulanLabel,
        jumlahKg: it.jumlahKg,
        harga: it.harga,
        jumlahRp: it.jumlahRp,
      }))

      const t = {
        totalKg: data.totalKg,
        totalRp: data.totalRp,
        ppn: data.totalPpn,
        pph22: data.totalPph22,
        grand: data.grandTotal
      }

      await generatePdf({
        letterName: data.letterName,
        letterAddress: data.letterAddress || '',
        letterEmail: data.letterEmail || '',
        letterLogoUrl: data.letterLogoUrl || '',
        noSurat: data.number,
        tanggalSurat: data.tanggalSurat || '',
        perihal: data.perihal,
        ditujukanKe: data.tujuan || '',
        lokasiTujuan: data.lokasiTujuan || '',
        pabrikName: pName,
        periodLabel,
        rows: mappedRows,
        detailMode: (data.detailMode as any) || 'per_hari',
        totals: t,
        bankInfo: data.bankInfo || '',
        penandatangan: data.penandatangan || '',
        jabatanTtd: data.jabatanTtd || '',
        y: data.year,
        m: data.month
      })
    } catch (e) {
      toast.error('Gagal mendownload PDF')
    }
   }, [generatePdf])

   const handleDeleteInvoice = useCallback(async () => {
     if (!deleteConfirmId) return
     try {
       const res = await fetch(`/api/invoice-tbs/${deleteConfirmId}`, { method: 'DELETE' })
       if (!res.ok) throw new Error('Gagal menghapus')
       toast.success('Invoice dihapus')
       setDeleteConfirmId(null)
       loadSavedInvoices()
     } catch {
       toast.error('Gagal menghapus')
     }
   }, [deleteConfirmId, loadSavedInvoices])

 
   const headerTitle = useMemo(() => {
     const pName = pabrikList.find(p => String(p.id) === String(selectedPabrikId))?.name || '-'
     const [y, m] = month.split('-').map(Number)
     const periodLabel = format(new Date(y, m - 1, 1), 'MMMM yyyy', { locale: idLocale })
     return `Invoice TBS - ${pName} (${periodLabel})`
   }, [selectedPabrikId, month, pabrikList])
 
   return (
     <div className="flex flex-col gap-6 p-4 md:p-6 max-w-7xl mx-auto w-full min-h-screen bg-gray-50/50">
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
         <div className="flex items-center gap-4">
           <div className="h-12 w-12 rounded-2xl bg-blue-50 flex items-center justify-center border border-blue-100 shadow-sm">
             <BuildingOffice2Icon className="h-6 w-6 text-blue-600" />
           </div>
           <div>
             <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{headerTitle}</h1>
             <p className="text-sm text-gray-500 font-medium">Buat dan kelola invoice TBS bulanan</p>
           </div>
         </div>
       </div>
       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
         <div className="space-y-1.5">
           <label className="text-xs font-bold text-gray-500 uppercase ml-1">Perusahaan</label>
           {loadingPerusahaan ? (
             <Skeleton className="h-10 w-full rounded-xl" />
           ) : (
             <Select value={selectedPerusahaanId} onValueChange={handlePerusahaanChange}>
               <SelectTrigger className="w-full h-11 rounded-xl border-gray-200 focus:ring-blue-500/20 transition-all">
                 <SelectValue placeholder="Pilih perusahaan" />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="all">Semua Perusahaan</SelectItem>
                 {perusahaanList.map((p) => (
                   <SelectItem key={p.id} value={String(p.id)}>
                     {p.name}
                   </SelectItem>
                 ))}
               </SelectContent>
             </Select>
           )}
         </div>
         <div className="space-y-1.5">
           <label className="text-xs font-bold text-gray-500 uppercase ml-1">Pabrik</label>
           {loadingPabrik ? (
             <Skeleton className="h-10 w-full rounded-xl" />
           ) : (
             <Select value={selectedPabrikId} onValueChange={handlePabrikChange}>
               <SelectTrigger className="w-full h-11 rounded-xl border-gray-200 focus:ring-blue-500/20 transition-all">
                 <SelectValue placeholder="Pilih pabrik" />
               </SelectTrigger>
               <SelectContent>
                 {filteredPabrikList.map((p) => (
                   <SelectItem key={p.id} value={String(p.id)}>
                     {p.name}
                   </SelectItem>
                 ))}
               </SelectContent>
             </Select>
           )}
         </div>
         <div className="space-y-1.5">
           <label className="text-xs font-bold text-gray-500 uppercase ml-1">Bulan</label>
           <div className="relative">
             <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 z-10" />
             <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-11 pl-10 rounded-xl border-gray-200 focus:ring-blue-500/20 transition-all" />
           </div>
         </div>
         <div className="flex items-end">
          <Button onClick={fetchData} className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 shadow-md transition-all active:scale-95 font-semibold">
             Muat Data
           </Button>
         </div>
       </div>
 
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600 w-full sm:w-auto">
          <div className="flex flex-col sm:flex-row sm:gap-2">
            <span className="text-gray-400">Total Kg:</span>
            <span className="font-bold text-gray-900">{formatNumber(totals.totalKg)}</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:gap-2">
            <span className="text-gray-400">Total Rp:</span>
            <span className="font-bold text-gray-900">{formatCurrency(totals.totalRp)}</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:gap-2">
            <span className="text-gray-400">PPN:</span>
            <span className="font-bold text-gray-900">{formatCurrency(totals.ppn)}</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:gap-2">
            <span className="text-gray-400">PPH 22:</span>
            <span className="font-bold text-gray-900">{formatCurrency(totals.pph22)}</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:gap-2 sm:col-span-2 lg:col-span-1 border-t sm:border-t-0 pt-2 sm:pt-0 mt-1 sm:mt-0">
            <span className="text-gray-400">Grand Total:</span>
            <span className="font-bold text-blue-600 text-lg sm:text-sm">{formatCurrency(totals.grand)}</span>
          </div>
         </div>
        
       </div>
 
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-2">
        <div className="space-y-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-2">
            <BuildingOffice2Icon className="h-5 w-5 text-blue-500" />
            Informasi Kop Surat & Surat
          </h3>

          {/* Preview Kop Surat */}
          <div className="p-6 border-2 border-dashed border-gray-100 rounded-2xl bg-gray-50/50">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <EyeIcon className="h-3 w-3" />
              Preview Header Kop Surat
            </p>
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm min-h-[120px] relative overflow-hidden flex items-center justify-center">
              {/* Logo on the left (Absolute) */}
              <div className="absolute left-6 top-1/2 -translate-y-1/2 h-20 w-20 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden">
                {letterLogoUrl ? (
                  <img 
                    src={`${letterLogoUrl}?t=${Date.now()}`} 
                    alt="Logo" 
                    className="h-16 w-16 object-contain" 
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = 'https://placehold.co/400x400?text=Error';
                    }}
                  />
                ) : (
                  <PhotoIcon className="h-8 w-8 text-gray-300" />
                )}
              </div>

              <div className="text-center relative z-10 px-24">
                {/* Company Info */}
                <h4 className="text-xl font-black text-gray-900 leading-tight uppercase tracking-tight">{letterName || 'NAMA PERUSAHAAN'}</h4>
                <p className="text-xs text-gray-500 font-medium mt-1 leading-relaxed max-w-lg mx-auto">{letterAddress || 'Alamat Lengkap Perusahaan'}</p>
                <p className="text-xs text-blue-600 font-bold mt-1">Email: {letterEmail || 'email@perusahaan.com'}</p>
              </div>

              {/* Watermark Background */}
              {letterLogoUrl && (
                <div className="absolute right-0 top-1/2 -translate-y-1/2 h-32 w-32 opacity-[0.03] grayscale pointer-events-none flex items-center justify-center">
                  <img src={letterLogoUrl} alt="Watermark" className="h-full w-full object-contain" />
                </div>
              )}
            </div>
            <p className="text-[10px] text-gray-400 mt-2 italic text-center">*Tampilan ini adalah preview header yang akan muncul di PDF</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase ml-1">Nama Perusahaan (Kop)</label>
              <Input value={letterName} onChange={(e) => setLetterName(e.target.value)} className="rounded-xl border-gray-200 h-11" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase ml-1">Email</label>
              <Input value={letterEmail} onChange={(e) => setLetterEmail(e.target.value)} className="rounded-xl border-gray-200 h-11" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase ml-1">Alamat</label>
            <Input value={letterAddress} onChange={(e) => setLetterAddress(e.target.value)} className="rounded-xl border-gray-200 h-11" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase ml-1">Logo Kop Surat</label>
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center overflow-hidden shrink-0">
                {letterLogoUrl ? (
                  <img 
                    src={`${letterLogoUrl}?t=${Date.now()}`} 
                    alt="Logo" 
                    className="h-8 w-8 object-contain" 
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = 'https://placehold.co/100x100?text=ERR';
                    }}
                  />
                ) : (
                  <PhotoIcon className="h-5 w-5 text-gray-300" />
                )}
              </div>
              <div className="flex-1 flex gap-2">
                <Input 
                  value={letterLogoUrl} 
                  onChange={(e) => setLetterLogoUrl(e.target.value)} 
                  placeholder="URL Logo (https://...)" 
                  className="rounded-xl border-gray-200 h-11 flex-1" 
                />
                <label className="cursor-pointer bg-emerald-50 text-emerald-700 border border-emerald-100 px-4 py-2.5 rounded-xl hover:bg-emerald-100 transition-colors flex items-center justify-center shrink-0">
                  <PhotoIcon className="h-5 w-5" />
                  <input 
                    type="file" 
                    className="sr-only" 
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      const formData = new FormData()
                      formData.append('file', file)
                      const loadingToast = toast.loading('Uploading logo...')
                      try {
                        const res = await fetch('/api/upload', { method: 'POST', body: formData })
                        const data = await res.json()
                        if (data.success) {
                          setLetterLogoUrl(data.url)
                          toast.success('Logo berhasil diupload', { id: loadingToast })
                        } else {
                          throw new Error(data.error)
                        }
                      } catch (err) {
                        toast.error('Gagal upload logo', { id: loadingToast })
                      }
                    }}
                  />
                </label>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase ml-1">Nomor Surat</label>
              <Input value={noSurat} onChange={(e) => setNoSurat(e.target.value)} className="rounded-xl border-gray-200 h-11" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase ml-1">Tanggal Surat</label>
              <Input type="date" value={tanggalSurat} onChange={(e) => setTanggalSurat(e.target.value)} className="rounded-xl border-gray-200 h-11" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase ml-1">Perihal</label>
            <Input value={perihal} onChange={(e) => setPerihal(e.target.value)} className="rounded-xl border-gray-200 h-11" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase ml-1">Ditujukan Kepada</label>
              <Input value={ditujukanKe} onChange={(e) => setDitujukanKe(e.target.value)} className="rounded-xl border-gray-200 h-11" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase ml-1">Lokasi Tujuan</label>
              <Input value={lokasiTujuan} onChange={(e) => setLokasiTujuan(e.target.value)} className="rounded-xl border-gray-200 h-11" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase ml-1">PPN (%)</label>
              <Input type="number" value={ppnPct} onChange={(e) => setPpnPct(Number(e.target.value) || 0)} className="rounded-xl border-gray-200 h-11" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase ml-1">PPH 22 (%)</label>
              <Input type="number" value={pph22Pct} onChange={(e) => setPph22Pct(Number(e.target.value) || 0)} className="rounded-xl border-gray-200 h-11" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase ml-1">Info Rekening</label>
            <Input value={bankInfo} onChange={(e) => setBankInfo(e.target.value)} className="rounded-xl border-gray-200 h-11" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase ml-1">Penandatangan</label>
              <Input value={penandatangan} onChange={(e) => setPenandatangan(e.target.value)} className="rounded-xl border-gray-200 h-11" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase ml-1">Jabatan</label>
              <Input value={jabatanTtd} onChange={(e) => setJabatanTtd(e.target.value)} className="rounded-xl border-gray-200 h-11" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          <div className="p-5 border-b border-gray-100">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-emerald-500" />
              Rincian Item Invoice
            </h3>
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">Mode Rincian PDF</span>
              <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
                <button
                  onClick={() => setDetailMode('per_hari')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                    detailMode === 'per_hari'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Per Hari
                </button>
                <button
                  onClick={() => setDetailMode('group_harga')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                    detailMode === 'group_harga'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Gabungan
                </button>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto flex-1">
            <Table>
              <TableHeader className="bg-slate-50 border-b border-slate-200">
                <TableRow className="hover:bg-transparent border-none">
                  <TableHead className="w-12 text-slate-600 font-bold uppercase text-[10px] tracking-wider">No</TableHead>
                  <TableHead className="text-slate-600 font-bold uppercase text-[10px] tracking-wider">Bulan/Tahun</TableHead>
                  <TableHead className="text-right w-36 text-slate-600 font-bold uppercase text-[10px] tracking-wider">Jumlah (Kg)</TableHead>
                  <TableHead className="text-right w-36 text-slate-600 font-bold uppercase text-[10px] tracking-wider">Harga (Rp)</TableHead>
                  <TableHead className="text-right text-slate-600 font-bold uppercase text-[10px] tracking-wider">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-40 text-center text-slate-400 italic bg-white">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <CalendarIcon className="h-8 w-8 opacity-20" />
                        <p>Tidak ada data untuk periode ini</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r, idx) => (
                    <TableRow key={r.id} className="group hover:bg-blue-50/30 transition-colors border-slate-100">
                      <TableCell className="text-slate-400 font-medium text-xs">{idx + 1}</TableCell>
                      <TableCell className="font-bold text-slate-700">{r.bulan}</TableCell>
                      <TableCell className="text-right">
                        <div className="relative group/input">
                          <Input
                            value={r.jumlahKg}
                            type="number"
                            onChange={(e) => {
                              const v = Number(e.target.value) || 0
                              setRows(prev => prev.map(x => x.id === r.id ? { ...x, jumlahKg: v, jumlahRp: Math.round(v * x.harga) } : x))
                            }}
                            className="h-10 text-right rounded-xl border-slate-200 focus:border-blue-400 focus:ring-blue-400/10 transition-all font-semibold text-slate-700"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-300 group-focus-within/input:text-blue-400 pointer-events-none">KG</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="relative group/input">
                          <Input
                            value={r.harga}
                            type="number"
                            onChange={(e) => {
                              const v = Number(e.target.value) || 0
                              setRows(prev => prev.map(x => x.id === r.id ? { ...x, harga: v, jumlahRp: Math.round(x.jumlahKg * v) } : x))
                            }}
                            className="h-10 text-right rounded-xl border-slate-200 focus:border-blue-400 focus:ring-blue-400/10 transition-all font-semibold text-slate-700"
                          />
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-300 group-focus-within/input:text-blue-400 pointer-events-none">Rp</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                          <span className="text-sm font-black text-blue-600">{formatCurrency(r.jumlahRp)}</span>
                          <span className="text-[10px] text-slate-400 font-medium group-hover:text-blue-400 transition-colors">Terhitung Otomatis</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {rows.length > 0 && (
            <div className="p-5 bg-gradient-to-br from-slate-50 to-white border-t border-slate-200 flex justify-between items-center shadow-[0_-4px_12px_-4px_rgba(0,0,0,0.05)]">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center border border-blue-200 shadow-sm">
                  <BanknotesIcon className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ringkasan Rincian</p>
                  <p className="text-sm font-bold text-slate-700">Total Akumulasi</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400 font-bold mb-0.5 tracking-tight">{formatNumber(totals.totalKg)} <span className="text-[10px] opacity-60">KG</span></p>
                <p className="text-2xl font-black text-blue-600 tracking-tighter drop-shadow-sm">{formatCurrency(totals.totalRp)}</p>
              </div>
            </div>
          )}
          <div className="p-3 flex flex-col sm:flex-row gap-3 sm:justify-end">
            <Button
              onClick={async () => {
                if (!selectedPabrikId || !month) { toast.error('Pilih pabrik dan bulan'); return }
                const [yy, mm] = month.split('-').map(Number)
                const payload = {
                  pabrikId: Number(selectedPabrikId),
                  perusahaanId: selectedPerusahaanId && selectedPerusahaanId !== 'all' ? Number(selectedPerusahaanId) : null,
                  year: yy,
                  month: mm,
                  status: 'DRAFT',
                  tanggalSurat: tanggalSurat || undefined,
                  perihal,
                  letterName,
                  letterAddress,
                  letterEmail,
                  letterLogoUrl,
                  tujuan: ditujukanKe,
                  lokasiTujuan,
                  detailMode,
                  ppnPct,
                  pph22Pct,
                  bankInfo,
                  penandatangan,
                  jabatanTtd,
                  rows: rows.map(r => ({ ...r })),
                  number: noSurat || undefined,
                }
                const res = await fetch('/api/invoice-tbs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
                const json = await res.json()
                if (!res.ok || json.error) { toast.error(json.error || 'Gagal menyimpan draft'); return }
                toast.success('Draft invoice tersimpan')
                loadSavedInvoices()
              }}
              className="rounded-full w-full sm:w-auto"
              variant="outline"
            >
              Simpan Draft
            </Button>
            <Button
              onClick={async () => {
                if (!selectedPabrikId || !month) { toast.error('Pilih pabrik dan bulan'); return }
                const [yy, mm] = month.split('-').map(Number)
                const payload = {
                  pabrikId: Number(selectedPabrikId),
                  perusahaanId: selectedPerusahaanId && selectedPerusahaanId !== 'all' ? Number(selectedPerusahaanId) : null,
                  year: yy,
                  month: mm,
                  status: 'FINALIZED',
                  tanggalSurat: tanggalSurat || undefined,
                  perihal,
                  letterName,
                  letterAddress,
                  letterEmail,
                  letterLogoUrl,
                  tujuan: ditujukanKe,
                  lokasiTujuan,
                  detailMode,
                  ppnPct,
                  pph22Pct,
                  bankInfo,
                  penandatangan,
                  jabatanTtd,
                  rows: rows.map(r => ({ ...r })),
                  number: noSurat || undefined,
                }
                const res = await fetch('/api/invoice-tbs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
                const json = await res.json()
                if (!res.ok || json.error) { toast.error(json.error || 'Gagal finalisasi'); return }
                toast.success('Invoice difinalisasi')
                loadSavedInvoices()
              }}
              className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto"
            >
              Finalisasi Invoice
            </Button>
          </div>
        </div>
      </div>

       <div ref={printRef} className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
         <div className="p-5 border-b border-gray-100 bg-gray-50/30">
           <h3 className="font-bold text-gray-900 flex items-center gap-2">
             <ArrowDownTrayIcon className="h-5 w-5 text-blue-500" />
             Preview Nota Sawit (Periode Terpilih)
           </h3>
         </div>
        <div className="md:hidden p-4 space-y-3">
          {loading ? (
            [...Array(3)].map((_, i) => (
              <div key={i} className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-56" />
                <Skeleton className="h-14 w-full" />
              </div>
            ))
          ) : data.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center text-sm text-gray-500">
              Tidak ada data nota sawit untuk periode ini
            </div>
          ) : (
            data.map((n, idx) => (
              <div key={n.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="font-semibold text-gray-900">{idx + 1}. {n.kendaraan?.platNomor || '-'}</div>
                    <div className="text-xs text-gray-500">{n.supir.name}</div>
                    <div className="text-xs text-gray-500">{n.kebunName}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tanggal</div>
                    <div className="text-xs font-semibold text-gray-800">{n.tanggalBongkar ? format(new Date(n.tanggalBongkar), 'dd MMM yyyy', { locale: idLocale }) : '-'}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                  <div>
                    <div className="text-gray-400">Netto</div>
                    <div className="font-medium text-gray-800">{formatNumber(n.netto)} Kg</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Potongan</div>
                    <div className="font-medium text-rose-600">-{formatNumber(n.potongan)} Kg</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Berat Akhir</div>
                    <div className="font-medium text-gray-800">{formatNumber(n.beratAkhir)} Kg</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Total</div>
                    <div className="font-semibold text-blue-700">{formatCurrency(n.totalPembayaran)}</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-gray-400">Aktual</div>
                    <div className="font-semibold text-emerald-700">{n.pembayaranAktual != null ? formatCurrency(n.pembayaranAktual) : '-'}</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="hidden md:block overflow-x-auto">
           <Table>
             <TableHeader className="bg-slate-50 border-b border-slate-200">
               <TableRow className="hover:bg-transparent border-none">
                <TableHead className="w-12 text-slate-600 font-bold uppercase text-[10px] tracking-wider">Nomor</TableHead>
                 <TableHead className="min-w-[120px] text-slate-600 font-bold uppercase text-[10px] tracking-wider">Tanggal</TableHead>
                 <TableHead className="text-slate-600 font-bold uppercase text-[10px] tracking-wider">Plat</TableHead>
                 <TableHead className="text-slate-600 font-bold uppercase text-[10px] tracking-wider">Supir</TableHead>
                 <TableHead className="text-slate-600 font-bold uppercase text-[10px] tracking-wider">Kebun</TableHead>
                 <TableHead className="text-right text-slate-600 font-bold uppercase text-[10px] tracking-wider">Netto (Kg)</TableHead>
                 <TableHead className="text-right text-slate-600 font-bold uppercase text-[10px] tracking-wider">Potongan</TableHead>
                 <TableHead className="text-right text-slate-600 font-bold uppercase text-[10px] tracking-wider">Berat Akhir</TableHead>
                 <TableHead className="text-right text-slate-600 font-bold uppercase text-[10px] tracking-wider">Harga/Kg</TableHead>
                 <TableHead className="text-right text-slate-600 font-bold uppercase text-[10px] tracking-wider">Total</TableHead>
                 <TableHead className="text-right text-slate-600 font-bold uppercase text-[10px] tracking-wider">Aktual</TableHead>
               </TableRow>
             </TableHeader>
             <TableBody>
               {loading ? (
                 <TableRow>
                   <TableCell colSpan={11} className="py-16">
                     <div className="flex flex-col items-center justify-center gap-3">
                       <ArrowPathIcon className="h-8 w-8 text-blue-500 animate-spin opacity-50" />
                       <p className="text-sm font-medium text-slate-400">Menghubungkan ke database...</p>
                     </div>
                   </TableCell>
                 </TableRow>
               ) : data.length === 0 ? (
                 <TableRow>
                   <TableCell colSpan={11} className="h-40 text-center text-slate-400 italic bg-white">
                     <div className="flex flex-col items-center justify-center gap-2">
                       <DocumentTextIcon className="h-8 w-8 opacity-20" />
                       <p>Tidak ada data nota sawit untuk periode ini</p>
                     </div>
                   </TableCell>
                 </TableRow>
               ) : (
                 data.map((n, idx) => (
                   <TableRow key={n.id} className="hover:bg-blue-50/30 transition-colors border-slate-100 group">
                     <TableCell className="text-slate-400 font-medium text-xs">{idx + 1}</TableCell>
                     <TableCell className="text-sm font-medium text-slate-600">{n.tanggalBongkar ? format(new Date(n.tanggalBongkar), 'dd MMM yyyy', { locale: idLocale }) : '-'}</TableCell>
                     <TableCell className="font-bold text-slate-900">
                       <span className="px-2 py-1 bg-slate-100 rounded-lg text-xs tracking-tighter group-hover:bg-white transition-colors">{n.kendaraan?.platNomor || '-'}</span>
                     </TableCell>
                     <TableCell className="text-sm text-slate-600">{n.supir.name}</TableCell>
                    <TableCell className="text-sm text-slate-600">{n.kebunName}</TableCell>
                     <TableCell className="text-right text-sm font-medium">{formatNumber(n.netto)}</TableCell>
                     <TableCell className="text-right text-sm text-rose-500 font-medium">-{formatNumber(n.potongan)}</TableCell>
                     <TableCell className="text-right font-bold text-slate-900">{formatNumber(n.beratAkhir)}</TableCell>
                     <TableCell className="text-right text-sm text-slate-500">{formatCurrency(n.hargaPerKg)}</TableCell>
                     <TableCell className="text-right font-black text-blue-600">{formatCurrency(n.totalPembayaran)}</TableCell>
                     <TableCell className="text-right text-sm text-emerald-600 font-bold bg-emerald-50/50 group-hover:bg-emerald-100/50 transition-colors">{n.pembayaranAktual != null ? formatCurrency(n.pembayaranAktual) : '-'}</TableCell>
                   </TableRow>
                 ))
               )}
             </TableBody>
           </Table>
         </div>
       </div>

       {/* Daftar Invoice Tersimpan */}
       <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden mt-6">
        <div className="p-5 border-b border-gray-100 bg-gray-50/30 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <h3 className="font-bold text-gray-900 flex items-center gap-2 min-w-0">
             <DocumentTextIcon className="h-5 w-5 text-blue-500" />
            <span className="leading-tight truncate">
              Daftar Invoice Tersimpan
              <span className="block sm:inline"> (Draft & Final)</span>
            </span>
           </h3>
           <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
              <Select value={signedPdfFilter} onValueChange={(v: 'all' | 'with' | 'without') => setSignedPdfFilter(v)}>
                <SelectTrigger className="h-9 w-full sm:w-[210px] rounded-xl border-gray-200">
                  <SelectValue placeholder="Filter PDF" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua (PDF & Non-PDF)</SelectItem>
                  <SelectItem value="with">Hanya yang ada PDF</SelectItem>
                  <SelectItem value="without">Belum ada PDF</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="sm" onClick={loadSavedInvoices} disabled={loadingSaved} className="w-full sm:w-auto justify-center">
                <ArrowPathIcon className={`h-4 w-4 mr-2 ${loadingSaved ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
         </div>
         <div className="md:hidden p-4 space-y-3">
           {loadingSaved ? (
             [...Array(3)].map((_, i) => (
               <div key={i} className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
                 <Skeleton className="h-4 w-40" />
                 <Skeleton className="h-4 w-56" />
                 <Skeleton className="h-9 w-40" />
               </div>
             ))
           ) : filteredSavedInvoices.length === 0 ? (
             <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center text-sm text-gray-500">
               Tidak ada invoice sesuai filter
             </div>
           ) : (
             filteredSavedInvoices.map((inv) => (
               <div
                 key={inv.id}
                 onClick={() => handleOpenDetail(inv)}
                 className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-3 hover:bg-gray-50/50 transition-colors"
               >
                 <div className="flex items-start justify-between gap-3">
                   <div className="space-y-1">
                     <div className="font-semibold text-gray-900">{inv.number}</div>
                     <div className="text-xs text-gray-500">{inv.pabrik?.name || '-'}</div>
                     <div className="text-xs text-gray-500">{format(new Date(inv.year, inv.month - 1, 1), 'MMMM yyyy', { locale: idLocale })}</div>
                   </div>
                   <div className="flex flex-col items-end gap-1">
                     <span className={`px-3 py-1 rounded-lg text-[10px] font-black tracking-wider uppercase ${
                       inv.status === 'FINALIZED' 
                         ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' 
                         : 'bg-amber-100 text-amber-700 border border-amber-200'
                     }`}>
                       {inv.status}
                     </span>
                     <span className="px-2 py-1 rounded-lg text-[10px] font-black tracking-wider uppercase bg-slate-100 text-slate-700 border border-slate-200">
                       {String(inv.detailMode || 'per_hari') === 'group_harga' ? 'Gabung Harga' : 'Per Hari'}
                     </span>
                   </div>
                 </div>

                 <div className="grid grid-cols-2 gap-2 text-xs">
                   <div>
                     <div className="text-gray-400">Grand Total</div>
                     <div className="font-black text-gray-900">{formatCurrency(inv.grandTotal)}</div>
                   </div>
                   <div className="text-right">
                     <div className="text-gray-400">PDF Ttd</div>
                     <div className={`font-semibold ${inv.signedPdfUrl ? 'text-emerald-700' : 'text-gray-500'}`}>
                       {inv.signedPdfUrl ? 'Ada' : 'Belum'}
                     </div>
                   </div>
                 </div>

                 <div className="flex flex-wrap gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                   <Button size="sm" variant="outline" className="rounded-full" onClick={() => handleOpenDetail(inv)}>
                     Detail
                   </Button>
                   {inv.status === 'FINALIZED' && (
                     <>
                       <Button
                         size="sm"
                         variant="outline"
                         className="rounded-full"
                         disabled={!inv.signedPdfUrl}
                         onClick={() => inv.signedPdfUrl ? handleOpenSignedPdf(inv) : null}
                       >
                         Lihat PDF Ttd
                       </Button>
                       <label className="inline-flex items-center justify-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 cursor-pointer">
                         Upload PDF
                         <input
                           type="file"
                           accept="application/pdf"
                           className="sr-only"
                           onChange={async (e) => {
                             const file = e.target.files?.[0]
                             if (!file) return
                             if (file.type !== 'application/pdf') { toast.error('Harap unggah file PDF'); return }
                             const fd = new FormData()
                             fd.append('file', file)
                             const loadingToast = toast.loading('Mengunggah PDF...')
                             try {
                               const up = await fetch('/api/upload', { method: 'POST', body: fd })
                               const upJson = await up.json()
                               if (!up.ok || !upJson.success) throw new Error(upJson.error || 'Upload gagal')
                               const put = await fetch(`/api/invoice-tbs/${inv.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ signedPdfUrl: upJson.url }) })
                               const putJson = await put.json()
                               if (!put.ok || putJson.error) throw new Error(putJson.error || 'Gagal menyimpan URL PDF')
                               toast.success('PDF tertandatangani berhasil diunggah', { id: loadingToast })
                               loadSavedInvoices()
                               e.target.value = ''
                             } catch (err: any) {
                               toast.error(err?.message || 'Gagal mengunggah PDF', { id: loadingToast })
                             }
                           }}
                         />
                       </label>
                     </>
                   )}
                   <Button size="sm" variant="outline" className="rounded-full" onClick={() => handleExportSpecificPdf(inv)}>
                     Download PDF
                   </Button>
                   <Button size="sm" variant="destructive" className="rounded-full" onClick={() => setDeleteConfirmId(inv.id)}>
                     Hapus
                   </Button>
                 </div>
               </div>
             ))
           )}
         </div>
        <div className="hidden md:block overflow-x-auto">
           <Table>
             <TableHeader className="bg-slate-50 border-b border-slate-200">
               <TableRow className="hover:bg-transparent border-none">
                 <TableHead className="text-slate-600 font-bold uppercase text-[10px] tracking-wider">No. Surat</TableHead>
                 <TableHead className="text-slate-600 font-bold uppercase text-[10px] tracking-wider">Pabrik</TableHead>
                 <TableHead className="text-slate-600 font-bold uppercase text-[10px] tracking-wider">Periode</TableHead>
                 <TableHead className="text-slate-600 font-bold uppercase text-[10px] tracking-wider">Status</TableHead>
                 <TableHead className="text-right text-slate-600 font-bold uppercase text-[10px] tracking-wider">Grand Total</TableHead>
                 <TableHead className="text-right text-slate-600 font-bold uppercase text-[10px] tracking-wider">Aksi</TableHead>
               </TableRow>
             </TableHeader>
             <TableBody>
               {loadingSaved ? (
                 <TableRow>
                   <TableCell colSpan={6} className="py-16 text-center bg-white">
                     <div className="flex flex-col items-center justify-center gap-3">
                       <ArrowPathIcon className="h-8 w-8 text-blue-500 animate-spin opacity-50" />
                       <p className="text-sm font-medium text-slate-400">Memuat arsip invoice...</p>
                     </div>
                   </TableCell>
                 </TableRow>
                ) : filteredSavedInvoices.length === 0 ? (
                 <TableRow>
                   <TableCell colSpan={6} className="h-40 text-center text-slate-400 italic bg-white">
                     <div className="flex flex-col items-center justify-center gap-2">
                       <DocumentTextIcon className="h-8 w-8 opacity-20" />
                        <p>Tidak ada invoice sesuai filter</p>
                     </div>
                   </TableCell>
                 </TableRow>
               ) : (
                filteredSavedInvoices.map((inv) => (
                   <TableRow key={inv.id} className="hover:bg-blue-50/30 transition-colors border-slate-100 group">
                     <TableCell className="font-bold text-blue-600">
                       <span className="hover:underline cursor-pointer" onClick={() => handleOpenDetail(inv)}>{inv.number}</span>
                     </TableCell>
                     <TableCell className="font-medium text-slate-700">{inv.pabrik?.name || '-'}</TableCell>
                     <TableCell className="text-sm text-slate-600">{format(new Date(inv.year, inv.month - 1, 1), 'MMMM yyyy', { locale: idLocale })}</TableCell>
                     <TableCell>
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-lg text-[10px] font-black tracking-wider uppercase ${
                          inv.status === 'FINALIZED' 
                          ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' 
                          : 'bg-amber-100 text-amber-700 border border-amber-200'
                        }`}>
                          {inv.status}
                        </span>
                        <span className="px-2 py-1 rounded-lg text-[10px] font-black tracking-wider uppercase bg-slate-100 text-slate-700 border border-slate-200">
                          {String(inv.detailMode || 'per_hari') === 'group_harga' ? 'Gabung Harga' : 'Per Hari'}
                        </span>
                      </div>
                     </TableCell>
                     <TableCell className="text-right font-black text-slate-900">{formatCurrency(inv.grandTotal)}</TableCell>
                     <TableCell className="text-right">
                       <div className="flex justify-end items-center gap-1.5">
                        <button 
                           onClick={() => handleOpenDetail(inv)} 
                           title="Lihat Detail"
                          className="p-2 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all duration-200 shadow-sm hover:shadow-md active:scale-90"
                         >
                           <EyeIcon className="h-4 w-4" />
                         </button>
                         {inv.status === 'FINALIZED' && (
                           <>
                             <button
                               onClick={() => inv.signedPdfUrl ? handleOpenSignedPdf(inv) : null}
                               title={inv.signedPdfUrl ? 'Lihat PDF Tertandatangani' : 'Belum ada PDF Tertandatangani'}
                               className={`p-2 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md active:scale-90 ${inv.signedPdfUrl ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white' : 'bg-gray-50 text-gray-400 cursor-not-allowed'}`}
                             >
                               <DocumentTextIcon className="h-4 w-4" />
                             </button>
                             <label 
                               title="Upload PDF Tertandatangani"
                               className="p-2 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-600 hover:text-white transition-all duration-200 shadow-sm hover:shadow-md active:scale-90 cursor-pointer"
                             >
                               <ArrowUpTrayIcon className="h-4 w-4" />
                               <input 
                                 type="file" 
                                 accept="application/pdf"
                                 className="sr-only"
                                 onChange={async (e) => {
                                   const file = e.target.files?.[0]
                                   if (!file) return
                                   if (file.type !== 'application/pdf') { toast.error('Harap unggah file PDF'); return }
                                   const fd = new FormData()
                                   fd.append('file', file)
                                   const loadingToast = toast.loading('Mengunggah PDF...')
                                   try {
                                     const up = await fetch('/api/upload', { method: 'POST', body: fd })
                                     const upJson = await up.json()
                                     if (!up.ok || !upJson.success) throw new Error(upJson.error || 'Upload gagal')
                                     const put = await fetch(`/api/invoice-tbs/${inv.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ signedPdfUrl: upJson.url }) })
                                     const putJson = await put.json()
                                     if (!put.ok || putJson.error) throw new Error(putJson.error || 'Gagal menyimpan URL PDF')
                                     toast.success('PDF tertandatangani berhasil diunggah', { id: loadingToast })
                                     loadSavedInvoices()
                                     e.target.value = ''
                                   } catch (err: any) {
                                     toast.error(err?.message || 'Gagal mengunggah PDF', { id: loadingToast })
                                   }
                                 }}
                               />
                             </label>
                           </>
                         )}
                         <button 
                           onClick={() => handleExportSpecificPdf(inv)} 
                           title="Download PDF"
                           className="p-2 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all duration-200 shadow-sm hover:shadow-md active:scale-90"
                         >
                           <ArrowDownTrayIcon className="h-4 w-4" />
                         </button>
                         <button 
                           onClick={() => setDeleteConfirmId(inv.id)}
                           title="Hapus Invoice"
                           className="p-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all duration-200 shadow-sm hover:shadow-md active:scale-90"
                         >
                           <TrashIcon className="h-4 w-4" />
                         </button>
                       </div>
                     </TableCell>
                   </TableRow>
                 ))
               )}
             </TableBody>
           </Table>
         </div>
       </div>

       <ConfirmationModal
          isOpen={!!deleteConfirmId}
          onClose={() => setDeleteConfirmId(null)}
          onConfirm={handleDeleteInvoice}
          title="Hapus Invoice"
          description="Apakah Anda yakin ingin menghapus invoice ini? Data yang dihapus tidak dapat dikembalikan."
        />

      <InvoiceDetailModal
          isOpen={detailModalOpen}
          onClose={() => setDetailModalOpen(false)}
          invoice={selectedInvoiceForDetail}
          onEdit={loadInvoiceToForm}
          onUpdated={(updated) => {
            setSelectedInvoiceForDetail(updated)
            loadSavedInvoices()
          }}
        onDownload={handleExportSpecificPdf}
        initialPdfOpen={detailShowPdf}
        />
      </div>
    )
  }
