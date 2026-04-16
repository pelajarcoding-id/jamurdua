import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/route-auth'
import { ensureKebunAccess } from '@/lib/kebun-access'
import { createAuditLog } from '@/lib/audit'

export const dynamic = 'force-dynamic'

async function ensureKebunBoronganKategoriTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "KebunBoronganKategori" (
      "id" SERIAL PRIMARY KEY,
      "kebunId" INTEGER NOT NULL,
      "name" TEXT NOT NULL,
      "nameLower" TEXT NOT NULL,
      "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `)
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "KebunBoronganKategori_kebunId_nameLower_key"
    ON "KebunBoronganKategori" ("kebunId", "nameLower");
  `)
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "KebunBoronganKategori_kebunId_idx"
    ON "KebunBoronganKategori" ("kebunId");
  `)
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    await ensureKebunBoronganKategoriTable()
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR', 'MANDOR', 'MANAGER'])
    if (guard.response) return guard.response
    const kebunId = Number(params.id)
    if (!kebunId) return NextResponse.json({ error: 'kebunId tidak valid' }, { status: 400 })
    const allowed = await ensureKebunAccess(guard.id, guard.role, kebunId)
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const rows: Array<{ id: number; name: string }> = await prisma.$queryRaw(
      Prisma.sql`
        SELECT c."id" AS id, c."name" AS name
        FROM "KebunBoronganKategori" c
        WHERE c."kebunId" = ${kebunId}
        ORDER BY c."name" ASC
      `,
    )

    return NextResponse.json({ data: rows })
  } catch (error) {
    console.error('GET /api/kebun/[id]/borongan/categories error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    await ensureKebunBoronganKategoriTable()
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'MANDOR', 'MANAGER'])
    if (guard.response) return guard.response
    const kebunId = Number(params.id)
    if (!kebunId) return NextResponse.json({ error: 'kebunId tidak valid' }, { status: 400 })
    const allowed = await ensureKebunAccess(guard.id, guard.role, kebunId)
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json().catch(() => ({}))
    const name = body?.name ? String(body.name).trim() : ''
    if (!name) return NextResponse.json({ error: 'name wajib diisi' }, { status: 400 })
    const nameLower = name.toLowerCase()

    const rows: any = await prisma.$queryRaw(
      Prisma.sql`
        INSERT INTO "KebunBoronganKategori" ("kebunId","name","nameLower","updatedAt")
        VALUES (${kebunId}, ${name}, ${nameLower}, CURRENT_TIMESTAMP)
        ON CONFLICT ("kebunId","nameLower") DO UPDATE
          SET "name" = EXCLUDED."name", "updatedAt" = CURRENT_TIMESTAMP
        RETURNING "id","kebunId","name","nameLower","createdAt","updatedAt"
      `,
    )
    const data = Array.isArray(rows) ? rows[0] : rows

    await createAuditLog(guard.id, 'UPDATE', 'KebunBoronganKategori', String(data.id), {
      kebunId,
      name,
    })

    return NextResponse.json({ data })
  } catch (error) {
    console.error('POST /api/kebun/[id]/borongan/categories error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    await ensureKebunBoronganKategoriTable()
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'MANDOR', 'MANAGER'])
    if (guard.response) return guard.response
    const kebunId = Number(params.id)
    if (!kebunId) return NextResponse.json({ error: 'kebunId tidak valid' }, { status: 400 })
    const allowed = await ensureKebunAccess(guard.id, guard.role, kebunId)
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const name = (searchParams.get('name') || '').trim()
    const idRaw = searchParams.get('id')
    const id = idRaw ? Number(idRaw) : null
    if (!name && !id) return NextResponse.json({ error: 'name atau id wajib diisi' }, { status: 400 })

    const beforeRows: Array<{ id: number; name: string; nameLower: string }> = await prisma.$queryRaw(
      id
        ? Prisma.sql`SELECT "id","name","nameLower" FROM "KebunBoronganKategori" WHERE "kebunId" = ${kebunId} AND "id" = ${id} LIMIT 1`
        : Prisma.sql`SELECT "id","name","nameLower" FROM "KebunBoronganKategori" WHERE "kebunId" = ${kebunId} AND "nameLower" = ${name.toLowerCase()} LIMIT 1`,
    )
    if (beforeRows.length === 0) return NextResponse.json({ ok: true })

    const usedRows: Array<{ exists: number }> = await prisma.$queryRaw(
      Prisma.sql`
        SELECT 1 as "exists"
        FROM "PekerjaanKebun" p
        WHERE p."kebunId" = ${kebunId}
          AND p."upahBorongan" = true
          AND lower(coalesce(p."kategoriBorongan", '')) = ${beforeRows[0].nameLower}
        LIMIT 1
      `,
    )
    if (usedRows.length > 0) {
      return NextResponse.json({ error: 'Kategori sudah dipakai pada data borongan dan tidak bisa dihapus' }, { status: 400 })
    }

    await prisma.$executeRaw(
      id
        ? Prisma.sql`DELETE FROM "KebunBoronganKategori" WHERE "kebunId" = ${kebunId} AND "id" = ${id}`
        : Prisma.sql`DELETE FROM "KebunBoronganKategori" WHERE "kebunId" = ${kebunId} AND "nameLower" = ${name.toLowerCase()}`,
    )

    await createAuditLog(guard.id, 'DELETE', 'KebunBoronganKategori', String(beforeRows[0].id), {
      kebunId,
      name: beforeRows[0].name,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/kebun/[id]/borongan/categories error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

