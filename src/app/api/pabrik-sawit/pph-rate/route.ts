import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/route-auth'
import { parseWibYmd, wibStartUtc } from '@/lib/wib'
import { getNotaSawitPphRate } from '@/lib/nota-sawit-pph'
import { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR', 'SUPIR', 'MANAGER'])
    if (guard.response) return guard.response

    const url = new URL(request.url)
    const pabrikId = Number(url.searchParams.get('pabrikId') || '')
    if (!Number.isFinite(pabrikId) || pabrikId <= 0) return NextResponse.json({ error: 'pabrikId tidak valid' }, { status: 400 })

    const tanggalRaw = String(url.searchParams.get('tanggal') || '').trim()
    const ymd = tanggalRaw ? parseWibYmd(tanggalRaw) : null
    const tanggal = ymd ? wibStartUtc(ymd) : null

    const perusahaanIdParamRaw = url.searchParams.get('perusahaanId')
    const perusahaanIdParam = perusahaanIdParamRaw ? Number(perusahaanIdParamRaw) : null

    const hasLinkTable = async () => {
      const rows = await prisma.$queryRaw<any[]>(
        Prisma.sql`SELECT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'PabrikSawitPerusahaan'
        ) AS "exists"`,
      )
      return Boolean(rows?.[0]?.exists)
    }

    const linkExists = await hasLinkTable().catch(() => false)
    const linkedIds = linkExists
      ? await prisma.$queryRaw<any[]>(
          Prisma.sql`SELECT "perusahaanId"::int as id, "isDefault"::boolean as "isDefault" FROM "PabrikSawitPerusahaan" WHERE "pabrikSawitId" = ${pabrikId}`,
        )
      : []
    const allowed = new Set<number>((linkedIds || []).map((r) => Number(r?.id)).filter((n) => Number.isFinite(n) && n > 0))
    const defaultFromLink = (linkedIds || []).find((r) => Boolean(r?.isDefault))
    const defaultLinkId = defaultFromLink ? Number(defaultFromLink.id) : null

    const pabrik = await prisma.pabrikSawit.findUnique({ where: { id: pabrikId }, select: { perusahaanId: true } as any })
    const defaultPabrikId = (pabrik as any)?.perusahaanId ? Number((pabrik as any).perusahaanId) : null

    const perusahaanId = (() => {
      if (perusahaanIdParam && Number.isFinite(perusahaanIdParam) && perusahaanIdParam > 0) {
        if (allowed.size > 0 && !allowed.has(perusahaanIdParam)) return null
        return perusahaanIdParam
      }
      if (defaultPabrikId && Number.isFinite(defaultPabrikId) && defaultPabrikId > 0) return defaultPabrikId
      if (defaultLinkId && Number.isFinite(defaultLinkId) && defaultLinkId > 0) return defaultLinkId
      if (allowed.size === 1) return Array.from(allowed)[0]
      return null
    })()

    if (!perusahaanId) return NextResponse.json({ data: { pabrikId, pphRate: 0.0025 } })

    const pphRate = await getNotaSawitPphRate({ perusahaanId, tanggal })
    return NextResponse.json({ data: { pabrikId, perusahaanId, pphRate } })
  } catch (error) {
    console.error('GET /api/pabrik-sawit/pph-rate error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
