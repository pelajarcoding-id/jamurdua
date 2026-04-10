import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getWibRangeUtcFromParams } from '@/lib/wib';

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where: any = {};
    const range = getWibRangeUtcFromParams(searchParams)
    if (range) {
      where.date = { gte: range.startUtc, lt: range.endExclusiveUtc };
    }

    const accounts = await prisma.jurnal.groupBy({
      by: ['akun'],
      where,
      _sum: {
        debit: true,
        kredit: true,
      },
    });

    const pendapatan: { akun: string; total: number }[] = [];
    const beban: { akun: string; total: number }[] = [];
    let totalPendapatan = 0;
    let totalBeban = 0;

    for (const acc of accounts) {
      const totalDebit = acc._sum.debit || 0;
      const totalKredit = acc._sum.kredit || 0;

      if (acc.akun.toLowerCase().includes('pendapatan')) {
        const saldo = totalKredit - totalDebit;
        pendapatan.push({ akun: acc.akun, total: saldo });
        totalPendapatan += saldo;
      } else if (acc.akun.toLowerCase().includes('beban')) {
        const saldo = totalDebit - totalKredit;
        beban.push({ akun: acc.akun, total: saldo });
        totalBeban += saldo;
      }
    }

    const labaBersih = totalPendapatan - totalBeban;

    return NextResponse.json({
      pendapatan,
      totalPendapatan,
      beban,
      totalBeban,
      labaBersih,
    });
  } catch (error) {
    console.error('Error fetching income statement data:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
