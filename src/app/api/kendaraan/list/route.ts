
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const kendaraan = await prisma.kendaraan.findMany({
      orderBy: { platNomor: 'asc' },
    });
    return NextResponse.json(kendaraan);
  } catch (error) {
    console.error('Error fetching kendaraan list:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
