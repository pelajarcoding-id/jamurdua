import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/route-auth'

async function hasSnapshotTable() {
  const rows = await prisma.$queryRaw<any[]>(
    Prisma.sql`SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'PerusahaanFinanceSnapshot'
    ) AS "exists"`
  )
  return Boolean(rows?.[0]?.exists)
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR', 'MANAGER'])
    if (guard.response) return guard.response

    const perusahaanId = Number(params.id)
    if (!perusahaanId) return NextResponse.json({ error: 'perusahaanId tidak valid' }, { status: 400 })

    const exists = await hasSnapshotTable()
    if (!exists) return NextResponse.json({ data: [] })

    const { searchParams } = new URL(request.url)
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 30)))
    const startDate = searchParams.get('startDate') || null
    const endDate = searchParams.get('endDate') || null

    const where = Prisma.sql`
      WHERE "perusahaanId" = ${perusahaanId}
      ${startDate ? Prisma.sql`AND ("startDate" IS NULL OR "startDate" >= ${startDate}::date)` : Prisma.empty}
      ${endDate ? Prisma.sql`AND ("endDate" IS NULL OR "endDate" <= ${endDate}::date)` : Prisma.empty}
    `

    const rows = await prisma.$queryRaw<any[]>(
      Prisma.sql`
        SELECT "id","perusahaanId","startDate","endDate","data","createdById","createdAt"
        FROM "PerusahaanFinanceSnapshot"
        ${where}
        ORDER BY "createdAt" DESC
        LIMIT ${limit}
      `
    )

    return NextResponse.json({ data: rows || [] })
  } catch (error) {
    console.error('GET /api/perusahaan/[id]/laporan-keuangan/history error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR', 'MANAGER'])
    if (guard.response) return guard.response

    const perusahaanId = Number(params.id)
    if (!perusahaanId) return NextResponse.json({ error: 'perusahaanId tidak valid' }, { status: 400 })

    const exists = await hasSnapshotTable()
    if (!exists) {
      return NextResponse.json(
        { error: 'Tabel history laporan belum ada. Jalankan migrasi Prisma terlebih dahulu.' },
        { status: 400 }
      )
    }

    const body = await request.json().catch(() => ({} as any))
    const startDate = typeof body?.startDate === 'string' && body.startDate ? body.startDate : null
    const endDate = typeof body?.endDate === 'string' && body.endDate ? body.endDate : null
    const data = body?.data
    if (!data) return NextResponse.json({ error: 'data wajib diisi' }, { status: 400 })

    const rows = await prisma.$queryRaw<any[]>(
      Prisma.sql`
        INSERT INTO "PerusahaanFinanceSnapshot"
          ("perusahaanId","startDate","endDate","data","createdById","createdAt")
        VALUES
          (${perusahaanId}, ${startDate}::date, ${endDate}::date, ${JSON.stringify(data)}::jsonb, ${guard.id}, NOW())
        RETURNING "id","perusahaanId","startDate","endDate","data","createdById","createdAt"
      `
    )

    return NextResponse.json({ data: rows?.[0] })
  } catch (error) {
    console.error('POST /api/perusahaan/[id]/laporan-keuangan/history error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

