import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/route-auth'

export async function GET(request: Request) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'MANAGER', 'MANDOR'])
    if (guard.response) return guard.response

    const { searchParams } = new URL(request.url)
    const kebunIdParam = searchParams.get('kebunId')
    const karyawanIdParam = searchParams.get('karyawanId')

    if (!karyawanIdParam) {
      return NextResponse.json({ error: 'karyawanId wajib diisi' }, { status: 400 })
    }
    const kebunId = kebunIdParam ? Number(kebunIdParam) : null
    const karyawanId = Number(karyawanIdParam)
    if ((kebunIdParam && Number.isNaN(kebunId)) || Number.isNaN(karyawanId)) {
      return NextResponse.json({ error: 'Parameter tidak valid' }, { status: 400 })
    }

    const trx = await prisma.$queryRaw<
      Array<{ id: number; date: Date; jumlah: number; tipe: string; kategori: string | null; deskripsi: string }>
    >`
      SELECT "id","date","jumlah","tipe","kategori","deskripsi"
      FROM "KasTransaksi"
      WHERE (${kebunId}::INT IS NULL OR "kebunId" = ${kebunId})
        AND "karyawanId" = ${karyawanId}
        AND "kategori" IN ('HUTANG_KARYAWAN','PEMBAYARAN_HUTANG')
        AND "deletedAt" IS NULL
      ORDER BY "date" DESC
    `

    const result = trx.map(r => ({
      ...r,
      deskripsi: (r.deskripsi || '').replace(/\s*\|\s*Batch\s+[A-Za-z0-9\-_:.]+/, '').trim()
    }))

    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('GET /api/karyawan-kebun/detail error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK'])
    if (guard.response) return guard.response

    const body = await request.json()
    const { id, date, jumlah, deskripsi } = body || {}
    if (!id) {
      return NextResponse.json({ error: 'id wajib diisi' }, { status: 400 })
    }
    const trxId = Number(id)
    if (Number.isNaN(trxId)) {
      return NextResponse.json({ error: 'id tidak valid' }, { status: 400 })
    }

    const existing = await prisma.kasTransaksi.findUnique({ where: { id: trxId } })
    if (!existing) {
      return NextResponse.json({ error: 'Transaksi tidak ditemukan' }, { status: 404 })
    }

    const dataUpdate: any = {}
    if (date) dataUpdate.date = new Date(date)
    if (typeof jumlah !== 'undefined') dataUpdate.jumlah = Number(jumlah)
    if (typeof deskripsi !== 'undefined') dataUpdate.deskripsi = deskripsi

    if (Object.keys(dataUpdate).length === 0) {
      return NextResponse.json({ error: 'Tidak ada perubahan' }, { status: 400 })
    }

    const updated = await prisma.kasTransaksi.update({
      where: { id: trxId },
      data: dataUpdate,
      select: { id: true, date: true, jumlah: true, tipe: true, kategori: true, deskripsi: true },
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('PUT /api/karyawan-kebun/detail error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const idParam = searchParams.get('id')
    if (!idParam) return NextResponse.json({ error: 'id wajib diisi' }, { status: 400 })
    const trxId = Number(idParam)
    if (Number.isNaN(trxId)) return NextResponse.json({ error: 'id tidak valid' }, { status: 400 })

    const guard = await requireRole(['ADMIN', 'PEMILIK'])
    if (guard.response) return guard.response
    const role = guard.role
    const userId = guard.id

    const existing = await prisma.kasTransaksi.findUnique({ where: { id: trxId } })
    if (!existing) {
      return NextResponse.json({ error: 'Transaksi tidak ditemukan' }, { status: 404 })
    }

    await prisma.jurnal.deleteMany({
      where: { refType: 'KasTransaksi', refId: trxId },
    })
    await prisma.$executeRaw`
      UPDATE "KasTransaksi"
      SET "deletedAt" = NOW(), "deletedById" = ${userId}
      WHERE "id" = ${trxId}
    `
    return NextResponse.json({ message: 'Transaksi dihapus (soft delete)' })
  } catch (error) {
    console.error('DELETE /api/karyawan-kebun/detail error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
