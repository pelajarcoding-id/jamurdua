import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getWibMonthRangeUtc, getWibRangeUtcFromParams } from '@/lib/wib'

export const dynamic = 'force-dynamic'

function defaultMonthKey() {
  const wib = new Date(Date.now() + 7 * 60 * 60 * 1000)
  const y = wib.getUTCFullYear()
  const m = String(wib.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const range = getWibRangeUtcFromParams(searchParams)
    const monthRange = range ? null : getWibMonthRangeUtc(searchParams.get('month') || defaultMonthKey())
    if (!range && !monthRange) return NextResponse.json({ error: 'month tidak valid' }, { status: 400 })
    const kebunIdParam = searchParams.get('kebunId')
    const kendaraanPlatNomor = searchParams.get('kendaraanPlatNomor') || null
    const karyawanIdParam = searchParams.get('karyawanId')
    const untagged = searchParams.get('untagged') === 'true'
    const tagScope = searchParams.get('tagScope')
    const pageRaw = Number(searchParams.get('page') || 1)
    const pageSizeRaw = Number(searchParams.get('pageSize') || searchParams.get('limit') || 20)
    const page = Number.isFinite(pageRaw) ? Math.max(pageRaw, 1) : 1
    const pageSize = Number.isFinite(pageSizeRaw) ? Math.min(Math.max(pageSizeRaw, 1), 200) : 20

    const kebunId = kebunIdParam ? Number(kebunIdParam) : null
    const karyawanId = karyawanIdParam ? Number(karyawanIdParam) : null

    const whereClause: any = {
      deletedAt: null,
      tipe: 'PENGELUARAN',
      date: { gte: (range?.startUtc || monthRange!.startUtc), lt: (range?.endExclusiveUtc || monthRange!.endExclusiveUtc) },
    }

    const effectiveScope = untagged ? 'untagged' : tagScope
    if (effectiveScope === 'kendaraan') {
      whereClause.kendaraanPlatNomor = kendaraanPlatNomor || { not: null }
    } else if (effectiveScope === 'kebun') {
      whereClause.kebunId = kebunId || { not: null }
    } else if (effectiveScope === 'karyawan') {
      whereClause.karyawanId = karyawanId || { not: null }
    } else if (effectiveScope === 'perusahaan') {
      const perusahaanIdParam = searchParams.get('perusahaanId')
      if (perusahaanIdParam) {
        whereClause.keterangan = { contains: `[PERUSAHAAN:${perusahaanIdParam}]` }
      } else {
        whereClause.keterangan = { contains: '[PERUSAHAAN:' }
      }
    } else if (effectiveScope === 'untagged') {
      whereClause.kebunId = null
      whereClause.kendaraanPlatNomor = null
      whereClause.karyawanId = null
      whereClause.OR = [{ keterangan: null }, { keterangan: { not: { contains: '[PERUSAHAAN:' } } }]
    } else {
      if (kebunId) whereClause.kebunId = kebunId
      if (kendaraanPlatNomor) whereClause.kendaraanPlatNomor = kendaraanPlatNomor
      if (karyawanId) whereClause.karyawanId = karyawanId
    }

    const [totalItems, totalAgg, rows] = await Promise.all([
      prisma.kasTransaksi.count({ where: whereClause }),
      prisma.kasTransaksi.aggregate({ where: whereClause, _sum: { jumlah: true }, _avg: { jumlah: true }, _max: { jumlah: true }, _min: { jumlah: true } }),
      prisma.kasTransaksi.findMany({
        where: whereClause,
        include: {
          kebun: { select: { id: true, name: true } },
          kendaraan: { select: { platNomor: true, merk: true } },
          karyawan: { select: { id: true, name: true } },
          user: { select: { id: true, name: true } },
        },
        orderBy: [{ date: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    return NextResponse.json({
      data: rows,
      meta: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
        totalJumlah: totalAgg._sum.jumlah || 0,
        avgJumlah: totalAgg._avg.jumlah || 0,
        maxJumlah: totalAgg._max.jumlah || 0,
        minJumlah: totalAgg._min.jumlah || 0,
      },
    })
  } catch (error) {
    console.error('Error fetching cost-center kas transaksi:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
