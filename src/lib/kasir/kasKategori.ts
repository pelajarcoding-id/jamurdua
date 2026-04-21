import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

let initPromise: Promise<void> | null = null

export async function ensureKasKategoriTable() {
  if (!initPromise) {
    initPromise = (async () => {
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
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "KasKategori_tipe_idx" ON "KasKategori" ("tipe");`
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "KasKategori_isActive_idx" ON "KasKategori" ("isActive");`

      const defaults = [
        { code: 'UMUM', label: 'Umum', tipe: 'BOTH' },
        { code: 'KEBUN', label: 'Kebun', tipe: 'BOTH' },
        { code: 'KENDARAAN', label: 'Kendaraan', tipe: 'BOTH' },
        { code: 'KARYAWAN', label: 'Karyawan', tipe: 'BOTH' },
        { code: 'GAJI', label: 'Gaji Kebun', tipe: 'PENGELUARAN' },
        { code: 'HUTANG_KARYAWAN', label: 'Hutang Karyawan', tipe: 'PENGELUARAN' },
        { code: 'PEMBAYARAN_HUTANG', label: 'Pembayaran Hutang', tipe: 'PEMASUKAN' },
        { code: 'PENJUALAN_SAWIT', label: 'Penjualan Sawit', tipe: 'PEMASUKAN' },
      ] as const

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
    })()
  }
  await initPromise
}

export async function validateKasKategoriOrThrow(kategoriRaw: string | undefined, tipe: 'PEMASUKAN' | 'PENGELUARAN') {
  const kategori = (kategoriRaw || 'UMUM').trim().toUpperCase()
  await ensureKasKategoriTable()
  const rows = await prisma.$queryRaw<Array<{ tipe: string; isActive: boolean }>>(
    Prisma.sql`SELECT "tipe","isActive" FROM "KasKategori" WHERE "code" = ${kategori} LIMIT 1`,
  )
  if (rows.length === 0) {
    throw new Error('Kategori tidak valid')
  }
  const row = rows[0]
  if (!row.isActive) {
    throw new Error('Kategori tidak aktif')
  }
  const allowed = row.tipe === 'BOTH' || row.tipe === tipe
  if (!allowed) {
    throw new Error('Kategori tidak sesuai dengan tipe transaksi')
  }
  return kategori
}
