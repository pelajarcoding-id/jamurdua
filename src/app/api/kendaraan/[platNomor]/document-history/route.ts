
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';
import { auth } from '@/auth';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic'

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
        } else if (jenis === 'IZIN_TRAYEK') {
            if (fotoUrl) updateData._izinTrayekUrl = fotoUrl
            updateData._izinTrayekDate = new Date(berlakuHingga)
        } else if (jenis === 'PAJAK') {
            updateData.tanggalPajakTahunan = new Date(berlakuHingga);
        } else if (jenis === 'SPEKSI') {
            updateData.speksi = new Date(berlakuHingga);
            if (fotoUrl) updateData.fotoSpeksiUrl = fotoUrl;
        }

        const izinTrayekUrl = updateData._izinTrayekUrl || null
        delete updateData._izinTrayekUrl
        const izinTrayekDate = updateData._izinTrayekDate || null
        delete updateData._izinTrayekDate

        await (prisma.kendaraan as any).update({
            where: { platNomor },
            data: updateData,
        })

        if (jenis === 'IZIN_TRAYEK' && izinTrayekDate) {
            const col: any = await prisma.$queryRaw(
                Prisma.sql`SELECT 1
                           FROM information_schema.columns
                           WHERE table_schema = 'public'
                             AND table_name = 'Kendaraan'
                             AND column_name = 'tanggalIzinTrayek'
                           LIMIT 1`
            )
            if (Array.isArray(col) && col.length > 0) {
                await prisma.$executeRaw(
                    Prisma.sql`UPDATE "Kendaraan" SET "tanggalIzinTrayek" = ${izinTrayekDate} WHERE "platNomor" = ${platNomor}`
                )
            }
        }

        if ((jenis === 'IZIN_TRAYEK' || jenis === 'PAJAK') && fotoUrl) {
            await prisma.$executeRaw(
                Prisma.sql`UPDATE "Kendaraan" SET "fotoPajakUrl" = ${fotoUrl} WHERE "platNomor" = ${platNomor}`
            )
            const col: any = await prisma.$queryRaw(
                Prisma.sql`SELECT 1
                           FROM information_schema.columns
                           WHERE table_schema = 'public'
                             AND table_name = 'Kendaraan'
                             AND column_name = 'fotoIzinTrayekUrl'
                           LIMIT 1`
            )
            if (Array.isArray(col) && col.length > 0) {
                await prisma.$executeRaw(
                    Prisma.sql`UPDATE "Kendaraan" SET "fotoIzinTrayekUrl" = ${fotoUrl} WHERE "platNomor" = ${platNomor}`
                )
            }
        }

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
