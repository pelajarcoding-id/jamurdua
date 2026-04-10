import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { createAuditLog } from '@/lib/audit'
import { requireRole } from '@/lib/route-auth'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'MANAGER'])
    if (guard.response) return guard.response
    const perusahaanId = Number(params.id)
    if (!perusahaanId) return NextResponse.json({ error: 'perusahaanId tidak valid' }, { status: 400 })

    const rows: Array<{ name: string }> = await prisma.$queryRaw(
      Prisma.sql`
        SELECT c."name" AS name
        FROM "PerusahaanBiayaKategori" c
        WHERE c."perusahaanId" = ${perusahaanId}
        ORDER BY c."name" ASC
      `
    )

    return NextResponse.json({ data: rows.map(r => r.name).filter(Boolean) })
  } catch (error) {
    console.error('GET /api/perusahaan/[id]/biaya/categories error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'MANAGER'])
    if (guard.response) return guard.response
    const perusahaanId = Number(params.id)
    if (!perusahaanId) return NextResponse.json({ error: 'perusahaanId tidak valid' }, { status: 400 })

    const body = await request.json().catch(() => ({}))
    const name = body?.name ? String(body.name).trim() : ''
    if (!name) return NextResponse.json({ error: 'name wajib diisi' }, { status: 400 })
    const nameLower = name.toLowerCase()

    const rows: any = await prisma.$queryRaw(
      Prisma.sql`
        INSERT INTO "PerusahaanBiayaKategori" ("perusahaanId","name","nameLower","updatedAt")
        VALUES (${perusahaanId}, ${name}, ${nameLower}, CURRENT_TIMESTAMP)
        ON CONFLICT ("perusahaanId","nameLower") DO UPDATE
          SET "name" = EXCLUDED."name", "updatedAt" = CURRENT_TIMESTAMP
        RETURNING "id","perusahaanId","name","nameLower","createdAt","updatedAt"
      `
    )
    const data = Array.isArray(rows) ? rows[0] : rows

    await createAuditLog(guard.id, 'UPDATE', 'PerusahaanBiayaKategori', String(data.id), {
      perusahaanId,
      name,
    })

    return NextResponse.json({ data })
  } catch (error) {
    console.error('POST /api/perusahaan/[id]/biaya/categories error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'MANAGER'])
    if (guard.response) return guard.response
    const perusahaanId = Number(params.id)
    if (!perusahaanId) return NextResponse.json({ error: 'perusahaanId tidak valid' }, { status: 400 })

    const { searchParams } = new URL(request.url)
    const name = (searchParams.get('name') || '').trim()
    const idRaw = searchParams.get('id')
    const id = idRaw ? Number(idRaw) : null

    if (!name && !id) return NextResponse.json({ error: 'name atau id wajib diisi' }, { status: 400 })

    const beforeRows: Array<{ id: number; name: string }> = await prisma.$queryRaw(
      id
        ? Prisma.sql`SELECT "id","name" FROM "PerusahaanBiayaKategori" WHERE "perusahaanId" = ${perusahaanId} AND "id" = ${id} LIMIT 1`
        : Prisma.sql`SELECT "id","name" FROM "PerusahaanBiayaKategori" WHERE "perusahaanId" = ${perusahaanId} AND "nameLower" = ${name.toLowerCase()} LIMIT 1`
    )
    if (beforeRows.length === 0) return NextResponse.json({ ok: true })

    await prisma.$executeRaw(
      id
        ? Prisma.sql`DELETE FROM "PerusahaanBiayaKategori" WHERE "perusahaanId" = ${perusahaanId} AND "id" = ${id}`
        : Prisma.sql`DELETE FROM "PerusahaanBiayaKategori" WHERE "perusahaanId" = ${perusahaanId} AND "nameLower" = ${name.toLowerCase()}`
    )

    await createAuditLog(guard.id, 'DELETE', 'PerusahaanBiayaKategori', String(beforeRows[0].id), {
      perusahaanId,
      name: beforeRows[0].name,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/perusahaan/[id]/biaya/categories error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
