import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/route-auth'
import { createAuditLog } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR'])
    if (guard.response) return guard.response

    const body = await request.json()
    const idsRaw: any[] = Array.isArray(body?.ids) ? body.ids : []
    const hargaPerKgRaw = body?.hargaPerKg
    const hargaPerKg = Math.round(Number(hargaPerKgRaw) || 0)

    const uniqueIds: number[] = Array.from(
      new Set<number>(
        idsRaw
          .map((v: any) => Number(v))
          .filter((n: number) => Number.isFinite(n) && n > 0),
      ),
    )

    if (uniqueIds.length === 0 || hargaPerKg <= 0) {
      return NextResponse.json({ error: 'Input tidak valid' }, { status: 400 })
    }

    const roundInt = (v: any) => Math.round(Number(v) || 0)

    const notas = await prisma.notaSawit.findMany({
      where: { id: { in: uniqueIds }, deletedAt: null },
      include: {
        timbangan: true,
        pabrikSawit: true,
        supir: true,
      },
    })

    let updated = 0
    let updatedKas = 0

    const pemilik = await prisma.user.findFirst({ where: { role: 'PEMILIK' }, select: { id: true } })
    const transactionUserId = pemilik?.id ?? guard.id

    for (const nota of notas) {
      const timbangan = nota.timbangan as any
      const netSource = nota.netto && nota.netto !== 0 ? nota.netto : timbangan?.netKg || 0
      const net = roundInt(netSource)
      const potongan = roundInt(nota.potongan || 0)
      const beratAkhir = Math.max(0, net - potongan)
      const totalPembayaran = roundInt(beratAkhir * hargaPerKg)
      const pph = roundInt(totalPembayaran * 0.0025)
      const pph25 = roundInt((nota as any).pph25 || 0)
      const pembayaranSetelahPph = roundInt(totalPembayaran - pph - pph25)

      const updatedNota = await prisma.notaSawit.update({
        where: { id: nota.id },
        data: {
          hargaPerKg,
          beratAkhir,
          totalPembayaran,
          pph,
          pembayaranSetelahPph,
        },
        include: { pabrikSawit: true, supir: true, timbangan: true },
      })
      updated += 1

      if (updatedNota.statusPembayaran === 'LUNAS') {
        const kasTransaction = await prisma.kasTransaksi.findFirst({
          where: {
            deletedAt: null,
            kategori: 'PENJUALAN_SAWIT',
            deskripsi: { contains: `Penjualan Sawit #${updatedNota.id}` },
          } as any,
        })

        const pabrikName = (updatedNota as any).pabrikSawit?.name || 'Unknown Pabrik'
        const supirName = (updatedNota as any).supir?.name || 'Unknown Supir'
        const tglBongkar = updatedNota.tanggalBongkar
          ? new Date(updatedNota.tanggalBongkar as any).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
          : '-'
        const description = `Penjualan Sawit #${updatedNota.id} - ${updatedNota.kendaraanPlatNomor || 'Tanpa Plat'} - ${pabrikName} (${tglBongkar}) - Supir: ${supirName}`
        const amount = (updatedNota as any).pembayaranAktual ?? (updatedNota as any).pembayaranSetelahPph

        if (kasTransaction) {
          await prisma.kasTransaksi.update({
            where: { id: kasTransaction.id },
            data: {
              deskripsi: description,
              jumlah: amount,
              kebunId: (updatedNota as any).timbangan?.kebunId,
              kendaraanPlatNomor: updatedNota.kendaraanPlatNomor || null,
            },
          })

          await prisma.jurnal.deleteMany({
            where: { refType: 'KasTransaksi', refId: kasTransaction.id },
          })

          await prisma.jurnal.createMany({
            data: [
              {
                date: kasTransaction.date,
                akun: 'Kas',
                deskripsi: description,
                debit: amount,
                kredit: 0,
                refType: 'KasTransaksi',
                refId: kasTransaction.id,
              },
              {
                date: kasTransaction.date,
                akun: 'Pendapatan Sawit',
                deskripsi: description,
                debit: 0,
                kredit: amount,
                refType: 'KasTransaksi',
                refId: kasTransaction.id,
              },
            ],
          })
          updatedKas += 1
        } else {
          if ((updatedNota as any).timbangan?.kebunId) {
            const kasTrx = await prisma.kasTransaksi.create({
              data: {
                date: new Date(),
                tipe: 'PEMASUKAN',
                deskripsi: description,
                jumlah: amount,
                kategori: 'PENJUALAN_SAWIT',
                kebunId: (updatedNota as any).timbangan?.kebunId,
                kendaraanPlatNomor: updatedNota.kendaraanPlatNomor || undefined,
                userId: transactionUserId,
              },
            })

            await prisma.jurnal.createMany({
              data: [
                {
                  date: kasTrx.date,
                  akun: 'Kas',
                  deskripsi: description,
                  debit: amount,
                  kredit: 0,
                  refType: 'KasTransaksi',
                  refId: kasTrx.id,
                },
                {
                  date: kasTrx.date,
                  akun: 'Pendapatan Sawit',
                  deskripsi: description,
                  debit: 0,
                  kredit: amount,
                  refType: 'KasTransaksi',
                  refId: kasTrx.id,
                },
              ],
            })
            updatedKas += 1
          }
        }
      }
    }

    await createAuditLog(guard.id, 'UPDATE', 'NotaSawit', 'BULK_HARGA', {
      hargaPerKg,
      count: updated,
      kasUpdated: updatedKas,
      ids: uniqueIds.slice(0, 500),
    })

    return NextResponse.json({ ok: true, updated, kasUpdated: updatedKas })
  } catch (error) {
    console.error('Gagal bulk update harga nota:', error)
    return NextResponse.json({ error: 'Gagal bulk update harga' }, { status: 500 })
  }
}
