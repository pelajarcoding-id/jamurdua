-- AlterTable
ALTER TABLE "AbsensiGajiHarian" ADD COLUMN     "gajianId" INTEGER;

-- AlterTable
ALTER TABLE "PekerjaanKebun" ADD COLUMN     "gajianId" INTEGER;

-- CreateIndex
CREATE INDEX "AbsensiGajiHarian_gajianId_idx" ON "AbsensiGajiHarian"("gajianId");

-- CreateIndex
CREATE INDEX "PekerjaanKebun_kebunId_date_idx" ON "PekerjaanKebun"("kebunId", "date");

-- CreateIndex
CREATE INDEX "PekerjaanKebun_gajianId_idx" ON "PekerjaanKebun"("gajianId");

-- AddForeignKey
ALTER TABLE "PekerjaanKebun" ADD CONSTRAINT "PekerjaanKebun_gajianId_fkey" FOREIGN KEY ("gajianId") REFERENCES "Gajian"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbsensiGajiHarian" ADD CONSTRAINT "AbsensiGajiHarian_gajianId_fkey" FOREIGN KEY ("gajianId") REFERENCES "Gajian"("id") ON DELETE SET NULL ON UPDATE CASCADE;
