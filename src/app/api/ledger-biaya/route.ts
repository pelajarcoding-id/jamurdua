import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/route-auth'
import { getWibRangeUtcFromParams } from '@/lib/wib'

export const dynamic = 'force-dynamic'

function toDateOnlyUtc(ymd: { y: number; m: number; d: number }) {
  return new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d, 0, 0, 0, 0))
}

function detectScope(row: any) {
  const ket = String(row?.keterangan || '')
  const kategori = String(row?.kategori || '').toUpperCase()
  const deskripsi = String(row?.deskripsi || '').toUpperCase()
  if (row?.kendaraanPlatNomor || /\[KENDARAAN:\s*.+\]/i.test(ket) || kategori.includes('KENDARAAN')) return 'KENDARAAN'
  if (row?.kebunId || /\[KEBUN:\s*.+\]/i.test(ket) || kategori.includes('KEBUN')) return 'KEBUN'
  if (/\[PERUSAHAAN:\s*\d+\]/i.test(ket) || kategori.includes('PERUSAHAAN')) return 'PERUSAHAAN'
  if (row?.karyawanId || /\[KARYAWAN:\s*\d+\]/i.test(ket) || kategori.includes('KARYAWAN') || row?.gajianId) return 'KARYAWAN'
  if (kategori.includes('UANG_JALAN') || deskripsi.includes('UANG JALAN') || deskripsi.includes('BBM')) return 'UANG_JALAN'
  return 'KAS'
}

function extractPerusahaanIdFromKeterangan(keterangan?: string | null) {
  const m = String(keterangan || '').match(/\[PERUSAHAAN:\s*(\d+)\]/i)
  const n = m ? Number(m[1]) : 0
  return Number.isFinite(n) && n > 0 ? n : null
}

function extractTagId(text: string | null | undefined, key: string) {
  const m = String(text || '').match(new RegExp(`\\[${key}:\\s*([^\\]]+)\\]`, 'i'))
  return m ? String(m[1]).trim() : null
}

function stripUangJalanTags(description: string) {
  return String(description || '')
    .replace(/\[KENDARAAN:[^\]]+\]/gi, '')
    .replace(/\[KEBUN:\s*\d+\]/gi, '')
    .replace(/\[KARYAWAN:\s*\d+\]/gi, '')
    .replace(/\[PERUSAHAAN:\s*\d+\]/gi, '')
    .replace(/\[URUTAN:\s*\d+\]/gi, '')
    .replace(/\[BON:\s*[^\]]+\]/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function detectScopeUangJalan(description: string, sesi: any) {
  const desc = String(description || '')
  if (sesi?.kendaraanPlatNomor || /\[KENDARAAN:/i.test(desc)) return 'KENDARAAN'
  if (/\[KEBUN:\s*\d+\]/i.test(desc)) return 'KEBUN'
  if (/\[KARYAWAN:\s*\d+\]/i.test(desc)) return 'KARYAWAN'
  if (/\[PERUSAHAAN:\s*\d+\]/i.test(desc)) return 'PERUSAHAAN'
  return 'UANG_JALAN'
}

function detectScopePekerjaan(row: any) {
  if (row?.kendaraanPlatNomor) return 'KENDARAAN'
  if (row?.userId) return 'KARYAWAN'
  if (row?.kebunId) return 'KEBUN'
  return 'KEBUN'
}

function decimalToNumber(v: any) {
  if (v == null) return 0
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }
  try {
    const s = typeof v?.toString === 'function' ? v.toString() : ''
    const n = Number(s)
    return Number.isFinite(n) ? n : 0
  } catch {
    return 0
  }
}

