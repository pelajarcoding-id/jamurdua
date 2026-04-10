import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/route-auth'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  const guard = await requireRole(['ADMIN'])
  if (guard.response) return guard.response

  const { searchParams } = new URL(request.url)
  const limit = Math.min(Math.max(Number(searchParams.get('limit') || '50'), 1), 200)

  const [kasir, notaSawit, inventory, sesiUangJalan] = await Promise.all([
    prisma.kasTransaksi.findMany({
      where: { deletedAt: { not: null } },
      orderBy: { deletedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        date: true,
        tipe: true,
        deskripsi: true,
        jumlah: true,
        kategori: true,
        gambarUrl: true,
        deletedAt: true,
        deletedById: true,
      },
    }),
    prisma.notaSawit.findMany({
      where: { deletedAt: { not: null } },
      orderBy: { deletedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        tanggalBongkar: true,
        totalPembayaran: true,
        statusPembayaran: true,
        kendaraanPlatNomor: true,
        gambarNotaUrl: true,
        deletedAt: true,
        deletedById: true,
        supir: { select: { id: true, name: true } },
        pabrikSawit: { select: { id: true, name: true } },
      },
    }),
    prisma.inventoryItem.findMany({
      where: { deletedAt: { not: null } },
      orderBy: { deletedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        sku: true,
        name: true,
        unit: true,
        category: true,
        stock: true,
        imageUrl: true,
        deletedAt: true,
        deletedById: true,
      },
    }),
    prisma.sesiUangJalan.findMany({
      where: { deletedAt: { not: null } },
      orderBy: { deletedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        tanggalMulai: true,
        status: true,
        keterangan: true,
        kendaraanPlatNomor: true,
        deletedAt: true,
        deletedById: true,
        supir: { select: { id: true, name: true } },
      },
    }),
  ])

  const deletedByIds = Array.from(
    new Set(
      [
        ...kasir.map((x) => x.deletedById).filter((v): v is number => typeof v === 'number'),
        ...notaSawit.map((x) => x.deletedById).filter((v): v is number => typeof v === 'number'),
        ...inventory.map((x) => x.deletedById).filter((v): v is number => typeof v === 'number'),
        ...sesiUangJalan.map((x) => x.deletedById).filter((v): v is number => typeof v === 'number'),
      ].filter((v) => Number.isFinite(v))
    )
  )

  const deletedByUsers =
    deletedByIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: deletedByIds } },
          select: { id: true, name: true },
        })
      : []

  const deletedByMap = new Map<number, { id: number; name: string }>(
    deletedByUsers.map((u) => [u.id, { id: u.id, name: u.name }])
  )

  const withDeletedBy = <T extends { deletedById: number | null }>(rows: T[]) =>
    rows.map((r) => ({
      ...r,
      deletedBy: r.deletedById != null ? deletedByMap.get(r.deletedById) ?? null : null,
      deletedByName: r.deletedById != null ? (deletedByMap.get(r.deletedById)?.name ?? null) : null,
    }))

  return NextResponse.json({
    kasir: withDeletedBy(kasir),
    notaSawit: withDeletedBy(notaSawit),
    inventory: withDeletedBy(inventory),
    sesiUangJalan: withDeletedBy(sesiUangJalan),
  })
}
