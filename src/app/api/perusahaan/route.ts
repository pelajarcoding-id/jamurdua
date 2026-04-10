
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { createAuditLog } from '@/lib/audit';
import { requireAuth, requireRole } from '@/lib/route-auth';
import { getWibRangeUtcFromParams } from '@/lib/wib';

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
    const guard = await requireAuth();
    if (guard.response) return guard.response;
    const whereClause: any = {};

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const range = getWibRangeUtcFromParams(searchParams)
    if (range) {
      whereClause.createdAt = { gte: range.startUtc, lt: range.endExclusiveUtc };
    }

    const [data, total] = await Promise.all([
      (prisma as any).perusahaan.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { id: 'desc' },
      }),
      (prisma as any).perusahaan.count({ where: whereClause }),
    ]);

    return NextResponse.json({
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Error fetching perusahaan data:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK']);
    if (guard.response) return guard.response;
    const body = await request.json();
    const { name, address, email, phone, logoUrl } = body;

    if (!name) {
      return NextResponse.json({ error: 'Nama perusahaan harus diisi' }, { status: 400 });
    }

    const newPerusahaan = await (prisma as any).perusahaan.create({
      data: { name, address, email, phone, logoUrl }
    });

    // Audit Log
    await createAuditLog(guard.id, 'CREATE', 'Perusahaan', newPerusahaan.id.toString(), {
      name,
      address,
      email,
      phone
    });

    return NextResponse.json(newPerusahaan, { status: 201 });
  } catch (error) {
    console.error('Error creating perusahaan:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
