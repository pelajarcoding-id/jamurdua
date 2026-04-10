import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/route-auth'
import { createAuditLog } from '@/lib/audit'

async function recreateKasirJurnal(trx: any) {
  const amount = Number(trx.jumlah || 0)
  if (!Number.isFinite(amount) || amount <= 0) return

  await prisma.jurnal.deleteMany({ where: { refType: 'KasTransaksi', refId: trx.id } })

  if (trx.tipe === 'PENGELUARAN') {
    let bebanAkun = 'Beban Operasional'
    if (trx.kendaraanPlatNomor) {
      bebanAkun = `Beban Kendaraan:${trx.kendaraanPlatNomor}`
    } else if (trx.kebunId) {
      const kb = await prisma.kebun.findUnique({ where: { id: Number(trx.kebunId) }, select: { name: true } })
      bebanAkun = `Beban Kebun:${kb?.name || trx.kebunId}`
    } else if (trx.karyawanId) {
      const usr = await prisma.user.findUnique({
        where: { id: Number(trx.karyawanId) },
        select: { name: true, role: true },
      })
      bebanAkun =
        usr?.role === 'SUPIR'
          ? `Beban Gaji Supir:${usr?.name || trx.karyawanId}`
          : `Beban Karyawan:${usr?.name || trx.karyawanId}`
    }

    await prisma.jurnal.createMany({
      data: [
        {
          date: trx.date,
          akun: bebanAkun,
          deskripsi: trx.deskripsi,
          debit: amount,
          kredit: 0,
          refType: 'KasTransaksi',
          refId: trx.id,
        },
        {
          date: trx.date,
          akun: 'Kas',
          deskripsi: trx.deskripsi,
          debit: 0,
          kredit: amount,
          refType: 'KasTransaksi',
          refId: trx.id,
        },
      ],
    })
  } else if (trx.tipe === 'PEMASUKAN') {
    const kreditAkun = trx.karyawanId ? 'Setoran Karyawan' : 'Pendapatan Lain-lain'
    await prisma.jurnal.createMany({
      data: [
        {
          date: trx.date,
          akun: 'Kas',
          deskripsi: trx.deskripsi,
          debit: amount,
          kredit: 0,
          refType: 'KasTransaksi',
          refId: trx.id,
        },
        {
          date: trx.date,
          akun: kreditAkun,
          deskripsi: trx.deskripsi,
          debit: 0,
          kredit: amount,
          refType: 'KasTransaksi',
          refId: trx.id,
        },
      ],
    })
  }
}

export async function POST(request: Request) {
  const guard = await requireRole(['ADMIN'])
  if (guard.response) return guard.response

  const body = await request.json().catch(() => null)
  const entity = String(body?.entity || '').toUpperCase()
  const id = Number(body?.id)

  if (!entity || !id) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  if (entity === 'KASIR') {
    const trx = await prisma.kasTransaksi.findUnique({ where: { id } })
    if (!trx || !(trx as any).deletedAt) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const restored = await prisma.kasTransaksi.update({
      where: { id },
      data: { deletedAt: null, deletedById: null } as any,
    })
    await recreateKasirJurnal(restored)
    await createAuditLog(guard.id, 'RESTORE', 'KasTransaksi', String(id), {})
    return NextResponse.json({ ok: true })
  }

  if (entity === 'NOTA_SAWIT') {
    const nota = await prisma.notaSawit.findUnique({ where: { id } })
    if (!nota || !(nota as any).deletedAt) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await prisma.notaSawit.update({ where: { id }, data: { deletedAt: null, deletedById: null } as any })
    await createAuditLog(guard.id, 'RESTORE', 'NotaSawit', String(id), {})
    return NextResponse.json({ ok: true })
  }

  if (entity === 'INVENTORY_ITEM') {
    const item = await prisma.inventoryItem.findUnique({ where: { id } })
    if (!item || !(item as any).deletedAt) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await prisma.inventoryItem.update({ where: { id }, data: { deletedAt: null, deletedById: null } as any })
    await createAuditLog(guard.id, 'RESTORE', 'InventoryItem', String(id), {})
    return NextResponse.json({ ok: true })
  }

  if (entity === 'SESI_UANG_JALAN') {
    const sesi = await prisma.sesiUangJalan.findUnique({ where: { id } })
    if (!sesi || !(sesi as any).deletedAt) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await prisma.$transaction(async (tx) => {
      await tx.sesiUangJalan.update({ where: { id }, data: { deletedAt: null, deletedById: null } as any })
      await tx.uangJalan.updateMany({
        where: { sesiUangJalanId: id, deletedAt: { not: null } },
        data: { deletedAt: null, deletedById: null } as any,
      })
    })
    await createAuditLog(guard.id, 'RESTORE', 'SesiUangJalan', String(id), {})
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Entity not supported' }, { status: 400 })
}
