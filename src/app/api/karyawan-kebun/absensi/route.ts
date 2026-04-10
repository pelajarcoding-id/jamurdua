import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { auth } from '@/auth'
import { parseWibYmd, wibEndExclusiveUtc, wibStartUtc } from '@/lib/wib'

export const dynamic = 'force-dynamic'

const canWriteForKebun = (session: any, kebunId: number) => {
  const role = session?.user?.role as string | undefined
  if (!role) return false
  if (role === 'ADMIN' || role === 'PEMILIK') return true
  if (role === 'MANDOR') {
    const mandorKebunId = Number((session.user as any)?.kebunId)
    return Number.isFinite(mandorKebunId) && mandorKebunId === kebunId
  }
  if (role === 'MANAGER') {
    const ids = Array.isArray((session.user as any)?.kebunIds) ? ((session.user as any).kebunIds as number[]) : []
    return ids.includes(kebunId)
  }
  return false
}

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
      "jamKerja" NUMERIC,
      "ratePerJam" NUMERIC,
      "uangMakan" NUMERIC,
      "useHourly" BOOLEAN,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE ("kebunId","karyawanId","date")
    )
  `)
  // Add new columns if they don't exist
  const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'AbsensiHarian'
  `
  const columnNames = columns.map(c => c.column_name)
  if (!columnNames.includes('jamKerja')) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "AbsensiHarian" ADD COLUMN "jamKerja" NUMERIC`)
  }
  if (!columnNames.includes('ratePerJam')) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "AbsensiHarian" ADD COLUMN "ratePerJam" NUMERIC`)
  }
  if (!columnNames.includes('uangMakan')) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "AbsensiHarian" ADD COLUMN "uangMakan" NUMERIC`)
  }
  if (!columnNames.includes('useHourly')) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "AbsensiHarian" ADD COLUMN "useHourly" BOOLEAN`)
  }

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

const isAssignedToKebunOnDate = async (karyawanId: number, kebunId: number, dateKey: string) => {
  const ymd = parseWibYmd(dateKey)
  if (!ymd) return true
  const dayStartUtc = wibStartUtc(ymd)
  const dayEndExclusiveUtc = wibEndExclusiveUtc(ymd)
  const assignmentCount = await prisma.karyawanAssignment.count({ where: { userId: karyawanId } })
  if (assignmentCount === 0) return true
  const assignment = await prisma.karyawanAssignment.findFirst({
    where: {
      userId: karyawanId,
      startDate: { lt: dayEndExclusiveUtc },
      OR: [{ endDate: null }, { endDate: { gt: dayStartUtc } }],
      location: { type: 'KEBUN', kebunId },
    },
    select: { id: true },
  })
  return !!assignment
}

