import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/route-auth';
import { ensureKebunAccess } from '@/lib/kebun-access';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const kebunId = Number(params.id);

    if (isNaN(kebunId)) {
      return NextResponse.json(
        { error: 'ID kebun tidak valid' },
        { status: 400 }
      );
    }

    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR', 'MANDOR', 'MANAGER'])
    if (guard.response) return guard.response
    const allowed = await ensureKebunAccess(guard.id, guard.role, kebunId)
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const whereClause: any = {
      kebunId: kebunId,
    };

    if (startDate && endDate) {
      whereClause.date = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    const panen = await prisma.notaSawit.findMany({
      where: {
        kebunId: kebunId,
        ...(startDate && endDate ? {
          tanggalBongkar: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          }
        } : {})
      },
      include: {
        pabrikSawit: {
          select: { name: true }
        },
        supir: {
          select: { name: true }
        },
        kendaraan: {
          select: { platNomor: true }
        },
        timbangan: true
      },
      orderBy: {
        tanggalBongkar: 'desc',
      },
    });

    return NextResponse.json(panen);
  } catch (error) {
    console.error('Error fetching harvest data:', error);
    return NextResponse.json(
      { error: 'Gagal mengambil data panen' },
      { status: 500 }
    );
  }
}
