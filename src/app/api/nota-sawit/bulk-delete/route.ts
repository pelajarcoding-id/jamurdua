import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/route-auth'
import { createAuditLog } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR'])
    if (guard.response) return guard.response
    const { ids } = await request.json()

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ message: 'IDs tidak valid' }, { status: 400 })
    }

    const deletedCount = await prisma.notaSawit.deleteMany({
      where: {
        id: {
          in: ids,
        },
      },
    })

    await createAuditLog(guard.id, 'DELETE', 'NotaSawit', 'BULK', {
      count: deletedCount.count,
      ids: ids.slice(0, 500),
    })

    return NextResponse.json({ message: `${deletedCount.count} nota berhasil dihapus` })
  } catch (error) {
    console.error('Gagal menghapus nota:', error)
    return NextResponse.json({ message: 'Gagal menghapus nota' }, { status: 500 })
  }
}
