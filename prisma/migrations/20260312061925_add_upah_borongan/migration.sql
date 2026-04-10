-- DropForeignKey
ALTER TABLE "NotaSawit" DROP CONSTRAINT "NotaSawit_timbanganId_fkey";

-- AlterTable
ALTER TABLE "BiayaLainGajian" ADD COLUMN     "keterangan" TEXT;

-- AlterTable
ALTER TABLE "DetailGajian" ADD COLUMN     "keterangan" TEXT;

-- AlterTable
ALTER TABLE "Gajian" ADD COLUMN     "tipe" TEXT NOT NULL DEFAULT 'PANEN';

-- AlterTable
ALTER TABLE "KasTransaksi" ALTER COLUMN "kategori" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Kendaraan" ADD COLUMN     "fotoPajakUrl" TEXT,
ADD COLUMN     "fotoSpeksiUrl" TEXT,
ADD COLUMN     "fotoStnkUrl" TEXT,
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "speksi" TIMESTAMP(3),
ADD COLUMN     "tanggalPajakTahunan" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "NotaSawit" ADD COLUMN     "bruto" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "kebunId" INTEGER,
ADD COLUMN     "netto" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "pembayaranAktual" DOUBLE PRECISION,
ADD COLUMN     "pembayaranSetelahPph" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "pph" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "pph25" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "tara" DOUBLE PRECISION NOT NULL DEFAULT 0,
ALTER COLUMN "timbanganId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "PotonganGajian" ADD COLUMN     "keterangan" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "kebunId" INTEGER,
ADD COLUMN     "passwordChangedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiwayatDokumen" (
    "id" SERIAL NOT NULL,
    "kendaraanPlat" TEXT NOT NULL,
    "jenis" TEXT NOT NULL,
    "tanggalBayar" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "berlakuHingga" TIMESTAMP(3) NOT NULL,
    "biaya" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "keterangan" TEXT,
    "fotoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiwayatDokumen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceLog" (
    "id" SERIAL NOT NULL,
    "kendaraanPlat" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL,
    "odometer" INTEGER,
    "nextServiceDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "fotoUrl" TEXT,

    CONSTRAINT "ServiceLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceLogItem" (
    "id" SERIAL NOT NULL,
    "serviceLogId" INTEGER NOT NULL,
    "inventoryItemId" INTEGER NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceLogItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "category" TEXT,
    "unit" TEXT NOT NULL,
    "stock" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "minStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "imageUrl" TEXT,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "initialStock" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryTransaction" (
    "id" SERIAL NOT NULL,
    "itemId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "imageUrl" TEXT,

    CONSTRAINT "InventoryTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KebunInventoryItem" (
    "id" SERIAL NOT NULL,
    "kebunId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "unit" TEXT NOT NULL,
    "stock" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "minStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "kendaraanPlatNomor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KebunInventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KebunInventoryTransaction" (
    "id" SERIAL NOT NULL,
    "kebunId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "KebunInventoryTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermintaanKebun" (
    "id" SERIAL NOT NULL,
    "kebunId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "quantity" DOUBLE PRECISION,
    "unit" TEXT,

    CONSTRAINT "PermintaanKebun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PekerjaanKebun" (
    "id" SERIAL NOT NULL,
    "kebunId" INTEGER NOT NULL,
    "userId" INTEGER,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "jenisPekerjaan" TEXT NOT NULL,
    "keterangan" TEXT,
    "biaya" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "upahBorongan" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PekerjaanKebun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DetailGajianKaryawan" (
    "id" SERIAL NOT NULL,
    "gajianId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "hariKerja" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gajiPokok" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bonus" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lembur" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "potongan" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "keterangan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DetailGajianKaryawan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "link" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceTbs" (
    "id" SERIAL NOT NULL,
    "pabrikId" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "letterName" TEXT NOT NULL DEFAULT 'CV. SARAKAN JAYA',
    "letterAddress" TEXT,
    "letterEmail" TEXT,
    "letterLogoUrl" TEXT,
    "perihal" TEXT NOT NULL DEFAULT 'Permohonan Pembayaran',
    "tujuan" TEXT,
    "lokasiTujuan" TEXT,
    "ppnPct" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "pph22Pct" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "bankInfo" TEXT,
    "penandatangan" TEXT,
    "jabatanTtd" TEXT,
    "totalKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalRp" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalPpn" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalPph22" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grandTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceTbs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceTbsItem" (
    "id" SERIAL NOT NULL,
    "invoiceId" INTEGER NOT NULL,
    "notaSawitId" INTEGER,
    "bulanLabel" TEXT NOT NULL,
    "jumlahKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "harga" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "jumlahRp" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceTbsItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceTbsHistory" (
    "id" SERIAL NOT NULL,
    "invoiceId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceTbsHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbsensiDefaultHarian" (
    "id" SERIAL NOT NULL,
    "kebunId" INTEGER NOT NULL,
    "karyawanId" INTEGER NOT NULL,
    "amount" DECIMAL NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AbsensiDefaultHarian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbsensiGajiHarian" (
    "id" SERIAL NOT NULL,
    "kebunId" INTEGER NOT NULL,
    "karyawanId" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "jumlah" DECIMAL NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AbsensiGajiHarian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbsensiHarian" (
    "id" SERIAL NOT NULL,
    "kebunId" INTEGER NOT NULL,
    "karyawanId" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "jumlah" DECIMAL NOT NULL DEFAULT 0,
    "kerja" BOOLEAN NOT NULL DEFAULT false,
    "libur" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "jamKerja" DECIMAL,
    "ratePerJam" DECIMAL,
    "uangMakan" DECIMAL,
    "useHourly" BOOLEAN,

    CONSTRAINT "AbsensiHarian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_UserKebuns" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_userId_endpoint_key" ON "PushSubscription"("userId", "endpoint");

-- CreateIndex
CREATE INDEX "ServiceLog_date_idx" ON "ServiceLog"("date");

-- CreateIndex
CREATE INDEX "ServiceLog_kendaraanPlat_date_idx" ON "ServiceLog"("kendaraanPlat", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_sku_key" ON "InventoryItem"("sku");

-- CreateIndex
CREATE INDEX "KebunInventoryItem_kebunId_idx" ON "KebunInventoryItem"("kebunId");

-- CreateIndex
CREATE INDEX "KebunInventoryTransaction_kebunId_date_idx" ON "KebunInventoryTransaction"("kebunId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceTbs_number_key" ON "InvoiceTbs"("number");

-- CreateIndex
CREATE INDEX "InvoiceTbs_pabrikId_year_month_idx" ON "InvoiceTbs"("pabrikId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "AbsensiDefaultHarian_kebunId_karyawanId_key" ON "AbsensiDefaultHarian"("kebunId", "karyawanId");

-- CreateIndex
CREATE UNIQUE INDEX "AbsensiGajiHarian_kebunId_karyawanId_date_key" ON "AbsensiGajiHarian"("kebunId", "karyawanId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "AbsensiHarian_kebunId_karyawanId_date_key" ON "AbsensiHarian"("kebunId", "karyawanId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "_UserKebuns_AB_unique" ON "_UserKebuns"("A", "B");

-- CreateIndex
CREATE INDEX "_UserKebuns_B_index" ON "_UserKebuns"("B");

-- CreateIndex
CREATE INDEX "NotaSawit_tanggalBongkar_idx" ON "NotaSawit"("tanggalBongkar");

-- CreateIndex
CREATE INDEX "NotaSawit_supirId_idx" ON "NotaSawit"("supirId");

-- CreateIndex
CREATE INDEX "NotaSawit_kendaraanPlatNomor_idx" ON "NotaSawit"("kendaraanPlatNomor");

-- CreateIndex
CREATE INDEX "NotaSawit_pabrikSawitId_idx" ON "NotaSawit"("pabrikSawitId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_kebunId_fkey" FOREIGN KEY ("kebunId") REFERENCES "Kebun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiwayatDokumen" ADD CONSTRAINT "RiwayatDokumen_kendaraanPlat_fkey" FOREIGN KEY ("kendaraanPlat") REFERENCES "Kendaraan"("platNomor") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceLog" ADD CONSTRAINT "ServiceLog_kendaraanPlat_fkey" FOREIGN KEY ("kendaraanPlat") REFERENCES "Kendaraan"("platNomor") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceLogItem" ADD CONSTRAINT "ServiceLogItem_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceLogItem" ADD CONSTRAINT "ServiceLogItem_serviceLogId_fkey" FOREIGN KEY ("serviceLogId") REFERENCES "ServiceLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KebunInventoryItem" ADD CONSTRAINT "KebunInventoryItem_kebunId_fkey" FOREIGN KEY ("kebunId") REFERENCES "Kebun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KebunInventoryItem" ADD CONSTRAINT "KebunInventoryItem_kendaraanPlatNomor_fkey" FOREIGN KEY ("kendaraanPlatNomor") REFERENCES "Kendaraan"("platNomor") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KebunInventoryTransaction" ADD CONSTRAINT "KebunInventoryTransaction_kebunId_fkey" FOREIGN KEY ("kebunId") REFERENCES "Kebun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KebunInventoryTransaction" ADD CONSTRAINT "KebunInventoryTransaction_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "KebunInventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KebunInventoryTransaction" ADD CONSTRAINT "KebunInventoryTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermintaanKebun" ADD CONSTRAINT "PermintaanKebun_kebunId_fkey" FOREIGN KEY ("kebunId") REFERENCES "Kebun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermintaanKebun" ADD CONSTRAINT "PermintaanKebun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PekerjaanKebun" ADD CONSTRAINT "PekerjaanKebun_kebunId_fkey" FOREIGN KEY ("kebunId") REFERENCES "Kebun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PekerjaanKebun" ADD CONSTRAINT "PekerjaanKebun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaSawit" ADD CONSTRAINT "NotaSawit_kebunId_fkey" FOREIGN KEY ("kebunId") REFERENCES "Kebun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaSawit" ADD CONSTRAINT "NotaSawit_timbanganId_fkey" FOREIGN KEY ("timbanganId") REFERENCES "Timbangan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetailGajianKaryawan" ADD CONSTRAINT "DetailGajianKaryawan_gajianId_fkey" FOREIGN KEY ("gajianId") REFERENCES "Gajian"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetailGajianKaryawan" ADD CONSTRAINT "DetailGajianKaryawan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceTbs" ADD CONSTRAINT "InvoiceTbs_pabrikId_fkey" FOREIGN KEY ("pabrikId") REFERENCES "PabrikSawit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceTbsItem" ADD CONSTRAINT "InvoiceTbsItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "InvoiceTbs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceTbsItem" ADD CONSTRAINT "InvoiceTbsItem_notaSawitId_fkey" FOREIGN KEY ("notaSawitId") REFERENCES "NotaSawit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceTbsHistory" ADD CONSTRAINT "InvoiceTbsHistory_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "InvoiceTbs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserKebuns" ADD CONSTRAINT "_UserKebuns_A_fkey" FOREIGN KEY ("A") REFERENCES "Kebun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserKebuns" ADD CONSTRAINT "_UserKebuns_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
