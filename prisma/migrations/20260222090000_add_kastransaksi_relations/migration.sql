-- Align KasTransaksi table with Prisma schema (relations & soft delete)
ALTER TABLE "KasTransaksi"
  ADD COLUMN IF NOT EXISTS "kategori" TEXT NOT NULL DEFAULT 'UMUM',
  ADD COLUMN IF NOT EXISTS "kebunId" INTEGER,
  ADD COLUMN IF NOT EXISTS "kendaraanPlatNomor" TEXT,
  ADD COLUMN IF NOT EXISTS "karyawanId" INTEGER,
  ADD COLUMN IF NOT EXISTS "userId" INTEGER,
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletedById" INTEGER;

-- Foreign keys
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'KasTransaksi_kebunId_fkey'
  ) THEN
    ALTER TABLE "KasTransaksi"
      ADD CONSTRAINT "KasTransaksi_kebunId_fkey"
      FOREIGN KEY ("kebunId") REFERENCES "Kebun"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'KasTransaksi_kendaraanPlatNomor_fkey'
  ) THEN
    ALTER TABLE "KasTransaksi"
      ADD CONSTRAINT "KasTransaksi_kendaraanPlatNomor_fkey"
      FOREIGN KEY ("kendaraanPlatNomor") REFERENCES "Kendaraan"("platNomor")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'KasTransaksi_karyawanId_fkey'
  ) THEN
    ALTER TABLE "KasTransaksi"
      ADD CONSTRAINT "KasTransaksi_karyawanId_fkey"
      FOREIGN KEY ("karyawanId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'KasTransaksi_userId_fkey'
  ) THEN
    ALTER TABLE "KasTransaksi"
      ADD CONSTRAINT "KasTransaksi_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'KasTransaksi_deletedById_fkey'
  ) THEN
    ALTER TABLE "KasTransaksi"
      ADD CONSTRAINT "KasTransaksi_deletedById_fkey"
      FOREIGN KEY ("deletedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

