-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "photoUrl" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Kendaraan" (
    "platNomor" TEXT NOT NULL,
    "merk" TEXT NOT NULL,
    "jenis" TEXT NOT NULL,
    "tanggalMatiStnk" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Kendaraan_pkey" PRIMARY KEY ("platNomor")
);

-- CreateTable
CREATE TABLE "Kebun" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Kebun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PabrikSawit" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PabrikSawit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotaSawit" (
    "id" SERIAL NOT NULL,
    "pabrikSawitId" INTEGER NOT NULL,
    "tanggalBongkar" TIMESTAMP(3),
    "timbanganId" INTEGER NOT NULL,
    "supirId" INTEGER NOT NULL,
    "kendaraanPlatNomor" TEXT,
    "potongan" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "beratAkhir" DOUBLE PRECISION NOT NULL,
    "hargaPerKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalPembayaran" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "statusPembayaran" TEXT NOT NULL DEFAULT 'BELUM_LUNAS',
    "statusGajian" TEXT NOT NULL DEFAULT 'BELUM_DIPROSES',
    "gajianId" INTEGER,
    "gambarNotaUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotaSawit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Timbangan" (
    "id" SERIAL NOT NULL,
    "kebunId" INTEGER NOT NULL,
    "supirId" INTEGER,
    "kendaraanPlatNomor" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grossKg" DOUBLE PRECISION NOT NULL,
    "tareKg" DOUBLE PRECISION NOT NULL,
    "netKg" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "photoUrl" TEXT,

    CONSTRAINT "Timbangan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gajian" (
    "id" SERIAL NOT NULL,
    "kebunId" INTEGER NOT NULL,
    "tanggalMulai" TIMESTAMP(3) NOT NULL,
    "tanggalSelesai" TIMESTAMP(3) NOT NULL,
    "totalNota" INTEGER NOT NULL,
    "totalBerat" DOUBLE PRECISION NOT NULL,
    "totalGaji" DOUBLE PRECISION NOT NULL,
    "totalBiayaLain" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalPotongan" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "keterangan" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Gajian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PotonganGajian" (
    "id" SERIAL NOT NULL,
    "gajianId" INTEGER NOT NULL,
    "deskripsi" TEXT NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PotonganGajian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DetailGajian" (
    "id" SERIAL NOT NULL,
    "gajianId" INTEGER NOT NULL,
    "notaSawitId" INTEGER NOT NULL,
    "harianKerja" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DetailGajian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BiayaLainGajian" (
    "id" SERIAL NOT NULL,
    "gajianId" INTEGER NOT NULL,
    "deskripsi" TEXT NOT NULL,
    "jumlah" DOUBLE PRECISION,
    "satuan" TEXT,
    "hargaSatuan" DOUBLE PRECISION,
    "total" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BiayaLainGajian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SesiUangJalan" (
    "id" SERIAL NOT NULL,
    "supirId" INTEGER NOT NULL,
    "kendaraanPlatNomor" TEXT,
    "tanggalMulai" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "keterangan" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Berjalan',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SesiUangJalan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UangJalan" (
    "id" SERIAL NOT NULL,
    "sesiUangJalanId" INTEGER NOT NULL,
    "tipe" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,
    "gambarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UangJalan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Jurnal" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "akun" TEXT NOT NULL,
    "deskripsi" TEXT,
    "debit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "kredit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "refType" TEXT,
    "refId" INTEGER,

    CONSTRAINT "Jurnal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KasTransaksi" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipe" TEXT NOT NULL,
    "deskripsi" TEXT NOT NULL,
    "jumlah" DOUBLE PRECISION NOT NULL,
    "keterangan" TEXT,
    "gambarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KasTransaksi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Kendaraan_platNomor_key" ON "Kendaraan"("platNomor");

-- CreateIndex
CREATE UNIQUE INDEX "NotaSawit_timbanganId_key" ON "NotaSawit"("timbanganId");

-- CreateIndex
CREATE UNIQUE INDEX "DetailGajian_notaSawitId_key" ON "DetailGajian"("notaSawitId");

-- AddForeignKey
ALTER TABLE "NotaSawit" ADD CONSTRAINT "NotaSawit_pabrikSawitId_fkey" FOREIGN KEY ("pabrikSawitId") REFERENCES "PabrikSawit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaSawit" ADD CONSTRAINT "NotaSawit_timbanganId_fkey" FOREIGN KEY ("timbanganId") REFERENCES "Timbangan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaSawit" ADD CONSTRAINT "NotaSawit_supirId_fkey" FOREIGN KEY ("supirId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaSawit" ADD CONSTRAINT "NotaSawit_kendaraanPlatNomor_fkey" FOREIGN KEY ("kendaraanPlatNomor") REFERENCES "Kendaraan"("platNomor") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaSawit" ADD CONSTRAINT "NotaSawit_gajianId_fkey" FOREIGN KEY ("gajianId") REFERENCES "Gajian"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timbangan" ADD CONSTRAINT "Timbangan_kebunId_fkey" FOREIGN KEY ("kebunId") REFERENCES "Kebun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timbangan" ADD CONSTRAINT "Timbangan_supirId_fkey" FOREIGN KEY ("supirId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timbangan" ADD CONSTRAINT "Timbangan_kendaraanPlatNomor_fkey" FOREIGN KEY ("kendaraanPlatNomor") REFERENCES "Kendaraan"("platNomor") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gajian" ADD CONSTRAINT "Gajian_kebunId_fkey" FOREIGN KEY ("kebunId") REFERENCES "Kebun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PotonganGajian" ADD CONSTRAINT "PotonganGajian_gajianId_fkey" FOREIGN KEY ("gajianId") REFERENCES "Gajian"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetailGajian" ADD CONSTRAINT "DetailGajian_gajianId_fkey" FOREIGN KEY ("gajianId") REFERENCES "Gajian"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetailGajian" ADD CONSTRAINT "DetailGajian_notaSawitId_fkey" FOREIGN KEY ("notaSawitId") REFERENCES "NotaSawit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiayaLainGajian" ADD CONSTRAINT "BiayaLainGajian_gajianId_fkey" FOREIGN KEY ("gajianId") REFERENCES "Gajian"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SesiUangJalan" ADD CONSTRAINT "SesiUangJalan_supirId_fkey" FOREIGN KEY ("supirId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SesiUangJalan" ADD CONSTRAINT "SesiUangJalan_kendaraanPlatNomor_fkey" FOREIGN KEY ("kendaraanPlatNomor") REFERENCES "Kendaraan"("platNomor") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UangJalan" ADD CONSTRAINT "UangJalan_sesiUangJalanId_fkey" FOREIGN KEY ("sesiUangJalanId") REFERENCES "SesiUangJalan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
