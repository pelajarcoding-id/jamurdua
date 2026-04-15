import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { createAuditLog } from '@/lib/audit'
import { Prisma } from '@prisma/client'
import { auth } from '@/auth'
import { scheduleFileDeletion } from '@/lib/file-retention'

export const dynamic = 'force-dynamic'

export async function PUT(request: Request, { params }: { params: { id: string } }) {
    try {
        const id = Number(params.id);
        const body = await request.json();
        const { name, email, role, jenisPekerjaan, password, oldPassword, kebunId, kebunIds, photoUrl } = body;

        if (!name || !email || !role) {
            return NextResponse.json({ error: 'Nama, Email, dan Role harus diisi' }, { status: 400 });
        }
        const normalizedEmail = String(email).trim().toLowerCase()
        if (!normalizedEmail) {
            return NextResponse.json({ error: 'Email tidak valid' }, { status: 400 });
        }
        if (role === 'MANDOR' && !kebunId) {
            return NextResponse.json({ error: 'Kebun wajib dipilih untuk role MANDOR' }, { status: 400 });
        }
        if (role === 'MANAGER' && (!Array.isArray(kebunIds) || kebunIds.length === 0)) {
            return NextResponse.json({ error: 'Minimal 1 kebun harus dipilih untuk role MANAGER' }, { status: 400 });
        }

        const updateData: any = { 
            name, 
            email: normalizedEmail, 
            role,
            jobType: jenisPekerjaan || null,
            kebunId: (role === 'MANDOR') ? Number(kebunId) : null,
        };
        
        const existingUserBeforeUpdate = await prisma.user.findUnique({ where: { id } });
        if (!existingUserBeforeUpdate) {
            return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
        }

        if (String(existingUserBeforeUpdate.email || '').toLowerCase() !== normalizedEmail) {
            const exists = await prisma.user.findFirst({
                where: {
                    email: { equals: normalizedEmail, mode: 'insensitive' },
                    NOT: { id },
                },
                select: { id: true },
            })
            if (exists) {
                return NextResponse.json({ error: 'Email sudah terdaftar' }, { status: 409 })
            }
        }

        if (photoUrl !== undefined) {
            if (photoUrl && existingUserBeforeUpdate.photoUrl && existingUserBeforeUpdate.photoUrl !== photoUrl) {
                await scheduleFileDeletion({
                    url: existingUserBeforeUpdate.photoUrl,
                    entity: 'User',
                    entityId: String(id),
                    reason: 'REPLACE_PHOTO',
                })
            }
            updateData.photoUrl = photoUrl || null;
        }

        // Check if requester is Admin or Owner to allow password reset without old password
        const session = await auth();
        const currentUserRole = String(session?.user?.role || '');
        const currentUserId = session?.user?.id ? Number(session.user.id) : 0;
        const isPrivilegedUser = currentUserRole === 'ADMIN' || currentUserRole === 'PEMILIK';
        const isEditingOtherUser = currentUserId !== id;
        const canBypassOldPassword = isPrivilegedUser && isEditingOtherUser;

        if (password) {
            // Verify old password
            if (!oldPassword && !canBypassOldPassword) {
                 return NextResponse.json({ error: 'Password lama harus diisi' }, { status: 400 });
            }

            // Only check old password if provided or if bypass is NOT allowed
            if (oldPassword || !canBypassOldPassword) {
                const currentUser = await prisma.user.findUnique({ where: { id } });
                if (!currentUser) {
                    return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
                }

                // If old password is provided, verify it (even for admins, to prevent mistakes if they chose to enter it)
                // But if it's a bypass case and they didn't provide it, we skip this.
                if (oldPassword) {
                     const isPasswordValid = await bcrypt.compare(oldPassword, currentUser.passwordHash);
                     if (!isPasswordValid) {
                         return NextResponse.json({ error: 'Password lama salah' }, { status: 400 });
                     }
                }
            }

            updateData.passwordHash = await bcrypt.hash(password, 10);
        }

        const updatedUser = await prisma.user.update({
            where: { id },
            data: updateData,
        });

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
                    Prisma.sql`DELETE FROM "_UserKebuns" WHERE "B" = ${id}`
                ),
                ...(role === 'MANAGER'
                    ? kebunIds.map((kid: number) =>
                          prisma.$executeRaw(
                              Prisma.sql`INSERT INTO "_UserKebuns" ("A", "B") VALUES (${kid}, ${id}) ON CONFLICT DO NOTHING`
                          )
                      )
                    : []),
            ]);
        } catch {
            // noop
        }

        // Audit Log
        const auditUserId = currentUserId || 1;
        await createAuditLog(auditUserId, 'UPDATE', 'User', updatedUser.id.toString(), {
            updatedFields: Object.keys(updateData),
            newData: {
                name: updatedUser.name,
                email: updatedUser.email,
                role: updatedUser.role
            }
        });

        return NextResponse.json({ id: updatedUser.id, name: updatedUser.name, email: updatedUser.email, role: updatedUser.role, jobType: updatedUser.jobType });
    } catch (error) {
        console.error(`Error updating user with id: ${params.id}`, error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
    try {
        const id = Number(params.id);
        if (!id || Number.isNaN(id)) {
            return NextResponse.json({ error: 'ID user tidak valid' }, { status: 400 })
        }
        if (id === 1) {
            return NextResponse.json({ error: 'User sistem (ID 1) tidak dapat dihapus.' }, { status: 400 })
        }

        const countAbsensiHarian = async () => {
            try {
                const rows = await prisma.$queryRaw<Array<{ count: number }>>(
                    Prisma.sql`SELECT COUNT(*)::int as "count" FROM public."AbsensiHarian" WHERE "karyawanId" = ${id}`
                )
                return rows?.[0]?.count || 0
            } catch {
                return 0
            }
        }
        const countAbsensiGajiHarian = async () => {
            try {
                const rows = await prisma.$queryRaw<Array<{ count: number }>>(
                    Prisma.sql`SELECT COUNT(*)::int as "count" FROM public."AbsensiGajiHarian" WHERE "karyawanId" = ${id}`
                )
                return rows?.[0]?.count || 0
            } catch {
                return 0
            }
        }
        const countAbsensiDefaultHarian = async () => {
            try {
                const rows = await prisma.$queryRaw<Array<{ count: number }>>(
                    Prisma.sql`SELECT COUNT(*)::int as "count" FROM public."AbsensiDefaultHarian" WHERE "karyawanId" = ${id}`
                )
                return rows?.[0]?.count || 0
            } catch {
                return 0
            }
        }

        const [
            absensiHarianCount,
            absensiGajiHarianCount,
            absensiDefaultHarianCount,
            detailGajianKaryawanCount,
            pekerjaanKebunCount,
            timbanganCount,
            notaSawitCount,
            uangJalanCount,
            auditLogCount,
            inventoryTxnCount,
            kebunInventoryTxnCount,
            permintaanCount,
            assignmentCount,
            kasAsCreatorCount,
            kasAsKaryawanCount,
            kasAsDeleterCount,
        ] = await Promise.all([
            countAbsensiHarian(),
            countAbsensiGajiHarian(),
            countAbsensiDefaultHarian(),
            prisma.detailGajianKaryawan.count({ where: { userId: id } }),
            prisma.pekerjaanKebun.count({ where: { userId: id } }),
            prisma.timbangan.count({ where: { supirId: id } }),
            prisma.notaSawit.count({ where: { supirId: id, deletedAt: null } }),
            prisma.sesiUangJalan.count({ where: { supirId: id, deletedAt: null } }),
            prisma.auditLog.count({ where: { userId: id } }),
            prisma.inventoryTransaction.count({ where: { userId: id } }),
            prisma.kebunInventoryTransaction.count({ where: { userId: id } }),
            prisma.permintaanKebun.count({ where: { userId: id } }),
            prisma.karyawanAssignment.count({ where: { userId: id } }),
            prisma.kasTransaksi.count({ where: { userId: id, deletedAt: null } }),
            prisma.kasTransaksi.count({ where: { karyawanId: id, deletedAt: null } }),
            prisma.kasTransaksi.count({ where: { deletedById: id, deletedAt: null } }),
        ])

        const blockers: Array<{ menu: string; count: number }> = []
        if (absensiHarianCount > 0) blockers.push({ menu: 'Absensi Karyawan', count: absensiHarianCount })
        if (absensiGajiHarianCount > 0) blockers.push({ menu: 'Pembayaran Absensi', count: absensiGajiHarianCount })
        if (absensiDefaultHarianCount > 0) blockers.push({ menu: 'Default Absensi', count: absensiDefaultHarianCount })
        if (notaSawitCount > 0) blockers.push({ menu: 'Nota Sawit', count: notaSawitCount })
        if (uangJalanCount > 0) blockers.push({ menu: 'Uang Jalan', count: uangJalanCount })
        if (timbanganCount > 0) blockers.push({ menu: 'Timbangan', count: timbanganCount })
        if (pekerjaanKebunCount > 0) blockers.push({ menu: 'Pekerjaan Kebun', count: pekerjaanKebunCount })
        if (permintaanCount > 0) blockers.push({ menu: 'Permintaan Kebun', count: permintaanCount })
        if (assignmentCount > 0) blockers.push({ menu: 'Penugasan Karyawan', count: assignmentCount })
        if (detailGajianKaryawanCount > 0) blockers.push({ menu: 'Gajian Karyawan', count: detailGajianKaryawanCount })
        if (inventoryTxnCount > 0) blockers.push({ menu: 'Transaksi Inventory', count: inventoryTxnCount })
        if (kebunInventoryTxnCount > 0) blockers.push({ menu: 'Transaksi Inventory Kebun', count: kebunInventoryTxnCount })
        if (auditLogCount > 0) blockers.push({ menu: 'Audit Log', count: auditLogCount })
        const kasCount = (kasAsCreatorCount || 0) + (kasAsKaryawanCount || 0) + (kasAsDeleterCount || 0)
        if (kasCount > 0) blockers.push({ menu: 'Kas (Transaksi)', count: kasCount })

        if (blockers.length > 0) {
            const detail = blockers.map((b) => `${b.menu} (${b.count})`).join(', ')
            return NextResponse.json(
                {
                    error: `User tidak dapat dihapus karena masih memiliki data di: ${detail}. Sebaiknya nonaktifkan user.`,
                    blockers,
                },
                { status: 409 }
            );
        }

        const deletedUser = await prisma.user.delete({
            where: { id },
        });

        if (deletedUser.photoUrl) {
            await scheduleFileDeletion({
                url: deletedUser.photoUrl,
                entity: 'User',
                entityId: String(id),
                reason: 'DELETE_USER',
            })
        }

        // Audit Log
        const sessionDelete = await auth();
        const auditUserId = sessionDelete?.user?.id ? Number(sessionDelete.user.id) : 1;
        await createAuditLog(auditUserId, 'DELETE', 'User', id.toString(), {
            name: deletedUser.name,
            email: deletedUser.email,
            role: deletedUser.role
        });

        return NextResponse.json({ message: 'Pengguna berhasil dihapus' });
    } catch (error) {
        console.error(`Error deleting user with id: ${params.id}`, error);
        return NextResponse.json({ error: 'Gagal menghapus user. User kemungkinan masih dipakai data lain.' }, { status: 400 });
    }
}
