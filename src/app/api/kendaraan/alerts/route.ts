import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Fetch all vehicles but only select necessary fields for the dashboard
    // This allows the frontend to show all vehicles including those that are "Safe"
    const vehicles = await prisma.kendaraan.findMany({
      select: {
        platNomor: true,
        merk: true,
        tanggalMatiStnk: true,
        tanggalPajakTahunan: true,
        speksi: true,
      },
      orderBy: {
        platNomor: 'asc',
      }
    });

    return NextResponse.json(vehicles);
  } catch (error) {
    console.error('Error fetching alerts:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
