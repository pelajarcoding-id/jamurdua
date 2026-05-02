import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function requireKioskSecret(request: Request) {
  const secret = (process.env.KIOSK_SECRET || '').trim()
  if (!secret) return null
  const provided = (request.headers.get('x-kiosk-secret') || '').trim()
  if (provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}

export async function GET(request: Request) {
  const secretResp = requireKioskSecret(request)
  if (secretResp) return secretResp

  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') || '').trim()
  const role = (searchParams.get('role') || '').trim().toUpperCase()
  const limitRaw = Number(searchParams.get('limit') || '200')
  const limit = Math.min(1000, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 200))

  const where: any = {
    AND: [
      {
        OR: [{ status: 'AKTIF' }, { status: null }],
      },
    ],
  }

  if (role) where.AND.push({ role })

  if (q) {
    const isNumeric = /^\d+$/.test(q)
    where.AND.push({
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        ...(isNumeric ? [{ id: Number(q) }] : []),
      ],
    })
  }

  const rows = await prisma.user.findMany({
    where,
    take: limit,
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      role: true,
      photoUrl: true,
    },
  })

  return NextResponse.json({ data: rows })
}

