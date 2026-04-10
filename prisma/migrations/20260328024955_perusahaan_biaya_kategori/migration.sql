-- DropForeignKey
ALTER TABLE "PerusahaanBiaya" DROP CONSTRAINT "PerusahaanBiaya_perusahaanId_fkey";

-- DropForeignKey
ALTER TABLE "PerusahaanDocument" DROP CONSTRAINT "PerusahaanDocument_perusahaanId_fkey";

-- AlterTable
ALTER TABLE "PerusahaanBiaya" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PerusahaanDocument" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "PerusahaanBiayaKategori" (
    "id" SERIAL NOT NULL,
    "perusahaanId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "nameLower" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerusahaanBiayaKategori_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PerusahaanBiayaKategori_perusahaanId_idx" ON "PerusahaanBiayaKategori"("perusahaanId");

-- CreateIndex
CREATE UNIQUE INDEX "PerusahaanBiayaKategori_perusahaanId_nameLower_key" ON "PerusahaanBiayaKategori"("perusahaanId", "nameLower");

-- AddForeignKey
ALTER TABLE "PerusahaanDocument" ADD CONSTRAINT "PerusahaanDocument_perusahaanId_fkey" FOREIGN KEY ("perusahaanId") REFERENCES "Perusahaan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerusahaanBiaya" ADD CONSTRAINT "PerusahaanBiaya_perusahaanId_fkey" FOREIGN KEY ("perusahaanId") REFERENCES "Perusahaan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerusahaanBiayaKategori" ADD CONSTRAINT "PerusahaanBiayaKategori_perusahaanId_fkey" FOREIGN KEY ("perusahaanId") REFERENCES "Perusahaan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
