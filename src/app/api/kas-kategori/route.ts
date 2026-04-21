import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/route-auth'
import { z } from 'zod'
import { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

const ensureTable = async () => {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "KasKategori" (
      "code" TEXT PRIMARY KEY,
      "label" TEXT NOT NULL,
      "tipe" TEXT NOT NULL,
      "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS "KasKategori_tipe_idx" ON "KasKategori" ("tipe");
  `
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS "KasKategori_isActive_idx" ON "KasKategori" ("isActive");
  `
}

const seedDefaults = async () => {
  const defaults = [
    { code: 'UMUM', label: 'Umum', tipe: 'BOTH' },
    { code: 'KEBUN', label: 'Kebun', tipe: 'BOTH' },
    { code: 'KENDARAAN', label: 'Kendaraan', tipe: 'BOTH' },
    { code: 'KARYAWAN', label: 'Karyawan', tipe: 'BOTH' },
    { code: 'GAJI', label: 'Gaji Kebun', tipe: 'PENGELUARAN' },
    { code: 'HUTANG_KARYAWAN', label: 'Hutang Karyawan', tipe: 'PENGELUARAN' },
    { code: 'PEMBAYARAN_HUTANG', label: 'Pembayaran Hutang', tipe: 'PEMASUKAN' },
    { code: 'PENJUALAN_SAWIT', label: 'Penjualan Sawit', tipe: 'PEMASUKAN' },
  ]

  for (const d of defaults) {
    await prisma.$executeRaw`
      INSERT INTO "KasKategori" ("code","label","tipe","isActive","updatedAt")
      VALUES (${d.code}, ${d.label}, ${d.tipe}, TRUE, CURRENT_TIMESTAMP)
      ON CONFLICT ("code") DO UPDATE SET
        "label" = EXCLUDED."label",
        "tipe" = EXCLUDED."tipe",
        "updatedAt" = CURRENT_TIMESTAMP;
    `
  }
}

export async function GET(request: Request) {
  const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR'])
  if (guard.response) return guard.response

  const url = new URL(request.url)
  const tipe = String(url.searchParams.get('tipe') || '').trim().toUpperCase()
  const activeOnly = url.searchParams.get('activeOnly') !== 'false'

  try {
    await ensureTable()
    await seedDefaults()

    const where: Prisma.Sql[] = []
    if (activeOnly) where.push(Prisma.sql`"isActive" = TRUE`)
    if (tipe === 'PEMASUKAN' || tipe === 'PENGELUARAN') {
      where.push(Prisma.sql`("tipe" = ${tipe} OR "tipe" = 'BOTH')`)
    }

    const whereSql = where.length
      ? where.slice(1).reduce((acc, curr) => Prisma.sql`${acc} AND ${curr}`, where[0])
      : Prisma.sql`TRUE`

    const rows = await prisma.$queryRaw<Array<{ code: string; label: string; tipe: string; isActive: boolean }>>(
      Prisma.sql`SELECT "code","label","tipe","isActive"
                 FROM "KasKategori"
                 WHERE ${whereSql}
                 ORDER BY "label" ASC`
    )

    return NextResponse.json(rows)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Gagal memuat kategori kas' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const guard = await requireRole(['ADMIN', 'PEMILIK'])
  if (guard.response) return guard.response

  const schema = z.object({
    code: z.string().trim().min(1).max(64),
    label: z.string().trim().min(1).max(64),
    tipe: z.enum(['PEMASUKAN', 'PENGELUARAN', 'BOTH']),
    isActive: z.boolean().optional(),
  })
  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 })
  }

  const code = parsed.data.code.toUpperCase()
  const label = parsed.data.label
  const tipe = parsed.data.tipe
  const isActive = parsed.data.isActive ?? true

  await ensureTable()
  await prisma.$executeRaw`
    INSERT INTO "KasKategori" ("code","label","tipe","isActive","updatedAt")
    VALUES (${code}, ${label}, ${tipe}, ${isActive}, CURRENT_TIMESTAMP)
    ON CONFLICT ("code") DO UPDATE SET
      "label" = EXCLUDED."label",
      "tipe" = EXCLUDED."tipe",
      "isActive" = EXCLUDED."isActive",
      "updatedAt" = CURRENT_TIMESTAMP;
  `

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const guard = await requireRole(['ADMIN', 'PEMILIK'])
  if (guard.response) return guard.response

  const url = new URL(request.url)
  const code = String(url.searchParams.get('code') || '').trim().toUpperCase()
  if (!code) {
    return NextResponse.json({ error: 'code wajib diisi' }, { status: 400 })
  }

  await ensureTable()

  const usageCount = await prisma.kasTransaksi.count({ where: { kategori: code } })
  if (usageCount > 0) {
    return NextResponse.json({ error: 'Kategori tidak bisa dihapus karena sudah ada transaksi' }, { status: 409 })
  }

  await prisma.$executeRaw`DELETE FROM "KasKategori" WHERE "code" = ${code}`
  return NextResponse.json({ ok: true })
}
