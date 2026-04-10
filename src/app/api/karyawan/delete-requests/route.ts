import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
type KaryawanDeleteRequestModel = {
  id: number
  status: string
  requesterId: number
  karyawanId: number
  reason: string | null
  karyawan?: { id: number; name: string }
  requester?: { id: number; name: string }
}

type KaryawanDeleteRequestDelegate = {
  findMany: (args: unknown) => Promise<KaryawanDeleteRequestModel[]>
  findFirst: (args: unknown) => Promise<KaryawanDeleteRequestModel | null>
  create: (args: unknown) => Promise<KaryawanDeleteRequestModel>
}

const karyawanDeleteRequest = (prisma as unknown as { karyawanDeleteRequest: KaryawanDeleteRequestDelegate })
  .karyawanDeleteRequest

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = session.user?.role?.toString().toUpperCase() || ''
  if (!['ADMIN', 'PEMILIK'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const data = await karyawanDeleteRequest.findMany({
    where: { status: 'PENDING' },
    include: {
      karyawan: { select: { id: true, name: true } },
      requester: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ data })
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = session.user?.role?.toString().toUpperCase() || ''
  if (!['MANAGER', 'ADMIN', 'PEMILIK'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const karyawanId = Number(body?.karyawanId)
  const reason = body?.reason ? String(body.reason) : null
  if (!karyawanId) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })

  const existing = await karyawanDeleteRequest.findFirst({
    where: { karyawanId, status: 'PENDING' },
    select: { id: true },
  })
  if (existing) {
    return NextResponse.json({ error: 'Permintaan penghapusan sudah diajukan' }, { status: 409 })
  }

  const requesterId = Number(session.user?.id)
  await karyawanDeleteRequest.create({
    data: {
      karyawanId,
      requesterId,
      status: 'PENDING',
      reason,
    },
  })

  const recipients = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'PEMILIK'] } },
    select: { id: true },
  })

  if (recipients.length > 0) {
    const requesterName = session.user?.name || 'Manager'
    const karyawan = await prisma.user.findUnique({
      where: { id: karyawanId },
      select: { name: true },
    })
    const message = `Permohonan hapus karyawan ${karyawan?.name || 'tersebut'} oleh ${requesterName}`
    await prisma.notification.createMany({
      data: recipients.map((r) => ({
        userId: r.id,
        type: 'KARYAWAN_DELETE_REQUEST',
        title: 'Persetujuan Hapus Karyawan',
        message,
        link: '/karyawan',
        isRead: false,
      })),
    })
  }

  return NextResponse.json({ ok: true })
}
