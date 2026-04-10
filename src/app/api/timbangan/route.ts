
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { createAuditLog } from '@/lib/audit';
import { auth } from '@/auth';
import { requireRole } from '@/lib/route-auth';
import { getWibRangeUtcFromParams } from '@/lib/wib';

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR', 'SUPIR', 'MANDOR', 'MANAGER'])
    if (guard.response) return guard.response
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const status = searchParams.get('status');

    const skip = (page - 1) * limit;

    const where: any = {
      AND: [],
    };

    if (search) {
      const or: any[] = [
        { kebun: { name: { contains: search, mode: 'insensitive' } } },
        { supir: { name: { contains: search, mode: 'insensitive' } } },
        { kendaraan: { platNomor: { contains: search, mode: 'insensitive' } } },
      ];
      const isNumeric = /^\d+(\.\d+)?$/.test(search);
      if (isNumeric) {
        const like = `%${search}%`;
        const idsRows: Array<{ id: number }> = await prisma.$queryRaw(
          Prisma.sql`SELECT t.id FROM "Timbangan" t
                     WHERE CAST(t.id AS TEXT) ILIKE ${like}
                        OR CAST(t."grossKg" AS TEXT) ILIKE ${like}
                        OR CAST(t."tareKg" AS TEXT) ILIKE ${like}
                        OR CAST(t."netKg" AS TEXT) ILIKE ${like}`
        );
        const numericIds = idsRows.map(r => r.id);
        if (numericIds.length > 0) {
          or.push({ id: { in: numericIds } });
        }
      }
      where.AND.push({ OR: or });
    }

    const range = getWibRangeUtcFromParams(searchParams)
    if (range) {
      where.AND.push({
        date: {
          gte: range.startUtc,
          lt: range.endExclusiveUtc,
        },
      });
    }

    if (status === 'processed') {
      where.AND.push({ notaSawit: { isNot: null } });
    } else if (status === 'unprocessed') {
      where.AND.push({ notaSawit: null });
    }

    const totalItems = await prisma.timbangan.count({ where });

    const timbangan = await prisma.timbangan.findMany({
      skip,
      take: limit,
      where,
      orderBy: { id: 'desc' },
      include: { kebun: true, supir: true, kendaraan: true, notaSawit: { select: { id: true } } },
    });

    return NextResponse.json({ data: timbangan, total: totalItems });
  } catch (error) {
    console.error('Error fetching timbangan data:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR', 'MANDOR', 'MANAGER'])
    if (guard.response) return guard.response
    const { kebunId, grossKg, tareKg, supirId, kendaraanPlatNomor, notes, photoUrl } = await request.json();
    const grossValue = Number(grossKg);
    const tareValue = Number(tareKg);
    const netKg = grossValue - tareValue;

    if (!kebunId || !grossKg) {
        return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }
    if (Number.isNaN(grossValue) || Number.isNaN(tareValue) || Number.isNaN(netKg)) {
      return NextResponse.json({ error: 'Nilai timbang tidak valid' }, { status: 400 });
    }

    // Define a constant for price per kg (this can be made dynamic later)
    const HARGA_PER_KG = 2000;
    const totalHarga = netKg * HARGA_PER_KG;

    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const newTimbangan = await tx.timbangan.create({
          data: { 
              kebun: { connect: { id: Number(kebunId) } },
              grossKg: grossValue,
              tareKg: tareValue,
              netKg,
              ...(supirId ? { supir: { connect: { id: Number(supirId) } } } : {}),
              ...(kendaraanPlatNomor ? { kendaraan: { connect: { platNomor: String(kendaraanPlatNomor) } } } : {}),
              notes: notes || null,
              photoUrl: photoUrl || null,
          }
      });

      // Auto-create journal entries
      await tx.jurnal.createMany({
        data: [
          {
            date: newTimbangan.date,
            akun: 'Piutang Usaha',
            deskripsi: `Penjualan dari timbangan #${newTimbangan.id}`,
            debit: totalHarga,
            kredit: 0,
          },
          {
            date: newTimbangan.date,
            akun: 'Pendapatan Jasa Angkut',
            deskripsi: `Pendapatan dari timbangan #${newTimbangan.id}`,
            debit: 0,
            kredit: totalHarga,
          },
        ],
      });

      return newTimbangan;
    });

    // Audit Log
    const session = await auth();
    const currentUserId = session?.user?.id ? Number(session.user.id) : guard.id;
    await createAuditLog(currentUserId, 'CREATE', 'Timbangan', result.id.toString(), {
        kebunId,
        grossKg,
        tareKg,
        netKg,
        kendaraanPlatNomor
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error creating timbangan and journal entries:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
