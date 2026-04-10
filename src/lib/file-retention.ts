import { prisma } from '@/lib/prisma'

function getRetentionDays() {
  const raw = process.env.UPLOAD_RETENTION_DAYS
  const parsed = raw ? Number(raw) : NaN
  if (!Number.isFinite(parsed) || parsed <= 0) return 180
  return Math.floor(parsed)
}

function addDays(date: Date, days: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function normalizeUrl(url: string) {
  return url.trim()
}

function detectDriver() {
  return (process.env.STORAGE_DRIVER || 'local').toLowerCase()
}

function extractS3KeyFromUrl(url: string) {
  const publicBase = (process.env.S3_PUBLIC_URL_BASE || '').replace(/\/$/, '')
  const u = normalizeUrl(url)
  if (!publicBase) return null
  if (!u.startsWith(publicBase + '/')) return null
  return u.slice(publicBase.length + 1)
}

export async function scheduleFileDeletion(input: {
  url: string
  entity?: string
  entityId?: string
  reason?: string
  deleteAt?: Date
}) {
  const url = normalizeUrl(input.url)
  if (!url) return

  const driver = detectDriver()
  const deleteAt = input.deleteAt ?? addDays(new Date(), getRetentionDays())
  const key = driver === 's3' ? extractS3KeyFromUrl(url) : null

  await (prisma as any).pendingFileDeletion.create({
    data: {
      url,
      key,
      driver,
      entity: input.entity,
      entityId: input.entityId,
      reason: input.reason,
      deleteAt,
    },
  })
}
