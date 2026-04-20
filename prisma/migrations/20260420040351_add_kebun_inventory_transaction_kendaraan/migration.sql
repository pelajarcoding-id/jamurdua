-- AlterTable
ALTER TABLE "KebunInventoryTransaction" ADD COLUMN     "kendaraanPlatNomor" TEXT;

-- AlterTable
ALTER TABLE "PekerjaanKebun" ADD COLUMN     "kategoriBorongan" TEXT;

-- CreateTable
CREATE TABLE "KebunBoronganKategori" (
    "id" SERIAL NOT NULL,
    "kebunId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "nameLower" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KebunBoronganKategori_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KebunBoronganKategori_kebunId_idx" ON "KebunBoronganKategori"("kebunId");

-- CreateIndex
CREATE UNIQUE INDEX "KebunBoronganKategori_kebunId_nameLower_key" ON "KebunBoronganKategori"("kebunId", "nameLower");

-- CreateIndex
CREATE INDEX "KebunInventoryTransaction_kendaraanPlatNomor_idx" ON "KebunInventoryTransaction"("kendaraanPlatNomor");

-- AddForeignKey
ALTER TABLE "KebunInventoryTransaction" ADD CONSTRAINT "KebunInventoryTransaction_kendaraanPlatNomor_fkey" FOREIGN KEY ("kendaraanPlatNomor") REFERENCES "Kendaraan"("platNomor") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KebunBoronganKategori" ADD CONSTRAINT "KebunBoronganKategori_kebunId_fkey" FOREIGN KEY ("kebunId") REFERENCES "Kebun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
