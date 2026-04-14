CREATE TABLE "PabrikSawitPerusahaan" (
    "pabrikSawitId" INTEGER NOT NULL,
    "perusahaanId" INTEGER NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PabrikSawitPerusahaan_pkey" PRIMARY KEY ("pabrikSawitId","perusahaanId")
);

CREATE INDEX "PabrikSawitPerusahaan_perusahaanId_idx" ON "PabrikSawitPerusahaan"("perusahaanId");

ALTER TABLE "PabrikSawitPerusahaan" ADD CONSTRAINT "PabrikSawitPerusahaan_pabrikSawitId_fkey" FOREIGN KEY ("pabrikSawitId") REFERENCES "PabrikSawit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PabrikSawitPerusahaan" ADD CONSTRAINT "PabrikSawitPerusahaan_perusahaanId_fkey" FOREIGN KEY ("perusahaanId") REFERENCES "Perusahaan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "PabrikSawitPerusahaan" ("pabrikSawitId","perusahaanId","isDefault","createdAt","updatedAt")
SELECT p.id, p."perusahaanId", true, NOW(), NOW()
FROM "PabrikSawit" p
WHERE p."perusahaanId" IS NOT NULL
ON CONFLICT DO NOTHING;
