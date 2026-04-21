import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/route-auth'
import { getPushSettingsForUser, PUSH_EVENT_DEFS, setPushSettingForUser } from '@/lib/notifications/push-settings'

export const dynamic = 'force-dynamic'

export async function GET() {
  const r = await requireRole(['ADMIN'])
  if (r.response) return r.response

  const settings = await getPushSettingsForUser(r.id)
  const subscriptionCount = await (prisma as any).pushSubscription.count({ where: { userId: r.id } })

  return NextResponse.json({
    defs: PUSH_EVENT_DEFS,
    settings,
    subscriptionCount,
  })
}

export async function PUT(request: Request) {
  const r = await requireRole(['ADMIN'])
  if (r.response) return r.response

  const body = await request.json().catch(() => ({} as any))
  const key = String(body?.key || '').trim().toUpperCase()
  const enabled = !!body?.enabled

  const allowedKeys = new Set(PUSH_EVENT_DEFS.map((d) => d.key))
  if (!allowedKeys.has(key as any)) {
    return NextResponse.json({ error: 'Key tidak valid' }, { status: 400 })
  }

  await setPushSettingForUser(r.id, key as any, enabled)
  const settings = await getPushSettingsForUser(r.id)
  return NextResponse.json({ success: true, settings })
}

