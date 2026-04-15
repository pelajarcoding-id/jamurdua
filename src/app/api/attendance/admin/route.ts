import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/route-auth'

export const dynamic = 'force-dynamic'

async function ensureAttendanceSelfieTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AttendanceSelfie" (
      "id" SERIAL PRIMARY KEY,
      "userId" INTEGER NOT NULL,
      "date" DATE NOT NULL,
      "checkIn" TIMESTAMP(3),
      "checkOut" TIMESTAMP(3),
      "photoInUrl" TEXT,
      "photoOutUrl" TEXT,
      "latIn" DOUBLE PRECISION,
      "longIn" DOUBLE PRECISION,
      "latOut" DOUBLE PRECISION,
      "longOut" DOUBLE PRECISION,
      "locationIn" TEXT,
      "locationOut" TEXT,
      "status" TEXT NOT NULL DEFAULT 'HADIR',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "AttendanceSelfie_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
    );
  `)
}

export async function GET(request: Request) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR'])
    if (guard.response) return guard.response

    await ensureAttendanceSelfieTable()

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, Number(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || '10')))
    const search = (searchParams.get('search') || '').trim()
    const startDate = (searchParams.get('startDate') || '').trim()
    const endDate = (searchParams.get('endDate') || '').trim()
    const locationIdRaw = (searchParams.get('locationId') || '').trim()
    const skip = (page - 1) * limit

    const whereParts: Prisma.Sql[] = []

    if (search) {
      const like = `%${search}%`
      whereParts.push(
        Prisma.sql`(
          u.name ILIKE ${like}
          OR u.email ILIKE ${like}
          OR COALESCE(wl.name, '') ILIKE ${like}
          OR CAST(a."userId" AS TEXT) ILIKE ${like}
        )`
      )
    }

    if (startDate) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
        whereParts.push(Prisma.sql`COALESCE(a."checkIn"::date, a."date") >= to_date(${startDate}, 'YYYY-MM-DD')`)
      }
    }
    if (endDate) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
        whereParts.push(Prisma.sql`COALESCE(a."checkIn"::date, a."date") <= to_date(${endDate}, 'YYYY-MM-DD')`)
      }
    }

    const locationId = Number(locationIdRaw)
    if (locationIdRaw && Number.isFinite(locationId) && locationId > 0) {
      whereParts.push(Prisma.sql`ka."locationId" = ${locationId}`)
    }

    const whereClause = whereParts.length
      ? Prisma.sql`WHERE ${Prisma.join(whereParts, ' AND ')}`
      : Prisma.empty

    const rows = await prisma.$queryRaw<Array<{
      id: number
      userId: number
      userName: string
      userEmail: string
      locationId: number | null
      locationName: string | null
      locationType: string | null
      date: string
      checkIn: Date | null
      checkOut: Date | null
      photoInUrl: string | null
      photoOutUrl: string | null
      latIn: number | null
      longIn: number | null
      latOut: number | null
      longOut: number | null
      locationIn: string | null
      locationOut: string | null
      status: string
      createdAt: Date
      updatedAt: Date
    }>>(
      Prisma.sql`
        SELECT
          a."id",
          a."userId",
          u."name" AS "userName",
          u."email" AS "userEmail",
          ka."locationId" AS "locationId",
          wl."name" AS "locationName",
          wl."type" AS "locationType",
          COALESCE(a."checkIn"::date, a."date")::text AS "date",
          a."checkIn",
          a."checkOut",
          a."photoInUrl",
          a."photoOutUrl",
          a."latIn",
          a."longIn",
          a."latOut",
          a."longOut",
          a."locationIn",
          a."locationOut",
          a."status",
          a."createdAt",
          a."updatedAt"
        FROM "AttendanceSelfie" a
        INNER JOIN "User" u ON u."id" = a."userId"
        LEFT JOIN LATERAL (
          SELECT ka."locationId"
          FROM "KaryawanAssignment" ka
          WHERE ka."userId" = a."userId"
            AND ka."status" = 'AKTIF'
            AND ka."startDate"::date <= COALESCE(a."checkIn"::date, a."date")
            AND (ka."endDate" IS NULL OR ka."endDate"::date >= COALESCE(a."checkIn"::date, a."date"))
          ORDER BY ka."startDate" DESC
          LIMIT 1
        ) ka ON true
        LEFT JOIN "WorkLocation" wl ON wl."id" = ka."locationId"
        ${whereClause}
        ORDER BY COALESCE(a."checkIn"::date, a."date") DESC, a."checkIn" DESC NULLS LAST, a."id" DESC
        LIMIT ${limit}
        OFFSET ${skip}
      `
    )

    const totalRows = await prisma.$queryRaw<Array<{ total: bigint | number }>>(
      Prisma.sql`
        SELECT COUNT(*)::bigint AS total
        FROM "AttendanceSelfie" a
        INNER JOIN "User" u ON u."id" = a."userId"
        LEFT JOIN LATERAL (
          SELECT ka."locationId"
          FROM "KaryawanAssignment" ka
          WHERE ka."userId" = a."userId"
            AND ka."status" = 'AKTIF'
            AND ka."startDate"::date <= COALESCE(a."checkIn"::date, a."date")
            AND (ka."endDate" IS NULL OR ka."endDate"::date >= COALESCE(a."checkIn"::date, a."date"))
          ORDER BY ka."startDate" DESC
          LIMIT 1
        ) ka ON true
        LEFT JOIN "WorkLocation" wl ON wl."id" = ka."locationId"
        ${whereClause}
      `
    )

    const summaryRows = await prisma.$queryRaw<Array<{
      totalKaryawanAbsen: bigint | number
      totalMasuk: bigint | number
      totalPulang: bigint | number
    }>>(
      Prisma.sql`
        SELECT
          COUNT(DISTINCT a."userId")::bigint AS "totalKaryawanAbsen",
          COUNT(*) FILTER (WHERE a."checkIn" IS NOT NULL)::bigint AS "totalMasuk",
          COUNT(*) FILTER (WHERE a."checkOut" IS NOT NULL)::bigint AS "totalPulang"
        FROM "AttendanceSelfie" a
        INNER JOIN "User" u ON u."id" = a."userId"
        LEFT JOIN LATERAL (
          SELECT ka."locationId"
          FROM "KaryawanAssignment" ka
          WHERE ka."userId" = a."userId"
            AND ka."status" = 'AKTIF'
            AND ka."startDate"::date <= COALESCE(a."checkIn"::date, a."date")
            AND (ka."endDate" IS NULL OR ka."endDate"::date >= COALESCE(a."checkIn"::date, a."date"))
          ORDER BY ka."startDate" DESC
          LIMIT 1
        ) ka ON true
        LEFT JOIN "WorkLocation" wl ON wl."id" = ka."locationId"
        ${whereClause}
      `
    )

    const total = Number(totalRows?.[0]?.total || 0)
    const summary = summaryRows?.[0] || {
      totalKaryawanAbsen: 0,
      totalMasuk: 0,
      totalPulang: 0,
    }

    return NextResponse.json({
      data: rows,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      summary: {
        totalKaryawanAbsen: Number(summary.totalKaryawanAbsen || 0),
        totalMasuk: Number(summary.totalMasuk || 0),
        totalPulang: Number(summary.totalPulang || 0),
      },
    })
  } catch (error) {
    console.error('Error fetching admin attendance list:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
