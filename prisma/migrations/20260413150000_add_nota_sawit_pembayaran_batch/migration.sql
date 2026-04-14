-- CreateTable
CREATE TABLE IF NOT EXISTS "NotaSawitPembayaranBatch" (
    "id" SERIAL NOT NULL,
    "pabrikSawitId" INTEGER NOT NULL,
    "tanggal" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "jumlahMasuk" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "adminBank" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "metodeAlokasi" TEXT NOT NULL DEFAULT 'PROPORSIONAL',
    "bebankanNotaId" INTEGER,
    "keterangan" TEXT,
    "gambarUrl" TEXT,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NotaSawitPembayaranBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "NotaSawitPembayaranBatchItem" (
    "id" SERIAL NOT NULL,
    "batchId" INTEGER NOT NULL,
    "notaSawitId" INTEGER NOT NULL,
    "tagihanNet" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "adminAllocated" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pembayaranAktual" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NotaSawitPembayaranBatchItem_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
    ALTER TABLE "NotaSawitPembayaranBatch"
    ADD CONSTRAINT "NotaSawitPembayaranBatch_pabrikSawitId_fkey"
    FOREIGN KEY ("pabrikSawitId") REFERENCES "PabrikSawit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "NotaSawitPembayaranBatchItem"
    ADD CONSTRAINT "NotaSawitPembayaranBatchItem_batchId_fkey"
    FOREIGN KEY ("batchId") REFERENCES "NotaSawitPembayaranBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "NotaSawitPembayaranBatchItem"
    ADD CONSTRAINT "NotaSawitPembayaranBatchItem_notaSawitId_fkey"
    FOREIGN KEY ("notaSawitId") REFERENCES "NotaSawit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE UNIQUE INDEX "NotaSawitPembayaranBatchItem_batchId_notaSawitId_key" ON "NotaSawitPembayaranBatchItem"("batchId", "notaSawitId");
EXCEPTION
    WHEN duplicate_table THEN NULL;
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE INDEX "NotaSawitPembayaranBatch_pabrikSawitId_idx" ON "NotaSawitPembayaranBatch"("pabrikSawitId");
EXCEPTION
    WHEN duplicate_table THEN NULL;
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE INDEX "NotaSawitPembayaranBatch_tanggal_idx" ON "NotaSawitPembayaranBatch"("tanggal");
EXCEPTION
    WHEN duplicate_table THEN NULL;
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE INDEX "NotaSawitPembayaranBatchItem_notaSawitId_idx" ON "NotaSawitPembayaranBatchItem"("notaSawitId");
EXCEPTION
    WHEN duplicate_table THEN NULL;
    WHEN duplicate_object THEN NULL;
END $$;
