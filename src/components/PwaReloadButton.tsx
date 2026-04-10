'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

function isStandaloneDisplay() {
  if (typeof window === 'undefined') return false
  // iOS Safari PWA
  // @ts-ignore
  const iosStandalone = typeof window.navigator !== 'undefined' && (window.navigator as any).standalone
  // Standard PWA
  const displayStandalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches
  return !!(iosStandalone || displayStandalone)
}

async function checkSwUpdateAndReload() {
  if (typeof window === 'undefined') return
  if (!('serviceWorker' in navigator)) {
    try { sessionStorage.setItem('pwaReloaded', '1') } catch {}
    window.location.reload()
    return
  }
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    await reg?.update()
    if (reg?.waiting) {
      const onControllerChange = () => {
        navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
        try { sessionStorage.setItem('pwaReloaded', '1') } catch {}
        window.location.reload()
      }
      navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)
      reg.waiting.postMessage?.({ type: 'SKIP_WAITING' })
    } else {
      try { sessionStorage.setItem('pwaReloaded', '1') } catch {}
      window.location.reload()
    }
  } catch {
    try { sessionStorage.setItem('pwaReloaded', '1') } catch {}
    window.location.reload()
  }
}

export default function PwaReloadButton() {
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setShow(isStandaloneDisplay())
    const handler = () => setShow(isStandaloneDisplay())
    window.matchMedia?.('(display-mode: standalone)')?.addEventListener?.('change', handler as any)
    return () => {
      window.matchMedia?.('(display-mode: standalone)')?.removeEventListener?.('change', handler as any)
    }
  }, [])

  useEffect(() => {
    try {
      if (sessionStorage.getItem('pwaReloaded') === '1') {
        sessionStorage.removeItem('pwaReloaded')
        toast.dismiss()
        toast.success('Aplikasi berhasil diperbarui')
      }
    } catch {}
  }, [])

  const handleReload = useCallback(() => {
    setLoading(true)
    toast.dismiss()
    toast.loading('Memeriksa pembaruan…')
    // set flag; SW flow may reload via controllerchange
    try { sessionStorage.setItem('pwaReloaded', '1') } catch {}
    // Safety: trigger after short delay in case SW operations hang
    const safety = setTimeout(() => {
      try { sessionStorage.setItem('pwaReloaded', '1') } catch {}
      window.location.reload()
    }, 7000)
    checkSwUpdateAndReload().finally(() => {
      // in normal path, page will reload before this runs
      clearTimeout(safety)
      setLoading(false)
    })
  }, [])

  if (!show) return null

  return (
    <Button
      onClick={handleReload}
      variant="outline"
      size="icon"
      className="rounded-full bg-white text-gray-800 border border-gray-200 hover:bg-gray-50"
      title="Perbarui Aplikasi"
      aria-label="Perbarui Aplikasi"
      disabled={loading}
    >
      <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
    </Button>
  )
}

