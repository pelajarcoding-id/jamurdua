'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowDownTrayIcon, XMarkIcon } from '@heroicons/react/24/outline'

type Props = {
  src: string
  alt?: string
  onClose: () => void
  downloadable?: boolean
}

export default function ImageViewer({ src, alt = 'Preview', onClose, downloadable = true }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const [mounted, setMounted] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const [scale, setScale] = useState(1)
  const [tx, setTx] = useState(0)
  const [ty, setTy] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [lastX, setLastX] = useState(0)
  const [lastY, setLastY] = useState(0)
  const [pointerCount, setPointerCount] = useState(0)
  const [doubleTapTs, setDoubleTapTs] = useState(0)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    const next = Math.min(4, Math.max(1, scale + delta))
    setScale(next)
  }

  const onPointerDown = (e: React.PointerEvent) => {
    ;(e.target as Element).setPointerCapture(e.pointerId)
    setPointerCount(c => c + 1)
    setDragging(true)
    setLastX(e.clientX)
    setLastY(e.clientY)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return
    const dx = e.clientX - lastX
    const dy = e.clientY - lastY
    setLastX(e.clientX)
    setLastY(e.clientY)
    setTx(t => t + dx)
    setTy(t => t + dy)
  }

  const onPointerUp = (e: React.PointerEvent) => {
    ;(e.target as Element).releasePointerCapture(e.pointerId)
    setPointerCount(c => Math.max(0, c - 1))
    setDragging(false)
    if (scale <= 1 && Math.abs(ty) > 120 && Math.abs(tx) < 80) {
      onClose()
    }
  }

  const onClick = () => {
    const now = Date.now()
    if (now - doubleTapTs < 300) {
      const next = scale >= 2 ? 1 : 2
      setScale(next)
      setTx(0)
      setTy(0)
    }
    setDoubleTapTs(now)
  }

  if (!mounted) return null

  return createPortal((
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center"
    >
      <div className="absolute top-4 right-4 flex gap-2">
        {downloadable && !error && (
          <a
            href={src}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors shadow-sm"
            title="Download"
          >
            <ArrowDownTrayIcon className="w-5 h-5" />
          </a>
        )}
        <button
          onClick={onClose}
          className="p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors shadow-sm"
          title="Tutup"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>
      {!error ? (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          onWheel={handleWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onClick={onClick}
          className="max-w-[95vw] sm:max-w-3xl max-h-[85vh] w-auto h-auto object-contain will-change-transform select-none rounded-lg shadow-2xl"
          style={{ transform: `translate(${tx}px, ${ty}px) scale(${scale})` }}
        />
      ) : (
        <div className="flex items-center justify-center w-[95vw] sm:max-w-3xl h-[60vh]">
          <div className="px-4 py-3 rounded-md bg-white shadow text-gray-700">
            Gambar tidak ditemukan atau tidak dapat dimuat.
          </div>
        </div>
      )}
    </div>
  ), document.body)
}
