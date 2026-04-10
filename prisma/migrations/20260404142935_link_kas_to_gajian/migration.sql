-- AlterTable
ALTER TABLE "KasTransaksi" ADD COLUMN     "gajianId" INTEGER;

-- CreateIndex
CREATE INDEX "KasTransaksi_gajianId_idx" ON "KasTransaksi"("gajianId");

-- AddForeignKey
ALTER TABLE "KasTransaksi" ADD CONSTRAINT "KasTransaksi_gajianId_fkey" FOREIGN KEY ("gajianId") REFERENCES "Gajian"("id") ON DELETE SET NULL ON UPDATE CASCADE;
