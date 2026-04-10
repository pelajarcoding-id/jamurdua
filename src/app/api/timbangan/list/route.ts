
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const includeId = searchParams.get('includeId');

    const where: any = {
      notaSawit: null,
    };

    if (includeId) {
      where.OR = [
        { notaSawit: null },
        { id: Number(includeId) }
      ];
      delete where.notaSawit;
    }

    const timbangan = await prisma.timbangan.findMany({
      where,
      orderBy: { id: 'desc' },
      include: { 
        kebun: true,
        supir: true,
        kendaraan: true
      },
    });

    return NextResponse.json(timbangan);
  } catch (error) {
    console.error('Error fetching timbangan list:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
