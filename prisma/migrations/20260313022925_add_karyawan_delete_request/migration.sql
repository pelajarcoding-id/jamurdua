-- CreateTable
CREATE TABLE "KaryawanDeleteRequest" (
    "id" SERIAL NOT NULL,
    "karyawanId" INTEGER NOT NULL,
    "requesterId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "reviewedById" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KaryawanDeleteRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KaryawanDeleteRequest_karyawanId_idx" ON "KaryawanDeleteRequest"("karyawanId");

-- CreateIndex
CREATE INDEX "KaryawanDeleteRequest_status_idx" ON "KaryawanDeleteRequest"("status");

-- AddForeignKey
ALTER TABLE "KaryawanDeleteRequest" ADD CONSTRAINT "KaryawanDeleteRequest_karyawanId_fkey" FOREIGN KEY ("karyawanId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KaryawanDeleteRequest" ADD CONSTRAINT "KaryawanDeleteRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KaryawanDeleteRequest" ADD CONSTRAINT "KaryawanDeleteRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
