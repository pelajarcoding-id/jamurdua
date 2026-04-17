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
    const search = (searchParams.get('search') || '').trim()
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
    whereClause.AND = [
      ...((whereClause.AND as any[]) || []),
      { OR: [{ kategori: { not: 'GAJI' } }, { kategori: null }] },
    ]

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

    if (search) {
      whereClause.AND = [
        ...((whereClause.AND as any[]) || []),
        {
          OR: [
            { kategori: { contains: search, mode: 'insensitive' } },
            { deskripsi: { contains: search, mode: 'insensitive' } },
            { keterangan: { contains: search, mode: 'insensitive' } },
            { user: { name: { contains: search, mode: 'insensitive' } } },
            { kebun: { name: { contains: search, mode: 'insensitive' } } },
            { kendaraan: { platNomor: { contains: search, mode: 'insensitive' } } },
            { karyawan: { name: { contains: search, mode: 'insensitive' } } },
          ],
        },
      ]
    }

    const startUtc = (range?.startUtc || monthRange!.startUtc)
    const endExclusiveUtc = (range?.endExclusiveUtc || monthRange!.endExclusiveUtc)
    const uangJalanBaseWhere: any = {
      deletedAt: null,
      tipe: 'PENGELUARAN',
      date: { gte: startUtc, lt: endExclusiveUtc },
      sesiUangJalan: { deletedAt: null },
    }

    if (effectiveScope === 'kendaraan') {
      uangJalanBaseWhere.description = kendaraanPlatNomor ? { contains: `[KENDARAAN:${kendaraanPlatNomor}]` } : { contains: '[KENDARAAN:' }
    } else if (effectiveScope === 'kebun') {
      uangJalanBaseWhere.description = kebunId ? { contains: `[KEBUN:${kebunId}]` } : { contains: '[KEBUN:' }
    } else if (effectiveScope === 'karyawan') {
      uangJalanBaseWhere.description = karyawanId ? { contains: `[KARYAWAN:${karyawanId}]` } : { contains: '[KARYAWAN:' }
    } else if (effectiveScope === 'perusahaan') {
      const perusahaanIdParam = searchParams.get('perusahaanId')
      uangJalanBaseWhere.description = perusahaanIdParam ? { contains: `[PERUSAHAAN:${perusahaanIdParam}]` } : { contains: '[PERUSAHAAN:' }
    } else if (effectiveScope === 'untagged') {
      uangJalanBaseWhere.AND = [
        { OR: [{ description: null }, { description: { not: { contains: '[KENDARAAN:' } } }] },
        { OR: [{ description: null }, { description: { not: { contains: '[KEBUN:' } } }] },
        { OR: [{ description: null }, { description: { not: { contains: '[PERUSAHAAN:' } } }] },
        { OR: [{ description: null }, { description: { not: { contains: '[KARYAWAN:' } } }] },
      ]
    } else {
      const descFilters: string[] = []
      if (kendaraanPlatNomor) descFilters.push(`[KENDARAAN:${kendaraanPlatNomor}]`)
      if (kebunId) descFilters.push(`[KEBUN:${kebunId}]`)
      if (karyawanId) descFilters.push(`[KARYAWAN:${karyawanId}]`)
      if (descFilters.length > 0) {
        uangJalanBaseWhere.AND = descFilters.map((x) => ({ description: { contains: x } }))
      }
    }

    if (search) {
      uangJalanBaseWhere.AND = [
        ...((uangJalanBaseWhere.AND as any[]) || []),
        {
          OR: [
            { description: { contains: search, mode: 'insensitive' } },
            { sesiUangJalan: { supir: { name: { contains: search, mode: 'insensitive' } } } },
            { sesiUangJalan: { kendaraan: { platNomor: { contains: search, mode: 'insensitive' } } } },
            { user: { name: { contains: search, mode: 'insensitive' } } },
          ],
        },
      ]
    }

    const takeN = page * pageSize
    const [kasTotalItems, kasTotalAgg, kasRows, ujTotalItems, ujTotalAgg, ujRows] = await Promise.all([
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
        take: takeN,
      }),
      prisma.uangJalan.count({ where: uangJalanBaseWhere }),
      prisma.uangJalan.aggregate({ where: uangJalanBaseWhere, _sum: { amount: true }, _avg: { amount: true }, _max: { amount: true }, _min: { amount: true } }),
      prisma.uangJalan.findMany({
        where: uangJalanBaseWhere,
        select: {
          id: true,
          date: true,
          tipe: true,
          amount: true,
          description: true,
          gambarUrl: true,
          sesiUangJalan: {
            select: {
              id: true,
              kendaraanPlatNomor: true,
              kendaraan: { select: { platNomor: true, merk: true } },
              supir: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: [{ date: 'desc' }, { id: 'desc' }],
        take: takeN,
      }),
    ])

    const stripAllMarkers = (text: string | null) => (text || '').replace(/\s*\[(KENDARAAN|KEBUN|PERUSAHAAN|KARYAWAN):[^\]]+\]/g, '').trim()
    const extractTag = (text: string | null, tag: string) => {
      const m = (text || '').match(new RegExp(`\\[${tag}:([^\\]]+)\\]`))
      return m?.[1] ? String(m[1]).trim() : null
    }

    const ujKebunIds = new Set<number>()
    const ujKaryawanIds = new Set<number>()
    const ujKendaraanPlats = new Set<string>()
    for (const r of (ujRows as any[])) {
      const kebunIdRaw = extractTag(r.description, 'KEBUN')
      const karyawanIdRaw = extractTag(r.description, 'KARYAWAN')
      const kendaraanRaw = extractTag(r.description, 'KENDARAAN')
      if (kebunIdRaw && Number.isFinite(Number(kebunIdRaw))) ujKebunIds.add(Number(kebunIdRaw))
      if (karyawanIdRaw && Number.isFinite(Number(karyawanIdRaw))) ujKaryawanIds.add(Number(karyawanIdRaw))
      const plat = kendaraanRaw || r?.sesiUangJalan?.kendaraanPlatNomor
      if (plat) ujKendaraanPlats.add(String(plat))
    }

    const [kebuns, karyawans, kendaraans] = await Promise.all([
      ujKebunIds.size > 0 ? prisma.kebun.findMany({ where: { id: { in: Array.from(ujKebunIds) } }, select: { id: true, name: true } }) : Promise.resolve([]),
      ujKaryawanIds.size > 0 ? prisma.user.findMany({ where: { id: { in: Array.from(ujKaryawanIds) } }, select: { id: true, name: true } }) : Promise.resolve([]),
      ujKendaraanPlats.size > 0 ? prisma.kendaraan.findMany({ where: { platNomor: { in: Array.from(ujKendaraanPlats) } }, select: { platNomor: true, merk: true } }) : Promise.resolve([]),
    ])
    const kebunMap = new Map(kebuns.map((k) => [k.id, k]))
    const karyawanMap = new Map(karyawans.map((u) => [u.id, u]))
    const kendaraanMap = new Map(kendaraans.map((k) => [k.platNomor, k]))

    const mappedKas = (kasRows as any[]).map((r: any) => ({ ...r, source: 'KAS' }))
    const mappedUj = (ujRows as any[]).map((r: any) => {
      const kebunIdRaw = extractTag(r.description, 'KEBUN')
      const kebunIdVal = kebunIdRaw && Number.isFinite(Number(kebunIdRaw)) ? Number(kebunIdRaw) : null
      const karyawanIdRaw = extractTag(r.description, 'KARYAWAN')
      const karyawanIdVal = karyawanIdRaw && Number.isFinite(Number(karyawanIdRaw)) ? Number(karyawanIdRaw) : null
      const kendaraanPlat = extractTag(r.description, 'KENDARAAN') || r?.sesiUangJalan?.kendaraanPlatNomor || null
      const kebun = kebunIdVal ? kebunMap.get(kebunIdVal) || null : null
      const karyawan = karyawanIdVal ? karyawanMap.get(karyawanIdVal) || null : null
      const kendaraan = kendaraanPlat ? kendaraanMap.get(String(kendaraanPlat)) || r?.sesiUangJalan?.kendaraan || null : null
      const supir = r?.sesiUangJalan?.supir || null
      return {
        id: r.id,
        date: r.date,
        tipe: 'PENGELUARAN',
        kategori: 'UANG_JALAN',
        deskripsi: stripAllMarkers(r.description) || 'Uang Jalan',
        keterangan: r.description || null,
        jumlah: Number(r.amount || 0),
        gambarUrl: r.gambarUrl || null,
        kebunId: kebunIdVal,
        kendaraanPlatNomor: kendaraanPlat ? String(kendaraanPlat) : null,
        karyawanId: karyawanIdVal,
        kebun,
        kendaraan,
        karyawan,
        user: supir,
        source: 'UANG_JALAN',
      }
    })

    const combined = [...mappedKas, ...mappedUj]
    combined.sort((a: any, b: any) => {
      const da = new Date(a.date).getTime()
      const db = new Date(b.date).getTime()
      if (db !== da) return db - da
      const sa = String(a.source || '')
      const sb = String(b.source || '')
      if (sa !== sb) return sa.localeCompare(sb)
      return Number(b.id) - Number(a.id)
    })
    const totalItems = (kasTotalItems || 0) + (ujTotalItems || 0)
    const totalJumlah = Number(kasTotalAgg?._sum?.jumlah || 0) + Number(ujTotalAgg?._sum?.amount || 0)
    const avgJumlah = totalItems > 0 ? totalJumlah / totalItems : 0
    const maxJumlah = Math.max(Number(kasTotalAgg?._max?.jumlah || 0), Number(ujTotalAgg?._max?.amount || 0))
    const minJumlah = (() => {
      const a = Number(kasTotalAgg?._min?.jumlah || 0)
      const b = Number(ujTotalAgg?._min?.amount || 0)
      if (kasTotalItems && ujTotalItems) return Math.min(a, b)
      if (kasTotalItems) return a
      if (ujTotalItems) return b
      return 0
    })()

    const data = combined.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize)

    return NextResponse.json({
      data,
      meta: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
        totalJumlah,
        avgJumlah,
        maxJumlah,
        minJumlah,
      },
    })
  } catch (error) {
    console.error('Error fetching cost-center kas transaksi:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
