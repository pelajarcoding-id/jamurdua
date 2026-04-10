import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import { NextResponse } from 'next/server';

const { auth } = NextAuth(authConfig);

export default auth((req: any) => {
  const { nextUrl } = req as any;
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction && nextUrl.pathname.startsWith('/uploads/')) {
    const filePath = nextUrl.pathname.replace('/uploads/', '');
    return NextResponse.rewrite(new URL(`/api/serve-image/${filePath}`, (req as any).url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
    '/uploads/:path*',
  ],
};
