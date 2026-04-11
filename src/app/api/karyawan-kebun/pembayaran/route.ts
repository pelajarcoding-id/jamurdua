import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { kebunId, karyawanId, jumlah, date, deskripsi, createdAt } = body || {}

    if (!karyawanId || !jumlah) {
      return NextResponse.json({ error: 'karyawanId dan jumlah wajib diisi' }, { status: 400 })
    }

    const createdAtDate = (() => {
      if (!createdAt) return null
      const d = new Date(String(createdAt))
      if (Number.isNaN(d.getTime())) return null
      return d
    })()
    const kebunIdNum = kebunId !== undefined && kebunId !== null ? Number(kebunId) : null
    const kasKebunId = kebunIdNum && Number.isFinite(kebunIdNum) && kebunIdNum > 0 ? kebunIdNum : null

    const trx = await prisma.kasTransaksi.create({
      data: {
        date: date ? new Date(date) : new Date(),
        tipe: 'PEMASUKAN',
        deskripsi: deskripsi || 'Pembayaran Hutang Karyawan',
        jumlah: Number(jumlah),
        kategori: 'PEMBAYARAN_HUTANG',
        kebunId: kasKebunId,
        karyawanId: Number(karyawanId),
        ...(createdAtDate ? { createdAt: createdAtDate } : {}),
      },
    })

    return NextResponse.json({ data: trx }, { status: 201 })
  } catch (error) {
    console.error('POST /api/karyawan-kebun/pembayaran error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
