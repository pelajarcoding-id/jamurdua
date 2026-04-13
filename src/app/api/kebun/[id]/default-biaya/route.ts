import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/route-auth'
import { ensureKebunAccess } from '@/lib/kebun-access'

export const dynamic = 'force-dynamic'

// GET all default biaya for a kebun
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const kebunId = parseInt(params.id)
  if (isNaN(kebunId)) return NextResponse.json({ error: 'ID Kebun tidak valid' }, { status: 400 })

  const guard = await requireRole(['ADMIN', 'PEMILIK', 'MANAGER', 'MANDOR'])
  if (guard.response) return guard.response

  const hasAccess = await ensureKebunAccess(guard.id, guard.role, kebunId)
  if (!hasAccess) return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })

  try {
    const data = await (prisma as any).kebunDefaultBiaya.findMany({
      where: { kebunId },
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json({ data })
  } catch (error: any) {
    console.error('GET /api/kebun/[id]/default-biaya error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST new default biaya
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const kebunId = parseInt(params.id)
  if (isNaN(kebunId)) return NextResponse.json({ error: 'ID Kebun tidak valid' }, { status: 400 })

  const guard = await requireRole(['ADMIN', 'PEMILIK'])
  if (guard.response) return guard.response

  const hasAccess = await ensureKebunAccess(guard.id, guard.role, kebunId)
  if (!hasAccess) return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })

  try {
    const body = await request.json()
    const { deskripsi, hargaSatuan, satuan, isAutoKg } = body

    if (!deskripsi) return NextResponse.json({ error: 'Deskripsi wajib diisi' }, { status: 400 })

    const newItem = await (prisma as any).kebunDefaultBiaya.create({
      data: {
        kebunId,
        deskripsi,
        hargaSatuan: Number(hargaSatuan) || 0,
        satuan: satuan || 'Kg',
        isAutoKg: !!isAutoKg,
      },
    })

    return NextResponse.json({ data: newItem })
  } catch (error: any) {
    console.error('POST /api/kebun/[id]/default-biaya error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
