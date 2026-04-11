import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { z } from 'zod'
import { auth } from '@/auth'
import { createAuditLog } from '@/lib/audit'
import { requireRole } from '@/lib/route-auth'
import { scheduleFileDeletion } from '@/lib/file-retention'

export const dynamic = 'force-dynamic'

const stripTagMarkers = (text: string) => {
  return String(text || '').replace(/\s*\[(KENDARAAN|KEBUN|PERUSAHAAN|KARYAWAN):[^\]]+\]/g, '').trim()
}

const buildDescriptionWithTags = (text: string, tags: { kendaraanPlatNomor?: string | null; kebunId?: string | null; perusahaanId?: string | null; karyawanId?: string | null }) => {
  const base = stripTagMarkers(text)
  const parts: string[] = [base].filter(Boolean)
  if (tags.kendaraanPlatNomor) parts.push(`[KENDARAAN:${tags.kendaraanPlatNomor}]`)
  if (tags.kebunId) parts.push(`[KEBUN:${tags.kebunId}]`)
  if (tags.perusahaanId) parts.push(`[PERUSAHAAN:${tags.perusahaanId}]`)
  if (tags.karyawanId) parts.push(`[KARYAWAN:${tags.karyawanId}]`)
  return parts.join(' ').trim()
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

    const body = await request.json();
    const { tipe, amount, description, date, tagKendaraanPlatNomor, tagKebunId, tagPerusahaanId, tagKaryawanId, gambarUrl } = body;

    const tagGroupCount =
      (tagKendaraanPlatNomor ? 1 : 0) +
      (tagKebunId ? 1 : 0) +
      (tagPerusahaanId ? 1 : 0) +
      (tagKaryawanId ? 1 : 0)
    if (tagGroupCount > 1) {
      return NextResponse.json({ error: 'Pilih salah satu tag: Kendaraan atau Kebun atau Perusahaan atau Karyawan' }, { status: 400 })
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
      karyawanId: tagKaryawanId ? String(tagKaryawanId) : null,
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
    if (existingKas) {
      await prisma.kasTransaksi.update({
        where: { id: existingKas.id },
        data: { deletedAt: new Date(), deletedById: currentUserId } as any,
      })
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
