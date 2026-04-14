import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { parseWibYmd, wibStartUtc } from '@/lib/wib'

const tableExistsCache = new Map<string, boolean>()

async function hasTable(tableName: string) {
  const key = String(tableName)
  if (tableExistsCache.has(key)) return tableExistsCache.get(key) as boolean
  try {
    const rows = await prisma.$queryRaw<any[]>(
      Prisma.sql`SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = ${key}
      ) AS "exists"`,
    )
    const exists = Boolean(rows?.[0]?.exists)
    if (exists) tableExistsCache.set(key, true)
    return exists
  } catch {
    return false
  }
}

export async function getNotaSawitPphRate(params: { perusahaanId: number; tanggal?: Date | null }) {
  const perusahaanId = Number(params.perusahaanId)
  if (!Number.isFinite(perusahaanId) || perusahaanId <= 0) return 0.0025

  const baseDate = params.tanggal ? new Date(params.tanggal) : new Date()
  const ymd = parseWibYmd(baseDate.toISOString())
  const effectiveDate = ymd ? wibStartUtc(ymd) : baseDate

  const hasRateHistory = await hasTable('PerusahaanNotaSawitPphRate')
  if (hasRateHistory) {
    try {
      const rows = await prisma.$queryRaw<any[]>(
        Prisma.sql`SELECT "pphRate"
                   FROM "PerusahaanNotaSawitPphRate"
                   WHERE "perusahaanId" = ${perusahaanId}
                     AND "effectiveFrom" <= ${effectiveDate}
                   ORDER BY "effectiveFrom" DESC
                   LIMIT 1`,
      )
      const rate = Number(rows?.[0]?.pphRate)
      if (Number.isFinite(rate) && rate >= 0 && rate <= 1) return rate
    } catch {}
  }

  const hasSetting = await hasTable('PerusahaanNotaSawitSetting')
  if (hasSetting) {
    try {
      const rows = await prisma.$queryRaw<any[]>(
        Prisma.sql`SELECT "pphRate" FROM "PerusahaanNotaSawitSetting" WHERE "perusahaanId" = ${perusahaanId} LIMIT 1`,
      )
      const rate = Number(rows?.[0]?.pphRate)
      if (Number.isFinite(rate) && rate >= 0 && rate <= 1) return rate
    } catch {}
  }

  return 0.0025
}
