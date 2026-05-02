'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Webcam from 'react-webcam'
import { toast } from 'react-hot-toast'
import { convertImageFileToWebp } from '@/lib/image-webp'
import { countFacesFromVideo, detectSingleFaceFromVideo } from '@/lib/faceapi-client'
import { RefreshCw, CheckCircle2, LogOut, Loader2, MapPin } from 'lucide-react'

const videoConstraints = {
  width: 720,
  height: 720,
  facingMode: 'user',
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

const formatWibTime = (value: string | null | undefined) => {
  if (!value) return '--:--'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '--:--'
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

function dataUrlToFile(dataUrl: string, filename: string) {
  const parts = dataUrl.split(',')
  if (parts.length < 2) throw new Error('Format foto tidak valid')
  const mimeMatch = parts[0].match(/data:(.*?);base64/)
  const mime = mimeMatch?.[1] || 'image/jpeg'
  const binary = atob(parts[1])
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new File([bytes], filename, { type: mime })
}

function captureDataUrlFromVideo(video: HTMLVideoElement, mirrored: boolean) {
  const w = Number(video.videoWidth || 0)
  const h = Number(video.videoHeight || 0)
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  if (mirrored) {
    ctx.translate(w, 0)
    ctx.scale(-1, 1)
  }
  ctx.drawImage(video, 0, 0, w, h)
  return canvas.toDataURL('image/jpeg', 0.92)
}

function getCurrentPosition(options?: PositionOptions) {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options)
  })
}

async function reverseGeocodeName(latitude: number, longitude: number) {
  const fallback = `Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)}`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
      { signal: controller.signal, headers: { 'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8' } }
    )
    const data = await res.json()
    return data?.display_name || fallback
  } catch {
    return fallback
  } finally {
    clearTimeout(timeout)
  }
}

async function detectSingleFace(file: File): Promise<{ supported: boolean; faceCount: number | null; ok: boolean }> {
  if (typeof window === 'undefined') return { supported: false, faceCount: null, ok: true }
  const FaceDetector = (window as any).FaceDetector
  if (!FaceDetector) return { supported: false, faceCount: null, ok: true }

  const detector = new FaceDetector({ fastMode: true, maxDetectedFaces: 3 })
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('Gagal memuat gambar'))
      el.src = url
    })
    const faces = await detector.detect(img)
    const count = Array.isArray(faces) ? faces.length : 0
    return { supported: true, faceCount: count, ok: count === 1 }
  } catch {
    return { supported: false, faceCount: null, ok: true }
  } finally {
    try {
      URL.revokeObjectURL(url)
    } catch {}
  }
}

type LockedUser = { userId: number; userName: string | null; userRole: string | null; distance: number; lockedAt: number }

