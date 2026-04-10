import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const accounts = await prisma.jurnal.groupBy({
      by: ['akun'],
      _sum: {
        debit: true,
        kredit: true,
      },
      orderBy: {
        akun: 'asc',
      },
    });

    const result = accounts.map((acc: { akun: string; _sum: { debit: number | null; kredit: number | null; } }) => {
      const totalDebit = acc._sum.debit || 0;
      const totalKredit = acc._sum.kredit || 0;
      // Simple balance calculation. This can be improved later based on account type.
      const saldo = totalDebit - totalKredit;

      return {
        akun: acc.akun,
        totalDebit,
        totalKredit,
        saldo,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching buku besar:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
