CREATE TABLE IF NOT EXISTS "PerusahaanDocument" (
  "id" SERIAL PRIMARY KEY,
  "perusahaanId" INTEGER NOT NULL,
  "type" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PerusahaanDocument_perusahaanId_fkey"
    FOREIGN KEY ("perusahaanId") REFERENCES "Perusahaan"("id") ON DELETE CASCADE
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PerusahaanDocument_perusahaanId_type_key'
  ) THEN
    ALTER TABLE "PerusahaanDocument"
    ADD CONSTRAINT "PerusahaanDocument_perusahaanId_type_key" UNIQUE ("perusahaanId", "type");
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS "PerusahaanDocument_perusahaanId_idx" ON "PerusahaanDocument" ("perusahaanId");

CREATE TABLE IF NOT EXISTS "PerusahaanBiaya" (
  "id" SERIAL PRIMARY KEY,
  "perusahaanId" INTEGER NOT NULL,
  "date" DATE NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'PENGELUARAN',
  "kategori" TEXT NOT NULL DEFAULT 'UMUM',
  "deskripsi" TEXT,
  "jumlah" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "gambarUrl" TEXT,
  "source" TEXT NOT NULL DEFAULT 'MANUAL',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PerusahaanBiaya_perusahaanId_fkey"
    FOREIGN KEY ("perusahaanId") REFERENCES "Perusahaan"("id") ON DELETE CASCADE
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'PerusahaanBiaya' AND column_name = 'gambarUrl'
  ) THEN
    ALTER TABLE "PerusahaanBiaya" ADD COLUMN "gambarUrl" TEXT;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS "PerusahaanBiaya_perusahaanId_idx" ON "PerusahaanBiaya" ("perusahaanId");
CREATE INDEX IF NOT EXISTS "PerusahaanBiaya_date_idx" ON "PerusahaanBiaya" ("date");
