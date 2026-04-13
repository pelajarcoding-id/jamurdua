-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT IF EXISTS "AuditLog_userId_fkey";

-- DropForeignKey
ALTER TABLE "KaryawanAssignment" DROP CONSTRAINT IF EXISTS "KaryawanAssignment_userId_fkey";

-- AlterTable
ALTER TABLE "DetailGajianKaryawan" ADD COLUMN IF NOT EXISTS "saldoHutang" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE IF NOT EXISTS "KasKategori" (
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "tipe" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KasKategori_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "KebunDefaultBiaya" (
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
CREATE INDEX IF NOT EXISTS "KasKategori_tipe_idx" ON "KasKategori"("tipe");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "KasKategori_isActive_idx" ON "KasKategori"("isActive");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "KebunDefaultBiaya_kebunId_idx" ON "KebunDefaultBiaya"("kebunId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AuditLog_userId_fkey') THEN
    ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'KebunDefaultBiaya_kebunId_fkey') THEN
    ALTER TABLE "KebunDefaultBiaya" ADD CONSTRAINT "KebunDefaultBiaya_kebunId_fkey" FOREIGN KEY ("kebunId") REFERENCES "Kebun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'KaryawanAssignment_userId_fkey') THEN
    ALTER TABLE "KaryawanAssignment" ADD CONSTRAINT "KaryawanAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
