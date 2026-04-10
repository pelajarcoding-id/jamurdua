import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userIdsParam = (searchParams.get('userIds') || '').trim()
    if (!userIdsParam) return NextResponse.json({ data: {} })

    const userIds = userIdsParam
      .split(',')
      .map((v) => Number(String(v).trim()))
      .filter((n) => Number.isFinite(n) && n > 0)

    if (userIds.length === 0) return NextResponse.json({ data: {} })

    const [hutangAgg, bayarAgg] = await Promise.all([
      prisma.kasTransaksi.groupBy({
        by: ['karyawanId'],
        where: {
          karyawanId: { in: userIds },
          tipe: 'PENGELUARAN',
          kategori: 'HUTANG_KARYAWAN',
          deletedAt: null,
        },
        _sum: { jumlah: true },
      }),
      prisma.kasTransaksi.groupBy({
        by: ['karyawanId'],
        where: {
          karyawanId: { in: userIds },
          tipe: 'PEMASUKAN',
          kategori: 'PEMBAYARAN_HUTANG',
          deletedAt: null,
        },
        _sum: { jumlah: true },
      }),
    ])

    const hutangMap = new Map(hutangAgg.map((r) => [r.karyawanId, Number(r._sum.jumlah || 0)]))
    const bayarMap = new Map(bayarAgg.map((r) => [r.karyawanId, Number(r._sum.jumlah || 0)]))

    const result: Record<number, number> = {}
    userIds.forEach((id) => {
      const totalHutang = hutangMap.get(id) || 0
      const totalBayar = bayarMap.get(id) || 0
      result[id] = Math.max(0, Math.round(totalHutang - totalBayar))
    })

    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('GET /api/karyawan-kebun/hutang-saldo error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

