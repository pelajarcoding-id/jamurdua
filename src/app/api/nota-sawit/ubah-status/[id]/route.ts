
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/route-auth';

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

    // INTEGRATION: If changing to LUNAS, create KasTransaksi
    if (statusPembayaran === 'LUNAS') {
      const existingItem = await prisma.notaSawit.findUnique({
        where: { id: parseInt(id, 10) },
        include: { 
             timbangan: true,
             pabrikSawit: true,
             supir: true
         }
       });
 
       if (existingItem && existingItem.statusPembayaran !== 'LUNAS') {
          const pabrikName = existingItem.pabrikSawit?.name || 'Unknown Pabrik';
          const supirName = existingItem.supir?.name || 'Unknown Supir';
          const tglBongkar = existingItem.tanggalBongkar 
              ? new Date(existingItem.tanggalBongkar).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
              : '-';
              
          const description = `Penjualan Sawit #${existingItem.id} - ${existingItem.kendaraanPlatNomor || 'Tanpa Plat'} - ${pabrikName} (${tglBongkar}) - Supir: ${supirName}`;
          
          const amount = existingItem.pembayaranAktual ?? existingItem.pembayaranSetelahPph;

          const kasTrx = await prisma.kasTransaksi.create({
           data: {
             date: new Date(),
             tipe: 'PEMASUKAN',
             deskripsi: description,
             jumlah: amount,
             kategori: 'PENJUALAN_SAWIT',
             kebunId: existingItem.timbangan?.kebunId || existingItem.kebunId!, 
             kendaraanPlatNomor: existingItem.kendaraanPlatNomor || undefined,
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

    const updatedNotaSawit = await prisma.notaSawit.update({
      where: { id: parseInt(id, 10) },
      data: { statusPembayaran },
    });

    return NextResponse.json(updatedNotaSawit);
  } catch (error) {
    console.error('Error updating status:', error);
    return NextResponse.json({ error: 'Gagal memperbarui status' }, { status: 500 });
  }
}
