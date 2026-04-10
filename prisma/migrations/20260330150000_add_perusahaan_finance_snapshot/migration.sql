CREATE TABLE "PerusahaanFinanceSnapshot" (
    "id" SERIAL NOT NULL,
    "perusahaanId" INTEGER NOT NULL,
    "startDate" DATE,
    "endDate" DATE,
    "data" JSONB NOT NULL,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PerusahaanFinanceSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PerusahaanFinanceSnapshot_perusahaanId_idx" ON "PerusahaanFinanceSnapshot"("perusahaanId");

CREATE INDEX "PerusahaanFinanceSnapshot_createdAt_idx" ON "PerusahaanFinanceSnapshot"("createdAt");

ALTER TABLE "PerusahaanFinanceSnapshot" ADD CONSTRAINT "PerusahaanFinanceSnapshot_perusahaanId_fkey" FOREIGN KEY ("perusahaanId") REFERENCES "Perusahaan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PerusahaanFinanceSnapshot" ADD CONSTRAINT "PerusahaanFinanceSnapshot_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

