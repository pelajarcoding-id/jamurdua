import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const count = await prisma.user.count()
    return Response.json({ hasUsers: count > 0 })
  } catch {
    return Response.json({ hasUsers: false })
  }
}
