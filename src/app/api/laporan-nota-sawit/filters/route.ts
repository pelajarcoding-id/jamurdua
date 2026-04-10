import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';


export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [kebun, supir, pabrik] = await Promise.all([
      prisma.kebun.findMany({
        orderBy: {
          name: 'asc',
        },
      }),
      prisma.user.findMany({
        where: {
          role: 'SUPIR',
        },
        orderBy: {
          name: 'asc',
        },
      }),
      prisma.pabrikSawit.findMany({
        orderBy: {
          name: 'asc',
        },
      }),
    ]);

    return NextResponse.json({ kebun, supir, pabrik });
  } catch (error) {
    console.error('Error fetching filter data:', error);
    return NextResponse.json({ error: 'Gagal mengambil data untuk filter' }, { status: 500 });
  }
}
