import NextAuth from 'next-auth';
import { authConfig } from './src/auth.config';

export default NextAuth(authConfig).auth;

export const config = {
  matcher: ['/((?!api|_next|favicon.ico|uploads|sw\\.js|custom-sw\\.js|manifest\\.json|icons).*)']
}
