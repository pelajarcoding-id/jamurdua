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
    const formData = await request.formData();
    const raw = {
      sesiUangJalanId: formData.get('sesiUangJalanId'),
      tipe: formData.get('tipe'),
      amount: formData.get('amount'),
      description: formData.get('description'),
      date: formData.get('date'),
      tagKendaraanPlatNomor: formData.get('tagKendaraanPlatNomor'),
      tagKebunId: formData.get('tagKebunId'),
      tagPerusahaanId: formData.get('tagPerusahaanId'),
    };
    const schema = z.object({
      sesiUangJalanId: z.coerce.number().int().positive(),
      tipe: z.enum(['PENGELUARAN', 'PEMASUKAN']),
      amount: z.coerce.number().nonnegative(),
      description: z.string().trim().max(500).optional(),
      date: z.string().optional(),
      tagKendaraanPlatNomor: z.preprocess((v) => (v === '' ? null : v), z.string().trim().max(32).nullable().optional()),
      tagKebunId: z.preprocess((v) => (v === '' ? null : v), z.coerce.number().int().positive().nullable().optional()),
      tagPerusahaanId: z.preprocess((v) => (v === '' ? null : v), z.coerce.number().int().positive().nullable().optional()),
    });
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
    }
    const { sesiUangJalanId, tipe, amount, description, date, tagKendaraanPlatNomor, tagKebunId, tagPerusahaanId } = parsed.data;
    const gambar = formData.get('gambar') as File | null;

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

    let gambarUrl: string | undefined = undefined;
    if (gambar) {
        const MAX_BYTES = 5 * 1024 * 1024;
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (typeof (gambar as any).size === 'number' && (gambar as any).size > MAX_BYTES) {
          return NextResponse.json({ error: 'File too large' }, { status: 413 });
        }
        if (gambar.type && !allowedTypes.includes(gambar.type)) {
          return NextResponse.json({ error: 'Unsupported file type' }, { status: 415 });
        }
        const bytes = await gambar.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const safeName = gambar.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const fileExtension = safeName.split('.').pop();
        const fileName = `${Date.now()}.${fileExtension}`;
        const path = join(process.cwd(), 'public/uploads', fileName);
        await writeFile(path, buffer);
        gambarUrl = `/uploads/${fileName}`;
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
        gambarUrl,
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
