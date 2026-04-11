import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/route-auth'
import { createAuditLog } from '@/lib/audit'
import { scheduleFileDeletion } from '@/lib/file-retention'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR'])
    if (guard.response) return guard.response
    const { ids } = await request.json()

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ message: 'IDs tidak valid' }, { status: 400 })
    }

    const uniqIds = Array.from(new Set(ids.map((v: any) => Number(v)).filter((v: number) => Number.isFinite(v) && v > 0)))
    if (uniqIds.length === 0) {
      return NextResponse.json({ message: 'IDs tidak valid' }, { status: 400 })
    }

    const linked = await prisma.detailGajian.findMany({
      where: { notaSawitId: { in: uniqIds } },
      select: { notaSawitId: true },
      take: 50,
    })
    if (linked.length > 0) {
      const blocked = Array.from(new Set(linked.map((l) => l.notaSawitId)))
      return NextResponse.json(
        { message: 'Sebagian nota sudah terikat Gajian dan tidak bisa dihapus', blockedIds: blocked },
        { status: 409 }
      )
    }

    const now = new Date()
    const notas = await prisma.notaSawit.findMany({
      where: { id: { in: uniqIds }, deletedAt: null },
      select: { id: true, gambarNotaUrl: true },
    })
    const imageUrls = notas.map((n) => n.gambarNotaUrl).filter((u): u is string => !!u)

    const fallbackPrefixes = notas.map((n) => `Penjualan Sawit #${n.id} -`)
    const trxRows = await prisma.kasTransaksi.findMany({
      where: {
        deletedAt: null,
        kategori: 'PENJUALAN_SAWIT',
        OR: [
          { notaSawitId: { in: notas.map((n) => n.id) } } as any,
          ...fallbackPrefixes.map((p) => ({ deskripsi: { startsWith: p } })),
        ],
      } as any,
      select: { id: true, gambarUrl: true },
    })
    const trxIds = trxRows.map((t) => t.id)
    const trxImages = trxRows.map((t) => t.gambarUrl).filter((u): u is string => !!u)

    const deletedCount = await prisma.$transaction(async (tx) => {
      if (trxIds.length > 0) {
        await tx.jurnal.deleteMany({
          where: {
            refType: 'KasTransaksi',
            refId: { in: trxIds },
          },
        })
        await tx.kasTransaksi.updateMany({
          where: { id: { in: trxIds } },
          data: { deletedAt: now, deletedById: guard.id },
        })
      }
      const res = await tx.notaSawit.updateMany({
        where: { id: { in: notas.map((n) => n.id) } },
        data: { deletedAt: now, deletedById: guard.id },
      })
      return res
    })

    for (const url of imageUrls) {
      await scheduleFileDeletion({ url, entity: 'NotaSawit', entityId: 'BULK', reason: 'DELETE_NOTA' }).catch(() => {})
    }
    for (const url of trxImages) {
      await scheduleFileDeletion({ url, entity: 'KasTransaksi', entityId: 'BULK', reason: 'DELETE_NOTA' }).catch(() => {})
    }

    await createAuditLog(guard.id, 'DELETE', 'NotaSawit', 'BULK', {
      count: deletedCount.count,
      ids: uniqIds.slice(0, 500),
    })

    return NextResponse.json({ message: `${deletedCount.count} nota berhasil dihapus` })
  } catch (error) {
    console.error('Gagal menghapus nota:', error)
    return NextResponse.json({ message: 'Gagal menghapus nota' }, { status: 500 })
  }
}
