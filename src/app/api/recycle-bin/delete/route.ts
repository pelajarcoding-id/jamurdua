import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/route-auth'
import { createAuditLog } from '@/lib/audit'
import { scheduleFileDeletion } from '@/lib/file-retention'

export const dynamic = 'force-dynamic'

export async function DELETE(request: Request) {
  const guard = await requireRole(['ADMIN'])
  if (guard.response) return guard.response

  const { searchParams } = new URL(request.url)
  const entity = String(searchParams.get('entity') || '').toUpperCase()
  const id = Number(searchParams.get('id'))

  if (!entity || !id) {
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
  }

  try {
    if (entity === 'KASIR') {
      const trx = await prisma.kasTransaksi.findUnique({ where: { id } })
      if (!trx || !(trx as any).deletedAt) return NextResponse.json({ error: 'Not found in recycle bin' }, { status: 404 })
      
      await prisma.jurnal.deleteMany({ where: { refType: 'KasTransaksi', refId: id } })
      await prisma.kasTransaksi.delete({ where: { id } })
      await createAuditLog(guard.id, 'PERMANENT_DELETE', 'KasTransaksi', String(id), { deskripsi: trx.deskripsi })
    } 
    else if (entity === 'NOTA_SAWIT') {
      const nota = await prisma.notaSawit.findUnique({ where: { id } })
      if (!nota || !(nota as any).deletedAt) return NextResponse.json({ error: 'Not found in recycle bin' }, { status: 404 })
      
      await prisma.notaSawit.delete({ where: { id } })
      await createAuditLog(guard.id, 'PERMANENT_DELETE', 'NotaSawit', String(id), { plat: nota.kendaraanPlatNomor })
    }
    else if (entity === 'INVENTORY_ITEM') {
      const item = await prisma.inventoryItem.findUnique({ where: { id } })
      if (!item || !(item as any).deletedAt) return NextResponse.json({ error: 'Not found in recycle bin' }, { status: 404 })
      
      await prisma.inventoryItem.delete({ where: { id } })
      await createAuditLog(guard.id, 'PERMANENT_DELETE', 'InventoryItem', String(id), { name: item.name })
    }
    else if (entity === 'SESI_UANG_JALAN') {
      const sesi = await prisma.sesiUangJalan.findUnique({
        where: { id },
        include: {
          rincian: { select: { id: true, gambarUrl: true } },
        },
      })
      if (!sesi || !(sesi as any).deletedAt) return NextResponse.json({ error: 'Not found in recycle bin' }, { status: 404 })

      const rincianImages = (sesi.rincian || []).map((r) => r.gambarUrl).filter((u): u is string => !!u)
      const rincianCount = Array.isArray(sesi.rincian) ? sesi.rincian.length : 0

      await prisma.$transaction([
        prisma.uangJalan.deleteMany({ where: { sesiUangJalanId: id } }),
        prisma.sesiUangJalan.delete({ where: { id } }),
      ])

      for (const url of rincianImages) {
        await scheduleFileDeletion({
          url,
          entity: 'UangJalan',
          entityId: String(id),
          reason: 'PERMANENT_DELETE_SESI_UANG_JALAN',
        })
      }

      await createAuditLog(guard.id, 'PERMANENT_DELETE', 'SesiUangJalan', String(id), { keterangan: sesi.keterangan, rincianCount })
    }
    else {
      return NextResponse.json({ error: 'Unknown entity' }, { status: 400 })
    }

    return NextResponse.json({ ok: true, message: 'Berhasil hapus permanen' })
  } catch (error: any) {
    console.error('DELETE /api/recycle-bin error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
