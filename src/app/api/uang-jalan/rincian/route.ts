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


export async function POST(request: Request) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR', 'SUPIR'])
    const session = await auth();
    if (!session) return guard.response
    const body = await request.json();
    const { sesiUangJalanId, tipe, amount, description, date, tagKendaraanPlatNomor, tagKebunId, tagPerusahaanId, gambarUrl } = body;

    const sesi = await prisma.sesiUangJalan.findUnique({ where: { id: Number(sesiUangJalanId) } });
    if (!sesi) {
      return NextResponse.json({ error: 'Sesi not found' }, { status: 404 });
    }
    if (session.user?.role === 'SUPIR' && Number(session.user?.id) !== sesi.supirId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const tagGroupCount =
      (tagKendaraanPlatNomor ? 1 : 0) +
      (tagKebunId ? 1 : 0) +
      (tagPerusahaanId ? 1 : 0)
    if (tagGroupCount > 1) {
      return NextResponse.json({ error: 'Pilih salah satu tag: Kendaraan atau Kebun atau Perusahaan' }, { status: 400 })
    }

    const finalDescription = buildDescriptionWithTags(description || '', {
      kendaraanPlatNomor: tagKendaraanPlatNomor || null,
      kebunId: tagKebunId ? String(tagKebunId) : null,
      perusahaanId: tagPerusahaanId ? String(tagPerusahaanId) : null,
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

    if (tipe === 'PENGELUARAN') {
      const tagsFromDesc = detectTagsFromDescription(finalDescription)
      const kendaraanPlatNomor = tagsFromDesc.kendaraanPlatNomor || sesi.kendaraanPlatNomor || null
      const kebunId = tagsFromDesc.kebunId ? Number(tagsFromDesc.kebunId) : null
      const perusahaanId = tagsFromDesc.perusahaanId || null
      const kategori = ensureUangJalanKasKategori(tipe, { kendaraanPlatNomor, kebunId: kebunId ? String(kebunId) : null })
      const keteranganKas = [
        stripTagMarkers(finalDescription),
        `Sesi Uang Jalan #${sesi.id}`,
        `[UJ_RINCIAN:${newRincian.id}]`,
        perusahaanId ? `[PERUSAHAAN:${perusahaanId}]` : null,
      ].filter(Boolean).join(' • ')

      await prisma.kasTransaksi.create({
        data: {
          date: newRincian.date,
          tipe: 'PENGELUARAN',
          deskripsi: `Uang Jalan: ${stripTagMarkers(finalDescription) || 'Pengeluaran'}`.slice(0, 200),
          jumlah: newRincian.amount,
          keterangan: keteranganKas.slice(0, 500),
          gambarUrl: newRincian.gambarUrl || null,
          kategori,
          kebunId,
          kendaraanPlatNomor,
          userId: currentUserId,
        },
      })
    }

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
