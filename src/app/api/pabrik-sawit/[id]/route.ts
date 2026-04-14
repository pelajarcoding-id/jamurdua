import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { createAuditLog } from '@/lib/audit';
import { requireAuth, requireRole } from '@/lib/route-auth';
import { Prisma } from '@prisma/client';

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
    const { name, address } = body;
    const perusahaanIdsRaw = Array.isArray(body?.perusahaanIds) ? body.perusahaanIds : []
    const perusahaanIds = Array.from(
      new Set(
        perusahaanIdsRaw
          .map((v: any) => Number(v))
          .filter((n: number) => Number.isFinite(n) && n > 0),
      ),
    )
    const defaultPerusahaanId = body?.defaultPerusahaanId ? Number(body.defaultPerusahaanId) : body?.perusahaanId ? Number(body.perusahaanId) : null
    const defaultId = Number.isFinite(defaultPerusahaanId) && (defaultPerusahaanId as number) > 0 ? (defaultPerusahaanId as number) : null
    const finalPerusahaanIds = defaultId && !perusahaanIds.includes(defaultId) ? [...perusahaanIds, defaultId] : perusahaanIds

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const hasLinkTable = async () => {
      const rows = await prisma.$queryRaw<any[]>(
        Prisma.sql`SELECT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'PabrikSawitPerusahaan'
        ) AS "exists"`,
      )
      return Boolean(rows?.[0]?.exists)
    }
    const linkExists = await hasLinkTable().catch(() => false)

    const updatedPabrikSawit = await prisma.$transaction(async (tx) => {
      const updated = await (tx as any).pabrikSawit.update({
        where: { id: parseInt(id, 10) },
        data: { name, address, perusahaanId: defaultId } as any,
      })
      if (linkExists) {
        const pid = Number(updated.id)
        await tx.$executeRaw(Prisma.sql`DELETE FROM "PabrikSawitPerusahaan" WHERE "pabrikSawitId" = ${pid}`)
        if (finalPerusahaanIds.length > 0) {
          const values = finalPerusahaanIds.map((cid) =>
            Prisma.sql`(${pid}, ${cid}, ${defaultId === cid}, NOW(), NOW())`,
          )
          await tx.$executeRaw(
            Prisma.sql`INSERT INTO "PabrikSawitPerusahaan" ("pabrikSawitId","perusahaanId","isDefault","createdAt","updatedAt")
                       VALUES ${Prisma.join(values)}`,
          )
        }
      }
      return updated
    })

    await createAuditLog(guard.id, 'UPDATE', 'PabrikSawit', id, {
      name,
      address,
      perusahaanIds: finalPerusahaanIds,
      defaultPerusahaanId: defaultId,
    })

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
