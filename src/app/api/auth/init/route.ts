import { prisma } from '@/lib/prisma'
import { signSession, setSessionCookie } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const count = await prisma.user.count()
  if (count > 0) return new Response('Sudah terinisialisasi', { status: 400 })
  const body = await req.json()
  if (!body.name || !body.email || !body.password) return new Response('Data tidak lengkap', { status: 400 })
  const bcrypt = (await import('bcrypt')).default
  const hash = await bcrypt.hash(body.password, 10)
  const u = await prisma.user.create({ data: { name: body.name, email: body.email, passwordHash: hash, role: 'ADMIN' } })
  const token = signSession({ id: u.id, name: u.name, role: u.role })
  setSessionCookie(token)
  return Response.json({ ok: true })
}
