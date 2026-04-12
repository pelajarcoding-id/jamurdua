import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const vehicles = await (async () => {
      try {
        return await prisma.$queryRaw(
          Prisma.sql`SELECT "platNomor","merk","tanggalMatiStnk","tanggalPajakTahunan","speksi","tanggalIzinTrayek"
                     FROM "Kendaraan"
                     ORDER BY "platNomor" ASC`
        )
      } catch {
        return await prisma.$queryRaw(
          Prisma.sql`SELECT "platNomor","merk","tanggalMatiStnk","tanggalPajakTahunan","speksi"
                     FROM "Kendaraan"
                     ORDER BY "platNomor" ASC`
        )
      }
    })()

    return NextResponse.json(vehicles);
  } catch (error) {
    console.error('Error fetching alerts:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
