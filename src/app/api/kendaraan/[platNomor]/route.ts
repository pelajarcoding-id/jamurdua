
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { auth } from '@/auth'
import { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

interface Params {
    params: { platNomor: string }
}

export async function PUT(request: Request, { params }: Params) {
    try {
        const { platNomor } = params;
        const body = await request.json();
        const { platNomor: newPlatNomor, merk, jenis, tanggalMatiStnk, imageUrl, tanggalPajakTahunan, tanggalIzinTrayek, speksi, fotoStnkUrl, fotoIzinTrayekUrl, fotoPajakUrl, fotoSpeksiUrl } = body;

        if (!merk || !jenis || !tanggalMatiStnk) {
            return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
        }

        if (tanggalIzinTrayek) {
            const col: any = await prisma.$queryRaw(
                Prisma.sql`SELECT 1
                           FROM information_schema.columns
                           WHERE table_schema = 'public'
                             AND table_name = 'Kendaraan'
                             AND column_name = 'tanggalIzinTrayek'
                           LIMIT 1`
            )
            if (!Array.isArray(col) || col.length === 0) {
                return NextResponse.json(
                    { error: 'Kolom tanggalIzinTrayek belum ada di database. Jalankan migrasi (prisma migrate deploy) lalu restart aplikasi.' },
                    { status: 400 }
                )
            }
        }

        const before = await (async () => {
            try {
                const rows = await prisma.$queryRaw(
                    Prisma.sql`SELECT "platNomor","merk","jenis","tanggalMatiStnk","imageUrl","speksi","tanggalPajakTahunan","fotoStnkUrl","fotoSpeksiUrl","fotoPajakUrl" AS "fotoPajakUrlLegacy","fotoIzinTrayekUrl"
                               FROM "Kendaraan"
                               WHERE "platNomor" = ${platNomor}
                               LIMIT 1`
                )
                return Array.isArray(rows) ? rows[0] : rows
            } catch {
                const rows = await prisma.$queryRaw(
                    Prisma.sql`SELECT "platNomor","merk","jenis","tanggalMatiStnk","imageUrl","speksi","tanggalPajakTahunan","fotoStnkUrl","fotoSpeksiUrl","fotoPajakUrl" AS "fotoPajakUrlLegacy"
                               FROM "Kendaraan"
                               WHERE "platNomor" = ${platNomor}
                               LIMIT 1`
                )
                return Array.isArray(rows) ? rows[0] : rows
            }
        })()

        const izinTrayekUrl = fotoIzinTrayekUrl || fotoPajakUrl || null
        const updateBase: any = {
            platNomor: newPlatNomor || undefined,
            merk,
            jenis,
            tanggalMatiStnk: new Date(tanggalMatiStnk),
            imageUrl,
            tanggalPajakTahunan: tanggalPajakTahunan ? new Date(tanggalPajakTahunan) : null,
            speksi: speksi ? new Date(speksi) : null,
            fotoStnkUrl: fotoStnkUrl || imageUrl,
            fotoSpeksiUrl,
        }

        const updated = await (prisma.kendaraan as any).update({ where: { platNomor }, data: updateBase })

        if (tanggalIzinTrayek) {
            await prisma.$executeRaw(
                Prisma.sql`UPDATE "Kendaraan" SET "tanggalIzinTrayek" = ${new Date(tanggalIzinTrayek)} WHERE "platNomor" = ${platNomor}`
            )
        }

        if (izinTrayekUrl) {
            await prisma.$executeRaw(
                Prisma.sql`UPDATE "Kendaraan" SET "fotoPajakUrl" = ${izinTrayekUrl} WHERE "platNomor" = ${platNomor}`
            )
            prisma
                .$executeRaw(
                    Prisma.sql`UPDATE "Kendaraan" SET "fotoIzinTrayekUrl" = ${izinTrayekUrl} WHERE "platNomor" = ${platNomor}`
                )
                .catch(() => null)
        }

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
                fotoIzinTrayekUrl: izinTrayekUrl,
                fotoSpeksiUrl: updated.fotoSpeksiUrl,
            },
        });

        const fresh = await (async () => {
            try {
                const rows = await prisma.$queryRaw(
                    Prisma.sql`SELECT *
                               FROM "Kendaraan"
                               WHERE "platNomor" = ${updated.platNomor}
                               LIMIT 1`
                )
                return Array.isArray(rows) ? rows[0] : rows
            } catch {
                return updated
            }
        })()
        return NextResponse.json(fresh);
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
