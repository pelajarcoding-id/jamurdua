import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/route-auth'
import { ensureKebunAccess } from '@/lib/kebun-access'

export const dynamic = 'force-dynamic'

// PUT update default biaya
export async function PUT(
  request: Request,
  { params }: { params: { id: string; biayaId: string } }
) {
  const kebunId = parseInt(params.id)
  const biayaId = parseInt(params.biayaId)
  if (isNaN(kebunId) || isNaN(biayaId)) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })

  const guard = await requireRole(['ADMIN', 'PEMILIK'])
  if (guard.response) return guard.response

  const hasAccess = await ensureKebunAccess(guard.id, guard.role, kebunId)
  if (!hasAccess) return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })

  try {
    const body = await request.json()
    const { deskripsi, hargaSatuan, satuan, isAutoKg, kategori } = body

    const updated = await (prisma as any).kebunDefaultBiaya.update({
      where: { id: biayaId, kebunId },
      data: {
        deskripsi,
        hargaSatuan: typeof hargaSatuan !== 'undefined' ? Number(hargaSatuan) : undefined,
        satuan,
        isAutoKg: typeof isAutoKg !== 'undefined' ? !!isAutoKg : undefined,
        kategori: typeof kategori !== 'undefined' ? kategori : undefined,
      },
    })

    return NextResponse.json({ data: updated })
  } catch (error: any) {
    console.error('PUT /api/kebun/[id]/default-biaya/[biayaId] error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}

// DELETE default biaya
export async function DELETE(
  request: Request,
  { params }: { params: { id: string; biayaId: string } }
) {
  const kebunId = parseInt(params.id)
  const biayaId = parseInt(params.biayaId)
  if (isNaN(kebunId) || isNaN(biayaId)) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })

  const guard = await requireRole(['ADMIN', 'PEMILIK'])
  if (guard.response) return guard.response

  const hasAccess = await ensureKebunAccess(guard.id, guard.role, kebunId)
  if (!hasAccess) return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })

  try {
    await (prisma as any).kebunDefaultBiaya.delete({
      where: { id: biayaId, kebunId },
    })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('DELETE /api/kebun/[id]/default-biaya/[biayaId] error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
