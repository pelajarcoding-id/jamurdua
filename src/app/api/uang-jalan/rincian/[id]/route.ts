import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { z } from 'zod'
import { auth } from '@/auth'
import { createAuditLog } from '@/lib/audit'
import { requireRole } from '@/lib/route-auth'
import { scheduleFileDeletion } from '@/lib/file-retention'

const stripTagMarkers = (text: string) => {
  return String(text || '').replace(/\s*\[(KENDARAAN|KEBUN|PERUSAHAAN):[^\]]+\]/g, '').trim()
}

const buildDescriptionWithTags = (text: string, tags: { kendaraanPlatNomor?: string | null; kebunId?: string | null; perusahaanId?: string | null }) => {
  const base = stripTagMarkers(text)
  const parts: string[] = [base].filter(Boolean)
  if (tags.kendaraanPlatNomor) parts.push(`[KENDARAAN:${tags.kendaraanPlatNomor}]`)
  if (tags.kebunId) parts.push(`[KEBUN:${tags.kebunId}]`)
  if (tags.perusahaanId) parts.push(`[PERUSAHAAN:${tags.perusahaanId}]`)
  return parts.join(' ').trim()
}

const detectTagsFromDescription = (text: string) => {
  const kendaraan = (text.match(/\[KENDARAAN:([^\]]+)\]/)?.[1] || '').trim()
  const kebun = (text.match(/\[KEBUN:(\d+)\]/)?.[1] || '').trim()
  const perusahaan = (text.match(/\[PERUSAHAAN:(\d+)\]/)?.[1] || '').trim()
  return {
    kendaraanPlatNomor: kendaraan || null,
    kebunId: kebun || null,
    perusahaanId: perusahaan || null,
  }
}

