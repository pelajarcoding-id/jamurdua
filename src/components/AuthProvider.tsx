'use client'

import { Session } from 'next-auth'
import { createContext, useContext, useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'

interface AuthContextType {
  session: Session | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ session: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter()
  const [navigating, setNavigating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [navStart, setNavStart] = useState<number | null>(null);

  useEffect(() => {
    // Fetch user session data from the server
    fetch('/api/auth/session').then(r => {
      if (r.ok) return r.json()
      return null
    }).then(d => {
      // The session object from /api/auth/session might be empty if not logged in
      if (d && Object.keys(d).length > 0) {
        setSession(d)
      } else {
        setSession(null);
      }
    }).finally(() => {
      setLoading(false);
    })
  }, [])

  useEffect(() => {
    if (loading) return
    if (session) return
    const isPublic =
      pathname === '/login' ||
      pathname === '/forgot-password' ||
      pathname === '/reset-password' ||
      pathname === '/offline' ||
      pathname.startsWith('/tools')
    if (!isPublic) {
      router.replace('/login')
    }
  }, [loading, pathname, router, session])

  useEffect(() => {
    if (loading) return
    if (!session?.user) return
    const role = String((session.user as any)?.role || '').toUpperCase()
    if (!role) return
    const allowed = ['ADMIN', 'PEMILIK', 'KASIR', 'MANAGER']
    if (allowed.includes(role)) return
    if (pathname !== '/attendance') {
      router.replace('/attendance')
    }
  }, [loading, pathname, router, session])

  useEffect(() => {
    const onNavStart = () => {
      const start = performance.now();
      setNavStart(start);
      setNavigating(true);
      setProgress(20);
      const t1 = setTimeout(() => setProgress(prev => (navigating ? Math.max(prev, 50) : prev)), 200);
      const t2 = setTimeout(() => setProgress(prev => (navigating ? Math.max(prev, 70) : prev)), 400);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      }
    };
    window.addEventListener('nav:start', onNavStart);
    return () => window.removeEventListener('nav:start', onNavStart);
  }, [navigating]);

  useEffect(() => {
    if (navStart !== null) {
      const end = performance.now();
      const duration = end - navStart;
      setProgress(100);
      setTimeout(() => {
        setNavigating(false);
        setProgress(0);
      }, 200);
      console.log(`Navigasi ke ${pathname} dalam ${Math.round(duration)} ms`);
      setNavStart(null);
    }
  }, [pathname, navStart]);

  return (
    <AuthContext.Provider value={{ session, loading }}>
      {children}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          height: navigating ? 3 : 0,
          width: `${progress}%`,
          backgroundColor: '#3b82f6',
          boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
          transition: 'width 200ms ease, height 150ms ease',
          zIndex: 1000
        }}
      />
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const { session, loading } = useContext(AuthContext)
  // Returns role, name, email, id, or empty strings if context is not yet available
  return {
    id: session?.user?.id || '',
    role: session?.user?.role || '',
    kebunId: (session?.user as any)?.kebunId || null,
    kebunIds: (session?.user as any)?.kebunIds || [],
    name: session?.user?.name || '',
    email: session?.user?.email || '',
    loading,
  }
}
