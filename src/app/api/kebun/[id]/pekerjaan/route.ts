import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/route-auth';
import { ensureKebunAccess } from '@/lib/kebun-access';
import { parseWibYmd, wibEndUtcInclusive, wibStartUtc } from '@/lib/wib';

export const dynamic = 'force-dynamic'

// GET: Ambil daftar pekerjaan untuk kebun tertentu
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
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

    const pekerjaan = await prisma.pekerjaanKebun.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, role: true }
        }
      },
      orderBy: { date: 'desc' }
    });

    const gajianIds = Array.from(
      new Set(
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
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'MANDOR', 'MANAGER'])
    if (guard.response) return guard.response

    const kebunId = parseInt(params.id);
    if (isNaN(kebunId)) {
      return NextResponse.json({ error: 'ID Kebun tidak valid' }, { status: 400 });
    }
    const allowed = await ensureKebunAccess(guard.id, guard.role, kebunId)
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json();
    const { jenisPekerjaan, keterangan, biaya, userId, userIds, date, upahBorongan, jumlah, satuan, hargaSatuan, imageUrl } = body;

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
    const parsedJumlah = isUpahBorongan && jumlah ? parseFloat(jumlah) : 0;
    const parsedHargaSatuan = isUpahBorongan && hargaSatuan ? parseFloat(hargaSatuan) : 0;
    const computedBiaya = isUpahBorongan ? (parsedJumlah * parsedHargaSatuan || 0) : 0;
    const dateYmd = parseWibYmd(date)
    const baseData = {
      kebunId,
      jenisPekerjaan,
      keterangan: keterangan?.trim() ? keterangan.trim() : null,
      biaya: computedBiaya || (isUpahBorongan && biaya ? parseFloat(biaya) : 0),
      imageUrl: imageUrl || null,
      upahBorongan: isUpahBorongan,
      jumlah: isUpahBorongan ? parsedJumlah : null,
      satuan: isUpahBorongan && satuan ? String(satuan) : null,
      hargaSatuan: isUpahBorongan ? parsedHargaSatuan : null,
      date: dateYmd ? wibStartUtc(dateYmd) : (date ? new Date(date) : new Date()),
    };

    if (parsedUserIds.length === 0) {
      const newPekerjaan = await prisma.pekerjaanKebun.create({
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
        prisma.pekerjaanKebun.create({
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
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'MANDOR', 'MANAGER'])
    if (guard.response) return guard.response

    const kebunId = parseInt(params.id);
    if (isNaN(kebunId)) {
      return NextResponse.json({ error: 'ID Kebun tidak valid' }, { status: 400 });
    }
    const allowed = await ensureKebunAccess(guard.id, guard.role, kebunId)
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json();
    const { id, ids, jenisPekerjaan, keterangan, biaya, userId, date, upahBorongan, jumlah, satuan, hargaSatuan, imageUrl } = body;
    if ((!id && (!Array.isArray(ids) || ids.length === 0)) || !jenisPekerjaan) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    const isUpahBorongan = Boolean(upahBorongan);
    const parsedJumlah = isUpahBorongan && jumlah ? parseFloat(jumlah) : 0;
    const parsedHargaSatuan = isUpahBorongan && hargaSatuan ? parseFloat(hargaSatuan) : 0;
    const computedBiaya = isUpahBorongan ? (parsedJumlah * parsedHargaSatuan || 0) : 0;
    const updateData = {
      kebunId,
      jenisPekerjaan,
      keterangan: keterangan?.trim() ? keterangan.trim() : null,
      biaya: computedBiaya || (isUpahBorongan && biaya ? parseFloat(biaya) : 0),
      ...(typeof imageUrl !== 'undefined' ? { imageUrl: imageUrl || null } : {}),
      upahBorongan: isUpahBorongan,
      jumlah: isUpahBorongan ? parsedJumlah : null,
      satuan: isUpahBorongan && satuan ? String(satuan) : null,
      hargaSatuan: isUpahBorongan ? parsedHargaSatuan : null,
      userId: userId ? parseInt(userId) : null,
      date: date ? new Date(date) : new Date(),
    };

    if (Array.isArray(ids) && ids.length > 0) {
      const parsedIds = ids.map((value: any) => parseInt(value)).filter((value: number) => !isNaN(value));
      await prisma.pekerjaanKebun.updateMany({
        where: { id: { in: parsedIds }, kebunId },
        data: updateData,
      });
      return NextResponse.json({ ok: true });
    }

    const updated = await prisma.pekerjaanKebun.update({
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
