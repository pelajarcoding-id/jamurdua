/*
  Warnings:

  - You are about to drop the column `perusahaanId` on the `Kebun` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Kebun" DROP CONSTRAINT "Kebun_perusahaanId_fkey";

-- AlterTable
ALTER TABLE "Kebun" DROP COLUMN "perusahaanId";

-- AlterTable
ALTER TABLE "PabrikSawit" ADD COLUMN     "perusahaanId" INTEGER;

-- AddForeignKey
ALTER TABLE "PabrikSawit" ADD CONSTRAINT "PabrikSawit_perusahaanId_fkey" FOREIGN KEY ("perusahaanId") REFERENCES "Perusahaan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
