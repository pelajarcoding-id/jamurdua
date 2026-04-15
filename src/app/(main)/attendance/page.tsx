'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Webcam from 'react-webcam'
import imageCompression from 'browser-image-compression'
import { Camera, MapPin, RefreshCw, CheckCircle2, LogOut, Loader2 } from 'lucide-react'
import { toast } from 'react-hot-toast'
import Image from 'next/image'
import { convertImageFileToWebp } from '@/lib/image-webp'

const videoConstraints = {
  width: 720,
  height: 720,
  facingMode: "user"
}

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

const formatWibDateFromYmd = (ymd: string | null | undefined) => {
  if (!ymd) return '-'
  const m = String(ymd).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return String(ymd)
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return String(ymd)
  const dt = new Date(Date.UTC(y, mo - 1, d, 0, 0, 0))
  return new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium' }).format(dt)
}

function dataUrlToFile(dataUrl: string, filename: string) {
  const parts = dataUrl.split(',')
  if (parts.length < 2) {
    throw new Error('Format foto tidak valid')
  }

  const mimeMatch = parts[0].match(/data:(.*?);base64/)
  const mime = mimeMatch?.[1] || 'image/jpeg'
  const binary = atob(parts[1])
  const bytes = new Uint8Array(binary.length)

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }

  return new File([bytes], filename, { type: mime })
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
      {
        signal: controller.signal,
        headers: { 'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8' },
      }
    )
    const data = await res.json()
    return data?.display_name || fallback
  } catch {
    return fallback
  } finally {
    clearTimeout(timeout)
  }
}

