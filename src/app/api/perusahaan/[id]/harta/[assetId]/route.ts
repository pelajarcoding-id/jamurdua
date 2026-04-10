import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/route-auth'
import { z } from 'zod'
import { ASSET_GROUPS } from '@/lib/asset-depreciation'
import { Prisma } from '@prisma/client'
import { parseWibYmd, wibStartUtc } from '@/lib/wib'

const groupValues = ASSET_GROUPS.map(g => g.value) as [string, ...string[]]

export async function PUT(request: Request, { params }: { params: { id: string; assetId: string } }) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR', 'MANAGER'])
    if (guard.response) return guard.response

    const perusahaanId = Number(params.id)
    const assetId = Number(params.assetId)
    if (!perusahaanId || !assetId) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

    const schema = z.object({
      name: z.string().trim().min(1).max(200),
      group: z.enum(groupValues),
      acquiredAt: z.string().min(1),
      cost: z.coerce.number().nonnegative(),
      salvage: z.coerce.number().nonnegative().optional().default(0),
      disposedAt: z.string().nullable().optional(),
      disposalType: z.enum(['SOLD', 'SCRAPPED']).nullable().optional(),
      disposalProceeds: z.coerce.number().nonnegative().optional().default(0),
      disposalNotes: z.string().max(500).nullable().optional(),
    })
    const parsed = schema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 })
    }

    const acquiredYmd = parseWibYmd(parsed.data.acquiredAt)
    if (!acquiredYmd) return NextResponse.json({ error: 'acquiredAt tidak valid' }, { status: 400 })

    const disposedAt = (() => {
      if (parsed.data.disposedAt === undefined) return undefined
      if (!parsed.data.disposedAt) return null
      const ymd = parseWibYmd(parsed.data.disposedAt)
      if (!ymd) return 'INVALID'
      return wibStartUtc(ymd)
    })()
    if (disposedAt === 'INVALID') return NextResponse.json({ error: 'disposedAt tidak valid' }, { status: 400 })
    const disposalType = parsed.data.disposedAt ? (parsed.data.disposalType || 'SOLD') : null
    const disposalProceeds = parsed.data.disposedAt ? Number(parsed.data.disposalProceeds || 0) : 0
    const disposalNotes = parsed.data.disposedAt ? (parsed.data.disposalNotes || null) : null

    if (disposedAt === undefined) {
      const updated = await (prisma as any).perusahaanAsset.update({
        where: { id: assetId, perusahaanId },
        data: {
          name: parsed.data.name,
          group: parsed.data.group,
          acquiredAt: wibStartUtc(acquiredYmd),
          cost: Number(parsed.data.cost),
          salvage: Number(parsed.data.salvage || 0),
        },
      })

      return NextResponse.json({ data: updated })
    }

    const rows: any = await prisma.$queryRawUnsafe(
      `
      UPDATE "PerusahaanAsset"
      SET
        "name" = $1,
        "group" = $2,
        "acquiredAt" = $3,
        "cost" = $4,
        "salvage" = $5,
        "disposedAt" = $6,
        "disposalType" = $7,
        "disposalProceeds" = $8,
        "disposalNotes" = $9,
        "updatedAt" = NOW()
      WHERE "id" = $10 AND "perusahaanId" = $11
      RETURNING *
      `,
      parsed.data.name,
      parsed.data.group,
      wibStartUtc(acquiredYmd),
      Number(parsed.data.cost),
      Number(parsed.data.salvage || 0),
      disposedAt,
      disposalType,
      disposalProceeds,
      disposalNotes,
      assetId,
      perusahaanId
    )

    const updated = Array.isArray(rows) ? rows[0] : rows
    return NextResponse.json({ data: updated })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021') {
      return NextResponse.json({ error: 'Table PerusahaanAsset belum tersedia. Jalankan migrasi database terlebih dulu.' }, { status: 409 })
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2022') {
      return NextResponse.json({ error: 'Struktur tabel PerusahaanAsset belum update. Jalankan migrasi database terlebih dulu.' }, { status: 409 })
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2010') {
      const metaCode = String((error.meta as any)?.code || '')
      if (metaCode === '42703') {
        return NextResponse.json({ error: 'Struktur tabel PerusahaanAsset belum update. Jalankan migrasi database terlebih dulu.' }, { status: 409 })
      }
      if (metaCode === '42P01') {
        return NextResponse.json({ error: 'Table PerusahaanAsset belum tersedia. Jalankan migrasi database terlebih dulu.' }, { status: 409 })
      }
    }
    console.error('PUT /api/perusahaan/[id]/harta/[assetId] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string; assetId: string } }) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR', 'MANAGER'])
    if (guard.response) return guard.response

    const perusahaanId = Number(params.id)
    const assetId = Number(params.assetId)
    if (!perusahaanId || !assetId) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

    await (prisma as any).perusahaanAsset.delete({
      where: { id: assetId, perusahaanId },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/perusahaan/[id]/harta/[assetId] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
