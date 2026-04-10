import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/route-auth'
import { ensureKebunAccess } from '@/lib/kebun-access'
import { Prisma } from '@prisma/client'
import { parseWibYmd } from '@/lib/wib'

export const dynamic = 'force-dynamic'

function toDateKey(ymd: { y: number; m: number; d: number }) {
  return `${String(ymd.y).padStart(4, '0')}-${String(ymd.m).padStart(2, '0')}-${String(ymd.d).padStart(2, '0')}`
}

type DraftItem = { id: string; deskripsi: string; total: number; keterangan?: string }

function normalizeItems(input: any): DraftItem[] {
  if (!Array.isArray(input)) return []
  const out: DraftItem[] = []
  for (let i = 0; i < input.length; i++) {
    const row = input[i]
    const id = typeof row?.id === 'string' && row.id.trim() ? row.id.trim() : `p-${Date.now()}-${i}`
    const deskripsi = typeof row?.deskripsi === 'string' ? row.deskripsi.trim() : ''
    const total = Math.round(Number(row?.total || 0))
    const keterangan = typeof row?.keterangan === 'string' ? row.keterangan : undefined
    if (!deskripsi && total <= 0 && !(keterangan || '').trim()) continue
    out.push({ id, deskripsi, total, ...(keterangan ? { keterangan } : {}) })
  }
  return out
}

async function hasFinalizedGajian(kebunId: number, startKey: string, endKey: string) {
  const rows = await prisma.$queryRaw<Array<{ ok: number }>>(
    Prisma.sql`SELECT 1 as ok
               FROM "Gajian"
               WHERE "kebunId" = ${kebunId}
                 AND "status" = 'FINALIZED'
                 AND ("tanggalMulai" + interval '7 hours')::date = ${startKey}::date
                 AND ("tanggalSelesai" + interval '7 hours')::date = ${endKey}::date
               LIMIT 1`,
  )
  return rows.length > 0
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR', 'MANDOR', 'MANAGER'])
    if (guard.response) return guard.response

    const kebunId = Number(params.id)
    if (Number.isNaN(kebunId)) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
    const allowed = await ensureKebunAccess(guard.id, guard.role, kebunId)
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const startYmd = parseWibYmd(searchParams.get('startDate'))
    const endYmd = parseWibYmd(searchParams.get('endDate'))
    if (!startYmd || !endYmd) return NextResponse.json({ items: [] })
    const startKey = toDateKey(startYmd)
    const endKey = toDateKey(endYmd)

    if (await hasFinalizedGajian(kebunId, startKey, endKey)) {
      return NextResponse.json({ items: [], isFinalized: true })
    }

    const rows = await prisma.$queryRaw<Array<{ items: any }>>(
      Prisma.sql`SELECT "items"
                 FROM "KebunGajianPotonganDraft"
                 WHERE "kebunId" = ${kebunId}
                   AND "startDate" = ${startKey}::date
                   AND "endDate" = ${endKey}::date
                 LIMIT 1`,
    )
    const items = rows[0]?.items
    return NextResponse.json({ items: normalizeItems(items) })
  } catch (error) {
    console.error('GET /api/kebun/[id]/gajian-potongan-draft error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR', 'MANDOR', 'MANAGER'])
    if (guard.response) return guard.response

    const kebunId = Number(params.id)
    if (Number.isNaN(kebunId)) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
    const allowed = await ensureKebunAccess(guard.id, guard.role, kebunId)
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json().catch(() => ({}))
    const startYmd = parseWibYmd(body?.startDate)
    const endYmd = parseWibYmd(body?.endDate)
    if (!startYmd || !endYmd) return NextResponse.json({ error: 'startDate/endDate tidak valid' }, { status: 400 })
    const startKey = toDateKey(startYmd)
    const endKey = toDateKey(endYmd)

    if (await hasFinalizedGajian(kebunId, startKey, endKey)) {
      return NextResponse.json({ error: 'Gajian periode ini sudah FINAL' }, { status: 409 })
    }

    const items = normalizeItems(body?.items)
    const rows = await prisma.$queryRaw<Array<{ items: any }>>(
      Prisma.sql`INSERT INTO "KebunGajianPotonganDraft" ("kebunId","startDate","endDate","items","createdAt","updatedAt")
                 VALUES (${kebunId}, ${startKey}::date, ${endKey}::date, ${Prisma.sql`${JSON.stringify(items)}::jsonb`}, NOW(), NOW())
                 ON CONFLICT ("kebunId","startDate","endDate")
                 DO UPDATE SET "items" = EXCLUDED."items", "updatedAt" = NOW()
                 RETURNING "items"`,
    )
    return NextResponse.json({ items: normalizeItems(rows[0]?.items) })
  } catch (error) {
    console.error('POST /api/kebun/[id]/gajian-potongan-draft error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR', 'MANDOR', 'MANAGER'])
    if (guard.response) return guard.response

    const kebunId = Number(params.id)
    if (Number.isNaN(kebunId)) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
    const allowed = await ensureKebunAccess(guard.id, guard.role, kebunId)
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const itemId = String(searchParams.get('itemId') || '').trim()
    const startYmd = parseWibYmd(searchParams.get('startDate'))
    const endYmd = parseWibYmd(searchParams.get('endDate'))
    if (!itemId) return NextResponse.json({ error: 'itemId wajib' }, { status: 400 })
    if (!startYmd || !endYmd) return NextResponse.json({ error: 'startDate/endDate tidak valid' }, { status: 400 })
    const startKey = toDateKey(startYmd)
    const endKey = toDateKey(endYmd)

    if (await hasFinalizedGajian(kebunId, startKey, endKey)) {
      return NextResponse.json({ error: 'Gajian periode ini sudah FINAL' }, { status: 409 })
    }

    const existing = await prisma.$queryRaw<Array<{ items: any }>>(
      Prisma.sql`SELECT "items"
                 FROM "KebunGajianPotonganDraft"
                 WHERE "kebunId" = ${kebunId}
                   AND "startDate" = ${startKey}::date
                   AND "endDate" = ${endKey}::date
                 LIMIT 1`,
    )
    const items = normalizeItems(existing[0]?.items).filter((x) => x.id !== itemId)
    await prisma.$executeRaw(
      Prisma.sql`UPDATE "KebunGajianPotonganDraft"
                 SET "items" = ${Prisma.sql`${JSON.stringify(items)}::jsonb`}, "updatedAt" = NOW()
                 WHERE "kebunId" = ${kebunId}
                   AND "startDate" = ${startKey}::date
                   AND "endDate" = ${endKey}::date`,
    )
    return NextResponse.json({ items })
  } catch (error) {
    console.error('DELETE /api/kebun/[id]/gajian-potongan-draft error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
