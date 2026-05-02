type FaceApiGlobal = any

let faceApiPromise: Promise<FaceApiGlobal> | null = null
let modelsPromise: Promise<void> | null = null

function getFaceApiFromWindow() {
  if (typeof window === 'undefined') return null
  const w = window as any
  return (w.faceapi || w.faceApi || w.FaceAPI || w.FaceApi) as FaceApiGlobal | undefined
}

function getCandidateCdnUrls() {
  const raw = String(process.env.NEXT_PUBLIC_FACEAPI_CDN || '').trim()
  const fromEnv = raw
    ? raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : []
  const defaults = [
    'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.js',
    'https://unpkg.com/@vladmandic/face-api/dist/face-api.js',
  ]
  const all = [...fromEnv, ...defaults]
  return Array.from(new Set(all))
}

function loadScriptTag(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (typeof document === 'undefined') reject(new Error('Browser required'))

    const existing = Array.from(document.querySelectorAll('script')).find((s) => (s as HTMLScriptElement).src === src) as
      | HTMLScriptElement
      | undefined
    if (existing) {
      if (getFaceApiFromWindow()) resolve()
      else {
        existing.addEventListener('load', () => resolve(), { once: true })
        existing.addEventListener('error', () => reject(new Error('failed to load faceapi')), { once: true })
      }
      return
    }

    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.crossOrigin = 'anonymous'
    script.onload = () => resolve()
    script.onerror = () => {
      try {
        script.remove()
      } catch {}
      reject(new Error('failed to load faceapi'))
    }
    document.head.appendChild(script)
  })
}

async function loadFaceApiScript(): Promise<FaceApiGlobal> {
  const existing = getFaceApiFromWindow()
  if (existing) return existing
  if (typeof document === 'undefined') throw new Error('Browser required')

  if (!faceApiPromise) {
    faceApiPromise = (async () => {
      const urls = getCandidateCdnUrls()
      let lastErr: any = null
      for (const url of urls) {
        try {
          await loadScriptTag(url)
          const api = getFaceApiFromWindow()
          if (api) return api
          lastErr = new Error(`faceapi not available after load: ${url}`)
        } catch (e: any) {
          lastErr = e
        }
      }
      const hint = urls.length ? `cdn tried: ${urls.join(', ')}` : 'no cdn url'
      throw new Error(`${lastErr?.message || 'failed to load faceapi'} (${hint})`)
    })().catch((e) => {
      faceApiPromise = null
      throw e
    })
  }
  return faceApiPromise
}

async function ensureModelsLoaded(): Promise<void> {
  if (modelsPromise) return modelsPromise
  modelsPromise = (async () => {
    const faceapi = await loadFaceApiScript()
    const baseUrl = process.env.NEXT_PUBLIC_FACE_MODELS_URL || 'https://justadudewhohacks.github.io/face-api.js/models'
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(baseUrl),
      faceapi.nets.faceLandmark68Net.loadFromUri(baseUrl),
      faceapi.nets.faceRecognitionNet.loadFromUri(baseUrl),
    ])
  })()
  return modelsPromise
}

export async function ensureFaceApiReady(): Promise<FaceApiGlobal> {
  const faceapi = await loadFaceApiScript()
  await ensureModelsLoaded()
  return faceapi
}

async function fileToImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('failed to load image'))
      img.src = url
    })
  } finally {
    try {
      URL.revokeObjectURL(url)
    } catch {}
  }
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

function ear(eye: Array<{ x: number; y: number }>) {
  if (eye.length < 6) return null
  const p1 = eye[0]
  const p2 = eye[1]
  const p3 = eye[2]
  const p4 = eye[3]
  const p5 = eye[4]
  const p6 = eye[5]
  const a = dist(p2, p6)
  const b = dist(p3, p5)
  const c = dist(p1, p4)
  if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(c) || c <= 0) return null
  return (a + b) / (2 * c)
}

export async function getFaceDescriptorFromFile(file: File): Promise<number[] | null> {
  const faceapi = await loadFaceApiScript()
  await ensureModelsLoaded()

  const img = await fileToImage(file)
  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 })
  const result = await faceapi.detectSingleFace(img, options).withFaceLandmarks().withFaceDescriptor()
  if (!result?.descriptor) return null
  const desc = result.descriptor as Float32Array | number[]
  const arr = Array.isArray(desc) ? desc : Array.from(desc)
  const nums = arr.map((x) => Number(x)).filter((x) => Number.isFinite(x))
  if (nums.length < 64) return null
  return nums
}

