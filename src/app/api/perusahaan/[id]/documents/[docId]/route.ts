import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { createAuditLog } from '@/lib/audit'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/route-auth'

export const dynamic = 'force-dynamic'

export async function DELETE(_: Request, { params }: { params: { id: string; docId: string } }) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'MANAGER'])
    if (guard.response) return guard.response
    const perusahaanId = Number(params.id)
    const docId = Number(params.docId)

    const existingRows: Array<{ id: number; type: string; fileName: string; fileUrl: string }> = await prisma.$queryRaw(
      Prisma.sql`SELECT "id","type","fileName","fileUrl"
                 FROM "PerusahaanDocument"
                 WHERE "id" = ${docId} AND "perusahaanId" = ${perusahaanId}
                 LIMIT 1`
    )
    if (existingRows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const existing = existingRows[0]

    await prisma.$executeRaw(
      Prisma.sql`DELETE FROM "PerusahaanDocument" WHERE "id" = ${docId}`
    )

    await createAuditLog(guard.id, 'DELETE', 'PerusahaanDocument', String(docId), {
      perusahaanId,
      type: existing.type,
      fileName: existing.fileName,
      fileUrl: existing.fileUrl,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/perusahaan/[id]/documents/[docId] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
