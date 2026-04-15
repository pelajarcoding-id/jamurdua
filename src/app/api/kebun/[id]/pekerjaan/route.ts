import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/route-auth';
import { ensureKebunAccess } from '@/lib/kebun-access';
import { parseWibYmd, wibEndUtcInclusive, wibStartUtc } from '@/lib/wib';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic'

async function ensurePekerjaanKebunKendaraanColumn() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "PekerjaanKebun"
    ADD COLUMN IF NOT EXISTS "kendaraanPlatNomor" TEXT;
  `)
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "PekerjaanKebun_kendaraanPlatNomor_idx"
    ON "PekerjaanKebun" ("kendaraanPlatNomor");
  `)
  const fk = await prisma.$queryRaw<Array<{ exists: number }>>`
    SELECT 1 as "exists"
    FROM pg_constraint
    WHERE conname = 'PekerjaanKebun_kendaraanPlatNomor_fkey'
    LIMIT 1
  `
  if (fk.length === 0) {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "PekerjaanKebun"
      ADD CONSTRAINT "PekerjaanKebun_kendaraanPlatNomor_fkey"
      FOREIGN KEY ("kendaraanPlatNomor") REFERENCES "Kendaraan"("platNomor")
      ON DELETE SET NULL
      NOT VALID
    `)
  }
}

async function resolveKendaraanPlatNomor(input?: string | null) {
  const raw = typeof input === 'string' ? input.trim() : ''
  if (!raw) return null

  const kendaraan = await prisma.kendaraan.findFirst({
    where: {
      platNomor: {
        equals: raw,
        mode: 'insensitive',
      },
    },
    select: { platNomor: true },
  })
  if (kendaraan?.platNomor) return kendaraan.platNomor

  const normalized = raw.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (!normalized) return null
  const rows = await prisma.$queryRaw<Array<{ platNomor: string }>>(
    Prisma.sql`
      SELECT "platNomor"
      FROM "Kendaraan"
      WHERE regexp_replace(lower("platNomor"), '[^a-z0-9]', '', 'g') = ${normalized}
      LIMIT 1
    `
  )
  return rows[0]?.platNomor || null
}

// GET: Ambil daftar pekerjaan untuk kebun tertentu
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await ensurePekerjaanKebunKendaraanColumn()
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR', 'MANDOR', 'MANAGER'])
    if (guard.response) return guard.response
    const kebunId = parseInt(params.id);
    if (isNaN(kebunId)) {
      return NextResponse.json({ error: 'ID Kebun tidak valid' }, { status: 400 });
    }
    const allowed = await ensureKebunAccess(guard.id, guard.role, kebunId)
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')
    const unpaidOnly = searchParams.get('unpaid') === '1'
    const upahBoronganOnly = searchParams.get('upahBorongan') === '1'
    const aktivitasOnly = searchParams.get('aktivitas') === '1'

    const where: any = { kebunId }
    if (startDateParam) {
      const ymd = parseWibYmd(startDateParam)
      if (ymd) where.date = { ...(where.date || {}), gte: wibStartUtc(ymd) }
    }
    if (endDateParam) {
      const ymd = parseWibYmd(endDateParam)
      if (ymd) where.date = { ...(where.date || {}), lte: wibEndUtcInclusive(ymd) }
    }
    if (unpaidOnly) {
      where.gajianId = null
    }
    if (upahBoronganOnly) {
      where.upahBorongan = true
    }
    if (aktivitasOnly) {
      where.upahBorongan = false
    }

    const pekerjaan = await (prisma as any).pekerjaanKebun.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, role: true },
        },
      },
      orderBy: { date: 'desc' },
    });

    const platList = Array.from(
      new Set(
        (Array.isArray(pekerjaan) ? pekerjaan : [])
          .map((p: any) => String(p?.kendaraanPlatNomor || '').trim())
          .filter((x: string) => !!x),
      ),
    )

    const kendaraanRows = platList.length
      ? await prisma.kendaraan.findMany({
          where: { platNomor: { in: platList } },
          select: { platNomor: true, merk: true, jenis: true },
        })
      : []
    const kendaraanByPlat = new Map<string, { platNomor: string; merk: string; jenis: string }>(
      kendaraanRows.map((k) => [k.platNomor, k]),
    )

    const gajianIds: number[] = Array.from(
      new Set<number>(
        pekerjaan
          .map((p: any) => (p?.gajianId ? Number(p.gajianId) : null))
          .filter((id: any): id is number => Number.isFinite(id) && id > 0),
      ),
    )
    const gajianRows = gajianIds.length
      ? await prisma.gajian.findMany({
          where: { id: { in: gajianIds } },
          select: { id: true, status: true },
        })
      : []
    const gajianStatusById = new Map<number, string>(gajianRows.map((g) => [g.id, g.status]))
    const withStatus = pekerjaan.map((p: any) => ({
      ...p,
      gajianStatus: p?.gajianId ? gajianStatusById.get(Number(p.gajianId)) || null : null,
      kendaraan: p?.kendaraanPlatNomor ? kendaraanByPlat.get(String(p.kendaraanPlatNomor)) || null : null,
    }))

    return NextResponse.json(withStatus);
  } catch (error) {
    console.error('Error fetching pekerjaan kebun:', error);
    return NextResponse.json(
      { error: 'Gagal mengambil data pekerjaan' },
      { status: 500 }
    );
  }
}

// POST: Tambah pekerjaan baru
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await ensurePekerjaanKebunKendaraanColumn()
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'MANDOR', 'MANAGER'])
    if (guard.response) return guard.response

    const kebunId = parseInt(params.id);
    if (isNaN(kebunId)) {
      return NextResponse.json({ error: 'ID Kebun tidak valid' }, { status: 400 });
    }
    const allowed = await ensureKebunAccess(guard.id, guard.role, kebunId)
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json();
    const { jenisPekerjaan, keterangan, biaya, userId, userIds, date, upahBorongan, jumlah, satuan, hargaSatuan, imageUrl, kendaraanPlatNomor } = body;

    if (!jenisPekerjaan) {
      return NextResponse.json(
        { error: 'Jenis pekerjaan wajib diisi' },
        { status: 400 }
      );
    }

    const parsedUserIds = Array.isArray(userIds)
      ? userIds.map((id: any) => parseInt(id)).filter((id: number) => !isNaN(id))
      : userId ? [parseInt(userId)] : [];
    const isUpahBorongan = Boolean(upahBorongan);
    const parsedJumlahRaw = jumlah ? parseFloat(jumlah) : 0;
    const parsedJumlah = isUpahBorongan ? (parsedJumlahRaw || 0) : (parsedJumlahRaw > 0 ? parsedJumlahRaw : 0);
    const parsedHargaSatuan = isUpahBorongan && hargaSatuan ? parseFloat(hargaSatuan) : 0;
    const computedBiaya = isUpahBorongan ? (parsedJumlah * parsedHargaSatuan || 0) : 0;
    const resolvedKendaraanPlatNomor = await resolveKendaraanPlatNomor(kendaraanPlatNomor)
    if (kendaraanPlatNomor && !resolvedKendaraanPlatNomor) {
      return NextResponse.json({ error: 'Kendaraan tidak ditemukan' }, { status: 400 })
    }
    const dateYmd = parseWibYmd(date)
    const baseData = {
      kebunId,
      jenisPekerjaan,
      keterangan: keterangan?.trim() ? keterangan.trim() : null,
      biaya: computedBiaya || (isUpahBorongan && biaya ? parseFloat(biaya) : 0),
      imageUrl: imageUrl || null,
      upahBorongan: isUpahBorongan,
      jumlah: parsedJumlah > 0 ? parsedJumlah : null,
      satuan: satuan ? String(satuan) : null,
      hargaSatuan: isUpahBorongan ? parsedHargaSatuan : null,
      kendaraanPlatNomor: resolvedKendaraanPlatNomor,
      date: dateYmd ? wibStartUtc(dateYmd) : (date ? new Date(date) : new Date()),
    };

    if (parsedUserIds.length === 0) {
      const newPekerjaan = await (prisma as any).pekerjaanKebun.create({
        data: {
          ...baseData,
          userId: null,
        },
        include: {
          user: {
            select: { id: true, name: true }
          }
        }
      });
      return NextResponse.json(newPekerjaan);
    }

    const created = await prisma.$transaction(
      parsedUserIds.map((uid: number) =>
        (prisma as any).pekerjaanKebun.create({
          data: {
            ...baseData,
            userId: uid,
          },
          include: {
            user: {
              select: { id: true, name: true }
            }
          }
        })
      )
    );

    return NextResponse.json(created);
  } catch (error) {
    console.error('Error creating pekerjaan kebun:', error);
    return NextResponse.json(
      { error: 'Gagal menyimpan pekerjaan' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await ensurePekerjaanKebunKendaraanColumn()
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'MANDOR', 'MANAGER'])
    if (guard.response) return guard.response

    const kebunId = parseInt(params.id);
    if (isNaN(kebunId)) {
      return NextResponse.json({ error: 'ID Kebun tidak valid' }, { status: 400 });
    }
    const allowed = await ensureKebunAccess(guard.id, guard.role, kebunId)
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json();
    const { id, ids, jenisPekerjaan, keterangan, biaya, userId, date, upahBorongan, jumlah, satuan, hargaSatuan, imageUrl, kendaraanPlatNomor } = body;
    if ((!id && (!Array.isArray(ids) || ids.length === 0)) || !jenisPekerjaan) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    const targetIds = Array.isArray(ids) && ids.length > 0
      ? ids.map((value: any) => parseInt(value)).filter((value: number) => !isNaN(value))
      : [parseInt(id)]

    if (targetIds.length > 0) {
      const lockedRows = await prisma.pekerjaanKebun.findMany({
        where: {
          kebunId,
          id: { in: targetIds },
          upahBorongan: true,
          gajianId: { not: null },
        },
        select: { id: true },
      })
      if (lockedRows.length > 0) {
        return NextResponse.json({ error: 'Data borongan sudah masuk penggajian dan tidak bisa diubah' }, { status: 400 })
      }
    }

    const isUpahBorongan = Boolean(upahBorongan);
    const parsedJumlahRaw = jumlah ? parseFloat(jumlah) : 0;
    const parsedJumlah = isUpahBorongan ? (parsedJumlahRaw || 0) : (parsedJumlahRaw > 0 ? parsedJumlahRaw : 0);
    const parsedHargaSatuan = isUpahBorongan && hargaSatuan ? parseFloat(hargaSatuan) : 0;
    const computedBiaya = isUpahBorongan ? (parsedJumlah * parsedHargaSatuan || 0) : 0;
    const resolvedKendaraanPlatNomor = await resolveKendaraanPlatNomor(kendaraanPlatNomor)
    if (kendaraanPlatNomor && !resolvedKendaraanPlatNomor) {
      return NextResponse.json({ error: 'Kendaraan tidak ditemukan' }, { status: 400 })
    }
    const updateData = {
      kebunId,
      jenisPekerjaan,
      keterangan: keterangan?.trim() ? keterangan.trim() : null,
      biaya: computedBiaya || (isUpahBorongan && biaya ? parseFloat(biaya) : 0),
      ...(typeof imageUrl !== 'undefined' ? { imageUrl: imageUrl || null } : {}),
      upahBorongan: isUpahBorongan,
      jumlah: parsedJumlah > 0 ? parsedJumlah : null,
      satuan: satuan ? String(satuan) : null,
      hargaSatuan: isUpahBorongan ? parsedHargaSatuan : null,
      userId: userId ? parseInt(userId) : null,
      kendaraanPlatNomor: resolvedKendaraanPlatNomor,
      date: date ? new Date(date) : new Date(),
    };

    if (Array.isArray(ids) && ids.length > 0) {
      const parsedIds = targetIds
      await (prisma as any).pekerjaanKebun.updateMany({
        where: { id: { in: parsedIds }, kebunId },
        data: updateData,
      });
      return NextResponse.json({ ok: true });
    }

    const updated = await (prisma as any).pekerjaanKebun.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        user: { select: { id: true, name: true } }
      }
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating pekerjaan kebun:', error);
    return NextResponse.json(
      { error: 'Gagal memperbarui pekerjaan' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await ensurePekerjaanKebunKendaraanColumn()
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'MANDOR', 'MANAGER'])
    if (guard.response) return guard.response

    const kebunId = parseInt(params.id);
    if (isNaN(kebunId)) {
      return NextResponse.json({ error: 'ID Kebun tidak valid' }, { status: 400 });
    }
    const allowed = await ensureKebunAccess(guard.id, guard.role, kebunId)
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get('ids');
    const idParam = searchParams.get('id');
    const ids = idsParam ? idsParam.split(',').map((value) => parseInt(value)).filter((value) => !isNaN(value)) : [];
    if (ids.length === 0 && !idParam) {
      return NextResponse.json({ error: 'ID pekerjaan wajib diisi' }, { status: 400 });
    }

    const targetIds = ids.length > 0 ? ids : [parseInt(idParam as string)]
    const lockedRows = await prisma.pekerjaanKebun.findMany({
      where: {
        kebunId,
        id: { in: targetIds.filter((x) => Number.isFinite(x)) },
        upahBorongan: true,
        gajianId: { not: null },
      },
      select: { id: true },
    })
    if (lockedRows.length > 0) {
      return NextResponse.json({ error: 'Data borongan sudah masuk penggajian dan tidak bisa dihapus' }, { status: 400 })
    }

    if (ids.length > 0) {
      await prisma.pekerjaanKebun.deleteMany({
        where: { id: { in: ids }, kebunId },
      });
    } else {
      await prisma.pekerjaanKebun.delete({
        where: { id: parseInt(idParam as string) },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error deleting pekerjaan kebun:', error);
    return NextResponse.json(
      { error: 'Gagal menghapus pekerjaan' },
      { status: 500 }
    );
  }
}
