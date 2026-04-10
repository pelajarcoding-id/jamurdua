-- CreateTable
CREATE TABLE "PendingFileDeletion" (
    "id" SERIAL NOT NULL,
    "url" TEXT NOT NULL,
    "key" TEXT,
    "driver" TEXT NOT NULL DEFAULT 'local',
    "entity" TEXT,
    "entityId" TEXT,
    "reason" TEXT,
    "deleteAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingFileDeletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PendingFileDeletion_deleteAt_idx" ON "PendingFileDeletion"("deleteAt");

-- CreateIndex
CREATE INDEX "PendingFileDeletion_url_idx" ON "PendingFileDeletion"("url");
