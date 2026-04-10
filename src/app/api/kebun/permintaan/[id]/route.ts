import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/route-auth';
import { ensureKebunAccess } from '@/lib/kebun-access';

// PATCH: Update status permintaan (Approve/Reject)
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'MANAGER'])
    if (guard.response) return guard.response

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID Permintaan tidak valid' }, { status: 400 });
    }

    const body = await request.json();
    const { status } = body;

    if (!status || !['PENDING', 'APPROVED', 'REJECTED', 'COMPLETED'].includes(status)) {
      return NextResponse.json({ error: 'Status tidak valid' }, { status: 400 });
    }

    const before = await (prisma as any).permintaanKebun.findUnique({
      where: { id },
      select: { id: true, kebunId: true, userId: true, title: true },
    });
    if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const allowed = await ensureKebunAccess(guard.id, guard.role, Number(before.kebunId))
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const updatedPermintaan = await (prisma as any).permintaanKebun.update({
      where: { id },
      data: { status },
      include: {
        kebun: true
      }
    });

    // Notify requester about status change
    try {
        await prisma.notification.create({
            data: {
                userId: updatedPermintaan.userId,
                title: 'Update Status Permintaan',
                message: `Permintaan Anda "${updatedPermintaan.title}" di ${updatedPermintaan.kebun.name} telah diubah menjadi ${status}`,
                type: status === 'APPROVED' ? 'SUCCESS' : status === 'REJECTED' ? 'ERROR' : 'INFO',
                link: `/kebun/${updatedPermintaan.kebunId}?tab=permintaan`
            }
        });
    } catch (error) {
        console.error('Failed to send notification', error);
    }

    return NextResponse.json(updatedPermintaan);
  } catch (error) {
    console.error('Error updating permintaan:', error);
    return NextResponse.json(
      { error: 'Gagal mengupdate permintaan' },
      { status: 500 }
    );
  }
}

// DELETE: Hapus permintaan
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'MANDOR', 'MANAGER'])
    if (guard.response) return guard.response

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID Permintaan tidak valid' }, { status: 400 });
    }

    const existing = await (prisma as any).permintaanKebun.findUnique({
      where: { id },
      select: { id: true, kebunId: true, userId: true },
    });
    if (!existing) return NextResponse.json({ success: true });
    const allowed = await ensureKebunAccess(guard.id, guard.role, Number(existing.kebunId))
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const isAdminOrOwner = guard.role === 'ADMIN' || guard.role === 'PEMILIK'
    if (!isAdminOrOwner && guard.id !== Number(existing.userId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await (prisma as any).permintaanKebun.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting permintaan:', error);
    return NextResponse.json(
      { error: 'Gagal menghapus permintaan' },
      { status: 500 }
    );
  }
}
