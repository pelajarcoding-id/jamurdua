
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { createAuditLog } from '@/lib/audit';
import { requireAuth, requireRole } from '@/lib/route-auth';

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const guard = await requireAuth();
    if (guard.response) return guard.response;
    const id = parseInt(params.id);
    const data = await (prisma as any).perusahaan.findUnique({ where: { id } });

    if (!data) {
      return NextResponse.json({ error: 'Perusahaan tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching perusahaan:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK']);
    if (guard.response) return guard.response;
    const id = parseInt(params.id);
    const body = await request.json();
    const { name, address, email, phone, logoUrl } = body;

    const updated = await (prisma as any).perusahaan.update({
      where: { id },
      data: { name, address, email, phone, logoUrl }
    });

    // Audit Log
    await createAuditLog(guard.id, 'UPDATE', 'Perusahaan', id.toString(), {
      name,
      address,
      email,
      phone
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating perusahaan:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK']);
    if (guard.response) return guard.response;
    const id = parseInt(params.id);

    // Check if there are related kebuns or notas
    const checkKebun = await prisma.kebun.count({ where: { perusahaanId: id } as any });
    if (checkKebun > 0) {
      return NextResponse.json({ error: 'Tidak dapat menghapus perusahaan yang masih memiliki data kebun' }, { status: 400 });
    }

    await (prisma as any).perusahaan.delete({
      where: { id }
    });

    // Audit Log
    await createAuditLog(guard.id, 'DELETE', 'Perusahaan', id.toString());

    return NextResponse.json({ message: 'Perusahaan berhasil dihapus' });
  } catch (error) {
    console.error('Error deleting perusahaan:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
