import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { uploadFile } from '@/lib/storage'

function getWibTodayYmd() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
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
        source: 'SELFIE',
        updatedAt: new Date(),
      },
      create: {
        kebunId,
        karyawanId: params.userId,
        date: params.date,
        kerja: true,
        libur: false,
        source: 'SELFIE',
      },
    })
  } catch (err) {
    console.error('syncSelfieToCalendarKerja error:', err)
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await ensureAttendanceSelfieTable()

    const userId = Number(session.user.id)
    const formData = await req.formData()
    const photo = formData.get('photo') as File | null
    const lat = formData.get('lat') ? Number(formData.get('lat')) : null
    const lng = formData.get('long') ? Number(formData.get('long')) : null
    const locationName = formData.get('locationName') as string | null
    const type = formData.get('type') as 'IN' | 'OUT'

    if (!photo) {
      return NextResponse.json({ error: 'Photo is required' }, { status: 400 })
    }

    const bytes = await photo.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const uploadResult = await uploadFile({
      bytes: buffer,
      originalName: `attendance-${userId}-${Date.now()}.webp`,
      contentType: 'image/webp',
      folder: 'attendance'
    })

    const today = getWibTodayDateForDb()

    const existingAttendance = await (prisma as any).attendanceSelfie.findUnique({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
    })

    let attendance
    if (type === 'IN') {
      attendance = await (prisma as any).attendanceSelfie.upsert({
        where: {
          userId_date: {
            userId,
            date: today,
          },
        },
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
    } else {
      if (!existingAttendance) {
        return NextResponse.json({ error: 'Belum absen masuk hari ini' }, { status: 400 })
      }
      attendance = await (prisma as any).attendanceSelfie.update({
        where: {
          id: existingAttendance.id,
        },
        data: {
          checkOut: new Date(),
          photoOutUrl: uploadResult.url,
          latOut: lat,
          longOut: lng,
          locationOut: locationName,
        },
      })
    }

    if (type === 'IN') {
      await syncSelfieToCalendarKerja({ userId, date: today })
    }

    return NextResponse.json({ ok: true, attendance })
  } catch (error: any) {
    console.error('Attendance Error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}

export async function GET(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await ensureAttendanceSelfieTable()

    const userId = Number(session.user.id)
    const today = getWibTodayDateForDb()
    const { searchParams } = new URL(req.url)
    const limit = Math.min(60, Math.max(1, Number(searchParams.get('limit') || '7')))
    const history = searchParams.get('history') === '1'

    const formatWibYmdFromDate = (d: Date) =>
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(d)

    const attendance = await (prisma as any).attendanceSelfie.findUnique({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
    })

    if (!history) {
      if (attendance?.checkIn) {
        await syncSelfieToCalendarKerja({ userId, date: today })
      }
      return NextResponse.json({ attendance })
    }

    const rows = await (prisma as any).attendanceSelfie.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: limit,
      select: {
        id: true,
        date: true,
        checkIn: true,
        checkOut: true,
        locationIn: true,
        locationOut: true,
        photoInUrl: true,
        photoOutUrl: true,
      },
    })

    const historyRows = (Array.isArray(rows) ? rows : []).map((r: any) => ({
      id: Number(r.id),
      date: r?.date ? formatWibYmdFromDate(new Date(r.date)) : null,
      checkIn: r?.checkIn ? new Date(r.checkIn).toISOString() : null,
      checkOut: r?.checkOut ? new Date(r.checkOut).toISOString() : null,
      locationIn: r?.locationIn ? String(r.locationIn) : null,
      locationOut: r?.locationOut ? String(r.locationOut) : null,
      photoInUrl: r?.photoInUrl ? String(r.photoInUrl) : null,
      photoOutUrl: r?.photoOutUrl ? String(r.photoOutUrl) : null,
    }))

    return NextResponse.json({ attendance, history: historyRows })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
