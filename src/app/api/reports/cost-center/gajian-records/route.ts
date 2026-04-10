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
    const kebunIdParam = searchParams.get('kebunId')
    const pageRaw = Number(searchParams.get('page') || 1)
    const pageSizeRaw = Number(searchParams.get('pageSize') || 20)
    const page = Number.isFinite(pageRaw) ? Math.max(pageRaw, 1) : 1
    const pageSize = Number.isFinite(pageSizeRaw) ? Math.min(Math.max(pageSizeRaw, 1), 200) : 20

    const kebunId = kebunIdParam ? Number(kebunIdParam) : null

    const whereClause: any = {
      status: 'FINALIZED',
      createdAt: { gte: (range?.startUtc || monthRange!.startUtc), lt: (range?.endExclusiveUtc || monthRange!.endExclusiveUtc) },
      ...(kebunId ? { kebunId } : {}),
    }

    const [totalItems, rows] = await Promise.all([
      prisma.gajian.count({ where: whereClause }),
      prisma.gajian.findMany({
        where: whereClause,
        include: {
          kebun: { select: { id: true, name: true } },
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    const totalJumlahAgg = await prisma.gajian.aggregate({
      where: whereClause,
      _sum: { totalGaji: true, totalBiayaLain: true, totalPotongan: true },
    })
    const totalJumlah = totalJumlahAgg._sum.totalGaji || 0

    return NextResponse.json({
      data: rows,
      meta: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
        totalJumlah,
      },
    })
  } catch (error) {
    console.error('Error fetching cost-center gajian records:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
