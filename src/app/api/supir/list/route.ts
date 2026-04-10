import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/route-auth';

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR', 'MANAGER'])
    if (guard.response) return guard.response
    const supirs = await prisma.user.findMany({
      where: {
        role: 'SUPIR',
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
    return NextResponse.json(supirs);
  } catch (error) {
    console.error('Error fetching supir list:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
