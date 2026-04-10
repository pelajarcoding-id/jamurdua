
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { auth } from '@/auth'

interface Params {
    params: { platNomor: string }
}

export async function PUT(request: Request, { params }: Params) {
    try {
        const { platNomor } = params;
        const body = await request.json();
        const { platNomor: newPlatNomor, merk, jenis, tanggalMatiStnk, imageUrl, tanggalPajakTahunan, speksi, fotoStnkUrl, fotoPajakUrl, fotoSpeksiUrl } = body;

        if (!merk || !jenis || !tanggalMatiStnk) {
            return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
        }

        const before = await prisma.kendaraan.findUnique({
            where: { platNomor },
            select: {
                platNomor: true,
                merk: true,
                jenis: true,
                tanggalMatiStnk: true,
                imageUrl: true,
                speksi: true,
                tanggalPajakTahunan: true,
                fotoStnkUrl: true,
                fotoPajakUrl: true,
                fotoSpeksiUrl: true,
            },
        })

        const updated = await prisma.kendaraan.update({
            where: { platNomor },
            data: {
                platNomor: newPlatNomor || undefined,
                merk,
                jenis,
                tanggalMatiStnk: new Date(tanggalMatiStnk),
                imageUrl,
                tanggalPajakTahunan: tanggalPajakTahunan ? new Date(tanggalPajakTahunan) : null,
                speksi: speksi ? new Date(speksi) : null,
                fotoStnkUrl,
                fotoPajakUrl,
                fotoSpeksiUrl,
            },
        });

        const session = await auth();
        const currentUserId = session?.user?.id ? Number(session.user.id) : 1;
        await createAuditLog(currentUserId, 'UPDATE', 'Kendaraan', String(updated.platNomor), {
            before,
            after: {
                platNomor: updated.platNomor,
                merk: updated.merk,
                jenis: updated.jenis,
                tanggalMatiStnk: updated.tanggalMatiStnk,
                imageUrl: updated.imageUrl,
                speksi: updated.speksi,
                tanggalPajakTahunan: updated.tanggalPajakTahunan,
                fotoStnkUrl: updated.fotoStnkUrl,
                fotoPajakUrl: updated.fotoPajakUrl,
                fotoSpeksiUrl: updated.fotoSpeksiUrl,
            },
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error(`Error updating kendaraan ${params.platNomor}:`, error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: Params) {
    try {
        const { platNomor } = params;

        const before = await prisma.kendaraan.findUnique({
            where: { platNomor },
            select: {
                platNomor: true,
                merk: true,
                jenis: true,
            },
        })

        const notaSawitTerkait = await prisma.notaSawit.findFirst({
            where: {
                kendaraan: {
                    platNomor: platNomor,
                },
            },
        });

        if (notaSawitTerkait) {
            return NextResponse.json(
                { error: 'Kendaraan tidak dapat dihapus karena digunakan di Nota Sawit.' },
                { status: 409 }
            );
        }

        await prisma.kendaraan.delete({
            where: { platNomor },
        });

        const session = await auth();
        const currentUserId = session?.user?.id ? Number(session.user.id) : 1;
        await createAuditLog(currentUserId, 'DELETE', 'Kendaraan', platNomor, { before });

        return NextResponse.json({ message: 'Kendaraan berhasil dihapus' }, { status: 200 });
    } catch (error) {
        console.error(`Error deleting kendaraan ${params.platNomor}:`, error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
