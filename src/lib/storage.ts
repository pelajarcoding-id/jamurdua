import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'

type UploadInput = {
  bytes: Buffer
  originalName: string
  contentType: string
}

type UploadResult = {
  url: string
  key: string
}

function sanitizeFileName(name: string) {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, '')
  return cleaned || 'file'
}

function makeKey(originalName: string) {
  const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
  const safeName = sanitizeFileName(originalName)
  return `uploads/${uniqueSuffix}-${safeName}`
}

export async function uploadFile(input: UploadInput): Promise<UploadResult> {
  const driver = (process.env.STORAGE_DRIVER || 'local').toLowerCase()
  const key = makeKey(input.originalName)

  if (driver === 's3') {
    const bucket = process.env.S3_BUCKET || ''
    const region = process.env.S3_REGION || 'auto'
    const endpoint = process.env.S3_ENDPOINT || ''
    const accessKeyId = process.env.S3_ACCESS_KEY_ID || ''
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || ''
    const publicBase = process.env.S3_PUBLIC_URL_BASE || ''

    if (!bucket || !endpoint || !accessKeyId || !secretAccessKey || !publicBase) {
      throw new Error('Konfigurasi S3 belum lengkap')
    }

    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3')

    const client = new S3Client({
      region,
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    })

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: input.bytes,
        ContentType: input.contentType,
      })
    )

    return { key, url: `${publicBase.replace(/\/$/, '')}/${key}` }
  }

  const uploadDir = join(process.cwd(), 'public', 'uploads')
  await mkdir(uploadDir, { recursive: true })
  const filename = key.split('/').pop() as string
  const filepath = join(uploadDir, filename)
  await writeFile(filepath, input.bytes)
  return { key, url: `/uploads/${filename}` }
}

