import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';


export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [kebun, supir, pabrik, kendaraan, perusahaan] = await Promise.all([
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
      prisma.kendaraan.findMany({
        where: {
          OR: [
            { jenis: { contains: 'truk', mode: 'insensitive' } },
            { jenis: { contains: 'truck', mode: 'insensitive' } },
          ],
        },
        orderBy: {
          platNomor: 'asc',
        },
      }),
      prisma.perusahaan.findMany({
        orderBy: {
          name: 'asc',
        },
      }),
    ]);

    return NextResponse.json({ kebun, supir, pabrik, kendaraan, perusahaan });
  } catch (error) {
    console.error('Error fetching filter data:', error);
    return NextResponse.json({ error: 'Gagal mengambil data untuk filter' }, { status: 500 });
  }
}
