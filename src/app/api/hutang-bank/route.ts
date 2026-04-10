import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';
import { requireRole } from '@/lib/route-auth';

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK']);
    if (guard.response) return guard.response;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      (prisma as any).hutangBank.findMany({
        where: where as any,
        include: {
          kasTransaksi: {
            where: { deletedAt: null },
            orderBy: { date: 'desc' }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      (prisma as any).hutangBank.count({ where: where as any })
    ]);

    const result = data.map((loan: any) => {
      const totalPaid = (loan.kasTransaksi as any[])
        .filter((t: any) => t.tipe === 'PENGELUARAN')
        .reduce((sum: number, t: any) => sum + t.jumlah, 0);
      
      return {
        ...loan,
        sisaPinjaman: loan.jumlahHutang - totalPaid
      };
    });

    return NextResponse.json({
      data: result,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching hutang bank:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

const hutangSchema = z.object({
  namaBank: z.string().min(1),
  jumlahHutang: z.number().positive(),
  angsuranBulanan: z.number().positive(),
  lamaPinjaman: z.number().int().positive(),
  tanggalMulai: z.string(),
  jatuhTempo: z.number().int().min(1).max(31).optional(),
  keterangan: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK']);
    if (guard.response) return guard.response;
    const currentUserId = guard.id;

    const body = await request.json();
    const parsed = hutangSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
    }

    const { namaBank, jumlahHutang, angsuranBulanan, lamaPinjaman, tanggalMulai, jatuhTempo, keterangan } = parsed.data;

    const newHutang = await prisma.$transaction(async (tx) => {
      const hutang = await (tx as any).hutangBank.create({
        data: {
          namaBank,
          jumlahHutang,
          angsuranBulanan,
          lamaPinjaman,
          tanggalMulai: new Date(tanggalMulai),
          jatuhTempo: jatuhTempo || 1,
          keterangan,
        }
      });

      const deskripsi = `Pencairan Pinjaman Bank: ${namaBank}`;
      const kasTrx = await tx.kasTransaksi.create({
        data: {
          date: new Date(tanggalMulai),
          tipe: 'PEMASUKAN',
          deskripsi,
          jumlah: jumlahHutang,
          kategori: 'UMUM',
          userId: currentUserId,
          hutangBankId: hutang.id,
        } as any
      });

      await tx.jurnal.createMany({
        data: [
          {
            date: new Date(tanggalMulai),
            akun: 'Kas',
            deskripsi,
            debit: jumlahHutang,
            kredit: 0,
            refType: 'KasTransaksi',
            refId: kasTrx.id,
          },
          {
            date: new Date(tanggalMulai),
            akun: `Hutang Bank:${namaBank}`,
            deskripsi,
            debit: 0,
            kredit: jumlahHutang,
            refType: 'KasTransaksi',
            refId: kasTrx.id,
          }
        ]
      });

      return hutang;
    });

    await createAuditLog(currentUserId, 'CREATE', 'HutangBank', newHutang.id.toString(), {
      namaBank,
      jumlahHutang,
    });

    return NextResponse.json(newHutang, { status: 201 });
  } catch (error) {
    console.error('Error creating hutang bank:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
