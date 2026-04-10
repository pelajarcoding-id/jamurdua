import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const role = session.user?.role?.toString().toUpperCase() || ''
  if (!['ADMIN', 'PEMILIK', 'MANAGER'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const userId = Number(body?.userId)
    const locationId = Number(body?.locationId)
    const startDate = body?.startDate ? new Date(body.startDate) : new Date()
    if (!userId || !locationId || isNaN(startDate.getTime())) {
      return NextResponse.json({ error: 'Data tidak valid' }, { status: 400 })
    }

    const location = await prisma.workLocation.findUnique({
      where: { id: locationId },
    })
    if (!location) {
      return NextResponse.json({ error: 'Lokasi tidak ditemukan' }, { status: 404 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.karyawanAssignment.updateMany({
        where: { userId, endDate: null },
        data: { endDate: startDate, status: 'NONAKTIF' },
      })

      await tx.karyawanAssignment.create({
        data: {
          userId,
          locationId,
          startDate,
          status: 'AKTIF',
        },
      })

      if (location.type === 'KEBUN' && location.kebunId) {
        await tx.user.update({
          where: { id: userId },
          data: { kebunId: location.kebunId },
        })
      } else {
        await tx.user.update({
          where: { id: userId },
          data: { kebunId: null },
        })
      }
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: 'Gagal memindahkan karyawan' }, { status: 500 })
  }
}
