import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import bcrypt from 'bcrypt'
import crypto from 'crypto'
import { requireRole } from '@/lib/route-auth'

export const dynamic = 'force-dynamic'

const parseYmdToDbDate = (raw: any) => {
  const s = String(raw || '').trim()
  if (!s) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  return new Date(`${s}T00:00:00.000Z`)
}

type UserWhereWithJobType = Prisma.UserWhereInput & {
  jobType?: Prisma.StringNullableFilter<'User'> | string | null
}

type UserSelectWithMeta = Prisma.UserSelect & {
  jobType?: boolean
  status?: boolean
  kendaraanPlatNomor?: boolean
}

type UserCreateWithMeta = Prisma.UserUncheckedCreateInput & {
  jobType?: string | null
  status?: string | null
  kendaraanPlatNomor?: string | null
}

export async function GET(request: Request) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR'])
    if (guard.response) return guard.response
    const { searchParams } = new URL(request.url)
    const search = (searchParams.get('search') || '').trim()
    const limit = Number(searchParams.get('limit') || 50)
    const page = Number(searchParams.get('page') || 1)
    const skip = (page - 1) * limit
    const kebunIdParam = searchParams.get('kebunId')
    const jobTypeParam = (searchParams.get('jobType') || 'all').toString().toUpperCase().trim()
    const roleParam = (searchParams.get('role') || 'all').toString().toUpperCase().trim()
    const statusParam = (searchParams.get('status') || 'all').toString().toUpperCase().trim()
    const kebunId = kebunIdParam ? Number(kebunIdParam) : undefined

    const orFilters: Prisma.UserWhereInput[] = search
      ? [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ]
      : []

    // Kumpulkan filter utama
    const andFilters: Prisma.UserWhereInput[] = []

    if (orFilters.length > 0) {
      andFilters.push({ OR: orFilters })
    }

    const allowedRoles = ['KARYAWAN', 'SUPIR', 'MANDOR', 'MANAGER']
    if (roleParam !== 'ALL') {
      if (allowedRoles.includes(roleParam)) {
        andFilters.push({ role: roleParam as any })
      } else {
        andFilters.push({ role: { in: allowedRoles } as any })
      }
    } else {
      andFilters.push({ role: { in: allowedRoles } as any })
    }

    if (typeof kebunId !== 'undefined') {
      andFilters.push({ kebunId })
    }

    if (jobTypeParam !== 'ALL') {
      if (jobTypeParam === 'KEBUN') {
        andFilters.push({
          OR: [
            { jobType: { contains: 'KEBUN', mode: 'insensitive' } } as UserWhereWithJobType,
            { jobType: null, kebunId: { not: null } } as UserWhereWithJobType,
          ],
        })
      } else {
        andFilters.push({
          jobType: { contains: jobTypeParam, mode: 'insensitive' },
        } as UserWhereWithJobType)
      }
    }

    if (statusParam === 'AKTIF') {
      andFilters.push({ OR: [{ status: 'AKTIF' }, { status: 'Aktif' }, { status: null }] })
    } else if (statusParam === 'NONAKTIF') {
      andFilters.push({ OR: [{ status: 'NONAKTIF' }, { status: 'Nonaktif' }] })
    } else if (statusParam !== 'ALL') {
      andFilters.push({ status: { contains: statusParam, mode: 'insensitive' } })
    }

    const where: UserWhereWithJobType = {
      AND: andFilters,
    }

    const select: UserSelectWithMeta = {
      id: true,
      name: true,
      email: true,
      photoUrl: true,
      role: true,
      createdAt: true,
      kebunId: true,
      jobType: true,
      status: true,
      kendaraanPlatNomor: true,
    }
    ;(select as any).tanggalMulaiBekerja = true

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select,
      }),
      prisma.user.count({ where }),
    ])

    return NextResponse.json({ data: items, total, page, limit })
  } catch (error) {
    console.error('GET /api/karyawan error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'MANAGER', 'MANDOR','KASIR'])
    if (guard.response) return guard.response
    const body = await request.json()
    const { name, email, password, kebunId, jobType, jenisPekerjaan, status, kendaraanPlatNomor, role, photoUrl, tanggalMulaiBekerja } = body || {}
    if (!name) {
      return NextResponse.json({ error: 'name wajib diisi' }, { status: 400 })
    }

    const rawEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
    if (rawEmail) {
      const exists = await prisma.user.findFirst({
        where: { email: { equals: rawEmail, mode: 'insensitive' } },
        select: { id: true },
      })
      if (exists) {
        return NextResponse.json({ error: 'Email sudah digunakan' }, { status: 409 })
      }
    }

    const finalEmail = rawEmail || `karyawan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@local`
    const rawPassword = typeof password === 'string' && password ? password : crypto.randomBytes(16).toString('hex')
    const passwordHash = await bcrypt.hash(String(rawPassword), 10)
    const allowedRoles = ['KARYAWAN', 'SUPIR', 'MANDOR', 'MANAGER']
    const finalRole = allowedRoles.includes(String(role || '').toUpperCase()) ? String(role).toUpperCase() : 'KARYAWAN'
    const data: UserCreateWithMeta = {
      name,
      email: finalEmail,
      passwordHash,
      role: finalRole as any,
      kebunId: kebunId ? Number(kebunId) : null,
      jobType: (jobType || jenisPekerjaan || '').toString().trim().toUpperCase() || null,
      status: typeof status !== 'undefined' ? String(status).trim().toUpperCase() : 'AKTIF',
      kendaraanPlatNomor: typeof kendaraanPlatNomor !== 'undefined' ? (kendaraanPlatNomor ? String(kendaraanPlatNomor) : null) : null,
    }
    ;(data as any).tanggalMulaiBekerja = parseYmdToDbDate(tanggalMulaiBekerja)
    if (typeof photoUrl !== 'undefined') {
      ;(data as any).photoUrl = photoUrl ? String(photoUrl) : null
    }

    const user = await prisma.user.create({
      data,
      select: { id: true, name: true, email: true, photoUrl: true, createdAt: true },
    })
    return NextResponse.json({ data: user }, { status: 201 })
  } catch (error) {
    console.error('POST /api/karyawan error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
