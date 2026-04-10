-- AlterTable
ALTER TABLE "InvoiceTbs" ADD COLUMN     "perusahaanId" INTEGER;

-- AlterTable
ALTER TABLE "Kebun" ADD COLUMN     "perusahaanId" INTEGER;

-- AlterTable
ALTER TABLE "NotaSawit" ADD COLUMN     "perusahaanId" INTEGER;

-- CreateTable
CREATE TABLE "Perusahaan" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "logoUrl" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Perusahaan_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Kebun" ADD CONSTRAINT "Kebun_perusahaanId_fkey" FOREIGN KEY ("perusahaanId") REFERENCES "Perusahaan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaSawit" ADD CONSTRAINT "NotaSawit_perusahaanId_fkey" FOREIGN KEY ("perusahaanId") REFERENCES "Perusahaan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceTbs" ADD CONSTRAINT "InvoiceTbs_perusahaanId_fkey" FOREIGN KEY ("perusahaanId") REFERENCES "Perusahaan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
