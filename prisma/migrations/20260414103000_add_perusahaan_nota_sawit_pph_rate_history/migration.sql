ALTER TABLE "NotaSawit" ADD COLUMN "pphRateApplied" DOUBLE PRECISION NOT NULL DEFAULT 0.0025;

CREATE TABLE "PerusahaanNotaSawitPphRate" (
    "id" SERIAL NOT NULL,
    "perusahaanId" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "pphRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0025,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerusahaanNotaSawitPphRate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PerusahaanNotaSawitPphRate_perusahaanId_effectiveFrom_key" ON "PerusahaanNotaSawitPphRate"("perusahaanId", "effectiveFrom");

CREATE INDEX "PerusahaanNotaSawitPphRate_perusahaanId_idx" ON "PerusahaanNotaSawitPphRate"("perusahaanId");

CREATE INDEX "PerusahaanNotaSawitPphRate_perusahaanId_effectiveFrom_idx" ON "PerusahaanNotaSawitPphRate"("perusahaanId", "effectiveFrom");

ALTER TABLE "PerusahaanNotaSawitPphRate" ADD CONSTRAINT "PerusahaanNotaSawitPphRate_perusahaanId_fkey" FOREIGN KEY ("perusahaanId") REFERENCES "Perusahaan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
