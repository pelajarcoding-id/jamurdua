import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/route-auth'
import { parseWibYmd, wibStartUtc } from '@/lib/wib'

export const dynamic = 'force-dynamic'

async function hasNotaSawitSettingTable() {
  const rows = await prisma.$queryRaw<any[]>(
    Prisma.sql`SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'PerusahaanNotaSawitSetting'
    ) AS "exists"`,
  )
  return Boolean(rows?.[0]?.exists)
}

async function hasNotaSawitRateTable() {
  const rows = await prisma.$queryRaw<any[]>(
    Prisma.sql`SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'PerusahaanNotaSawitPphRate'
    ) AS "exists"`,
  )
  return Boolean(rows?.[0]?.exists)
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR', 'MANAGER'])
    if (guard.response) return guard.response

    const perusahaanId = Number(params.id)
    if (!perusahaanId) return NextResponse.json({ error: 'perusahaanId tidak valid' }, { status: 400 })

    const settingExists = await hasNotaSawitSettingTable()
    const rateExists = await hasNotaSawitRateTable().catch(() => false)
    if (!settingExists && !rateExists) return NextResponse.json({ data: { perusahaanId, pphRate: 0.0025, rates: [] } })

    let pphRate = 0.0025
    let updatedAt: any = null
    if (settingExists) {
      const rows = await prisma.$queryRaw<any[]>(
        Prisma.sql`SELECT "perusahaanId","pphRate","updatedAt" FROM "PerusahaanNotaSawitSetting" WHERE "perusahaanId" = ${perusahaanId} LIMIT 1`,
      )
      const row = rows?.[0]
      if (row) {
        pphRate = Number(row.pphRate || 0.0025)
        updatedAt = row.updatedAt || null
      }
    }

    const rates = rateExists
      ? await prisma.$queryRaw<any[]>(
          Prisma.sql`SELECT "effectiveFrom","pphRate","updatedAt"
                     FROM "PerusahaanNotaSawitPphRate"
                     WHERE "perusahaanId" = ${perusahaanId}
                     ORDER BY "effectiveFrom" DESC`,
        )
      : []

    return NextResponse.json({
      data: {
        perusahaanId,
        pphRate: Number.isFinite(pphRate) ? pphRate : 0.0025,
        updatedAt,
        rates: (rates || []).map((r) => ({
          effectiveFrom: r.effectiveFrom || null,
          pphRate: Number(r.pphRate ?? 0.0025),
          updatedAt: r.updatedAt || null,
        })),
      },
    })
  } catch (error) {
    console.error('GET /api/perusahaan/[id]/nota-sawit/setting error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR'])
    if (guard.response) return guard.response

    const perusahaanId = Number(params.id)
    if (!perusahaanId) return NextResponse.json({ error: 'perusahaanId tidak valid' }, { status: 400 })

    const body = await request.json().catch(() => ({} as any))
    const pphRate = Number(body?.pphRate ?? 0.0025)
    if (!Number.isFinite(pphRate) || pphRate < 0 || pphRate > 1) {
      return NextResponse.json({ error: 'pphRate tidak valid (0..1)' }, { status: 400 })
    }

    const effectiveFromRaw = body?.effectiveFrom !== undefined && body?.effectiveFrom !== null ? String(body.effectiveFrom).trim() : ''
    const ymd = effectiveFromRaw ? parseWibYmd(effectiveFromRaw) : null
    const effectiveFrom = ymd ? wibStartUtc(ymd) : null

    if (effectiveFrom) {
      const rateExists = await hasNotaSawitRateTable()
      if (!rateExists) return NextResponse.json({ error: 'Tabel tarif PPh Nota Sawit belum ada. Jalankan migrasi.' }, { status: 400 })

      const rows = await prisma.$queryRaw<any[]>(
        Prisma.sql`
          INSERT INTO "PerusahaanNotaSawitPphRate" ("perusahaanId","effectiveFrom","pphRate","createdAt","updatedAt")
          VALUES (${perusahaanId}, ${effectiveFrom}, ${pphRate}, NOW(), NOW())
          ON CONFLICT ("perusahaanId","effectiveFrom") DO UPDATE SET "pphRate" = ${pphRate}, "updatedAt" = NOW()
          RETURNING "perusahaanId","effectiveFrom","pphRate","updatedAt"
        `,
      )
      return NextResponse.json({ data: rows?.[0] || { perusahaanId, effectiveFrom, pphRate } })
    }

    const exists = await hasNotaSawitSettingTable()
    if (!exists) return NextResponse.json({ error: 'Tabel setting Nota Sawit belum ada. Jalankan migrasi.' }, { status: 400 })

    const rows = await prisma.$queryRaw<any[]>(
      Prisma.sql`
        INSERT INTO "PerusahaanNotaSawitSetting" ("perusahaanId","pphRate","createdAt","updatedAt")
        VALUES (${perusahaanId}, ${pphRate}, NOW(), NOW())
        ON CONFLICT ("perusahaanId") DO UPDATE SET "pphRate" = ${pphRate}, "updatedAt" = NOW()
        RETURNING "perusahaanId","pphRate","updatedAt"
      `,
    )
    return NextResponse.json({ data: rows?.[0] || { perusahaanId, pphRate } })
  } catch (error) {
    console.error('PUT /api/perusahaan/[id]/nota-sawit/setting error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
