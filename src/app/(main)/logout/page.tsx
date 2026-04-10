'use client'
import { useEffect } from 'react'

export const dynamic = 'force-dynamic'

export default function LogoutPage() {
  useEffect(() => {
    const performLogout = async () => {
      try {
        await fetch('/api/auth/logout', { method: 'POST' })
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
