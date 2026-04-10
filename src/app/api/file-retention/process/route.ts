import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/route-auth'
import { unlink } from 'fs/promises'
import { join } from 'path'

export const dynamic = 'force-dynamic'

async function isUrlReferenced(url: string) {
  const u = url.trim()
  if (!u) return false

  const [
    kas,
    nota,
    user,
    timbangan,
    kendaraan,
    riwayatDokumen,
    serviceLog,
    inventoryItem,
    inventoryTransaction,
    uangJalan,
  ] = await Promise.all([
    prisma.kasTransaksi.findFirst({ where: { gambarUrl: u, deletedAt: null }, select: { id: true } }),
    prisma.notaSawit.findFirst({ where: { gambarNotaUrl: u, deletedAt: null }, select: { id: true } }),
    prisma.user.findFirst({ where: { photoUrl: u }, select: { id: true } }),
    prisma.timbangan.findFirst({ where: { photoUrl: u }, select: { id: true } }),
    prisma.kendaraan.findFirst({
      where: {
        OR: [{ imageUrl: u }, { fotoPajakUrl: u }, { fotoSpeksiUrl: u }, { fotoStnkUrl: u }],
      },
      select: { platNomor: true },
    }),
    prisma.riwayatDokumen.findFirst({ where: { fotoUrl: u }, select: { id: true } }),
    prisma.serviceLog.findFirst({ where: { fotoUrl: u }, select: { id: true } }),
    prisma.inventoryItem.findFirst({ where: { imageUrl: u, deletedAt: null }, select: { id: true } }),
    prisma.inventoryTransaction.findFirst({ where: { imageUrl: u }, select: { id: true } }),
    prisma.uangJalan.findFirst({ where: { gambarUrl: u }, select: { id: true } }),
  ])

  return !!(
    kas ||
    nota ||
    user ||
    timbangan ||
    kendaraan ||
    riwayatDokumen ||
    serviceLog ||
    inventoryItem ||
    inventoryTransaction ||
    uangJalan
  )
}

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

export async function POST(request: Request) {
  const guard = await requireRole(['ADMIN'])
  if (guard.response) return guard.response

  const body = await request.json().catch(() => ({}))
  const limit = typeof body?.limit === 'number' ? Math.min(Math.max(body.limit, 1), 200) : 50
  const force = !!body?.force

  const where: any = {}
  if (!force) {
    where.deleteAt = { lte: new Date() }
  }

  const due = await (prisma as any).pendingFileDeletion.findMany({
    where,
    orderBy: [{ deleteAt: 'asc' }, { id: 'asc' }],
    take: limit,
  })

  let deletedCount = 0
  let skippedReferenced = 0

  for (const item of due) {
    const referenced = await isUrlReferenced(item.url)
    if (referenced) {
      skippedReferenced += 1
      await (prisma as any).pendingFileDeletion.update({
        where: { id: item.id },
        data: { deleteAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      })
      continue
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
      if (!deleted) deleted = true
    }

    await (prisma as any).pendingFileDeletion.delete({ where: { id: item.id } })
    if (deleted) deletedCount += 1
  }

  return NextResponse.json({ ok: true, processed: due.length, deletedCount, skippedReferenced })
}
