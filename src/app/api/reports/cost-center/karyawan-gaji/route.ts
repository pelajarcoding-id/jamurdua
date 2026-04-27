import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { getWibMonthRangeUtc, getWibRangeUtcFromParams, parseWibYmd, wibEndUtcInclusive, wibStartUtc } from '@/lib/wib'
 
export const dynamic = 'force-dynamic'
 
function defaultMonthKey() {
  const wib = new Date(Date.now() + 7 * 60 * 60 * 1000)
  const y = wib.getUTCFullYear()
  const m = String(wib.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}
 
const ensureTable = async () => {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AbsensiGajiHarian" (
      "id" SERIAL PRIMARY KEY,
      "kebunId" INTEGER NOT NULL,
      "karyawanId" INTEGER NOT NULL,
      "date" DATE NOT NULL,
      "jumlah" NUMERIC NOT NULL DEFAULT 0,
      "gajianId" INTEGER,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE ("kebunId","karyawanId","date")
    )
  `)
  await prisma.$executeRawUnsafe(`ALTER TABLE "AbsensiGajiHarian" ADD COLUMN IF NOT EXISTS "gajianId" INTEGER`)
}
 
const dateToWibKey = (d: Date) => {
  const wib = new Date(d.getTime() + 7 * 60 * 60 * 1000)
  const y = wib.getUTCFullYear()
  const m = String(wib.getUTCMonth() + 1).padStart(2, '0')
  const day = String(wib.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
 
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const mode = (searchParams.get('mode') || '').trim().toLowerCase()
 
    const range = getWibRangeUtcFromParams(searchParams)
    const monthRange = range ? null : getWibMonthRangeUtc(searchParams.get('month') || defaultMonthKey())
    if (!range && !monthRange) return NextResponse.json({ error: 'month tidak valid' }, { status: 400 })
 
    const startUtc = range?.startUtc || monthRange!.startUtc
    const endExclusiveUtc = range?.endExclusiveUtc || monthRange!.endExclusiveUtc
 
    const kebunIdParam = searchParams.get('kebunId')
    const kebunId = kebunIdParam ? Number(kebunIdParam) : null
    const searchLower = (searchParams.get('search') || '').trim().toLowerCase()
 
    const pageRaw = Number(searchParams.get('page') || 1)
    const pageSizeRaw = Number(searchParams.get('pageSize') || searchParams.get('limit') || 20)
    const page = Number.isFinite(pageRaw) ? Math.max(pageRaw, 1) : 1
    const pageSize = Number.isFinite(pageSizeRaw) ? Math.min(Math.max(pageSizeRaw, 1), 200) : 20
 
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')
    const startYmd = startDateParam ? parseWibYmd(startDateParam) : null
    const endYmd = endDateParam ? parseWibYmd(endDateParam) : null
 
    const startKey = startYmd ? `${String(startYmd.y).padStart(4, '0')}-${String(startYmd.m).padStart(2, '0')}-${String(startYmd.d).padStart(2, '0')}` : dateToWibKey(startUtc)
    const endKey = endYmd
      ? `${String(endYmd.y).padStart(4, '0')}-${String(endYmd.m).padStart(2, '0')}-${String(endYmd.d).padStart(2, '0')}`
      : dateToWibKey(new Date(endExclusiveUtc.getTime() - 1))
 
    const startUtcFinal = startYmd ? wibStartUtc(startYmd) : startUtc
    const endUtcFinal = endYmd ? wibEndUtcInclusive(endYmd) : new Date(endExclusiveUtc.getTime() - 1)

    if (mode === 'tag_biaya' || mode === 'tag') {
      const kasAgg = await prisma.kasTransaksi.groupBy({
        by: ['karyawanId'],
        where: {
          deletedAt: null,
          tipe: 'PENGELUARAN',
          karyawanId: { not: null },
          ...(kebunId ? { kebunId } : {}),
          date: { gte: startUtcFinal, lte: endUtcFinal },
          AND: [
            {
              OR: [{ kategori: { not: 'GAJI' } }, { kategori: null }],
            },
          ],
        } as any,
        _sum: { jumlah: true },
      } as any)

      const uangJalanAgg = await prisma.$queryRaw<
        Array<{ karyawanId: number; total: any }>
      >(
        Prisma.sql`
          SELECT (regexp_match(uj."description", '\\[KARYAWAN:(\\d+)\\]'))[1]::INT AS "karyawanId",
                 COALESCE(SUM(uj."amount"),0) AS total
          FROM "UangJalan" uj
          JOIN "SesiUangJalan" sj
            ON sj."id" = uj."sesiUangJalanId"
           AND sj."deletedAt" IS NULL
          WHERE uj."deletedAt" IS NULL
            AND uj."tipe" = 'PENGELUARAN'
            AND uj."date" >= ${startUtcFinal}
            AND uj."date" <= ${endUtcFinal}
            AND uj."description" ~ '\\[KARYAWAN:(\\d+)\\]'
            ${kebunId ? Prisma.sql`AND uj."description" LIKE ${`%[KEBUN:${kebunId}]%`}` : Prisma.empty}
          GROUP BY 1
        `
      )

      const kasMap = new Map<number, number>(
        (kasAgg as any[]).map((r: any) => [Number(r.karyawanId), Number(r._sum?.jumlah) || 0])
      )
      const uangJalanMap = new Map<number, number>(
        (uangJalanAgg || []).map((r) => [Number(r.karyawanId), Number(r.total) || 0])
      )

      const karyawanIds = Array.from(new Set<number>([...kasMap.keys(), ...uangJalanMap.keys()]))
      const users = karyawanIds.length
        ? await prisma.user.findMany({
            where: { id: { in: karyawanIds } },
            select: { id: true, name: true },
          })
        : []
      const nameMap = new Map(users.map((u) => [u.id, u.name]))

      const allRows = karyawanIds
        .map((idNum) => {
          const kasTotal = kasMap.get(idNum) || 0
          const uangJalanTotal = uangJalanMap.get(idNum) || 0
          return {
            karyawanId: idNum,
            karyawanName: nameMap.get(idNum) || `Karyawan #${idNum}`,
            kasTotal,
            uangJalanTotal,
            total: kasTotal + uangJalanTotal,
          }
        })
        .sort((a, b) => a.karyawanName.localeCompare(b.karyawanName))

      const filteredRows = searchLower
        ? allRows.filter((r) => {
            if (String(r.karyawanId) === searchLower) return true
            return String(r.karyawanName || '').toLowerCase().includes(searchLower)
          })
        : allRows

      const totalItems = filteredRows.length
      const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
      const startIdx = (page - 1) * pageSize
      const paged = filteredRows.slice(startIdx, startIdx + pageSize)

      const sumKas = filteredRows.reduce((acc, r) => acc + (Number(r.kasTotal) || 0), 0)
      const sumUangJalan = filteredRows.reduce((acc, r) => acc + (Number(r.uangJalanTotal) || 0), 0)
      const sumTotal = filteredRows.reduce((acc, r) => acc + (Number(r.total) || 0), 0)

      return NextResponse.json({
        data: paged,
        meta: {
          mode: 'tag_biaya',
          page,
          pageSize,
          totalItems,
          totalPages,
          startDate: startKey,
          endDate: endKey,
          sumKas,
          sumUangJalan,
          sumTotal,
        },
      })
    }

    await ensureTable()
 
    const berjalanAgg: Array<{ karyawanId: number; total: any }> = await prisma.$queryRaw(
      Prisma.sql`SELECT "karyawanId",
                        COALESCE(SUM("jumlah"),0) AS total
                 FROM "AbsensiGajiHarian"
                 WHERE "date" >= ${startKey}::DATE
                   AND "date" <= ${endKey}::DATE
                   ${kebunId ? Prisma.sql`AND "kebunId" = ${kebunId}` : Prisma.empty}
                 GROUP BY "karyawanId"`
    )
 
    const dibayar = await prisma.kasTransaksi.groupBy({
      by: ['karyawanId'],
      where: {
        deletedAt: null,
        tipe: 'PENGELUARAN',
        kategori: 'GAJI',
        karyawanId: { not: null },
        ...(kebunId ? { kebunId } : {}),
        date: { gte: startUtcFinal, lte: endUtcFinal },
      } as any,
      _sum: { jumlah: true },
    } as any)
 
    const berjalanMap = new Map<number, number>(berjalanAgg.map((r) => [Number(r.karyawanId), Number(r.total) || 0]))
    const dibayarMap = new Map<number, number>((dibayar as any[]).map((r: any) => [Number(r.karyawanId), Number(r._sum?.jumlah) || 0]))
 
    const karyawanIds = Array.from(new Set<number>([...berjalanMap.keys(), ...dibayarMap.keys()]))
    const users = karyawanIds.length
      ? await prisma.user.findMany({
          where: { id: { in: karyawanIds } },
          select: { id: true, name: true },
        })
      : []
    const nameMap = new Map(users.map((u) => [u.id, u.name]))
 
    const allRows = karyawanIds
      .map((idNum) => {
        const gajiBerjalan = berjalanMap.get(idNum) || 0
        const gajiDibayar = dibayarMap.get(idNum) || 0
        return {
          karyawanId: idNum,
          karyawanName: nameMap.get(idNum) || `Karyawan #${idNum}`,
          gajiBerjalan,
          gajiDibayar,
          total: gajiBerjalan + gajiDibayar,
        }
      })
      .sort((a, b) => a.karyawanName.localeCompare(b.karyawanName))

    const filteredRows = searchLower
      ? allRows.filter((r) => {
          if (String(r.karyawanId) === searchLower) return true
          return String(r.karyawanName || '').toLowerCase().includes(searchLower)
        })
      : allRows
 
    const totalItems = filteredRows.length
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
    const startIdx = (page - 1) * pageSize
    const paged = filteredRows.slice(startIdx, startIdx + pageSize)
 
    const sumBerjalan = filteredRows.reduce((acc, r) => acc + (Number(r.gajiBerjalan) || 0), 0)
    const sumDibayar = filteredRows.reduce((acc, r) => acc + (Number(r.gajiDibayar) || 0), 0)
    const sumTotal = filteredRows.reduce((acc, r) => acc + (Number(r.total) || 0), 0)
 
    return NextResponse.json({
      data: paged,
      meta: {
        page,
        pageSize,
        totalItems,
        totalPages,
        startDate: startKey,
        endDate: endKey,
        sumBerjalan,
        sumDibayar,
        sumTotal,
      },
    })
  } catch (error) {
    console.error('Error fetching cost-center karyawan gaji report:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

