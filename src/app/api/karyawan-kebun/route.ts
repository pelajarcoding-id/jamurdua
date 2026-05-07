import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { parseWibYmd, wibEndUtcInclusive, wibStartUtc } from '@/lib/wib'

export const dynamic = 'force-dynamic'

const ensureTable = async () => {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AbsensiHarian" (
      "id" SERIAL PRIMARY KEY,
      "kebunId" INTEGER NOT NULL,
      "karyawanId" INTEGER NOT NULL,
      "date" DATE NOT NULL,
      "jumlah" NUMERIC NOT NULL DEFAULT 0,
      "kerja" BOOLEAN NOT NULL DEFAULT FALSE,
      "libur" BOOLEAN NOT NULL DEFAULT FALSE,
      "note" TEXT,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE ("kebunId","karyawanId","date")
    )
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AbsensiGajiHarian" (
      "id" SERIAL PRIMARY KEY,
      "kebunId" INTEGER NOT NULL,
      "karyawanId" INTEGER NOT NULL,
      "date" DATE NOT NULL,
      "jumlah" NUMERIC NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE ("kebunId","karyawanId","date")
    )
  `)
}

export async function GET(request: Request) {
  try {
    await ensureTable()
    const { searchParams } = new URL(request.url)
    const kebunIdParam = searchParams.get('kebunId')
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')
    const karyawanIdParam = searchParams.get('karyawanId')
    const search = (searchParams.get('search') || '').trim()
    const statusParam = (searchParams.get('status') || 'all').toString().toUpperCase().trim()
    const jobTypeParam = (searchParams.get('jobType') || 'all').toString().toUpperCase().trim()
    const roleParam = (searchParams.get('role') || 'all').toString().toUpperCase().trim()

    const kebunId = kebunIdParam ? Number(kebunIdParam) : null
    if (kebunIdParam && Number.isNaN(kebunId)) {
      return NextResponse.json({ error: 'kebunId tidak valid' }, { status: 400 })
    }

    const startYmd = parseWibYmd(startDateParam)
    const endYmd = parseWibYmd(endDateParam)
    const startUtc = startYmd ? wibStartUtc(startYmd) : null
    const endUtc = endYmd ? wibEndUtcInclusive(endYmd) : null
    const startKey = startYmd ? `${String(startYmd.y).padStart(4, '0')}-${String(startYmd.m).padStart(2, '0')}-${String(startYmd.d).padStart(2, '0')}` : null
    const endKey = endYmd ? `${String(endYmd.y).padStart(4, '0')}-${String(endYmd.m).padStart(2, '0')}-${String(endYmd.d).padStart(2, '0')}` : null

    const dateFilter: any = {}
    if (startUtc) dateFilter.gte = startUtc
    if (endUtc) dateFilter.lte = endUtc

    // Agregasi pekerjaan kebun per karyawan
    const pekerjaanAgg = await prisma.pekerjaanKebun.groupBy({
      by: ['userId'],
      where: {
        ...(kebunId ? { kebunId } : {}),
        ...(startDateParam || endDateParam ? { date: dateFilter } : {}),
        userId: { not: null },
      },
      _count: { _all: true },
      _sum: { biaya: true },
    })

    // Agregasi kas pengeluaran (sering dipakai catat hutang/pinjaman) per karyawan - FILTER KEBUN & PERIODE
    const kasPengeluaranAgg = await prisma.kasTransaksi.groupBy({
      by: ['karyawanId'],
      where: {
        ...(kebunId ? { kebunId } : {}),
        ...(startDateParam || endDateParam ? { date: dateFilter } : {}),
        karyawanId: { not: null },
        tipe: 'PENGELUARAN',
        kategori: 'HUTANG_KARYAWAN',
        deletedAt: null,
      },
      _sum: { jumlah: true },
    })

    // Agregasi kas pemasukan (sering dipakai pembayaran hutang) per karyawan - FILTER KEBUN & PERIODE
    const kasPembayaranAgg = await prisma.kasTransaksi.groupBy({
      by: ['karyawanId'],
      where: {
        ...(kebunId ? { kebunId } : {}),
        ...(startDateParam || endDateParam ? { date: dateFilter } : {}),
        karyawanId: { not: null },
        tipe: 'PEMASUKAN',
        kategori: 'PEMBAYARAN_HUTANG',
        deletedAt: null,
      },
      _sum: { jumlah: true },
    })

    // Agregasi kas pemasukan (pembayaran hutang) per karyawan - KHUSUS PERIODE INI
    const kasPembayaranPeriodeAgg = await prisma.kasTransaksi.groupBy({
      by: ['karyawanId'],
      where: {
        ...(kebunId ? {
          OR: [
            { kebunId: kebunId },
            { kebunId: null }
          ]
        } : {}),
        ...(startDateParam || endDateParam ? { date: dateFilter } : {}),
        karyawanId: { not: null },
        tipe: 'PEMASUKAN',
        kategori: 'PEMBAYARAN_HUTANG',
        deletedAt: null,
      },
      _sum: { jumlah: true },
    })

    // Agregasi kas pengeluaran (Hutang) - TOTAL LIFETIME (untuk saldo hutang akurat)
    const kasPengeluaranLifetimeAgg = await prisma.kasTransaksi.groupBy({
      by: ['karyawanId'],
      where: {
        karyawanId: { not: null },
        tipe: 'PENGELUARAN',
        kategori: 'HUTANG_KARYAWAN',
        deletedAt: null,
      },
      _sum: { jumlah: true },
    })

    // Agregasi kas pemasukan (Bayar Hutang) - TOTAL LIFETIME (untuk saldo hutang akurat)
    const kasPembayaranLifetimeAgg = await prisma.kasTransaksi.groupBy({
      by: ['karyawanId'],
      where: {
        karyawanId: { not: null },
        tipe: 'PEMASUKAN',
        kategori: 'PEMBAYARAN_HUTANG',
        deletedAt: null,
      },
      _sum: { jumlah: true },
    })

    const absensiFilters: Prisma.Sql[] = []
    if (kebunId) {
      absensiFilters.push(Prisma.sql`a."kebunId" = ${kebunId}`)
    }
    if (startKey) {
      absensiFilters.push(Prisma.sql`a."date" >= ${startKey}::DATE`)
    }
    if (endKey) {
      absensiFilters.push(Prisma.sql`a."date" <= ${endKey}::DATE`)
    }
    const absensiWhere = absensiFilters.length > 0 ? Prisma.join(absensiFilters, ' AND ') : Prisma.sql`true`

    const karyawanIdFilter = karyawanIdParam ? Number(karyawanIdParam) : null

    let absensiAgg: Array<{ karyawanId: number; hariKerja: number; totalGaji: number; totalGajiDibayar: number; totalGajiBelumDibayar: number }> = []
    try {
      absensiAgg = await prisma.$queryRaw<Array<{ karyawanId: number; hariKerja: number; totalGaji: number; totalGajiDibayar: number; totalGajiBelumDibayar: number }>>(Prisma.sql`
        SELECT a."karyawanId" as "karyawanId",
               SUM(CASE WHEN a."kerja" = true OR a."jumlah" > 0 THEN 1 ELSE 0 END) as "hariKerja",
               SUM(a."jumlah") as "totalGaji",
               SUM(CASE WHEN p."id" IS NOT NULL THEN p."jumlah" ELSE 0 END) as "totalGajiDibayar",
               SUM(CASE WHEN p."id" IS NULL THEN a."jumlah" ELSE 0 END) as "totalGajiBelumDibayar"
        FROM "AbsensiHarian" a
        LEFT JOIN "AbsensiGajiHarian" p
          ON p."kebunId" = a."kebunId"
         AND p."karyawanId" = a."karyawanId"
         AND p."date" = a."date"
        WHERE ${absensiWhere}
          AND a."karyawanId" IS NOT NULL
          ${karyawanIdFilter ? Prisma.sql`AND a."karyawanId" = ${karyawanIdFilter}` : Prisma.sql``}
        GROUP BY a."karyawanId"
      `)
    } catch {
      // Jika tabel belum ada, biarkan kosong
      absensiAgg = []
    }

    // Tambahkan semua user (kecuali ADMIN/PEMILIK) yang terikat ke kebunId tersebut
    let assignedUsersRaw: Array<{ id: number }> = []
    try {
      if (kebunId) {
        // Karena kebunId mungkin belum terdaftar di schema.prisma User (biasanya ditambahkan via raw SQL),
        // kita gunakan queryRaw untuk mengambil user yang memiliki kebunId ini.
        const usersByKebun = await prisma.$queryRaw<Array<{ id: number }>>`
          SELECT "id" FROM "User" WHERE "kebunId" = ${kebunId} AND "role" NOT IN ('ADMIN', 'PEMILIK')
        `
        assignedUsersRaw = usersByKebun
      } else {
        const usersAssigned = await prisma.user.findMany({
          where: {
            role: { notIn: ['ADMIN', 'PEMILIK'] },
          },
          select: { id: true },
        })
        assignedUsersRaw = usersAssigned
      }
    } catch {
      assignedUsersRaw = []
    }

    // Kumpulkan semua karyawanId yang muncul
    const userIds = Array.from(
      new Set([
        ...assignedUsersRaw.map(u => u.id),
      ]),
    )

    const pendingDeleteRows = userIds.length > 0
      ? await prisma.$queryRaw<Array<{ karyawanId: number }>>(
          Prisma.sql`SELECT "karyawanId"
                     FROM "KaryawanDeleteRequest"
                     WHERE "status" = 'PENDING'
                       AND "karyawanId" IN (${Prisma.join(userIds)})`,
        )
      : []
    const pendingDeleteSet = new Set(pendingDeleteRows.map((r) => Number(r.karyawanId)))

    // Ambil data karyawan dengan filter
    const userWhere: Prisma.UserWhereInput = {
      id: { in: userIds },
    }

    const andFilters: Prisma.UserWhereInput[] = []
    if (karyawanIdParam) {
      andFilters.push({ id: Number(karyawanIdParam) })
    }
    if (search) {
      andFilters.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ]
      })
    }

    if (roleParam !== 'ALL') {
      const allowedRoles = ['KARYAWAN', 'SUPIR', 'MANDOR', 'MANAGER']
      if (allowedRoles.includes(roleParam)) {
        andFilters.push({ role: roleParam as any })
      } else {
        andFilters.push({ role: { in: allowedRoles } as any })
      }
    }

    if (jobTypeParam !== 'ALL') {
      if (jobTypeParam === 'KEBUN') {
        andFilters.push({
          OR: [
            { jobType: { contains: 'KEBUN', mode: 'insensitive' } },
            { jobType: null, kebunId: { not: null } },
          ],
        })
      } else {
        andFilters.push({
          jobType: { contains: jobTypeParam, mode: 'insensitive' },
        })
      }
    }

    if (statusParam === 'AKTIF') {
      andFilters.push({ OR: [{ status: 'AKTIF' }, { status: 'Aktif' }, { status: null }] })
    } else if (statusParam === 'NONAKTIF') {
      andFilters.push({ OR: [{ status: 'NONAKTIF' }, { status: 'Nonaktif' }] })
    } else if (statusParam !== 'ALL') {
      andFilters.push({ status: { contains: statusParam, mode: 'insensitive' } })
    }

    if (andFilters.length > 0) {
      userWhere.AND = andFilters
    }

    const users = await prisma.user.findMany({
      where: userWhere,
      select: { id: true, name: true, email: true, photoUrl: true, status: true, jobType: true, kebunId: true },
    })

    const result = await Promise.all(users.map(async (u) => {
      const p = pekerjaanAgg.find(x => x.userId === u.id)
      const keluar = kasPengeluaranAgg.find(x => x.karyawanId === u.id)
      const masuk = kasPembayaranAgg.find(x => x.karyawanId === u.id)
      const masukPeriode = kasPembayaranPeriodeAgg.find(x => x.karyawanId === u.id)
      
      // Saldo Hutang Lifetime
      const keluarLifetime = kasPengeluaranLifetimeAgg.find(x => x.karyawanId === u.id)
      const masukLifetime = kasPembayaranLifetimeAgg.find(x => x.karyawanId === u.id)
      const totalPengeluaranLifetime = keluarLifetime?._sum?.jumlah ?? 0
      const totalPembayaranLifetime = masukLifetime?._sum?.jumlah ?? 0
      const hutangSaldo = totalPengeluaranLifetime - totalPembayaranLifetime

      const pekerjaanCount = p?._count?._all ?? 0
      const pekerjaanTotalBiaya = p?._sum?.biaya ?? 0
      const totalPengeluaran = keluar?._sum?.jumlah ?? 0
      const totalPembayaran = masuk?._sum?.jumlah ?? 0
      const totalPembayaranPeriode = masukPeriode?._sum?.jumlah ?? 0
      const abs = absensiAgg.find(x => x.karyawanId === u.id)
      const hariKerja = Number(abs?.hariKerja || 0)
      const totalGaji = Number(abs?.totalGaji || 0)
      const totalGajiDibayar = Number(abs?.totalGajiDibayar || 0)
      const totalGajiBelumDibayar = Number(abs?.totalGajiBelumDibayar || 0)
      const lastCut = await prisma.kasTransaksi.findFirst({
        where: {
          ...(kebunId ? { kebunId } : {}),
          karyawanId: u.id,
          tipe: 'PEMASUKAN',
          kategori: 'PEMBAYARAN_HUTANG',
          deletedAt: null,
        },
        orderBy: { date: 'desc' },
        select: { id: true, jumlah: true, date: true, deskripsi: true },
      })
      return {
        karyawan: { ...u, deleteRequestPending: pendingDeleteSet.has(u.id) },
        pekerjaanCount,
        pekerjaanTotalBiaya,
        totalPengeluaran,
        totalPembayaran,
        totalPembayaranPeriode,
        hutangSaldo,
        hariKerja,
        totalGaji,
        totalGajiDibayar,
        totalGajiBelumDibayar,
        lastPotongan: lastCut ? {
          id: lastCut.id,
          jumlah: lastCut.jumlah,
          date: lastCut.date,
          deskripsi: lastCut.deskripsi,
        } : null,
      }
    }))

    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('GET /api/karyawan-kebun error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
