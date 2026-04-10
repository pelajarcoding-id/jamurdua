import { signOut } from '@/auth';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'

export async function POST() {
  await signOut({ redirect: false });
  return NextResponse.json({ ok: true });
}