export default function AttendanceKioskPage() {
  const webcamRef = useRef<Webcam>(null)
  const videoWrapRef = useRef<HTMLDivElement>(null)
  const kioskSecret = useMemo(() => process.env.NEXT_PUBLIC_KIOSK_SECRET || '', [])
  const headers = useMemo(() => {
    const h: Record<string, string> = {}
    if (kioskSecret) h['x-kiosk-secret'] = kioskSecret
    return h
  }, [kioskSecret])

  const [submitting, setSubmitting] = useState(false)

  const [location, setLocation] = useState<{ lat: number; lng: number; name: string } | null>(null)
  const [locating, setLocating] = useState(false)

  const [todayAttendance, setTodayAttendance] = useState<any>(null)
  const [statusLoading, setStatusLoading] = useState(false)
  const [statusUserId, setStatusUserId] = useState<number | null>(null)
  const [hkUnpaid, setHkUnpaid] = useState<number | null>(null)
  const [hkRange, setHkRange] = useState<{ startDate: string; endDate: string } | null>(null)
  const [hkLoading, setHkLoading] = useState(false)

  const [cameraReady, setCameraReady] = useState(false)
  const [liveFaceCount, setLiveFaceCount] = useState<number | null>(null)
  const [recognized, setRecognized] = useState<{ userId: number; userName: string | null; userRole: string | null; distance: number } | null>(null)
  const [locked, setLocked] = useState<LockedUser | null>(null)
  const [lockedShot, setLockedShot] = useState<string | null>(null)
  const [overlay, setOverlay] = useState<{ left: number; top: number; width: number; height: number; label: string | null } | null>(null)
  const lastRecognizeAtRef = useRef<number>(0)
  const lastMatchOkAtRef = useRef<number>(0)
  const streakRef = useRef<{ userId: number; count: number } | null>(null)
  const submittingRef = useRef(false)
  const recognizedRef = useRef<typeof recognized>(null)
  const lockedRef = useRef<LockedUser | null>(null)
  const lockedShotRef = useRef<string | null>(null)

  const captureFromCamera = useCallback(() => {
    const video = (webcamRef.current as any)?.video as HTMLVideoElement | undefined
    if (video && video.readyState >= 2) {
      const dataUrl = captureDataUrlFromVideo(video, true)
      if (dataUrl) return dataUrl
    }
    return webcamRef.current?.getScreenshot() || null
  }, [])

  const resetForNextAttendance = useCallback(() => {
    setTodayAttendance(null)
    setStatusUserId(null)
    setHkUnpaid(null)
    setHkRange(null)
    setRecognized(null)
    setLocked(null)
    setLockedShot(null)
    setOverlay(null)
    setLiveFaceCount(null)
    streakRef.current = null
    lastRecognizeAtRef.current = 0
    lastMatchOkAtRef.current = 0
  }, [])

  const captureLockedShot = useCallback(async () => {
    if (typeof window === 'undefined') return
    if (lockedRef.current == null) return
    if (lockedShotRef.current) return

    for (let i = 0; i < 10; i++) {
      if (lockedRef.current == null) return
      if (lockedShotRef.current) return
      const dataUrl = captureFromCamera()
      if (dataUrl) {
        setLockedShot(dataUrl)
        return
      }
      await sleep(120)
    }
  }, [captureFromCamera])

  const getLocation = useCallback(async () => {
    setLocating(true)
    if (!navigator.geolocation) {
      setLocating(false)
      return
    }
    if (!window.isSecureContext) {
      setLocating(false)
      return
    }
    try {
      let position: GeolocationPosition
      try {
        position = await getCurrentPosition({ enableHighAccuracy: true, timeout: 12000, maximumAge: 0 })
      } catch {
        position = await getCurrentPosition({ enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 })
      }
      const { latitude, longitude } = position.coords
      const name = await reverseGeocodeName(latitude, longitude)
      setLocation({ lat: latitude, lng: longitude, name })
    } catch {
      setLocation(null)
    } finally {
      setLocating(false)
    }
  }, [])

  const loadStatus = useCallback(
    async (userId: string) => {
      const id = Number(userId)
      if (!Number.isFinite(id) || id <= 0) {
        setTodayAttendance(null)
        setStatusUserId(null)
        return
      }
      try {
        setStatusLoading(true)
        const res = await fetch(`/api/attendance/kiosk?userId=${id}`, { cache: 'no-store', headers })
        const json = await res.json().catch(() => ({} as any))
        if (!res.ok) throw new Error(json?.error || 'Gagal memuat status')
        setTodayAttendance(json?.attendance || null)
        setStatusUserId(id)
      } catch {
        setTodayAttendance(null)
        setStatusUserId(null)
      } finally {
        setStatusLoading(false)
      }
    },
    [headers]
  )

  const loadUnpaidHk = useCallback(
    async (userId: string) => {
      const id = Number(userId)
      if (!Number.isFinite(id) || id <= 0) {
        setHkUnpaid(null)
        setHkRange(null)
        return
      }
      try {
        setHkLoading(true)
        const res = await fetch(`/api/attendance/kiosk?userId=${id}&unpaid=1`, { cache: 'no-store', headers })
        const json = await res.json().catch(() => ({} as any))
        if (!res.ok) throw new Error(json?.error || 'Gagal memuat HK')
        setHkUnpaid(Number(json?.hkUnpaid) || 0)
        const startDate = json?.startDate ? String(json.startDate) : ''
        const endDate = json?.endDate ? String(json.endDate) : ''
        if (startDate && endDate) setHkRange({ startDate, endDate })
        else setHkRange(null)
      } catch {
        setHkUnpaid(null)
        setHkRange(null)
      } finally {
        setHkLoading(false)
      }
    },
    [headers]
  )

  useEffect(() => {
    getLocation()
  }, [getLocation])

  useEffect(() => {
    submittingRef.current = submitting
  }, [submitting])

  useEffect(() => {
    recognizedRef.current = recognized
  }, [recognized])

  useEffect(() => {
    lockedRef.current = locked
  }, [locked])

  useEffect(() => {
    lockedShotRef.current = lockedShot
  }, [lockedShot])

  useEffect(() => {
    const id = locked?.userId ? String(locked.userId) : ''
    if (!id) {
      setTodayAttendance(null)
      setStatusUserId(null)
      setHkUnpaid(null)
      setHkRange(null)
      return
    }
    loadStatus(id)
    loadUnpaidHk(id)
  }, [loadStatus, loadUnpaidHk, locked?.userId])

  useEffect(() => {
    if (!locked) return
    if (lockedShot) return
    captureLockedShot()
  }, [captureLockedShot, locked, lockedShot])

  useEffect(() => {
    let cancelled = false
    let t: number | null = null

    const tick = async () => {
      if (cancelled) return
      const video = (webcamRef.current as any)?.video as HTMLVideoElement | undefined
      const wrap = videoWrapRef.current
      if (!video || !wrap || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
        setCameraReady(false)
        setLiveFaceCount(null)
        setOverlay(null)
        setRecognized(null)
        t = window.setTimeout(tick, 250)
        return
      }

      setCameraReady(true)
      const faces = await countFacesFromVideo(video).catch(() => null)
      setLiveFaceCount(faces)
      if (faces != null && faces !== 1) {
        setOverlay(null)
        setRecognized(null)
        t = window.setTimeout(tick, 250)
        return
      }

      const r = await detectSingleFaceFromVideo(video).catch(() => null)
      if (!r) {
        setOverlay(null)
        setRecognized(null)
        t = window.setTimeout(tick, 250)
        return
      }

      const rect = wrap.getBoundingClientRect()
      const scaleX = rect.width / video.videoWidth
      const scaleY = rect.height / video.videoHeight
      const mirror = true
      const leftUnmirrored = r.box.x * scaleX
      const width = r.box.width * scaleX
      const left = mirror ? rect.width - leftUnmirrored - width : leftUnmirrored
      const top = r.box.y * scaleY
      const height = r.box.height * scaleY

      let label: string | null = null
      const currentLocked = lockedRef.current
      const currentRecognized = currentLocked
        ? { userId: currentLocked.userId, userName: currentLocked.userName, userRole: currentLocked.userRole, distance: currentLocked.distance }
        : recognizedRef.current
      label = currentRecognized?.userName ? currentRecognized.userName : currentRecognized?.userId ? `ID ${currentRecognized.userId}` : null
      setOverlay({ left, top, width, height, label })

      const stableFace = Number.isFinite(r.score) && r.score >= 0.6
      if (stableFace && !submittingRef.current && !lockedRef.current) {
        const now = Date.now()
        if (now - lastRecognizeAtRef.current >= 900) {
          lastRecognizeAtRef.current = now
          const resRec = await fetch('/api/face/recognize', {
            method: 'POST',
            headers: { ...headers, 'content-type': 'application/json' },
            body: JSON.stringify({ descriptor: r.descriptor }),
          }).catch(() => null as any)

          const jsonRec = resRec ? await resRec.json().catch(() => ({} as any)) : null
          const match = jsonRec?.match
          const matchUserId = Number(match?.userId)
          const distance = Number(match?.distance)
          if (resRec?.ok && Number.isFinite(matchUserId) && matchUserId > 0 && Number.isFinite(distance)) {
            const prev = streakRef.current
            const nextCount = prev && prev.userId === matchUserId ? prev.count + 1 : 1
            streakRef.current = { userId: matchUserId, count: nextCount }
            const next = {
              userId: matchUserId,
              userName: match?.userName ? String(match.userName) : null,
              userRole: match?.userRole ? String(match.userRole) : null,
              distance,
            }
            lastMatchOkAtRef.current = now
            setRecognized(next)
            const currentLocked = lockedRef.current as LockedUser | null
            if (!currentLocked || currentLocked.userId !== matchUserId) {
              setLocked({ ...next, lockedAt: Date.now() })
              setLockedShot(null)
            }
          } else {
            streakRef.current = null
            if (!lockedRef.current && now - lastMatchOkAtRef.current > 4000) setRecognized(null)
          }
        }
      } else {
        streakRef.current = null
      }

      t = window.setTimeout(tick, 250)
    }

    tick()
    return () => {
      cancelled = true
      if (t) window.clearTimeout(t)
    }
  }, [headers])

  const submitAttendance = useCallback(
    async (type: 'IN' | 'OUT') => {
      const canSubmit = !!locked?.userId
      if (!canSubmit) {
        toast.error('Belum siap absen. Tunggu nama karyawan terdeteksi.')
        return
      }

      const effectiveUserId = String((locked?.userId || recognized?.userId) as number)

      const statusMatch = Number(statusUserId) === Number(effectiveUserId)
      const s = statusMatch ? todayAttendance : null
      if (type === 'IN' && s?.checkIn) {
        toast.error('Sudah absen masuk hari ini')
        return
      }
      if (type === 'OUT' && !s?.checkIn) {
        toast.error('Belum absen masuk hari ini')
        return
      }
      if (type === 'OUT' && s?.checkOut) {
        toast.error('Sudah absen pulang hari ini')
        return
      }

      const dataUrl = lockedShot || captureFromCamera()
      if (!dataUrl) {
        toast.error('Gagal ambil foto dari kamera')
        return
      }

      setSubmitting(true)
      const toastId = toast.loading('Proses absensi...')
      try {
        const rawFile = dataUrlToFile(dataUrl, 'attendance.jpg')
        const file = await convertImageFileToWebp(rawFile, { quality: 0.82, maxDimension: 1280, targetMaxBytes: 420_000 })

        const face = await detectSingleFace(file)
        if (face.supported && !face.ok) {
          const c = face.faceCount ?? 0
          toast.error(c <= 0 ? 'Wajah tidak terdeteksi' : 'Terdeteksi lebih dari 1 wajah')
          return
        }

        const formData = new FormData()
        formData.append('userId', effectiveUserId)
        formData.append('type', type)
        formData.append('photo', file)
        if (location) {
          formData.append('lat', String(location.lat))
          formData.append('long', String(location.lng))
          formData.append('locationName', location.name)
        }

        const res = await fetch('/api/attendance/kiosk', { method: 'POST', body: formData, headers })
        const json = await res.json().catch(() => ({} as any))
        if (!res.ok) throw new Error(json?.error || 'Gagal absensi')

        toast.success(type === 'IN' ? 'Absen masuk berhasil' : 'Absen pulang berhasil')
        await loadStatus(effectiveUserId)
        setTimeout(() => {
          resetForNextAttendance()
        }, 700)
      } catch (e: any) {
        toast.error(e?.message || 'Gagal absensi')
      } finally {
        toast.dismiss(toastId)
        setSubmitting(false)
      }
    },
    [captureFromCamera, headers, loadStatus, location, locked, lockedShot, recognized, resetForNextAttendance, statusUserId, todayAttendance]
  )

  const activeUserId = useMemo(() => {
    if (locked?.userId) return String(locked.userId)
    return ''
  }, [locked?.userId])

  const statusReadyForActive = useMemo(() => {
    if (!activeUserId) return false
    return !statusLoading && Number(statusUserId) === Number(activeUserId)
  }, [activeUserId, statusLoading, statusUserId])

  const attendanceForActive = useMemo(() => {
    if (!statusReadyForActive) return null
    return todayAttendance
  }, [statusReadyForActive, todayAttendance])

  const canAttemptSubmit = useMemo(() => {
    return !!locked?.userId
  }, [locked?.userId])

  const inBlocked = useMemo(() => {
    if (!statusReadyForActive) return false
    return !!attendanceForActive?.checkIn
  }, [attendanceForActive?.checkIn, statusReadyForActive])

  const outBlocked = useMemo(() => {
    if (!statusReadyForActive) return true
    return !attendanceForActive?.checkIn || !!attendanceForActive?.checkOut
  }, [attendanceForActive?.checkIn, attendanceForActive?.checkOut, statusReadyForActive])

  const todayWibLabel = useMemo(() => {
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(new Date())
  }, [])

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">{`Absensi Karyawan · ${todayWibLabel}`}</h1>
        <p className="text-sm text-gray-600">Kiosk responsif. Tanpa login. Kamera live mendeteksi nama.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <p className="text-xs text-gray-400 uppercase font-semibold">Karyawan</p>
            <p className="font-semibold text-gray-900 truncate">
              {locked?.userName
                ? locked.userName
                : locked?.userId
                  ? `ID ${locked.userId}`
                  : recognized?.userName
                    ? recognized.userName
                    : recognized?.userId
                      ? `ID ${recognized.userId}`
                      : 'Arahkan wajah ke kamera'}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {statusLoading ? 'Memuat status...' : `Masuk ${formatWibTime(todayAttendance?.checkIn)} · Pulang ${formatWibTime(todayAttendance?.checkOut)}`}
            </p>
            {locked?.userId ? (
              <p className="text-xs text-gray-500 truncate">
                {hkLoading
                  ? 'Memuat HK belum dibayar...'
                  : hkUnpaid != null
                    ? `HK belum dibayar${hkRange ? ` (${hkRange.startDate} s/d ${hkRange.endDate})` : ''}: ${hkUnpaid} Hari`
                    : 'HK belum dibayar: -'}
              </p>
            ) : null}
          </div>

          <div className="shrink-0 flex flex-col items-end gap-2">
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                todayAttendance?.checkOut ? 'bg-blue-100 text-blue-700' : todayAttendance?.checkIn ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {todayAttendance?.checkOut ? 'Sudah Selesai Absen' : todayAttendance?.checkIn ? 'Bekerja' : 'Belum Absen'}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-gray-50 rounded-2xl p-4 flex items-start space-x-3">
        <div className={`p-2 rounded-xl ${location ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'}`}>
          <MapPin className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-gray-700">Lokasi</p>
            <button onClick={getLocation} disabled={locating} className="text-xs text-blue-600 font-medium flex items-center">
              {locating ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
              Perbarui
            </button>
          </div>
          <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{locating ? 'Mencari lokasi...' : location ? location.name : 'Lokasi belum terdeteksi'}</p>
          <p className="text-[11px] text-gray-400 mt-1">
            Kamera: {cameraReady ? 'siap' : 'belum siap'} · Wajah: {liveFaceCount == null ? '-' : liveFaceCount === 1 ? '1' : `${liveFaceCount} (tolak)`}
          </p>
        </div>
      </div>

      <div className="relative aspect-square bg-black rounded-3xl overflow-hidden shadow-lg border-4 border-white max-w-md mx-auto">
        <div ref={videoWrapRef} className="absolute inset-0">
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            videoConstraints={videoConstraints}
            className="w-full h-full object-cover"
            mirrored={true}
          />
        </div>
        {locked && lockedShot ? (
          <img
            src={lockedShot}
            alt="Captured"
            className="absolute inset-0 w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
          />
        ) : null}

        <div className="absolute inset-0 border-[30px] border-black/20 pointer-events-none flex items-center justify-center">
          <div className="w-80 h-80">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeDasharray="6 8" />
              {cameraReady && (liveFaceCount == null || liveFaceCount === 1) ? (
                locked ? (
                  <circle
                    cx="50"
                    cy="50"
                    r="46"
                    fill="none"
                    stroke="rgba(16,185,129,0.9)"
                    strokeWidth="3"
                    className="drop-shadow-[0_0_18px_rgba(16,185,129,0.45)]"
                  />
                ) : (
                  <g className="origin-center animate-spin">
                    <circle
                      cx="50"
                      cy="50"
                      r="46"
                      fill="none"
                      stroke="rgba(16,185,129,0.85)"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray="55 350"
                    />
                  </g>
                )
              ) : null}
            </svg>
          </div>
        </div>

        {overlay?.label ? (
          <div
            className="absolute bg-emerald-600 text-white text-xs px-2 py-1 rounded-full max-w-[90%] truncate"
            style={{ left: overlay.left, top: Math.max(0, overlay.top - 28) }}
          >
            {overlay.label}
          </div>
        ) : null}

        {locked ? (
          <button
            onClick={() => {
              setLocked(null)
              setLockedShot(null)
              setRecognized(null)
              setTodayAttendance(null)
              setStatusUserId(null)
              setHkUnpaid(null)
              setHkRange(null)
              streakRef.current = null
            }}
            disabled={submitting}
            className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full backdrop-blur-md"
            aria-label="Ganti karyawan"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => submitAttendance('IN')}
          disabled={
            submitting ||
            !canAttemptSubmit ||
            inBlocked ||
            (activeUserId ? statusLoading && Number(statusUserId) !== Number(activeUserId) : false)
          }
          className="flex flex-col items-center justify-center p-4 bg-green-600 disabled:bg-gray-200 text-white rounded-2xl shadow-md disabled:shadow-none transition-all active:scale-95"
        >
          {submitting ? <Loader2 className="w-6 h-6 animate-spin mb-1" /> : <CheckCircle2 className="w-6 h-6 mb-1" />}
          <span className="font-bold">Absen Masuk</span>
        </button>
        <button
          onClick={() => submitAttendance('OUT')}
          disabled={
            submitting ||
            !canAttemptSubmit ||
            outBlocked ||
            (activeUserId ? statusLoading && Number(statusUserId) !== Number(activeUserId) : false)
          }
          className="flex flex-col items-center justify-center p-4 bg-blue-600 disabled:bg-gray-200 text-white rounded-2xl shadow-md disabled:shadow-none transition-all active:scale-95"
        >
          {submitting ? <Loader2 className="w-6 h-6 animate-spin mb-1" /> : <LogOut className="w-6 h-6 mb-1" />}
          <span className="font-bold">Absen Pulang</span>
        </button>
      </div>
    </div>
  )
}
