import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { createAuditLog } from '@/lib/audit';
import { requireRole } from '@/lib/route-auth';
import { ensureKebunAccess } from '@/lib/kebun-access';

export const dynamic = 'force-dynamic'

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'MANDOR', 'MANAGER'])
    if (guard.response) return guard.response
    const currentUserId = guard.id;
    const id = Number(params.id);
    const body = await request.json();

    const before = await prisma.pekerjaanKebun.findUnique({ where: { id } });
    if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const allowed = await ensureKebunAccess(guard.id, guard.role, Number((before as any).kebunId))
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const updated = await prisma.pekerjaanKebun.update({
      where: { id },
      data: {
        date: body.date ? new Date(body.date) : undefined,
        jenisPekerjaan: body.jenisPekerjaan,
        keterangan: body.keterangan,
        biaya: body.biaya !== undefined ? Number(body.biaya) : undefined,
        userId: body.userId ? Number(body.userId) : null,
      },
    });

    await createAuditLog(currentUserId, 'UPDATE', 'PekerjaanKebun', String(id), {
      before,
      after: updated,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating work record:', error);
    return NextResponse.json(
      { error: 'Gagal memperbarui data pekerjaan' },
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
    const currentUserId = guard.id;
    const id = Number(params.id);

    const before = await prisma.pekerjaanKebun.findUnique({ where: { id } });
    if (!before) return NextResponse.json({ message: 'Data berhasil dihapus' });
    const allowed = await ensureKebunAccess(guard.id, guard.role, Number((before as any).kebunId))
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    await prisma.pekerjaanKebun.delete({
      where: { id },
    });

    await createAuditLog(currentUserId, 'DELETE', 'PekerjaanKebun', String(id), { before });

    return NextResponse.json({ message: 'Data berhasil dihapus' });
  } catch (error) {
    console.error('Error deleting work record:', error);
    return NextResponse.json(
      { error: 'Gagal menghapus data pekerjaan' },
      { status: 500 }
    );
  }
}
