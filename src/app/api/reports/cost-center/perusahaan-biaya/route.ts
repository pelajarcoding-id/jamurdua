import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
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
    const perusahaanIdParam = searchParams.get('perusahaanId')
    const search = (searchParams.get('search') || '').trim()
    const pageRaw = Number(searchParams.get('page') || 1)
    const pageSizeRaw = Number(searchParams.get('pageSize') || 20)
    const page = Number.isFinite(pageRaw) ? Math.max(pageRaw, 1) : 1
    const pageSize = Number.isFinite(pageSizeRaw) ? Math.min(Math.max(pageSizeRaw, 1), 200) : 20

    const perusahaanId = perusahaanIdParam ? Number(perusahaanIdParam) : null

    const startYmd = range?.startYmd || monthRange!.startYmd
    const endYmd = range?.endYmd || monthRange!.endYmd
    const startKey = `${String(startYmd.y).padStart(4, '0')}-${String(startYmd.m).padStart(2, '0')}-${String(startYmd.d).padStart(2, '0')}`
    const endKey = `${String(endYmd.y).padStart(4, '0')}-${String(endYmd.m).padStart(2, '0')}-${String(endYmd.d).padStart(2, '0')}`
    const filters: any[] = [
      Prisma.sql`"date" >= ${startKey}::date`,
      Prisma.sql`"date" <= ${endKey}::date`,
    ]
    if (perusahaanId) filters.push(Prisma.sql`"perusahaanId" = ${perusahaanId}`)
    if (search) {
      const like = `%${search}%`
      filters.push(Prisma.sql`("kategori" ILIKE ${like} OR "deskripsi" ILIKE ${like} OR "type" ILIKE ${like})`)
    }
    const whereSql = Prisma.join(filters, ' AND ')

    const [countRows, sumRows, data] = await Promise.all([
      prisma.$queryRaw<Array<{ total: any }>>(Prisma.sql`
        SELECT COUNT(*)::int AS total
        FROM "PerusahaanBiaya"
        WHERE ${whereSql}
      `),
      prisma.$queryRaw<Array<{ total: any }>>(Prisma.sql`
        SELECT COALESCE(SUM("jumlah"),0) AS total
        FROM "PerusahaanBiaya"
        WHERE ${whereSql}
      `),
      prisma.$queryRaw<any>(Prisma.sql`
        SELECT pb."id", pb."perusahaanId", pb."date", pb."type", pb."kategori", pb."deskripsi", pb."jumlah", pb."gambarUrl", pb."source", pb."createdAt", pb."updatedAt",
               p."id" AS "perusahaan_id", p."name" AS "perusahaan_name"
        FROM "PerusahaanBiaya" pb
        JOIN "Perusahaan" p ON p."id" = pb."perusahaanId"
        WHERE ${whereSql}
        ORDER BY pb."date" DESC, pb."id" DESC
        LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
      `),
    ])

    const totalItems = Number(countRows?.[0]?.total || 0)
    const totalJumlah = Number(sumRows?.[0]?.total || 0)
    const rows = (Array.isArray(data) ? data : []).map((r: any) => ({
      id: r.id,
      perusahaanId: r.perusahaanId,
      date: r.date,
      type: r.type,
      kategori: r.kategori,
      deskripsi: r.deskripsi,
      jumlah: Number(r.jumlah || 0),
      gambarUrl: r.gambarUrl,
      source: r.source,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      perusahaan: { id: r.perusahaan_id, name: r.perusahaan_name },
    }))

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
    console.error('Error fetching cost-center perusahaan biaya:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
