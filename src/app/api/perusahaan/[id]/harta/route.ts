import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/route-auth'
import { z } from 'zod'
import { ASSET_GROUPS } from '@/lib/asset-depreciation'
import { Prisma } from '@prisma/client'
import { parseWibYmd, wibStartUtc } from '@/lib/wib'

export const dynamic = 'force-dynamic'

const groupValues = ASSET_GROUPS.map(g => g.value) as [string, ...string[]]

const isMissingTable = (error: unknown) => {
  const msg = String((error as any)?.message || '')
  if (msg.includes('PerusahaanAsset') && msg.toLowerCase().includes('does not exist')) return true
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021') return true
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2010') {
    const metaCode = String((error.meta as any)?.code || '')
    if (metaCode === '42P01') return true
  }
  return false
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR', 'MANAGER'])
    if (guard.response) return guard.response

    const perusahaanId = Number(params.id)
    if (!perusahaanId) return NextResponse.json({ error: 'Invalid perusahaan id' }, { status: 400 })

    const items = await prisma.$queryRawUnsafe(
      'SELECT * FROM "PerusahaanAsset" WHERE "perusahaanId" = $1 ORDER BY "acquiredAt" DESC, "id" DESC',
      perusahaanId
    )

    return NextResponse.json({ data: items })
  } catch (error) {
    if (isMissingTable(error)) {
      return NextResponse.json({ data: [], warning: 'PERUSAHAAN_ASSET_TABLE_MISSING' })
    }
    console.error('GET /api/perusahaan/[id]/harta error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR', 'MANAGER'])
    if (guard.response) return guard.response

    const perusahaanId = Number(params.id)
    if (!perusahaanId) return NextResponse.json({ error: 'Invalid perusahaan id' }, { status: 400 })

    const schema = z.object({
      name: z.string().trim().min(1).max(200),
      group: z.enum(groupValues),
      acquiredAt: z.string().min(1),
      cost: z.coerce.number().nonnegative(),
      salvage: z.coerce.number().nonnegative().optional().default(0),
    })
    const parsed = schema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 })
    }

    const acquiredYmd = parseWibYmd(parsed.data.acquiredAt)
    if (!acquiredYmd) {
      return NextResponse.json({ error: 'acquiredAt tidak valid' }, { status: 400 })
    }

    const created = await (prisma as any).perusahaanAsset.create({
      data: {
        perusahaanId,
        name: parsed.data.name,
        group: parsed.data.group,
        acquiredAt: wibStartUtc(acquiredYmd),
        cost: Number(parsed.data.cost),
        salvage: Number(parsed.data.salvage || 0),
      },
    })

    return NextResponse.json({ data: created })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021') {
      return NextResponse.json({ error: 'Table PerusahaanAsset belum tersedia. Jalankan migrasi database terlebih dulu.' }, { status: 409 })
    }
    console.error('POST /api/perusahaan/[id]/harta error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
