import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { uploadFile } from '@/lib/storage'

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

    const today = new Date()
    today.setHours(0, 0, 0, 0)

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

    return NextResponse.json({ ok: true, attendance })
  } catch (error: any) {
    console.error('Attendance Error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await ensureAttendanceSelfieTable()

    const userId = Number(session.user.id)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const attendance = await (prisma as any).attendanceSelfie.findUnique({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
    })

    return NextResponse.json({ attendance })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