export async function GET(request: Request) {
  try {
    await ensureTable()
    const { searchParams } = new URL(request.url)
    const kebunIdParam = searchParams.get('kebunId')
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')
    const unpaidOnly = searchParams.get('unpaid') === '1'

    if (!kebunIdParam || !startDateParam || !endDateParam) {
      return NextResponse.json({ error: 'kebunId, startDate, endDate wajib diisi' }, { status: 400 })
    }
    const kebunId = Number(kebunIdParam)
    if (Number.isNaN(kebunId)) {
      return NextResponse.json({ error: 'kebunId tidak valid' }, { status: 400 })
    }

    const startYmd = parseWibYmd(startDateParam)
    const endYmd = parseWibYmd(endDateParam)
    if (!startYmd || !endYmd) {
      return NextResponse.json({ error: 'startDate/endDate tidak valid' }, { status: 400 })
    }
    const startKey = `${String(startYmd.y).padStart(4, '0')}-${String(startYmd.m).padStart(2, '0')}-${String(startYmd.d).padStart(2, '0')}`
    const endKey = `${String(endYmd.y).padStart(4, '0')}-${String(endYmd.m).padStart(2, '0')}-${String(endYmd.d).padStart(2, '0')}`

    if (unpaidOnly) {
      const agg = await prisma.$queryRaw<Array<{ karyawanId: number; total: number; hariKerja: number }>>`
        SELECT a."karyawanId", SUM(a."jumlah") as "total", COUNT(*) as "hariKerja"
        FROM "AbsensiHarian" a
        LEFT JOIN "AbsensiGajiHarian" p
          ON p."kebunId" = a."kebunId"
         AND p."karyawanId" = a."karyawanId"
         AND p."date" = a."date"
        WHERE a."kebunId" = ${kebunId}
          AND a."date" >= ${startKey}::DATE
          AND a."date" <= ${endKey}::DATE
          AND a."jumlah" > 0
          AND p."id" IS NULL
        GROUP BY a."karyawanId"
        ORDER BY a."karyawanId" ASC
      `
      const ids = agg.map(a => a.karyawanId)
      const users = await prisma.user.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true },
      })
      const userMap = new Map(users.map(u => [u.id, u.name]))
      return NextResponse.json({
        data: agg.map(a => ({
          karyawanId: a.karyawanId,
          name: userMap.get(a.karyawanId) || '-',
          total: Number(a.total) || 0,
          hariKerja: Number(a.hariKerja) || 0,
        })),
      })
    }

    // Fetch all records for a specific user in a date range
    const karyawanIdParam = searchParams.get('karyawanId')
    if (karyawanIdParam) {
      const karyawanId = Number(karyawanIdParam)
      const records = await prisma.$queryRaw<Array<{ 
        date: Date; 
        jumlah: number; 
        kerja: boolean; 
        libur: boolean; 
        note: string | null;
        jamKerja: number | null;
        ratePerJam: number | null;
        uangMakan: number | null;
        useHourly: boolean | null;
      }>>`
        SELECT "date", "jumlah", "kerja", "libur", "note", "jamKerja", "ratePerJam", "uangMakan", "useHourly"
        FROM "AbsensiHarian"
        WHERE "kebunId" = ${kebunId}
          AND "karyawanId" = ${karyawanId}
          AND "date" >= ${startKey}::DATE
          AND "date" <= ${endKey}::DATE
        ORDER BY "date" ASC
      `
      return NextResponse.json({ data: records })
    }

    return NextResponse.json({ data: [] })
  } catch (error) {
    console.error('GET /api/karyawan-kebun/absensi error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    await ensureTable()
    const session = await auth()
    if (!session?.user?.role) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = await request.json()
    const { kebunId, karyawanId, entries } = body || {}
    if (!kebunId || !karyawanId || !Array.isArray(entries)) {
      return NextResponse.json({ error: 'kebunId, karyawanId, dan entries wajib diisi' }, { status: 400 })
    }
    const kebunIdNum = Number(kebunId)
    if (!Number.isFinite(kebunIdNum) || kebunIdNum <= 0) {
      return NextResponse.json({ error: 'kebunId tidak valid' }, { status: 400 })
    }
    if (!canWriteForKebun(session, kebunIdNum)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const dateKeys = entries
      .map((entry: any) => String(entry?.date || '').trim())
      .map((raw) => {
        const ymd = parseWibYmd(raw)
        if (!ymd) return null
        return `${String(ymd.y).padStart(4, '0')}-${String(ymd.m).padStart(2, '0')}-${String(ymd.d).padStart(2, '0')}`
      })
      .filter((v): v is string => !!v)

    if (dateKeys.length > 0) {
      const uniqueKeys = Array.from(new Set(dateKeys))
      for (const dk of uniqueKeys) {
        const ok = await isAssignedToKebunOnDate(Number(karyawanId), kebunIdNum, dk)
        if (!ok) {
          return NextResponse.json({ error: `Tanggal ${dk} karyawan tidak terdaftar lagi di kebun ini.` }, { status: 409 })
        }
      }
      const paid = await prisma.$queryRaw<Array<{ date: string }>>(
        Prisma.sql`SELECT TO_CHAR("date", 'YYYY-MM-DD') as "date"
                   FROM "AbsensiGajiHarian"
                   WHERE "kebunId" = ${Number(kebunId)}
                     AND "karyawanId" = ${Number(karyawanId)}
                     AND "date" IN (${Prisma.join(uniqueKeys.map((k) => Prisma.sql`${k}::DATE`))})`
      )
      if (paid.length > 0) {
        return NextResponse.json({ error: 'Absensi sudah dibayar gaji dan tidak bisa diubah' }, { status: 409 })
      }
    }
    for (const entry of entries) {
      const date = entry?.date
      const jumlahRaw = entry?.jumlah ?? entry?.amount
      const jumlah = Number(jumlahRaw) || 0
      const kerja = !!(entry?.kerja ?? entry?.work)
      const libur = !!(entry?.libur ?? entry?.off)
      const note = entry?.keterangan ?? entry?.note ?? null
      const jamKerja = Number(entry?.jamKerja ?? entry?.hour) || null
      const ratePerJam = Number(entry?.ratePerJam ?? entry?.rate) || null
      const uangMakan = Number(entry?.uangMakan ?? entry?.meal) || null
      const useHourly = !!(entry?.useHourly ?? entry?.hourly)

      if (!date) continue
      const dateYmd = parseWibYmd(date)
      if (!dateYmd) continue
      const dateKey = `${String(dateYmd.y).padStart(4, '0')}-${String(dateYmd.m).padStart(2, '0')}-${String(dateYmd.d).padStart(2, '0')}`
      await prisma.$executeRaw`
        INSERT INTO "AbsensiHarian" ("kebunId","karyawanId","date","jumlah","kerja","libur","note","jamKerja","ratePerJam","uangMakan","useHourly","updatedAt")
        VALUES (${Number(kebunId)}, ${Number(karyawanId)}, ${dateKey}::DATE, ${jumlah}, ${kerja}, ${libur}, ${note}, ${jamKerja}, ${ratePerJam}, ${uangMakan}, ${useHourly}, NOW())
        ON CONFLICT ("kebunId","karyawanId","date")
        DO UPDATE SET
          "jumlah" = EXCLUDED."jumlah",
          "kerja" = EXCLUDED."kerja",
          "libur" = EXCLUDED."libur",
          "note" = EXCLUDED."note",
          "jamKerja" = EXCLUDED."jamKerja",
          "ratePerJam" = EXCLUDED."ratePerJam",
          "uangMakan" = EXCLUDED."uangMakan",
          "useHourly" = EXCLUDED."useHourly",
          "updatedAt" = NOW()
      `
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('POST /api/karyawan-kebun/absensi error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    await ensureTable()
    const session = await auth()
    if (!session?.user?.role) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!['ADMIN', 'PEMILIK', 'MANAGER', 'MANDOR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const kebunId = Number(searchParams.get('kebunId'))
    const karyawanId = Number(searchParams.get('karyawanId'))
    const date = searchParams.get('date')

    if (!kebunId || !karyawanId || !date) {
      return NextResponse.json({ error: 'kebunId, karyawanId, dan date wajib diisi' }, { status: 400 })
    }
    if (!canWriteForKebun(session, kebunId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const dateYmd = parseWibYmd(date)
    if (!dateYmd) {
      return NextResponse.json({ error: 'date tidak valid' }, { status: 400 })
    }
    const dateKey = `${String(dateYmd.y).padStart(4, '0')}-${String(dateYmd.m).padStart(2, '0')}-${String(dateYmd.d).padStart(2, '0')}`

    const okAssignment = await isAssignedToKebunOnDate(karyawanId, kebunId, dateKey)
    if (!okAssignment) {
      return NextResponse.json({ error: `Tanggal ${dateKey} bukan periode penugasan karyawan di kebun ini.` }, { status: 409 })
    }

    // Check if paid
    const paid = await prisma.$queryRaw<Array<{ id: number }>>`
      SELECT id FROM "AbsensiGajiHarian"
      WHERE "kebunId" = ${kebunId}
        AND "karyawanId" = ${karyawanId}
        AND "date" = ${dateKey}::DATE
    `
    if (paid.length > 0) {
      return NextResponse.json({ error: 'Absensi sudah dibayar gaji dan tidak bisa dihapus. Batalkan gaji terlebih dahulu.' }, { status: 409 })
    }

    await prisma.$executeRaw`
      DELETE FROM "AbsensiHarian"
      WHERE "kebunId" = ${kebunId}
        AND "karyawanId" = ${karyawanId}
        AND "date" = ${dateKey}::DATE
    `

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/karyawan-kebun/absensi error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
