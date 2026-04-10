import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getWibRangeUtcFromParams } from '@/lib/wib';

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where: any = {
      AND: [],
    };

    if (search) {
      where.AND.push({
        OR: [
          { kebun: { name: { contains: search, mode: 'insensitive' } } },
          { notaSawit: { supir: { name: { contains: search, mode: 'insensitive' } } } },
          { notaSawit: { kendaraan: { platNomor: { contains: search, mode: 'insensitive' } } } },
        ],
      });
    }

    const range = getWibRangeUtcFromParams(searchParams)
    if (range) {
      where.AND.push({
        date: {
          gte: range.startUtc,
          lt: range.endExclusiveUtc,
        },
      });
    }

    const [summary, distinctRows] = await Promise.all([
      prisma.timbangan.aggregate({
        _count: {
          id: true,
        },
        where,
      }),
      prisma.timbangan.findMany({
        where,
        select: { kendaraanPlatNomor: true, supirId: true },
      }),
    ]);

    const kendaraanSet = new Set(
      distinctRows.map((row) => row.kendaraanPlatNomor).filter((val): val is string => Boolean(val))
    );
    const supirSet = new Set(
      distinctRows.map((row) => row.supirId).filter((val): val is number => typeof val === 'number')
    );

    return NextResponse.json({
      totalTimbangan: summary._count.id || 0,
      totalKendaraan: kendaraanSet.size,
      totalSupir: supirSet.size,
    });

  } catch (error) {
    console.error('Error fetching timbangan summary:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
