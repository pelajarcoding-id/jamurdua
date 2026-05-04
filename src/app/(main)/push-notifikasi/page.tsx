'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import RoleGate from '@/components/RoleGate'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import toast from 'react-hot-toast'
import { ArrowPathIcon, BellAlertIcon } from '@heroicons/react/24/outline'

type Def = { key: string; label: string; description: string }

export default function PushNotifikasiPage() {
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [defs, setDefs] = useState<Def[]>([])
  const [settings, setSettings] = useState<Record<string, boolean>>({})
  const [subscriptionCount, setSubscriptionCount] = useState(0)
  const [cronSecretConfigured, setCronSecretConfigured] = useState(false)
  const [schedule, setSchedule] = useState<Record<string, string>>({})

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/notifications/settings', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Gagal memuat')
      setDefs(Array.isArray(json?.defs) ? json.defs : [])
      setSettings(json?.settings || {})
      setSubscriptionCount(Number(json?.subscriptionCount || 0))
      setCronSecretConfigured(!!json?.cronSecretConfigured)
      setSchedule(json?.schedule || {})
    } catch (e: any) {
      toast.error(e?.message || 'Gagal memuat')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const isPushEnabled = settings['ALL'] !== false

  const toggle = useCallback(
    async (key: string, enabled: boolean) => {
      setSavingKey(key)
      try {
        const res = await fetch('/api/notifications/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, enabled }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || 'Gagal menyimpan')
        setSettings(json?.settings || {})
        toast.success('Tersimpan')
      } catch (e: any) {
        toast.error(e?.message || 'Gagal menyimpan')
      } finally {
        setSavingKey(null)
      }
    },
    [],
  )

  const subscribeUser = useCallback(async () => {
    if (!('serviceWorker' in navigator)) {
      toast.error('Browser tidak mendukung Push Notifikasi')
      return
    }

    const toastId = toast.loading('Memulai aktivasi...')
    try {
      const keyRes = await fetch('/api/notifications/vapid-public', { cache: 'no-store' })
      const keyJson = await keyRes.json().catch(() => ({} as any))
      const publicKey = String(keyJson?.publicKey || '').trim()
      if (!publicKey) {
        toast.error('Konfigurasi VAPID Key tidak ditemukan.', { id: toastId })
        return
      }

      toast.loading('Meminta izin notifikasi...', { id: toastId })
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        toast.error('Izin notifikasi ditolak. Izinkan di pengaturan browser.', { id: toastId })
        return
      }

      if (!window.isSecureContext && window.location.hostname !== 'localhost') {
        toast.error('Push Notifikasi memerlukan HTTPS', { id: toastId })
        return
      }

      toast.loading('Mendaftarkan Service Worker...', { id: toastId })
      const swScript = process.env.NODE_ENV === 'development' ? '/custom-sw.js' : '/sw.js'
      let registration = await navigator.serviceWorker.getRegistration('/')
      if (!registration) {
        try {
          registration = await navigator.serviceWorker.register(swScript, { scope: '/', updateViaCache: 'none' as any })
        } catch {
          registration = await navigator.serviceWorker.register('/custom-sw.js', { scope: '/', updateViaCache: 'none' as any })
        }
      }
      if (!registration) {
        toast.error('Gagal mendaftarkan Service Worker', { id: toastId })
        return
      }
      try {
        await registration.update()
      } catch {}

      await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((resolve) => setTimeout(resolve, 8000)),
      ])

      if (!navigator.serviceWorker.controller) {
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => resolve(), 3000)
          navigator.serviceWorker.addEventListener(
            'controllerchange',
            () => {
              clearTimeout(timeout)
              resolve()
            },
            { once: true },
          )
        })
      }

      const urlBase64ToUint8Array = (base64String: string) => {
        const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
        const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/')
        const rawData = window.atob(base64)
        const outputArray = new Uint8Array(rawData.length)
        for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
        return outputArray
      }

      toast.loading('Mendaftarkan push subscription...', { id: toastId })
      let sub = await registration.pushManager.getSubscription()
      if (!sub) {
        sub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        })
      }

      toast.loading('Menyimpan ke server...', { id: toastId })
      const res = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub),
      })
      if (!res.ok) throw new Error('Gagal menyimpan langganan ke server')

      toast.success('Push notifikasi berhasil diaktifkan!', { id: toastId })
      await fetchData()
    } catch (e: any) {
      toast.error(e?.message || 'Gagal aktivasi', { id: toastId })
    }
  }, [fetchData])

  const items = useMemo(() => defs.filter((d) => d.key !== 'ALL'), [defs])

  return (
    <RoleGate allow={['ADMIN']}>
      <div className="p-4 md:p-8 space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Push Notification (Admin)</h1>
            <p className="text-sm text-gray-500 mt-1">Atur jenis notifikasi push yang diterima admin.</p>
          </div>
          <Button variant="outline" className="rounded-full" onClick={fetchData} disabled={loading}>
            <ArrowPathIcon className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-4 md:p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <BellAlertIcon className="w-5 h-5 text-emerald-600" />
                <div className="text-base font-semibold text-gray-900">Status Push</div>
              </div>
              <div className="text-sm text-gray-500">Subscription terdaftar: {subscriptionCount}</div>
              {!cronSecretConfigured ? (
                <div className="text-xs text-amber-600">Cron belum aktif (CRON_SECRET belum diset).</div>
              ) : null}
            </div>
            <Button onClick={subscribeUser} className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white">
              Aktifkan Push
            </Button>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-gray-100 bg-gray-50 p-4">
            <div className="space-y-0.5">
              <Label className="text-sm font-semibold text-gray-900">Aktifkan Push Notifikasi</Label>
              <div className="text-xs text-gray-500">Matikan untuk menghentikan semua push notifikasi.</div>
            </div>
            <Switch
              checked={isPushEnabled}
              onCheckedChange={(v) => toggle('ALL', !!v)}
              disabled={loading || savingKey === 'ALL'}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {items.map((d) => (
              <div key={d.key} className="rounded-2xl border border-gray-100 bg-white p-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-900">{d.label}</div>
                  <div className="text-xs text-gray-500 mt-1">{d.description}</div>
                  {d.key === 'ATTENDANCE_CHECKIN' ? (
                    <div className="flex items-center gap-2 mt-2">
                      <Label className="text-[11px] text-gray-500">Jam pengingat</Label>
                      <input
                        type="time"
                        value={schedule?.ATTENDANCE_CHECKIN || '08:00'}
                        onChange={(e) => setSchedule((prev) => ({ ...prev, ATTENDANCE_CHECKIN: e.target.value }))}
                        className="h-8 rounded-xl border border-gray-200 px-2 text-xs bg-white"
                        disabled={loading || savingKey === 'ATTENDANCE_CHECKIN'}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-xl text-xs"
                        disabled={loading || savingKey === 'ATTENDANCE_CHECKIN'}
                        onClick={async () => {
                          const next = String(schedule?.ATTENDANCE_CHECKIN || '08:00')
                          setSavingKey('ATTENDANCE_CHECKIN')
                          try {
                            const res = await fetch('/api/notifications/settings', {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ key: 'ATTENDANCE_CHECKIN', scheduleTime: next }),
                            })
                            const json = await res.json()
                            if (!res.ok) throw new Error(json?.error || 'Gagal menyimpan')
                            setSchedule(json?.schedule || {})
                            toast.success('Tersimpan')
                          } catch (e: any) {
                            toast.error(e?.message || 'Gagal menyimpan')
                          } finally {
                            setSavingKey(null)
                          }
                        }}
                      >
                        Simpan
                      </Button>
                    </div>
                  ) : null}
                </div>
                <Switch
                  checked={settings[d.key] !== false}
                  onCheckedChange={(v) => toggle(d.key, !!v)}
                  disabled={loading || !isPushEnabled || savingKey === d.key}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </RoleGate>
  )
}
