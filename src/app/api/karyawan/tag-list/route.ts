import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/route-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR', 'MANAGER', 'MANDOR'])
    if (guard.response) return guard.response

    const { searchParams } = new URL(request.url)
    const limit = Math.min(1000, Math.max(1, Number(searchParams.get('limit') || 1000)))
    const search = (searchParams.get('search') || '').trim()

    const where: any = {
      AND: [
        { OR: [{ status: 'AKTIF' }, { status: null }] },
        { role: { notIn: ['ADMIN', 'PEMILIK'] } },
      ],
    }

    if (search) {
      where.AND.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      })
    }

    const users = await prisma.user.findMany({
      where,
      take: limit,
      orderBy: { name: 'asc' },
      select: { id: true, name: true, role: true, jobType: true, status: true },
    })

    return NextResponse.json({ data: users })
  } catch (error) {
    console.error('GET /api/karyawan/tag-list error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
