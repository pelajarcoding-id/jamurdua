import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export type PushEventKey =
  | 'ALL'
  | 'NOTA_SAWIT_NEW'
  | 'NOTA_SAWIT_PAYMENT'
  | 'GAJIAN'
  | 'KASIR'
  | 'KEBUN_PERMINTAAN'
  | 'INVENTORY_KEBUN'
  | 'VEHICLE_EXPIRY'
  | 'ATTENDANCE_CHECKIN'

export type PushScheduleKey = 'ATTENDANCE_CHECKIN'

export const PUSH_EVENT_DEFS: Array<{ key: PushEventKey; label: string; description: string }> = [
  { key: 'ALL', label: 'Push Notifikasi', description: 'Aktif/nonaktifkan seluruh push notifikasi.' },
  { key: 'NOTA_SAWIT_NEW', label: 'Nota Sawit Baru', description: 'Notifikasi saat nota sawit baru dibuat.' },
  { key: 'NOTA_SAWIT_PAYMENT', label: 'Pembayaran Nota Sawit', description: 'Notifikasi saat status pembayaran/batch pembayaran berubah.' },
  { key: 'GAJIAN', label: 'Gajian', description: 'Notifikasi terkait proses/finalisasi/batal finalisasi gajian.' },
  { key: 'KASIR', label: 'Kasir', description: 'Notifikasi terkait transaksi kasir.' },
  { key: 'KEBUN_PERMINTAAN', label: 'Permintaan Kebun', description: 'Notifikasi saat ada permintaan dari kebun.' },
  { key: 'INVENTORY_KEBUN', label: 'Inventory Kebun', description: 'Notifikasi saat stok/transaction inventory kebun dibuat.' },
  { key: 'VEHICLE_EXPIRY', label: 'Kendaraan Jatuh Tempo', description: 'Notifikasi STNK/Pajak/Speksi mendekati jatuh tempo.' },
  { key: 'ATTENDANCE_CHECKIN', label: 'Absensi', description: 'Notifikasi absensi (cek-in/monitoring) bila digunakan.' },
]

let initPromise: Promise<void> | null = null
let scheduleInitPromise: Promise<void> | null = null

export async function ensurePushSettingsTable() {
  if (!initPromise) {
    initPromise = (async () => {
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "PushNotificationSetting" (
          "id" SERIAL PRIMARY KEY,
          "userId" INTEGER NOT NULL,
          "key" TEXT NOT NULL,
          "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "PushNotificationSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
        );
      `
      await prisma.$executeRaw`CREATE UNIQUE INDEX IF NOT EXISTS "PushNotificationSetting_userId_key_unique" ON "PushNotificationSetting" ("userId","key");`
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "PushNotificationSetting_userId_idx" ON "PushNotificationSetting" ("userId");`
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "PushNotificationSetting_key_idx" ON "PushNotificationSetting" ("key");`
    })()
  }
  await initPromise
}

export async function ensurePushScheduleTable() {
  if (!scheduleInitPromise) {
    scheduleInitPromise = (async () => {
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "PushNotificationSchedule" (
          "key" TEXT PRIMARY KEY,
          "hour" INTEGER NOT NULL DEFAULT 8,
          "minute" INTEGER NOT NULL DEFAULT 0,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `
    })()
  }
  await scheduleInitPromise
}

export async function getPushSchedule(key: PushScheduleKey) {
  await ensurePushScheduleTable()
  const rows = await prisma.$queryRaw<Array<{ hour: number; minute: number }>>(
    Prisma.sql`SELECT "hour","minute" FROM "PushNotificationSchedule" WHERE "key" = ${key} LIMIT 1`,
  )
  const hour = Math.max(0, Math.min(23, Number(rows?.[0]?.hour ?? 8)))
  const minute = Math.max(0, Math.min(59, Number(rows?.[0]?.minute ?? 0)))
  return { hour, minute }
}

export async function setPushSchedule(key: PushScheduleKey, hour: number, minute: number) {
  await ensurePushScheduleTable()
  const h = Math.max(0, Math.min(23, Math.floor(Number(hour))))
  const m = Math.max(0, Math.min(59, Math.floor(Number(minute))))
  await prisma.$executeRaw(
    Prisma.sql`
      INSERT INTO "PushNotificationSchedule" ("key","hour","minute","updatedAt")
      VALUES (${key}, ${h}, ${m}, CURRENT_TIMESTAMP)
      ON CONFLICT ("key") DO UPDATE SET
        "hour" = EXCLUDED."hour",
        "minute" = EXCLUDED."minute",
        "updatedAt" = CURRENT_TIMESTAMP;
    `,
  )
}

export async function getPushSettingsForUser(userId: number) {
  await ensurePushSettingsTable()
  const rows = await prisma.$queryRaw<Array<{ key: string; enabled: boolean }>>(
    Prisma.sql`SELECT "key","enabled" FROM "PushNotificationSetting" WHERE "userId" = ${userId}`,
  )
  const map: Record<string, boolean> = {}
  for (const r of rows) map[String(r.key)] = !!r.enabled
  const result: Record<PushEventKey, boolean> = {} as any
  for (const def of PUSH_EVENT_DEFS) {
    const k = def.key
    result[k] = map[k] ?? true
  }
  return result
}

export async function setPushSettingForUser(userId: number, key: PushEventKey, enabled: boolean) {
  await ensurePushSettingsTable()
  await prisma.$executeRaw(
    Prisma.sql`
      INSERT INTO "PushNotificationSetting" ("userId","key","enabled","updatedAt")
      VALUES (${userId}, ${key}, ${enabled}, CURRENT_TIMESTAMP)
      ON CONFLICT ("userId","key") DO UPDATE SET
        "enabled" = EXCLUDED."enabled",
        "updatedAt" = CURRENT_TIMESTAMP;
    `,
  )
}

export async function resolvePushEligibleUserIds(userIds: number[], eventKey: PushEventKey) {
  if (userIds.length === 0) return []
  await ensurePushSettingsTable()
  const rows = await prisma.$queryRaw<Array<{ userId: number }>>(
    Prisma.sql`
      SELECT "userId"
      FROM "PushNotificationSetting"
      WHERE "userId" IN (${Prisma.join(userIds)})
        AND (
          ("key" = 'ALL' AND "enabled" = FALSE)
          OR ("key" = ${eventKey} AND "enabled" = FALSE)
        )
    `,
  )
  const disabled = new Set<number>(rows.map((r) => Number(r.userId)))
  return userIds.filter((id) => !disabled.has(Number(id)))
}
