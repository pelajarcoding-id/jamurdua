import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { createAuditLog } from '@/lib/audit';
import { requireAuth, requireRole } from '@/lib/route-auth';

export const dynamic = 'force-dynamic'

// GET /api/pabrik-sawit/[id]
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const guard = await requireAuth();
    if (guard.response) return guard.response;
    const { id } = params;
    const pabrikSawit = await prisma.pabrikSawit.findUnique({
      where: { id: parseInt(id, 10) },
    });

    if (!pabrikSawit) {
      return NextResponse.json({ error: 'Pabrik sawit not found' }, { status: 404 });
    }

    return NextResponse.json(pabrikSawit);
  } catch (error) {
    console.error('Error fetching pabrik sawit:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// PUT /api/pabrik-sawit/[id]
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK']);
    if (guard.response) return guard.response;
    const { id } = params;
    const body = await request.json();
    const { name, address, perusahaanId } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const updatedPabrikSawit = await prisma.pabrikSawit.update({
      where: { id: parseInt(id, 10) },
      data: {
        name,
        address,
        perusahaanId: perusahaanId ? parseInt(perusahaanId) : null
      } as any,
    });

    return NextResponse.json(updatedPabrikSawit);
  } catch (error) {
    console.error('Error updating pabrik sawit:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// DELETE /api/pabrik-sawit/[id]
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK']);
    if (guard.response) return guard.response;
    const { id } = params;

    await prisma.pabrikSawit.delete({
      where: { id: parseInt(id, 10) },
    });

    // Audit Log
    await createAuditLog(guard.id, 'DELETE', 'PabrikSawit', id, {
        deletedId: id
    });

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting pabrik sawit:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
