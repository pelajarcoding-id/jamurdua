import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/route-auth'
import { uploadFile } from '@/lib/storage'

export const dynamic = 'force-dynamic'

async function ensureFaceProfileTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "FaceProfile" (
      "id" SERIAL PRIMARY KEY,
      "userId" INTEGER NOT NULL UNIQUE,
      "descriptor" JSONB NOT NULL,
      "photoUrl" TEXT,
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

  const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'FaceProfile'
  `
  const columnNames = columns.map((c) => c.column_name)
  if (!columnNames.includes('photoUrl')) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "FaceProfile" ADD COLUMN "photoUrl" TEXT`)
  }
}

function normalizeDescriptor(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null
  const nums = value.map((x) => Number(x)).filter((x) => Number.isFinite(x))
  if (nums.length < 64) return null
  if (nums.length > 1024) return null
  return nums
}

function distanceL2(a: number[], b: number[]) {
  const n = Math.min(a.length, b.length)
  if (n <= 0) return Number.NaN
  let sum = 0
  for (let i = 0; i < n; i++) {
    const d = a[i] - b[i]
    sum += d * d
  }
  return Math.sqrt(sum / n)
}

export async function GET(request: Request) {
  const guard = await requireRole(['ADMIN', 'PEMILIK'])
  if (guard.response) return guard.response

  try {
    await ensureFaceProfileTable()
    const { searchParams } = new URL(request.url)
    const limitRaw = Number(searchParams.get('limit') || '200')
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 1000) : 200
    const search = (searchParams.get('search') || '').trim()

    if (!search) {
      const rows = await prisma.$queryRaw<Array<{ userId: number; name: string; role: string | null; status: string | null; updatedAt: Date; photoUrl: string | null }>>`
        SELECT f."userId", u."name", u."role", u."status", f."updatedAt", f."photoUrl"
        FROM "FaceProfile" f
        JOIN "User" u ON u."id" = f."userId"
        ORDER BY f."updatedAt" DESC
        LIMIT ${limit}
      `
      return NextResponse.json({
        data: (rows || []).map((r) => ({
          userId: Number((r as any).userId),
          name: String((r as any).name || ''),
          role: (r as any).role == null ? null : String((r as any).role),
          status: (r as any).status == null ? null : String((r as any).status),
          updatedAt: (r as any).updatedAt instanceof Date ? (r as any).updatedAt.toISOString() : String((r as any).updatedAt || ''),
          photoUrl: (r as any).photoUrl == null ? null : String((r as any).photoUrl),
        })),
      })
    }

    const isNumeric = /^\d+$/.test(search)
    if (isNumeric) {
      const userId = Number(search)
      const rows = await prisma.$queryRaw<Array<{ userId: number; name: string; role: string | null; status: string | null; updatedAt: Date; photoUrl: string | null }>>`
        SELECT f."userId", u."name", u."role", u."status", f."updatedAt", f."photoUrl"
        FROM "FaceProfile" f
        JOIN "User" u ON u."id" = f."userId"
        WHERE f."userId" = ${userId}
        ORDER BY f."updatedAt" DESC
        LIMIT ${limit}
      `
      return NextResponse.json({
        data: (rows || []).map((r) => ({
          userId: Number((r as any).userId),
          name: String((r as any).name || ''),
          role: (r as any).role == null ? null : String((r as any).role),
          status: (r as any).status == null ? null : String((r as any).status),
          updatedAt: (r as any).updatedAt instanceof Date ? (r as any).updatedAt.toISOString() : String((r as any).updatedAt || ''),
          photoUrl: (r as any).photoUrl == null ? null : String((r as any).photoUrl),
        })),
      })
    }

    const like = `%${search}%`
    const rows = await prisma.$queryRaw<Array<{ userId: number; name: string; role: string | null; status: string | null; updatedAt: Date; photoUrl: string | null }>>`
      SELECT f."userId", u."name", u."role", u."status", f."updatedAt", f."photoUrl"
      FROM "FaceProfile" f
      JOIN "User" u ON u."id" = f."userId"
      WHERE u."name" ILIKE ${like}
      ORDER BY f."updatedAt" DESC
      LIMIT ${limit}
    `
    return NextResponse.json({
      data: (rows || []).map((r) => ({
        userId: Number((r as any).userId),
        name: String((r as any).name || ''),
        role: (r as any).role == null ? null : String((r as any).role),
        status: (r as any).status == null ? null : String((r as any).status),
        updatedAt: (r as any).updatedAt instanceof Date ? (r as any).updatedAt.toISOString() : String((r as any).updatedAt || ''),
        photoUrl: (r as any).photoUrl == null ? null : String((r as any).photoUrl),
      })),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const guard = await requireRole(['ADMIN', 'PEMILIK'])
  if (guard.response) return guard.response

  try {
    await ensureFaceProfileTable()
    const contentType = String(request.headers.get('content-type') || '')
    let userId: number = Number.NaN
    let descriptor: number[] | null = null
    let photo: File | null = null

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      userId = Number(formData.get('userId') || '')
      const rawDescriptor = formData.get('descriptor')
      if (typeof rawDescriptor === 'string') {
        descriptor = normalizeDescriptor(JSON.parse(rawDescriptor))
      } else {
        descriptor = null
      }
      photo = (formData.get('photo') as File | null) || null
    } else {
      const body = await request.json().catch(() => null as any)
      userId = Number(body?.userId)
      descriptor = normalizeDescriptor(body?.descriptor)
      photo = null
    }

    if (!Number.isFinite(userId) || userId <= 0) {
      return NextResponse.json({ error: 'userId invalid' }, { status: 400 })
    }
    if (!descriptor) {
      return NextResponse.json({ error: 'descriptor invalid' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const dupThresholdRaw = Number(process.env.FACE_DUPLICATE_THRESHOLD || process.env.FACE_MATCH_THRESHOLD || '0.5')
    const dupThreshold = Number.isFinite(dupThresholdRaw) ? dupThresholdRaw : 0.5
    const others = await prisma.$queryRaw<Array<{ userId: number; name: string; descriptor: any }>>`
      SELECT f."userId", u."name", f."descriptor"
      FROM "FaceProfile" f
      JOIN "User" u ON u."id" = f."userId"
      WHERE f."userId" <> ${userId}
    `
    let best: { userId: number; name: string; distance: number } | null = null
    for (const r of others || []) {
      const otherId = Number((r as any).userId)
      const otherName = String((r as any).name || '')
      if (!Number.isFinite(otherId) || otherId <= 0) continue
      const otherDesc = normalizeDescriptor((r as any).descriptor)
      if (!otherDesc) continue
      const d = distanceL2(descriptor, otherDesc)
      if (!Number.isFinite(d)) continue
      if (!best || d < best.distance) best = { userId: otherId, name: otherName, distance: d }
    }
    if (best && best.distance <= dupThreshold) {
      return NextResponse.json(
        {
          error: `Wajah sudah terdaftar untuk karyawan lain: ${best.name || '-'} (${best.userId})`,
          duplicate: { userId: best.userId, name: best.name || null, distance: best.distance },
          threshold: dupThreshold,
        },
        { status: 409 }
      )
    }

    let photoUrl: string | null = null
    if (photo) {
      const bytes = await photo.arrayBuffer()
      const buffer = Buffer.from(bytes)
      const uploadResult = await uploadFile({
        bytes: buffer,
        originalName: `face-profile-${userId}-${Date.now()}.webp`,
        contentType: photo.type || 'image/webp',
        folder: 'face-profile',
      })
      photoUrl = uploadResult.url
    }

    await prisma.$executeRawUnsafe(
      `
        INSERT INTO "FaceProfile" ("userId", "descriptor", "photoUrl", "createdAt", "updatedAt")
        VALUES ($1, $2::jsonb, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT ("userId")
        DO UPDATE SET
          "descriptor" = EXCLUDED."descriptor",
          "photoUrl" = COALESCE(EXCLUDED."photoUrl", "FaceProfile"."photoUrl"),
          "updatedAt" = CURRENT_TIMESTAMP
      `,
      userId,
      JSON.stringify(descriptor),
      photoUrl
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
