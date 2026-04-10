-- AlterTable
ALTER TABLE "KasTransaksi" ADD COLUMN     "hutangBankId" INTEGER;

-- CreateTable
CREATE TABLE "HutangBank" (
    "id" SERIAL NOT NULL,
    "namaBank" TEXT NOT NULL,
    "jumlahHutang" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "angsuranBulanan" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lamaPinjaman" INTEGER NOT NULL,
    "tanggalMulai" DATE NOT NULL,
    "keterangan" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AKTIF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HutangBank_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "KasTransaksi" ADD CONSTRAINT "KasTransaksi_hutangBankId_fkey" FOREIGN KEY ("hutangBankId") REFERENCES "HutangBank"("id") ON DELETE SET NULL ON UPDATE CASCADE;
