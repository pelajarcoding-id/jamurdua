
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit';
import { Prisma } from '@prisma/client';
import { auth } from '@/auth';
import { differenceInDays } from 'date-fns';

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const search = searchParams.get('search') || '';
        const jenisFilter = searchParams.get('jenis') || '';
        const statusFilter = (searchParams.get('status') || '').toLowerCase();
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        const skip = (page - 1) * limit;

        const where: any = {
            AND: [],
        };

        if (search) {
            const or: any[] = [
                { platNomor: { contains: search, mode: 'insensitive' } },
                { merk: { contains: search, mode: 'insensitive' } },
                { jenis: { contains: search, mode: 'insensitive' } },
            ];
            where.AND.push({ OR: or });
        }

        if (startDate && endDate) {
            where.AND.push({
                createdAt: {
                    gte: new Date(startDate),
                    lte: new Date(endDate),
                },
            });
        }

        if (jenisFilter) {
            where.AND.push({
                jenis: { equals: jenisFilter, mode: 'insensitive' },
            });
        }

        const computeStatus = (k: any) => {
            const today = new Date();
            const stnkDays = differenceInDays(new Date(k.tanggalMatiStnk), today);
            const pajakDays = k.tanggalPajakTahunan ? differenceInDays(new Date(k.tanggalPajakTahunan), today) : 999;
            const izinDate = (k as any).tanggalIzinTrayek;
            const izinDays = izinDate ? differenceInDays(new Date(izinDate), today) : 999;
            const speksiDays = k.speksi ? differenceInDays(new Date(k.speksi), today) : 999;

            const isLate = stnkDays < 0 || pajakDays < 0 || izinDays < 0 || speksiDays < 0;
            const isUrgent = !isLate && (stnkDays <= 7 || pajakDays <= 7 || izinDays <= 7 || speksiDays <= 7);
            const isWarning = !isLate && !isUrgent && (stnkDays <= 30 || pajakDays <= 30 || izinDays <= 30 || speksiDays <= 30);

            if (isLate) return 'sudah_mati';
            if (isUrgent) return 'segera_habis';
            if (isWarning) return 'perhatian';
            return 'aktif';
        };

        if (statusFilter && statusFilter !== 'all') {
            const allRows = await prisma.kendaraan.findMany({
                where,
                orderBy: { createdAt: 'desc' },
            });
            const filtered = allRows.filter((k) => computeStatus(k) === statusFilter);
            const totalItems = filtered.length;
            const paged = filtered.slice(skip, skip + limit);
            return NextResponse.json({ data: paged, total: totalItems });
        }

        const totalItems = await prisma.kendaraan.count({ where });

        const kendaraan = await prisma.kendaraan.findMany({
            skip,
            take: limit,
            where,
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json({ data: kendaraan, total: totalItems });
    } catch (error) {
        console.error("Error fetching kendaraan:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { platNomor, merk, jenis, tanggalMatiStnk, imageUrl, tanggalPajakTahunan, tanggalIzinTrayek, speksi, fotoStnkUrl, fotoIzinTrayekUrl, fotoPajakUrl, fotoSpeksiUrl, beratKosong } = body;

        if (!platNomor || !merk || !jenis || !tanggalMatiStnk) {
            return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
        }

        // Cek apakah plat nomor sudah ada
        const existingKendaraan = await prisma.kendaraan.findUnique({
            where: { platNomor }
        });

        if (existingKendaraan) {
            return NextResponse.json({ error: `Kendaraan dengan plat nomor ${platNomor} sudah terdaftar.` }, { status: 400 });
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

        const izinTrayekUrl = fotoIzinTrayekUrl || fotoPajakUrl || null
        const baseData: any = {
            platNomor,
            merk,
            jenis,
            tanggalMatiStnk: new Date(tanggalMatiStnk),
            imageUrl,
            tanggalPajakTahunan: tanggalPajakTahunan ? new Date(tanggalPajakTahunan) : null,
            speksi: speksi ? new Date(speksi) : null,
            fotoStnkUrl: fotoStnkUrl || imageUrl,
            fotoSpeksiUrl,
            beratKosong: beratKosong ? parseFloat(beratKosong) : null,
        }

        const newKendaraan = await (prisma.kendaraan as any).create({ data: baseData })

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

        // Audit Log
        const session = await auth();
        const currentUserId = session?.user?.id ? Number(session.user.id) : 1;
        await createAuditLog(currentUserId, 'CREATE', 'Kendaraan', newKendaraan.platNomor, {
            platNomor,
            merk,
            jenis
        });

        const created = await (async () => {
            try {
                const rows = await prisma.$queryRaw(
                    Prisma.sql`SELECT *
                               FROM "Kendaraan"
                               WHERE "platNomor" = ${newKendaraan.platNomor}
                               LIMIT 1`
                )
                return Array.isArray(rows) ? rows[0] : rows
            } catch {
                return newKendaraan
            }
        })()

        return NextResponse.json(created, { status: 201 });
    } catch (error) {
        console.error("Error creating kendaraan:", error);
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === 'P2002') {
                return NextResponse.json({ error: 'Kendaraan dengan plat nomor ini sudah terdaftar.' }, { status: 400 });
            }
        }
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
