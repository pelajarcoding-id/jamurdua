ALTER TABLE "KasTransaksi" ADD COLUMN "notaSawitId" INTEGER;
CREATE INDEX "KasTransaksi_notaSawitId_idx" ON "KasTransaksi" ("notaSawitId");
ALTER TABLE "KasTransaksi"
  ADD CONSTRAINT "KasTransaksi_notaSawitId_fkey"
  FOREIGN KEY ("notaSawitId") REFERENCES "NotaSawit"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

