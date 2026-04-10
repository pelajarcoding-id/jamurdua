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

    let allowedPlats: string[] | null = null;
    if (kebunId) {
      const notaPlats = await prisma.notaSawit.findMany({
        where: {
          kebunId,
          createdAt: { gte: monthRange.startUtc, lt: monthRange.endExclusiveUtc },
          kendaraanPlatNomor: { not: null },
        },
        select: { kendaraanPlatNomor: true },
      });
      allowedPlats = Array.from(new Set(notaPlats.map(n => n.kendaraanPlatNomor!).filter(Boolean)));
    }
    if (kendaraanPlatParam) {
      allowedPlats = [kendaraanPlatParam];
    }

    const entries = await prisma.jurnal.findMany({
      where: {
        date: { gte: monthRange.startUtc, lt: monthRange.endExclusiveUtc },
        akun: { startsWith: 'Beban Kendaraan:' },
      },
      select: { akun: true, debit: true },
    });

    const map = new Map<string, number>();
    for (const e of entries) {
      const plat = e.akun.replace('Beban Kendaraan:', '');
      if (allowedPlats && !allowedPlats.includes(plat)) continue;
      map.set(plat, (map.get(plat) || 0) + (e.debit || 0));
    }

    const result = Array.from(map.entries()).map(([platNomor, total]) => ({ platNomor, total }));
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching kasir-by-vehicle:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
