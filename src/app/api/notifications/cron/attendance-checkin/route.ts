import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendPushNotification } from '@/lib/web-push'
import { parseWibYmd, wibEndExclusiveUtc, wibStartUtc } from '@/lib/wib'

export const dynamic = 'force-dynamic'

const getWibTodayYmd = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

const getWibTodayDateForDb = () => new Date(`${getWibTodayYmd()}T00:00:00.000Z`)

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

export async function POST(request: Request) {
  const url = new URL(request.url)
  const secret = request.headers.get('x-cron-secret') || url.searchParams.get('secret') || ''
  const expected = process.env.CRON_SECRET || ''
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await ensureAttendanceSelfieTable()

  const todayYmd = getWibTodayYmd()
  const todayParsed = parseWibYmd(todayYmd)
  if (!todayParsed) return NextResponse.json({ error: 'Invalid date' }, { status: 500 })

  const startUtc = wibStartUtc(todayParsed)
  const endExclusiveUtc = wibEndExclusiveUtc(todayParsed)
  const todayDbDate = getWibTodayDateForDb()

  const roles = ['ADMIN', 'PEMILIK', 'MANAGER', 'MANDOR', 'KASIR', 'GUDANG', 'KEUANGAN'] as const
  const recipients = await prisma.user.findMany({
    where: { role: { in: [...roles] } },
    select: { id: true },
  })
  if (recipients.length === 0) return NextResponse.json({ ok: true, sent: 0, created: 0 })

  const recipientIds = recipients.map((r) => r.id)
  const checkedIn = await (prisma as any).attendanceSelfie.findMany({
    where: {
      userId: { in: recipientIds },
      date: todayDbDate,
      checkIn: { not: null },
    },
    select: { userId: true },
  })
  const checkedInSet = new Set((checkedIn || []).map((r: any) => Number(r.userId)))
  const pendingIds = recipientIds.filter((id) => !checkedInSet.has(id))
  if (pendingIds.length === 0) return NextResponse.json({ ok: true, sent: 0, created: 0 })

  const existing = await prisma.notification.findMany({
    where: {
      userId: { in: pendingIds },
      type: 'ATTENDANCE_CHECKIN_REMINDER',
      createdAt: { gte: startUtc, lt: endExclusiveUtc },
    },
    select: { userId: true },
  })
  const existingIds = new Set(existing.map((n) => Number(n.userId)))

  const link = '/attendance'
  const toCreate = pendingIds
    .filter((id) => !existingIds.has(id))
    .map((userId) => ({
      userId,
      type: 'ATTENDANCE_CHECKIN_REMINDER',
      title: 'Pengingat Absen Masuk',
      message: 'Anda belum absen masuk hari ini. Silakan lakukan absen masuk sekarang.',
      link,
      isRead: false,
    }))

  if (toCreate.length === 0) return NextResponse.json({ ok: true, sent: 0, created: 0 })

  await prisma.notification.createMany({ data: toCreate })

  const subscriptions = await (prisma as any).pushSubscription.findMany({
    where: { userId: { in: toCreate.map((n) => n.userId) } },
  })

  const byUser = new Map<number, { title: string; body: string; url: string }>()
  for (const n of toCreate) {
    byUser.set(Number(n.userId), { title: n.title, body: n.message, url: n.link || '/' })
  }

  const sendResults = await Promise.all(
    (subscriptions || []).map((sub: any) => {
      const payload = byUser.get(Number(sub.userId))
      if (!payload) return Promise.resolve(false)
      return sendPushNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload)
    }),
  )

  return NextResponse.json({ ok: true, created: toCreate.length, sent: sendResults.filter(Boolean).length })
}

