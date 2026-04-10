import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/route-auth'
import { parseDateRangeFromSearchParams } from '@/lib/wib'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR', 'MANAGER', 'SUPIR'])
    if (guard.response) return guard.response

    const supirId = Number(params.id)
    if (!supirId) return NextResponse.json({ error: 'supirId tidak valid' }, { status: 400 })

    if (guard.role === 'SUPIR' && guard.id !== supirId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const range = parseDateRangeFromSearchParams(searchParams)
    if (!range) return NextResponse.json({ error: 'startDate dan endDate wajib diisi' }, { status: 400 })

    const supir = await prisma.user.findUnique({
      where: { id: supirId },
      select: { id: true, name: true, role: true },
    })
    if (!supir || supir.role !== 'SUPIR') return NextResponse.json({ error: 'Supir tidak ditemukan' }, { status: 404 })

    const notas = await prisma.notaSawit.findMany({
      where: {
        supirId,
        createdAt: { gte: range.start, lte: range.end },
      },
      select: {
        id: true,
        createdAt: true,
        tanggalBongkar: true,
        kendaraanPlatNomor: true,
        beratAkhir: true,
        statusPembayaran: true,
        kebun: { select: { id: true, name: true } },
        pabrikSawit: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    })

    const uangJalanRows = await prisma.uangJalan.findMany({
      where: {
        sesiUangJalan: { supirId },
        date: { gte: range.start, lte: range.end },
      },
      select: {
        id: true,
        tipe: true,
        amount: true,
        date: true,
        description: true,
        gambarUrl: true,
        sesiUangJalan: {
          select: {
            id: true,
            tanggalMulai: true,
            status: true,
            keterangan: true,
            kendaraanPlatNomor: true,
          },
        },
      },
      orderBy: { date: 'desc' },
      take: 2000,
    })

    const sesiMap = new Map<number, any>()
    let totalDiberikan = 0
    let totalPengeluaran = 0

    for (const r of uangJalanRows) {
      const sesiId = r.sesiUangJalan.id
      let sesi = sesiMap.get(sesiId)
      if (!sesi) {
        sesi = {
          id: sesiId,
          tanggalMulai: r.sesiUangJalan.tanggalMulai,
          status: r.sesiUangJalan.status,
          keterangan: r.sesiUangJalan.keterangan,
          kendaraanPlatNomor: r.sesiUangJalan.kendaraanPlatNomor,
          totalDiberikan: 0,
          totalPengeluaran: 0,
          saldo: 0,
          rincian: [],
        }
        sesiMap.set(sesiId, sesi)
      }
      sesi.rincian.push({
        id: r.id,
        tipe: r.tipe,
        amount: r.amount,
        date: r.date,
        description: r.description,
        gambarUrl: r.gambarUrl,
      })
      if (r.tipe === 'PEMASUKAN') {
        sesi.totalDiberikan += r.amount
        totalDiberikan += r.amount
      } else if (r.tipe === 'PENGELUARAN') {
        sesi.totalPengeluaran += r.amount
        totalPengeluaran += r.amount
      }
    }

    const sesiList = Array.from(sesiMap.values())
      .map((s) => ({ ...s, saldo: s.totalDiberikan - s.totalPengeluaran }))
      .sort((a, b) => new Date(b.tanggalMulai).getTime() - new Date(a.tanggalMulai).getTime())

    const totalBerat = notas.reduce((acc, n) => acc + Number(n.beratAkhir || 0), 0)
    const jumlahNota = notas.length

    return NextResponse.json({
      supir: { id: supir.id, name: supir.name },
      period: { start: range.start.toISOString(), end: range.end.toISOString() },
      notaSummary: {
        jumlahNota,
        totalBerat,
        rataRataBerat: jumlahNota > 0 ? totalBerat / jumlahNota : 0,
      },
      uangJalanSummary: {
        totalDiberikan,
        totalPengeluaran,
        saldo: totalDiberikan - totalPengeluaran,
      },
      notas,
      sesiUangJalan: sesiList,
    })
  } catch (error) {
    console.error('GET /api/supir/[id]/details error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

