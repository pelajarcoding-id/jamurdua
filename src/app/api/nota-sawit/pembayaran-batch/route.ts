import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/route-auth'
import { createAuditLog } from '@/lib/audit'
import { parseWibYmd, wibStartUtc } from '@/lib/wib'
import { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

type AlokasiMetode = 'PROPORSIONAL' | 'RATA' | 'SATU_NOTA'

export async function GET(request: Request) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR'])
    if (guard.response) return guard.response

    const url = new URL(request.url)
    const pageParam = url.searchParams.get('page')
    const limitParam = url.searchParams.get('limit')
    const pabrikIdParam = url.searchParams.get('pabrikId')
    const kebunIdParam = url.searchParams.get('kebunId')
    const searchParam = url.searchParams.get('search')
    const startDateParam = url.searchParams.get('startDate')
    const endDateParam = url.searchParams.get('endDate')
    const sortParam = String(url.searchParams.get('sort') || 'tanggal').trim().toLowerCase()
    const page = Math.max(1, Number(pageParam || 1))
    const limit = Math.min(200, Math.max(1, Number(limitParam || 20)))
    const pabrikSawitId = pabrikIdParam ? Number(pabrikIdParam) : null
    const kebunId = kebunIdParam ? Number(kebunIdParam) : null
    const search = (searchParam || '').trim()
    const startDate = startDateParam ? new Date(startDateParam) : null
    const endDate = endDateParam ? new Date(endDateParam) : null

    const where: any = {
      ...(pabrikSawitId && Number.isFinite(pabrikSawitId) ? { pabrikSawitId } : {}),
    }
    if (kebunId && Number.isFinite(kebunId)) {
      where.items = {
        some: {
          notaSawit: {
            OR: [{ kebunId }, { timbangan: { kebunId } }],
          },
        },
      }
    }
    if (startDate && Number.isFinite(startDate.getTime()) && endDate && Number.isFinite(endDate.getTime())) {
      where.tanggal = { gte: startDate, lte: endDate }
    } else if (startDate && Number.isFinite(startDate.getTime())) {
      where.tanggal = { gte: startDate }
    } else if (endDate && Number.isFinite(endDate.getTime())) {
      where.tanggal = { lte: endDate }
    }
    if (search) {
      const tokens = search.split(/\s+/).map((t) => t.trim()).filter(Boolean).slice(0, 5)
      const normalizeNumericToken = (s: string) => {
        const sCompact = s.replace(/\s+/g, '')
        if (!/[.,]/.test(sCompact)) return sCompact
        const parts = sCompact.split(/[.,]/)
        const last = parts[parts.length - 1] || ''
        if (last.length === 3) return parts.join('')
        return sCompact.replace(',', '.')
      }

      const whereSqlParts: Prisma.Sql[] = [Prisma.sql`TRUE`]
      if (pabrikSawitId && Number.isFinite(pabrikSawitId)) whereSqlParts.push(Prisma.sql`b."pabrikSawitId" = ${pabrikSawitId}`)
      if (kebunId && Number.isFinite(kebunId)) whereSqlParts.push(Prisma.sql`(n."kebunId" = ${kebunId} OR t."kebunId" = ${kebunId})`)
      if (startDate && Number.isFinite(startDate.getTime())) whereSqlParts.push(Prisma.sql`b.tanggal >= ${startDate}`)
      if (endDate && Number.isFinite(endDate.getTime())) whereSqlParts.push(Prisma.sql`b.tanggal <= ${endDate}`)
      const whereSql = whereSqlParts.slice(1).reduce((acc, curr) => Prisma.sql`${acc} AND ${curr}`, whereSqlParts[0])

      const tokenConds: Prisma.Sql[] = tokens.map((t) => {
        const hasDigit = /\d/.test(t)
        const isNumericToken = hasDigit && /^[\d.,\s]+$/.test(t)
        const normalized = isNumericToken ? normalizeNumericToken(t) : t
        const like = `%${normalized}%`
        return Prisma.sql`(
          CAST(b.id AS TEXT) ILIKE ${like}
          OR COALESCE(p.name, '') ILIKE ${like}
          OR COALESCE(b.keterangan, '') ILIKE ${like}
          OR CAST(COALESCE(b."jumlahMasuk", 0) AS TEXT) ILIKE ${like}
          OR CAST(COALESCE(b."adminBank", 0) AS TEXT) ILIKE ${like}
          OR CAST(COUNT(DISTINCT i."notaSawitId") AS TEXT) ILIKE ${like}
          OR CAST(COALESCE(SUM(i."tagihanNet"), 0) AS TEXT) ILIKE ${like}
          OR CAST(COALESCE(SUM(i."pembayaranAktual"), 0) AS TEXT) ILIKE ${like}
          OR CAST((COALESCE(b."jumlahMasuk", 0) - COALESCE(b."adminBank", 0)) AS TEXT) ILIKE ${like}
          OR CAST(((COALESCE(b."jumlahMasuk", 0) - COALESCE(b."adminBank", 0)) - COALESCE(SUM(i."pembayaranAktual"), 0)) AS TEXT) ILIKE ${like}
          OR BOOL_OR(
            COALESCE(kb.name, '') ILIKE ${like}
            OR COALESCE(kb2.name, '') ILIKE ${like}
            OR CAST(n.id AS TEXT) ILIKE ${like}
            OR CAST(COALESCE(n."beratAkhir", 0) AS TEXT) ILIKE ${like}
          )
        )`
      })
      if (tokenConds.length > 0) {
        const havingSql = tokenConds.slice(1).reduce((acc, curr) => Prisma.sql`${acc} AND ${curr}`, tokenConds[0])
        const idsRows: Array<{ id: number }> = await prisma.$queryRaw(
          Prisma.sql`
            SELECT b.id
            FROM "NotaSawitPembayaranBatch" b
            LEFT JOIN "PabrikSawit" p ON p.id = b."pabrikSawitId"
            LEFT JOIN "NotaSawitPembayaranBatchItem" i ON i."batchId" = b.id
            LEFT JOIN "NotaSawit" n ON n.id = i."notaSawitId"
            LEFT JOIN "Kebun" kb ON kb.id = n."kebunId"
            LEFT JOIN "Timbangan" t ON t.id = n."timbanganId"
            LEFT JOIN "Kebun" kb2 ON kb2.id = t."kebunId"
            WHERE ${whereSql}
            GROUP BY b.id, p.id, p.name, b.keterangan, b.tanggal, b."jumlahMasuk", b."adminBank"
            HAVING ${havingSql}
            ORDER BY b.id DESC
          `,
        )
        const ids = idsRows.map((r) => Number(r.id)).filter((n) => Number.isFinite(n) && n > 0)
        if (ids.length === 0) {
          return NextResponse.json({
            data: [],
            page,
            limit,
            total: 0,
            summary: {
              totalBatches: 0,
              totalNota: 0,
              totalTagihan: 0,
              totalKasMasuk: 0,
              totalAllocated: 0,
              totalSelisih: 0,
            },
          })
        }
        where.id = { in: ids }
      }
    }

    const total = await (prisma as any).notaSawitPembayaranBatch.count({ where })
    const skip = (page - 1) * limit

    const batchIdIn: number[] = Array.isArray((where as any)?.id?.in) ? ((where as any).id.in as any[]) : []
    const baseWhereSqlParts: Prisma.Sql[] = [Prisma.sql`TRUE`]
    if (pabrikSawitId && Number.isFinite(pabrikSawitId)) baseWhereSqlParts.push(Prisma.sql`b."pabrikSawitId" = ${pabrikSawitId}`)
    if (startDate && Number.isFinite(startDate.getTime())) baseWhereSqlParts.push(Prisma.sql`b.tanggal >= ${startDate}`)
    if (endDate && Number.isFinite(endDate.getTime())) baseWhereSqlParts.push(Prisma.sql`b.tanggal <= ${endDate}`)
    if (batchIdIn.length > 0) baseWhereSqlParts.push(Prisma.sql`b.id IN (${Prisma.join(batchIdIn)})`)
    if (kebunId && Number.isFinite(kebunId)) {
      baseWhereSqlParts.push(Prisma.sql`
        EXISTS (
          SELECT 1
          FROM "NotaSawitPembayaranBatchItem" i2
          JOIN "NotaSawit" n2 ON n2.id = i2."notaSawitId"
          LEFT JOIN "Timbangan" t2 ON t2.id = n2."timbanganId"
          WHERE i2."batchId" = b.id
            AND (n2."kebunId" = ${kebunId} OR t2."kebunId" = ${kebunId})
        )
      `)
    }
    const baseWhereSql = baseWhereSqlParts.slice(1).reduce((acc, curr) => Prisma.sql`${acc} AND ${curr}`, baseWhereSqlParts[0])

    const summaryRows: Array<{
      totalBatches: any
      totalNota: any
      totalTagihan: any
      totalKasMasuk: any
      totalAllocated: any
    }> = await prisma.$queryRaw(
      Prisma.sql`
        WITH filtered_batches AS (
          SELECT b.id, COALESCE(b."jumlahMasuk", 0) AS "jumlahMasuk", COALESCE(b."adminBank", 0) AS "adminBank"
          FROM "NotaSawitPembayaranBatch" b
          WHERE ${baseWhereSql}
        ),
        items_join AS (
          SELECT
            fb.id AS "batchId",
            i."notaSawitId" AS "notaSawitId",
            COALESCE(i."pembayaranAktual", 0) AS "pembayaranAktual",
            COALESCE(n."pembayaranSetelahPph", n."totalPembayaran", i."tagihanNet", 0) AS "tagihanNow"
          FROM filtered_batches fb
          LEFT JOIN "NotaSawitPembayaranBatchItem" i ON i."batchId" = fb.id
          LEFT JOIN "NotaSawit" n ON n.id = i."notaSawitId"
        )
        SELECT
          (SELECT COUNT(*) FROM filtered_batches) AS "totalBatches",
          (SELECT COUNT(DISTINCT "notaSawitId") FROM items_join WHERE "notaSawitId" IS NOT NULL) AS "totalNota",
          COALESCE((SELECT SUM("tagihanNow") FROM items_join), 0) AS "totalTagihan",
          COALESCE((SELECT SUM("jumlahMasuk" - "adminBank") FROM filtered_batches), 0) AS "totalKasMasuk",
          COALESCE((SELECT SUM("pembayaranAktual") FROM items_join), 0) AS "totalAllocated"
      `,
    )
    const s0 = summaryRows?.[0] || ({} as any)
    const totalBatches = Number(s0.totalBatches || 0)
    const totalNota = Number(s0.totalNota || 0)
    const totalTagihanSummary = Math.round(Number(s0.totalTagihan || 0))
    const totalKasMasukSummary = Math.round(Number(s0.totalKasMasuk || 0))
    const totalAllocatedSummary = Math.round(Number(s0.totalAllocated || 0))
    const totalSelisihSummary = Math.round(totalKasMasukSummary - totalAllocatedSummary)

    const orderBy =
      sortParam === 'batch'
        ? [{ id: 'desc' }]
        : [{ tanggal: 'desc' }, { id: 'desc' }]

    const batches = await (prisma as any).notaSawitPembayaranBatch.findMany({
      where,
      include: {
        pabrikSawit: true,
        createdBy: { select: { id: true, name: true } },
        items: {
          include: {
            notaSawit: {
              select: {
                id: true,
                tanggalBongkar: true,
                beratAkhir: true,
                hargaPerKg: true,
                totalPembayaran: true,
                pembayaranSetelahPph: true,
                kendaraanPlatNomor: true,
                supir: { select: { name: true } },
                kebun: { select: { id: true, name: true } },
                timbangan: { select: { kebun: { select: { id: true, name: true } } } },
              },
            },
          },
        },
      },
      orderBy,
      skip,
      take: limit,
    })

    const data = (Array.isArray(batches) ? batches : []).map((b: any) => {
      const items = Array.isArray(b.items) ? b.items : []
      const totalTagihan = items.reduce((sum: number, i: any) => {
        const nota = i?.notaSawit || null
        const tagihanNow = Math.round(Number(nota?.pembayaranSetelahPph ?? nota?.totalPembayaran ?? i?.tagihanNet ?? 0))
        return sum + (Number.isFinite(tagihanNow) ? tagihanNow : 0)
      }, 0)
      const totalAllocated = items.reduce((sum: number, i: any) => sum + Math.round(Number(i?.pembayaranAktual || 0)), 0)
      const jumlahMasuk = Math.round(Number(b?.jumlahMasuk || 0))
      const adminBank = Math.round(Number(b?.adminBank || 0))
      const totalKasMasuk = Math.max(0, Math.round(Number(jumlahMasuk - adminBank) || 0))
      return {
        id: b.id,
        tanggal: b.tanggal,
        pabrikSawit: b.pabrikSawit ? { id: b.pabrikSawit.id, name: b.pabrikSawit.name } : null,
        createdBy: b.createdBy ? { id: b.createdBy.id, name: b.createdBy.name } : null,
        jumlahMasuk,
        adminBank,
        metodeAlokasi: b.metodeAlokasi,
        bebankanNotaId: b.bebankanNotaId,
        keterangan: b.keterangan,
        gambarUrl: b.gambarUrl || null,
        count: items.length,
        totalTagihan,
        totalKasMasuk,
        totalAllocated,
        selisih: Math.round(totalKasMasuk - totalAllocated),
        items: items.map((i: any) => {
          const nota = i?.notaSawit || null
          const kebun = nota?.kebun || nota?.timbangan?.kebun || null
          const tagihanNow = Math.round(Number(nota?.pembayaranSetelahPph ?? nota?.totalPembayaran ?? i?.tagihanNet ?? 0))
          return {
            notaSawitId: i.notaSawitId,
            tagihanNet: Number.isFinite(tagihanNow) ? tagihanNow : 0,
            adminAllocated: Math.round(Number(i?.adminAllocated || 0)),
            pembayaranAktual: Math.round(Number(i?.pembayaranAktual || 0)),
            nota: nota
              ? {
                  id: nota.id,
                  tanggalBongkar: nota.tanggalBongkar,
                  beratAkhir: nota.beratAkhir,
                  hargaPerKg: nota.hargaPerKg,
                  kendaraanPlatNomor: nota.kendaraanPlatNomor || null,
                  supir: nota.supir ? { name: nota.supir.name } : null,
                  kebun: kebun ? { id: kebun.id, name: kebun.name } : null,
                }
              : null,
          }
        }),
      }
    })

    return NextResponse.json({
      data,
      page,
      limit,
      total,
      summary: {
        totalBatches,
        totalNota,
        totalTagihan: totalTagihanSummary,
        totalKasMasuk: totalKasMasukSummary,
        totalAllocated: totalAllocatedSummary,
        totalSelisih: totalSelisihSummary,
      },
    })
  } catch (error) {
    console.error('GET /api/nota-sawit/pembayaran-batch error:', error)
    return NextResponse.json({ error: 'Gagal memuat riwayat rekonsiliasi' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR'])
    if (guard.response) return guard.response

    const body = await request.json().catch(() => ({}))
    const idsRaw: any[] = Array.isArray(body?.ids) ? body.ids : []
    const gambarUrl = body?.gambarUrl ? String(body.gambarUrl).trim() : null
    const uniqueIds: number[] = Array.from(
      new Set<number>(
        idsRaw
          .map((v: any) => Number(v))
          .filter((n: number) => Number.isFinite(n) && n > 0),
      ),
    )

    const roundInt = (v: any) => Math.round(Number(v) || 0)
    const jumlahMasuk = roundInt(body?.jumlahMasuk)
    const adminBank = Math.max(0, roundInt(body?.adminBank))
    const metodeAlokasi = String(body?.metodeAlokasi || 'PROPORSIONAL').toUpperCase() as AlokasiMetode
    const bebankanNotaId = body?.bebankanNotaId ? Number(body.bebankanNotaId) : null
    const setLunas = body?.setLunas !== false
    const keterangan = body?.keterangan !== undefined && body?.keterangan !== null ? String(body.keterangan).trim() : null

    const tanggalRaw = String(body?.tanggal || '').trim()
    const ymd = tanggalRaw ? parseWibYmd(tanggalRaw) : null
    const tanggal = ymd ? wibStartUtc(ymd) : new Date()

    const chunk = <T,>(arr: T[], size: number) => {
      const out: T[][] = []
      for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
      return out
    }

    const findKasIdsByNota = async (tx: any, notaIds: number[]) => {
      const idsSet = new Set<number>()
      for (const part of chunk(notaIds, 40)) {
        const or = [
          { notaSawitId: { in: part } },
          ...part.map((id) => ({ deskripsi: { contains: `Penjualan Sawit #${id}` } })),
        ]
        const rows = await tx.kasTransaksi.findMany({
          where: { deletedAt: null, kategori: 'PENJUALAN_SAWIT', OR: or } as any,
          select: { id: true },
        })
        for (const r of rows) idsSet.add(Number(r.id))
      }
      return Array.from(idsSet).filter((n) => Number.isFinite(n) && n > 0)
    }

    if (!['PROPORSIONAL', 'RATA', 'SATU_NOTA'].includes(metodeAlokasi)) {
      return NextResponse.json({ error: 'Metode alokasi tidak valid' }, { status: 400 })
    }

    let pabrikSawitId = 0
    let pabrikNameForDesc = 'Pabrik'
    let notas: any[] = []
    let entries: any[] = []

    if (uniqueIds.length === 0) {
      const pabrikIdBody = Number(body?.pabrikSawitId || body?.pabrikId || 0)
      if (!Number.isFinite(pabrikIdBody) || pabrikIdBody <= 0) {
        return NextResponse.json({ error: 'Pabrik batch tidak valid' }, { status: 400 })
      }
      const pabrik = await prisma.pabrikSawit.findFirst({ where: { id: pabrikIdBody }, select: { id: true, name: true } })
      if (!pabrik) {
        return NextResponse.json({ error: 'Pabrik tidak ditemukan' }, { status: 404 })
      }
      pabrikSawitId = pabrik.id
      pabrikNameForDesc = pabrik.name
    } else {
      notas = await prisma.notaSawit.findMany({
        where: { id: { in: uniqueIds }, deletedAt: null },
        include: {
          timbangan: { select: { kebunId: true } },
          pabrikSawit: true,
          supir: true,
        },
      })

      if (notas.length === 0) {
        return NextResponse.json({ error: 'Nota tidak ditemukan' }, { status: 404 })
      }

      pabrikSawitId = Number((notas[0] as any).pabrikSawitId)
      if (!Number.isFinite(pabrikSawitId) || pabrikSawitId <= 0) {
        return NextResponse.json({ error: 'Pabrik nota tidak valid' }, { status: 400 })
      }

      const mismatch = notas.some((n: any) => Number(n.pabrikSawitId) !== pabrikSawitId)
      if (mismatch) {
        return NextResponse.json({ error: 'Nota terpilih harus dari pabrik yang sama' }, { status: 400 })
      }

      pabrikNameForDesc = String((notas[0] as any)?.pabrikSawit?.name || pabrikNameForDesc)

      entries = notas.map((n: any) => {
        const tagihanNet = roundInt(n.pembayaranSetelahPph ?? n.totalPembayaran ?? 0)
        return {
          notaId: Number(n.id),
          tagihanNet,
          kendaraanPlatNomor: String(n.kendaraanPlatNomor || ''),
          tanggalBongkar: n.tanggalBongkar ? new Date(n.tanggalBongkar) : null,
          supirName: String(n.supir?.name || ''),
          pabrikName: String(n.pabrikSawit?.name || ''),
          kebunId: Number((n as any).timbangan?.kebunId || (n as any).kebunId || 0),
        }
      })
    }

    const totalTagihan = entries.reduce((sum, e) => sum + (e.tagihanNet || 0), 0)
    const nCount = entries.length

    const allocateAdmin = () => {
      const adminMap: Record<number, number> = {}
      entries.forEach((e) => {
        adminMap[e.notaId] = 0
      })
      if (adminBank <= 0 || nCount === 0) return adminMap

      if (metodeAlokasi === 'RATA') {
        const base = Math.floor(adminBank / nCount)
        let rem = adminBank - base * nCount
        for (const e of entries) {
          adminMap[e.notaId] = base + (rem > 0 ? 1 : 0)
          if (rem > 0) rem -= 1
        }
        return adminMap
      }

      if (metodeAlokasi === 'SATU_NOTA') {
        const targetId = bebankanNotaId && entries.some((e) => e.notaId === bebankanNotaId) ? bebankanNotaId : entries[0].notaId
        adminMap[targetId] = adminBank
        return adminMap
      }

      if (totalTagihan <= 0) return adminMap

      const rawRows = entries.map((e) => {
        const numerator = e.tagihanNet * adminBank
        const floor = Math.floor(numerator / totalTagihan)
        const rem = numerator - floor * totalTagihan
        return { id: e.notaId, floor, rem }
      })
      const sumFloor = rawRows.reduce((sum, r) => sum + r.floor, 0)
      let remaining = adminBank - sumFloor
      rawRows.sort((a, b) => b.rem - a.rem)
      for (const r of rawRows) {
        adminMap[r.id] = r.floor + (remaining > 0 ? 1 : 0)
        if (remaining > 0) remaining -= 1
      }
      return adminMap
    }

    const adminMap = allocateAdmin()
    const computed = entries.map((e) => {
      const adminAllocated = Math.max(0, roundInt(adminMap[e.notaId] || 0))
      const pembayaranAktual = Math.max(0, e.tagihanNet - adminAllocated)
      return { ...e, adminAllocated, pembayaranAktual }
    })
    const totalAllocated = computed.reduce((sum, e) => sum + e.pembayaranAktual, 0)
    const totalKasMasuk = Math.max(0, roundInt(jumlahMasuk - adminBank))
    const setLunasEffective = uniqueIds.length > 0 && setLunas

    const result = await prisma.$transaction(async (tx) => {
      const pemilik = await tx.user.findFirst({ where: { role: 'PEMILIK' }, select: { id: true } })
      const transactionUserId = pemilik?.id ?? guard.id
      const now = new Date()

      const batch = await (tx as any).notaSawitPembayaranBatch.create({
        data: {
          pabrikSawitId,
          tanggal,
          jumlahMasuk,
          adminBank,
          metodeAlokasi,
          bebankanNotaId: bebankanNotaId || null,
          keterangan: keterangan || null,
          gambarUrl: gambarUrl || null,
          createdById: guard.id,
        },
        select: { id: true },
      })

      if (computed.length > 0) {
        await (tx as any).notaSawitPembayaranBatchItem.createMany({
          data: computed.map((c) => ({
            batchId: batch.id,
            notaSawitId: c.notaId,
            tagihanNet: c.tagihanNet,
            adminAllocated: c.adminAllocated,
            pembayaranAktual: c.pembayaranAktual,
          })),
        })
      }

      if (computed.length > 0) {
        await tx.notaSawit.updateMany({
          where: { id: { in: computed.map((c) => c.notaId) } },
          data: {
            pembayaranAktual: null,
            ...(setLunasEffective ? { statusPembayaran: 'LUNAS' } : {}),
          } as any,
        })
      }

      if (setLunasEffective) {
        const notaIds = computed.map((c) => c.notaId)

        const kasIds = await findKasIdsByNota(tx, notaIds)
        if (kasIds.length > 0) {
          await tx.jurnal.deleteMany({ where: { refType: 'KasTransaksi', refId: { in: kasIds } } })
          await tx.kasTransaksi.updateMany({
            where: { id: { in: kasIds } },
            data: { deletedAt: now, deletedById: guard.id },
          })
        }

        const kebunIds = Array.from(new Set(computed.map((c) => Number(c.kebunId)).filter((n) => Number.isFinite(n) && n > 0)))
        const kebunId = kebunIds.length === 1 ? kebunIds[0] : null
        const description = `Uang Nota Sawit - ${pabrikNameForDesc}`
        const transferDateText = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }).format(tanggal)
        const periodeNotaText = (() => {
          const dates = computed
            .map((c) => (c?.tanggalBongkar ? new Date(c.tanggalBongkar) : null))
            .filter((d): d is Date => !!d && Number.isFinite(d.getTime()))
          if (dates.length === 0) return null
          const min = new Date(Math.min(...dates.map((d) => d.getTime())))
          const max = new Date(Math.max(...dates.map((d) => d.getTime())))
          const fmt = (d: Date) => new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }).format(d)
          if (min.toDateString() === max.toDateString()) return `Periode Nota: ${fmt(min)}`
          return `Periode Nota: ${fmt(min)} - ${fmt(max)}`
        })()
        const keteranganKasBase = `Batch ID: ${batch.id} • Jumlah Nota: ${computed.length} • Tanggal Transfer: ${transferDateText}`
        const keteranganKas = periodeNotaText ? `${keteranganKasBase} • ${periodeNotaText}` : keteranganKasBase

        const existingBatchKas = await tx.kasTransaksi.findFirst({
          where: {
            deletedAt: null,
            kategori: 'PENJUALAN_SAWIT',
            OR: [
              { notaSawitPembayaranBatchId: batch.id } as any,
              { keterangan: { startsWith: `Batch ID: ${batch.id} •` } },
              { deskripsi: { startsWith: `Uang Nota Sawit Batch #${batch.id} -` } },
            ],
          } as any,
        })

        const kasTrx = existingBatchKas
          ? await tx.kasTransaksi.update({
              where: { id: existingBatchKas.id },
              data: {
                date: tanggal,
                tipe: 'PEMASUKAN',
                deskripsi: description,
                jumlah: totalKasMasuk,
                kategori: 'PENJUALAN_SAWIT',
                keterangan: keteranganKas,
                kebunId: kebunId || null,
                userId: transactionUserId,
                notaSawitId: null,
                notaSawitPembayaranBatchId: batch.id,
                deletedAt: null,
                deletedById: null,
              } as any,
            })
          : await tx.kasTransaksi.create({
              data: {
                date: tanggal,
                tipe: 'PEMASUKAN',
                deskripsi: description,
                jumlah: totalKasMasuk,
                kategori: 'PENJUALAN_SAWIT',
                keterangan: keteranganKas,
                kebunId: kebunId || undefined,
                userId: transactionUserId,
                notaSawitPembayaranBatchId: batch.id,
              } as any,
            })

        await tx.jurnal.deleteMany({ where: { refType: 'KasTransaksi', refId: kasTrx.id } })
        await tx.jurnal.createMany({
          data: [
            {
              date: kasTrx.date,
              akun: 'Kas',
              deskripsi: description,
              debit: totalKasMasuk,
              kredit: 0,
              refType: 'KasTransaksi',
              refId: kasTrx.id,
            },
            {
              date: kasTrx.date,
              akun: 'Pendapatan Sawit',
              deskripsi: description,
              debit: 0,
              kredit: totalKasMasuk,
              refType: 'KasTransaksi',
              refId: kasTrx.id,
            },
          ],
        })
      }

      if (!setLunasEffective && uniqueIds.length === 0 && totalKasMasuk > 0) {
        const description = `Uang Nota Sawit - ${pabrikNameForDesc}`
        const kasTrx = await tx.kasTransaksi.create({
          data: {
            date: tanggal,
            tipe: 'PEMASUKAN',
            deskripsi: description,
            jumlah: totalKasMasuk,
            kategori: 'PENJUALAN_SAWIT',
            keterangan: keterangan || null,
            userId: transactionUserId,
            notaSawitPembayaranBatchId: batch.id,
          } as any,
        })

        await tx.jurnal.createMany({
          data: [
            {
              date: kasTrx.date,
              akun: 'Kas',
              deskripsi: description,
              debit: totalKasMasuk,
              kredit: 0,
              refType: 'KasTransaksi',
              refId: kasTrx.id,
            },
            {
              date: kasTrx.date,
              akun: 'Pendapatan Sawit',
              deskripsi: description,
              debit: 0,
              kredit: totalKasMasuk,
              refType: 'KasTransaksi',
              refId: kasTrx.id,
            },
          ],
        })
      }

      await createAuditLog(guard.id, 'CREATE', 'NotaSawitPembayaranBatch', String(batch.id), {
        pabrikSawitId,
        tanggal: tanggal.toISOString(),
        jumlahMasuk,
        adminBank,
        metodeAlokasi,
        bebankanNotaId: bebankanNotaId || null,
        setLunas: setLunasEffective,
        count: computed.length,
        totalTagihan,
        totalKasMasuk,
        totalAllocated,
        ids: uniqueIds.slice(0, 500),
      })

      return batch
    })

    return NextResponse.json({
      ok: true,
      batchId: result.id,
      count: computed.length,
      totalTagihan,
      totalAktual: totalKasMasuk,
      totalAllocated,
      jumlahMasuk,
      adminBank,
      selisih: roundInt(totalKasMasuk - totalAllocated),
    })
  } catch (error) {
    console.error('POST /api/nota-sawit/pembayaran-batch error:', error)
    return NextResponse.json({ error: 'Gagal menyimpan rekonsiliasi pembayaran' }, { status: 500 })
  }
}
