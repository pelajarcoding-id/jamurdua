import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getWibMonthRangeUtc, getWibRangeUtcFromParams } from '@/lib/wib'

export const dynamic = 'force-dynamic'

function defaultMonthKey() {
  const wib = new Date(Date.now() + 7 * 60 * 60 * 1000)
  const y = wib.getUTCFullYear()
  const m = String(wib.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const range = getWibRangeUtcFromParams(searchParams)
    const monthRange = range ? null : getWibMonthRangeUtc(searchParams.get('month') || defaultMonthKey())
    if (!range && !monthRange) return NextResponse.json({ error: 'month tidak valid' }, { status: 400 })
    const startUtc = range?.startUtc || monthRange!.startUtc
    const endExclusiveUtc = range?.endExclusiveUtc || monthRange!.endExclusiveUtc
    const kebunIdParam = searchParams.get('kebunId')
    const kebunId = kebunIdParam ? Number(kebunIdParam) : null

    const kebuns = await prisma.kebun.findMany({
      where: kebunId ? { id: kebunId } : undefined,
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })

    const rows = await Promise.all(
      kebuns.map(async (k) => {
        const notas = await prisma.notaSawit.findMany({
          where: {
            deletedAt: null,
            tanggalBongkar: { gte: startUtc, lt: endExclusiveUtc },
            AND: [{ OR: [{ kebunId: k.id }, { timbangan: { kebunId: k.id } }] }],
          },
          select: { kendaraanPlatNomor: true, totalPembayaran: true },
        })

        const totalTrips = notas.length
        const income = notas.reduce((acc, n) => acc + (n.totalPembayaran || 0), 0)

        const [kasAgg, uangJalanAgg, gajiAgg] = await Promise.all([
          prisma.kasTransaksi.aggregate({
            where: {
              deletedAt: null,
              tipe: 'PENGELUARAN',
              kebunId: k.id,
              OR: [{ kategori: { not: 'GAJI' } }, { kategori: null }],
              date: { gte: startUtc, lt: endExclusiveUtc },
            },
            _sum: { jumlah: true },
          }),
          prisma.uangJalan.aggregate({
            where: {
              deletedAt: null,
              tipe: 'PENGELUARAN',
              description: { contains: `[KEBUN:${k.id}]` },
              sesiUangJalan: { deletedAt: null },
              date: { gte: startUtc, lt: endExclusiveUtc },
            } as any,
            _sum: { amount: true },
          }),
          prisma.gajian.aggregate({
            where: {
              kebunId: k.id,
              status: 'FINALIZED',
              createdAt: { gte: startUtc, lt: endExclusiveUtc },
            },
            _sum: { totalGaji: true, totalBiayaLain: true, totalPotongan: true },
          }),
        ])

        const kasCost = kasAgg._sum.jumlah || 0
        const uangJalanCost = uangJalanAgg._sum.amount || 0
        const gajiCost = gajiAgg._sum.totalGaji || 0
        const totalCost = kasCost + uangJalanCost + gajiCost
        const grossProfit = income - totalCost

        return {
          kebunId: k.id,
          kebunName: k.name,
          totalTrips,
          kasCost,
          uangJalanCost,
          gajiCost,
          totalCost,
          income,
          grossProfit,
        }
      })
    )

    return NextResponse.json(rows)
  } catch (error) {
    console.error('Error fetching cost-center by kebun report:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
