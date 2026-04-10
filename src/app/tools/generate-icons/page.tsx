'use client'

import { useCallback, useRef, useState } from 'react'

function drawCube(ctx: CanvasRenderingContext2D, size: number) {
  const w = size
  ctx.clearRect(0, 0, w, w)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, w)

  const pad = w * 0.1
  const cx = w / 2
  const cy = w / 2 - w * 0.05
  const t = w * 0.18
  const h = w * 0.12

  const blue = '#2563eb' // tailwind blue-600
  const blueDark = '#1e40af' // blue-800

  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  // Top diamond
  ctx.beginPath()
  ctx.moveTo(cx, cy - t)
  ctx.lineTo(cx + t, cy)
  ctx.lineTo(cx, cy + t)
  ctx.lineTo(cx - t, cy)
  ctx.closePath()
  ctx.fillStyle = blue
  ctx.fill()
  ctx.lineWidth = w * 0.03
  ctx.strokeStyle = blueDark
  ctx.stroke()

  // Left face
  ctx.beginPath()
  ctx.moveTo(cx - t, cy)
  ctx.lineTo(cx, cy + t)
  ctx.lineTo(cx, cy + t + h)
  ctx.lineTo(cx - t, cy + h)
  ctx.closePath()
  ctx.fillStyle = '#3b82f6' // blue-500
  ctx.fill()
  ctx.lineWidth = w * 0.03
  ctx.strokeStyle = blueDark
  ctx.stroke()

  // Right face
  ctx.beginPath()
  ctx.moveTo(cx + t, cy)
  ctx.lineTo(cx, cy + t)
  ctx.lineTo(cx, cy + t + h)
  ctx.lineTo(cx + t, cy + h)
  ctx.closePath()
  ctx.fillStyle = '#1d4ed8' // blue-700
  ctx.fill()
  ctx.lineWidth = w * 0.03
  ctx.strokeStyle = blueDark
  ctx.stroke()

  // Base shadow
  ctx.beginPath()
  const r = w * 0.24
  ctx.ellipse(cx, cy + t + h + w * 0.08, r, w * 0.05, 0, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(0,0,0,0.06)'
  ctx.fill()

  // Safe zone border (for maskable)
  ctx.lineWidth = 1
  ctx.strokeStyle = 'rgba(0,0,0,0.06)'
  ctx.strokeRect(pad, pad, w - pad * 2, w - pad * 2)
}

export default function GenerateIconsPage() {
  const c192 = useRef<HTMLCanvasElement>(null)
  const c512 = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState<string>('')

  const handleGenerate = useCallback(async () => {
    setStatus('Membuat ikon...')
    const canvases: Array<{ ref: React.RefObject<HTMLCanvasElement>, size: number }> = [
      { ref: c192, size: 192 },
      { ref: c512, size: 512 },
    ]
    try {
      for (const { ref, size } of canvases) {
        const canvas = ref.current!
        const ctx = canvas.getContext('2d')!
        drawCube(ctx, size)
        const dataUrl = canvas.toDataURL('image/png')
        const res = await fetch('/api/icons/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ size, dataUrl })
        })
        if (!res.ok) {
          const msg = await res.text()
          throw new Error(`Gagal menyimpan ikon ${size}: ${msg}`)
        }
      }
      setStatus('Ikon berhasil dibuat di /public/icons')
    } catch (e: any) {
      setStatus(`Gagal: ${e.message || 'unknown error'}`)
    }
  }, [])

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow p-6">
        <h1 className="text-xl font-bold mb-2">Generator Ikon PWA</h1>
        <p className="text-sm text-gray-600 mb-4">
          Membuat ikon PNG 192x192 dan 512x512 dengan logo kubik biru Sarakan. Tekan tombol di bawah untuk menyimpan ke public/icons/.
        </p>
        <div className="grid grid-cols-2 gap-6 items-center">
          <div className="text-sm text-gray-500">Preview 192x192</div>
          <div className="text-sm text-gray-500">Preview 512x512</div>
          <canvas ref={c192} width={192} height={192} className="border rounded" />
          <canvas ref={c512} width={512} height={512} className="border rounded" />
        </div>
        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={handleGenerate}
            className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
          >
            Buat dan Simpan Ikon
          </button>
          <span className="text-sm text-gray-600">{status}</span>
        </div>
      </div>
    </main>
  )
}

