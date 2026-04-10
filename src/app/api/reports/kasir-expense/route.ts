import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getWibMonthRangeUtc } from '@/lib/wib';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get('month');
    const kebunIdParam = searchParams.get('kebunId');
    const kendaraanPlatParam = searchParams.get('kendaraanPlatNomor');
    const kebunId = kebunIdParam ? Number(kebunIdParam) : null;

    const monthRange = getWibMonthRangeUtc(monthParam)
    if (!monthRange) return NextResponse.json({ error: 'month tidak valid' }, { status: 400 })

    let akunFilter: string[] | null = null;
    if (kebunId) {
      const notaPlats = await prisma.notaSawit.findMany({
        where: {
          kebunId,
          createdAt: { gte: monthRange.startUtc, lt: monthRange.endExclusiveUtc },
          kendaraanPlatNomor: { not: null },
        },
        select: { kendaraanPlatNomor: true },
      });
      const plats = Array.from(new Set(notaPlats.map(n => n.kendaraanPlatNomor!).filter(Boolean)));
      akunFilter = plats.map(plat => `Beban Kendaraan:${plat}`);
    }
    if (kendaraanPlatParam) {
      akunFilter = [`Beban Kendaraan:${kendaraanPlatParam}`];
    }

    const expense = await prisma.jurnal.aggregate({
      where: {
        refType: 'KasTransaksi',
        date: { gte: monthRange.startUtc, lt: monthRange.endExclusiveUtc },
        ...(akunFilter ? { akun: { in: akunFilter } } : { akun: { startsWith: 'Beban' } }),
      },
      _sum: { debit: true },
    });

    return NextResponse.json({
      totalKasirExpense: expense._sum.debit || 0,
      period: { startDate: monthRange.startUtc, endDate: monthRange.endUtcInclusive },
    });
  } catch (error) {
    console.error('Error fetching kasir expense:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
