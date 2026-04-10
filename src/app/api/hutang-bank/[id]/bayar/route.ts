import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';
import { requireRole } from '@/lib/route-auth';

const bayarSchema = z.object({
  jumlah: z.number().positive(),
  tanggal: z.string(),
  keterangan: z.string().optional(),
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK']);
    if (guard.response) return guard.response;
    const currentUserId = guard.id;
    const loanId = parseInt(params.id);

    const body = await request.json();
    const parsed = bayarSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
    }

    const { jumlah, tanggal, keterangan } = parsed.data;

    const loan = await (prisma as any).hutangBank.findUnique({
      where: { id: loanId }
    });

    if (!loan) {
      return NextResponse.json({ error: 'Pinjaman tidak ditemukan' }, { status: 404 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const deskripsi = `Angsuran Bank: ${loan.namaBank}${keterangan ? ' - ' + keterangan : ''}`;
      const kasTrx = await tx.kasTransaksi.create({
        data: {
          date: new Date(tanggal),
          tipe: 'PENGELUARAN',
          deskripsi,
          jumlah,
          kategori: 'UMUM',
          userId: currentUserId,
          hutangBankId: loanId,
        } as any
      });

      await tx.jurnal.createMany({
        data: [
          {
            date: new Date(tanggal),
            akun: `Hutang Bank:${loan.namaBank}`,
            deskripsi,
            debit: jumlah,
            kredit: 0,
            refType: 'KasTransaksi',
            refId: kasTrx.id,
          },
          {
            date: new Date(tanggal),
            akun: 'Kas',
            deskripsi,
            debit: 0,
            kredit: jumlah,
            refType: 'KasTransaksi',
            refId: kasTrx.id,
          }
        ]
      });

      const totalPaidAgg = await tx.kasTransaksi.aggregate({
        where: { hutangBankId: loanId, tipe: 'PENGELUARAN' } as any,
        _sum: { jumlah: true }
      });
      
      const totalPaid = totalPaidAgg._sum?.jumlah || 0;
      if (totalPaid >= loan.jumlahHutang) {
        await (tx as any).hutangBank.update({
          where: { id: loanId },
          data: { status: 'LUNAS' }
        });
      }

      return kasTrx;
    });

    await createAuditLog(currentUserId, 'PAY_INSTALLMENT', 'HutangBank', loanId.toString(), {
      jumlah,
      tanggal,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error paying installment:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
