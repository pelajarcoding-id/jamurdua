import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/route-auth'
import { createAuditLog } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR'])
    if (guard.response) return guard.response
    const { ids, status } = await request.json()

    if (!Array.isArray(ids) || ids.length === 0 || !['LUNAS', 'BELUM_LUNAS'].includes(status)) {
      return NextResponse.json({ message: 'Input tidak valid' }, { status: 400 })
    }

    const currentUserId = guard.id

    // Find PEMILIK user to assign the transaction to
    const pemilik = await prisma.user.findFirst({
        where: { role: 'PEMILIK' }
    });
    const transactionUserId = pemilik ? pemilik.id : currentUserId;

    if (status === 'LUNAS') {
        // Fetch items that are NOT LUNAS yet to avoid double counting
        const itemsToProcess = await prisma.notaSawit.findMany({
            where: {
                id: { in: ids },
                statusPembayaran: { not: 'LUNAS' }
            },
            include: { 
                timbangan: true,
                pabrikSawit: true,
                supir: true
            }
        });

        for (const item of itemsToProcess) {
            const hasBatch = await (prisma as any).notaSawitPembayaranBatchItem.findFirst({
                where: { notaSawitId: item.id },
                select: { id: true },
            })
            if (hasBatch) {
                continue
            }

            const pabrikName = item.pabrikSawit?.name || 'Unknown Pabrik';
            const supirName = item.supir?.name || 'Unknown Supir';
            const tglBongkar = item.tanggalBongkar 
                ? new Date(item.tanggalBongkar).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
                : '-';

            const description = `Penjualan Sawit #${item.id} - ${item.kendaraanPlatNomor || 'Tanpa Plat'} - ${pabrikName} (${tglBongkar}) - Supir: ${supirName}`;
            
            const amount = item.pembayaranAktual ?? item.pembayaranSetelahPph;
            if (!item.timbangan?.kebunId) {
                continue;
            }

            const kasTrx = await prisma.kasTransaksi.create({
                data: {
                    date: new Date(),
                    tipe: 'PEMASUKAN',
                    deskripsi: description,
                    jumlah: amount,
                    kategori: 'PENJUALAN_SAWIT',
                    kebunId: item.timbangan.kebunId,
                    kendaraanPlatNomor: item.kendaraanPlatNomor || undefined,
                    userId: transactionUserId,
                }
            });

            await prisma.jurnal.createMany({
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
            });
        }
    }

    const updatedCount = await prisma.notaSawit.updateMany({
      where: {
        id: {
          in: ids,
        },
      },
      data: {
        statusPembayaran: status,
        ...(status === 'LUNAS' ? { pembayaranAktual: null } : {}),
      },
    })

    await createAuditLog(guard.id, 'UPDATE', 'NotaSawit', 'BULK_STATUS', {
      status,
      count: updatedCount.count,
      ids: ids.slice(0, 500),
    })

    return NextResponse.json({ message: `${updatedCount.count} status nota berhasil diubah` })
  } catch (error) {
    console.error('Gagal mengubah status nota:', error)
    return NextResponse.json({ message: 'Gagal mengubah status nota' }, { status: 500 })
  }
}
