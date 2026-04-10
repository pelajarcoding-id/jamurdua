import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/route-auth'
import { defaultPerusahaanTaxSetting } from '@/lib/tax-id'

export const dynamic = 'force-dynamic'

async function hasTaxSettingTable() {
  const rows = await prisma.$queryRaw<any[]>(
    Prisma.sql`SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'PerusahaanTaxSetting'
    ) AS "exists"`
  )
  return Boolean(rows?.[0]?.exists)
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'MANAGER'])
    if (guard.response) return guard.response

    const perusahaanId = Number(params.id)
    if (!perusahaanId) return NextResponse.json({ error: 'perusahaanId tidak valid' }, { status: 400 })

    const fallback = defaultPerusahaanTaxSetting()
    try {
      const exists = await hasTaxSettingTable()
      if (!exists) return NextResponse.json({ data: { perusahaanId, ...fallback } })
      const rows = await prisma.$queryRaw<any[]>(
        Prisma.sql`SELECT "perusahaanId","scheme","standardRate","umkmFinalRate","umkmOmzetThreshold","facilityOmzetThreshold","facilityPortionThreshold","facilityDiscount","rounding"
                   FROM "PerusahaanTaxSetting"
                   WHERE "perusahaanId" = ${perusahaanId}
                   LIMIT 1`
      )
      const row = rows?.[0]
      if (!row) return NextResponse.json({ data: { perusahaanId, ...fallback } })
      return NextResponse.json({ data: { perusahaanId, ...fallback, ...row } })
    } catch {
      return NextResponse.json({ data: { perusahaanId, ...fallback } })
    }
  } catch (error) {
    console.error('GET /api/perusahaan/[id]/tax error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK'])
    if (guard.response) return guard.response

    const perusahaanId = Number(params.id)
    if (!perusahaanId) return NextResponse.json({ error: 'perusahaanId tidak valid' }, { status: 400 })

    const body = await request.json().catch(() => ({} as any))
    const fallback = defaultPerusahaanTaxSetting()
    const scheme = String(body?.scheme || fallback.scheme).toUpperCase()
    const rounding = String(body?.rounding || fallback.rounding).toUpperCase()

    const data = {
      perusahaanId,
      scheme: ['AUTO', 'STANDARD', 'PASAL_31E', 'UMKM_FINAL'].includes(scheme) ? scheme : fallback.scheme,
      rounding: ['THOUSAND', 'NONE'].includes(rounding) ? rounding : fallback.rounding,
      standardRate: Number(body?.standardRate ?? fallback.standardRate),
      umkmFinalRate: Number(body?.umkmFinalRate ?? fallback.umkmFinalRate),
      umkmOmzetThreshold: Number(body?.umkmOmzetThreshold ?? fallback.umkmOmzetThreshold),
      facilityOmzetThreshold: Number(body?.facilityOmzetThreshold ?? fallback.facilityOmzetThreshold),
      facilityPortionThreshold: Number(body?.facilityPortionThreshold ?? fallback.facilityPortionThreshold),
      facilityDiscount: Number(body?.facilityDiscount ?? fallback.facilityDiscount),
    }

    const exists = await hasTaxSettingTable()
    if (!exists) {
      return NextResponse.json(
        { error: 'Tabel pengaturan pajak belum ada. Jalankan migrasi Prisma terlebih dahulu.' },
        { status: 400 }
      )
    }

    const rows = await prisma.$queryRaw<any[]>(
      Prisma.sql`INSERT INTO "PerusahaanTaxSetting"
                   ("perusahaanId","scheme","standardRate","umkmFinalRate","umkmOmzetThreshold","facilityOmzetThreshold","facilityPortionThreshold","facilityDiscount","rounding","createdAt","updatedAt")
                 VALUES
                   (${data.perusahaanId}, ${data.scheme}, ${data.standardRate}, ${data.umkmFinalRate}, ${data.umkmOmzetThreshold}, ${data.facilityOmzetThreshold}, ${data.facilityPortionThreshold}, ${data.facilityDiscount}, ${data.rounding}, NOW(), NOW())
                 ON CONFLICT ("perusahaanId") DO UPDATE SET
                   "scheme" = EXCLUDED."scheme",
                   "standardRate" = EXCLUDED."standardRate",
                   "umkmFinalRate" = EXCLUDED."umkmFinalRate",
                   "umkmOmzetThreshold" = EXCLUDED."umkmOmzetThreshold",
                   "facilityOmzetThreshold" = EXCLUDED."facilityOmzetThreshold",
                   "facilityPortionThreshold" = EXCLUDED."facilityPortionThreshold",
                   "facilityDiscount" = EXCLUDED."facilityDiscount",
                   "rounding" = EXCLUDED."rounding",
                   "updatedAt" = NOW()
                 RETURNING "perusahaanId","scheme","standardRate","umkmFinalRate","umkmOmzetThreshold","facilityOmzetThreshold","facilityPortionThreshold","facilityDiscount","rounding"`
    )
    return NextResponse.json({ data: rows?.[0] || data })
  } catch (error) {
    console.error('PUT /api/perusahaan/[id]/tax error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
