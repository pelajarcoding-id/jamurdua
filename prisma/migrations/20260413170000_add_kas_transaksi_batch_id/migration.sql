ALTER TABLE "KasTransaksi"
ADD COLUMN IF NOT EXISTS "notaSawitPembayaranBatchId" INTEGER;

DO $$ BEGIN
    ALTER TABLE "KasTransaksi"
    ADD CONSTRAINT "KasTransaksi_notaSawitPembayaranBatchId_fkey"
    FOREIGN KEY ("notaSawitPembayaranBatchId") REFERENCES "NotaSawitPembayaranBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE INDEX "KasTransaksi_notaSawitPembayaranBatchId_idx" ON "KasTransaksi"("notaSawitPembayaranBatchId");
EXCEPTION
    WHEN duplicate_table THEN NULL;
    WHEN duplicate_object THEN NULL;
END $$;
