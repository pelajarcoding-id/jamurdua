import { prisma } from '@/lib/prisma';
import { GajianClient } from './client';

async function getInitialData() {
  const [kebunList, allGajian] = await Promise.all([
    prisma.kebun.findMany({ orderBy: { name: 'asc' } }),
    prisma.gajian.findMany({
      where: {
        status: { in: ['DRAFT', 'FINALIZED'] },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        kebun: true,
        biayaLain: true,
        potongan: true,
        detailKaryawan: true,
      },
    }),
  ]);

  const withComputedTotals = allGajian.map((g) => {
    const totalBiayaLain = (g.biayaLain || []).reduce((sum, b) => sum + (Number(b.total) || 0), 0)
    const totalPotonganManual = (g.potongan || []).reduce((sum, p) => sum + (Number(p.total) || 0), 0)
    const totalPotonganHutang = (g.detailKaryawan || []).reduce((sum, d) => sum + (Number((d as any).potongan) || 0), 0)
    const totalPotongan = totalPotonganManual + totalPotonganHutang
    const totalGajiHarian = (g.detailKaryawan || []).reduce((sum, d) => sum + (Number((d as any).gajiPokok) || 0), 0)
    const hasSalaryInBiaya = (g.biayaLain || []).some((b: any) => {
      const desc = String(b?.deskripsi || '').trim()
      const total = Number(b?.total || 0)
      if (!/^(total\s*gaji\s*karyawan|biaya\s*gaji\s*harian)/i.test(desc)) return false
      return Number.isFinite(total) && total > 0
    })
    const totalJumlahGaji = totalBiayaLain + (hasSalaryInBiaya ? 0 : totalGajiHarian)
    const totalGaji = totalJumlahGaji - totalPotongan
    return {
      ...g,
      totalBiayaLain: totalBiayaLain || 0,
      totalPotongan: totalPotongan || 0,
      totalGaji: totalGaji || 0,
      totalGajiHarian: totalGajiHarian || 0,
      totalJumlahGaji: totalJumlahGaji || 0,
    }
  })

  const drafts = withComputedTotals.filter(g => g.status === 'DRAFT');
  const finalized = withComputedTotals.filter(g => g.status === 'FINALIZED');

  return { kebunList, initialGajianHistory: { drafts, finalized } };
}

export default async function GajianPage() {
  const { kebunList, initialGajianHistory } = await getInitialData();

  return (
    <main className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Proses Gajian</h1>
        <GajianClient kebunList={kebunList} initialGajianHistory={initialGajianHistory} />
      </div>
    </main>
  );
}
