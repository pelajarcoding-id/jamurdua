
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { createAuditLog } from '@/lib/audit'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/route-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const roleParam = (searchParams.get('role') || '').toUpperCase().trim()
        const guard = await requireRole(roleParam === 'SUPIR' ? ['ADMIN', 'PEMILIK', 'KASIR', 'MANAGER', 'MANDOR'] : ['ADMIN', 'PEMILIK'])
        if (guard.response) return guard.response
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const search = searchParams.get('search') || '';
        const role = searchParams.get('role');
        const status = searchParams.get('status');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        const skip = (page - 1) * limit;

        const where: any = {
            AND: [],
        };

        if (role) {
            where.role = role;
        }

        if (status) {
            const statusParam = status.toUpperCase().trim();
            if (statusParam === 'AKTIF') {
                where.AND.push({
                    OR: [{ status: 'AKTIF' }, { status: null }]
                });
            } else if (statusParam !== 'ALL') {
                where.status = status;
            }
        }

        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { role: { contains: search, mode: 'insensitive' } },
            ];
            const isNumeric = /^\d+$/.test(search);
            if (isNumeric) {
                const like = `%${search}%`;
                const idsRows: Array<{ id: number }> = await prisma.$queryRaw(
                    Prisma.sql`SELECT u.id FROM "User" u WHERE CAST(u.id AS TEXT) ILIKE ${like}`
                );
                const numericIds = idsRows.map(r => r.id);
                if (numericIds.length > 0) {
                    where.OR.push({ id: { in: numericIds } });
                }
            }
        }

        if (startDate && endDate) {
            where.AND.push({
                createdAt: {
                    gte: new Date(startDate),
                    lte: new Date(endDate),
                },
            });
        }

        const totalItems = await prisma.user.count({ where });

        const users = await prisma.user.findMany({
            skip,
            take: limit,
            where,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                jobType: true,
                photoUrl: true,
                createdAt: true,
                updatedAt: true,
                passwordChangedAt: true,
                kebunId: true,
                status: true,
            }
        });

        let userKebunMap: Record<number, number[]> = {};
        try {
            const userIds = users.map(u => u.id);
            if (userIds.length > 0) {
                const rows = await prisma.$queryRaw<Array<{ userId: number; kebunId: number }>>(
                    Prisma.sql`SELECT "B" as "userId", "A" as "kebunId" FROM "_UserKebuns" WHERE "B" IN (${Prisma.join(userIds)})`
                );
                userKebunMap = rows.reduce<Record<number, number[]>>((acc, row) => {
                    if (!acc[row.userId]) acc[row.userId] = [];
                    acc[row.userId].push(row.kebunId);
                    return acc;
                }, {});
            }
        } catch {
            userKebunMap = {};
        }

        const usersWithKebunIds = users.map(u => ({
            ...u,
            kebunIds: userKebunMap[u.id] || [],
        }));

        return NextResponse.json({ data: usersWithKebunIds, total: totalItems });
    } catch (error) {
        console.error("Error fetching users: ", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const guard = await requireRole(['ADMIN', 'PEMILIK'])
        if (guard.response) return guard.response
        const body = await request.json();
        const { name, email, role, jenisPekerjaan, password, kebunId, kebunIds, photoUrl } = body;

        if (!name || !email || !role || !password) {
            return NextResponse.json({ error: 'Semua field harus diisi' }, { status: 400 });
        }
        if (role === 'MANDOR' && !kebunId) {
            return NextResponse.json({ error: 'Kebun wajib dipilih untuk role MANDOR' }, { status: 400 });
        }
        if (role === 'MANAGER' && (!Array.isArray(kebunIds) || kebunIds.length === 0)) {
            return NextResponse.json({ error: 'Minimal 1 kebun harus dipilih untuk role MANAGER' }, { status: 400 });
        }

        const normalizedEmail = String(email).trim().toLowerCase()
        if (!normalizedEmail) {
            return NextResponse.json({ error: 'Email tidak valid' }, { status: 400 });
        }

        const existingUser = await prisma.user.findFirst({
            where: {
                email: {
                    equals: normalizedEmail,
                    mode: 'insensitive',
                },
            },
            select: { id: true },
        });
        if (existingUser) {
            return NextResponse.json({ error: 'Email sudah terdaftar' }, { status: 409 });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const newUser = await prisma.user.create({
            data: {
                name,
                email: normalizedEmail,
                role,
                jobType: jenisPekerjaan || null,
                passwordHash,
                photoUrl: photoUrl || null,
                kebunId: (role === 'MANDOR') ? Number(kebunId) : null,
            },
        });

        if (role === 'MANAGER') {
            try {
                await prisma.$executeRawUnsafe(`
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = '_UserKebuns'
  ) THEN
    CREATE TABLE "_UserKebuns" (
      "A" INTEGER NOT NULL,
      "B" INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX "_UserKebuns_AB_unique" ON "_UserKebuns"("A", "B");
    CREATE INDEX "_UserKebuns_B_index" ON "_UserKebuns"("B");
    ALTER TABLE "_UserKebuns"
      ADD CONSTRAINT "_UserKebuns_A_fkey"
      FOREIGN KEY ("A") REFERENCES "Kebun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    ALTER TABLE "_UserKebuns"
      ADD CONSTRAINT "_UserKebuns_B_fkey"
      FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;`);
                await prisma.$transaction([
                    prisma.$executeRaw(
                        Prisma.sql`DELETE FROM "_UserKebuns" WHERE "B" = ${newUser.id}`
                    ),
                    ...kebunIds.map((kid: number) =>
                        prisma.$executeRaw(
                            Prisma.sql`INSERT INTO "_UserKebuns" ("A", "B") VALUES (${kid}, ${newUser.id}) ON CONFLICT DO NOTHING`
                        )
                    ),
                ]);
            } catch {
                // noop
            }
        }

        // Audit Log
        await createAuditLog(guard.id, 'CREATE', 'User', newUser.id.toString(), {
            name: newUser.name,
            email: newUser.email,
            role: newUser.role
        });

        return NextResponse.json({ id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role });
    } catch (error) {
        console.error("Error creating user: ", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
