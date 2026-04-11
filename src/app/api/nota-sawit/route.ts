import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { createAuditLog } from '@/lib/audit';
import { auth } from '@/auth';
import { requireRole } from '@/lib/route-auth';
import { scheduleFileDeletion } from '@/lib/file-retention';
import { getWibRangeUtcFromParams, parseWibYmd, wibEndExclusiveUtc, wibStartUtc } from '@/lib/wib';

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const url = new URL(request.url);
  const startDate = url.searchParams.get('startDate');
  const endDate = url.searchParams.get('endDate');
  const pageParam = url.searchParams.get('page');
  const limitParam = url.searchParams.get('limit');
  const cursorParam = url.searchParams.get('cursorId');
  const search = url.searchParams.get('search') || '';
  const kebunId = url.searchParams.get('kebunId');
  const supirId = url.searchParams.get('supirId');
  const pabrikId = url.searchParams.get('pabrikId');
  const statusPembayaran = url.searchParams.get('statusPembayaran');
  const perusahaanId = url.searchParams.get('perusahaanId');

  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR', 'SUPIR'])
    if (guard.response) return guard.response
    const range = getWibRangeUtcFromParams(url.searchParams)
    const start = range?.startUtc
    const end = range?.endExclusiveUtc

    const where: Prisma.NotaSawitWhereInput = {
      deletedAt: null,
      ...(start || end
        ? {
            tanggalBongkar: {
              ...(start ? { gte: start } : {}),
              ...(end ? { lt: end } : {}),
            },
          }
        : {}),
    };

    if (kebunId) {
      const kid = parseInt(kebunId, 10)
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        { OR: [{ kebunId: kid }, { timbangan: { kebunId: kid } }] },
      ]
    }

    if (supirId) {
      where.supirId = parseInt(supirId, 10);
    }

    if (pabrikId) {
      where.pabrikSawitId = parseInt(pabrikId, 10);
    }

    if (statusPembayaran && (statusPembayaran === 'LUNAS' || statusPembayaran === 'BELUM_LUNAS')) {
        where.statusPembayaran = statusPembayaran;
    }

    if (perusahaanId) {
      // Find the company associated with the mill
      // Actually, NotaSawit has its own perusahaanId in schema, 
      // but the user wants it to be tied to Pabrik.
      // However, the schema still has perusahaanId on NotaSawit for direct relation.
      (where as any).perusahaanId = parseInt(perusahaanId, 10);
    }

    if (search) {
      const orConditions: Prisma.NotaSawitWhereInput[] = [];
      const s = search.trim();
      const sLower = s.toLowerCase();
      const isNumeric = /^\d+(\.\d+)?$/.test(s);
      const ymd = parseWibYmd(s)
      if (ymd) {
        orConditions.push({
          tanggalBongkar: { gte: wibStartUtc(ymd), lt: wibEndExclusiveUtc(ymd) },
        })
      }
      if (isNumeric) {
        const like = `%${s}%`;
        const baseConds: Prisma.Sql[] = [
          Prisma.sql`(n."deletedAt" IS NULL) AND (CAST(n.id AS TEXT) ILIKE ${like}
            OR CAST(n.bruto AS TEXT) ILIKE ${like}
            OR CAST(n.tara AS TEXT) ILIKE ${like}
            OR CAST(n.netto AS TEXT) ILIKE ${like}
            OR CAST(n.potongan AS TEXT) ILIKE ${like}
            OR CAST(n."hargaPerKg" AS TEXT) ILIKE ${like}
            OR CAST(n."totalPembayaran" AS TEXT) ILIKE ${like})`,
        ];
        const startYmd = parseWibYmd(startDate)
        const endYmd = parseWibYmd(endDate)
        if (startYmd) baseConds.push(Prisma.sql`n."tanggalBongkar" >= ${wibStartUtc(startYmd)}`)
        if (endYmd) baseConds.push(Prisma.sql`n."tanggalBongkar" < ${wibEndExclusiveUtc(endYmd)}`)
        if (kebunId) {
          const kid = parseInt(kebunId, 10)
          baseConds.push(Prisma.sql`(t."kebunId" = ${kid} OR n."kebunId" = ${kid})`)
        }
        if (supirId) {
          baseConds.push(Prisma.sql`n."supirId" = ${parseInt(supirId, 10)}`);
        }
        if (pabrikId) {
          baseConds.push(Prisma.sql`n."pabrikSawitId" = ${parseInt(pabrikId, 10)}`);
        }
        if (statusPembayaran && (statusPembayaran === 'LUNAS' || statusPembayaran === 'BELUM_LUNAS')) {
          baseConds.push(Prisma.sql`n."statusPembayaran" = ${statusPembayaran}`);
        }
        const whereSql = baseConds.slice(1).reduce((acc, curr) => Prisma.sql`${acc} AND ${curr}`, baseConds[0]);
        const idsRows: Array<{ id: number }> = await prisma.$queryRaw(
          Prisma.sql`SELECT n.id
                     FROM "NotaSawit" n
                     LEFT JOIN "Timbangan" t ON t.id = n."timbanganId"
                     WHERE ${whereSql}`
        );
        const numericIds = idsRows.map(r => r.id);
        if (numericIds.length > 0) {
          orConditions.push({ id: { in: numericIds } });
        }
      }
      // Enum status by text
      if (sLower.includes('lunas')) {
        orConditions.push({ statusPembayaran: 'LUNAS' });
      }
      if (sLower.includes('belum') || sLower.includes('pending')) {
        orConditions.push({ statusPembayaran: 'BELUM_LUNAS' });
      }
      // String-based relations and fields
      orConditions.push(
        {
          supir: {
            name: {
              contains: s,
              mode: 'insensitive',
            },
          },
        },
        {
          kendaraan: {
            platNomor: {
              contains: s,
              mode: 'insensitive',
            },
          },
        },
        {
          kendaraanPlatNomor: {
            contains: s,
            mode: 'insensitive',
          },
        },
        {
          pabrikSawit: {
            name: {
              contains: s,
              mode: 'insensitive',
            },
          },
        },
        {
          kebun: {
            name: {
              contains: s,
              mode: 'insensitive',
            },
          },
        },
        {
          timbangan: {
            kebun: {
              name: {
                contains: s,
                mode: 'insensitive',
              },
            },
          },
        },
      );
      where.OR = orConditions;
    }

    // If for report (no pagination params), return all data
    if (!pageParam && !limitParam) {
      const notaSawit = await prisma.notaSawit.findMany({
        where,
        include: {
          timbangan: {
            include: {
              kebun: true,
              supir: { select: { id: true, name: true } },
              kendaraan: true,
            },
          },
          kebun: true, // Include kebun untuk nota manual
          supir: { select: { id: true, name: true } },
          kendaraan: true,
          pabrikSawit: true,
        },
        orderBy: [
          { tanggalBongkar: 'desc' },
          { createdAt: 'desc' }
        ],
      });
      return NextResponse.json(notaSawit);
    }

    // If for paginated list (offset or cursor)
    const page = parseInt(pageParam || '1', 10);
    const limit = parseInt(limitParam || '10', 10);

    let notaSawit;
    if (cursorParam) {
      notaSawit = await prisma.notaSawit.findMany({
        where,
        include: {
          timbangan: {
            include: {
              kebun: true,
              supir: { select: { id: true, name: true } },
              kendaraan: true,
            },
          },
          kebun: true, // Include kebun untuk nota manual
          supir: { select: { id: true, name: true } },
          kendaraan: true,
          pabrikSawit: true,
        },
        orderBy: [
          { tanggalBongkar: 'desc' },
          { id: 'desc' }
        ],
        cursor: { id: Number(cursorParam) },
        skip: 1,
        take: limit,
      });
    } else {
      const skip = (page - 1) * limit;
      notaSawit = await prisma.notaSawit.findMany({
        where,
        skip,
        take: limit,
        include: {
          timbangan: {
            include: {
              kebun: true,
              supir: { select: { id: true, name: true } },
              kendaraan: true,
            },
          },
          kebun: true, // Include kebun untuk nota manual
          supir: { select: { id: true, name: true } },
          kendaraan: true,
          pabrikSawit: true,
        },
        orderBy: [
          { tanggalBongkar: 'desc' },
          { id: 'desc' }
        ],
      });
    }
    const total = await prisma.notaSawit.count({ where });
    const nextCursor = notaSawit.length > 0 ? notaSawit[notaSawit.length - 1].id : null;

    return NextResponse.json({
      data: notaSawit,
      total,
      page,
      limit,
      nextCursor,
    });
  } catch (error) {
    console.error('Error fetching nota sawit data:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR'])
    if (guard.response) return guard.response
    const body = await request.json();
    const roundInt = (v: any) => Math.round(Number(v) || 0)
    const useTimbanganKebun = body.useTimbanganKebun === true || body.useTimbanganKebun === 'true'
    const supirId = Number(body.supirId);
    const kendaraanPlatNomor = body.kendaraanPlatNomor as string;
    const pabrikSawitId = Number(body.pabrikSawitId);
    const tanggalBongkarValue = body.tanggalBongkar;
    const tanggalBongkarRaw = tanggalBongkarValue !== undefined && tanggalBongkarValue !== null ? String(tanggalBongkarValue).trim() : ''
    let tanggalBongkar: Date | null = null
    if (tanggalBongkarRaw) {
      const ymd = parseWibYmd(tanggalBongkarRaw)
      if (!ymd) {
        return NextResponse.json({ error: 'Tanggal bongkar tidak valid' }, { status: 400 })
      }
      tanggalBongkar = wibStartUtc(ymd)
    }
    const potongan = roundInt(body.potongan);
    const hargaPerKg = roundInt(body.hargaPerKg);
    const statusPembayaran = body.statusPembayaran as string;
    const isManual = body.isManual === true || body.isManual === 'true';

    if (!supirId || !kendaraanPlatNomor || !pabrikSawitId) {
      return NextResponse.json({ error: 'Supir, Kendaraan, dan Pabrik Sawit harus diisi' }, { status: 400 });
    }

    let timbanganId: number | null = null;
    const timbanganIdRaw = body.timbanganId;

    if (timbanganIdRaw && timbanganIdRaw !== 'undefined' && timbanganIdRaw !== 'null') {
      timbanganId = Number(timbanganIdRaw);
    }

    let kebunId: number | null = null;
    if (!timbanganId) {
        // Kasus: Tidak pilih Timbangan (Manual/Kebun saja)
        kebunId = Number(body.kebunId);
        if (!kebunId) {
             return NextResponse.json({ error: 'Kebun harus dipilih jika tidak menggunakan data timbangan' }, { status: 400 });
        }
    }

    let timbanganData = null;
    if (timbanganId) {
        timbanganData = await prisma.timbangan.findUnique({ where: { id: timbanganId } });
        if (!timbanganData) {
            return NextResponse.json({ error: 'Timbangan not found' }, { status: 404 });
        }
        // Jika menggunakan timbangan, ambil kebunId dari sana
        kebunId = timbanganData.kebunId;
    }

    if (!timbanganId && useTimbanganKebun) {
      const grossKg = roundInt(body.grossKg)
      const tareKg = roundInt(body.tareKg)
      const netKg = Math.max(0, grossKg - tareKg)
      const createdTimbangan = await prisma.timbangan.create({
        data: {
          kebunId: kebunId!,
          supirId: supirId || null,
          kendaraanPlatNomor: kendaraanPlatNomor || null,
          date: tanggalBongkar || new Date(),
          grossKg,
          tareKg,
          netKg,
          notes: 'Input dari Nota Sawit',
        },
      })
      timbanganId = createdTimbangan.id
    }

    // Get Nota Sawit specific weights
    const bruto = roundInt(body.bruto || 0);
    const tara = roundInt(body.tara || 0);
    const netto = roundInt(body.netto || 0);
    
    const effectiveNetto = netto; 

    const beratAkhir = Math.max(0, effectiveNetto - potongan);
    const totalPembayaran = roundInt(beratAkhir * hargaPerKg);
    const pph = roundInt(totalPembayaran * 0.0025);
    const pph25 = roundInt(body.pph25 || 0);
    const pembayaranSetelahPph = totalPembayaran - pph - pph25;

    const pembayaranAktualValue = body.pembayaranAktual;
    const pembayaranAktual = (pembayaranAktualValue !== undefined && pembayaranAktualValue !== null && pembayaranAktualValue !== '') ? roundInt(pembayaranAktualValue) : null;

    let gambarNotaUrl = body.gambarNotaUrl || null;

    if (!tanggalBongkar) tanggalBongkar = new Date();

    // Get Perusahaan from Pabrik
    const pabrik = await prisma.pabrikSawit.findUnique({ where: { id: pabrikSawitId } });
    const perusahaanId = (pabrik as any)?.perusahaanId || null;

    const createData: any = { 
        timbanganId, 
        kebunId,
        supirId, 
        pabrikSawitId,
        perusahaanId,
        tanggalBongkar,
        potongan, 
        beratAkhir, 
        kendaraanPlatNomor, 
        hargaPerKg, 
        totalPembayaran, 
        pph,
        pph25,
        pembayaranSetelahPph,
        pembayaranAktual,
        statusPembayaran: statusPembayaran || 'BELUM_LUNAS',
        gambarNotaUrl,
        bruto, 
        tara,   
        netto: effectiveNetto
    };

    const newNotaSawit = await prisma.notaSawit.create({
      data: createData,
      include: {
        timbangan: {
          include: {
            kebun: true,
            supir: true,
            kendaraan: true,
          },
        },
        kebun: true, // Include kebun di sini juga!
        supir: true,
        kendaraan: true,
        pabrikSawit: true,
      },
    });

    const session = await auth();
    const currentUserId = session?.user?.id ? Number(session.user.id) : guard.id;
    const creatorName = session?.user?.name || 'User';

    // Create Notification for all Admin and Pemilik
    try {
      // Perbaikan: Ambil nama kebun dari timbangan ATAU dari kebun yang di-include
      // Kita perlu include 'kebun' di query create juga jika mau ambil namanya langsung
      // Tapi karena return include di atas sudah benar (di method POST ini kita harus pastikan include 'kebun' juga)
      
      // Ups, di POST create include tadi belum ada 'kebun'!
      // Mari kita perbaiki include di POST create di bawah
      
      const kebunName = newNotaSawit.timbangan?.kebun?.name || (newNotaSawit as any).kebun?.name || '-';
      const supirName = newNotaSawit.supir?.name || '-';
      const platNomor = newNotaSawit.kendaraanPlatNomor || '-';
      
      const recipients = await prisma.user.findMany({
        where: {
          role: { in: ['ADMIN', 'PEMILIK'] }
        },
        select: { id: true }
      });

      const notifications = recipients.map(recipient => ({
        userId: recipient.id,
        type: 'NOTA_SAWIT',
        title: 'Nota Sawit Baru',
        message: `Nota Sawit ${kebunName} ${supirName} ${platNomor} ditambahkan oleh ${creatorName}`,
        link: `/nota-sawit?search=${newNotaSawit.kendaraanPlatNomor || ''}`,
        isRead: false
      }));

      if (notifications.length > 0) {
        await prisma.notification.createMany({
          data: notifications
        });
      }
    } catch (notifError) {
      console.error('Failed to create notification:', notifError);
      // Continue execution, don't fail request
    }

    // Find PEMILIK user to assign the transaction to
    const pemilik = await prisma.user.findFirst({
        where: { role: 'PEMILIK' }
    });
    const transactionUserId = pemilik ? pemilik.id : currentUserId;

    // INTEGRATION: Auto-create KasTransaksi if LUNAS
    if (statusPembayaran === 'LUNAS') {
      const pabrikName = newNotaSawit.pabrikSawit?.name || 'Unknown Pabrik';
      const supirName = newNotaSawit.supir?.name || 'Unknown Supir';
      const tglBongkar = newNotaSawit.tanggalBongkar 
        ? new Date(newNotaSawit.tanggalBongkar).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
        : '-';
      
      const description = `Penjualan Sawit #${newNotaSawit.id} - ${newNotaSawit.kendaraanPlatNomor || 'Tanpa Plat'} - ${pabrikName} (${tglBongkar}) - Supir: ${supirName}`;
      
      const amount = newNotaSawit.pembayaranAktual ?? pembayaranSetelahPph;

      const kasTrx = await prisma.kasTransaksi.create({
        data: {
          date: new Date(),
          tipe: 'PEMASUKAN',
          deskripsi: description,
          jumlah: amount,
          kategori: 'PENJUALAN_SAWIT',
          kebunId: newNotaSawit.timbangan?.kebunId || newNotaSawit.kebunId!, // Gunakan timbangan.kebunId atau langsung kebunId
          kendaraanPlatNomor: newNotaSawit.kendaraanPlatNomor || undefined,
          userId: transactionUserId,
        }
      });

      // Auto-post to Jurnal
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

    await createAuditLog(currentUserId, 'CREATE', 'NotaSawit', newNotaSawit.id.toString(), {
        timbanganId,
        totalPembayaran,
        kendaraanPlatNomor
    });

    return NextResponse.json({ ...newNotaSawit, isManualInput: isManual }, { status: 201 });

  } catch (error) {
    console.error('Error creating nota sawit:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR'])
  if (guard.response) return guard.response

  try {
    const session = await auth()
    const currentUserId = session?.user?.id ? Number(session.user.id) : guard.id
    const { ids } = await request.json()

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Invalid or empty IDs array' }, { status: 400 })
    }

    const itemsToDelete = await prisma.notaSawit.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: { id: true, totalPembayaran: true, kendaraanPlatNomor: true, gambarNotaUrl: true },
    })

    if (itemsToDelete.length === 0) {
      return NextResponse.json({ message: `0 nota sawit deleted successfully` })
    }

    const linkedToGajian = await prisma.detailGajian.findFirst({
      where: { notaSawitId: { in: ids } },
      select: { id: true },
    })

    if (linkedToGajian) {
      return NextResponse.json(
        { error: 'Gagal menghapus: Beberapa Nota Sawit sudah masuk dalam perhitungan Gajian. Silakan hapus dari Gajian terlebih dahulu.' },
        { status: 409 }
      )
    }

    const updated = await prisma.notaSawit.updateMany({
      where: { id: { in: ids }, deletedAt: null },
      data: { deletedAt: new Date(), deletedById: currentUserId },
    })

    await Promise.all(itemsToDelete.map(item => {
      if (!item.gambarNotaUrl) return Promise.resolve()
      return scheduleFileDeletion({
        url: item.gambarNotaUrl,
        entity: 'NotaSawit',
        entityId: String(item.id),
        reason: 'DELETE_NOTA_BULK',
      })
    }))

    await Promise.all(itemsToDelete.map(item =>
      createAuditLog(currentUserId, 'DELETE', 'NotaSawit', item.id.toString(), {
        totalPembayaran: item.totalPembayaran,
        kendaraanPlatNomor: item.kendaraanPlatNomor,
      })
    ))

    return NextResponse.json({ message: `${updated.count} nota sawit deleted successfully` })
  } catch (error) {
    console.error('Error deleting nota sawit:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
