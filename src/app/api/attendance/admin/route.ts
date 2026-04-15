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

async function ensureAbsensiHarianTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AbsensiHarian" (
      "id" SERIAL PRIMARY KEY,
      "kebunId" INTEGER NOT NULL,
      "karyawanId" INTEGER NOT NULL,
      "date" DATE NOT NULL,
      "jumlah" NUMERIC NOT NULL DEFAULT 0,
      "kerja" BOOLEAN NOT NULL DEFAULT FALSE,
      "libur" BOOLEAN NOT NULL DEFAULT FALSE,
      "note" TEXT,
      "jamKerja" NUMERIC,
      "ratePerJam" NUMERIC,
      "uangMakan" NUMERIC,
      "useHourly" BOOLEAN,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE ("kebunId","karyawanId","date")
    )
  `)
}

const attendanceEffectiveDateSql = (alias: string) =>
  Prisma.sql`COALESCE(${Prisma.raw(`${alias}."checkIn"`)}::date, ${Prisma.raw(`${alias}."date"`)})`

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
    const karyawanIdRaw = (searchParams.get('karyawanId') || '').trim()
    const includeKaryawan = searchParams.get('includeKaryawan') === '1'
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
        whereParts.push(Prisma.sql`${attendanceEffectiveDateSql('a')} >= to_date(${startDate}, 'YYYY-MM-DD')`)
      }
    }
    if (endDate) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
        whereParts.push(Prisma.sql`${attendanceEffectiveDateSql('a')} <= to_date(${endDate}, 'YYYY-MM-DD')`)
      }
    }

    const locationId = Number(locationIdRaw)
    if (locationIdRaw && Number.isFinite(locationId) && locationId > 0) {
      whereParts.push(Prisma.sql`ka."locationId" = ${locationId}`)
    }

    const karyawanId = Number(karyawanIdRaw)
    if (karyawanIdRaw && Number.isFinite(karyawanId) && karyawanId > 0) {
      whereParts.push(Prisma.sql`a."userId" = ${karyawanId}`)
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
          ${attendanceEffectiveDateSql('a')}::text AS "date",
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
            AND ka."startDate"::date <= ${attendanceEffectiveDateSql('a')}
            AND (ka."endDate" IS NULL OR ka."endDate"::date >= ${attendanceEffectiveDateSql('a')})
          ORDER BY ka."startDate" DESC
          LIMIT 1
        ) ka ON true
        LEFT JOIN "WorkLocation" wl ON wl."id" = ka."locationId"
        ${whereClause}
        ORDER BY ${attendanceEffectiveDateSql('a')} DESC, a."checkIn" DESC NULLS LAST, a."id" DESC
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
            AND ka."startDate"::date <= ${attendanceEffectiveDateSql('a')}
            AND (ka."endDate" IS NULL OR ka."endDate"::date >= ${attendanceEffectiveDateSql('a')})
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
            AND ka."startDate"::date <= ${attendanceEffectiveDateSql('a')}
            AND (ka."endDate" IS NULL OR ka."endDate"::date >= ${attendanceEffectiveDateSql('a')})
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

    const karyawanOptions = includeKaryawan
      ? await prisma.$queryRaw<Array<{ id: number; name: string; email: string }>>(
          Prisma.sql`
            SELECT DISTINCT
              u."id",
              u."name",
              u."email"
            FROM "AttendanceSelfie" a
            INNER JOIN "User" u ON u."id" = a."userId"
            ORDER BY u."name" ASC
          `
        )
      : []

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
      karyawanOptions,
    })
  } catch (error) {
    console.error('Error fetching admin attendance list:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK'])
    if (guard.response) return guard.response

    const { searchParams } = new URL(request.url)
    const id = Number(searchParams.get('id') || '')
    const modeRaw = String(searchParams.get('mode') || '').toLowerCase()
    const mode = modeRaw === 'in' || modeRaw === 'out' || modeRaw === 'both' ? modeRaw : null
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'ID absensi tidak valid' }, { status: 400 })
    }
    if (!mode) {
      return NextResponse.json({ error: 'Mode pembatalan tidak valid' }, { status: 400 })
    }

    await ensureAttendanceSelfieTable()
    await ensureAbsensiHarianTable()

    const existing = await (prisma as any).attendanceSelfie.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        date: true,
        checkIn: true,
        checkOut: true,
      },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Data absensi tidak ditemukan' }, { status: 404 })
    }

    const effectiveDate: Date = (existing.checkIn || existing.date) as Date

    await prisma.$transaction(async (tx) => {
      if (mode === 'both') {
        await tx.$executeRaw(
          Prisma.sql`
            UPDATE "AbsensiHarian"
            SET
              "kerja" = FALSE,
              "libur" = FALSE,
              "jumlah" = 0,
              "updatedAt" = NOW()
            WHERE "karyawanId" = ${existing.userId}
              AND "date" = ${effectiveDate}::date
          `
        )

        await (tx as any).attendanceSelfie.delete({ where: { id } })
        return
      }

      const attendanceUpdate: any = { updatedAt: new Date() }
      if (mode === 'in') {
        attendanceUpdate.checkIn = null
        attendanceUpdate.photoInUrl = null
        attendanceUpdate.latIn = null
        attendanceUpdate.longIn = null
        attendanceUpdate.locationIn = null
      }
      if (mode === 'out') {
        attendanceUpdate.checkOut = null
        attendanceUpdate.photoOutUrl = null
        attendanceUpdate.latOut = null
        attendanceUpdate.longOut = null
        attendanceUpdate.locationOut = null
      }

      const updated = await (tx as any).attendanceSelfie.update({
        where: { id },
        data: attendanceUpdate,
        select: { checkIn: true, checkOut: true, userId: true, date: true },
      })

      const stillHasCheckIn = Boolean(updated.checkIn)
      if (!stillHasCheckIn) {
        await tx.$executeRaw(
          Prisma.sql`
            UPDATE "AbsensiHarian"
            SET
              "kerja" = FALSE,
              "libur" = FALSE,
              "jumlah" = 0,
              "updatedAt" = NOW()
            WHERE "karyawanId" = ${existing.userId}
              AND "date" = ${effectiveDate}::date
          `
        )
      } else {
        await tx.$executeRaw(
          Prisma.sql`
            UPDATE "AbsensiHarian"
            SET
              "kerja" = TRUE,
              "libur" = FALSE,
              "updatedAt" = NOW()
            WHERE "karyawanId" = ${existing.userId}
              AND "date" = ${effectiveDate}::date
          `
        )
      }
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error patching admin attendance:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK'])
    if (guard.response) return guard.response

    const { searchParams } = new URL(request.url)
    const id = Number(searchParams.get('id') || '')
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'ID absensi tidak valid' }, { status: 400 })
    }

    await ensureAttendanceSelfieTable()

    const existing = await (prisma as any).attendanceSelfie.findUnique({
      where: { id },
      select: { id: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Data absensi tidak ditemukan' }, { status: 404 })
    }

    await ensureAbsensiHarianTable()

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`
          UPDATE "AbsensiHarian" ah
          SET
            "kerja" = FALSE,
            "libur" = FALSE,
            "jumlah" = 0,
            "updatedAt" = NOW()
          FROM "AttendanceSelfie" a
          WHERE a."id" = ${id}
            AND ah."karyawanId" = a."userId"
            AND ah."date" = COALESCE(a."checkIn"::date, a."date")
        `
      )

      await (tx as any).attendanceSelfie.delete({
        where: { id },
      })
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error deleting admin attendance:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
