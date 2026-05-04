import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { uploadFile } from '@/lib/storage'

export const dynamic = 'force-dynamic'

const MIN_OUT_AFTER_IN_MS = 30 * 60 * 1000

function getWibTodayYmd() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function getWibMonthRangeYmd() {
  const now = new Date()
  const monthKey = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
  }).format(now)
  const startKey = `${monthKey}-01`
  const start = new Date(`${startKey}T00:00:00.000Z`)
  const end = new Date(start)
  end.setUTCMonth(end.getUTCMonth() + 1)
  const endKey = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(end)
  const endInclusive = new Date(`${endKey}T00:00:00.000Z`)
  endInclusive.setUTCDate(endInclusive.getUTCDate() - 1)
  const endInclusiveKey = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(endInclusive)
  return { startKey, endInclusiveKey }
}

function getWibTodayDateForDb() {
  const ymd = getWibTodayYmd()
  return new Date(`${ymd}T00:00:00.000Z`)
}

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

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "AttendanceSelfie_userId_date_key"
      ON "AttendanceSelfie" ("userId", "date");
  `)
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "AttendanceSelfie_userId_idx"
      ON "AttendanceSelfie" ("userId");
  `)
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "AttendanceSelfie_date_idx"
      ON "AttendanceSelfie" ("date");
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
      "source" TEXT,
      "jamKerja" NUMERIC,
      "ratePerJam" NUMERIC,
      "uangMakan" NUMERIC,
      "useHourly" BOOLEAN,
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

  const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'AbsensiHarian'
  `
  const columnNames = columns.map((c) => c.column_name)
  if (!columnNames.includes('source')) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "AbsensiHarian" ADD COLUMN "source" TEXT`)
  }

  const fkAbsensiHarian = await prisma.$queryRaw<Array<{ exists: number }>>`
    SELECT 1 as "exists"
    FROM pg_constraint
    WHERE conname = 'AbsensiHarian_karyawanId_fkey'
    LIMIT 1
  `
  if (fkAbsensiHarian.length === 0) {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "AbsensiHarian"
      ADD CONSTRAINT "AbsensiHarian_karyawanId_fkey"
      FOREIGN KEY ("karyawanId") REFERENCES "User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE
      NOT VALID
    `)
  }
}

async function syncSelfieToCalendarKerja(params: { userId: number; date: Date }) {
  try {
    await ensureAbsensiHarianTable()
    const kebunId = 0
    await (prisma as any).absensiHarian.upsert({
      where: {
        kebunId_karyawanId_date: {
          kebunId,
          karyawanId: params.userId,
          date: params.date,
        },
      },
      update: {
        kerja: true,
        libur: false,
        source: 'KIOSK-SELFIE',
        updatedAt: new Date(),
      },
      create: {
        kebunId,
        karyawanId: params.userId,
        date: params.date,
        kerja: true,
        libur: false,
        source: 'KIOSK-SELFIE',
      },
    })
  } catch {}
}

function requireKioskSecret(request: Request) {
  const secret = (process.env.KIOSK_SECRET || '').trim()
  if (!secret) return null
  const provided = (request.headers.get('x-kiosk-secret') || '').trim()
  if (provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}

export async function GET(request: Request) {
  const secretResp = requireKioskSecret(request)
  if (secretResp) return secretResp

  const { searchParams } = new URL(request.url)
  const userId = Number(searchParams.get('userId') || '')
  const unpaid = searchParams.get('unpaid') === '1'
  if (!Number.isFinite(userId) || userId <= 0) {
    return NextResponse.json({ error: 'userId invalid' }, { status: 400 })
  }

  if (unpaid) {
    await ensureAbsensiHarianTable()
    const { startKey, endInclusiveKey } = getWibMonthRangeYmd()
    const rows = await prisma.$queryRaw<Array<{ hk: number }>>`
      SELECT COUNT(DISTINCT a."date")::int as "hk"
      FROM "AbsensiHarian" a
      LEFT JOIN "AbsensiGajiHarian" p
        ON p."karyawanId" = a."karyawanId"
       AND p."date" = a."date"
      WHERE a."karyawanId" = ${userId}
        AND a."date" >= ${startKey}::DATE
        AND a."date" <= ${endInclusiveKey}::DATE
        AND (a."kerja" = TRUE OR a."jumlah" > 0)
        AND p."id" IS NULL
    `
    return NextResponse.json({ hkUnpaid: Number(rows?.[0]?.hk) || 0, startDate: startKey, endDate: endInclusiveKey })
  }

  await ensureAttendanceSelfieTable()
  const today = getWibTodayDateForDb()
  const attendance = await (prisma as any).attendanceSelfie.findUnique({
    where: { userId_date: { userId, date: today } },
  })
  return NextResponse.json({ attendance })
}

export async function POST(request: Request) {
  const secretResp = requireKioskSecret(request)
  if (secretResp) return secretResp

  try {
    await ensureAttendanceSelfieTable()

    const formData = await request.formData()
    const userId = Number(formData.get('userId') || '')
    const type = String(formData.get('type') || '').toUpperCase() as 'IN' | 'OUT'
    const photo = formData.get('photo') as File | null
    const lat = formData.get('lat') ? Number(formData.get('lat')) : null
    const lng = formData.get('long') ? Number(formData.get('long')) : null
    const locationName = formData.get('locationName') as string | null
    const livenessPassed = formData.get('livenessPassed') != null ? String(formData.get('livenessPassed')) === '1' : null

    if (!Number.isFinite(userId) || userId <= 0) {
      return NextResponse.json({ error: 'userId invalid' }, { status: 400 })
    }
    if (type !== 'IN' && type !== 'OUT') {
      return NextResponse.json({ error: 'type invalid' }, { status: 400 })
    }
    if (!photo) {
      return NextResponse.json({ error: 'Photo is required' }, { status: 400 })
    }
    const requireLiveness = String(process.env.KIOSK_REQUIRE_LIVENESS || '0') !== '0'
    if (requireLiveness && livenessPassed !== true) {
      return NextResponse.json({ error: 'Liveness check required' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true },
    })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const status = String(user.status || 'AKTIF').toUpperCase()
    if (status !== 'AKTIF') {
      return NextResponse.json({ error: 'User not active' }, { status: 400 })
    }

    const bytes = await photo.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const uploadResult = await uploadFile({
      bytes: buffer,
      originalName: `attendance-kiosk-${userId}-${Date.now()}.webp`,
      contentType: photo.type || 'image/webp',
      folder: 'attendance',
    })

    const today = getWibTodayDateForDb()
    const existingAttendance = await (prisma as any).attendanceSelfie.findUnique({
      where: { userId_date: { userId, date: today } },
    })

    let attendance
    if (type === 'IN') {
      if (existingAttendance?.checkIn) {
        return NextResponse.json({ error: 'Sudah absen masuk hari ini' }, { status: 400 })
      }
      attendance = await (prisma as any).attendanceSelfie.upsert({
        where: { userId_date: { userId, date: today } },
        update: {
          checkIn: new Date(),
          photoInUrl: uploadResult.url,
          latIn: lat,
          longIn: lng,
          locationIn: locationName,
        },
        create: {
          userId,
          date: today,
          checkIn: new Date(),
          photoInUrl: uploadResult.url,
          latIn: lat,
          longIn: lng,
          locationIn: locationName,
          status: 'HADIR',
        },
      })
      await syncSelfieToCalendarKerja({ userId, date: today })
    } else {
      if (!existingAttendance) {
        return NextResponse.json({ error: 'Belum absen masuk hari ini' }, { status: 400 })
      }
      if (existingAttendance?.checkOut) {
        return NextResponse.json({ error: 'Sudah absen pulang hari ini' }, { status: 400 })
      }
      if (existingAttendance?.checkIn) {
        const inTime = new Date(existingAttendance.checkIn).getTime()
        if (!Number.isNaN(inTime) && Date.now() - inTime < MIN_OUT_AFTER_IN_MS) {
          return NextResponse.json({ error: 'Absen pulang minimal 30 menit setelah absen masuk' }, { status: 400 })
        }
      }
      attendance = await (prisma as any).attendanceSelfie.update({
        where: { id: existingAttendance.id },
        data: {
          checkOut: new Date(),
          photoOutUrl: uploadResult.url,
          latOut: lat,
          longOut: lng,
          locationOut: locationName,
        },
      })
    }

    return NextResponse.json({ ok: true, attendance })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 })
  }
}
