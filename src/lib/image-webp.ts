export async function convertImageFileToWebp(
  file: File,
  options?: { quality?: number; maxDimension?: number; targetMaxBytes?: number }
): Promise<File> {
  const quality = typeof options?.quality === 'number' ? options!.quality : 0.82
  const maxDimension = typeof options?.maxDimension === 'number' ? options!.maxDimension : 1280
  const targetMaxBytes = typeof options?.targetMaxBytes === 'number' ? options!.targetMaxBytes : 0

  if (!file) return file
  if (typeof window === 'undefined') return file
  if (targetMaxBytes > 0 && Number(file.size || 0) > 0 && Number(file.size || 0) <= targetMaxBytes) {
    if (file.type === 'image/webp' || file.type === 'image/jpeg') return file
  }

  const objectUrl = URL.createObjectURL(file)
  try {
    let imgSource: ImageBitmap | HTMLImageElement | null = null
    
    // Try to load as Image object first for better stability on iOS/Safari
    // before potentially using the more memory-heavy createImageBitmap
    const loadImage = (): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = (e) => reject(e)
      img.src = objectUrl
    })

    try {
      imgSource = await loadImage()
    } catch {
      try {
        imgSource = await createImageBitmap(file as any, { imageOrientation: 'from-image' } as any)
      } catch {
        imgSource = await createImageBitmap(file as any)
      }
    }

    if (!imgSource) return file

    const srcW = 'naturalWidth' in imgSource ? imgSource.naturalWidth : imgSource.width
    const srcH = 'naturalHeight' in imgSource ? imgSource.naturalHeight : imgSource.height
    
    const scale = Math.min(1, maxDimension / Math.max(srcW, srcH))
    const dstW = Math.max(1, Math.round(srcW * scale))
    const dstH = Math.max(1, Math.round(srcH * scale))

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return file

    const drawAndEncode = async (mimeType: 'image/webp' | 'image/jpeg') => {
      let currentW = dstW
      let currentH = dstH
      let currentQ = quality
      let lastBlob: Blob | null = null

      for (let i = 0; i < 8; i++) {
        canvas.width = currentW
        canvas.height = currentH
        ctx.clearRect(0, 0, currentW, currentH)
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'medium'
        ctx.drawImage(imgSource as any, 0, 0, currentW, currentH)

        const blob: Blob | null = await new Promise((resolve) => {
          canvas.toBlob((b) => resolve(b), mimeType, currentQ)
        })
        if (!blob) continue
        lastBlob = blob

        if (!targetMaxBytes || blob.size <= targetMaxBytes) {
          return blob
        }

        if (currentQ > 0.56) {
          currentQ = Math.max(0.56, currentQ - 0.08)
        } else {
          const nextW = Math.max(640, Math.round(currentW * 0.85))
          const nextH = Math.max(640, Math.round(currentH * 0.85))
          if (nextW === currentW || nextH === currentH) break
          currentW = nextW
          currentH = nextH
        }
      }

      return lastBlob
    }

    const blobWebp = await drawAndEncode('image/webp')
    if (blobWebp) {
      const base = file.name.replace(/\.[^/.]+$/, '')
      const outName = `${base || 'image'}.webp`
      return new File([blobWebp], outName, { type: 'image/webp' })
    }

    const blobJpeg = await drawAndEncode('image/jpeg')
    if (blobJpeg) {
      const base = file.name.replace(/\.[^/.]+$/, '')
      const outName = `${base || 'image'}.jpg`
      return new File([blobJpeg], outName, { type: 'image/jpeg' })
    }
    return file
  } catch (err) {
    console.error('WebP conversion error:', err)
    return file
  } finally {
    try {
      URL.revokeObjectURL(objectUrl)
    } catch {}
  }
}
