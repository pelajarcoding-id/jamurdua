import { prisma } from '@/lib/prisma'
import { sendPushNotification } from '@/lib/web-push'
import { PushEventKey, resolvePushEligibleUserIds } from '@/lib/notifications/push-settings'

export async function sendPushToUsers(params: {
  userIds: number[]
  eventKey: PushEventKey
  payload: { title: string; body: string; url?: string }
}) {
  const unique = Array.from(new Set(params.userIds.map((n) => Number(n)).filter((n) => Number.isFinite(n))))
  if (unique.length === 0) return { sent: 0 }

  const eligible = await resolvePushEligibleUserIds(unique, params.eventKey)
  if (eligible.length === 0) return { sent: 0 }

  const subs = await (prisma as any).pushSubscription.findMany({
    where: { userId: { in: eligible } },
  })
  if (!subs || subs.length === 0) return { sent: 0 }

  const results = await Promise.all(
    subs.map((sub: any) =>
      sendPushNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, params.payload),
    ),
  )
  const sent = results.filter(Boolean).length
  return { sent }
}

