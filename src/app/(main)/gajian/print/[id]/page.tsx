'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import type { Gajian, Kebun, DetailGajian, NotaSawit, Timbangan, User, BiayaLainGajian, PotonganGajian } from '@prisma/client';

//  Define extended types to match the API response
type NotaSawitWithRelations = NotaSawit & {
  supir: User;
  timbangan: Timbangan;
};

type DetailGajianWithRelations = DetailGajian & {
  notaSawit: NotaSawitWithRelations;
};

type GajianWithDetails = Gajian & {
  kebun: Kebun;
  detailGajian: DetailGajianWithRelations[];
  biayaLain: BiayaLainGajian[];
  potongan: PotonganGajian[];
};

const formatNumber = (num: number) => new Intl.NumberFormat('id-ID').format(num);
const formatDate = (date: Date | string) => new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(date));

export default function PrintGajianPage() {
  const { id } = useParams();
  const [gajian, setGajian] = useState<GajianWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [hutangRows, setHutangRows] = useState<Array<{ name: string; tanggal: string; saldo: number; potong: number; sisa: number; hutangBaru: number; keterangan?: string }>>([]);

  useEffect(() => {
    if (id) {
      fetch(`/api/gajian/${id}`)
        .then(res => res.json())
        .then(data => {
          setGajian(data);
          setLoading(false);
          const adjustedEndDate = new Date(data.tanggalSelesai);
          adjustedEndDate.setHours(23, 59, 59, 999);
          
          const hutangTambahanRows = Array.isArray((data as any).hutangTambahan) ? (data as any).hutangTambahan : []
          const hutangTambahanMap = new Map<number, { jumlah: number; deskripsi: string }>()
          hutangTambahanRows.forEach((h: any) => {
            const userId = Number(h?.userId)
            const jumlah = Number(h?.jumlah || 0)
            if (!Number.isFinite(userId) || userId <= 0) return
            if (!Number.isFinite(jumlah) || jumlah <= 0) return
            const prev = hutangTambahanMap.get(userId)
            hutangTambahanMap.set(userId, { jumlah: (prev?.jumlah || 0) + jumlah, deskripsi: String(h?.deskripsi || prev?.deskripsi || 'Hutang Karyawan') })
          })

          const tgl = adjustedEndDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: '2-digit' });
          const mapped = (data.detailKaryawan || [])
            .map((d: any) => {
              const hutangBaru = Number(hutangTambahanMap.get(Number(d.userId))?.jumlah || 0)
              const potong = Number(d.potongan || 0)
              const snapshotSaldo = d.saldoHutang ?? 0
              
              const saldoBefore = snapshotSaldo
              const sisaAfter = Math.max(0, snapshotSaldo + hutangBaru - potong)
              
              return {
                name: d.user?.name || '-',
                tanggal: tgl,
                saldo: saldoBefore,
                potong: potong,
                sisa: sisaAfter,
                hutangBaru: hutangBaru,
                keterangan: d.keterangan || '',
              }
            })
            .filter((r: any) => r.saldo > 0 || r.potong > 0 || r.hutangBaru > 0);
            
          setHutangRows(mapped);
          setTimeout(() => window.print(), 500);
        })
        .catch(err => {
          console.error(err);
          setLoading(false);
        });
    }
  }, [id]);

  if (loading) {
    return <div className="p-8 text-center">Memuat data...</div>;
  }

  if (!gajian) {
    return <div className="p-8 text-center">Data gajian tidak ditemukan.</div>;
  }

  const maxRows = Math.max(gajian.detailGajian.length, gajian.biayaLain.length);
  const combinedData = Array.from({ length: maxRows }).map((_, index) => {
    const detail = gajian.detailGajian[index];
    const biaya = gajian.biayaLain[index];
    return { detail, biaya };
  });

  const totalJumlahGaji = (gajian.biayaLain || []).reduce((sum, item) => sum + item.total, 0);
  const totalPotongan = (gajian.potongan || []).reduce((sum, item) => sum + item.total, 0);

  return (
    <div className="bg-white p-4 font-mono text-xs">
      <style jsx global>{`
        @media print {
          body {
            -webkit-print-color-adjust: exact;
            color-adjust: exact;
          }
          .no-print {
            display: none;
          }
        }
      `}</style>

      <div className="text-center mb-4">
        <h1 className="font-bold text-sm">GAJIAN PERIODE {formatDate(gajian.tanggalMulai)} S/D {formatDate(gajian.tanggalSelesai)}</h1>
      </div>

      <table className="w-full border-collapse border border-black">
        <thead>
          <tr className="border border-black">
            <th className="border border-black p-1">NO</th>
            <th className="border border-black p-1">TANGGAL BONGKAR</th>
            <th className="border border-black p-1">NO POLISI</th>
            <th className="border border-black p-1">SUPIR</th>
            <th className="border border-black p-1 text-right">KG</th>
            <th className="border border-black p-1">JENIS PEKERJAAN</th>
            <th className="border border-black p-1 text-right">JUMLAH TBS/HK</th>
            <th className="border border-black p-1 text-right">GAJI / HK (RP)</th>
            <th className="border border-black p-1 text-right">JUMLAH GAJI (RP)</th>
            <th className="border border-black p-1">KETERANGAN</th>
          </tr>
        </thead>
        <tbody>
          {combinedData.map((item, index) => (
            <tr key={index} className="border border-black">
              <td className="border border-black p-1">{index + 1}</td>
              <td className="border border-black p-1">
                {item.detail
                  ? formatDate((item.detail.notaSawit as any).tanggalBongkar || item.detail.notaSawit.createdAt)
                  : ''}
              </td>
              <td className="border border-black p-1">{item.detail?.notaSawit?.kendaraanPlatNomor || ''}</td>
              <td className="border border-black p-1">{item.detail?.notaSawit?.supir?.name || ''}</td>
              <td className="border border-black p-1 text-right">{item.detail ? formatNumber(item.detail.notaSawit.beratAkhir) : ''}</td>
              <td className="border border-black p-1">{item.biaya?.deskripsi || ''}</td>
              <td className="border border-black p-1 text-right">{item.biaya?.jumlah ? `${formatNumber(item.biaya.jumlah)} ${item.biaya.satuan || ''}` : ''}</td>
              <td className="border border-black p-1 text-right">{item.biaya?.hargaSatuan ? formatNumber(item.biaya.hargaSatuan) : ''}</td>
              <td className="border border-black p-1 text-right">{item.biaya ? formatNumber(item.biaya.total) : ''}</td>
              <td className="border border-black p-1"></td>
            </tr>
          ))}
          </tbody>
        <tfoot>
          <tr className="border border-black font-bold">
            <td colSpan={4} className="border border-black p-1 text-center">JUMLAH</td>
            <td className="border border-black p-1 text-right">{formatNumber(gajian.totalBerat)}</td>
            <td colSpan={3} className="border border-black p-1 text-center">TOTAL</td>
            <td className="border border-black p-1 text-right">{formatNumber(totalJumlahGaji)}</td>
            <td className="border border-black p-1"></td>
          </tr>
          <tr className="border border-black font-bold">
            <td colSpan={4} className="border border-black p-1 text-center"></td>
            <td className="border border-black p-1 text-right"></td>
            <td colSpan={3} className="border border-black p-1 text-center">POTONGAN</td>
            <td className="border border-black p-1 text-right">{formatNumber(totalPotongan)}</td>
            <td className="border border-black p-1"></td>
          </tr>
          <tr className="border border-black font-bold">
            <td colSpan={4} className="border border-black p-1 text-center"></td>
            <td className="border border-black p-1 text-right"></td>
            <td colSpan={3} className="border border-black p-1 text-center">TOTAL DITERIMA</td>
            <td className="border border-black p-1 text-right">{formatNumber(totalJumlahGaji - totalPotongan)}</td>
            <td className="border border-black p-1"></td>
          </tr>
        </tfoot>
      </table>

      {(gajian.potongan || []).length > 0 && (
        <div className="mt-6">
          <div className="text-center mb-2">
            <h2 className="font-bold text-sm">DAFTAR POTONGAN HUTANG</h2>
          </div>
          <table className="w-full border-collapse border border-black">
            <thead>
              <tr className="border border-black">
                <th className="border border-black p-1">NO</th>
                <th className="border border-black p-1">DESKRIPSI</th>
                <th className="border border-black p-1 text-right">JUMLAH (RP)</th>
              </tr>
            </thead>
            <tbody>
              {(gajian.potongan || []).map((item, index) => (
                <tr key={`potongan-${item.id}`} className="border border-black">
                  <td className="border border-black p-1">{index + 1}</td>
                  <td className="border border-black p-1">{item.deskripsi}</td>
                  <td className="border border-black p-1 text-right">{formatNumber(item.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border border-black font-bold">
                <td className="border border-black p-1" colSpan={2}>TOTAL POTONGAN</td>
                <td className="border border-black p-1 text-right">{formatNumber(totalPotongan)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <div className="mt-4 text-right no-print">
        <Button onClick={() => window.print()}>
          Cetak Ulang
        </Button>
      </div>

      {hutangRows.length > 0 && (
        <div className="mt-6">
          <div className="text-center mb-2">
            <h2 className="font-bold text-sm">DAFTAR HUTANG PERIODE {formatDate(gajian.tanggalMulai)} S/D {formatDate(gajian.tanggalSelesai)}</h2>
          </div>
          <table className="w-full border-collapse border border-black">
            <thead>
              <tr className="border border-black">
                <th className="border border-black p-1">NO</th>
                <th className="border border-black p-1">NAMA</th>
                <th className="border border-black p-1">TANGGAL</th>
                <th className="border border-black p-1">SALDO</th>
                <th className="border border-black p-1">HUTANG</th>
                <th className="border border-black p-1">POTONG</th>
                <th className="border border-black p-1">SISA</th>
                <th className="border border-black p-1">KETERANGAN</th>
              </tr>
            </thead>
            <tbody>
              {hutangRows.map((r, idx) => (
                <tr key={idx} className="border border-black">
                  <td className="border border-black p-1">{idx + 1}</td>
                  <td className="border border-black p-1">{r.name}</td>
                  <td className="border border-black p-1">{r.tanggal}</td>
                  <td className="border border-black p-1 text-right">RP. {new Intl.NumberFormat('id-ID').format(r.saldo)}</td>
                  <td className="border border-black p-1 text-right">{r.hutangBaru > 0 ? `RP. ${new Intl.NumberFormat('id-ID').format(r.hutangBaru)}` : '-'}</td>
                  <td className="border border-black p-1 text-right">RP. {new Intl.NumberFormat('id-ID').format(r.potong)}</td>
                  <td className="border border-black p-1 text-right">RP. {new Intl.NumberFormat('id-ID').format(r.sisa)}</td>
                  <td className="border border-black p-1">{r.keterangan}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border border-black font-bold">
                <td className="border border-black p-1" colSpan={2}></td>
                <td className="border border-black p-1 text-center">JUMLAH</td>
                <td className="border border-black p-1 text-right">
                  RP. {new Intl.NumberFormat('id-ID').format(hutangRows.reduce((a, r) => a + r.saldo, 0))}
                </td>
                <td className="border border-black p-1 text-right">
                  {hutangRows.reduce((a, r) => a + r.hutangBaru, 0) > 0 ? `RP. ${new Intl.NumberFormat('id-ID').format(hutangRows.reduce((a, r) => a + r.hutangBaru, 0))}` : '-'}
                </td>
                <td className="border border-black p-1 text-right">
                  RP. {new Intl.NumberFormat('id-ID').format(hutangRows.reduce((a, r) => a + r.potong, 0))}
                </td>
                <td className="border border-black p-1 text-right">
                  RP. {new Intl.NumberFormat('id-ID').format(hutangRows.reduce((a, r) => a + r.sisa, 0))}
                </td>
                <td className="border border-black p-1"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
