import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { getWibMonthRangeUtc } from '@/lib/wib'

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
    const monthRange = getWibMonthRangeUtc(searchParams.get('month') || defaultMonthKey())
    if (!monthRange) return NextResponse.json({ error: 'month tidak valid' }, { status: 400 })
    const kebunIdParam = searchParams.get('kebunId')
    const kebunId = kebunIdParam ? Number(kebunIdParam) : null

    const gajianRows: Array<{
      kebunId: number
      totalGajian: any
      totalGaji: any
      totalBiayaLain: any
      totalPotongan: any
    }> = await prisma.$queryRaw(
      Prisma.sql`SELECT "kebunId",
                        COUNT(*)::int AS "totalGajian",
                        COALESCE(SUM("totalGaji"),0) AS "totalGaji",
                        COALESCE(SUM("totalBiayaLain"),0) AS "totalBiayaLain",
                        COALESCE(SUM("totalPotongan"),0) AS "totalPotongan"
                 FROM "Gajian"
                 WHERE "status" = 'FINALIZED'
                   AND "tanggalMulai" < ${monthRange.endExclusiveUtc}
                   AND "tanggalSelesai" >= ${monthRange.startUtc}
                   ${kebunId ? Prisma.sql`AND "kebunId" = ${kebunId}` : Prisma.empty}
                 GROUP BY "kebunId"`
    )

    const kasRows: Array<{ kebunId: number; total: any }> = await prisma.$queryRaw(
      Prisma.sql`SELECT "kebunId",
                        COALESCE(SUM("jumlah"),0) AS total
                 FROM "KasTransaksi"
                 WHERE "deletedAt" IS NULL
                   AND "tipe" = 'PENGELUARAN'
                   AND COALESCE("kategori",'') = 'GAJI'
                   AND "date" >= ${monthRange.startUtc}
                   AND "date" < ${monthRange.endExclusiveUtc}
                   AND "kebunId" IS NOT NULL
                   ${kebunId ? Prisma.sql`AND "kebunId" = ${kebunId}` : Prisma.empty}
                 GROUP BY "kebunId"`
    )

    const kebunIds = Array.from(
      new Set<number>([
        ...gajianRows.map((r) => Number(r.kebunId)),
        ...kasRows.map((r) => Number(r.kebunId)),
      ])
    )

    if (kebunId && !kebunIds.includes(kebunId)) {
      kebunIds.push(kebunId)
    }

    const kebuns = kebunIds.length
      ? await prisma.kebun.findMany({ where: { id: { in: kebunIds } }, select: { id: true, name: true } })
      : []
    const kebunNameMap = new Map(kebuns.map((k) => [k.id, k.name]))

    const gajianMap = new Map<number, { totalGajian: number; gajiFinalized: number }>()
    for (const r of gajianRows) {
      const gajiFinalized = Number(r.totalGaji || 0) + Number(r.totalBiayaLain || 0) - Number(r.totalPotongan || 0)
      gajianMap.set(Number(r.kebunId), { totalGajian: Number(r.totalGajian || 0), gajiFinalized })
    }

    const kasMap = new Map<number, number>()
    for (const r of kasRows) {
      kasMap.set(Number(r.kebunId), Number(r.total || 0))
    }

    const result = kebunIds
      .map((idNum) => {
        const g = gajianMap.get(idNum)
        const gajiFinalized = g?.gajiFinalized || 0
        const totalGajian = g?.totalGajian || 0
        const gajiHarian = kasMap.get(idNum) || 0
        const totalBiayaGaji = gajiFinalized + gajiHarian
        return {
          kebunId: idNum,
          kebunName: kebunNameMap.get(idNum) || `Kebun #${idNum}`,
          totalGajian,
          gajiFinalized,
          gajiHarian,
          totalBiayaGaji,
        }
      })
      .sort((a, b) => a.kebunName.localeCompare(b.kebunName))

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching gaji-karyawan report:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
