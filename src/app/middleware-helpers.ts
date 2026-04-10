import { NextResponse } from 'next/server'

export function guard(req: any) {
  const sessionCookie = req.cookies.get('session')?.value
  const { pathname } = req.nextUrl
  const publicPaths = ['/login', '/api/auth/login', '/api/auth/init', '/api/auth/state']
  if (publicPaths.includes(pathname) || pathname.startsWith('/_next') || pathname.startsWith('/api/upload')) {
    return NextResponse.next()
  }
  if (!sessionCookie) {
    const url = new URL('/login', req.url)
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}