
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit';
import { Prisma } from '@prisma/client';
import { auth } from '@/auth';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const search = searchParams.get('search') || '';
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
            const isNumeric = /^\d+(\.\d+)?$/.test(search);
            if (isNumeric) {
                const like = `%${search}%`;
                const idsRows: Array<{ id: number }> = await prisma.$queryRaw(
                    Prisma.sql`SELECT k.id FROM "Kendaraan" k WHERE CAST(k.id AS TEXT) ILIKE ${like}`
                );
                const numericIds = idsRows.map(r => r.id);
                if (numericIds.length > 0) {
                    or.push({ id: { in: numericIds } });
                }
            }
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
        const { platNomor, merk, jenis, tanggalMatiStnk, imageUrl, tanggalPajakTahunan, speksi, fotoStnkUrl, fotoPajakUrl, fotoSpeksiUrl } = body;

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

        const newKendaraan = await prisma.kendaraan.create({
            data: {
                platNomor,
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

        // Audit Log
        const session = await auth();
        const currentUserId = session?.user?.id ? Number(session.user.id) : 1;
        await createAuditLog(currentUserId, 'CREATE', 'Kendaraan', newKendaraan.platNomor, {
            platNomor,
            merk,
            jenis
        });

        return NextResponse.json(newKendaraan, { status: 201 });
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
