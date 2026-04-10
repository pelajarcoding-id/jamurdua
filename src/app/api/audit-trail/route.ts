import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { requireRole } from '@/lib/route-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const guard = await requireRole(['ADMIN']);
    if (guard.response) return guard.response

    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get('limit') || '10');
    const page = Number(searchParams.get('page') || '1');
    const search = searchParams.get('search') || '';

    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { entity: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { action: { contains: search, mode: 'insensitive' } },
      ];
      const isNumeric = /^\d+$/.test(search);
      if (isNumeric) {
        const like = `%${search}%`;
        const idsRows: Array<{ id: number }> = await prisma.$queryRaw(
          Prisma.sql`SELECT a.id FROM "AuditLog" a
                     LEFT JOIN "User" u ON u.id = a."userId"
                     WHERE CAST(a.id AS TEXT) ILIKE ${like}
                        OR CAST(a."entityId" AS TEXT) ILIKE ${like}`
        );
        const numericIds = idsRows.map(r => r.id);
        if (numericIds.length > 0) {
          where.OR.push({ id: { in: numericIds } });
        }
      }
      const parsedDate = !Number.isNaN(Date.parse(search)) ? new Date(search) : null;
      if (parsedDate) {
        const start = new Date(parsedDate); start.setHours(0,0,0,0);
        const end = new Date(parsedDate); end.setHours(23,59,59,999);
        where.OR.push({ createdAt: { gte: start, lte: end } });
      }
    }

    const [logs, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        where: where as any,
        include: {
          user: {
            select: { name: true, email: true }
          }
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where: where as any }),
    ]);

    return NextResponse.json({
      data: logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
