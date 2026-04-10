import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { auth } from '@/auth'
import { createAuditLog } from '@/lib/audit'
import { z } from 'zod'
import { requireRole } from '@/lib/route-auth'
import { parseWibYmd } from '@/lib/wib'

export async function PATCH(request: Request, { params }: { params: { id: string; biayaId: string } }) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR', 'MANAGER'])
    if (guard.response) return guard.response
    const perusahaanId = Number(params.id)
    const biayaId = Number(params.biayaId)
    if (!perusahaanId || !biayaId) return NextResponse.json({ error: 'Parameter tidak valid' }, { status: 400 })

    const schema = z.object({
      kategori: z.string().trim().min(1).max(80).optional(),
      deskripsi: z.string().trim().max(250).nullable().optional(),
      jumlah: z.coerce.number().positive().optional(),
      date: z.string().trim().optional(),
      gambarUrl: z.string().trim().nullable().optional(),
    })
    const parsed = schema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })

    const existingRows: Array<{ id: number; type: string; kategori: string; deskripsi: string | null; jumlah: any; date: any; source: string; gambarUrl: string | null }> =
      await prisma.$queryRaw(
        Prisma.sql`SELECT "id","type","kategori","deskripsi","jumlah","date","source","gambarUrl"
                   FROM "PerusahaanBiaya"
                   WHERE "id" = ${biayaId} AND "perusahaanId" = ${perusahaanId}
                   LIMIT 1`
      )
    if (existingRows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const existing = existingRows[0]
    if (String(existing.source || '').toUpperCase() !== 'MANUAL') {
      return NextResponse.json({ error: 'Hanya biaya manual yang bisa diedit dari sini' }, { status: 409 })
    }

    const data = parsed.data
    const dateKey = (() => {
      if (!data.date) return null
      const ymd = parseWibYmd(String(data.date))
      if (!ymd) return null
      return `${String(ymd.y).padStart(4, '0')}-${String(ymd.m).padStart(2, '0')}-${String(ymd.d).padStart(2, '0')}`
    })()
    if (data.date && !dateKey) return NextResponse.json({ error: 'date tidak valid' }, { status: 400 })
    const dateSql = dateKey ? Prisma.sql`${dateKey}::date` : Prisma.sql`"date"`
    const kategoriSql = data.kategori ? Prisma.sql`${data.kategori}` : Prisma.sql`"kategori"`
    const deskripsiSql = data.deskripsi !== undefined ? Prisma.sql`${data.deskripsi}` : Prisma.sql`"deskripsi"`
    const jumlahSql = data.jumlah !== undefined ? Prisma.sql`${Number(data.jumlah)}` : Prisma.sql`"jumlah"`
    const gambarSql = data.gambarUrl !== undefined ? Prisma.sql`${data.gambarUrl}` : Prisma.sql`"gambarUrl"`

    const rows: any = await prisma.$queryRaw(
      Prisma.sql`UPDATE "PerusahaanBiaya"
                 SET "date" = ${dateSql},
                     "kategori" = ${kategoriSql},
                     "deskripsi" = ${deskripsiSql},
                     "jumlah" = ${jumlahSql},
                     "gambarUrl" = ${gambarSql},
                     "updatedAt" = NOW()
                 WHERE "id" = ${biayaId} AND "perusahaanId" = ${perusahaanId}
                 RETURNING "id","perusahaanId","date","type","kategori","deskripsi","jumlah","gambarUrl","source","createdAt","updatedAt"`
    )
    const updated = Array.isArray(rows) ? rows[0] : rows

    const session = await auth()
    const currentUserId = session?.user?.id ? Number(session.user.id) : 1
    await createAuditLog(currentUserId, 'UPDATE', 'PerusahaanBiaya', String(biayaId), {
      perusahaanId,
      before: {
        date: existing.date,
        type: existing.type,
        kategori: existing.kategori,
        deskripsi: existing.deskripsi,
        jumlah: Number(existing.jumlah || 0),
        gambarUrl: existing.gambarUrl,
        source: existing.source,
      },
      after: updated,
      changedFields: Object.keys(data),
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('PATCH /api/perusahaan/[id]/biaya/[biayaId] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string; biayaId: string } }) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR', 'MANAGER'])
    if (guard.response) return guard.response
    const perusahaanId = Number(params.id)
    const biayaId = Number(params.biayaId)
    if (!perusahaanId || !biayaId) return NextResponse.json({ error: 'Parameter tidak valid' }, { status: 400 })

    const existingRows: Array<{ id: number; type: string; kategori: string; deskripsi: string | null; jumlah: any; date: any; source: string; gambarUrl: string | null }> =
      await prisma.$queryRaw(
        Prisma.sql`SELECT "id","type","kategori","deskripsi","jumlah","date","source","gambarUrl"
                   FROM "PerusahaanBiaya"
                   WHERE "id" = ${biayaId} AND "perusahaanId" = ${perusahaanId}
                   LIMIT 1`
      )
    if (existingRows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const existing = existingRows[0]

    await prisma.$executeRaw(
      Prisma.sql`DELETE FROM "PerusahaanBiaya" WHERE "id" = ${biayaId}`
    )

    const session = await auth()
    const currentUserId = session?.user?.id ? Number(session.user.id) : 1
    await createAuditLog(currentUserId, 'DELETE', 'PerusahaanBiaya', String(biayaId), {
      perusahaanId,
      date: existing.date,
      type: existing.type,
      kategori: existing.kategori,
      deskripsi: existing.deskripsi,
      jumlah: Number(existing.jumlah || 0),
      gambarUrl: existing.gambarUrl,
      source: existing.source,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/perusahaan/[id]/biaya/[biayaId] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
