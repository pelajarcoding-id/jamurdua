CREATE TABLE "PerusahaanPpnSetting" (
    "id" SERIAL NOT NULL,
    "perusahaanId" INTEGER NOT NULL,
    "ppnRate" DOUBLE PRECISION NOT NULL DEFAULT 0.11,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerusahaanPpnSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PerusahaanPpnSetting_perusahaanId_key" ON "PerusahaanPpnSetting"("perusahaanId");

ALTER TABLE "PerusahaanPpnSetting" ADD CONSTRAINT "PerusahaanPpnSetting_perusahaanId_fkey" FOREIGN KEY ("perusahaanId") REFERENCES "Perusahaan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

