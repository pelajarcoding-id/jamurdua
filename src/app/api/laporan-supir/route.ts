
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { requireRole } from '@/lib/route-auth';
import { parseDateRangeFromSearchParams } from '@/lib/wib';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR', 'MANAGER', 'SUPIR'])
  if (guard.response) return guard.response

  const range = parseDateRangeFromSearchParams(searchParams)
  if (!range) {
    return NextResponse.json({ error: 'startDate dan endDate wajib diisi' }, { status: 400 })
  }

  try {
    const summary = await prisma.notaSawit.groupBy({
      by: ['supirId'],
      where: {
        supirId: {
          not: null,
        },
        ...(guard.role === 'SUPIR' ? { supirId: guard.id } : {}),
        createdAt: { gte: range.start, lte: range.end },
      },
      _sum: {
        beratAkhir: true,
      },
      _count: {
        _all: true,
      },
    });

    const supirIds = summary.map((s) => s.supirId).filter((id): id is number => id !== null);

    const supirs = await prisma.user.findMany({
      where: {
        id: {
          in: supirIds,
        },
      },
      select: {
        id: true,
        name: true,
      },
    });

    const supirMap = new Map(supirs.map((s) => [s.id, s.name]));

    const result = summary.map((s) => ({
      supirId: s.supirId,
      supirName: s.supirId ? supirMap.get(s.supirId) || 'Unknown' : 'Unknown',
      totalRit: s._count._all,
      totalNetKg: (s as any)._sum.beratAkhir || 0,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching supir report:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json(
        { error: 'Database error: ' + error.message },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
