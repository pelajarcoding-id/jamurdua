import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import type { SesiUangJalan, UangJalan, User, Kendaraan } from '@prisma/client';
import { createAuditLog } from '@/lib/audit';
import { auth } from '@/auth';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { requireRole } from '@/lib/route-auth';
import { getWibRangeUtcFromParams, parseWibYmd, wibStartUtc } from '@/lib/wib';

export const dynamic = 'force-dynamic'

async function resolveKendaraanPlatNomorOrThrow(input?: string | null) {
  const raw = typeof input === 'string' ? input.trim() : ''
  if (!raw) return null

  const kendaraan = await prisma.kendaraan.findFirst({
    where: { platNomor: { equals: raw, mode: 'insensitive' } },
    select: { platNomor: true },
  })
  if (kendaraan?.platNomor) return kendaraan.platNomor

  const normalized = raw.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (normalized) {
    const rows = await prisma.$queryRaw<Array<{ platNomor: string }>>(
      Prisma.sql`
        SELECT "platNomor"
        FROM "Kendaraan"
        WHERE regexp_replace(lower("platNomor"), '[^a-z0-9]', '', 'g') = ${normalized}
        LIMIT 1
      `
    )
    if (rows.length > 0 && rows[0]?.platNomor) return rows[0].platNomor
  }

  throw new Error('KENDARAAN_NOT_FOUND')
}

// Define a type for the session object that includes relations
type SesiWithDetails = SesiUangJalan & {
  supir: User;
  kendaraan: Kendaraan | null;
  createdBy: User | null;
  rincian: UangJalan[];
};

