-- CreateTable
CREATE TABLE "KebunGajianPotonganDraft" (
    "id" SERIAL NOT NULL,
    "kebunId" INTEGER NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "items" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KebunGajianPotonganDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KebunGajianPotonganDraft_kebunId_startDate_endDate_key" ON "KebunGajianPotonganDraft"("kebunId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "KebunGajianPotonganDraft_kebunId_startDate_endDate_idx" ON "KebunGajianPotonganDraft"("kebunId", "startDate", "endDate");

-- AddForeignKey
ALTER TABLE "KebunGajianPotonganDraft" ADD CONSTRAINT "KebunGajianPotonganDraft_kebunId_fkey" FOREIGN KEY ("kebunId") REFERENCES "Kebun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

