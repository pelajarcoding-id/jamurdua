import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { createAuditLog } from '@/lib/audit';
import { requireRole } from '@/lib/route-auth';
import { scheduleFileDeletion } from '@/lib/file-retention';
import { parseWibYmd, wibStartUtc } from '@/lib/wib';

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

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR', 'SUPIR'])
    if (guard.response) return guard.response
    const schema = z.object({
      status: z.enum(['BERJALAN', 'SELESAI']).optional(),
      keterangan: z.string().trim().max(500).optional().nullable(),
      kendaraanPlatNomor: z.string().trim().max(32).optional().nullable(),
      tanggalMulai: z.string().optional(),
    });
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
    }
    const { status, keterangan, kendaraanPlatNomor, tanggalMulai } = parsed.data;
    if (status == null && keterangan == null && kendaraanPlatNomor == null && tanggalMulai == null) {
      return NextResponse.json({ error: 'Tidak ada perubahan' }, { status: 400 });
    }

    const existing = await prisma.sesiUangJalan.findUnique({ where: { id } });
    if (!existing || (existing as any).deletedAt) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (guard.role === 'SUPIR' && guard.id !== existing.supirId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const resolvedKendaraanPlatNomor = kendaraanPlatNomor === undefined
      ? undefined
      : await resolveKendaraanPlatNomorOrThrow(kendaraanPlatNomor)

    const nextTanggalMulai = tanggalMulai
      ? (() => {
          const ymd = parseWibYmd(tanggalMulai)
          return ymd ? wibStartUtc(ymd) : new Date(tanggalMulai)
        })()
      : null

    const updatedSesi = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updated = await tx.sesiUangJalan.update({
        where: { id },
        data: {
          ...(status != null ? { status } : {}),
          ...(keterangan != null ? { keterangan } : {}),
          ...(kendaraanPlatNomor != null ? { kendaraanPlatNomor: resolvedKendaraanPlatNomor } : {}),
          ...(nextTanggalMulai ? { tanggalMulai: nextTanggalMulai } : {}),
        } as any,
      })

      const nextKet = typeof keterangan === 'string' ? keterangan.trim() : ''
      if (nextTanggalMulai || nextKet) {
        const first = await tx.$queryRaw<Array<{ id: number; description: string | null }>>(
          Prisma.sql`
            SELECT "id", "description"
            FROM "UangJalan"
            WHERE "deletedAt" IS NULL
              AND "sesiUangJalanId" = ${id}
              AND upper("tipe") = 'PEMASUKAN'
            ORDER BY "createdAt" ASC, "id" ASC
            LIMIT 1
          `
        )
        const firstRow = Array.isArray(first) && first.length > 0 ? first[0] : null
        const firstId = firstRow ? Number(firstRow.id) : 0
        if (Number.isFinite(firstId) && firstId > 0) {
          const updateData: any = {}
          if (nextTanggalMulai) updateData.date = nextTanggalMulai
          if (nextKet && !String(firstRow?.description || '').trim()) updateData.description = nextKet
          if (Object.keys(updateData).length > 0) {
            await tx.uangJalan.update({
              where: { id: firstId },
              data: updateData,
            })
          }
        }
      }

      return updated
    })

    await createAuditLog(guard.id, 'UPDATE', 'SesiUangJalan', id.toString(), {
      ...(status != null ? { status } : {}),
      ...(keterangan != null ? { keterangan } : {}),
      ...(kendaraanPlatNomor != null ? { kendaraanPlatNomor } : {}),
      ...(tanggalMulai ? { tanggalMulai } : {}),
    });

    return NextResponse.json(updatedSesi);
  } catch (error) {
    if ((error as any)?.message === 'KENDARAAN_NOT_FOUND') {
      return NextResponse.json({ error: 'Plat kendaraan tidak ditemukan' }, { status: 400 })
    }
    console.error(`Error updating sesi uang jalan with id: ${params.id}`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR', 'SUPIR'])
    if (guard.response) return guard.response
    const existing = await prisma.sesiUangJalan.findUnique({ where: { id } });
    if (!existing || (existing as any).deletedAt) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (guard.role === 'SUPIR' && guard.id !== existing.supirId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const rincian = await prisma.uangJalan.findMany({
      where: { sesiUangJalanId: id, deletedAt: null },
      select: { id: true, gambarUrl: true },
    })

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.uangJalan.updateMany({
        where: { sesiUangJalanId: id, deletedAt: null },
        data: { deletedAt: new Date(), deletedById: guard.id } as any,
      })

      await tx.sesiUangJalan.update({
        where: { id },
        data: { deletedAt: new Date(), deletedById: guard.id } as any,
      })
    })

    await Promise.all(rincian.map((r) => {
      if (!r.gambarUrl) return Promise.resolve()
      return scheduleFileDeletion({
        url: r.gambarUrl,
        entity: 'UangJalan',
        entityId: String(r.id),
        reason: 'DELETE_SESI',
      })
    }))

    await createAuditLog(guard.id, 'DELETE', 'SesiUangJalan', id.toString(), {});

    return NextResponse.json({ message: 'Sesi Uang Jalan berhasil dihapus' });
  } catch (error) {
    console.error(`Error deleting sesi uang jalan with id: ${params.id}`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
