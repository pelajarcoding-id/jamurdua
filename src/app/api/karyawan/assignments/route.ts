import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const userIdParam = searchParams.get('userId')
  const userIdsParam = searchParams.get('userIds')
  const active = searchParams.get('active') === '1'

  if (userIdParam) {
    const userId = Number(userIdParam)
    if (!userId) return NextResponse.json({ data: [] })
    const data = await prisma.karyawanAssignment.findMany({
      where: { userId },
      include: { location: true },
      orderBy: { startDate: 'desc' },
    })
    return NextResponse.json({ data })
  }

  if (userIdsParam) {
    const ids = userIdsParam
      .split(',')
      .map((v) => Number(v))
      .filter((v) => Number.isFinite(v))
    if (ids.length === 0) return NextResponse.json({ data: [] })
    const data = await prisma.karyawanAssignment.findMany({
      where: {
        userId: { in: ids },
        ...(active ? { endDate: null } : {}),
      },
      include: { location: true },
      orderBy: { startDate: 'desc' },
    })
    return NextResponse.json({ data })
  }

  return NextResponse.json({ data: [] })
}
