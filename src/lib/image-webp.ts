export async function convertImageFileToWebp(
  file: File,
  options?: { quality?: number; maxDimension?: number }
): Promise<File> {
  const quality = typeof options?.quality === 'number' ? options!.quality : 0.9
  const maxDimension = typeof options?.maxDimension === 'number' ? options!.maxDimension : 1920

  if (!file) return file
  if (file.type === 'image/webp') return file
  if (typeof window === 'undefined') return file

  const objectUrl = URL.createObjectURL(file)
  try {
    let bitmap: ImageBitmap | null = null
    try {
      bitmap = await createImageBitmap(file as any, { imageOrientation: 'from-image' } as any)
    } catch {
      bitmap = await createImageBitmap(file as any)
    }

    const srcW = bitmap.width
    const srcH = bitmap.height
    const scale = Math.min(1, maxDimension / Math.max(srcW, srcH))
    const dstW = Math.max(1, Math.round(srcW * scale))
    const dstH = Math.max(1, Math.round(srcH * scale))

    const canvas = document.createElement('canvas')
    canvas.width = dstW
    canvas.height = dstH
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, 0, 0, dstW, dstH)

    const blob: Blob | null = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/webp', quality)
    })

    if (!blob) return file

    const base = file.name.replace(/\.[^/.]+$/, '')
    const outName = `${base || 'image'}.webp`
    return new File([blob], outName, { type: 'image/webp' })
  } catch {
    return file
  } finally {
    try {
      URL.revokeObjectURL(objectUrl)
    } catch {}
  }
}