export async function GET(request: Request) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR', 'SUPIR'])
    if (guard.response) return guard.response
    const session = await auth();
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    let supirId = searchParams.get('supirId');
    if (session?.user?.role === 'SUPIR') {
      supirId = String(session.user.id);
    }

    const skip = (page - 1) * limit;

    const where: any = {
      AND: [],
    };

    where.AND.push({ deletedAt: null });

    if (supirId) {
      where.AND.push({ supirId: Number(supirId) });
    }

    if (search) {
      where.OR = [
        { supir: { name: { contains: search, mode: 'insensitive' } } },
        { kendaraan: { platNomor: { contains: search, mode: 'insensitive' } } },
        { keterangan: { contains: search, mode: 'insensitive' } },
      ];
      const isNumeric = /^\d+(\.\d+)?$/.test(search);
      if (isNumeric) {
        const like = `%${search}%`;
        const idsRows: Array<{ id: number }> = await prisma.$queryRaw(
          Prisma.sql`SELECT s.id
                     FROM "SesiUangJalan" s
                     LEFT JOIN "UangJalan" r ON r."sesiUangJalanId" = s.id AND r."deletedAt" IS NULL
                     WHERE s."deletedAt" IS NULL AND (CAST(s.id AS TEXT) ILIKE ${like}
                        OR CAST(r.amount AS TEXT) ILIKE ${like})`
        );
        const numericIds = idsRows.map(r => r.id);
        if (numericIds.length > 0) {
          where.OR.push({ id: { in: numericIds } });
        }
      }
    }

    const range = getWibRangeUtcFromParams(searchParams)
    if (range) {
      where.AND.push({
        tanggalMulai: {
          gte: range.startUtc,
          lt: range.endExclusiveUtc,
        },
      });
    }

    const totalItems = await prisma.sesiUangJalan.count({ where });

    const sesiIds = await prisma.sesiUangJalan.findMany({
      where,
      select: { id: true },
    });
    const idList = sesiIds.map(s => s.id);
    let totalDiberikan = 0;
    let totalPengeluaran = 0;
    if (idList.length > 0) {
      const pemasukanAgg = await prisma.uangJalan.aggregate({
        _sum: { amount: true },
        where: { tipe: { equals: 'PEMASUKAN', mode: 'insensitive' }, sesiUangJalanId: { in: idList }, deletedAt: null },
      });
      const pengeluaranAgg = await prisma.uangJalan.aggregate({
        _sum: { amount: true },
        where: { tipe: { equals: 'PENGELUARAN', mode: 'insensitive' }, sesiUangJalanId: { in: idList }, deletedAt: null },
      });
      totalDiberikan = pemasukanAgg._sum.amount || 0;
      totalPengeluaran = pengeluaranAgg._sum.amount || 0;
    }

    const sesiUangJalan = await prisma.sesiUangJalan.findMany({
      skip,
      take: limit,
      where,
      include: {
        supir: true,
        kendaraan: true,
        createdBy: { select: { id: true, name: true } },
        rincian: { where: { deletedAt: null } },
      } as any,
      orderBy: [
        { tanggalMulai: 'desc' },
        { createdAt: 'desc' }
      ],
    }) as any[];

    const normalizeTipe = (val: any) => String(val || '').toUpperCase()

    const repairs: Array<{ id: number; data: { date?: Date; description?: string | null } }> = []
    for (const sesi of sesiUangJalan as SesiWithDetails[]) {
      const tanggalMulai = sesi?.tanggalMulai ? new Date(sesi.tanggalMulai) : null
      if (!tanggalMulai || Number.isNaN(tanggalMulai.getTime())) continue

      const pemasukan = Array.isArray(sesi?.rincian)
        ? sesi.rincian.filter((r: any) => normalizeTipe(r?.tipe) === 'PEMASUKAN' && !(r as any)?.deletedAt)
        : []

      pemasukan.sort((a: any, b: any) => {
        const ca = a?.createdAt ? new Date(a.createdAt).getTime() : 0
        const cb = b?.createdAt ? new Date(b.createdAt).getTime() : 0
        if (ca !== cb) return ca - cb
        return Number(a?.id || 0) - Number(b?.id || 0)
      })

      const first = pemasukan[0] as any
      const firstDate = first?.date ? new Date(first.date) : null
      if (!first || !Number(first?.id)) continue
      const updateData: { date?: Date; description?: string | null } = {}

      if (!firstDate || Number.isNaN(firstDate.getTime()) || firstDate.getTime() !== tanggalMulai.getTime()) {
        updateData.date = tanggalMulai
        first.date = tanggalMulai
      }

      const sesiKet = String((sesi as any)?.keterangan || '').trim()
      const firstDesc = String(first?.description || '').trim()
      if (!firstDesc && sesiKet) {
        updateData.description = sesiKet
        first.description = sesiKet
      }

      if (Object.keys(updateData).length > 0) {
        repairs.push({ id: Number(first.id), data: updateData })
      }
    }

    if (repairs.length > 0) {
      await prisma.$transaction(
        repairs.map((r) =>
          prisma.uangJalan.update({
            where: { id: r.id },
            data: r.data as any,
          })
        )
      )
    }

    const result = sesiUangJalan.map((sesi: SesiWithDetails) => {
      const totalPemasukan = sesi.rincian
        .filter((r: UangJalan) => normalizeTipe(r.tipe) === 'PEMASUKAN')
        .reduce((acc: number, r: UangJalan) => acc + r.amount, 0);

      const totalPengeluaran = sesi.rincian
        .filter((r: UangJalan) => normalizeTipe(r.tipe) === 'PENGELUARAN')
        .reduce((acc: number, r: UangJalan) => acc + r.amount, 0);

      return {
        ...sesi,
        totalDiberikan: totalPemasukan,
        totalPengeluaran,
        totalKembalian: totalPengeluaran,
        saldo: totalPemasukan - totalPengeluaran,
      };
    });

    const summary = {
      totalDiberikan,
      totalPengeluaran,
      totalKembalian: totalPengeluaran,
      totalSaldo: totalDiberikan - totalPengeluaran,
      totalSesi: totalItems,
    };

    return NextResponse.json({ data: result, total: totalItems, summary });
  } catch (error) {
    console.error("Error fetching sesi uang jalan: ", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

interface PostRequestBody {
    supirId: number;
    keterangan?: string;
    amount: number;
    description?: string;
    kendaraanPlatNomor?: string | null;
    tanggalMulai?: string;
}

export async function POST(request: Request) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR'])
    if (guard.response) return guard.response
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const schema = z.object({
      supirId: z.coerce.number().int().positive(),
      keterangan: z.string().trim().max(500).optional(),
      amount: z.coerce.number().nonnegative(),
      description: z.string().trim().max(500).optional(),
      kendaraanPlatNomor: z.preprocess(
        (v) => (v === '' ? null : v),
        z.string().trim().max(32).nullable().optional()
      ),
      tanggalMulai: z.string().optional(),
    });
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
    }
    const { supirId, keterangan, amount, description, kendaraanPlatNomor, tanggalMulai } = parsed.data;
    if (session.user?.role === 'SUPIR' && Number(session.user?.id) !== Number(supirId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Create a new session and the first transaction within it
    const currentUserId = session?.user?.id ? Number(session.user.id) : null;
    const resolvedKendaraanPlatNomor = kendaraanPlatNomor === undefined
      ? undefined
      : await resolveKendaraanPlatNomorOrThrow(kendaraanPlatNomor)
    const tanggalMulaiDate = (() => {
      const ymd = parseWibYmd(tanggalMulai)
      return ymd ? wibStartUtc(ymd) : (tanggalMulai ? new Date(tanggalMulai) : new Date())
    })()
    const initialDescription = (() => {
      const raw = String(description ?? keterangan ?? '').trim()
      return raw ? raw : undefined
    })()
    const newSesi = await prisma.sesiUangJalan.create({
      data: {
        supirId: Number(supirId),
        keterangan,
        kendaraanPlatNomor: resolvedKendaraanPlatNomor,
        ...(currentUserId ? { createdById: currentUserId } : {}),
        tanggalMulai: tanggalMulaiDate,
        rincian: {
          create: {
            tipe: 'PEMASUKAN',
            amount: Number(amount),
            description: initialDescription,
            date: tanggalMulaiDate,
          },
        },
      } as any,
      include: {
        rincian: true,
      },
    });

    // Audit Log
    const auditUserId = currentUserId || 1;
    await createAuditLog(auditUserId, 'CREATE', 'SesiUangJalan', newSesi.id.toString(), {
        supirId,
        amount,
        kendaraanPlatNomor,
        tanggalMulai: newSesi.tanggalMulai
    });

    return NextResponse.json(newSesi);
  } catch (error) {
    if ((error as any)?.message === 'KENDARAAN_NOT_FOUND') {
      return NextResponse.json({ error: 'Plat kendaraan tidak ditemukan' }, { status: 400 })
    }
    console.error("Error creating sesi uang jalan: ", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
