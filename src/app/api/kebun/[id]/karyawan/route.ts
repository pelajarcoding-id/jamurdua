import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/route-auth'
import { ensureKebunAccess } from '@/lib/kebun-access'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR', 'MANDOR', 'MANAGER'])
    if (guard.response) return guard.response

    const kebunId = Number(params.id)
    if (!Number.isFinite(kebunId) || kebunId <= 0) {
      return NextResponse.json({ error: 'ID Kebun tidak valid' }, { status: 400 })
    }

    const allowed = await ensureKebunAccess(guard.id, guard.role, kebunId)
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const limit = Math.min(1000, Math.max(1, Number(searchParams.get('limit') || 1000)))
    const search = String(searchParams.get('search') || '').trim()

    const and: any[] = [
      {
        OR: [
          { kebunId },
          { role: 'SUPIR' },
        ],
      },
      { role: { in: ['KARYAWAN', 'MANDOR', 'MANAGER', 'SUPIR'] } },
      { OR: [{ status: 'AKTIF' }, { status: 'Aktif' }, { status: null }] },
    ]

    if (search) {
      and.push({ name: { contains: search, mode: 'insensitive' } })
    }

    const users = await prisma.user.findMany({
      where: { AND: and },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
      take: limit,
    })

    return NextResponse.json({ data: users })
  } catch (error) {
    console.error('GET /api/kebun/[id]/karyawan error:', error)
    return NextResponse.json({ error: 'Gagal mengambil data karyawan' }, { status: 500 })
  }
}
