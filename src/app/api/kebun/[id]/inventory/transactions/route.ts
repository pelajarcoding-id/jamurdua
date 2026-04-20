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
    const limit = Math.min(Number(searchParams.get('limit') || '20'), 100)
    const itemIdParam = searchParams.get('itemId')
    const itemId = itemIdParam ? Number(itemIdParam) : null
    if (itemIdParam && Number.isNaN(itemId)) {
      return NextResponse.json({ error: 'Invalid itemId' }, { status: 400 })
    }

    const rows = await (prisma as any).kebunInventoryTransaction.findMany({
      where: {
        kebunId,
        ...(itemId ? { itemId } : {}),
      },
      orderBy: { date: 'desc' },
      take: limit,
      select: {
        id: true,
        type: true,
        quantity: true,
        notes: true,
        imageUrl: true,
        date: true,
        createdAt: true,
        kendaraanPlatNomor: true,
        item: { select: { id: true, name: true, unit: true, category: true } },
        user: { select: { id: true, name: true } },
        kendaraan: { select: { platNomor: true, merk: true, jenis: true } },
      }
    })

    return NextResponse.json({ data: rows })
  } catch (error) {
    console.error('GET /api/kebun/[id]/inventory/transactions error:', error)
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
    const currentUserId = guard.id
    if (!Number.isFinite(currentUserId) || currentUserId <= 0) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const schema = z.object({
      itemId: z.coerce.number().int().positive(),
      type: z.enum(['IN', 'OUT', 'ADJUSTMENT']),
      quantity: z.coerce.number().positive(),
      date: z.string().optional(),
      notes: z.string().trim().max(500).optional(),
      imageUrl: z.string().trim().max(2048).optional(),
      kendaraanPlatNomor: z.string().trim().max(64).optional(),
    })
    const parsed = schema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 })
    }
    const { itemId, type, quantity, date, notes, imageUrl, kendaraanPlatNomor } = parsed.data
    const kendaraanPlatNomorFinal = String(kendaraanPlatNomor || '').trim()

    const item = await (prisma as any).kebunInventoryItem.findFirst({ where: { id: itemId, kebunId } })
    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

    const result = await prisma.$transaction(async (tx) => {
      const currentStock = Number(item?.stock || 0)
      let newStock = currentStock
      if (type === 'IN') newStock = currentStock + Number(quantity)
      if (type === 'OUT') newStock = currentStock - Number(quantity)
      if (type === 'ADJUSTMENT') newStock = Number(quantity)
      if (newStock < 0) {
        throw new Error('Stok tidak mencukupi')
      }

      const stock = await (tx as any).kebunInventoryItem.update({
        where: { id: itemId },
        data: { stock: newStock },
      })

      const trx = await (tx as any).kebunInventoryTransaction.create({
        data: {
          kebunId,
          itemId,
          type,
          quantity: Number(quantity),
          notes,
          imageUrl: imageUrl || null,
          kendaraanPlatNomor: kendaraanPlatNomorFinal ? kendaraanPlatNomorFinal : null,
          date: date ? new Date(date) : new Date(),
          userId: currentUserId,
        },
      })
      return { stock, trx }
    })

    return NextResponse.json(result)
  } catch (error: any) {
    if (error?.message === 'Stok tidak mencukupi') {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('POST /api/kebun/[id]/inventory/transactions error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const kebunId = Number(params.id)
    if (Number.isNaN(kebunId)) {
      return NextResponse.json({ error: 'Invalid kebunId' }, { status: 400 })
    }
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'MANDOR', 'MANAGER'])
    if (guard.response) return guard.response
    const allowed = await ensureKebunAccess(guard.id, guard.role, kebunId)
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const currentUserId = guard.id
    if (!Number.isFinite(currentUserId) || currentUserId <= 0) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const schema = z.object({
      id: z.coerce.number().int().positive(),
      quantity: z.coerce.number().positive(),
      date: z.string().optional(),
      notes: z.string().trim().max(500).optional(),
      imageUrl: z.string().trim().max(2048).optional(),
      kendaraanPlatNomor: z.string().trim().max(64).optional(),
    })
    const parsed = schema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 })
    }
    const { id, quantity, date, notes, imageUrl, kendaraanPlatNomor } = parsed.data
    const kendaraanPlatNomorFinal = String(kendaraanPlatNomor || '').trim()

    const existing = await (prisma as any).kebunInventoryTransaction.findFirst({
      where: { id, kebunId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Transaksi tidak ditemukan' }, { status: 404 })
    }
    if (existing.type === 'ADJUSTMENT') {
      return NextResponse.json({ error: 'Transaksi penyesuaian tidak dapat diedit' }, { status: 400 })
    }

    const item = await (prisma as any).kebunInventoryItem.findFirst({ where: { id: existing.itemId, kebunId } })
    if (!item) return NextResponse.json({ error: 'Item tidak ditemukan' }, { status: 404 })

    const result = await prisma.$transaction(async (tx) => {
      const currentStock = Number(item?.stock || 0)
      const oldQty = Number(existing.quantity || 0)
      const oldEffect = existing.type === 'IN' ? oldQty : -oldQty
      const newEffect = existing.type === 'IN' ? Number(quantity) : -Number(quantity)
      const newStock = currentStock - oldEffect + newEffect
      if (newStock < 0) {
        throw new Error('Stok tidak mencukupi')
      }

      const stock = await (tx as any).kebunInventoryItem.update({
        where: { id: existing.itemId },
        data: { stock: newStock },
      })

      const trx = await (tx as any).kebunInventoryTransaction.update({
        where: { id: existing.id },
        data: {
          quantity: Number(quantity),
          notes,
          ...(typeof kendaraanPlatNomor !== 'undefined' ? { kendaraanPlatNomor: kendaraanPlatNomorFinal ? kendaraanPlatNomorFinal : null } : {}),
          ...(typeof imageUrl !== 'undefined' ? { imageUrl: imageUrl || null } : {}),
          date: date ? new Date(date) : existing.date,
          userId: currentUserId,
        },
      })
      return { stock, trx }
    })

    return NextResponse.json(result)
  } catch (error: any) {
    if (error?.message === 'Stok tidak mencukupi') {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('PATCH /api/kebun/[id]/inventory/transactions error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
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
    const id = Number(searchParams.get('id') || '')
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'ID transaksi tidak valid' }, { status: 400 })
    }

    const existing = await (prisma as any).kebunInventoryTransaction.findFirst({
      where: { id, kebunId },
      select: { id: true, itemId: true, type: true, quantity: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Transaksi tidak ditemukan' }, { status: 404 })
    }
    if (existing.type === 'ADJUSTMENT') {
      return NextResponse.json({ error: 'Transaksi penyesuaian tidak dapat dihapus' }, { status: 400 })
    }

    const item = await (prisma as any).kebunInventoryItem.findFirst({ where: { id: existing.itemId, kebunId } })
    if (!item) return NextResponse.json({ error: 'Item tidak ditemukan' }, { status: 404 })

    const result = await prisma.$transaction(async (tx) => {
      const currentStock = Number(item?.stock || 0)
      const oldQty = Number(existing.quantity || 0)
      let newStock = currentStock

      if (existing.type === 'IN') {
        newStock = currentStock - oldQty
      } else if (existing.type === 'OUT') {
        newStock = currentStock + oldQty
      }

      if (newStock < 0) {
        throw new Error('Stok tidak boleh kurang dari 0')
      }

      const stock = await (tx as any).kebunInventoryItem.update({
        where: { id: existing.itemId },
        data: { stock: newStock },
      })
      await (tx as any).kebunInventoryTransaction.delete({ where: { id: existing.id } })
      return { stock }
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error('DELETE /api/kebun/[id]/inventory/transactions error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
