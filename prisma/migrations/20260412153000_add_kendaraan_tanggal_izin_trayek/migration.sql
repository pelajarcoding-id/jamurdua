ALTER TABLE "Kendaraan" ADD COLUMN "tanggalIzinTrayek" TIMESTAMP(3);

UPDATE "Kendaraan"
SET "tanggalIzinTrayek" = "tanggalPajakTahunan"
WHERE "tanggalIzinTrayek" IS NULL
  AND "tanggalPajakTahunan" IS NOT NULL;

