-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_userId_fkey";

-- DropForeignKey
ALTER TABLE "KaryawanAssignment" DROP CONSTRAINT "KaryawanAssignment_userId_fkey";

-- AlterTable
ALTER TABLE "DetailGajianKaryawan" ADD COLUMN     "saldoHutang" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "KasKategori" (
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "tipe" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KasKategori_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "KebunDefaultBiaya" (
    "id" SERIAL NOT NULL,
    "kebunId" INTEGER NOT NULL,
    "deskripsi" TEXT NOT NULL,
    "hargaSatuan" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "satuan" TEXT NOT NULL DEFAULT 'Kg',
    "isAutoKg" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KebunDefaultBiaya_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KasKategori_tipe_idx" ON "KasKategori"("tipe");

-- CreateIndex
CREATE INDEX "KasKategori_isActive_idx" ON "KasKategori"("isActive");

-- CreateIndex
CREATE INDEX "KebunDefaultBiaya_kebunId_idx" ON "KebunDefaultBiaya"("kebunId");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KebunDefaultBiaya" ADD CONSTRAINT "KebunDefaultBiaya_kebunId_fkey" FOREIGN KEY ("kebunId") REFERENCES "Kebun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KaryawanAssignment" ADD CONSTRAINT "KaryawanAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
