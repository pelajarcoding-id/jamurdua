import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import type { NotaSawit, Prisma } from '@prisma/client';
import { createAuditLog } from '@/lib/audit';
import { auth } from '@/auth';
import { getWibRangeUtcFromParams, parseWibYmd, wibEndUtcInclusive, wibStartUtc } from '@/lib/wib';

export const dynamic = 'force-dynamic'

// GET /api/gajian?kebunId=...&startDate=...&endDate=...
// GET /api/gajian?kebunId=...&history=true
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const kebunId = searchParams.get('kebunId');
  const fetchHistory = searchParams.get('fetchHistory');
  const search = searchParams.get('search');
  const gajianIdToEdit = searchParams.get('gajianIdToEdit');
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '10', 10);

  const skip = (page - 1) * limit;

  try {
    if (fetchHistory === 'true') {
      const where: Prisma.GajianWhereInput = {};
      if (kebunId) {
        const parsedKebunId = parseInt(kebunId, 10);
        if (!isNaN(parsedKebunId)) {
          where.kebunId = parsedKebunId;
        }
      }

      const range = getWibRangeUtcFromParams(searchParams)
      if (range) {
        where.createdAt = {
          gte: range.startUtc,
          lt: range.endExclusiveUtc,
        };
      }

      if (search) {
        where.OR = [
          { keterangan: { contains: search, mode: 'insensitive' } },
          { kebun: { name: { contains: search, mode: 'insensitive' } } },
        ];
      }

      const hasSalaryInBiaya = (biaya: Array<{ deskripsi: string }> | null | undefined) => {
        const list = Array.isArray(biaya) ? biaya : []
        return list.some((b) => /^(total\s*gaji\s*karyawan|biaya\s*gaji\s*harian)/i.test(String(b?.deskripsi || '').trim()))
      }

      const [draftsRaw, finalizedRaw] = await prisma.$transaction([
        prisma.gajian.findMany({
          where: { ...where, status: 'DRAFT' },
          orderBy: { tanggalSelesai: 'desc' },
          include: {
            kebun: true,
            biayaLain: { select: { deskripsi: true } },
            detailKaryawan: { select: { gajiPokok: true } },
          } as any,
        }),
        prisma.gajian.findMany({
          where: { ...where, status: 'FINALIZED' },
          orderBy: { tanggalSelesai: 'desc' },
          include: {
            kebun: true,
            biayaLain: { select: { deskripsi: true } },
            detailKaryawan: { select: { gajiPokok: true } },
          } as any,
        }),
      ]);

      const mapRow = (g: any) => {
        const totalGajiHarian = (Array.isArray(g?.detailKaryawan) ? g.detailKaryawan : []).reduce(
          (sum: number, d: any) => sum + (Number(d?.gajiPokok) || 0),
          0
        )
        const totalBiayaLain = Number(g?.totalBiayaLain) || 0
        const totalJumlahGaji = totalBiayaLain + (hasSalaryInBiaya(g?.biayaLain) ? 0 : totalGajiHarian)
        return {
          id: g.id,
          kebunId: g.kebunId,
          kebun: g.kebun,
          tanggalMulai: g.tanggalMulai,
          tanggalSelesai: g.tanggalSelesai,
          totalBerat: Number(g?.totalBerat) || 0,
          totalNota: Number(g?.totalNota) || 0,
          totalBiayaLain,
          totalPotongan: Number(g?.totalPotongan) || 0,
          totalGaji: Number(g?.totalGaji) || 0,
          totalGajiHarian,
          totalJumlahGaji,
          keterangan: g.keterangan || '',
          status: g.status,
          dibuatOlehName: g.dibuatOlehName ?? null,
          disetujuiOlehName: g.disetujuiOlehName ?? null,
          createdAt: g.createdAt,
          updatedAt: g.updatedAt,
        }
      }

      const drafts = (Array.isArray(draftsRaw) ? draftsRaw : []).map(mapRow)
      const finalized = (Array.isArray(finalizedRaw) ? finalizedRaw : []).map(mapRow)
      return NextResponse.json({ drafts, finalized });
    }

    if (!kebunId) {
      return NextResponse.json({ error: 'kebunId is required' }, { status: 400 });
    }

    const parsedKebunId = parseInt(kebunId, 10);
    if (isNaN(parsedKebunId)) {
      return NextResponse.json({ error: 'Invalid kebunId' }, { status: 400 });
    }

    const range = getWibRangeUtcFromParams(searchParams)
    const start = range?.startUtc
    const end = range?.endExclusiveUtc

    const statusFilter: Prisma.NotaSawitWhereInput = gajianIdToEdit
      ? {
          OR: [
            { detailGajian: null },
            { detailGajian: { gajianId: parseInt(gajianIdToEdit) } }
          ]
        }
      : { detailGajian: null };

    const where: Prisma.NotaSawitWhereInput = {
      AND: [
        { deletedAt: null },
        {
          OR: [
            { timbangan: { kebunId: parsedKebunId } },
            { kebunId: parsedKebunId },
          ],
        },
        start || end
          ? {
              tanggalBongkar: {
                gte: start,
                lt: end,
              },
            }
          : {},
        statusFilter,
      ],
    };

    const [notas, total] = await prisma.$transaction([
      prisma.notaSawit.findMany({
        where,
        skip,
        take: limit,
        include: {
          supir: true,
          kendaraan: true,
          timbangan: {
            include: {
              kebun: true,
            },
          },
          kebun: true,
        },
        orderBy: [
          { tanggalBongkar: 'asc' },
          { createdAt: 'asc' },
        ],
      }),
      prisma.notaSawit.count({ where }),
    ]);

    return NextResponse.json({ data: notas, total });
  } catch (error) {
    console.error('Error fetching data for gajian page:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// POST  /api/gajian
export async function POST(request: Request) {
  try {
    const session = await auth();
    const currentUserId = session?.user?.id ? Number(session.user.id) : 1;

    const body = await request.json();
    const { kebunId, tanggalMulai, tanggalSelesai, keterangan, notas, biayaLain, potongan, status, gajianId, payAbsensi, detailKaryawan, dibuatOlehName, disetujuiOlehName, hutangTambahan, pekerjaanBoronganIds } = body;

    if (!kebunId || !tanggalMulai || !tanggalSelesai || !notas || !Array.isArray(notas)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const parsedKebunId = parseInt(kebunId, 10);
    if (isNaN(parsedKebunId)) {
      return NextResponse.json({ error: 'Invalid kebunId' }, { status: 400 });
    }

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "GajianHutangTambahan" (
        "id" SERIAL PRIMARY KEY,
        "gajianId" INTEGER NOT NULL,
        "userId" INTEGER NOT NULL,
        "jumlah" NUMERIC NOT NULL DEFAULT 0,
        "date" DATE,
        "deskripsi" TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "GajianHutangTambahan_gajianId_idx" ON "GajianHutangTambahan" ("gajianId")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "GajianHutangTambahan_userId_idx" ON "GajianHutangTambahan" ("userId")`)
    
    // Fetch full nota data to ensure accurate totalBerat calculation
    const notaIds = notas.map((nota: { id: number }) => nota.id);
    const uniqueNotaIds = Array.from(new Set(notaIds));
    if (uniqueNotaIds.length !== notaIds.length) {
      const duplicates = notaIds.filter((id: number, idx: number) => notaIds.indexOf(id) !== idx);
      return NextResponse.json({ error: 'Terdapat ID nota duplikat pada permintaan', duplicates: Array.from(new Set(duplicates)) }, { status: 400 });
    }
    
    const dbNotas = await prisma.notaSawit.findMany({
      where: { id: { in: uniqueNotaIds } },
      select: { id: true, beratAkhir: true }
    });
    
    const totalBerat = dbNotas.reduce((sum, nota) => sum + (nota.beratAkhir || 0), 0);
    const totalNota = notas.length;

    const totalBiayaLain = (biayaLain || []).reduce((sum: number, item: { total: string | number }) => sum + (Number(item.total) || 0), 0);
    const totalPotonganManual = (potongan || []).reduce((sum: number, item: { total: string | number }) => sum + (Number(item.total) || 0), 0);
    const totalPotonganHutang = (detailKaryawan || []).reduce((sum: number, item: { potongan: string | number }) => sum + (Number((item as any).potongan) || 0), 0);
    const totalPotongan = totalPotonganManual + totalPotonganHutang;
    const totalGajiPokokKaryawan = (detailKaryawan || []).reduce((sum: number, item: { gajiPokok?: string | number }) => sum + (Number((item as any).gajiPokok) || 0), 0);
    
    // Prevent double counting if salary is already in expenses
    const hasSalaryInBiaya = (biayaLain || []).some((b: any) => {
      const d = String((b as any)?.deskripsi || '').trim()
      return /^total\s*gaji\s*karyawan/i.test(d) || /^biaya\s*gaji\s*harian/i.test(d)
    });
    
    const totalJumlahGaji = totalBiayaLain + (hasSalaryInBiaya ? 0 : totalGajiPokokKaryawan);
    const totalGaji = totalJumlahGaji - totalPotongan;

    const startYmd = parseWibYmd(tanggalMulai)
    const endYmd = parseWibYmd(tanggalSelesai)
    if (!startYmd || !endYmd) {
      return NextResponse.json({ error: 'tanggalMulai/tanggalSelesai tidak valid' }, { status: 400 })
    }
    const tanggalMulaiUtc = wibStartUtc(startYmd)
    const tanggalSelesaiUtc = wibEndUtcInclusive(endYmd)

    const periodeHuman = (() => {
      const start = new Date(Date.UTC(startYmd.y, startYmd.m - 1, startYmd.d, 0, 0, 0))
      const end = new Date(Date.UTC(endYmd.y, endYmd.m - 1, endYmd.d, 0, 0, 0))
      const fmtDay = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric' })
      const fmtMonthYear = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', month: 'long', year: 'numeric' })
      const fmtFull = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'long', year: 'numeric' })
      const startMy = fmtMonthYear.format(start)
      const endMy = fmtMonthYear.format(end)
      if (startMy === endMy) {
        return `${fmtDay.format(start)} s.d ${fmtDay.format(end)} ${endMy}`
      }
      return `${fmtFull.format(start)} s.d ${fmtFull.format(end)}`
    })()

    const GAJIAN_MANUAL_BIAYA_MARKER = '[GAJIAN_BIAYA_MANUAL]'

    const gajianData = {
      kebunId: parsedKebunId,
      tanggalMulai: tanggalMulaiUtc,
      tanggalSelesai: tanggalSelesaiUtc,
      totalBerat: totalBerat || 0, // Ensure not NaN
      totalNota: totalNota,
      keterangan: keterangan || '',
      totalGaji: totalGaji || 0,
      totalBiayaLain: totalBiayaLain || 0,
      totalPotongan: totalPotongan || 0,
      dibuatOlehName: typeof dibuatOlehName === 'string' ? dibuatOlehName : null,
      disetujuiOlehName: typeof disetujuiOlehName === 'string' ? disetujuiOlehName : null,
      status: status === 'FINALIZED' ? 'FINALIZED' : 'DRAFT',
    };

    // Check for conflicts
    const conflicts = await prisma.detailGajian.findMany({
      where: {
        notaSawitId: { in: uniqueNotaIds },
        gajianId: gajianId ? { not: gajianId } : undefined, // Ignore current gajian if updating
      },
      select: { notaSawitId: true },
    });

    if (conflicts.length > 0) {
      return NextResponse.json(
        { 
          error: 'Beberapa nota sudah tercatat pada gajian lain', 
          conflicts: conflicts.map(c => c.notaSawitId),
        },
        { status: 409 }
      );
    }

    const gajian = await prisma.$transaction(async (tx) => {
      let upsertedGajian;
      if (gajianId) {
        // Update existing gajian (draft)
        upsertedGajian = await tx.gajian.update({
          where: { id: gajianId },
          data: gajianData,
        });

        // Clear old relations
        await tx.detailGajian.deleteMany({ where: { gajianId: gajianId } });
        await tx.biayaLainGajian.deleteMany({ where: { gajianId: gajianId } });
        await tx.potonganGajian.deleteMany({ where: { gajianId: gajianId } });
        await tx.detailGajianKaryawan.deleteMany({ where: { gajianId: gajianId } });
        await tx.absensiGajiHarian.deleteMany({ where: { gajianId: gajianId } as any });
        await tx.pekerjaanKebun.deleteMany({
          where: {
            gajianId: gajianId,
            upahBorongan: true,
            keterangan: { startsWith: GAJIAN_MANUAL_BIAYA_MARKER },
          } as any,
        })
        await tx.pekerjaanKebun.updateMany({ where: { gajianId: gajianId } as any, data: { gajianId: null } as any });

      } else {
        // Create new gajian
        upsertedGajian = await tx.gajian.create({
          data: gajianData,
        });
      }

      let sanitizedDetailKaryawan: any[] = []
      let totalPotonganHutangEffective = 0

      if (gajianId) {
        await (tx as any).kasTransaksi.deleteMany({
          where: {
            gajianId: upsertedGajian.id,
            kategori: { in: ['PEMBAYARAN_HUTANG', 'HUTANG_KARYAWAN'] },
            deletedAt: null,
          },
        })
      }

      if (detailKaryawan && detailKaryawan.length > 0) {
        const userIds = detailKaryawan.map((d: any) => Number(d.userId)).filter((userId: number) => !isNaN(userId));
        const extraHutangByUserId = new Map<number, number>()
        if (Array.isArray(hutangTambahan)) {
          for (const h of hutangTambahan) {
            const uid = Number((h as any)?.userId)
            const jml = Number((h as any)?.jumlah || 0)
            if (!Number.isFinite(uid) || uid <= 0) continue
            if (!Number.isFinite(jml) || jml <= 0) continue
            extraHutangByUserId.set(uid, (extraHutangByUserId.get(uid) || 0) + jml)
          }
        }
        
        // Fetch current debt balance for these users
        const [hutangAgg, bayarAgg] = await Promise.all([
          tx.kasTransaksi.groupBy({
            by: ['karyawanId'],
            where: {
              karyawanId: { in: userIds },
              tipe: 'PENGELUARAN',
              kategori: 'HUTANG_KARYAWAN',
              deletedAt: null,
            },
            _sum: { jumlah: true },
          }),
          tx.kasTransaksi.groupBy({
            by: ['karyawanId'],
            where: {
              karyawanId: { in: userIds },
              tipe: 'PEMASUKAN',
              kategori: 'PEMBAYARAN_HUTANG',
              deletedAt: null,
            },
            _sum: { jumlah: true },
          }),
        ]);

        const hutangMap = new Map(hutangAgg.map((r) => [r.karyawanId, Number(r._sum.jumlah || 0)]));
        const bayarMap = new Map(bayarAgg.map((r) => [r.karyawanId, Number(r._sum.jumlah || 0)]));

        sanitizedDetailKaryawan = detailKaryawan.map((d: any) => {
          const userId = Number(d.userId)
          const gajiPokok = Number(d.gajiPokok || 0)
          const totalHutang = hutangMap.get(userId) || 0
          const totalBayar = bayarMap.get(userId) || 0
          const currentSaldo = Math.max(0, Math.round(totalHutang - totalBayar))
          const extraHutang = Math.max(0, Math.round(Number(extraHutangByUserId.get(userId) || 0)))
          const requestedPotong = Math.max(0, Math.round(Number(d.potongan || 0)))
          const maxPotongByDebt = currentSaldo + extraHutang
          const potonganEff = Math.min(requestedPotong, maxPotongByDebt)
          totalPotonganHutangEffective += potonganEff

          return {
            ...d,
            userId,
            gajiPokok,
            potongan: potonganEff,
            total: gajiPokok - potonganEff,
            saldoHutangSnapshot: currentSaldo,
          }
        })

        await tx.detailGajianKaryawan.createMany({
            data: sanitizedDetailKaryawan.map((d: any) => ({
              gajianId: upsertedGajian.id,
              userId: d.userId,
              hariKerja: d.hariKerja,
              gajiPokok: d.gajiPokok || 0,
              potongan: d.potongan || 0,
              saldoHutang: Number(d.saldoHutangSnapshot || 0),
              total: d.total || 0,
              keterangan: d.keterangan || null,
            }))
        });

        if (gajianData.status === 'DRAFT') {
          await tx.absensiGajiHarian.deleteMany({ where: { gajianId: upsertedGajian.id } as any })
          const absensiRows = await tx.absensiHarian.findMany({
            where: {
              kebunId: parsedKebunId,
              date: { gte: tanggalMulaiUtc, lte: tanggalSelesaiUtc },
              jumlah: { gt: 0 },
              karyawanId: { in: userIds },
            },
            select: { kebunId: true, karyawanId: true, date: true, jumlah: true },
          })
          if (absensiRows.length > 0) {
            await tx.absensiGajiHarian.createMany({
              data: absensiRows.map((a) => ({
                kebunId: a.kebunId,
                karyawanId: a.karyawanId,
                date: a.date,
                jumlah: a.jumlah as any,
                gajianId: upsertedGajian.id,
              })),
              skipDuplicates: true,
            })
          }
        }
      }

      if (notas.length > 0) {
        await tx.detailGajian.createMany({
          data: notas.map((nota: { id: number, harianKerja?: number, keterangan?: string }) => ({
            gajianId: upsertedGajian.id,
            notaSawitId: nota.id,
            harianKerja: nota.harianKerja || 0,
            keterangan: nota.keterangan || null,
          })),
          skipDuplicates: true
        });
      }

      if (status === 'FINALIZED' && notas.length > 0) {
        await tx.notaSawit.updateMany({
          where: {
            id: { in: notaIds },
          },
          data: {
            statusGajian: 'DIPROSES',
            gajianId: upsertedGajian.id,
          },
        });
      }

      if (biayaLain && biayaLain.length > 0) {
        await tx.biayaLainGajian.createMany({
          data: biayaLain.map((item: { deskripsi: string; kategori?: string | null; jumlah: string; satuan: string; hargaSatuan: string; total: string; keterangan?: string }) => ({
            gajianId: upsertedGajian.id,
            deskripsi: item.deskripsi,
            kategori: typeof item.kategori === 'string' ? item.kategori.trim() : null,
            jumlah: parseFloat(item.jumlah) || null,
            satuan: item.satuan || null,
            hargaSatuan: parseFloat(item.hargaSatuan) || null,
            total: parseFloat(item.total) || 0,
            keterangan: item.keterangan || null,
          })),
        });
      }

      const potonganWithoutAuto = (potongan || []).filter((p: any) => String(p?.deskripsi || '') !== 'Potongan Hutang Karyawan')
      const potonganRowsToSave = [
        ...potonganWithoutAuto,
        ...(totalPotonganHutangEffective > 0 ? [{ deskripsi: 'Potongan Hutang Karyawan', total: totalPotonganHutangEffective, keterangan: 'Otomatis dari detail karyawan' }] : []),
      ]

      if (potonganRowsToSave.length > 0) {
        await tx.potonganGajian.createMany({
          data: potonganRowsToSave.map((item: { deskripsi: string; total: string; keterangan?: string }) => ({
            gajianId: upsertedGajian.id,
            deskripsi: item.deskripsi,
            total: parseFloat(item.total) || 0,
            keterangan: item.keterangan || null,
          })),
        });
      }

      const totalBiayaLainFinal = Array.isArray(biayaLain)
        ? biayaLain.reduce((sum: number, item: any) => sum + (Number(parseFloat(String(item?.total ?? '0'))) || 0), 0)
        : 0
      const totalPotonganManualFinal = Array.isArray(potonganWithoutAuto)
        ? potonganWithoutAuto.reduce((sum: number, item: any) => sum + (Number(parseFloat(String(item?.total ?? '0'))) || 0), 0)
        : 0
      const totalPotonganFinal = totalPotonganManualFinal + (Number(totalPotonganHutangEffective) || 0)
      const totalGajiFinal = totalBiayaLainFinal - totalPotonganFinal
      await tx.gajian.update({
        where: { id: upsertedGajian.id },
        data: {
          totalBiayaLain: totalBiayaLainFinal,
          totalPotongan: totalPotonganFinal,
          totalGaji: totalGajiFinal,
        },
      })

      await (tx as any).kasTransaksi.deleteMany({
        where: {
          gajianId: upsertedGajian.id,
          kategori: 'GAJI',
          karyawanId: null,
        },
      })

      if (status === 'FINALIZED') {
        const pemilik = await tx.user.findFirst({ where: { role: 'PEMILIK' }, select: { id: true } })
        const transactionUserId = pemilik?.id ?? currentUserId
        const periodeText = `${String(startYmd.y).padStart(4, '0')}-${String(startYmd.m).padStart(2, '0')}-${String(startYmd.d).padStart(2, '0')} - ${String(endYmd.y).padStart(4, '0')}-${String(endYmd.m).padStart(2, '0')}-${String(endYmd.d).padStart(2, '0')}`

        // 1. Create individual transactions for each employee's pay
        if (sanitizedDetailKaryawan.length > 0) {
          for (const d of sanitizedDetailKaryawan) {
            const amount = Math.max(0, Math.round(Number(d.total || 0)))
            if (amount <= 0) continue

            const user = await tx.user.findUnique({ where: { id: d.userId }, select: { name: true } })
            const employeeName = user?.name || `Karyawan #${d.userId}`
            const deskripsiKas = `Pembayaran Gaji: ${employeeName} (Gajian #${upsertedGajian.id})`
            const keteranganKas = `Gajian #${upsertedGajian.id} • Periode ${periodeText}`

            await tx.kasTransaksi.create({
              data: {
                date: tanggalSelesaiUtc,
                tipe: 'PENGELUARAN',
                deskripsi: deskripsiKas,
                jumlah: amount,
                kategori: 'GAJI',
                keterangan: keteranganKas,
                kebunId: parsedKebunId,
                userId: transactionUserId,
                gajianId: upsertedGajian.id,
                karyawanId: d.userId,
              } as any,
            })
          }
        }

        // 2. Create transaction for remaining non-salary expenses (Biaya Lain - Salary Already Accounted)
        // If there are other expenses (e.g. food, tools) not part of individual pay
        const totalPaidToKaryawan = sanitizedDetailKaryawan.reduce((sum: number, d: any) => sum + Math.max(0, Math.round(Number(d.total || 0))), 0)
        const remainingExpense = Math.round(totalGajiFinal - totalPaidToKaryawan)
        
        if (remainingExpense > 0) {
          const deskripsiKas = `Biaya Operasional Lainnya (Gajian #${upsertedGajian.id})`
          const keteranganKas = `Gajian #${upsertedGajian.id} • Periode ${periodeText}`
          await tx.kasTransaksi.create({
            data: {
              date: tanggalSelesaiUtc,
              tipe: 'PENGELUARAN',
              deskripsi: deskripsiKas,
              jumlah: remainingExpense,
              kategori: 'GAJI',
              keterangan: keteranganKas,
              kebunId: parsedKebunId,
              userId: transactionUserId,
              gajianId: upsertedGajian.id,
              karyawanId: null,
            } as any,
          })
        }
      }

      // Handle Absensi Payment Status Update
      if (status === 'FINALIZED' && payAbsensi) {
        // Ensure table exists
        await tx.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "AbsensiGajiHarian" (
            "id" SERIAL PRIMARY KEY,
            "kebunId" INTEGER NOT NULL,
            "karyawanId" INTEGER NOT NULL,
            "date" DATE NOT NULL,
            "jumlah" NUMERIC NOT NULL DEFAULT 0,
            "gajianId" INTEGER,
            "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
            UNIQUE ("kebunId","karyawanId","date")
          )
        `);
        await tx.$executeRawUnsafe(`ALTER TABLE "AbsensiGajiHarian" ADD COLUMN IF NOT EXISTS "gajianId" INTEGER`);

        // Fetch Absensi records to mark as paid
        const absensiRecords = await tx.absensiHarian.findMany({
          where: {
            kebunId: parsedKebunId,
            date: {
              gte: new Date(tanggalMulai),
              lte: new Date(tanggalSelesai),
            },
            jumlah: { gt: 0 },
          },
        });

        // Mark as paid by inserting into AbsensiGajiHarian
        for (const abs of absensiRecords) {
          await tx.$executeRaw`
            INSERT INTO "AbsensiGajiHarian" ("kebunId","karyawanId","date","jumlah","gajianId")
            VALUES (${abs.kebunId}, ${abs.karyawanId}, ${abs.date}, ${Number(abs.jumlah)}, ${upsertedGajian.id})
            ON CONFLICT ("kebunId","karyawanId","date") DO UPDATE
            SET "jumlah" = EXCLUDED."jumlah",
                "gajianId" = EXCLUDED."gajianId"
          `;
        }
      }

      const hutangPotonganRows = Array.isArray(sanitizedDetailKaryawan) && sanitizedDetailKaryawan.length > 0
        ? sanitizedDetailKaryawan
            .map((d: any) => ({
              userId: Number(d?.userId),
              potongan: Number(d?.potongan || 0),
            }))
            .filter((d: any) => Number.isFinite(d.userId) && d.userId > 0 && Number.isFinite(d.potongan) && d.potongan > 0)
        : []

      await (tx as any).kasTransaksi.deleteMany({
        where: {
          gajianId: upsertedGajian.id,
          kategori: 'PEMBAYARAN_HUTANG',
          deletedAt: null,
        },
      })

      if (status === 'FINALIZED' && hutangPotonganRows.length > 0) {
        await (tx as any).kasTransaksi.createMany({
          data: hutangPotonganRows.map((r: any) => ({
            date: new Date(tanggalSelesai),
            tipe: 'PEMASUKAN',
            deskripsi: `Potongan Hutang dari Gajian #${upsertedGajian.id}`,
            jumlah: r.potongan,
            kategori: 'PEMBAYARAN_HUTANG',
            kebunId: parsedKebunId,
            karyawanId: r.userId,
            gajianId: upsertedGajian.id,
          })),
        })
      }

      const hutangTambahanRows = Array.isArray(hutangTambahan)
        ? hutangTambahan
            .map((h: any) => ({
              userId: Number(h?.userId),
              jumlah: Number(h?.jumlah || 0),
              date: h?.date ? new Date(h.date) : null,
              deskripsi: h?.deskripsi ? String(h.deskripsi) : null,
            }))
            .filter((h: any) => Number.isFinite(h.userId) && h.userId > 0 && Number.isFinite(h.jumlah) && h.jumlah > 0)
        : []

      await tx.$executeRaw`DELETE FROM "GajianHutangTambahan" WHERE "gajianId" = ${upsertedGajian.id}`
      for (const h of hutangTambahanRows) {
        await tx.$executeRaw`
          INSERT INTO "GajianHutangTambahan" ("gajianId","userId","jumlah","date","deskripsi","updatedAt")
          VALUES (${upsertedGajian.id}, ${h.userId}, ${h.jumlah}, ${h.date}, ${h.deskripsi}, NOW())
        `
      }

      await (tx as any).kasTransaksi.deleteMany({
        where: {
          gajianId: upsertedGajian.id,
          kategori: 'HUTANG_KARYAWAN',
          deletedAt: null,
        },
      })

      if (status === 'FINALIZED' && hutangTambahanRows.length > 0) {
        await (tx as any).kasTransaksi.createMany({
          data: hutangTambahanRows.map((h: any) => ({
            date: h.date || tanggalSelesaiUtc,
            tipe: 'PENGELUARAN',
            deskripsi: h.deskripsi || `Hutang dari Gajian #${upsertedGajian.id}`,
            jumlah: h.jumlah,
            kategori: 'HUTANG_KARYAWAN',
            kebunId: parsedKebunId,
            karyawanId: h.userId,
            gajianId: upsertedGajian.id,
          })),
        })
      }

      const parsedPekerjaanBoronganIds = Array.isArray(pekerjaanBoronganIds)
        ? pekerjaanBoronganIds.map((v: any) => Number(v)).filter((n: any) => Number.isFinite(n) && n > 0)
        : []
      await tx.pekerjaanKebun.deleteMany({
        where: {
          gajianId: upsertedGajian.id,
          upahBorongan: true,
          keterangan: { startsWith: GAJIAN_MANUAL_BIAYA_MARKER },
        } as any,
      })
      await tx.pekerjaanKebun.updateMany({ where: { gajianId: upsertedGajian.id } as any, data: { gajianId: null } as any })
      if (parsedPekerjaanBoronganIds.length > 0) {
        await tx.pekerjaanKebun.updateMany({
          where: {
            id: { in: parsedPekerjaanBoronganIds },
            kebunId: parsedKebunId,
            upahBorongan: true,
            date: { gte: tanggalMulaiUtc, lte: tanggalSelesaiUtc },
          } as any,
          data: { gajianId: upsertedGajian.id } as any,
        })
      }

      if (status === 'FINALIZED') {
        const pekerjaanSigSet = new Set<string>()
        if (parsedPekerjaanBoronganIds.length > 0) {
          const pekerjaanRows = await tx.pekerjaanKebun.findMany({
            where: { id: { in: parsedPekerjaanBoronganIds }, kebunId: parsedKebunId, upahBorongan: true } as any,
            select: { jenisPekerjaan: true, biaya: true, jumlah: true, satuan: true, hargaSatuan: true },
          } as any)
          for (const p of pekerjaanRows as any[]) {
            const desc = String(p?.jenisPekerjaan || '').trim().toLowerCase()
            const biaya = Math.round(Number(p?.biaya || 0))
            const jumlah = Math.round(Number(p?.jumlah || 0) * 1000)
            const satuan = String(p?.satuan || '').trim().toLowerCase()
            const harga = Math.round(Number(p?.hargaSatuan || 0))
            pekerjaanSigSet.add(`${desc}|${biaya}|${jumlah}|${satuan}|${harga}`)
          }
        }

        const manualBiayaForBorongan = Array.isArray(biayaLain)
          ? biayaLain
              .filter((b: any) => {
                const clientId = typeof b?.clientId === 'string' ? b.clientId.trim() : ''
                if (!clientId) return false
                if (clientId.startsWith('auto-')) return false
                const ketRaw = typeof b?.keterangan === 'string' ? b.keterangan.trim() : ''
                if (/^\[AUTO_BORONGAN:/i.test(ketRaw)) return false
                const deskripsi = String(b?.deskripsi || '').trim()
                const total = Number.parseFloat(String(b?.total ?? '0'))
                if (pekerjaanSigSet.size > 0) {
                  const desc = deskripsi.toLowerCase()
                  const biaya = Math.round(total)
                  const jumlah = Math.round(Number.parseFloat(String(b?.jumlah ?? 0)) * 1000)
                  const satuan = String(b?.satuan || '').trim().toLowerCase()
                  const harga = Math.round(Number.parseFloat(String(b?.hargaSatuan ?? 0)))
                  const sig = `${desc}|${biaya}|${jumlah}|${satuan}|${harga}`
                  if (pekerjaanSigSet.has(sig)) return false
                }
                return !!deskripsi && Number.isFinite(total) && total > 0
              })
              .map((b: any) => ({
                deskripsi: String(b?.deskripsi || '').trim(),
                kategori: typeof b?.kategori === 'string' ? b.kategori.trim() : '',
                jumlah: Number.parseFloat(String(b?.jumlah ?? '')),
                satuan: typeof b?.satuan === 'string' ? b.satuan.trim() : null,
                hargaSatuan: Number.parseFloat(String(b?.hargaSatuan ?? '')),
                total: Number.parseFloat(String(b?.total ?? '0')),
                keterangan: typeof b?.keterangan === 'string' ? b.keterangan.trim() : '',
              }))
          : []

        if (manualBiayaForBorongan.length > 0) {
          await tx.pekerjaanKebun.createMany({
            data: manualBiayaForBorongan.map((b: any) => ({
              kebunId: parsedKebunId,
              userId: null,
              kendaraanPlatNomor: null,
              date: tanggalSelesaiUtc,
              jenisPekerjaan: b.deskripsi,
              kategoriBorongan: b.kategori ? b.kategori : 'GAJI_MANUAL',
              keterangan: `${GAJIAN_MANUAL_BIAYA_MARKER} Periode ${periodeHuman}${b.keterangan ? ` ${b.keterangan}` : ''}`,
              biaya: Number.isFinite(b.total) ? b.total : 0,
              imageUrl: null,
              gajianId: upsertedGajian.id,
              upahBorongan: true,
              jumlah: Number.isFinite(b.jumlah) && b.jumlah > 0 ? b.jumlah : null,
              satuan: b.satuan || null,
              hargaSatuan: Number.isFinite(b.hargaSatuan) && b.hargaSatuan > 0 ? b.hargaSatuan : null,
            })) as any,
          })
        }
      }

      return upsertedGajian;
    });

    // Audit Log
    await createAuditLog(currentUserId, gajianId ? 'UPDATE' : 'CREATE', 'Gajian', gajian.id.toString(), {
        kebunId: gajian.kebunId,
        totalGaji: gajian.totalGaji,
        status: gajian.status,
        periode: `${String(startYmd.y).padStart(4, '0')}-${String(startYmd.m).padStart(2, '0')}-${String(startYmd.d).padStart(2, '0')} - ${String(endYmd.y).padStart(4, '0')}-${String(endYmd.m).padStart(2, '0')}-${String(endYmd.d).padStart(2, '0')}`
    });

    return NextResponse.json(gajian, { status: 201 });
  } catch (error) {
    console.error('Error creating gajian:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
