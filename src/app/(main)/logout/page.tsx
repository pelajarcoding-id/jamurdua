'use client'
import { useEffect } from 'react'

export const dynamic = 'force-dynamic'

export default function LogoutPage() {
  useEffect(() => {
    const performLogout = async () => {
      try {
        const endpoints: string[] = []
        if ('serviceWorker' in navigator && 'PushManager' in window) {
          const regs = await navigator.serviceWorker.getRegistrations().catch(() => [])
          for (const reg of regs) {
            try {
              const sub = await reg.pushManager.getSubscription()
              if (!sub) continue
              const endpoint = String(sub.endpoint || '').trim()
              if (endpoint) endpoints.push(endpoint)
              try { await sub.unsubscribe() } catch {}
            } catch {}
          }
        }

        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoints }),
        })
        // Use window.location.href to force a full page reload and clear client state
        window.location.href = '/login'
      } catch (error) {
        console.error('Logout failed:', error)
        // Fallback redirect even if API fails
        window.location.href = '/login'
      }
    }
    performLogout()
  }, [])

  return (
    <div className="flex h-[50vh] w-full items-center justify-center">
      <div className="flex flex-col items-center space-y-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
        <p className="text-gray-500 font-medium">Sedang memproses logout...</p>
      </div>
    </div>
  )
}
