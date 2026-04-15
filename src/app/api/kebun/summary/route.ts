import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/route-auth'
import { getAccessibleKebunIds } from '@/lib/kebun-access'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const search = (searchParams.get('search') || '').trim()
  const startDateParam = searchParams.get('startDate')
  const endDateParam = searchParams.get('endDate')

  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR', 'MANDOR', 'MANAGER'])
    if (guard.response) return guard.response
    const ids = await getAccessibleKebunIds(guard.id, guard.role)

    const whereClause: any = { AND: [] }

    if (ids !== null) {
      whereClause.AND.push({ id: { in: ids.length > 0 ? ids : [-1] } })
    }

    if (search) {
      const or: any[] = [
        { name: { contains: search, mode: 'insensitive' } },
        { location: { contains: search, mode: 'insensitive' } },
      ]
      const isNumeric = /^\d+$/.test(search)
      if (isNumeric) {
        const like = `%${search}%`
        const idsRows: Array<{ id: number }> = await prisma.$queryRaw(
          Prisma.sql`SELECT k.id FROM "Kebun" k WHERE CAST(k.id AS TEXT) ILIKE ${like}`
        )
        const numericIds = idsRows.map(r => r.id)
        if (numericIds.length > 0) {
          or.push({ id: { in: numericIds } })
        }
      }
      whereClause.AND.push({ OR: or })
    }

    const kebunRows = await prisma.kebun.findMany({
      where: whereClause,
      select: { id: true, name: true },
      orderBy: { id: 'desc' },
    })
    const kebunIds = kebunRows.map(k => k.id)

    if (kebunIds.length === 0) {
      return NextResponse.json({
        totalProduksi: 0,
        totalBeratAkhir: 0,
        totalBayarNet: 0,
        totalBiaya: 0,
        produksiPerKebun: [],
      })
    }

    const startDate = startDateParam ? new Date(startDateParam) : undefined
    const endDate = endDateParam ? new Date(endDateParam) : undefined
    if (endDate) {
      endDate.setHours(23, 59, 59, 999)
    }

    const notaWhere: Prisma.NotaSawitWhereInput = {
      kebunId: { in: kebunIds },
      ...(startDate || endDate
        ? {
            tanggalBongkar: {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {}),
            },
          }
        : {}),
    }

    const [totalProduksiAgg, totalBayarNetAgg, produksiRows] = await Promise.all([
      prisma.notaSawit.aggregate({
        where: notaWhere,
        _sum: { beratAkhir: true },
      }),
      prisma.notaSawit.aggregate({
        where: notaWhere,
        _sum: { pembayaranSetelahPph: true },
      }),
      prisma.notaSawit.groupBy({
        by: ['kebunId'],
        where: notaWhere,
        _sum: { beratAkhir: true },
      }),
    ])

    const kebunMap = new Map(kebunRows.map(k => [k.id, k.name]))
    const produksiPerKebun = produksiRows
      .filter(row => typeof row.kebunId === 'number')
      .map(row => ({
        kebunId: row.kebunId as number,
        kebunName: kebunMap.get(row.kebunId as number) || `Kebun ${row.kebunId}`,
        totalBeratAkhir: Number(row._sum.beratAkhir || 0),
      }))
      .sort((a, b) => b.totalBeratAkhir - a.totalBeratAkhir)

    const totalBeratAkhir = Number(totalProduksiAgg._sum.beratAkhir || 0)
    const totalBayarNet = Number(totalBayarNetAgg._sum.pembayaranSetelahPph || 0)

    return NextResponse.json({
      totalProduksi: totalBeratAkhir,
      totalBeratAkhir,
      totalBayarNet,
      totalBiaya: totalBayarNet,
      produksiPerKebun,
    })
  } catch (error) {
    console.error('Error fetching kebun summary:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
