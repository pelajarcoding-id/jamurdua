import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { createAuditLog } from '@/lib/audit'
import { requireRole } from '@/lib/route-auth'
import { parseWibYmd, wibEndUtcInclusive, wibStartUtc } from '@/lib/wib'

function toDateKey(ymd: { y: number; m: number; d: number }) {
  return `${String(ymd.y).padStart(4, '0')}-${String(ymd.m).padStart(2, '0')}-${String(ymd.d).padStart(2, '0')}`
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR', 'MANAGER'])
    if (guard.response) return guard.response
    const perusahaanId = Number(params.id)
    if (!perusahaanId) return NextResponse.json({ error: 'perusahaanId tidak valid' }, { status: 400 })

    const { searchParams } = new URL(request.url)
    const startYmd = parseWibYmd(searchParams.get('startDate'))
    const endYmd = parseWibYmd(searchParams.get('endDate'))
    const startKey = startYmd ? toDateKey(startYmd) : null
    const endKey = endYmd ? toDateKey(endYmd) : null
    const type = (searchParams.get('type') || '').trim()
    const source = (searchParams.get('source') || '').trim().toUpperCase()
    const pageRaw = Number(searchParams.get('page') || 1)
    const limitRaw = Number(searchParams.get('limit') || searchParams.get('pageSize') || 20)
    const page = Number.isFinite(pageRaw) ? Math.max(1, pageRaw) : 1
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), 200) : 20

    if (source === 'LEDGER') {
      const startDate = startYmd ? wibStartUtc(startYmd) : null
      const endDate = endYmd ? wibEndUtcInclusive(endYmd) : null

      const tipe = type || 'PENGELUARAN'

      const manualFilters: any[] = [Prisma.sql`"perusahaanId" = ${perusahaanId}`]
      if (tipe) manualFilters.push(Prisma.sql`"type" = ${tipe}`)
      if (startKey) manualFilters.push(Prisma.sql`"date" >= ${startKey}::date`)
      if (endKey) manualFilters.push(Prisma.sql`"date" <= ${endKey}::date`)
      const manualWhereSql = Prisma.join(manualFilters, ' AND ')

      const [manual, kasirPerusahaan] = await Promise.all([
        prisma.$queryRaw(
          Prisma.sql`SELECT "id","date","type","kategori","deskripsi","jumlah","gambarUrl","source"
                     FROM "PerusahaanBiaya"
                     WHERE ${manualWhereSql}
                     ORDER BY "date" DESC, "id" DESC`
        ) as any,
        prisma.kasTransaksi.findMany({
          where: {
            deletedAt: null,
            tipe: tipe as any,
            keterangan: { contains: `[PERUSAHAAN:${perusahaanId}]` },
            ...(startDate || endDate
              ? {
                  date: {
                    ...(startDate ? { gte: startDate } : {}),
                    ...(endDate ? { lte: endDate } : {}),
                  },
                }
              : {}),
          } as any,
          select: {
            id: true,
            date: true,
            tipe: true,
            kategori: true,
            deskripsi: true,
            keterangan: true,
            jumlah: true,
            gambarUrl: true,
            kebunId: true,
            kendaraanPlatNomor: true,
            karyawanId: true,
          },
          orderBy: [{ date: 'desc' }, { id: 'desc' }],
        }),
      ])

      const cleanKet = (ket: string | null) => (ket || '').replace(/\[PERUSAHAAN:\d+\]/g, '').trim()

      const manualRows = (manual as any[]).map((r: any) => ({
        id: Number(r.id),
        perusahaanId,
        date: r.date,
        type: String(r.type || 'PENGELUARAN'),
        kategori: r.kategori || 'UMUM',
        deskripsi: r.deskripsi || null,
        keterangan: null as any,
        jumlah: Number(r.jumlah || 0),
        gambarUrl: r.gambarUrl || null,
        source: String(r.source || 'MANUAL').toUpperCase(),
        kasTransaksiId: null,
        kebunId: null,
        kendaraanPlatNomor: null,
        karyawanId: null,
      }))

      const kasirRows = (kasirPerusahaan as any[]).map((r: any) => {
        const ket = cleanKet(r.keterangan)
        const descParts = [r.deskripsi]
        if (ket) descParts.push(ket)
        return {
          id: r.id,
          perusahaanId,
          date: r.date,
          type: r.tipe,
          kategori: r.kategori || 'UMUM',
          deskripsi: descParts.filter(Boolean).join(' - '),
          keterangan: r.keterangan,
          jumlah: Number(r.jumlah || 0),
          gambarUrl: r.gambarUrl || null,
          source: 'KASIR',
          kasTransaksiId: r.id,
          kebunId: r.kebunId || null,
          kendaraanPlatNomor: r.kendaraanPlatNomor || null,
          karyawanId: r.karyawanId || null,
        }
      })

      const all = [...manualRows, ...kasirRows]
      all.sort((a, b) => {
        const da = new Date(a.date).getTime()
        const db = new Date(b.date).getTime()
        if (db !== da) return db - da
        const sa = String(a.source || '')
        const sb = String(b.source || '')
        if (sa !== sb) return sa.localeCompare(sb)
        return Number(b.id) - Number(a.id)
      })

      const totalItems = all.length
      const totalJumlah = all.reduce((acc, x) => acc + Number(x.jumlah || 0), 0)
      const totalPages = Math.max(1, Math.ceil(totalItems / limit))
      const data = all.slice((page - 1) * limit, (page - 1) * limit + limit)

      return NextResponse.json({
        data,
        meta: {
          page,
          pageSize: limit,
          totalItems,
          totalPages,
          totalJumlah,
        },
      })
    }

    if (source === 'KASIR') {
      const startDate = startYmd ? wibStartUtc(startYmd) : null
      const endDate = endYmd ? wibEndUtcInclusive(endYmd) : null

      const tipe = type || 'PENGELUARAN'
      const rows = await prisma.kasTransaksi.findMany({
        where: {
          deletedAt: null,
          tipe: tipe as any,
          keterangan: { contains: `[PERUSAHAAN:${perusahaanId}]` },
          ...(startDate || endDate
            ? {
                date: {
                  ...(startDate ? { gte: startDate } : {}),
                  ...(endDate ? { lte: endDate } : {}),
                },
              }
            : {}),
        } as any,
        select: {
          id: true,
          date: true,
          tipe: true,
          kategori: true,
          deskripsi: true,
          keterangan: true,
          jumlah: true,
          gambarUrl: true,
          kebunId: true,
          kendaraanPlatNomor: true,
          karyawanId: true,
        },
        orderBy: [{ date: 'desc' }, { id: 'desc' }],
      })

      const data = rows.map((r) => {
        return {
          id: r.id,
          perusahaanId,
          date: r.date,
          type: r.tipe,
          kategori: r.kategori || 'UMUM',
          deskripsi: r.deskripsi,
          keterangan: r.keterangan,
          jumlah: r.jumlah,
          gambarUrl: r.gambarUrl,
          source: 'KASIR',
          kasTransaksiId: r.id,
          kebunId: r.kebunId,
          kendaraanPlatNomor: r.kendaraanPlatNomor,
          karyawanId: r.karyawanId,
          createdAt: null,
          updatedAt: null,
        }
      })

      return NextResponse.json({ data })
    }

    const filters: any[] = [Prisma.sql`"perusahaanId" = ${perusahaanId}`]
    if (type) filters.push(Prisma.sql`"type" = ${type}`)
    if (startKey) filters.push(Prisma.sql`"date" >= ${startKey}::date`)
    if (endKey) filters.push(Prisma.sql`"date" <= ${endKey}::date`)

    const whereSql = Prisma.join(filters, ' AND ')

    const data = await prisma.$queryRaw(
      Prisma.sql`SELECT "id","perusahaanId","date","type","kategori","deskripsi","jumlah","gambarUrl","source","createdAt","updatedAt"
                 FROM "PerusahaanBiaya"
                 WHERE ${whereSql}
                 ORDER BY "date" DESC, "id" DESC`
    )
    return NextResponse.json({ data })
  } catch (error) {
    console.error('GET /api/perusahaan/[id]/biaya error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR', 'MANAGER'])
    if (guard.response) return guard.response
    const perusahaanId = Number(params.id)
    if (!perusahaanId) return NextResponse.json({ error: 'perusahaanId tidak valid' }, { status: 400 })

    const body = await request.json()
    const date = body?.date ? String(body.date) : ''
    const kategori = body?.kategori ? String(body.kategori) : 'UMUM'
    const deskripsi = body?.deskripsi ? String(body.deskripsi) : null
    const jumlah = Number(body?.jumlah || 0)
    const type = body?.type ? String(body.type) : 'PENGELUARAN'
    const gambarUrl = body?.gambarUrl ? String(body.gambarUrl) : null

    if (!date) return NextResponse.json({ error: 'Tanggal wajib diisi' }, { status: 400 })
    if (!kategori) return NextResponse.json({ error: 'Kategori wajib diisi' }, { status: 400 })
    if (!Number.isFinite(jumlah) || jumlah <= 0) return NextResponse.json({ error: 'Jumlah harus > 0' }, { status: 400 })

    const ymd = parseWibYmd(date)
    if (!ymd) return NextResponse.json({ error: 'Tanggal tidak valid' }, { status: 400 })
    const dateKey = toDateKey(ymd)

    const rows = await prisma.$queryRaw(
      Prisma.sql`INSERT INTO "PerusahaanBiaya" ("perusahaanId","date","type","kategori","deskripsi","jumlah","gambarUrl","source","createdAt","updatedAt")
                 VALUES (${perusahaanId}, ${dateKey}::date, ${type}, ${kategori}, ${deskripsi}, ${jumlah}, ${gambarUrl}, 'MANUAL', NOW(), NOW())
                 RETURNING "id","perusahaanId","date","type","kategori","deskripsi","jumlah","gambarUrl","source","createdAt","updatedAt"`
    ) as any
    const data = Array.isArray(rows) ? rows[0] : rows

    await createAuditLog(guard.id, 'CREATE', 'PerusahaanBiaya', String(data.id), {
      perusahaanId,
      date: dateKey,
      type,
      kategori,
      deskripsi,
      jumlah,
      gambarUrl,
      source: 'MANUAL',
    })

    return NextResponse.json({ data })
  } catch (error) {
    console.error('POST /api/perusahaan/[id]/biaya error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
