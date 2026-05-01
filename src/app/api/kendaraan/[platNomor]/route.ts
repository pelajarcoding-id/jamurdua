
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { auth } from '@/auth'
import { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

interface Params {
    params: { platNomor: string }
}

const normalizePlatParam = (raw: string) => {
    const base = String(raw || '').trim()
    if (!base) return ''
    const plusFixed = base.replace(/\+/g, ' ')
    try {
        return decodeURIComponent(plusFixed).trim()
    } catch {
        return plusFixed.trim()
    }
}

const resolveExistingPlatNomor = async (platNomor: string) => {
    const exact = await prisma.kendaraan.findUnique({
        where: { platNomor },
        select: { platNomor: true },
    })
    if (exact?.platNomor) return exact.platNomor
    if (!platNomor) return null
    const compact = platNomor.toLowerCase().replace(/[^a-z0-9]+/g, '')
    if (!compact) return null
    const rows = await prisma.$queryRaw<Array<{ platNomor: string }>>(
        Prisma.sql`
            SELECT "platNomor"
            FROM "Kendaraan"
            WHERE regexp_replace(lower("platNomor"), '[^a-z0-9]+', '', 'g') = ${compact}
            LIMIT 1
        `,
    )
    return rows.length > 0 ? String(rows[0].platNomor) : null
}

export async function PUT(request: Request, { params }: Params) {
    try {
        const platNomor = normalizePlatParam(params.platNomor);
        const body = await request.json();
        const { platNomor: newPlatNomor, merk, jenis, tanggalMatiStnk, imageUrl, tanggalPajakTahunan, tanggalIzinTrayek, speksi, fotoStnkUrl, fotoIzinTrayekUrl, fotoPajakUrl, fotoSpeksiUrl, beratKosong } = body;

        if (!merk || !jenis || !tanggalMatiStnk) {
            return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
        }

        const existingPlatNomor = await resolveExistingPlatNomor(platNomor)
        if (!existingPlatNomor) {
            return NextResponse.json({ error: 'Kendaraan tidak ditemukan' }, { status: 404 })
        }

        const nextPlatNomor = newPlatNomor ? String(newPlatNomor).trim() : ''
        if (nextPlatNomor && nextPlatNomor !== existingPlatNomor) {
            const conflict = await resolveExistingPlatNomor(nextPlatNomor)
            if (conflict && conflict !== existingPlatNomor) {
                return NextResponse.json({ error: `Plat nomor ${nextPlatNomor} sudah terdaftar` }, { status: 409 })
            }
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
                               WHERE "platNomor" = ${existingPlatNomor}
                               LIMIT 1`
                )
                return Array.isArray(rows) ? rows[0] : rows
            } catch {
                const rows = await prisma.$queryRaw(
                    Prisma.sql`SELECT "platNomor","merk","jenis","tanggalMatiStnk","imageUrl","speksi","tanggalPajakTahunan","fotoStnkUrl","fotoSpeksiUrl","fotoPajakUrl" AS "fotoPajakUrlLegacy"
                               FROM "Kendaraan"
                               WHERE "platNomor" = ${existingPlatNomor}
                               LIMIT 1`
                )
                return Array.isArray(rows) ? rows[0] : rows
            }
        })()

        const izinTrayekUrl = fotoIzinTrayekUrl || fotoPajakUrl || null
        const updateBase: any = {
            platNomor: nextPlatNomor || undefined,
            merk,
            jenis,
            tanggalMatiStnk: new Date(tanggalMatiStnk),
            imageUrl,
            tanggalPajakTahunan: tanggalPajakTahunan ? new Date(tanggalPajakTahunan) : null,
            speksi: speksi ? new Date(speksi) : null,
            fotoStnkUrl: fotoStnkUrl || imageUrl,
            fotoSpeksiUrl,
            beratKosong: beratKosong !== undefined ? (beratKosong ? parseFloat(beratKosong) : null) : undefined,
        }

        const updateResult = await prisma.kendaraan.updateMany({ where: { platNomor: existingPlatNomor }, data: updateBase })
        if (updateResult.count === 0) {
            return NextResponse.json({ error: 'Kendaraan tidak ditemukan' }, { status: 404 })
        }

        const finalPlatNomor = nextPlatNomor || existingPlatNomor
        const updated = await prisma.kendaraan.findUnique({ where: { platNomor: finalPlatNomor } })
        if (!updated) {
            return NextResponse.json({ error: 'Kendaraan tidak ditemukan' }, { status: 404 })
        }

        if (tanggalIzinTrayek) {
            await prisma.$executeRaw(
                Prisma.sql`UPDATE "Kendaraan" SET "tanggalIzinTrayek" = ${new Date(tanggalIzinTrayek)} WHERE "platNomor" = ${updated.platNomor}`
            )
        }

        if (izinTrayekUrl) {
            await prisma.$executeRaw(
                Prisma.sql`UPDATE "Kendaraan" SET "fotoPajakUrl" = ${izinTrayekUrl} WHERE "platNomor" = ${updated.platNomor}`
            )
            prisma
                .$executeRaw(
                    Prisma.sql`UPDATE "Kendaraan" SET "fotoIzinTrayekUrl" = ${izinTrayekUrl} WHERE "platNomor" = ${updated.platNomor}`
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

        return NextResponse.json(updated);
    } catch (error) {
        console.error(`Error updating kendaraan ${params.platNomor}:`, error);
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            return NextResponse.json({ error: 'Kendaraan tidak ditemukan' }, { status: 404 })
        }
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: Params) {
    try {
        const platNomor = normalizePlatParam(params.platNomor);
        const existingPlatNomor = await resolveExistingPlatNomor(platNomor)
        if (!existingPlatNomor) {
            return NextResponse.json({ error: 'Kendaraan tidak ditemukan' }, { status: 404 })
        }

        const before = await prisma.kendaraan.findUnique({
            where: { platNomor: existingPlatNomor },
            select: {
                platNomor: true,
                merk: true,
                jenis: true,
            },
        })

        const notaSawitTerkait = await prisma.notaSawit.findFirst({
            where: {
                kendaraan: {
                    platNomor: existingPlatNomor,
                },
            },
        });

        if (notaSawitTerkait) {
            return NextResponse.json(
                { error: 'Kendaraan tidak dapat dihapus karena digunakan di Nota Sawit.' },
                { status: 409 }
            );
        }

        const del = await prisma.kendaraan.deleteMany({
            where: { platNomor: existingPlatNomor },
        })
        if (del.count === 0) {
            return NextResponse.json({ error: 'Kendaraan tidak ditemukan' }, { status: 404 })
        }

        const session = await auth();
        const currentUserId = session?.user?.id ? Number(session.user.id) : 1;
        await createAuditLog(currentUserId, 'DELETE', 'Kendaraan', existingPlatNomor, { before });

        return NextResponse.json({ message: 'Kendaraan berhasil dihapus' }, { status: 200 });
    } catch (error) {
        console.error(`Error deleting kendaraan ${params.platNomor}:`, error);
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            return NextResponse.json({ error: 'Kendaraan tidak ditemukan' }, { status: 404 })
        }
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
