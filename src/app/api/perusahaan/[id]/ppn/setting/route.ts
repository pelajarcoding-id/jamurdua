import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/route-auth'

async function hasPpnSettingTable() {
  const rows = await prisma.$queryRaw<any[]>(
    Prisma.sql`SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'PerusahaanPpnSetting'
    ) AS "exists"`
  )
  return Boolean(rows?.[0]?.exists)
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR', 'MANAGER'])
    if (guard.response) return guard.response

    const perusahaanId = Number(params.id)
    if (!perusahaanId) return NextResponse.json({ error: 'perusahaanId tidak valid' }, { status: 400 })

    const exists = await hasPpnSettingTable()
    if (!exists) return NextResponse.json({ data: { perusahaanId, ppnRate: 0.11 } })

    const rows = await prisma.$queryRaw<any[]>(
      Prisma.sql`SELECT "perusahaanId","ppnRate","updatedAt" FROM "PerusahaanPpnSetting" WHERE "perusahaanId" = ${perusahaanId} LIMIT 1`
    )
    const row = rows?.[0]
    if (!row) return NextResponse.json({ data: { perusahaanId, ppnRate: 0.11 } })
    return NextResponse.json({ data: { perusahaanId, ppnRate: Number(row.ppnRate || 0.11), updatedAt: row.updatedAt || null } })
  } catch (error) {
    console.error('GET /api/perusahaan/[id]/ppn/setting error:', error)
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
    const ppnRate = Number(body?.ppnRate ?? 0.11)
    if (!Number.isFinite(ppnRate) || ppnRate < 0 || ppnRate > 1) {
      return NextResponse.json({ error: 'ppnRate tidak valid (0..1)' }, { status: 400 })
    }

    const exists = await hasPpnSettingTable()
    if (!exists) return NextResponse.json({ error: 'Tabel setting PPN belum ada. Jalankan migrasi.' }, { status: 400 })

    const rows = await prisma.$queryRaw<any[]>(
      Prisma.sql`
        INSERT INTO "PerusahaanPpnSetting" ("perusahaanId","ppnRate","createdAt","updatedAt")
        VALUES (${perusahaanId}, ${ppnRate}, NOW(), NOW())
        ON CONFLICT ("perusahaanId") DO UPDATE SET "ppnRate" = ${ppnRate}, "updatedAt" = NOW()
        RETURNING "perusahaanId","ppnRate","updatedAt"
      `
    )
    return NextResponse.json({ data: rows?.[0] || { perusahaanId, ppnRate } })
  } catch (error) {
    console.error('PUT /api/perusahaan/[id]/ppn/setting error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

