import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { defaultPerusahaanTaxSetting, computePphTerutang, roundTaxableIncome, type PerusahaanTaxSettingShape } from '@/lib/tax-id'
import { requireRole } from '@/lib/route-auth'
import { computeStraightLineDepreciation } from '@/lib/asset-depreciation'
import { parseWibYmd, wibEndUtcInclusive, wibStartUtc } from '@/lib/wib'

export const dynamic = 'force-dynamic'

async function hasTaxSettingTable() {
  const rows = await prisma.$queryRaw<any[]>(
    Prisma.sql`SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'PerusahaanTaxSetting'
    ) AS "exists"`
  )
  return Boolean(rows?.[0]?.exists)
}

function toDateKey(ymd: { y: number; m: number; d: number }) {
  return `${String(ymd.y).padStart(4, '0')}-${String(ymd.m).padStart(2, '0')}-${String(ymd.d).padStart(2, '0')}`
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR', 'MANAGER'])
    if (guard.response) return guard.response
    const perusahaanId = Number(params.id)
    if (!perusahaanId) return NextResponse.json({ error: 'perusahaanId tidak valid' }, { status: 400 })

    const { searchParams } = new URL(request.url)
    const startYmd = parseWibYmd(searchParams.get('startDate'))
    const endYmd = parseWibYmd(searchParams.get('endDate'))
    const startKey = startYmd ? toDateKey(startYmd) : null
    const endKey = endYmd ? toDateKey(endYmd) : null
    const startDate = startYmd ? wibStartUtc(startYmd) : null
    const endDate = endYmd ? wibEndUtcInclusive(endYmd) : null

    const notaWhere: any = { perusahaanId }
    if (startDate || endDate) {
      notaWhere.tanggalBongkar = {}
      if (startDate) notaWhere.tanggalBongkar.gte = startDate
      if (endDate) notaWhere.tanggalBongkar.lte = endDate
    }

    const [pendapatanAgg, piutangAgg, kasPengeluaranPerusahaanAgg, kasPengeluaranPerusahaanByKategori, manualBiayaRows] = await Promise.all([
      prisma.notaSawit.aggregate({
        where: notaWhere,
        _sum: { totalPembayaran: true },
      }),
      prisma.notaSawit.aggregate({
        where: {
          perusahaanId,
          statusPembayaran: 'BELUM_LUNAS',
          ...(endDate ? { tanggalBongkar: { lte: endDate } } : {}),
        } as any,
        _sum: { totalPembayaran: true },
      }),
      prisma.kasTransaksi.aggregate({
        where: {
          deletedAt: null,
          tipe: 'PENGELUARAN',
          keterangan: { contains: `[PERUSAHAAN:${perusahaanId}]` },
          ...(startDate || endDate
            ? {
                date: {
                  ...(startDate ? { gte: startDate } : {}),
                  ...(endDate ? { lte: endDate } : {}),
                },
              }
            : {}),
        } as any,
        _sum: { jumlah: true },
      }),
      prisma.kasTransaksi.groupBy({
        by: ['kategori'],
        where: {
          deletedAt: null,
          tipe: 'PENGELUARAN',
          keterangan: { contains: `[PERUSAHAAN:${perusahaanId}]` },
          ...(startDate || endDate
            ? {
                date: {
                  ...(startDate ? { gte: startDate } : {}),
                  ...(endDate ? { lte: endDate } : {}),
                },
              }
            : {}),
        } as any,
        _sum: { jumlah: true },
      }),
      prisma.$queryRaw(
        Prisma.sql`SELECT "kategori", COALESCE(SUM("jumlah"), 0) AS "total"
                   FROM "PerusahaanBiaya"
                   WHERE "perusahaanId" = ${perusahaanId}
                     AND "type" = 'PENGELUARAN'
                     AND "source" = 'MANUAL'
                     ${startKey ? Prisma.sql`AND "date" >= ${startKey}::date` : Prisma.empty}
                     ${endKey ? Prisma.sql`AND "date" <= ${endKey}::date` : Prisma.empty}
                   GROUP BY "kategori"
                   ORDER BY "total" DESC`
      ),
    ])

    const pendapatanTbs = pendapatanAgg._sum.totalPembayaran ?? 0
    const pengeluaranKas = kasPengeluaranPerusahaanAgg?._sum?.jumlah ?? 0

    const breakdownAuto: Array<{ kategori: string; total: number; source: 'AUTO' | 'MANUAL' }> = []
    for (const row of kasPengeluaranPerusahaanByKategori || []) {
      breakdownAuto.push({ kategori: String(row.kategori || 'UMUM'), total: Number(row._sum.jumlah ?? 0), source: 'AUTO' })
    }

    const asOfDate = endDate || new Date()
    const periodStartForDep = startDate || new Date(asOfDate.getFullYear(), 0, 1)
    let assets: any[] = []
    try {
      assets = await prisma.$queryRawUnsafe(
        'SELECT * FROM "PerusahaanAsset" WHERE "perusahaanId" = $1 AND "acquiredAt" <= $2',
        perusahaanId,
        asOfDate
      )
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021') {
        assets = []
      } else if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2010') {
        const metaCode = String((error.meta as any)?.code || '')
        if (metaCode === '42P01') {
          assets = []
        } else {
          throw error
        }
      } else {
        throw error
      }
    }
    let depreciationExpense = 0
    let totalAssetCost = 0
    let accumulatedDepreciation = 0
    for (const a of assets) {
      const disposedAt = a.disposedAt ? new Date(a.disposedAt) : null
      const dep = computeStraightLineDepreciation({
        cost: Number(a.cost || 0),
        salvage: Number(a.salvage || 0),
        acquiredAt: new Date(a.acquiredAt),
        group: String(a.group || ''),
        periodStart: periodStartForDep,
        periodEnd: asOfDate,
        disposedAt,
      })
      depreciationExpense += dep.expenseInPeriod

      const activeAsOf = !disposedAt || disposedAt > asOfDate
      if (activeAsOf) {
        totalAssetCost += Number(a.cost || 0)
        accumulatedDepreciation += dep.accumulated
      }
    }
    if (depreciationExpense !== 0) {
      breakdownAuto.push({ kategori: 'Penyusutan Aktiva', total: depreciationExpense, source: 'AUTO' })
    }

    const breakdownManual: Array<{ kategori: string; total: number; source: 'AUTO' | 'MANUAL' }> = (manualBiayaRows as any[]).map((r: any) => ({
      kategori: String(r.kategori || 'UMUM'),
      total: Number(r.total || 0),
      source: 'MANUAL',
    }))

    const totalBiayaManual = breakdownManual.reduce((acc, x) => acc + x.total, 0)
    const totalBiayaAuto = breakdownAuto.reduce((acc, x) => acc + x.total, 0)
    const totalBiaya = totalBiayaAuto + totalBiayaManual
    const labaBersih = pendapatanTbs - totalBiaya

    const breakdownPengeluaran = [...breakdownAuto, ...breakdownManual]
      .filter(x => x.total !== 0)
      .sort((a, b) => b.total - a.total)

    const pemasukanKas = 0
    const kasSaldo = 0
    const piutang = piutangAgg._sum.totalPembayaran ?? 0

    const classify = (kategori: string) => {
      const k = String(kategori || '').trim().toUpperCase()
      if (!k) return 'ADMIN'

      const isAdmin =
        k === 'UMUM' ||
        k === 'GAJI' ||
        k.includes('GAJI') ||
        k.includes('ADMIN') ||
        k.includes('KEBUTUHAN KANTOR') ||
        k.includes('KANTOR') ||
        k.includes('LISTRIK') ||
        k.includes('INTERNET') ||
        k === 'AIR' ||
        k.includes('AIR ') ||
        k.includes('BBM') ||
        k.includes('PERAWATAN') ||
        k.includes('AKTIVA') ||
        k.includes('PENYUSUTAN') ||
        k.includes('PERJALANAN') ||
        k.includes('DINAS') ||
        k === 'KENDARAAN'

      const isHpp =
        k === 'KEBUN' ||
        k.includes('HPP') ||
        k.includes('HARGA POKOK') ||
        k.includes('PRODUKSI') ||
        k.includes('PANEN') ||
        k.includes('PUPUK') ||
        k.includes('BIBIT') ||
        k.includes('PEMELIHARAAN') ||
        k.includes('TBS') ||
        k.includes('ANGKUT') ||
        k.includes('BONGKAR')

      if (isHpp && !isAdmin) return 'HPP'
      if (isHpp && isAdmin) return 'ADMIN'
      return isAdmin ? 'ADMIN' : 'ADMIN'
    }

    const hppTotal = breakdownPengeluaran.filter(x => classify(x.kategori) === 'HPP').reduce((acc, x) => acc + x.total, 0)
    const adminTotal = breakdownPengeluaran.filter(x => classify(x.kategori) === 'ADMIN').reduce((acc, x) => acc + x.total, 0)
    const labaKotor = pendapatanTbs - hppTotal
    const labaSebelumPph = labaKotor - adminTotal

    let taxSetting: PerusahaanTaxSettingShape = defaultPerusahaanTaxSetting()
    try {
      const exists = await hasTaxSettingTable()
      if (!exists) throw new Error('missing table')
      const rows = await prisma.$queryRaw<any[]>(
        Prisma.sql`SELECT "scheme","standardRate","umkmFinalRate","umkmOmzetThreshold","facilityOmzetThreshold","facilityPortionThreshold","facilityDiscount","rounding"
                   FROM "PerusahaanTaxSetting"
                   WHERE "perusahaanId" = ${perusahaanId}
                   LIMIT 1`
      )
      const row = rows?.[0]
      if (row) {
        taxSetting = {
          scheme: String(row.scheme || taxSetting.scheme).toUpperCase() as any,
          standardRate: Number(row.standardRate ?? taxSetting.standardRate),
          umkmFinalRate: Number(row.umkmFinalRate ?? taxSetting.umkmFinalRate),
          umkmOmzetThreshold: Number(row.umkmOmzetThreshold ?? taxSetting.umkmOmzetThreshold),
          facilityOmzetThreshold: Number(row.facilityOmzetThreshold ?? taxSetting.facilityOmzetThreshold),
          facilityPortionThreshold: Number(row.facilityPortionThreshold ?? taxSetting.facilityPortionThreshold),
          facilityDiscount: Number(row.facilityDiscount ?? taxSetting.facilityDiscount),
          rounding: String(row.rounding || taxSetting.rounding).toUpperCase() as any,
        }
      }
    } catch {
      taxSetting = defaultPerusahaanTaxSetting()
    }

    const labaSebelumPphDibulatkan = roundTaxableIncome(labaSebelumPph, taxSetting.rounding)
    const taxRes = computePphTerutang({ omzet: pendapatanTbs, taxableIncome: labaSebelumPphDibulatkan, setting: taxSetting })
    const pphTerutang = taxRes.pphTerutang
    const labaSetelahPph = labaSebelumPphDibulatkan - pphTerutang

    const aset = [
      { akun: 'Kas', total: kasSaldo },
      { akun: 'Piutang (Nota Belum Lunas)', total: piutang },
      ...(totalAssetCost !== 0 ? [{ akun: 'Aktiva Tetap (Harga Perolehan)', total: totalAssetCost }] : []),
      ...(accumulatedDepreciation !== 0 ? [{ akun: 'Akumulasi Penyusutan (-)', total: -accumulatedDepreciation }] : []),
    ]
    const totalAset = aset.reduce((acc, a) => acc + a.total, 0)

    const kewajiban: Array<{ akun: string; total: number }> = []
    const totalKewajiban = 0

    const ekuitas = [{ akun: 'Ekuitas', total: totalAset - totalKewajiban }]
    const totalEkuitas = ekuitas.reduce((acc, a) => acc + a.total, 0)

    return NextResponse.json({
      period: {
        startDate: startDate ? startDate.toISOString() : null,
        endDate: endDate ? endDate.toISOString() : null,
      },
      labaRugi: {
        pendapatanTbs,
        pemasukanKas,
        pengeluaranKas,
        biayaManual: totalBiayaManual,
        biayaAuto: totalBiayaAuto,
        totalBiaya,
        labaBersih,
        hppTotal,
        adminTotal,
        labaKotor,
        labaSebelumPph,
        labaSebelumPphDibulatkan,
        pphTerutang,
        labaSetelahPph,
        penyusutanAktiva: depreciationExpense,
        tax: {
          schemeApplied: taxRes.schemeApplied,
          omzet: pendapatanTbs,
          taxableIncome: labaSebelumPphDibulatkan,
          setting: taxSetting,
        },
        breakdownPengeluaran,
      },
      neraca: {
        aset,
        totalAset,
        aktivaTetap: {
          hargaPerolehan: totalAssetCost,
          akumulasiPenyusutan: accumulatedDepreciation,
          nilaiBuku: Math.max(0, totalAssetCost - accumulatedDepreciation),
        },
        kewajiban,
        totalKewajiban,
        ekuitas,
        totalEkuitas,
      },
    })
  } catch (error) {
    console.error('GET /api/perusahaan/[id]/laporan-keuangan error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
