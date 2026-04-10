import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/route-auth'
import { unlink } from 'fs/promises'
import { join } from 'path'

export const dynamic = 'force-dynamic'

async function deleteLocalByUrl(url: string) {
  const u = url.trim()
  if (!u.startsWith('/')) return false
  const p = join(process.cwd(), 'public', u.replace(/^\//, ''))
  try {
    await unlink(p)
    return true
  } catch {
    return false
  }
}

async function deleteS3ByKey(key: string) {
  const bucket = process.env.S3_BUCKET || ''
  const region = process.env.S3_REGION || 'auto'
  const endpoint = process.env.S3_ENDPOINT || ''
  const accessKeyId = process.env.S3_ACCESS_KEY_ID || ''
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || ''

  if (!bucket || !endpoint || !accessKeyId || !secretAccessKey) return false

  const s3 = (await import('@aws-sdk/client-s3')) as any
  const client = new s3.S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  })

  try {
    await client.send(new s3.DeleteObjectCommand({ Bucket: bucket, Key: key }))
    return true
  } catch {
    return false
  }
}

export async function DELETE(request: Request) {
  const guard = await requireRole(['ADMIN'])
  if (guard.response) return guard.response

  const { searchParams } = new URL(request.url)
  const id = Number(searchParams.get('id'))

  if (!id) {
    return NextResponse.json({ error: 'ID wajib diisi' }, { status: 400 })
  }

  try {
    const item = await (prisma as any).pendingFileDeletion.findUnique({ where: { id } })
    if (!item) {
      return NextResponse.json({ error: 'Data tidak ditemukan' }, { status: 404 })
    }

    let deleted = false
    if ((item.driver || '').toLowerCase() === 's3') {
      if (item.key) {
        deleted = await deleteS3ByKey(item.key)
      } else {
        deleted = true
      }
    } else {
      deleted = await deleteLocalByUrl(item.url)
      if (!deleted) deleted = true // Anggap terhapus jika file fisik tidak ada
    }

    await (prisma as any).pendingFileDeletion.delete({ where: { id } })

    return NextResponse.json({ ok: true, message: 'File berhasil dihapus' })
  } catch (error: any) {
    console.error('DELETE /api/file-retention/delete error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
