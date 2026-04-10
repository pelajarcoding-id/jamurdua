import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { parseWibYmd, wibEndUtcInclusive, wibStartUtc } from '@/lib/wib';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      kebunId, 
      tanggalMulai, 
      tanggalSelesai, 
      detailKaryawan, 
      biayaLain,
      potongan
    } = body;

    // Validate
    if (!kebunId || !tanggalMulai || !tanggalSelesai || !detailKaryawan) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    const startYmd = parseWibYmd(tanggalMulai)
    const endYmd = parseWibYmd(tanggalSelesai)
    if (!startYmd || !endYmd) {
      return NextResponse.json({ error: 'Tanggal tidak valid' }, { status: 400 })
    }
    const startDate = wibStartUtc(startYmd)
    const endDate = wibEndUtcInclusive(endYmd)

    const existingOverlap = await prisma.gajian.findFirst({
      where: {
        kebunId: Number(kebunId),
        tipe: 'BULANAN',
        status: { in: ['DRAFT', 'FINALIZED'] },
        tanggalMulai: { lte: endDate },
        tanggalSelesai: { gte: startDate },
      },
      select: { id: true, status: true },
    })
    if (existingOverlap) {
      return NextResponse.json(
        { error: `Sudah ada penggajian BULANAN yang menutupi periode ini (ID ${existingOverlap.id}, status ${existingOverlap.status}).` },
        { status: 409 }
      )
    }

    const potonganManual = Array.isArray(potongan) ? potongan : []

    const totalGajiKaryawan = detailKaryawan.reduce((acc: number, curr: any) => acc + (curr.total || 0), 0);
    const totalPotonganHutang = detailKaryawan.reduce((acc: number, curr: any) => acc + (curr.potongan || 0), 0);
    const totalPotonganManual = potonganManual.reduce((acc: number, curr: any) => acc + (Number(curr.total) || 0), 0);
    const totalPotongan = totalPotonganHutang + totalPotonganManual;

    // Prepare Biaya Lain (append Total Gaji Karyawan)
    const biayaLainToCreate = Array.isArray(biayaLain) ? [...biayaLain] : [];
    if (totalGajiKaryawan > 0) {
        biayaLainToCreate.push({
            deskripsi: 'Total Gaji Karyawan',
            jumlah: 1,
            satuan: 'Paket',
            hargaSatuan: totalGajiKaryawan,
            total: totalGajiKaryawan,
            keterangan: 'Otomatis dari Rekap Absensi'
        });
    }

    const totalBiayaLain = biayaLainToCreate.reduce((acc: number, curr: any) => acc + (curr.total || 0), 0);
    
    // Total Gaji (Grand Total) = Total Expenses (including Salary) - Deductions
    const totalGaji = totalBiayaLain - totalPotongan;

    const requestedUserIds = Array.isArray(detailKaryawan)
      ? detailKaryawan.map((d: any) => Number(d?.userId)).filter((id: any) => Number.isFinite(id) && id > 0)
      : []

    let hariKerjaMap = new Map<number, number>()
    if (requestedUserIds.length > 0) {
      try {
        const rows = await prisma.absensiHarian.groupBy({
          by: ['karyawanId'],
          where: {
            kebunId: Number(kebunId),
            date: { gte: startDate, lte: endDate },
            karyawanId: { in: requestedUserIds },
            OR: [{ kerja: true }, { jumlah: { gt: 0 } }],
          },
          _count: { _all: true },
        })
        hariKerjaMap = new Map(rows.map(r => [r.karyawanId, r._count._all]))
      } catch {
        hariKerjaMap = new Map()
      }
    }

    const createData: any = {
      kebunId: Number(kebunId),
      tanggalMulai: startDate,
      tanggalSelesai: endDate,
      status: 'DRAFT',
      totalNota: 0,
      totalBerat: 0,
      totalGaji,
      totalBiayaLain,
      totalPotongan,
      keterangan: `Pengajuan Gaji Kebun Periode ${String(startYmd.y).padStart(4, '0')}-${String(startYmd.m).padStart(2, '0')}-${String(startYmd.d).padStart(2, '0')} - ${String(endYmd.y).padStart(4, '0')}-${String(endYmd.m).padStart(2, '0')}-${String(endYmd.d).padStart(2, '0')}`,
      tipe: 'BULANAN',
      detailKaryawan: {
        create: detailKaryawan.map((d: any) => ({
            userId: d.userId,
            hariKerja: hariKerjaMap.get(Number(d.userId)) || 0,
            gajiPokok: d.gajiPokok || 0,
            potongan: d.potongan || 0,
            total: d.total || 0,
            keterangan: d.keterangan
        }))
      }
    };

    if (biayaLainToCreate.length > 0) {
      createData.biayaLain = {
        create: biayaLainToCreate.map((b: any) => ({
          deskripsi: b.deskripsi,
          jumlah: 1,
          satuan: 'Paket',
          hargaSatuan: b.hargaSatuan || b.total,
          total: b.total,
          keterangan: b.keterangan || 'Dari Aktivitas Kebun',
        })),
      };
    }
    if (potonganManual.length > 0) {
      const validPotongan = potonganManual
        .map((p: any) => ({
          deskripsi: String(p?.deskripsi || '').trim(),
          total: Math.round(Number(p?.total || 0)),
          keterangan: typeof p?.keterangan === 'string' ? p.keterangan : undefined,
        }))
        .filter((p: any) => p.deskripsi && p.total > 0)

      if (validPotongan.length > 0) {
        createData.potongan = {
          create: validPotongan.map((p: any) => ({
            deskripsi: p.deskripsi,
            total: p.total,
            keterangan: p.keterangan || null,
          })),
        }
      }
    }

    const gajian = await prisma.$transaction(async (tx) => {
      const created = await tx.gajian.create({ data: createData })

      const absensi = await tx.absensiHarian.findMany({
        where: {
          kebunId: Number(kebunId),
          date: { gte: startDate, lte: endDate },
          jumlah: { gt: 0 },
        },
        select: { kebunId: true, karyawanId: true, date: true, jumlah: true },
      })

      if (absensi.length > 0) {
        await tx.absensiGajiHarian.createMany({
          data: absensi.map((a) => ({
            kebunId: a.kebunId,
            karyawanId: a.karyawanId,
            date: a.date,
            jumlah: a.jumlah,
            gajianId: created.id,
          })),
          skipDuplicates: true,
        })
      }

      await tx.pekerjaanKebun.updateMany({
        where: {
          kebunId: Number(kebunId),
          date: { gte: startDate, lte: endDate },
          upahBorongan: true,
          biaya: { gt: 0 },
          gajianId: null,
        } as any,
        data: { gajianId: created.id } as any,
      })

      return created
    })

    return NextResponse.json({ success: true, data: gajian });
  } catch (error) {
    console.error('Error creating gajian from kebun:', error);
    return NextResponse.json(
      { error: 'Gagal membuat draft gajian' }, 
      { status: 500 }
    );
  }
}
