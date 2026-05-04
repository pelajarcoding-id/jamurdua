import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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

function requireKioskSecret(request: Request) {
  const secret = (process.env.KIOSK_SECRET || '').trim()
  if (!secret) return null
  const provided = (request.headers.get('x-kiosk-secret') || '').trim()
  if (provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}

function normalizeDescriptor(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null
  if (value.length !== 128) return null
  const nums = value.map((x) => Number(x))
  if (!nums.every((x) => Number.isFinite(x))) return null
  return nums
}

function distanceL2(a: number[], b: number[]) {
  const n = a.length
  if (n <= 0 || b.length !== n) return Number.NaN
  let sum = 0
  for (let i = 0; i < n; i++) {
    const d = a[i] - b[i]
    sum += d * d
  }
  return Math.sqrt(sum)
}

export async function POST(request: Request) {
  const secretResp = requireKioskSecret(request)
  if (secretResp) return secretResp

  try {
    await ensureFaceProfileTable()
    const body = await request.json().catch(() => null as any)
    const probe = normalizeDescriptor(body?.descriptor)
    if (!probe) return NextResponse.json({ error: 'descriptor invalid' }, { status: 400 })

    const rows = await prisma.$queryRaw<Array<{ userId: number; descriptor: any }>>`
      SELECT "userId", "descriptor"
      FROM "FaceProfile"
    `

    let best: { userId: number; distance: number } | null = null
    for (const r of rows || []) {
      const userId = Number((r as any).userId)
      const desc = normalizeDescriptor((r as any).descriptor)
      if (!Number.isFinite(userId) || userId <= 0) continue
      if (!desc) continue
      const d = distanceL2(probe, desc)
      if (!Number.isFinite(d)) continue
      if (!best || d < best.distance) best = { userId, distance: d }
    }

    const thresholdRaw = Number(process.env.FACE_MATCH_THRESHOLD || '0.55')
    const threshold = Number.isFinite(thresholdRaw) ? thresholdRaw : 0.55
    const match = best && best.distance <= threshold ? best : null
    const user = match
      ? await prisma.user.findUnique({ where: { id: match.userId }, select: { id: true, name: true, role: true } })
      : null

    return NextResponse.json({
      match: match ? { ...match, userName: user?.name || null, userRole: user?.role || null } : null,
      threshold,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
