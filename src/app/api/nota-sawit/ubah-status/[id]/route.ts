
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/route-auth';

export const dynamic = 'force-dynamic'

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR'])
    if (guard.response) return guard.response
    const { id } = params;
    const { statusPembayaran } = await request.json();

    if (!statusPembayaran || !['LUNAS', 'BELUM_LUNAS'].includes(statusPembayaran)) {
      return NextResponse.json({ error: 'Status pembayaran tidak valid' }, { status: 400 });
    }

    const currentUserId = guard.id;

    // Find PEMILIK user to assign the transaction to
    const pemilik = await prisma.user.findFirst({
        where: { role: 'PEMILIK' }
    });
    const transactionUserId = pemilik ? pemilik.id : currentUserId;

    const notaId = parseInt(id, 10)
    const updatedNotaSawit = await prisma.$transaction(async (tx) => {
      const existingItem = await tx.notaSawit.findUnique({
        where: { id: notaId },
        include: {
          timbangan: true,
          pabrikSawit: true,
          supir: true,
        },
      })
      if (!existingItem) {
        throw new Error('NOT_FOUND')
      }

      if (statusPembayaran === 'LUNAS') {
        if (existingItem.statusPembayaran !== 'LUNAS') {
          const pabrikName = existingItem.pabrikSawit?.name || 'Unknown Pabrik'
          const supirName = existingItem.supir?.name || 'Unknown Supir'
          const tglBongkar = existingItem.tanggalBongkar
            ? new Date(existingItem.tanggalBongkar).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
            : '-'
          const description = `Penjualan Sawit #${existingItem.id} - ${existingItem.kendaraanPlatNomor || 'Tanpa Plat'} - ${pabrikName} (${tglBongkar}) - Supir: ${supirName}`
          const amount = existingItem.pembayaranAktual ?? existingItem.pembayaranSetelahPph

          const kasTrx = await tx.kasTransaksi.create({
            data: {
              date: new Date(),
              tipe: 'PEMASUKAN',
              deskripsi: description,
              jumlah: amount,
              kategori: 'PENJUALAN_SAWIT',
              kebunId: existingItem.timbangan?.kebunId || existingItem.kebunId!,
              kendaraanPlatNomor: existingItem.kendaraanPlatNomor || undefined,
              userId: transactionUserId,
              notaSawitId: existingItem.id,
            } as any,
          })

          await tx.jurnal.createMany({
            data: [
              {
                date: new Date(),
                akun: 'Kas',
                deskripsi: description,
                debit: amount,
                kredit: 0,
                refType: 'KasTransaksi',
                refId: kasTrx.id,
              },
              {
                date: new Date(),
                akun: 'Pendapatan Sawit',
                deskripsi: description,
                debit: 0,
                kredit: amount,
                refType: 'KasTransaksi',
                refId: kasTrx.id,
              },
            ],
          })
        }
      } else if (statusPembayaran === 'BELUM_LUNAS') {
        const fallbackPrefix = `Penjualan Sawit #${existingItem.id} -`
        const trxRows = await tx.kasTransaksi.findMany({
          where: {
            deletedAt: null,
            kategori: 'PENJUALAN_SAWIT',
            OR: [
              { notaSawitId: existingItem.id } as any,
              { deskripsi: { startsWith: fallbackPrefix } },
            ],
          } as any,
          select: { id: true, gambarUrl: true },
        })
        const ids = trxRows.map((t) => t.id)
        if (ids.length > 0) {
          await tx.jurnal.deleteMany({
            where: {
              refType: 'KasTransaksi',
              refId: { in: ids },
            },
          })
          await tx.kasTransaksi.updateMany({
            where: { id: { in: ids } },
            data: { deletedAt: new Date(), deletedById: currentUserId },
          })
        }
      }

      return tx.notaSawit.update({
        where: { id: notaId },
        data: { statusPembayaran },
      })
    })

    return NextResponse.json(updatedNotaSawit);
  } catch (error) {
    console.error('Error updating status:', error);
    if ((error as any)?.message === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Nota tidak ditemukan' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Gagal memperbarui status' }, { status: 500 });
  }
}
