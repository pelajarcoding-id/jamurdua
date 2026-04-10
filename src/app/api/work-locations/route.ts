import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

export const dynamic = 'force-dynamic'

const ensureDefaultLocations = async () => {
  const baseLocations = [
    { name: 'Kantor Pusat', type: 'KANTOR_PUSAT' },
    { name: 'Gudang', type: 'GUDANG' },
  ]

  for (const loc of baseLocations) {
    const existing = await prisma.workLocation.findFirst({
      where: { type: loc.type, name: loc.name },
      select: { id: true },
    })
    if (!existing) {
      await prisma.workLocation.create({ data: { name: loc.name, type: loc.type } })
    }
  }

  const kebuns = await prisma.kebun.findMany({ select: { id: true, name: true } })
  for (const kebun of kebuns) {
    const existing = await prisma.workLocation.findFirst({
      where: { type: 'KEBUN', kebunId: kebun.id },
      select: { id: true, name: true },
    })
    if (!existing) {
      await prisma.workLocation.create({
        data: { name: kebun.name, type: 'KEBUN', kebunId: kebun.id },
      })
    } else if (existing.name !== kebun.name) {
      await prisma.workLocation.update({
        where: { id: existing.id },
        data: { name: kebun.name },
      })
    }
  }
}

export async function GET() {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await ensureDefaultLocations()
  const locations = await prisma.workLocation.findMany({
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
  })
  return NextResponse.json({ data: locations })
}
