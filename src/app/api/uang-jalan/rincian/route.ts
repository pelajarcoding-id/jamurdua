import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { z } from 'zod';
import { auth } from '@/auth';
import { createAuditLog } from '@/lib/audit';
import { requireRole } from '@/lib/route-auth';
import { parseWibYmd, wibStartUtc } from '@/lib/wib';
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

export async function POST(request: Request) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR', 'SUPIR'])
    const session = await auth();
    if (!session) return guard.response
    const body = await request.json();
    const { sesiUangJalanId, tipe, amount, description, date, tagKendaraanPlatNomor, tagKebunId, tagPerusahaanId, tagKaryawanId, gambarUrl } = body;

    const sesi = await prisma.sesiUangJalan.findUnique({ where: { id: Number(sesiUangJalanId) } });
    if (!sesi) {
      return NextResponse.json({ error: 'Sesi not found' }, { status: 404 });
    }
    if (session.user?.role === 'SUPIR' && Number(session.user?.id) !== sesi.supirId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const finalDescription = buildDescriptionWithTags(description || '', {
      kendaraanPlatNomor: tagKendaraanPlatNomor || null,
      kebunId: tagKebunId ? String(tagKebunId) : null,
      perusahaanId: tagPerusahaanId ? String(tagPerusahaanId) : null,
      karyawanId: tagKaryawanId ? String(tagKaryawanId) : null,
    })

    const newRincian = await prisma.uangJalan.create({
      data: {
        sesiUangJalanId: Number(sesiUangJalanId),
        tipe,
        amount: Number(amount),
        description: finalDescription || null,
        gambarUrl: gambarUrl || null,
        date: (() => {
          const ymd = parseWibYmd(date)
          return ymd ? wibStartUtc(ymd) : (date ? new Date(date) : undefined)
        })(),
      },
    });

    const currentUserId = session?.user?.id ? Number(session.user.id) : 1;

    await createAuditLog(currentUserId, 'CREATE', 'UangJalan', newRincian.id.toString(), {
      sesiUangJalanId,
      tipe,
      amount,
    });

    return NextResponse.json(newRincian);
  } catch (error) {
    console.error("Error creating rincian uang jalan: ", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
