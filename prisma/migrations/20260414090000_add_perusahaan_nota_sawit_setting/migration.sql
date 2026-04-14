CREATE TABLE "PerusahaanNotaSawitSetting" (
    "id" SERIAL NOT NULL,
    "perusahaanId" INTEGER NOT NULL,
    "pphRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0025,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerusahaanNotaSawitSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PerusahaanNotaSawitSetting_perusahaanId_key" ON "PerusahaanNotaSawitSetting"("perusahaanId");

CREATE INDEX "PerusahaanNotaSawitSetting_perusahaanId_idx" ON "PerusahaanNotaSawitSetting"("perusahaanId");

ALTER TABLE "PerusahaanNotaSawitSetting" ADD CONSTRAINT "PerusahaanNotaSawitSetting_perusahaanId_fkey" FOREIGN KEY ("perusahaanId") REFERENCES "Perusahaan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
