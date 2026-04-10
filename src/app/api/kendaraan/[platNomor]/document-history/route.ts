
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';
import { auth } from '@/auth';

interface Params {
    params: { platNomor: string }
}

export async function GET(request: Request, { params }: Params) {
    try {
        const { platNomor } = params;

        const history = await prisma.riwayatDokumen.findMany({
            where: {
                kendaraanPlat: platNomor
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        return NextResponse.json(history);
    } catch (error) {
        console.error("Error fetching document history:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request, { params }: Params) {
    try {
        const { platNomor } = params;
        const body = await request.json();
        const { jenis, berlakuHingga, biaya, keterangan, fotoUrl } = body;

        if (!jenis || !berlakuHingga) {
            return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
        }

        // 1. Create History Record
        const history = await prisma.riwayatDokumen.create({
            data: {
                kendaraanPlat: platNomor,
                jenis,
                berlakuHingga: new Date(berlakuHingga),
                biaya: Number(biaya),
                keterangan,
                fotoUrl
            }
        });

        // 2. Update Kendaraan Record based on document type
        const updateData: any = {};
        if (jenis === 'STNK') {
            updateData.tanggalMatiStnk = new Date(berlakuHingga);
            if (fotoUrl) updateData.fotoStnkUrl = fotoUrl;
        } else if (jenis === 'PAJAK') {
            updateData.tanggalPajakTahunan = new Date(berlakuHingga);
            if (fotoUrl) updateData.fotoPajakUrl = fotoUrl;
        } else if (jenis === 'SPEKSI') {
            updateData.speksi = new Date(berlakuHingga);
            if (fotoUrl) updateData.fotoSpeksiUrl = fotoUrl;
        }

        await prisma.kendaraan.update({
            where: { platNomor },
            data: updateData
        });

        // 3. Create Audit Log
        const session = await auth();
        const currentUserId = session?.user?.id ? Number(session.user.id) : 1;
        await createAuditLog(currentUserId, 'UPDATE', 'Kendaraan', platNomor, {
            action: 'RENEW_DOCUMENT',
            jenis,
            berlakuHingga
        });

        return NextResponse.json(history, { status: 201 });
    } catch (error) {
        console.error("Error creating document history:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
