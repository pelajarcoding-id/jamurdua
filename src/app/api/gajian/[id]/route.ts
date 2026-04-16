import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic'

const prisma = new PrismaClient();

const ensureHutangTambahanTable = async () => {
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
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { id } = params;

  try {
    await ensureHutangTambahanTable()
    const gajian = await prisma.gajian.findUnique({
      where: { id: parseInt(id, 10) },
      include: {
        kebun: true,
        detailGajian: {
          include: {
            notaSawit: {
              include: {
                supir: true,
                kendaraan: true,
                timbangan: {
                  include: {
                    kebun: true,
                  },
                },
              },
            },
          },
        },
        biayaLain: true,
        potongan: true,
        detailKaryawan: {
            include: {
                user: true
            }
        },
      },
    });

    if (!gajian) {
      return NextResponse.json({ message: 'Gajian not found' }, { status: 404 });
    }

    const hutangTambahan = await prisma.$queryRaw<Array<{ userId: number; jumlah: number; date: Date | null; deskripsi: string | null }>>`
      SELECT "userId", "jumlah", "date", "deskripsi"
      FROM "GajianHutangTambahan"
      WHERE "gajianId" = ${gajian.id}
      ORDER BY "id" ASC
    `

    const pekerjaanRows = await prisma.$queryRaw<Array<{
      id: number
      kebunId: number
      userId: number | null
      date: Date
      jenisPekerjaan: string
      kategoriBorongan: string | null
      keterangan: string | null
      biaya: number
      upahBorongan: boolean
      jumlah: number | null
      satuan: string | null
      hargaSatuan: number | null
    }>>`
      SELECT
        "id","kebunId","userId","date","jenisPekerjaan","kategoriBorongan","keterangan","biaya","upahBorongan","jumlah","satuan","hargaSatuan"
      FROM "PekerjaanKebun"
      WHERE "gajianId" = ${gajian.id}
        AND "upahBorongan" = TRUE
      ORDER BY "date" DESC
    `

    const userIds = Array.from(new Set(pekerjaanRows.map(r => r.userId).filter((v): v is number => typeof v === 'number' && v > 0)))
    const users = userIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
      : []
    const userMap = new Map(users.map(u => [u.id, u]))
    const pekerjaanKebun = pekerjaanRows.map(r => ({ ...r, user: r.userId ? (userMap.get(r.userId) || null) : null }))

    return NextResponse.json({ ...gajian, hutangTambahan, pekerjaanKebun });
  } catch (error) {
    console.error('Error fetching gajian:', error);
    return NextResponse.json({ message: 'Error fetching gajian' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  const gajianId = parseInt(id, 10);

  if (isNaN(gajianId)) {
    return NextResponse.json({ error: 'Invalid gajianId' }, { status: 400 });
  }

  try {
    await ensureHutangTambahanTable()
    await prisma.$transaction(async (tx) => {
      const gajian = await tx.gajian.findUnique({
        where: { id: gajianId },
        select: {
          kebunId: true,
          tanggalMulai: true,
          tanggalSelesai: true,
          status: true,
          detailKaryawan: {
            select: { userId: true },
          },
        },
      });
      if (!gajian) {
        throw new Error('Gajian not found');
      }

      const detailGajians = await tx.detailGajian.findMany({
        where: { gajianId },
        select: { notaSawitId: true },
      });
      const notaSawitIds = detailGajians.map(d => d.notaSawitId);

      if (notaSawitIds.length > 0) {
        await tx.notaSawit.updateMany({
          where: { id: { in: notaSawitIds } },
          data: {
            statusGajian: 'BELUM_DIPROSES',
            gajianId: null,
          },
        });
      }

      await (tx as any).kasTransaksi.deleteMany({
        where: {
          gajianId,
          kategori: 'PEMBAYARAN_HUTANG',
        },
      })
      await (tx as any).kasTransaksi.deleteMany({
        where: {
          gajianId,
          kategori: 'HUTANG_KARYAWAN',
        },
      })
      await tx.$executeRaw`DELETE FROM "GajianHutangTambahan" WHERE "gajianId" = ${gajianId}`

      await tx.absensiGajiHarian.deleteMany({ where: { gajianId } as any });
      await tx.pekerjaanKebun.updateMany({ where: { gajianId } as any, data: { gajianId: null } as any });

      if (gajian.status === 'FINALIZED') {
        const karyawanIds = gajian.detailKaryawan.map(d => d.userId);
        await tx.absensiGajiHarian.deleteMany({
          where: {
            kebunId: gajian.kebunId,
            date: {
              gte: gajian.tanggalMulai,
              lte: gajian.tanggalSelesai,
            },
            ...(karyawanIds.length > 0 ? { karyawanId: { in: karyawanIds } } : {}),
          },
        });
      }

      await tx.detailGajian.deleteMany({ where: { gajianId } });
      await tx.biayaLainGajian.deleteMany({ where: { gajianId } });
      await tx.potonganGajian.deleteMany({ where: { gajianId } });
      await tx.detailGajianKaryawan.deleteMany({ where: { gajianId } });

      await tx.gajian.delete({ where: { id: gajianId } });
    });

    return NextResponse.json({ message: 'Gajian deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error deleting gajian:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
