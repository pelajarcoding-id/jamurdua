import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/route-auth'
import { createAuditLog } from '@/lib/audit'
import { parseWibYmd, wibStartUtc } from '@/lib/wib'

export const dynamic = 'force-dynamic'

type AlokasiMetode = 'PROPORSIONAL' | 'RATA' | 'SATU_NOTA'

const roundInt = (v: any) => Math.round(Number(v) || 0)

const allocateAdmin = (args: {
  metodeAlokasi: AlokasiMetode
  adminBank: number
  bebankanNotaId: number | null
  entries: Array<{ notaId: number; tagihanNet: number }>
}) => {
  const { metodeAlokasi, adminBank, bebankanNotaId, entries } = args
  const adminMap: Record<number, number> = {}
  entries.forEach((e) => {
    adminMap[e.notaId] = 0
  })
  const count = entries.length
  if (adminBank <= 0 || count === 0) return adminMap

  if (metodeAlokasi === 'RATA') {
    const base = Math.floor(adminBank / count)
    let rem = adminBank - base * count
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

  const totalTagihan = entries.reduce((sum, e) => sum + (e.tagihanNet || 0), 0)
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

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR'])
    if (guard.response) return guard.response

    const batchId = Number(params.id)
    if (!Number.isFinite(batchId) || batchId <= 0) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })

    const body = await request.json().catch(() => ({}))
    const idsRaw = Array.isArray(body?.ids) ? (body.ids as any[]) : null
    const uniqueIds = idsRaw
      ? Array.from(new Set(idsRaw.map((v: any) => Number(v)).filter((n: number) => Number.isFinite(n) && n > 0)))
      : null
    const setLunas = body?.setLunas !== undefined ? body?.setLunas !== false : null
    const tanggalRaw = String(body?.tanggal || '').trim()
    const ymd = tanggalRaw ? parseWibYmd(tanggalRaw) : null
    const tanggal = ymd ? wibStartUtc(ymd) : null
    const jumlahMasuk = body?.jumlahMasuk === undefined || body?.jumlahMasuk === null ? null : roundInt(body?.jumlahMasuk)
    const adminBank = body?.adminBank === undefined || body?.adminBank === null ? null : Math.max(0, roundInt(body?.adminBank))
    const keterangan = body?.keterangan !== undefined && body?.keterangan !== null ? String(body.keterangan).trim() : null
    const gambarUrl = body?.gambarUrl !== undefined ? (body?.gambarUrl ? String(body.gambarUrl).trim() : null) : undefined

    if (!tanggal) return NextResponse.json({ error: 'Tanggal tidak valid' }, { status: 400 })
    if (jumlahMasuk !== null && jumlahMasuk < 0) return NextResponse.json({ error: 'Nominal masuk tidak valid' }, { status: 400 })
    if (uniqueIds && uniqueIds.length === 0) return NextResponse.json({ error: 'Pilih minimal 1 nota' }, { status: 400 })

    const result = await prisma.$transaction(async (tx) => {
      const batch = await (tx as any).notaSawitPembayaranBatch.findUnique({
        where: { id: batchId },
        include: {
          pabrikSawit: true,
          items: {
            select: {
              id: true,
              notaSawitId: true,
              tagihanNet: true,
              notaSawit: { select: { tanggalBongkar: true, kebunId: true, timbangan: { select: { kebunId: true } } } },
            },
          },
        },
      })
      if (!batch) throw new Error('NOT_FOUND')

      const existingNotaIds: number[] = (Array.isArray(batch.items) ? batch.items : [])
        .map((i: any) => Number(i?.notaSawitId))
        .filter((n: number) => Number.isFinite(n) && n > 0)
      if (existingNotaIds.length === 0) throw new Error('EMPTY')

      const metodeAlokasi = String(batch.metodeAlokasi || 'PROPORSIONAL').toUpperCase() as AlokasiMetode
      const bebankanNotaId = batch.bebankanNotaId ? Number(batch.bebankanNotaId) : null
      const nextJumlahMasuk = jumlahMasuk === null ? roundInt(batch.jumlahMasuk) : jumlahMasuk
      const nextAdminBank = adminBank === null ? Math.max(0, roundInt(batch.adminBank)) : adminBank

      const targetNotaIds = uniqueIds || existingNotaIds
      const newer = await (tx as any).notaSawitPembayaranBatchItem.findFirst({
        where: { notaSawitId: { in: targetNotaIds }, batchId: { gt: batchId } },
        select: { id: true, batchId: true, notaSawitId: true },
      })
      if (newer) throw new Error('LOCKED')

      const targetNotas = uniqueIds
        ? await tx.notaSawit.findMany({
            where: { id: { in: targetNotaIds }, deletedAt: null },
            select: {
              id: true,
              pabrikSawitId: true,
              pembayaranSetelahPph: true,
              totalPembayaran: true,
              tanggalBongkar: true,
              kebunId: true,
              timbangan: { select: { kebunId: true } },
            },
          })
        : null
      if (uniqueIds) {
        if (!targetNotas || targetNotas.length !== targetNotaIds.length) {
          throw new Error('NOTA_NOT_FOUND')
        }
        const mismatch = (targetNotas as any[]).some((n) => Number(n.pabrikSawitId) !== Number(batch.pabrikSawitId))
        if (mismatch) throw new Error('PABRIK_MISMATCH')
      }

      const entries: Array<{ notaId: number; tagihanNet: number; tanggalBongkar: Date | null; kebunId: number }> = uniqueIds
        ? (targetNotas as any[]).map((n) => ({
            notaId: Number(n.id),
            tagihanNet: roundInt(n.pembayaranSetelahPph ?? n.totalPembayaran ?? 0),
            tanggalBongkar: n.tanggalBongkar ? new Date(n.tanggalBongkar) : null,
            kebunId: Number(n.timbangan?.kebunId || n.kebunId || 0),
          }))
        : (Array.isArray(batch.items) ? batch.items : []).map((i: any) => ({
            notaId: Number(i.notaSawitId),
            tagihanNet: roundInt(i.tagihanNet),
            tanggalBongkar: i?.notaSawit?.tanggalBongkar ? new Date(i.notaSawit.tanggalBongkar) : null,
            kebunId: Number(i?.notaSawit?.timbangan?.kebunId || i?.notaSawit?.kebunId || 0),
          }))

      const adminEntries = entries.map((e) => ({ notaId: e.notaId, tagihanNet: e.tagihanNet }))
      const adminMap = allocateAdmin({ metodeAlokasi, adminBank: nextAdminBank, bebankanNotaId, entries: adminEntries })
      const updatedItems = entries.map((e) => {
        const adminAllocated = Math.max(0, roundInt(adminMap[e.notaId] || 0))
        const pembayaranAktual = Math.max(0, roundInt(e.tagihanNet - adminAllocated))
        return { notaSawitId: e.notaId, adminAllocated, pembayaranAktual }
      })

      const updatedBatch = await (tx as any).notaSawitPembayaranBatch.update({
        where: { id: batchId },
        data: { tanggal, jumlahMasuk: nextJumlahMasuk, adminBank: nextAdminBank, keterangan, ...(gambarUrl !== undefined ? { gambarUrl } : {}) },
      })

      if (uniqueIds) {
        await (tx as any).notaSawitPembayaranBatchItem.deleteMany({ where: { batchId } })
        await (tx as any).notaSawitPembayaranBatchItem.createMany({
          data: updatedItems.map((u) => ({
            batchId,
            notaSawitId: u.notaSawitId,
            tagihanNet: entries.find((e) => e.notaId === u.notaSawitId)?.tagihanNet || 0,
            adminAllocated: u.adminAllocated,
            pembayaranAktual: u.pembayaranAktual,
          })),
        })
      } else {
      for (const u of updatedItems) {
        await (tx as any).notaSawitPembayaranBatchItem.updateMany({
          where: { batchId, notaSawitId: u.notaSawitId },
          data: { adminAllocated: u.adminAllocated, pembayaranAktual: u.pembayaranAktual },
        })
      }
      }

      const shouldSetLunas = setLunas === null ? null : !!setLunas
      const newNotaIds = updatedItems.map((u) => u.notaSawitId)
      if (uniqueIds) {
        const removed = existingNotaIds.filter((id) => !newNotaIds.includes(id))
        if (removed.length > 0) {
          await tx.notaSawit.updateMany({
            where: { id: { in: removed } },
            data: { statusPembayaran: 'BELUM_LUNAS', pembayaranAktual: null } as any,
          })
        }
      }
      if (shouldSetLunas === true) {
        const existingKasByNota = await tx.kasTransaksi.findMany({
          where: { deletedAt: null, kategori: 'PENJUALAN_SAWIT', notaSawitId: { in: newNotaIds } },
          select: { id: true },
        })
        if (existingKasByNota.length > 0) {
          const kasIds = existingKasByNota.map((k) => k.id)
          await tx.jurnal.deleteMany({ where: { refType: 'KasTransaksi', refId: { in: kasIds } } })
          await tx.kasTransaksi.updateMany({ where: { id: { in: kasIds } }, data: { deletedAt: new Date(), deletedById: guard.id } as any })
        }
        await tx.notaSawit.updateMany({
          where: { id: { in: newNotaIds } },
          data: { statusPembayaran: 'LUNAS', pembayaranAktual: null } as any,
        })
      } else if (shouldSetLunas === false) {
        await tx.notaSawit.updateMany({
          where: { id: { in: newNotaIds } },
          data: { statusPembayaran: 'BELUM_LUNAS', pembayaranAktual: null } as any,
        })
      }

      const totalKasMasuk = Math.max(0, roundInt(nextJumlahMasuk - nextAdminBank))
      const transferDateText = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }).format(tanggal)
      const periodeNotaText = (() => {
        const dates = entries
          .map((e) => (e?.tanggalBongkar ? new Date(e.tanggalBongkar) : null))
          .filter((d): d is Date => !!d && Number.isFinite(d.getTime()))
        if (dates.length === 0) return null
        const min = new Date(Math.min(...dates.map((d) => d.getTime())))
        const max = new Date(Math.max(...dates.map((d) => d.getTime())))
        const fmt = (d: Date) => new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }).format(d)
        if (min.toDateString() === max.toDateString()) return `Periode Nota: ${fmt(min)}`
        return `Periode Nota: ${fmt(min)} - ${fmt(max)}`
      })()
      const pabrikName = String(batch?.pabrikSawit?.name || 'Pabrik')
      const description = `Uang Nota Sawit - ${pabrikName}`
      const keteranganKasBase = `Batch ID: ${batchId} • Jumlah Nota: ${entries.length} • Tanggal Transfer: ${transferDateText}`
      const keteranganKas = periodeNotaText ? `${keteranganKasBase} • ${periodeNotaText}` : keteranganKasBase

      const batchKas = await tx.kasTransaksi.findFirst({
        where: {
          deletedAt: null,
          kategori: 'PENJUALAN_SAWIT',
          OR: [
            { keterangan: { startsWith: `Batch ID: ${batchId} •` } },
            { deskripsi: { startsWith: `Uang Nota Sawit Batch #${batchId} -` } },
          ],
        } as any,
      })
      if (shouldSetLunas === false) {
        if (batchKas) {
          await tx.jurnal.deleteMany({ where: { refType: 'KasTransaksi', refId: batchKas.id } })
          await tx.kasTransaksi.update({ where: { id: batchKas.id }, data: { deletedAt: new Date(), deletedById: guard.id } as any })
        }
      } else {
        const pemilik = await tx.user.findFirst({ where: { role: 'PEMILIK' }, select: { id: true } })
        const transactionUserId = pemilik?.id ?? guard.id
        const kebunIds = Array.from(new Set(entries.map((e) => Number(e.kebunId)).filter((n) => Number.isFinite(n) && n > 0)))
        const kebunId = kebunIds.length === 1 ? kebunIds[0] : null
        const kasTrx = batchKas
          ? await tx.kasTransaksi.update({
              where: { id: batchKas.id },
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
              } as any,
            })
        await tx.jurnal.deleteMany({ where: { refType: 'KasTransaksi', refId: kasTrx.id } })
        await tx.jurnal.createMany({
          data: [
            { date: tanggal, akun: 'Kas', deskripsi: description, debit: totalKasMasuk, kredit: 0, refType: 'KasTransaksi', refId: kasTrx.id },
            { date: tanggal, akun: 'Pendapatan Sawit', deskripsi: description, debit: 0, kredit: totalKasMasuk, refType: 'KasTransaksi', refId: kasTrx.id },
          ],
        })
      }

      await createAuditLog(guard.id, 'UPDATE', 'NotaSawitPembayaranBatch', String(batchId), {
        tanggal: tanggal.toISOString(),
        jumlahMasuk: nextJumlahMasuk,
        adminBank: nextAdminBank,
        keterangan,
        ids: uniqueIds ? uniqueIds.slice(0, 500) : undefined,
        setLunas: shouldSetLunas === null ? undefined : shouldSetLunas,
        count: entries.length,
      })

      return { updatedBatchId: updatedBatch.id }
    })

    return NextResponse.json({ ok: true, batchId: result.updatedBatchId })
  } catch (error) {
    if ((error as any)?.message === 'NOT_FOUND') return NextResponse.json({ error: 'Batch tidak ditemukan' }, { status: 404 })
    if ((error as any)?.message === 'EMPTY') return NextResponse.json({ error: 'Batch tidak memiliki nota' }, { status: 400 })
    if ((error as any)?.message === 'LOCKED') {
      return NextResponse.json({ error: 'Tidak bisa edit batch ini karena ada batch lebih baru yang memakai nota yang sama.' }, { status: 400 })
    }
    if ((error as any)?.message === 'NOTA_NOT_FOUND') return NextResponse.json({ error: 'Ada nota yang tidak ditemukan.' }, { status: 404 })
    if ((error as any)?.message === 'PABRIK_MISMATCH') return NextResponse.json({ error: 'Nota terpilih harus dari pabrik yang sama dengan batch.' }, { status: 400 })
    console.error('PATCH /api/nota-sawit/pembayaran-batch/[id] error:', error)
    return NextResponse.json({ error: 'Gagal mengubah rekonsiliasi' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR'])
    if (guard.response) return guard.response

    const batchId = Number(params.id)
    if (!Number.isFinite(batchId) || batchId <= 0) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })

    await prisma.$transaction(async (tx) => {
      const batch = await (tx as any).notaSawitPembayaranBatch.findUnique({
        where: { id: batchId },
        include: { items: { select: { notaSawitId: true } } },
      })
      if (!batch) throw new Error('NOT_FOUND')

      const notaIds = (Array.isArray(batch.items) ? batch.items : []).map((i: any) => Number(i?.notaSawitId)).filter((n: number) => Number.isFinite(n) && n > 0)
      if (notaIds.length === 0) throw new Error('EMPTY')

      const newer = await (tx as any).notaSawitPembayaranBatchItem.findFirst({
        where: { notaSawitId: { in: notaIds }, batchId: { gt: batchId } },
        select: { id: true },
      })
      if (newer) throw new Error('LOCKED')

      const kasTrx = await tx.kasTransaksi.findFirst({
        where: {
          deletedAt: null,
          kategori: 'PENJUALAN_SAWIT',
          OR: [
            { keterangan: { startsWith: `Batch ID: ${batchId} •` } },
            { deskripsi: { startsWith: `Uang Nota Sawit Batch #${batchId} -` } },
          ],
        } as any,
        select: { id: true },
      })
      if (kasTrx) {
        await tx.jurnal.deleteMany({ where: { refType: 'KasTransaksi', refId: kasTrx.id } })
        await tx.kasTransaksi.update({ where: { id: kasTrx.id }, data: { deletedAt: new Date(), deletedById: guard.id } as any })
      }

      await tx.notaSawit.updateMany({
        where: { id: { in: notaIds } },
        data: { statusPembayaran: 'BELUM_LUNAS', pembayaranAktual: null } as any,
      })

      await (tx as any).notaSawitPembayaranBatchItem.deleteMany({ where: { batchId } })
      await (tx as any).notaSawitPembayaranBatch.delete({ where: { id: batchId } })

      await createAuditLog(guard.id, 'DELETE', 'NotaSawitPembayaranBatch', String(batchId), { count: notaIds.length })
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    if ((error as any)?.message === 'NOT_FOUND') return NextResponse.json({ error: 'Batch tidak ditemukan' }, { status: 404 })
    if ((error as any)?.message === 'EMPTY') return NextResponse.json({ error: 'Batch tidak memiliki nota' }, { status: 400 })
    if ((error as any)?.message === 'LOCKED') {
      return NextResponse.json({ error: 'Tidak bisa hapus batch ini karena ada batch lebih baru yang memakai nota yang sama.' }, { status: 400 })
    }
    console.error('DELETE /api/nota-sawit/pembayaran-batch/[id] error:', error)
    return NextResponse.json({ error: 'Gagal menghapus rekonsiliasi' }, { status: 500 })
  }
}
