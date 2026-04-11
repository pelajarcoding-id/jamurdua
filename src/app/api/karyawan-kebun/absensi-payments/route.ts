import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { auth } from '@/auth'
import { getWibRangeUtcFromParams, parseWibYmd, wibEndUtcInclusive, wibStartUtc } from '@/lib/wib'

export const dynamic = 'force-dynamic'

const ensureTable = async () => {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AbsensiGajiHarian" (
      "id" SERIAL PRIMARY KEY,
      "kebunId" INTEGER NOT NULL,
      "karyawanId" INTEGER NOT NULL,
      "date" DATE NOT NULL,
      "jumlah" NUMERIC NOT NULL DEFAULT 0,
      "gajianId" INTEGER,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE ("kebunId","karyawanId","date")
    )
  `)
  await prisma.$executeRawUnsafe(`ALTER TABLE "AbsensiGajiHarian" ADD COLUMN IF NOT EXISTS "gajianId" INTEGER`)
}

const formatIdLongDateFromYmdKey = (key: string) => {
  const m = key.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return key
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return key
  const dt = new Date(Date.UTC(y, mo - 1, d, 0, 0, 0))
  try {
    return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' })
      .format(dt)
      .toLowerCase()
  } catch {
    return key
  }
}

const parseIdLongDateToYmdKey = (text: string) => {
  const raw = (text || '').trim().toLowerCase()
  const m = raw.match(/^(\d{1,2})\s+([a-z]+)\s+(\d{4})$/i)
  if (!m) return null
  const day = Number(m[1])
  const monthName = String(m[2]).toLowerCase()
  const year = Number(m[3])
  const monthMap: Record<string, number> = {
    januari: 1,
    februari: 2,
    maret: 3,
    april: 4,
    mei: 5,
    juni: 6,
    juli: 7,
    agustus: 8,
    september: 9,
    oktober: 10,
    november: 11,
    desember: 12,
  }
  const month = monthMap[monthName]
  if (!month || !Number.isFinite(year) || !Number.isFinite(day)) return null
  if (day < 1 || day > 31) return null
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

const parsePeriod = (text?: string | null) => {
  const raw = (text || '').trim()
  if (!raw) return null
  const iso = raw.match(/Periode\s+(\d{4}-\d{2}-\d{2})(?:\s*-\s*(\d{4}-\d{2}-\d{2}))?/)
  if (iso) return { start: iso[1], end: iso[2] || iso[1] }
  const id = raw.match(/Periode\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})(?:\s*-\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4}))?/i)
  if (id) {
    const start = parseIdLongDateToYmdKey(id[1])
    const end = parseIdLongDateToYmdKey(id[2] || id[1])
    if (!start || !end) return null
    return { start, end }
  }
  return null
}

export async function GET(request: Request) {
  try {
    await ensureTable()
    const { searchParams } = new URL(request.url)
    const kebunIdParam = searchParams.get('kebunId')
    const karyawanIdParam = searchParams.get('karyawanId')
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')
    const historyParam = searchParams.get('history') === '1'

    if (!kebunIdParam || !startDateParam || !endDateParam) {
      return NextResponse.json({ error: 'kebunId, startDate, endDate wajib diisi' }, { status: 400 })
    }
    const kebunId = Number(kebunIdParam)
    const kasKebunId = kebunId > 0 ? kebunId : null
    const karyawanId = karyawanIdParam ? Number(karyawanIdParam) : null
    if (Number.isNaN(kebunId) || (karyawanIdParam && Number.isNaN(karyawanId))) {
      return NextResponse.json({ error: 'Parameter tidak valid' }, { status: 400 })
    }

    const startYmd = parseWibYmd(startDateParam)
    const endYmd = parseWibYmd(endDateParam)
    if (!startYmd || !endYmd) {
      return NextResponse.json({ error: 'startDate/endDate tidak valid' }, { status: 400 })
    }
    const startKey = `${String(startYmd.y).padStart(4, '0')}-${String(startYmd.m).padStart(2, '0')}-${String(startYmd.d).padStart(2, '0')}`
    const endKey = `${String(endYmd.y).padStart(4, '0')}-${String(endYmd.m).padStart(2, '0')}-${String(endYmd.d).padStart(2, '0')}`
    const startUtc = wibStartUtc(startYmd)
    const endUtc = wibEndUtcInclusive(endYmd)

    const dateToWibKey = (d: Date) => {
      const wib = new Date(d.getTime() + 7 * 60 * 60 * 1000)
      const y = wib.getUTCFullYear()
      const m = String(wib.getUTCMonth() + 1).padStart(2, '0')
      const day = String(wib.getUTCDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    }
    const rangeDateKeys = (start: string, end: string) => {
      const s = parseWibYmd(start)
      const e = parseWibYmd(end)
      if (!s || !e) return []
      let startMs = Date.UTC(s.y, s.m - 1, s.d)
      let endMs = Date.UTC(e.y, e.m - 1, e.d)
      if (endMs < startMs) {
        const tmp = startMs
        startMs = endMs
        endMs = tmp
      }
      const out: string[] = []
      for (let t = startMs; t <= endMs; t += 24 * 60 * 60 * 1000) {
        const dt = new Date(t)
        const y = dt.getUTCFullYear()
        const m = String(dt.getUTCMonth() + 1).padStart(2, '0')
        const d = String(dt.getUTCDate()).padStart(2, '0')
        out.push(`${y}-${m}-${d}`)
      }
      return out
    }

    if (karyawanId && historyParam) {
      const paidAtParam = searchParams.get('paidAt')
      const gajianIdParam = searchParams.get('gajianId')
      const detailParam = searchParams.get('detail') === '1'
      if (detailParam && gajianIdParam) {
        const gajianId = Number(gajianIdParam)
        if (!Number.isFinite(gajianId) || gajianId <= 0) {
          return NextResponse.json({ error: 'gajianId tidak valid' }, { status: 400 })
        }

        const gajian = await prisma.gajian.findUnique({
          where: { id: gajianId },
          select: { id: true, status: true, kebunId: true, tanggalMulai: true, tanggalSelesai: true, updatedAt: true },
        })
        if (!gajian || gajian.kebunId !== kebunId || gajian.status !== 'FINALIZED') {
          return NextResponse.json({ error: 'Data tidak ditemukan' }, { status: 404 })
        }

        const paidRows = await prisma.$queryRaw<Array<{ date: string; jumlah: number; gajianId: number | null }>>`
          SELECT TO_CHAR("date", 'YYYY-MM-DD') as "date", "jumlah", "gajianId"
          FROM "AbsensiGajiHarian"
          WHERE "kebunId" = ${kebunId}
            AND "karyawanId" = ${karyawanId}
            AND "gajianId" = ${gajianId}
          ORDER BY "date" ASC
        `
        if (paidRows.length === 0) return NextResponse.json({ error: 'Data tidak ditemukan' }, { status: 404 })

        const startKeyFinal = paidRows[0]!.date
        const endKeyFinal = paidRows[paidRows.length - 1]!.date

        const batchPotongan = await prisma.kasTransaksi.findMany({
          where: {
            kebunId: kasKebunId,
            karyawanId,
            kategori: 'PEMBAYARAN_HUTANG',
            deletedAt: null,
            gajianId,
          } as any,
          select: { date: true, jumlah: true },
        })
        const potongMap = new Map<string, number>()
        batchPotongan.forEach((p) => {
          const key = dateToWibKey(p.date)
          potongMap.set(key, (potongMap.get(key) || 0) + (Number(p.jumlah) || 0))
        })

        const items = paidRows.map((r) => {
          const potonganHutang = potongMap.get(r.date) || 0
          const jumlah = Number(r.jumlah) || 0
          return {
            date: r.date,
            jumlah,
            potonganHutang,
            sisa: Math.max(0, Math.round(jumlah - potonganHutang)),
            gajianId: r.gajianId ?? null,
          }
        })
        const totalJumlah = items.reduce((sum, r) => sum + (Number(r.jumlah) || 0), 0)
        const totalPotonganFromTrx = batchPotongan.reduce((sum, r) => sum + (Number(r.jumlah) || 0), 0)
        let totalPotonganHutang = items.reduce((sum, r) => sum + (Number(r.potonganHutang) || 0), 0)
        if (totalPotonganHutang === 0 && totalPotonganFromTrx > 0 && items.length > 0) {
          const lastIndex = items.length - 1
          const last = items[lastIndex]!
          const nextPotong = totalPotonganFromTrx
          items[lastIndex] = {
            ...last,
            potonganHutang: nextPotong,
            sisa: Math.max(0, Math.round(Number(last.jumlah || 0) - nextPotong)),
          }
          totalPotonganHutang = nextPotong
        }
        return NextResponse.json({
          summary: {
            paidAt: gajian.updatedAt.toISOString(),
            startDate: startKeyFinal,
            endDate: endKeyFinal,
            jumlah: Math.round(totalJumlah),
            potonganHutang: Math.round(totalPotonganHutang),
            sisa: Math.max(0, Math.round(totalJumlah - totalPotonganHutang)),
            deskripsi: `Pembayaran Gaji via Proses Gaji #${gajianId}`,
            keterangan: `Gajian #${gajianId}`,
            userName: null,
            batchKey: null,
          },
          items,
        })
      }
      if (detailParam && paidAtParam) {
        const paidAt = new Date(paidAtParam)
        if (Number.isNaN(paidAt.getTime())) {
          return NextResponse.json({ error: 'paidAt tidak valid' }, { status: 400 })
        }

        const trxRows = await prisma.kasTransaksi.findMany({
          where: {
            kebunId: kasKebunId,
            karyawanId,
            kategori: 'GAJI',
            deletedAt: null,
            createdAt: paidAt,
          },
          orderBy: { date: 'asc' },
          select: {
            id: true,
            date: true,
            createdAt: true,
            jumlah: true,
            deskripsi: true,
            keterangan: true,
            user: { select: { name: true } },
          },
        })
        if (trxRows.length === 0) return NextResponse.json({ error: 'Data tidak ditemukan' }, { status: 404 })

        let startKeyMin: string | null = null
        let endKeyMax: string | null = null
        const dateSet = new Set<string>()
        let totalJumlah = 0

        trxRows.forEach((r) => {
          totalJumlah += Number(r.jumlah) || 0
          const dateKey = dateToWibKey(r.date)
          const period = parsePeriod(r.keterangan)
          const rangeStart = period?.start || dateKey
          const rangeEnd = period?.end || dateKey
          if (!startKeyMin || rangeStart < startKeyMin) startKeyMin = rangeStart
          if (!endKeyMax || rangeEnd > endKeyMax) endKeyMax = rangeEnd
          rangeDateKeys(rangeStart, rangeEnd).forEach((k) => dateSet.add(k))
        })

        const startKeyFinal = startKeyMin || startKey
        const endKeyFinal = endKeyMax || endKey

        const paidRows = await prisma.$queryRaw<Array<{ date: string; jumlah: number; gajianId: number | null }>>`
          SELECT TO_CHAR("date", 'YYYY-MM-DD') as "date", "jumlah", "gajianId"
          FROM "AbsensiGajiHarian"
          WHERE "kebunId" = ${kebunId}
            AND "karyawanId" = ${karyawanId}
            AND "date" >= ${startKeyFinal}::DATE
            AND "date" <= ${endKeyFinal}::DATE
          ORDER BY "date" ASC
        `
        const paidMap = new Map(paidRows.map((r) => [r.date, { jumlah: Number(r.jumlah) || 0, gajianId: r.gajianId }]))

        const startYmd2 = parseWibYmd(startKeyFinal)
        const endYmd2 = parseWibYmd(endKeyFinal)
        const dateStart2 = startYmd2 ? wibStartUtc(startYmd2) : startUtc
        const dateEnd2 = endYmd2 ? wibEndUtcInclusive(endYmd2) : endUtc
        const potonganRows = await prisma.kasTransaksi.findMany({
          where: {
            kebunId: kasKebunId,
            karyawanId,
            kategori: 'PEMBAYARAN_HUTANG',
            deletedAt: null,
            createdAt: paidAt,
          },
          select: { date: true, jumlah: true },
        })
        const fallbackPotonganRows = await prisma.kasTransaksi.findMany({
          where: {
            kebunId: kasKebunId,
            karyawanId,
            kategori: 'PEMBAYARAN_HUTANG',
            deletedAt: null,
            date: { gte: dateStart2, lte: dateEnd2 },
          },
          select: { date: true, jumlah: true },
        })
        const potongMap = new Map<string, number>()
        ;(potonganRows.length > 0 ? potonganRows : fallbackPotonganRows).forEach((p) => {
          const key = dateToWibKey(p.date)
          potongMap.set(key, (potongMap.get(key) || 0) + (Number(p.jumlah) || 0))
        })

        const dates = Array.from(dateSet.values()).sort((a, b) => a.localeCompare(b))
        const items = dates.map((date) => {
          const paid = paidMap.get(date)
          const jumlah = paid?.jumlah || 0
          const potonganHutang = potongMap.get(date) || 0
          return {
            date,
            jumlah,
            potonganHutang,
            sisa: Math.max(0, Math.round(jumlah - potonganHutang)),
            gajianId: paid?.gajianId ?? null,
          }
        })
        const totalPotonganFromTrx = (potonganRows.length > 0 ? potonganRows : fallbackPotonganRows).reduce((sum, r) => sum + (Number(r.jumlah) || 0), 0)
        let totalPotonganHutang = items.reduce((sum, r) => sum + (Number(r.potonganHutang) || 0), 0)
        if (totalPotonganHutang === 0 && totalPotonganFromTrx > 0 && items.length > 0) {
          const lastIndex = items.length - 1
          const last = items[lastIndex]!
          const nextPotong = totalPotonganFromTrx
          items[lastIndex] = {
            ...last,
            potonganHutang: nextPotong,
            sisa: Math.max(0, Math.round(Number(last.jumlah || 0) - nextPotong)),
          }
          totalPotonganHutang = nextPotong
        }
        return NextResponse.json({
        summary: {
          paidAt: trxRows[0].createdAt.toISOString(),
          startDate: startKeyFinal,
          endDate: endKeyFinal,
          jumlah: Math.round(totalJumlah),
          potonganHutang: Math.round(totalPotonganHutang),
          sisa: Math.max(0, Math.round(totalJumlah - totalPotonganHutang)),
          deskripsi: trxRows[0].deskripsi || '',
          keterangan: (trxRows[0].keterangan || '').trim(),
          userName: trxRows[0].user?.name || null,
          batchKey: null,
        },
        items,
      })
      }
      const range = getWibRangeUtcFromParams(searchParams)
      const dateStart = range?.startUtc || startUtc
      const dateEnd = range?.endUtcInclusive || endUtc
      const rows = await prisma.kasTransaksi.findMany({
        where: {
          kebunId: kasKebunId,
          karyawanId,
          kategori: 'GAJI',
          deletedAt: null,
          date: {
            gte: dateStart,
            lte: dateEnd,
          },
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          date: true,
          createdAt: true,
          jumlah: true,
          deskripsi: true,
          keterangan: true,
          kebunId: true,
          karyawanId: true,
          userId: true,
          user: { select: { name: true } },
        },
      })
      const minDate = rows.reduce<Date | null>((acc, r) => {
        const d = r.date
        if (!acc || d < acc) return d
        return acc
      }, null)
      const maxDate = rows.reduce<Date | null>((acc, r) => {
        const d = r.date
        if (!acc || d > acc) return d
        return acc
      }, null)
      const potongan = minDate && maxDate ? await prisma.kasTransaksi.findMany({
        where: {
          kebunId: kasKebunId,
          karyawanId,
          kategori: 'PEMBAYARAN_HUTANG',
          deletedAt: null,
          date: {
            gte: minDate,
            lte: maxDate,
          },
        },
        select: { date: true, jumlah: true, createdAt: true },
      }) : []
      const potongByDate = new Map<string, number>()
      const potongByPaidAt = new Map<string, Map<string, number>>()
      potongan.forEach(p => {
        const dateKey = dateToWibKey(p.date)
        const amount = Number(p.jumlah) || 0
        potongByDate.set(dateKey, (potongByDate.get(dateKey) || 0) + amount)
        const paidAt = p.createdAt?.toISOString?.() ? p.createdAt.toISOString() : null
        if (paidAt) {
          const paidMap = potongByPaidAt.get(paidAt) || new Map<string, number>()
          paidMap.set(dateKey, (paidMap.get(dateKey) || 0) + amount)
          potongByPaidAt.set(paidAt, paidMap)
        }
      })
      const grouped = new Map<string, { id: number; startDate: string; endDate: string; jumlah: number; deskripsi: string; userName: string | null; potonganHutang: number; paidAt: string; kebunId: number; karyawanId: number; dateSet: Set<string> }>()
      rows.forEach(r => {
        const paidAt = r.createdAt.toISOString()
        const key = `${r.kebunId}-${r.karyawanId}-${paidAt}`
        const dateKey = dateToWibKey(r.date)
        const period = parsePeriod(r.keterangan)
        const rangeStart = period?.start || dateKey
        const rangeEnd = period?.end || dateKey
        const dateKeys = rangeDateKeys(rangeStart, rangeEnd)
        const potongSum = (() => {
          const m = potongByPaidAt.get(paidAt)
          if (m) return dateKeys.reduce((acc, d) => acc + (m.get(d) || 0), 0)
          return dateKeys.reduce((acc, d) => acc + (potongByDate.get(d) || 0), 0)
        })()
        const existing = grouped.get(key)
        if (!existing) {
          grouped.set(key, {
            id: r.id,
            startDate: rangeStart,
            endDate: rangeEnd,
            jumlah: Number(r.jumlah) || 0,
            deskripsi: (r.keterangan || '').trim() || r.deskripsi || '',
            userName: r.user?.name || null,
            potonganHutang: potongSum,
            paidAt,
            kebunId: kebunId,
            karyawanId: karyawanId!,
            dateSet: new Set(dateKeys),
          })
        } else {
          if (rangeStart < existing.startDate) existing.startDate = rangeStart
          if (rangeEnd > existing.endDate) existing.endDate = rangeEnd
          existing.jumlah += Number(r.jumlah) || 0
          dateKeys.forEach(d => {
            if (!existing.dateSet.has(d)) {
              existing.dateSet.add(d)
              const m = potongByPaidAt.get(paidAt)
              existing.potonganHutang += (m?.get(d) || 0) || (potongByDate.get(d) || 0)
            }
          })
        }
      })
      const data = Array.from(grouped.values())
        .map(g => ({
          id: g.id,
          startDate: g.startDate,
          endDate: g.endDate,
          jumlah: g.jumlah,
          deskripsi: g.deskripsi,
          userName: g.userName,
          potonganHutang: g.potonganHutang,
          paidAt: g.paidAt,
          kebunId: g.kebunId,
          karyawanId: g.karyawanId,
          source: 'KAS',
          gajianId: null as any,
        }))
      const gajianAgg = await prisma.$queryRaw<Array<{ gajianId: number; startDate: string; endDate: string; total: number }>>(
        Prisma.sql`SELECT "gajianId" as "gajianId",
                          TO_CHAR(MIN("date"), 'YYYY-MM-DD') as "startDate",
                          TO_CHAR(MAX("date"), 'YYYY-MM-DD') as "endDate",
                          COALESCE(SUM("jumlah"), 0) as "total"
                   FROM "AbsensiGajiHarian"
                   WHERE "kebunId" = ${kebunId}
                     AND "karyawanId" = ${karyawanId}
                     AND "gajianId" IS NOT NULL
                     AND "date" >= ${startKey}::DATE
                     AND "date" <= ${endKey}::DATE
                   GROUP BY "gajianId"`
      )
      const gajianIds = gajianAgg.map((r) => Number(r.gajianId)).filter((n) => Number.isFinite(n) && n > 0)
      const gajianRows = gajianIds.length > 0
        ? await prisma.gajian.findMany({
            where: { id: { in: gajianIds }, status: 'FINALIZED' },
            select: { id: true, updatedAt: true },
          })
        : []
      const gajianUpdatedAtById = new Map<number, Date>(gajianRows.map((g) => [g.id, g.updatedAt]))
      const potonganByGajian = gajianIds.length > 0
        ? await prisma.kasTransaksi.groupBy({
            by: ['gajianId'],
            where: {
              kebunId,
              karyawanId,
              kategori: 'PEMBAYARAN_HUTANG',
              deletedAt: null,
              gajianId: { in: gajianIds },
            } as any,
            _sum: { jumlah: true },
          } as any)
        : []
      const potonganMapByGajianId = new Map<number, number>(
        (potonganByGajian as any[]).map((r: any) => [Number(r.gajianId), Number(r._sum?.jumlah) || 0]),
      )
      const dataGajian = gajianAgg
        .map((r) => {
          const id = Number(r.gajianId)
          const paidAt = gajianUpdatedAtById.get(id)?.toISOString() || new Date().toISOString()
          const jumlah = Number((r as any).total) || 0
          const potonganHutang = potonganMapByGajianId.get(id) || 0
          return {
            id: -id,
            gajianId: id,
            startDate: String((r as any).startDate),
            endDate: String((r as any).endDate),
            jumlah,
            deskripsi: `Pembayaran Gaji via Proses Gaji #${id}`,
            userName: data[0]?.userName || null,
            potonganHutang,
            paidAt,
            kebunId: kebunId,
            karyawanId: karyawanId!,
            source: 'GAJIAN',
          }
        })

      const merged = [...data, ...dataGajian].sort((a, b) => b.paidAt.localeCompare(a.paidAt))
      return NextResponse.json({
        data: merged,
      })
    }

    if (karyawanId) {
      const rows = await prisma.$queryRaw<Array<{ date: string; jumlah: number }>>`
        SELECT TO_CHAR("date", 'YYYY-MM-DD') as "date", "jumlah"
        FROM "AbsensiGajiHarian"
        WHERE "kebunId" = ${kebunId}
          AND "karyawanId" = ${karyawanId}
          AND "date" >= ${startKey}::DATE
          AND "date" <= ${endKey}::DATE
        ORDER BY "date" ASC
      `
      const kasRows = await prisma.kasTransaksi.findMany({
        where: {
          kebunId,
          karyawanId,
          kategori: 'GAJI',
          deletedAt: null,
          date: {
            gte: startUtc,
            lte: endUtc,
          },
        },
        select: { date: true, jumlah: true },
      })
      const merged = new Map<string, number>()
      rows.forEach(r => merged.set(r.date, (merged.get(r.date) || 0) + (Number(r.jumlah) || 0)))
      kasRows.forEach(r => {
        const key = dateToWibKey(r.date)
        merged.set(key, (merged.get(key) || 0) + (Number(r.jumlah) || 0))
      })
      return NextResponse.json({
        data: Array.from(merged.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, jumlah]) => ({ date, jumlah })),
      })
    }

    const agg = await prisma.$queryRaw<Array<{ karyawanId: number; total: number }>>`
      SELECT "karyawanId", SUM("jumlah") as "total"
      FROM "AbsensiGajiHarian"
      WHERE "kebunId" = ${kebunId}
        AND "date" >= ${startKey}::DATE
        AND "date" <= ${endKey}::DATE
      GROUP BY "karyawanId"
      ORDER BY "karyawanId" ASC
    `
    const ids = agg.map(a => a.karyawanId)
    const users = await prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    })
    const userMap = new Map(users.map(u => [u.id, u.name]))
    return NextResponse.json({
      data: agg.map(a => ({
        karyawanId: a.karyawanId,
        name: userMap.get(a.karyawanId) || '-',
        total: Number(a.total) || 0,
      })),
    })
  } catch (error) {
    console.error('GET /api/karyawan-kebun/absensi-payments error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    await ensureTable()
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const currentUserId = Number(session.user.id)
    if (!Number.isFinite(currentUserId) || currentUserId <= 0) {
      return NextResponse.json({ error: 'User tidak valid. Silakan login ulang.' }, { status: 401 })
    }
    const body = await request.json()
    const { kebunId, karyawanId, entries, createdAt } = body || {}
    if (kebunId === undefined || kebunId === null || !karyawanId || !Array.isArray(entries)) {
      return NextResponse.json({ error: 'kebunId, karyawanId, dan entries wajib diisi' }, { status: 400 })
    }
    const kebunIdNum = Number(kebunId)
    const karyawanIdNum = Number(karyawanId)
    if (!Number.isFinite(kebunIdNum) || kebunIdNum < 0 || !Number.isFinite(karyawanIdNum) || karyawanIdNum <= 0) {
      return NextResponse.json({ error: 'kebunId/karyawanId tidak valid' }, { status: 400 })
    }

    const [kebunExists, karyawanExists, creatorExists] = await Promise.all([
      kebunIdNum > 0 ? prisma.kebun.findUnique({ where: { id: kebunIdNum }, select: { id: true } }) : Promise.resolve({ id: 0 } as any),
      prisma.user.findUnique({ where: { id: karyawanIdNum }, select: { id: true } }),
      prisma.user.findUnique({ where: { id: currentUserId }, select: { id: true } }),
    ])
    if (kebunIdNum > 0 && !kebunExists) return NextResponse.json({ error: 'Kebun tidak ditemukan' }, { status: 400 })
    if (!karyawanExists) return NextResponse.json({ error: 'Karyawan tidak ditemukan' }, { status: 400 })
    if (!creatorExists) return NextResponse.json({ error: 'User pembuat transaksi tidak ditemukan' }, { status: 400 })

    const validEntries = entries
      .map((entry: any) => {
        const dateRaw = entry?.date
        const jumlah = Number(entry?.jumlah) || 0
        if (!dateRaw || jumlah <= 0) return null
        const ymd = parseWibYmd(String(dateRaw))
        if (!ymd) return null
        const dateKey = `${String(ymd.y).padStart(4, '0')}-${String(ymd.m).padStart(2, '0')}-${String(ymd.d).padStart(2, '0')}`
        return { dateKey, jumlah }
      })
      .filter(Boolean) as Array<{ dateKey: string; jumlah: number }>
    if (validEntries.length === 0) {
      return NextResponse.json({ ok: true })
    }

    const sortedByKey = [...validEntries].sort((a, b) => a.dateKey.localeCompare(b.dateKey))
    const startKey = sortedByKey[0]?.dateKey
    const endKey = sortedByKey[sortedByKey.length - 1]?.dateKey

    const existing = await prisma.$queryRaw<Array<{ date: string }>>`
      SELECT TO_CHAR("date", 'YYYY-MM-DD') as "date"
      FROM "AbsensiGajiHarian"
      WHERE "kebunId" = ${kebunIdNum}
        AND "karyawanId" = ${karyawanIdNum}
        AND "date" >= ${startKey}::DATE
        AND "date" <= ${endKey}::DATE
    `
    const existingSet = new Set(existing.map(e => e.date))
    const newEntries = sortedByKey.filter(e => !existingSet.has(e.dateKey))
    if (newEntries.length === 0) {
      return NextResponse.json({ ok: true })
    }

    const karyawan = await prisma.user.findUnique({
      where: { id: Number(karyawanId) },
      select: { name: true },
    })

    const batchCreatedAt = (() => {
      if (!createdAt) return new Date()
      const d = new Date(String(createdAt))
      if (Number.isNaN(d.getTime())) return new Date()
      return d
    })()
    const sortedEntries = [...newEntries].sort((a, b) => a.dateKey.localeCompare(b.dateKey))
    const startDate = sortedEntries[0]?.dateKey
    const endDate = sortedEntries[sortedEntries.length - 1]?.dateKey
    const totalJumlah = sortedEntries.reduce((acc, e) => acc + (Number(e.jumlah) || 0), 0)
    for (const entry of sortedEntries) {
      const date = entry.dateKey
      const jumlah = entry.jumlah
      await prisma.$executeRaw`
        INSERT INTO "AbsensiGajiHarian" ("kebunId","karyawanId","date","jumlah")
        VALUES (${kebunIdNum}, ${karyawanIdNum}, ${date}::DATE, ${jumlah})
        ON CONFLICT ("kebunId","karyawanId","date") DO NOTHING
      `
    }
    if (startDate && endDate && totalJumlah > 0) {
      const periodeText = startDate === endDate
        ? formatIdLongDateFromYmdKey(startDate)
        : `${formatIdLongDateFromYmdKey(startDate)} - ${formatIdLongDateFromYmdKey(endDate)}`
      const trxDate = (() => {
        const ymd = parseWibYmd(startDate)
        return ymd ? wibStartUtc(ymd) : new Date()
      })()
      const kasKebunId = kebunIdNum > 0 ? kebunIdNum : null
      await prisma.kasTransaksi.create({
        data: {
          date: trxDate,
          tipe: 'PENGELUARAN',
          deskripsi: `Pembayaran Gaji Harian - ${karyawan?.name || karyawanId}`,
          keterangan: `Periode ${periodeText}`,
          jumlah: totalJumlah,
          kategori: 'GAJI',
          kebunId: kasKebunId,
          karyawanId: karyawanIdNum,
          userId: currentUserId,
          createdAt: batchCreatedAt,
        },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('POST /api/karyawan-kebun/absensi-payments error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    await ensureTable()
    const session = await auth()
    if (!session?.user?.role) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!['ADMIN', 'PEMILIK', 'MANAGER', 'MANDOR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { searchParams } = new URL(request.url)
    const idParam = searchParams.get('id')
    const dateParam = searchParams.get('date')
    const paidAtParam = searchParams.get('paidAt')
    const kebunIdParam = searchParams.get('kebunId')
    const karyawanIdParam = searchParams.get('karyawanId')
    const id = idParam ? Number(idParam) : NaN
    if (idParam) {
      if (!id || Number.isNaN(id)) {
        return NextResponse.json({ error: 'id wajib diisi' }, { status: 400 })
      }
      const trx = await prisma.kasTransaksi.findUnique({
        where: { id },
        select: { id: true, kategori: true, kebunId: true, karyawanId: true, date: true, keterangan: true, createdAt: true },
      })
      if (!trx || trx.kategori !== 'GAJI') {
        return NextResponse.json({ error: 'Data tidak ditemukan' }, { status: 404 })
      }
      if (trx.kebunId) {
        const gajianLocked = await prisma.gajian.findFirst({
          where: {
            kebunId: trx.kebunId,
            status: 'FINALIZED',
            tanggalMulai: { lte: trx.date },
            tanggalSelesai: { gte: trx.date },
          },
          select: { id: true },
        })
        if (gajianLocked) {
          return NextResponse.json({ error: 'Pembayaran ini sudah masuk gajian. Hapus gajian terlebih dahulu.' }, { status: 400 })
        }
      }
      await prisma.jurnal.deleteMany({
        where: {
          refType: 'KasTransaksi',
          refId: id,
        },
      })
      await prisma.kasTransaksi.delete({
        where: { id },
      })
      if (trx.karyawanId) {
        await prisma.kasTransaksi.deleteMany({
          where: {
            kebunId: trx.kebunId ?? null,
            karyawanId: trx.karyawanId,
            kategori: 'PEMBAYARAN_HUTANG',
            createdAt: trx.createdAt,
          },
        })
      }
      if (trx.karyawanId) {
        const absensiKebunId = trx.kebunId ?? 0
        const dateKey = (() => {
          const wib = new Date(trx.date.getTime() + 7 * 60 * 60 * 1000)
          const y = wib.getUTCFullYear()
          const m = String(wib.getUTCMonth() + 1).padStart(2, '0')
          const d = String(wib.getUTCDate()).padStart(2, '0')
          return `${y}-${m}-${d}`
        })()
        const ymd = parseWibYmd(dateKey)
        const dayStart = ymd ? wibStartUtc(ymd) : trx.date
        const dayEnd = ymd ? wibEndUtcInclusive(ymd) : trx.date
        const remaining = await prisma.kasTransaksi.count({
          where: {
            kebunId: trx.kebunId,
            karyawanId: trx.karyawanId,
            kategori: 'GAJI',
            date: {
              gte: dayStart,
              lte: dayEnd,
            },
          },
        })
        if (remaining === 0) {
          await prisma.$executeRaw`
            DELETE FROM "AbsensiGajiHarian"
            WHERE "kebunId" = ${absensiKebunId}
              AND "karyawanId" = ${trx.karyawanId}
              AND "date" = ${dateKey}::DATE
          `
        }
      }
      return NextResponse.json({ ok: true })
    }

    if (kebunIdParam === null || kebunIdParam === undefined || karyawanIdParam === null || karyawanIdParam === undefined) {
      return NextResponse.json({ error: 'kebunId dan karyawanId wajib diisi' }, { status: 400 })
    }
    const kebunId = Number(kebunIdParam)
    const karyawanId = Number(karyawanIdParam)
    if (Number.isNaN(kebunId) || kebunId < 0 || Number.isNaN(karyawanId) || karyawanId <= 0) {
      return NextResponse.json({ error: 'Parameter tidak valid' }, { status: 400 })
    }
    const kasKebunId = kebunId > 0 ? kebunId : null
    if (paidAtParam) {
      const paidAt = new Date(paidAtParam)
      if (Number.isNaN(paidAt.getTime())) {
        return NextResponse.json({ error: 'paidAt tidak valid' }, { status: 400 })
      }
      const trxRows = await prisma.kasTransaksi.findMany({
        where: {
          kebunId: kasKebunId,
          karyawanId,
          kategori: 'GAJI',
          createdAt: paidAt,
        },
        select: { id: true, date: true, keterangan: true },
      })
      if (trxRows.length === 0) {
        return NextResponse.json({ error: 'Data tidak ditemukan' }, { status: 404 })
      }
      const minDate = trxRows.reduce((acc, r) => acc && acc < r.date ? acc : r.date, trxRows[0].date)
      const maxDate = trxRows.reduce((acc, r) => acc && acc > r.date ? acc : r.date, trxRows[0].date)
      if (kebunId > 0) {
        const gajianLocked = await prisma.gajian.findFirst({
          where: {
            kebunId,
            status: 'FINALIZED',
            tanggalMulai: { lte: maxDate },
            tanggalSelesai: { gte: minDate },
          },
          select: { id: true },
        })
        if (gajianLocked) {
          return NextResponse.json({ error: 'Pembayaran ini sudah masuk gajian. Hapus gajian terlebih dahulu.' }, { status: 400 })
        }
      }
      const ids = trxRows.map(r => r.id)
      await prisma.jurnal.deleteMany({
        where: { refType: 'KasTransaksi', refId: { in: ids } },
      })
      await prisma.kasTransaksi.deleteMany({
        where: { id: { in: ids } },
      })
      await prisma.kasTransaksi.deleteMany({
        where: {
          kebunId: kasKebunId,
          karyawanId,
          kategori: 'PEMBAYARAN_HUTANG',
          createdAt: paidAt,
        },
      })
      const period = parsePeriod(trxRows[0]?.keterangan)
      if (period) {
        const startDate = period.start
        const endDate = period.end
        await prisma.$executeRaw`
          DELETE FROM "AbsensiGajiHarian"
          WHERE "kebunId" = ${kebunId}
            AND "karyawanId" = ${karyawanId}
            AND "date" BETWEEN ${startDate}::DATE AND ${endDate}::DATE
        `
      } else {
        const uniqueDateKeys = Array.from(new Set(trxRows.map(r => {
          const wib = new Date(r.date.getTime() + 7 * 60 * 60 * 1000)
          const y = wib.getUTCFullYear()
          const m = String(wib.getUTCMonth() + 1).padStart(2, '0')
          const d = String(wib.getUTCDate()).padStart(2, '0')
          return `${y}-${m}-${d}`
        })))
        if (uniqueDateKeys.length > 0) {
          await prisma.$executeRaw`
            DELETE FROM "AbsensiGajiHarian"
            WHERE "kebunId" = ${kebunId}
              AND "karyawanId" = ${karyawanId}
              AND "date" IN (${Prisma.join(uniqueDateKeys.map(k => Prisma.sql`${k}::DATE`))})
          `
        }
      }
      return NextResponse.json({ ok: true })
    }
    if (!dateParam) {
      return NextResponse.json({ error: 'date wajib diisi' }, { status: 400 })
    }
    const dateYmd = parseWibYmd(dateParam)
    if (!dateYmd) {
      return NextResponse.json({ error: 'date tidak valid' }, { status: 400 })
    }
    const dateKey = `${String(dateYmd.y).padStart(4, '0')}-${String(dateYmd.m).padStart(2, '0')}-${String(dateYmd.d).padStart(2, '0')}`
    const dayStart = wibStartUtc(dateYmd)
    const dayEnd = wibEndUtcInclusive(dateYmd)
    if (kebunId > 0) {
      const gajianLocked = await prisma.gajian.findFirst({
        where: {
          kebunId,
          status: 'FINALIZED',
          tanggalMulai: { lte: dayStart },
          tanggalSelesai: { gte: dayStart },
        },
        select: { id: true },
      })
      if (gajianLocked) {
        return NextResponse.json({ error: 'Pembayaran ini sudah masuk gajian. Hapus gajian terlebih dahulu.' }, { status: 400 })
      }
    }
    const trxRows = await prisma.kasTransaksi.findMany({
      where: {
        kebunId: kasKebunId,
        karyawanId,
        kategori: 'GAJI',
        date: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
      select: { id: true },
    })
    const ids = trxRows.map(r => r.id)
    if (ids.length > 0) {
      await prisma.jurnal.deleteMany({
        where: { refType: 'KasTransaksi', refId: { in: ids } },
      })
      await prisma.kasTransaksi.deleteMany({
        where: { id: { in: ids } },
      })
    }
    await prisma.$executeRaw`
      DELETE FROM "AbsensiGajiHarian"
      WHERE "kebunId" = ${kebunId}
        AND "karyawanId" = ${karyawanId}
        AND "date" = ${dateKey}::DATE
    `
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/karyawan-kebun/absensi-payments error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
