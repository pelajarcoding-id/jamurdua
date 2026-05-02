'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Webcam from 'react-webcam'
import { toast } from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { convertImageFileToWebp } from '@/lib/image-webp'
import { getFaceCountFromFile, getFaceDescriptorFromFile } from '@/lib/faceapi-client'
import RoleGate from '@/components/RoleGate'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { cn } from '@/lib/utils'
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/24/outline'

const videoConstraints = {
  width: 720,
  height: 720,
  facingMode: 'user',
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

type UserOption = { id: number; name: string; role: string; status: string | null }

function SearchableUserPicker({
  value,
  onChange,
  options,
  disabled,
}: {
  value: string
  onChange: (next: string) => void
  options: UserOption[]
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const selected = value ? options.find((o) => String(o.id) === value) : null
  const label = selected ? `${selected.name} (${selected.id})` : 'Pilih karyawan'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between rounded-xl"
        >
          <span className="truncate">{label}</span>
          <ChevronUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Cari karyawan..." />
          <CommandList>
            <CommandEmpty>Karyawan tidak ditemukan.</CommandEmpty>
            <CommandGroup>
              {options.map((u) => {
                const v = String(u.id)
                const text = `${u.name} (${u.id}) - ${u.role}`
                return (
                  <CommandItem
                    key={u.id}
                    value={text}
                    onSelect={() => {
                      onChange(v)
                      setOpen(false)
                    }}
                  >
                    <CheckIcon className={cn('mr-2 h-4 w-4', value === v ? 'opacity-100' : 'opacity-0')} />
                    <span className="truncate">{text}</span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export default function FaceEnrollmentPage() {
  const webcamRef = useRef<Webcam>(null)
  const [userId, setUserId] = useState('')
  const [userPreview, setUserPreview] = useState<{ id: number; name: string; role: string; status: string | null } | null>(null)
  const [userPreviewLoading, setUserPreviewLoading] = useState(false)
  const [userOptions, setUserOptions] = useState<UserOption[]>([])
  const [userOptionsLoading, setUserOptionsLoading] = useState(false)
  const [imgSrc, setImgSrc] = useState<string | null>(null)
  const [isCapturing, setIsCapturing] = useState(true)
  const [saving, setSaving] = useState(false)
  const modelsUrl = useMemo(() => process.env.NEXT_PUBLIC_FACE_MODELS_URL || 'https://justadudewhohacks.github.io/face-api.js/models', [])

  useEffect(() => {
    const loadUsers = async () => {
      try {
        setUserOptionsLoading(true)
        const res = await fetch('/api/users?page=1&limit=1000&status=AKTIF&role=KARYAWAN', { cache: 'no-store' })
        const json = await res.json().catch(() => ({} as any))
        if (!res.ok) {
          setUserOptions([])
          return
        }
        const list = Array.isArray(json?.data) ? json.data : []
        const mapped = list
          .map((x: any) => ({
            id: Number(x?.id),
            name: String(x?.name || ''),
            role: String(x?.role || ''),
            status: x?.status == null ? null : String(x.status),
          }))
          .filter((x: any) => Number.isFinite(x.id) && x.id > 0 && x.name)
          .sort((a: UserOption, b: UserOption) => a.name.localeCompare(b.name, 'id-ID', { sensitivity: 'base' }))
        setUserOptions(mapped)
      } catch {
        setUserOptions([])
      } finally {
        setUserOptionsLoading(false)
      }
    }
    loadUsers()
  }, [])

  useEffect(() => {
    const raw = String(userId || '').trim()
    const id = Number(raw)
    if (!raw || !Number.isFinite(id) || id <= 0) {
      setUserPreview(null)
      setUserPreviewLoading(false)
      return
    }

    const controller = new AbortController()
    const t = window.setTimeout(async () => {
      try {
        setUserPreviewLoading(true)
        const res = await fetch(`/api/users?search=${encodeURIComponent(String(id))}&page=1&limit=10&status=AKTIF`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        const json = await res.json().catch(() => ({} as any))
        if (!res.ok) {
          setUserPreview(null)
          return
        }
        const list = Array.isArray(json?.data) ? json.data : []
        const found = list.find((x: any) => Number(x?.id) === id)
        if (!found) {
          setUserPreview(null)
          return
        }
        setUserPreview({
          id: Number(found.id),
          name: String(found.name || ''),
          role: String(found.role || ''),
          status: found.status == null ? null : String(found.status),
        })
      } catch {
        setUserPreview(null)
      } finally {
        setUserPreviewLoading(false)
      }
    }, 350)

    return () => {
      controller.abort()
      window.clearTimeout(t)
    }
  }, [userId])

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot()
    if (!imageSrc) return
    setImgSrc(imageSrc)
    setIsCapturing(false)
  }, [])

  const retake = useCallback(() => {
    setImgSrc(null)
    setIsCapturing(true)
  }, [])

  const enroll = useCallback(async () => {
    const id = Number(userId)
    if (!Number.isFinite(id) || id <= 0) {
      toast.error('UserId tidak valid')
      return
    }
    if (!imgSrc) {
      toast.error('Ambil foto dulu')
      return
    }

    setSaving(true)
    const toastId = toast.loading('Menyimpan face profile...')
    try {
      const rawFile = dataUrlToFile(imgSrc, 'enroll.jpg')
      const file = await convertImageFileToWebp(rawFile, { quality: 0.9, maxDimension: 1280, targetMaxBytes: 650_000 })

      const count = await getFaceCountFromFile(file)
      if (count != null && count !== 1) {
        toast.error(count <= 0 ? 'Wajah tidak terdeteksi' : 'Terdeteksi lebih dari 1 wajah')
        return
      }

      const descriptor = await getFaceDescriptorFromFile(file)
      if (!descriptor) {
        toast.error('Gagal ambil descriptor wajah. Coba ulang.')
        return
      }

      const res = await fetch('/api/face/enroll', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: id, descriptor }),
      })
      const json = await res.json().catch(() => ({} as any))
      if (!res.ok) throw new Error(json?.error || 'Gagal enroll')

      toast.success('Enroll berhasil')
      retake()
    } catch (e: any) {
      toast.error(e?.message || 'Gagal enroll')
    } finally {
      toast.dismiss(toastId)
      setSaving(false)
    }
  }, [imgSrc, retake, userId])

  const remove = useCallback(async () => {
    const id = Number(userId)
    if (!Number.isFinite(id) || id <= 0) {
      toast.error('UserId tidak valid')
      return
    }
    setSaving(true)
    const toastId = toast.loading('Menghapus face profile...')
    try {
      const res = await fetch(`/api/face/enroll?userId=${id}`, { method: 'DELETE' })
      const json = await res.json().catch(() => ({} as any))
      if (!res.ok) throw new Error(json?.error || 'Gagal hapus')
      toast.success('Face profile dihapus')
    } catch (e: any) {
      toast.error(e?.message || 'Gagal hapus')
    } finally {
      toast.dismiss(toastId)
      setSaving(false)
    }
  }, [userId])

  return (
    <RoleGate allow={['ADMIN', 'PEMILIK']}>
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Face Enrollment</h1>
          <p className="text-sm text-muted-foreground">Daftarkan wajah karyawan untuk absensi kiosk (auto recognize).</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base">Pilih Karyawan</CardTitle>
              <CardDescription>Pilih dari daftar, atau input User ID manual.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div className="text-sm font-medium">Karyawan</div>
                <SearchableUserPicker
                  value={userId}
                  onChange={(v) => setUserId(v)}
                  options={userOptions}
                  disabled={userOptionsLoading || saving}
                />
                <div className="text-xs text-muted-foreground">{userOptionsLoading ? 'Memuat daftar karyawan...' : `Total: ${userOptions.length}`}</div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">User ID</div>
                <Input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="contoh: 123" inputMode="numeric" disabled={saving} />
                <div className="text-sm text-muted-foreground">
                  {userPreviewLoading ? (
                    'Mencari...'
                  ) : userPreview ? (
                    <>
                      Nama: {userPreview.name} | Role: {userPreview.role || '-'} | Status: {userPreview.status || 'AKTIF'}
                    </>
                  ) : String(userId || '').trim() ? (
                    'User tidak ditemukan'
                  ) : (
                    'Pilih karyawan dulu'
                  )}
                </div>
              </div>

              <div className="rounded-xl border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Models: {modelsUrl}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base">Foto Wajah</CardTitle>
              <CardDescription>Pastikan 1 wajah, terang, tanpa masker, posisi depan.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="w-full overflow-hidden rounded-2xl bg-black">
                {isCapturing ? (
                  <Webcam
                    audio={false}
                    ref={webcamRef}
                    screenshotFormat="image/jpeg"
                    videoConstraints={videoConstraints}
                    className="w-full h-auto"
                  />
                ) : imgSrc ? (
                  <img src={imgSrc} alt="Preview" className="w-full h-auto" />
                ) : null}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {isCapturing ? (
                  <Button onClick={capture} disabled={saving || !String(userId || '').trim()} className="rounded-xl">
                    Ambil foto
                  </Button>
                ) : (
                  <Button variant="outline" onClick={retake} disabled={saving} className="rounded-xl">
                    Ambil ulang
                  </Button>
                )}
                <Button onClick={enroll} disabled={!imgSrc || saving} className="rounded-xl">
                  Enroll
                </Button>
                <Button variant="destructive" onClick={remove} disabled={saving || !String(userId || '').trim()} className="rounded-xl">
                  Hapus
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </RoleGate>
  )
}
