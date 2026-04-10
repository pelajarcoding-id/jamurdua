import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { createAuditLog } from '@/lib/audit';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  const gajianId = parseInt(id, 10);

  if (isNaN(gajianId)) {
    return NextResponse.json({ error: 'Invalid gajianId' }, { status: 400 });
  }

  const session = await auth();
  if (!session?.user?.role || !['ADMIN', 'PEMILIK'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const gajian = await tx.gajian.findUnique({
        where: { id: gajianId },
        include: {
          detailGajian: true,
          detailKaryawan: true,
        },
      });

      if (!gajian) {
        throw new Error('Gajian not found');
      }

      if (gajian.status !== 'FINALIZED') {
        throw new Error('Hanya gajian yang sudah FINALIZED yang dapat dibatalkan');
      }

      // Check if already paid in Kasir (category GAJI)
      const isPaid = await tx.kasTransaksi.findFirst({
        where: {
          gajianId: gajianId,
          kategori: 'GAJI',
          deletedAt: null,
        },
      });

      if (isPaid) {
        throw new Error('Gajian sudah dibayar di Kasir. Batalkan pembayaran gaji di Kasir terlebih dahulu.');
      }

      // 1. Revert NotaSawit status
      const notaSawitIds = gajian.detailGajian.map(d => d.notaSawitId);
      if (notaSawitIds.length > 0) {
        await tx.notaSawit.updateMany({
          where: { id: { in: notaSawitIds } },
          data: {
            statusGajian: 'BELUM_DIPROSES',
            gajianId: null,
          },
        });
      }

      // 2. Delete linked KasTransaksi (PEMBAYARAN_HUTANG and HUTANG_KARYAWAN)
      // We don't use soft delete here because these are auto-generated during finalization
      await (tx as any).kasTransaksi.deleteMany({
        where: {
          gajianId,
          kategori: { in: ['PEMBAYARAN_HUTANG', 'HUTANG_KARYAWAN'] },
        },
      });

      // 3. Delete GajianHutangTambahan
      // Note: If the table doesn't exist in some environments, we use executeRaw
      await tx.$executeRawUnsafe(`DELETE FROM "GajianHutangTambahan" WHERE "gajianId" = ${gajianId}`);

      // 4. Delete AbsensiGajiHarian
      await tx.$executeRawUnsafe(`DELETE FROM "AbsensiGajiHarian" WHERE "gajianId" = ${gajianId}`);

      // 5. Unlink PekerjaanKebun
      await tx.pekerjaanKebun.updateMany({
        where: { gajianId: gajianId } as any,
        data: { gajianId: null } as any,
      });

      // 6. Update status back to DRAFT
      const updatedGajian = await tx.gajian.update({
        where: { id: gajianId },
        data: {
          status: 'DRAFT',
          updatedAt: new Date(),
        },
      });

      return updatedGajian;
    });

    await createAuditLog(Number(session.user.id), 'UPDATE', 'Gajian', String(gajianId), {
      action: 'REVERT_TO_DRAFT',
      previousStatus: 'FINALIZED',
      newStatus: 'DRAFT',
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error reverting gajian:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
