import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const ensureTable = async () => {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AbsensiDefaultHarian" (
      "id" SERIAL PRIMARY KEY,
      "kebunId" INTEGER NOT NULL,
      "karyawanId" INTEGER NOT NULL,
      "amount" NUMERIC NOT NULL DEFAULT 0,
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE ("kebunId","karyawanId")
    )
  `)
}

export async function GET(request: Request) {
  try {
    await ensureTable()
    const { searchParams } = new URL(request.url)
    const kebunIdParam = searchParams.get('kebunId')
    const karyawanIdParam = searchParams.get('karyawanId')
    if (!kebunIdParam || !karyawanIdParam) {
      return NextResponse.json({ error: 'kebunId dan karyawanId wajib diisi' }, { status: 400 })
    }
    const kebunId = Number(kebunIdParam)
    const karyawanId = Number(karyawanIdParam)
    if (Number.isNaN(kebunId) || Number.isNaN(karyawanId)) {
      return NextResponse.json({ error: 'Parameter tidak valid' }, { status: 400 })
    }

    const rows = await prisma.$queryRaw<Array<{ amount: number }>>`
      SELECT "amount"
      FROM "AbsensiDefaultHarian"
      WHERE "kebunId" = ${kebunId}
        AND "karyawanId" = ${karyawanId}
      LIMIT 1
    `
    const amount = rows[0]?.amount ?? 0
    return NextResponse.json({ amount: Number(amount) || 0 })
  } catch (error) {
    console.error('GET /api/karyawan-kebun/absensi-default error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    await ensureTable()
    const body = await request.json()
    const { kebunId, karyawanId, amount } = body || {}
    if (!kebunId || !karyawanId) {
      return NextResponse.json({ error: 'kebunId dan karyawanId wajib diisi' }, { status: 400 })
    }
    const num = Number(amount) || 0
    await prisma.$executeRaw`
      INSERT INTO "AbsensiDefaultHarian" ("kebunId","karyawanId","amount","updatedAt")
      VALUES (${Number(kebunId)}, ${Number(karyawanId)}, ${num}, NOW())
      ON CONFLICT ("kebunId","karyawanId")
      DO UPDATE SET "amount" = EXCLUDED."amount", "updatedAt" = NOW()
    `
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('POST /api/karyawan-kebun/absensi-default error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
