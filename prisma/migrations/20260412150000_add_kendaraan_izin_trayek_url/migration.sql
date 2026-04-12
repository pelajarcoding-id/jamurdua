ALTER TABLE "Kendaraan" ADD COLUMN "fotoIzinTrayekUrl" TEXT;

UPDATE "Kendaraan"
SET "fotoIzinTrayekUrl" = "fotoPajakUrl"
WHERE "fotoIzinTrayekUrl" IS NULL
  AND "fotoPajakUrl" IS NOT NULL;