export async function GET(request: Request) {
  console.log('DEBUG: API Ledger Biaya called at', new Date().toISOString())
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR', 'MANAGER'])
    if (guard.response) return guard.response

    const url = new URL(request.url)
    const sp = url.searchParams
    const pageRaw = Number(sp.get('page') || 1)
    const limitRaw = Number(sp.get('limit') || 20)
    const page = Number.isFinite(pageRaw) ? Math.max(1, pageRaw) : 1
    const limit = Number.isFinite(limitRaw) ? Math.min(200, Math.max(1, limitRaw)) : 20
    const takeN = page * limit

    const search = String(sp.get('search') || '').trim()
    const tipe = String(sp.get('tipe') || 'all').trim().toUpperCase()
    const scope = String(sp.get('scope') || 'all').trim().toUpperCase()
    const kategori = String(sp.get('kategori') || '').trim()
    const kebunId = Number(sp.get('kebunId') || 0)
    const karyawanId = Number(sp.get('karyawanId') || 0)
    const perusahaanIdParam = Number(sp.get('perusahaanId') || 0)
    const kendaraanPlatNomor = String(sp.get('kendaraanPlatNomor') || '').trim()
    const includeOperasional = sp.get('includeOperasional') !== '0'
    const includeEntityStats = sp.get('includeEntityStats') === '1'
    const incomeOnly = tipe === 'PEMASUKAN'
    const expenseOnly = tipe === 'PENGELUARAN'

    const range = getWibRangeUtcFromParams(sp)
    const includeKas = scope === 'ALL' || scope === 'KAS' || scope === 'KENDARAAN' || scope === 'KEBUN' || scope === 'KARYAWAN' || scope === 'PERUSAHAAN' || scope === 'UANG_JALAN'
    const includeUangJalan = scope === 'ALL' || scope === 'UANG_JALAN' || scope === 'KENDARAAN' || scope === 'KEBUN' || scope === 'KARYAWAN' || scope === 'PERUSAHAAN'
    const includePerusahaanBiaya = scope === 'ALL' || scope === 'PERUSAHAAN'
    const includeBorongan = includeOperasional && !incomeOnly && (scope === 'ALL' || scope === 'KEBUN' || scope === 'KARYAWAN' || scope === 'KENDARAAN')
    const includeAbsensi = includeOperasional && !incomeOnly && (scope === 'ALL' || scope === 'KEBUN' || scope === 'KARYAWAN')
    const includeServiceLog = !incomeOnly && (scope === 'ALL' || scope === 'KENDARAAN')
    const includeRiwayatDokumen = !incomeOnly && (scope === 'ALL' || scope === 'KENDARAAN')
    const includeNotaSawitIncome =
      !expenseOnly && (scope === 'ALL' || scope === 'KEBUN' || scope === 'KENDARAAN' || scope === 'PERUSAHAAN')

    const whereKas: any = { deletedAt: null, AND: [] as any[] }
    if (range) whereKas.AND.push({ date: { gte: range.startUtc, lt: range.endExclusiveUtc } })
    
    // Filter pendapatan hanya yang dibuat oleh pemilik
    const incomeFilter = {
      tipe: 'PEMASUKAN',
      user: { role: 'PEMILIK' },
      NOT: [
        { kategori: { equals: 'PENJUALAN_SAWIT', mode: 'insensitive' } },
        { kategori: { equals: 'PENJUALAN SAWIT', mode: 'insensitive' } },
        { kategori: { contains: 'PENJUALAN_SAWIT', mode: 'insensitive' } },
        { notaSawitId: { not: null } },
      ],
    }
    const expenseFilter = { tipe: 'PENGELUARAN' }

    if (tipe === 'PEMASUKAN') {
      whereKas.AND.push(incomeFilter)
    } else if (tipe === 'PENGELUARAN') {
      whereKas.AND.push(expenseFilter)
    } else {
      whereKas.AND.push({
        OR: [
          expenseFilter,
          incomeFilter
        ]
      })
    }

    whereKas.AND.push({
      NOT: {
        kategori: {
          equals: 'GAJI',
          mode: 'insensitive',
        },
      },
    })

    if (kategori) whereKas.AND.push({ kategori })
    if (Number.isFinite(kebunId) && kebunId > 0) whereKas.AND.push({ kebunId })
    if (Number.isFinite(karyawanId) && karyawanId > 0) whereKas.AND.push({ karyawanId })
    if (Number.isFinite(perusahaanIdParam) && perusahaanIdParam > 0) {
      whereKas.AND.push({ keterangan: { contains: `[PERUSAHAAN:${perusahaanIdParam}]` } })
    }
    if (kendaraanPlatNomor) whereKas.AND.push({ kendaraanPlatNomor: { equals: kendaraanPlatNomor, mode: 'insensitive' } })

    if (scope !== 'ALL') {
      if (scope === 'KENDARAAN') {
        whereKas.AND.push({
          OR: [
            { kendaraanPlatNomor: { not: null } },
            { keterangan: { contains: '[KENDARAAN:', mode: 'insensitive' } },
            { kategori: { contains: 'KENDARAAN', mode: 'insensitive' } },
          ],
        })
      } else if (scope === 'KEBUN') {
        whereKas.AND.push({
          OR: [
            { kebunId: { not: null } },
            { keterangan: { contains: '[KEBUN:', mode: 'insensitive' } },
            { kategori: { contains: 'KEBUN', mode: 'insensitive' } },
          ],
        })
      } else if (scope === 'PERUSAHAAN') {
        whereKas.AND.push({
          OR: [
            { keterangan: { contains: '[PERUSAHAAN:', mode: 'insensitive' } },
            { kategori: { contains: 'PERUSAHAAN', mode: 'insensitive' } },
          ],
        })
      } else if (scope === 'KARYAWAN') {
        whereKas.AND.push({
          OR: [
            { karyawanId: { not: null } },
            { gajianId: { not: null } },
            { keterangan: { contains: '[KARYAWAN:', mode: 'insensitive' } },
            { kategori: { contains: 'KARYAWAN', mode: 'insensitive' } },
          ],
        })
      } else if (scope === 'KAS') {
        whereKas.AND.push({
          AND: [
            { kebunId: null },
            { karyawanId: null },
            { kendaraanPlatNomor: null },
            { gajianId: null },
            { keterangan: { not: { contains: '[PERUSAHAAN:', mode: 'insensitive' } } },
          ],
        })
      }
    }

    if (search) {
      whereKas.AND.push({
        OR: [
          { deskripsi: { contains: search, mode: 'insensitive' } },
          { keterangan: { contains: search, mode: 'insensitive' } },
          { kategori: { contains: search, mode: 'insensitive' } },
          { tipe: { contains: search, mode: 'insensitive' } },
          { kebun: { name: { contains: search, mode: 'insensitive' } } },
          { karyawan: { name: { contains: search, mode: 'insensitive' } } },
          { kendaraan: { platNomor: { contains: search, mode: 'insensitive' } } },
          { kendaraanPlatNomor: { contains: search, mode: 'insensitive' } },
        ],
      })
    }
    if (whereKas.AND.length === 0) delete whereKas.AND

    const whereUj: any = { deletedAt: null, AND: [] as any[] }
    if (range) whereUj.AND.push({ date: { gte: range.startUtc, lt: range.endExclusiveUtc } })
    
    // Uang Jalan Pemasukan tidak memiliki creator, sehingga kita exclude jika hanya ingin dari pemilik
    if (tipe === 'PEMASUKAN') {
      whereUj.AND.push({ id: -1 })
    } else if (tipe === 'PENGELUARAN') {
      whereUj.AND.push({ tipe: { equals: 'PENGELUARAN', mode: 'insensitive' } })
    } else {
      whereUj.AND.push({ tipe: { equals: 'PENGELUARAN', mode: 'insensitive' } })
    }

    if (kategori && kategori.toUpperCase() !== 'UANG_JALAN') whereUj.AND.push({ id: -1 })
    if (kendaraanPlatNomor) {
      whereUj.AND.push({
        OR: [
          { sesiUangJalan: { kendaraanPlatNomor: { equals: kendaraanPlatNomor, mode: 'insensitive' } } },
          { description: { contains: `[KENDARAAN:${kendaraanPlatNomor}]` } },
        ],
      })
    }
    if (Number.isFinite(kebunId) && kebunId > 0) whereUj.AND.push({ description: { contains: `[KEBUN:${kebunId}]` } })
    if (Number.isFinite(karyawanId) && karyawanId > 0) whereUj.AND.push({ description: { contains: `[KARYAWAN:${karyawanId}]` } })
    if (Number.isFinite(perusahaanIdParam) && perusahaanIdParam > 0) whereUj.AND.push({ description: { contains: `[PERUSAHAAN:${perusahaanIdParam}]` } })
    if (scope !== 'ALL') {
      if (scope === 'KENDARAAN') whereUj.AND.push({ OR: [{ sesiUangJalan: { kendaraanPlatNomor: { not: null } } }, { description: { contains: '[KENDARAAN:' } }] })
      else if (scope === 'KEBUN') whereUj.AND.push({ description: { contains: '[KEBUN:' } })
      else if (scope === 'PERUSAHAAN') whereUj.AND.push({ description: { contains: '[PERUSAHAAN:' } })
      else if (scope === 'KARYAWAN') whereUj.AND.push({ description: { contains: '[KARYAWAN:' } })
      else if (scope === 'KAS') whereUj.AND.push({ id: -1 })
    }
    if (search) {
      whereUj.AND.push({
        OR: [
          { description: { contains: search, mode: 'insensitive' } },
          { sesiUangJalan: { supir: { name: { contains: search, mode: 'insensitive' } } } },
          { sesiUangJalan: { kendaraan: { platNomor: { contains: search, mode: 'insensitive' } } } },
        ],
      })
    }
    if (whereUj.AND.length === 0) delete whereUj.AND

    const wherePb: any = { AND: [] as any[] }
    if (range) {
      const start = toDateOnlyUtc(range.startYmd)
      const end = toDateOnlyUtc(range.endYmd)
      wherePb.AND.push({ date: { gte: start, lte: end } })
    }
    
    // Perusahaan Biaya Pemasukan tidak memiliki creator, sehingga kita exclude jika hanya ingin dari pemilik
    if (tipe === 'PEMASUKAN') {
      wherePb.AND.push({ id: -1 })
    } else if (tipe === 'PENGELUARAN') {
      wherePb.AND.push({ type: 'PENGELUARAN' })
    } else {
      wherePb.AND.push({ type: 'PENGELUARAN' })
    }

    if (kategori) wherePb.AND.push({ kategori })
    if (Number.isFinite(perusahaanIdParam) && perusahaanIdParam > 0) wherePb.AND.push({ perusahaanId: perusahaanIdParam })
    if (scope !== 'ALL') {
      if (scope !== 'PERUSAHAAN') wherePb.AND.push({ id: -1 })
    }
    if (search) {
      wherePb.AND.push({
        OR: [
          { deskripsi: { contains: search, mode: 'insensitive' } },
          { kategori: { contains: search, mode: 'insensitive' } },
          { perusahaan: { name: { contains: search, mode: 'insensitive' } } },
        ],
      })
    }
    if (wherePb.AND.length === 0) delete wherePb.AND

    const tasks: any[] = []
    if (includeKas) {
      tasks.push(
        prisma.kasTransaksi.findMany({
          where: whereKas,
          include: {
            kebun: { select: { id: true, name: true } },
            karyawan: { select: { id: true, name: true } },
            kendaraan: { select: { platNomor: true, merk: true } },
            user: { select: { name: true, role: true } },
          },
          orderBy: [{ date: 'desc' }, { id: 'desc' }],
          take: takeN,
        }),
        prisma.kasTransaksi.count({ where: whereKas }),
        prisma.kasTransaksi.aggregate({ where: { ...whereKas, tipe: 'PENGELUARAN' }, _sum: { jumlah: true } }),
        prisma.kasTransaksi.aggregate({
          where: {
            ...whereKas,
            tipe: 'PEMASUKAN',
            NOT: [
              { kategori: { equals: 'PENJUALAN_SAWIT', mode: 'insensitive' } },
              { kategori: { equals: 'PENJUALAN SAWIT', mode: 'insensitive' } },
              { kategori: { contains: 'PENJUALAN_SAWIT', mode: 'insensitive' } },
              { notaSawitId: { not: null } },
            ],
          } as any,
          _sum: { jumlah: true },
        }),
      )
    } else {
      tasks.push(Promise.resolve([]), Promise.resolve(0), Promise.resolve({ _sum: { jumlah: 0 } }), Promise.resolve({ _sum: { jumlah: 0 } }))
    }
    if (includeUangJalan) {
      tasks.push(
        prisma.uangJalan.findMany({
          where: whereUj,
          include: {
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
        prisma.uangJalan.count({ where: whereUj }),
        prisma.uangJalan.aggregate({ where: { ...whereUj, tipe: { equals: 'PENGELUARAN', mode: 'insensitive' } }, _sum: { amount: true } }),
        prisma.uangJalan.aggregate({ where: { ...whereUj, tipe: { equals: 'PEMASUKAN', mode: 'insensitive' } }, _sum: { amount: true } }),
      )
    } else {
      tasks.push(Promise.resolve([]), Promise.resolve(0), Promise.resolve({ _sum: { amount: 0 } }), Promise.resolve({ _sum: { amount: 0 } }))
    }
    if (includePerusahaanBiaya) {
      tasks.push(
        prisma.perusahaanBiaya.findMany({
          where: wherePb,
          include: { perusahaan: { select: { id: true, name: true } } },
          orderBy: [{ date: 'desc' }, { id: 'desc' }],
          take: takeN,
        }),
        prisma.perusahaanBiaya.count({ where: wherePb }),
        prisma.perusahaanBiaya.aggregate({ where: { ...wherePb, type: 'PENGELUARAN' }, _sum: { jumlah: true } }),
        prisma.perusahaanBiaya.aggregate({ where: { ...wherePb, type: 'PEMASUKAN' }, _sum: { jumlah: true } }),
      )
    } else {
      tasks.push(Promise.resolve([]), Promise.resolve(0), Promise.resolve({ _sum: { jumlah: 0 } }), Promise.resolve({ _sum: { jumlah: 0 } }))
    }

    const wherePk: any = { AND: [] as any[] }
    if (range) wherePk.AND.push({ date: { gte: range.startUtc, lt: range.endExclusiveUtc } })
    wherePk.AND.push({ upahBorongan: true })
    wherePk.AND.push({ biaya: { gt: 0 } })
    if (Number.isFinite(kebunId) && kebunId > 0) wherePk.AND.push({ kebunId })
    if (Number.isFinite(karyawanId) && karyawanId > 0) wherePk.AND.push({ userId: karyawanId })
    if (kendaraanPlatNomor) wherePk.AND.push({ kendaraanPlatNomor: { equals: kendaraanPlatNomor, mode: 'insensitive' } })
    if (search) {
      wherePk.AND.push({
        OR: [
          { jenisPekerjaan: { contains: search, mode: 'insensitive' } },
          { kategoriBorongan: { contains: search, mode: 'insensitive' } },
          { keterangan: { contains: search, mode: 'insensitive' } },
          { kebun: { name: { contains: search, mode: 'insensitive' } } },
          { user: { name: { contains: search, mode: 'insensitive' } } },
          { kendaraan: { platNomor: { contains: search, mode: 'insensitive' } } },
        ],
      })
    }
    if (wherePk.AND.length === 0) delete wherePk.AND

    const wherePkSummary = { ...wherePk }

    if (includeBorongan) {
      tasks.push(
        prisma.pekerjaanKebun.findMany({
          where: wherePkSummary,
          include: {
            kebun: { select: { id: true, name: true } },
            user: { select: { id: true, name: true } },
            kendaraan: { select: { platNomor: true, merk: true } },
          },
          orderBy: [{ date: 'desc' }, { id: 'desc' }],
          take: takeN,
        }),
        prisma.pekerjaanKebun.count({ where: wherePkSummary }),
        prisma.pekerjaanKebun.aggregate({ where: wherePkSummary, _sum: { biaya: true } }),
      )
    } else {
      tasks.push(Promise.resolve([]), Promise.resolve(0), Promise.resolve({ _sum: { biaya: 0 } }))
    }

    const whereAbRaw: any = { AND: [] as any[] }
    if (range) {
      const start = toDateOnlyUtc(range.startYmd)
      const end = toDateOnlyUtc(range.endYmd)
      whereAbRaw.AND.push({ date: { gte: start, lte: end } })
    }
    if (Number.isFinite(kebunId) && kebunId > 0) whereAbRaw.AND.push({ kebunId })
    if (Number.isFinite(karyawanId) && karyawanId > 0) whereAbRaw.AND.push({ karyawanId })
    whereAbRaw.AND.push({ OR: [{ jumlah: { gt: 0 } }, { uangMakan: { gt: 0 } }] })
    if (search) {
      whereAbRaw.AND.push({
        OR: [
          { note: { contains: search, mode: 'insensitive' } },
          { source: { contains: search, mode: 'insensitive' } },
        ],
      })
    }
    if (whereAbRaw.AND.length === 0) delete whereAbRaw.AND

    const whereAbFinal = whereAbRaw

    const whereSl: any = { AND: [] as any[] }
    if (range) whereSl.AND.push({ date: { gte: range.startUtc, lt: range.endExclusiveUtc } })
    if (kendaraanPlatNomor) whereSl.AND.push({ kendaraanPlat: { equals: kendaraanPlatNomor, mode: 'insensitive' } })
    if (search) {
      whereSl.AND.push({
        OR: [
          { description: { contains: search, mode: 'insensitive' } },
          { kendaraanPlat: { contains: search, mode: 'insensitive' } },
        ],
      })
    }
    if (whereSl.AND.length === 0) delete whereSl.AND

    const whereRd: any = { AND: [] as any[] }
    if (range) whereRd.AND.push({ tanggalBayar: { gte: range.startUtc, lt: range.endExclusiveUtc } })
    if (kendaraanPlatNomor) whereRd.AND.push({ kendaraanPlat: { equals: kendaraanPlatNomor, mode: 'insensitive' } })
    if (search) {
      whereRd.AND.push({
        OR: [
          { jenis: { contains: search, mode: 'insensitive' } },
          { keterangan: { contains: search, mode: 'insensitive' } },
          { kendaraanPlat: { contains: search, mode: 'insensitive' } },
        ],
      })
    }
    if (whereRd.AND.length === 0) delete whereRd.AND

    // For summary, we need to know if it's already paid. 
    // AbsensiHarian doesn't have gajianId directly in schema usually, 
    // it uses AbsensiGajiHarian join table.
    // Wait, let's check schema for AbsensiHarian.
    
    if (includeAbsensi) {
      tasks.push(
        prisma.absensiHarian.findMany({
          where: whereAbFinal,
          orderBy: [{ date: 'desc' }, { id: 'desc' }],
          take: takeN,
        }),
        prisma.absensiHarian.count({ where: whereAbFinal }),
      )
    } else {
      tasks.push(Promise.resolve([]), Promise.resolve(0))
    }

    if (includeServiceLog) {
      tasks.push(
        prisma.serviceLog.findMany({
          where: whereSl,
          include: { kendaraan: { select: { platNomor: true, merk: true } } },
          orderBy: [{ date: 'desc' }, { id: 'desc' }],
          take: takeN,
        }),
        prisma.serviceLog.count({ where: whereSl }),
        prisma.serviceLog.aggregate({ where: whereSl, _sum: { cost: true } }),
      )
    } else {
      tasks.push(Promise.resolve([]), Promise.resolve(0), Promise.resolve({ _sum: { cost: 0 } }))
    }

    if (includeRiwayatDokumen) {
      tasks.push(
        prisma.riwayatDokumen.findMany({
          where: whereRd,
          include: { kendaraan: { select: { platNomor: true, merk: true } } },
          orderBy: [{ tanggalBayar: 'desc' }, { id: 'desc' }],
          take: takeN,
        }),
        prisma.riwayatDokumen.count({ where: whereRd }),
        prisma.riwayatDokumen.aggregate({ where: whereRd, _sum: { biaya: true } }),
      )
    } else {
      tasks.push(Promise.resolve([]), Promise.resolve(0), Promise.resolve({ _sum: { biaya: 0 } }))
    }

    if (includeNotaSawitIncome) {
      const andConditions: Prisma.NotaSawitWhereInput[] = []
      if (range) {
        andConditions.push({
          OR: [
            { tanggalBongkar: { gte: range.startUtc, lt: range.endExclusiveUtc } },
            { tanggalBongkar: null, createdAt: { gte: range.startUtc, lt: range.endExclusiveUtc } },
            { timbangan: { date: { gte: range.startUtc, lt: range.endExclusiveUtc } } },
          ],
        })
      }

      const entityOr: Prisma.NotaSawitWhereInput[] = []
      if (Number.isFinite(kebunId) && kebunId > 0) {
        entityOr.push({ timbangan: { kebunId: kebunId } })
        entityOr.push({ timbanganId: null, kebunId: kebunId })
      } else if (scope === 'KEBUN' && !kendaraanPlatNomor && !(Number.isFinite(perusahaanIdParam) && perusahaanIdParam > 0)) {
        entityOr.push({ kebunId: { not: null } })
        entityOr.push({ timbanganId: { not: null } })
      }
      if (kendaraanPlatNomor) {
        entityOr.push({ kendaraanPlatNomor: kendaraanPlatNomor })
      }
      if (Number.isFinite(perusahaanIdParam) && perusahaanIdParam > 0) {
        entityOr.push({ perusahaanId: perusahaanIdParam })
        entityOr.push({ pabrikSawit: { perusahaanId: perusahaanIdParam } })
      }
      if (entityOr.length > 0) andConditions.push({ OR: entityOr })

      const whereNota: Prisma.NotaSawitWhereInput = {
        deletedAt: null,
        ...(andConditions.length > 0 ? { AND: andConditions } : {}),
      }

      tasks.push(
        prisma.notaSawit.findMany({
          where: whereNota,
          select: {
            id: true,
            statusPembayaran: true,
            tanggalBongkar: true,
            createdAt: true,
            kendaraanPlatNomor: true,
            pembayaranAktual: true,
            pembayaranSetelahPph: true,
            totalPembayaran: true,
            kebun: { select: { id: true, name: true } },
            timbangan: { select: { id: true, date: true, kebun: { select: { id: true, name: true } } } },
          },
        })
      )
    } else {
      tasks.push(Promise.resolve([]))
    }

    const [
      kasRows,
      kasCount,
      kasPengeluaranAgg,
      kasPemasukanAgg,
      ujRows,
      ujCount,
      ujPengeluaranAgg,
      ujPemasukanAgg,
      pbRows,
      pbCount,
      pbPengeluaranAgg,
      pbPemasukanAgg,
      pkRows,
      pkCount,
      pkAgg,
      abRows,
      abCount,
      slRows,
      slCount,
      slAgg,
      rdRows,
      rdCount,
      rdAgg,
      notaSawitRows,
    ] = await Promise.all(tasks)

    const perusahaanIds = Array.from(
      new Set(
        [
          ...(kasRows as any[]).map((r) => extractPerusahaanIdFromKeterangan(r.keterangan)),
          ...(ujRows as any[]).map((r: any) => {
            const tag = extractTagId(String(r?.description || ''), 'PERUSAHAAN')
            const n = tag ? Number(tag) : 0
            return Number.isFinite(n) && n > 0 ? n : null
          }),
        ].filter((n): n is number => Number.isFinite(n || 0) && (n || 0) > 0),
      ),
    )
    const perusahaanMap = new Map<number, string>()
    if (perusahaanIds.length > 0) {
      const ps = await prisma.perusahaan.findMany({ where: { id: { in: perusahaanIds } }, select: { id: true, name: true } })
      ps.forEach((p) => perusahaanMap.set(p.id, p.name))
    }

    const kebunIds = Array.from(
      new Set(
        (ujRows as any[])
          .map((r: any) => {
            const tag = extractTagId(String(r?.description || ''), 'KEBUN')
            const n = tag ? Number(tag) : 0
            return Number.isFinite(n) && n > 0 ? n : null
          })
          .filter((n): n is number => Number.isFinite(n || 0) && (n || 0) > 0),
      ),
    )
    const kebunMap = new Map<number, string>()
    if (kebunIds.length > 0) {
      const ks = await prisma.kebun.findMany({ where: { id: { in: kebunIds } }, select: { id: true, name: true } })
      ks.forEach((k) => kebunMap.set(k.id, k.name))
    }

    const karyawanIds = Array.from(
      new Set(
        (ujRows as any[])
          .map((r: any) => {
            const tag = extractTagId(String(r?.description || ''), 'KARYAWAN')
            const n = tag ? Number(tag) : 0
            return Number.isFinite(n) && n > 0 ? n : null
          })
          .filter((n): n is number => Number.isFinite(n || 0) && (n || 0) > 0),
      ),
    )
    const karyawanMap = new Map<number, string>()
    if (karyawanIds.length > 0) {
      const us = await prisma.user.findMany({ where: { id: { in: karyawanIds } }, select: { id: true, name: true } })
      us.forEach((u) => karyawanMap.set(u.id, u.name))
    }

    const abKebunIds = Array.from(new Set((abRows as any[]).map((r: any) => Number(r?.kebunId)).filter((n: number) => Number.isFinite(n) && n > 0)))
    const abKaryawanIds = Array.from(new Set((abRows as any[]).map((r: any) => Number(r?.karyawanId)).filter((n: number) => Number.isFinite(n) && n > 0)))
    if (abKebunIds.length > 0) {
      const ks = await prisma.kebun.findMany({ where: { id: { in: abKebunIds } }, select: { id: true, name: true } })
      ks.forEach((k) => kebunMap.set(k.id, k.name))
    }
    if (abKaryawanIds.length > 0) {
      const us = await prisma.user.findMany({ where: { id: { in: abKaryawanIds } }, select: { id: true, name: true } })
      us.forEach((u) => karyawanMap.set(u.id, u.name))
    }

    const paidKeys = new Set<string>()
    if (includeAbsensi && range) {
      try {
        const start = toDateOnlyUtc(range.startYmd)
        const end = toDateOnlyUtc(range.endYmd)
        const paid = await prisma.absensiGajiHarian.findMany({
          where: {
            kebunId: Number.isFinite(kebunId) && kebunId > 0 ? kebunId : undefined,
            karyawanId: Number.isFinite(karyawanId) && karyawanId > 0 ? karyawanId : undefined,
            gajianId: { not: null },
            date: { gte: start, lte: end },
          } as any,
          select: { kebunId: true, karyawanId: true, date: true },
        })
        paid.forEach((r: any) => {
          const dt = new Date(r.date)
          const y = dt.getUTCFullYear()
          const m = String(dt.getUTCMonth() + 1).padStart(2, '0')
          const d = String(dt.getUTCDate()).padStart(2, '0')
          paidKeys.add(`${Number(r.kebunId)}:${Number(r.karyawanId)}:${y}-${m}-${d}`)
        })
      } catch {}
    }

    const normalizedKas = (kasRows as any[]).map((r: any) => {
      const perusahaanId = extractPerusahaanIdFromKeterangan(r.keterangan)
      return {
        key: `KAS:${r.id}`,
        source: 'KAS',
        id: r.id,
        date: r.date,
        tipe: r.tipe,
        kategori: r.kategori || 'UMUM',
        deskripsi: r.deskripsi || '',
        keterangan: r.keterangan || null,
        jumlah: Number(r.jumlah || 0),
        gambarUrl: r.gambarUrl || null,
        scope: detectScope(r),
        kebun: r.kebun ? { id: r.kebun.id, name: r.kebun.name } : null,
        karyawan: r.karyawan ? { id: r.karyawan.id, name: r.karyawan.name } : null,
        kendaraan: r.kendaraan ? { platNomor: r.kendaraan.platNomor, merk: r.kendaraan.merk } : null,
        perusahaan: perusahaanId ? { id: perusahaanId, name: perusahaanMap.get(perusahaanId) || `Perusahaan #${perusahaanId}` } : null,
        createdBy: r.user ? { name: r.user.name, role: r.user.role } : null,
      }
    })

    const normalizedUj = (ujRows as any[]).map((r: any) => {
      const desc = String(r.description || '')
      const perusahaanTag = extractTagId(desc, 'PERUSAHAAN')
      const perusahaanId = perusahaanTag ? Number(perusahaanTag) : null
      const kebunTag = extractTagId(desc, 'KEBUN')
      const kebunIdTag = kebunTag ? Number(kebunTag) : null
      const karyawanTag = extractTagId(desc, 'KARYAWAN')
      const karyawanIdTag = karyawanTag ? Number(karyawanTag) : null
      const kendaraanTag = extractTagId(desc, 'KENDARAAN')
      const plat = r?.sesiUangJalan?.kendaraan?.platNomor || r?.sesiUangJalan?.kendaraanPlatNomor || kendaraanTag || null
      return {
        key: `UANG_JALAN:${r.id}`,
        source: 'UANG_JALAN',
        id: r.id,
        date: r.date,
        tipe: String(r.tipe || '').toUpperCase(),
        kategori: 'UANG_JALAN',
        deskripsi: stripUangJalanTags(desc) || 'Uang Jalan',
        keterangan: desc || null,
        jumlah: Number(r.amount || 0),
        gambarUrl: r.gambarUrl || null,
        scope: detectScopeUangJalan(desc, r?.sesiUangJalan),
        kebun: kebunIdTag ? { id: kebunIdTag, name: kebunMap.get(kebunIdTag) || `Kebun #${kebunIdTag}` } : null,
        karyawan: karyawanIdTag ? { id: karyawanIdTag, name: karyawanMap.get(karyawanIdTag) || `Karyawan #${karyawanIdTag}` } : null,
        kendaraan: plat ? { platNomor: String(plat), merk: r?.sesiUangJalan?.kendaraan?.merk || '' } : null,
        perusahaan: perusahaanId ? { id: perusahaanId, name: perusahaanMap.get(perusahaanId) || `Perusahaan #${perusahaanId}` } : null,
      }
    })

    const normalizedPb = (pbRows as any[]).map((r: any) => {
      return {
        key: `PERUSAHAAN_BIAYA:${r.id}`,
        source: 'PERUSAHAAN_BIAYA',
        id: r.id,
        date: r.date,
        tipe: String(r.type || '').toUpperCase(),
        kategori: r.kategori || 'UMUM',
        deskripsi: r.deskripsi || 'Biaya Perusahaan',
        keterangan: null,
        jumlah: Number(r.jumlah || 0),
        gambarUrl: r.gambarUrl || null,
        scope: 'PERUSAHAAN',
        kebun: null,
        karyawan: null,
        kendaraan: null,
        perusahaan: r.perusahaan ? { id: r.perusahaan.id, name: r.perusahaan.name } : null,
      }
    })

    const normalizedPk = (pkRows as any[]).map((r: any) => {
      const total = Number(r.biaya || 0)
      return {
        key: `BORONGAN:${r.id}`,
        source: 'BORONGAN',
        id: r.id,
        date: r.date,
        tipe: 'PENGELUARAN',
        kategori: 'BORONGAN',
        deskripsi: String(r.kategoriBorongan || r.jenisPekerjaan || 'Borongan'),
        keterangan: r.keterangan || null,
        jumlah: Number.isFinite(total) ? total : 0,
        gambarUrl: r.imageUrl || null,
        scope: detectScopePekerjaan(r),
        kebun: r.kebun ? { id: r.kebun.id, name: r.kebun.name } : null,
        karyawan: r.user ? { id: r.user.id, name: r.user.name } : null,
        kendaraan: r.kendaraan ? { platNomor: r.kendaraan.platNomor, merk: r.kendaraan.merk } : null,
        perusahaan: null,
        isPaid: r.gajianId != null,
      }
    })

    const normalizedAb = (abRows as any[])
      .map((r: any) => {
        const dt = new Date(r.date)
        const y = dt.getUTCFullYear()
        const m = String(dt.getUTCMonth() + 1).padStart(2, '0')
        const d = String(dt.getUTCDate()).padStart(2, '0')
        const key = `${Number(r.kebunId)}:${Number(r.karyawanId)}:${y}-${m}-${d}`
        const isPaid = paidKeys.has(key)

        const jumlah = decimalToNumber(r.jumlah)
        const uangMakan = decimalToNumber(r.uangMakan)
        const total = Math.round(jumlah + uangMakan)
        const note = String(r.note || '').trim()
        const src = String(r.source || '').trim()
        const ymd = `${y}-${m}-${d}`

        return {
          key: `ABSENSI:${r.id}`,
          source: 'ABSENSI',
          id: r.id,
          date: r.date,
          tipe: 'PENGELUARAN',
          kategori: 'ABSENSI',
          deskripsi: note ? `Absensi: ${note}` : src ? `Absensi (${src})` : 'Absensi Harian',
          keterangan: `Tanggal ${ymd}`,
          jumlah: Number.isFinite(total) ? total : 0,
          gambarUrl: null,
          scope: 'KARYAWAN',
          kebun: r.kebunId ? { id: Number(r.kebunId), name: kebunMap.get(Number(r.kebunId)) || `Kebun #${Number(r.kebunId)}` } : null,
          karyawan: r.karyawanId ? { id: Number(r.karyawanId), name: karyawanMap.get(Number(r.karyawanId)) || `Karyawan #${Number(r.karyawanId)}` } : null,
          kendaraan: null,
          perusahaan: null,
          isPaid: isPaid,
        }
      })

    const normalizedSl = (slRows as any[]).map((r: any) => ({
      key: `SERVIS:${r.id}`,
      source: 'SERVIS',
      id: r.id,
      date: r.date,
      tipe: 'PENGELUARAN',
      kategori: 'SERVIS',
      deskripsi: r.description || 'Servis Kendaraan',
      keterangan: r.odometer ? `Odometer: ${r.odometer}` : null,
      jumlah: Number(r.cost || 0),
      gambarUrl: r.fotoUrl || null,
      scope: 'KENDARAAN',
      kebun: null,
      karyawan: null,
      kendaraan: r.kendaraan ? { platNomor: r.kendaraan.platNomor, merk: r.kendaraan.merk } : null,
      perusahaan: null,
      isPaid: false,
    }))

    const normalizedRd = (rdRows as any[]).map((r: any) => ({
      key: `DOKUMEN:${r.id}`,
      source: 'DOKUMEN',
      id: r.id,
      date: r.tanggalBayar,
      tipe: 'PENGELUARAN',
      kategori: 'PAJAK_STNK',
      deskripsi: r.jenis || 'Pengurusan Dokumen',
      keterangan: r.keterangan || null,
      jumlah: Number(r.biaya || 0),
      gambarUrl: r.fotoUrl || null,
      scope: 'KENDARAAN',
      kebun: null,
      karyawan: null,
      kendaraan: r.kendaraan ? { platNomor: r.kendaraan.platNomor, merk: r.kendaraan.merk } : null,
      perusahaan: null,
      isPaid: false,
    }))

    const normalizedNota = (notaSawitRows as any[])
      .map((n: any) => {
        const aktual = Number(n?.pembayaranAktual || 0)
        const setelahPph = Number(n?.pembayaranSetelahPph || 0)
        const total = Number(n?.totalPembayaran || 0)
        const netRp = aktual > 0 ? aktual : setelahPph > 0 ? setelahPph : total
        const kebun = n?.kebun || n?.timbangan?.kebun || null
        const date = n?.tanggalBongkar || n?.timbangan?.date || n?.createdAt
        const plat = String(n?.kendaraanPlatNomor || '').trim()
        return {
          key: `NOTA_SAWIT:${n.id}`,
          source: 'NOTA_SAWIT',
          id: n.id,
          date,
          tipe: 'PEMASUKAN',
          kategori: 'NOTA_SAWIT',
          deskripsi: `Nota Sawit #${n.id}`,
          keterangan: plat ? `Plat: ${plat}` : null,
          jumlah: netRp,
          gambarUrl: null,
          scope: kebun ? 'KEBUN' : plat ? 'KENDARAAN' : 'ALL',
          kebun: kebun ? { id: Number(kebun.id), name: String(kebun.name) } : null,
          karyawan: null,
          kendaraan: plat ? { platNomor: plat, merk: '-' } : null,
          perusahaan: null,
          isPaid: String(n?.statusPembayaran || '').toUpperCase() === 'LUNAS',
        }
      })
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, takeN)

    const merged = [
      ...normalizedKas,
      ...normalizedUj,
      ...normalizedPb,
      ...normalizedPk,
      ...normalizedAb,
      ...normalizedSl,
      ...normalizedRd,
      ...normalizedNota,
    ].sort((a: any, b: any) => {
      const da = new Date(a.date).getTime()
      const db = new Date(b.date).getTime()
      if (db !== da) return db - da
      const sa = String(a.source || '')
      const sb = String(b.source || '')
      if (sa !== sb) return sa.localeCompare(sb)
      return Number(b.id) - Number(a.id)
    })

    const total =
      Number(kasCount || 0) +
      Number(ujCount || 0) +
      Number(pbCount || 0) +
      Number(pkCount || 0) +
      Number(abCount || 0) +
      Number(slCount || 0) +
      Number(rdCount || 0) +
      Number((notaSawitRows as any[])?.length || 0)
    const totalPages = Math.max(1, Math.ceil(total / limit))
    const pageData = merged.slice((page - 1) * limit, (page - 1) * limit + limit)

    const notaIncome = (notaSawitRows as any[]).reduce((acc: number, n: any) => {
      const aktual = Number(n?.pembayaranAktual || 0)
      const setelahPph = Number(n?.pembayaranSetelahPph || 0)
      const total = Number(n?.totalPembayaran || 0)
      const netRp = aktual > 0 ? aktual : setelahPph > 0 ? setelahPph : total
      return acc + netRp
    }, 0)
    const pemasukanRaw =
      Number(kasPemasukanAgg?._sum?.jumlah || 0) + Number(ujPemasukanAgg?._sum?.amount || 0) + Number(pbPemasukanAgg?._sum?.jumlah || 0) + notaIncome
    const pengeluaranRaw =
      Number(kasPengeluaranAgg?._sum?.jumlah || 0) +
      Number(ujPengeluaranAgg?._sum?.amount || 0) +
      Number(pbPengeluaranAgg?._sum?.jumlah || 0) +
      Number(pkAgg?._sum?.biaya || 0) +
      Number(slAgg?._sum?.cost || 0) +
      Number(rdAgg?._sum?.biaya || 0) +
      normalizedAb.reduce((sum: number, r: any) => sum + Number(r?.jumlah || 0), 0)

    const pemasukan = incomeOnly ? pemasukanRaw : expenseOnly ? 0 : pemasukanRaw
    const pengeluaran = expenseOnly ? pengeluaranRaw : incomeOnly ? 0 : pengeluaranRaw

    // Breakdown calculation for KPIs
    const breakdown: Record<string, number> = expenseOnly || incomeOnly ? {} : {
      GAJI: 0,
      ABSENSI: normalizedAb.reduce((sum: number, r: any) => sum + Number(r?.jumlah || 0), 0),
      UANG_JALAN: Number(ujPengeluaranAgg?._sum?.amount || 0),
      PERUSAHAAN: Number(pbPengeluaranAgg?._sum?.jumlah || 0),
      SERVIS: Number(slAgg?._sum?.cost || 0),
      PAJAK_STNK: Number(rdAgg?._sum?.biaya || 0),
      OPERASIONAL: 0,
    }

    // 1. Process detailed Borongan breakdown by category
    if (!(expenseOnly || incomeOnly)) {
      const boronganRows = await prisma.pekerjaanKebun.findMany({
        where: wherePkSummary,
        select: {
          biaya: true,
          jenisPekerjaan: true,
          kategoriBorongan: true,
        } as any,
      })

      boronganRows.forEach((b: any) => {
        const catName = (b.kategoriBorongan || b.jenisPekerjaan || 'BORONGAN_LAIN').toUpperCase()
        const key = `BORONGAN: ${catName}`
        if (breakdown[key] === undefined) breakdown[key] = 0
        breakdown[key] += Number(b.biaya || 0)
      })
    }

    const incomeBreakdown: Record<string, number> = expenseOnly || incomeOnly ? {} : {
      NOTA_SAWIT: notaIncome,
      LAINNYA: Number(ujPemasukanAgg?._sum?.amount || 0) + Number(pbPemasukanAgg?._sum?.jumlah || 0),
    }

    // Process KasTransaksi categories for breakdown
    const kasRowsAgg = await prisma.kasTransaksi.findMany({
      where: {
        ...whereKas,
        NOT: {
          kategori: {
            equals: 'GAJI',
            mode: 'insensitive',
          },
        },
      },
      select: {
        kategori: true,
        tipe: true,
        jumlah: true,
      },
    })

    if (!(expenseOnly || incomeOnly)) kasRowsAgg.forEach(b => {
      const cat = (b.kategori || 'OPERASIONAL').toUpperCase()
      const catKey = cat.replace(/\s+/g, '_')
      if (catKey === 'PENJUALAN_SAWIT') return
      const val = Number(b.jumlah || 0)
      if (b.tipe === 'PENGELUARAN') {
        if (breakdown[cat] !== undefined) {
          breakdown[cat] += val
        } else {
          if (breakdown[cat] === undefined) breakdown[cat] = 0
          breakdown[cat] += val
        }
      } else if (b.tipe === 'PEMASUKAN') {
        if (cat === 'NOTA_SAWIT') incomeBreakdown.NOTA_SAWIT += val
        else {
          if (incomeBreakdown[cat] === undefined) incomeBreakdown[cat] = 0
          incomeBreakdown[cat] += val
        }
      }
    })

    let entityStats: any = null
    if (includeEntityStats && !(incomeOnly || expenseOnly)) {
      if (scope === 'KEBUN' && !(Number.isFinite(kebunId) && kebunId > 0)) {
        const kebuns = await prisma.kebun.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } })
        const timbanganRows = await prisma.timbangan.findMany({ select: { id: true, kebunId: true } })
        const timbanganById = new Map<number, number>()
        for (const t of timbanganRows) timbanganById.set(t.id, t.kebunId)

        const notaRows = await prisma.notaSawit.findMany({
          where: {
            deletedAt: null,
            ...(range
              ? {
                  OR: [
                    { tanggalBongkar: { gte: range.startUtc, lt: range.endExclusiveUtc } },
                    { tanggalBongkar: null, createdAt: { gte: range.startUtc, lt: range.endExclusiveUtc } },
                    { timbangan: { date: { gte: range.startUtc, lt: range.endExclusiveUtc } } },
                  ],
                }
              : {}),
          },
          select: { kebunId: true, timbanganId: true, pembayaranAktual: true, pembayaranSetelahPph: true, totalPembayaran: true },
        })

        const notaByKebun = new Map<number, number>()
        for (const n of notaRows as any[]) {
          const kid = (n.kebunId ?? (n.timbanganId ? timbanganById.get(n.timbanganId) : undefined)) as number | undefined
          if (!kid) continue
          const aktual = Number(n?.pembayaranAktual || 0)
          const setelahPph = Number(n?.pembayaranSetelahPph || 0)
          const total = Number(n?.totalPembayaran || 0)
          const netRp = aktual > 0 ? aktual : setelahPph > 0 ? setelahPph : total
          notaByKebun.set(kid, (notaByKebun.get(kid) || 0) + netRp)
        }

        const kasIncomeRows = await prisma.kasTransaksi.findMany({
          where: {
            deletedAt: null,
            tipe: 'PEMASUKAN',
            kebunId: { not: null },
            date: range ? { gte: range.startUtc, lt: range.endExclusiveUtc } : undefined,
            user: { role: 'PEMILIK' },
          },
          select: { kebunId: true, jumlah: true },
        })

        const kasIncomeByKebun = new Map<number, number>()
        for (const r of kasIncomeRows) {
          const kid = r.kebunId as number | null
          if (!kid) continue
          kasIncomeByKebun.set(kid, (kasIncomeByKebun.get(kid) || 0) + Number(r.jumlah || 0))
        }

        const kasExpenseAggByKebun = await prisma.kasTransaksi.groupBy({
          by: ['kebunId'],
          where: {
            deletedAt: null,
            tipe: 'PENGELUARAN',
            kebunId: { not: null },
            date: range ? { gte: range.startUtc, lt: range.endExclusiveUtc } : undefined,
            NOT: { kategori: { equals: 'GAJI', mode: 'insensitive' } },
          },
          _sum: { jumlah: true },
        })

        const kasExpenseByKebun = new Map<number, number>()
        for (const g of kasExpenseAggByKebun) {
          const kid = g.kebunId as number | null
          if (!kid) continue
          kasExpenseByKebun.set(kid, Number(g._sum.jumlah || 0))
        }

        const boronganAggByKebun = includeBorongan
          ? await prisma.pekerjaanKebun.groupBy({
              by: ['kebunId'],
              where: {
                date: range ? { gte: range.startUtc, lt: range.endExclusiveUtc } : undefined,
                upahBorongan: true,
                biaya: { gt: 0 },
              } as any,
              _sum: { biaya: true },
            })
          : []

        const boronganByKebun = new Map<number, number>()
        for (const g of boronganAggByKebun as any[]) {
          const kid = g.kebunId as number | null
          if (!kid) continue
          boronganByKebun.set(kid, Number(g._sum.biaya || 0))
        }

        const absensiByKebun = new Map<number, number>()
        if (includeAbsensi && range) {
          const start = toDateOnlyUtc(range.startYmd)
          const end = toDateOnlyUtc(range.endYmd)

          const absensiRows = await prisma.absensiHarian.findMany({
            where: {
              date: { gte: start, lte: end },
              OR: [{ jumlah: { gt: 0 } }, { uangMakan: { gt: 0 } }],
            },
            select: { kebunId: true, karyawanId: true, date: true, jumlah: true, uangMakan: true },
          })

          for (const a of absensiRows) {
            absensiByKebun.set(
              a.kebunId,
              (absensiByKebun.get(a.kebunId) || 0) + Number(a.jumlah || 0) + Number(a.uangMakan || 0)
            )
          }
        }

        const rows = kebuns.map(k => {
          const pemasukanVal = (notaByKebun.get(k.id) || 0) + (kasIncomeByKebun.get(k.id) || 0)
          const pengeluaranVal =
            (kasExpenseByKebun.get(k.id) || 0) + (boronganByKebun.get(k.id) || 0) + (absensiByKebun.get(k.id) || 0)
          const saldoVal = pemasukanVal - pengeluaranVal
          const profitMarginVal = pemasukanVal > 0 ? (saldoVal / pemasukanVal) * 100 : 0
          const costRatioVal = pemasukanVal > 0 ? (pengeluaranVal / pemasukanVal) * 100 : 0
          return {
            key: k.id,
            name: k.name,
            pemasukan: pemasukanVal,
            pengeluaran: pengeluaranVal,
            saldo: saldoVal,
            profitMargin: profitMarginVal,
            costRatio: costRatioVal,
          }
        })

        rows.sort((a, b) => (b.pengeluaran || 0) - (a.pengeluaran || 0))
        entityStats = { type: 'kebun', rows }
      } else if (scope === 'PERUSAHAAN' && !(Number.isFinite(perusahaanIdParam) && perusahaanIdParam > 0)) {
        const perusahaanRows = await prisma.perusahaan.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } })

        const pabrikRows = await prisma.pabrikSawit.findMany({ select: { id: true, perusahaanId: true } })
        const pabrikToPerusahaan = new Map<number, number | null>()
        for (const p of pabrikRows) pabrikToPerusahaan.set(p.id, p.perusahaanId ?? null)

        const notaRows = await prisma.notaSawit.findMany({
          where: {
            deletedAt: null,
            ...(range
              ? {
                  OR: [
                    { tanggalBongkar: { gte: range.startUtc, lt: range.endExclusiveUtc } },
                    { tanggalBongkar: null, createdAt: { gte: range.startUtc, lt: range.endExclusiveUtc } },
                    { timbangan: { date: { gte: range.startUtc, lt: range.endExclusiveUtc } } },
                  ],
                }
              : {}),
          },
          select: { perusahaanId: true, pabrikSawitId: true, pembayaranAktual: true, pembayaranSetelahPph: true, totalPembayaran: true },
        })

        const notaByPerusahaan = new Map<number, number>()
        for (const n of notaRows as any[]) {
          const pid = (n.perusahaanId ?? pabrikToPerusahaan.get(n.pabrikSawitId) ?? null) as number | null
          if (!pid) continue
          const aktual = Number(n?.pembayaranAktual || 0)
          const setelahPph = Number(n?.pembayaranSetelahPph || 0)
          const total = Number(n?.totalPembayaran || 0)
          const netRp = aktual > 0 ? aktual : setelahPph > 0 ? setelahPph : total
          notaByPerusahaan.set(pid, (notaByPerusahaan.get(pid) || 0) + netRp)
        }

        const taggedKasIncome = await prisma.kasTransaksi.findMany({
          where: {
            deletedAt: null,
            tipe: 'PEMASUKAN',
            date: range ? { gte: range.startUtc, lt: range.endExclusiveUtc } : undefined,
            keterangan: { contains: '[PERUSAHAAN:', mode: 'insensitive' },
            user: { role: 'PEMILIK' },
          },
          select: { keterangan: true, jumlah: true },
        })

        const taggedKasExpense = await prisma.kasTransaksi.findMany({
          where: {
            deletedAt: null,
            tipe: 'PENGELUARAN',
            date: range ? { gte: range.startUtc, lt: range.endExclusiveUtc } : undefined,
            keterangan: { contains: '[PERUSAHAAN:', mode: 'insensitive' },
          },
          select: { keterangan: true, jumlah: true },
        })

        const kasIncomeByPerusahaan = new Map<number, number>()
        for (const r of taggedKasIncome) {
          const pid = extractPerusahaanIdFromKeterangan(String(r.keterangan || ''))
          if (!pid) continue
          kasIncomeByPerusahaan.set(pid, (kasIncomeByPerusahaan.get(pid) || 0) + Number(r.jumlah || 0))
        }

        const kasExpenseByPerusahaan = new Map<number, number>()
        for (const r of taggedKasExpense) {
          const pid = extractPerusahaanIdFromKeterangan(String(r.keterangan || ''))
          if (!pid) continue
          kasExpenseByPerusahaan.set(pid, (kasExpenseByPerusahaan.get(pid) || 0) + Number(r.jumlah || 0))
        }

        const pbExpenseAgg = await prisma.perusahaanBiaya.groupBy({
          by: ['perusahaanId'],
          where: {
            type: 'PENGELUARAN',
            date: range ? { gte: toDateOnlyUtc(range.startYmd), lte: toDateOnlyUtc(range.endYmd) } : undefined,
          },
          _sum: { jumlah: true },
        })

        const pbExpenseByPerusahaan = new Map<number, number>()
        for (const g of pbExpenseAgg) {
          pbExpenseByPerusahaan.set(g.perusahaanId, Number(g._sum.jumlah || 0))
        }

        const rows = perusahaanRows.map(p => {
          const pemasukanVal = (notaByPerusahaan.get(p.id) || 0) + (kasIncomeByPerusahaan.get(p.id) || 0)
          const pengeluaranVal = (pbExpenseByPerusahaan.get(p.id) || 0) + (kasExpenseByPerusahaan.get(p.id) || 0)
          const saldoVal = pemasukanVal - pengeluaranVal
          const profitMarginVal = pemasukanVal > 0 ? (saldoVal / pemasukanVal) * 100 : 0
          const costRatioVal = pemasukanVal > 0 ? (pengeluaranVal / pemasukanVal) * 100 : 0
          return {
            key: p.id,
            name: p.name,
            pemasukan: pemasukanVal,
            pengeluaran: pengeluaranVal,
            saldo: saldoVal,
            profitMargin: profitMarginVal,
            costRatio: costRatioVal,
          }
        })

        rows.sort((a, b) => (b.pengeluaran || 0) - (a.pengeluaran || 0))
        entityStats = { type: 'perusahaan', rows }
      } else if (scope === 'KENDARAAN' && !kendaraanPlatNomor) {
        const kendaraans = await prisma.kendaraan.findMany({
          select: { platNomor: true, merk: true },
          orderBy: [{ platNomor: 'asc' }],
        })

        const notaRows = await prisma.notaSawit.findMany({
          where: {
            deletedAt: null,
            kendaraanPlatNomor: { not: null },
            ...(range
              ? {
                  OR: [
                    { tanggalBongkar: { gte: range.startUtc, lt: range.endExclusiveUtc } },
                    { tanggalBongkar: null, createdAt: { gte: range.startUtc, lt: range.endExclusiveUtc } },
                    { timbangan: { date: { gte: range.startUtc, lt: range.endExclusiveUtc } } },
                  ],
                }
              : {}),
          },
          select: { kendaraanPlatNomor: true, pembayaranAktual: true, pembayaranSetelahPph: true, totalPembayaran: true },
        })

        const notaByPlat = new Map<string, number>()
        for (const n of notaRows as any[]) {
          const plat = String(n.kendaraanPlatNomor || '').trim()
          if (!plat) continue
          const aktual = Number(n?.pembayaranAktual || 0)
          const setelahPph = Number(n?.pembayaranSetelahPph || 0)
          const total = Number(n?.totalPembayaran || 0)
          const netRp = aktual > 0 ? aktual : setelahPph > 0 ? setelahPph : total
          notaByPlat.set(plat, (notaByPlat.get(plat) || 0) + netRp)
        }

        const kasIncomeRows = await prisma.kasTransaksi.findMany({
          where: {
            deletedAt: null,
            tipe: 'PEMASUKAN',
            kendaraanPlatNomor: { not: null },
            date: range ? { gte: range.startUtc, lt: range.endExclusiveUtc } : undefined,
            user: { role: 'PEMILIK' },
          },
          select: { kendaraanPlatNomor: true, jumlah: true },
        })

        const kasIncomeByPlat = new Map<string, number>()
        for (const r of kasIncomeRows) {
          const plat = String(r.kendaraanPlatNomor || '').trim()
          if (!plat) continue
          kasIncomeByPlat.set(plat, (kasIncomeByPlat.get(plat) || 0) + Number(r.jumlah || 0))
        }

        const kasExpenseAggByPlat = await prisma.kasTransaksi.groupBy({
          by: ['kendaraanPlatNomor'],
          where: {
            deletedAt: null,
            tipe: 'PENGELUARAN',
            kendaraanPlatNomor: { not: null },
            date: range ? { gte: range.startUtc, lt: range.endExclusiveUtc } : undefined,
            NOT: { kategori: { equals: 'GAJI', mode: 'insensitive' } },
          },
          _sum: { jumlah: true },
        })

        const kasExpenseByPlat = new Map<string, number>()
        for (const g of kasExpenseAggByPlat) {
          const plat = String(g.kendaraanPlatNomor || '').trim()
          if (!plat) continue
          kasExpenseByPlat.set(plat, Number(g._sum.jumlah || 0))
        }

        const slAggByPlat = await prisma.serviceLog.groupBy({
          by: ['kendaraanPlat'],
          where: {
            date: range ? { gte: range.startUtc, lt: range.endExclusiveUtc } : undefined,
            kendaraanPlat: { not: '' },
          } as any,
          _sum: { cost: true },
        })

        const slByPlat = new Map<string, number>()
        for (const g of slAggByPlat as any[]) {
          const plat = String(g.kendaraanPlat || '').trim()
          if (!plat) continue
          slByPlat.set(plat, Number(g._sum.cost || 0))
        }

        const rdAggByPlat = await prisma.riwayatDokumen.groupBy({
          by: ['kendaraanPlat'],
          where: {
            tanggalBayar: range ? { gte: range.startUtc, lt: range.endExclusiveUtc } : undefined,
            kendaraanPlat: { not: '' },
          } as any,
          _sum: { biaya: true },
        })

        const rdByPlat = new Map<string, number>()
        for (const g of rdAggByPlat as any[]) {
          const plat = String(g.kendaraanPlat || '').trim()
          if (!plat) continue
          rdByPlat.set(plat, Number(g._sum.biaya || 0))
        }

        const ujRowsForKendaraan = await prisma.uangJalan.findMany({
          where: {
            deletedAt: null,
            date: range ? { gte: range.startUtc, lt: range.endExclusiveUtc } : undefined,
            tipe: { equals: 'PENGELUARAN', mode: 'insensitive' },
          },
          select: { amount: true, sesiUangJalan: { select: { kendaraanPlatNomor: true } } } as any,
        })

        const ujByPlat = new Map<string, number>()
        for (const u of ujRowsForKendaraan as any[]) {
          const plat = String(u.sesiUangJalan?.kendaraanPlatNomor || '').trim()
          if (!plat) continue
          ujByPlat.set(plat, (ujByPlat.get(plat) || 0) + Number(u.amount || 0))
        }

        const rows = kendaraans.map(k => {
          const plat = String(k.platNomor || '').trim()
          const pemasukanVal = (notaByPlat.get(plat) || 0) + (kasIncomeByPlat.get(plat) || 0)
          const pengeluaranVal =
            (kasExpenseByPlat.get(plat) || 0) + (slByPlat.get(plat) || 0) + (rdByPlat.get(plat) || 0) + (ujByPlat.get(plat) || 0)
          const saldoVal = pemasukanVal - pengeluaranVal
          const profitMarginVal = pemasukanVal > 0 ? (saldoVal / pemasukanVal) * 100 : 0
          const costRatioVal = pemasukanVal > 0 ? (pengeluaranVal / pemasukanVal) * 100 : 0
          return {
            key: plat,
            name: k.merk ? `${plat} (${k.merk})` : plat,
            pemasukan: pemasukanVal,
            pengeluaran: pengeluaranVal,
            saldo: saldoVal,
            profitMargin: profitMarginVal,
            costRatio: costRatioVal,
          }
        })

        rows.sort((a, b) => (b.pengeluaran || 0) - (a.pengeluaran || 0))
        entityStats = { type: 'kendaraan', rows }
      }
    }

    return NextResponse.json({
      data: pageData,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      summary: {
        pemasukan,
        pengeluaran,
        saldo: pemasukan - pengeluaran,
        notaIncome,
        breakdown,
        incomeBreakdown,
      },
      entityStats,
    })
  } catch (error) {
    console.error('GET /api/ledger-biaya error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
