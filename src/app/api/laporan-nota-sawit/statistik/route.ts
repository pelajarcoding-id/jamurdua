import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getWibRangeUtcFromParams } from '@/lib/wib';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const kebunId = searchParams.get('kebunId');
  const supirId = searchParams.get('supirId');
  const pabrikId = searchParams.get('pabrikId');
  const kendaraanPlatNomor = searchParams.get('kendaraanPlatNomor');
  const perusahaanId = searchParams.get('perusahaanId');
  const statusPembayaran = (searchParams.get('statusPembayaran') || '').toUpperCase()
  const search = (searchParams.get('search') || '').trim()
  const groupByParam = (searchParams.get('groupBy') || 'kebun').toLowerCase()
  const groupBy = ['total', 'kebun', 'perusahaan', 'pabrik'].includes(groupByParam) ? groupByParam : 'kebun'

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'Parameter tanggal mulai dan tanggal akhir diperlukan' }, { status: 400 });
  }

  try {
    const range = getWibRangeUtcFromParams(searchParams)
    if (!range) {
      return NextResponse.json({ error: 'Tanggal tidak valid' }, { status: 400 });
    }

    const notaSawitWhere: Prisma.NotaSawitWhereInput = {
      deletedAt: null,
      tanggalBongkar: {
        gte: range.startUtc,
        lt: range.endExclusiveUtc,
      },
    };
    const notaSawitWhereNoTanggal: Prisma.NotaSawitWhereInput = {
      deletedAt: null,
    }

    if (supirId) {
      notaSawitWhere.supirId = parseInt(supirId, 10);
      notaSawitWhereNoTanggal.supirId = parseInt(supirId, 10);
    }

    if (kebunId) {
      const kid = parseInt(kebunId, 10)
      const kebunCond: Prisma.NotaSawitWhereInput = { OR: [{ kebunId: kid }, { timbangan: { kebunId: kid } }] }
      notaSawitWhere.AND = [
        ...(Array.isArray(notaSawitWhere.AND) ? notaSawitWhere.AND : notaSawitWhere.AND ? [notaSawitWhere.AND] : []),
        kebunCond,
      ]
      notaSawitWhereNoTanggal.AND = [
        ...(Array.isArray(notaSawitWhereNoTanggal.AND) ? notaSawitWhereNoTanggal.AND : notaSawitWhereNoTanggal.AND ? [notaSawitWhereNoTanggal.AND] : []),
        kebunCond,
      ]
    }

    if (pabrikId) {
      notaSawitWhere.pabrikSawitId = parseInt(pabrikId, 10);
      notaSawitWhereNoTanggal.pabrikSawitId = parseInt(pabrikId, 10);
    }

    if (kendaraanPlatNomor) {
      notaSawitWhere.kendaraanPlatNomor = kendaraanPlatNomor;
      notaSawitWhereNoTanggal.kendaraanPlatNomor = kendaraanPlatNomor;
    }
    if (perusahaanId) {
      const pid = parseInt(perusahaanId, 10)
      if (Number.isFinite(pid) && pid > 0) {
        ;(notaSawitWhere as any).perusahaanId = pid
        ;(notaSawitWhereNoTanggal as any).perusahaanId = pid
      }
    }
    if (statusPembayaran === 'LUNAS' || statusPembayaran === 'BELUM_LUNAS') {
      ;(notaSawitWhere as any).statusPembayaran = statusPembayaran
      ;(notaSawitWhereNoTanggal as any).statusPembayaran = statusPembayaran
    }
    if (search) {
      const isInt = /^\d+$/.test(search)
      const idNum = isInt ? Number(search) : null
      const orCond: Prisma.NotaSawitWhereInput[] = [
        { kendaraanPlatNomor: { contains: search, mode: 'insensitive' } },
        { supir: { name: { contains: search, mode: 'insensitive' } } },
        { kebun: { name: { contains: search, mode: 'insensitive' } } },
        { timbangan: { kebun: { name: { contains: search, mode: 'insensitive' } } } },
        { pabrikSawit: { name: { contains: search, mode: 'insensitive' } } },
        { perusahaan: { name: { contains: search, mode: 'insensitive' } } },
      ]
      if (idNum) orCond.push({ id: idNum })
      notaSawitWhere.AND = [
        ...(Array.isArray(notaSawitWhere.AND) ? notaSawitWhere.AND : notaSawitWhere.AND ? [notaSawitWhere.AND] : []),
        { OR: orCond },
      ]
      notaSawitWhereNoTanggal.AND = [
        ...(Array.isArray(notaSawitWhereNoTanggal.AND) ? notaSawitWhereNoTanggal.AND : notaSawitWhereNoTanggal.AND ? [notaSawitWhereNoTanggal.AND] : []),
        { OR: orCond },
      ]
    }

    // 1. KPI
    const kpiData = await prisma.notaSawit.aggregate({
      where: notaSawitWhere,
      _sum: {
        totalPembayaran: true,
        beratAkhir: true,
        pph: true,
        potongan: true,
        // @ts-ignore
        pph25: true,
        pembayaranSetelahPph: true,
        pembayaranAktual: true,
        ...( { buahBalik: true } as any ),
      },
    });

    const jumlahNota = await prisma.notaSawit.count({
      where: notaSawitWhere,
    });

    const totalTonase = kpiData._sum?.beratAkhir || 0;
    const totalPotongan = kpiData._sum?.potongan || 0;
    const totalNetto = totalTonase + totalPotongan;
    const totalPembayaran = kpiData._sum?.totalPembayaran || 0;
    
    const rataRataHargaPerKg = totalTonase > 0 ? totalPembayaran / totalTonase : 0;
    const rataRataTonasePerNota = jumlahNota > 0 ? totalTonase / jumlahNota : 0;
    const totalPph = kpiData._sum?.pph || 0;
    // @ts-ignore
    const totalPph25 = kpiData._sum?.pph25 || 0;
    const totalNet = kpiData._sum?.pembayaranSetelahPph || 0;
    const totalBuahBalik = (kpiData as any)?._sum?.buahBalik || 0;

    const pembayaranByStatus = await prisma.notaSawit.groupBy({
      by: ['statusPembayaran'],
      where: notaSawitWhere,
      _sum: { totalPembayaran: true },
      _count: { _all: true },
    })
    const lunasRow = pembayaranByStatus.find((r: any) => String(r.statusPembayaran || '').toUpperCase() === 'LUNAS')
    const belumRow = pembayaranByStatus.find((r: any) => String(r.statusPembayaran || '').toUpperCase() === 'BELUM_LUNAS')
    const lunasCount = lunasRow?._count?._all || 0
    const belumLunasCount = belumRow?._count?._all || 0
    const totalPembayaranLunas = lunasRow?._sum?.totalPembayaran || 0
    const totalPembayaranBelumLunas = belumRow?._sum?.totalPembayaran || 0

    const pembayaranBatchAgg = await prisma.notaSawitPembayaranBatchItem.aggregate({
      where: {
        batch: {
          tanggal: {
            gte: range.startUtc,
            lt: range.endExclusiveUtc,
          },
          ...(pabrikId ? { pabrikSawitId: parseInt(pabrikId, 10) } : {}),
        },
        notaSawit: notaSawitWhereNoTanggal,
      },
      _sum: { pembayaranAktual: true },
    })
    const totalPembayaranNotaSawit = pembayaranBatchAgg._sum?.pembayaranAktual || 0

    const selisih = totalPembayaranNotaSawit - totalNet;

    const kpi = {
      totalTonase,
      totalPotongan,
      totalNetto,
      totalPembayaran,
      totalBuahBalik,
      lunasCount,
      belumLunasCount,
      totalPembayaranLunas,
      totalPembayaranBelumLunas,
      jumlahNota,
      rataRataHargaPerKg,
      rataRataTonasePerNota,
      totalPph,
      totalPph25,
      totalNet,
      totalPembayaranNotaSawit,
      selisih,
    };

    // 2. Statistik Bulanan & Per Kebun
    const rawData = await prisma.notaSawit.findMany({
      where: notaSawitWhere,
      select: {
        tanggalBongkar: true,
        totalPembayaran: true,
        beratAkhir: true,
        perusahaan: { select: { name: true } },
        pabrikSawit: { select: { name: true, perusahaan: { select: { name: true } } } },
        kebun: {
          select: {
            name: true,
          },
        },
        timbangan: {
          select: {
            kebun: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        tanggalBongkar: 'asc',
      },
    });

    const monthKeyWib = (d: Date) => {
      const wib = new Date(d.getTime() + 7 * 60 * 60 * 1000)
      const y = wib.getUTCFullYear()
      const m = String(wib.getUTCMonth() + 1).padStart(2, '0')
      return `${y}-${m}`
    }

    // Proses data bulanan untuk Total
    const monthlyData = rawData.reduce((acc: Record<string, { month: string; totalPembayaran: number; totalBerat: number }>, item) => {
      if (item.tanggalBongkar) {
        const month = monthKeyWib(item.tanggalBongkar); // YYYY-MM WIB
        if (!acc[month]) {
          acc[month] = { month, totalPembayaran: 0, totalBerat: 0 };
        }
        acc[month].totalPembayaran += item.totalPembayaran || 0;
        acc[month].totalBerat += item.beratAkhir || 0;
      }
      return acc;
    }, {});

    const sortedMonthlyData = Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));

    const monthlyDataWithGrowth = sortedMonthlyData.map((item, index) => {
      const previousItem = index > 0 ? sortedMonthlyData[index - 1] : null;
      const previousBerat = previousItem ? previousItem.totalBerat : 0;
      const growthKg = previousItem ? item.totalBerat - previousBerat : 0;
      const growthPercentage = previousBerat > 0 ? (growthKg / previousBerat) * 100 : 0;
      
      return {
        ...item,
        previousBerat,
        growthKg,
        growthPercentage,
        isUp: growthKg >= 0
      };
    });

    // Proses data bulanan per Kebun
    const getGroupName = (item: any) => {
      if (groupBy === 'kebun') return item.kebun?.name || item.timbangan?.kebun?.name || 'Tidak diketahui'
      if (groupBy === 'perusahaan') return item.perusahaan?.name || item.pabrikSawit?.perusahaan?.name || 'Tidak diketahui'
      if (groupBy === 'pabrik') return item.pabrikSawit?.name || 'Tidak diketahui'
      return 'Total'
    }

    const monthlyDataGroupMap = rawData.reduce((acc: Record<string, Record<string, { month: string; totalBerat: number }>>, item) => {
      if (groupBy === 'total') return acc
      const name = getGroupName(item)
      if (item.tanggalBongkar && name) {
        const month = monthKeyWib(item.tanggalBongkar)
        if (!acc[name]) acc[name] = {}
        if (!acc[name][month]) acc[name][month] = { month, totalBerat: 0 }
        acc[name][month].totalBerat += item.beratAkhir || 0
      }
      return acc
    }, {})

    const monthlyDataPerGroup = Object.entries(monthlyDataGroupMap).map(([groupName, monthlyStats]) => {
      const sortedStats = Object.values(monthlyStats).sort((a, b) => a.month.localeCompare(b.month))
      const statsWithGrowth = sortedStats.map((item, index) => {
        const previousItem = index > 0 ? sortedStats[index - 1] : null
        const previousBerat = previousItem ? previousItem.totalBerat : 0
        const growthKg = previousItem ? item.totalBerat - previousBerat : 0
        const growthPercentage = previousBerat > 0 ? (growthKg / previousBerat) * 100 : 0
        return {
          ...item,
          previousBerat,
          growthKg,
          growthPercentage,
          isUp: growthKg >= 0,
        }
      })
      return { groupName, data: statsWithGrowth }
    })


    const topMap = rawData.reduce((acc: Record<string, number>, item: any) => {
      if (groupBy === 'total') return acc
      const name = getGroupName(item)
      acc[name] = (acc[name] || 0) + Number(item?.beratAkhir || 0)
      return acc
    }, {})
    const topGroups = Object.entries(topMap)
      .map(([nama, totalBerat]) => ({ nama, totalBerat }))
      .sort((a, b) => {
        if (b.totalBerat !== a.totalBerat) return b.totalBerat - a.totalBerat
        return a.nama.localeCompare(b.nama)
      })

    return NextResponse.json({
      kpi,
      monthlyData: monthlyDataWithGrowth,
      monthlyDataPerGroup,
      topGroups,
      groupBy,
    });

  } catch (error) {
    console.error('Error fetching statistics:', error);
    return NextResponse.json({ error: 'Gagal mengambil data statistik' }, { status: 500 });
  }
}
