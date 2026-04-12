import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const rows: Array<{ jenis: string }> = await prisma.$queryRaw(
      Prisma.sql`SELECT DISTINCT jenis FROM "Kendaraan" WHERE jenis IS NOT NULL AND jenis <> '' ORDER BY jenis ASC`
    )
    return NextResponse.json({ data: rows.map((r) => r.jenis) })
  } catch {
    return NextResponse.json({ data: [] })
  }
}

