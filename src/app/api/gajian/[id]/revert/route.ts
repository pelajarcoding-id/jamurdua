import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { createAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic'

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
      const GAJIAN_MANUAL_BIAYA_MARKER = '[GAJIAN_BIAYA_MANUAL]'
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

      const gajiTrxRows = await tx.kasTransaksi.findMany({
        where: {
          gajianId: gajianId,
          kategori: 'GAJI',
          deletedAt: null,
        },
        select: { id: true, karyawanId: true, deskripsi: true },
      });

      const gajiTrxIds = gajiTrxRows.map((t) => t.id)

      // 1. Revert NotaSawit status
      const notaSawitIds = gajian.detailGajian.map(d => d.notaSawitId);
      if (notaSawitIds.length > 0) {
        await tx.notaSawit.updateMany({
          where: { id: { in: notaSawitIds }, gajianId: gajianId },
          data: {
            statusGajian: 'BELUM_DIPROSES',
            gajianId: null,
          },
        });
      }

      // 2. Delete linked KasTransaksi (auto-generated during finalization)
      // We don't use soft delete here because these are auto-generated during finalization
      const hutangTrxRows = await tx.kasTransaksi.findMany({
        where: {
          gajianId,
          kategori: { in: ['PEMBAYARAN_HUTANG', 'HUTANG_KARYAWAN'] },
        },
        select: { id: true },
      })
      const hutangTrxIds = hutangTrxRows.map((t) => t.id)

      const trxIdsToDelete = Array.from(new Set([...hutangTrxIds, ...gajiTrxIds]))
      if (trxIdsToDelete.length > 0) {
        await tx.jurnal.deleteMany({ where: { refType: 'KasTransaksi', refId: { in: trxIdsToDelete } } })
        await (tx as any).kasTransaksi.deleteMany({ where: { id: { in: trxIdsToDelete } } })
      }

      // 3. Delete GajianHutangTambahan
      // Note: If the table doesn't exist in some environments, we use executeRaw
      await tx.$executeRawUnsafe(`DELETE FROM "GajianHutangTambahan" WHERE "gajianId" = ${gajianId}`);

      // 4. Delete AbsensiGajiHarian
      await tx.$executeRawUnsafe(`DELETE FROM "AbsensiGajiHarian" WHERE "gajianId" = ${gajianId}`);

      await tx.pekerjaanKebun.deleteMany({
        where: {
          gajianId: gajianId,
          upahBorongan: true,
          keterangan: { startsWith: GAJIAN_MANUAL_BIAYA_MARKER },
        } as any,
      })

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
