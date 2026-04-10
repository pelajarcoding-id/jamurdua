import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/route-auth'
import { ensureKebunAccess } from '@/lib/kebun-access'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const kebunId = Number(params.id)
    if (Number.isNaN(kebunId)) {
      return NextResponse.json({ error: 'Invalid kebunId' }, { status: 400 })
    }
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'MANDOR', 'MANAGER'])
    if (guard.response) return guard.response
    const allowed = await ensureKebunAccess(guard.id, guard.role, kebunId)
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const { searchParams } = new URL(request.url)
    const search = (searchParams.get('search') || '').trim()

    const where: { OR?: Array<Record<string, any>> } = {}
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
      ]
    }

    const items = await (prisma as any).kebunInventoryItem.findMany({
      where: {
        kebunId,
        ...where,
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        category: true,
        unit: true,
        minStock: true,
        stock: true,
        imageUrl: true,
        kendaraanPlatNomor: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({
      data: items,
    })
  } catch (error) {
    console.error('GET /api/kebun/[id]/inventory error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const kebunId = Number(params.id)
    if (Number.isNaN(kebunId)) {
      return NextResponse.json({ error: 'Invalid kebunId' }, { status: 400 })
    }
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'MANDOR', 'MANAGER'])
    if (guard.response) return guard.response
    const allowed = await ensureKebunAccess(guard.id, guard.role, kebunId)
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const schema = z.object({
      name: z.string().trim().min(1).max(128),
      category: z.string().trim().max(64).optional(),
      unit: z.string().trim().min(1).max(32),
      minStock: z.coerce.number().nonnegative(),
      stock: z.coerce.number().nonnegative(),
      kendaraanPlatNomor: z.string().trim().max(32).optional(),
      imageUrl: z.string().trim().max(2048).optional(),
    }).superRefine((data, ctx) => {
      if ((data.category || '').toLowerCase() === 'kendaraan' && !data.kendaraanPlatNomor) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Kendaraan wajib dipilih',
          path: ['kendaraanPlatNomor'],
        })
      }
    })
    const parsed = schema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 })
    }
    const { name, category, unit, minStock, stock, kendaraanPlatNomor, imageUrl } = parsed.data

    const item = await (prisma as any).kebunInventoryItem.create({
      data: {
        kebunId,
        name,
        category: category && category.length > 0 ? category : null,
        unit,
        minStock,
        stock,
        imageUrl: imageUrl || null,
        kendaraanPlatNomor: kendaraanPlatNomor || null,
      },
    })

    return NextResponse.json({ data: item }, { status: 201 })
  } catch (error) {
    console.error('POST /api/kebun/[id]/inventory error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
