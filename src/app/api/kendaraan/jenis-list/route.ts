import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const defaults = ['Mobil Truck', 'Mobil Pribadi', 'Mobil Langsir', 'Alat Berat', 'Sepeda Motor']
    const rows: Array<{ jenis: string }> = await prisma.$queryRaw(
      Prisma.sql`SELECT DISTINCT jenis FROM "Kendaraan" WHERE jenis IS NOT NULL AND jenis <> '' ORDER BY jenis ASC`
    )
    const fromDb = rows.map((r) => String(r.jenis || '').trim()).filter(Boolean)
    const merged = Array.from(new Set([...defaults, ...fromDb]))
    return NextResponse.json({ data: merged })
  } catch {
    return NextResponse.json({ data: ['Mobil Truck', 'Mobil Pribadi', 'Mobil Langsir', 'Alat Berat', 'Sepeda Motor'] })
  }
}
