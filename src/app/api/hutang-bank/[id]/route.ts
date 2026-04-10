import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';
import { requireRole } from '@/lib/route-auth';

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK']);
    if (guard.response) return guard.response;

    const loan = await (prisma as any).hutangBank.findUnique({
      where: { id: parseInt(params.id) },
      include: {
        kasTransaksi: {
          orderBy: { date: 'desc' }
        }
      }
    });

    if (!loan) {
      return NextResponse.json({ error: 'Pinjaman tidak ditemukan' }, { status: 404 });
    }

    const totalPaid = (loan.kasTransaksi as any[])
      .filter((t: any) => t.tipe === 'PENGELUARAN')
      .reduce((sum: number, t: any) => sum + t.jumlah, 0);

    return NextResponse.json({
      ...loan,
      sisaPinjaman: loan.jumlahHutang - totalPaid
    });
  } catch (error) {
    console.error('Error fetching hutang bank detail:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

const updateSchema = z.object({
  namaBank: z.string().min(1).optional(),
  jumlahHutang: z.number().positive().optional(),
  angsuranBulanan: z.number().positive().optional(),
  lamaPinjaman: z.number().int().positive().optional(),
  tanggalMulai: z.string().optional(),
  jatuhTempo: z.number().int().min(1).max(31).optional(),
  keterangan: z.string().optional(),
  status: z.enum(['AKTIF', 'LUNAS']).optional(),
});

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK']);
    if (guard.response) return guard.response;
    const currentUserId = guard.id;

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
    }

    const updated = await (prisma as any).hutangBank.update({
      where: { id: parseInt(params.id) },
      data: {
        ...parsed.data,
        tanggalMulai: parsed.data.tanggalMulai ? new Date(parsed.data.tanggalMulai) : undefined,
      }
    });

    await createAuditLog(currentUserId, 'UPDATE', 'HutangBank', params.id, parsed.data);

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating hutang bank:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK']);
    if (guard.response) return guard.response;
    const currentUserId = guard.id;
    const loanId = parseInt(params.id);

    // Check if there are transactions other than the initial one
    const transactions = await prisma.kasTransaksi.findMany({
      where: { hutangBankId: loanId } as any
    });

    if (transactions.length > 1) {
      return NextResponse.json({ error: 'Tidak dapat menghapus pinjaman yang sudah memiliki riwayat angsuran. Hapus angsuran di Kasir terlebih dahulu.' }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      // Delete associated transactions and journal entries
      for (const trx of transactions) {
        await tx.jurnal.deleteMany({
          where: { refType: 'KasTransaksi', refId: trx.id }
        });
        await tx.kasTransaksi.delete({
          where: { id: trx.id }
        });
      }

      // Delete the loan record
      await (tx as any).hutangBank.delete({
        where: { id: loanId }
      });
    });

    await createAuditLog(currentUserId, 'DELETE', 'HutangBank', params.id, {});

    return NextResponse.json({ message: 'Pinjaman berhasil dihapus' });
  } catch (error) {
    console.error('Error deleting hutang bank:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
