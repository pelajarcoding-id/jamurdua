
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/route-auth';
import { getAccessibleKebunIds } from '@/lib/kebun-access';

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR', 'MANDOR', 'MANAGER'])
    if (guard.response) return guard.response
    const ids = await getAccessibleKebunIds(guard.id, guard.role)
    const kebun = await prisma.kebun.findMany({
      where: ids === null ? undefined : { id: { in: ids.length > 0 ? ids : [-1] } },
      orderBy: { id: 'desc' },
    });
    return NextResponse.json(kebun);
  } catch (error) {
    console.error('Error fetching kebun list:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
