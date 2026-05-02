import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/route-auth'

export const dynamic = 'force-dynamic'

async function ensureFaceProfileTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "FaceProfile" (
      "id" SERIAL PRIMARY KEY,
      "userId" INTEGER NOT NULL UNIQUE,
      "descriptor" JSONB NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "FaceProfile_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
    );
  `)

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "FaceProfile_userId_idx"
      ON "FaceProfile" ("userId");
  `)
}

function normalizeDescriptor(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null
  const nums = value.map((x) => Number(x)).filter((x) => Number.isFinite(x))
  if (nums.length < 64) return null
  if (nums.length > 1024) return null
  return nums
}

export async function POST(request: Request) {
  const guard = await requireRole(['ADMIN', 'PEMILIK'])
  if (guard.response) return guard.response

  try {
    await ensureFaceProfileTable()
    const body = await request.json().catch(() => null as any)
    const userId = Number(body?.userId)
    const descriptor = normalizeDescriptor(body?.descriptor)
    if (!Number.isFinite(userId) || userId <= 0) {
      return NextResponse.json({ error: 'userId invalid' }, { status: 400 })
    }
    if (!descriptor) {
      return NextResponse.json({ error: 'descriptor invalid' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    await prisma.$executeRawUnsafe(
      `
        INSERT INTO "FaceProfile" ("userId", "descriptor", "createdAt", "updatedAt")
        VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT ("userId")
        DO UPDATE SET "descriptor" = EXCLUDED."descriptor", "updatedAt" = CURRENT_TIMESTAMP
      `,
      userId,
      JSON.stringify(descriptor)
    )

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const guard = await requireRole(['ADMIN', 'PEMILIK'])
  if (guard.response) return guard.response

  try {
    await ensureFaceProfileTable()
    const { searchParams } = new URL(request.url)
    const userId = Number(searchParams.get('userId') || '')
    if (!Number.isFinite(userId) || userId <= 0) {
      return NextResponse.json({ error: 'userId invalid' }, { status: 400 })
    }
    await prisma.$executeRawUnsafe(`DELETE FROM "FaceProfile" WHERE "userId" = $1`, userId)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}

