import { auth, signOut } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id ? Number(session.user.id) : null;

  let endpoints: string[] = []
  try {
    const body = await request.json().catch(() => null as any)
    if (Array.isArray(body?.endpoints)) {
      endpoints = body.endpoints.map((e: any) => String(e || '').trim()).filter(Boolean)
    } else if (typeof body?.endpoint === 'string') {
      const endpoint = String(body.endpoint || '').trim()
      if (endpoint) endpoints = [endpoint]
    }
  } catch {}

  if (userId) {
    try {
      if (endpoints.length > 0) {
        await (prisma as any).pushSubscription.deleteMany({
          where: { userId, endpoint: { in: endpoints } },
        })
      } else {
        await (prisma as any).pushSubscription.deleteMany({
          where: { userId },
        })
      }
    } catch {}
  }

  await signOut({ redirect: false });
  return NextResponse.json({ ok: true });
}
