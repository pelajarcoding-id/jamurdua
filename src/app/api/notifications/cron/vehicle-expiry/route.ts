import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendPushNotification } from '@/lib/web-push'
import { parseWibYmd, wibEndExclusiveUtc, wibStartUtc } from '@/lib/wib'

export const dynamic = 'force-dynamic'

const getWibTodayYmd = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

const addDaysYmd = (ymd: string, days: number) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd
  const d = new Date(`${ymd}T00:00:00+07:00`)
  d.setDate(d.getDate() + days)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

const daysLeftFromWibStart = (expiry: Date, wibTodayStartUtc: Date) =>
  Math.ceil((expiry.getTime() - wibTodayStartUtc.getTime()) / (24 * 60 * 60 * 1000))

export async function POST(request: Request) {
  const url = new URL(request.url)
  const secret = request.headers.get('x-cron-secret') || url.searchParams.get('secret') || ''
  const expected = process.env.CRON_SECRET || ''
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const todayYmd = getWibTodayYmd()
  const today = parseWibYmd(todayYmd)
  if (!today) return NextResponse.json({ error: 'Invalid date' }, { status: 500 })

  const untilYmd = addDaysYmd(todayYmd, 5)
  const until = parseWibYmd(untilYmd)
  if (!until) return NextResponse.json({ error: 'Invalid date' }, { status: 500 })

  const startUtc = wibStartUtc(today)
  const endExclusiveUtc = wibEndExclusiveUtc(until)

  const vehicles = await prisma.kendaraan.findMany({
    where: {
      OR: [
        { tanggalMatiStnk: { gte: startUtc, lt: endExclusiveUtc } },
        { tanggalPajakTahunan: { gte: startUtc, lt: endExclusiveUtc } },
      ],
    },
    select: {
      platNomor: true,
      merk: true,
      tanggalMatiStnk: true,
      tanggalPajakTahunan: true,
    },
  })

  if (vehicles.length === 0) return NextResponse.json({ ok: true, sent: 0, created: 0 })

  const recipients = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'PEMILIK'] } },
    select: { id: true },
  })
  if (recipients.length === 0) return NextResponse.json({ ok: true, sent: 0, created: 0 })

  const recipientIds = recipients.map((r) => r.id)
  const existing = await prisma.notification.findMany({
    where: {
      userId: { in: recipientIds },
      type: { in: ['KENDARAAN_STNK', 'KENDARAAN_PAJAK'] },
      createdAt: { gte: startUtc, lt: wibEndExclusiveUtc(today) },
    },
    select: { userId: true, type: true, link: true },
  })
  const existingKey = new Set(existing.map((n) => `${n.userId}|${n.type}|${n.link || ''}`))

  const toCreate: Array<{ userId: number; type: string; title: string; message: string; link: string; isRead: boolean }> = []
  for (const v of vehicles) {
    const plat = v.platNomor
    const link = `/kendaraan?search=${encodeURIComponent(plat)}`

    const stnkLeft = daysLeftFromWibStart(v.tanggalMatiStnk, startUtc)
    if (stnkLeft >= 0 && stnkLeft <= 5) {
      for (const uid of recipientIds) {
        const key = `${uid}|KENDARAAN_STNK|${link}`
        if (existingKey.has(key)) continue
        toCreate.push({
          userId: uid,
          type: 'KENDARAAN_STNK',
          title: `STNK Akan Jatuh Tempo (${stnkLeft} hari)`,
          message: `${v.merk} - ${plat}`,
          link,
          isRead: false,
        })
      }
    }

    if (v.tanggalPajakTahunan) {
      const pajakLeft = daysLeftFromWibStart(v.tanggalPajakTahunan, startUtc)
      if (pajakLeft >= 0 && pajakLeft <= 5) {
        for (const uid of recipientIds) {
          const key = `${uid}|KENDARAAN_PAJAK|${link}`
          if (existingKey.has(key)) continue
          toCreate.push({
            userId: uid,
            type: 'KENDARAAN_PAJAK',
            title: `Pajak Tahunan Akan Jatuh Tempo (${pajakLeft} hari)`,
            message: `${v.merk} - ${plat}`,
            link,
            isRead: false,
          })
        }
      }
    }
  }

  if (toCreate.length === 0) return NextResponse.json({ ok: true, sent: 0, created: 0 })

  await prisma.notification.createMany({ data: toCreate })

  const subscriptions = await (prisma as any).pushSubscription.findMany({
    where: { userId: { in: recipientIds } },
  })

  const pushPayloadByUser = new Map<number, { title: string; body: string; url: string }[]>()
  for (const n of toCreate) {
    const list = pushPayloadByUser.get(n.userId) || []
    list.push({ title: n.title, body: n.message, url: n.link })
    pushPayloadByUser.set(n.userId, list)
  }

  const sendResults = await Promise.all(
    (subscriptions || []).flatMap((sub: any) => {
      const payloads = pushPayloadByUser.get(Number(sub.userId)) || []
      return payloads.map((p) =>
        sendPushNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, p),
      )
    }),
  )

  return NextResponse.json({ ok: true, created: toCreate.length, sent: sendResults.filter(Boolean).length })
}

