import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { startOfMonth, endOfMonth } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get('month');
    const kebunIdParam = searchParams.get('kebunId');
    const kendaraanPlatParam = searchParams.get('kendaraanPlatNomor');
    const month = monthParam ? new Date(monthParam) : new Date();
    const kebunId = kebunIdParam ? Number(kebunIdParam) : null;

    const startDate = startOfMonth(month);
    const endDate = endOfMonth(month);

    const notas = await prisma.notaSawit.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
        kendaraanPlatNomor: { not: null },
        ...(kebunId ? { kebunId } : {}),
        ...(kendaraanPlatParam ? { kendaraanPlatNomor: kendaraanPlatParam } : {}),
      },
      select: {
        kendaraanPlatNomor: true,
        totalPembayaran: true,
      },
    });

    const map = new Map<string, number>();
    for (const n of notas) {
      const plat = n.kendaraanPlatNomor as string;
      map.set(plat, (map.get(plat) || 0) + (n.totalPembayaran || 0));
    }

    const result = Array.from(map.entries()).map(([platNomor, total]) => ({ platNomor, total }));
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching nota income:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
