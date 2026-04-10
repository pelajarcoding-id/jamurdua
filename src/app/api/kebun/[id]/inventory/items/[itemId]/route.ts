import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/route-auth'
import { ensureKebunAccess } from '@/lib/kebun-access'

export async function PATCH(request: Request, { params }: { params: { id: string; itemId: string } }) {
  try {
    const kebunId = Number(params.id)
    const itemId = Number(params.itemId)
    if (Number.isNaN(kebunId) || Number.isNaN(itemId)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
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
      kendaraanPlatNomor: z.string().trim().max(32).optional(),
      imageUrl: z.string().trim().max(2048).nullable().optional(),
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

    const existing = await (prisma as any).kebunInventoryItem.findFirst({
      where: { id: itemId, kebunId },
    })
    if (!existing) return NextResponse.json({ error: 'Item tidak ditemukan' }, { status: 404 })

    const { name, category, unit, minStock, kendaraanPlatNomor, imageUrl } = parsed.data
    const updated = await (prisma as any).kebunInventoryItem.update({
      where: { id: itemId },
      data: {
        name,
        category: category && category.length > 0 ? category : null,
        unit,
        minStock,
        kendaraanPlatNomor: kendaraanPlatNomor || null,
        ...(typeof imageUrl !== 'undefined' ? { imageUrl: imageUrl || null } : {}),
      },
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

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('PATCH /api/kebun/[id]/inventory/items/[itemId] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string; itemId: string } }) {
  try {
    const kebunId = Number(params.id)
    const itemId = Number(params.itemId)
    if (Number.isNaN(kebunId) || Number.isNaN(itemId)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    }

    const guard = await requireRole(['ADMIN', 'PEMILIK', 'MANDOR', 'MANAGER'])
    if (guard.response) return guard.response
    const allowed = await ensureKebunAccess(guard.id, guard.role, kebunId)
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const item = await (prisma as any).kebunInventoryItem.findFirst({
      where: { id: itemId, kebunId },
      select: { id: true, stock: true },
    })
    if (!item) return NextResponse.json({ error: 'Item tidak ditemukan' }, { status: 404 })

    const stock = Number(item.stock || 0)
    if (stock !== 0) {
      return NextResponse.json({ error: 'Barang tidak dapat dihapus karena stok masih ada' }, { status: 400 })
    }

    const trxCount = await (prisma as any).kebunInventoryTransaction.count({
      where: { kebunId, itemId },
    })
    if (Number(trxCount || 0) > 0) {
      return NextResponse.json({ error: 'Barang tidak dapat dihapus karena sudah memiliki transaksi' }, { status: 400 })
    }

    await (prisma as any).kebunInventoryItem.delete({ where: { id: itemId } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/kebun/[id]/inventory/items/[itemId] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