export async function getFaceCountFromFile(file: File): Promise<number | null> {
  const faceapi = await loadFaceApiScript()
  await ensureModelsLoaded()

  const img = await fileToImage(file)
  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 })
  const results = await faceapi.detectAllFaces(img, options)
  if (!Array.isArray(results)) return null
  return results.length
}

export type FaceLandmarkMetrics = {
  detectionScore: number
  noseX: number
  noseY: number
  mouthOpen: number
  leftEar: number | null
  rightEar: number | null
}

export async function getFaceLandmarkMetricsFromFile(file: File): Promise<FaceLandmarkMetrics | null> {
  const faceapi = await loadFaceApiScript()
  await ensureModelsLoaded()

  const img = await fileToImage(file)
  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 })
  const result = await faceapi.detectSingleFace(img, options).withFaceLandmarks()
  if (!result?.landmarks || !result?.detection?.box) return null

  const box = result.detection.box
  const w = Number(box.width)
  const h = Number(box.height)
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null

  const pos = Array.isArray(result.landmarks.positions) ? result.landmarks.positions : []
  if (pos.length < 68) return null

  const nose = pos[30]
  const mouthTop = pos[62]
  const mouthBot = pos[66]
  if (!nose || !mouthTop || !mouthBot) return null

  const noseX = (Number(nose.x) - Number(box.x)) / w
  const noseY = (Number(nose.y) - Number(box.y)) / h
  const mouthOpen = dist({ x: Number(mouthTop.x), y: Number(mouthTop.y) }, { x: Number(mouthBot.x), y: Number(mouthBot.y) }) / h

  const leftEye = pos.slice(36, 42).map((p: any) => ({ x: Number(p.x), y: Number(p.y) }))
  const rightEye = pos.slice(42, 48).map((p: any) => ({ x: Number(p.x), y: Number(p.y) }))
  const leftEar = ear(leftEye)
  const rightEar = ear(rightEye)

  const detectionScore = Number(result?.detection?.score || 0)
  const values = [noseX, noseY, mouthOpen, detectionScore]
  if (values.some((x) => !Number.isFinite(x))) return null

  return { detectionScore, noseX, noseY, mouthOpen, leftEar, rightEar }
}

export type FaceVideoResult = {
  box: { x: number; y: number; width: number; height: number }
  score: number
  descriptor: number[]
  metrics: FaceLandmarkMetrics
}

export async function detectSingleFaceFromVideo(video: HTMLVideoElement): Promise<FaceVideoResult | null> {
  const faceapi = await ensureFaceApiReady()
  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 })
  const result = await faceapi.detectSingleFace(video as any, options).withFaceLandmarks().withFaceDescriptor()
  if (!result?.descriptor || !result?.landmarks || !result?.detection?.box) return null

  const box = result.detection.box
  const x = Number(box.x)
  const y = Number(box.y)
  const width = Number(box.width)
  const height = Number(box.height)
  if (![x, y, width, height].every((v) => Number.isFinite(v)) || width <= 0 || height <= 0) return null

  const desc = result.descriptor as Float32Array | number[]
  const arr = Array.isArray(desc) ? desc : Array.from(desc)
  const descriptor = arr.map((v) => Number(v)).filter((v) => Number.isFinite(v))
  if (descriptor.length < 64) return null

  const pos = Array.isArray(result.landmarks.positions) ? result.landmarks.positions : []
  if (pos.length < 68) return null
  const nose = pos[30]
  const mouthTop = pos[62]
  const mouthBot = pos[66]
  if (!nose || !mouthTop || !mouthBot) return null

  const noseX = (Number(nose.x) - x) / width
  const noseY = (Number(nose.y) - y) / height
  const mouthOpen = dist({ x: Number(mouthTop.x), y: Number(mouthTop.y) }, { x: Number(mouthBot.x), y: Number(mouthBot.y) }) / height

  const leftEye = pos.slice(36, 42).map((p: any) => ({ x: Number(p.x), y: Number(p.y) }))
  const rightEye = pos.slice(42, 48).map((p: any) => ({ x: Number(p.x), y: Number(p.y) }))
  const leftEar = ear(leftEye)
  const rightEar = ear(rightEye)

  const score = Number(result?.detection?.score || 0)
  const values = [noseX, noseY, mouthOpen, score]
  if (values.some((v) => !Number.isFinite(v))) return null

  return {
    box: { x, y, width, height },
    score,
    descriptor,
    metrics: { detectionScore: score, noseX, noseY, mouthOpen, leftEar, rightEar },
  }
}

export async function countFacesFromVideo(video: HTMLVideoElement): Promise<number | null> {
  const faceapi = await ensureFaceApiReady()
  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 })
  const results = await faceapi.detectAllFaces(video as any, options)
  if (!Array.isArray(results)) return null
  return results.length
}
