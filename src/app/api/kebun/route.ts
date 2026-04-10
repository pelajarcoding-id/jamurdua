
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { createAuditLog } from '@/lib/audit';
import { Prisma } from '@prisma/client';
import { requireRole } from '@/lib/route-auth';
import { getAccessibleKebunIds } from '@/lib/kebun-access';

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');
  const search = searchParams.get('search') || '';
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  const skip = (page - 1) * limit;

  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR', 'MANDOR', 'MANAGER'])
    if (guard.response) return guard.response
    const ids = await getAccessibleKebunIds(guard.id, guard.role)

    const whereClause: any = { AND: [] };

    if (ids !== null) {
      whereClause.AND.push({ id: { in: ids.length > 0 ? ids : [-1] } })
    }

    if (search) {
      const or: any[] = [
        { name: { contains: search, mode: 'insensitive' } },
        { location: { contains: search, mode: 'insensitive' } },
      ];
      const isNumeric = /^\d+$/.test(search);
      if (isNumeric) {
        const like = `%${search}%`;
        const idsRows: Array<{ id: number }> = await prisma.$queryRaw(
          Prisma.sql`SELECT k.id FROM "Kebun" k WHERE CAST(k.id AS TEXT) ILIKE ${like}`
        );
        const numericIds = idsRows.map(r => r.id);
        if (numericIds.length > 0) {
          or.push({ id: { in: numericIds } });
        }
      }
      whereClause.AND.push({ OR: or });
    }

    if (startDate && endDate) {
      whereClause.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    const [kebun, total] = await Promise.all([
      prisma.kebun.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { id: 'desc' },
      }),
      prisma.kebun.count({ where: whereClause }),
    ]);

    return NextResponse.json({
      data: kebun,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Error fetching kebun data:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
    try {
        const guard = await requireRole(['ADMIN', 'PEMILIK'])
        if (guard.response) return guard.response
        const { name, location } = await request.json();

        if (!name) {
            return NextResponse.json({ error: 'Nama kebun harus diisi' }, { status: 400 });
        }

        const newKebun = await prisma.kebun.create({
            data: { 
                name, 
                location
            }
        });

        // Audit Log
        await createAuditLog(guard.id, 'CREATE', 'Kebun', newKebun.id.toString(), {
            name,
            location
        });

        return NextResponse.json(newKebun, { status: 201 });
    } catch (error) {
        console.error('Error creating kebun:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
