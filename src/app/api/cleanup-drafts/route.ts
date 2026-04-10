import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Find all draft gajians
      const draftGajians = await tx.gajian.findMany({
        where: { status: 'DRAFT' },
        select: { id: true },
      });

      if (draftGajians.length === 0) {
        return { message: 'Tidak ada gajian dengan status DRAFT untuk dihapus.', count: 0 };
      }

      const draftGajianIds = draftGajians.map((g) => g.id);

      // 2. Find all notaSawit associated with these drafts
      const detailGajians = await tx.detailGajian.findMany({
        where: { gajianId: { in: draftGajianIds } },
        select: { notaSawitId: true },
      });
      const notaSawitIdsToReset = detailGajians.map(d => d.notaSawitId);

      // 3. Reset status of associated notaSawit
      if (notaSawitIdsToReset.length > 0) {
        await tx.notaSawit.updateMany({
          where: { id: { in: notaSawitIdsToReset } },
          data: { statusPembayaran: 'BELUM_LUNAS' },
        });
      }

      // 4. Delete related records
      await tx.potonganGajian.deleteMany({
        where: { gajianId: { in: draftGajianIds } },
      });

      await tx.biayaLainGajian.deleteMany({
        where: { gajianId: { in: draftGajianIds } },
      });

      await tx.detailGajian.deleteMany({
        where: { gajianId: { in: draftGajianIds } },
      });

      // 5. Delete the draft gajians themselves
      const deleteResult = await tx.gajian.deleteMany({
        where: { id: { in: draftGajianIds } },
      });

      return { message: `Berhasil menghapus ${deleteResult.count} gajian dengan status DRAFT.`, count: deleteResult.count };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Gagal menghapus gajian draft:', error);
    return NextResponse.json({ error: 'Gagal menghapus gajian draft.', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
