import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/route-auth'

async function hasPpnTable() {
  const rows = await prisma.$queryRaw<any[]>(
    Prisma.sql`SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'PerusahaanPpnReport'
    ) AS "exists"`
  )
  return Boolean(rows?.[0]?.exists)
}

function monthName(month: number) {
  const m = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
  return m[month - 1] || String(month)
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR', 'MANAGER'])
    if (guard.response) return guard.response

    const perusahaanId = Number(params.id)
    if (!perusahaanId) return NextResponse.json({ error: 'perusahaanId tidak valid' }, { status: 400 })

    const { searchParams } = new URL(request.url)
    const year = Number(searchParams.get('year') || new Date().getFullYear())
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ error: 'year tidak valid' }, { status: 400 })
    }

    const invoiceAgg = await prisma.invoiceTbs.groupBy({
      by: ['month'],
      where: { perusahaanId, year },
      _sum: { totalPpn: true, totalRp: true, grandTotal: true },
    })
    const invoiceByMonth = new Map<number, { ppn: number; dpp: number; grand: number }>()
    invoiceAgg.forEach((r) => {
      invoiceByMonth.set(Number(r.month), {
        ppn: Number(r._sum.totalPpn || 0),
        dpp: Number(r._sum.totalRp || 0),
        grand: Number(r._sum.grandTotal || 0),
      })
    })

    const exists = await hasPpnTable()
    const savedByMonth = new Map<number, any>()
    if (exists) {
      const rows = await prisma.$queryRaw<any[]>(
        Prisma.sql`SELECT "month","ppnMasukan","ppnKeluaranOverride","sptFileName","sptFileUrl","status","submittedAt","createdAt","updatedAt"
                   FROM "PerusahaanPpnReport"
                   WHERE "perusahaanId" = ${perusahaanId}
                     AND "year" = ${year}
                   ORDER BY "month" ASC`
      )
      ;(rows || []).forEach((r) => savedByMonth.set(Number(r.month), r))
    }

    const data = Array.from({ length: 12 }).map((_, idx) => {
      const month = idx + 1
      const inv = invoiceByMonth.get(month) || { ppn: 0, dpp: 0, grand: 0 }
      const saved = savedByMonth.get(month)
      const ppnKeluaran = saved?.ppnKeluaranOverride != null ? Number(saved.ppnKeluaranOverride) : inv.ppn
      const ppnMasukan = saved?.ppnMasukan != null ? Number(saved.ppnMasukan) : 0
      const ppnTerutang = Math.max(0, ppnKeluaran - ppnMasukan)
      return {
        year,
        month,
        label: `${monthName(month)} ${year}`,
        dpp: inv.dpp,
        ppnKeluaran,
        ppnMasukan,
        ppnTerutang,
        status: String(saved?.status || 'DRAFT'),
        sptFileName: saved?.sptFileName || null,
        sptFileUrl: saved?.sptFileUrl || null,
        submittedAt: saved?.submittedAt || null,
        updatedAt: saved?.updatedAt || null,
      }
    })

    return NextResponse.json({ data })
  } catch (error) {
    console.error('GET /api/perusahaan/[id]/ppn error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR', 'MANAGER'])
    if (guard.response) return guard.response

    const perusahaanId = Number(params.id)
    if (!perusahaanId) return NextResponse.json({ error: 'perusahaanId tidak valid' }, { status: 400 })

    const exists = await hasPpnTable()
    if (!exists) {
      return NextResponse.json({ error: 'Tabel PPN belum ada. Jalankan migrasi Prisma terlebih dahulu.' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({} as any))
    const year = Number(body?.year || new Date().getFullYear())
    const month = Number(body?.month)
    if (!Number.isFinite(year) || year < 2000 || year > 2100) return NextResponse.json({ error: 'year tidak valid' }, { status: 400 })
    if (!Number.isFinite(month) || month < 1 || month > 12) return NextResponse.json({ error: 'month tidak valid' }, { status: 400 })

    const ppnMasukan = body?.ppnMasukan == null ? null : Number(body.ppnMasukan)
    const ppnKeluaranOverride = body?.ppnKeluaranOverride == null ? null : Number(body.ppnKeluaranOverride)
    const status = body?.status ? String(body.status).toUpperCase() : null
    const sptFileName = body?.sptFileName ? String(body.sptFileName) : null
    const sptFileUrl = body?.sptFileUrl ? String(body.sptFileUrl) : null

    const submittedAt = status === 'SUBMITTED' ? Prisma.sql`NOW()` : Prisma.sql`"submittedAt"`

    const rows = await prisma.$queryRaw<any[]>(
      Prisma.sql`
        INSERT INTO "PerusahaanPpnReport"
          ("perusahaanId","year","month","ppnMasukan","ppnKeluaranOverride","sptFileName","sptFileUrl","status","submittedAt","createdById","createdAt","updatedAt")
        VALUES
          (${perusahaanId}, ${year}, ${month},
           ${ppnMasukan ?? 0},
           ${ppnKeluaranOverride},
           ${sptFileName},
           ${sptFileUrl},
           ${status ?? 'DRAFT'},
           ${status === 'SUBMITTED' ? Prisma.sql`NOW()` : null},
           ${guard.id},
           NOW(),
           NOW())
        ON CONFLICT ("perusahaanId","year","month") DO UPDATE SET
          "ppnMasukan" = COALESCE(${ppnMasukan}, "PerusahaanPpnReport"."ppnMasukan"),
          "ppnKeluaranOverride" = COALESCE(${ppnKeluaranOverride}, "PerusahaanPpnReport"."ppnKeluaranOverride"),
          "sptFileName" = COALESCE(${sptFileName}, "PerusahaanPpnReport"."sptFileName"),
          "sptFileUrl" = COALESCE(${sptFileUrl}, "PerusahaanPpnReport"."sptFileUrl"),
          "status" = COALESCE(${status}, "PerusahaanPpnReport"."status"),
          "submittedAt" = ${submittedAt},
          "updatedAt" = NOW()
        RETURNING "id","perusahaanId","year","month","ppnMasukan","ppnKeluaranOverride","sptFileName","sptFileUrl","status","submittedAt","createdAt","updatedAt"
      `
    )

    return NextResponse.json({ data: rows?.[0] })
  } catch (error) {
    console.error('PUT /api/perusahaan/[id]/ppn error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
