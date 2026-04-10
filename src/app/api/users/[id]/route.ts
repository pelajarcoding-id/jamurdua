import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { createAuditLog } from '@/lib/audit'
import { Prisma } from '@prisma/client'
import { auth } from '@/auth'

export async function PUT(request: Request, { params }: { params: { id: string } }) {
    try {
        const id = Number(params.id);
        const data = await request.formData();
        const name = data.get('name') as string;
        const email = data.get('email') as string;
        const role = data.get('role') as string;
        const jenisPekerjaan = data.get('jenisPekerjaan') as string | null;
        const password = data.get('password') as string | null;
        const oldPassword = data.get('oldPassword') as string | null;
        const kebunId = data.get('kebunId') ? Number(data.get('kebunId')) : null;
        const kebunIdsRaw = data.get('kebunIds') as string | null;
        const kebunIds = kebunIdsRaw ? JSON.parse(kebunIdsRaw) as number[] : [];
        const photo = data.get('photo') as File | null;

        if (!name || !email || !role) {
            return NextResponse.json({ error: 'Nama, Email, dan Role harus diisi' }, { status: 400 });
        }
        if (role === 'MANDOR' && !kebunId) {
            return NextResponse.json({ error: 'Kebun wajib dipilih untuk role MANDOR' }, { status: 400 });
        }
        if (role === 'MANAGER' && (!Array.isArray(kebunIds) || kebunIds.length === 0)) {
            return NextResponse.json({ error: 'Minimal 1 kebun harus dipilih untuk role MANAGER' }, { status: 400 });
        }

        const updateData: any = { 
            name, 
            email, 
            role,
            jobType: jenisPekerjaan || null,
            kebunId: (role === 'MANDOR') ? kebunId : null,
        };

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

        if (photo) {
            const bytes = await photo.arrayBuffer();
            const buffer = Buffer.from(bytes);
            const filename = `${Date.now()}-${photo.name}`;
            const path = join(process.cwd(), 'public/uploads', filename);
            await writeFile(path, buffer);
            updateData.photoUrl = `/uploads/${filename}`;
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
                    ? kebunIds.map((kid) =>
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

        const notaSawitCount = await prisma.notaSawit.count({
            where: { supirId: id },
        });

        const uangJalanCount = await prisma.sesiUangJalan.count({
            where: { supirId: id },
        });

        const [
            auditLogCount,
            inventoryTxnCount,
            kebunInventoryTxnCount,
            permintaanCount,
            assignmentCount,
            kasAsCreatorCount,
            kasAsKaryawanCount,
            kasAsDeleterCount,
        ] = await Promise.all([
            prisma.auditLog.count({ where: { userId: id } }),
            prisma.inventoryTransaction.count({ where: { userId: id } }),
            prisma.kebunInventoryTransaction.count({ where: { userId: id } }),
            prisma.permintaanKebun.count({ where: { userId: id } }),
            prisma.karyawanAssignment.count({ where: { userId: id } }),
            prisma.kasTransaksi.count({ where: { userId: id } }),
            prisma.kasTransaksi.count({ where: { karyawanId: id } }),
            prisma.kasTransaksi.count({ where: { deletedById: id } }),
        ])

        const blockers: string[] = []
        if (notaSawitCount > 0) blockers.push('Nota Sawit')
        if (uangJalanCount > 0) blockers.push('Uang Jalan')
        if (auditLogCount > 0) blockers.push('Audit Log')
        if (inventoryTxnCount > 0) blockers.push('Transaksi Inventory')
        if (kebunInventoryTxnCount > 0) blockers.push('Transaksi Inventory Kebun')
        if (permintaanCount > 0) blockers.push('Permintaan Kebun')
        if (assignmentCount > 0) blockers.push('Penugasan Karyawan')
        if (kasAsCreatorCount > 0 || kasAsKaryawanCount > 0 || kasAsDeleterCount > 0) blockers.push('Kas Transaksi')

        if (blockers.length > 0) {
            return NextResponse.json(
                { error: `Pengguna tidak dapat dihapus karena masih digunakan di: ${blockers.join(', ')}. Gunakan nonaktifkan user jika perlu.` },
                { status: 400 }
            );
        }

        const deletedUser = await prisma.user.delete({
            where: { id },
        });

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
