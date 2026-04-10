import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { createAuditLog } from '@/lib/audit'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/route-auth'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'MANAGER'])
    if (guard.response) return guard.response
    const perusahaanId = Number(params.id)
    const data = await prisma.$queryRaw(
      Prisma.sql`SELECT "id","perusahaanId","type","fileName","fileUrl","createdAt","updatedAt"
                 FROM "PerusahaanDocument"
                 WHERE "perusahaanId" = ${perusahaanId}
                 ORDER BY "updatedAt" DESC`
    )
    return NextResponse.json({ data })
  } catch (error) {
    console.error('GET /api/perusahaan/[id]/documents error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'MANAGER'])
    if (guard.response) return guard.response
    const perusahaanId = Number(params.id)
    const body = await request.json()
    const type = body?.type ? String(body.type) : ''
    const fileName = body?.fileName ? String(body.fileName) : ''
    const fileUrl = body?.fileUrl ? String(body.fileUrl) : ''

    if (!type || !fileName || !fileUrl) {
      return NextResponse.json({ error: 'type, fileName, fileUrl wajib diisi' }, { status: 400 })
    }

    const existingRows: Array<{ id: number }> = await prisma.$queryRaw(
      Prisma.sql`SELECT "id" FROM "PerusahaanDocument" WHERE "perusahaanId" = ${perusahaanId} AND "type" = ${type} LIMIT 1`
    )
    const existingId = existingRows.length > 0 ? Number(existingRows[0].id) : null

    const rows = existingId
      ? await prisma.$queryRaw(
          Prisma.sql`UPDATE "PerusahaanDocument"
                     SET "fileName" = ${fileName}, "fileUrl" = ${fileUrl}, "updatedAt" = CURRENT_TIMESTAMP
                     WHERE "id" = ${existingId}
                     RETURNING "id","perusahaanId","type","fileName","fileUrl","createdAt","updatedAt"`
        )
      : await prisma.$queryRaw(
          Prisma.sql`INSERT INTO "PerusahaanDocument" ("perusahaanId","type","fileName","fileUrl")
                     VALUES (${perusahaanId}, ${type}, ${fileName}, ${fileUrl})
                     RETURNING "id","perusahaanId","type","fileName","fileUrl","createdAt","updatedAt"`
        )
    const doc = Array.isArray(rows) ? (rows as any)[0] : rows

    await createAuditLog(guard.id, existingId ? 'UPDATE' : 'CREATE', 'PerusahaanDocument', String((doc as any).id), {
      perusahaanId,
      type,
      fileName,
      fileUrl,
    })

    return NextResponse.json({ data: doc })
  } catch (error) {
    console.error('POST /api/perusahaan/[id]/documents error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
