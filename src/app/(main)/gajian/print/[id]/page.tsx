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
  const [hutangRows, setHutangRows] = useState<Array<{ name: string; tanggal: string; saldo: number; potong: number; sisa: number; keterangan?: string }>>([]);

  useEffect(() => {
    if (id) {
      fetch(`/api/gajian/${id}`)
        .then(res => res.json())
        .then(data => {
          setGajian(data);
          setLoading(false);
          const adjustedEndDate = new Date(data.tanggalSelesai);
          adjustedEndDate.setHours(23, 59, 59, 999);
          const params = new URLSearchParams({
            kebunId: String(data.kebunId),
            startDate: new Date(data.tanggalMulai).toISOString(),
            endDate: adjustedEndDate.toISOString(),
          });
          fetch(`/api/karyawan-kebun?${params.toString()}`, { cache: 'no-store' })
            .then(res => res.json())
            .then(json => {
              const list = Array.isArray(json.data) ? json.data : [];
              const tgl = adjustedEndDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: '2-digit' });
              const mapped = list.map((r: any, idx: number) => ({
                name: r.karyawan?.name || '-',
                tanggal: tgl,
                saldo: Math.round(Number(r.totalPengeluaran || 0)),
                potong: Math.round(Number(r.totalPembayaran || 0)),
                sisa: Math.max(0, Math.round(Number(r.hutangSaldo || 0))),
                keterangan: '',
              }));
              setHutangRows(mapped);
            })
            .catch(() => {});
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
