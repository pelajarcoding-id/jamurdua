CREATE TABLE IF NOT EXISTS "PerusahaanAsset" (
  "id" SERIAL PRIMARY KEY,
  "perusahaanId" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "group" TEXT NOT NULL,
  "acquiredAt" DATE NOT NULL,
  "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "salvage" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "PerusahaanAsset_perusahaanId_idx" ON "PerusahaanAsset"("perusahaanId");
CREATE INDEX IF NOT EXISTS "PerusahaanAsset_perusahaanId_acquiredAt_idx" ON "PerusahaanAsset"("perusahaanId", "acquiredAt");

ALTER TABLE "PerusahaanAsset"
ADD CONSTRAINT "PerusahaanAsset_perusahaanId_fkey"
FOREIGN KEY ("perusahaanId") REFERENCES "Perusahaan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

