import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getWibRangeUtcFromParams } from '@/lib/wib';

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';

  const where: Prisma.PabrikSawitWhereInput = {};

  try {
    const allPabrik = await prisma.pabrikSawit.findMany({ where, select: { id: true, name: true, address: true } });

    const filteredPabrik = search
      ? allPabrik.filter(p =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          (p.address && p.address.toLowerCase().includes(search.toLowerCase()))
        )
      : allPabrik;

    const totalPabrik = filteredPabrik.length;
    const pabrikIds = filteredPabrik.map(p => p.id);

    const range = getWibRangeUtcFromParams(searchParams)
    const notaWhere: any = {
      deletedAt: null,
      pabrikSawitId: { in: pabrikIds },
      ...(range
        ? {
            tanggalBongkar: { gte: range.startUtc, lt: range.endExclusiveUtc },
          }
        : {}),
    }

    const stats = pabrikIds.length > 0
      ? await prisma.notaSawit.groupBy({
          by: ['pabrikSawitId'],
          where: notaWhere,
          _sum: { beratAkhir: true, totalPembayaran: true, potongan: true },
          _count: { id: true },
        })
      : []

    const pabrikMap = new Map(filteredPabrik.map(p => [p.id, p.name]));

    const rows = (stats as any[]).map((s) => {
      const totalBerat = Number(s?._sum?.beratAkhir || 0)
      const totalNilai = Number(s?._sum?.totalPembayaran || 0)
      const totalPotongan = Number(s?._sum?.potongan || 0)
      const totalBeratNetto = totalBerat + totalPotongan
      const rataRataHarga = totalBerat > 0 ? totalNilai / totalBerat : 0
      const potonganPercent = totalBeratNetto > 0 ? (totalPotongan / totalBeratNetto) * 100 : 0
      return {
        pabrikSawitId: s.pabrikSawitId,
        name: pabrikMap.get(s.pabrikSawitId) || `Pabrik #${s.pabrikSawitId}`,
        totalBerat,
        totalNilai,
        totalPotongan,
        totalBeratNetto,
        totalNota: Number(s?._count?.id || 0),
        rataRataHarga,
        potonganPercent,
      }
    })

    const bestAvgPrice = rows
      .filter(r => r.totalBerat > 0)
      .sort((a, b) => b.rataRataHarga - a.rataRataHarga)[0] || null

    const highestPotonganPercent = rows
      .filter(r => r.totalBeratNetto > 0 && r.totalPotongan > 0)
      .sort((a, b) => b.potonganPercent - a.potonganPercent)[0] || null

    const highestTonase = rows
      .sort((a, b) => b.totalBerat - a.totalBerat)[0] || null

    const highestPembayaran = rows
      .sort((a, b) => b.totalNilai - a.totalNilai)[0] || null

    const selisihAgg = pabrikIds.length > 0
      ? await prisma.$queryRaw<Array<{ pabrikSawitId: number; kebunBruto: number; pabrikBruto: number; jumlahNota: number; totalPembayaran: number; totalBeratAkhir: number }>>(
          Prisma.sql`
            SELECT
              n."pabrikSawitId"::int as "pabrikSawitId",
              COALESCE(SUM(t."grossKg"), 0)::float as "kebunBruto",
              COALESCE(SUM(n."bruto"), 0)::float as "pabrikBruto",
              COALESCE(SUM(n."totalPembayaran"), 0)::float as "totalPembayaran",
              COALESCE(SUM(n."beratAkhir"), 0)::float as "totalBeratAkhir",
              COUNT(*)::int as "jumlahNota"
            FROM "NotaSawit" n
            INNER JOIN "Timbangan" t ON t."id" = n."timbanganId"
            WHERE n."deletedAt" IS NULL
              AND n."timbanganId" IS NOT NULL
              AND n."pabrikSawitId" IN (${Prisma.join(pabrikIds)})
              ${range ? Prisma.sql`AND n."tanggalBongkar" >= ${range.startUtc} AND n."tanggalBongkar" < ${range.endExclusiveUtc}` : Prisma.empty}
            GROUP BY n."pabrikSawitId"
            ORDER BY COUNT(*) DESC
          `
        )
      : []

    const selisihPerPabrik = selisihAgg
      .map((r) => {
        const totalSelisihKg = Number(r.pabrikBruto || 0) - Number(r.kebunBruto || 0)
        const selisihPercent = Number(r.kebunBruto || 0) > 0 ? (totalSelisihKg / Number(r.kebunBruto || 0)) * 100 : 0
        const avgHargaPerKg = Number(r.totalBeratAkhir || 0) > 0 ? Number(r.totalPembayaran || 0) / Number(r.totalBeratAkhir || 0) : 0
        const estimasiPendapatanSelisih = totalSelisihKg * avgHargaPerKg
        return {
          pabrikSawitId: r.pabrikSawitId,
          pabrikName: pabrikMap.get(r.pabrikSawitId) || `Pabrik #${r.pabrikSawitId}`,
          jumlahNota: Number(r.jumlahNota || 0),
          totalBrutoKebun: Number(r.kebunBruto || 0),
          totalBrutoPabrik: Number(r.pabrikBruto || 0),
          totalSelisihKg,
          selisihPercent,
          avgHargaPerKg,
          estimasiPendapatanSelisih,
          totalPembayaran: Number(r.totalPembayaran || 0),
          totalBeratAkhir: Number(r.totalBeratAkhir || 0),
        }
      })
      .sort((a, b) => {
        const da = Math.abs(a.totalSelisihKg)
        const db = Math.abs(b.totalSelisihKg)
        if (da !== db) return da - db
        return a.pabrikName.localeCompare(b.pabrikName)
      })

    return NextResponse.json({
      totalPabrik,
      bestAvgPrice,
      highestPotonganPercent,
      highestTonase,
      highestPembayaran,
      selisihPerPabrik,
    });
  } catch (error) {
    console.error('Error fetching pabrik sawit summary:', error);
    return NextResponse.json({ error: 'Failed to fetch summary data' }, { status: 500 });
  }
}
