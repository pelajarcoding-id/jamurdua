import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/route-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR', 'SUPIR'])
    if (guard.response) return guard.response

    const { searchParams } = new URL(request.url)
    const idsParam = (searchParams.get('ids') || '').trim()
    if (!idsParam) return NextResponse.json({ data: [] })

    const ids = Array.from(
      new Set(
        idsParam
          .split(',')
          .map((v) => Number(String(v).trim()))
          .filter((n) => Number.isFinite(n) && n > 0),
      ),
    )

    if (ids.length === 0) return NextResponse.json({ data: [] })

    const data = await prisma.notaSawit.findMany({
      where: { id: { in: ids }, deletedAt: null },
      include: {
        timbangan: {
          include: {
            kebun: true,
          },
        },
        kebun: true,
        supir: true,
        kendaraan: true,
        pabrikSawit: true,
      },
    })

    return NextResponse.json({ data })
  } catch (error) {
    console.error('GET /api/nota-sawit/bulk error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
