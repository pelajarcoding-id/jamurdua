import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { requireAuth } from '@/lib/route-auth'

type ImageItem = {
  id: string
  url: string
  category: string
  label?: string
  createdAt?: string | null
  entity?: string
  entityId?: string
}

export async function GET() {
  try {
    const guard = await requireAuth()
    if (guard.response) return guard.response
    const [
      users,
      kendaraan,
      riwayatDokumen,
      serviceLogs,
      inventoryItems,
      inventoryTx,
      notaSawit,
      uangJalan,
      kasTransaksi,
      timbangan,
      perusahaanBiaya,
    ] = await Promise.all([
      prisma.user.findMany({ select: { id: true, name: true, photoUrl: true, createdAt: true } }),
      prisma.kendaraan.findMany({
        select: {
          platNomor: true,
          imageUrl: true,
          fotoStnkUrl: true,
          fotoPajakUrl: true,
          fotoSpeksiUrl: true,
          createdAt: true,
        },
      }),
      prisma.riwayatDokumen.findMany({
        select: { id: true, kendaraanPlat: true, jenis: true, fotoUrl: true, createdAt: true },
      }),
      prisma.serviceLog.findMany({ select: { id: true, kendaraanPlat: true, fotoUrl: true, createdAt: true } }),
      prisma.inventoryItem.findMany({ select: { id: true, name: true, imageUrl: true, createdAt: true } }),
      prisma.inventoryTransaction.findMany({
        select: { id: true, itemId: true, imageUrl: true, createdAt: true },
      }),
      prisma.notaSawit.findMany({
        select: { id: true, gambarNotaUrl: true, createdAt: true, timbanganId: true },
      }),
      prisma.uangJalan.findMany({
        select: { id: true, gambarUrl: true, createdAt: true, sesiUangJalanId: true },
      }),
      prisma.kasTransaksi.findMany({
        where: { deletedAt: null },
        select: { id: true, gambarUrl: true, createdAt: true, deskripsi: true, tipe: true, kategori: true },
      }),
      prisma.timbangan.findMany({
        select: { id: true, photoUrl: true, date: true },
      }),
      prisma.$queryRaw(
        Prisma.sql`SELECT "id","perusahaanId","gambarUrl","createdAt","kategori","deskripsi"
                   FROM "PerusahaanBiaya"
                   ORDER BY "createdAt" DESC, "id" DESC`
      ) as Promise<Array<{ id: number; perusahaanId: number; gambarUrl: string | null; createdAt: Date | null; kategori: string | null; deskripsi: string | null }>>,
    ])

    const items: ImageItem[] = []

    users.forEach((u: any) => {
      if (u.photoUrl) {
        items.push({
          id: `USER-${u.id}`,
          url: u.photoUrl,
          category: 'USER',
          label: u.name,
          createdAt: u.createdAt?.toISOString?.() ?? null,
          entity: 'User',
          entityId: String(u.id),
        })
      }
    })

    kendaraan.forEach((k: any) => {
      if (k.imageUrl) {
        items.push({
          id: `KENDARAAN-FOTO-${k.platNomor}`,
          url: k.imageUrl,
          category: 'KENDARAAN_FOTO',
          label: k.platNomor,
          createdAt: k.createdAt?.toISOString?.() ?? null,
          entity: 'Kendaraan',
          entityId: String(k.platNomor),
        })
      }
      if (k.fotoStnkUrl) {
        items.push({
          id: `KENDARAAN-STNK-${k.platNomor}`,
          url: k.fotoStnkUrl,
          category: 'KENDARAAN_STNK',
          label: k.platNomor,
          createdAt: k.createdAt?.toISOString?.() ?? null,
          entity: 'Kendaraan',
          entityId: String(k.platNomor),
        })
      }
      if (k.fotoPajakUrl) {
        items.push({
          id: `KENDARAAN-PAJAK-${k.platNomor}`,
          url: k.fotoPajakUrl,
          category: 'KENDARAAN_PAJAK',
          label: k.platNomor,
          createdAt: k.createdAt?.toISOString?.() ?? null,
          entity: 'Kendaraan',
          entityId: String(k.platNomor),
        })
      }
      if (k.fotoSpeksiUrl) {
        items.push({
          id: `KENDARAAN-SPEKSI-${k.platNomor}`,
          url: k.fotoSpeksiUrl,
          category: 'KENDARAAN_SPEKSI',
          label: k.platNomor,
          createdAt: k.createdAt?.toISOString?.() ?? null,
          entity: 'Kendaraan',
          entityId: String(k.platNomor),
        })
      }
    })

    riwayatDokumen.forEach((r: any) => {
      if (r.fotoUrl) {
        items.push({
          id: `DOKUMEN-${r.id}`,
          url: r.fotoUrl,
          category: `DOKUMEN_${r.jenis || 'LAIN'}`,
          label: `${r.kendaraanPlat} ${r.jenis || ''}`.trim(),
          createdAt: r.createdAt?.toISOString?.() ?? null,
          entity: 'RiwayatDokumen',
          entityId: String(r.id),
        })
      }
    })

    serviceLogs.forEach((s: any) => {
      if (s.fotoUrl) {
        items.push({
          id: `SERVICE-${s.id}`,
          url: s.fotoUrl,
          category: 'SERVICE',
          label: s.kendaraanPlat,
          createdAt: s.createdAt?.toISOString?.() ?? null,
          entity: 'ServiceLog',
          entityId: String(s.id),
        })
      }
    })

    inventoryItems.forEach((i: any) => {
      if (i.imageUrl) {
        items.push({
          id: `INVENTORY-${i.id}`,
          url: i.imageUrl,
          category: 'INVENTORY_ITEM',
          label: i.name,
          createdAt: i.createdAt?.toISOString?.() ?? null,
          entity: 'InventoryItem',
          entityId: String(i.id),
        })
      }
    })

    inventoryTx.forEach((t: any) => {
      if (t.imageUrl) {
        items.push({
          id: `INVENTORY-TX-${t.id}`,
          url: t.imageUrl,
          category: 'INVENTORY_TX',
          label: `Transaksi #${t.id}`,
          createdAt: t.createdAt?.toISOString?.() ?? null,
          entity: 'InventoryTransaction',
          entityId: String(t.id),
        })
      }
    })

    notaSawit.forEach((n: any) => {
      if (n.gambarNotaUrl) {
        items.push({
          id: `NOTA-${n.id}`,
          url: n.gambarNotaUrl,
          category: 'NOTA_SAWIT',
          label: `Nota #${n.id}`,
          createdAt: n.createdAt?.toISOString?.() ?? null,
          entity: 'NotaSawit',
          entityId: String(n.id),
        })
      }
    })

    uangJalan.forEach((u: any) => {
      if (u.gambarUrl) {
        items.push({
          id: `UANGJALAN-${u.id}`,
          url: u.gambarUrl,
          category: 'UANG_JALAN',
          label: `Uang Jalan #${u.id}`,
          createdAt: u.createdAt?.toISOString?.() ?? null,
          entity: 'UangJalan',
          entityId: String(u.id),
        })
      }
    })

    kasTransaksi.forEach((k: any) => {
      if (k.gambarUrl) {
        items.push({
          id: `KAS-${k.id}`,
          url: k.gambarUrl,
          category: 'KAS_TRANSAKSI',
          label: `${k.tipe} • ${k.kategori || 'UMUM'} • ${k.deskripsi?.slice(0, 24) || ''}`.trim(),
          createdAt: k.createdAt?.toISOString?.() ?? null,
          entity: 'KasTransaksi',
          entityId: String(k.id),
        })
      }
    })

    timbangan.forEach((t: any) => {
      if (t.photoUrl) {
        items.push({
          id: `TIMBANGAN-${t.id}`,
          url: t.photoUrl,
          category: 'TIMBANGAN',
          label: `Timbangan #${t.id}`,
          createdAt: t.date?.toISOString?.() ?? null,
          entity: 'Timbangan',
          entityId: String(t.id),
        })
      }
    })

    perusahaanBiaya.forEach((b: any) => {
      if (b.gambarUrl) {
        items.push({
          id: `PERUSAHAAN-BIAYA-${b.id}`,
          url: b.gambarUrl,
          category: 'PERUSAHAAN_BIAYA',
          label: `${b.kategori} • ${b.deskripsi?.slice(0, 24) || ''}`.trim(),
          createdAt: b.createdAt?.toISOString?.() ?? null,
          entity: 'PerusahaanBiaya',
          entityId: String(b.id),
        })
      }
    })

    items.sort((a, b) => {
      const ta = a.createdAt ? Date.parse(a.createdAt) : 0
      const tb = b.createdAt ? Date.parse(b.createdAt) : 0
      return tb - ta
    })

    const categories = Array.from(new Set(items.map(i => i.category))).sort()

    return NextResponse.json({ data: items, categories })
  } catch (e) {
    console.error('GET /api/images error:', e)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
