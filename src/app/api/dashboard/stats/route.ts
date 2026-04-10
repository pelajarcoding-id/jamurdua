import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function parseDateOnly(value: string | null) {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d
}

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function endOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const prodStartRaw = parseDateOnly(searchParams.get('productionStartDate'))
    const prodEndRaw = parseDateOnly(searchParams.get('productionEndDate'))
    const finStartRaw = parseDateOnly(searchParams.get('financeStartDate'))
    const finEndRaw = parseDateOnly(searchParams.get('financeEndDate'))

    const now = new Date()
    const startOfToday = new Date(now)
    startOfToday.setHours(0, 0, 0, 0)

    const sevenDaysStart = new Date(startOfToday)
    sevenDaysStart.setDate(sevenDaysStart.getDate() - 6)

    const monthStart = new Date(now)
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    let productionStart = prodStartRaw ? startOfDay(prodStartRaw) : monthStart
    let productionEnd = prodEndRaw ? endOfDay(prodEndRaw) : now
    if (productionEnd.getTime() < productionStart.getTime()) {
      const tmp = productionStart
      productionStart = startOfDay(productionEnd)
      productionEnd = endOfDay(tmp)
    }
    const productionDays = Math.floor((startOfDay(productionEnd).getTime() - startOfDay(productionStart).getTime()) / (24 * 60 * 60 * 1000)) + 1
    if (productionDays > 366) {
      return NextResponse.json({ error: 'Rentang waktu terlalu panjang (maks 366 hari)' }, { status: 400 })
    }

    let financeStart = finStartRaw ? startOfDay(finStartRaw) : monthStart
    let financeEnd = finEndRaw ? endOfDay(finEndRaw) : now
    if (financeEnd.getTime() < financeStart.getTime()) {
      const tmp = financeStart
      financeStart = startOfDay(financeEnd)
      financeEnd = endOfDay(tmp)
    }

    const [
      notaCount,
      timbanganCount,
      uangJalanCount,
      kendaraanCount,
      supirCount,
      pabrikCount,
      kebunCount,
      gajianCount,
      userCount,
      kasirCount,
      recentNotas,
      kasPemasukan,
      kasPengeluaran
    ] = await prisma.$transaction([
      prisma.notaSawit.count(),
      prisma.timbangan.count(),
      prisma.sesiUangJalan.count(),
      prisma.kendaraan.count(),
      prisma.user.count({ where: { role: 'SUPIR' } }),
      prisma.pabrikSawit.count(),
      prisma.kebun.count(),
      prisma.gajian.count(),
      prisma.user.count(),
      prisma.kasTransaksi.count({ where: { deletedAt: null } }),
      prisma.notaSawit.findMany({
        where: {
          OR: [
            { tanggalBongkar: { gte: productionStart, lte: productionEnd } },
            { tanggalBongkar: null, createdAt: { gte: productionStart, lte: productionEnd } },
          ],
        },
        select: { createdAt: true, tanggalBongkar: true, beratAkhir: true }
      }),
      prisma.kasTransaksi.aggregate({
        where: {
          deletedAt: null,
          tipe: 'PEMASUKAN',
          date: { gte: financeStart, lte: financeEnd },
        },
        _sum: { jumlah: true }
      }),
      prisma.kasTransaksi.aggregate({
        where: {
          deletedAt: null,
          tipe: 'PENGELUARAN',
          date: { gte: financeStart, lte: financeEnd },
        },
        _sum: { jumlah: true }
      })
    ]);

    // Process Production Stats
    const productionMap = new Map<string, number>();
    for (let i = 0; i < productionDays; i++) {
      const d = new Date(startOfDay(productionStart))
      d.setDate(d.getDate() + i)
      const dateStr = d.toISOString().split('T')[0]
      productionMap.set(dateStr, 0)
    }

    recentNotas.forEach(nota => {
        const effectiveDate = nota.tanggalBongkar ?? nota.createdAt
        const dateStr = effectiveDate.toISOString().split('T')[0];
        if (productionMap.has(dateStr)) {
            productionMap.set(dateStr, (productionMap.get(dateStr) || 0) + nota.beratAkhir);
        }
    });

    const productionStats = Array.from(productionMap.entries())
        .map(([date, total]) => ({ date, total }))
        .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      notaCount,
      timbanganCount,
      uangJalanCount,
      kendaraanCount,
      supirCount,
      pabrikCount,
      kebunCount,
      gajianCount,
      userCount,
      kasirCount,
      productionStats,
      range: {
        productionStartDate: startOfDay(productionStart).toISOString(),
        productionEndDate: endOfDay(productionEnd).toISOString(),
        financeStartDate: startOfDay(financeStart).toISOString(),
        financeEndDate: endOfDay(financeEnd).toISOString(),
      },
      financialStats: {
        pemasukan: kasPemasukan._sum.jumlah || 0,
        pengeluaran: kasPengeluaran._sum.jumlah || 0
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
