CREATE TABLE "PerusahaanPpnReport" (
    "id" SERIAL NOT NULL,
    "perusahaanId" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "ppnMasukan" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ppnKeluaranOverride" DOUBLE PRECISION,
    "sptFileName" TEXT,
    "sptFileUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerusahaanPpnReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PerusahaanPpnReport_perusahaanId_year_month_key" ON "PerusahaanPpnReport"("perusahaanId", "year", "month");

CREATE INDEX "PerusahaanPpnReport_perusahaanId_idx" ON "PerusahaanPpnReport"("perusahaanId");

CREATE INDEX "PerusahaanPpnReport_year_month_idx" ON "PerusahaanPpnReport"("year", "month");

ALTER TABLE "PerusahaanPpnReport" ADD CONSTRAINT "PerusahaanPpnReport_perusahaanId_fkey" FOREIGN KEY ("perusahaanId") REFERENCES "Perusahaan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PerusahaanPpnReport" ADD CONSTRAINT "PerusahaanPpnReport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

