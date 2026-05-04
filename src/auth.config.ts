import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ auth, request }) {
      const nextUrl = request.nextUrl
      const isLoggedIn = !!auth?.user;
      const isOnLogin = nextUrl.pathname.startsWith('/login');
      const user = auth?.user;
      const userRole = (user?.role || '').toUpperCase();

      const buildRedirect = (pathname: string) => {
        const url = nextUrl.clone()
        const xfHost = request.headers.get('x-forwarded-host')
        const xfProto = request.headers.get('x-forwarded-proto')
        const xfPort = request.headers.get('x-forwarded-port')
        const hostHeader = request.headers.get('host')
        const cfVisitor = request.headers.get('cf-visitor')

        const protoFromForwarded = (xfProto ? xfProto.split(',')[0].trim() : '').toLowerCase()
        const protoFromCf =
          cfVisitor && cfVisitor.toLowerCase().includes('"scheme":"https"') ? 'https' : ''
        const proto = (protoFromForwarded || protoFromCf || url.protocol.replace(':', '')).toLowerCase()
        if (proto === 'http' || proto === 'https') url.protocol = `${proto}:`

        const pickHost = () => {
          const safe = (raw: string) => /^[a-z0-9.-]+(?::\d+)?$/i.test(raw)
          const fromXf = xfHost ? xfHost.split(',')[0].trim() : ''
          if (fromXf && safe(fromXf)) return fromXf
          const fromHost = hostHeader ? hostHeader.split(',')[0].trim() : ''
          if (fromHost && safe(fromHost)) return fromHost
          return ''
        }

        const pickedHost = pickHost()
        if (pickedHost) {
          const idx = pickedHost.lastIndexOf(':')
          const hostname = idx > -1 ? pickedHost.slice(0, idx) : pickedHost
          const hostPort = idx > -1 ? pickedHost.slice(idx + 1) : ''
          url.hostname = hostname

          if (url.protocol === 'https:') {
            url.port = ''
          } else {
            const portHeader = xfPort ? xfPort.split(',')[0].trim() : ''
            const portCandidate = /^\d+$/.test(portHeader) ? portHeader : (/^\d+$/.test(hostPort) ? hostPort : '')
            url.port = portCandidate
          }
        }
        url.pathname = pathname
        url.search = ''
        return Response.redirect(url)
      }

      // Allow access to public uploads and serve-image API
      if (nextUrl.pathname.startsWith('/uploads/') || nextUrl.pathname.startsWith('/api/serve-image/')) {
        return true;
      }

      if (isLoggedIn && nextUrl.pathname.startsWith('/ai') && userRole !== 'ADMIN') {
        return buildRedirect('/')
      }

      if (isLoggedIn && userRole === 'MANDOR') {
        const allowedRoutes = ['/kebun', '/timbangan', '/profile', '/logout'];
        const isAllowed = allowedRoutes.some(route => nextUrl.pathname === route || nextUrl.pathname.startsWith(`${route}/`));

        if (isOnLogin || nextUrl.pathname === '/') {
          return buildRedirect('/kebun')
        }

        if (!isAllowed) {
          return buildRedirect('/kebun')
        }
      }
      if (isLoggedIn && userRole === 'MANAGER') {
        const allowedRoutes = ['/kebun', '/timbangan', '/karyawan', '/karyawan-kebun', '/profile', '/logout'];
        const isAllowed = allowedRoutes.some(route => nextUrl.pathname === route || nextUrl.pathname.startsWith(`${route}/`));

        if (isOnLogin || nextUrl.pathname === '/') {
          return buildRedirect('/kebun')
        }

        if (!isAllowed) {
          return buildRedirect('/kebun')
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
          return buildRedirect('/')
        }
      }

      if (isOnLogin) {
        if (isLoggedIn) {
          if (userRole === 'MANDOR' || userRole === 'MANAGER') {
            return buildRedirect('/kebun')
          }
          return buildRedirect('/')
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
