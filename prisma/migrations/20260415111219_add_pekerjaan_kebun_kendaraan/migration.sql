-- AlterTable
ALTER TABLE "InvoiceTbs" ADD COLUMN     "tanggalSurat" DATE;

-- AlterTable
ALTER TABLE "NotaSawitPembayaranBatch" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PekerjaanKebun" ADD COLUMN     "kendaraanPlatNomor" TEXT;

-- CreateTable
CREATE TABLE "AttendanceSelfie" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "checkIn" TIMESTAMP(3),
    "checkOut" TIMESTAMP(3),
    "photoInUrl" TEXT,
    "photoOutUrl" TEXT,
    "latIn" DOUBLE PRECISION,
    "longIn" DOUBLE PRECISION,
    "latOut" DOUBLE PRECISION,
    "longOut" DOUBLE PRECISION,
    "locationIn" TEXT,
    "locationOut" TEXT,
    "status" TEXT NOT NULL DEFAULT 'HADIR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceSelfie_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AttendanceSelfie_userId_idx" ON "AttendanceSelfie"("userId");

-- CreateIndex
CREATE INDEX "AttendanceSelfie_date_idx" ON "AttendanceSelfie"("date");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceSelfie_userId_date_key" ON "AttendanceSelfie"("userId", "date");

-- CreateIndex
CREATE INDEX "PekerjaanKebun_kendaraanPlatNomor_idx" ON "PekerjaanKebun"("kendaraanPlatNomor");

-- AddForeignKey
ALTER TABLE "PekerjaanKebun" ADD CONSTRAINT "PekerjaanKebun_kendaraanPlatNomor_fkey" FOREIGN KEY ("kendaraanPlatNomor") REFERENCES "Kendaraan"("platNomor") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSelfie" ADD CONSTRAINT "AttendanceSelfie_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
