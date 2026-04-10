import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { sendPasswordResetEmail } from '@/lib/mailer'

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
    const rawEmail = typeof body?.email === 'string' ? body.email : ''
    const email = rawEmail.trim().toLowerCase()
    if (!email) {
      return NextResponse.json({ ok: true })
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true },
    })
    if (!user) {
      return NextResponse.json({ ok: true })
    }

    await prisma.$executeRaw`DELETE FROM "PasswordResetToken" WHERE "userId" = ${user.id}`

    const token = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000)

    await prisma.$executeRaw`
      INSERT INTO "PasswordResetToken" ("userId","tokenHash","expiresAt")
      VALUES (${user.id}, ${tokenHash}, ${expiresAt})
    `

    const origin = new URL(request.url).origin
    const baseUrl = process.env.NEXTAUTH_URL || process.env.AUTH_URL || origin
    const resetUrl = `${baseUrl}/reset-password?token=${token}&email=${encodeURIComponent(user.email)}`
    await sendPasswordResetEmail({ to: user.email, name: user.name, resetUrl })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ ok: true })
  }
}
