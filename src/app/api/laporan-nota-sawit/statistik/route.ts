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

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'Parameter tanggal mulai dan tanggal akhir diperlukan' }, { status: 400 });
  }

  try {
    const range = getWibRangeUtcFromParams(searchParams)
    if (!range) {
      return NextResponse.json({ error: 'Tanggal tidak valid' }, { status: 400 });
    }

    const notaSawitWhere: Prisma.NotaSawitWhereInput = {
      tanggalBongkar: {
        gte: range.startUtc,
        lt: range.endExclusiveUtc,
      },
    };

    if (supirId) {
      notaSawitWhere.supirId = parseInt(supirId, 10);
    }

    if (kebunId) {
      notaSawitWhere.timbangan = {
        kebunId: parseInt(kebunId, 10),
      };
    }

    if (pabrikId) {
      notaSawitWhere.pabrikSawitId = parseInt(pabrikId, 10);
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
      },
    });

    const jumlahNota = await prisma.notaSawit.count({
      where: notaSawitWhere,
    });

    console.log('KPI Aggregate Result:', JSON.stringify(kpiData, null, 2));
    console.log('Jumlah Nota:', jumlahNota);

    // Hitung total pembayaran aktual (gabungan yang diisi manual dan default net)
    // 1. Ambil sum pembayaranAktual yang tidak null (sudah ada di kpiData)
    // 2. Ambil sum pembayaranSetelahPph untuk row yang pembayaranAktual-nya NULL
    const kpiDataNullAktual = await prisma.notaSawit.aggregate({
      where: {
        ...notaSawitWhere,
        pembayaranAktual: null,
      },
      _sum: {
        pembayaranSetelahPph: true,
      },
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
    
    // Total Aktual = (Sum Aktual Non-Null) + (Sum Net Where Aktual Null)
    const sumAktualNonNull = kpiData._sum?.pembayaranAktual || 0;
    const sumNetWhereAktualNull = kpiDataNullAktual._sum?.pembayaranSetelahPph || 0;
    const totalAktual = sumAktualNonNull + sumNetWhereAktualNull;
    
    const selisih = totalAktual - totalNet;

    const kpi = {
      totalTonase,
      totalPotongan,
      totalNetto,
      totalPembayaran,
      jumlahNota,
      rataRataHargaPerKg,
      rataRataTonasePerNota,
      totalPph,
      totalPph25,
      totalNet,
      totalAktual,
      selisih,
    };

    // 2. Statistik Bulanan & Per Kebun
    const rawData = await prisma.notaSawit.findMany({
      where: notaSawitWhere,
      select: {
        tanggalBongkar: true,
        totalPembayaran: true,
        beratAkhir: true,
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
    const monthlyDataKebunMap = rawData.reduce((acc: Record<string, Record<string, { month: string; totalBerat: number }>>, item) => {
      if (item.tanggalBongkar && item.timbangan?.kebun?.name) {
        const month = monthKeyWib(item.tanggalBongkar);
        const kebunName = item.timbangan.kebun.name;

        if (!acc[kebunName]) {
          acc[kebunName] = {};
        }
        if (!acc[kebunName][month]) {
          acc[kebunName][month] = { month, totalBerat: 0 };
        }
        acc[kebunName][month].totalBerat += item.beratAkhir || 0;
      }
      return acc;
    }, {});

    const monthlyDataPerKebun = Object.entries(monthlyDataKebunMap).map(([kebunName, monthlyStats]) => {
        // Ensure all months in the range are present? Or just the ones with data? 
        // For simplicity, just the ones with data, sorted by month.
        const sortedStats = Object.values(monthlyStats).sort((a, b) => a.month.localeCompare(b.month));
        
        const statsWithGrowth = sortedStats.map((item, index) => {
            const previousItem = index > 0 ? sortedStats[index - 1] : null;
            // Note: This simple previousItem logic assumes consecutive months. 
            // If a month is missing, growth will be calculated against the last available month.
            // For more accuracy, we might want to fill gaps, but for now this is acceptable or we can check month diff.
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

        return {
            kebunName,
            data: statsWithGrowth
        };
    });


    // 3. Kebun Paling Produktif
    const notaSawitFilter: Prisma.NotaSawitWhereInput = {};
    if (pabrikId) notaSawitFilter.pabrikSawitId = parseInt(pabrikId, 10);
    if (supirId) notaSawitFilter.supirId = parseInt(supirId, 10);

    const timbanganWhere: Prisma.TimbanganWhereInput = {
        date: {
            gte: range.startUtc,
            lt: range.endExclusiveUtc,
        },
        kebunId: kebunId ? parseInt(kebunId, 10) : undefined,
        notaSawit: {
            isNot: null,
            is: notaSawitFilter
        }
    };

    const productiveKebun = await prisma.timbangan.groupBy({
        by: ['kebunId'],
        where: timbanganWhere,
        _sum: {
            netKg: true,
        },
        orderBy: {
            _sum: {
                netKg: 'desc',
            },
        },
        take: 5, // Ambil top 5
    });

    // Ambil nama kebun
    const kebunIds = productiveKebun.map((k: { kebunId: number | null }) => k.kebunId).filter((id): id is number => id !== null);
    const kebunDetails = await prisma.kebun.findMany({
        where: {
            id: {
                in: kebunIds,
            },
        },
        select: {
            id: true,
            name: true,
        },
    });

    const kebunMap = kebunDetails.reduce((acc: Record<number, string>, kebun: { id: number; name: string }) => {
        acc[kebun.id] = kebun.name;
        return acc;
    }, {});

    const topKebun = productiveKebun.map((k: { kebunId: number | null; _sum: { netKg: number | null } }) => ({
        nama: k.kebunId ? kebunMap[k.kebunId] || 'Tidak Diketahui' : 'Tidak Diketahui',
        totalBerat: k._sum.netKg || 0,
    }));

    return NextResponse.json({
      kpi,
      monthlyData: monthlyDataWithGrowth,
      monthlyDataPerKebun,
      topKebun,
    });

  } catch (error) {
    console.error('Error fetching statistics:', error);
    return NextResponse.json({ error: 'Gagal mengambil data statistik' }, { status: 500 });
  }
}
