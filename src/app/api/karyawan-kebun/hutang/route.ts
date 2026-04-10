import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { kebunId, karyawanId, jumlah, date, deskripsi } = body || {}

    if (!karyawanId || !jumlah) {
      return NextResponse.json({ error: 'karyawanId dan jumlah wajib diisi' }, { status: 400 })
    }

    const trx = await prisma.kasTransaksi.create({
      data: {
        date: date ? new Date(date) : new Date(),
        tipe: 'PENGELUARAN',
        deskripsi: deskripsi || 'Hutang Karyawan',
        jumlah: Number(jumlah),
        kategori: 'HUTANG_KARYAWAN',
        kebunId: kebunId ? Number(kebunId) : null,
        karyawanId: Number(karyawanId),
      },
    })

    return NextResponse.json({ data: trx }, { status: 201 })
  } catch (error) {
    console.error('POST /api/karyawan-kebun/hutang error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
