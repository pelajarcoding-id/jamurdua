import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { Prisma } from '@prisma/client'
import bcrypt from 'bcrypt'
import { createAuditLog } from '@/lib/audit'

type UserUpdateWithMeta = Prisma.UserUncheckedUpdateInput & {
  jobType?: string | null
  status?: string | null
  kendaraanPlatNomor?: string | null
}

type KaryawanDeleteRequestModel = {
  id: number
  status: string
  requesterId: number
  karyawanId: number
  reason: string | null
}

type KaryawanDeleteRequestDelegate = {
  findFirst: (args: unknown) => Promise<KaryawanDeleteRequestModel | null>
  create: (args: unknown) => Promise<KaryawanDeleteRequestModel>
}

const karyawanDeleteRequest = (prisma as unknown as { karyawanDeleteRequest: KaryawanDeleteRequestDelegate })
  .karyawanDeleteRequest

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await auth()
    const currentUserId = session?.user?.id ? Number(session.user.id) : 1
    const role = session?.user?.role?.toString().toUpperCase() || ''
    if (!['ADMIN', 'PEMILIK', 'MANAGER', 'MANDOR'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const id = Number(params.id)
    if (Number.isNaN(id)) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
    const body = await request.json()
    const { name, email, password, kebunId, jobType, jenisPekerjaan, status, kendaraanPlatNomor, photoUrl, role: targetRole } = body || {}

    const before = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, role: true, kebunId: true, jobType: true, status: true, kendaraanPlatNomor: true },
    })

    const data: UserUpdateWithMeta = {}
    if (name) data.name = name
    if (email) {
      const exists = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      })
      if (exists && exists.id !== id) {
        return NextResponse.json({ error: 'Email sudah digunakan' }, { status: 409 })
      }
      data.email = email
    }
    if (password) {
      data.passwordHash = await bcrypt.hash(String(password), 10)
    }
    if (typeof kebunId !== 'undefined') {
      data.kebunId = kebunId ? Number(kebunId) : null
    }
    if (typeof jobType !== 'undefined' || typeof jenisPekerjaan !== 'undefined') {
      const jt = (jobType || jenisPekerjaan || '').toString().trim().toUpperCase()
      data.jobType = jt || null
    }
    if (typeof status !== 'undefined') {
      data.status = String(status).trim().toUpperCase()
    }
    if (typeof kendaraanPlatNomor !== 'undefined') {
      data.kendaraanPlatNomor = kendaraanPlatNomor ? String(kendaraanPlatNomor) : null
    }
    if (typeof photoUrl !== 'undefined') {
      ;(data as any).photoUrl = photoUrl ? String(photoUrl) : null
    }
    if (typeof targetRole !== 'undefined') {
      const allowedRoles = ['KARYAWAN', 'SUPIR', 'MANDOR', 'MANAGER']
      const nextRole = String(targetRole || '').toUpperCase().trim()
      if (allowedRoles.includes(nextRole)) {
        ;(data as any).role = nextRole
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, photoUrl: true, createdAt: true },
    })

    await createAuditLog(currentUserId, 'UPDATE', 'User', user.id.toString(), {
      before,
      after: user,
      updatedFields: Object.keys(data),
    })
    return NextResponse.json({ data: user })
  } catch (error) {
    console.error('PUT /api/karyawan/[id] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = session.user?.role?.toString().toUpperCase() || ''
    const currentUserId = session.user?.id ? Number(session.user.id) : 1
    const id = Number(params.id)
    if (Number.isNaN(id)) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })

    if (role === 'MANAGER') {
      const existing = await karyawanDeleteRequest.findFirst({
        where: { karyawanId: id, status: 'PENDING' },
        select: { id: true },
      })
      if (existing) {
        return NextResponse.json({ error: 'Permintaan penghapusan sudah diajukan' }, { status: 409 })
      }

      const requesterId = Number(session.user?.id)
      await karyawanDeleteRequest.create({
        data: {
          karyawanId: id,
          requesterId,
          status: 'PENDING',
        },
      })

      await createAuditLog(currentUserId, 'CREATE', 'KaryawanDeleteRequest', id.toString(), {
        karyawanId: id,
        requesterId,
        status: 'PENDING',
      })

      const recipients = await prisma.user.findMany({
        where: { role: { in: ['ADMIN', 'PEMILIK'] } },
        select: { id: true },
      })

      if (recipients.length > 0) {
        const requesterName = session.user?.name || 'Manager'
        const karyawan = await prisma.user.findUnique({
          where: { id },
          select: { name: true },
        })
        const message = `${requesterName} meminta persetujuan hapus karyawan ${karyawan?.name || 'tersebut'}`
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

      return NextResponse.json({ message: 'Permintaan penghapusan telah diajukan' }, { status: 202 })
    }

    if (!['ADMIN', 'PEMILIK'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

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
      prisma.pekerjaanKebun.findFirst({ where: { userId: id } }),
      prisma.kasTransaksi.findFirst({ 
        where: { 
          OR: [
            { karyawanId: id },
            { userId: id }
          ]
        } 
      }),
      prisma.detailGajianKaryawan.findFirst({ where: { userId: id } }),
      prisma.notaSawit.findFirst({ where: { supirId: id } }),
      prisma.timbangan.findFirst({ where: { supirId: id } }),
      prisma.inventoryTransaction.findFirst({ where: { userId: id } }),
      prisma.kebunInventoryTransaction.findFirst({ where: { userId: id } }),
      prisma.permintaanKebun.findFirst({ where: { userId: id } }),
      prisma.sesiUangJalan.findFirst({ where: { supirId: id } }),
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

    const before = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, role: true, kebunId: true },
    })

    await prisma.$transaction(async (tx) => {
      // Delete KaryawanAssignment first to avoid foreign key constraint error
      await tx.karyawanAssignment.deleteMany({
        where: { userId: id }
      })
      await tx.user.delete({ where: { id } })
    })

    await createAuditLog(currentUserId, 'DELETE', 'User', id.toString(), { before })
    return NextResponse.json({ message: 'Karyawan dihapus' })
  } catch (error) {
    console.error('DELETE /api/karyawan/[id] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
