import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/route-auth'
import { Prisma } from '@prisma/client'
import { getWibRangeUtcFromParams, parseWibYmd, wibEndExclusiveUtc, wibStartUtc } from '@/lib/wib'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR', 'SUPIR'])
    if (guard.response) return guard.response

    const url = new URL(request.url)
    const startDate = url.searchParams.get('startDate')
    const endDate = url.searchParams.get('endDate')
    const search = url.searchParams.get('search') || ''
    const kebunId = url.searchParams.get('kebunId')
    const supirId = url.searchParams.get('supirId')
    const pabrikId = url.searchParams.get('pabrikId')
    const statusPembayaran = url.searchParams.get('statusPembayaran')
    const statusGajian = url.searchParams.get('statusGajian')
    const perusahaanId = url.searchParams.get('perusahaanId')

    const range = getWibRangeUtcFromParams(url.searchParams)
    const start = range?.startUtc
    const end = range?.endExclusiveUtc

    const where: Prisma.NotaSawitWhereInput = {
      deletedAt: null,
      ...(start || end
        ? {
            tanggalBongkar: {
              ...(start ? { gte: start } : {}),
              ...(end ? { lt: end } : {}),
            },
          }
        : {}),
    }

    if (kebunId) {
      const kid = parseInt(kebunId, 10)
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        { OR: [{ kebunId: kid }, { timbangan: { kebunId: kid } }] },
      ]
    }
    if (supirId) where.supirId = parseInt(supirId, 10)
    if (pabrikId) where.pabrikSawitId = parseInt(pabrikId, 10)
    if (statusPembayaran && (statusPembayaran === 'LUNAS' || statusPembayaran === 'BELUM_LUNAS')) {
      where.statusPembayaran = statusPembayaran
    }
    if (statusGajian) {
      const sg = String(statusGajian).toUpperCase()
      if (sg === 'BELUM_DIPROSES') {
        where.detailGajian = null
      } else if (sg === 'DIPROSES') {
        where.statusGajian = 'DIPROSES'
      }
    }
    if (perusahaanId) {
      ;(where as any).perusahaanId = parseInt(perusahaanId, 10)
    }

    if (search) {
      const tokens = search.trim().split(/\s+/).filter(Boolean)
      const baseAnd = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      ] as Prisma.NotaSawitWhereInput[]

      for (const token of tokens) {
        const s = token.trim()
        if (!s) continue
        const sLower = s.toLowerCase()
        const orConditions: Prisma.NotaSawitWhereInput[] = []

        const ymd = parseWibYmd(s)
        if (ymd) orConditions.push({ tanggalBongkar: { gte: wibStartUtc(ymd), lt: wibEndExclusiveUtc(ymd) } })

        const hasDigit = /\d/.test(s)
        const isNumericToken = hasDigit && /^[\d.,\s]+$/.test(s)
        if (isNumericToken) {
          const sCompact = s.replace(/\s+/g, '')
          const numericToken = (() => {
            if (!/[.,]/.test(sCompact)) return sCompact
            const parts = sCompact.split(/[.,]/)
            const last = parts[parts.length - 1] || ''
            if (last.length === 3) return parts.join('')
            return sCompact.replace(',', '.')
          })()
          const like = `%${numericToken}%`
          const baseConds: Prisma.Sql[] = [
            Prisma.sql`(n."deletedAt" IS NULL) AND (CAST(n.id AS TEXT) ILIKE ${like}
              OR CAST(n.bruto AS TEXT) ILIKE ${like}
              OR CAST(n.tara AS TEXT) ILIKE ${like}
              OR CAST(n.netto AS TEXT) ILIKE ${like}
              OR CAST(n.potongan AS TEXT) ILIKE ${like}
              OR CAST(n."beratAkhir" AS TEXT) ILIKE ${like}
              OR CAST(n."hargaPerKg" AS TEXT) ILIKE ${like}
              OR CAST(n."totalPembayaran" AS TEXT) ILIKE ${like}
              OR CAST(n."pembayaranSetelahPph" AS TEXT) ILIKE ${like}
              OR CAST(n."pembayaranAktual" AS TEXT) ILIKE ${like}
              OR CAST(n.pph AS TEXT) ILIKE ${like}
              OR CAST(n.pph25 AS TEXT) ILIKE ${like})`,
          ]
          const startYmd = parseWibYmd(startDate)
          const endYmd = parseWibYmd(endDate)
          if (startYmd) baseConds.push(Prisma.sql`n."tanggalBongkar" >= ${wibStartUtc(startYmd)}`)
          if (endYmd) baseConds.push(Prisma.sql`n."tanggalBongkar" < ${wibEndExclusiveUtc(endYmd)}`)
          if (kebunId) baseConds.push(Prisma.sql`t."kebunId" = ${parseInt(kebunId, 10)}`)
          if (supirId) baseConds.push(Prisma.sql`n."supirId" = ${parseInt(supirId, 10)}`)
          if (pabrikId) baseConds.push(Prisma.sql`n."pabrikSawitId" = ${parseInt(pabrikId, 10)}`)
          if (statusPembayaran && (statusPembayaran === 'LUNAS' || statusPembayaran === 'BELUM_LUNAS')) {
            baseConds.push(Prisma.sql`n."statusPembayaran" = ${statusPembayaran}`)
          }
          const whereSql = baseConds.slice(1).reduce((acc, curr) => Prisma.sql`${acc} AND ${curr}`, baseConds[0])
          const idsRows: Array<{ id: number }> = await prisma.$queryRaw(
            Prisma.sql`SELECT n.id
                       FROM "NotaSawit" n
                       LEFT JOIN "Timbangan" t ON t.id = n."timbanganId"
                       WHERE ${whereSql}`,
          )
          const numericIds = idsRows.map((r) => r.id)
          if (numericIds.length > 0) orConditions.push({ id: { in: numericIds } })
        }

        if (sLower.includes('lunas')) orConditions.push({ statusPembayaran: 'LUNAS' })
        if (sLower.includes('belum') || sLower.includes('pending')) orConditions.push({ statusPembayaran: 'BELUM_LUNAS' })

        orConditions.push(
          { keterangan: { contains: s, mode: 'insensitive' } },
          { statusGajian: { contains: s, mode: 'insensitive' } },
          { supir: { name: { contains: s, mode: 'insensitive' } } },
          { kendaraan: { platNomor: { contains: s, mode: 'insensitive' } } },
          { kendaraanPlatNomor: { contains: s, mode: 'insensitive' } },
          { pabrikSawit: { name: { contains: s, mode: 'insensitive' } } },
          { kebun: { name: { contains: s, mode: 'insensitive' } } },
          { timbangan: { kebun: { name: { contains: s, mode: 'insensitive' } } } },
          { timbangan: { notes: { contains: s, mode: 'insensitive' } } },
        )

        baseAnd.push({ OR: orConditions })
      }

      where.AND = baseAnd
      delete (where as any).OR
    }

    const rows = await prisma.notaSawit.findMany({
      where,
      select: {
        id: true,
        netto: true,
        beratAkhir: true,
        pembayaranAktual: true,
        pembayaranSetelahPph: true,
        totalPembayaran: true,
        statusPembayaran: true,
        kebun: { select: { id: true, name: true } },
        timbangan: { select: { netKg: true, kebun: { select: { id: true, name: true } } } },
      },
    })

    const totalNota = rows.length
    const totalBerat = rows.reduce((sum, r) => {
      const beratAkhir = Number(r.beratAkhir || 0)
      return sum + (Number.isFinite(beratAkhir) ? beratAkhir : 0)
    }, 0)
    const tonaseByKebunMap = rows.reduce((acc, r) => {
      const kebun = (r as any).kebun || (r as any).timbangan?.kebun || null
      const kebunId = kebun?.id ? Number(kebun.id) : null
      const kebunName = kebun?.name ? String(kebun.name) : null
      if (!kebunId || !kebunName) return acc
      const beratAkhir = Number(r.beratAkhir || 0)
      const add = Number.isFinite(beratAkhir) ? beratAkhir : 0
      const prev = acc.get(kebunId)
      acc.set(kebunId, { kebunId, name: kebunName, totalBerat: (prev?.totalBerat || 0) + add })
      return acc
    }, new Map<number, { kebunId: number; name: string; totalBerat: number }>())
    const totalPembayaran = rows.reduce((sum, r) => {
      const val = Number(r.pembayaranSetelahPph ?? r.totalPembayaran ?? 0)
      return sum + (Number.isFinite(val) ? val : 0)
    }, 0)
    const lunasCount = rows.filter((r) => r.statusPembayaran === 'LUNAS').length
    const belumLunasCount = rows.filter((r) => r.statusPembayaran === 'BELUM_LUNAS').length
    const totalPembayaranLunas = rows.reduce((sum, r) => {
      if (r.statusPembayaran !== 'LUNAS') return sum
      const val = Number(r.pembayaranSetelahPph ?? r.totalPembayaran ?? 0)
      return sum + (Number.isFinite(val) ? val : 0)
    }, 0)
    const totalPembayaranBelumLunas = rows.reduce((sum, r) => {
      if (r.statusPembayaran !== 'BELUM_LUNAS') return sum
      const val = Number(r.pembayaranSetelahPph ?? r.totalPembayaran ?? 0)
      return sum + (Number.isFinite(val) ? val : 0)
    }, 0)
    const tonaseByKebun = Array.from(tonaseByKebunMap.values())
      .map((r) => ({ ...r, totalBerat: Math.round(Number(r.totalBerat) || 0) }))
      .sort((a, b) => b.totalBerat - a.totalBerat)

    return NextResponse.json({
      count: totalNota,
      totalNota,
      totalBerat: Math.round(totalBerat),
      tonaseByKebun,
      totalPembayaran: Math.round(totalPembayaran),
      lunasCount,
      belumLunasCount,
      totalPembayaranLunas: Math.round(totalPembayaranLunas),
      totalPembayaranBelumLunas: Math.round(totalPembayaranBelumLunas),
    })
  } catch (error) {
    console.error('GET /api/nota-sawit/summary error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
