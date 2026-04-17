import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { sendPushNotification } from '@/lib/web-push'

export const dynamic = 'force-dynamic'

export async function POST() {
  const session = await auth()
  const userId = session?.user?.id ? Number(session.user.id) : null
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const subs = await (prisma as any).pushSubscription.findMany({ where: { userId } })
  if (!subs || subs.length === 0) return NextResponse.json({ ok: true, sent: 0 })

  const results = await Promise.all(
    subs.map((sub: any) =>
      sendPushNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        { title: 'Tes Push Notifikasi', body: 'Push notifikasi aktif.', url: '/' },
      ),
    ),
  )
  const sent = results.filter(Boolean).length
  return NextResponse.json({ ok: true, sent })
}

