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

      const [drafts, finalized] = await prisma.$transaction([
        prisma.gajian.findMany({
          where: { ...where, status: 'DRAFT' },
          orderBy: { updatedAt: 'desc' },
          include: { kebun: true },
        }),
        prisma.gajian.findMany({
          where: { ...where, status: 'FINALIZED' },
          orderBy: { createdAt: 'desc' },
          include: { kebun: true },
        }),
      ]);
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
      ? { OR: [{ statusGajian: 'BELUM_DIPROSES' }, { gajianId: parseInt(gajianIdToEdit) }] }
      : { statusGajian: 'BELUM_DIPROSES' };

    const where: Prisma.NotaSawitWhereInput = {
      AND: [
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
        orderBy: {
          createdAt: 'asc',
        },
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
    const hasSalaryInBiaya = (biayaLain || []).some((b: any) => b.deskripsi === 'Total Gaji Karyawan');
    
    const totalJumlahGaji = totalBiayaLain + (hasSalaryInBiaya ? 0 : totalGajiPokokKaryawan);
    const totalGaji = totalJumlahGaji - totalPotongan;

    const startYmd = parseWibYmd(tanggalMulai)
    const endYmd = parseWibYmd(tanggalSelesai)
    if (!startYmd || !endYmd) {
      return NextResponse.json({ error: 'tanggalMulai/tanggalSelesai tidak valid' }, { status: 400 })
    }
    const tanggalMulaiUtc = wibStartUtc(startYmd)
    const tanggalSelesaiUtc = wibEndUtcInclusive(endYmd)

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
        await tx.pekerjaanKebun.updateMany({ where: { gajianId: gajianId } as any, data: { gajianId: null } as any });

      } else {
        // Create new gajian
        upsertedGajian = await tx.gajian.create({
          data: gajianData,
        });
      }

      if (detailKaryawan && detailKaryawan.length > 0) {
        await tx.detailGajianKaryawan.createMany({
            data: detailKaryawan.map((d: any) => ({
                gajianId: upsertedGajian.id,
                userId: d.userId,
                hariKerja: d.hariKerja,
                gajiPokok: d.gajiPokok || 0,
                potongan: d.potongan || 0,
                total: d.total || 0,
                keterangan: d.keterangan || null
            }))
        });
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
          data: biayaLain.map((item: { deskripsi: string; jumlah: string; satuan: string; hargaSatuan: string; total: string; keterangan?: string }) => ({
            gajianId: upsertedGajian.id,
            deskripsi: item.deskripsi,
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
        ...(totalPotonganHutang > 0 ? [{ deskripsi: 'Potongan Hutang Karyawan', total: totalPotonganHutang, keterangan: 'Otomatis dari detail karyawan' }] : []),
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

      const hutangPotonganRows = Array.isArray(detailKaryawan)
        ? detailKaryawan
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

      return upsertedGajian;
    });

    // Audit Log
    const session = await auth();
    const currentUserId = session?.user?.id ? Number(session.user.id) : 1;
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
