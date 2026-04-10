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
  findUnique: (args: unknown) => Promise<KaryawanDeleteRequestModel | null>
  update: (args: unknown) => Promise<KaryawanDeleteRequestModel>
}

const karyawanDeleteRequest = (prisma as unknown as { karyawanDeleteRequest: KaryawanDeleteRequestDelegate })
  .karyawanDeleteRequest

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = session.user?.role?.toString().toUpperCase() || ''
  if (!['ADMIN', 'PEMILIK'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const id = Number(params.id)
  if (!id) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
  const body = await request.json().catch(() => ({}))
  const action = (body?.action || '').toString().toUpperCase()
  const reason = body?.reason ? String(body.reason) : null

  const requestItem = await karyawanDeleteRequest.findUnique({
    where: { id },
    include: {
      karyawan: { select: { id: true, name: true } },
      requester: { select: { id: true, name: true } },
    },
  })
  if (!requestItem) return NextResponse.json({ error: 'Permintaan tidak ditemukan' }, { status: 404 })
  if (requestItem.status !== 'PENDING') {
    return NextResponse.json({ error: 'Permintaan sudah diproses' }, { status: 409 })
  }

  if (action === 'REJECT') {
    await karyawanDeleteRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewedById: Number(session.user?.id),
        reviewedAt: new Date(),
        reason: reason || requestItem.reason,
      },
    })
    await prisma.notification.create({
      data: {
        userId: requestItem.requesterId,
        type: 'KARYAWAN_DELETE_REQUEST_RESULT',
        title: 'Permintaan Hapus Karyawan Ditolak',
        message: `Permintaan hapus karyawan ${requestItem.karyawan?.name || '-'} ditolak.`,
        link: '/karyawan',
        isRead: false,
      },
    })
    return NextResponse.json({ ok: true })
  }

  if (action !== 'APPROVE') {
    return NextResponse.json({ error: 'Aksi tidak valid' }, { status: 400 })
  }

  const karyawanId = requestItem.karyawanId
  
  // Check for any linked data that should block deletion
  const [
    linkedPekerjaan,
    linkedKas,
    linkedDetailGaji,
    linkedNota,
    linkedTimbangan,
    linkedInv,
    linkedKebunInv,
    linkedPermintaan,
    linkedSesi
  ] = await Promise.all([
    prisma.pekerjaanKebun.findFirst({ where: { userId: karyawanId } }),
    prisma.kasTransaksi.findFirst({ 
      where: { 
        OR: [
          { karyawanId: karyawanId },
          { userId: karyawanId }
        ]
      } 
    }),
    prisma.detailGajianKaryawan.findFirst({ where: { userId: karyawanId } }),
    prisma.notaSawit.findFirst({ where: { supirId: karyawanId } }),
    prisma.timbangan.findFirst({ where: { supirId: karyawanId } }),
    prisma.inventoryTransaction.findFirst({ where: { userId: karyawanId } }),
    prisma.kebunInventoryTransaction.findFirst({ where: { userId: karyawanId } }),
    prisma.permintaanKebun.findFirst({ where: { userId: karyawanId } }),
    prisma.sesiUangJalan.findFirst({ where: { supirId: karyawanId } }),
  ])

  if (linkedPekerjaan || linkedKas || linkedDetailGaji || linkedNota || linkedTimbangan || linkedInv || linkedKebunInv || linkedPermintaan || linkedSesi) {
    let errorMsg = 'Tidak bisa hapus: karyawan memiliki referensi data '
    const details = []
    if (linkedPekerjaan) details.push('pekerjaan kebun')
    if (linkedKas) details.push('kas transaksi')
    if (linkedDetailGaji) details.push('riwayat gajian')
    if (linkedNota) details.push('nota sawit')
    if (linkedTimbangan) details.push('timbangan')
    if (linkedInv || linkedKebunInv) details.push('inventaris')
    if (linkedPermintaan) details.push('permintaan')
    if (linkedSesi) details.push('sesi uang jalan')
    
    return NextResponse.json(
      { error: errorMsg + details.join(', ') },
      { status: 409 }
    )
  }

  await prisma.$transaction(async (tx) => {
    // 1. Delete KaryawanAssignment first to avoid foreign key constraint error
    await tx.karyawanAssignment.deleteMany({
      where: { userId: karyawanId }
    })

    // 2. Update the delete request status
    const txClient = tx as unknown as { karyawanDeleteRequest: KaryawanDeleteRequestDelegate }
    await txClient.karyawanDeleteRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        reviewedById: Number(session.user?.id),
        reviewedAt: new Date(),
        reason: reason || requestItem.reason,
      },
    })

    // 3. Delete the user
    await tx.user.delete({ where: { id: karyawanId } })
  })
  await prisma.notification.create({
    data: {
      userId: requestItem.requesterId,
      type: 'KARYAWAN_DELETE_REQUEST_RESULT',
      title: 'Permintaan Hapus Karyawan Disetujui',
      message: `Permintaan hapus karyawan ${requestItem.karyawan?.name || '-'} disetujui.`,
      link: '/karyawan',
      isRead: false,
    },
  })

  return NextResponse.json({ ok: true })
}
