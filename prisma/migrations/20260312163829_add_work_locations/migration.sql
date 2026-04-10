-- CreateTable
CREATE TABLE "WorkLocation" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "kebunId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KaryawanAssignment" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "locationId" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'AKTIF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KaryawanAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkLocation_kebunId_key" ON "WorkLocation"("kebunId");

-- CreateIndex
CREATE INDEX "WorkLocation_type_idx" ON "WorkLocation"("type");

-- CreateIndex
CREATE INDEX "WorkLocation_kebunId_idx" ON "WorkLocation"("kebunId");

-- CreateIndex
CREATE INDEX "KaryawanAssignment_userId_idx" ON "KaryawanAssignment"("userId");

-- CreateIndex
CREATE INDEX "KaryawanAssignment_locationId_idx" ON "KaryawanAssignment"("locationId");

-- AddForeignKey
ALTER TABLE "WorkLocation" ADD CONSTRAINT "WorkLocation_kebunId_fkey" FOREIGN KEY ("kebunId") REFERENCES "Kebun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KaryawanAssignment" ADD CONSTRAINT "KaryawanAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KaryawanAssignment" ADD CONSTRAINT "KaryawanAssignment_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "WorkLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
