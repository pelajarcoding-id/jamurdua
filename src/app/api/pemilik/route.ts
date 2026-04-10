import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/route-auth'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR', 'MANAGER', 'MANDOR'])
    if (guard.response) return guard.response

    const pemilik = await prisma.user.findFirst({
      where: { role: 'PEMILIK' },
      select: { id: true, name: true },
      orderBy: { id: 'asc' },
    })

    return NextResponse.json({ data: pemilik || null })
  } catch (error) {
    console.error('GET /api/pemilik error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
