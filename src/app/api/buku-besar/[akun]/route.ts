import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface Params {
  params: { akun: string };
}

export async function GET(request: Request, { params }: Params) {
  try {
    const akun = decodeURIComponent(params.akun);

    const transactions = await prisma.jurnal.findMany({
      where: {
        akun: akun,
      },
      orderBy: {
        date: 'asc',
      },
    });

    if (transactions.length === 0) {
      return NextResponse.json(
        { error: 'Akun tidak ditemukan atau tidak memiliki transaksi' },
        { status: 404 }
      );
    }

    return NextResponse.json(transactions);
  } catch (error) {
    console.error(`Error fetching details for akun ${params.akun}:`, error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
