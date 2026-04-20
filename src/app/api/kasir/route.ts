import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { requireRole } from '@/lib/route-auth';
import { scheduleFileDeletion } from '@/lib/file-retention';
import { getWibRangeUtcFromParams, parseWibYmd, wibEndUtcInclusive, wibStartUtc } from '@/lib/wib';
import { validateKasKategoriOrThrow } from '@/lib/kasir/kasKategori'

export const dynamic = 'force-dynamic'

async function resolveKendaraanPlatNomorOrThrow(input?: string | null) {
  const raw = typeof input === 'string' ? input.trim() : ''
  if (!raw) return null

  const kendaraan = await prisma.kendaraan.findFirst({
    where: {
      platNomor: {
        equals: raw,
        mode: 'insensitive',
      },
    },
    select: { platNomor: true },
  })

  if (!kendaraan) {
    const normalized = raw.toLowerCase().replace(/[^a-z0-9]/g, '')
    if (normalized) {
      const rows = await prisma.$queryRaw<Array<{ platNomor: string }>>(
        Prisma.sql`
          SELECT "platNomor"
          FROM "Kendaraan"
          WHERE regexp_replace(lower("platNomor"), '[^a-z0-9]', '', 'g') = ${normalized}
          LIMIT 1
        `
      )
      if (rows.length > 0 && rows[0]?.platNomor) {
        return rows[0].platNomor
      }
    }
    throw new Error('Plat kendaraan tidak ditemukan')
  }

  // Pakai nilai canonical dari DB agar FK selalu valid.
  return kendaraan.platNomor
}

// Fungsi untuk mendapatkan saldo awal hingga tanggal tertentu (tidak termasuk tanggal tersebut)
async function getSaldoAwal(untilDate: Date, userId?: number | null) {
  const baseWhere: any = {
    deletedAt: null,
    date: { lt: untilDate },
  };
  if (userId) baseWhere.userId = userId;

  const [pemasukanAgg, pengeluaranAgg] = await Promise.all([
    prisma.kasTransaksi.aggregate({
      _sum: { jumlah: true },
      where: { ...baseWhere, tipe: 'PEMASUKAN' },
    }),
    prisma.kasTransaksi.aggregate({
      _sum: { jumlah: true },
      where: { ...baseWhere, tipe: 'PENGELUARAN' },
    }),
  ])
  const pemasukan = pemasukanAgg._sum.jumlah ?? 0;
  const pengeluaran = pengeluaranAgg._sum.jumlah ?? 0;
  return pemasukan - pengeluaran;
}

