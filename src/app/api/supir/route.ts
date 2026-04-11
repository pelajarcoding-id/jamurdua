
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { User } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { requireRole } from '@/lib/route-auth';
import { parseDateRangeFromSearchParams } from '@/lib/wib';

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR', 'MANAGER', 'SUPIR'])
  if (guard.response) return guard.response
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');
  const search = searchParams.get('search') || '';
  const supirId = searchParams.get('supirId');

  const skip = (page - 1) * limit;
  const range = parseDateRangeFromSearchParams(searchParams);

  try {
    const whereClause: any = {
      role: 'SUPIR',
    };

    if (guard.role === 'SUPIR') {
      whereClause.id = guard.id;
    } else if (supirId && supirId !== 'all') {
      whereClause.id = parseInt(supirId);
    }

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } } as any,
      ];
      const isNumeric = /^\d+$/.test(search);
      if (isNumeric) {
        const like = `%${search}%`;
        const idsRows: Array<{ id: number }> = await prisma.$queryRaw(
          Prisma.sql`SELECT u.id FROM "User" u WHERE u.role = 'SUPIR' AND CAST(u.id AS TEXT) ILIKE ${like}`
        );
        const numericIds = idsRows.map(r => r.id);
        if (numericIds.length > 0) {
          whereClause.OR.push({ id: { in: numericIds } });
        }
      }
    }

    const totalItems = await prisma.user.count({ where: whereClause });

    const supirs = await prisma.user.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: { name: 'asc' },
    });

    if (!range) {
      const rows = supirs.map((s: User) => ({
        supirId: s.id,
        supir: s.name,
        jumlahNota: 0,
        totalDiberikan: 0,
        totalPengeluaran: 0,
        saldoUangJalan: 0,
        totalUangJalan: 0,
        totalBerat: 0,
        rataRataBerat: 0,
      }));
      return NextResponse.json({ data: rows, total: totalItems });
    }

    const supirsWithData = await Promise.all(
      supirs.map(async (supir: User) => {
        const notaSawitAggregate = await prisma.notaSawit.aggregate({
          _sum: {
            beratAkhir: true,
          },
          _count: {
            id: true,
          },
          where: {
            supirId: supir.id,
            deletedAt: null,
            createdAt: {
              gte: range.start,
              lte: range.end,
            },
          },
        });

        const uangJalanGrouped = await prisma.uangJalan.groupBy({
          by: ['tipe'],
          _sum: { amount: true },
          where: {
            deletedAt: null,
            sesiUangJalan: { supirId: supir.id, deletedAt: null },
            date: { gte: range.start, lte: range.end },
          },
        });
        const totalDiberikan = uangJalanGrouped.find(r => r.tipe === 'PEMASUKAN')?._sum.amount || 0;
        const totalPengeluaran = uangJalanGrouped.find(r => r.tipe === 'PENGELUARAN')?._sum.amount || 0;
        const saldoUangJalan = totalDiberikan - totalPengeluaran;

        const totalBerat = notaSawitAggregate._sum.beratAkhir || 0;
        const jumlahNota = notaSawitAggregate._count.id;
        
        return {
          supirId: supir.id,
          supir: supir.name,
          jumlahNota: jumlahNota,
          totalDiberikan,
          totalPengeluaran,
          saldoUangJalan,
          totalUangJalan: saldoUangJalan,
          totalBerat: totalBerat,
          rataRataBerat: jumlahNota > 0 ? totalBerat / jumlahNota : 0,
        };
      })
    );

    return NextResponse.json({ data: supirsWithData, total: totalItems });
  } catch (error) {
    console.error('Error fetching supir report:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