export default function AttendancePage() {
  const webcamRef = useRef<Webcam>(null)
  const [imgSrc, setImgSrc] = useState<string | null>(null)
  const [captureToken, setCaptureToken] = useState<number>(0)
  const captureTokenRef = useRef<number>(0)
  const captureTimeoutRef = useRef<number | null>(null)
  const [location, setLocation] = useState<{ lat: number; lng: number; name: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [locating, setLocating] = useState(false)
  const [attendance, setAttendance] = useState<any>(null)
  const [isCapturing, setIsCapturing] = useState(true)
  const [historyRows, setHistoryRows] = useState<any[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [photoModal, setPhotoModal] = useState<{ open: boolean; url: string | null; title: string }>({
    open: false,
    url: null,
    title: '',
  })

  useEffect(() => {
    captureTokenRef.current = captureToken
  }, [captureToken])

  useEffect(() => {
    if (captureTimeoutRef.current) {
      window.clearTimeout(captureTimeoutRef.current)
      captureTimeoutRef.current = null
    }

    if (!imgSrc || !captureToken) return

    captureTimeoutRef.current = window.setTimeout(() => {
      if (captureTokenRef.current !== captureToken) return
      setImgSrc(null)
      setIsCapturing(true)
      toast.error('Foto absensi sudah kadaluarsa (lebih dari 30 menit). Silakan ambil foto ulang.')
    }, 30 * 60 * 1000)

    return () => {
      if (captureTimeoutRef.current) {
        window.clearTimeout(captureTimeoutRef.current)
        captureTimeoutRef.current = null
      }
    }
  }, [captureToken, imgSrc])

  // Fetch current status
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/attendance')
      const data = await res.json()
      if (data.attendance) {
        setAttendance(data.attendance)
      }
    } catch (error) {
      console.error('Error fetching status:', error)
    }
  }, [])

  const fetchHistory = useCallback(async () => {
    try {
      setHistoryLoading(true)
      const res = await fetch('/api/attendance?history=1&limit=7', { cache: 'no-store' })
      const data = await res.json().catch(() => ({} as any))
      if (!res.ok) return
      setHistoryRows(Array.isArray(data?.history) ? data.history : [])
    } catch {
      setHistoryRows([])
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
    fetchHistory()
    getLocation()
  }, [fetchStatus, fetchHistory])

  const getLocation = async () => {
    setLocating(true)
    if (!navigator.geolocation) {
      toast.error('Geolokasi tidak didukung oleh browser Anda')
      setLocating(false)
      return
    }
    if (!window.isSecureContext) {
      toast.error('Di browser mobile, lokasi butuh HTTPS. Buka aplikasi via HTTPS.')
      setLocating(false)
      return
    }

    try {
      const permissionsApi = (navigator as any).permissions
      if (permissionsApi?.query) {
        try {
          const status = await permissionsApi.query({ name: 'geolocation' as PermissionName })
          if (status?.state === 'denied') {
            toast.error('Izin lokasi ditolak. Aktifkan izin lokasi di pengaturan browser.')
            setLocating(false)
            return
          }
        } catch {
          // ignore unsupported permissions API
        }
      }

      let position: GeolocationPosition
      try {
        position = await getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 0,
        })
      } catch {
        // Fallback untuk browser/perangkat yang sulit lock GPS
        position = await getCurrentPosition({
          enableHighAccuracy: false,
          timeout: 15000,
          maximumAge: 60000,
        })
      }

      const { latitude, longitude } = position.coords
      const locationName = await reverseGeocodeName(latitude, longitude)
      setLocation({
        lat: latitude,
        lng: longitude,
        name: locationName,
      })
    } catch (error: any) {
      const code = Number(error?.code)
      if (code === 1) {
        toast.error('Izin lokasi ditolak. Aktifkan izin lokasi untuk situs ini.')
      } else if (code === 2) {
        toast.error('Lokasi belum tersedia. Coba aktifkan GPS lalu tekan Perbarui.')
      } else if (code === 3) {
        toast.error('Permintaan lokasi timeout. Coba lagi atau pindah ke area sinyal lebih baik.')
      } else {
        toast.error('Gagal mendapatkan lokasi. Pastikan izin lokasi aktif.')
      }
    } finally {
      setLocating(false)
    }
  }

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot()
    if (imageSrc) {
      setImgSrc(imageSrc)
      setCaptureToken(Date.now())
      setIsCapturing(false)
    }
  }, [webcamRef])

  const retake = () => {
    setImgSrc(null)
    setCaptureToken(0)
    setIsCapturing(true)
  }

  const handleAttendance = async (type: 'IN' | 'OUT') => {
    if (!imgSrc || !location) {
      toast.error('Foto dan lokasi diperlukan')
      return
    }

    setLoading(true)
    const toastId = toast.loading('Sedang memproses absensi...')
    try {
      // Convert data URL screenshot to file without network fetch
      const file = dataUrlToFile(imgSrc, "attendance.jpg")

      // Compress and convert to WebP
      let compressedFile: File
      try {
        compressedFile = await imageCompression(file, {
          maxSizeMB: 0.2,
          maxWidthOrHeight: 800,
          useWebWorker: true,
          fileType: 'image/webp' as any
        })
        if (compressedFile.size > 350_000) {
          compressedFile = await imageCompression(file, {
            maxSizeMB: 0.15,
            maxWidthOrHeight: 720,
            useWebWorker: true,
            fileType: 'image/webp' as any
          })
        }
      } catch {
        compressedFile = await convertImageFileToWebp(file, { quality: 0.82, maxDimension: 720 })
      }

      const formData = new FormData()
      formData.append('photo', compressedFile)
      formData.append('lat', location.lat.toString())
      formData.append('long', location.lng.toString())
      formData.append('locationName', location.name)
      formData.append('type', type)

      const res = await fetch('/api/attendance', {
        method: 'POST',
        body: formData
      })

      const contentType = res.headers.get('content-type') || ''
      const raw = await res.text()
      const data = contentType.includes('application/json') ? JSON.parse(raw || '{}') : null
      if (!res.ok) {
        const msg = data?.error ? String(data.error) : raw || `HTTP ${res.status}`
        throw new Error(msg)
      }
      if (data?.error) throw new Error(String(data.error))

      toast.success(type === 'IN' ? 'Berhasil Absen Masuk' : 'Berhasil Absen Pulang', { id: toastId })
      setAttendance(data.attendance)
      setImgSrc(null)
      setCaptureToken(0)
      setIsCapturing(false)
      fetchStatus()
      fetchHistory()
    } catch (error: any) {
      toast.error(error.message || 'Gagal melakukan absensi', { id: toastId })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto p-4 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-gray-800">Absensi Selfie</h1>
        <p className="text-gray-500">Silakan lakukan absensi harian Anda</p>
      </div>

      {/* Status Card */}
      <div className="bg-white rounded-2xl shadow-sm border p-4 flex justify-around items-center">
        <div className="text-center">
          <p className="text-xs text-gray-400 uppercase font-semibold">Masuk</p>
          <p className="font-medium text-gray-700">
            {formatWibTime(attendance?.checkIn)}
          </p>
        </div>
        <div className="h-8 w-px bg-gray-100"></div>
        <div className="text-center">
          <p className="text-xs text-gray-400 uppercase font-semibold">Pulang</p>
          <p className="font-medium text-gray-700">
            {formatWibTime(attendance?.checkOut)}
          </p>
        </div>
        <div className="h-8 w-px bg-gray-100"></div>
        <div className="text-center">
          <p className="text-xs text-gray-400 uppercase font-semibold">Status</p>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${attendance?.checkOut ? 'bg-blue-100 text-blue-700' : attendance?.checkIn ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
            {attendance?.checkOut ? 'Selesai' : attendance?.checkIn ? 'Bekerja' : 'Belum Absen'}
          </span>
        </div>
      </div>

      {/* Camera / Preview Area */}
      <div className="relative aspect-square bg-black rounded-3xl overflow-hidden shadow-lg border-4 border-white">
        {isCapturing ? (
          <>
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              videoConstraints={videoConstraints}
              className="w-full h-full object-cover"
              mirrored={true}
            />
            <div className="absolute inset-0 border-[30px] border-black/20 pointer-events-none flex items-center justify-center">
               <div className="w-64 h-64 border-2 border-white/50 rounded-full border-dashed"></div>
            </div>
            <button
              onClick={capture}
              className="absolute bottom-6 left-1/2 -translate-x-1/2 w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-xl active:scale-90 transition-transform"
            >
              <div className="w-12 h-12 border-4 border-gray-200 rounded-full"></div>
            </button>
          </>
        ) : imgSrc ? (
          <>
            <Image 
              src={imgSrc} 
              alt="Selfie" 
              fill 
              className="object-cover mirrored"
              style={{ transform: 'scaleX(-1)' }}
            />
            <button
              onClick={retake}
              className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full backdrop-blur-md"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-white space-y-4">
            <Camera className="w-12 h-12 opacity-50" />
            <button 
              onClick={() => setIsCapturing(true)}
              className="px-6 py-2 bg-white text-black rounded-full font-semibold"
            >
              Buka Kamera
            </button>
          </div>
        )}
      </div>

      {/* Location Info */}
      <div className="bg-gray-50 rounded-2xl p-4 flex items-start space-x-3">
        <div className={`p-2 rounded-xl ${location ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'}`}>
          <MapPin className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">Lokasi Anda</p>
            <button 
              onClick={getLocation} 
              disabled={locating}
              className="text-xs text-blue-600 font-medium flex items-center"
            >
              {locating ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
              Perbarui
            </button>
          </div>
          <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">
            {locating ? 'Mencari lokasi...' : location ? location.name : 'Lokasi belum terdeteksi'}
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => handleAttendance('IN')}
          disabled={loading || !imgSrc || !location || !!attendance?.checkIn}
          className="flex flex-col items-center justify-center p-4 bg-green-600 disabled:bg-gray-200 text-white rounded-2xl shadow-md disabled:shadow-none transition-all active:scale-95"
        >
          {loading ? <Loader2 className="w-6 h-6 animate-spin mb-1" /> : <CheckCircle2 className="w-6 h-6 mb-1" />}
          <span className="font-bold">Absen Masuk</span>
        </button>
        <button
          onClick={() => handleAttendance('OUT')}
          disabled={loading || !imgSrc || !location || !attendance?.checkIn || !!attendance?.checkOut}
          className="flex flex-col items-center justify-center p-4 bg-blue-600 disabled:bg-gray-200 text-white rounded-2xl shadow-md disabled:shadow-none transition-all active:scale-95"
        >
          {loading ? <Loader2 className="w-6 h-6 animate-spin mb-1" /> : <LogOut className="w-6 h-6 mb-1" />}
          <span className="font-bold">Absen Pulang</span>
        </button>
      </div>

      {attendance?.checkOut && (
        <div className="text-center p-4 bg-blue-50 text-blue-700 rounded-2xl border border-blue-100">
          <p className="text-sm font-medium">Anda sudah menyelesaikan absensi hari ini. Terima kasih!</p>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900">Riwayat Absensi (7 Hari)</h2>
          <button
            type="button"
            onClick={fetchHistory}
            className="text-xs text-blue-600 font-medium"
            disabled={historyLoading}
          >
            {historyLoading ? 'Memuat...' : 'Refresh'}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="py-2 pr-3">Tanggal</th>
                <th className="py-2 pr-3">Masuk</th>
                <th className="py-2 pr-3">Pulang</th>
                <th className="py-2 pr-3">Foto</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {historyRows.length === 0 ? (
                <tr>
                  <td className="py-3 text-gray-500" colSpan={4}>
                    {historyLoading ? 'Memuat...' : 'Belum ada riwayat.'}
                  </td>
                </tr>
              ) : (
                historyRows.map((r) => {
                  const dateText = formatWibDateFromYmd(r?.date)
                  return (
                    <tr key={r.id}>
                      <td className="py-2 pr-3 text-gray-700">{dateText}</td>
                      <td className="py-2 pr-3 text-gray-700">{formatWibTime(r.checkIn)}</td>
                      <td className="py-2 pr-3 text-gray-700">{formatWibTime(r.checkOut)}</td>
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="text-xs text-blue-600 disabled:text-gray-300"
                            disabled={!r.photoInUrl}
                            onClick={() => setPhotoModal({ open: true, url: r.photoInUrl, title: 'Foto Masuk' })}
                          >
                            Masuk
                          </button>
                          <button
                            type="button"
                            className="text-xs text-blue-600 disabled:text-gray-300"
                            disabled={!r.photoOutUrl}
                            onClick={() => setPhotoModal({ open: true, url: r.photoOutUrl, title: 'Foto Pulang' })}
                          >
                            Pulang
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {photoModal.open && photoModal.url ? (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setPhotoModal({ open: false, url: null, title: '' })}
        >
          <div
            className="bg-white rounded-2xl overflow-hidden max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="text-sm font-semibold text-gray-900">{photoModal.title}</div>
              <button
                type="button"
                className="text-sm text-gray-500"
                onClick={() => setPhotoModal({ open: false, url: null, title: '' })}
              >
                Tutup
              </button>
            </div>
            <div className="p-3 bg-gray-50">
              <img src={photoModal.url} alt={photoModal.title} className="w-full rounded-xl" />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
