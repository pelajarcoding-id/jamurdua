-- CreateTable
CREATE TABLE "PerusahaanTaxSetting" (
    "id" SERIAL NOT NULL,
    "perusahaanId" INTEGER NOT NULL,
    "scheme" TEXT NOT NULL DEFAULT 'AUTO',
    "standardRate" DOUBLE PRECISION NOT NULL DEFAULT 0.22,
    "umkmFinalRate" DOUBLE PRECISION NOT NULL DEFAULT 0.005,
    "umkmOmzetThreshold" DOUBLE PRECISION NOT NULL DEFAULT 4800000000,
    "facilityOmzetThreshold" DOUBLE PRECISION NOT NULL DEFAULT 50000000000,
    "facilityPortionThreshold" DOUBLE PRECISION NOT NULL DEFAULT 4800000000,
    "facilityDiscount" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "rounding" TEXT NOT NULL DEFAULT 'THOUSAND',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerusahaanTaxSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PerusahaanTaxSetting_perusahaanId_key" ON "PerusahaanTaxSetting"("perusahaanId");

-- CreateIndex
CREATE INDEX "PerusahaanTaxSetting_perusahaanId_idx" ON "PerusahaanTaxSetting"("perusahaanId");

-- AddForeignKey
ALTER TABLE "PerusahaanTaxSetting" ADD CONSTRAINT "PerusahaanTaxSetting_perusahaanId_fkey" FOREIGN KEY ("perusahaanId") REFERENCES "Perusahaan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

