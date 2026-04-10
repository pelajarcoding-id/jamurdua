import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'

const ensureTable = async () => {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
      "id" SERIAL PRIMARY KEY,
      "userId" INTEGER NOT NULL,
      "tokenHash" TEXT NOT NULL UNIQUE,
      "expiresAt" TIMESTAMP NOT NULL,
      "usedAt" TIMESTAMP,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `)
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "PasswordResetToken_userId_idx" ON "PasswordResetToken" ("userId")
  `)
}

export async function POST(request: Request) {
  try {
    await ensureTable()
    const body = await request.json()
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    const token = typeof body?.token === 'string' ? body.token.trim() : ''
    const password = typeof body?.password === 'string' ? body.password : ''

    if (!email || !token || password.length < 8) {
      return NextResponse.json({ error: 'Data tidak valid' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    })
    if (!user) {
      return NextResponse.json({ error: 'Token tidak valid atau kedaluwarsa' }, { status: 400 })
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    const tokenRows = await prisma.$queryRaw<Array<{ id: number }>>`
      SELECT "id" FROM "PasswordResetToken"
      WHERE "userId" = ${user.id}
        AND "tokenHash" = ${tokenHash}
        AND "usedAt" IS NULL
        AND "expiresAt" > NOW()
      LIMIT 1
    `
    const tokenRow = tokenRows[0]
    if (!tokenRow) {
      return NextResponse.json({ error: 'Token tidak valid atau kedaluwarsa' }, { status: 400 })
    }

    const bcrypt = (await import('bcrypt')).default
    const passwordHash = await bcrypt.hash(password, 10)

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash, passwordChangedAt: new Date() },
      }),
      prisma.$executeRaw`UPDATE "PasswordResetToken" SET "usedAt" = NOW() WHERE "id" = ${tokenRow.id}`,
      prisma.$executeRaw`DELETE FROM "PasswordResetToken" WHERE "userId" = ${user.id} AND "id" <> ${tokenRow.id}`,
    ])

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: 'Gagal mereset password' }, { status: 500 })
  }
}