export async function GET(request: Request) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR'])
    if (guard.response) return guard.response
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const page = parseInt(searchParams.get('page') || '1');
    const limitRaw = parseInt(searchParams.get('limit') || '10');
    const limit = Math.min(limitRaw, 100);
    const filterUserId = searchParams.get('filterUserId'); // ID user yang dipilih (untuk admin)
    const kategori = searchParams.get('kategori'); // Filter kategori
    const tipeFilter = searchParams.get('tipe'); // Filter tipe: PEMASUKAN/PENGELUARAN
    const search = searchParams.get('search') || '';
    const skip = (page - 1) * limit;

    let startDateTime: Date;
    let endDateTime: Date;

    if (startDateParam && endDateParam) {
      const range = getWibRangeUtcFromParams(searchParams)
      if (!range) return NextResponse.json({ error: 'Tanggal tidak valid' }, { status: 400 })
      startDateTime = range.startUtc
      endDateTime = range.endUtcInclusive
    } else if (date) {
      const ymd = parseWibYmd(date)
      if (!ymd) return NextResponse.json({ error: 'Tanggal tidak valid' }, { status: 400 })
      startDateTime = wibStartUtc(ymd)
      endDateTime = wibEndUtcInclusive(ymd)
    } else {
      return NextResponse.json({ error: 'Tanggal diperlukan' }, { status: 400 });
    }

    const currentUserId = guard.id
    const isAdmin = guard.role === 'ADMIN' || guard.role === 'PEMILIK'

    const whereClause: any = {
      deletedAt: null,
      date: {
        gte: startDateTime,
        lte: endDateTime,
      },
    };

    if (kategori && kategori !== 'all') {
      whereClause.kategori = kategori;
    }
    if (tipeFilter === 'PEMASUKAN' || tipeFilter === 'PENGELUARAN') {
      whereClause.tipe = tipeFilter;
    }

    let targetUserId: number | null = null;

    if (isAdmin) {
      // Jika admin, bisa filter berdasarkan filterUserId
      if (filterUserId && filterUserId !== 'all') {
        targetUserId = Number(filterUserId);
        whereClause.userId = targetUserId;
      }
      // Jika filterUserId === 'all' atau tidak ada, tampilkan semua (tidak ada filter userId di whereClause)
    } else {
      // Jika bukan admin, paksa filter berdasarkan user sendiri
      targetUserId = currentUserId;
      whereClause.userId = targetUserId;
    }

    const saldoAwal = await getSaldoAwal(startDateTime, targetUserId);

    if (search) {
      const or: any[] = [
        { deskripsi: { contains: search, mode: 'insensitive' } },
        { keterangan: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { kebun: { name: { contains: search, mode: 'insensitive' } } },
        { kendaraan: { platNomor: { contains: search, mode: 'insensitive' } } },
        { kendaraan: { merk: { contains: search, mode: 'insensitive' } } },
        { karyawan: { name: { contains: search, mode: 'insensitive' } } },
      ];
      const sLower = search.toLowerCase();
      if (sLower === 'pemasukan') {
        or.push({ tipe: 'PEMASUKAN' });
      }
      if (sLower === 'pengeluaran') {
        or.push({ tipe: 'PENGELUARAN' });
      }
      if (['umum','kebun','kendaraan','gaji'].includes(sLower)) {
        const map: Record<string, any> = {
          umum: 'UMUM',
          kebun: 'KEBUN',
          kendaraan: 'KENDARAAN',
          gaji: 'GAJI'
        };
        or.push({ kategori: map[sLower] });
      }
      const isNumeric = /^\d+(\.\d+)?$/.test(search);
      if (isNumeric) {
        const like = `%${search}%`;
        const idsRows: Array<{ id: number }> = await prisma.$queryRaw(
          Prisma.sql`SELECT k.id
                     FROM "KasTransaksi" k
                     WHERE CAST(k.id AS TEXT) ILIKE ${like}
                        OR CAST(k.jumlah AS TEXT) ILIKE ${like}`
        );
        const numericIds = idsRows.map(r => r.id);
        if (numericIds.length > 0) {
          or.push({ id: { in: numericIds } });
        }
      }
      const dateYmd = parseWibYmd(search)
      if (dateYmd) {
        or.push({ date: { gte: wibStartUtc(dateYmd), lte: wibEndUtcInclusive(dateYmd) } });
      }
      (whereClause as any).OR = or;
    }

    const [transactions, totalItems] = await Promise.all([
      prisma.kasTransaksi.findMany({
        where: whereClause,
        include: {
          kebun: { select: { id: true, name: true } },
          kendaraan: { select: { platNomor: true, merk: true } },
          karyawan: { select: { id: true, name: true } },
          user: { select: { name: true } },
        },
        orderBy: [
          { date: 'desc' },
          { createdAt: 'desc' }
        ],
        skip,
        take: limit,
      }),
      prisma.kasTransaksi.count({ where: whereClause }),
    ]);

    const grouped = await prisma.kasTransaksi.groupBy({
      by: ['tipe'],
      where: whereClause,
      _sum: { jumlah: true },
    })
    const totalPemasukan = Number(grouped.find((g) => g.tipe === 'PEMASUKAN')?._sum?.jumlah || 0)
    const totalPengeluaran = Number(grouped.find((g) => g.tipe === 'PENGELUARAN')?._sum?.jumlah || 0)

    const saldoAkhir = saldoAwal + totalPemasukan - totalPengeluaran;
    const pageCount = Math.ceil(totalItems / limit);

    return NextResponse.json({
      saldoAwal,
      totalPemasukan,
      totalPengeluaran,
      saldoAkhir,
      transactions,
      totalItems,
      pageCount,
    });
  } catch (error) {
    console.error('Error fetching kasir data:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR'])
    if (guard.response) return guard.response
    const currentUserId = guard.id

    const schema = z.object({
      tipe: z.enum(['PEMASUKAN', 'PENGELUARAN']),
      deskripsi: z.string().trim().min(1).max(200),
      jumlah: z.coerce.number().positive(),
      keterangan: z.string().trim().max(500).optional(),
      gambarUrl: z.string().optional().or(z.literal("")),
      date: z.string().min(1),
      kendaraanPlatNomor: z.string().trim().max(32).optional(),
      kebunId: z.coerce.number().int().positive().optional(),
      karyawanId: z.coerce.number().int().positive().optional(),
      kategori: z.string().trim().max(64).optional(),
    });
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      console.error("Kasir Validation Error:", JSON.stringify(parsed.error.flatten(), null, 2));
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
    }
    const { tipe, deskripsi, jumlah, keterangan, gambarUrl, date, kendaraanPlatNomor, kebunId, karyawanId } = parsed.data;
    const kategori = await validateKasKategoriOrThrow(parsed.data.kategori, tipe)
    const resolvedKendaraanPlatNomor = await resolveKendaraanPlatNomorOrThrow(kendaraanPlatNomor)

    const newTransaction = await prisma.kasTransaksi.create({
      data: {
        date: new Date(date),
        tipe,
        deskripsi,
        jumlah,
        keterangan,
        gambarUrl: gambarUrl || null,
        kategori,
        kebunId: kebunId ? Number(kebunId) : null,
        kendaraanPlatNomor: resolvedKendaraanPlatNomor,
        karyawanId: karyawanId ? Number(karyawanId) : null,
        userId: currentUserId,
      },
    });

    // Auto-post to Jurnal
    const amount = jumlah;
    if (!isNaN(amount) && amount > 0) {
      if (tipe === 'PENGELUARAN') {
        let bebanAkun = 'Beban Operasional';
        if (resolvedKendaraanPlatNomor) {
          bebanAkun = `Beban Kendaraan:${resolvedKendaraanPlatNomor}`;
        } else if (kebunId) {
          const kb = await prisma.kebun.findUnique({ where: { id: Number(kebunId) }, select: { name: true } });
          bebanAkun = `Beban Kebun:${kb?.name || kebunId}`;
        } else if (karyawanId) {
          const usr = await prisma.user.findUnique({ where: { id: Number(karyawanId) }, select: { name: true, role: true } });
          bebanAkun = usr?.role === 'SUPIR' ? `Beban Gaji Supir:${usr?.name || karyawanId}` : `Beban Karyawan:${usr?.name || karyawanId}`;
        }
        await prisma.jurnal.createMany({
          data: [
            {
              date: newTransaction.date,
              akun: bebanAkun,
              deskripsi: deskripsi,
              debit: amount,
              kredit: 0,
              refType: 'KasTransaksi',
              refId: newTransaction.id,
            },
            {
              date: newTransaction.date,
              akun: 'Kas',
              deskripsi: deskripsi,
              debit: 0,
              kredit: amount,
              refType: 'KasTransaksi',
              refId: newTransaction.id,
            },
          ],
        });
      } else if (tipe === 'PEMASUKAN') {
        const kreditAkun = karyawanId ? 'Setoran Karyawan' : 'Pendapatan Lain-lain';
        await prisma.jurnal.createMany({
          data: [
            {
              date: newTransaction.date,
              akun: 'Kas',
              deskripsi: deskripsi,
              debit: amount,
              kredit: 0,
              refType: 'KasTransaksi',
              refId: newTransaction.id,
            },
            {
              date: newTransaction.date,
              akun: kreditAkun,
              deskripsi: deskripsi,
              debit: 0,
              kredit: amount,
              refType: 'KasTransaksi',
              refId: newTransaction.id,
            },
          ],
        });
      }
    }

    await createAuditLog(currentUserId, 'CREATE', 'KasTransaksi', newTransaction.id.toString(), {
      tipe,
      deskripsi,
      jumlah,
    });

    return NextResponse.json(newTransaction, { status: 201 });
  } catch (error: any) {
    if (error?.message === 'Kategori tidak valid' || error?.message === 'Kategori tidak aktif' || error?.message === 'Kategori tidak sesuai dengan tipe transaksi' || error?.message === 'Plat kendaraan tidak ditemukan') {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error?.code === 'P2003') {
      return NextResponse.json({ error: 'Tag kendaraan tidak valid. Pilih kendaraan yang tersedia.' }, { status: 400 })
    }
    console.error('Error creating kas transaction:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR'])
    if (guard.response) return guard.response
    const currentUserId = guard.id
    const isAdmin = guard.role === 'ADMIN' || guard.role === 'PEMILIK'

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID transaksi diperlukan' }, { status: 400 });
    }

    const trxId = parseInt(id);

    // Verify ownership
    const existingTrx = await prisma.kasTransaksi.findUnique({
      where: { id: trxId },
    });

    if (!existingTrx || existingTrx.deletedAt || (!isAdmin && existingTrx.userId !== currentUserId)) {
        return NextResponse.json({ error: 'Transaksi tidak ditemukan atau Anda tidak memiliki akses' }, { status: 404 });
    }
    if (existingTrx.kategori === 'GAJI' && existingTrx.kebunId) {
      if (existingTrx.gajianId) {
        const linked = await prisma.gajian.findUnique({
          where: { id: existingTrx.gajianId },
          select: { id: true, status: true },
        })
        if (linked) {
          return NextResponse.json(
            { error: 'Transaksi gaji tidak bisa dihapus karena masih terhubung ke data gajian. Batalkan/ubah dari menu Gajian terlebih dahulu.' },
            { status: 400 },
          )
        }
      }
    }
    if (existingTrx.kategori === 'PENJUALAN_SAWIT') {
      const deskripsi = String(existingTrx.deskripsi || '')
      const keterangan = String((existingTrx as any).keterangan || '')
      const isUangNotaSawit = deskripsi.startsWith('Uang Nota Sawit -') || keterangan.startsWith('Batch ID:')
      if (isUangNotaSawit) {
        return NextResponse.json(
          { error: 'Transaksi Uang Nota Sawit tidak bisa dihapus dari menu Kasir. Hapus dari menu Nota Sawit > Pembayaran.' },
          { status: 400 },
        )
      }
    }

    await prisma.jurnal.deleteMany({
      where: {
        refType: 'KasTransaksi',
        refId: trxId,
      },
    });

    await prisma.kasTransaksi.update({
      where: { id: trxId },
      data: {
        deletedAt: new Date(),
        deletedById: currentUserId,
      },
    });

    if (existingTrx.gambarUrl) {
      await scheduleFileDeletion({
        url: existingTrx.gambarUrl,
        entity: 'KasTransaksi',
        entityId: String(trxId),
        reason: 'DELETE_TRX',
      })
    }

    if (existingTrx.kategori === 'GAJI' && existingTrx.kebunId && existingTrx.karyawanId) {
      const dateKey = (() => {
        const wib = new Date(existingTrx.date.getTime() + 7 * 60 * 60 * 1000)
        const y = wib.getUTCFullYear()
        const m = String(wib.getUTCMonth() + 1).padStart(2, '0')
        const d = String(wib.getUTCDate()).padStart(2, '0')
        return `${y}-${m}-${d}`
      })()
      const ymd = parseWibYmd(dateKey)
      const dayStart = ymd ? wibStartUtc(ymd) : existingTrx.date
      const dayEnd = ymd ? wibEndUtcInclusive(ymd) : existingTrx.date
      const remaining = await prisma.kasTransaksi.count({
        where: {
          kebunId: existingTrx.kebunId,
          karyawanId: existingTrx.karyawanId,
          kategori: 'GAJI',
          date: {
            gte: dayStart,
            lte: dayEnd,
          },
        },
      })
      if (remaining === 0) {
        await prisma.$executeRaw`
          DELETE FROM "AbsensiGajiHarian"
          WHERE "kebunId" = ${existingTrx.kebunId}
            AND "karyawanId" = ${existingTrx.karyawanId}
            AND "date" = ${dateKey}::DATE
        `
      }
    }

    await createAuditLog(currentUserId, 'DELETE', 'KasTransaksi', id.toString(), {});

    return NextResponse.json({ message: 'Transaksi berhasil dihapus' });
  } catch (error) {
    console.error('Error deleting kas transaction:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR'])
    if (guard.response) return guard.response
    const currentUserId = guard.id
    const isAdmin = guard.role === 'ADMIN' || guard.role === 'PEMILIK'

    const schema = z.object({
      id: z.coerce.number().int().positive(),
      tipe: z.enum(['PEMASUKAN', 'PENGELUARAN']),
      deskripsi: z.string().trim().min(1).max(200),
      jumlah: z.coerce.number().positive(),
      keterangan: z.string().trim().max(500).optional(),
      gambarUrl: z.string().optional().or(z.literal("")),
      date: z.string().min(1),
      kendaraanPlatNomor: z.string().trim().max(32).optional(),
      kebunId: z.coerce.number().int().positive().optional(),
      karyawanId: z.coerce.number().int().positive().optional(),
      kategori: z.string().trim().max(64).optional(),
    });
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      console.error("Kasir PUT Validation Error:", JSON.stringify(parsed.error.flatten(), null, 2));
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
    }
    const { id, tipe, deskripsi, jumlah, keterangan, gambarUrl, date, kendaraanPlatNomor, kebunId, karyawanId } = parsed.data;
    const kategori = parsed.data.kategori === undefined ? undefined : await validateKasKategoriOrThrow(parsed.data.kategori, tipe)
    const resolvedKendaraanPlatNomor = kendaraanPlatNomor === undefined
      ? undefined
      : await resolveKendaraanPlatNomorOrThrow(kendaraanPlatNomor)

    // Verify ownership
    const existingTrx = await prisma.kasTransaksi.findUnique({
      where: { id: id },
    });

    if (!existingTrx || existingTrx.deletedAt || (!isAdmin && existingTrx.userId !== currentUserId)) {
        return NextResponse.json({ error: 'Transaksi tidak ditemukan atau Anda tidak memiliki akses' }, { status: 404 });
    }

    const updatedTransaction = await prisma.kasTransaksi.update({
      where: { id: id },
      data: {
        date: new Date(date),
        tipe,
        deskripsi,
        jumlah,
        keterangan: keterangan === undefined ? undefined : keterangan,
        gambarUrl: gambarUrl === undefined ? undefined : (gambarUrl || null),
        kategori: kategori === undefined ? undefined : kategori,
        kebunId: kebunId === undefined ? undefined : (kebunId ? Number(kebunId) : null),
        kendaraanPlatNomor: resolvedKendaraanPlatNomor,
        karyawanId: karyawanId === undefined ? undefined : (karyawanId ? Number(karyawanId) : null),
      },
    });

    if (existingTrx.gambarUrl && existingTrx.gambarUrl !== updatedTransaction.gambarUrl) {
      await scheduleFileDeletion({
        url: existingTrx.gambarUrl,
        entity: 'KasTransaksi',
        entityId: String(id),
        reason: 'REPLACE_OR_REMOVE_IMAGE',
      })
    }

    // Re-create Jurnal entries for this transaction
    const trxId = id;
    const amount = jumlah;
    await prisma.jurnal.deleteMany({
      where: { refType: 'KasTransaksi', refId: trxId },
    });
    if (!isNaN(amount) && amount > 0) {
      if (tipe === 'PENGELUARAN') {
        let bebanAkun = 'Beban Operasional';
        if (resolvedKendaraanPlatNomor) {
          bebanAkun = `Beban Kendaraan:${resolvedKendaraanPlatNomor}`;
        } else if (kebunId) {
          const kb = await prisma.kebun.findUnique({ where: { id: Number(kebunId) }, select: { name: true } });
          bebanAkun = `Beban Kebun:${kb?.name || kebunId}`;
        } else if (karyawanId) {
          const usr = await prisma.user.findUnique({ where: { id: Number(karyawanId) }, select: { name: true, role: true } });
          bebanAkun = usr?.role === 'SUPIR' ? `Beban Gaji Supir:${usr?.name || karyawanId}` : `Beban Karyawan:${usr?.name || karyawanId}`;
        }
        await prisma.jurnal.createMany({
          data: [
            {
              date: updatedTransaction.date,
              akun: bebanAkun,
              deskripsi: deskripsi,
              debit: amount,
              kredit: 0,
              refType: 'KasTransaksi',
              refId: trxId,
            },
            {
              date: updatedTransaction.date,
              akun: 'Kas',
              deskripsi: deskripsi,
              debit: 0,
              kredit: amount,
              refType: 'KasTransaksi',
              refId: trxId,
            },
          ],
        });
      } else if (tipe === 'PEMASUKAN') {
        const kreditAkun = karyawanId ? 'Setoran Karyawan' : 'Pendapatan Lain-lain';
        await prisma.jurnal.createMany({
          data: [
            {
              date: updatedTransaction.date,
              akun: 'Kas',
              deskripsi: deskripsi,
              debit: amount,
              kredit: 0,
              refType: 'KasTransaksi',
              refId: trxId,
            },
            {
              date: updatedTransaction.date,
              akun: kreditAkun,
              deskripsi: deskripsi,
              debit: 0,
              kredit: amount,
              refType: 'KasTransaksi',
              refId: trxId,
            },
          ],
        });
      }
    }

    // Audit Log
    await createAuditLog(currentUserId, 'UPDATE', 'KasTransaksi', id.toString(), {
        tipe,
        deskripsi,
        jumlah,
        keterangan
    });

    return NextResponse.json(updatedTransaction);
  } catch (error: any) {
    if (error?.message === 'Kategori tidak valid' || error?.message === 'Kategori tidak aktif' || error?.message === 'Kategori tidak sesuai dengan tipe transaksi' || error?.message === 'Plat kendaraan tidak ditemukan') {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error?.code === 'P2003') {
      return NextResponse.json({ error: 'Tag kendaraan tidak valid. Pilih kendaraan yang tersedia.' }, { status: 400 })
    }
    console.error('Error updating kas transaction:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
