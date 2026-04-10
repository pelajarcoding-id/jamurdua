import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { getWibMonthRangeUtc } from '@/lib/wib'

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
    const monthRange = getWibMonthRangeUtc(searchParams.get('month') || defaultMonthKey())
    if (!monthRange) return NextResponse.json({ error: 'month tidak valid' }, { status: 400 })
    const perusahaanIdParam = searchParams.get('perusahaanId')
    const perusahaanId = perusahaanIdParam ? Number(perusahaanIdParam) : null

    const perusahaans: Array<{ id: number; name: string }> = await (prisma as any).perusahaan.findMany({
      where: perusahaanId ? { id: perusahaanId } : undefined,
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })

    const rows = await Promise.all(
      perusahaans.map(async (p) => {
        const notas = await prisma.notaSawit.findMany({
          where: {
            perusahaanId: p.id,
            createdAt: { gte: monthRange.startUtc, lt: monthRange.endExclusiveUtc },
          },
          select: { kendaraanPlatNomor: true, totalPembayaran: true },
        })

        const totalTrips = notas.length
        const income = notas.reduce((acc, n) => acc + (n.totalPembayaran || 0), 0)
        const biayaManual = await (async () => {
          try {
            const rows: Array<{ total: any }> = await prisma.$queryRaw(
              Prisma.sql`SELECT COALESCE(SUM("jumlah"),0) AS total
                         FROM "PerusahaanBiaya"
                         WHERE "perusahaanId" = ${p.id}
                           AND "date" >= ${monthRange.startKey}::date
                           AND "date" <= ${monthRange.endKey}::date`
            )
            const total = rows?.[0]?.total
            return Number(total || 0)
          } catch {
            return 0
          }
        })()

        const totalCost = biayaManual
        const grossProfit = income - totalCost

        return {
          perusahaanId: p.id,
          perusahaanName: p.name,
          totalTrips,
          biayaManual,
          totalCost,
          income,
          grossProfit,
        }
      })
    )

    return NextResponse.json(rows)
  } catch (error) {
    console.error('Error fetching cost-center by perusahaan report:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
