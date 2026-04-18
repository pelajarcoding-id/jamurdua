export async function convertImageFileToWebp(
  file: File,
  options?: { quality?: number; maxDimension?: number }
): Promise<File> {
  const quality = typeof options?.quality === 'number' ? options!.quality : 0.82
  const maxDimension = typeof options?.maxDimension === 'number' ? options!.maxDimension : 1280

  if (!file) return file
  if (typeof window === 'undefined') return file

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
    canvas.width = dstW
    canvas.height = dstH
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'medium' // 'medium' often uses less memory than 'high'
    ctx.drawImage(imgSource as any, 0, 0, dstW, dstH)

    const blobWebp: Blob | null = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/webp', quality)
    })

    if (blobWebp) {
      const base = file.name.replace(/\.[^/.]+$/, '')
      const outName = `${base || 'image'}.webp`
      return new File([blobWebp], outName, { type: 'image/webp' })
    }

    const blobJpeg: Blob | null = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', quality)
    })
    if (!blobJpeg) return file

    const base = file.name.replace(/\.[^/.]+$/, '')
    const outName = `${base || 'image'}.jpg`
    return new File([blobJpeg], outName, { type: 'image/jpeg' })
  } catch (err) {
    console.error('WebP conversion error:', err)
    return file
  } finally {
    try {
      URL.revokeObjectURL(objectUrl)
    } catch {}
  }
}
