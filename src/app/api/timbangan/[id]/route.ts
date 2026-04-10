import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { createAuditLog } from '@/lib/audit';
import { auth } from '@/auth';
import { requireRole } from '@/lib/route-auth';

export const dynamic = 'force-dynamic'

export async function PUT(request: Request, { params }: { params: { id: string } }) {
    try {
        const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR', 'MANDOR', 'MANAGER'])
        if (guard.response) return guard.response
        const session = await auth();
        const currentUserId = session?.user?.id ? Number(session.user.id) : 1;
        const id = Number(params.id);
        const { kebunId, grossKg, tareKg, supirId, kendaraanPlatNomor, notes, photoUrl } = await request.json();
        const netKg = parseFloat(grossKg) - parseFloat(tareKg);

        if (!kebunId || !grossKg) {
            return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
        }

        const before = await prisma.timbangan.findUnique({ where: { id } });
        const updatedTimbangan = await prisma.timbangan.update({
            where: { id },
            data: { 
                kebunId: Number(kebunId),
                grossKg: parseFloat(grossKg),
                tareKg: parseFloat(tareKg),
                netKg,
                supirId: supirId ? Number(supirId) : null,
                kendaraanPlatNomor: kendaraanPlatNomor || null,
                notes: notes || null,
                photoUrl: photoUrl || null,
            }
        });

        await createAuditLog(currentUserId, 'UPDATE', 'Timbangan', String(id), {
            before,
            after: updatedTimbangan,
        });

        return NextResponse.json(updatedTimbangan);
    } catch (error) {
        console.error(`Error updating timbangan with id: ${params.id}` , error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
    try {
        const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR', 'MANDOR', 'MANAGER'])
        if (guard.response) return guard.response
        const session = await auth();
        const currentUserId = session?.user?.id ? Number(session.user.id) : 1;
        const id = Number(params.id);

        const before = await prisma.timbangan.findUnique({ where: { id } });
        await prisma.timbangan.delete({ where: { id } });

        await createAuditLog(currentUserId, 'DELETE', 'Timbangan', String(id), { before });

        return new NextResponse(null, { status: 204 }); // No Content
    } catch (error) {
        console.error(`Error deleting timbangan with id: ${params.id}`, error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
