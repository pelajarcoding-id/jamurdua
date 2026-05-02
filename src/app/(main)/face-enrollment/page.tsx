'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Webcam from 'react-webcam'
import { toast } from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { ModalContentWrapper, ModalHeader } from '@/components/ui/modal-elements'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import { convertImageFileToWebp } from '@/lib/image-webp'
import { getFaceCountFromFile, getFaceDescriptorFromFile } from '@/lib/faceapi-client'
import RoleGate from '@/components/RoleGate'
import { Camera, Eye, RefreshCw, Trash2 } from 'lucide-react'
import { XMarkIcon } from '@heroicons/react/24/outline'

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

export default function FaceEnrollmentPage() {
  const webcamRef = useRef<Webcam>(null)
  const [userId, setUserId] = useState('')
  const [userOptions, setUserOptions] = useState<UserOption[]>([])
  const [userOptionsLoading, setUserOptionsLoading] = useState(false)
  const [userQuery, setUserQuery] = useState('')
  const [imgSrc, setImgSrc] = useState<string | null>(null)
  const [isCapturing, setIsCapturing] = useState(true)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [profiles, setProfiles] = useState<Array<{ userId: number; name: string; role: string | null; status: string | null; updatedAt: string; photoUrl: string | null }>>([])
  const [profilesLoading, setProfilesLoading] = useState(false)
  const [profilesQuery, setProfilesQuery] = useState('')
  const [profilesApplied, setProfilesApplied] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewProfile, setPreviewProfile] = useState<{
    userId: number
    name: string
    role: string | null
    status: string | null
    updatedAt: string
    photoUrl: string | null
  } | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ userId: number; name: string } | null>(null)

  useEffect(() => {
    const loadUsers = async () => {
      try {
        setUserOptionsLoading(true)
        const res = await fetch('/api/users?page=1&limit=2000&status=AKTIF', { cache: 'no-store' })
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

  const selectedUser = useMemo(() => {
    const id = Number(String(userId || '').trim())
    if (!Number.isFinite(id) || id <= 0) return null
    return userOptions.find((u) => u.id === id) || null
  }, [userId, userOptions])

  const filteredUsers = useMemo(() => {
    const q = String(userQuery || '').trim().toLowerCase()
    const base = userOptions
    if (!q) return base.slice(0, 12)
    return base
      .filter((u) => u.name.toLowerCase().includes(q) || String(u.id).includes(q))
      .slice(0, 12)
  }, [userOptions, userQuery])

  const loadProfiles = useCallback(async (search: string) => {
    try {
      setProfilesLoading(true)
      const params = new URLSearchParams({ limit: '500' })
      const s = String(search || '').trim()
      if (s) params.set('search', s)
      const res = await fetch(`/api/face/enroll?${params.toString()}`, { cache: 'no-store' })
      const json = await res.json().catch(() => ({} as any))
      if (!res.ok) throw new Error(json?.error || 'Gagal memuat face profile')
      const list = Array.isArray(json?.data) ? json.data : []
      const mapped = list
        .map((x: any) => ({
          userId: Number(x?.userId),
          name: String(x?.name || ''),
          role: x?.role == null ? null : String(x.role),
          status: x?.status == null ? null : String(x.status),
          updatedAt: String(x?.updatedAt || ''),
          photoUrl: x?.photoUrl == null ? null : String(x.photoUrl),
        }))
        .filter((x: any) => Number.isFinite(x.userId) && x.userId > 0 && x.name)
      setProfiles(mapped)
    } catch (e: any) {
      setProfiles([])
      toast.error(e?.message || 'Gagal memuat face profile')
    } finally {
      setProfilesLoading(false)
    }
  }, [])

  const applyProfilesSearch = useCallback(
    (term: string) => {
      const s = String(term || '').trim()
      setProfilesApplied(s)
      loadProfiles(s)
    },
    [loadProfiles]
  )

  useEffect(() => {
    applyProfilesSearch('')
  }, [applyProfilesSearch])

  const openCamera = useCallback(() => {
    setImgSrc(null)
    setIsCapturing(true)
    setCameraOpen(true)
  }, [])

  const capture = useCallback(() => {
    if (!cameraOpen) return
    const imageSrc = webcamRef.current?.getScreenshot()
    if (!imageSrc) return
    setImgSrc(imageSrc)
    setIsCapturing(false)
    setCameraOpen(false)
  }, [cameraOpen])

  const retake = useCallback(() => {
    setImgSrc(null)
    setIsCapturing(true)
    setCameraOpen(false)
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
        body: (() => {
          const fd = new FormData()
          fd.append('userId', String(id))
          fd.append('descriptor', JSON.stringify(descriptor))
          fd.append('photo', file)
          return fd
        })(),
      })
      const json = await res.json().catch(() => ({} as any))
      if (!res.ok) throw new Error(json?.error || 'Gagal enroll')

      toast.success('Enroll berhasil')
      retake()
      applyProfilesSearch(profilesApplied)
    } catch (e: any) {
      toast.error(e?.message || 'Gagal enroll')
    } finally {
      toast.dismiss(toastId)
      setSaving(false)
    }
  }, [applyProfilesSearch, imgSrc, profilesApplied, retake, userId])

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
      retake()
      applyProfilesSearch(profilesApplied)
    } catch (e: any) {
      toast.error(e?.message || 'Gagal hapus')
    } finally {
      toast.dismiss(toastId)
      setSaving(false)
    }
  }, [applyProfilesSearch, profilesApplied, retake, userId])

  const removeByUserId = useCallback(
    async (id: number) => {
      if (!Number.isFinite(id) || id <= 0) return
      const toastId = toast.loading('Menghapus face profile...')
      try {
        const res = await fetch(`/api/face/enroll?userId=${id}`, { method: 'DELETE' })
        const json = await res.json().catch(() => ({} as any))
        if (!res.ok) throw new Error(json?.error || 'Gagal hapus')
        toast.success('Face profile dihapus')
        if (Number(String(userId || '').trim()) === id) {
          retake()
        }
        applyProfilesSearch(profilesApplied)
      } catch (e: any) {
        toast.error(e?.message || 'Gagal hapus')
      } finally {
        toast.dismiss(toastId)
      }
    },
    [applyProfilesSearch, profilesApplied, retake, userId]
  )

  return (
    <RoleGate allow={['ADMIN', 'PEMILIK']}>
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Registrasi Wajah Karyawan</h1>
          <p className="text-sm text-muted-foreground">Daftarkan wajah karyawan untuk absensi harian (auto recognize).</p>
        </div>

        <Card className="rounded-2xl">
          <CardHeader className="text-center">
            <CardTitle className="text-base">Registrasi Wajah</CardTitle>
            <CardDescription>Pilih karyawan, buka kamera, ambil foto, lalu daftarkan.</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <div className="w-full max-w-xl space-y-4">
              <div className="space-y-2">
                <div className="text-sm font-medium text-center">Karyawan</div>
                <div className="relative">
                  <Input
                    value={userQuery}
                    onChange={(e) => {
                      setUserQuery(e.target.value)
                    }}
                    placeholder={userOptionsLoading ? 'Memuat karyawan...' : 'Cari karyawan...'}
                    disabled={userOptionsLoading || saving}
                    className="rounded-full"
                  />
                  <div className="mt-2 w-full max-h-56 overflow-y-auto rounded-2xl border bg-background">
                    {filteredUsers.map((u) => {
                      const picked = Number(userId) === u.id
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => {
                            setUserId(String(u.id))
                            setUserQuery(`${u.name} (${u.id})`)
                            setImgSrc(null)
                            setIsCapturing(true)
                            setCameraOpen(false)
                          }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-muted ${picked ? 'bg-emerald-50 text-emerald-700' : ''}`}
                        >
                          {u.name} ({u.id}){u.role ? ` - ${u.role}` : ''}
                        </button>
                      )
                    })}
                    {!userOptionsLoading && filteredUsers.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">Karyawan tidak ditemukan</div>
                    ) : null}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground text-center">
                  {userOptionsLoading ? 'Memuat daftar karyawan...' : `Total: ${userOptions.length}`}
                </div>
              </div>

              <div className="text-sm text-muted-foreground text-center">
                {selectedUser ? (
                  <>
                    Nama: {selectedUser.name} | Role: {selectedUser.role || '-'} | Status: {selectedUser.status || 'AKTIF'}
                  </>
                ) : userId ? (
                  'User tidak ditemukan'
                ) : (
                  'Pilih karyawan dulu'
                )}
              </div>

              <div className="flex flex-col items-center gap-2">
                {isCapturing && !cameraOpen ? (
                  <Button
                    onClick={openCamera}
                    disabled={saving || !selectedUser}
                    className="rounded-xl w-fit bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    <Camera className="h-5 w-5 mr-2" />
                    Buka Kamera
                  </Button>
                ) : null}
              </div>

              {cameraOpen || imgSrc ? (
                <div className="space-y-4">
                  {isCapturing && cameraOpen ? (
                    <>
                      <div className="relative aspect-square bg-black rounded-3xl overflow-hidden shadow-lg border-4 border-white max-w-md mx-auto">
                        <div className="absolute inset-0">
                          <Webcam
                            audio={false}
                            ref={webcamRef}
                            screenshotFormat="image/jpeg"
                            videoConstraints={videoConstraints}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="absolute inset-0 border-[30px] border-black/20 pointer-events-none flex items-center justify-center">
                          <div className="w-72 h-72">
                            <svg viewBox="0 0 100 100" className="w-full h-full">
                              <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeDasharray="6 8" />
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
                            </svg>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-center gap-2">
                        <Button
                          onClick={capture}
                          disabled={saving || !selectedUser}
                          className="rounded-xl w-fit bg-emerald-600 text-white hover:bg-emerald-700"
                        >
                          Ambil foto
                        </Button>
                      </div>
                    </>
                  ) : imgSrc ? (
                    <div className="w-full overflow-hidden rounded-2xl bg-black">
                      <img src={imgSrc} alt="Preview" className="w-full h-auto" />
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {isCapturing ? (
                      <Button variant="outline" onClick={retake} disabled={saving} className="rounded-xl">
                        Reset
                      </Button>
                    ) : (
                      <Button variant="outline" onClick={retake} disabled={saving} className="rounded-xl">
                        Ambil ulang
                      </Button>
                    )}
                    <Button onClick={enroll} disabled={!imgSrc || saving || !selectedUser} className="rounded-xl">
                      Daftarkan
                    </Button>
                    <Button variant="destructive" onClick={remove} disabled={saving || !selectedUser} className="rounded-xl">
                      Hapus
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Karyawan Terdaftar Wajah</CardTitle>
            <CardDescription>Daftar karyawan yang sudah punya face profile.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
              <Input
                value={profilesQuery}
                onChange={(e) => {
                  const v = e.target.value
                  setProfilesQuery(v)
                  if (!String(v || '').trim()) applyProfilesSearch('')
                }}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return
                  e.preventDefault()
                  applyProfilesSearch(profilesQuery)
                }}
                placeholder="Cari nama atau ID..."
                className="rounded-full sm:max-w-sm"
                disabled={profilesLoading}
              />
              <div className="text-xs text-muted-foreground">
                {profilesLoading ? 'Memuat...' : `Total: ${profiles.length}`}
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-semibold">ID</th>
                    <th className="px-3 py-2 font-semibold">Nama</th>
                    <th className="px-3 py-2 font-semibold">Role</th>
                    <th className="px-3 py-2 font-semibold">Wajah</th>
                    <th className="px-3 py-2 font-semibold">Update</th>
                    <th className="px-3 py-2 font-semibold text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((p) => (
                    <tr key={p.userId} className="border-t">
                      <td className="px-3 py-2 whitespace-nowrap">{p.userId}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{p.name}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{p.role || '-'}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="rounded-xl"
                          onClick={() => {
                            setPreviewProfile(p)
                            setPreviewOpen(true)
                          }}
                          aria-label="Lihat wajah"
                        >
                          <Eye className="h-5 w-5" />
                        </Button>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{p.updatedAt ? new Date(p.updatedAt).toLocaleString('id-ID') : '-'}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-right">
                        <div className="inline-flex items-center gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="rounded-xl"
                            onClick={() => {
                              setUserId(String(p.userId))
                              setUserQuery(`${p.name} (${p.userId})`)
                              retake()
                              window.scrollTo({ top: 0, behavior: 'smooth' })
                            }}
                            aria-label="Update wajah"
                          >
                            <RefreshCw className="h-5 w-5" />
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="rounded-xl"
                            onClick={() => {
                              setDeleteTarget({ userId: p.userId, name: p.name })
                              setDeleteOpen(true)
                            }}
                            aria-label="Hapus wajah"
                          >
                            <Trash2 className="h-5 w-5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!profilesLoading && profiles.length === 0 ? (
                    <tr>
                      <td className="px-3 py-6 text-center text-muted-foreground" colSpan={6}>
                        Tidak ada data
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Dialog
          open={previewOpen}
          onOpenChange={(o) => {
            setPreviewOpen(o)
            if (!o) setPreviewProfile(null)
          }}
        >
          <DialogContent className="p-0 overflow-hidden">
            <ModalHeader title="Wajah Terdaftar" />
            <ModalContentWrapper>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-gray-900 truncate">
                    {previewProfile ? `${previewProfile.name} (${previewProfile.userId})` : '-'}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {previewProfile?.role || '-'} · {previewProfile?.status || 'AKTIF'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPreviewOpen(false)
                    setPreviewProfile(null)
                  }}
                  className="rounded-full p-2 hover:bg-gray-100"
                  aria-label="Tutup"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-3 rounded-2xl bg-black overflow-hidden">
                {previewProfile?.photoUrl ? (
                  <img src={previewProfile.photoUrl} alt="Wajah" className="w-full h-auto" />
                ) : (
                  <div className="p-6 text-center text-sm text-white/70">Foto wajah belum tersimpan</div>
                )}
              </div>
            </ModalContentWrapper>
          </DialogContent>
        </Dialog>

        <ConfirmationModal
          isOpen={deleteOpen}
          onClose={() => {
            setDeleteOpen(false)
            setDeleteTarget(null)
          }}
          onConfirm={() => {
            const id = Number(deleteTarget?.userId)
            setDeleteOpen(false)
            setDeleteTarget(null)
            removeByUserId(id)
          }}
          title="Hapus Wajah"
          description={`Hapus face profile untuk ${deleteTarget?.name || '-'} (${deleteTarget?.userId || '-'})?`}
          variant="emerald"
          confirmLabel="Hapus"
        />
      </div>
    </RoleGate>
  )
}
