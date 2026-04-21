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
  const cronSecretConfigured = !!process.env.CRON_SECRET

  const lastByTypeRows = await prisma.notification.groupBy({
    by: ['type'],
    where: { userId: r.id },
    _max: { createdAt: true },
  })
  const lastByType = new Map<string, Date>()
  for (const row of lastByTypeRows as any[]) {
    const t = String(row?.type || '')
    const dt = row?._max?.createdAt ? new Date(row._max.createdAt) : null
    if (!t || !dt) continue
    lastByType.set(t, dt)
  }

  const eventTypes: Record<string, string[]> = {
    NOTA_SAWIT_NEW: ['NOTA_SAWIT'],
    NOTA_SAWIT_PAYMENT: ['NOTA_SAWIT_PAYMENT'],
    GAJIAN: ['GAJIAN_KEBUN'],
    KASIR: ['KASIR'],
    KEBUN_PERMINTAAN: ['PERMINTAAN_KEBUN'],
    INVENTORY_KEBUN: ['INVENTORY_MIN_STOCK'],
    VEHICLE_EXPIRY: ['KENDARAAN_STNK', 'KENDARAAN_PAJAK'],
    ATTENDANCE_CHECKIN: ['ATTENDANCE_CHECKIN_REMINDER'],
  }
  const lastTimes: Record<string, string | null> = {}
  for (const def of PUSH_EVENT_DEFS) {
    const key = def.key
    if (key === 'ALL') {
      lastTimes[key] = null
      continue
    }
    const types = eventTypes[key] || []
    let maxTime = 0
    for (const t of types) {
      const dt = lastByType.get(t)
      if (!dt) continue
      const ms = dt.getTime()
      if (ms > maxTime) maxTime = ms
    }
    lastTimes[key] = maxTime > 0 ? new Date(maxTime).toISOString() : null
  }

  return NextResponse.json({
    defs: PUSH_EVENT_DEFS,
    settings,
    subscriptionCount,
    cronSecretConfigured,
    lastTimes,
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
