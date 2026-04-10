import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnLogin = nextUrl.pathname.startsWith('/login');
      const user = auth?.user;
      const userRole = (user?.role || '').toUpperCase();

      // Allow access to public uploads and serve-image API
      if (nextUrl.pathname.startsWith('/uploads/') || nextUrl.pathname.startsWith('/api/serve-image/')) {
        return true;
      }

      if (isLoggedIn && userRole === 'MANDOR') {
        const allowedRoutes = ['/kebun', '/timbangan', '/profile', '/logout'];
        const isAllowed = allowedRoutes.some(route => nextUrl.pathname === route || nextUrl.pathname.startsWith(`${route}/`));

        if (isOnLogin || nextUrl.pathname === '/') {
          return Response.redirect(new URL('/kebun', nextUrl));
        }

        if (!isAllowed) {
          return Response.redirect(new URL('/kebun', nextUrl));
        }
      }
      if (isLoggedIn && userRole === 'MANAGER') {
        const allowedRoutes = ['/kebun', '/timbangan', '/karyawan', '/karyawan-kebun', '/profile', '/logout'];
        const isAllowed = allowedRoutes.some(route => nextUrl.pathname === route || nextUrl.pathname.startsWith(`${route}/`));

        if (isOnLogin || nextUrl.pathname === '/') {
          return Response.redirect(new URL('/kebun', nextUrl));
        }

        if (!isAllowed) {
          return Response.redirect(new URL('/kebun', nextUrl));
        }
      }

      if (isLoggedIn && userRole === 'SUPIR') {
        const restrictedRoutes = [
          '/kebun', 
          '/gajian', 
          '/kendaraan', 
          '/users', 
          '/kasir', 
          '/jurnal', 
          '/pabrik-sawit', 
          '/supir'
        ];
        
        const isRestricted = restrictedRoutes.some(route => nextUrl.pathname.startsWith(route));
        
        if (isRestricted) {
          return Response.redirect(new URL('/', nextUrl));
        }
      }

      if (isOnLogin) {
        if (isLoggedIn) {
          if (userRole === 'MANDOR' || userRole === 'MANAGER') {
            return Response.redirect(new URL('/kebun', nextUrl));
          }
          return Response.redirect(new URL('/', nextUrl));
        }
        return true;
      }
      
      if (!isLoggedIn) {
        return false;
      }
      
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
  providers: [], // Add providers with an empty array for now
} satisfies NextAuthConfig;
