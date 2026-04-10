import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { parseWibYmd } from '@/lib/wib'

export const dynamic = 'force-dynamic'

const ensureTable = async () => {
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
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE ("kebunId","karyawanId","date")
    )
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AbsensiGajiHarian" (
      "id" SERIAL PRIMARY KEY,
      "kebunId" INTEGER NOT NULL,
      "karyawanId" INTEGER NOT NULL,
      "date" DATE NOT NULL,
      "jumlah" NUMERIC NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE ("kebunId","karyawanId","date")
    )
  `)
}

export async function GET(request: Request) {
  try {
    await ensureTable()
    const { searchParams } = new URL(request.url)
    const kebunIdParam = searchParams.get('kebunId')
    const jobTypeParam = searchParams.get('jobType')
    const karyawanIdParam = searchParams.get('karyawanId')
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')
    const statusParam = searchParams.get('status')

    const startYmd = parseWibYmd(startDateParam)
    const endYmd = parseWibYmd(endDateParam)
    const startKey = startYmd ? `${String(startYmd.y).padStart(4, '0')}-${String(startYmd.m).padStart(2, '0')}-${String(startYmd.d).padStart(2, '0')}` : null
    const endKey = endYmd ? `${String(endYmd.y).padStart(4, '0')}-${String(endYmd.m).padStart(2, '0')}-${String(endYmd.d).padStart(2, '0')}` : null

    const kebunId = kebunIdParam ? Number(kebunIdParam) : null
    if (kebunIdParam && Number.isNaN(kebunId)) {
      return NextResponse.json({ error: 'kebunId tidak valid' }, { status: 400 })
    }
    const karyawanId = karyawanIdParam ? Number(karyawanIdParam) : null
    if (karyawanIdParam && Number.isNaN(karyawanId)) {
      return NextResponse.json({ error: 'karyawanId tidak valid' }, { status: 400 })
    }

    // Cek apakah kolom jobType ada di database melalui information_schema
    let hasJobTypeColumn = false
    try {
      const colCheck = await prisma.$queryRaw<Array<{ column_name: string }>>`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'User' AND column_name = 'jobType'
      `
      hasJobTypeColumn = colCheck.length > 0
    } catch (e) {
      hasJobTypeColumn = false
    }

    const gajiPaidFilters: Prisma.Sql[] = [Prisma.sql`1=1`]
    if (kebunId) {
      gajiPaidFilters.push(Prisma.sql`a."kebunId" = ${kebunId}`)
    }
    if (karyawanId) {
      gajiPaidFilters.push(Prisma.sql`a."karyawanId" = ${karyawanId}`)
    }
    if (startKey) {
      gajiPaidFilters.push(Prisma.sql`a."date" >= ${startKey}::DATE`)
    }
    if (endKey) {
      gajiPaidFilters.push(Prisma.sql`a."date" <= ${endKey}::DATE`)
    }
    if (jobTypeParam && jobTypeParam !== 'all' && hasJobTypeColumn) {
      if (jobTypeParam === 'KEBUN') {
        gajiPaidFilters.push(Prisma.sql`(u."jobType" ILIKE ${`%KEBUN%`} OR (u."jobType" IS NULL AND u."kebunId" IS NOT NULL))`)
      } else {
        gajiPaidFilters.push(Prisma.sql`u."jobType" ILIKE ${`%${jobTypeParam}%`}`)
      }
    } else if (jobTypeParam === 'KEBUN' && !hasJobTypeColumn) {
      gajiPaidFilters.push(Prisma.sql`u."kebunId" IS NOT NULL`)
    }
    if (statusParam && statusParam !== 'all') {
      if (statusParam.toUpperCase() === 'AKTIF') {
        gajiPaidFilters.push(Prisma.sql`(u."status" IS NULL OR u."status" IN ('AKTIF', 'Aktif'))`)
      } else if (statusParam.toUpperCase() === 'NONAKTIF') {
        gajiPaidFilters.push(Prisma.sql`u."status" IN ('NONAKTIF', 'Nonaktif')`)
      } else {
        gajiPaidFilters.push(Prisma.sql`u."status" ILIKE ${statusParam}`)
      }
    }
    const gajiPaidWhere = Prisma.join(gajiPaidFilters, ' AND ')

    const selectJobTypeSql = hasJobTypeColumn 
      ? Prisma.sql`COALESCE(u."jobType", 'LAIN') as "jobType"`
      : Prisma.sql`'LAIN' as "jobType"`

    const gajiPaidRows = await prisma.$queryRaw<Array<{ jobType: string | null; total: number }>>(Prisma.sql`
      SELECT ${selectJobTypeSql}, SUM(a."jumlah") as "total"
      FROM "AbsensiGajiHarian" a
      JOIN "User" u ON u.id = a."karyawanId"
      WHERE ${gajiPaidWhere}
      GROUP BY 1
      ORDER BY 1
    `)
    const totalPaid = gajiPaidRows.reduce((acc, r) => acc + (Number(r.total) || 0), 0)

    const gajiUnpaidFilters: Prisma.Sql[] = [Prisma.sql`1=1`]
    if (kebunId) {
      gajiUnpaidFilters.push(Prisma.sql`a."kebunId" = ${kebunId}`)
    }
    if (karyawanId) {
      gajiUnpaidFilters.push(Prisma.sql`a."karyawanId" = ${karyawanId}`)
    }
    if (startKey) {
      gajiUnpaidFilters.push(Prisma.sql`a."date" >= ${startKey}::DATE`)
    }
    if (endKey) {
      gajiUnpaidFilters.push(Prisma.sql`a."date" <= ${endKey}::DATE`)
    }
    if (jobTypeParam && jobTypeParam !== 'all' && hasJobTypeColumn) {
      if (jobTypeParam === 'KEBUN') {
        gajiUnpaidFilters.push(Prisma.sql`(u."jobType" ILIKE ${`%KEBUN%`} OR (u."jobType" IS NULL AND u."kebunId" IS NOT NULL))`)
      } else {
        gajiUnpaidFilters.push(Prisma.sql`u."jobType" ILIKE ${`%${jobTypeParam}%`}`)
      }
    } else if (jobTypeParam === 'KEBUN' && !hasJobTypeColumn) {
      gajiUnpaidFilters.push(Prisma.sql`u."kebunId" IS NOT NULL`)
    }
    if (statusParam && statusParam !== 'all') {
      if (statusParam.toUpperCase() === 'AKTIF') {
        gajiUnpaidFilters.push(Prisma.sql`(u."status" IS NULL OR u."status" IN ('AKTIF', 'Aktif'))`)
      } else if (statusParam.toUpperCase() === 'NONAKTIF') {
        gajiUnpaidFilters.push(Prisma.sql`u."status" IN ('NONAKTIF', 'Nonaktif')`)
      } else {
        gajiUnpaidFilters.push(Prisma.sql`u."status" ILIKE ${statusParam}`)
      }
    }
    const gajiUnpaidWhere = Prisma.join(gajiUnpaidFilters, ' AND ')

    const gajiUnpaidRows = await prisma.$queryRaw<Array<{ jobType: string | null; total: number }>>(Prisma.sql`
      SELECT ${selectJobTypeSql}, SUM(a."jumlah") as "total"
      FROM "AbsensiHarian" a
      LEFT JOIN "AbsensiGajiHarian" p
        ON p."kebunId" = a."kebunId"
       AND p."karyawanId" = a."karyawanId"
       AND p."date" = a."date"
      JOIN "User" u ON u.id = a."karyawanId"
      WHERE ${gajiUnpaidWhere}
        AND a."jumlah" > 0
        AND p."id" IS NULL
      GROUP BY 1
      ORDER BY 1
    `)
    const totalUnpaid = gajiUnpaidRows.reduce((acc, r) => acc + (Number(r.total) || 0), 0)

    const paidMap = new Map(gajiPaidRows.map(r => [r.jobType || 'LAIN', Number(r.total) || 0]))
    const unpaidMap = new Map(gajiUnpaidRows.map(r => [r.jobType || 'LAIN', Number(r.total) || 0]))
    const jobTypes = Array.from(new Set([...paidMap.keys(), ...unpaidMap.keys()]))
    const gajiByJobType = jobTypes.map(jobType => ({
      jobType,
      total: (paidMap.get(jobType) || 0) + (unpaidMap.get(jobType) || 0),
    }))
    const totalGaji = totalPaid + totalUnpaid

    const hutangFilters: Prisma.Sql[] = [
      Prisma.sql`k."kategori" IN ('HUTANG_KARYAWAN','PEMBAYARAN_HUTANG')`,
      Prisma.sql`k."deletedAt" IS NULL`,
      Prisma.sql`k."karyawanId" IS NOT NULL`,
    ]
    if (kebunId) {
      hutangFilters.push(Prisma.sql`k."kebunId" = ${kebunId}`)
    }
    if (karyawanId) {
      hutangFilters.push(Prisma.sql`k."karyawanId" = ${karyawanId}`)
    }
    if (jobTypeParam && jobTypeParam !== 'all' && hasJobTypeColumn) {
      if (jobTypeParam === 'KEBUN') {
        hutangFilters.push(Prisma.sql`(u."jobType" ILIKE ${`%KEBUN%`} OR (u."jobType" IS NULL AND u."kebunId" IS NOT NULL))`)
      } else {
        hutangFilters.push(Prisma.sql`u."jobType" ILIKE ${`%${jobTypeParam}%`}`)
      }
    } else if (jobTypeParam === 'KEBUN' && !hasJobTypeColumn) {
      hutangFilters.push(Prisma.sql`u."kebunId" IS NOT NULL`)
    }
    if (statusParam && statusParam !== 'all') {
      if (statusParam.toUpperCase() === 'AKTIF') {
        hutangFilters.push(Prisma.sql`(u."status" IS NULL OR u."status" IN ('AKTIF', 'Aktif'))`)
      } else if (statusParam.toUpperCase() === 'NONAKTIF') {
        hutangFilters.push(Prisma.sql`u."status" IN ('NONAKTIF', 'Nonaktif')`)
      } else {
        hutangFilters.push(Prisma.sql`u."status" ILIKE ${statusParam}`)
      }
    }
    const hutangWhere = Prisma.join(hutangFilters, ' AND ')

    const hutangRows = await prisma.$queryRaw<Array<{ jobType: string | null; hutang: number; pembayaran: number }>>(Prisma.sql`
      SELECT ${selectJobTypeSql},
             SUM(CASE WHEN k."kategori" = 'HUTANG_KARYAWAN' THEN k."jumlah" ELSE 0 END) as "hutang",
             SUM(CASE WHEN k."kategori" = 'PEMBAYARAN_HUTANG' THEN k."jumlah" ELSE 0 END) as "pembayaran"
      FROM "KasTransaksi" k
      JOIN "User" u ON u.id = k."karyawanId"
      WHERE ${hutangWhere}
      GROUP BY 1
      ORDER BY 1
    `)

    const hutangByJobType = hutangRows.map(r => ({
      jobType: r.jobType || 'LAIN',
      hutang: Number(r.hutang) || 0,
      pembayaran: Number(r.pembayaran) || 0,
      saldo: (Number(r.hutang) || 0) - (Number(r.pembayaran) || 0),
    }))
    const totalHutang = hutangByJobType.reduce((acc, r) => acc + r.saldo, 0)

    // Hitung total karyawan yang memenuhi filter
    const userFilters: Prisma.Sql[] = [Prisma.sql`u."role" NOT IN ('ADMIN', 'PEMILIK')`]
    if (kebunId) {
      userFilters.push(Prisma.sql`u."kebunId" = ${kebunId}`)
    }
    if (jobTypeParam && jobTypeParam !== 'all' && hasJobTypeColumn) {
      if (jobTypeParam === 'KEBUN') {
        userFilters.push(Prisma.sql`(u."jobType" ILIKE ${`%KEBUN%`} OR (u."jobType" IS NULL AND u."kebunId" IS NOT NULL))`)
      } else {
        userFilters.push(Prisma.sql`u."jobType" ILIKE ${`%${jobTypeParam}%`}`)
      }
    } else if (jobTypeParam === 'KEBUN' && !hasJobTypeColumn) {
      userFilters.push(Prisma.sql`u."kebunId" IS NOT NULL`)
    }
    if (statusParam && statusParam !== 'all') {
      if (statusParam.toUpperCase() === 'AKTIF') {
        userFilters.push(Prisma.sql`(u."status" IS NULL OR u."status" IN ('AKTIF', 'Aktif'))`)
      } else if (statusParam.toUpperCase() === 'NONAKTIF') {
        userFilters.push(Prisma.sql`u."status" IN ('NONAKTIF', 'Nonaktif')`)
      } else {
        userFilters.push(Prisma.sql`u."status" ILIKE ${statusParam}`)
      }
    }
    const userWhereSql = Prisma.join(userFilters, ' AND ')
    const userCountRow = await prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
      SELECT COUNT(*)::INT as "count" FROM "User" u WHERE ${userWhereSql}
    `)
    const totalKaryawan = userCountRow[0]?.count || 0

    return NextResponse.json({
      totalKaryawan,
      gaji: {
        total: totalGaji,
        paid: totalPaid,
        unpaid: totalUnpaid,
        byJobType: gajiByJobType,
      },
      hutang: {
        total: totalHutang,
        byJobType: hutangByJobType,
      },
    })
  } catch (error) {
    console.error('GET /api/karyawan-kebun/summary error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
