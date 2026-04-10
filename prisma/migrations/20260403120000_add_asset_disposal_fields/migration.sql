ALTER TABLE "PerusahaanAsset"
ADD COLUMN IF NOT EXISTS "disposedAt" DATE,
ADD COLUMN IF NOT EXISTS "disposalType" TEXT,
ADD COLUMN IF NOT EXISTS "disposalProceeds" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "disposalNotes" TEXT;

CREATE INDEX IF NOT EXISTS "PerusahaanAsset_perusahaanId_disposedAt_idx"
ON "PerusahaanAsset"("perusahaanId", "disposedAt");

