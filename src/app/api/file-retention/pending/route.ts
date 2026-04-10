import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/route-auth'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  const guard = await requireRole(['ADMIN'])
  if (guard.response) return guard.response

  const { searchParams } = new URL(request.url)
  const take = Math.min(Math.max(Number(searchParams.get('limit') || '100'), 1), 500)
  const status = (searchParams.get('status') || 'all').toLowerCase()
  const now = new Date()

  const where: any = {}
  if (status === 'due') where.deleteAt = { lte: now }
  if (status === 'upcoming') where.deleteAt = { gt: now }

  const items = await (prisma as any).pendingFileDeletion.findMany({
    where,
    orderBy: [{ deleteAt: 'asc' }, { id: 'asc' }],
    take,
  })

  const dueCount = await (prisma as any).pendingFileDeletion.count({
    where: { deleteAt: { lte: now } },
  })

  const total = await (prisma as any).pendingFileDeletion.count()

  return NextResponse.json({ data: items, total, dueCount })
}
