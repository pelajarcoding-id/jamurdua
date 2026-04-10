'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const sections = [
  {
    title: 'Ringkasan',
    bullets: [
      'Aplikasi Next.js 14 dengan autentikasi NextAuth (Credentials).',
      'Peran: ADMIN, KASIR, PEMILIK, SUPIR dengan pembatasan akses.',
      'PWA aktif di produksi dan CSP dikonfigurasi via next.config.js.',
    ],
  },
  {
    title: 'Autentikasi & Otorisasi',
    bullets: [
      'Login via email dan password, validasi dengan bcrypt.',
      'Middleware mengarahkan pengguna yang tidak berhak.',
      'Session menyertakan id dan role untuk pembatasan UI dan API.',
    ],
  },
  {
    title: 'Kasir',
    bullets: [
      'Mencatat pemasukan/pengeluaran dengan kategori dan bukti gambar.',
      'Optimistic update pada tambah/ubah/hapus untuk respons cepat.',
      'Auto-post ke Jurnal dua sisi sesuai tipe transaksi.',
    ],
  },
  {
    title: 'Jurnal',
    bullets: [
      'Mencatat date, akun, deskripsi, debit, kredit.',
      'Ubah tersedia, hapus hanya untuk ADMIN di UI dan API.',
      'Audit log dibuat saat create/update/delete dari modul terkait.',
    ],
  },
  {
    title: 'Uang Jalan',
    bullets: [
      'Mengelola sesi uang jalan per supir dan rincian pemasukan/pengeluaran.',
      'Optimistic update pada aksi sesi dan rincian.',
      'Upload bukti dan alat bantu scan teks dari gambar.',
    ],
  },
  {
    title: 'Timbangan, Nota Sawit, Gajian',
    bullets: [
      'Timbangan menyimpan data panen dengan kebun dan kendaraan.',
      'Nota Sawit terhubung ke timbangan, digunakan dalam gajian.',
      'Gajian menghitung potongan dan biaya lain, siap cetak.',
    ],
  },
  {
    title: 'Laporan & Grafik',
    bullets: [
      'Dashboard menampilkan tren produksi dan ringkasan keuangan.',
      'Laporan cost center menggabungkan biaya uang jalan, servis, kasir.',
      'Ekspor PDF tersedia di beberapa modul untuk kebutuhan cetak.',
    ],
  },
  {
    title: 'Keamanan',
    bullets: [
      'CSP ketat dengan kontrol sumber script, style, dan koneksi.',
      'X-Frame-Options, X-Content-Type-Options, Referrer-Policy aktif.',
      'Permissions-Policy menutup akses kamera, mic, geolokasi default.',
    ],
  },
]

export default function AppFlowDocPage() {
  const [downloading, setDownloading] = useState(false)

  const handleDownloadPdf = async () => {
    try {
      setDownloading(true)
      const jsPDF = (await import('jspdf')).default
      const doc = new jsPDF({ unit: 'pt', format: 'a4' })
      const margin = 36
      let y = margin
      doc.setFontSize(16)
      doc.text('Dokumentasi Alur Aplikasi', margin, y)
      y += 18
      doc.setFontSize(10)
      for (const section of sections) {
        y += 18
        doc.setFontSize(12)
        doc.text(section.title, margin, y)
        doc.setFontSize(10)
        y += 10
        for (const bullet of section.bullets) {
          const lines = doc.splitTextToSize(`• ${bullet}`, 522)
          for (const line of lines) {
            if (y > 770) {
              doc.addPage()
              y = margin
            }
            doc.text(line, margin, y)
            y += 14
          }
        }
      }
      doc.save('dokumen-alur-aplikasi.pdf')
    } catch (e) {
      console.error(e)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Dokumentasi Alur Aplikasi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {sections.map((s, i) => (
              <div key={i} className="space-y-2">
                <h3 className="text-lg font-semibold">{s.title}</h3>
                <ul className="list-disc pl-5 space-y-1">
                  {s.bullets.map((b, j) => (
                    <li key={j}>{b}</li>
                  ))}
                </ul>
              </div>
            ))}
            <div className="pt-4">
              <Button onClick={handleDownloadPdf} disabled={downloading}>
                {downloading ? 'Menyiapkan...' : 'Unduh PDF'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
