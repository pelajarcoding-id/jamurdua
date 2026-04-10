import { NextResponse } from 'next/server';
import { PrismaClient, Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic'

const prisma = new PrismaClient();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  const where: Prisma.PabrikSawitWhereInput = {};

  // Note: We intentionally do NOT filter by startDate/endDate here
  // because we want to show the total number of factories regardless of when they were created,
  // while the date filter applies to the transaction statistics in the main list.

  try {
    const allPabrik = await prisma.pabrikSawit.findMany({
      where,
    });

    const filteredPabrik = search
      ? allPabrik.filter(p =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          (p.address && p.address.toLowerCase().includes(search.toLowerCase()))
        )
      : allPabrik;

    const totalPabrik = filteredPabrik.length;

    return NextResponse.json({ totalPabrik });
  } catch (error) {
    console.error('Error fetching pabrik sawit summary:', error);
    return NextResponse.json({ error: 'Failed to fetch summary data' }, { status: 500 });
  }
}
