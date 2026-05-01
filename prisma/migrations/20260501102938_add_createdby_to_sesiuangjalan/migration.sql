-- AlterTable
ALTER TABLE "SesiUangJalan" ADD COLUMN     "createdById" INTEGER;

-- CreateIndex
CREATE INDEX "NotaSawitPembayaranBatch_createdById_idx" ON "NotaSawitPembayaranBatch"("createdById");

-- CreateIndex
CREATE INDEX "SesiUangJalan_createdById_idx" ON "SesiUangJalan"("createdById");

-- AddForeignKey
ALTER TABLE "NotaSawitPembayaranBatch" ADD CONSTRAINT "NotaSawitPembayaranBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SesiUangJalan" ADD CONSTRAINT "SesiUangJalan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
