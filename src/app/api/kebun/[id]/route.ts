import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { createAuditLog } from '@/lib/audit';
import { requireRole } from '@/lib/route-auth';
import { ensureKebunAccess } from '@/lib/kebun-access';

export async function GET(request: Request, { params }: { params: { id: string } }) {
    try {
        const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR', 'MANDOR', 'MANAGER'])
        if (guard.response) return guard.response
        const id = Number(params.id);
        if (Number.isNaN(id)) {
            return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 });
        }
        const allowed = await ensureKebunAccess(guard.id, guard.role, id)
        if (!allowed) return NextResponse.json({ error: 'Forbidden: Anda tidak memiliki akses ke kebun ini' }, { status: 403 });

        const kebun = await prisma.kebun.findUnique({ where: { id } });
        if (!kebun) {
            return NextResponse.json({ error: 'Kebun tidak ditemukan' }, { status: 404 });
        }
        return NextResponse.json(kebun);
    } catch (error) {
        console.error(`Error fetching kebun with id: ${params.id}`, error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
    try {
        const guard = await requireRole(['ADMIN', 'PEMILIK'])
        if (guard.response) return guard.response
        const id = Number(params.id);
        const { name, location, perusahaanId } = await request.json();

        if (!name) {
            return NextResponse.json({ error: 'Nama kebun harus diisi' }, { status: 400 });
        }

        const before = await prisma.kebun.findUnique({ where: { id } });
        const updatedKebun = await prisma.kebun.update({
            where: { id },
            data: { 
                name, 
                location, 
                perusahaanId: perusahaanId ? parseInt(perusahaanId) : null 
            } as any
        });

        await createAuditLog(guard.id, 'UPDATE', 'Kebun', String(id), {
            before,
            after: updatedKebun,
        });

        return NextResponse.json(updatedKebun);
    } catch (error) {
        console.error(`Error updating kebun with id: ${params.id}` , error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
    try {
        const guard = await requireRole(['ADMIN', 'PEMILIK'])
        if (guard.response) return guard.response
        const id = Number(params.id);
        const before = await prisma.kebun.findUnique({ where: { id } });
        await prisma.kebun.delete({ where: { id } });

        await createAuditLog(guard.id, 'DELETE', 'Kebun', String(id), { before });

        return new NextResponse(null, { status: 204 }); // No Content
    } catch (error) {
        console.error(`Error deleting kebun with id: ${params.id}`, error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
