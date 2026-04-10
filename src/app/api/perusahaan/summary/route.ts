
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getWibRangeUtcFromParams } from '@/lib/wib';

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  try {
    const whereClause: any = {};
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const range = getWibRangeUtcFromParams(searchParams)
    if (range) {
      whereClause.createdAt = { gte: range.startUtc, lt: range.endExclusiveUtc };
    }

    const totalPerusahaan = await (prisma as any).perusahaan.count({ where: whereClause });
    
    // Statistik tambahan: total pabrik yang terhubung ke perusahaan-perusahaan ini
    const totalPabrik = await prisma.pabrikSawit.count({
      where: {
        perusahaanId: { not: null },
        perusahaan: whereClause
      } as any
    });

    // Statistik tambahan: total nota sawit dari perusahaan-perusahaan ini
    const totalNota = await prisma.notaSawit.count({
      where: {
        perusahaanId: { not: null },
        perusahaan: whereClause
      } as any
    });

    return NextResponse.json({
      totalPerusahaan,
      totalPabrik,
      totalNota
    });
  } catch (error) {
    console.error('Error fetching perusahaan summary:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