const ensureUangJalanKasKategori = (tipe: string, tags: { kendaraanPlatNomor?: string | null; kebunId?: string | null }) => {
  if (tipe !== 'PENGELUARAN') return 'UMUM'
  if (tags.kendaraanPlatNomor) return 'KENDARAAN'
  if (tags.kebunId) return 'KEBUN'
  return 'UMUM'
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR', 'SUPIR'])
    if (guard.response) return guard.response
    const session = await auth()
    if (!session) return guard.response

    const id = Number(params.id)
    if (!id) return NextResponse.json({ error: 'id tidak valid' }, { status: 400 })

    const existing = await prisma.uangJalan.findUnique({
      where: { id },
      include: { sesiUangJalan: true },
    })
    if (!existing || (existing as any).deletedAt) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (session.user?.role === 'SUPIR' && Number(session.user?.id) !== existing.sesiUangJalan.supirId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const formData = await request.formData()
    const raw = {
      tipe: formData.get('tipe'),
      amount: formData.get('amount'),
      description: formData.get('description'),
      date: formData.get('date'),
      tagKendaraanPlatNomor: formData.get('tagKendaraanPlatNomor'),
      tagKebunId: formData.get('tagKebunId'),
      tagPerusahaanId: formData.get('tagPerusahaanId'),
    }
    const schema = z.object({
      tipe: z.enum(['PENGELUARAN', 'PEMASUKAN']),
      amount: z.coerce.number().nonnegative(),
      description: z.string().trim().max(500).optional(),
      date: z.string().optional(),
      tagKendaraanPlatNomor: z.preprocess((v) => (v === '' ? null : v), z.string().trim().max(32).nullable().optional()),
      tagKebunId: z.preprocess((v) => (v === '' ? null : v), z.coerce.number().int().positive().nullable().optional()),
      tagPerusahaanId: z.preprocess((v) => (v === '' ? null : v), z.coerce.number().int().positive().nullable().optional()),
    })
    const parsed = schema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 })
    }

    const { tipe, amount, description, date, tagKendaraanPlatNomor, tagKebunId, tagPerusahaanId } = parsed.data
    const gambar = formData.get('gambar') as File | null

    const tagGroupCount =
      (tagKendaraanPlatNomor ? 1 : 0) +
      (tagKebunId ? 1 : 0) +
      (tagPerusahaanId ? 1 : 0)
    if (tagGroupCount > 1) {
      return NextResponse.json({ error: 'Pilih salah satu tag: Kendaraan atau Kebun atau Perusahaan' }, { status: 400 })
    }

    let gambarUrl: string | undefined = undefined
    if (gambar) {
      const MAX_BYTES = 5 * 1024 * 1024
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
      if (typeof (gambar as any).size === 'number' && (gambar as any).size > MAX_BYTES) {
        return NextResponse.json({ error: 'File too large' }, { status: 413 })
      }
      if (gambar.type && !allowedTypes.includes(gambar.type)) {
        return NextResponse.json({ error: 'Unsupported file type' }, { status: 415 })
      }
      const bytes = await gambar.arrayBuffer()
      const buffer = Buffer.from(bytes)
      const safeName = gambar.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const fileExtension = safeName.split('.').pop()
      const fileName = `${Date.now()}.${fileExtension}`
      const path = join(process.cwd(), 'public/uploads', fileName)
      await writeFile(path, buffer)
      gambarUrl = `/uploads/${fileName}`
    }

    if (gambarUrl && existing.gambarUrl && existing.gambarUrl !== gambarUrl) {
      await scheduleFileDeletion({
        url: existing.gambarUrl,
        entity: 'UangJalan',
        entityId: String(id),
        reason: 'REPLACE_IMAGE',
      })
    }

    const finalDescription = buildDescriptionWithTags(description || '', {
      kendaraanPlatNomor: tagKendaraanPlatNomor || null,
      kebunId: tagKebunId ? String(tagKebunId) : null,
      perusahaanId: tagPerusahaanId ? String(tagPerusahaanId) : null,
    })

    const updated = await prisma.uangJalan.update({
      where: { id },
      data: {
        tipe,
        amount: Number(amount),
        description: finalDescription || null,
        ...(date ? { date: new Date(date) } : {}),
        ...(gambarUrl ? { gambarUrl } : {}),
      },
    })

    const currentUserId = session?.user?.id ? Number(session.user.id) : guard.id

    const marker = `[UJ_RINCIAN:${id}]`
    const existingKas = await prisma.kasTransaksi.findFirst({
      where: { deletedAt: null, keterangan: { contains: marker } },
      select: { id: true },
    })

    if (updated.tipe === 'PENGELUARAN') {
      const tagsFromDesc = detectTagsFromDescription(finalDescription)
      const kendaraanPlatNomor = tagsFromDesc.kendaraanPlatNomor || existing.sesiUangJalan.kendaraanPlatNomor || null
      const kebunId = tagsFromDesc.kebunId ? Number(tagsFromDesc.kebunId) : null
      const perusahaanId = tagsFromDesc.perusahaanId || null
      const kategori = ensureUangJalanKasKategori('PENGELUARAN', { kendaraanPlatNomor, kebunId: kebunId ? String(kebunId) : null })
      const keteranganKas = [
        stripTagMarkers(finalDescription),
        `Sesi Uang Jalan #${existing.sesiUangJalanId}`,
        marker,
        perusahaanId ? `[PERUSAHAAN:${perusahaanId}]` : null,
      ].filter(Boolean).join(' • ')

      if (existingKas) {
        await prisma.kasTransaksi.update({
          where: { id: existingKas.id },
          data: {
            date: updated.date,
            tipe: 'PENGELUARAN',
            deskripsi: `Uang Jalan: ${stripTagMarkers(finalDescription) || 'Pengeluaran'}`.slice(0, 200),
            jumlah: updated.amount,
            keterangan: keteranganKas.slice(0, 500),
            gambarUrl: updated.gambarUrl || null,
            kategori,
            kebunId,
            kendaraanPlatNomor,
            userId: currentUserId,
          },
        })
      } else {
        await prisma.kasTransaksi.create({
          data: {
            date: updated.date,
            tipe: 'PENGELUARAN',
            deskripsi: `Uang Jalan: ${stripTagMarkers(finalDescription) || 'Pengeluaran'}`.slice(0, 200),
            jumlah: updated.amount,
            keterangan: keteranganKas.slice(0, 500),
            gambarUrl: updated.gambarUrl || null,
            kategori,
            kebunId,
            kendaraanPlatNomor,
            userId: currentUserId,
          },
        })
      }
    } else {
      if (existingKas) {
        await prisma.kasTransaksi.update({
          where: { id: existingKas.id },
          data: { deletedAt: new Date(), deletedById: currentUserId } as any,
        })
      }
    }

    await createAuditLog(currentUserId, 'UPDATE', 'UangJalan', String(id), {
      before: {
        tipe: existing.tipe,
        amount: existing.amount,
        description: existing.description,
        date: existing.date,
        gambarUrl: existing.gambarUrl,
      },
      after: {
        tipe: updated.tipe,
        amount: updated.amount,
        description: updated.description,
        date: updated.date,
        gambarUrl: updated.gambarUrl,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating rincian uang jalan:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR', 'SUPIR'])
    if (guard.response) return guard.response
    const session = await auth()
    if (!session) return guard.response

    const id = Number(params.id)
    if (!id) return NextResponse.json({ error: 'id tidak valid' }, { status: 400 })

    const existing = await prisma.uangJalan.findUnique({
      where: { id },
      include: { sesiUangJalan: true },
    })
    if (!existing || (existing as any).deletedAt) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (session.user?.role === 'SUPIR' && Number(session.user?.id) !== existing.sesiUangJalan.supirId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await prisma.uangJalan.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: session?.user?.id ? Number(session.user.id) : guard.id } as any,
    })

    const currentUserId = session?.user?.id ? Number(session.user.id) : guard.id
    const marker = `[UJ_RINCIAN:${id}]`
    const existingKas = await prisma.kasTransaksi.findFirst({
      where: { deletedAt: null, keterangan: { contains: marker } },
      select: { id: true },
    })
    if (existingKas) {
      await prisma.kasTransaksi.update({
        where: { id: existingKas.id },
        data: { deletedAt: new Date(), deletedById: currentUserId } as any,
      })
    }

    if (existing.gambarUrl) {
      await scheduleFileDeletion({
        url: existing.gambarUrl,
        entity: 'UangJalan',
        entityId: String(id),
        reason: 'DELETE_RINCIAN',
      })
    }

    await createAuditLog(currentUserId, 'DELETE', 'UangJalan', String(id), {
      sesiUangJalanId: existing.sesiUangJalanId,
      tipe: existing.tipe,
      amount: existing.amount,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error deleting rincian uang jalan:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
