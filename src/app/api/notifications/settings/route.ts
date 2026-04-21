import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/route-auth'
import { getPushSchedule, getPushSettingsForUser, PUSH_EVENT_DEFS, setPushSchedule, setPushSettingForUser } from '@/lib/notifications/push-settings'

export const dynamic = 'force-dynamic'

export async function GET() {
  const r = await requireRole(['ADMIN'])
  if (r.response) return r.response

  const settings = await getPushSettingsForUser(r.id)
  const subscriptionCount = await (prisma as any).pushSubscription.count({ where: { userId: r.id } })
  const cronSecretConfigured = !!process.env.CRON_SECRET
  const attendance = await getPushSchedule('ATTENDANCE_CHECKIN')
  const pad2 = (n: number) => String(n).padStart(2, '0')
  const schedule = {
    ATTENDANCE_CHECKIN: `${pad2(attendance.hour)}:${pad2(attendance.minute)}`,
  }

  return NextResponse.json({
    defs: PUSH_EVENT_DEFS,
    settings,
    subscriptionCount,
    cronSecretConfigured,
    schedule,
  })
}

export async function PUT(request: Request) {
  const r = await requireRole(['ADMIN'])
  if (r.response) return r.response

  const body = await request.json().catch(() => ({} as any))
  const key = String(body?.key || '').trim().toUpperCase()
  const enabled = !!body?.enabled
  const scheduleTime = typeof body?.scheduleTime === 'string' ? body.scheduleTime.trim() : ''

  const allowedKeys = new Set(PUSH_EVENT_DEFS.map((d) => d.key))
  if (!allowedKeys.has(key as any)) {
    return NextResponse.json({ error: 'Key tidak valid' }, { status: 400 })
  }

  if (scheduleTime && key === 'ATTENDANCE_CHECKIN') {
    const m = scheduleTime.match(/^(\d{1,2}):(\d{2})$/)
    if (!m) return NextResponse.json({ error: 'Format jam tidak valid' }, { status: 400 })
    const hour = Number(m[1])
    const minute = Number(m[2])
    await setPushSchedule('ATTENDANCE_CHECKIN', hour, minute)
  } else {
    await setPushSettingForUser(r.id, key as any, enabled)
  }
  const settings = await getPushSettingsForUser(r.id)
  const attendance = await getPushSchedule('ATTENDANCE_CHECKIN')
  const pad2 = (n: number) => String(n).padStart(2, '0')
  const schedule = {
    ATTENDANCE_CHECKIN: `${pad2(attendance.hour)}:${pad2(attendance.minute)}`,
  }
  return NextResponse.json({ success: true, settings, schedule })
}
